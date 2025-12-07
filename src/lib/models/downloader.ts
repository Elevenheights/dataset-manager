import fs from 'fs';
import path from 'path';
import { DownloadJob, ModelDefinition, InstalledModel, ModelFile } from './types';
import { addInstalledModel, getModelTargetPath, getModelFileInfo, scanModelDirectory } from './storage';

// In-memory storage for active download jobs
const downloadJobs = new Map<string, DownloadJob>();

// Track child processes for cancellation
const downloadProcesses = new Map<string, any>();

// Generate a unique job ID
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Start a model download
 */
export function startModelDownload(
  model: ModelDefinition,
  options?: {
    huggingfaceToken?: string;
  }
): string {
  const jobId = generateJobId();
  
  const job: DownloadJob = {
    id: jobId,
    modelId: model.id,
    modelName: model.name,
    status: 'pending',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    startedAt: new Date(),
    files: [],
  };
  
  downloadJobs.set(jobId, job);
  
  // Start the download asynchronously
  executeDownload(job, model, options).catch(error => {
    job.status = 'failed';
    job.error = error.message;
    console.error(`Download job ${jobId} failed:`, error);
  });
  
  return jobId;
}

/**
 * Execute the actual download based on source type
 */
async function executeDownload(
  job: DownloadJob,
  model: ModelDefinition,
  options?: {
    huggingfaceToken?: string;
  }
): Promise<void> {
  job.status = 'downloading';
  
  try {
    let files: ModelFile[] = [];
    
    switch (model.sourceType) {
      case 'huggingface':
        files = await downloadFromHuggingFace(job, model, options?.huggingfaceToken);
        break;
      case 'civitai':
        files = await downloadFromCivitAI(job, model);
        break;
      case 'direct_url':
        files = await downloadFromDirectUrl(job, model);
        break;
      default:
        throw new Error(`Unsupported source type: ${model.sourceType}`);
    }
    
    job.status = 'verifying';
    
    // For HF downloads, files are in the cache and will be found by scanHuggingFaceCache
    // For other sources (CivitAI, direct URL), files array is populated
    if (files.length > 0) {
      // Verify all files were downloaded (non-HF sources)
      const allFilesExist = files.every(file => fs.existsSync(file.path));
      
      if (!allFilesExist) {
        throw new Error('Some files failed to download');
      }
      
      // Create installed model entry
      const installedModel: InstalledModel = {
        id: model.id,
        name: model.name,
        family: model.family,
        type: model.type,
        version: model.version,
        installedDate: new Date(),
        source: model.sourceType,
        sourceUrl: model.sourceUrl || model.huggingfaceRepo,
        files,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
        tags: model.tags,
      };
      
      addInstalledModel(installedModel);
    }
    // For HF downloads (files.length === 0), the scanHuggingFaceCache will find them
    // No need to add to database - they'll be auto-discovered
    
    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date();
    
  } catch (error: any) {
    job.status = 'failed';
    job.error = error.message;
    throw error;
  }
}

/**
 * Download from Hugging Face using Python API with hf_transfer for high speed
 * Downloads go to HF cache (/workspace/models/huggingface/hub) which is shared with AI Toolkit
 */
