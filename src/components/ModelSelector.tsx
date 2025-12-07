'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';

interface InstalledModel {
  id: string;
  name: string;
  family: string;
  type: string;
  totalSize: number;
}

interface ModelSelectorProps {
  modelType?: string; // Filter by type, e.g., 'base_model'
  modelFamily?: string; // Filter by family, e.g., 'flux'
  value?: string; // Selected model ID
  onChange?: (modelId: string, model: InstalledModel) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
}

export default function ModelSelector({
  modelType,
  modelFamily,
  value,
  onChange,
  label = 'Select Model',
  required = false,
  placeholder = 'Choose a model...',
}: ModelSelectorProps) {
  const [models, setModels] = useState<InstalledModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams();
        if (modelType) params.set('type', modelType);
        if (modelFamily) params.set('family', modelFamily);

        const response = await fetch(`/api/models/installed?${params}`);
        const data = await response.json();

        if (data.success) {
          setModels(data.models);
        } else {
          setError(data.error || 'Failed to load models');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load models');
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [modelType, modelFamily]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = e.target.value;
    const selectedModel = models.find(m => m.id === modelId);

    if (selectedModel && onChange) {
      onChange(modelId, selectedModel);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
        {label}
        {required && <span className="text-[var(--color-accent-red)]">*</span>}
      </label>

      {loading ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-muted)]" />
          <span className="text-sm text-[var(--color-text-muted)]">Loading models...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-accent-red)]/10 border border-[var(--color-accent-red)]/30 rounded-md">
          <AlertCircle className="w-4 h-4 text-[var(--color-accent-red)]" />
          <span className="text-sm text-[var(--color-accent-red)]">{error}</span>
        </div>
      ) : models.length === 0 ? (
        <div className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md">
          <p className="text-sm text-[var(--color-text-muted)]">
            No models installed.{' '}
            <a href="/models" className="text-[var(--color-accent-blue)] hover:underline">
              Install models
            </a>
          </p>
        </div>
      ) : (
        <select
          value={value}
          onChange={handleChange}
          required={required}
          className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent-purple)] focus:border-transparent"
        >
          <option value="">{placeholder}</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} ({formatBytes(model.totalSize)}) - {model.family}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

