/**
 * ToolsPanel Component
 * Main container for the reorganized tools panel with 4 categories
 */

import React, { useState, useMemo, useEffect } from 'react';
import { ToolCategory } from './types';
import { TOOLS, getToolsByCategory, searchTools } from './toolsData';
import { useToolsStorage } from './useToolsStorage';
import { CategoryTabs } from './CategoryTabs';
import { SearchBox } from './SearchBox';
import { ToolCard } from './ToolCard';
import { ContextualSuggestions } from './ContextualSuggestions';
import { QuickAccessBar, MobileQuickAccessBar } from './QuickAccessBar';

interface ToolsPanelProps {
  onToolSelect: (toolId: string) => void;
  onClose?: () => void;
  isMobile?: boolean;
  className?: string;
}

export const ToolsPanel: React.FC<ToolsPanelProps> = ({
  onToolSelect,
  onClose,
  isMobile = false,
  className = ''
}) => {
  // State
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobilePanel, setShowMobilePanel] = useState(false);

  // Storage hooks
  const {
    trackToolUsage,
    togglePinTool,
    getRecentTools,
    getPinnedTools,
    isToolPinned,
    getToolStats,
    usageStats
  } = useToolsStorage();

  // Get tools to display
  const displayedTools = useMemo(() => {
    if (searchQuery.trim()) {
      return searchTools(searchQuery);
    }
    return getToolsByCategory(activeCategory);
  }, [activeCategory, searchQuery]);

  // Get recent and pinned tools
  const recentToolIds = getRecentTools();
  const pinnedToolIds = getPinnedTools();
  const recentTools = TOOLS.filter(t => recentToolIds.includes(t.id));
  const quickAccessTools = [...pinnedToolIds, ...recentToolIds]
    .filter((id, index, arr) => arr.indexOf(id) === index) // unique
    .slice(0, 3)
    .map(id => TOOLS.find(t => t.id === id))
    .filter(Boolean) as typeof TOOLS;

  // Count tools per category
  const toolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    TOOLS.forEach(tool => {
      counts[tool.category] = (counts[tool.category] || 0) + 1;
    });
    return counts;
  }, []);

  // Handle tool selection
  const handleToolSelect = (toolId: string) => {
    trackToolUsage(toolId);
    onToolSelect(toolId);
    if (isMobile) {
      setShowMobilePanel(false);
    }
  };

  // Handle category change
  const handleCategoryChange = (category: ToolCategory | 'all') => {
    setActiveCategory(category);
    setSearchQuery(''); // Clear search when changing category
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + 1/2/3/4 for category shortcuts
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const categoryMap: Record<string, ToolCategory | 'all'> = {
          '1': 'all',
          '2': 'ai',
          '3': 'content',
          '4': 'analysis',
          '5': 'utilities'
        };
        const category = categoryMap[e.key];
        if (category) {
          e.preventDefault();
          setActiveCategory(category);
        }
      }

      // Escape to close
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Mobile bottom sheet
  if (isMobile) {
    return (
      <>
        {/* Mobile Bottom Sheet */}
        <div
          className={`
            fixed inset-x-0 bottom-0
            h-[70vh] rounded-t-3xl
            bg-white dark:bg-zinc-900
            border-t border-zinc-200 dark:border-zinc-800
            shadow-2xl
            transform transition-transform duration-300 ease-out
            z-[400]
            ${showMobilePanel ? 'translate-y-0' : 'translate-y-full'}
            ${className}
          `}
          role="dialog"
          aria-label="Tools panel"
        >
          {/* Drag Handle */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full"></div>

          {/* Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Tools
              </h2>
              <button
                onClick={() => setShowMobilePanel(false)}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Close tools panel"
              >
                <i className="fa-solid fa-times text-zinc-600 dark:text-zinc-400"></i>
              </button>
            </div>

            {/* Search */}
            <SearchBox
              value={searchQuery}
              onChange={setSearchQuery}
              resultsCount={displayedTools.length}
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Category Tabs */}
            {!searchQuery && (
              <CategoryTabs
                activeCategory={activeCategory}
                onCategoryChange={handleCategoryChange}
                toolCounts={toolCounts}
              />
            )}

            {/* Contextual Suggestions */}
            {!searchQuery && activeCategory === 'all' && (
              <ContextualSuggestions
                allTools={TOOLS}
                recentTools={recentToolIds}
                onToolSelect={handleToolSelect}
              />
            )}

            {/* Tool Grid */}
            <div className="grid grid-cols-2 gap-3">
              {displayedTools.map(tool => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  isPinned={isToolPinned(tool.id)}
                  usageCount={getToolStats(tool.id)?.usageCount}
                  onSelect={handleToolSelect}
                  onPin={togglePinTool}
                />
              ))}
            </div>

            {/* Empty State */}
            {displayedTools.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <i className="fa-solid fa-magnifying-glass text-4xl text-zinc-300 dark:text-zinc-700 mb-4"></i>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No tools found matching "{searchQuery}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Quick Access */}
        <MobileQuickAccessBar
          tools={quickAccessTools}
          onToolSelect={handleToolSelect}
        />

        {/* Backdrop */}
        {showMobilePanel && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300]"
            onClick={() => setShowMobilePanel(false)}
          />
        )}
      </>
    );
  }

  // Desktop Layout
  return (
    <div
      className={`
        w-80 h-full flex flex-col
        bg-white dark:bg-zinc-900
        border-l border-zinc-200 dark:border-zinc-800
        ${className}
      `}
      role="complementary"
      aria-label="Tools panel"
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-wrench text-purple-500"></i>
            Tools
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              aria-label="Close tools panel"
            >
              <i className="fa-solid fa-times text-zinc-600 dark:text-zinc-400"></i>
            </button>
          )}
        </div>

        {/* Search */}
        <SearchBox
          value={searchQuery}
          onChange={setSearchQuery}
          resultsCount={displayedTools.length}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Category Tabs */}
        {!searchQuery && (
          <CategoryTabs
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
            toolCounts={toolCounts}
          />
        )}

        {/* Contextual Suggestions */}
        {!searchQuery && activeCategory === 'all' && (
          <ContextualSuggestions
            allTools={TOOLS}
            recentTools={recentToolIds}
            onToolSelect={handleToolSelect}
          />
        )}

        {/* Tool Grid */}
        <div
          className="grid grid-cols-1 gap-3"
          role="tabpanel"
          id={`tabpanel-${activeCategory}`}
          aria-labelledby={`tab-${activeCategory}`}
        >
          {displayedTools.map(tool => (
            <ToolCard
              key={tool.id}
              tool={tool}
              isPinned={isToolPinned(tool.id)}
              usageCount={getToolStats(tool.id)?.usageCount}
              onSelect={handleToolSelect}
              onPin={togglePinTool}
            />
          ))}
        </div>

        {/* Empty State */}
        {displayedTools.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <i className="fa-solid fa-magnifying-glass text-4xl text-zinc-300 dark:text-zinc-700 mb-4"></i>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
              No tools found
            </p>
            {searchQuery && (
              <p className="text-xs text-zinc-400">
                Try a different search term
              </p>
            )}
          </div>
        )}
      </div>

      {/* Desktop Quick Access Bar */}
      <QuickAccessBar
        tools={quickAccessTools}
        onToolSelect={handleToolSelect}
      />
    </div>
  );
};
