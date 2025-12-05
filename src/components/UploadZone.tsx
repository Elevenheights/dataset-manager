'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileArchive, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { UploadProgress } from '@/types';

interface UploadZoneProps {
  onUploadComplete: (datasetId: string) => void;
}

export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const [datasetName, setDatasetName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const uploadFile = async (file: File) => {
    if (!datasetName.trim()) {
      setProgress({
        status: 'error',
        progress: 0,
        message: 'Please enter a dataset name first',
      });
      return;
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setProgress({
        status: 'error',
        progress: 0,
        message: 'Please upload a ZIP file',
      });
      return;
    }

    setProgress({
      status: 'uploading',
      progress: 10,
      message: 'Uploading ZIP file...',
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', datasetName.trim());

    try {
      setProgress({
        status: 'extracting',
        progress: 40,
        message: 'Extracting and processing images...',
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setProgress({
        status: 'complete',
        progress: 100,
        message: result.message,
        totalFiles: result.dataset.totalImages,
      });

      // Delay before redirect
      setTimeout(() => {
        onUploadComplete(result.dataset.id);
      }, 1500);
    } catch (error) {
      setProgress({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'uploading':
      case 'extracting':
      case 'processing':
        return <Loader2 className="w-10 h-10 animate-spin text-purple-400" />;
      case 'complete':
        return <CheckCircle className="w-10 h-10 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-10 h-10 text-orange-400" />;
      default:
        return <FileArchive className="w-10 h-10 text-gray-500" />;
    }
  };

  const isProcessing = progress.status !== 'idle' && progress.status !== 'error';

  return (
    <div className="space-y-5 w-full">
      {/* Dataset Name Input */}
      <div className="w-full">
        <label 
          className="block text-sm font-medium mb-3"
          style={{ color: '#a1a1aa' }}
        >
          Dataset Name <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          value={datasetName}
          onChange={(e) => setDatasetName(e.target.value)}
          placeholder="My LoRA Dataset"
          disabled={isProcessing}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'rgba(17, 12, 25, 0.8)',
            border: '1px solid rgba(147, 51, 234, 0.3)',
            borderRadius: '8px',
            color: '#f4f4f5',
            fontSize: '15px',
            outline: 'none',
            transition: 'all 0.2s ease',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'rgba(147, 51, 234, 0.6)';
            e.target.style.boxShadow = '0 0 0 3px rgba(147, 51, 234, 0.15)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(147, 51, 234, 0.3)';
            e.target.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Upload Zone */}
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="w-full py-10 px-5 sm:py-12 sm:px-8"
        style={{
          position: 'relative',
          borderRadius: '12px',
          textAlign: 'center',
          cursor: isProcessing ? 'default' : 'pointer',
          opacity: isProcessing ? 0.8 : 1,
          pointerEvents: isProcessing ? 'none' : 'auto',
          background: isDragging 
            ? 'rgba(147, 51, 234, 0.1)' 
            : 'linear-gradient(145deg, rgba(17, 12, 25, 0.9) 0%, rgba(10, 6, 18, 0.9) 100%)',
          border: isDragging 
            ? '2px dashed rgba(147, 51, 234, 0.8)' 
            : '2px dashed rgba(147, 51, 234, 0.4)',
          transition: 'all 0.3s ease',
          transform: isDragging ? 'scale(1.02)' : 'scale(1)',
          boxShadow: isDragging 
            ? '0 8px 40px rgba(147, 51, 234, 0.2)' 
            : '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".zip"
          style={{ display: 'none' }}
        />

        <div className="flex flex-col items-center justify-center gap-5 w-full">
          {progress.status === 'idle' ? (
            <>
              {/* Upload Icon */}
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    padding: '3px',
                    background: 'linear-gradient(135deg, #9333ea 0%, #ff6b35 100%)',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: '#0f0a18',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Upload className="w-10 h-10 text-purple-400" />
                  </div>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    inset: '-20px',
                    borderRadius: '50%',
                    background: 'rgba(147, 51, 234, 0.15)',
                    filter: 'blur(30px)',
                    zIndex: -1,
                  }}
                />
              </div>

              {/* Text */}
              <div className="w-full">
                <h3 
                  className="text-2xl sm:text-3xl font-semibold mb-3"
                  style={{ fontFamily: 'var(--font-outfit)', color: '#f4f4f5' }}
                >
                  Drop your ZIP file here
                </h3>
                <p className="text-base sm:text-lg" style={{ color: '#71717a' }}>
                  or click to browse
                </p>
              </div>

              {/* Accepted Formats */}
              <div
                className="w-full max-w-full sm:max-w-[360px]"
                style={{
                  marginTop: '4px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(39, 39, 42, 0.5)',
                  border: '1px solid rgba(63, 63, 70, 0.5)',
                  textAlign: 'left',
                }}
              >
                <p style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 500, marginBottom: '8px' }}>
                  Accepted formats:
                </p>
                <ul style={{ fontSize: '12px', color: '#71717a' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a855f7' }} />
                    ZIP containing images (.jpg, .jpeg, .png, .webp)
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff6b35' }} />
                    Optional: .txt files with same name as images
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* Status Icon */}
              <div
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  background: 'rgba(39, 39, 42, 0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {getStatusIcon()}
              </div>

              {/* Status Text */}
              <div className="w-full">
                <h3 
                  className="text-2xl sm:text-3xl font-semibold mb-3"
                  style={{ fontFamily: 'var(--font-outfit)', color: '#f4f4f5' }}
                >
                  {progress.status === 'complete' ? 'Upload Complete!' : 
                   progress.status === 'error' ? 'Upload Failed' : 'Processing...'}
                </h3>
                <p className="text-base sm:text-lg" style={{ color: '#a1a1aa' }}>
                  {progress.message}
                </p>
              </div>

              {/* Progress Bar */}
              {(progress.status === 'uploading' || progress.status === 'extracting' || progress.status === 'processing') && (
                <div className="w-full max-w-full sm:max-w-[320px]" style={{ marginTop: '12px' }}>
                  <div
                    style={{
                      height: '8px',
                      background: 'rgba(39, 39, 42, 0.8)',
                      borderRadius: '9999px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${progress.progress}%`,
                        background: 'linear-gradient(90deg, #9333ea 0%, #ff6b35 100%)',
                        transition: 'width 0.5s ease',
                        borderRadius: '9999px',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Retry Button */}
              {progress.status === 'error' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setProgress({ status: 'idle', progress: 0, message: '' });
                  }}
                  style={{
                    marginTop: '8px',
                    padding: '10px 24px',
                    borderRadius: '10px',
                    background: 'rgba(39, 39, 42, 0.8)',
                    border: '1px solid rgba(63, 63, 70, 0.8)',
                    color: '#d4d4d8',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(63, 63, 70, 0.8)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(39, 39, 42, 0.8)';
                  }}
                >
                  Try Again
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
