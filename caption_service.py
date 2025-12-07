"""
Qwen 2.5 VL Caption Service
Loads Qwen2.5-VL-7B-Instruct-Q8_0.gguf and provides captioning API
Includes VRAM optimization: Loads on demand, unloads after inactivity
"""

import os
import base64
import io
import time
import threading
import gc
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
from llama_cpp import Llama
from llama_cpp.llama_chat_format import Llava15ChatHandler
import logging
from pathlib import Path

# Load .env.caption file if it exists (for local development only)
env_file = Path(__file__).parent / '.env.caption'
if env_file.exists():
    logging.info("Loading configuration from .env.caption (dev mode)")
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
DEV_MODEL_PATH = os.getenv('DEV_MODEL_PATH')
DEV_MMPROJ_PATH = os.getenv('DEV_MMPROJ_PATH')

if DEV_MODEL_PATH:
    MODEL_PATH = DEV_MODEL_PATH
    MMPROJ_PATH = DEV_MMPROJ_PATH
    logger.info(f"🔧 DEV MODE: Using model from {MODEL_PATH}")
    if MMPROJ_PATH:
        logger.info(f"🔧 DEV MODE: Using mmproj from {MMPROJ_PATH}")
else:
    # Qwen 2.5 VL - requires both model and mmproj (vision encoder)
    # From unsloth/Qwen2.5-VL-7B-Instruct-GGUF repo
    MODEL_PATH = os.path.join("/workspace", "models", "Qwen2.5-VL-7B-Instruct-Q8_0.gguf")
    MMPROJ_PATH = os.path.join("/workspace", "models", "mmproj-F16.gguf")
    
    logger.info(f"🚀 PRODUCTION MODE: Using model path: {MODEL_PATH}")
    logger.info(f"🚀 PRODUCTION MODE: Using mmproj path: {MMPROJ_PATH}")

# GPU configuration
try:
    import torch
    has_gpu = torch.cuda.is_available()
except ImportError:
    has_gpu = False

if not has_gpu:
    logging.warning("⚠️ GPU not detected! Forcing CPU mode (n_gpu_layers=0)")
    N_GPU_LAYERS = 0
else:
    N_GPU_LAYERS = int(os.getenv('N_GPU_LAYERS', '-1'))  # -1 = all layers on GPU

N_CTX = int(os.getenv('N_CTX', '4096'))
UNLOAD_TIMEOUT = 180  # 3 minutes in seconds

# Global state
model = None
last_activity = 0
unload_timer = None
model_lock = threading.Lock()

# Caption generation status (for UI updates)
caption_status = {
    'status': 'idle',  # idle, loading_model, generating, completed, error
    'message': '',
    'progress': 0
}
status_lock = threading.Lock()

# Default caption prompt template
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

def unload_model_job():
    """Background job to unload model after timeout"""
    global model, unload_timer
    
    while True:
        time.sleep(10)
        with model_lock:
            if model is not None:
                elapsed = time.time() - last_activity
                if elapsed > UNLOAD_TIMEOUT:
                    logger.info(f"⏳ Inactivity timeout ({elapsed:.1f}s). Unloading model to free VRAM...")
                    del model
                    model = None
                    gc.collect()
                    logger.info("✅ Model unloaded. VRAM freed.")

def start_unload_timer():
    """Start the background thread for unloading"""
    global unload_timer
    if unload_timer is None:
        unload_timer = threading.Thread(target=unload_model_job, daemon=True)
        unload_timer.start()
        logger.info("⏰ Auto-unload timer started")

