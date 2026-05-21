/**
 * Tools Panel Data — message-tools registry.
 *
 * Phase 2 (post-prune): the registry now exposes exactly the tools that
 * a solo operator would reach for while writing a message. Everything
 * else — Vision Lab, Code Studio, Deep Reasoner, Video Studio, Voice
 * Studio, Route Planner — lives in the global Tools modal (Tools.tsx),
 * not here. Utilities (Backup, Shortcuts, Notifications) live in global
 * Settings.
 *
 * Three categories: WRITE (composer-facing), ANALYZE (thread-facing),
 * COACH (AI-in-conversation).
 */

import { Tool, CategoryConfig } from './types';

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'write',
    name: 'WRITE',
    icon: 'fa-pen-fancy',
    color: 'rose',
    description: 'Tools that touch the composer',
  },
  {
    id: 'analyze',
    name: 'ANALYZE',
    icon: 'fa-chart-line',
    color: 'rose',
    description: 'Tools that read the thread',
  },
  {
    id: 'coach',
    name: 'COACH',
    icon: 'fa-comments',
    color: 'rose',
    description: 'AI in the conversation, not in the composer',
  },
];

export const TOOLS: Tool[] = [
  // ──────────────────────────────────────────────────────────────
  // WRITE — tools that touch the composer
  // ──────────────────────────────────────────────────────────────
  {
    id: 'smart-compose',
    name: 'Smart Compose',
    description: 'Draft suggestions and quick phrases',
    icon: 'fa-wand-magic-sparkles',
    category: 'write',
    keywords: ['compose', 'write', 'suggest', 'draft', 'phrase', 'quick'],
  },
  {
    id: 'templates',
    name: 'Templates',
    description: 'Saved phrases with variables',
    icon: 'fa-file-lines',
    category: 'write',
    keywords: ['template', 'preset', 'saved', 'snippet'],
  },
  {
    id: 'message-formatting',
    name: 'Format',
    description: 'Bold, italic, code, list, quote, link',
    icon: 'fa-text-height',
    category: 'write',
    keywords: ['format', 'bold', 'italic', 'code', 'list', 'quote', 'link', 'markdown'],
  },
  {
    id: 'translation',
    name: 'Translate',
    description: 'Live translation of received and draft text',
    icon: 'fa-language',
    category: 'write',
    keywords: ['translate', 'language', 'multilingual'],
  },

  // ──────────────────────────────────────────────────────────────
  // ANALYZE — tools that read the thread
  // ──────────────────────────────────────────────────────────────
  {
    id: 'conversation-summary',
    name: 'Conversation Summary',
    description: 'LLM-generated summary on demand',
    icon: 'fa-list-check',
    category: 'analyze',
    keywords: ['summary', 'summarize', 'recap', 'tldr'],
  },
  {
    id: 'pace',
    name: 'Pace',
    description: 'Engagement and response-time charts',
    icon: 'fa-stopwatch',
    category: 'analyze',
    keywords: ['pace', 'engagement', 'response', 'time', 'speed', 'rhythm'],
  },
  {
    id: 'sentiment',
    name: 'Sentiment',
    description: 'Tone of the current message and the thread trend',
    icon: 'fa-face-smile',
    category: 'analyze',
    keywords: ['sentiment', 'tone', 'emotion', 'mood', 'trend'],
  },
  {
    id: 'conversation-flow',
    name: 'Conversation Flow',
    description: 'Visualize message rhythm and turn-taking',
    icon: 'fa-diagram-project',
    category: 'analyze',
    keywords: ['flow', 'pattern', 'visual', 'rhythm', 'turns'],
  },

  // ──────────────────────────────────────────────────────────────
  // COACH — AI in the conversation, not in the composer
  // ──────────────────────────────────────────────────────────────
  {
    id: 'ai-coach',
    name: 'AI Coach',
    description: 'Real-time draft critique and rewrites',
    icon: 'fa-user-graduate',
    category: 'coach',
    keywords: ['coach', 'guidance', 'critique', 'rewrite', 'tone'],
  },
  {
    id: 'ai-mediator',
    name: 'AI Mediator',
    description: 'De-escalation when conflict signals appear',
    icon: 'fa-handshake',
    category: 'coach',
    keywords: ['mediate', 'conflict', 'resolve', 'de-escalate'],
  },
  {
    id: 'insights',
    name: 'Insights',
    description: 'Patterns and recurring themes in the thread',
    icon: 'fa-magnifying-glass-chart',
    category: 'coach',
    keywords: ['insights', 'intelligence', 'patterns', 'themes'],
  },
];

/**
 * Get tools by category
 */
export function getToolsByCategory(category: string): Tool[] {
  if (category === 'all') return TOOLS;
  return TOOLS.filter(tool => tool.category === category);
}

/**
 * Get tool by ID
 */
export function getToolById(id: string): Tool | undefined {
  return TOOLS.find(tool => tool.id === id);
}

/**
 * Search tools by query
 */
export function searchTools(query: string): Tool[] {
  const lowerQuery = query.toLowerCase();
  return TOOLS.filter(tool => {
    const matchesName = tool.name.toLowerCase().includes(lowerQuery);
    const matchesDescription = tool.description.toLowerCase().includes(lowerQuery);
    const matchesKeywords = tool.keywords?.some(keyword =>
      keyword.toLowerCase().includes(lowerQuery)
    );
    return matchesName || matchesDescription || matchesKeywords;
  });
}

/**
 * Category color classes — coral-only signal across all categories per
 * the Coral-As-Signal rule. Active state, hover, and dots all use rose.
 */
export function getCategoryColor(_category: string): { bg: string; text: string; border: string; dot: string } {
  return {
    bg: 'bg-rose-500/[0.08] dark:bg-rose-500/[0.12]',
    text: 'text-rose-600 dark:text-rose-bright',
    border: 'border-rose-500/30',
    dot: 'bg-rose-500',
  };
}
