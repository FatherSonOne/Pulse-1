/**
 * PulseAIContext — Shared context provider for Pulse AI features.
 *
 * Bridges the text assistant (PulseAssistant) and voice chat (PulseVoiceChat)
 * so both can access Pulse data context and share conversation state.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { AppView, User } from '../types';
import { AssistantContext } from '../services/pulseAssistantService';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface PulseAIContextState {
  /** Current section-level context (data loaded by useAssistantContext) */
  assistantContext: AssistantContext | null;
  /** Current active section */
  activeSection: AppView;
  /** Current user */
  user: User | null;
  /** Text assistant conversation summary (for voice to reference) */
  textConversationSummary: string;
  /** Voice session active */
  isVoiceActive: boolean;
  /** Update the shared assistant context (called by useAssistantContext) */
  setAssistantContext: (ctx: AssistantContext) => void;
  /** Update the active section */
  setActiveSection: (section: AppView) => void;
  /** Set text conversation summary for voice AI to reference */
  setTextConversationSummary: (summary: string) => void;
  /** Set voice session active state */
  setIsVoiceActive: (active: boolean) => void;
  /** Build a Pulse data context string for injection into any AI system prompt */
  buildPulseDataPrompt: () => string;
}

const PulseAIContext = createContext<PulseAIContextState | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────────

interface PulseAIProviderProps {
  user: User | null;
  activeView: AppView;
  children: React.ReactNode;
}

export function PulseAIProvider({ user, activeView, children }: PulseAIProviderProps) {
  const [assistantContext, setAssistantContext] = useState<AssistantContext | null>(null);
  const [activeSection, setActiveSection] = useState<AppView>(activeView);
  const [textConversationSummary, setTextConversationSummary] = useState('');
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  // Keep activeSection in sync with the app's activeView
  React.useEffect(() => {
    setActiveSection(activeView);
  }, [activeView]);

  /**
   * Build a compact data summary string that can be injected into any AI
   * system prompt (text or voice) to give it awareness of Pulse data.
   */
  const buildPulseDataPrompt = useCallback((): string => {
    const ctx = assistantContext;
    if (!ctx) return 'No Pulse data context available.';

    const parts: string[] = [];
    parts.push(`User: ${ctx.user?.name ?? 'Unknown'}`);
    parts.push(`Current section: ${ctx.section}`);

    const tasks = ctx.tasks ?? [];
    if (tasks.length > 0) {
      const overdue = tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done' && t.status !== 'cancelled');
      const active = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
      parts.push(`Tasks: ${active.length} active, ${overdue.length} overdue`);
      if (overdue.length > 0) {
        parts.push(`Overdue: ${overdue.slice(0, 5).map(t => t.title).join(', ')}`);
      }
    }

    const decisions = ctx.decisions ?? [];
    if (decisions.length > 0) {
      const voting = decisions.filter(d => d.status === 'voting');
      parts.push(`Decisions: ${decisions.length} total, ${voting.length} awaiting votes`);
    }

    const threads = ctx.threads ?? [];
    if (threads.length > 0) {
      const unread = threads.filter(t => t.unread).length;
      parts.push(`Messages: ${threads.length} threads, ${unread} unread`);
    }

    if (ctx.emailUnreadCount !== undefined && ctx.emailUnreadCount > 0) {
      parts.push(`Email: ${ctx.emailUnreadCount} unread`);
    }

    const events = ctx.events ?? [];
    if (events.length > 0) {
      const today = new Date().toDateString();
      const todayEvents = events.filter(e => new Date(e.start).toDateString() === today);
      parts.push(`Calendar: ${todayEvents.length} today, ${events.length} upcoming`);
    }

    const contacts = ctx.contacts ?? [];
    if (contacts.length > 0) {
      parts.push(`Contacts: ${contacts.length} loaded`);
    }

    if (textConversationSummary) {
      parts.push(`\nRecent text AI conversation: ${textConversationSummary}`);
    }

    return parts.join('\n');
  }, [assistantContext, textConversationSummary]);

  const value = useMemo<PulseAIContextState>(() => ({
    assistantContext,
    activeSection,
    user,
    textConversationSummary,
    isVoiceActive,
    setAssistantContext,
    setActiveSection,
    setTextConversationSummary,
    setIsVoiceActive,
    buildPulseDataPrompt,
  }), [assistantContext, activeSection, user, textConversationSummary, isVoiceActive, buildPulseDataPrompt]);

  return (
    <PulseAIContext.Provider value={value}>
      {children}
    </PulseAIContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function usePulseAI(): PulseAIContextState {
  const context = useContext(PulseAIContext);
  if (!context) {
    throw new Error('usePulseAI must be used within a PulseAIProvider');
  }
  return context;
}
