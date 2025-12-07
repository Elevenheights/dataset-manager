# System Architecture

## 🏗️ Complete System Overview

```
┌─────────────────────────────────────────────────────────┐
│              RunPod Template (Your Website)             │
│  Downloads: runpod_start.sh → Runs automatically       │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  runpod_start.sh                        │
│  Orchestrates entire deployment automatically           │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌────────┐    ┌──────────┐    ┌──────────┐
    │ Clone  │    │ Download │    │  Setup   │
    │ Repos  │    │  Models  │    │ Services │
    └────┬───┘    └────┬─────┘    └────┬─────┘
         │             │               │
         ▼             ▼               ▼
┌──────────────────────────────────────────────┐
│         Final Deployment (/workspace)        │
├──────────────────────────────────────────────┤
│                                              │
│  📂 dataset-manager/      (Port 3000)       │
│     ├─ Next.js UI                           │
│     ├─ caption_service.py                   │
│     └─ data/                                │
│                                              │
│  📂 caption-service/      (Port 11435)      │
│     ├─ caption_service.py (deployed)        │
│     ├─ venv/                                │
│     └─ Qwen 2.5 VL loaded                  │
│                                              │
│  📂 ai-toolkit/          (Port 8675)        │
│     ├─ Training UI                          │
│     ├─ datasets/  ← Exports go here         │
│     └─ venv/                                │
│                                              │
│  📂 models/                                 │
│     ├─ Qwen2.5-VL-7B-Instruct-Q8_0.gguf    │
│     ├─ Z-Image-Turbo/                      │
│     └─ zimage_turbo_training_adapter/      │
│                                              │
│  📂 ComfyUI/                                │
│     └─ Inference tools                      │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 🔄 Data Flow

### Upload → Caption → Export → Train

```
1. USER UPLOADS ZIP
   Dataset Manager (port 3000)
   ↓
   Extracts to: /workspace/dataset-manager/data/datasets/{id}/

2. AI CAPTIONS IMAGES
   Dataset Manager → Caption Service API (port 11435)
   ↓
   Qwen 2.5 VL generates captions
   ↓
   Captions saved as .txt files alongside images

3. USER EXPORTS DATASET
   Dataset Manager copies files
   ↓
   /workspace/ai-toolkit/datasets/{name}/1_dataset/
   ├─ image1.jpg
   ├─ image1.txt
   └─ ...

4. USER TRAINS LORA
   AI Toolkit UI (port 8675)
   ↓
   Reads from datasets/ folder
   ↓
   Trains using Z-Image-Turbo
   ↓
   Outputs trained LoRA
```

---

## 🎛️ Service Communication

```
┌──────────────────┐
│  User Browser    │
└────────┬─────────┘
         │
         ├─────────────────────────────────┐
         │                                 │
         ▼                                 ▼
┌─────────────────┐              ┌─────────────────┐
│ Dataset Manager │              │  AI Toolkit UI  │
│  (Next.js)      │              │  (Node.js)      │
│  Port 3000      │              │  Port 8675      │
└────────┬────────┘              └─────────────────┘
         │
         │ API calls
         ▼
┌─────────────────┐
│ Caption Service │
│  (Flask)        │
│  Port 11435     │
└────────┬────────┘
         │
         │ Model inference
         ▼
┌─────────────────┐
│  Qwen 2.5 VL    │
│  (GGUF Model)   │
│  GPU/CPU        │
└─────────────────┘
```

---

## 💾 Configuration Strategy

### Environment Detection
```python
# caption_service.py
DEV_MODEL_PATH = os.getenv('DEV_MODEL_PATH')

if DEV_MODEL_PATH:
    # Local development - uses .env.caption or environment variable
    MODEL_PATH = DEV_MODEL_PATH
else:
    # Production - hardcoded path
    MODEL_PATH = "/workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf"
```

```typescript
// Next.js API routes
const isDev = process.env.NODE_ENV === 'development';

if (isDev) {
    exportPath = './data/exports/';
} else {
    exportPath = '/workspace/ai-toolkit/datasets/';
}
```

### No Config Files Needed
- ✅ Smart defaults for everything
- ✅ Environment detection (dev vs prod)
- ✅ Hardcoded production paths
- ✅ Optional override via environment variables

---

## 🔐 What Goes in Git vs What Doesn't

### ✅ Committed to Git:
```
✓ Source code (src/)
✓ package.json, requirements.txt
✓ runpod_start.sh
✓ caption_service.py
✓ .env.caption.example (template only)
✓ Documentation (*.md)
✓ .gitignore
```

### ❌ NOT Committed (.gitignore):
```
✗ .env.caption (local dev config)
✗ node_modules/ (npm dependencies)
✗ venv_caption/ (Python venv)
✗ .next/ (build output)
✗ data/ (user datasets)
✗ *.log (log files)
```

### 📦 Downloaded on Deployment:
```
⬇ node_modules/ (npm install)
⬇ venv/ (pip install)
⬇ Models (~20GB)
⬇ AI Toolkit (git clone)
⬇ ComfyUI (git clone)
```

---

## 🚀 Deployment Sequence

### RunPod Template Execution Order

```
1. RunPod creates container
   └─> Base image: PyTorch + CUDA

2. Template runs start command
   └─> wget runpod_start.sh from your website

3. runpod_start.sh executes
   ├─> Clones dataset-manager from git
   ├─> Clones ai-toolkit from GitHub
   ├─> Clones ComfyUI from GitHub
   ├─> Downloads models from HuggingFace
   ├─> npm install (dataset-manager)
   ├─> npm install (ai-toolkit/ui)
   ├─> pip install (caption service with CUDA)
   ├─> pip install (ai-toolkit)
   ├─> npm run build (dataset-manager)
   ├─> Deploys caption_service.py
   ├─> Starts caption service in background
   ├─> Starts dataset-manager in background
   └─> Starts ai-toolkit UI in background

4. Services running
   ├─> Dataset Manager: http://localhost:3000
   ├─> Caption Service: http://localhost:11435
   └─> AI Toolkit: http://localhost:8675

5. Container stays alive (tail -f /dev/null)
```

**Total time:** ~25 minutes (mostly model downloads)

---

## 🎯 Zero-Config Philosophy

The entire system is designed for **zero configuration**:

1. **No .env files required** in production
2. **No manual path configuration** needed
3. **No service account setup** required
4. **No API keys** to configure (uses local models)
5. **Smart defaults** for everything
6. **Automatic environment detection** (dev vs prod)

**User clicks template → Wait → Use app**

That's it! 🎉

---

## 🔧 Advanced: Customization Points

If users want to customize:

**Fork the repository:**
```bash
# Set custom repo in template
export DATASET_MANAGER_REPO="https://github.com/UserFork/CustomVersion.git"
```

**Override model locations:**
```bash
# In template environment variables
export DEV_MODEL_PATH="/custom/path/to/model.gguf"
```

**Change ports:**
```bash
# In template start script
export PORT=3001  # Dataset Manager
export QWEN_PORT=11436  # Caption Service
```

But **99% of users won't need any customization** - defaults just work!

