import { NextRequest, NextResponse } from 'next/server';
import {
  getInstalledModels,
  removeInstalledModel,
  getTotalDiskUsage,
  getInstalledModelsByFamily,
  getInstalledModelsByType,
} from '@/lib/models/storage';

// GET - List all installed models with disk usage
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const family = searchParams.get('family');
    const type = searchParams.get('type');
    
    let models;
    
    if (family) {
      models = getInstalledModelsByFamily(family as any);
    } else if (type) {
      models = getInstalledModelsByType(type as any);
    } else {
      models = getInstalledModels();
    }
    
    const totalDiskUsage = getTotalDiskUsage();
    
    return NextResponse.json({
      success: true,
      models,
      totalDiskUsage,
      totalModels: models.length,
    });
  } catch (error) {
    console.error('Error fetching installed models:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch installed models' },
      { status: 500 }
    );
  }
}

// DELETE - Remove an installed model
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('id');
    
    if (!modelId) {
      return NextResponse.json(
        { success: false, error: 'Model ID is required' },
        { status: 400 }
      );
    }
    
    const removed = removeInstalledModel(modelId);
    
    if (!removed) {
      return NextResponse.json(
        { success: false, error: 'Model not found or already removed' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `Model ${modelId} removed successfully`,
    });
  } catch (error) {
    console.error('Error removing model:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove model' },
      { status: 500 }
    );
  }
}

