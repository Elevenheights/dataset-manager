import { NextRequest, NextResponse } from 'next/server';
import { generateCaption, checkQwenConnection, getDefaultPrompt } from '@/lib/ollama';
import { getDataset, updateCaption, getImage } from '@/lib/dataset';
import path from 'path';

// GET - Check Qwen caption service connection
export async function GET() {
  try {
    const status = await checkQwenConnection();
    return NextResponse.json({
      ...status,
      model: 'qwen_2.5_vl_7b',
      defaultPrompt: getDefaultPrompt(),
    });
  } catch (error) {
    console.error('Qwen service status error:', error);
    return NextResponse.json(
      { error: 'Failed to check Qwen service status' },
      { status: 500 }
    );
  }
}

// POST - Generate caption for single image using Qwen 2.5 VL
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { datasetId, imageId, prompt, temperature, settings } = body;

    if (!datasetId || !imageId) {
      return NextResponse.json(
        { error: 'datasetId and imageId are required' },
        { status: 400 }
      );
    }

    const dataset = getDataset(datasetId);
    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      );
    }

    const image = getImage(datasetId, imageId);
    if (!image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Construct full image path (image.path is just the filename after the fix)
    const imagePath = path.join(process.cwd(), 'data', 'datasets', datasetId, image.path);

    // Generate caption using Qwen 2.5 VL with settings
    const result = await generateCaption(
      imagePath,
      prompt,
      temperature || 0.7,
      settings
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Caption generation failed' },
        { status: 500 }
      );
    }

    // Save the generated caption
    const updatedImage = updateCaption(datasetId, imageId, result.caption);

    return NextResponse.json({
      success: true,
      caption: result.caption,
      image: updatedImage,
    });
  } catch (error) {
    console.error('Caption generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Caption generation failed' },
      { status: 500 }
    );
  }
}



