import { NextRequest, NextResponse } from 'next/server';
import { MODEL_REGISTRY, searchModels, getModelsByFamily, getModelsByType } from '@/lib/models/registry';
import { getInstalledModels, isModelInstalled } from '@/lib/models/storage';
import { ModelDefinition, AddCustomModelRequest } from '@/lib/models/types';

// GET - List all available models (built-in + custom)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const family = searchParams.get('family');
    const type = searchParams.get('type');
    const installedOnly = searchParams.get('installedOnly') === 'true';
    
    let models = [...MODEL_REGISTRY];
    
    // Apply filters
    if (query) {
      models = searchModels(query);
    } else if (family) {
      models = getModelsByFamily(family as any);
    } else if (type) {
      models = getModelsByType(type as any);
    }
    
    // Add installation status to each model
    const modelsWithStatus = models.map(model => ({
      ...model,
      isInstalled: isModelInstalled(model.id),
    }));
    
    // Filter to only installed if requested
    const finalModels = installedOnly 
      ? modelsWithStatus.filter(m => m.isInstalled)
      : modelsWithStatus;
    
    return NextResponse.json({
      success: true,
      models: finalModels,
      total: finalModels.length,
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}

// POST - Add a custom model definition
export async function POST(request: NextRequest) {
  try {
    const body: AddCustomModelRequest = await request.json();
    
    // Validate required fields
    if (!body.name || !body.type || !body.sourceType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, type, sourceType' },
        { status: 400 }
      );
    }
    
    // Generate a custom model ID
    const customId = `custom_${Date.now()}_${body.name.toLowerCase().replace(/\s+/g, '_')}`;
    
    // Create model definition
    const customModel: ModelDefinition = {
      id: customId,
      name: body.name,
      family: 'custom',
      type: body.type,
      description: body.description || 'Custom uploaded model',
      sourceType: body.sourceType,
      sourceUrl: body.sourceUrl,
      huggingfaceRepo: body.huggingfaceRepo,
      huggingfaceFiles: body.huggingfaceFiles,
      format: 'safetensors', // Default, will be determined during download
      tags: body.tags || ['custom'],
      recommended: false,
    };
    
    // Validate based on source type
    if (customModel.sourceType === 'huggingface' && !customModel.huggingfaceRepo) {
      return NextResponse.json(
        { success: false, error: 'Hugging Face repository is required' },
        { status: 400 }
      );
    }
    
    if (customModel.sourceType === 'direct_url' && !customModel.sourceUrl) {
      return NextResponse.json(
        { success: false, error: 'Source URL is required for direct downloads' },
        { status: 400 }
      );
    }
    
    if (customModel.sourceType === 'civitai' && !body.civitaiUrl) {
      return NextResponse.json(
        { success: false, error: 'CivitAI URL is required' },
        { status: 400 }
      );
    }
    
    // Add to registry (in memory, could be persisted to a file)
    MODEL_REGISTRY.push(customModel);
    
    return NextResponse.json({
      success: true,
      model: customModel,
      message: 'Custom model added successfully',
    });
  } catch (error) {
    console.error('Error adding custom model:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add custom model' },
      { status: 500 }
    );
  }
}

