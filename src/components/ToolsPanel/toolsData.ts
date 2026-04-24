/**
 * Tools Panel Data Configuration
 * Reorganizes existing tools into 4 categories with metadata
 */

import { Tool, CategoryConfig } from './types';

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'ai',
    name: 'AI TOOLS',
    icon: 'fa-robot',
    color: 'teal',  // Aurora teal for AI
    description: 'Intelligent assistance and automation'
  },
  {
    id: 'content',
    name: 'CONTENT',
    icon: 'fa-pen-fancy',
    color: 'green',  // Aurora green for Content
    description: 'Create and compose messages'
  },
  {
    id: 'analysis',
    name: 'ANALYSIS',
    icon: 'fa-chart-line',
    color: 'cyan',  // Aurora cyan for Analysis
    description: 'Insights and intelligence'
  },
  {
    id: 'utilities',
    name: 'UTILITIES',
    icon: 'fa-wrench',
    color: 'violet',  // Aurora violet for Utilities
    description: 'Helper tools and settings'
  }
];

export const TOOLS: Tool[] = [
  // ========================================
  // Category 1: AI Tools (Purple)
  // ========================================
  {
    id: 'ai-coach',
    name: 'AI Coach',
    description: 'Get personalized coaching and guidance',
    icon: 'fa-user-graduate',
    category: 'ai',
    keywords: ['coach', 'guidance', 'advice', 'mentor']
  },
  {
    id: 'ai-mediator',
    name: 'AI Mediator',
    description: 'Resolve conflicts with neutral mediation',
    icon: 'fa-handshake',
    category: 'ai',
    keywords: ['mediate', 'conflict', 'resolve', 'neutral']
  },
  {
    id: 'smart-compose',
    name: 'Smart Compose',
    description: 'AI-powered message suggestions',
    icon: 'fa-wand-magic-sparkles',
    category: 'ai',
    keywords: ['compose', 'write', 'suggest', 'ai']
  },
  {
    id: 'sentiment-analysis',
    name: 'Sentiment Analysis',
    description: 'Analyze tone and emotional content',
    icon: 'fa-face-smile',
    category: 'ai',
    keywords: ['sentiment', 'tone', 'emotion', 'mood']
  },
  {
    id: 'voice-context',
    name: 'Voice Context',
    description: 'Voice-aware conversation intelligence',
    icon: 'fa-microphone-lines',
    category: 'ai',
    keywords: ['voice', 'audio', 'context', 'conversation']
  },
  {
    id: 'translation',
    name: 'Translation',
    description: 'Real-time language translation',
    icon: 'fa-language',
    category: 'ai',
    keywords: ['translate', 'language', 'multilingual']
  },
  {
    id: 'brainstorm-assistant',
    name: 'Brainstorm Assistant',
    description: 'Generate creative ideas and solutions',
    icon: 'fa-lightbulb',
    category: 'ai',
    keywords: ['brainstorm', 'ideas', 'creative', 'innovation']
  },
  {
    id: 'conversation-intelligence',
    name: 'Conversation Intelligence',
    description: 'Extract insights from conversations',
    icon: 'fa-brain',
    category: 'ai',
    keywords: ['intelligence', 'insights', 'conversation', 'analysis']
  },
  {
    id: 'deep-reasoner',
    name: 'Deep Reasoner',
    description: 'Complex problem solving with extended thinking',
    icon: 'fa-brain',
    category: 'ai',
    keywords: ['reasoning', 'logic', 'problem', 'thinking'],
    requiresApiKey: true,
    apiKeyName: 'Gemini'
  },

  // ========================================
  // Category 2: Content Creation (Blue)
  // ========================================
  {
    id: 'templates',
    name: 'Templates',
    description: 'Pre-built message templates',
    icon: 'fa-file-lines',
    category: 'content',
    keywords: ['template', 'preset', 'format']
  },
  {
    id: 'quick-phrases',
    name: 'Quick Phrases',
    description: 'Save and reuse common phrases',
    icon: 'fa-bolt',
    category: 'content',
    keywords: ['quick', 'phrase', 'shortcut', 'snippet']
  },
  {
    id: 'message-formatting',
    name: 'Message Formatting',
    description: 'Rich text formatting options',
    icon: 'fa-text',
    category: 'content',
    keywords: ['format', 'bold', 'italic', 'style']
  },
  {
    id: 'voice-recorder',
    name: 'Voice Recorder',
    description: 'Record and transcribe voice messages',
    icon: 'fa-microphone',
    category: 'content',
    keywords: ['voice', 'record', 'audio', 'transcribe']
  },
  {
    id: 'emoji-reactions',
    name: 'Emoji & Reactions',
    description: 'Express with emojis and reactions',
    icon: 'fa-face-smile-beam',
    category: 'content',
    keywords: ['emoji', 'reaction', 'emotion', 'express']
  },
  {
    id: 'file-attachments',
    name: 'File Attachments',
    description: 'Attach files and media',
    icon: 'fa-paperclip',
    category: 'content',
    keywords: ['attach', 'file', 'media', 'upload']
  },
  {
    id: 'scheduled-messages',
    name: 'Scheduled Messages',
    description: 'Schedule messages for later',
    icon: 'fa-clock',
    category: 'content',
    keywords: ['schedule', 'later', 'time', 'delay']
  },
  {
    id: 'draft-manager',
    name: 'Draft Manager',
    description: 'Manage saved message drafts',
    icon: 'fa-file-pen',
    category: 'content',
    keywords: ['draft', 'save', 'manage', 'unfinished']
  },
  {
    id: 'code-studio',
    name: 'Code Studio',
    description: 'Generate code and algorithms',
    icon: 'fa-laptop-code',
    category: 'content',
    keywords: ['code', 'programming', 'developer'],
    requiresApiKey: true,
    apiKeyName: 'Gemini'
  },
  {
    id: 'vision-lab',
    name: 'Vision Lab',
    description: 'Create stunning images with Imagen 3',
    icon: 'fa-image',
    category: 'content',
    keywords: ['image', 'generate', 'art', 'visual'],
    requiresApiKey: true,
    apiKeyName: 'Gemini'
  },
  {
    id: 'video-studio',
    name: 'Video Studio',
    description: 'Generate videos with Veo AI model',
    icon: 'fa-clapperboard',
    category: 'content',
    keywords: ['video', 'generate', 'veo'],
    requiresApiKey: true,
    apiKeyName: 'Veo',
    isPro: true
  },

  // ========================================
  // Category 3: Analysis (Green)
  // ========================================
  {
    id: 'engagement-scoring',
    name: 'Engagement Scoring',
    description: 'Measure message engagement levels',
    icon: 'fa-chart-simple',
    category: 'analysis',
    keywords: ['engagement', 'score', 'metric', 'performance']
  },
  {
    id: 'response-time-tracker',
    name: 'Response Time Tracker',
    description: 'Track response time patterns',
    icon: 'fa-stopwatch',
    category: 'analysis',
    keywords: ['response', 'time', 'speed', 'performance']
  },
  {
    id: 'conversation-flow',
    name: 'Conversation Flow',
    description: 'Visualize conversation patterns',
    icon: 'fa-diagram-project',
    category: 'analysis',
    keywords: ['flow', 'pattern', 'conversation', 'visual']
  },
  {
    id: 'sentiment-timeline',
    name: 'Sentiment Timeline',
    description: 'Track sentiment changes over time',
    icon: 'fa-chart-line',
    category: 'analysis',
    keywords: ['sentiment', 'timeline', 'mood', 'trend']
  },
  {
    id: 'analytics-export',
    name: 'Analytics Export',
    description: 'Export analytics and reports',
    icon: 'fa-file-export',
    category: 'analysis',
    keywords: ['export', 'analytics', 'report', 'data']
  },
  {
    id: 'read-receipts',
    name: 'Read Receipts',
    description: 'Track message read status',
    icon: 'fa-eye',
    category: 'analysis',
    keywords: ['read', 'receipt', 'status', 'seen']
  },
  {
    id: 'message-impact',
    name: 'Message Impact',
    description: 'Analyze message effectiveness',
    icon: 'fa-bullseye',
    category: 'analysis',
    keywords: ['impact', 'effectiveness', 'success']
  },
  {
    id: 'video-analyst',
    name: 'Video Analyst',
    description: 'Analyze and extract insights from video',
    icon: 'fa-film',
    category: 'analysis',
    keywords: ['video', 'analyze', 'insights'],
    requiresApiKey: true,
    apiKeyName: 'Gemini'
  },
  {
    id: 'meeting-intel',
    name: 'Meeting Intel',
    description: 'Speaker diarization & sentiment from recordings',
    icon: 'fa-users-rectangle',
    category: 'analysis',
    keywords: ['meeting', 'transcribe', 'diarization'],
    requiresApiKey: true,
    apiKeyName: 'AssemblyAI',
    isPro: true
  },
  // ========================================
  // Category 4: Utilities (Amber)
  // ========================================
  {
    id: 'search-filter',
    name: 'Search & Filter',
    description: 'Find messages quickly',
    icon: 'fa-magnifying-glass',
    category: 'utilities',
    keywords: ['search', 'find', 'filter', 'query']
  },
  {
    id: 'message-pinning',
    name: 'Message Pinning',
    description: 'Pin important messages',
    icon: 'fa-thumbtack',
    category: 'utilities',
    keywords: ['pin', 'important', 'favorite', 'bookmark']
  },
  {
    id: 'thread-linking',
    name: 'Thread Linking',
    description: 'Link related conversations',
    icon: 'fa-link',
    category: 'utilities',
    keywords: ['link', 'thread', 'connect', 'reference']
  },
  {
    id: 'knowledge-base',
    name: 'Knowledge Base',
    description: 'Access saved information',
    icon: 'fa-book',
    category: 'utilities',
    keywords: ['knowledge', 'information', 'library', 'docs']
  },
  {
    id: 'keyboard-shortcuts',
    name: 'Keyboard Shortcuts',
    description: 'View and customize shortcuts',
    icon: 'fa-keyboard',
    category: 'utilities',
    keywords: ['keyboard', 'shortcut', 'hotkey', 'keys']
  },
  {
    id: 'backup-sync',
    name: 'Backup & Sync',
    description: 'Backup and sync your data',
    icon: 'fa-cloud-arrow-up',
    category: 'utilities',
    keywords: ['backup', 'sync', 'cloud', 'save']
  },
  {
    id: 'settings',
    name: 'Settings',
    description: 'Configure tool preferences',
    icon: 'fa-gear',
    category: 'utilities',
    keywords: ['settings', 'preferences', 'config', 'options']
  },
  {
    id: 'voice-studio',
    name: 'Voice Studio',
    description: 'Ultra-realistic text-to-speech synthesis',
    icon: 'fa-podcast',
    category: 'utilities',
    keywords: ['voice', 'tts', 'speech', 'audio'],
    requiresApiKey: true,
    apiKeyName: 'ElevenLabs',
    isPro: true
  },
  {
    id: 'route-planner',
    name: 'Route Planner',
    description: 'Visual maps & optimized navigation',
    icon: 'fa-route',
    category: 'utilities',
    keywords: ['map', 'route', 'navigation', 'directions'],
    requiresApiKey: true,
    apiKeyName: 'Mapbox',
    isPro: true
  },
  {
    id: 'ai-assistant',
    name: 'AI Assistant',
    description: 'Multi-model chat with auto-fallback',
    icon: 'fa-robot',
    category: 'utilities',
    keywords: ['assistant', 'chat', 'ai', 'help'],
    requiresApiKey: true,
    apiKeyName: 'Multi-AI'
  }
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
 * Get category color classes - Minimalist CMF Nothing Design
 */
export function getCategoryColor(category: string): { bg: string; text: string; border: string; dot: string } {
  const colorMap: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    ai: {
      bg: 'bg-zinc-100 dark:bg-zinc-800/50',  // Monochrome bg
      text: 'text-teal-500 dark:text-teal-400',  // Aurora teal
      border: 'border-zinc-200 dark:border-zinc-800',
      dot: 'bg-teal-500'
    },
    content: {
      bg: 'bg-zinc-100 dark:bg-zinc-800/50',
      text: 'text-green-500 dark:text-green-400',  // Aurora green
      border: 'border-zinc-200 dark:border-zinc-800',
      dot: 'bg-green-500'
    },
    analysis: {
      bg: 'bg-zinc-100 dark:bg-zinc-800/50',
      text: 'text-cyan-500 dark:text-cyan-400',  // Aurora cyan
      border: 'border-zinc-200 dark:border-zinc-800',
      dot: 'bg-cyan-500'
    },
    utilities: {
      bg: 'bg-zinc-100 dark:bg-zinc-800/50',
      text: 'text-violet-500 dark:text-violet-400',  // Aurora violet
      border: 'border-zinc-200 dark:border-zinc-800',
      dot: 'bg-violet-500'
    }
  };

  return colorMap[category] || colorMap.utilities;
}
