import { NextRequest, NextResponse } from 'next/server';
import { getCurrentDataset, updateCaption, getDataset } from '@/lib/dataset';

// GET - Get current dataset with all images and captions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const datasetId = searchParams.get('datasetId');
    
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

    return NextResponse.json({
      success: true,
      dataset,
    });
  } catch (error) {
    console.error('Get captions error:', error);
    return NextResponse.json(
      { error: 'Failed to get captions' },
      { status: 500 }
    );
  }
}

// PUT - Update a single caption
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { datasetId, imageId, caption } = body;

    if (!datasetId || !imageId) {
      return NextResponse.json(
        { error: 'datasetId and imageId are required' },
        { status: 400 }
      );
    }

    const updatedImage = updateCaption(datasetId, imageId, caption || '');
    
    if (!updatedImage) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      image: updatedImage,
    });
  } catch (error) {
    console.error('Update caption error:', error);
    return NextResponse.json(
      { error: 'Failed to update caption' },
      { status: 500 }
    );
  }
}




