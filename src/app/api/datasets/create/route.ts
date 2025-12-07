import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATASETS_DIR = path.join(DATA_DIR, 'datasets');
const METADATA_FILE = path.join(DATA_DIR, 'metadata.json');

// Read metadata.json
function getMetadata(): { currentDataset: string | null; datasets: Record<string, any> } {
  if (!fs.existsSync(METADATA_FILE)) {
    return { currentDataset: null, datasets: {} };
  }
  return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
}

// Save metadata.json
function saveMetadata(metadata: { currentDataset: string | null; datasets: Record<string, any> }) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Dataset name is required',
      }, { status: 400 });
    }
    
    // Sanitize name (remove special chars, keep alphanumeric, spaces, hyphens, underscores)
    const sanitizedName = name.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
    
    if (!sanitizedName) {
      return NextResponse.json({
        success: false,
        error: 'Invalid dataset name',
      }, { status: 400 });
    }
    
    const metadata = getMetadata();
    const datasetId = uuidv4();
    const datasetPath = path.join(DATASETS_DIR, datasetId);
    
    // Create directory
    if (!fs.existsSync(datasetPath)) {
      fs.mkdirSync(datasetPath, { recursive: true });
    }
    
    // Create dataset entry in metadata
    const dataset = {
      id: datasetId,
      name: sanitizedName,
      createdAt: new Date().toISOString(),
      images: [],
      totalImages: 0,
      captionedCount: 0,
    };
    
    metadata.datasets[datasetId] = dataset;
    metadata.currentDataset = datasetId; // Auto-select new dataset
    saveMetadata(metadata);
    
    return NextResponse.json({
      success: true,
      dataset: {
        id: datasetId,
        name: sanitizedName,
        path: datasetPath,
        imageCount: 0,
        captionCount: 0,
        createdAt: dataset.createdAt,
        modifiedAt: dataset.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating dataset:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create dataset',
    }, { status: 500 });
  }
}

