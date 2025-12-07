'use client';

import { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  Plus, 
  Search, 
  Filter,
  HardDrive,
  Loader2,
} from 'lucide-react';
import ModelCard from '@/components/ModelCard';
import ModelDownloadProgress from '@/components/ModelDownloadProgress';
import AddCustomModelForm from '@/components/AddCustomModelForm';

interface ModelWithStatus {
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
}

interface InstalledModel {
  id: string;
  name: string;
  family: string;
  type: string;
  totalSize: number;
  installedDate: string;
  files: Array<{ filename: string; size: number }>;
  isDefault?: boolean;
}

type TabType = 'available' | 'installed' | 'add-custom';

export default function ModelsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('available');
  const [availableModels, setAvailableModels] = useState<ModelWithStatus[]>([]);
  const [installedModels, setInstalledModels] = useState<InstalledModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [totalDiskUsage, setTotalDiskUsage] = useState(0);

  // Fetch available models
  const fetchAvailableModels = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedFamily !== 'all') params.set('family', selectedFamily);
      if (selectedType !== 'all') params.set('type', selectedType);
      
      const response = await fetch(`/api/models?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setAvailableModels(data.models);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  // Fetch installed models
  const fetchInstalledModels = async () => {
    try {
      const response = await fetch('/api/models/installed');
      const data = await response.json();
      
      if (data.success) {
        setInstalledModels(data.models);
        setTotalDiskUsage(data.totalDiskUsage);
      }
    } catch (error) {
      console.error('Error fetching installed models:', error);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchAvailableModels(), fetchInstalledModels()]);
      setLoading(false);
    };
    
    loadData();
  }, [searchQuery, selectedFamily, selectedType]);
  
  // Separate polling effect - only refresh when on the page
  useEffect(() => {
    // Poll for updates every 30 seconds to check for download completion
    // Only when on the models tab
    const pollInterval = setInterval(async () => {
      await fetchInstalledModels();
      if (activeTab === 'available') {
        await fetchAvailableModels(); // Update button states
      }
    }, 30000); // Reduced frequency to 30s
    
    return () => clearInterval(pollInterval);
  }, [activeTab]); // Only depend on activeTab, not search params

  // Format bytes to human-readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-lg bg-gradient-to-br from-[var(--color-accent-purple)]/20 to-[var(--color-accent-blue)]/20 border border-[var(--color-border)]">
              <Database className="w-6 h-6 text-[var(--color-accent-purple-light)]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
                Model Manager
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                Download and manage AI models for training
              </p>
            </div>
          </div>
          
          {/* AI Toolkit Auto-Download Notice */}
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-200">
              💡 <strong>Using AI Toolkit for training?</strong> You generally don't need to pre-download models here. 
              AI Toolkit will automatically download the models specified in your training config. 
              This Model Manager is useful for:
            </p>
            <ul className="mt-2 text-sm text-blue-200/80 space-y-1 ml-6 list-disc">
              <li>Pre-downloading models to save time when training starts</li>
              <li>Managing custom or fine-tuned models</li>
              <li>Viewing what models AI Toolkit has already downloaded</li>
              <li>Removing old models to free up disk space</li>
            </ul>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[var(--color-border)]">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'available'
                ? 'border-[var(--color-accent-purple)] text-[var(--color-accent-purple-light)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            Available Models
            <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] text-xs">
              {availableModels.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('installed')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'installed'
                ? 'border-[var(--color-accent-purple)] text-[var(--color-accent-purple-light)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            Installed Models
            <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] text-xs">
              {installedModels.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('add-custom')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'add-custom'
                ? 'border-[var(--color-accent-purple)] text-[var(--color-accent-purple-light)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            <Plus className="w-4 h-4 inline-block mr-1" />
            Add Custom
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent-purple)]" />
          </div>
        )}

        {/* Available Models Tab */}
        {!loading && activeTab === 'available' && (
          <div>
            {/* Filters */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-accent-purple)] focus:border-transparent"
                />
              </div>
              <select
                value={selectedFamily}
                onChange={(e) => setSelectedFamily(e.target.value)}
                className="px-4 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent-purple)] focus:border-transparent"
              >
                <option value="all">All Families</option>
                <option value="zimage">Z-Image</option>
                <option value="qwen">Qwen</option>
                <option value="flux">Flux</option>
                <option value="sdxl">SDXL</option>
                <option value="custom">Custom</option>
              </select>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent-purple)] focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="base_model">Base Models</option>
                <option value="lora">LoRAs</option>
                <option value="vae">VAEs</option>
                <option value="adapter">Adapters</option>
                <option value="text_encoder">Text Encoders</option>
              </select>
            </div>

            {/* Model Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableModels.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  onDownloadComplete={fetchInstalledModels}
                />
              ))}
            </div>

            {availableModels.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[var(--color-text-muted)]">No models found</p>
              </div>
            )}
          </div>
        )}

        {/* Installed Models Tab */}
        {!loading && activeTab === 'installed' && (
          <div>
            {/* Disk Usage Summary */}
            <div className="mb-6 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HardDrive className="w-5 h-5 text-[var(--color-accent-blue)]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      Total Disk Usage
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {installedModels.length} model{installedModels.length !== 1 ? 's' : ''} installed
                    </p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-[var(--color-accent-purple-light)]">
                  {formatBytes(totalDiskUsage)}
                </p>
              </div>
            </div>

            {/* Installed Models List */}
            <div className="space-y-3">
              {installedModels.map((model) => (
                <div
                  key={model.id}
                  className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent-purple)]/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                          {model.name}
                        </h3>
                        {model.isDefault && (
                          <span className="px-2 py-0.5 text-xs bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)] rounded-full border border-[var(--color-accent-green)]/30">
                            Default
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] rounded-full border border-[var(--color-border)]">
                          {model.family}
                        </span>
                        <span className="px-2 py-0.5 text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] rounded-full border border-[var(--color-border)]">
                          {model.type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                        <span>{formatBytes(model.totalSize)}</span>
                        <span>•</span>
                        <span>{model.files.length} file{model.files.length !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span>Installed {new Date(model.installedDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm(`Remove ${model.name}?`)) {
                          await fetch(`/api/models/installed?id=${model.id}`, { method: 'DELETE' });
                          fetchInstalledModels();
                        }
                      }}
                      className="px-3 py-1.5 text-sm text-[var(--color-accent-red)] hover:bg-[var(--color-accent-red)]/10 rounded-md transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {installedModels.length === 0 && (
              <div className="text-center py-12">
                <Database className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-muted)] opacity-50" />
                <p className="text-[var(--color-text-muted)] mb-2">No models installed yet</p>
                <button
                  onClick={() => setActiveTab('available')}
                  className="btn-primary text-sm"
                >
                  Browse Available Models
                </button>
              </div>
            )}
          </div>
        )}

        {/* Add Custom Model Tab */}
        {!loading && activeTab === 'add-custom' && (
          <div>
            <AddCustomModelForm
              onSuccess={() => {
                fetchAvailableModels();
                setActiveTab('available');
              }}
            />
          </div>
        )}

        {/* Download Progress (Global) */}
        <ModelDownloadProgress />
      </div>
    </div>
  );
}