async function downloadFromHuggingFace(
  job: DownloadJob,
  model: ModelDefinition,
  token?: string
): Promise<ModelFile[]> {
  if (!model.huggingfaceRepo) {
    throw new Error('Hugging Face repository not specified');
  }
  
  const filesToDownload = model.huggingfaceFiles || [];
  
  // Initialize file tracking
  if (filesToDownload.length > 0) {
    job.files = filesToDownload.map(filename => ({
      filename,
      status: 'pending',
      progress: 0,
    }));
  } else {
    job.files = [{
      filename: 'All files in repo',
      status: 'pending',
      progress: 0,
    }];
  }
  
  // Parse estimated size
  let estimatedBytes = 0;
  if (model.estimatedSize) {
    const match = model.estimatedSize.match(/(\d+\.?\d*)\s*(GB|MB|TB)/i);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2].toUpperCase();
      estimatedBytes = value * (unit === 'TB' ? 1099511627776 : unit === 'GB' ? 1073741824 : 1048576);
    }
  }
  
  job.totalBytes = estimatedBytes || 1;
  job.downloadedBytes = 0;
  job.progress = 0;
  
  const { spawn } = require('child_process');
  const progressFile = `/tmp/download_${job.id}.json`;
  
  // Use the correct target directory based on model family and ID
  const targetDir = getModelTargetPath(model.family, model.id);
  console.log(`📂 Target directory for ${model.name}: ${targetDir}`);
  
  // Build config for Python script
  const config = {
    source_type: 'huggingface',
    repo_id: model.huggingfaceRepo,
    files: filesToDownload,
    local_dir: targetDir,  // Use family/modelId structure
    token: token || null,
    progress_file: progressFile,
  };
  
  const configJson = JSON.stringify(config);
  
  // Determine python executable
  let pythonPath = 'python3';
  if (fs.existsSync('/app/caption-service/venv/bin/python3')) {
    pythonPath = '/app/caption-service/venv/bin/python3';
  }
  
  console.log(`🐍 Starting Python download for ${model.name}`);
  console.log(`   Python: ${pythonPath}`);
  console.log(`   Script: /app/dataset-manager/download_model.py`);
  console.log(`   Progress file: ${progressFile}`);
  console.log(`   Config: ${configJson.substring(0, 200)}...`);
  
  // Start progress monitoring - scan for .incomplete files and partial downloads
  let progressCheckCount = 0;
  
  const progressInterval = setInterval(() => {
    if (job.status !== 'downloading') {
      clearInterval(progressInterval);
      return;
    }
    
    progressCheckCount++;
    
    // First try to read from progress file (written by Python)
    try {
      if (fs.existsSync(progressFile)) {
        const fileContent = fs.readFileSync(progressFile, 'utf-8');
        const data = JSON.parse(fileContent);
        
        if (data.downloaded !== undefined && data.downloaded > 0) {
          job.downloadedBytes = data.downloaded;
          job.totalBytes = data.total || estimatedBytes;
          job.progress = Math.min(99, Math.round(data.progress || 0));
          job.speed = data.speed;
          job.eta = data.eta;
          return; // Got progress from file, done
        }
      }
    } catch (e) {
      // Progress file might be mid-write, continue to fallback
    }
    
    // Fallback: Scan for download cache files
    // hf_transfer downloads chunks in parallel, so we need to sum ALL files in the cache
    const cacheDir = path.join(targetDir, '.cache', 'huggingface', 'download');
    const altCacheDirs = [
      '/workspace/models/.cache/huggingface/download',
      '/workspace/models/huggingface/hub/.cache',
    ];
    
    let totalDownloaded = 0;
    let foundFiles = false;
    let fileCount = 0;
    let newestMtime = 0;
    
    // Scan the primary cache directory for this download
    const scanCacheDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isFile()) {
            try {
              const stats = fs.statSync(fullPath);
              totalDownloaded += stats.size;
              foundFiles = true;
              fileCount++;
              // Track newest modification time
              if (stats.mtimeMs > newestMtime) {
                newestMtime = stats.mtimeMs;
              }
            } catch (e) {
              // File might be locked
            }
          } else if (entry.isDirectory()) {
            // Recurse into subdirectories
            scanCacheDir(fullPath);
          }
        }
      } catch (e) {
        // Directory might not be accessible
      }
    };
    
    // Scan main cache directory
    scanCacheDir(cacheDir);
    
    // Also check alternative cache locations
    for (const altDir of altCacheDirs) {
      scanCacheDir(altDir);
    }
    
    // Also scan the target directory itself for the final file being written
    if (fs.existsSync(targetDir)) {
      try {
        const entries = fs.readdirSync(targetDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && !entry.name.startsWith('.')) {
            const fullPath = path.join(targetDir, entry.name);
            try {
              const stats = fs.statSync(fullPath);
              // Check if this file is actively being written (modified in last 10 seconds)
              const age = Date.now() - stats.mtimeMs;
              if (age < 10000 && stats.size > 0) {
                totalDownloaded = Math.max(totalDownloaded, stats.size);
                foundFiles = true;
                if (stats.mtimeMs > newestMtime) {
                  newestMtime = stats.mtimeMs;
                }
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
    }
    
    if (foundFiles && estimatedBytes > 0) {
      job.downloadedBytes = totalDownloaded;
      job.totalBytes = estimatedBytes;
      job.progress = Math.min(99, Math.round((totalDownloaded / estimatedBytes) * 100));
      
      // Calculate how recently files were modified
      const secondsSinceUpdate = Math.round((Date.now() - newestMtime) / 1000);
      
      if (progressCheckCount % 5 === 1) {
        console.log(`📊 Download progress: ${job.progress}% (${(totalDownloaded / 1024 / 1024 / 1024).toFixed(2)} GB / ${(estimatedBytes / 1024 / 1024 / 1024).toFixed(2)} GB) | ${fileCount} files | Last update: ${secondsSinceUpdate}s ago`);
      }
      
      // If files haven't been modified in over 30 seconds but download isn't done, might be stalled
      if (secondsSinceUpdate > 30 && job.progress < 99 && progressCheckCount % 15 === 0) {
        console.log(`⚠️ Warning: No file activity for ${secondsSinceUpdate}s - download may be stalled`);
      }
    } else if (progressCheckCount > 3 && job.progress === 0) {
      // Show activity indicator after a few checks
      job.progress = 1 + (progressCheckCount % 3);
      if (job.files.length > 0) {
        job.files[0].status = 'downloading';
      }
      
      if (progressCheckCount % 10 === 1) {
        console.log(`📊 Waiting for download to start... Cache dir: ${cacheDir}`);
      }
    }
  }, 1000); // Check every second
  
  // Execute Python download script
  return new Promise((resolve, reject) => {
    console.log(`🚀 Spawning Python download process...`);
    
    const child = spawn(
      pythonPath,
      ['/app/dataset-manager/download_model.py', configJson],
      {
        cwd: '/workspace/models',
        env: {
          ...process.env,
          HF_HOME: '/workspace/models/huggingface',
          TRANSFORMERS_CACHE: '/workspace/models/huggingface/transformers',
          DIFFUSERS_CACHE: '/workspace/models/huggingface/diffusers',
          HF_HUB_ENABLE_HF_TRANSFER: '1', // Fast parallel downloads
        },
      }
    );
    
    console.log(`✅ Python process spawned with PID: ${child.pid}`);
    
    // Store process for cancellation
    downloadProcesses.set(job.id, child);
    
    let output = '';
    let errorOutput = '';
    
    child.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });
    
    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      errorOutput += text;
      console.log(`📥 ${text.trim()}`);
      
      // Check for disk space errors
      if (text.includes('No space left') || text.includes('disk space')) {
        job.error = 'Not enough disk space';
        job.status = 'failed';
      }
    });
    
    child.on('close', (code: number | null) => {
      clearInterval(progressInterval);
      downloadProcesses.delete(job.id);
      
      // Clean up progress file
      try {
        if (fs.existsSync(progressFile)) fs.unlinkSync(progressFile);
      } catch (e) {}
      
      if (job.status === 'cancelled') {
        resolve([]);
        return;
      }
      
      if (code === 0) {
        // Parse result from Python
        try {
          const result = JSON.parse(output);
          if (result.success) {
            job.files.forEach(file => {
              file.status = 'completed';
              file.progress = 100;
            });
            job.progress = 100;
            job.downloadedBytes = job.totalBytes;
            
            console.log(`✅ Download completed: ${model.name}`);
            
            // For HF downloads with local_dir, files are downloaded to targetDir
            // We need to manually scan and register them
            const targetDir = getModelTargetPath(model.family, model.id);
            
            // Use setTimeout for async delay
            setTimeout(() => {
              try {
                if (fs.existsSync(targetDir)) {
                  const scannedFiles = scanModelDirectory(targetDir);
                  
                  if (scannedFiles.length > 0) {
                    const installedModel: InstalledModel = {
                      id: model.id,
                      name: model.name,
                      family: model.family,
                      type: model.type,
                      version: model.version,
                      installedDate: new Date(),
                      source: 'huggingface',
                      sourceUrl: model.huggingfaceRepo || '',
                      files: scannedFiles,
                      totalSize: scannedFiles.reduce((sum, f) => sum + f.size, 0),
                      tags: model.tags,
                    };
                    
                    addInstalledModel(installedModel);
                    console.log(`✅ Registered ${model.name}: ${scannedFiles.length} files, ${(installedModel.totalSize / 1073741824).toFixed(2)} GB`);
                  } else {
                    console.warn(`⚠️ No files found in ${targetDir} for ${model.name}`);
                    // List what's actually in the directory
                    try {
                      const actualFiles = fs.readdirSync(targetDir);
                      console.warn(`   Directory contents: ${actualFiles.join(', ')}`);
                    } catch (e) {
                      console.warn(`   Could not read directory: ${e}`);
                    }
                  }
                } else {
                  console.warn(`⚠️ Target directory doesn't exist: ${targetDir}`);
                  // Check parent directory
                  const parentDir = path.dirname(targetDir);
                  if (fs.existsSync(parentDir)) {
                    const parentContents = fs.readdirSync(parentDir);
                    console.warn(`   Parent dir (${parentDir}) contains: ${parentContents.join(', ')}`);
                  }
                }
              } catch (e) {
                console.error(`Error registering model: ${e}`);
              }
            }, 500);
            
            resolve([]);
          } else {
            throw new Error(result.error || 'Unknown error');
          }
        } catch (e) {
          reject(new Error(`Failed to parse result: ${output}`));
        }
      } else {
        const errorMsg = output ? JSON.parse(output).error : errorOutput;
        console.error(`❌ Download failed: ${model.name}`);
        job.error = errorMsg || 'Download failed';
        reject(new Error(errorMsg || errorOutput));
      }
    });
    
    child.on('error', (error: Error) => {
      clearInterval(progressInterval);
      downloadProcesses.delete(job.id);
      reject(new Error(`Failed to start Python download: ${error.message}`));
    });
  });
}

