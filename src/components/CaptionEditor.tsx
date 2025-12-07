'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DatasetImage } from '@/types';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Save,
  Loader2,
  Check,
} from 'lucide-react';

interface CaptionEditorProps {
  image: DatasetImage;
  datasetId: string;
  onClose: () => void;
  onUpdate: (updatedImage: DatasetImage) => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export default function CaptionEditor({
  image,
  datasetId,
  onClose,
  onUpdate,
  onNavigate,
  hasPrev,
  hasNext,
}: CaptionEditorProps) {
  const [caption, setCaption] = useState(image.caption);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [imageLoading, setImageLoading] = useState(true);
  const [generationStatus, setGenerationStatus] = useState<{status: string; message: string; progress: number}>({ 
    status: 'idle', 
    message: '', 
    progress: 0 
  });
  const savingRef = useRef(false);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update caption when image changes
  useEffect(() => {
    setCaption(image.caption);
    setSaveStatus('idle');
    setImageLoading(true);
  }, [image.id]);

  const saveCaption = useCallback(async (captionToSave: string) => {
    if (savingRef.current) return; // Already saving, skip
    
    savingRef.current = true;
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const response = await fetch('/api/captions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId,
          imageId: image.id,
          caption: captionToSave,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSaveStatus('saved');
        onUpdate(result.image);
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  }, [datasetId, image.id, onUpdate]);

  // Auto-save with debounce
  useEffect(() => {
    if (caption === image.caption) return; // No changes, skip
    
    const timer = setTimeout(() => {
      saveCaption(caption);
    }, 1000);

    return () => clearTimeout(timer);
  }, [caption, image.caption, saveCaption]);

  const generateCaption = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setGenerationStatus({ status: 'starting', message: 'Starting...', progress: 0 });

    // Start polling for status
    statusIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await fetch('http://localhost:11435/status');
        const statusData = await statusRes.json();
        setGenerationStatus(statusData);
      } catch (err) {
        console.error('Failed to fetch status:', err);
      }
    }, 1000); // Poll every second

    try {
      // Load caption settings from localStorage
      const settingsJson = localStorage.getItem('captionSettings');
      const settings = settingsJson ? JSON.parse(settingsJson) : {};

      const response = await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId,
          imageId: image.id,
          temperature: settings.temperature || 0.7,
          settings,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setCaption(result.caption);
        setGenerationStatus({ status: 'completed', message: 'Caption generated!', progress: 100 });
        onUpdate(result.image);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setGenerationStatus({ status: 'error', message: result.error || 'Unknown error', progress: 0 });
        alert(result.error || 'Caption generation failed');
      }
    } catch (error) {
      console.error('Generate error:', error);
      setGenerationStatus({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error', progress: 0 });
      alert('Failed to connect to Qwen caption service. Make sure it\'s running.');
    } finally {
      setIsGenerating(false);
      // Clear status polling
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
      // Reset status after a delay
      setTimeout(() => {
        setGenerationStatus({ status: 'idle', message: '', progress: 0 });
      }, 3000);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev && !e.target) {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight' && hasNext && !e.target) {
        onNavigate('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, onClose, onNavigate]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Editor Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-[var(--color-bg-secondary)] border-l border-[var(--color-border)] flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('prev')}
              disabled={!hasPrev}
              className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => onNavigate('next')}
              disabled={!hasNext}
              className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <h2
            className="text-lg font-semibold truncate max-w-xs"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            {image.filename}
          </h2>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Preview */}
        <div className="relative flex-shrink-0 h-80 bg-black flex items-center justify-center">
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent-purple)]" />
            </div>
          )}
          <img
            src={image.fullUrl}
            alt={image.filename}
            onLoad={() => setImageLoading(false)}
            className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
              imageLoading ? 'opacity-0' : 'opacity-100'
            }`}
          />
        </div>

        {/* Caption Editor */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
          {/* AI Generation Controls */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border)]">
                <Sparkles className="w-3 h-3 text-[var(--color-accent-purple)]" />
                <span className="text-xs text-[var(--color-text-muted)] font-mono">
                  Qwen 2.5 VL
                </span>
              </div>
              <button
                onClick={generateCaption}
                disabled={isGenerating}
                className="btn-primary flex items-center gap-2 text-sm py-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate with AI
                  </>
                )}
              </button>
            </div>
            
            {/* Generation Status */}
            {isGenerating && generationStatus.status !== 'idle' && (
              <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-blue-200">
                    {generationStatus.message}
                  </span>
                  {generationStatus.progress > 0 && (
                    <span className="text-xs text-blue-300">
                      {generationStatus.progress}%
                    </span>
                  )}
                </div>
                {generationStatus.progress > 0 && (
                  <div className="h-1 bg-blue-900/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${generationStatus.progress}%` }}
                    />
                  </div>
                )}
                {generationStatus.status === 'generating' && (
                  <p className="text-xs text-blue-300/70 mt-1">
                    ⏰ This may take 5-10 minutes on CPU
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Caption Textarea */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                Caption
              </label>
              <div className="flex items-center gap-2 text-xs">
                {isSaving && (
                  <span className="text-[var(--color-text-muted)] flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Saving...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-green-500 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Saved
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-[var(--color-accent-orange)]">
                    Failed to save
                  </span>
                )}
              </div>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Enter a detailed caption for this image..."
              className="textarea-field flex-1 min-h-[200px]"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-[var(--color-text-muted)]">
              <span>{caption.length} characters</span>
              <span>{caption.split(/\s+/).filter(Boolean).length} words</span>
            </div>
          </div>

          {/* Manual Save Button */}
          <button
            onClick={() => saveCaption(caption)}
            disabled={isSaving || caption === image.caption}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Caption
          </button>
        </div>
      </div>
    </div>
  );
}



