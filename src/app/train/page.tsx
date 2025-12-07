'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, ExternalLink, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export default function TrainPage() {
  const [aiToolkitUrl, setAiToolkitUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiToolkitReady, setAiToolkitReady] = useState(false);

  const checkAiToolkit = useCallback(async (url: string) => {
    try {
      // Try to reach AI Toolkit health endpoint
      const isRunpod = url.includes('runpod.net');
      
      if (isRunpod) {
        // For RunPod, we can't easily check due to CORS, so assume it's ready
        // if the URL pattern looks valid
        setAiToolkitReady(true);
      } else {
        // For local, try to actually reach it
        const response = await fetch(url, { 
          method: 'HEAD',
          mode: 'no-cors',
          signal: AbortSignal.timeout(3000),
        });
        // If we get here without error, it's likely running
        setAiToolkitReady(true);
      }
    } catch (error) {
      setAiToolkitReady(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Determine AI Toolkit URL based on environment
    const hostname = window.location.hostname;
    let url: string;
    
    // If hostname contains runpod, extract the pod ID
    if (hostname.includes('runpod.net') || hostname.includes('proxy.runpod')) {
      const parts = hostname.split('-');
      const podId = parts[0]; // First part is usually the pod ID
      url = `https://${podId}-8675.proxy.runpod.net`;
    } else {
      // Local development
      url = 'http://localhost:8675';
    }
    
    setAiToolkitUrl(url);
    checkAiToolkit(url);
    
    // Re-check periodically
    const interval = setInterval(() => {
      checkAiToolkit(url);
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, [checkAiToolkit]);

  const openAiToolkit = () => {
    if (aiToolkitUrl) {
      // Open in new tab with noopener for security
      window.open(aiToolkitUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="min-h-[calc(100vh-73px)] p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-lg bg-gradient-to-br from-[var(--color-accent-orange)]/20 to-[var(--color-accent-purple)]/20 border border-[var(--color-border)]">
              <Zap className="w-6 h-6 text-[var(--color-accent-orange)]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
                LoRA Training
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                Train custom LoRA models with AI Toolkit
              </p>
            </div>
          </div>
        </div>

        {/* AI Toolkit Launch Card */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-[var(--color-border)]">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              AI Toolkit UI
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Configure and monitor your LoRA training jobs
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status */}
            {loading ? (
              <div className="flex items-center gap-3 p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--color-accent-purple)]" />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Checking AI Toolkit status...
                </span>
              </div>
            ) : aiToolkitReady ? (
              <div className="flex items-center gap-3 p-4 bg-[var(--color-accent-green)]/10 border border-[var(--color-accent-green)]/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-[var(--color-accent-green)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--color-accent-green)]">
                    AI Toolkit is ready
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Running on port 8675
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-[var(--color-accent-orange)]/10 border border-[var(--color-accent-orange)]/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-[var(--color-accent-orange)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--color-accent-orange)]">
                    AI Toolkit may be starting up
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Wait a moment and try launching
                  </p>
                </div>
              </div>
            )}

            {/* Launch Button */}
            <button
              onClick={openAiToolkit}
              disabled={!aiToolkitUrl}
              className="w-full btn-primary py-4 flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              <Zap className="w-6 h-6" />
              Launch AI Toolkit UI
              <ExternalLink className="w-5 h-5" />
            </button>

            {/* URL Display */}
            {aiToolkitUrl && (
              <div className="p-3 bg-[var(--color-bg-tertiary)]/50 rounded-lg">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">
                  AI Toolkit URL:
                </p>
                <code className="text-sm text-[var(--color-accent-blue)] font-mono break-all">
                  {aiToolkitUrl}
                </code>
              </div>
            )}
          </div>
        </div>

        {/* Workflow Guide */}
        <div className="mt-8 p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Training Workflow
          </h3>
          <ol className="space-y-3 text-sm text-[var(--color-text-secondary)]">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-bold">
                1
              </span>
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">Download Models</p>
                <p className="text-[var(--color-text-muted)]">
                  Go to Models page and download your base model (Z-Image, Flux, SDXL, etc.)
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-bold">
                2
              </span>
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">Prepare Dataset</p>
                <p className="text-[var(--color-text-muted)]">
                  Upload images and generate captions using Qwen 2.5 VL
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-bold">
                3
              </span>
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">Export Dataset</p>
                <p className="text-[var(--color-text-muted)]">
                  Export to AI Toolkit format (datasets are saved to /workspace/ai-toolkit/datasets/)
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-bold">
                4
              </span>
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">Configure Training</p>
                <p className="text-[var(--color-text-muted)]">
                  Click "Launch AI Toolkit UI" above and create a training job with your dataset
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-bold">
                5
              </span>
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">Monitor & Download</p>
                <p className="text-[var(--color-text-muted)]">
                  Watch training progress in AI Toolkit. Trained LoRAs are saved to /workspace/ai-toolkit/output/
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* Quick Links */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <a
            href="/models"
            className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent-purple)]/50 transition-colors text-center"
          >
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Browse Models
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Download base models
            </p>
          </a>
          <a
            href="/upload"
            className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent-purple)]/50 transition-colors text-center"
          >
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Upload Dataset
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Prepare training images
            </p>
          </a>
          <a
            href="/caption"
            className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent-purple)]/50 transition-colors text-center"
          >
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Caption Images
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Generate AI captions
            </p>
          </a>
        </div>
      </div>
    </div>
  );
}

