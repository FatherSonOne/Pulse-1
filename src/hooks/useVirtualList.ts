// useVirtualList.ts - Simple virtualization hook for long lists
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface UseVirtualListOptions<T> {
  items: T[];
  itemHeight: number; // Fixed height per item
  containerHeight: number;
  overscan?: number; // Extra items to render above/below visible area
}

interface VirtualListResult<T> {
  virtualItems: { item: T; index: number; style: React.CSSProperties }[];
  totalHeight: number;
  containerRef: React.RefObject<HTMLDivElement>;
  scrollTo: (index: number) => void;
}

export function useVirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3,
}: UseVirtualListOptions<T>): VirtualListResult<T> {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Handle scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate visible range
  const { startIndex, endIndex } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(items.length - 1, start + visibleCount + overscan * 2);

    return { startIndex: start, endIndex: end };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  // Generate virtual items with positioning
  const virtualItems = useMemo(() => {
    const result = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (items[i]) {
        result.push({
          item: items[i],
          index: i,
          style: {
            position: 'absolute' as const,
            top: i * itemHeight,
            left: 0,
            right: 0,
            height: itemHeight,
          },
        });
      }
    }
    return result;
  }, [items, startIndex, endIndex, itemHeight]);

  // Total height for scroll
  const totalHeight = items.length * itemHeight;

  // Scroll to specific index
  const scrollTo = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollTop = index * itemHeight;
  }, [itemHeight]);

  return {
    virtualItems,
    totalHeight,
    containerRef,
    scrollTo,
  };
}

export default useVirtualList;
