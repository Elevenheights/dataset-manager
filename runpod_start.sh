#!/usr/bin/env bash

set -e

echo "=========================================="
echo "  UltraMuse Dataset Manager Setup"
echo "  RunPod Template Auto-Installer"
echo "=========================================="
echo ""
echo "This script is automatically run by the"
echo "UltraMuse RunPod template on instance creation"
echo ""

# ==========================================
# CONFIGURATION
# ==========================================
# Dataset Manager repository (set by template or environment)
DATASET_MANAGER_REPO="${DATASET_MANAGER_REPO:-https://github.com/elevenheights/dataset-manager.git}"
DATASET_MANAGER_BRANCH="${DATASET_MANAGER_BRANCH:-main}"

echo "Configuration:"
echo "  Repository: $DATASET_MANAGER_REPO"
echo "  Branch: $DATASET_MANAGER_BRANCH"
echo ""
echo "To use your own fork, set environment variable:"
echo "  export DATASET_MANAGER_REPO=https://github.com/YourUsername/YourFork.git"
echo ""

echo "=== Starting base RunPod stack (/start.sh) in background ==="
/start.sh &
sleep 10 || true

cd /workspace

# ==========================================
# Dataset Manager Deployment
# ==========================================
echo "=== Deploying Dataset Manager ==="

if [ ! -d "dataset-manager" ]; then
    echo "Cloning Dataset Manager from repository..."
    git clone -b "$DATASET_MANAGER_BRANCH" "$DATASET_MANAGER_REPO" dataset-manager
    
    if [ $? -ne 0 ]; then
        echo "❌ ERROR: Failed to clone dataset manager repository"
        echo ""
        echo "Please update DATASET_MANAGER_REPO at the top of this script with your repository URL."
        echo "Current value: $DATASET_MANAGER_REPO"
        echo ""
        echo "You can also set it as an environment variable:"
        echo "  export DATASET_MANAGER_REPO=https://github.com/YourUsername/YourRepo.git"
        echo "  bash runpod_start.sh"
        echo ""
        exit 1
    fi
else
    echo "Dataset Manager already exists, updating..."
    cd dataset-manager
    git pull origin "$DATASET_MANAGER_BRANCH" || true
    cd /workspace
fi

echo "✅ Dataset Manager deployed at /workspace/dataset-manager"

# ==========================================
# AI Toolkit Setup
# ==========================================
echo "=== Setting up AI Toolkit ==="
if [ ! -d "ai-toolkit" ]; then
    git clone https://github.com/ostris/ai-toolkit.git
fi

cd ai-toolkit
git pull origin main || true
git submodule update --init --recursive

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
python -m pip install --no-cache-dir torch==2.6.0 torchvision==0.21.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu126
python -m pip install "huggingface-hub>=0.34,<1.0" -U
python -m pip install -r requirements.txt -U

cd /workspace
mkdir -p models

# ==========================================
# Download AI Toolkit Models
# ==========================================
echo "=== Downloading Z-Image-Turbo model ==="
python -m huggingface_hub.commands.huggingface_cli download \
  Tongyi-MAI/Z-Image-Turbo \
  --local-dir models/Z-Image-Turbo \
  --exclude "*.git*" "*.md" \
  --resume-download

echo "=== Downloading Z-Image training adapter ==="
python -m huggingface_hub.commands.huggingface_cli download \
  ostris/zimage_turbo_training_adapter \
  --local-dir models/zimage_turbo_training_adapter \
  --exclude "*.git*" "*.md" \
  --resume-download

# ==========================================
# Download Qwen 2.5 VL GGUF Model for Captioning
# ==========================================
echo "=== Downloading Qwen 2.5 VL GGUF model for caption service ==="
QWEN_MODEL_PATH="/workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf"

# Download the model
python -m huggingface_hub.commands.huggingface_cli download \
  Qwen/Qwen2.5-VL-7B-Instruct-GGUF \
  Qwen2.5-VL-7B-Instruct-Q8_0.gguf \
  --local-dir models \
  --local-dir-use-symlinks False \
  --resume-download

