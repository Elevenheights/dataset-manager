import { NextRequest, NextResponse } from 'next/server';
import { generateCaption } from '@/lib/ollama';
import { getDataset, updateCaption, getImage } from '@/lib/dataset';

// POST - Generate captions for multiple images using Qwen 2.5 VL
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { datasetId, imageIds, prompt, temperature, overwriteExisting } = body;

    if (!datasetId || !imageIds || !Array.isArray(imageIds)) {
      return NextResponse.json(
        { error: 'datasetId and imageIds array are required' },
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

    // Filter images to process
    const imagesToProcess = imageIds
      .map(id => getImage(datasetId, id))
      .filter((img): img is NonNullable<typeof img> => {
        if (!img) return false;
        // Skip if has caption and not overwriting
        if (img.hasCaption && !overwriteExisting) return false;
        return true;
      });

    if (imagesToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No images to process',
        results: [],
        processed: 0,
        total: imageIds.length,
      });
    }

    // Process images sequentially using Qwen 2.5 VL
    const results: { imageId: string; success: boolean; caption?: string; error?: string }[] = [];
    
    for (const image of imagesToProcess) {
      const result = await generateCaption(
        image.path,
        prompt,
        temperature || 0.7
      );

      if (result.success) {
        updateCaption(datasetId, image.id, result.caption);
        results.push({
          imageId: image.id,
          success: true,
          caption: result.caption,
        });
      } else {
        results.push({
          imageId: image.id,
          success: false,
          error: result.error,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Generated ${successCount}/${imagesToProcess.length} captions using Qwen 2.5 VL`,
      results,
      processed: successCount,
      total: imagesToProcess.length,
    });
  } catch (error) {
    console.error('Bulk caption generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bulk caption generation failed' },
      { status: 500 }
    );
  }
}



