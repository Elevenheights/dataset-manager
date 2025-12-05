import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { extractZip } from '@/lib/zip';
import { getDataset } from '@/lib/dataset';

// Storage paths
const DATA_DIR = path.join(process.cwd(), 'data');
const DATASETS_DIR = path.join(DATA_DIR, 'datasets');
const METADATA_FILE = path.join(DATA_DIR, 'metadata.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function getMetadata() {
  if (!fs.existsSync(METADATA_FILE)) {
    return { currentDataset: null, datasets: {} };
  }
  return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
}

function saveMetadata(metadata: any) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

// POST - Add more images to existing dataset
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const datasetId = formData.get('datasetId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    if (!datasetId) {
      return NextResponse.json(
        { error: 'datasetId is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Only ZIP files are allowed' },
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

    // Save uploaded file temporarily
    const zipPath = path.join(UPLOADS_DIR, `add_${Date.now()}.zip`);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(zipPath, buffer);

    // Extract zip
    const extractResult = await extractZip(zipPath);
    
    if (!extractResult.success) {
      return NextResponse.json(
        { error: extractResult.message },
        { status: 500 }
      );
    }

    const datasetDir = path.join(DATASETS_DIR, datasetId);
    const addedImages: any[] = [];

    // Copy extracted images to dataset directory
    for (const extractedFile of extractResult.files) {
      if (extractedFile.type !== 'image') continue;

      const filename = extractedFile.filename;
      const ext = path.extname(filename);
      const baseName = path.basename(filename, ext);
      
      // Check if image already exists (avoid duplicates)
      const existingImage = dataset.images.find((img: any) => img.filename === filename);
      if (existingImage) {
        console.log(`Skipping duplicate image: ${filename}`);
        continue;
      }

      const imageId = uuidv4();
      const newImagePath = path.join(datasetDir, filename);
      
      // Copy image
      fs.copyFileSync(extractedFile.path, newImagePath);
      
      // Check for caption file
      const captionPath = path.join(path.dirname(extractedFile.path), `${baseName}.txt`);
      let caption = '';
      if (fs.existsSync(captionPath)) {
        caption = fs.readFileSync(captionPath, 'utf-8').trim();
        // Copy caption file
        const newCaptionPath = path.join(datasetDir, `${baseName}.txt`);
        fs.copyFileSync(captionPath, newCaptionPath);
      }

      const imageData = {
        id: imageId,
        filename,
        path: newImagePath,
        thumbnailUrl: `/api/images/${datasetId}/${filename}?thumb=true`,
        fullUrl: `/api/images/${datasetId}/${filename}`,
        caption,
        hasCaption: caption.length > 0,
      };

      dataset.images.push(imageData);
      addedImages.push(imageData);
    }

    // Update counts
    dataset.totalImages = dataset.images.length;
    dataset.captionedCount = dataset.images.filter((img: any) => img.hasCaption).length;

    // Save updated metadata
    saveMetadata(metadata);

    return NextResponse.json({
      success: true,
      message: `Added ${addedImages.length} images to dataset`,
      addedCount: addedImages.length,
      totalImages: dataset.totalImages,
      skippedCount: extractResult.imageCount - addedImages.length,
    });
  } catch (error) {
    console.error('Add images error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add images' },
      { status: 500 }
    );
  }
}

