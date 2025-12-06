#!/usr/bin/env bash

set -e

echo "=========================================="
echo "  UltraMuse Dataset Manager Setup"
echo "  RunPod Template Auto-Installer"
echo "  ⚡ Optimized Edition"
echo "=========================================="
echo ""
echo "This script is automatically run by the"
echo "UltraMuse RunPod template on instance creation"
echo ""
echo "Performance Optimizations:"
echo "  ⚡ uv package manager (10-100x faster than pip)"
echo "  ⚡ Parallel model downloads (3 simultaneous)"
echo "  ⚡ Early PyTorch install (prevents dependency hell)"
echo "  ⚡ Binary Node.js install (no heavy apt deps)"
echo ""

# ==========================================
# CONFIGURATION
# ==========================================
# Dataset Manager repository (set by template or environment)
DATASET_MANAGER_REPO="${DATASET_MANAGER_REPO:-https://github.com/Elevenheights/dataset-manager.git}"
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
    # Create venv with system-site-packages to inherit PyTorch from base container
    python3 -m venv --system-site-packages venv
fi

source venv/bin/activate

# ==========================================
# Install uv (10-100x faster than pip)
# ==========================================
echo "Installing uv package manager (Rust-based, ultra-fast)..."
pip install uv

# ==========================================
# Install PyTorch FIRST to prevent dependency hell
# ==========================================
echo "Installing PyTorch with CUDA support (prevents reinstall loops)..."
python -c "import torch; print(f'  ✅ PyTorch {torch.__version__}, CUDA {torch.version.cuda}')" 2>/dev/null || {
    echo "  Installing PyTorch 2.5.1+cu121..."
    uv pip install torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu121
}

# Install hf_transfer for faster downloads (multi-threaded)
uv pip install hf_transfer

# Install huggingface-hub and requirements
uv pip install "huggingface-hub>=0.34,<1.0"
uv pip install -r requirements.txt

# Enable high-speed transfers for all downloads
export HF_HUB_ENABLE_HF_TRANSFER=1
echo "✅ HuggingFace high-speed downloads enabled (hf_transfer)"

cd /workspace
mkdir -p models

# ==========================================
# Download Models in Parallel (MAJOR SPEEDUP)
# ==========================================
echo "=== Starting parallel model downloads ==="
echo "  📥 Z-Image-De-Turbo (12.3GB)"
echo "  📥 Z-Image training adapter"
echo "  📥 Qwen 2.5 VL GGUF (7.6GB)"
echo ""

# Define model paths for verification
QWEN_MODEL_PATH="/workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf"
ZIMAGE_MODEL="/workspace/models/z_image_de_turbo_v1_bf16.safetensors"
ADAPTER_MODEL="/workspace/models/zimage_turbo_training_adapter"

# Start all three downloads in parallel
echo "Starting Z-Image-De-Turbo download..."
hf download \
  ostris/Z-Image-De-Turbo \
  z_image_de_turbo_v1_bf16.safetensors \
  --local-dir models &
PID_ZIMAGE=$!

echo "Starting Z-Image training adapter download..."
hf download \
  ostris/zimage_turbo_training_adapter \
  --local-dir models/zimage_turbo_training_adapter \
  --exclude "*.git*" "*.md" &
PID_ADAPTER=$!

echo "Starting Qwen 2.5 VL GGUF download..."
hf download \
  unsloth/Qwen2.5-VL-7B-Instruct-GGUF \
  Qwen2.5-VL-7B-Instruct-Q8_0.gguf \
  --local-dir models &
PID_QWEN=$!

echo "✅ All downloads started in parallel"
echo "   While models download, setting up other services..."
echo ""

# ==========================================
# ComfyUI Setup (while models download)
# ==========================================
echo "=== Setting up ComfyUI ==="

# Deactivate ai-toolkit venv before ComfyUI setup
deactivate 2>/dev/null || true

if [ ! -d "ComfyUI" ]; then
    git clone https://github.com/comfyanonymous/ComfyUI.git
fi

cd /workspace/ComfyUI
git pull origin main || git pull origin master || true

