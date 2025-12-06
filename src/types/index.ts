export interface DatasetImage {
  id: string;
  filename: string;
  path: string;
  thumbnailUrl: string;
  fullUrl: string;
  caption: string;
  hasCaption: boolean;
  width?: number;
  height?: number;
  size?: number;
}

export interface Dataset {
  id: string;
  name: string;
  createdAt: string;
  images: DatasetImage[];
  totalImages: number;
  captionedCount: number;
}

export interface UploadProgress {
  status: 'idle' | 'uploading' | 'extracting' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
  totalFiles?: number;
  processedFiles?: number;
}

export interface CaptionRequest {
  imageId: string;
  prompt?: string;
}

export interface BulkCaptionRequest {
  imageIds: string[];
  prompt?: string;
  overwriteExisting?: boolean;
}

export interface CaptionResponse {
  imageId: string;
  caption: string;
  success: boolean;
  error?: string;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  systemPrompt: string;
}

export interface ExportConfig {
  outputPath: string;
  folderStructure: 'flat' | 'numbered';
  prefix?: string;
}




