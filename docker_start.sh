#!/bin/bash

set -e

echo "=========================================="
echo "  UltraMuse Dataset + Model Manager"
echo "  🐳 Docker Edition - Instant Start!"
echo "=========================================="
echo ""

# ---------------------------------------------------------------------------- #
#                          RunPod Service Functions                            #
# ---------------------------------------------------------------------------- #

# Start nginx service
start_nginx() {
    echo "Starting Nginx service..."
    service nginx start || true
}

# Setup SSH
setup_ssh() {
    if [[ $PUBLIC_KEY ]]; then
        echo "Setting up SSH..."
        mkdir -p ~/.ssh
        echo "$PUBLIC_KEY" >> ~/.ssh/authorized_keys
        chmod 700 -R ~/.ssh

        if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
            ssh-keygen -t rsa -f /etc/ssh/ssh_host_rsa_key -q -N ''
        fi

        if [ ! -f /etc/ssh/ssh_host_dsa_key ]; then
            ssh-keygen -t dsa -f /etc/ssh/ssh_host_dsa_key -q -N ''
        fi

        if [ ! -f /etc/ssh/ssh_host_ecdsa_key ]; then
            ssh-keygen -t ecdsa -f /etc/ssh/ssh_host_ecdsa_key -q -N ''
        fi

        if [ ! -f /etc/ssh/ssh_host_ed25519_key ]; then
            ssh-keygen -t ed25519 -f /etc/ssh/ssh_host_ed25519_key -q -N ''
        fi

        service ssh start

        echo "SSH host keys:"
        for key in /etc/ssh/*.pub; do
            echo "Key: $key"
            ssh-keygen -lf $key
        done
    fi
}

# Export env vars
export_env_vars() {
    echo "Exporting environment variables..."
    printenv | grep -E '^[A-Z_][A-Z0-9_]*=' | grep -v '^PUBLIC_KEY' | awk -F = '{ val = $0; sub(/^[^=]*=/, "", val); print "export " $1 "=\"" val "\"" }' > /etc/rp_environment
    if ! grep -q 'source /etc/rp_environment' ~/.bashrc 2>/dev/null; then
        echo 'source /etc/rp_environment' >> ~/.bashrc
    fi
}

# Start Jupyter Lab
start_jupyter() {
    if [[ $JUPYTER_PASSWORD ]]; then
        echo "Starting Jupyter Lab..."
        mkdir -p /workspace
        cd /
        nohup python3 -m jupyter lab --allow-root --no-browser --port=8888 --ip=* \
            --FileContentsManager.delete_to_trash=False \
            --ServerApp.terminado_settings='{"shell_command":["/bin/bash"]}' \
            --IdentityProvider.token=$JUPYTER_PASSWORD \
            --ServerApp.allow_origin=* \
            --ServerApp.preferred_dir=/workspace &> /jupyter.log &
        echo "Jupyter Lab started"
    fi
}

# ---------------------------------------------------------------------------- #
#                          Start RunPod Services                               #
# ---------------------------------------------------------------------------- #

start_nginx
echo "Pod Started"
setup_ssh
start_jupyter
export_env_vars
echo "RunPod services ready."
echo ""

# ---------------------------------------------------------------------------- #
#                          Start UltraMuse Services                            #
# ---------------------------------------------------------------------------- #

# ==========================================
# Setup Persistent Storage (Symlinks)
# ==========================================
echo "Setting up persistent storage..."

# Create persistent directories on volume
mkdir -p /workspace/datasets
mkdir -p /workspace/uploads
mkdir -p /workspace/ai-toolkit/output

# Link Dataset Manager data to persistent volume
rm -rf /app/dataset-manager/data/datasets
rm -rf /app/dataset-manager/data/uploads
ln -s /workspace/datasets /app/dataset-manager/data/datasets
ln -s /workspace/uploads /app/dataset-manager/data/uploads

# Link AI Toolkit persistence (Output, Config, Jobs, Datasets)
echo "Setting up AI Toolkit persistence..."

# Create persistent dirs
mkdir -p /workspace/ai-toolkit/output
mkdir -p /workspace/ai-toolkit/config
mkdir -p /workspace/ai-toolkit/jobs
mkdir -p /workspace/ai-toolkit/datasets

# Output
rm -rf /app/ai-toolkit/output
ln -s /workspace/ai-toolkit/output /app/ai-toolkit/output

# Jobs
rm -rf /app/ai-toolkit/jobs
ln -s /workspace/ai-toolkit/jobs /app/ai-toolkit/jobs

# Datasets (Target for Dataset Manager exports)
rm -rf /app/ai-toolkit/datasets
ln -s /workspace/ai-toolkit/datasets /app/ai-toolkit/datasets

# Config (copy defaults first if empty)
if [ -z "$(ls -A /workspace/ai-toolkit/config 2>/dev/null)" ]; then
    echo "Initializing AI Toolkit config on volume..."
    cp -r /app/ai-toolkit/config/* /workspace/ai-toolkit/config/ 2>/dev/null || true
fi
rm -rf /app/ai-toolkit/config
ln -s /workspace/ai-toolkit/config /app/ai-toolkit/config

# ==========================================
# Update repos (quick git pull)
# ==========================================
echo "Checking for updates..."

cd /app/dataset-manager
# git pull origin main 2>/dev/null || true  <-- COMMENTED OUT TO PREVENT OVERWRITING LOCAL CHANGES

cd /app/ai-toolkit
git pull origin main 2>/dev/null || true

cd /app

# ==========================================
# Download Models (first boot only)
# ==========================================
download_caption_model() {
    echo "=== Checking Caption Model ==="
    cd /workspace  # Models live on volume
    
    # Only auto-download Qwen caption model (required for captioning service)
    # Need BOTH the model and the mmproj (vision encoder) files
    # All other models (Z-Image, Flux, SDXL, etc.) are managed through Model Manager UI
    
    QWEN_MODEL="/workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf"
    QWEN_MMPROJ="/workspace/models/mmproj-F16.gguf"
    
    if [ ! -f "$QWEN_MODEL" ] || [ ! -f "$QWEN_MMPROJ" ]; then
        echo "📥 Downloading Qwen 2.5 VL GGUF model for captioning..."
        echo "   This includes the model (~8GB) and vision encoder (~1.4GB)"
        echo "⚡ Using hf_transfer for fast parallel download with progress tracking..."
        
        # Create progress file
        mkdir -p /app/dataset-manager/data/progress
        PROGRESS_FILE="/app/dataset-manager/data/progress/qwen-caption-download.json"
        echo '{"downloaded":0,"total":100,"progress":0,"current_file":"Starting..."}' > "$PROGRESS_FILE"
        
        # Use our existing download_model.py script with progress tracking
        source /app/caption-service/venv/bin/activate
        export HF_HUB_ENABLE_HF_TRANSFER=1
        
        # Download BOTH files from unsloth repo
        python3 /app/dataset-manager/download_model.py "$(cat <<EOF
{
    "repo_id": "unsloth/Qwen2.5-VL-7B-Instruct-GGUF",
    "files": ["Qwen2.5-VL-7B-Instruct-Q8_0.gguf", "mmproj-F16.gguf"],
    "local_dir": "/workspace/models",
    "progress_file": "$PROGRESS_FILE"
}
EOF
)" || echo "⚠️ Failed to download Qwen model"
        
        deactivate
        echo "✅ Qwen download complete!"
    else
        echo "✅ Qwen 2.5 VL model and vision encoder already exist"
    fi
    
    echo "=== Caption model check complete ==="
}

# Configure Hugging Face cache to use persistent volume
setup_huggingface_cache() {
    echo "Configuring Hugging Face cache..."
    
    # Redirect all HF downloads to /workspace/models/huggingface (persistent!)
    export HF_HOME=/workspace/models/huggingface
    export TRANSFORMERS_CACHE=/workspace/models/huggingface/transformers
    export DIFFUSERS_CACHE=/workspace/models/huggingface/diffusers
    export HF_HUB_CACHE=/workspace/models/huggingface/hub
    
    # Make these available to all processes
    echo "export HF_HOME=/workspace/models/huggingface" >> /etc/profile
    echo "export TRANSFORMERS_CACHE=/workspace/models/huggingface/transformers" >> /etc/profile
    echo "export DIFFUSERS_CACHE=/workspace/models/huggingface/diffusers" >> /etc/profile
    echo "export HF_HUB_CACHE=/workspace/models/huggingface/hub" >> /etc/profile
    
    # Create directories
    mkdir -p /workspace/models/huggingface/{hub,transformers,diffusers}
    
    echo "✅ Hugging Face cache configured (persists on volume)"
}

# Initialize model directory structure for Model Manager
init_model_directories() {
    echo "Initializing model directories..."
    mkdir -p /workspace/models/{base,lora,vae,adapter,custom,zimage,qwen,flux,sdxl}
    
    # Initialize installed-models.json if it doesn't exist
    if [ ! -f "/workspace/models/installed-models.json" ]; then
        echo '{
  "version": "1.0.0",
  "installedModels": [],
  "lastUpdated": "'$(date -Iseconds)'"
}' > /workspace/models/installed-models.json
        echo "✅ Created model database"
    else
        echo "✅ Model database exists"
    fi
}

# Setup Hugging Face cache (must be done first, before any downloads)
setup_huggingface_cache

# Initialize model structure (Qwen caption model downloads on-demand from caption page)
init_model_directories

# ==========================================
# Start Caption Service
# ==========================================
echo "Starting Caption Service..."
cd /app/caption-service

# Copy latest caption_service.py if it exists in dataset-manager
if [ -f "/app/dataset-manager/caption_service.py" ]; then
    cp /app/dataset-manager/caption_service.py .
fi

if [ -f "caption_service.py" ]; then
    source venv/bin/activate
    
    # Check if CUDA is available
    CUDA_AVAILABLE=false
    if python3 -c "import torch; exit(0 if torch.cuda.is_available() else 1)" 2>/dev/null; then
        CUDA_AVAILABLE=true
        echo "✅ CUDA detected - Caption service will use GPU acceleration"
    else
        echo "ℹ️  CUDA not available - Caption service will use CPU mode"
        echo "   (This is normal for CPU-only builds or Docker without --gpus flag)"
    fi
    
    # Verify dependencies are available
    python3 -c "import llama_cpp; import flask; import PIL" 2>/dev/null || {
        echo "⚠️  Missing dependencies in caption service venv. Installing..."
        pip install flask flask-cors pillow
    }
    
    # Set GPU layers based on availability
    # llama-cpp-python will automatically handle CPU-only mode if built without CUDA
    if [ "$CUDA_AVAILABLE" = false ]; then
        export N_GPU_LAYERS=0
        echo "   Set N_GPU_LAYERS=0 for CPU inference"
    fi

    # Start service
    echo "🚀 Starting caption service on port 11435..."
    nohup python caption_service.py > caption_service.log 2>&1 &
    CAPTION_PID=$!
    deactivate
    echo "✅ Caption Service started (PID: $CAPTION_PID)"
    
    # Wait a moment and check if it's still running
    sleep 3
    if ! kill -0 $CAPTION_PID 2>/dev/null; then
        echo "❌ Caption Service failed to start. Check logs:"
        tail -20 caption_service.log
    else
        # Show startup logs
        echo "📋 Caption Service startup logs:"
        head -10 caption_service.log
    fi
fi

# ==========================================
# Start Dataset Manager
# ==========================================
echo "Starting Dataset Manager..."
cd /app/dataset-manager

# Set RunPod hostname for AI Toolkit links
if [ -n "$RUNPOD_POD_ID" ]; then
    export RUNPOD_POD_HOSTNAME="$RUNPOD_POD_ID"
else
    HOSTNAME=$(hostname)
    export RUNPOD_POD_HOSTNAME="${HOSTNAME%-*}"
fi

export NODE_ENV=production
nohup npm start > dataset_manager.log 2>&1 &
DATASET_PID=$!
echo "✅ Dataset Manager started (PID: $DATASET_PID)"

# ==========================================
# Start AI Toolkit UI
# ==========================================
echo "Starting AI Toolkit UI..."
cd /app/ai-toolkit/ui

# Manual startup sequence (instead of build_and_start) to ensure deps work
echo "Installing AI Toolkit UI dependencies..."
npm install --include=dev --legacy-peer-deps
npm install --save-dev @types/node typescript

# Update DB
echo "Updating database..."
npx prisma generate
npx prisma db push

# Build & Start
echo "Building AI Toolkit UI..."
# Only build if not already built or force rebuild needed
if [ ! -d ".next" ] || [ ! -d "dist" ]; then
    npm run build || echo "⚠️ AI Toolkit UI build failed, trying to run anyway..."
fi

echo "Starting server..."
# Use npx to ensure concurrently is found
npx concurrently --restart-tries -1 --restart-after 1000 -n WORKER,UI "node dist/cron/worker.js" "next start --port 8675" &
AI_TOOLKIT_PID=$!
echo "✅ AI Toolkit UI started (PID: $AI_TOOLKIT_PID)"

# ==========================================
# Ready!
# ==========================================
sleep 5

echo ""
echo "=========================================="
echo "  🚀 ALL SERVICES READY"
echo "=========================================="
echo "✅ Dataset Manager:    http://localhost:3000"
echo "✅ Caption Service:    http://localhost:11435"
echo "✅ AI Toolkit UI:      http://localhost:8675"
echo "✅ Jupyter Lab:        http://localhost:8888"
echo ""
echo "📦 Models location: /workspace/models/"
echo "   (downloading in background if first boot)"
echo "💾 Persistent Data: /workspace/datasets"
echo ""
echo "📝 Logs:"
echo "   - Caption Service:  /app/caption-service/caption_service.log"
echo "   - Dataset Manager:  /app/dataset-manager/dataset_manager.log"
echo "=========================================="

cd /workspace
sleep infinity
