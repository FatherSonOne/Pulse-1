/**
 * Slash Command Aliases — message tools.
 *
 * Maps short slash inputs to canonical tool IDs in toolsData.ts. The
 * Phase-2 prune dropped aliases for tools that moved out of the
 * message-tools surface (Vision Lab, Code Studio, Deep Reasoner, etc.
 * now live in the global Tools modal and have their own aliases there
 * if needed).
 */

export const SLASH_COMMAND_ALIASES: Record<string, string> = {
  // WRITE
  'compose': 'smart-compose',
  'write': 'smart-compose',
  'draft': 'smart-compose',
  'suggest': 'smart-compose',
  'phrase': 'smart-compose',
  'phrases': 'smart-compose',
  'template': 'templates',
  'templates': 'templates',
  'preset': 'templates',
  'format': 'message-formatting',
  'bold': 'message-formatting',
  'translate': 'translation',
  'lang': 'translation',

  // ANALYZE
  'summary': 'conversation-summary',
  'summarize': 'conversation-summary',
  'recap': 'conversation-summary',
  'tldr': 'conversation-summary',
  'pace': 'pace',
  'engagement': 'pace',
  'response-time': 'pace',
  'sentiment': 'sentiment',
  'tone': 'sentiment',
  'mood': 'sentiment',
  'flow': 'conversation-flow',

  // COACH
  'coach': 'ai-coach',
  'critique': 'ai-coach',
  'mediator': 'ai-mediator',
  'mediate': 'ai-mediator',
  'deescalate': 'ai-mediator',
  'insights': 'insights',
  'patterns': 'insights',
};

/**
 * Resolve a slash command to a tool ID.
 */
export function resolveSlashCommand(command: string): string | null {
  const normalized = command.toLowerCase().trim();
  return SLASH_COMMAND_ALIASES[normalized] ?? null;
}

/**
 * Get all available slash commands.
 */
export function getAllSlashCommands(): string[] {
  return Object.keys(SLASH_COMMAND_ALIASES).sort();
}

/**
 * Get aliases for a specific tool ID.
 */
export function getAliasesForTool(toolId: string): string[] {
  return Object.entries(SLASH_COMMAND_ALIASES)
    .filter(([, id]) => id === toolId)
    .map(([alias]) => alias);
}
