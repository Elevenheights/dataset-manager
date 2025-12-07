'use client';

import { useState, useEffect } from 'react';
import { FolderOpen, Plus, Trash2, ChevronDown, Image as ImageIcon, FileText } from 'lucide-react';

interface Dataset {
  id: string;
  name: string;
  path: string;
  imageCount: number;
  captionCount: number;
  createdAt: string;
  modifiedAt: string;
}

interface DatasetSelectorProps {
  currentDataset: string; // Dataset ID
  onDatasetChange: (datasetId: string) => void;
}

export default function DatasetSelector({ currentDataset, onDatasetChange }: DatasetSelectorProps) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch datasets
  const fetchDatasets = async () => {
    try {
      const response = await fetch('/api/datasets/list');
      const data = await response.json();
      
      if (data.success) {
        setDatasets(data.datasets);
        
        // If no current dataset but datasets exist, auto-select first one
        if (!currentDataset && data.datasets.length > 0) {
          onDatasetChange(data.datasets[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching datasets:', error);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  // Create new dataset
  const handleCreateDataset = async () => {
    if (!newDatasetName.trim()) {
      setError('Please enter a dataset name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/datasets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDatasetName }),
      });

      const data = await response.json();

      if (data.success) {
        setDatasets([data.dataset, ...datasets]);
        setNewDatasetName('');
        setShowCreateModal(false);
        onDatasetChange(data.dataset.id);
      } else {
        setError(data.error || 'Failed to create dataset');
      }
    } catch (error) {
      setError('Failed to create dataset');
    } finally {
      setLoading(false);
    }
  };

  // Delete dataset
  const handleDeleteDataset = async (datasetId: string, datasetName: string) => {
    if (!confirm(`Are you sure you want to delete "${datasetName}"? This will permanently delete all images and captions.`)) {
      return;
    }

    try {
      const response = await fetch('/api/datasets/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId }),
      });

      const data = await response.json();

      if (data.success) {
        setDatasets(datasets.filter(d => d.id !== datasetId));
        
        // If deleted current dataset
        if (datasetId === currentDataset) {
          const remaining = datasets.filter(d => d.id !== datasetId);
          if (remaining.length > 0) {
            // Switch to first available
            onDatasetChange(remaining[0].id);
          } else {
            // No datasets left - clear selection
            onDatasetChange('');
          }
        }
      } else {
        alert(`Failed to delete dataset: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to delete dataset');
    }
  };

  const currentDatasetInfo = datasets.find(d => d.id === currentDataset);

  return (
    <div className="relative">
      {/* Current Dataset Display / Dropdown Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-br from-[var(--color-accent-purple)]/20 to-[var(--color-accent-purple)]/10 rounded-xl border border-[var(--color-accent-purple)]/30 hover:border-[var(--color-accent-purple)]/50 transition-all"
      >
        <FolderOpen className="w-5 h-5 text-[var(--color-accent-purple)]" />
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-white">
            {currentDatasetInfo?.name || 'No Dataset Selected'}
          </div>
          {currentDatasetInfo && (
            <div className="flex items-center gap-3 text-xs text-white/60 mt-0.5">
              <span className="flex items-center gap-1">
                <ImageIcon className="w-3 h-3" />
                {currentDatasetInfo.imageCount}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {currentDatasetInfo.captionCount}
              </span>
            </div>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-white/60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[100]" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div className="absolute top-full left-0 mt-2 w-80 bg-[var(--color-bg-secondary)] border border-white/10 rounded-xl shadow-2xl z-[101] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Datasets</h3>
              <button
                onClick={() => {
                  setShowCreateModal(true);
                  setIsOpen(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-accent-orange)]/20 hover:bg-[var(--color-accent-orange)]/30 text-[var(--color-accent-orange)] text-xs font-medium rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            </div>

            {/* Dataset List */}
            <div className="max-h-96 overflow-y-auto">
              {datasets.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-white/50">
                  No datasets yet. Create one to get started!
                </div>
              ) : (
                datasets.map(dataset => (
                  <div
                    key={dataset.id}
                    className={`px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0 ${
                      dataset.id === currentDataset ? 'bg-[var(--color-accent-purple)]/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => {
                          onDatasetChange(dataset.id);
                          setIsOpen(false);
                        }}
                        className="flex-1 text-left"
                      >
                        <div className="text-sm font-medium text-white mb-1">
                          {dataset.name}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/60">
                          <span className="flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            {dataset.imageCount} images
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {dataset.captionCount} captions
                          </span>
                        </div>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDataset(dataset.id, dataset.name);
                        }}
                        className="p-1.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded transition-colors"
                        title="Delete dataset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Create Dataset Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--color-bg-secondary)] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-4">Create New Dataset</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/80 mb-2">
                Dataset Name
              </label>
              <input
                type="text"
                value={newDatasetName}
                onChange={(e) => setNewDatasetName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateDataset()}
                placeholder="e.g., character-portraits"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-accent-purple)]/50 transition-colors"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-400">{error}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewDatasetName('');
                  setError(null);
                }}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDataset}
                disabled={loading || !newDatasetName.trim()}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[var(--color-accent-purple)] to-[var(--color-accent-orange)] hover:opacity-90 text-white font-medium rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

