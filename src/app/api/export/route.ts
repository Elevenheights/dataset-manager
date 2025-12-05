import { NextRequest, NextResponse } from 'next/server';
import { getCurrentDataset, exportDataset, getDataset } from '@/lib/dataset';
import path from 'path';
import fs from 'fs';

// Determine export paths based on environment
const isDev = process.env.NODE_ENV === 'development' || process.env.DEV_MODE === 'true';
const DEV_EXPORT_PATH = path.join(process.cwd(), 'data', 'exports');
const PROD_EXPORT_PATH = '/workspace/ai-toolkit/datasets';

// POST - Export dataset to AI toolkit folder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { datasetId, outputPath: customOutputPath } = body;

    // Get dataset
    let dataset;
    if (datasetId) {
      dataset = getDataset(datasetId);
    } else {
      dataset = getCurrentDataset();
    }
    
    if (!dataset) {
      return NextResponse.json(
        { error: 'No dataset found' },
        { status: 404 }
      );
    }

    // Determine output path based on mode
    let outputPath: string;
    if (customOutputPath) {
      // User provided custom path
      outputPath = customOutputPath;
    } else if (isDev) {
      // Dev mode: use local exports folder
      outputPath = path.join(DEV_EXPORT_PATH, dataset.name.replace(/[^a-zA-Z0-9-_]/g, '_'));
      // Ensure exports directory exists
      if (!fs.existsSync(DEV_EXPORT_PATH)) {
        fs.mkdirSync(DEV_EXPORT_PATH, { recursive: true });
      }
    } else {
      // Production mode: use AI Toolkit datasets folder
      outputPath = path.join(PROD_EXPORT_PATH, dataset.name.replace(/[^a-zA-Z0-9-_]/g, '_'));
    }

    // Warn about uncaptioned images
    const uncaptionedCount = dataset.totalImages - dataset.captionedCount;
    
    // Export the dataset
    const result = exportDataset(dataset.id, outputPath);

    return NextResponse.json({
      ...result,
      outputPath,
      mode: isDev ? 'development' : 'production',
      uncaptionedCount,
      warning: uncaptionedCount > 0 
        ? `${uncaptionedCount} images have empty captions` 
        : null,
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}

// GET - Get export status/info
export async function GET() {
  try {
    const dataset = getCurrentDataset();
    
    if (!dataset) {
      return NextResponse.json(
        { error: 'No dataset found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      datasetId: dataset.id,
      datasetName: dataset.name,
      totalImages: dataset.totalImages,
      captionedCount: dataset.captionedCount,
      uncaptionedCount: dataset.totalImages - dataset.captionedCount,
      readyToExport: dataset.totalImages > 0,
    });
  } catch (error) {
    console.error('Export info error:', error);
    return NextResponse.json(
      { error: 'Failed to get export info' },
      { status: 500 }
    );
  }
}