/**
 * Download from CivitAI using Python
 */
async function downloadFromCivitAI(
  job: DownloadJob,
  model: ModelDefinition
): Promise<ModelFile[]> {
  if (!model.sourceUrl && !model.civitaiModelId) {
    throw new Error('CivitAI model ID or URL not specified');
  }
  
  const targetDir = getModelTargetPath(model.family, model.id);
  
  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // Parse CivitAI URL to get model ID
  let modelId = model.civitaiModelId;
  
  if (model.sourceUrl && !modelId) {
    const urlMatch = model.sourceUrl.match(/civitai\.com\/models\/(\d+)/);
    if (urlMatch) {
      modelId = urlMatch[1];
    }
  }
  
  if (!modelId) {
    throw new Error('Could not determine CivitAI model ID');
  }
  
  const { spawn } = require('child_process');
  const progressFile = `/tmp/download_${job.id}.json`;
  
  const config = {
    source_type: 'civitai',
    model_id: modelId,
    version_id: model.civitaiVersionId || null,
    output_dir: targetDir,
    progress_file: progressFile,
  };
  
  const configJson = JSON.stringify(config);
  
  console.log(`🐍 Starting CivitAI download for ${model.name}`);
  
  // Monitor progress
  const progressInterval = setInterval(() => {
    if (job.status !== 'downloading') {
      clearInterval(progressInterval);
      return;
    }
    
    try {
      if (fs.existsSync(progressFile)) {
        const data = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
        if (data.downloaded !== undefined) {
          job.downloadedBytes = data.downloaded;
          job.totalBytes = data.total || job.totalBytes;
          job.progress = Math.min(99, Math.round(data.progress || 0));
          job.speed = data.speed;
          job.eta = data.eta;
        }
      }
    } catch (e) {}
  }, 1000);
  
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['/app/dataset-manager/download_model.py', configJson]);
    
    downloadProcesses.set(job.id, child);
    
    let output = '';
    let errorOutput = '';
    
    child.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });
    
    child.stderr?.on('data', (data: Buffer) => {
      errorOutput += data.toString();
      console.log(`📥 ${data.toString().trim()}`);
    });
    
    child.on('close', (code: number | null) => {
      clearInterval(progressInterval);
      downloadProcesses.delete(job.id);
      
      try {
        if (fs.existsSync(progressFile)) fs.unlinkSync(progressFile);
      } catch (e) {}
      
      if (job.status === 'cancelled') {
        resolve([]);
        return;
      }
      
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          if (result.success) {
            job.progress = 100;
            console.log(`✅ CivitAI download completed: ${model.name}`);
            
            const fileInfo = getModelFileInfo(result.path);
            resolve(fileInfo ? [fileInfo] : []);
          } else {
            throw new Error(result.error || 'Unknown error');
          }
        } catch (e) {
          reject(new Error(`Failed to parse result: ${output}`));
        }
      } else {
        const errorMsg = output ? JSON.parse(output).error : errorOutput;
        job.error = errorMsg || 'Download failed';
        reject(new Error(errorMsg || errorOutput));
      }
    });
    
    child.on('error', (error: Error) => {
      clearInterval(progressInterval);
      downloadProcesses.delete(job.id);
      reject(new Error(`Failed to start download: ${error.message}`));
    });
  });
}