def ensure_model_loaded():
    """Load the Qwen 2.5 VL GGUF model if not already loaded"""
    global model, last_activity
    
    # Update activity timestamp
    last_activity = time.time()
    
    if model is not None:
        return

    logger.info(f"🔄 Loading Qwen 2.5 VL GGUF model from {MODEL_PATH}...")
    
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found at: {MODEL_PATH}")
    
    if not os.path.exists(MMPROJ_PATH):
        raise FileNotFoundError(f"Vision encoder (mmproj) not found at: {MMPROJ_PATH}")
    
    try:
        # Load GGUF model with llama-cpp-python
        # Qwen 2.5 VL requires both the model and mmproj (vision encoder)
        logger.info(f"📷 Loading vision encoder from {MMPROJ_PATH}...")
        
        # Try to create a Llava15ChatHandler for multimodal support
        try:
            from llama_cpp.llama_chat_format import Llava15ChatHandler
            chat_handler = Llava15ChatHandler(clip_model_path=MMPROJ_PATH)
            logger.info("✅ Created Llava15ChatHandler with vision encoder")
            
            model = Llama(
                model_path=MODEL_PATH,
                chat_handler=chat_handler,
                n_ctx=N_CTX,
                n_gpu_layers=N_GPU_LAYERS,
                verbose=False,
            )
        except Exception as handler_error:
            # Fallback: Load without explicit handler, use qwen format
            logger.warning(f"Could not use Llava15ChatHandler: {handler_error}")
            logger.info("Trying alternative: qwen chat format with mmproj...")
            
            model = Llama(
                model_path=MODEL_PATH,
                chat_format="qwen",  # Use Qwen's native format
                clip_model_path=MMPROJ_PATH,  # Vision encoder
                n_ctx=N_CTX,
                n_gpu_layers=N_GPU_LAYERS,
                verbose=False,
            )
        
        logger.info("✅ Qwen 2.5 VL model loaded successfully with vision support!")
        
        # Start timer if not running
        start_unload_timer()
        
    except Exception as e:
        logger.error(f"❌ Error loading model: {e}")
        raise

def apply_word_replacements(text: str, replace_words: str, case_insensitive: bool = True, whole_words: bool = True) -> str:
    """Apply word replacements to caption"""
    import re
    
    if not replace_words or not replace_words.strip():
        return text
    
    result = text
    lines = replace_words.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line or ';' not in line:
            continue
        
        parts = line.split(';', 1)
        if len(parts) != 2:
            continue
        
        original, replacement = parts[0].strip(), parts[1].strip()
        if not original:
            continue
        
        # Build regex pattern
        if whole_words:
            pattern = r'\b' + re.escape(original) + r'\b'
        else:
            pattern = re.escape(original)
        
        flags = re.IGNORECASE if case_insensitive else 0
        result = re.sub(pattern, replacement, result, flags=flags)
    
    return result

def update_status(status: str, message: str, progress: int = 0):
    """Update caption generation status"""
    global caption_status
    with status_lock:
        caption_status = {
            'status': status,
            'message': message,
            'progress': progress
        }
        logger.info(f"📊 Status: {status} - {message}")

def generate_caption_internal(
    image: Image.Image, 
    prompt: str = None, 
    temperature: float = 0.7,
    top_k: int = 50,
    top_p: float = 0.95,
    repetition_penalty: float = 1.05,
    prefix: str = '',
    suffix: str = '',
    replace_words: str = '',
    replace_case_insensitive: bool = True,
    replace_whole_words: bool = True
) -> str:
    """Generate caption for an image using GGUF model"""
    with model_lock:
        update_status('loading_model', 'Loading vision model...', 10)
        ensure_model_loaded()
        
        if model is None:
            update_status('error', 'Failed to load model', 0)
            raise RuntimeError("Failed to load model")
        
        prompt = prompt or DEFAULT_CAPTION_PROMPT
        
        # Convert image to base64 for llama-cpp-python
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG")
        img_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        # Prepare messages
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}},
                    {"type": "text", "text": prompt}
                ]
            }
        ]
        
        # Generate
        try:
            update_status('generating', 'Generating caption... (this may take 5-10 minutes on CPU)', 50)
            response = model.create_chat_completion(
                messages=messages,
                temperature=temperature,
                max_tokens=512,
                top_p=top_p,
                top_k=top_k,
                repeat_penalty=repetition_penalty,
            )
            update_status('generating', 'Processing response...', 90)
            
            # Update activity
            global last_activity
            last_activity = time.time()
            
            # Extract caption
            caption = response['choices'][0]['message']['content'].strip()
            
            logger.info(f"📝 Raw caption generated: {caption[:200]}..." if len(caption) > 200 else f"📝 Raw caption: {caption}")
            
            # Clean up prefixes
            prefixes = [
                "caption:", "here's the caption:", "here is the caption:", "the caption is:",
                "description:", "here's the description:", "here is the description:",
                "assistant:", "answer:", "image:"
            ]
            caption_lower = caption.lower()
            for prefix_text in prefixes:
                if caption_lower.startswith(prefix_text):
                    caption = caption[len(prefix_text):].strip()
                    break
            
            # Apply word replacements
            if replace_words:
                caption = apply_word_replacements(caption, replace_words, replace_case_insensitive, replace_whole_words)
            
            # Apply prefix and suffix
            if prefix:
                caption = prefix + caption
            if suffix:
                caption = caption + suffix
            
            logger.info(f"✅ Final caption ({len(caption)} chars): {caption[:200]}..." if len(caption) > 200 else f"✅ Final caption: {caption}")
            
            return caption
            
        except Exception as e:
            logger.error(f"Error generating caption: {e}")
            raise

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    # Check if BOTH model files exist (model + vision encoder)
    model_exists = os.path.exists(MODEL_PATH)
    mmproj_exists = os.path.exists(MMPROJ_PATH)
    both_exist = model_exists and mmproj_exists
    
    # Calculate download progress if model is being downloaded
    download_status = None
    if not both_exist:
        model_dir = os.path.dirname(MODEL_PATH)
        model_filename = os.path.basename(MODEL_PATH)
        mmproj_filename = os.path.basename(MMPROJ_PATH)
        
        # Check if partial download exists
        temp_files = []
        if os.path.exists(model_dir):
            temp_files = [f for f in os.listdir(model_dir) 
                         if (model_filename in f or mmproj_filename in f) and '.tmp' in f]
        
        if temp_files:
            download_status = 'downloading'
        else:
            download_status = 'not_started'
    
    return jsonify({
        'status': 'ok' if both_exist else 'waiting_for_model',
        'model_loaded': model is not None,
        'model_path': MODEL_PATH,
        'mmproj_path': MMPROJ_PATH,
        'model_exists': model_exists,
        'mmproj_exists': mmproj_exists,
        'download_status': download_status,
        'vram_free': model is None,
        'ready': both_exist  # UI can check this
    })

