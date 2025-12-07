# UltraMuse Dataset Manager - Project Overview

**Professional LoRA training dataset preparation tool with AI-powered captioning and model management.**

---

## 📍 Current Status (December 7, 2025)

### ✅ Production Ready Features
- **Dataset Management** - Upload, organize, and manage training datasets
- **AI Captioning** - Qwen 2.5 VL 7B generates professional captions
- **Model Manager** - Download and manage AI models from HuggingFace, CivitAI, or direct URLs
- **AI Toolkit Integration** - One-click export to AI Toolkit training format
- **Virtual Scrolling** - Handle 1000+ images smoothly
- **Docker Deployment** - Full containerized deployment with RunPod template

### 🔧 Recent Updates (Latest Session)

**Model Download Progress Tracking (FIXED)**
- **Issue**: Progress bar stuck at 0% despite active downloads
- **Solution**: Implemented `.incomplete` file scanning (same as Qwen download)
- **Added**: Live network stats showing real-time download speed
- **Added**: User-friendly message explaining progress may pause during chunk transfers
- Files: `src/lib/models/downloader.ts`, `src/components/ModelDownloadProgress.tsx`, `src/app/api/system/network/route.ts`

**Previous Fixes**
- Image path resolution (Windows to Docker compatibility)
- Caption service status checking
- Bulk caption improvements
- Model cache unification with AI Toolkit

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                  Docker Container                       │
│                                                         │
│  📦 Dataset Manager (Port 3000)                        │
│     ├─ Next.js 16 Frontend                            │
│     ├─ API Routes (Backend)                           │
│     └─ Data: /workspace/datasets/                     │
│                                                         │
│  📦 Caption Service (Port 11435)                       │
│     ├─ Flask API                                       │
│     ├─ Qwen 2.5 VL 7B Model                          │
│     └─ llama-cpp-python (GPU)                         │
│                                                         │
│  📦 AI Toolkit (Port 8675)                             │
│     ├─ Training UI                                     │
│     ├─ Receives exports from Dataset Manager          │
│     └─ Shares model cache                             │
│                                                         │
│  📦 Shared Model Storage                               │
│     └─ /workspace/models/                             │
│         ├─ huggingface/ (Unified HF cache)           │
│         ├─ zimage/                                    │
│         ├─ flux/                                      │
│         ├─ sdxl/                                      │
│         └─ qwen/                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Upload ZIP → Extract to /workspace/datasets/{id}/
2. AI Caption → Qwen service generates .txt files
3. Export → Copy to /workspace/ai-toolkit/datasets/
4. Train → AI Toolkit reads dataset for LoRA training
```

---

## 📂 Project Structure

```
dataset-manager/
├── src/
│   ├── app/                      # Next.js pages & API routes
│   │   ├── api/                  # Backend endpoints
│   │   │   ├── datasets/         # Dataset CRUD
│   │   │   ├── captions/         # Caption updates
│   │   │   ├── images/           # Image management
│   │   │   ├── models/           # Model manager API
│   │   │   ├── ollama/           # Caption generation
│   │   │   ├── export/           # AI Toolkit export
│   │   │   └── system/           # System status, network
│   │   ├── page.tsx              # Home page
│   │   ├── caption/              # Caption management UI
│   │   ├── models/               # Model manager UI
│   │   ├── train/                # Training config UI
│   │   └── upload/               # Upload UI
│   ├── components/               # React components
│   │   ├── BulkCaptionModal.tsx
│   │   ├── CaptionEditor.tsx
│   │   ├── ImageGrid.tsx
│   │   ├── ModelCard.tsx
│   │   ├── ModelDownloadProgress.tsx  # NEW: Live network stats
│   │   └── ModelSelector.tsx
│   ├── lib/                      # Business logic
│   │   ├── dataset.ts            # Dataset operations
│   │   ├── ollama.ts             # Caption service client
│   │   ├── zip.ts                # ZIP extraction
│   │   └── models/               # Model management
│   │       ├── types.ts          # TypeScript types
│   │       ├── registry.ts       # Built-in model catalog
│   │       ├── storage.ts        # Model database & HF cache scan
│   │       └── downloader.ts     # Multi-source downloads
│   └── types/                    # Global TypeScript types
├── data/                         # Local development data
│   ├── datasets/                 # Extracted datasets
│   ├── uploads/                  # Temporary uploads
│   └── exports/                  # Dev mode exports
├── caption_service.py            # Qwen caption Flask API
├── download_model.py             # Python downloader (hf_transfer)
├── docker_start.sh               # Docker entrypoint
├── Dockerfile                    # Container definition
├── package.json                  # Node.js dependencies
└── requirements.txt              # Python dependencies

