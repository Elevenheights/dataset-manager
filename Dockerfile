# UltraMuse Dataset Manager - Pre-built Docker Image for RunPod
# This eliminates all setup time - everything is pre-installed and ready to go!

FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

LABEL maintainer="UltraMuse"
LABEL description="Dataset Manager + AI Toolkit + Caption Service - Ready to Run"

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV HF_HUB_ENABLE_HF_TRANSFER=1
# NOTE: NODE_ENV is set to production AFTER npm installs (to include devDependencies)

WORKDIR /app

# ==========================================
# Install system dependencies
# ==========================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    wget \
    nginx \
    openssh-server \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

# Install Jupyter Lab
RUN pip install jupyterlab

# Configure SSH
RUN mkdir -p /var/run/sshd

# ==========================================
# Install Node.js (LTS binary - fast)
# ==========================================
RUN cd /tmp && \
    wget -q https://nodejs.org/dist/v20.18.2/node-v20.18.2-linux-x64.tar.xz && \
    tar -xJf node-v20.18.2-linux-x64.tar.xz && \
    cp -r node-v20.18.2-linux-x64/{bin,include,lib,share} /usr/local/ && \
    rm -rf node-v20.18.2-linux-x64* && \
    node --version && npm --version

# ==========================================
# Install croc for file transfers
# ==========================================
RUN curl https://getcroc.schollz.com | bash

# ==========================================
# Clone and setup AI Toolkit
# ==========================================
RUN git clone https://github.com/ostris/ai-toolkit.git /app/ai-toolkit && \
    cd /app/ai-toolkit && \
    git submodule update --init --recursive

# Create AI Toolkit venv and install dependencies
RUN cd /app/ai-toolkit && \
    python3 -m venv --system-site-packages venv && \
    . venv/bin/activate && \
    pip install uv && \
    uv pip install hf_transfer && \
    uv pip install "huggingface-hub>=0.34,<1.0" && \
    uv pip install -r requirements.txt

# ==========================================
# Clone and setup ComfyUI
# ==========================================
RUN git clone https://github.com/comfyanonymous/ComfyUI.git /app/ComfyUI

RUN cd /app/ComfyUI && \
    python3 -m venv venv && \
    . venv/bin/activate && \
    pip install uv && \
    uv pip install -r requirements.txt

# ==========================================
# Models Directory (downloaded on first boot, persists on RunPod volume)
# ==========================================
RUN mkdir -p /workspace/models
# Models are NOT included in image to keep size small
# They will be downloaded on first boot by docker_start.sh

# ==========================================
# Setup Caption Service
# ==========================================
# Build llama-cpp-python: Use CUDA if GPU build requested, otherwise CPU-only for compatibility
# To build GPU version: docker build --build-arg ENABLE_GPU=true ...
# To build CPU version (default): docker build ...
ARG ENABLE_GPU=false

RUN mkdir -p /app/caption-service && \
    cd /app/caption-service && \
    python3 -m venv venv && \
    . venv/bin/activate && \
    pip install uv && \
    if [ "$ENABLE_GPU" = "true" ]; then \
        echo "Building llama-cpp-python with CUDA support..."; \
        CMAKE_ARGS="-DGGML_CUDA=on" uv pip install llama-cpp-python --no-cache-dir; \
    else \
        echo "Building llama-cpp-python for CPU (compatible with all systems)..."; \
        uv pip install llama-cpp-python --no-cache-dir; \
    fi && \
    uv pip install flask flask-cors Pillow requests huggingface-hub hf-transfer

# ==========================================
# Copy Dataset Manager (use local files instead of cloning)
# ==========================================
COPY . /app/dataset-manager

# Install Dataset Manager Python dependencies (for download_model.py)
# Use pip directly to avoid --system flag issues with RunPod
RUN cd /app/dataset-manager && \
    pip install -r requirements.txt

# Install Dataset Manager Node.js dependencies (including devDependencies for TypeScript)
RUN cd /app/dataset-manager && \
    npm install --include=dev && \
    npm run build

# ==========================================
# Setup AI Toolkit UI
# ==========================================
RUN cd /app/ai-toolkit/ui && \
    npm install --legacy-peer-deps && \
    npm run build

# NOW set NODE_ENV=production for runtime
ENV NODE_ENV=production

# ==========================================
# Copy startup script
# ==========================================
COPY docker_start.sh /app/docker_start.sh
RUN dos2unix /app/docker_start.sh && \
    chmod +x /app/docker_start.sh

# ==========================================
# Expose ports
# ==========================================
# 3000  - Dataset Manager
# 8675  - AI Toolkit UI
# 8888  - Jupyter Lab
# 8188  - ComfyUI (Manual Start)
# 22    - SSH
# Note: 11435 (Caption Service) is internal only
EXPOSE 3000 8675 8888 8188 22

# ==========================================
# Start command
# ==========================================
CMD ["/app/docker_start.sh"]

