import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const METADATA_FILE = path.join(DATA_DIR, 'metadata.json');

// Read metadata.json (existing system)
function getMetadata(): { currentDataset: string | null; datasets: Record<string, any> } {
  if (!fs.existsSync(METADATA_FILE)) {
    return { currentDataset: null, datasets: {} };
  }
  return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
}

export async function GET() {
  try {
    const metadata = getMetadata();
    
    // Convert datasets object to array format
    const datasets = Object.entries(metadata.datasets).map(([id, dataset]: [string, any]) => {
      return {
        id,
        name: dataset.name || 'Unnamed Dataset',
        path: dataset.id,
        imageCount: dataset.totalImages || 0,
        captionCount: dataset.captionedCount || 0,
        createdAt: dataset.createdAt,
        modifiedAt: dataset.createdAt, // Use createdAt since we don't track modified
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      datasets,
      currentDataset: metadata.currentDataset,
    });
  } catch (error) {
    console.error('Error listing datasets:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list datasets',
    }, { status: 500 });
  }
}

