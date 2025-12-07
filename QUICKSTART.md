# ⚡ QuickStart - Get Running in 5 Minutes

## Local Development (Windows)

### 1. Start Dataset Manager
```powershell
cd dataset-manager
npm install
npm run dev
```
Open: http://localhost:3000

### 2. Start Caption Service (Optional)
```powershell
# First time: Create .env.caption for your local model path
copy .env.caption.example .env.caption
# Edit .env.caption and set: DEV_MODEL_PATH=C:\Path\To\Qwen2.5-VL-7B-Instruct-Q8_0.gguf

# Then start the service
start_caption_service.bat
```

**Note:** `.env.caption` is only for local dev and is in `.gitignore`

### 3. Use It!
- Upload ZIP with images
- AI captions them automatically
- Edit as needed
- Export to local folder

**Done!** ✨

---

## RunPod Production (True One-Click)

### Using UltraMuse RunPod Template

**Step 1:** Go to RunPod  
**Step 2:** Select **"UltraMuse Dataset Manager"** template  
**Step 3:** Click **"Deploy"**  
**Step 4:** Wait ~25 minutes ☕

**That's literally it!** The template automatically:
- ✅ Downloads setup script from UltraMuse website
- ✅ Clones Dataset Manager, AI Toolkit, ComfyUI
- ✅ Downloads all models (~20GB)
- ✅ Installs all dependencies
- ✅ Starts all services in background

### Access Your Apps
- Dataset Manager: `http://<runpod-url>:3000`
- AI Toolkit: `http://<runpod-url>:8675`

**No SSH. No commands. Just click and wait.** 🎉

---

## Manual Deployment (Advanced)

If you want to use your own fork or run manually:

```bash
# SSH into RunPod
export DATASET_MANAGER_REPO="https://github.com/YourUsername/YourFork.git"
wget -O runpod_start.sh https://yourwebsite.com/runpod_start.sh
bash runpod_start.sh
```

See [RUNPOD_TEMPLATE.md](RUNPOD_TEMPLATE.md) for template configuration details.

---

## 📖 Full Documentation

- **[README.md](README.md)** - Overview and features
- **[RUNPOD_DEPLOYMENT.md](RUNPOD_DEPLOYMENT.md)** - Detailed deployment guide
- **[DEPLOYMENT_FLOW.md](DEPLOYMENT_FLOW.md)** - What gets downloaded
- **[USAGE_EXAMPLE.md](USAGE_EXAMPLE.md)** - Complete training workflow
- **[DEV_SETUP.md](DEV_SETUP.md)** - Local development setup
- **[CAPTION_SERVICE_README.md](CAPTION_SERVICE_README.md)** - Caption service details

---

## 🆘 Common Issues

**"Repository not found"**
- Update `DATASET_MANAGER_REPO` with your actual repo URL
- Make sure the repository is public or RunPod has access

**"Models still downloading"**
- Wait for the script to complete (~25 min)
- Check logs: `tail -f /workspace/caption-service/caption_service.log`

**"Port already in use"**
- Kill existing processes: `pkill -f "node|python"`
- Re-run the script

**"Caption service not ready"**
- Check health: `curl http://localhost:11435/health`
- View logs: `cat /workspace/caption-service/caption_service.log`
- Restart: `cd /workspace/caption-service && source venv/bin/activate && python caption_service.py`

---

## 💬 Support

Discord: https://discord.gg/9jVnQHDx
- Free resources
- Early model access  
- Community help

