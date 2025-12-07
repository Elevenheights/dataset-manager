import fs from 'fs';
import path from 'path';
import { InstalledModel, ModelStorageDatabase, ModelFile, ModelType, ModelFamily, SourceType } from './types';

const STORAGE_FILE = process.env.MODELS_DB_PATH || '/workspace/models/installed-models.json';
const MODELS_DIR = process.env.MODELS_DIR || '/workspace/models';
const HF_CACHE_DIR = process.env.HF_HOME || '/workspace/models/huggingface';

// Ensure the storage file and directory exist
function ensureStorageInitialized(): void {
  const dir = path.dirname(STORAGE_FILE);
  
  // Create models directory if it doesn't exist
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }
  
  // Create subdirectories for organization
  const subdirs = ['base', 'lora', 'vae', 'adapter', 'custom', 'zimage', 'qwen', 'flux', 'sdxl'];
  subdirs.forEach(subdir => {
    const subdirPath = path.join(MODELS_DIR, subdir);
    if (!fs.existsSync(subdirPath)) {
      fs.mkdirSync(subdirPath, { recursive: true });
    }
  });
  
  // Create storage directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Initialize storage file if it doesn't exist
  if (!fs.existsSync(STORAGE_FILE)) {
    const initialData: ModelStorageDatabase = {
      version: '1.0.0',
      installedModels: [],
      lastUpdated: new Date()
    };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(initialData, null, 2));
  }
}

