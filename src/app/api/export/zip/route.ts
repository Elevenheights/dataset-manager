import { NextRequest, NextResponse } from 'next/server';
import { getDataset } from '@/lib/dataset';
import StreamZip from 'node-stream-zip';
import fs from 'fs';
import path from 'path';

// Storage paths
const DATA_DIR = path.join(process.cwd(), 'data');
const DATASETS_DIR = path.join(DATA_DIR, 'datasets');
const EXPORTS_DIR = path.join(DATA_DIR, 'exports');

// POST - Export dataset as downloadable ZIP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { datasetId } = body;

    const dataset = getDataset(datasetId);
    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      );
    }

    // Ensure exports directory exists
    if (!fs.existsSync(EXPORTS_DIR)) {
      fs.mkdirSync(EXPORTS_DIR, { recursive: true });
    }

    // Create temporary directory with AI Toolkit structure
    const tempDir = path.join(EXPORTS_DIR, `temp_${Date.now()}`);
    const datasetFolder = path.join(tempDir, '1_dataset');
    fs.mkdirSync(datasetFolder, { recursive: true });

    const datasetDir = path.join(DATASETS_DIR, datasetId);

    // Copy images and captions to temp directory
    for (const image of dataset.images) {
      const ext = path.extname(image.filename);
      const baseName = path.basename(image.filename, ext);

      // Copy image
      const srcImagePath = path.join(datasetDir, image.filename);
      const destImagePath = path.join(datasetFolder, image.filename);
      if (fs.existsSync(srcImagePath)) {
        fs.copyFileSync(srcImagePath, destImagePath);
      }

      // Create caption file
      const destCaptionPath = path.join(datasetFolder, `${baseName}.txt`);
      fs.writeFileSync(destCaptionPath, image.caption || '');
    }

    // Create ZIP file
    const sanitizedName = dataset.name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const zipPath = path.join(EXPORTS_DIR, `${sanitizedName}_aitoolkit.zip`);

    // Use node-stream-zip to create the archive
    const zip = new StreamZip.async({
      file: zipPath,
      storeEntries: true,
    });

    // We need to use a different approach - node-stream-zip is read-only
    // Use archiver or built-in zip functionality
    // For now, let's use a simple approach with AdmZip for writing
    const AdmZip = require('adm-zip');
    const zipWriter = new AdmZip();
    
    // Add the entire 1_dataset folder
    zipWriter.addLocalFolder(datasetFolder, '1_dataset');
    zipWriter.writeZip(zipPath);

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });

    // Return the file
    const zipBuffer = fs.readFileSync(zipPath);
    
    // Clean up the zip file after reading
    fs.unlinkSync(zipPath);

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${sanitizedName}_aitoolkit.zip"`,
      },
    });
  } catch (error) {
    console.error('ZIP export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ZIP export failed' },
      { status: 500 }
    );
  }
}

