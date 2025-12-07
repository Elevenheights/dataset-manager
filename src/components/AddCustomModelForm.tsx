'use client';

import { useState } from 'react';
import { Link, Upload, Loader2 } from 'lucide-react';

type SourceType = 'huggingface' | 'civitai' | 'direct_url' | 'local_upload';

interface AddCustomModelFormProps {
  onSuccess?: () => void;
}

export default function AddCustomModelForm({ onSuccess }: AddCustomModelFormProps) {
  const [sourceType, setSourceType] = useState<SourceType>('huggingface');
  const [name, setName] = useState('');
  const [type, setType] = useState('base_model');
  const [description, setDescription] = useState('');
  const [huggingfaceRepo, setHuggingfaceRepo] = useState('');
  const [huggingfaceFiles, setHuggingfaceFiles] = useState('');
  const [huggingfaceToken, setHuggingfaceToken] = useState('');
  const [civitaiUrl, setCivitaiUrl] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (sourceType === 'local_upload') {
        // Handle file upload
        if (!file) {
          setError('Please select a file');
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);
        formData.append('type', type);
        formData.append('tags', tags);

        const response = await fetch('/api/models/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!data.success) {
          setError(data.error || 'Upload failed');
          setLoading(false);
          return;
        }

        setSuccess('Model uploaded successfully!');
      } else {
        // Handle custom model addition
        const payload: any = {
          name,
          type,
          description,
          sourceType,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        };

        if (sourceType === 'huggingface') {
          payload.huggingfaceRepo = huggingfaceRepo;
          payload.huggingfaceFiles = huggingfaceFiles.split(',').map(f => f.trim()).filter(Boolean);
          if (huggingfaceToken) {
            payload.huggingfaceToken = huggingfaceToken;
          }
        } else if (sourceType === 'civitai') {
          payload.civitaiUrl = civitaiUrl;
        } else if (sourceType === 'direct_url') {
          payload.sourceUrl = directUrl;
        }

        const response = await fetch('/api/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!data.success) {
          setError(data.error || 'Failed to add model');
          setLoading(false);
          return;
        }

        setSuccess('Custom model added successfully!');
      }

      // Reset form
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <div className="space-y-6">
        {/* Source Type Tabs */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Source Type
          </label>
          <div className="flex gap-2">
            {[
              { value: 'huggingface', label: 'Hugging Face' },
              { value: 'civitai', label: 'CivitAI' },
              { value: 'direct_url', label: 'Direct URL' },
              { value: 'local_upload', label: 'Upload File' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSourceType(option.value as SourceType)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  sourceType === option.value
                    ? 'bg-[var(--color-accent-purple)] text-white'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Model Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent-purple)] focus:border-transparent"
              placeholder="My Custom Model"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Model Type *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent-purple)] focus:border-transparent"
            >
              <option value="base_model">Base Model</option>
              <option value="lora">LoRA</option>
              <option value="vae">VAE</option>
              <option value="adapter">Adapter</option>
              <option value="text_encoder">Text Encoder</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent-purple)] focus:border-transparent"
            placeholder="Optional description..."
          />
        </div>

        {/* Source-Specific Fields */}
        {sourceType === 'huggingface' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Hugging Face Repository *
              </label>
              <input
                type="text"
                value={huggingfaceRepo}
                onChange={(e) => setHuggingfaceRepo(e.target.value)}
                required
                className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent-purple)] focus:border-transparent"
                placeholder="username/model-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Files to Download (comma-separated)
              </label>
              <input
                type="text"
                value={huggingfaceFiles}
                onChange={(e) => setHuggingfaceFiles(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent-purple)] focus:border-transparent"
                placeholder="model.safetensors, config.json"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Hugging Face Token (optional, for gated models)
              </label>
              <input
                type="password"
                value={huggingfaceToken}
                onChange={(e) => setHuggingfaceToken(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent-purple)] focus:border-transparent"
                placeholder="hf_..."
              />
            </div>
          </div>
        )}

        {sourceType === 'civitai' && (
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              CivitAI URL *
            </label>
            <input
              type="url"
              value={civitaiUrl}
              onChange={(e) => setCivitaiUrl(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent-purple)] focus:border-transparent"
              placeholder="https://civitai.com/models/..."
            />
          </div>
        )}

        {sourceType === 'direct_url' && (
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Direct Download URL *
            </label>
            <input
              type="url"
              value={directUrl}
              onChange={(e) => setDirectUrl(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent-purple)] focus:border-transparent"
              placeholder="https://example.com/model.safetensors"
            />
          </div>
        )}

        {sourceType === 'local_upload' && (
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Select Model File *
            </label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
              accept=".safetensors,.gguf,.ckpt,.pth,.bin"
              className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent-purple)] focus:border-transparent"
            />
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-accent-purple)] focus:border-transparent"
            placeholder="custom, fine-tune, style"
          />
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-3 bg-[var(--color-accent-red)]/10 border border-[var(--color-accent-red)]/30 rounded-md text-sm text-[var(--color-accent-red)]">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-[var(--color-accent-green)]/10 border border-[var(--color-accent-green)]/30 rounded-md text-sm text-[var(--color-accent-green)]">
            {success}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {sourceType === 'local_upload' ? 'Uploading...' : 'Adding...'}
            </>
          ) : (
            <>
              {sourceType === 'local_upload' ? <Upload className="w-5 h-5" /> : <Link className="w-5 h-5" />}
              {sourceType === 'local_upload' ? 'Upload Model' : 'Add Model'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

