/**
 * useStudioCommands — Slash command + @agent mention system for War Room.
 *
 * Commands: /brainstorm, /decide, /analyze, /summarize, /plan, /debrief, /risks, /compare
 * Agents:   @analyst, @skeptic, @scribe, @deep-diver
 *
 * Each command injects a system-level context prefix before the user's message,
 * guiding the AI to produce structured output that the artifact parser can detect.
 */

import { useCallback, useMemo } from 'react';
import type { AgentType } from './AgentSelector';

// ── Command definitions ────────────────────────────────────────────────────────

export interface StudioCommand {
  id: string;
  label: string;
  description: string;
  icon: string;
  /** Prompt prefix injected before the user's actual message */
  promptPrefix: string;
  /** Optional: auto-switch agent when this command is used */
  agentHint?: AgentType;
  /** Accent color for the autocomplete menu */
  accent: string;
}

export const STUDIO_COMMANDS: StudioCommand[] = [
  {
    id: 'brainstorm',
    label: '/brainstorm',
    description: 'Generate creative ideas',
    icon: 'fa-lightbulb',
    accent: '#f59e0b',
    promptPrefix:
      'The user wants to brainstorm. Generate a diverse set of creative ideas. ' +
      'Structure your response with a brief intro paragraph, then a section headed "## Ideas" ' +
      'containing a bullet list of distinct ideas. Each idea should be concise but descriptive. ' +
      'Aim for at least 6-8 ideas covering different angles.\n\n',
  },
  {
    id: 'decide',
    label: '/decide',
    description: 'Compare options and make a decision',
    icon: 'fa-scale-balanced',
    accent: '#8b5cf6',
    promptPrefix:
      'The user wants help making a decision. Structure your response with: ' +
      '1) A brief analysis paragraph, ' +
      '2) "## Pros" section with bullet list of advantages, ' +
      '3) "## Cons" section with bullet list of disadvantages, ' +
      '4) "## Recommendation" with your suggested decision and reasoning. ' +
      'If comparing multiple options, use a markdown table.\n\n',
  },
  {
    id: 'analyze',
    label: '/analyze',
    description: 'Deep analysis with structured findings',
    icon: 'fa-chart-line',
    accent: '#3b82f6',
    agentHint: 'deep-diver',
    promptPrefix:
      'The user wants a deep analysis. Structure your response with: ' +
      '1) "## Key Points" with a bullet list of main findings, ' +
      '2) Detailed analysis paragraphs with evidence and citations, ' +
      '3) "## Risks" section if applicable with bullet list, ' +
      '4) "## Recommendations" or "## Action Items" with bullet list.\n\n',
  },
  {
    id: 'summarize',
    label: '/summarize',
    description: 'Summarize sources or conversation',
    icon: 'fa-file-lines',
    accent: '#f43f5e',
    agentHint: 'scribe',
    promptPrefix:
      'The user wants a concise summary. Structure your response with: ' +
      '1) A one-paragraph executive summary, ' +
      '2) "## Key Points" section with 5-8 bullet points covering the most important information, ' +
      '3) "## Action Items" if there are clear next steps.\n\n',
  },
  {
    id: 'plan',
    label: '/plan',
    description: 'Create a structured plan or roadmap',
    icon: 'fa-map',
    accent: '#10b981',
    promptPrefix:
      'The user wants a structured plan. Structure your response with: ' +
      '1) A brief objective statement, ' +
      '2) "## Timeline" section with a bullet list where each item is formatted as "Phase/Step Name: Description", ' +
      '3) "## Action Items" with specific next steps as a checklist, ' +
      '4) "## Risks" section if applicable.\n\n',
  },
  {
    id: 'debrief',
    label: '/debrief',
    description: 'Extract insights and action items',
    icon: 'fa-clipboard-check',
    accent: '#06b6d4',
    agentHint: 'scribe',
    promptPrefix:
      'The user wants a debrief/retrospective. Structure your response with: ' +
      '1) "## Summary" with a brief overview paragraph and bullet list, ' +
      '2) "## Key Points" — what went well, what was learned, ' +
      '3) "## Action Items" — specific, actionable next steps as a checklist.\n\n',
  },
  {
    id: 'risks',
    label: '/risks',
    description: 'Identify and assess risks',
    icon: 'fa-triangle-exclamation',
    accent: '#ef4444',
    agentHint: 'skeptic',
    promptPrefix:
      'The user wants a risk assessment. Structure your response with: ' +
      '1) A brief context paragraph, ' +
      '2) "## Risks" section with a markdown table having columns: Risk | Likelihood | Impact | Mitigation, ' +
      'OR a bullet list where each item describes a risk and its mitigation. ' +
      '3) "## Recommendations" with prioritized action items.\n\n',
  },
  {
    id: 'compare',
    label: '/compare',
    description: 'Side-by-side comparison table',
    icon: 'fa-table-columns',
    accent: '#6366f1',
    promptPrefix:
      'The user wants a comparison. Structure your response with: ' +
      '1) A brief intro paragraph, ' +
      '2) A markdown comparison table with the options as columns and criteria as rows, ' +
      '3) "## Pros" and "## Cons" sections for the top recommendation, ' +
      '4) "## Recommendation" with your conclusion.\n\n',
  },
];

