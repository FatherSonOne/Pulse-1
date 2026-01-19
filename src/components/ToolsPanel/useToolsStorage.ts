/**
 * Custom Hook: useToolsStorage
 * Manages tool usage statistics and user preferences in localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import { ToolUsageStats } from './types';

const STORAGE_KEY = 'pulse-tools-data';
const MAX_RECENT_TOOLS = 3;

interface StorageData {
  recentTools: string[];
  pinnedTools: string[];
  usageStats: Record<string, ToolUsageStats>;
}

const getDefaultData = (): StorageData => ({
  recentTools: [],
  pinnedTools: [],
  usageStats: {}
});

/**
 * Load data from localStorage
 */
function loadFromStorage(): StorageData {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load tools data from localStorage:', error);
  }
  return getDefaultData();
}

/**
 * Save data to localStorage
 */
function saveToStorage(data: StorageData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save tools data to localStorage:', error);
  }
}

export function useToolsStorage() {
  const [storageData, setStorageData] = useState<StorageData>(loadFromStorage);

  // Save to localStorage whenever data changes
  useEffect(() => {
    saveToStorage(storageData);
  }, [storageData]);

  /**
   * Track tool usage
   */
  const trackToolUsage = useCallback((toolId: string) => {
    setStorageData(prevData => {
      const now = Date.now();

      // Update usage stats
      const currentStats = prevData.usageStats[toolId] || {
        toolId,
        usageCount: 0,
        lastUsed: now
      };

      const updatedStats = {
        ...prevData.usageStats,
        [toolId]: {
          ...currentStats,
          usageCount: currentStats.usageCount + 1,
          lastUsed: now
        }
      };

      // Update recent tools (keep last 3, most recent first)
      const recentTools = [
        toolId,
        ...prevData.recentTools.filter(id => id !== toolId)
      ].slice(0, MAX_RECENT_TOOLS);

      return {
        ...prevData,
        recentTools,
        usageStats: updatedStats
      };
    });
  }, []);

  /**
   * Toggle tool pin status
   */
  const togglePinTool = useCallback((toolId: string) => {
    setStorageData(prevData => {
      const isPinned = prevData.pinnedTools.includes(toolId);
      const pinnedTools = isPinned
        ? prevData.pinnedTools.filter(id => id !== toolId)
        : [...prevData.pinnedTools, toolId];

      return {
        ...prevData,
        pinnedTools
      };
    });
  }, []);

  /**
   * Get most used tools
   */
  const getMostUsedTools = useCallback((limit: number = 5): string[] => {
    return Object.values(storageData.usageStats)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit)
      .map(stat => stat.toolId);
  }, [storageData.usageStats]);

  /**
   * Get recent tools
   */
  const getRecentTools = useCallback((): string[] => {
    return storageData.recentTools;
  }, [storageData.recentTools]);

  /**
   * Get pinned tools
   */
  const getPinnedTools = useCallback((): string[] => {
    return storageData.pinnedTools;
  }, [storageData.pinnedTools]);

  /**
   * Check if tool is pinned
   */
  const isToolPinned = useCallback((toolId: string): boolean => {
    return storageData.pinnedTools.includes(toolId);
  }, [storageData.pinnedTools]);

  /**
   * Get usage stats for a specific tool
   */
  const getToolStats = useCallback((toolId: string): ToolUsageStats | null => {
    return storageData.usageStats[toolId] || null;
  }, [storageData.usageStats]);

  /**
   * Clear all usage data
   */
  const clearAllData = useCallback(() => {
    setStorageData(getDefaultData());
  }, []);

  return {
    trackToolUsage,
    togglePinTool,
    getMostUsedTools,
    getRecentTools,
    getPinnedTools,
    isToolPinned,
    getToolStats,
    clearAllData,
    usageStats: storageData.usageStats
  };
}
