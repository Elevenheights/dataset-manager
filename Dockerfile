# UltraMuse Dataset Manager - Pre-built Docker Image for RunPod
# This eliminates all setup time - everything is pre-installed and ready to go!

FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

LABEL maintainer="UltraMuse"
LABEL description="Dataset Manager + AI Toolkit + Caption Service - Ready to Run"

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV HF_HUB_ENABLE_HF_TRANSFER=1
# NOTE: NODE_ENV is set to production AFTER npm installs (to include devDependencies)

WORKDIR /workspace

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
RUN git clone https://github.com/ostris/ai-toolkit.git /workspace/ai-toolkit && \
    cd /workspace/ai-toolkit && \
    git submodule update --init --recursive

# Create AI Toolkit venv and install dependencies
RUN cd /workspace/ai-toolkit && \
    python3 -m venv --system-site-packages venv && \
    . venv/bin/activate && \
    pip install uv && \
    uv pip install hf_transfer && \
    uv pip install "huggingface-hub>=0.34,<1.0" && \
    uv pip install -r requirements.txt

# ==========================================
# Clone and setup ComfyUI
# ==========================================
RUN git clone https://github.com/comfyanonymous/ComfyUI.git /workspace/ComfyUI

RUN cd /workspace/ComfyUI && \
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
RUN mkdir -p /workspace/caption-service && \
    cd /workspace/caption-service && \
    python3 -m venv venv && \
    . venv/bin/activate && \
    pip install uv && \
    CMAKE_ARGS="-DGGML_CUDA=on" uv pip install llama-cpp-python --no-cache-dir && \
    uv pip install flask flask-cors Pillow requests

# ==========================================
# Copy Dataset Manager (use local files instead of cloning)
# ==========================================
COPY . /workspace/dataset-manager

# Install Dataset Manager dependencies (including devDependencies for TypeScript)
RUN cd /workspace/dataset-manager && \
    npm install --include=dev && \
    npm run build

# ==========================================
# Setup AI Toolkit UI
# ==========================================
RUN cd /workspace/ai-toolkit/ui && \
    npm install --legacy-peer-deps && \
    npm run build

# NOW set NODE_ENV=production for runtime
ENV NODE_ENV=production

# ==========================================
# Copy startup script
# ==========================================
COPY docker_start.sh /workspace/docker_start.sh
RUN dos2unix /workspace/docker_start.sh && \
    chmod +x /workspace/docker_start.sh

# ==========================================
# Expose ports
# ==========================================
# 3000  - Dataset Manager
# 8675  - AI Toolkit UI
# 11435 - Caption Service
# 8888  - Jupyter Lab
# 8188  - ComfyUI (Manual Start)
# 22    - SSH
EXPOSE 3000 8675 11435 8888 8188 22

# ==========================================
# Start command
# ==========================================
CMD ["/workspace/docker_start.sh"]