// Read the storage database
function readStorage(): ModelStorageDatabase {
  ensureStorageInitialized();
  
  try {
    const data = fs.readFileSync(STORAGE_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Convert date strings back to Date objects
    parsed.lastUpdated = new Date(parsed.lastUpdated);
    parsed.installedModels = parsed.installedModels.map((model: any) => ({
      ...model,
      installedDate: new Date(model.installedDate),
      lastUsed: model.lastUsed ? new Date(model.lastUsed) : undefined
    }));
    
    return parsed;
  } catch (error) {
    console.error('Error reading model storage:', error);
    // Return fresh database if corrupted
    return {
      version: '1.0.0',
      installedModels: [],
      lastUpdated: new Date()
    };
  }
}

// Write to the storage database
function writeStorage(data: ModelStorageDatabase): void {
  ensureStorageInitialized();
  data.lastUpdated = new Date();
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Scan Hugging Face cache for models downloaded by AI Toolkit or huggingface-cli
 * HF cache structure: {HF_HOME}/hub/models--{org}--{name}/snapshots/{revision}/
 */
function scanHuggingFaceCache(): InstalledModel[] {
  const hfModels: InstalledModel[] = [];
  
  try {
    const hubDir = path.join(HF_CACHE_DIR, 'hub');
    
    if (!fs.existsSync(hubDir)) {
      return [];
    }
    
    const entries = fs.readdirSync(hubDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('models--')) {
        // Parse model name: models--org--name -> org/name
        const parts = entry.name.replace('models--', '').split('--');
        if (parts.length < 2) continue;
        
        const repoName = parts.join('/');
        const modelDir = path.join(hubDir, entry.name);
        
        // Find the snapshots directory
        const snapshotsDir = path.join(modelDir, 'snapshots');
        if (!fs.existsSync(snapshotsDir)) continue;
        
        // Get latest snapshot (most recent directory)
        const snapshots = fs.readdirSync(snapshotsDir, { withFileTypes: true })
          .filter(s => s.isDirectory())
          .map(s => ({
            name: s.name,
            path: path.join(snapshotsDir, s.name),
            time: fs.statSync(path.join(snapshotsDir, s.name)).mtime
          }))
          .sort((a, b) => b.time.getTime() - a.time.getTime());
        
        if (snapshots.length === 0) continue;
        
        const latestSnapshot = snapshots[0];
        
        // HF cache uses symlinks - check blobs directory instead
        const blobsDir = path.join(modelDir, 'blobs');
        const files = fs.existsSync(blobsDir) 
          ? scanModelDirectory(blobsDir, false) // Don't recurse into blobs
          : scanModelDirectory(latestSnapshot.path);
        
        if (files.length === 0) {
          // Only log once per model, not on every API call
          continue;
        }
        
        // Determine model family and type from repo name
        let family: ModelFamily = 'custom';
        let type: ModelType = 'base_model';
        
        if (repoName.includes('flux') || repoName.includes('FLUX')) family = 'flux';
        else if (repoName.includes('qwen') || repoName.includes('Qwen')) family = 'qwen';
        else if (repoName.includes('sdxl') || repoName.includes('stable-diffusion-xl')) family = 'sdxl';
        else if (repoName.includes('Z-Image') || repoName.includes('zimage')) family = 'zimage';
        
        if (repoName.includes('adapter') || repoName.includes('Adapter')) type = 'adapter';
        else if (repoName.includes('lora') || repoName.includes('LoRA')) type = 'lora';
        else if (repoName.includes('vae') || repoName.includes('VAE')) type = 'vae';
        
        hfModels.push({
          id: `hf_cache_${repoName.replace(/\//g, '_')}`,
          name: repoName.split('/')[1] || repoName,
          family,
          type,
          installedDate: latestSnapshot.time,
          source: 'huggingface',
          sourceUrl: repoName,
          files,
          totalSize: files.reduce((sum, file) => sum + file.size, 0),
          tags: ['huggingface-cache', 'auto-downloaded'],
        });
      }
    }
  } catch (error) {
    console.error('Error scanning Hugging Face cache:', error);
  }
  
  return hfModels;
}

// Get all installed models (combines manual installs + HF cache)
export function getInstalledModels(): InstalledModel[] {
  const storage = readStorage();
  
  // Verify manually installed models still exist on disk
  const manualModels = storage.installedModels.filter(model => {
    const filesExist = model.files.every(file => {
      try {
        return fs.existsSync(file.path);
      } catch {
        return false;
      }
    });
    
    if (!filesExist) {
      console.warn(`Model ${model.id} has missing files, removing from database`);
    }
    
    return filesExist;
  });
  
  // Scan Hugging Face cache for AI Toolkit downloaded models
  const hfCachedModels = scanHuggingFaceCache();
  
  // Combine both sources
  // Filter out HF cache models if we already have them in manual database (avoid duplicates)
  const manualModelRepos = new Set(manualModels.map(m => m.sourceUrl));
  const uniqueHfModels = hfCachedModels.filter(hf => !manualModelRepos.has(hf.sourceUrl));
  
  return [...manualModels, ...uniqueHfModels];
}

// Get a specific installed model by ID
export function getInstalledModel(id: string): InstalledModel | null {
  const storage = readStorage();
  return storage.installedModels.find(model => model.id === id) || null;
}

// Check if a model is installed (checks both manual DB and HF cache)
export function isModelInstalled(id: string): boolean {
  // First check manual database
  const storage = readStorage();
  const manualModel = storage.installedModels.find(model => model.id === id);
  if (manualModel) return true;
  
  // Also check HF cache by scanning for matching repo names
  // Map model IDs to their HF repos
  const idToRepoMap: Record<string, string[]> = {
    'z-image-de-turbo-bf16': ['ostris/Z-Image-De-Turbo', 'ostris--Z-Image-De-Turbo'],
    'z-image-turbo-bf16': ['Tongyi-MAI/Z-Image-Turbo', 'Tongyi-MAI--Z-Image-Turbo'],
    'z-image-training-adapter': ['ostris/zimage_turbo_training_adapter', 'ostris--zimage_turbo_training_adapter'],
    'qwen-image-base': ['Comfy-Org/Qwen-Image_ComfyUI', 'Comfy-Org--Qwen-Image_ComfyUI'],
    'sdxl-1.0-base': ['stabilityai/stable-diffusion-xl-base-1.0', 'stabilityai--stable-diffusion-xl-base-1.0'],
  };
  
  const repoPatterns = idToRepoMap[id];
  if (repoPatterns) {
    const hubDir = path.join(HF_CACHE_DIR, 'hub');
    if (fs.existsSync(hubDir)) {
      const entries = fs.readdirSync(hubDir);
      for (const entry of entries) {
        for (const pattern of repoPatterns) {
          if (entry.includes(pattern.replace('/', '--'))) {
            // Check if it has actual model files
            const snapshotsDir = path.join(hubDir, entry, 'snapshots');
            if (fs.existsSync(snapshotsDir)) {
              const snapshots = fs.readdirSync(snapshotsDir);
              if (snapshots.length > 0) {
                return true;
              }
            }
          }
        }
      }
    }
  }
  
  return false;
}

// Add a new installed model
export function addInstalledModel(model: InstalledModel): void {
  const storage = readStorage();
  
  // Remove existing model with same ID if it exists
  storage.installedModels = storage.installedModels.filter(m => m.id !== model.id);
  
  // Add new model
  storage.installedModels.push(model);
  
  writeStorage(storage);
}

// Update an existing installed model
export function updateInstalledModel(id: string, updates: Partial<InstalledModel>): boolean {
  const storage = readStorage();
  const index = storage.installedModels.findIndex(m => m.id === id);
  
  if (index === -1) {
    return false;
  }
  
  storage.installedModels[index] = {
    ...storage.installedModels[index],
    ...updates
  };
  
  writeStorage(storage);
  return true;
}

// Remove an installed model
export function removeInstalledModel(id: string): boolean {
  const storage = readStorage();
  const model = storage.installedModels.find(m => m.id === id);
  
  if (!model) {
    return false;
  }
  
  // Delete files from disk
  model.files.forEach(file => {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log(`Deleted file: ${file.path}`);
      }
    } catch (error) {
      console.error(`Error deleting file ${file.path}:`, error);
    }
  });
  
  // Remove from database
  storage.installedModels = storage.installedModels.filter(m => m.id !== id);
  writeStorage(storage);
  
  return true;
}

