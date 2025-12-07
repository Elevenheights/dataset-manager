import { NextRequest, NextResponse } from 'next/server';
import { getDownloadJob, cancelDownloadJob } from '@/lib/models/downloader';

// GET - Get download job status by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    
    const job = getDownloadJob(jobId);
    
    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Download job not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error('Error fetching download job:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch download job' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel a download job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    
    const cancelled = cancelDownloadJob(jobId);
    
    if (!cancelled) {
      return NextResponse.json(
        { success: false, error: 'Download job not found or already completed' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `Download job ${jobId} cancelled`,
    });
  } catch (error) {
    console.error('Error cancelling download job:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel download job' },
      { status: 500 }
    );
  }
}

