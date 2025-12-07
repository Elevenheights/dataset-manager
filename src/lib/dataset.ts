import fs from 'fs';
import path from 'path';
import { DatasetImage, Dataset } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Storage paths
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DATASETS_DIR = path.join(DATA_DIR, 'datasets');
const METADATA_FILE = path.join(DATA_DIR, 'metadata.json');

// Ensure directories exist
export function ensureDirectories() {
  [DATA_DIR, UPLOADS_DIR, DATASETS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Initialize metadata file
function getMetadata(): { currentDataset: string | null; datasets: Record<string, Dataset> } {
  ensureDirectories();
  if (!fs.existsSync(METADATA_FILE)) {
    const initial = { currentDataset: null, datasets: {} };
    fs.writeFileSync(METADATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
}

function saveMetadata(metadata: { currentDataset: string | null; datasets: Record<string, Dataset> }) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

// Get current dataset
export function getCurrentDataset(): Dataset | null {
  const metadata = getMetadata();
  if (!metadata.currentDataset) return null;
  return metadata.datasets[metadata.currentDataset] || null;
}

// Create a new dataset from extracted files
export function createDataset(name: string, imageFiles: string[]): Dataset {
  const metadata = getMetadata();
  const datasetId = uuidv4();
  const datasetDir = path.join(DATASETS_DIR, datasetId);
  
  if (!fs.existsSync(datasetDir)) {
    fs.mkdirSync(datasetDir, { recursive: true });
  }

  const images: DatasetImage[] = imageFiles.map(filePath => {
    const filename = path.basename(filePath);
    const id = uuidv4();
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    
    // Copy image to dataset directory
    const newPath = path.join(datasetDir, filename);
    fs.copyFileSync(filePath, newPath);
    
    // Check for existing caption file
    const captionPath = path.join(path.dirname(filePath), `${baseName}.txt`);
    let caption = '';
    if (fs.existsSync(captionPath)) {
      caption = fs.readFileSync(captionPath, 'utf-8').trim();
      // Copy caption file too
      const newCaptionPath = path.join(datasetDir, `${baseName}.txt`);
      fs.copyFileSync(captionPath, newCaptionPath);
    }
    
    return {
      id,
      filename,
      path: filename, // Store only filename, not full path (prevents Windows path issues in Docker)
      thumbnailUrl: `/api/images/${datasetId}/${filename}?thumb=true`,
      fullUrl: `/api/images/${datasetId}/${filename}`,
      caption,
      hasCaption: caption.length > 0,
    };
  });

  const dataset: Dataset = {
    id: datasetId,
    name,
    createdAt: new Date().toISOString(),
    images,
    totalImages: images.length,
    captionedCount: images.filter(img => img.hasCaption).length,
  };

  metadata.datasets[datasetId] = dataset;
  metadata.currentDataset = datasetId;
  saveMetadata(metadata);

  return dataset;
}

// Update image caption
export function updateCaption(datasetId: string, imageId: string, caption: string): DatasetImage | null {
  const metadata = getMetadata();
  const dataset = metadata.datasets[datasetId];
  if (!dataset) return null;

  const imageIndex = dataset.images.findIndex(img => img.id === imageId);
  if (imageIndex === -1) return null;

  const image = dataset.images[imageIndex];
  image.caption = caption;
  image.hasCaption = caption.trim().length > 0;

  // Save caption to file
  const ext = path.extname(image.filename);
  const baseName = path.basename(image.filename, ext);
  const captionPath = path.join(DATASETS_DIR, datasetId, `${baseName}.txt`);
  fs.writeFileSync(captionPath, caption);

  // Update counts
  dataset.captionedCount = dataset.images.filter(img => img.hasCaption).length;
  
  saveMetadata(metadata);
  return image;
}

// Get dataset by ID
export function getDataset(datasetId: string): Dataset | null {
  const metadata = getMetadata();
  return metadata.datasets[datasetId] || null;
}

// Get image by ID
export function getImage(datasetId: string, imageId: string): DatasetImage | null {
  const dataset = getDataset(datasetId);
  if (!dataset) return null;
  return dataset.images.find(img => img.id === imageId) || null;
}

// Get image file path
export function getImagePath(datasetId: string, filename: string): string | null {
  const imagePath = path.join(DATASETS_DIR, datasetId, filename);
  if (fs.existsSync(imagePath)) {
    return imagePath;
  }
  return null;
}

// Export dataset to AI toolkit folder
export function exportDataset(
  datasetId: string, 
  outputPath: string, 
  overwrite: boolean = false
): { success: boolean; message: string; exportedCount: number; finalPath: string } {
  const dataset = getDataset(datasetId);
  if (!dataset) {
    return { success: false, message: 'Dataset not found', exportedCount: 0, finalPath: '' };
  }

  try {
    // Sanitize dataset name
    const sanitizedName = dataset.name.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    // Determine dataset root folder (handle versioning)
    let datasetRoot = path.join(outputPath, sanitizedName);
    
    if (!overwrite) {
      let version = 1;
      // Check if folder exists (and check if it's version 1 implied)
      if (fs.existsSync(datasetRoot)) {
        // Try finding next available version
        let nextVersion = 1;
        while (fs.existsSync(path.join(outputPath, `${sanitizedName}-${nextVersion}`))) {
          nextVersion++;
        }
        // If base exists but no hyphenated version, start at -1
        // If base exists AND hyphenated versions exist, use next number
        datasetRoot = path.join(outputPath, `${sanitizedName}-${nextVersion}`);
      }
    } else {
      // Overwrite - remove if exists
      if (fs.existsSync(datasetRoot)) {
        fs.rmSync(datasetRoot, { recursive: true, force: true });
      }
    }
    
    // Create concept folder inside dataset root
    // AI Toolkit expects: dataset_name/10_triggerword/images...
    // We'll use '1_dataset' as default concept folder
    const tokenFolder = path.join(datasetRoot, '1_dataset');
    
    // Create folders
    fs.mkdirSync(tokenFolder, { recursive: true });

    let exportedCount = 0;
    for (const image of dataset.images) {
      const ext = path.extname(image.filename);
      const baseName = path.basename(image.filename, ext);
      
      // Copy image
      const srcImagePath = path.join(DATASETS_DIR, datasetId, image.filename);
      const destImagePath = path.join(tokenFolder, image.filename);
      if (fs.existsSync(srcImagePath)) {
        fs.copyFileSync(srcImagePath, destImagePath);
      }
      
      // Copy/create caption file
      const destCaptionPath = path.join(tokenFolder, `${baseName}.txt`);
      fs.writeFileSync(destCaptionPath, image.caption || '');
      
      exportedCount++;
    }

    return { 
      success: true, 
      message: `Successfully exported ${exportedCount} images to ${path.basename(datasetRoot)}/1_dataset`, 
      exportedCount,
      finalPath: datasetRoot,
    };
  } catch (error) {
    return { 
      success: false, 
      message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      exportedCount: 0,
      finalPath: '',
    };
  }
}

// Clear current dataset
export function clearDataset(datasetId: string): boolean {
  const metadata = getMetadata();
  if (!metadata.datasets[datasetId]) return false;

  // Remove dataset directory
  const datasetDir = path.join(DATASETS_DIR, datasetId);
  if (fs.existsSync(datasetDir)) {
    fs.rmSync(datasetDir, { recursive: true });
  }

  delete metadata.datasets[datasetId];
  if (metadata.currentDataset === datasetId) {
    metadata.currentDataset = null;
  }
  saveMetadata(metadata);
  return true;
}

// Get uploads directory
export function getUploadsDir(): string {
  ensureDirectories();
  return UPLOADS_DIR;
}

// Clear uploads directory
export function clearUploads(): void {
  if (fs.existsSync(UPLOADS_DIR)) {
    fs.rmSync(UPLOADS_DIR, { recursive: true });
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}



