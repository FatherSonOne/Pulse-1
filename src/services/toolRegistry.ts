/**
 * Tool Registry Service - Enhanced tool discovery with fuzzy search
 * Integrates existing tools from toolsData with command palette
 */

import { TOOLS, CATEGORIES } from '../components/ToolsPanel/toolsData';
import type { Tool } from '../components/ToolsPanel/types';

export interface ToolAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  keywords: string[];
  shortcut?: string;
  requiresApiKey?: boolean;
  apiKeyName?: string;
  isPro?: boolean;
  onLaunch: () => void;
}

// Map tool categories to keyboard shortcuts
const TOOL_SHORTCUTS: Record<string, string> = {
  'deep-reasoner': 'Ctrl+Shift+R',
  'video-analyst': 'Ctrl+Shift+V',
  'code-studio': 'Ctrl+Shift+C',
  'vision-lab': 'Ctrl+Shift+I',
  'deep-search': 'Ctrl+Shift+S',
  'meeting-intel': 'Ctrl+Shift+M',
  'video-studio': 'Ctrl+Shift+U',
  'voice-studio': 'Ctrl+Shift+O',
  'route-planner': 'Ctrl+Shift+P',
  'ai-assistant': 'Ctrl+Shift+A',
};

/**
 * Map tool IDs to ToolOverlay categories for keyboard shortcut launching
 * This enables tools to be opened directly in their corresponding overlay
 */
export const TOOL_OVERLAY_MAP: Record<string, 'analytics' | 'collaboration' | 'productivity' | 'intelligence' | 'proactive' | 'communication' | 'personalization' | 'security' | 'mediaHub'> = {
  // AI Tools → Intelligence overlay
  'deep-reasoner': 'intelligence',
  'ai-coach': 'intelligence',
  'ai-mediator': 'intelligence',
  'conversation-intelligence': 'intelligence',
  'brainstorm-assistant': 'intelligence',
  'ai-assistant': 'intelligence',

  // Content Creation → varies by tool type
  'code-studio': 'productivity',
  'smart-compose': 'productivity',
  'templates': 'productivity',
  'quick-phrases': 'productivity',
  'scheduled-messages': 'productivity',
  'draft-manager': 'productivity',

  // Media Tools → Media Hub
  'vision-lab': 'mediaHub',
  'video-studio': 'mediaHub',
  'voice-studio': 'mediaHub',
  'voice-recorder': 'mediaHub',
  'file-attachments': 'mediaHub',

  // Analysis Tools → Analytics overlay
  'video-analyst': 'analytics',
  'sentiment-analysis': 'analytics',
  'engagement-scoring': 'analytics',
  'response-time-tracker': 'analytics',
  'conversation-flow': 'analytics',
  'sentiment-timeline': 'analytics',
  'analytics-export': 'analytics',
  'message-impact': 'analytics',

  // Meeting/Research → Analytics/Intelligence
  'meeting-intel': 'analytics',
  'deep-search': 'intelligence',

  // Communication Tools → Communication overlay
  'translation': 'communication',
  'emoji-reactions': 'communication',
  'voice-context': 'communication',

  // Collaboration Tools → Collaboration overlay
  'search-filter': 'collaboration',
  'message-pinning': 'collaboration',
  'thread-linking': 'collaboration',
  'knowledge-base': 'collaboration',
  'read-receipts': 'collaboration',

  // Utilities
  'keyboard-shortcuts': 'personalization',
  'message-formatting': 'personalization',
  'settings': 'personalization',
  'backup-sync': 'personalization',
  'route-planner': 'mediaHub',
};

/**
 * Get the ToolOverlay category for a given tool ID
 * Returns null if tool doesn't map to an overlay
 */
export function getToolOverlayType(toolId: string): 'analytics' | 'collaboration' | 'productivity' | 'intelligence' | 'proactive' | 'communication' | 'personalization' | 'security' | 'mediaHub' | null {
  return TOOL_OVERLAY_MAP[toolId] || null;
}

/**
 * Convert Tool from toolsData to ToolAction for command palette
 */
