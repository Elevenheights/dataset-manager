'use client';

import { useState } from 'react';
import { Download, Check, Loader2, Lock, AlertCircle } from 'lucide-react';

interface ModelCardProps {
  model: {
    id: string;
    name: string;
    family: string;
    type: string;
    description: string;
    estimatedSize?: string;
    tags?: string[];
    recommended?: boolean;
    isInstalled: boolean;
    requiresToken?: boolean;
    previewImage?: string;
  };
  onDownloadComplete?: () => void;
}

export default function ModelCard({ model, onDownloadComplete }: ModelCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const handleDownload = async () => {
    if (model.requiresToken && !token && !showTokenInput) {
      setShowTokenInput(true);
      return;
    }

    setIsDownloading(true);
    setError('');

    try {
      const response = await fetch('/api/models/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: model.id,
          huggingfaceToken: token || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Download failed');
        setIsDownloading(false);
        return;
      }

      // Poll for completion
      const jobId = data.jobId;
      let pollCount = 0;
      const maxPolls = 300; // 10 minutes max (2s interval)
      
      const checkInterval = setInterval(async () => {
        pollCount++;
        
        if (pollCount > maxPolls) {
          clearInterval(checkInterval);
          setError('Download timeout - check logs or try again');
          setIsDownloading(false);
          return;
        }
        
        try {
          const statusResponse = await fetch(`/api/models/download/${jobId}`);
          const statusData = await statusResponse.json();

          if (statusData.success && statusData.job) {
            const job = statusData.job;

            if (job.status === 'completed') {
              clearInterval(checkInterval);
              setIsDownloading(false);
              setShowTokenInput(false);
              setToken('');
              if (onDownloadComplete) {
                onDownloadComplete();
              }
            } else if (job.status === 'failed') {
              clearInterval(checkInterval);
              
              // Show detailed error including disk space issues
              let errorMsg = job.error || 'Download failed';
              if (errorMsg.includes('disk space') || errorMsg.includes('free disk')) {
                errorMsg = '❌ Not enough disk space! Free up space and try again.';
              }
              
              setError(errorMsg);
              setIsDownloading(false);
            }
          }
        } catch (err) {
          // Network error during polling
          console.error('Poll error:', err);
        }
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Download failed');
      setIsDownloading(false);
    }
  };

  return (
    <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent-purple)]/50 transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {model.name}
            </h3>
            {model.recommended && (
              <span className="px-2 py-0.5 text-xs bg-[var(--color-accent-purple)]/20 text-[var(--color-accent-purple-light)] rounded-full border border-[var(--color-accent-purple)]/30">
                Recommended
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] rounded-full border border-[var(--color-border)]">
              {model.family}
            </span>
            <span className="px-2 py-0.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] rounded-full border border-[var(--color-border)]">
              {model.type.replace('_', ' ')}
            </span>
          </div>
        </div>
        {model.isInstalled && (
          <div className="flex items-center gap-1 px-2 py-1 bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)] text-xs rounded-full border border-[var(--color-accent-green)]/30">
            <Check className="w-3 h-3" />
            Installed
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-[var(--color-text-muted)] mb-3 line-clamp-2">
        {model.description}
      </p>

      {/* Tags */}
      {model.tags && model.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {model.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs bg-[var(--color-bg-tertiary)]/50 text-[var(--color-text-muted)] rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Size and Token Info */}
      <div className="flex items-center justify-between mb-3">
        {model.estimatedSize && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {model.estimatedSize}
          </span>
        )}
        {model.requiresToken && (
          <div className="flex items-center gap-1 text-xs text-[var(--color-accent-orange)]">
            <Lock className="w-3 h-3" />
            Token required
          </div>
        )}
      </div>

      {/* Token Input (if needed) */}
      {showTokenInput && !model.isInstalled && (
        <div className="mb-3">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Hugging Face token..."
            className="w-full px-3 py-2 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-accent-purple)] focus:border-transparent"
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Get your token from{' '}
            <a
              href="https://huggingface.co/settings/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-accent-blue)] hover:underline"
            >
              Hugging Face Settings
            </a>
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-3 p-2 bg-[var(--color-accent-red)]/10 border border-[var(--color-accent-red)]/30 rounded text-xs text-[var(--color-accent-red)] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Download Button */}
      <button
        onClick={handleDownload}
        disabled={model.isInstalled || isDownloading}
        className={`w-full py-2 px-4 rounded-md flex items-center justify-center gap-2 text-sm font-medium transition-all ${
          model.isInstalled
            ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
            : isDownloading
            ? 'bg-[var(--color-accent-purple)]/50 text-white cursor-wait'
            : 'btn-primary hover:scale-105'
        }`}
      >
        {isDownloading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Downloading...
          </>
        ) : model.isInstalled ? (
          <>
            <Check className="w-4 h-4" />
            Installed
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            {showTokenInput && model.requiresToken ? 'Download with Token' : 'Download'}
          </>
        )}
      </button>
    </div>
  );
}

