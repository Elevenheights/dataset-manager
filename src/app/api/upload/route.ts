import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { extractZip, getImageFiles } from '@/lib/zip';
import { createDataset, getUploadsDir, ensureDirectories, clearUploads } from '@/lib/dataset';

export async function POST(request: NextRequest) {
  try {
    ensureDirectories();
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const datasetName = formData.get('name') as string || 'Untitled Dataset';

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
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

    // Clear previous uploads
    clearUploads();

    // Save uploaded file temporarily
    const uploadsDir = getUploadsDir();
    const zipPath = path.join(uploadsDir, `upload_${Date.now()}.zip`);
    
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

    // Get image files and create dataset
    const imageFiles = getImageFiles(extractResult.extractDir);
    
    if (imageFiles.length === 0) {
      return NextResponse.json(
        { error: 'No valid image files found in the ZIP' },
        { status: 400 }
      );
    }

    const dataset = createDataset(datasetName, imageFiles);

    return NextResponse.json({
      success: true,
      message: `Created dataset with ${dataset.totalImages} images`,
      dataset: {
        id: dataset.id,
        name: dataset.name,
        totalImages: dataset.totalImages,
        captionedCount: dataset.captionedCount,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