// ── Agent mentions ─────────────────────────────────────────────────────────────

export interface AgentMention {
  id: AgentType;
  label: string;
  description: string;
  icon: string;
  accent: string;
}

export const AGENT_MENTIONS: AgentMention[] = [
  { id: 'general',     label: '@general',     description: 'Balanced assistant',              icon: 'fa-lightbulb',      accent: '#f59e0b' },
  { id: 'skeptic',     label: '@skeptic',     description: 'Critical thinker',                icon: 'fa-scale-balanced', accent: '#8b5cf6' },
  { id: 'scribe',      label: '@scribe',      description: 'Note-taker & summarizer',         icon: 'fa-pen-fancy',      accent: '#10b981' },
  { id: 'deep-diver',  label: '@deep-diver',  description: 'In-depth researcher',             icon: 'fa-microscope',     accent: '#3b82f6' },
];

// ── Parse result ───────────────────────────────────────────────────────────────

export interface ParsedInput {
  /** The command if found (null = no command) */
  command: StudioCommand | null;
  /** Agent override from @mention or command hint */
  agentOverride: AgentType | null;
  /** The user's actual message text (command/mention stripped) */
  userText: string;
  /** Full prompt to send (prefix + user text) */
  fullPrompt: string;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useStudioCommands() {
  /** Parse user input, extract commands and @mentions, build the full prompt */
  const parseInput = useCallback((rawInput: string): ParsedInput => {
    let text = rawInput.trim();
    let command: StudioCommand | null = null;
    let agentOverride: AgentType | null = null;

    // 1. Check for /command at the start
    const cmdMatch = text.match(/^\/(\w+)\s*/);
    if (cmdMatch) {
      const cmdId = cmdMatch[1].toLowerCase();
      const found = STUDIO_COMMANDS.find(c => c.id === cmdId);
      if (found) {
        command = found;
        text = text.slice(cmdMatch[0].length).trim();
        if (found.agentHint) {
          agentOverride = found.agentHint;
        }
      }
    }

    // 2. Check for @agent mention anywhere
    const mentionMatch = text.match(/@(general|skeptic|scribe|deep-diver)\b/i);
    if (mentionMatch) {
      const mentionId = mentionMatch[1].toLowerCase() as AgentType;
      agentOverride = mentionId;
      text = text.replace(mentionMatch[0], '').trim();
    }

    // 3. Build full prompt
    const prefix = command ? command.promptPrefix : '';
    const fullPrompt = prefix + text;

    return { command, agentOverride, userText: text, fullPrompt };
  }, []);

  /** Get autocomplete suggestions based on current input */
  const getAutocompleteSuggestions = useCallback((input: string): (StudioCommand | AgentMention)[] => {
    const trimmed = input.trim();

    // Slash commands
    if (trimmed.startsWith('/')) {
      const query = trimmed.slice(1).toLowerCase();
      if (query.length === 0) return STUDIO_COMMANDS;
      return STUDIO_COMMANDS.filter(c => c.id.startsWith(query));
    }

    // Agent mentions — triggered by @ anywhere in input
    const atMatch = trimmed.match(/@(\w*)$/);
    if (atMatch) {
      const query = atMatch[1].toLowerCase();
      if (query.length === 0) return AGENT_MENTIONS;
      return AGENT_MENTIONS.filter(a => a.id.startsWith(query) || a.label.slice(1).startsWith(query));
    }

    return [];
  }, []);

  /** Apply an autocomplete selection to the current input */
  const applyAutocomplete = useCallback((input: string, item: StudioCommand | AgentMention): string => {
    if ('promptPrefix' in item) {
      // Slash command — replace /partial with /full + space
      return input.replace(/\/\w*$/, `/${item.id} `);
    } else {
      // Agent mention — replace @partial with @full + space
      return input.replace(/@\w*$/, `@${item.id} `);
    }
  }, []);

  return { parseInput, getAutocompleteSuggestions, applyAutocomplete, commands: STUDIO_COMMANDS, agents: AGENT_MENTIONS };
}
