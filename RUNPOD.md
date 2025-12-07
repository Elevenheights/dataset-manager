# RunPod Deployment Guide

Complete guide for deploying UltraMuse Dataset Manager to RunPod with true one-click setup.

---

## 🚀 Quick Deploy (Recommended)

### For End Users - Template Method

1. Go to RunPod
2. Click **"Templates"**
3. Search for **"UltraMuse Dataset Manager"**
4. Click **"Deploy"**
5. Wait ~25 minutes ☕

**Done!** Access your apps via RunPod URLs:
- Dataset Manager: `http://<pod-id>-3000.proxy.runpod.net`
- AI Toolkit: `http://<pod-id>-8675.proxy.runpod.net`

---

## 📦 What Gets Auto-Deployed

The template automatically downloads and sets up **everything**:

1. ✅ **Dataset Manager** (port 3000) - Full UI for dataset management
2. ✅ **AI Toolkit** (port 8675) - Training interface  
3. ✅ **Caption Service** (port 11435) - Qwen 2.5 VL API
4. ✅ **ComfyUI** - For inference testing
5. ✅ **All Models** (~20GB):
   - Qwen 2.5 VL 7B (8 GB)
   - Z-Image-Turbo (10 GB)
   - Training Adapter (2 GB)

**Total setup time:** ~25 minutes (mostly model downloads)

---

## 🛠️ Template Configuration

### For Template Creators

**Container Image:**
```
runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04
```

**Docker Command (Start Script):**
```bash
#!/bin/bash
cd /workspace
wget -O runpod_start.sh https://yourwebsite.com/runpod_start.sh
chmod +x runpod_start.sh
bash runpod_start.sh
```

**Environment Variables (Optional):**
```bash
DATASET_MANAGER_REPO=https://github.com/UltraMuse/Dataset-Manager.git
DATASET_MANAGER_BRANCH=main
NODE_ENV=production
```

**Exposed Ports:**
- `3000` - Dataset Manager UI
- `8675` - AI Toolkit UI  
- `11435` - Caption Service API
- `8888` - Jupyter Lab (optional)

**Volume Mount:**
- `/workspace` - Persistent storage for models, datasets, outputs

---

## ⚙️ Manual Deployment (Advanced)

### Prerequisites

- RunPod GPU instance (RTX 3090/4090+ recommended)
- 100GB+ storage
- PyTorch + CUDA base image

### Steps

**1. Push your code to Git:**
```bash
cd dataset-manager
git init
git add .
git commit -m "Deploy to RunPod"
git remote add origin https://github.com/YourUsername/UltraMuse.git
git push -u origin main
```

**2. SSH into RunPod and run:**
```bash
export DATASET_MANAGER_REPO="https://github.com/YourUsername/UltraMuse.git"
wget -O runpod_start.sh https://yourwebsite.com/runpod_start.sh
bash runpod_start.sh
```

**Or one-liner:**
```bash
export DATASET_MANAGER_REPO="https://github.com/YourUsername/UltraMuse.git" && \
wget -O runpod_start.sh https://yourwebsite.com/runpod_start.sh && \
bash runpod_start.sh
```

---

## 📂 Deployed Structure

```
/workspace/
├── dataset-manager/              # Main application
│   ├── src/                     # Next.js source
│   ├── data/                    # Datasets & uploads
│   ├── caption_service.py
│   └── runpod_start.sh
│
├── caption-service/              # Caption runtime
│   ├── caption_service.py       # Deployed copy
│   ├── venv/                    # Python environment
│   └── caption_service.log
│
├── ai-toolkit/                   # Training framework
│   ├── datasets/                # Exports from Dataset Manager
│   ├── ui/                      # Training UI
│   └── venv/
│
├── models/                       # Shared model storage
│   ├── huggingface/             # HF cache (unified)
│   ├── Qwen2.5-VL-7B-Instruct-Q8_0.gguf
│   ├── zimage/
│   └── flux/
│
└── ComfyUI/                      # Inference tools
```

---

## 🔄 Complete Workflow

### 1. Upload & Caption (Dataset Manager)
- Upload ZIP with images → `http://<pod>:3000`
- AI generates captions automatically
- Edit/refine captions as needed

### 2. Export (Dataset Manager)
- One-click export to AI Toolkit format
- Files copied to `/workspace/ai-toolkit/datasets/`

### 3. Train (AI Toolkit)
- Open AI Toolkit UI → `http://<pod>:8675`
- Configure training settings
- Start LoRA training with Z-Image-Turbo

### 4. Test (ComfyUI)
- Load trained LoRA
- Generate test images
- Iterate as needed

---

## 🔧 Management Commands

### Service Control

**Restart Caption Service:**
```bash
cd /workspace/caption-service
source venv/bin/activate
python caption_service.py
```

**Restart Dataset Manager:**
```bash
cd /workspace/dataset-manager
npm start
```

