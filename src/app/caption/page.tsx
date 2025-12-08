'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ImageGrid from '@/components/ImageGrid';
import CaptionEditor from '@/components/CaptionEditor';
import BulkCaptionModal from '@/components/BulkCaptionModal';
import CaptionSettingsModal from '@/components/CaptionSettingsModal';
import ModelSelector from '@/components/ModelSelector';
import DatasetSelector from '@/components/DatasetSelector';
import { Dataset, DatasetImage } from '@/types';
import {
  Sparkles,
  Download,
  CheckSquare,
  Square,
  Loader2,
  AlertTriangle,
  FolderOpen,
  RefreshCw,
  CheckCircle,
  X,
  Trash2,
  Plus,
  Upload,
  Settings,
} from 'lucide-react';

interface SystemStatus {
  ready: boolean;
  dev_mode: boolean;
  caption_service: {
    available: boolean;
    ready: boolean;  // true only when BOTH model and mmproj files exist
    downloading: boolean;
    error?: string;
  };
  qwen_caption_model: {
    exists: boolean;
  };
  ai_toolkit_models: {
    zimage_turbo: { exists: boolean };
    training_adapter: { exists: boolean };
  };
  messages: string[];
}

function CaptionPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const datasetId = searchParams.get('dataset');

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<DatasetImage | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportPath, setExportPath] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<'zip' | 'aitoolkit'>('zip');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictFolderName, setConflictFolderName] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [captionSettings, setCaptionSettings] = useState<any>(null);
  const [selectedBaseModel, setSelectedBaseModel] = useState('');
  const [qwenDownloadStatus, setQwenDownloadStatus] = useState<{
    exists: boolean;
    downloading: boolean;
    progress: number;
    downloadedBytes: number;
    expectedSize: number;
    error?: string | null;
  }>({ exists: false, downloading: false, progress: 0, downloadedBytes: 0, expectedSize: 8589934592 });
  const [currentDatasetName, setCurrentDatasetName] = useState<string>('');
  const [dismissedDownloadBanner, setDismissedDownloadBanner] = useState(false);

  // Sync currentDatasetName with URL param
  useEffect(() => {
    if (datasetId) {
      setCurrentDatasetName(datasetId);
    }
  }, [datasetId]);

  // Fetch dataset
  const fetchDataset = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = datasetId
        ? `/api/captions?datasetId=${datasetId}`
        : '/api/captions';
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load dataset');
      }

      setDataset(data.dataset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setDataset(null); // Clear dataset on error
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  // Fetch system status
  const fetchSystemStatus = useCallback(async () => {
    setCheckingStatus(true);
    try {
      const response = await fetch('/api/system/status');
      const data = await response.json();
      setSystemStatus(data);
    } catch (err) {
      console.error('Failed to check system status:', err);
      // Set a minimal status to allow dev mode to work
      setSystemStatus({
        ready: false,
        dev_mode: true,
        caption_service: { 
          available: false, 
          ready: false,
          downloading: false,
          error: 'Could not check status' 
        },
        qwen_caption_model: { exists: false },
        ai_toolkit_models: {
          zimage_turbo: { exists: false },
          training_adapter: { exists: false },
        },
        messages: ['System status check failed - assuming dev mode'],
      });
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  // Load current dataset ID
  const loadCurrentDataset = useCallback(async () => {
    try {
      const response = await fetch('/api/datasets/current');
      const data = await response.json();
      if (data.success && data.currentDataset) {
        setCurrentDatasetName(data.currentDataset); // This is actually the ID
      }
    } catch (error) {
      console.error('Error loading current dataset:', error);
    }
  }, []);

  // Handle dataset change
  const handleDatasetChange = useCallback(async (newDatasetId: string) => {
    try {
      // If no dataset (all deleted), redirect to upload page
      if (!newDatasetId) {
        router.push('/upload');
        return;
      }
      
      // Clear current data immediately
      setDataset(null);
      setLoading(true);
      setError(null);

      // Set as current dataset in backend
      await fetch('/api/datasets/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId: newDatasetId }),
      });

      // Update local state
      setCurrentDatasetName(newDatasetId);

      // Update URL to reflect change - this will trigger re-render and fetch via useEffect
      router.push(`/caption?dataset=${newDatasetId}`);
      
    } catch (error) {
      console.error('Error changing dataset:', error);
      setLoading(false);
    }
  }, [router]);

  // Check Qwen model status and trigger download if needed
  const checkQwenModel = useCallback(async () => {
    try {
      // Check if model exists
      const statusResponse = await fetch('/api/caption-model/download');
      const statusData = await statusResponse.json();
      
      // Check download progress
      const progressResponse = await fetch('/api/caption-model/download-progress');
      const progressData = await progressResponse.json();
      
      if (statusData.success) {
        const wasDownloading = qwenDownloadStatus.downloading;
        const newStatus = {
          exists: statusData.exists,
          downloading: progressData.downloading || statusData.downloadInProgress,
          progress: progressData.progress || statusData.progress || 0,
          downloadedBytes: progressData.downloaded || statusData.fileSize || 0,
          expectedSize: progressData.total || statusData.expectedSize || 8589934592,
          error: statusData.error || null,
        };
        
        setQwenDownloadStatus(newStatus);
        
        // If download just completed, refresh system status
        if (wasDownloading && !newStatus.downloading && newStatus.exists) {
          console.log('Qwen download completed - refreshing system status...');
          setTimeout(() => {
            fetchSystemStatus();
          }, 2000); // Wait 2 seconds for caption service to detect the files
        }
        
        // If model doesn't exist and isn't downloading, start download
        if (!statusData.exists && !progressData.downloading && !statusData.downloadInProgress && !statusData.error) {
          console.log('Starting Qwen caption model download...');
          await fetch('/api/caption-model/download', { method: 'POST' });
          setQwenDownloadStatus(prev => ({ ...prev, downloading: true, progress: 1 }));
        }
      }
    } catch (error) {
      console.error('Error checking Qwen model:', error);
    }
  }, [qwenDownloadStatus.downloading, fetchSystemStatus]);

  // Initial load
  useEffect(() => {
    loadCurrentDataset();
    fetchDataset();
    fetchSystemStatus();
    checkQwenModel();
  }, [loadCurrentDataset, fetchDataset, fetchSystemStatus, checkQwenModel]);
  
  // Separate effect for polling - only when actively downloading
  useEffect(() => {
    if (!qwenDownloadStatus.downloading || qwenDownloadStatus.exists) {
      return; // Don't poll if not downloading or already exists
    }
    
    // Poll Qwen download status every 2 seconds while downloading for real-time progress
    const interval = setInterval(() => {
      checkQwenModel();
    }, 2000); // Fast polling for real-time progress updates
    
    return () => clearInterval(interval);
  }, [qwenDownloadStatus.downloading, qwenDownloadStatus.exists, checkQwenModel]);

  // Handle image selection
  const handleSelectImage = useCallback((image: DatasetImage) => {
    setSelectedImage(image);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setSelectedImage(null);
  }, []);

  const handleUpdateImage = useCallback((updatedImage: DatasetImage) => {
    setDataset((prev) => {
      if (!prev) return prev;
      const images = prev.images.map((img) =>
        img.id === updatedImage.id ? updatedImage : img
      );
      return {
        ...prev,
        images,
        captionedCount: images.filter((img) => img.hasCaption).length,
      };
    });
  }, []);

  const handleNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (!dataset || !selectedImage) return;
      const currentIndex = dataset.images.findIndex(
        (img) => img.id === selectedImage.id
      );
      const newIndex =
        direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex >= 0 && newIndex < dataset.images.length) {
        setSelectedImage(dataset.images[newIndex]);
      }
    },
    [dataset, selectedImage]
  );

  // Selection mode handlers
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedIds(new Set());
    }
  };

  const toggleImageSelection = (imageId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (dataset) {
      setSelectedIds(new Set(dataset.images.map((img) => img.id)));
    }
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Handle export conflict resolution
  const handleExportWithOverwrite = async (shouldOverwrite: boolean) => {
    if (!dataset) return;
    
    setShowConflictDialog(false);
    setExporting(true);

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId: dataset.id,
          outputPath: exportPath.trim() || undefined,
          overwrite: shouldOverwrite,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Export failed');
      }

      alert(result.message);
      setShowExportModal(false);
      setExportPath('');
      
      // Open AI Toolkit in new tab
      if (result.aiToolkitUrl) {
        window.open(result.aiToolkitUrl, '_blank');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // Delete selected images
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedIds.size} image(s)? This cannot be undone.`
    );
    
    if (!confirmDelete) return;
    
    setIsDeleting(true);
    
    try {
      const response = await fetch('/api/images/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId: dataset?.id,
          imageIds: Array.from(selectedIds),
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete images');
      }
      
      // Refresh dataset and clear selection
      await fetchDataset();
      setSelectedIds(new Set());
      setSelectionMode(false);
      
      alert(result.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete images');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export handler
  const handleExport = async () => {
    if (!dataset) return;

    setExporting(true);

    try {
      if (exportMode === 'zip') {
        // Download as ZIP
        const response = await fetch('/api/export/zip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            datasetId: dataset.id,
          }),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'ZIP export failed');
        }

        // Download the ZIP file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dataset.name.replace(/[^a-zA-Z0-9-_]/g, '_')}_aitoolkit.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        alert('Dataset exported as ZIP file!');
        setShowExportModal(false);
      } else {
        // Export to AI Toolkit
        // Warn if AI Toolkit models are not ready, but allow export
        if (!exportReady && !systemStatus?.dev_mode) {
          const proceed = window.confirm('AI Toolkit models are not fully downloaded yet. Export might not work in AI Toolkit until downloads complete. Proceed anyway?');
          if (!proceed) return;
        }

        const response = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            datasetId: dataset.id,
            outputPath: exportPath.trim() || undefined,
            overwrite: false, // First attempt - check for conflicts
          }),
        });

        const result = await response.json();

        // Handle conflict
        if (result.conflict) {
          setConflictFolderName(result.existingFolder);
          setShowConflictDialog(true);
          return;
        }

        if (!response.ok) {
          throw new Error(result.error || 'Export failed');
        }

        alert(result.message);
        setShowExportModal(false);
        setExportPath('');
        
        // Open AI Toolkit in new tab if available
        if (result.aiToolkitUrl) {
          window.open(result.aiToolkitUrl, '_blank');
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-73px)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[var(--color-accent-purple)] mx-auto mb-4" />
          <p className="text-[var(--color-text-muted)]">Loading dataset...</p>
        </div>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="min-h-[calc(100vh-73px)] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 rounded-full bg-[var(--color-accent-orange)]/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-[var(--color-accent-orange)]" />
          </div>
          <h2
            className="text-xl font-semibold mb-2"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            {error || 'No Dataset Found'}
          </h2>
          <p className="text-[var(--color-text-muted)] mb-6">
            Please upload a dataset first to start captioning.
          </p>
          <button onClick={() => router.push('/upload')} className="btn-primary">
            Go to Upload
          </button>
        </div>
      </div>
    );
  }

  const currentImageIndex = selectedImage
    ? dataset.images.findIndex((img) => img.id === selectedImage.id)
    : -1;
  const hasPrev = currentImageIndex > 0;
  const hasNext = currentImageIndex < dataset.images.length - 1;
  const uncaptionedCount = dataset.totalImages - dataset.captionedCount;

  // Caption is ready when service is available AND both model files exist (checked by caption_service.ready)
  const captionReady = systemStatus?.caption_service.ready ?? false;
  const exportReady = systemStatus?.ready ?? false;

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col">
      {/* Qwen Model Download Banner */}
      {!dismissedDownloadBanner && (qwenDownloadStatus.downloading || qwenDownloadStatus.error) && !qwenDownloadStatus.exists && (
        <div className={`px-6 py-3 border-b ${qwenDownloadStatus.error ? 'bg-red-500/10 border-red-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
          <div className="flex items-center gap-4 relative">
            {qwenDownloadStatus.error ? (
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            ) : qwenDownloadStatus.exists && qwenDownloadStatus.progress === 100 ? (
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin text-blue-400 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                qwenDownloadStatus.error ? 'text-red-200' : 
                qwenDownloadStatus.exists && qwenDownloadStatus.progress === 100 ? 'text-green-200' : 
                'text-blue-200'
              }`}>
                {qwenDownloadStatus.error ? 'Download Error' : 
                 qwenDownloadStatus.exists && qwenDownloadStatus.progress === 100 ? 'Caption Model Ready!' :
                 'Downloading Qwen 2.5 VL Model Files'}
              </p>
              <p className={`text-xs ${
                qwenDownloadStatus.error ? 'text-red-200/70' : 
                qwenDownloadStatus.exists && qwenDownloadStatus.progress === 100 ? 'text-green-200/70' : 
                'text-blue-200/70'
              }`}>
                {qwenDownloadStatus.error ? qwenDownloadStatus.error :
                 qwenDownloadStatus.exists && qwenDownloadStatus.progress === 100 ? 
                 `Model (7.6 GB) and vision encoder (1.3 GB) downloaded successfully. You can now caption images!` :
                 `Downloading model files (~${(qwenDownloadStatus.expectedSize / (1024 * 1024 * 1024)).toFixed(1)} GB total). This happens once and persists.`}
              </p>
            </div>
            {!qwenDownloadStatus.error && (
              <div className="text-right mr-2">
                <div className="text-sm font-medium text-blue-200">
                  {qwenDownloadStatus.progress}%
                </div>
                <div className="text-xs text-blue-200/70">
                  {(qwenDownloadStatus.downloadedBytes / (1024 * 1024 * 1024)).toFixed(2)} / {(qwenDownloadStatus.expectedSize / (1024 * 1024 * 1024)).toFixed(1)} GB
                </div>
              </div>
            )}
            {/* Cancel Button (only when downloading) */}
            {qwenDownloadStatus.downloading && (
              <button
                onClick={async () => {
                  if (confirm('Cancel the caption model download? You can restart it later.')) {
                    try {
                      await fetch('/api/caption-model/download', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'cancel' }),
                      });
                      setQwenDownloadStatus(prev => ({ ...prev, downloading: false, progress: 0 }));
                    } catch (e) {
                      console.error('Failed to cancel:', e);
                    }
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium text-red-300 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}
            
            {/* Dismiss Button (always show) */}
            <button
              onClick={() => setDismissedDownloadBanner(true)}
              className="p-1 hover:bg-white/10 rounded transition-colors ml-auto"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Progress bar */}
          {!qwenDownloadStatus.error && (
            <div className="mt-2 h-1.5 bg-blue-900/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                style={{ width: `${qwenDownloadStatus.progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* System Status Banner */}
      {systemStatus && !systemStatus.ready && !qwenDownloadStatus.downloading && !qwenDownloadStatus.exists && (
        <div className="px-6 py-3 bg-[var(--color-accent-orange)]/10 border-b border-[var(--color-accent-orange)]/30">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[var(--color-accent-orange)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--color-accent-orange)] mb-1">
                  Caption Service Not Ready
                </p>
                <ul className="text-xs text-[var(--color-accent-orange)]/80 space-y-1">
                  {systemStatus.messages.filter(m => m.includes('⚠️')).map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              </div>
            </div>
            
            {/* Retry Button if caption service has issues */}
            {!systemStatus.caption_service.available && (
              <button
                onClick={() => {
                  fetchSystemStatus();
                  checkQwenModel();
                }}
                className="px-3 py-1.5 bg-[var(--color-accent-orange)]/20 hover:bg-[var(--color-accent-orange)]/30 text-[var(--color-accent-orange)] text-xs font-medium rounded-lg transition-colors border border-[var(--color-accent-orange)]/30"
              >
                Refresh Status
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="relative z-40 flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          {/* Dataset Selector */}
          <div className="relative z-50">
            <DatasetSelector
              currentDataset={currentDatasetName}
              onDatasetChange={handleDatasetChange}
            />
          </div>
          
          <div>
            <h2
              className="text-lg font-semibold"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              {dataset.name}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              {dataset.captionedCount}/{dataset.totalImages} captioned
              {uncaptionedCount > 0 && (
                <span className="text-[var(--color-accent-orange)] ml-2">
                  ({uncaptionedCount} remaining)
                </span>
              )}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-32 h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--color-accent-purple)] to-[var(--color-accent-orange)] transition-all duration-300"
              style={{
                width: `${(dataset.captionedCount / dataset.totalImages) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh button */}
          <button
            onClick={fetchDataset}
            className="btn-secondary py-2 px-3"
            title="Refresh dataset"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Selection mode toggle */}
          <button
            onClick={toggleSelectionMode}
            className={`btn-secondary py-2 px-4 flex items-center gap-2 ${
              selectionMode ? 'border-[var(--color-accent-purple)] bg-[var(--color-accent-purple)]/10' : ''
            }`}
          >
            {selectionMode ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            Select
          </button>

          {/* Selection actions */}
          {selectionMode && (
            <>
              <button onClick={selectAll} className="btn-secondary py-2 px-3 text-sm">
                All
              </button>
              <button onClick={deselectAll} className="btn-secondary py-2 px-3 text-sm">
                None
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={selectedIds.size === 0 || isDeleting}
                className="btn-secondary py-2 px-3 text-sm flex items-center gap-2 text-red-400 hover:text-red-300 hover:border-red-400/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedIds.size})
              </button>
            </>
          )}

          {/* Add images button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-secondary py-2 px-4 flex items-center gap-2"
            title="Add more images to this dataset"
          >
            <Plus className="w-4 h-4" />
            Add Images
          </button>

          {/* Caption Settings button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="btn-secondary py-2 px-4 flex items-center gap-2"
            title="Configure caption generation settings"
          >
            <Settings className="w-4 h-4" />
            Caption Settings
          </button>

          {/* Bulk caption button */}
          <button
            onClick={() => setShowBulkModal(true)}
            disabled={!captionReady}
            className="btn-secondary py-2 px-4 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!captionReady ? 'Caption service not ready' : 'Generate captions with Qwen 2.5 VL'}
          >
            <Sparkles className="w-4 h-4" />
            Bulk Caption
          </button>

          {/* Export button */}
          <button
            onClick={() => setShowExportModal(true)}
            // Enable export button even if models aren't ready (we can warn inside modal)
            // Just require system status to be loaded
            disabled={!systemStatus}
            className="btn-primary py-2 px-4 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export to AI Toolkit"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Image Grid */}
      <div className="flex-1 overflow-hidden">
        <ImageGrid
          images={dataset.images}
          selectedImage={selectedImage}
          onSelectImage={handleSelectImage}
          selectedIds={selectedIds}
          onToggleSelect={toggleImageSelection}
          selectionMode={selectionMode}
        />
      </div>

      {/* Caption Editor */}
      {selectedImage && (
        <CaptionEditor
          image={selectedImage}
          datasetId={dataset.id}
          onClose={handleCloseEditor}
          onUpdate={handleUpdateImage}
          onNavigate={handleNavigate}
          hasPrev={hasPrev}
          hasNext={hasNext}
        />
      )}

      {/* Bulk Caption Modal */}
      {showBulkModal && (
        <BulkCaptionModal
          datasetId={dataset.id}
          selectedIds={Array.from(selectedIds)}
          totalUncaptioned={uncaptionedCount}
          totalImages={dataset.images.length}
          onClose={() => setShowBulkModal(false)}
          onComplete={() => {
            setShowBulkModal(false);
            fetchDataset();
          }}
        />
      )}

      {/* Caption Settings Modal */}
      <CaptionSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={(settings) => {
          setCaptionSettings(settings);
          console.log('Caption settings saved:', settings);
        }}
      />

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => !exporting && setShowExportModal(false)}
          />
          <div className="relative w-full max-w-md bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-border)]">
              <h2
                className="text-lg font-semibold flex items-center gap-2"
                style={{ fontFamily: 'var(--font-outfit)' }}
              >
                <FolderOpen className="w-5 h-5 text-[var(--color-accent-purple)]" />
                Export Dataset
              </h2>
            </div>
            <div className="p-4 space-y-4">
              {/* Export Mode Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                  Export Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setExportMode('zip')}
                    className={`p-4 rounded-lg border transition-all text-left ${
                      exportMode === 'zip'
                        ? 'border-[var(--color-accent-purple)] bg-[var(--color-accent-purple)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
                    }`}
                  >
                    <Download className="w-5 h-5 text-[var(--color-accent-purple)] mb-2" />
                    <p className="font-medium text-sm mb-1">Download ZIP</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Save to your computer
                    </p>
                  </button>
                  <button
                    onClick={() => setExportMode('aitoolkit')}
                    className={`p-4 rounded-lg border transition-all text-left ${
                      exportMode === 'aitoolkit'
                        ? 'border-[var(--color-accent-orange)] bg-[var(--color-accent-orange)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
                    }`}
                  >
                    <FolderOpen className="w-5 h-5 text-[var(--color-accent-orange)] mb-2" />
                    <p className="font-medium text-sm mb-1">AI Toolkit</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Send to training folder
                    </p>
                  </button>
                </div>
              </div>

              {/* Model Selection for AI Toolkit Export */}
              {exportMode === 'aitoolkit' && (
                <div className="space-y-3">
                  <ModelSelector
                    modelType="base_model"
                    value={selectedBaseModel}
                    onChange={(modelId) => setSelectedBaseModel(modelId)}
                    label="Base Model for Training"
                    placeholder="Select a base model..."
                  />
                  <p className="text-xs text-[var(--color-text-muted)]">
                    This determines which model will be used for LoRA training. If no model is selected, you'll need to configure it manually in AI Toolkit.
                  </p>
                </div>
              )}

              {/* Mode-specific info */}
              {exportMode === 'aitoolkit' && (
                systemStatus?.dev_mode ? (
                  <div className="p-3 rounded-lg bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/30">
                    <p className="text-sm font-medium text-[var(--color-accent-purple)] mb-1">
                      🔧 Development Mode
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mb-2">
                      Export to: <code className="font-mono text-[var(--color-accent-purple)]">./data/exports/{dataset?.name}/1_dataset/</code>
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Images and .txt caption files will be saved here for testing
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                    <p className="text-sm font-medium text-green-400 mb-1">
                      🚀 Production Mode (RunPod)
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mb-2">
                      Export to: <code className="font-mono text-green-400">/workspace/ai-toolkit/datasets/{dataset?.name}/1_dataset/</code>
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Ready for AI Toolkit training
                    </p>
                  </div>
                )
              )}

              {exportMode === 'zip' && (
                <div className="p-3 rounded-lg bg-[var(--color-accent-purple)]/10 border border-[var(--color-accent-purple)]/30">
                  <p className="text-sm font-medium text-[var(--color-accent-purple)] mb-1">
                    📦 Download Package
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Downloads a ZIP file with AI Toolkit folder structure:<br />
                    <code className="font-mono">1_dataset/image.jpg + image.txt</code>
                  </p>
                </div>
              )}

              {/* Optional custom path - only for AI Toolkit mode */}
              {exportMode === 'aitoolkit' && (
                <details className="group">
                  <summary className="text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-accent-purple)] transition-colors">
                    Advanced: Custom Output Path
                  </summary>
                  <div className="mt-3">
                    <input
                      type="text"
                      value={exportPath}
                      onChange={(e) => setExportPath(e.target.value)}
                      placeholder={systemStatus?.dev_mode ? 'C:\\custom\\path' : '/custom/path'}
                      className="input-field"
                    />
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      Leave empty to use default location. A subfolder `1_dataset` will be created.
                    </p>
                  </div>
                </details>
              )}

              {uncaptionedCount > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-accent-orange)]/10 border border-[var(--color-accent-orange)]/30">
                  <AlertTriangle className="w-4 h-4 text-[var(--color-accent-orange)]" />
                  <span className="text-sm text-[var(--color-accent-orange)]">
                    {uncaptionedCount} images have no caption
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--color-border)]">
              <button
                onClick={() => setShowExportModal(false)}
                className="btn-secondary"
                disabled={exporting}
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="btn-primary flex items-center gap-2"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {exportMode === 'zip' ? 'Creating ZIP...' : 'Exporting...'}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    {exportMode === 'zip' ? 'Download ZIP' : 'Export to AI Toolkit'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Images Modal */}
      {showAddModal && dataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative w-full max-w-md bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-border)]">
              <h2
                className="text-lg font-semibold flex items-center gap-2"
                style={{ fontFamily: 'var(--font-outfit)' }}
              >
                <Plus className="w-5 h-5 text-[var(--color-accent-purple)]" />
                Add Images to Dataset
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-[var(--color-text-muted)]">
                Upload a ZIP file containing images to add to <strong className="text-white">{dataset.name}</strong>
              </p>
              <label className="block cursor-pointer">
                <div className="p-8 border-2 border-dashed border-[var(--color-border)] rounded-xl hover:border-[var(--color-accent-purple)] transition-colors text-center">
                  <Upload className="w-10 h-10 text-[var(--color-accent-purple)] mx-auto mb-3" />
                  <p className="text-sm font-medium text-white mb-1">Click to select ZIP file</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Images (.jpg, .jpeg, .png, .webp) with optional .txt captions
                  </p>
                </div>
                <input
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('datasetId', dataset.id);

                    try {
                      const response = await fetch('/api/images/add', {
                        method: 'POST',
                        body: formData,
                      });

                      const result = await response.json();

                      if (!response.ok) {
                        throw new Error(result.error || 'Failed to add images');
                      }

                      alert(result.message + (result.skippedCount > 0 ? `\n${result.skippedCount} duplicate(s) skipped` : ''));
                      setShowAddModal(false);
                      fetchDataset();
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Failed to add images');
                    }
                    
                    // Reset input
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--color-border)]">
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Conflict Dialog */}
      {showConflictDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-border)]">
              <h2
                className="text-lg font-semibold flex items-center gap-2"
                style={{ fontFamily: 'var(--font-outfit)' }}
              >
                <AlertTriangle className="w-5 h-5 text-[var(--color-accent-orange)]" />
                Folder Already Exists
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                A dataset folder named <strong className="text-white">{conflictFolderName}</strong> already exists in AI Toolkit.
              </p>
              <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)]/50">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  <strong>Update Existing:</strong> Replaces all files in {conflictFolderName}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  <strong>Create New:</strong> Creates next available folder (2_{dataset?.name.replace(/[^a-zA-Z0-9-_]/g, '_')}, etc.)
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 p-4 border-t border-[var(--color-border)]">
              <button
                onClick={() => handleExportWithOverwrite(true)}
                disabled={exporting}
                className="btn-secondary flex items-center justify-center gap-2 bg-[var(--color-accent-orange)]/10 border-[var(--color-accent-orange)]/30 hover:bg-[var(--color-accent-orange)]/20"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Update {conflictFolderName}
                  </>
                )}
              </button>
              <button
                onClick={() => handleExportWithOverwrite(false)}
                disabled={exporting}
                className="btn-primary flex items-center justify-center gap-2"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create New Folder
                  </>
                )}
              </button>
              <button
                onClick={() => setShowConflictDialog(false)}
                disabled={exporting}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Background decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 -left-32 w-64 h-64 bg-[var(--color-accent-purple)]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 -right-32 w-64 h-64 bg-[var(--color-accent-orange)]/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
}

export default function CaptionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-73px)] flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-[var(--color-accent-purple)]" />
        </div>
      }
    >
      <CaptionPageContent />
    </Suspense>
  );
}



