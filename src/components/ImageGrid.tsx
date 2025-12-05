'use client';

import { useState, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DatasetImage } from '@/types';
import { Search, CheckCircle2, Circle, Filter } from 'lucide-react';

interface ImageGridProps {
  images: DatasetImage[];
  selectedImage: DatasetImage | null;
  onSelectImage: (image: DatasetImage) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (imageId: string) => void;
  selectionMode?: boolean;
}

export default function ImageGrid({
  images,
  selectedImage,
  onSelectImage,
  selectedIds = new Set(),
  onToggleSelect,
  selectionMode = false,
}: ImageGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'captioned' | 'uncaptioned'>('all');
  const [parentRef, setParentRef] = useState<HTMLDivElement | null>(null);

  // Filter and search images
  const filteredImages = useMemo(() => {
    return images.filter((image) => {
      // Apply filter
      if (filter === 'captioned' && !image.hasCaption) return false;
      if (filter === 'uncaptioned' && image.hasCaption) return false;

      // Apply search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          image.filename.toLowerCase().includes(query) ||
          image.caption.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [images, filter, searchQuery]);

  // Calculate grid dimensions
  const ITEM_SIZE = 220; // thumbnail size + padding (approximately 8 per row on 1920px screen)
  const GAP = 16;
  const containerWidth = parentRef?.clientWidth || 800;
  const columns = Math.max(1, Math.floor((containerWidth + GAP) / (ITEM_SIZE + GAP)));
  const rowCount = Math.ceil(filteredImages.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef,
    estimateSize: () => ITEM_SIZE + GAP,
    overscan: 3,
  });

  const handleImageClick = useCallback((image: DatasetImage, e: React.MouseEvent) => {
    if (selectionMode && onToggleSelect) {
      e.preventDefault();
      onToggleSelect(image.id);
    } else {
      onSelectImage(image);
    }
  }, [selectionMode, onToggleSelect, onSelectImage]);

  return (
    <div className="flex flex-col h-full">
      {/* Search and Filter Bar */}
      <div className="flex items-center gap-4 p-4 border-b border-[var(--color-border)]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by filename or caption..."
            className="input-field pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="input-field py-2 px-3 w-auto"
          >
            <option value="all">All ({images.length})</option>
            <option value="captioned">
              Captioned ({images.filter((i) => i.hasCaption).length})
            </option>
            <option value="uncaptioned">
              Uncaptioned ({images.filter((i) => !i.hasCaption).length})
            </option>
          </select>
        </div>

        <div className="text-sm text-[var(--color-text-muted)]">
          {filteredImages.length} images
          {selectionMode && selectedIds.size > 0 && (
            <span className="ml-2 text-[var(--color-accent-purple)]">
              ({selectedIds.size} selected)
            </span>
          )}
        </div>
      </div>

      {/* Virtual Grid */}
      <div
        ref={setParentRef}
        className="flex-1 overflow-auto p-4"
        style={{ contain: 'strict' }}
      >
        {filteredImages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-[var(--color-text-muted)]" />
              </div>
              <p className="text-[var(--color-text-muted)]">
                {searchQuery || filter !== 'all'
                  ? 'No images match your search'
                  : 'No images in dataset'}
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const startIndex = virtualRow.index * columns;
              const rowImages = filteredImages.slice(startIndex, startIndex + columns);

              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="flex gap-4 flex-wrap">
                    {rowImages.map((image) => (
                      <div
                        key={image.id}
                        onClick={(e) => handleImageClick(image, e)}
                        className={`
                          image-item relative cursor-pointer rounded-xl overflow-hidden
                          ${selectedImage?.id === image.id ? 'ring-2 ring-[var(--color-accent-purple)] glow-purple' : ''}
                          ${selectedIds.has(image.id) ? 'ring-2 ring-[var(--color-accent-orange)]' : ''}
                        `}
                        style={{ width: ITEM_SIZE, height: ITEM_SIZE }}
                      >
                        {/* Thumbnail */}
                        <img
                          src={image.thumbnailUrl}
                          alt={image.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />

                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                        {/* Caption indicator */}
                        <div
                          className={`caption-indicator ${
                            image.hasCaption ? 'has-caption' : 'no-caption'
                          }`}
                          title={image.hasCaption ? 'Has caption' : 'No caption'}
                        />

                        {/* Selection checkbox */}
                        {selectionMode && (
                          <div className="absolute top-2 left-2">
                            {selectedIds.has(image.id) ? (
                              <CheckCircle2 className="w-6 h-6 text-[var(--color-accent-orange)]" />
                            ) : (
                              <Circle className="w-6 h-6 text-white/50" />
                            )}
                          </div>
                        )}

                        {/* Filename */}
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-xs text-white truncate">
                            {image.filename}
                          </p>
                          {image.hasCaption && (
                            <p className="text-xs text-white/60 truncate">
                              {image.caption.substring(0, 50)}...
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}



