#!/bin/bash

set -e

echo "=========================================="
echo "  UltraMuse Dataset Manager"
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

cd /workspace

# ==========================================
# Update repos (quick git pull)
# ==========================================
echo "Checking for updates..."

cd /workspace/dataset-manager
git pull origin main 2>/dev/null || true

cd /workspace/ai-toolkit
git pull origin main 2>/dev/null || true

cd /workspace

# ==========================================
# Download Models (first boot only)
# ==========================================
download_models() {
    echo "=== Checking/Downloading Models ==="
    cd /workspace
    
    # Activate AI Toolkit venv for huggingface-cli
    source /workspace/ai-toolkit/venv/bin/activate
    export HF_HUB_ENABLE_HF_TRANSFER=1
    
    # Z-Image-De-Turbo model (~12GB)
    if [ ! -f "/workspace/models/z_image_de_turbo_v1_bf16.safetensors" ]; then
        echo "📥 Downloading Z-Image-De-Turbo model (~12GB)..."
        huggingface-cli download ostris/Z-Image-De-Turbo z_image_de_turbo_v1_bf16.safetensors --local-dir /workspace/models || echo "⚠️ Failed to download Z-Image model"
    else
        echo "✅ Z-Image-De-Turbo model already exists"
    fi
    
    # Z-Image training adapter
    if [ ! -d "/workspace/models/zimage_turbo_training_adapter" ] || [ -z "$(ls -A /workspace/models/zimage_turbo_training_adapter 2>/dev/null)" ]; then
        echo "📥 Downloading Z-Image training adapter..."
        huggingface-cli download ostris/zimage_turbo_training_adapter --local-dir /workspace/models/zimage_turbo_training_adapter --exclude "*.git*" "*.md" || echo "⚠️ Failed to download adapter"
    else
        echo "✅ Z-Image training adapter already exists"
    fi
    
    # Qwen 2.5 VL GGUF model (~8GB)
    if [ ! -f "/workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf" ]; then
        echo "📥 Downloading Qwen 2.5 VL GGUF model (~8GB)..."
        huggingface-cli download unsloth/Qwen2.5-VL-7B-Instruct-GGUF Qwen2.5-VL-7B-Instruct-Q8_0.gguf --local-dir /workspace/models || echo "⚠️ Failed to download Qwen model"
    else
        echo "✅ Qwen 2.5 VL GGUF model already exists"
    fi
    
    deactivate
    echo "=== Model check complete ==="
}

# Download models if needed (runs in background to not block startup)
download_models &
MODEL_DOWNLOAD_PID=$!

# ==========================================
# Start Caption Service
# ==========================================
echo "Starting Caption Service..."
cd /workspace/caption-service

# Copy latest caption_service.py if it exists in dataset-manager
if [ -f "/workspace/dataset-manager/caption_service.py" ]; then
    cp /workspace/dataset-manager/caption_service.py .
fi

if [ -f "caption_service.py" ]; then
    source venv/bin/activate
    nohup python caption_service.py > caption_service.log 2>&1 &
    CAPTION_PID=$!
    deactivate
    echo "✅ Caption Service started (PID: $CAPTION_PID)"
fi

# ==========================================
# Start Dataset Manager
# ==========================================
echo "Starting Dataset Manager..."
cd /workspace/dataset-manager

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
cd /workspace/ai-toolkit/ui

# Use their build_and_start script which handles building if needed
npm run build_and_start &
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
echo ""
echo "📝 Logs:"
echo "   - Caption Service:  /workspace/caption-service/caption_service.log"
echo "   - Dataset Manager:  /workspace/dataset-manager/dataset_manager.log"
echo "=========================================="

cd /workspace
sleep infinity
