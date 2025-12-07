// Model Management Types

export type ModelType = 
  | 'base_model'
  | 'lora'
  | 'vae'
  | 'adapter'
  | 'text_encoder'
  | 'controlnet'
  | 'other';

export type ModelFormat = 
  | 'safetensors'
  | 'gguf'
  | 'ckpt'
  | 'pth'
  | 'bin';

export type SourceType = 
  | 'huggingface'
  | 'civitai'
  | 'direct_url'
  | 'local_upload';

export type ModelFamily = 
  | 'zimage'
  | 'qwen'
  | 'flux'
  | 'sdxl'
  | 'sd15'
  | 'custom';

export interface ModelDefinition {
  id: string;
  name: string;
  family: ModelFamily;
  type: ModelType;
  description: string;
  version?: string;
  
  // Source information
  sourceType: SourceType;
  sourceUrl?: string; // HF repo, CivitAI URL, or direct URL
  huggingfaceRepo?: string; // e.g., "black-forest-labs/FLUX.1-dev"
  huggingfaceFiles?: string[]; // specific files to download
  civitaiModelId?: string;
  civitaiVersionId?: string;
  
  // File information
  format: ModelFormat;
  fileSize?: number; // in bytes
  estimatedSize?: string; // human-readable, e.g., "6.8 GB"
  
  // Requirements
  requiresToken?: boolean; // for gated HF models
  requiresLicense?: boolean;
  licenseUrl?: string;
  
  // Metadata
  tags?: string[];
  compatibility?: string[]; // which workflows this works with
  recommended?: boolean;
  previewImage?: string;
  
  // Installation info
  targetPath?: string; // where to install relative to /workspace/models/
}

export interface InstalledModel {
  id: string;
  name: string;
  family: ModelFamily;
  type: ModelType;
  version?: string;
  
  // Installation details
  installedDate: Date;
  source: SourceType;
  sourceUrl?: string;
  
  // File information
  files: ModelFile[];
  totalSize: number;
  
  // Status
  isDefault?: boolean;
  lastUsed?: Date;
  
  // Metadata
  tags?: string[];
  notes?: string;
}

export interface ModelFile {
  filename: string;
  path: string; // absolute path on disk
  size: number;
  format: ModelFormat;
  checksum?: string;
}

export interface DownloadJob {
  id: string;
  modelId: string;
  modelName: string;
  
  // Progress
  status: 'pending' | 'downloading' | 'verifying' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
  speed?: number; // bytes per second
  eta?: number; // seconds remaining
  
  // Timestamps
  startedAt: Date;
  completedAt?: Date;
  
  // Error handling
  error?: string;
  retryCount?: number;
  
  // Files
  files: {
    filename: string;
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    progress: number;
  }[];
}

export interface ModelStorageDatabase {
  version: string;
  installedModels: InstalledModel[];
  lastUpdated: Date;
}

export interface AddCustomModelRequest {
  name: string;
  type: ModelType;
  sourceType: SourceType;
  sourceUrl?: string;
  huggingfaceRepo?: string;
  huggingfaceFiles?: string[];
  huggingfaceToken?: string;
  civitaiUrl?: string;
  description?: string;
  tags?: string[];
}

