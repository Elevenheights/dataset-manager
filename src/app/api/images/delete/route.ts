import { NextRequest, NextResponse } from 'next/server';
import { getDataset } from '@/lib/dataset';
import fs from 'fs';
import path from 'path';

// Storage paths
const DATA_DIR = path.join(process.cwd(), 'data');
const DATASETS_DIR = path.join(DATA_DIR, 'datasets');
const METADATA_FILE = path.join(DATA_DIR, 'metadata.json');

function getMetadata() {
  if (!fs.existsSync(METADATA_FILE)) {
    return { currentDataset: null, datasets: {} };
  }
  return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
}

function saveMetadata(metadata: any) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

// DELETE - Remove images from dataset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { datasetId, imageIds } = body;

    if (!datasetId || !imageIds || !Array.isArray(imageIds)) {
      return NextResponse.json(
        { error: 'datasetId and imageIds array are required' },
        { status: 400 }
      );
    }

    const metadata = getMetadata();
    const dataset = metadata.datasets[datasetId];
    
    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      );
    }

    const datasetDir = path.join(DATASETS_DIR, datasetId);
    let deletedCount = 0;
    const errors: string[] = [];

    // Remove images and their caption files
    for (const imageId of imageIds) {
      const imageIndex = dataset.images.findIndex((img: any) => img.id === imageId);
      
      if (imageIndex === -1) {
        errors.push(`Image ${imageId} not found`);
        continue;
      }

      const image = dataset.images[imageIndex];
      const ext = path.extname(image.filename);
      const baseName = path.basename(image.filename, ext);

      try {
        // Delete image file
        const imagePath = path.join(datasetDir, image.filename);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }

        // Delete caption file
        const captionPath = path.join(datasetDir, `${baseName}.txt`);
        if (fs.existsSync(captionPath)) {
          fs.unlinkSync(captionPath);
        }

        // Remove from dataset
        dataset.images.splice(imageIndex, 1);
        deletedCount++;
      } catch (err) {
        errors.push(`Failed to delete ${image.filename}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Update counts
    dataset.totalImages = dataset.images.length;
    dataset.captionedCount = dataset.images.filter((img: any) => img.hasCaption).length;

    // Save updated metadata
    saveMetadata(metadata);

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} image(s)`,
      deletedCount,
      remainingImages: dataset.totalImages,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Delete images error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete images' },
      { status: 500 }
    );
  }
}

