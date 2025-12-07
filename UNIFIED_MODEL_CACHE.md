# Unified Model Cache System

## Overview

The Model Manager uses the **Hugging Face cache** as the central storage for all models. This creates a unified system where models downloaded by any tool are visible to all other tools.

## How It Works

### 1. Hugging Face Cache Location

All models are stored in:
```
/workspace/models/huggingface/
├── hub/              # Model files (organized by repo)
├── transformers/     # Transformers cache
└── diffusers/        # Diffusers cache
```

### 2. Environment Variables

Set in `docker_start.sh` on container startup:
```bash
export HF_HOME=/workspace/models/huggingface
export TRANSFORMERS_CACHE=/workspace/models/huggingface/transformers
export DIFFUSERS_CACHE=/workspace/models/huggingface/diffusers
export HF_HUB_CACHE=/workspace/models/huggingface/hub
```

### 3. All Tools Share the Same Cache

**Model Manager** downloads:
```bash
huggingface-cli download "black-forest-labs/FLUX.1-dev"
# Downloads to: /workspace/models/huggingface/hub/models--black-forest-labs--FLUX.1-dev/
```

**AI Toolkit** auto-downloads (from config):
```yaml
model:
  name_or_path: "black-forest-labs/FLUX.1-dev"
# Also downloads to: /workspace/models/huggingface/hub/models--black-forest-labs--FLUX.1-dev/
```

**Result:** Same model, same location, no duplicates! ✅

### 4. Model Manager Auto-Discovery

The Model Manager automatically scans the HF cache and shows:
- ✅ Models you downloaded via Model Manager UI
- ✅ Models AI Toolkit downloaded during training
- ✅ Models downloaded via `huggingface-cli` command
- ✅ Models downloaded by any tool using HF libraries

## Benefits

### No Duplicate Downloads
- AI Toolkit needs Flux? It downloads to HF cache
- Later, Model Manager shows it as "Installed"
- No need to download again!

### Disk Space Efficiency
- One copy of each model
- All tools share the cache
- Easy to track total usage

### Persistence
- HF cache is on `/workspace` volume
- Survives container restarts
- Shared across container rebuilds

### Compatibility
- Works with all HF-based tools (Diffusers, Transformers, AI Toolkit, etc.)
- Standard HF cache structure
- Can move between tools seamlessly

## Model Manager View

The "Installed Models" tab shows:

**Manually Downloaded Models:**
- Downloaded via Model Manager UI
- Tracked in `installed-models.json`
- Full metadata (name, type, tags, etc.)

**AI Toolkit Auto-Downloaded Models:**
- Discovered by scanning HF cache
- Shown with badge: "Auto-downloaded"
- Basic metadata inferred from repo name
- Can be removed/managed like manual models

## Example Workflow

1. **User exports dataset** in Dataset Manager
2. **Opens AI Toolkit UI** and creates training config
3. **Config specifies:** `name_or_path: "black-forest-labs/FLUX.1-dev"`
4. **AI Toolkit starts training** → downloads Flux to HF cache (if not present)
5. **User opens Model Manager** → sees Flux listed as "Installed"
6. **Next training run** → AI Toolkit finds Flux in cache, no re-download!

## Technical Details

### HF Cache Structure

```
/workspace/models/huggingface/hub/
└── models--{org}--{model}/
    ├── refs/                    # Branch references
    ├── snapshots/
    │   └── {hash}/              # Specific version
    │       ├── model.safetensors
    │       ├── config.json
    │       └── ...other files
    └── blobs/                   # Deduplicated file storage
```

### Scanning Logic

`scanHuggingFaceCache()` in [`storage.ts`](dataset-manager/src/lib/models/storage.ts):
1. Scans `/workspace/models/huggingface/hub/`
2. Finds directories matching `models--{org}--{model}`
3. Gets latest snapshot (most recent)
4. Scans for .safetensors, .gguf, .ckpt files
5. Infers model family/type from repo name
6. Returns as InstalledModel[]

### Model Removal

When removing a model from Model Manager:
- If manually downloaded: Deletes files and database entry
- If HF cache: Only deletes from HF cache (AI Toolkit won't find it anymore)
- Disk space immediately reclaimed

## Configuration

### For AI Toolkit Integration

No configuration needed! AI Toolkit automatically uses `HF_HOME` environment variable.

### For Custom Tools

To use the unified cache in your own tools:
```python
# Python
import os
os.environ['HF_HOME'] = '/workspace/models/huggingface'

# Then use transformers/diffusers normally
from transformers import AutoModel
model = AutoModel.from_pretrained("model-name")  # Uses cache!
```

```javascript
// Node.js (if using HF libraries)
process.env.HF_HOME = '/workspace/models/huggingface';
```

## Migration from Old System

If you had models in `/workspace/models/` (flat structure):
1. They'll still work
2. Model Manager can scan and import them
3. New downloads go to HF cache
4. Old models can be moved to HF cache manually if desired

## Disk Space Management

The Model Manager shows:
- **Total HF Cache Usage**: All models from all sources
- **Per-Model Size**: Individual model disk usage  
- **Remove Button**: Safely delete models

Models are deduplicated automatically by HF's blob storage system!

## Summary

✅ **One cache to rule them all**
✅ **No duplicate downloads**
✅ **Works with AI Toolkit out of the box**
✅ **Persists across restarts**
✅ **Easy to manage**

This is the best of both worlds: automatic model management + manual control when needed!

