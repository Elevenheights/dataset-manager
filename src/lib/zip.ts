import StreamZip from 'node-stream-zip';
import path from 'path';
import fs from 'fs';
import { getUploadsDir, clearUploads } from './dataset';

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
const ALLOWED_TEXT_EXTENSIONS = ['.txt'];

export interface ExtractedFile {
  filename: string;
  path: string;
  type: 'image' | 'caption';
  baseName: string;
}

export interface ExtractionResult {
  success: boolean;
  message: string;
  files: ExtractedFile[];
  imageCount: number;
  captionCount: number;
  extractDir: string;
}

export async function extractZip(zipPath: string): Promise<ExtractionResult> {
  try {
    const uploadsDir = getUploadsDir();
    const extractDir = path.join(uploadsDir, 'extracted');
    
    // Clean extraction directory
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    fs.mkdirSync(extractDir, { recursive: true });

    const extractedFiles: ExtractedFile[] = [];
    let imageCount = 0;
    let captionCount = 0;

    const RESERVED_NAMES = new Set([
      'CON','PRN','AUX','NUL',
      'COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9',
      'LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9',
    ]);

    const sanitizeName = (name: string) => {
      const withoutInvalid = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
      const trimmed = withoutInvalid.trim().replace(/[. ]+$/, '');
      const limited = trimmed.slice(0, 240); // avoid Windows MAX_PATH issues
      if (!limited) return '';
      const upperStem = path.basename(limited, path.extname(limited)).toUpperCase();
      if (RESERVED_NAMES.has(upperStem)) return '';
      return limited;
    };

    const zip = new StreamZip.async({ file: zipPath });

    try {
      const entries = await zip.entries();
      
      for (const entry of Object.values(entries)) {
        try {
          // Skip directories and hidden files
          if (entry.isDirectory || entry.name.startsWith('.') || entry.name.includes('__MACOSX')) {
            continue;
          }

          const rawFilename = path.basename(entry.name);
          const filename = sanitizeName(rawFilename);
          if (!filename) {
            continue;
          }
          const ext = path.extname(filename).toLowerCase();
          const baseName = path.basename(filename, ext);

          // Skip hidden files
          if (filename.startsWith('.')) {
            continue;
          }

          const isImage = ALLOWED_IMAGE_EXTENSIONS.includes(ext);
          const isCaption = ALLOWED_TEXT_EXTENSIONS.includes(ext);

          if (!isImage && !isCaption) {
            continue;
          }

          // Extract to flat structure (no nested folders)
          const destPath = path.join(extractDir, filename);
          
          // Handle duplicate filenames by adding suffix
          let finalPath = destPath;
          let counter = 1;
          while (fs.existsSync(finalPath)) {
            const newFilename = `${baseName}_${counter}${ext}`;
            finalPath = path.join(extractDir, newFilename);
            counter++;
          }

          // Extract the file
          await zip.extract(entry.name, finalPath);

          const fileInfo: ExtractedFile = {
            filename: path.basename(finalPath),
            path: finalPath,
            type: isImage ? 'image' : 'caption',
            baseName: path.basename(finalPath, ext),
          };

          extractedFiles.push(fileInfo);

          if (isImage) {
            imageCount++;
          } else {
            captionCount++;
          }
        } catch (err) {
          console.warn(`Skipping entry "${entry.name}" due to error:`, err);
          continue;
        }
      }
      
      await zip.close();
    } catch (err) {
      await zip.close();
      throw err;
    }

    // Clean up the uploaded zip
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    return {
      success: true,
      message: `Extracted ${imageCount} images and ${captionCount} caption files`,
      files: extractedFiles,
      imageCount,
      captionCount,
      extractDir,
    };
  } catch (error) {
    console.error('Zip extraction error:', error);
    return {
      success: false,
      message: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      files: [],
      imageCount: 0,
      captionCount: 0,
      extractDir: '',
    };
  }
}

export function getImageFiles(extractDir: string): string[] {
  if (!fs.existsSync(extractDir)) {
    return [];
  }

  const files = fs.readdirSync(extractDir);
  return files
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ALLOWED_IMAGE_EXTENSIONS.includes(ext);
    })
    .map(file => path.join(extractDir, file));
}


