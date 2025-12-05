"""
Qwen 2.5 VL Caption Service
Loads Qwen2.5-VL-7B-Instruct-Q8_0.gguf and provides captioning API
"""

import os
import base64
import io
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
from llama_cpp import Llama
from llama_cpp.llama_chat_format import Llava15ChatHandler
import logging
from pathlib import Path

# Load .env.caption file if it exists (for local development only)
# NOTE: This file is NOT required and won't exist in production
# Production automatically uses /workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf
env_file = Path(__file__).parent / '.env.caption'
if env_file.exists():
    logger.info("Loading configuration from .env.caption (dev mode)")
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()
else:
    logger.info("No .env.caption file found - using environment defaults (production mode)")

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
# DEV MODE: Set environment variable DEV_MODEL_PATH for local development
# PRODUCTION: Uses /workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf
DEV_MODEL_PATH = os.getenv('DEV_MODEL_PATH')
if DEV_MODEL_PATH:
    MODEL_PATH = DEV_MODEL_PATH
    logger.info(f"🔧 DEV MODE: Using model from {MODEL_PATH}")
else:
    MODEL_PATH = os.path.join("/workspace", "models", "Qwen2.5-VL-7B-Instruct-Q8_0.gguf")
    logger.info(f"🚀 PRODUCTION MODE: Using model from {MODEL_PATH}")

# GPU configuration
N_GPU_LAYERS = int(os.getenv('N_GPU_LAYERS', '-1'))  # -1 = all layers on GPU
N_CTX = int(os.getenv('N_CTX', '4096'))

# Check if model exists
if not os.path.exists(MODEL_PATH):
    logger.error(f"❌ Model file not found at: {MODEL_PATH}")
    logger.error("Please ensure the model is downloaded before starting the service.")
    if not DEV_MODEL_PATH:
        logger.error("In production, the RunPod startup script should download it automatically.")
    else:
        logger.error("In dev mode, set DEV_MODEL_PATH in .env.caption to your model location.")
    logger.error("")
    logger.error("Example .env.caption file:")
    logger.error("  DEV_MODEL_PATH=C:\\Models\\Qwen2.5-VL-7B-Instruct-Q8_0.gguf")

# Global model
model = None

# Default caption prompt template - inspired by SECourses approach
DEFAULT_CAPTION_PROMPT = """You are an expert image captioner for AI training datasets. Analyze this image and provide a detailed, descriptive caption.

Requirements:
- Write a single, continuous caption (no bullet points or sections)
- Be extremely detailed about: composition, subjects, poses, expressions, clothing, colors, lighting, background, atmosphere
- Use natural, descriptive language as if describing a photograph
- Do NOT use words like: rendered, hyperrealistic, digital art, artwork, painting, illustration
- Use professional photography terminology where appropriate
- Caption should be 100-200 words
- Focus on what IS in the image, not interpretations

Respond with ONLY the caption, no explanations or prefixes."""


def load_model():
    """Load the Qwen 2.5 VL GGUF model"""
    global model
    
    try:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model file not found at: {MODEL_PATH}")
        
        logger.info(f"Loading Qwen 2.5 VL GGUF model from {MODEL_PATH}...")
        logger.info(f"Configuration: n_gpu_layers={N_GPU_LAYERS}, n_ctx={N_CTX}")
        logger.info("This may take a few minutes on first load...")
        
        # Load GGUF model with llama-cpp-python
        # For vision models, we need to use the multimodal chat format
        model = Llama(
            model_path=MODEL_PATH,
            n_ctx=N_CTX,
            n_gpu_layers=N_GPU_LAYERS,
            verbose=False,
            chat_format="llava-1-5",  # Qwen2-VL uses similar multimodal format
        )
        
        logger.info("✅ Qwen 2.5 VL GGUF model loaded successfully!")
        
    except Exception as e:
        logger.error(f"❌ Error loading model: {e}")
        raise


def generate_caption_internal(image: Image.Image, prompt: str = None, temperature: float = 0.7) -> str:
    """Generate caption for an image using GGUF model"""
    if model is None:
        raise RuntimeError("Model not loaded")
    
    prompt = prompt or DEFAULT_CAPTION_PROMPT
    
    # Convert image to base64 for llama-cpp-python
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG")
    img_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    # Prepare the conversation format for Qwen2-VL (vision model)
    # llama-cpp-python expects a specific format for vision models
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}},
                {"type": "text", "text": prompt}
            ]
        }
    ]
    
    # Generate with llama-cpp-python
    try:
        response = model.create_chat_completion(
            messages=messages,
            temperature=temperature,
            max_tokens=512,
            top_p=0.9,
        )
        
        # Extract caption from response
        caption = response['choices'][0]['message']['content'].strip()
        
        # Clean up the response - remove any prefixes or formatting
        prefixes = [
            "caption:", "here's the caption:", "here is the caption:", "the caption is:",
            "description:", "here's the description:", "here is the description:",
            "assistant:", "answer:", "image:"
        ]
        caption_lower = caption.lower()
        for prefix in prefixes:
            if caption_lower.startswith(prefix):
                caption = caption[len(prefix):].strip()
                break
        
        return caption
        
    except Exception as e:
        logger.error(f"Error generating caption: {e}")
        raise


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    model_info = {
        'status': 'ok' if model is not None else 'model_not_loaded',
        'model_loaded': model is not None,
        'model_path': MODEL_PATH,
        'model_exists': os.path.exists(MODEL_PATH),
        'dev_mode': DEV_MODEL_PATH is not None,
        'gpu_layers': N_GPU_LAYERS,
    }
    
    status_code = 200 if model is not None else 503
    return jsonify(model_info), status_code


@app.route('/caption', methods=['POST'])
def caption():
    """Generate caption for an image"""
    try:
        data = request.json
        
        if 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400
        
        # Decode base64 image
        image_b64 = data['image']
        image_bytes = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        
        # Get parameters
        prompt = data.get('prompt')
        temperature = data.get('temperature', 0.7)
        
        # Generate caption
        caption = generate_caption_internal(image, prompt, temperature)
        
        return jsonify({
            'success': True,
            'caption': caption
        })
        
    except Exception as e:
        logger.error(f"Error generating caption: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    logger.info("Starting Qwen 2.5 VL Caption Service...")
    load_model()
    
    # Run on port 11435 (different from Ollama's 11434)
    port = int(os.getenv('PORT', 11435))
    logger.info(f"Server starting on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)