@app.route('/status', methods=['GET'])
def get_status():
    """Get current caption generation status"""
    with status_lock:
        return jsonify(caption_status)

@app.route('/caption', methods=['POST'])
def caption():
    """Generate caption for an image"""
    try:
        update_status('starting', 'Starting caption generation...', 0)
        
        data = request.json
        
        if 'image' not in data:
            update_status('error', 'No image provided', 0)
            return jsonify({'error': 'No image provided'}), 400
        
        # Decode base64 image
        image_b64 = data['image']
        image_bytes = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        
        # Get parameters
        prompt = data.get('customPrompt') or data.get('prompt')
        temperature = float(data.get('temperature', 0.7))
        top_k = int(data.get('topK', 50))
        top_p = float(data.get('topP', 0.95))
        repetition_penalty = float(data.get('repetitionPenalty', 1.05))
        prefix = data.get('prefix', '')
        suffix = data.get('suffix', '')
        replace_words = data.get('replaceWords', '')
        replace_case_insensitive = data.get('replaceCaseInsensitive', True)
        replace_whole_words = data.get('replaceWholeWordsOnly', True)
        
        # Generate caption
        caption = generate_caption_internal(
            image=image,
            prompt=prompt,
            temperature=temperature,
            top_k=top_k,
            top_p=top_p,
            repetition_penalty=repetition_penalty,
            prefix=prefix,
            suffix=suffix,
            replace_words=replace_words,
            replace_case_insensitive=replace_case_insensitive,
            replace_whole_words=replace_whole_words
        )
        
        update_status('completed', 'Caption generated successfully!', 100)
        
        logger.info(f"🎉 Caption request completed successfully")
        
        return jsonify({
            'success': True,
            'caption': caption
        })
        
    except Exception as e:
        logger.error(f"Error generating caption: {e}")
        update_status('error', f'Error: {str(e)}', 0)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/unload', methods=['POST'])
def unload_model():
    """Manually unload model to free VRAM (e.g., after bulk processing)"""
    global model
    with model_lock:
        if model is not None:
            del model
            model = None
            gc.collect()
            logger.info("✅ Model manually unloaded")
            return jsonify({'success': True, 'message': 'Model unloaded'})
        else:
            return jsonify({'success': True, 'message': 'Model was already unloaded'})

if __name__ == '__main__':
    logger.info("Starting Qwen 2.5 VL Caption Service...")
    
    # Don't load model on startup anymore - load on demand!
    # load_model()
    
    # Run on port 11435
    port = int(os.getenv('PORT', 11435))
    logger.info(f"Server starting on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