/**
 * Download from direct URL using Python
 */
async function downloadFromDirectUrl(
  job: DownloadJob,
  model: ModelDefinition
): Promise<ModelFile[]> {
  if (!model.sourceUrl) {
    throw new Error('Source URL not specified');
  }
  
  const targetDir = getModelTargetPath(model.family, model.id);
  
  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // Extract filename from URL
  const urlParts = model.sourceUrl.split('/');
  const filename = urlParts[urlParts.length - 1] || 'model.safetensors';
  const filePath = path.join(targetDir, filename);
  
  const { spawn } = require('child_process');
  const progressFile = `/tmp/download_${job.id}.json`;
  
  const config = {
    source_type: 'url',
    url: model.sourceUrl,
    output_path: filePath,
    progress_file: progressFile,
  };
  
  const configJson = JSON.stringify(config);
  
  console.log(`🐍 Starting URL download for ${model.name}`);
  
  // Monitor progress
  const progressInterval = setInterval(() => {
    if (job.status !== 'downloading') {
      clearInterval(progressInterval);
      return;
    }
    
    try {
      if (fs.existsSync(progressFile)) {
        const data = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
        if (data.downloaded !== undefined) {
          job.downloadedBytes = data.downloaded;
          job.totalBytes = data.total || job.totalBytes;
          job.progress = Math.min(99, Math.round(data.progress || 0));
          job.speed = data.speed;
          job.eta = data.eta;
        }
      }
    } catch (e) {}
  }, 1000);
  
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['/app/dataset-manager/download_model.py', configJson]);
    
    downloadProcesses.set(job.id, child);
    
    let output = '';
    let errorOutput = '';
    
    child.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });
    
    child.stderr?.on('data', (data: Buffer) => {
      errorOutput += data.toString();
      console.log(`📥 ${data.toString().trim()}`);
    });
    
    child.on('close', (code: number | null) => {
      clearInterval(progressInterval);
      downloadProcesses.delete(job.id);
      
      try {
        if (fs.existsSync(progressFile)) fs.unlinkSync(progressFile);
      } catch (e) {}
      
      if (job.status === 'cancelled') {
        resolve([]);
        return;
      }
      
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          if (result.success) {
            job.progress = 100;
            console.log(`✅ URL download completed: ${model.name}`);
            
            const fileInfo = getModelFileInfo(result.path);
            resolve(fileInfo ? [fileInfo] : []);
          } else {
            throw new Error(result.error || 'Unknown error');
          }
        } catch (e) {
          reject(new Error(`Failed to parse result: ${output}`));
        }
      } else {
        const errorMsg = output ? JSON.parse(output).error : errorOutput;
        job.error = errorMsg || 'Download failed';
        reject(new Error(errorMsg || errorOutput));
      }
    });
    
    child.on('error', (error: Error) => {
      clearInterval(progressInterval);
      downloadProcesses.delete(job.id);
      reject(new Error(`Failed to start download: ${error.message}`));
    });
  });
}

