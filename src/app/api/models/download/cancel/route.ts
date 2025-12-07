import { NextRequest, NextResponse } from 'next/server';
import { cancelDownloadJob, getDownloadJob } from '@/lib/models/downloader';

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();
    
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }
    
    const job = getDownloadJob(jobId);
    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Download job not found' },
        { status: 404 }
      );
    }
    
    const cancelled = cancelDownloadJob(jobId);
    
    return NextResponse.json({
      success: cancelled,
      message: cancelled ? 'Download cancelled' : 'Failed to cancel download',
    });
  } catch (error: any) {
    console.error('Error cancelling download:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to cancel download' },
      { status: 500 }
    );
  }
}

