# UltraMuse Dataset Manager

Professional LoRA training dataset preparation tool with AI-powered captioning and model management.

**⚡ Quick Links:**
- 📘 **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** - Complete consolidated documentation
- 🚀 **[QUICKSTART.md](QUICKSTART.md)** - Get running in 5 minutes
- 🏗️ **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture deep-dive

## 🌟 Features

- ✅ **ZIP Upload** - Drop your images once, extract automatically
- ✅ **AI Captioning** - Qwen 2.5 VL 7B generates detailed, training-optimized captions
- ✅ **Virtual Scrolling** - Handle 1000+ images smoothly
- ✅ **Batch Operations** - Caption, edit, and manage hundreds of images at once
- ✅ **Add/Remove** - Dynamically manage images in your dataset
- ✅ **AI Toolkit Export** - One-click export to training format
- ✅ **Dev + Prod** - Works locally and on RunPod

## 🚀 Quick Start

### Local Development (Windows)

**1. Start Dataset Manager**
```bash
cd dataset-manager
npm install
npm run dev
```
→ Open `http://localhost:3000`

**2. Start Caption Service** (Optional - for AI captioning)
```bash
# Copy .env.caption.example to .env.caption
# Set DEV_MODEL_PATH to your Qwen GGUF model location
start_caption_service.bat
```
→ Service runs on `http://localhost:11435`

### RunPod Production (True One-Click)

**Using the UltraMuse RunPod Template:**

1. Go to RunPod
2. Select **"UltraMuse Dataset Manager"** template
3. Click **"Deploy"**
4. Wait ~25 minutes ☕

**Done!** Access your apps:
- Dataset Manager: `http://<runpod-url>:3000`
- AI Toolkit: `http://<runpod-url>:8675`

The template automatically:
- ✅ Downloads setup script from UltraMuse website
- ✅ Clones Dataset Manager, AI Toolkit, ComfyUI
- ✅ Downloads all models (~20GB): Qwen 2.5 VL, Z-Image-Turbo
- ✅ Installs dependencies and starts all services
- ✅ Everything runs in background

**No SSH, no commands, no configuration required.**

---

**For Advanced Users:** See deployment docs:
- [QUICKSTART.md](QUICKSTART.md) - Quick setup guide
- [RUNPOD_TEMPLATE.md](RUNPOD_TEMPLATE.md) - Template configuration
- [RUNPOD_DEPLOYMENT.md](RUNPOD_DEPLOYMENT.md) - Manual deployment
- [USAGE_EXAMPLE.md](USAGE_EXAMPLE.md) - Complete workflow

## 📖 Documentation

**Start Here:**
- 📘 **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** ⭐ - Complete system documentation (current status, architecture, features, roadmap)
- 🚀 **[QUICKSTART.md](QUICKSTART.md)** - Get running in 5 minutes (local or Docker)

**Deployment:**
- 🌐 **[RUNPOD.md](RUNPOD.md)** - RunPod deployment guide (template + manual setup, troubleshooting)

**Technical Deep-Dives:**
- 🏗️ **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and data flow
- 🔧 **[MODEL_MANAGER_README.md](MODEL_MANAGER_README.md)** - Model manager API and features
- 💾 **[UNIFIED_MODEL_CACHE.md](UNIFIED_MODEL_CACHE.md)** - HuggingFace cache integration
- 🤖 **[CAPTION_SERVICE_README.md](CAPTION_SERVICE_README.md)** - Caption service technical details
- ⚡ **[OPTIMIZATION_NOTES.md](OPTIMIZATION_NOTES.md)** - Performance optimizations

**Recent Updates:**
- 📊 **[MODEL_DOWNLOAD_PROGRESS_FIX.md](MODEL_DOWNLOAD_PROGRESS_FIX.md)** - Progress tracking + live network stats (Dec 7, 2025)
- 🔧 **[FIXES_SUMMARY.md](FIXES_SUMMARY.md)** - All bug fixes history

## ❓ FAQ

**Q: Do I need to commit `.env.caption`?**  
A: **No!** It's in `.gitignore` and only for local dev. Production works without it.

**Q: Will the RunPod template work without configuration files?**  
A: **Yes!** Everything uses smart defaults. No .env files needed on RunPod.

**Q: Can I customize the deployment?**  
A: Yes, set `DATASET_MANAGER_REPO` environment variable to use your own fork.

## 🔧 Tech Stack

**Frontend:**
- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- TypeScript
- Virtual scrolling (`@tanstack/react-virtual`)

**Backend:**
- Next.js API Routes
- Node.js file system operations
- `node-stream-zip` for robust extraction

**AI Captioning:**
- Qwen 2.5 VL 7B (Q8 GGUF)
- llama-cpp-python (GPU accelerated)
- Flask API server

## 📦 Project Structure

```
dataset-manager/
├── src/                    # Next.js application
│   ├── app/               # Pages and API routes
│   ├── components/        # React components
│   ├── lib/               # Utilities
│   └── types/             # TypeScript types
├── data/                  # Local data storage
│   ├── datasets/          # Processed datasets
│   ├── uploads/           # Temporary uploads
│   └── exports/           # Dev mode exports
├── caption_service.py     # Qwen caption service
├── runpod_start.sh       # RunPod startup (automated)
├── start_caption_service.bat  # Windows caption service
└── package.json
```

## 🎯 Workflow

1. **Upload** → Drop ZIP with images
2. **Caption** → AI generates descriptions or edit manually
3. **Manage** → Add/remove images, search, filter
4. **Export** → One-click to AI Toolkit format
5. **Train** → Use exported dataset in AI Toolkit

## 🔑 Key Capabilities

### Dataset Management
- Upload multiple ZIPs
- Add images to existing datasets
- Delete selected images
- Search by filename or caption
- Filter by caption status

### AI Captioning
- Hardcoded Qwen 2.5 VL model
- Batch caption 100s of images
- Custom prompts supported
- Professional, training-optimized output

### Export
- **Dev Mode:** Exports to `./data/exports/`
- **Production:** Exports to `/workspace/ai-toolkit/datasets/`
- AI Toolkit format: `{dataset}/1_dataset/{image}.jpg + {image}.txt`

## ⚙️ Configuration

### Development
Create `.env.caption` for local caption service:
```bash
DEV_MODEL_PATH=C:\Models\Qwen2.5-VL-7B-Instruct-Q8_0.gguf
PORT=11435
N_GPU_LAYERS=-1
```

### Production (RunPod)
Environment is automatically configured by `runpod_start.sh`

## 🆘 Troubleshooting

### Upload fails with "Invalid filename"
- The new `node-stream-zip` handles this automatically
- Files with invalid characters are sanitized

### Caption service won't start
- **Dev:** Check `DEV_MODEL_PATH` in `.env.caption`
- **Prod:** Verify model downloaded: `/workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf`

### Export doesn't work
- **Dev:** Always works (local folder)
- **Prod:** Check AI Toolkit models downloaded

## 📞 Support

Join our Discord for:
- Free resources
- Early model access
- Support and troubleshooting

🔗 https://discord.gg/9jVnQHDx

## 📄 License

Private project - UltraMuse

---

**Built with ❤️ for the LoRA training community**