Documentation:
├── README.md                     # Main readme
├── PROJECT_OVERVIEW.md           # This file (consolidated docs)
├── QUICKSTART.md                 # 5-minute setup guide
├── ARCHITECTURE.md               # System architecture
├── RUNPOD_TEMPLATE.md            # RunPod template config
└── [Various fix summaries]       # Bug fix documentation
```

---

## 🚀 Quick Start

### Local Development (Windows)

```powershell
# 1. Start Dataset Manager
cd dataset-manager
npm install
npm run dev
# Opens: http://localhost:3000

# 2. (Optional) Start Caption Service
# First time: Copy .env.caption.example → .env.caption
# Set: DEV_MODEL_PATH=C:\Path\To\Qwen2.5-VL-7B-Instruct-Q8_0.gguf
start_caption_service.bat
# Runs on: http://localhost:11435
```

### Docker (Production)

```powershell
docker build -t ultramuse-dataset-manager:latest .
docker run -d --name dataset-manager \
  -p 3000:3000 -p 11435:11435 -p 8675:8675 \
  -v dataset-manager-data:/workspace \
  ultramuse-dataset-manager:latest
```

### RunPod (One-Click)

1. Select **"UltraMuse Dataset Manager"** template
2. Click **Deploy**
3. Wait ~25 minutes ☕
4. Access: `http://<runpod-url>:3000`

**All services auto-start:** Dataset Manager, Caption Service, AI Toolkit UI

---

## 🎯 Features

### Dataset Management
- ✅ Upload multiple ZIP files
- ✅ Add/remove images dynamically
- ✅ Search by filename or caption
- ✅ Filter by caption status
- ✅ Virtual scrolling (1000+ images)
- ✅ Bulk operations

### AI Captioning
- ✅ Qwen 2.5 VL 7B (8B Q8 GGUF)
- ✅ Single or bulk caption generation
- ✅ Custom prompt support
- ✅ Professional, training-optimized output
- ✅ GPU acceleration (llama-cpp-python)

### Model Manager
- ✅ Built-in model registry (Z-Image, Flux, SDXL, Qwen)
- ✅ Download from HuggingFace, CivitAI, direct URLs
- ✅ Upload local model files
- ✅ **Live download progress with network stats** (NEW)
- ✅ Unified HF cache (shared with AI Toolkit)
- ✅ Disk usage tracking
- ✅ Token support for gated models

### Export Integration
- ✅ One-click export to AI Toolkit format
- ✅ Select base model for training
- ✅ Automatic directory structure
- ✅ ZIP export for portability
- ✅ Dev/prod environment detection

---

## 🔧 Tech Stack

**Frontend:**
- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- TypeScript
- Virtual scrolling (`@tanstack/react-virtual`)

**Backend:**
- Next.js API Routes
- Node.js file operations
- `node-stream-zip` for ZIP handling
- Python subprocess for downloads

**AI Services:**
- Qwen 2.5 VL 7B (Q8 GGUF)
- llama-cpp-python (GPU)
- Flask API server
- hf_transfer for fast downloads

**Infrastructure:**
- Docker containerization
- RunPod template deployment
- Volume-based persistence

---

## 📊 Key Workflows

### Complete Training Pipeline

```
1. UPLOAD
   User uploads ZIP → Extracts to dataset folder

2. CAPTION
   AI generates descriptions → Saves as .txt files

3. MANAGE
   User edits captions, adds/removes images

4. EXPORT
   One-click → AI Toolkit datasets folder
   Format: {dataset}/1_dataset/{image}.jpg + {image}.txt

5. TRAIN
   AI Toolkit → Trains LoRA using Z-Image or Flux

6. INFERENCE
   Use trained LoRA in ComfyUI or other tools
```

### Model Management

```
DOWNLOAD:
  HuggingFace → hf_transfer (fast parallel)
  CivitAI → Direct API download
  Direct URL → Standard HTTPS download
  Local → File upload
  ↓
  Organized storage: /workspace/models/{family}/
  ↓
  Tracked in: installed-models.json
  ↓
  Auto-discovery: Scans HF cache for AI Toolkit models

PROGRESS TRACKING:
  Python writes progress → /tmp/download_*.json
  TypeScript scans .incomplete files (hf_transfer)
  UI polls every 1s → Updates progress bar
  NEW: Live network stats → Shows actual download speed
```

---

## 🔐 Configuration

### Environment Detection

```typescript
// Automatic dev vs prod detection
const isDev = process.env.NODE_ENV === 'development';

// Dev mode
if (isDev) {
  CAPTION_SERVICE_URL = 'http://localhost:11435'
  EXPORT_PATH = './data/exports/'
  MODEL_PATH = process.env.DEV_MODEL_PATH
}

// Production mode
else {
  CAPTION_SERVICE_URL = 'http://localhost:11435'
  EXPORT_PATH = '/workspace/ai-toolkit/datasets/'
  MODEL_PATH = '/workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf'
}
```