/**
 * Generic file download with progress tracking
 */
async function downloadFile(
  url: string,
  destinationPath: string,
  onProgress?: (progress: { downloaded: number; total: number; percent: number; speed?: number; eta?: number }) => void
): Promise<void> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  const fileStream = fs.createWriteStream(destinationPath);
  
  let downloadedBytes = 0;
  let lastUpdate = Date.now();
  let lastBytes = 0;
  
  if (!response.body) {
    throw new Error('Response body is null');
  }
  
  const reader = response.body.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    fileStream.write(Buffer.from(value));
    downloadedBytes += value.length;
    
    // Update progress
    if (onProgress && contentLength > 0) {
      const now = Date.now();
      const timeDiff = (now - lastUpdate) / 1000; // seconds
      
      if (timeDiff >= 0.5) { // Update every 500ms
        const bytesDiff = downloadedBytes - lastBytes;
        const speed = bytesDiff / timeDiff; // bytes per second
        const remaining = contentLength - downloadedBytes;
        const eta = speed > 0 ? remaining / speed : 0;
        
        onProgress({
          downloaded: downloadedBytes,
          total: contentLength,
          percent: (downloadedBytes / contentLength) * 100,
          speed,
          eta,
        });
        
        lastUpdate = now;
        lastBytes = downloadedBytes;
      }
    }
  }
  
  await new Promise<void>((resolve, reject) => {
    fileStream.end(() => resolve());
    fileStream.on('error', reject);
  });
}

