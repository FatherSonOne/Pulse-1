/**
 * ToolsPanel Type Definitions
 * Contains all TypeScript interfaces and types for the reorganized Tools panel
 */

export type ToolCategory = 'ai' | 'content' | 'analysis' | 'utilities';

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: ToolCategory;
  keywords?: string[];
  isNew?: boolean;
  isPro?: boolean;
  requiresApiKey?: boolean;
  apiKeyName?: string;
}

export interface ToolUsageStats {
  toolId: string;
  usageCount: number;
  lastUsed: number; // timestamp
}

export interface ToolsPanelState {
  activeCategory: ToolCategory | 'all';
  searchQuery: string;
  recentTools: string[]; // tool IDs
  pinnedTools: string[]; // tool IDs
  usageStats: Record<string, ToolUsageStats>;
}

export interface CategoryConfig {
  id: ToolCategory;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export interface ContextualSuggestion {
  toolId: string;
  reason: string;
  priority: number;
}
