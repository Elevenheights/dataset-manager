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
    const { datasetId, outputPath: customOutputPath, overwrite = false } = body;

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

    // Determine base output path
    let basePath: string;
    if (customOutputPath) {
      basePath = customOutputPath;
    } else if (isDev) {
      basePath = DEV_EXPORT_PATH;
      if (!fs.existsSync(DEV_EXPORT_PATH)) {
        fs.mkdirSync(DEV_EXPORT_PATH, { recursive: true });
      }
    } else {
      basePath = PROD_EXPORT_PATH;
    }

    // Check for existing folder with same name
    const sanitizedName = dataset.name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const existingFolder = path.join(basePath, sanitizedName);
    
    if (fs.existsSync(existingFolder) && !overwrite) {
      // Folder exists and user hasn't confirmed overwrite
      return NextResponse.json({
        conflict: true,
        existingFolder: sanitizedName,
        message: 'A dataset with this name already exists',
      });
    }

    // Export the dataset
    const result = exportDataset(dataset.id, basePath, overwrite);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      );
    }

    // Get RunPod subdomain for AI Toolkit link
    const runpodSubdomain = process.env.RUNPOD_POD_ID || process.env.RUNPOD_POD_HOSTNAME;
    const aiToolkitUrl = runpodSubdomain 
      ? `https://${runpodSubdomain}-8675.proxy.runpod.net`
      : isDev 
        ? 'http://localhost:8675'
        : null;

    const uncaptionedCount = dataset.totalImages - dataset.captionedCount;

    return NextResponse.json({
      success: true,
      message: result.message,
      exportedCount: result.exportedCount,
      finalPath: result.finalPath,
      folderName: path.basename(result.finalPath),
      mode: isDev ? 'development' : 'production',
      aiToolkitUrl,
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



