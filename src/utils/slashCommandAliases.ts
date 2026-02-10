/**
 * Slash Command Aliases
 * Maps slash commands to tool IDs for quick tool launching
 * Examples: /reasoner → deep-reasoner, /vid → video-analyst
 */

export const SLASH_COMMAND_ALIASES: Record<string, string> = {
  // Deep Reasoner aliases
  'reasoner': 'deep-reasoner',
  'reason': 'deep-reasoner',
  'think': 'deep-reasoner',
  'analyze': 'deep-reasoner',

  // Video Analyst aliases
  'video': 'video-analyst',
  'vid': 'video-analyst',
  'watch': 'video-analyst',

  // Code Studio aliases
  'code': 'code-studio',
  'dev': 'code-studio',
  'program': 'code-studio',
  'debug': 'code-studio',

  // Vision Lab aliases
  'image': 'vision-lab',
  'img': 'vision-lab',
  'art': 'vision-lab',
  'picture': 'vision-lab',
  'photo': 'vision-lab',

  // Deep Search aliases
  'search': 'deep-search',
  'research': 'deep-search',
  'web': 'deep-search',
  'find': 'deep-search',

  // Meeting Intel aliases
  'meeting': 'meeting-intel',
  'transcribe': 'meeting-intel',
  'diarize': 'meeting-intel',

  // Voice Studio aliases
  'voice': 'voice-studio',
  'tts': 'voice-studio',
  'speech': 'voice-studio',
  'speak': 'voice-studio',

  // Route Planner aliases
  'map': 'route-planner',
  'route': 'route-planner',
  'directions': 'route-planner',
  'navigate': 'route-planner',

  // AI Assistant aliases
  'ai': 'ai-assistant',
  'assistant': 'ai-assistant',
  'chat': 'ai-assistant',
  'help': 'ai-assistant',

  // Video Studio aliases
  'veo': 'video-studio',
  'makevideo': 'video-studio',

  // Translation aliases
  'translate': 'translation',
  'lang': 'translation',

  // Templates aliases
  'template': 'templates',
  'preset': 'templates',

  // Smart Compose aliases
  'compose': 'smart-compose',
  'write': 'smart-compose',
  'draft': 'smart-compose',
};

/**
 * Resolve a slash command to a tool ID
 * @param command - The command text after the slash (e.g., "vid" from "/vid")
 * @returns The tool ID if found, null otherwise
 */
export function resolveSlashCommand(command: string): string | null {
  const normalized = command.toLowerCase().trim();

  // Check if it's an alias
  if (SLASH_COMMAND_ALIASES[normalized]) {
    return SLASH_COMMAND_ALIASES[normalized];
  }

  // Check if it's already a direct tool ID
  // (In case user types the full tool ID like "/deep-reasoner")
  // This will be validated against actual tools in the hook

  return null;
}

/**
 * Get all available slash commands
 * Useful for help/documentation
 */
export function getAllSlashCommands(): string[] {
  return Object.keys(SLASH_COMMAND_ALIASES).sort();
}

/**
 * Get aliases for a specific tool ID
 * @param toolId - The tool ID to find aliases for
 * @returns Array of aliases that map to this tool
 */
export function getAliasesForTool(toolId: string): string[] {
  return Object.entries(SLASH_COMMAND_ALIASES)
    .filter(([_, id]) => id === toolId)
    .map(([alias]) => alias);
}
