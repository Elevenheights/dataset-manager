import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

// Qwen 2.5 VL requires BOTH files for vision support
const QWEN_MODEL_PATH = '/workspace/models/Qwen2.5-VL-7B-Instruct-Q8_0.gguf';
const QWEN_MMPROJ_PATH = '/workspace/models/mmproj-F16.gguf';
const QWEN_MODEL_SIZE = 8589934592; // ~8 GB
const QWEN_MMPROJ_SIZE = 1449480192; // ~1.35 GB
const QWEN_TOTAL_SIZE = QWEN_MODEL_SIZE + QWEN_MMPROJ_SIZE; // ~9.4 GB total
const HF_DOWNLOAD_CACHE = '/workspace/models/.cache/huggingface/download';
const PID_FILE = '/workspace/qwen-download.pid';

// Track the download process
let qwenDownloadProcess: ChildProcess | null = null;

// Helper to find incomplete download files and calculate progress
function getDownloadProgress(): { downloading: boolean; progress: number; downloadedBytes: number } {
  // Check for .incomplete files in HF download cache
  const searchPaths = [
    HF_DOWNLOAD_CACHE,
    '/workspace/models/huggingface/hub',
  ];
  
  let totalIncomplete = 0;
  let foundIncomplete = false;
  
  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;
    
    try {
      const files = fs.readdirSync(searchPath, { recursive: true }) as string[];
      for (const file of files) {
        const fullPath = path.join(searchPath, file);
        if (file.includes('.incomplete') && fs.existsSync(fullPath)) {
          try {
            const stats = fs.statSync(fullPath);
            totalIncomplete += stats.size;
            foundIncomplete = true;
          } catch (e) {
            // File might be locked, skip
          }
        }
      }
    } catch (e) {
      // Directory might not be accessible
    }
  }
  
  if (foundIncomplete) {
    const progress = Math.min(99, Math.round((totalIncomplete / QWEN_TOTAL_SIZE) * 100));
    return { downloading: true, progress, downloadedBytes: totalIncomplete };
  }
  
  return { downloading: false, progress: 0, downloadedBytes: 0 };
}

// POST - Start downloading Qwen caption model
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Handle cancel request
    if (body.action === 'cancel') {
      return cancelQwenDownload();
    }
    
    // Check if in dev mode (Windows environment)
    const isDevMode = process.env.NODE_ENV === 'development' || process.platform === 'win32';
    
    if (isDevMode) {
      // In dev mode, don't actually download - just return a message
      return NextResponse.json({
        success: true,
        devMode: true,
        message: 'Qwen model download disabled in development mode. Deploy to production to enable.',
        downloadStarted: false,
      });
    }
    
    // Check if BOTH files already exist
    const modelExists = fs.existsSync(QWEN_MODEL_PATH);
    const mmprojExists = fs.existsSync(QWEN_MMPROJ_PATH);
    
    if (modelExists && mmprojExists) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        message: 'Qwen caption model and vision encoder already downloaded',
      });
    }
    
    // Check if already downloading
    if (qwenDownloadProcess || fs.existsSync(PID_FILE)) {
      return NextResponse.json({
        success: true,
        message: 'Download already in progress',
        downloadStarted: false,
      });
    }

    // Use Python for download (like other models) instead of bash
    // Download BOTH model and vision encoder
    const progressFile = `/tmp/qwen-download.json`;
    const config = {
      source_type: 'huggingface',
      repo_id: 'unsloth/Qwen2.5-VL-7B-Instruct-GGUF',
      files: ['Qwen2.5-VL-7B-Instruct-Q8_0.gguf', 'mmproj-F16.gguf'],
      local_dir: '/workspace/models',
      progress_file: progressFile,
    };
    
    // Determine python executable (prefer caption service venv which has deps)
    let pythonPath = 'python3';
    if (fs.existsSync('/app/caption-service/venv/bin/python3')) {
      pythonPath = '/app/caption-service/venv/bin/python3';
    }
    
    qwenDownloadProcess = spawn(pythonPath, [
      '/app/dataset-manager/download_model.py',
      JSON.stringify(config)
    ], {
      cwd: '/workspace/models',
      env: {
        ...process.env,
        HF_HOME: '/workspace/models/huggingface',
        HF_HUB_ENABLE_HF_TRANSFER: '1',
      },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    // Save PID for tracking
    if (qwenDownloadProcess.pid) {
      fs.writeFileSync(PID_FILE, qwenDownloadProcess.pid.toString());
    }
    
    // Log output
    qwenDownloadProcess.stdout?.on('data', (data) => {
      fs.appendFileSync('/workspace/qwen-download.log', data.toString());
    });
    
    qwenDownloadProcess.stderr?.on('data', (data) => {
      fs.appendFileSync('/workspace/qwen-download.log', data.toString());
    });
    
    qwenDownloadProcess.on('close', (code) => {
      qwenDownloadProcess = null;
      try { fs.unlinkSync(PID_FILE); } catch (e) {}
      console.log(`Qwen download process exited with code ${code}`);
    });
    
    // Unref so it doesn't block Node from exiting
    qwenDownloadProcess.unref();
    
    return NextResponse.json({
      success: true,
      message: 'Qwen caption model download started',
      downloadStarted: true,
    });
  } catch (error: any) {
    console.error('Error starting Qwen download:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start download' },
      { status: 500 }
    );
  }
}

