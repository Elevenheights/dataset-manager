'use client';

import { useState, useEffect } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';

interface CaptionSettings {
  customPrompt: string;
  prefix: string;
  suffix: string;
  replaceWords: string;
  replaceCaseInsensitive: boolean;
  replaceWholeWordsOnly: boolean;
  temperature: number;
  topK: number;
  topP: number;
  repetitionPenalty: number;
}

const DEFAULT_SETTINGS: CaptionSettings = {
  customPrompt: '',
  prefix: '',
  suffix: '',
  replaceWords: '',
  replaceCaseInsensitive: true,
  replaceWholeWordsOnly: true,
  temperature: 0.7,
  topK: 50,
  topP: 0.95,
  repetitionPenalty: 1.05,
};

interface CaptionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: CaptionSettings) => void;
}

export default function CaptionSettingsModal({
  isOpen,
  onClose,
  onSave,
}: CaptionSettingsModalProps) {
  const [settings, setSettings] = useState<CaptionSettings>(DEFAULT_SETTINGS);
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<string[]>([]);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('captionSettings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }

    // Load saved template names
    const templates = localStorage.getItem('captionTemplates');
    if (templates) {
      setSavedTemplates(Object.keys(JSON.parse(templates)));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('captionSettings', JSON.stringify(settings));
    onSave(settings);
    onClose();
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem('captionSettings', JSON.stringify(DEFAULT_SETTINGS));
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    const templates = JSON.parse(localStorage.getItem('captionTemplates') || '{}');
    templates[templateName] = settings;
    localStorage.setItem('captionTemplates', JSON.stringify(templates));
    setSavedTemplates(Object.keys(templates));
    setTemplateName('');
    alert(`Template "${templateName}" saved!`);
  };

  const handleLoadTemplate = (name: string) => {
    const templates = JSON.parse(localStorage.getItem('captionTemplates') || '{}');
    if (templates[name]) {
      setSettings(templates[name]);
    }
  };

  const handleDeleteTemplate = (name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;

    const templates = JSON.parse(localStorage.getItem('captionTemplates') || '{}');
    delete templates[name];
    localStorage.setItem('captionTemplates', JSON.stringify(templates));
    setSavedTemplates(Object.keys(templates));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-bg-primary)] rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-[var(--color-border)]">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Caption Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-[var(--color-text-primary)]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Custom Prompt */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Custom Prompt
            </label>
            <p className="text-sm text-[var(--color-text-muted)] mb-2">
              Override the default prompt. Leave empty to use default.
            </p>
            <textarea
              value={settings.customPrompt}
              onChange={(e) =>
                setSettings({ ...settings, customPrompt: e.target.value })
              }
              className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md focus:ring-2 focus:ring-[var(--color-accent-blue)] focus:border-transparent text-[var(--color-text-primary)]"
              rows={4}
              placeholder="Describe this image in detail..."
            />
          </div>

          {/* Prefix and Suffix */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Caption Prefix
              </label>
              <input
                type="text"
                value={settings.prefix}
                onChange={(e) =>
                  setSettings({ ...settings, prefix: e.target.value })
                }
                className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md focus:ring-2 focus:ring-[var(--color-accent-blue)] focus:border-transparent text-[var(--color-text-primary)]"
                placeholder="e.g., 'A photo of '"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Caption Suffix
              </label>
              <input
                type="text"
                value={settings.suffix}
                onChange={(e) =>
                  setSettings({ ...settings, suffix: e.target.value })
                }
                className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md focus:ring-2 focus:ring-[var(--color-accent-blue)] focus:border-transparent text-[var(--color-text-primary)]"
                placeholder="e.g., ', high quality'"
              />
            </div>
          </div>

          {/* Word Replacement */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Word Replacement
            </label>
            <p className="text-sm text-[var(--color-text-muted)] mb-2">
              Replace words in captions. Format: one pair per line as{' '}
              <code className="bg-[var(--color-bg-tertiary)] px-1 rounded text-[var(--color-text-primary)]">original;replacement</code>
            </p>
            <textarea
              value={settings.replaceWords}
              onChange={(e) =>
                setSettings({ ...settings, replaceWords: e.target.value })
              }
              className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md focus:ring-2 focus:ring-[var(--color-accent-blue)] focus:border-transparent font-mono text-sm text-[var(--color-text-primary)]"
              rows={5}
              placeholder="man;ohwx man&#10;woman;ohwx woman&#10;person;ohwx person"
            />
            <div className="mt-2 space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.replaceCaseInsensitive}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      replaceCaseInsensitive: e.target.checked,
                    })
                  }
                  className="mr-2"
                />
                <span className="text-sm text-[var(--color-text-primary)]">
                  Case insensitive (match Man, man, MAN)
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.replaceWholeWordsOnly}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      replaceWholeWordsOnly: e.target.checked,
                    })
                  }
                  className="mr-2"
                />
                <span className="text-sm text-[var(--color-text-primary)]">
                  Replace whole words only (prevent partial matches)
                </span>
              </label>
            </div>
          </div>

          {/* Generation Parameters */}
          <div className="border-t border-[var(--color-border)] pt-6">
            <h3 className="text-lg font-semibold mb-4 text-[var(--color-text-primary)]">Generation Parameters</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  Temperature: {settings.temperature}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={settings.temperature}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      temperature: parseFloat(e.target.value),
                    })
                  }
                  className="w-full"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  0.1 = focused, 1.0 = creative
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  Top K: {settings.topK}
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={settings.topK}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      topK: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Higher = more diverse vocabulary
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  Top P: {settings.topP}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={settings.topP}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      topP: parseFloat(e.target.value),
                    })
                  }
                  className="w-full"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Cumulative probability threshold
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  Repetition Penalty: {settings.repetitionPenalty}
                </label>
                <input
                  type="range"
                  min="1.0"
                  max="2.0"
                  step="0.05"
                  value={settings.repetitionPenalty}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      repetitionPenalty: parseFloat(e.target.value),
                    })
                  }
                  className="w-full"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Higher = less repetition
                </p>
              </div>
            </div>
          </div>

          {/* Template Management */}
          <div className="border-t border-[var(--color-border)] pt-6">
            <h3 className="text-lg font-semibold mb-4 text-[var(--color-text-primary)]">Templates</h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name..."
                className="flex-1 px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md focus:ring-2 focus:ring-[var(--color-accent-blue)] focus:border-transparent text-[var(--color-text-primary)]"
              />
              <button
                onClick={handleSaveTemplate}
                className="px-4 py-2 bg-[var(--color-accent-green)] text-white rounded-md hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Template
              </button>
            </div>

            {savedTemplates.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-[var(--color-text-muted)]">Saved Templates:</p>
                <div className="grid grid-cols-2 gap-2">
                  {savedTemplates.map((name) => (
                    <div
                      key={name}
                      className="flex items-center justify-between bg-[var(--color-bg-secondary)] px-3 py-2 rounded border border-[var(--color-border)]"
                    >
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{name}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleLoadTemplate(name)}
                          className="text-xs text-[var(--color-accent-blue)] hover:opacity-80"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(name)}
                          className="text-xs text-[var(--color-accent-red)] hover:opacity-80"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[var(--color-bg-primary)] border-t border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-bg-secondary)] transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn-secondary px-6 py-2"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn-primary px-6 py-2 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export hook to get current settings
export function useCaptionSettings(): CaptionSettings {
  const [settings, setSettings] = useState<CaptionSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const saved = localStorage.getItem('captionSettings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  return settings;
}

