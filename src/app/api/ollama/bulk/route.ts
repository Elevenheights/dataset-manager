import { NextRequest, NextResponse } from 'next/server';
import { generateCaption } from '@/lib/ollama';
import { getDataset, updateCaption, getImage } from '@/lib/dataset';
import path from 'path';

// POST - Generate captions for multiple images using Qwen 2.5 VL
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { datasetId, imageIds, prompt, temperature, overwriteExisting, appendMode, settings } = body;

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
        // Skip if has caption and not overwriting or appending
        if (img.hasCaption && !overwriteExisting && !appendMode) return false;
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

    // Process images sequentially using Qwen 2.5 VL with settings
    const results: { imageId: string; success: boolean; caption?: string; error?: string }[] = [];
    
    for (const image of imagesToProcess) {
      // Construct full image path (image.path is just the filename after the fix)
      const imagePath = path.join(process.cwd(), 'data', 'datasets', datasetId, image.path);
      
      const result = await generateCaption(
        imagePath,
        prompt,
        temperature || 0.7,
        settings
      );

      if (result.success) {
        // Handle append mode: combine existing caption with new one
        let finalCaption = result.caption;
        if (appendMode && image.caption) {
          finalCaption = `${image.caption} ${result.caption}`;
        }
        
        updateCaption(datasetId, image.id, finalCaption);
        results.push({
          imageId: image.id,
          success: true,
          caption: finalCaption,
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



