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

// Keyboard shortcuts for message tools. Globally available so the user
// can pop a tool open without first opening the drawer.
const TOOL_SHORTCUTS: Record<string, string> = {
  'smart-compose': 'Ctrl+Shift+W',
  'smart-reply': 'Ctrl+Shift+R',
  'voice-extractor': 'Ctrl+Shift+V',
  'schedule-message': 'Ctrl+Shift+S',
  'proposal-mode': 'Ctrl+Shift+P',
  'message-formatting': 'Ctrl+Shift+F',
  'translation': 'Ctrl+Shift+L',
  'conversation-summary': 'Ctrl+Shift+U',
  'pace': 'Ctrl+Shift+B',
  'sentiment': 'Ctrl+Shift+Y',
  'conversation-flow': 'Ctrl+Shift+G',
  'ai-coach': 'Ctrl+Shift+K',
  'ai-mediator': 'Ctrl+Shift+M',
  'insights': 'Ctrl+Shift+I',
};

/**
 * Map message-tool IDs to overlay categories. Used when a tool is
 * launched via keyboard shortcut or command palette so the right
 * surface opens. Tools without an overlay entry are inline-toggled
 * via INLINE_PANEL_TOOLS below (Smart Compose, AI Coach, AI Mediator,
 * Voice Note, Schedule, Smart Reply, Proposal Mode).
 */
export const TOOL_OVERLAY_MAP: Record<string, 'analytics' | 'collaboration' | 'productivity' | 'intelligence' | 'proactive' | 'communication' | 'personalization' | 'security' | 'mediaHub'> = {
  // WRITE
  'message-formatting': 'personalization',
  'translation': 'mediaHub',

  // ANALYZE
  'conversation-summary': 'productivity',
  'pace': 'analytics',
  'sentiment': 'proactive',
  'conversation-flow': 'analytics',

  // COACH
  'insights': 'security',
};

/**
 * Tool IDs that the composer toggles inline (a panel above the input
 * row, no overlay). The slash-command dispatcher first asks the parent
 * to handle these via `onInlinePanelLaunch`; if not handled, it falls
 * back to the overlay map above.
 */
export type InlinePanelToolId =
  | 'smart-compose'
  | 'ai-coach'
  | 'ai-mediator'
  | 'voice-extractor'
  | 'schedule-message'
  | 'smart-reply'
  | 'proposal-mode';

export const INLINE_PANEL_TOOLS: ReadonlySet<InlinePanelToolId> = new Set([
  'smart-compose',
  'ai-coach',
  'ai-mediator',
  'voice-extractor',
  'schedule-message',
  'smart-reply',
  'proposal-mode',
]);

export function isInlinePanelTool(toolId: string): toolId is InlinePanelToolId {
  return INLINE_PANEL_TOOLS.has(toolId as InlinePanelToolId);
}

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
 * Get category color. Coral-as-signal rule: every category uses the
 * same rose tint; differentiation comes from the section label, not
 * a colour swatch.
 */
function getCategoryColor(_category: string): string {
  return '#f43f5e';
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
 * Suggest message tools based on draft / thread context. Code Studio,
 * Vision Lab, etc. live in the global Tools modal now, so they don't
 * appear here. Only message-tool suggestions are returned.
 */
export function suggestToolsFromContext(
  context: {
    messageContent?: string;
  },
  tools: ToolAction[]
): ToolAction[] {
  const suggestions: ToolAction[] = [];
  const lower = context.messageContent?.toLowerCase() || '';

  // Translation
  if (lower.includes('translate') || lower.includes('language') || lower.includes('español') || lower.includes('français')) {
    const t = tools.find(x => x.id === 'translation');
    if (t) suggestions.push(t);
  }

  // Summary
  if (lower.includes('summarize') || lower.includes('summary') || lower.includes('recap') || lower.includes('tldr')) {
    const t = tools.find(x => x.id === 'conversation-summary');
    if (t) suggestions.push(t);
  }

  // Sentiment cues — strong words trigger a sentiment check
  if (lower.match(/\b(angry|frustrated|upset|annoyed|happy|excited|love|hate)\b/)) {
    const t = tools.find(x => x.id === 'sentiment');
    if (t) suggestions.push(t);
  }

  // Coach cues — apology / softening territory
  if (lower.match(/\b(sorry|apologize|wrong|terrible|stupid|always|never)\b/)) {
    const t = tools.find(x => x.id === 'ai-coach');
    if (t) suggestions.push(t);
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
