# Model Manager - Feature Documentation

## Overview

The Model Manager is a comprehensive system for browsing, downloading, and managing AI training models directly from the UltraMuse web interface.

## Features

### 1. Built-in Model Registry

Pre-configured models ready to download:

**Z-Image Models:**
- Z-Image De-Turbo v1 BF16 (6.8 GB) - Base model
- Z-Image Turbo Training Adapter (2.5 GB) - Required for training

**Qwen Models:**
- Qwen2.5-VL 7B Instruct Q8 (8.5 GB) - Vision-language captioning
- Qwen Image Base Model (15 GB) - Image generation training

**Flux Models:**
- Flux.1 Dev (23.8 GB) - High-quality generation [Requires HF token]
- Flux.1 Schnell (23.8 GB) - Fast variant
- Flux.2 Dev (24.5 GB) - Latest version [Requires HF token]
- Flux SPRO (24.1 GB) - Professional variant [Requires HF token]

**SDXL Models:**
- SDXL 1.0 Base (6.9 GB) - Standard SDXL
- SDXL 1.0 Refiner (6.1 GB) - Refinement model
- SDXL Turbo (6.9 GB) - Fast single-step variant

### 2. Custom Model Support

Add models from multiple sources:

**Hugging Face:**
- Enter repository path (e.g., `username/model-name`)
- Specify files to download
- Optional token support for gated/private models
- Automatic download with progress tracking

**CivitAI:**
- Paste model URL
- Automatic version detection
- Direct download from CivitAI CDN

**Direct URLs:**
- Any direct download link to .safetensors, .gguf, etc.
- Progress tracking and resume support

**Local Upload:**
- Upload model files from your computer
- Supports .safetensors, .gguf, .ckpt, .pth, .bin

### 3. Model Organization

Models are automatically organized in `/workspace/models/`:
```
/workspace/models/
├── zimage/          # Z-Image models
├── qwen/            # Qwen models
├── flux/            # Flux models
├── sdxl/            # SDXL models
├── custom/          # Custom uploaded models
├── base/            # Generic base models
├── lora/            # LoRA files
├── vae/             # VAE models
├── adapter/         # Training adapters
└── installed-models.json  # Model database
```

### 4. Export Integration

When exporting datasets to AI Toolkit:
- Select which base model to use for training
- Model selector shows only installed base models
- Optional - can configure manually in AI Toolkit later

## Technical Architecture

### Backend Components

**Model Types System** (`src/lib/models/types.ts`):
- TypeScript interfaces for all model-related types
- DownloadJob tracking
- InstalledModel database schema

**Model Registry** (`src/lib/models/registry.ts`):
- Centralized registry of built-in models
- Search and filter functionality
- Validation helpers

**Storage Service** (`src/lib/models/storage.ts`):
- JSON-based model database
- CRUD operations for installed models
- Disk usage tracking
- Model verification

**Download Service** (`src/lib/models/downloader.ts`):
- Multi-source download support
- Progress tracking
- Resume capability
- File upload handling

### API Routes

- `GET /api/models` - List available models with install status
- `POST /api/models` - Add custom model to registry
- `GET /api/models/installed` - List installed models
- `DELETE /api/models/installed?id=<id>` - Remove model
- `POST /api/models/download` - Start download (returns jobId)
- `GET /api/models/download/[jobId]` - Check download progress
- `DELETE /api/models/download/[jobId]` - Cancel download
- `POST /api/models/upload` - Upload local model file

### Frontend Components

**ModelCard** (`src/components/ModelCard.tsx`):
- Display model information
- Download/install buttons
- Token input for gated models
- Status indicators

**ModelDownloadProgress** (`src/components/ModelDownloadProgress.tsx`):
- Real-time download progress popup
- Multiple downloads tracked
- Speed and ETA display

**ModelSelector** (`src/components/ModelSelector.tsx`):
- Reusable dropdown for selecting installed models
- Filter by type and family
- Used in export workflow

**AddCustomModelForm** (`src/components/AddCustomModelForm.tsx`):
- Multi-source model addition
- Form validation
- Upload progress

**Models Page** (`src/app/models/page.tsx`):
- Three-tab interface
- Search and filter
- Disk usage summary

## Usage Examples

### Downloading a Built-in Model

```typescript
// Frontend
const response = await fetch('/api/models/download', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    modelId: 'flux-1-dev',
    huggingfaceToken: 'hf_...' // For gated models
  })
});

const { jobId } = await response.json();

// Poll for progress
const job = await fetch(`/api/models/download/${jobId}`);
```

### Adding a Custom Model

```typescript
const response = await fetch('/api/models', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Custom Model',
    type: 'base_model',
    sourceType: 'huggingface',
    huggingfaceRepo: 'username/model-name',
    huggingfaceFiles: ['model.safetensors', 'config.json'],
    description: 'Custom fine-tuned model',
    tags: ['custom', 'fine-tune']
  })
});
```

### Listing Installed Models

```typescript
const response = await fetch('/api/models/installed');
const { models, totalDiskUsage } = await response.json();
```

### Using ModelSelector in Components

```tsx
import ModelSelector from '@/components/ModelSelector';

<ModelSelector
  modelType="base_model"
  modelFamily="flux"
  value={selectedModel}
  onChange={(modelId, model) => {
    console.log('Selected:', modelId, model);
  }}
  label="Select Base Model"
  required={true}
/>
```

## Environment Variables

- `MODELS_DIR` - Model storage location (default: `/workspace/models`)
- `MODELS_DB_PATH` - Model database location (default: `/workspace/models/installed-models.json`)

## Data Persistence

All model data persists on the RunPod volume at `/workspace/models/`:
- Model files are stored in organized subdirectories
- `installed-models.json` tracks all installed models
- Survives container restarts/rebuilds
- Shared across all running containers on the same volume

## Security Notes

**Hugging Face Tokens:**
- Tokens are NOT stored permanently
- Required each time for gated models
- Transmitted securely over HTTPS
- Only "Read" permission needed

**Model Sources:**
- CivitAI: Uses official API (v1)
- Direct URLs: Standard HTTPS downloads
- Uploads: Validated file types only

## Troubleshooting

**Model won't download:**
- Check Hugging Face token (if required)
- Verify internet connectivity
- Check disk space on volume
- View download job status for errors

**Model missing after download:**
- Check `/workspace/models/installed-models.json`
- Verify files exist on disk
- Run integrity check from UI

**Slow downloads:**
- RunPod datacenter has fast connections
- Local testing may be slower
- CivitAI varies by region

## Future Enhancements

Potential additions for v2:
- Model quantization tools
- Automatic model conversion
- Model benchmarking
- Shared model library across users
- Model preview/testing interface
- Integration with more training frameworks