### Files Needed

**Development:**
- `.env.caption` (optional, for local caption service)
- No other config files needed

**Production:**
- No config files needed! All paths hardcoded

**Git (.gitignore):**
- `.env.caption` ❌ (local only)
- `node_modules/` ❌
- `data/` ❌
- `.next/` ❌

---

## 🆘 Troubleshooting

### Model Download Issues

**Progress stuck at 0%:**
- ✅ FIXED: Now scans .incomplete files
- ✅ NEW: Shows live network stats to confirm download
- Check: Network indicator shows download speed

**Download seems frozen:**
- Check: "Last update: Xs ago" in logs
- Normal: Progress may pause during chunk writes
- Warning: If >30s with no file activity

### Caption Service

**Not starting:**
- Dev: Check `DEV_MODEL_PATH` in `.env.caption`
- Prod: Verify model exists at `/workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf`
- Check: `curl http://localhost:11435/health`

**Slow generation:**
- Expected: ~5-15s per image (CPU mode)
- GPU: ~1-3s per image (CUDA enabled)
- Bulk: Processes sequentially

### Image Path Issues

**Images not displaying:**
- ✅ FIXED: Now stores relative paths only
- Old datasets: May need path fix script (see FIXES_SUMMARY.md)
- Check: metadata.json should have filenames, not full paths

---

## 📈 Performance

### Benchmarks

**Dataset Operations:**
- ZIP upload (1000 images): ~30-60s
- Virtual scrolling: Handles 5000+ images smoothly
- Search/filter: Instant (<100ms)

**AI Captioning:**
- Single image (GPU): 1-3s
- Single image (CPU): 5-15s
- Bulk 100 images (GPU): 2-5 minutes
- Bulk 100 images (CPU): 8-15 minutes

**Model Downloads:**
- HuggingFace (hf_transfer): 50-200 MB/s
- CivitAI: 20-100 MB/s (varies)
- Direct URL: Depends on source

**Disk Usage:**
- Dataset Manager: ~50 MB
- Caption Service: ~200 MB
- Qwen Model: 8.5 GB
- Z-Image Models: ~9.3 GB
- Flux Models: ~24 GB each
- User datasets: Varies

---

## 🔮 Roadmap

### Planned Features
- [ ] Model quantization tools
- [ ] Automatic tag generation (Danbooru/e621 style)
- [ ] Image editing (crop, resize, rotate)
- [ ] Dataset versioning
- [ ] Multi-user support
- [ ] Cloud storage integration (S3, etc.)
- [ ] Advanced search (semantic, visual similarity)
- [ ] Dataset analytics dashboard

### Under Consideration
- [ ] Video dataset support
- [ ] Audio caption generation
- [ ] Custom model fine-tuning UI
- [ ] Collaborative captioning
- [ ] API for external tools
- [ ] Plugin system

---

## 📞 Support & Community

**Discord:** https://discord.gg/4zbGm5j6jW
- Free resources
- Early model access
- Support and troubleshooting
- Community datasets

**Repository:** Private (UltraMuse)

**Documentation:**
- `README.md` - Main readme
- `QUICKSTART.md` - Quick setup
- `ARCHITECTURE.md` - System design
- `RUNPOD_TEMPLATE.md` - Deployment template
- `FIXES_SUMMARY.md` - Bug fix history

---

## 📄 License

Private project - UltraMuse  
Built with ❤️ for the LoRA training community

---

## 🎓 Development Notes

### Adding New Features

**New API Endpoint:**
1. Create route in `src/app/api/{feature}/route.ts`
2. Implement GET/POST/PUT/DELETE handlers
3. Use TypeScript types from `src/types/`
4. Return `NextResponse.json()`

**New Model Source:**
1. Add download method in `src/lib/models/downloader.ts`
2. Update `ModelDefinition` type if needed
3. Add to registry in `src/lib/models/registry.ts`
4. Update UI in `src/components/AddCustomModelForm.tsx`

**New UI Component:**
1. Create in `src/components/`
2. Use Tailwind + CSS variables for theming
3. Keep components small and focused
4. Export as default

### Code Style

- **TypeScript:** Strict mode, explicit types
- **React:** Functional components, hooks
- **API Routes:** Error handling with try/catch
- **Naming:** camelCase (variables), PascalCase (components)
- **Comments:** Explain "why", not "what"

### Testing Locally

```powershell
# Development server
npm run dev

# Production build
npm run build
npm start

# Docker test
.\rebuild-and-restart.ps1
```

---

**Last Updated:** December 7, 2025  
**Version:** 1.5.0  
**Status:** Production Ready ✅

