import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Model paths (RunPod production paths)
const QWEN_MODEL_PATH = '/workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf';
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

async function checkCaptionService(url: string): Promise<{ available: boolean; error?: string }> {
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.model_loaded) {
        return { available: true };
      } else {
        return { available: false, error: 'Model not loaded in caption service' };
      }
    } else {
      return { available: false, error: `Service returned ${response.status}` };
    }
  } catch (error) {
    return { 
      available: false, 
      error: error instanceof Error ? error.message : 'Service not reachable' 
    };
  }
}

export async function GET() {
  const messages: string[] = [];
  
  // Check Qwen model
  const qwenModel = checkFileOrDir(QWEN_MODEL_PATH);
  
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
    } else {
      messages.push('✅ Caption service is ready');
    }
    
    // Dev mode is always "ready" for export (uses local folders)
    ready = true;
  } else {
    // Production mode - check all models
    if (!qwenModel.exists) {
      messages.push('⚠️ Qwen 2.5 VL model not found - captioning will not work');
      messages.push(`Expected at: ${QWEN_MODEL_PATH}`);
    } else {
      messages.push(`✅ Qwen 2.5 VL model ready (${qwenModel.size})`);
    }
    
    if (!zimageModel.exists) {
      messages.push('⚠️ Z-Image-Turbo model not found - AI Toolkit export may fail');
    } else {
      messages.push('✅ Z-Image-Turbo model ready');
    }
    
    if (!adapterModel.exists) {
      messages.push('⚠️ Training adapter not found - AI Toolkit export may fail');
    } else {
      messages.push('✅ Training adapter ready');
    }
    
    if (!captionServiceStatus.available) {
      messages.push(`⚠️ Caption service not running: ${captionServiceStatus.error}`);
      messages.push('Start with: bash /workspace/caption-service/start_caption_runpod.sh');
    } else {
      messages.push('✅ Caption service is ready');
    }
    
    // Production is ready only if caption service is available
    // Export readiness depends on AI Toolkit models
    ready = captionServiceStatus.available;
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
      url: captionServiceUrl,
      error: captionServiceStatus.error,
    },
    messages,
  };
  
  return NextResponse.json(status);
}

