import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Model paths (RunPod production paths)
// Qwen 2.5 VL requires BOTH files for vision support
const QWEN_MODEL_PATH = '/workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf';
const QWEN_MMPROJ_PATH = '/workspace/models/mmproj-F16.gguf';
const ZIMAGE_MODEL_PATH = '/workspace/models/z_image_de_turbo_v1_bf16.safetensors';
const ADAPTER_MODEL_PATH = '/workspace/models/zimage_turbo_training_adapter';

// For development, check if we're in dev mode
const isDev = process.env.NODE_ENV === 'development' || process.env.DEV_MODE === 'true';

interface ModelStatus {
  exists: boolean;
  path: string;
  size?: string;
}

interface SystemStatus {
  ready: boolean;
  dev_mode: boolean;
  qwen_caption_model: ModelStatus;
  ai_toolkit_models: {
    zimage_turbo: ModelStatus;
    training_adapter: ModelStatus;
  };
  caption_service: {
    available: boolean;
    ready: boolean;
    downloading: boolean;
    url: string;
    error?: string;
  };
  messages: string[];
}

function checkFileOrDir(filePath: string): ModelStatus {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const size = stats.isDirectory() 
        ? 'directory' 
        : `${(stats.size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
      
      return {
        exists: true,
        path: filePath,
        size,
      };
    }
  } catch (error) {
    // File doesn't exist or can't be accessed
  }
  
  return {
    exists: false,
    path: filePath,
  };
}

async function checkCaptionService(url: string): Promise<{ 
  available: boolean; 
  ready: boolean;
  downloading: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Service is running if we get a response
      const available = data.status === 'ok' || data.status === 'waiting_for_model';
      
      // Ready = model exists and can be loaded
      const ready = data.ready === true || data.model_exists === true;
      
      // Downloading = model is being downloaded
      const downloading = data.download_status === 'downloading';
      
      return { available, ready, downloading };
    } else {
      return { available: false, ready: false, downloading: false, error: `Service returned ${response.status}` };
    }
  } catch (error) {
    return { 
      available: false, 
      ready: false,
      downloading: false,
      error: error instanceof Error ? error.message : 'Service not reachable' 
    };
  }
}

export async function GET() {
  const messages: string[] = [];
  
  // Check Qwen model files (need BOTH for vision support)
  const qwenModel = checkFileOrDir(QWEN_MODEL_PATH);
  const qwenMmproj = checkFileOrDir(QWEN_MMPROJ_PATH);
  const qwenComplete = qwenModel.exists && qwenMmproj.exists;
  
  // Check AI Toolkit models
  const zimageModel = checkFileOrDir(ZIMAGE_MODEL_PATH);
  const adapterModel = checkFileOrDir(ADAPTER_MODEL_PATH);
  
  // Check caption service
  const captionServiceUrl = process.env.QWEN_SERVICE_URL || 'http://localhost:11435';
  const captionServiceStatus = await checkCaptionService(captionServiceUrl);
  
  // Determine overall readiness
  let ready = true;
  
  // In dev mode, we might not have the production paths
  if (isDev) {
    messages.push('Running in DEVELOPMENT mode');
    messages.push('AI Toolkit model checks skipped (dev mode)');
    messages.push('Export will save to local workspace folder');
    
    // In dev mode, only caption service matters
    if (!captionServiceStatus.available) {
      messages.push(`⚠️ Caption service not ready: ${captionServiceStatus.error}`);
      messages.push('Start the caption service with start_caption_service.bat');
    } else if (captionServiceStatus.downloading) {
      messages.push('📥 Qwen model is downloading... Caption service will be ready soon');
    } else if (!captionServiceStatus.ready) {
      messages.push('⚠️ Caption service is running but Qwen model files not found');
      messages.push('Download both model and vision encoder from the Caption page');
    } else {
      messages.push('✅ Caption service is ready');
    }
    
    // Dev mode is always "ready" for export (uses local folders)
    ready = true;
  } else {
    // Production mode - check all models
    if (!qwenComplete) {
      messages.push('⚠️ Qwen 2.5 VL model files not complete - captioning will not work');
      if (!qwenModel.exists) {
        messages.push(`  Missing: ${QWEN_MODEL_PATH}`);
      }
      if (!qwenMmproj.exists) {
        messages.push(`  Missing: ${QWEN_MMPROJ_PATH} (vision encoder)`);
      }
    } else {
      messages.push(`✅ Qwen 2.5 VL model ready (${qwenModel.size})`);
      messages.push(`✅ Vision encoder ready (${qwenMmproj.size})`);
    }
    
    // Don't warn about missing training models - AI Toolkit downloads them automatically
    // Only show if they exist
    if (zimageModel.exists) {
      messages.push('✅ Z-Image model found in cache');
    }
    
    if (adapterModel.exists) {
      messages.push('✅ Training adapter found in cache');
    }
    
    if (!captionServiceStatus.available) {
      messages.push(`⚠️ Caption service not running: ${captionServiceStatus.error}`);
      messages.push('Waiting for service to start...');
    } else if (captionServiceStatus.downloading) {
      messages.push('📥 Qwen model is downloading... This may take several minutes');
      messages.push('Caption service will be ready once download completes');
    } else if (!captionServiceStatus.ready) {
      messages.push('⚠️ Caption service is running but Qwen model not found');
      messages.push('Download will start automatically, please wait...');
    } else {
      messages.push('✅ Caption service is ready');
    }
    
    // Production is ready if caption service is ready AND model exists
    ready = captionServiceStatus.ready;
  }
  
  const status: SystemStatus = {
    ready,
    dev_mode: isDev,
    qwen_caption_model: qwenModel,
    ai_toolkit_models: {
      zimage_turbo: zimageModel,
      training_adapter: adapterModel,
    },
    caption_service: {
      available: captionServiceStatus.available,
      ready: captionServiceStatus.ready,
      downloading: captionServiceStatus.downloading,
      url: captionServiceUrl,
      error: captionServiceStatus.error,
    },
    messages,
  };
  
  return NextResponse.json(status);
}

