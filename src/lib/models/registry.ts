import { ModelDefinition, ModelFamily, ModelType } from './types';

/**
 * Built-in Model Registry
 * Pre-configured models for easy download and use
 */

export const MODEL_REGISTRY: ModelDefinition[] = [
  // ========== Z-IMAGE MODELS ==========
  // VERIFIED: These are the correct repos used in docker_start.sh
  {
    id: 'zimage-deturbo-bf16',
    name: 'Z-Image De-Turbo v1 BF16',
    family: 'zimage',
    type: 'base_model',
    description: 'Z-Image de-turbo (de-distilled) model for highest quality image generation. BF16 precision. Recommended for LoRA training.',
    version: '1.0',
    sourceType: 'huggingface',
    huggingfaceRepo: 'ostris/Z-Image-De-Turbo', // VERIFIED - already in docker_start.sh
    huggingfaceFiles: ['z_image_de_turbo_v1_bf16.safetensors'],
    format: 'safetensors',
    estimatedSize: '12 GB',
    tags: ['image-generation', 'text-to-image', 'high-quality', 'de-distilled'],
    compatibility: ['ai-toolkit', 'diffusers'],
    recommended: true,
    targetPath: 'zimage/deturbo',
    previewImage: '/model-previews/zimage-deturbo.jpg',
  },
  {
    id: 'zimage-turbo-bf16',
    name: 'Z-Image Turbo v1',
    family: 'zimage',
    type: 'base_model',
    description: 'Z-Image Turbo (distilled) - 8 NFE model with sub-second inference. Excels in photorealistic generation and bilingual text rendering (EN/CN).',
    version: '1.0',
    sourceType: 'huggingface',
    huggingfaceRepo: 'Tongyi-MAI/Z-Image-Turbo', // VERIFIED - from official Tongyi-MAI org
    huggingfaceFiles: ['z_image_turbo_v1.safetensors'],
    format: 'safetensors',
    estimatedSize: '~12 GB',
    tags: ['image-generation', 'text-to-image', 'fast', 'distilled', '8-steps'],
    compatibility: ['diffusers'],
    recommended: true,
    targetPath: 'zimage/turbo',
  },
  {
    id: 'zimage-training-adapter',
    name: 'Z-Image Training Adapter',
    family: 'zimage',
    type: 'adapter',
    description: 'Training adapter for Z-Image Turbo (distilled version only). Required for LoRA training with the distilled Turbo variant. NOT needed for De-Turbo.',
    version: '1.0',
    sourceType: 'huggingface',
    huggingfaceRepo: 'ostris/zimage_turbo_training_adapter', // VERIFIED - already in docker_start.sh
    huggingfaceFiles: ['zimage_turbo_training_adapter_v1.safetensors', 'zimage_turbo_training_adapter_v2.safetensors'],
    format: 'safetensors',
    estimatedSize: '2.5 GB',
    tags: ['adapter', 'training', 'turbo-only'],
    compatibility: ['ai-toolkit'],
    recommended: true,
    targetPath: 'zimage/adapter',
  },

  // ========== QWEN IMAGE MODELS ==========
  // NOTE: Qwen2.5-VL caption model (LLM) is auto-downloaded separately for captioning service
  {
    id: 'qwen-image',
    name: 'Qwen Image',
    family: 'qwen',
    type: 'base_model',
    description: 'Qwen Image model for image generation LoRA training. BF16 precision. ComfyUI compatible.',
    version: '1.0',
    sourceType: 'huggingface',
    huggingfaceRepo: 'Comfy-Org/Qwen-Image_ComfyUI',
    huggingfaceFiles: ['split_files/diffusion_models/qwen_image_bf16.safetensors'],
    format: 'safetensors',
    estimatedSize: '~7 GB',
    tags: ['image-generation', 'training', 'qwen'],
    compatibility: ['ai-toolkit', 'comfyui'],
    recommended: true,
    targetPath: 'qwen/image',
  },

  // ========== FLUX MODELS ==========
  // NOTE: Flux models removed from built-in registry
  // Users should add these via "Add Custom Model" with the correct Hugging Face repository
  // Common Flux repos: black-forest-labs/FLUX.1-dev, black-forest-labs/FLUX.1-schnell
  // AI Toolkit will auto-download Flux models when you start training with them

  // ========== SDXL MODELS ==========
  // NOTE: These repositories should be correct, but file names may vary
  // stabilityai is the official Stability AI organization
  {
    id: 'sdxl-1.0-base',
    name: 'Stable Diffusion XL 1.0 Base',
    family: 'sdxl',
    type: 'base_model',
    description: 'SDXL 1.0 base model. High-quality image generation at 1024x1024 resolution. Repository verified.',
    version: '1.0',
    sourceType: 'huggingface',
    huggingfaceRepo: 'stabilityai/stable-diffusion-xl-base-1.0', // Official Stability AI repo
    huggingfaceFiles: ['sd_xl_base_1.0.safetensors'],
    format: 'safetensors',
    estimatedSize: '~7 GB',
    tags: ['image-generation', 'sdxl', 'stable-diffusion'],
    compatibility: ['ai-toolkit', 'comfyui', 'automatic1111', 'diffusers'],
    recommended: true,
    targetPath: 'sdxl/base',
    previewImage: '/model-previews/sdxl-base.jpg',
  },
  // NOTE: SDXL Refiner and Turbo removed from built-in registry
  // Most users only need SDXL Base. Refiner and Turbo can be added via "Add Custom Model" if needed
];

// Helper functions for registry operations

export function getModelById(id: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find(model => model.id === id);
}

export function getModelsByFamily(family: ModelFamily): ModelDefinition[] {
  return MODEL_REGISTRY.filter(model => model.family === family);
}

export function getModelsByType(type: ModelType): ModelDefinition[] {
  return MODEL_REGISTRY.filter(model => model.type === type);
}

export function getRecommendedModels(): ModelDefinition[] {
  return MODEL_REGISTRY.filter(model => model.recommended);
}

export function searchModels(query: string): ModelDefinition[] {
  const lowerQuery = query.toLowerCase();
  return MODEL_REGISTRY.filter(model => 
    model.name.toLowerCase().includes(lowerQuery) ||
    model.description.toLowerCase().includes(lowerQuery) ||
    model.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
    model.id.toLowerCase().includes(lowerQuery)
  );
}

export function getModelFamilies(): ModelFamily[] {
  const families = new Set(MODEL_REGISTRY.map(model => model.family));
  return Array.from(families);
}

export function getModelTypes(): ModelType[] {
  const types = new Set(MODEL_REGISTRY.map(model => model.type));
  return Array.from(types);
}

// Validation helper
export function validateModelDefinition(model: Partial<ModelDefinition>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!model.id) errors.push('Model ID is required');
  if (!model.name) errors.push('Model name is required');
  if (!model.family) errors.push('Model family is required');
  if (!model.type) errors.push('Model type is required');
  if (!model.sourceType) errors.push('Source type is required');

  if (model.sourceType === 'huggingface' && !model.huggingfaceRepo) {
    errors.push('Hugging Face repository is required for HF models');
  }

  if (model.sourceType === 'civitai' && !model.civitaiModelId) {
    errors.push('CivitAI model ID is required for CivitAI models');
  }

  if (model.sourceType === 'direct_url' && !model.sourceUrl) {
    errors.push('Source URL is required for direct downloads');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

