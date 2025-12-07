import { NextRequest, NextResponse } from 'next/server';
import { startModelDownload, getAllDownloadJobs } from '@/lib/models/downloader';
import { getModelById } from '@/lib/models/registry';
import { isModelInstalled } from '@/lib/models/storage';

// POST - Start a model download
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, huggingfaceToken } = body;
    
    if (!modelId) {
      return NextResponse.json(
        { success: false, error: 'Model ID is required' },
        { status: 400 }
      );
    }
    
    // Get model definition first
    const model = getModelById(modelId);
    
    if (!model) {
      return NextResponse.json(
        { success: false, error: 'Model not found in registry' },
        { status: 404 }
      );
    }
    
    // Check if model already installed (checks both database and HF cache)
    const installed = isModelInstalled(modelId);
    if (installed) {
      console.log(`Model ${modelId} already installed, skipping download`);
      return NextResponse.json(
        { success: false, error: 'Model is already installed. Check the Installed Models tab.' },
        { status: 400 }
      );
    }
    
    // Check if token is required but not provided
    if (model.requiresToken && !huggingfaceToken) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'This model requires a Hugging Face token',
          requiresToken: true,
        },
        { status: 400 }
      );
    }
    
    // Start download
    const jobId = startModelDownload(model, {
      huggingfaceToken,
    });
    
    return NextResponse.json({
      success: true,
      jobId,
      modelId: model.id,
      modelName: model.name,
      message: 'Download started',
    });
  } catch (error: any) {
    console.error('Error starting download:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start download' },
      { status: 500 }
    );
  }
}

// GET - Get all active download jobs
export async function GET() {
  try {
    const jobs = getAllDownloadJobs();
    
    return NextResponse.json({
      success: true,
      jobs,
      totalJobs: jobs.length,
    });
  } catch (error) {
    console.error('Error fetching download jobs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch download jobs' },
      { status: 500 }
    );
  }
}

