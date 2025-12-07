'use client';

import { useState, useEffect } from 'react';
import { Download, X, Loader2, CheckCircle, XCircle, Wifi } from 'lucide-react';

interface DownloadJob {
  id: string;
  modelName: string;
  status: 'pending' | 'downloading' | 'verifying' | 'completed' | 'failed';
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speed?: number;
  eta?: number;
}

interface NetworkStats {
  rxRate: number; // bytes per second (download)
  txRate: number; // bytes per second (upload)
}

export default function ModelDownloadProgress() {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);

  useEffect(() => {
    // Poll for active downloads
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/models/download');
        const data = await response.json();

        if (data.success) {
          // Filter to only show active jobs
          const activeJobs = data.jobs.filter(
            (job: DownloadJob) => 
              job.status === 'pending' || 
              job.status === 'downloading' || 
              job.status === 'verifying'
          );
          setJobs(activeJobs);
        }
      } catch (error) {
        console.error('Error fetching download jobs:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, []);

  // Poll for network stats when there are active downloads
  useEffect(() => {
    if (jobs.length === 0) {
      setNetworkStats(null);
      return;
    }

    const fetchNetworkStats = async () => {
      try {
        const response = await fetch('/api/system/network');
        const data = await response.json();
        if (data.success) {
          setNetworkStats({
            rxRate: data.rxRate,
            txRate: data.txRate,
          });
        }
      } catch (error) {
        // Network stats not available
      }
    };

    // Initial fetch
    fetchNetworkStats();

    // Poll every second for responsive network display
    const interval = setInterval(fetchNetworkStats, 1000);

    return () => clearInterval(interval);
  }, [jobs.length]);

  const cancelDownload = async (jobId: string) => {
    setCancelling(prev => new Set(prev).add(jobId));
    try {
      await fetch('/api/models/download/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      // Remove from local state immediately
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (error) {
      console.error('Failed to cancel download:', error);
    } finally {
      setCancelling(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatETA = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  if (jobs.length === 0) return null;

  // Format network speed
  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return (bytesPerSecond / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  };

  return (
    <div className="fixed bottom-6 right-6 w-96 max-w-full z-50">
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[var(--color-accent-purple-light)]" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              Downloading Models ({jobs.length})
            </span>
          </div>
          {/* Live Network Stats */}
          {networkStats && networkStats.rxRate > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-accent-green)]/10 border border-[var(--color-accent-green)]/30">
              <Wifi className="w-3 h-3 text-[var(--color-accent-green)]" />
              <span className="text-xs font-medium text-[var(--color-accent-green)]">
                ↓ {formatSpeed(networkStats.rxRate)}
              </span>
            </div>
          )}
        </div>

        {/* Info Message */}
        <div className="px-4 py-2 bg-blue-500/5 border-b border-[var(--color-border)]">
          <p className="text-xs text-blue-300/80">
            💡 Progress may pause briefly during chunk transfers - this is normal. 
            Check the network indicator above to confirm download is active.
          </p>
        </div>

        {/* Jobs List */}
        <div className="max-h-96 overflow-y-auto">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="px-4 py-3 border-b border-[var(--color-border)] last:border-b-0"
            >
              {/* Model Name and Status */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {job.modelName}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {job.status === 'downloading' && 'Downloading...'}
                    {job.status === 'verifying' && 'Verifying...'}
                    {job.status === 'pending' && 'Pending...'}
                    {job.status === 'completed' && 'Completed'}
                    {job.status === 'failed' && 'Failed'}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {(job.status === 'downloading' || job.status === 'pending') && (
                    <button
                      onClick={() => cancelDownload(job.id)}
                      disabled={cancelling.has(job.id)}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                      title="Cancel download"
                    >
                      {cancelling.has(job.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  {job.status === 'downloading' && !cancelling.has(job.id) && (
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent-purple-light)]" />
                  )}
                  {job.status === 'completed' && (
                    <CheckCircle className="w-4 h-4 text-[var(--color-accent-green)]" />
                  )}
                  {job.status === 'failed' && (
                    <XCircle className="w-4 h-4 text-[var(--color-accent-red)]" />
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-2">
                <div className="h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--color-accent-purple)] to-[var(--color-accent-blue)] transition-all duration-300"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              </div>

              {/* Progress Details */}
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>
                  {formatBytes(job.downloadedBytes)} / {formatBytes(job.totalBytes)}
                </span>
                <div className="flex items-center gap-3">
                  {job.speed && job.speed > 0 && (
                    <span>{formatBytes(job.speed)}/s</span>
                  )}
                  {job.eta && job.eta > 0 && (
                    <span>{formatETA(job.eta)} remaining</span>
                  )}
                  <span>{Math.round(job.progress)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Network Activity Indicator */}
        {networkStats && (
          <div className="px-4 py-2 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>Network Activity:</span>
            <div className="flex items-center gap-3">
              <span className={networkStats.rxRate > 1024 ? 'text-[var(--color-accent-green)]' : ''}>
                ↓ {formatSpeed(networkStats.rxRate)}
              </span>
              <span className={networkStats.txRate > 1024 ? 'text-[var(--color-accent-blue)]' : ''}>
                ↑ {formatSpeed(networkStats.txRate)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

