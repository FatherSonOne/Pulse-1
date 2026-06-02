// Agent persona catalog. The interactive <AgentSelector> dropdown that once
// lived here was unrendered (zero JSX usages) and was removed in WI-11 of the
// War Room repair plan (2026-06-02). The AgentType union and AGENTS array are
// load-bearing — imported by warRoomStore, LiveDashboard, useStudioCommands,
// StudioHeader, Composer, PulseStudio, and ChatPane — so they stay.

import type { LucideIcon } from 'lucide-react';
import { Lightbulb, Microscope, PenTool, Scale } from 'lucide-react';

export type AgentType = 'general' | 'skeptic' | 'scribe' | 'deep-diver';

export const AGENTS: { id: AgentType; name: string; icon: string; description: string; color: string }[] = [
  { id: 'general', name: 'General', icon: 'fa-lightbulb', description: 'Balanced AI assistant for any task', color: 'from-amber-500 to-yellow-500' },
  { id: 'skeptic', name: 'Skeptic', icon: 'fa-scale-balanced', description: 'Critical thinker, questions assumptions', color: 'from-purple-500 to-indigo-500' },
  { id: 'scribe', name: 'Scribe', icon: 'fa-pen-fancy', description: 'Note-taker and summarizer', color: 'from-emerald-500 to-teal-500' },
  { id: 'deep-diver', name: 'Deep Diver', icon: 'fa-microscope', description: 'In-depth analysis and research', color: 'from-blue-500 to-cyan-500' },
];

/** Lucide icon per agent for the live Notebook surface. (The AGENTS.icon
 *  fa-strings remain for the dormant legacy PulseStudio path.) */
export const AGENT_ICONS: Record<AgentType, LucideIcon> = {
  general: Lightbulb,
  skeptic: Scale,
  scribe: PenTool,
  'deep-diver': Microscope,
};
