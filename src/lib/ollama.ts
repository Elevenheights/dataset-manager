import fs from 'fs';
import path from 'path';

export interface QwenCaptionResponse {
  success: boolean;
  caption: string;
  error?: string;
}

export interface CaptionSettings {
  customPrompt?: string;
  prefix?: string;
  suffix?: string;
  replaceWords?: string;
  replaceCaseInsensitive?: boolean;
  replaceWholeWordsOnly?: boolean;
  temperature?: number;
  topK?: number;
  topP?: number;
  repetitionPenalty?: number;
}

const QWEN_SERVICE_URL = process.env.QWEN_SERVICE_URL || 'http://localhost:11435';

// Default caption prompt template - inspired by SECourses approach
const DEFAULT_CAPTION_PROMPT = `You are an expert image captioner for AI training datasets. Analyze this image and provide a detailed, descriptive caption.

Requirements:
- Write a single, continuous caption (no bullet points or sections)
- Be extremely detailed about: composition, subjects, poses, expressions, clothing, colors, lighting, background, atmosphere
- Use natural, descriptive language as if describing a photograph
- Do NOT use words like: rendered, hyperrealistic, digital art, artwork, painting, illustration
- Use professional photography terminology where appropriate
- Caption should be 100-200 words
- Focus on what IS in the image, not interpretations

Respond with ONLY the caption, no explanations or prefixes.`;

export async function generateCaption(
  imagePath: string,
  customPrompt?: string,
  temperature: number = 0.7,
  settings?: CaptionSettings
): Promise<{ success: boolean; caption: string; error?: string }> {
  try {
    // Resolve image path (handle both absolute and relative paths)
    let resolvedPath = imagePath;
    
    // If path doesn't exist (e.g., Windows path in Docker), try to resolve it
    if (!fs.existsSync(resolvedPath)) {
      // Extract relative path from absolute path
      // e.g., C:\...\data\datasets\abc\image.png -> data/datasets/abc/image.png
      const dataIndex = imagePath.indexOf('data');
      if (dataIndex !== -1) {
        const relativePath = imagePath.substring(dataIndex);
        const possiblePath = path.join(process.cwd(), relativePath);
        if (fs.existsSync(possiblePath)) {
          resolvedPath = possiblePath;
        }
      }
    }
    
    // Check if image exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }
    
    // Read image and convert to base64
    const imageBuffer = fs.readFileSync(resolvedPath);
    const base64Image = imageBuffer.toString('base64');
    
    const prompt = customPrompt || settings?.customPrompt || DEFAULT_CAPTION_PROMPT;

    const response = await fetch(`${QWEN_SERVICE_URL}/caption`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        customPrompt: prompt,
        temperature: settings?.temperature ?? temperature,
        topK: settings?.topK ?? 50,
        topP: settings?.topP ?? 0.95,
        repetitionPenalty: settings?.repetitionPenalty ?? 1.05,
        prefix: settings?.prefix ?? '',
        suffix: settings?.suffix ?? '',
        replaceWords: settings?.replaceWords ?? '',
        replaceCaseInsensitive: settings?.replaceCaseInsensitive ?? true,
        replaceWholeWordsOnly: settings?.replaceWholeWordsOnly ?? true,
      }),
      // Increase timeout for CPU inference (can take 5-10 minutes)
      signal: AbortSignal.timeout(600000), // 10 minutes
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qwen caption service error: ${response.status} - ${errorText}`);
    }

    const data: QwenCaptionResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Caption generation failed');
    }

    return {
      success: true,
      caption: data.caption.trim(),
    };
  } catch (error) {
    console.error('Qwen caption generation error:', error);
    return {
      success: false,
      caption: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function checkQwenConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const response = await fetch(`${QWEN_SERVICE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Failed to connect to Qwen service: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check if service is ready (both model and mmproj files exist)
    // Note: model_loaded is false when not in use (to save VRAM), so check 'ready' instead
    if (!data.ready) {
      const missing = [];
      if (!data.model_exists) missing.push('model file');
      if (!data.mmproj_exists) missing.push('vision encoder');
      
      if (missing.length > 0) {
        throw new Error(`Missing: ${missing.join(' and ')}`);
      }
      throw new Error('Caption model not ready');
    }
    
    return {
      connected: true,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Failed to connect to Qwen service',
    };
  }
}

export async function generateBulkCaptions(
  imagePaths: { id: string; path: string }[],
  customPrompt?: string,
  temperature: number = 0.7,
  onProgress?: (completed: number, total: number, currentId: string) => void,
  settings?: CaptionSettings
): Promise<{ id: string; caption: string; success: boolean; error?: string }[]> {
  const results: { id: string; caption: string; success: boolean; error?: string }[] = [];
  
  for (let i = 0; i < imagePaths.length; i++) {
    const { id, path: imagePath } = imagePaths[i];
    
    if (onProgress) {
      onProgress(i, imagePaths.length, id);
    }
    
    const result = await generateCaption(imagePath, customPrompt, temperature, settings);
    results.push({
      id,
      caption: result.caption,
      success: result.success,
      error: result.error,
    });
    
    // Small delay between requests to avoid overwhelming the API
    if (i < imagePaths.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

export function getDefaultPrompt(): string {
  return DEFAULT_CAPTION_PROMPT;
}



