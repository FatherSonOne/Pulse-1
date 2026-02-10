import { useState, useEffect, useCallback, RefObject } from 'react';
import { getAllToolActions, fuzzySearchTools, saveRecentTool } from '../services/toolRegistry';
import type { ToolAction } from '../services/toolRegistry';
import { SLASH_COMMAND_ALIASES, resolveSlashCommand } from '../utils/slashCommandAliases';

interface SlashCommandState {
  isActive: boolean;
  query: string;
  matches: ToolAction[];
  selectedIndex: number;
}

interface SlashCommandHandlers {
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  handleSelect: (tool: ToolAction) => void;
  handleDismiss: () => void;
}

/**
 * Hook for slash command detection and tool launching
 * Detects when user types "/" at start of input and shows autocomplete
 *
 * @param inputText - Current text in the input field
 * @param editorRef - Ref to the contentEditable div
 * @param onToolLaunch - Callback when tool is selected (receives toolId)
 * @returns State and handlers for slash command system
 */
export function useSlashCommands(
  inputText: string,
  editorRef: RefObject<HTMLDivElement>,
  onToolLaunch: (toolId: string) => void
): { state: SlashCommandState; handlers: SlashCommandHandlers } {
  const [isActive, setIsActive] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<ToolAction[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Detect slash at start of input
  useEffect(() => {
    const trimmed = inputText.trim();

    // Check if input starts with "/"
    if (trimmed.startsWith('/')) {
      // Extract command (everything after "/" until first space or end)
      const cmd = trimmed.slice(1).split(' ')[0];
      setQuery(cmd);
      setIsActive(true);

      // Get all tools
      const tools = getAllToolActions(() => {});

      // If query is empty, show all tools
      if (!cmd) {
        setMatches(tools.slice(0, 8));
        setSelectedIndex(0);
        return;
      }

      // First, try exact alias match
      const directMatch = resolveSlashCommand(cmd);
      if (directMatch) {
        const exactTool = tools.find(t => t.id === directMatch);
        if (exactTool) {
          // Put exact match first, then fuzzy matches
          const fuzzyMatches = fuzzySearchTools(cmd, tools, 7);
          const otherMatches = fuzzyMatches.filter(t => t.id !== directMatch);
          setMatches([exactTool, ...otherMatches]);
          setSelectedIndex(0);
          return;
        }
      }

      // Fuzzy search tools - searches name, description, keywords
      const fuzzyMatches = fuzzySearchTools(cmd, tools, 8);

      // Also search in aliases
      const aliasMatches = Object.entries(SLASH_COMMAND_ALIASES)
        .filter(([alias]) => alias.toLowerCase().includes(cmd.toLowerCase()))
        .map(([_, toolId]) => tools.find(t => t.id === toolId))
        .filter((t): t is ToolAction => t !== undefined);

      // Combine and deduplicate
      const combined = [...new Set([...fuzzyMatches, ...aliasMatches])];

      setMatches(combined.slice(0, 8));
      setSelectedIndex(0);
    } else {
      // Not a slash command anymore
      setIsActive(false);
      setQuery('');
      setMatches([]);
      setSelectedIndex(0);
    }
  }, [inputText]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isActive || matches.length === 0) return false;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, matches.length - 1));
        return true;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        return true;

      case 'Enter':
        e.preventDefault();
        if (matches[selectedIndex]) {
          handleSelect(matches[selectedIndex]);
        }
        return true;

      case 'Escape':
        e.preventDefault();
        handleDismiss();
        return true;

      case 'Tab':
        // Tab accepts first suggestion
        e.preventDefault();
        if (matches[0]) {
          handleSelect(matches[0]);
        }
        return true;

      default:
        return false;
    }
  }, [isActive, matches, selectedIndex]);

  // Handle tool selection
  const handleSelect = useCallback((tool: ToolAction) => {
    // Track usage
    saveRecentTool(tool.id);

    // Launch tool
    onToolLaunch(tool.id);

    // Deactivate slash command
    setIsActive(false);
    setQuery('');
    setMatches([]);
    setSelectedIndex(0);

    // Clear input (will be handled by parent)
  }, [onToolLaunch]);

  // Handle dismiss (close dropdown)
  const handleDismiss = useCallback(() => {
    setIsActive(false);
    setQuery('');
    setMatches([]);
    setSelectedIndex(0);
  }, []);

  return {
    state: { isActive, query, matches, selectedIndex },
    handlers: { handleKeyDown, handleSelect, handleDismiss }
  };
}
