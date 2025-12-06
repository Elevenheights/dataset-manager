'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface BulkCaptionModalProps {
  datasetId: string;
  selectedIds: string[];
  totalUncaptioned: number;
  onClose: () => void;
  onComplete: () => void;
}

export default function BulkCaptionModal({
  datasetId,
  selectedIds,
  totalUncaptioned,
  onClose,
  onComplete,
}: BulkCaptionModalProps) {
  const [mode, setMode] = useState<'selected' | 'uncaptioned'>('selected');
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  const [qwenConnected, setQwenConnected] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState('');

  // Check Qwen caption service connection
  useEffect(() => {
    fetch('/api/ollama')
      .then((res) => res.json())
      .then((data) => {
        setQwenConnected(data.connected);
        if (data.defaultPrompt) {
          setDefaultPrompt(data.defaultPrompt);
        }
      })
      .catch(() => setQwenConnected(false));
  }, []);

  const startGeneration = async () => {
    if (!qwenConnected) {
      alert('Qwen caption service is not ready. Please start the caption service first.');
      return;
    }

    setIsGenerating(true);
    setResults({ success: 0, failed: 0 });

    try {
      // Determine which images to process
      let imageIds: string[];
      if (mode === 'selected') {
        imageIds = selectedIds;
      } else {
        // Fetch all uncaptioned image IDs
        const response = await fetch(`/api/captions?datasetId=${datasetId}`);
        const data = await response.json();
        if (data.dataset) {
          imageIds = data.dataset.images
            .filter((img: { hasCaption: boolean; id: string }) => !img.hasCaption)
            .map((img: { id: string }) => img.id);
        } else {
          throw new Error('Failed to get dataset');
        }
      }

      setProgress({ current: 0, total: imageIds.length });

      // Process in batches to show progress
      const batchSize = 5;
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < imageIds.length; i += batchSize) {
        const batch = imageIds.slice(i, i + batchSize);
        
        const response = await fetch('/api/ollama/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            datasetId,
            imageIds: batch,
            temperature: 0.7,
            overwriteExisting,
            prompt: customPrompt || undefined,
          }),
        });

        const result = await response.json();
        
        if (result.results) {
          successCount += result.results.filter((r: { success: boolean }) => r.success).length;
          failedCount += result.results.filter((r: { success: boolean }) => !r.success).length;
        }

        setProgress({ current: Math.min(i + batchSize, imageIds.length), total: imageIds.length });
        setResults({ success: successCount, failed: failedCount });
      }

      // Complete
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      console.error('Bulk generation error:', error);
      setResults((prev) => ({ ...prev, failed: prev.failed + 1 }));
    } finally {
      setIsGenerating(false);
    }
  };

  const targetCount = mode === 'selected' ? selectedIds.length : totalUncaptioned;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={!isGenerating ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2
            className="text-lg font-semibold flex items-center gap-2"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            <Sparkles className="w-5 h-5 text-[var(--color-accent-purple)]" />
            Bulk AI Captioning
          </h2>
          {!isGenerating && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {!qwenConnected ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-[var(--color-accent-orange)]/10 border border-[var(--color-accent-orange)]/30">
              <AlertTriangle className="w-5 h-5 text-[var(--color-accent-orange)]" />
              <div>
                <p className="font-medium text-[var(--color-accent-orange)]">
                  Qwen Caption Service Not Ready
                </p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Start the caption service with start_caption_service.bat
                </p>
              </div>
            </div>
          ) : !isGenerating ? (
            <>
              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                  Images to Caption
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setMode('selected')}
                    disabled={selectedIds.length === 0}
                    className={`flex-1 p-3 rounded-lg border transition-all ${
                      mode === 'selected'
                        ? 'border-[var(--color-accent-purple)] bg-[var(--color-accent-purple)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
                    } ${selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-left">
                      <p className="font-medium">Selected Images</p>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {selectedIds.length} images
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => setMode('uncaptioned')}
                    disabled={totalUncaptioned === 0}
                    className={`flex-1 p-3 rounded-lg border transition-all ${
                      mode === 'uncaptioned'
                        ? 'border-[var(--color-accent-purple)] bg-[var(--color-accent-purple)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
                    } ${totalUncaptioned === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-left">
                      <p className="font-medium">All Uncaptioned</p>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {totalUncaptioned} images
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Model Info */}
              <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border)]">
                <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Using Model
                </p>
                <p className="text-sm text-white font-mono">
                  Qwen 2.5 VL 7B (Q8_0 GGUF)
                </p>
              </div>

              {/* Custom Prompt */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                  Custom Prompt (optional)
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={defaultPrompt || "Leave empty to use default captioning prompt..."}
                  className="textarea-field text-sm"
                  rows={3}
                />
              </div>

              {/* Options */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-accent-purple)] focus:ring-[var(--color-accent-purple)]"
                />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Overwrite existing captions
                </span>
              </label>
            </>
          ) : (
            /* Progress Display */
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent-purple)]" />
                </div>
              </div>

              <div className="text-center">
                <p className="text-lg font-medium" style={{ fontFamily: 'var(--font-outfit)' }}>
                  Generating Captions...
                </p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {progress.current} of {progress.total} images processed
                </p>
              </div>

              {/* Progress Bar */}
              <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--color-accent-purple)] to-[var(--color-accent-orange)] transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>

              {/* Results */}
              <div className="flex items-center justify-center gap-6 text-sm">
                <span className="flex items-center gap-1 text-green-500">
                  <CheckCircle className="w-4 h-4" />
                  {results.success} succeeded
                </span>
                {results.failed > 0 && (
                  <span className="flex items-center gap-1 text-[var(--color-accent-orange)]">
                    <XCircle className="w-4 h-4" />
                    {results.failed} failed
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isGenerating && qwenConnected && (
          <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--color-border)]">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={startGeneration}
              disabled={targetCount === 0}
              className="btn-primary flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Generate {targetCount} Captions
            </button>
          </div>
        )}
      </div>
    </div>
  );
}



