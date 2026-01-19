/**
 * ToolsPanel Module Exports
 * Centralized exports for all ToolsPanel components and utilities
 */

// Main component
export { ToolsPanel } from './ToolsPanel';

// Sub-components
export { CategoryTabs } from './CategoryTabs';
export { SearchBox } from './SearchBox';
export { ToolCard } from './ToolCard';
export { ContextualSuggestions } from './ContextualSuggestions';
export { QuickAccessBar, MobileQuickAccessBar } from './QuickAccessBar';

// Hooks
export { useToolsStorage } from './useToolsStorage';

// Data and utilities
export { TOOLS, CATEGORIES, getToolsByCategory, getToolById, searchTools, getCategoryColor } from './toolsData';

// Types
export type { Tool, ToolCategory, ToolUsageStats, ToolsPanelState, CategoryConfig, ContextualSuggestion } from './types';
