import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
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

// Get current dataset ID
export async function GET() {
  try {
    const metadata = getMetadata();
    
    // Return the dataset ID and its name
    let currentDatasetInfo = null;
    if (metadata.currentDataset && metadata.datasets[metadata.currentDataset]) {
      const dataset = metadata.datasets[metadata.currentDataset];
      currentDatasetInfo = {
        id: metadata.currentDataset,
        name: dataset.name || 'Unnamed Dataset',
      };
    }

    return NextResponse.json({
      success: true,
      currentDataset: metadata.currentDataset,
      currentDatasetInfo,
    });
  } catch (error) {
    console.error('Error getting current dataset:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get current dataset',
    }, { status: 500 });
  }
}

// Set current dataset by ID
export async function POST(request: Request) {
  try {
    const { datasetId } = await request.json();

    // Allow empty string to clear selection
    if (datasetId === '') {
      const metadata = getMetadata();
      metadata.currentDataset = null;
      saveMetadata(metadata);
      return NextResponse.json({ success: true, currentDataset: null });
    }

    if (!datasetId || typeof datasetId !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Dataset ID is required',
      }, { status: 400 });
    }

    const metadata = getMetadata();
    
    // Verify dataset exists
    if (!metadata.datasets[datasetId]) {
      return NextResponse.json({
        success: false,
        error: 'Dataset not found',
      }, { status: 404 });
    }

    // Update current dataset
    metadata.currentDataset = datasetId;
    saveMetadata(metadata);

    return NextResponse.json({
      success: true,
      currentDataset: datasetId,
    });
  } catch (error) {
    console.error('Error setting current dataset:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set current dataset',
    }, { status: 500 });
  }
}

