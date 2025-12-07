import { NextResponse } from 'next/server';
import { exec } from 'child_process';

export async function POST() {
  try {
    // Trigger the download command in the background
    // We use nohup to ensure it keeps running even if this request ends
    exec('nohup bash -c "source /app/ai-toolkit/venv/bin/activate && export HF_HUB_ENABLE_HF_TRANSFER=1 && huggingface-cli download unsloth/Qwen2.5-VL-7B-Instruct-GGUF Qwen2.5-VL-7B-Instruct-Q8_0.gguf --local-dir /workspace/models" > /workspace/download_retry.log 2>&1 &');
    
    exec('nohup bash -c "source /app/ai-toolkit/venv/bin/activate && export HF_HUB_ENABLE_HF_TRANSFER=1 && huggingface-cli download ostris/Z-Image-De-Turbo z_image_de_turbo_v1_bf16.safetensors --local-dir /workspace/models" >> /workspace/download_retry.log 2>&1 &');

    return NextResponse.json({
      success: true,
      message: 'Download started in background'
    });
  } catch (error) {
    console.error('Download retry error:', error);
    return NextResponse.json(
      { error: 'Failed to start download' },
      { status: 500 }
    );
  }
}

