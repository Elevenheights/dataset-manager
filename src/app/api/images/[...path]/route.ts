import { NextRequest, NextResponse } from 'next/server';
import { getImagePath } from '@/lib/dataset';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathParts = resolvedParams.path;
    
    if (pathParts.length < 2) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const datasetId = pathParts[0];
    const filename = pathParts.slice(1).join('/');
    
    const imagePath = getImagePath(datasetId, filename);
    
    if (!imagePath) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Check if thumbnail is requested
    const { searchParams } = new URL(request.url);
    const isThumb = searchParams.get('thumb') === 'true';

    // Read the image
    let imageBuffer = fs.readFileSync(imagePath);
    
    // Generate thumbnail if requested
    if (isThumb) {
      try {
        // Use sharp for thumbnail generation if available
        const sharpModule = await import('sharp').catch(() => null);
        if (sharpModule) {
          const thumbnailBuffer = await sharpModule.default(imageBuffer)
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer();
          imageBuffer = Buffer.from(thumbnailBuffer);
        }
      } catch {
        // If sharp fails, return original image
        console.log('Sharp not available, returning original image');
      }
    }

    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
    };
    
    const contentType = isThumb ? 'image/jpeg' : (contentTypes[ext] || 'image/jpeg');

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Image serving error:', error);
    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    );
  }
}