// Cancel Qwen download
function cancelQwenDownload() {
  try {
    // Kill tracked process
    if (qwenDownloadProcess) {
      qwenDownloadProcess.kill('SIGTERM');
      qwenDownloadProcess = null;
    }
    
    // Also check PID file for spawned process
    if (fs.existsSync(PID_FILE)) {
      const pid = fs.readFileSync(PID_FILE, 'utf-8').trim();
      try {
        process.kill(parseInt(pid), 'SIGTERM');
        // Kill child processes too
        const { execSync } = require('child_process');
        execSync(`pkill -P ${pid} 2>/dev/null || true`, { stdio: 'ignore' });
      } catch (e) {
        // Process may already be dead
      }
      fs.unlinkSync(PID_FILE);
    }
    
    // Clean up incomplete files
    const incompleteFiles = [
      '/workspace/models/.cache/huggingface/download',
    ];
    
    for (const dir of incompleteFiles) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            if (file.includes('.incomplete')) {
              fs.unlinkSync(path.join(dir, file));
            }
          }
        } catch (e) {}
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Download cancelled',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET - Check download status with real progress
export async function GET() {
  try {
    // Check if in dev mode (Windows environment)
    const isDevMode = process.env.NODE_ENV === 'development' || process.platform === 'win32';
    
    if (isDevMode) {
      // In dev mode, pretend both files exist to avoid download attempts
      return NextResponse.json({
        success: true,
        exists: true, // Fake it in dev mode
        modelExists: true,
        mmprojExists: true,
        devMode: true,
        downloadInProgress: false,
        fileSize: QWEN_TOTAL_SIZE,
        expectedSize: QWEN_TOTAL_SIZE,
        progress: 100,
        error: null,
      });
    }
    
    // Check if BOTH files exist
    const modelExists = fs.existsSync(QWEN_MODEL_PATH);
    const mmprojExists = fs.existsSync(QWEN_MMPROJ_PATH);
    const bothExist = modelExists && mmprojExists;
    
    let fileSize = 0;
    if (modelExists) {
      const stats = fs.statSync(QWEN_MODEL_PATH);
      fileSize += stats.size;
    }
    if (mmprojExists) {
      const stats = fs.statSync(QWEN_MMPROJ_PATH);
      fileSize += stats.size;
    }
    
    // Get real download progress
    const downloadInfo = getDownloadProgress();
    
    // Check log file for errors
    let error = null;
    if (fs.existsSync('/workspace/qwen-download.log')) {
      try {
        const log = fs.readFileSync('/workspace/qwen-download.log', 'utf-8');
        if (log.includes('Not enough free disk space')) {
          error = 'Not enough disk space';
        } else if (log.includes('Error') || log.includes('error')) {
          const lines = log.split('\n').filter(l => l.toLowerCase().includes('error'));
          error = lines[lines.length - 1] || 'Download error';
        }
      } catch (e) {
        // Log might not exist yet
      }
    }
    
    return NextResponse.json({
      success: true,
      exists: bothExist,
      modelExists,
      mmprojExists,
      downloadInProgress: downloadInfo.downloading,
      fileSize: bothExist ? fileSize : downloadInfo.downloadedBytes,
      expectedSize: QWEN_TOTAL_SIZE,
      progress: bothExist ? 100 : downloadInfo.progress,
      error,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

