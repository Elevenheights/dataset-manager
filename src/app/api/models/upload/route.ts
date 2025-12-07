import { NextRequest, NextResponse } from 'next/server';
import { handleLocalUpload } from '@/lib/models/downloader';
import { writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_TEMP_DIR = '/tmp/model-uploads';

// POST - Upload a local model file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const type = formData.get('type') as string;
    const family = formData.get('family') as string || 'custom';
    const tags = formData.get('tags') as string;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }
    
    if (!name || !type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, type' },
        { status: 400 }
      );
    }
    
    // Generate model ID
    const modelId = `custom_${uuidv4()}`;
    
    // Save file temporarily
    const tempPath = path.join(UPLOAD_TEMP_DIR, `${modelId}_${file.name}`);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    await writeFile(tempPath, buffer);
    
    // Handle upload (move to final location)
    const installedModel = await handleLocalUpload(
      {
        path: tempPath,
        filename: file.name,
        size: file.size,
      },
      {
        id: modelId,
        name,
        family,
        type,
        tags: tags ? tags.split(',').map(t => t.trim()) : ['custom'],
      }
    );
    
    return NextResponse.json({
      success: true,
      model: installedModel,
      message: 'Model uploaded successfully',
    });
  } catch (error: any) {
    console.error('Error uploading model:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to upload model' },
      { status: 500 }
    );
  }
}

