import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

export async function DELETE(request: Request) {
  try {
    const { datasetId } = await request.json();
    
    if (!datasetId || typeof datasetId !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Dataset ID is required',
      }, { status: 400 });
    }
    
    const metadata = getMetadata();
    
    // Check if dataset exists in metadata
    if (!metadata.datasets[datasetId]) {
      return NextResponse.json({
        success: false,
        error: 'Dataset not found',
      }, { status: 404 });
    }
    
    const datasetName = metadata.datasets[datasetId].name || 'Unknown';
    const datasetPath = path.join(DATASETS_DIR, datasetId);
    
    // Security check - ensure path is within DATASETS_DIR
    if (!datasetPath.startsWith(DATASETS_DIR)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid dataset path',
      }, { status: 403 });
    }
    
    // Delete directory if it exists
    if (fs.existsSync(datasetPath)) {
      fs.rmSync(datasetPath, { recursive: true, force: true });
    }
    
    // Remove from metadata
    delete metadata.datasets[datasetId];
    
    // If this was the current dataset, clear it
    if (metadata.currentDataset === datasetId) {
      metadata.currentDataset = null;
    }
    
    saveMetadata(metadata);
    
    return NextResponse.json({
      success: true,
      message: `Dataset "${datasetName}" deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting dataset:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete dataset',
    }, { status: 500 });
  }
}

