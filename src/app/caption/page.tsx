'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ImageGrid from '@/components/ImageGrid';
import CaptionEditor from '@/components/CaptionEditor';
import BulkCaptionModal from '@/components/BulkCaptionModal';
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
  Trash2,
  Plus,
  Upload,
} from 'lucide-react';

interface SystemStatus {
  ready: boolean;
  dev_mode: boolean;
  caption_service: {
    available: boolean;
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
        caption_service: { available: false, error: 'Could not check status' },
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

  useEffect(() => {
    fetchDataset();
    fetchSystemStatus();
  }, [fetchDataset, fetchSystemStatus]);

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
        // Check if AI Toolkit models are ready (production only)
        if (!exportReady && !systemStatus?.dev_mode) {
          alert('AI Toolkit models are not ready yet. Please wait for downloads to complete.');
          return;
        }

        const response = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            datasetId: dataset.id,
            outputPath: exportPath.trim() || undefined, // Optional - uses default if empty
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Export failed');
        }

        const message = result.mode === 'development'
          ? `${result.message}\n\nExported to: ${result.outputPath}`
          : result.message;
        
        alert(message);
        setShowExportModal(false);
        setExportPath(''); // Reset for next export
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
        <div className="text-center max-w-md">
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
          <button onClick={() => router.push('/')} className="btn-primary">
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

  const captionReady = systemStatus?.caption_service.available ?? false;
  const exportReady = systemStatus?.ready ?? false;

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col">
      {/* System Status Banner */}
      {systemStatus && !systemStatus.ready && (
        <div className="px-6 py-3 bg-[var(--color-accent-orange)]/10 border-b border-[var(--color-accent-orange)]/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[var(--color-accent-orange)] mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--color-accent-orange)] mb-1">
                System Not Ready
              </p>
              <ul className="text-xs text-[var(--color-accent-orange)]/80 space-y-1">
                {systemStatus.messages.filter(m => m.includes('⚠️')).map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
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
            disabled={!exportReady && !systemStatus?.dev_mode}
            className="btn-primary py-2 px-4 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              systemStatus?.dev_mode 
                ? 'Export to local folder' 
                : (!exportReady ? 'AI Toolkit models not ready' : 'Export to AI Toolkit')
            }
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
          onClose={() => setShowBulkModal(false)}
          onComplete={() => {
            setShowBulkModal(false);
            fetchDataset();
          }}
        />
      )}

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