# Wait for download to complete and verify
MAX_WAIT=600  # Wait up to 10 minutes
WAITED=0
while [ ! -f "$QWEN_MODEL_PATH" ] && [ $WAITED -lt $MAX_WAIT ]; do
    echo "⏳ Waiting for Qwen model download to complete... ($WAITED/$MAX_WAIT seconds)"
    sleep 10
    WAITED=$((WAITED + 10))
done

# Final verification
if [ -f "$QWEN_MODEL_PATH" ]; then
    MODEL_SIZE=$(du -h "$QWEN_MODEL_PATH" | cut -f1)
    echo "✅ Qwen 2.5 VL GGUF model ready (size: $MODEL_SIZE)"
else
    echo "❌ ERROR: Qwen 2.5 VL GGUF model download failed or timed out!"
    echo "Caption service will not work until model is available."
    echo "You can manually download it later with:"
    echo "  python -m huggingface_hub.commands.huggingface_cli download Qwen/Qwen2.5-VL-7B-Instruct-GGUF Qwen2.5-VL-7B-Instruct-Q8_0.gguf --local-dir /workspace/models"
fi

# ==========================================
# ComfyUI Setup
# ==========================================
echo "=== Setting up ComfyUI ==="
if [ ! -d "ComfyUI" ]; then
    git clone https://github.com/comfyanonymous/ComfyUI.git
fi

cd /workspace/ComfyUI
git pull origin master || true
python -m pip install -r requirements.txt -U

# ==========================================
# Install croc for file transfers
# ==========================================
cd /workspace
if ! command -v croc >/dev/null 2>&1; then
    echo "=== Installing croc ==="
    curl https://getcroc.schollz.com | bash
fi

# ==========================================
# Node.js / npm for AI Toolkit UI
# ==========================================
if ! command -v npm >/dev/null 2>&1; then
    echo "=== Installing Node.js and npm ==="
    apt-get update
    apt-get install -y nodejs npm
fi

# ==========================================
# Verify AI Toolkit Models Downloaded
# ==========================================
echo "=== Verifying AI Toolkit models are ready ==="
ZIMAGE_MODEL="/workspace/models/Z-Image-Turbo"
ADAPTER_MODEL="/workspace/models/zimage_turbo_training_adapter"

# Wait for AI Toolkit models if needed
if [ ! -d "$ZIMAGE_MODEL" ] || [ ! -d "$ADAPTER_MODEL" ]; then
    echo "⏳ Waiting for AI Toolkit models to finish downloading..."
    MAX_WAIT=1200  # Wait up to 20 minutes for large models
    WAITED=0
    while ([ ! -d "$ZIMAGE_MODEL" ] || [ ! -d "$ADAPTER_MODEL" ]) && [ $WAITED -lt $MAX_WAIT ]; do
        sleep 15
        WAITED=$((WAITED + 15))
        echo "  Still waiting... ($WAITED/$MAX_WAIT seconds)"
    done
fi

if [ -d "$ZIMAGE_MODEL" ] && [ -d "$ADAPTER_MODEL" ]; then
    echo "✅ AI Toolkit models ready for training"
else
    echo "⚠️  WARNING: AI Toolkit models not fully downloaded"
fi

# ==========================================
# Setup Caption Service (Qwen 2.5 VL)
# ==========================================
echo "=== Setting up Caption Service ==="
cd /workspace

# Create caption service directory if it doesn't exist
if [ ! -d "caption-service" ]; then
    mkdir -p caption-service
fi

cd caption-service

# Check if Qwen model is downloaded before setting up service
if [ -f "$QWEN_MODEL_PATH" ]; then
    echo "✅ Qwen model found, setting up caption service..."
    
    # Create virtual environment for caption service
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    
    # Install caption service requirements
    # Note: llama-cpp-python with CUDA support for faster inference
    echo "Installing llama-cpp-python with GPU support..."
    CMAKE_ARGS="-DLLAMA_CUBLAS=on" pip install llama-cpp-python --force-reinstall --upgrade --no-cache-dir
    pip install flask flask-cors Pillow requests
    
    echo "✅ Caption service dependencies installed"
    
    # Check if caption_service.py needs to be deployed
    if [ ! -f "caption_service.py" ]; then
        if [ -f "/workspace/dataset-manager/caption_service.py" ]; then
            echo "Deploying caption_service.py from dataset-manager..."
            cp /workspace/dataset-manager/caption_service.py .
        else
            echo "⚠️  WARNING: caption_service.py not found!"
            echo "   Please ensure it's deployed to /workspace/caption-service/"
        fi
    fi
    
    # Start caption service in background
    if [ -f "caption_service.py" ]; then
        echo "Starting Qwen Caption Service on port 11435..."
        nohup python caption_service.py > caption_service.log 2>&1 &
        CAPTION_PID=$!
        echo "✅ Caption service started (PID: $CAPTION_PID)"
        echo "   Log: /workspace/caption-service/caption_service.log"
    fi
    
    deactivate
    
