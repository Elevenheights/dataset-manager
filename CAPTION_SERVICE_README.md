# Qwen 2.5 VL Caption Service (GGUF)

This caption service uses the **Qwen 2.5 VL 7B** model in GGUF format (`Qwen2.5-VL-7B-Instruct-Q8_0.gguf`) to generate high-quality captions for your dataset images.

## Quick Start

### 1. Download the Model

**For RunPod/Production:**
The `runpod_start.sh` script automatically downloads the model to `/workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf`

**For Local Development:**
1. Download from HuggingFace:
   ```bash
   huggingface-cli download Qwen/Qwen2.5-VL-7B-Instruct-GGUF \
     Qwen2.5-VL-7B-Instruct-Q8_0.gguf \
     --local-dir ./models \
     --local-dir-use-symlinks False
   ```

2. Copy `.env.caption.example` to `.env.caption`:
   ```bash
   cp .env.caption.example .env.caption
   ```

3. Edit `.env.caption` and set your model path:
   ```bash
   # Windows example:
   DEV_MODEL_PATH=C:\Models\Qwen2.5-VL-7B-Instruct-Q8_0.gguf
   
   # Linux/Mac example:
   DEV_MODEL_PATH=/home/user/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf
   ```

### 2. Start the Caption Service

**On Windows (Development):**
```bash
start_caption_service.bat
```

**On Linux/Mac (Development):**
```bash
python3 -m venv venv_caption
source venv_caption/bin/activate

# Install with GPU support
CMAKE_ARGS="-DLLAMA_CUBLAS=on" pip install llama-cpp-python --force-reinstall --upgrade --no-cache-dir
pip install -r requirements_caption.txt

python caption_service.py
```

**On RunPod (Production):**
The `runpod_start.sh` script automatically sets everything up.

The service will start on `http://localhost:11435`

### 3. Use the Dataset Manager

Once the caption service is running:
1. Start the dataset manager: `npm run dev`
2. Upload your dataset
3. Go to the Caption page
4. Click "Bulk Caption" to caption all images using Qwen 2.5 VL

## Development Mode

For local development, you can specify a custom model location:

1. Copy `.env.caption.example` to `.env.caption`
2. Edit and set your model path:
   ```bash
   DEV_MODEL_PATH=C:\Models\Qwen2.5-VL-7B-Instruct-Q8_0.gguf
   ```
3. Start the service - it will automatically use your local model

See `DEV_SETUP.md` for detailed development instructions.

## System Requirements

### Minimum (CPU Only)
- **RAM:** 16GB+ 
- **Storage:** 15GB free space for model
- **Performance:** ~10-30 seconds per image

### Recommended (GPU)
- **GPU:** NVIDIA GPU with 8GB+ VRAM (RTX 3060 or better)
- **RAM:** 16GB+ system RAM
- **CUDA:** 12.9 or compatible
- **Performance:** ~1-3 seconds per image

## API

The caption service provides a simple REST API:

**POST** `/caption` - Generate caption for an image
```json
{
  "image": "base64_encoded_image",
  "temperature": 0.7,
  "prompt": "optional custom prompt"
}
```

**GET** `/health` - Check service status

## Caption Quality

The Qwen 2.5 VL model provides:
- ✅ Detailed, natural language descriptions
- ✅ Professional photography terminology
- ✅ 100-200 word captions optimized for LoRA training
- ✅ Consistent style across your dataset
- ✅ No "rendered" or "digital art" artifacts

## Troubleshooting

### "Model file not found"
- The service will use the base Qwen model from HuggingFace
- For best results, download the custom model using the training system

### "CUDA out of memory"
- Reduce batch processing
- Close other GPU applications
- Use CPU mode (slower but works)

### "Connection refused"
- Ensure the caption service is running
- Check that port 11435 is not blocked
- Verify the service started without errors

### Slow performance
- **GPU:** Enable CUDA and ensure drivers are up to date
- **CPU:** This is normal - captioning is compute-intensive
- **Network:** First run downloads the base model (~14GB)

## Advanced Configuration

### Change Port
```bash
# Set environment variable before starting
PORT=8080 python caption_service.py
```

### Custom Model Path
Edit `caption_service.py` and change:
```python
MODEL_PATH = "path/to/your/model.safetensors"
```

### Adjust Temperature
Lower temperature = more deterministic captions
Higher temperature = more creative captions

Default is 0.7 (good balance)

## Performance Tips

1. **Batch Processing:** Use "Bulk Caption" for multiple images
2. **GPU Acceleration:** Ensure CUDA is properly installed
3. **Keep Service Running:** No need to restart between datasets
4. **Monitor Memory:** Close unused applications when captioning large datasets

## Support

If you encounter issues:
1. Check the console output for error messages
2. Verify model file exists and is not corrupted
3. Ensure Python dependencies are correctly installed
4. Try running with `--debug` flag for verbose logging

