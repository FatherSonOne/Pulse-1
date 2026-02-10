import { getAllToolActions } from '../../services/toolRegistry';
import type { ToolCategory, ToolAction } from './types';

/**
 * Tool Categories for Radial Menu
 * Organized into 4 main categories positioned in a circle
 */
export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'ai',
    name: 'AI Tools',
    icon: 'fa-brain',
    color: '#f43f5e', // rose-500
    description: 'AI-powered reasoning and analysis',
    tools: [
      'deep-reasoner',
      'ai-coach',
      'ai-mediator',
      'conversation-intelligence',
      'brainstorm-assistant',
      'ai-assistant',
      'deep-search',
    ],
  },
  {
    id: 'content',
    name: 'Content',
    icon: 'fa-pen-fancy',
    color: '#ec4899', // pink-500
    description: 'Content creation and editing',
    tools: [
      'code-studio',
      'smart-compose',
      'templates',
      'quick-phrases',
      'draft-manager',
      'message-formatting',
    ],
  },
  {
    id: 'analysis',
    name: 'Analysis',
    icon: 'fa-chart-line',
    color: '#fb7185', // rose-400
    description: 'Analytics and insights',
    tools: [
      'video-analyst',
      'sentiment-analysis',
      'engagement-scoring',
      'response-time-tracker',
      'conversation-flow',
      'sentiment-timeline',
      'meeting-intel',
      'message-impact',
    ],
  },
  {
    id: 'utilities',
    name: 'Utilities',
    icon: 'fa-toolbox',
    color: '#be123c', // rose-700
    description: 'Media, communication, and utilities',
    tools: [
      'vision-lab',
      'video-studio',
      'voice-studio',
      'translation',
      'route-planner',
      'keyboard-shortcuts',
      'settings',
      'backup-sync',
    ],
  },
];

/**
 * Get tools for a specific category
 * Filters all available tools by category tool IDs
 */
export function getToolsByCategory(categoryId: string): ToolAction[] {
  const category = TOOL_CATEGORIES.find(c => c.id === categoryId);
  if (!category) return [];

  // Get all tools from toolRegistry
  const allTools = getAllToolActions(() => {});

  // Filter to only tools in this category
  return allTools.filter(tool => category.tools.includes(tool.id));
}

/**
 * Get category by ID
 */
export function getCategoryById(categoryId: string): ToolCategory | undefined {
  return TOOL_CATEGORIES.find(c => c.id === categoryId);
}

/**
 * Get total tool count across all categories
 */
export function getTotalToolCount(): number {
  return TOOL_CATEGORIES.reduce((sum, cat) => sum + cat.tools.length, 0);
}