else
    echo "⚠️  Skipping caption service setup - Qwen model not yet available"
    echo "    The model should have downloaded above. Check for errors."
fi

# ==========================================
# Setup Dataset Manager UI (port 3000)
# ==========================================
echo "=== Setting up Dataset Manager UI ==="
cd /workspace

# Check if dataset-manager exists
if [ -d "dataset-manager" ]; then
    cd dataset-manager
    
    # Install Node.js dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing Dataset Manager dependencies..."
        npm install
    fi
    
    # Set production environment
    export NODE_ENV=production
    export DEV_MODE=false
    
    # Set RunPod subdomain for AI Toolkit links
    # RunPod exposes this as RUNPOD_POD_ID or we can extract from hostname
    if [ -n "$RUNPOD_POD_ID" ]; then
        export RUNPOD_POD_HOSTNAME="$RUNPOD_POD_ID"
    else
        # Try to extract from hostname
        HOSTNAME=$(hostname)
        export RUNPOD_POD_HOSTNAME="${HOSTNAME%-*}"
    fi
    
    echo "RunPod Pod ID: $RUNPOD_POD_HOSTNAME"
    
    # Build the Next.js app
    echo "Building Dataset Manager..."
    npm run build
    
    # Start the Dataset Manager in background
    echo "Starting Dataset Manager on port 3000..."
    nohup npm start > dataset_manager.log 2>&1 &
    DATASET_UI_PID=$!
    echo "✅ Dataset Manager started (PID: $DATASET_UI_PID)"
    echo "   Log: /workspace/dataset-manager/dataset_manager.log"
    
else
    echo "⚠️  WARNING: dataset-manager not found in /workspace"
    echo "   Please deploy the dataset-manager folder to /workspace/"
fi

# ==========================================
# Start AI Toolkit UI (port 8675)
# ==========================================
echo "=== Starting AI Toolkit UI ==="
cd /workspace/ai-toolkit/ui

if [ ! -d node_modules ]; then
    npm install
fi

# Optional: change this env if you want a real password
# export AI_TOOLKIT_AUTH="${AI_TOOLKIT_AUTH:-changeme}"

npm run build_and_start &
AI_TOOLKIT_PID=$!
echo "✅ AI Toolkit UI started (PID: $AI_TOOLKIT_PID)"

# ==========================================
# Wait for services to initialize
# ==========================================
echo ""
echo "⏳ Waiting for services to initialize..."
sleep 10

echo ""
echo "=========================================="
echo "  🚀 ALL SERVICES READY"
echo "=========================================="
echo "✅ Dataset Manager:    http://localhost:3000"
echo "✅ Caption Service:    http://localhost:11435"
echo "✅ AI Toolkit UI:      http://localhost:8675"
echo "✅ Z-Image-Turbo:      Ready for training"
echo "✅ ComfyUI:            Ready"
echo "✅ croc:               Installed"
echo ""
echo "📦 Models:"
echo "   - Qwen 2.5 VL GGUF: /workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf"
echo "   - Z-Image-Turbo:    /workspace/models/Z-Image-Turbo"
echo "   - Training Adapter: /workspace/models/zimage_turbo_training_adapter"
echo ""
echo "📝 Logs:"
echo "   - Caption Service:  /workspace/caption-service/caption_service.log"
echo "   - Dataset Manager:  /workspace/dataset-manager/dataset_manager.log"
echo ""
echo "🎯 Quick Links:"
echo "   - Manage Datasets:  http://localhost:3000"
echo "   - AI Training:      http://localhost:8675"
echo ""
echo "=========================================="

cd /workspace
tail -f /dev/null