# Create separate venv for ComfyUI to avoid conflicts
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install uv 2>/dev/null || true
uv pip install -r requirements.txt
deactivate

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
    echo "=== Installing Node.js and npm (fast binary method) ==="
    # Download and install Node.js LTS binary directly (much faster than apt-get)
    NODE_VERSION="20.18.2"
    cd /tmp
    wget -q https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz
    tar -xJf node-v${NODE_VERSION}-linux-x64.tar.xz
    cp -r node-v${NODE_VERSION}-linux-x64/{bin,include,lib,share} /usr/local/
    rm -rf node-v${NODE_VERSION}-linux-x64*
    cd /workspace
    
    # Verify installation
    node --version
    npm --version
    echo "✅ Node.js $(node --version) installed"
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# ==========================================
# Wait for Parallel Model Downloads to Complete
# ==========================================
echo ""
echo "=== Waiting for parallel model downloads to complete ==="
echo "⏳ This may take several minutes depending on network speed..."
echo ""

# Wait for each download process (with error handling)
echo "Waiting for Z-Image-De-Turbo download (PID: $PID_ZIMAGE)..."
if wait $PID_ZIMAGE; then
    echo "✅ Z-Image-De-Turbo download complete"
else
    echo "⚠️  Z-Image-De-Turbo download may have had issues (will verify file later)"
fi

echo "Waiting for training adapter download (PID: $PID_ADAPTER)..."
if wait $PID_ADAPTER; then
    echo "✅ Training adapter download complete"
else
    echo "⚠️  Training adapter download may have had issues (will verify file later)"
fi

echo "Waiting for Qwen model download (PID: $PID_QWEN)..."
if wait $PID_QWEN; then
    echo "✅ Qwen model download complete"
else
    echo "⚠️  Qwen model download may have had issues (will verify file later)"
fi

echo ""
echo "=== Verifying all models downloaded successfully ==="

# Verify Z-Image models
if [ -f "$ZIMAGE_MODEL" ] && [ -d "$ADAPTER_MODEL" ]; then
    ZIMAGE_SIZE=$(du -h "$ZIMAGE_MODEL" | cut -f1)
    echo "✅ AI Toolkit models ready for training"
    echo "   Z-Image-De-Turbo: $ZIMAGE_SIZE"
else
    echo "⚠️  WARNING: AI Toolkit models not fully downloaded"
fi

# Verify Qwen model
if [ -f "$QWEN_MODEL_PATH" ]; then
    QWEN_SIZE=$(du -h "$QWEN_MODEL_PATH" | cut -f1)
    echo "✅ Qwen 2.5 VL GGUF model ready (size: $QWEN_SIZE)"
else
    echo "⚠️  WARNING: Qwen model download failed"
    echo "   Caption service will be disabled"
    echo "   You can manually download later with:"
    echo "     hf download unsloth/Qwen2.5-VL-7B-Instruct-GGUF Qwen2.5-VL-7B-Instruct-Q8_0.gguf --local-dir /workspace/models"
fi

echo ""

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
    
    # Install uv in caption service venv
    pip install uv
    
    # Install caption service requirements
    # Note: llama-cpp-python with CUDA support for faster inference
    echo "Installing llama-cpp-python with GPU support..."
    CMAKE_ARGS="-DGGML_CUDA=on" uv pip install llama-cpp-python --force-reinstall --upgrade --no-cache-dir
    uv pip install flask flask-cors Pillow requests
    
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
    
    # Clean install to prevent module resolution issues
    # NOTE: Install with NODE_ENV unset to ensure devDependencies (TypeScript) are installed
    echo "Installing Dataset Manager dependencies (clean install)..."
    rm -rf node_modules .next
    npm cache clean --force 2>/dev/null || true
    unset NODE_ENV
    npm install
    
    # Verify TypeScript is installed
    if [ -f "node_modules/typescript/bin/tsc" ]; then
        echo "✅ TypeScript installed successfully"
    else
        echo "⚠️ TypeScript not found, installing explicitly..."
        npm install --save-dev typescript
    fi
    
    # Set production environment for build and runtime
    export NODE_ENV=production
    export DEV_MODE=false
    
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

# Clean install for AI Toolkit UI (same approach as Dataset Manager)
echo "Installing AI Toolkit UI dependencies..."
rm -rf node_modules 2>/dev/null || true
npm install

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

