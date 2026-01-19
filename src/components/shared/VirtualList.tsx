/**
 * VirtualList Component
 * Efficient rendering of large lists with virtualization
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((index: number, item: T) => number);
  containerHeight: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  scrollToIndex?: number;
  emptyMessage?: React.ReactNode;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

interface VirtualItem {
  index: number;
  start: number;
  size: number;
}

export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
  onScroll,
  scrollToIndex,
  emptyMessage = 'No items',
  loadingMore = false,
  onLoadMore,
  hasMore = false,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate item sizes
  const getItemSize = useCallback(
    (index: number): number => {
      if (typeof itemHeight === 'function') {
        return itemHeight(index, items[index]);
      }
      return itemHeight;
    },
    [itemHeight, items]
  );

  // Calculate total height and item positions
  const { totalHeight, itemPositions } = useMemo(() => {
    const positions: number[] = [];
    let total = 0;

    for (let i = 0; i < items.length; i++) {
      positions.push(total);
      total += getItemSize(i);
    }

    return { totalHeight: total, itemPositions: positions };
  }, [items.length, getItemSize]);

  // Find visible items
  const visibleItems = useMemo((): VirtualItem[] => {
    if (items.length === 0) return [];

    // Binary search for start index
    let startIndex = 0;
    let low = 0;
    let high = items.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (itemPositions[mid] <= scrollTop) {
        startIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    startIndex = Math.max(0, startIndex - overscan);

    // Find end index
    let endIndex = startIndex;
    let currentHeight = itemPositions[startIndex];

    while (
      endIndex < items.length &&
      currentHeight < scrollTop + containerHeight
    ) {
      currentHeight += getItemSize(endIndex);
      endIndex++;
    }

    endIndex = Math.min(items.length - 1, endIndex + overscan);

    // Build visible items array
    const visible: VirtualItem[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      visible.push({
        index: i,
        start: itemPositions[i],
        size: getItemSize(i),
      });
    }

    return visible;
  }, [items.length, itemPositions, scrollTop, containerHeight, overscan, getItemSize]);

  // Handle scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = e.currentTarget.scrollTop;
      setScrollTop(newScrollTop);
      onScroll?.(newScrollTop);

      // Check if we need to load more
      if (
        hasMore &&
        !loadingMore &&
        onLoadMore &&
        newScrollTop + containerHeight >= totalHeight - 200
      ) {
        onLoadMore();
      }
    },
    [onScroll, hasMore, loadingMore, onLoadMore, containerHeight, totalHeight]
  );

  // Scroll to index
  useEffect(() => {
    if (scrollToIndex !== undefined && containerRef.current && itemPositions[scrollToIndex] !== undefined) {
      containerRef.current.scrollTop = itemPositions[scrollToIndex];
    }
  }, [scrollToIndex, itemPositions]);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore || loadingMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      { root: containerRef.current, rootMargin: '200px' }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, onLoadMore, loadingMore]);

  if (items.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-gray-500 ${className}`}
        style={{ height: containerHeight }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ index, start, size }) => (
          <div key={index} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            {renderItem(items[index], index, {
              position: 'absolute',
              top: start,
              left: 0,
              right: 0,
              height: size,
            })}
          </div>
        ))}

        {/* Load more sentinel */}
        {hasMore && (
          <div
            ref={sentinelRef}
            style={{
              position: 'absolute',
              bottom: 0,
              height: 1,
              width: '100%',
            }}
          />
        )}

        {/* Loading indicator */}
        {loadingMore && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <i className="fa fa-spinner fa-spin text-gray-400" />
            <span className="ml-2 text-gray-400 text-sm">Loading more...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Simple Virtual List (Fixed Height)
// ============================================

interface SimpleVirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
}

export function SimpleVirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = '',
}: SimpleVirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const endIndex = Math.min(items.length - 1, startIndex + visibleCount + overscan * 2);

  const visibleItems: { index: number; top: number }[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visibleItems.push({ index: i, top: i * itemHeight });
  }

  return (
    <div
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ index, top }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top,
              left: 0,
              right: 0,
              height: itemHeight,
            }}
          >
            {renderItem(items[index], index)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Windowed Grid
// ============================================

interface VirtualGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  gap?: number;
  className?: string;
}

export function VirtualGrid<T>({
  items,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  renderItem,
  gap = 8,
  className = '',
}: VirtualGridProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const columnsCount = Math.max(1, Math.floor((containerWidth + gap) / (itemWidth + gap)));
  const rowsCount = Math.ceil(items.length / columnsCount);
  const totalHeight = rowsCount * (itemHeight + gap) - gap;

  const startRow = Math.max(0, Math.floor(scrollTop / (itemHeight + gap)) - 1);
  const visibleRows = Math.ceil(containerHeight / (itemHeight + gap)) + 2;
  const endRow = Math.min(rowsCount - 1, startRow + visibleRows);

  const visibleItems: { index: number; row: number; col: number }[] = [];
  for (let row = startRow; row <= endRow; row++) {
    for (let col = 0; col < columnsCount; col++) {
      const index = row * columnsCount + col;
      if (index < items.length) {
        visibleItems.push({ index, row, col });
      }
    }
  }

  return (
    <div
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ index, row, col }) => {
          const style: React.CSSProperties = {
            position: 'absolute',
            top: row * (itemHeight + gap),
            left: col * (itemWidth + gap),
            width: itemWidth,
            height: itemHeight,
          };

          return (
            <div key={index} style={style}>
              {renderItem(items[index], index, style)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualList;