**Restart AI Toolkit:**
```bash
cd /workspace/ai-toolkit/ui
npm run build_and_start
```

### Logs

```bash
# Caption service
tail -f /workspace/caption-service/caption_service.log

# Dataset Manager
tail -f /workspace/dataset-manager/dataset_manager.log

# Check all services
ps aux | grep -E "node|python|caption"
```

### Health Checks

```bash
# Caption service
curl http://localhost:11435/health

# Dataset Manager
curl http://localhost:3000

# AI Toolkit
curl http://localhost:8675

# All ports
netstat -tulpn | grep -E "3000|8675|11435"
```

---

## 🐛 Troubleshooting

### Services Won't Start

**Check logs:**
```bash
tail -50 /workspace/caption-service/caption_service.log
tail -50 /workspace/dataset-manager/dataset_manager.log
```

**Verify models downloaded:**
```bash
ls -lh /workspace/models/
# Should see:
# - Qwen2.5-VL-7B-Instruct-Q8_0.gguf (~8GB)
# - mmproj-F16.gguf (~1.3GB)
# - zimage/ directory
```

**Check port conflicts:**
```bash
netstat -tulpn | grep -E "3000|8675|11435"
# If ports in use, kill processes:
pkill -f "node|python"
```

### Model Downloads Failed

**Re-download Qwen:**
```bash
cd /workspace/models
huggingface-cli download unsloth/Qwen2.5-VL-7B-Instruct-GGUF \
  Qwen2.5-VL-7B-Instruct-Q8_0.gguf \
  mmproj-F16.gguf \
  --local-dir . \
  --local-dir-use-symlinks False
```

**Re-download Z-Image:**
```bash
huggingface-cli download ostris/Z-Image-De-Turbo \
  z_image_de_turbo_v1_bf16.safetensors \
  --local-dir /workspace/models/zimage
```

### Caption Service Not Responding

**Check GPU availability:**
```bash
nvidia-smi  # Should show GPU
```

**Test manually:**
```bash
cd /workspace/caption-service
source venv/bin/activate
python caption_service.py  # Run in foreground to see errors
```

**Check model exists:**
```bash
ls -lh /workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf
ls -lh /workspace/models/mmproj-F16.gguf
```

### Dataset Manager Build Fails

**Clean rebuild:**
```bash
cd /workspace/dataset-manager
rm -rf .next node_modules
npm install
npm run build
npm start
```

### Disk Space Issues

**Check space:**
```bash
df -h /workspace
```

**Clear caches if needed:**
```bash
# HF download cache
rm -rf /workspace/models/.cache/huggingface/download/*

# npm cache
npm cache clean --force
```

---

## 🔐 Security Notes

1. **Default:** Services run on `localhost` only
2. **RunPod Proxy:** Automatically handles external access
3. **Authentication:** Consider adding auth for production
4. **Firewall:** RunPod's port forwarding is secure by default

---

## 💡 Performance Tips

1. **GPU Monitoring:** `watch -n 1 nvidia-smi`
2. **Save Snapshots:** Create RunPod snapshots after successful setup
3. **Backup Datasets:** Export and download your datasets regularly
4. **Log Rotation:** Set up logrotate for long-running instances
5. **Model Cache:** `/workspace/models/` is shared - don't duplicate

---

## 🔄 Updating Your Deployment

**Quick update:**
```bash
cd /workspace/dataset-manager
git pull
npm install
npm run build
# Restart services (use commands above)
```

**Full re-deploy:**
```bash
# Re-run the start script
bash /workspace/dataset-manager/runpod_start.sh
```

---

## 📊 Resource Requirements

### Minimum (CPU Captioning)
- **GPU:** RTX 3090 (24GB VRAM)
- **Storage:** 100GB
- **RAM:** 32GB

### Recommended (Fast Training)
- **GPU:** RTX 4090 (24GB VRAM) or better
- **Storage:** 150GB+
- **RAM:** 64GB+

### Network
- Good bandwidth for model downloads (~20GB on first boot)
- ~1-2 GB/month for updates

---

## 📞 Support

**Discord:** https://discord.gg/4zbGm5j6jW
- Free resources
- Early model access
- Community help
- Troubleshooting

**Documentation:**
- `PROJECT_OVERVIEW.md` - Complete system overview
- `QUICKSTART.md` - Local development
- `ARCHITECTURE.md` - Technical details

---

## ✅ Checklist

After deployment, verify:

- [ ] Dataset Manager loads: `http://<pod>:3000`
- [ ] Caption service healthy: `curl localhost:11435/health`
- [ ] AI Toolkit loads: `http://<pod>:8675`
- [ ] Models downloaded: `ls /workspace/models/`
- [ ] Can upload ZIP files
- [ ] Can generate captions
- [ ] Can export datasets
- [ ] Can start training in AI Toolkit

**All checked?** You're ready to train! 🚀

---

**Last Updated:** December 7, 2025  
**Status:** Production Ready ✅

