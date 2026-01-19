// useVoxSelection Hook - Multi-select state management for Vox messages
// Enables batch operations like download and archive across all Vox modes

import { useState, useCallback, useMemo } from 'react';

export interface VoxSelectionItem {
  id: string;
  type: 'audio' | 'video';
  url: string;
  duration: number;
  timestamp: Date;
  senderId?: string;
  senderName?: string;
  transcript?: string;
  mode: 'quick_vox' | 'voice_threads' | 'team_vox' | 'vox_notes' | 'pulse_radio' | 'vox_drop' | 'video_vox' | 'classic';
}

export interface UseVoxSelectionReturn {
  // State
  selectedIds: Set<string>;
  selectedItems: VoxSelectionItem[];
  isSelectionMode: boolean;
  selectionCount: number;

  // Actions
  toggleSelection: (item: VoxSelectionItem) => void;
  selectAll: (items: VoxSelectionItem[]) => void;
  deselectAll: () => void;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  isSelected: (id: string) => boolean;

  // Batch operations
  getSelectedForDownload: () => VoxSelectionItem[];
  getSelectedForArchive: () => VoxSelectionItem[];
  getTotalDuration: () => number;
}

export function useVoxSelection(): UseVoxSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedItemsMap, setSelectedItemsMap] = useState<Map<string, VoxSelectionItem>>(new Map());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Toggle selection for a single item
  const toggleSelection = useCallback((item: VoxSelectionItem) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item.id)) {
        newSet.delete(item.id);
        setSelectedItemsMap(prevMap => {
          const newMap = new Map(prevMap);
          newMap.delete(item.id);
          return newMap;
        });
      } else {
        newSet.add(item.id);
        setSelectedItemsMap(prevMap => {
          const newMap = new Map(prevMap);
          newMap.set(item.id, item);
          return newMap;
        });
      }
      return newSet;
    });
  }, []);

  // Select all items
  const selectAll = useCallback((items: VoxSelectionItem[]) => {
    const ids = new Set(items.map(item => item.id));
    const itemsMap = new Map(items.map(item => [item.id, item]));
    setSelectedIds(ids);
    setSelectedItemsMap(itemsMap);
  }, []);

  // Deselect all items
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setSelectedItemsMap(new Map());
  }, []);

  // Enter selection mode (typically triggered by long press)
  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  // Exit selection mode and clear selection
  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
    setSelectedItemsMap(new Map());
  }, []);

  // Check if an item is selected
  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  // Get selected items as array
  const selectedItems = useMemo(() => {
    return Array.from(selectedItemsMap.values());
  }, [selectedItemsMap]);

  // Get selection count
  const selectionCount = useMemo(() => {
    return selectedIds.size;
  }, [selectedIds]);

  // Get selected items for download
  const getSelectedForDownload = useCallback(() => {
    return selectedItems.filter(item => item.url);
  }, [selectedItems]);

  // Get selected items for archive
  const getSelectedForArchive = useCallback(() => {
    return selectedItems;
  }, [selectedItems]);

  // Get total duration of selected items
  const getTotalDuration = useCallback(() => {
    return selectedItems.reduce((total, item) => total + (item.duration || 0), 0);
  }, [selectedItems]);

  return {
    selectedIds,
    selectedItems,
    isSelectionMode,
    selectionCount,
    toggleSelection,
    selectAll,
    deselectAll,
    enterSelectionMode,
    exitSelectionMode,
    isSelected,
    getSelectedForDownload,
    getSelectedForArchive,
    getTotalDuration,
  };
}

export default useVoxSelection;