/**
 * Get download job status
 */
export function getDownloadJob(jobId: string): DownloadJob | null {
  return downloadJobs.get(jobId) || null;
}

/**
 * Get all download jobs
 */
export function getAllDownloadJobs(): DownloadJob[] {
  return Array.from(downloadJobs.values());
}

/**
 * Cancel a download job
 */
export function cancelDownloadJob(jobId: string): boolean {
  const job = downloadJobs.get(jobId);
  
  if (!job) {
    return false;
  }
  
  if (job.status === 'downloading') {
    job.status = 'cancelled';
    
    // Kill the child process if it exists
    const process = downloadProcesses.get(jobId);
    if (process) {
      try {
        process.kill('SIGTERM');
        // Also kill any child processes (huggingface-cli)
        const { execSync } = require('child_process');
        execSync(`pkill -P ${process.pid} 2>/dev/null || true`, { stdio: 'ignore' });
      } catch (e) {
        console.log('Error killing download process:', e);
      }
      downloadProcesses.delete(jobId);
    }
  }
  
  return true;
}

/**
 * Clear completed/failed jobs
 */
export function clearCompletedJobs(): void {
  for (const [jobId, job] of downloadJobs.entries()) {
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      downloadJobs.delete(jobId);
    }
  }
}

/**
 * Handle local file upload
 */
export async function handleLocalUpload(
  file: {
    path: string;
    filename: string;
    size: number;
  },
  model: {
    id: string;
    name: string;
    family: string;
    type: string;
    tags?: string[];
  }
): Promise<InstalledModel> {
  const targetDir = getModelTargetPath(model.family as any, model.id);
  
  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const targetPath = path.join(targetDir, file.filename);
  
  // Move file to target location
  fs.renameSync(file.path, targetPath);
  
  // Get file info
  const fileInfo = getModelFileInfo(targetPath);
  
  if (!fileInfo) {
    throw new Error('Failed to verify uploaded file');
  }
  
  // Create installed model entry
  const installedModel: InstalledModel = {
    id: model.id,
    name: model.name,
    family: model.family as any,
    type: model.type as any,
    installedDate: new Date(),
    source: 'local_upload',
    files: [fileInfo],
    totalSize: fileInfo.size,
    tags: model.tags,
  };
  
  addInstalledModel(installedModel);
  
  return installedModel;
}