// Get total disk usage of all installed models
export function getTotalDiskUsage(): number {
  const models = getInstalledModels();
  return models.reduce((total, model) => total + model.totalSize, 0);
}

// Get models by family
export function getInstalledModelsByFamily(family: ModelFamily): InstalledModel[] {
  return getInstalledModels().filter(model => model.family === family);
}

// Get models by type
export function getInstalledModelsByType(type: ModelType): InstalledModel[] {
  return getInstalledModels().filter(model => model.type === type);
}

// Set a model as default for its type
export function setModelAsDefault(id: string): boolean {
  const storage = readStorage();
  const model = storage.installedModels.find(m => m.id === id);
  
  if (!model) {
    return false;
  }
  
  // Remove default flag from other models of the same type
  storage.installedModels.forEach(m => {
    if (m.type === model.type && m.id !== id) {
      m.isDefault = false;
    }
  });
  
  // Set this model as default
  model.isDefault = true;
  
  writeStorage(storage);
  return true;
}

// Get default model for a specific type
export function getDefaultModel(type: ModelType): InstalledModel | null {
  const models = getInstalledModelsByType(type);
  return models.find(m => m.isDefault) || models[0] || null;
}

// Update last used timestamp
export function updateLastUsed(id: string): boolean {
  return updateInstalledModel(id, { lastUsed: new Date() });
}

// Get model file info from disk
export function getModelFileInfo(filePath: string): ModelFile | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const stats = fs.statSync(filePath);
    const filename = path.basename(filePath);
    const ext = path.extname(filename).slice(1);
    
    return {
      filename,
      path: filePath,
      size: stats.size,
      format: ext as any, // Type assertion for format
    };
  } catch (error) {
    console.error(`Error getting file info for ${filePath}:`, error);
    return null;
  }
}

// Scan a directory for model files (recursively for subdirectories)
export function scanModelDirectory(dirPath: string, recursive: boolean = true): ModelFile[] {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    
    const files: ModelFile[] = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1).toLowerCase();
        
        // Check if it's a model file (exclude small config files)
        if (['safetensors', 'gguf', 'ckpt', 'pth', 'bin'].includes(ext)) {
          const fileInfo = getModelFileInfo(fullPath);
          // Only include files larger than 1MB (to skip small config files)
          if (fileInfo && fileInfo.size > 1048576) {
            files.push(fileInfo);
          }
        }
      } else if (entry.isDirectory() && recursive) {
        // Recursively scan subdirectories (SDXL has files in subdirs)
        const subFiles = scanModelDirectory(fullPath, true);
        files.push(...subFiles);
      }
    }
    
    return files;
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
    return [];
  }
}

// Get disk space info
export function getDiskSpaceInfo(): { total: number; used: number; available: number } {
  // This is a simplified version - in production you might want to use a library
  // to get actual disk space information
  const used = getTotalDiskUsage();
  
  return {
    total: 0, // Would need system call to get this
    used,
    available: 0 // Would need system call to get this
  };
}

// Export the models directory path
export function getModelsDirectory(): string {
  return MODELS_DIR;
}

// Get target path for a model
export function getModelTargetPath(family: ModelFamily, modelId: string): string {
  return path.join(MODELS_DIR, family, modelId);
}

// Verify model integrity (check if all files exist)
export function verifyModelIntegrity(id: string): { valid: boolean; missingFiles: string[] } {
  const model = getInstalledModel(id);
  
  if (!model) {
    return { valid: false, missingFiles: [] };
  }
  
  const missingFiles: string[] = [];
  
  model.files.forEach(file => {
    if (!fs.existsSync(file.path)) {
      missingFiles.push(file.filename);
    }
  });
  
  return {
    valid: missingFiles.length === 0,
    missingFiles
  };
}