export function toolToAction(tool: Tool, onLaunch: (toolId: string) => void): ToolAction {
  return {
    id: tool.id,
    name: tool.name,
    description: tool.description,
    icon: tool.icon,
    color: getCategoryColor(tool.category),
    category: tool.category,
    keywords: tool.keywords || [],
    shortcut: TOOL_SHORTCUTS[tool.id],
    requiresApiKey: tool.requiresApiKey,
    apiKeyName: tool.apiKeyName,
    isPro: tool.isPro,
    onLaunch: () => onLaunch(tool.id),
  };
}

/**
 * Get all tools as actions
 */
export function getAllToolActions(onLaunch: (toolId: string) => void): ToolAction[] {
  return TOOLS.map(tool => toolToAction(tool, onLaunch));
}

/**
 * Get category color for consistent theming
 */
function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    ai: '#f43f5e', // rose-500 (BRAND COLOR)
    content: '#ec4899', // pink-500
    analysis: '#fb7185', // rose-400
    utilities: '#be123c', // rose-700
  };
  return colorMap[category] || '#f43f5e';
}

/**
 * Fuzzy search implementation using Levenshtein-like algorithm
 * Allows for typos and partial matches
 */
export function fuzzyScore(query: string, text: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // Exact match scores highest
  if (lowerText === lowerQuery) return 1000;

  // Starts with query scores very high
  if (lowerText.startsWith(lowerQuery)) return 900;

  // Contains query scores high
  if (lowerText.includes(lowerQuery)) return 800;

  // Fuzzy match using character-by-character comparison
  let score = 0;
  let queryIndex = 0;
  let textIndex = 0;
  let consecutiveMatches = 0;

  while (queryIndex < lowerQuery.length && textIndex < lowerText.length) {
    if (lowerQuery[queryIndex] === lowerText[textIndex]) {
      score += 1 + consecutiveMatches * 5; // Bonus for consecutive matches
      consecutiveMatches++;
      queryIndex++;
    } else {
      consecutiveMatches = 0;
    }
    textIndex++;
  }

  // Penalize if not all characters matched
  if (queryIndex < lowerQuery.length) {
    score = score * 0.5;
  }

  // Bonus for matching at word boundaries
  const words = lowerText.split(/[\s-_]/);
  for (const word of words) {
    if (word.startsWith(lowerQuery)) {
      score += 50;
    }
  }

  return score;
}

/**
 * Fuzzy search tools by query
 * Returns tools sorted by relevance score
 */
export function fuzzySearchTools(
  query: string,
  tools: ToolAction[],
  limit: number = 20
): ToolAction[] {
  if (!query.trim()) return tools.slice(0, limit);

  const scored = tools.map(tool => {
    // Calculate scores for different fields
    const nameScore = fuzzyScore(query, tool.name) * 3; // Name is most important
    const descriptionScore = fuzzyScore(query, tool.description);
    const keywordScore = Math.max(
      ...tool.keywords.map(keyword => fuzzyScore(query, keyword)),
      0
    ) * 2;

    const totalScore = nameScore + descriptionScore + keywordScore;

    return {
      tool,
      score: totalScore,
    };
  });

  // Filter out very low scores (below threshold)
  const threshold = 10;
  const filtered = scored.filter(item => item.score >= threshold);

  // Sort by score descending
  filtered.sort((a, b) => b.score - a.score);

  return filtered.slice(0, limit).map(item => item.tool);
}

/**
 * Search tools with basic string matching (fallback)
 */
export function searchTools(
  query: string,
  tools: ToolAction[]
): ToolAction[] {
  const lowerQuery = query.toLowerCase();
  return tools.filter(tool => {
    const matchesName = tool.name.toLowerCase().includes(lowerQuery);
    const matchesDescription = tool.description.toLowerCase().includes(lowerQuery);
    const matchesKeywords = tool.keywords.some(k =>
      k.toLowerCase().includes(lowerQuery)
    );
    return matchesName || matchesDescription || matchesKeywords;
  });
}

/**
 * Get tools by category
 */
export function getToolsByCategory(
  category: string,
  tools: ToolAction[]
): ToolAction[] {
  if (category === 'all') return tools;
  return tools.filter(tool => tool.category === category);
}

