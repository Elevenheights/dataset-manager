import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PROGRESS_FILE = '/app/dataset-manager/data/progress/qwen-caption-download.json';

export async function GET() {
  try {
    // Check if progress file exists
    if (!fs.existsSync(PROGRESS_FILE)) {
      // No download in progress
      return NextResponse.json({
        downloading: false,
        progress: 0,
      });
    }

    // Read progress file
    const progressData = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    
    return NextResponse.json({
      downloading: true,
      progress: progressData.progress || 0,
      downloaded: progressData.downloaded || 0,
      total: progressData.total || 0,
      currentFile: progressData.current_file || '',
      speed: progressData.speed || 0,
      eta: progressData.eta || 0,
    });
  } catch (error) {
    console.error('Error reading Qwen download progress:', error);
    return NextResponse.json({
      downloading: false,
      progress: 0,
      error: 'Failed to read progress',
    });
  }
}