/**
 * Get tool by ID
 */
export function getToolById(
  id: string,
  tools: ToolAction[]
): ToolAction | undefined {
  return tools.find(tool => tool.id === id);
}

/**
 * Suggest tools based on context (message content, file types, etc.)
 */
export function suggestToolsFromContext(
  context: {
    messageContent?: string;
    fileType?: string;
    hasCode?: boolean;
    hasImage?: boolean;
    hasVideo?: boolean;
    hasAudio?: boolean;
  },
  tools: ToolAction[]
): ToolAction[] {
  const suggestions: ToolAction[] = [];

  const lower = context.messageContent?.toLowerCase() || '';

  // Code detection
  if (context.hasCode || lower.includes('code') || lower.includes('function') || lower.includes('bug')) {
    const codeTool = tools.find(t => t.id === 'code-studio');
    if (codeTool) suggestions.push(codeTool);
  }

  // Video detection
  if (context.hasVideo || lower.includes('video') || lower.includes('analyze this') || lower.includes('watch')) {
    const videoTool = tools.find(t => t.id === 'video-analyst');
    if (videoTool) suggestions.push(videoTool);
  }

  // Complex problem detection
  if (lower.includes('analyze') || lower.includes('think about') || lower.includes('complex') || lower.includes('reason')) {
    const reasonTool = tools.find(t => t.id === 'deep-reasoner');
    if (reasonTool) suggestions.push(reasonTool);
  }

  // Image detection
  if (context.hasImage || lower.includes('image') || lower.includes('photo') || lower.includes('picture') || lower.includes('create image')) {
    const visionTool = tools.find(t => t.id === 'vision-lab');
    if (visionTool) suggestions.push(visionTool);
  }

  // Audio/Meeting detection
  if (context.hasAudio || lower.includes('meeting') || lower.includes('transcribe') || lower.includes('recording')) {
    const meetingTool = tools.find(t => t.id === 'meeting-intel');
    if (meetingTool) suggestions.push(meetingTool);
  }

  // Route/Map detection
  if (lower.includes('route') || lower.includes('directions') || lower.includes('map') || lower.includes('navigate')) {
    const routeTool = tools.find(t => t.id === 'route-planner');
    if (routeTool) suggestions.push(routeTool);
  }

  // Voice/TTS detection
  if (lower.includes('voice') || lower.includes('speak') || lower.includes('tts') || lower.includes('text to speech')) {
    const voiceTool = tools.find(t => t.id === 'voice-studio');
    if (voiceTool) suggestions.push(voiceTool);
  }

  // Search detection
  if (lower.includes('search') || lower.includes('research') || lower.includes('find out') || lower.includes('look up')) {
    const searchTool = tools.find(t => t.id === 'deep-search');
    if (searchTool) suggestions.push(searchTool);
  }

  // Translation detection
  if (lower.includes('translate') || lower.includes('language') || lower.includes('español') || lower.includes('français')) {
    const translationTool = tools.find(t => t.id === 'translation');
    if (translationTool) suggestions.push(translationTool);
  }

  return suggestions;
}

/**
 * Get recently used tools from localStorage
 */
export function getRecentTools(limit: number = 5): string[] {
  try {
    const recent = localStorage.getItem('pulse-recent-tools');
    if (recent) {
      const parsed = JSON.parse(recent);
      return Array.isArray(parsed) ? parsed.slice(0, limit) : [];
    }
  } catch (error) {
    console.error('Error loading recent tools:', error);
  }
  return [];
}

/**
 * Save recently used tool to localStorage
 */
export function saveRecentTool(toolId: string): void {
  try {
    const recent = getRecentTools(10);

    // Remove if already exists
    const filtered = recent.filter(id => id !== toolId);

    // Add to front
    const updated = [toolId, ...filtered].slice(0, 10);

    localStorage.setItem('pulse-recent-tools', JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving recent tool:', error);
  }
}

export default {
  getAllToolActions,
  fuzzySearchTools,
  searchTools,
  getToolsByCategory,
  getToolById,
  suggestToolsFromContext,
  getRecentTools,
  saveRecentTool,
};
