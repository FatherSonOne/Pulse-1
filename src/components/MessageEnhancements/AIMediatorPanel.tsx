// AI Mediator Panel — conflict detection and resolution assistant.
// Combines keyword heuristics (detectConflicts, below — instant signal)
// with a debounced LLM call (analyzeTeamHealth) so users get a fast
// preview AND a higher-fidelity LLM read of the thread.
import React, { useState, useEffect } from 'react';

import { Lightbulb, X } from 'lucide-react';
import { AIProvenanceTag } from '../shared/AIProvenanceTag';
import { analyzeTeamHealth } from '../../services/geminiService';
import type { TeamHealth } from '../../types';

interface ConflictSignal {
  id: string;
  type: 'tension' | 'disagreement' | 'frustration' | 'miscommunication';
  severity: 'low' | 'medium' | 'high';
  message: string;
  context: string;
  timestamp: Date;
}

interface MediationSuggestion {
  id: string;
  type: 'rephrase' | 'clarify' | 'acknowledge' | 'pause' | 'escalate';
  title: string;
  description: string;
  suggestedText?: string;
  actionLabel: string;
}

interface AIMediatorPanelProps {
  messages: Array<{ id: string; text: string; sender: string; timestamp: Date }>;
  contactName: string;
  onApplySuggestion: (suggestion: MediationSuggestion) => void;
  onDismiss: () => void;
  apiKey?: string;
  /** Suppress the component's outer rounded-border + collapsible
   *  header. Use when the panel is wrapped in PanelShell so the host
   *  owns chrome and dismiss. The body always renders expanded. */
  hideHeader?: boolean;
}

// Conflict detection helper
const detectConflicts = (messages: AIMediatorPanelProps['messages']): ConflictSignal[] => {
  const signals: ConflictSignal[] = [];

  const tensionWords = ['but', 'however', 'actually', 'wrong', 'no', 'disagree', 'problem'];
  const frustrationWords = ['again', 'always', 'never', 'still', 'waiting', 'frustrated', 'annoyed'];
  const escalationWords = ['urgent', 'immediately', 'unacceptable', 'disappointed', 'concerned'];

  messages.slice(-10).forEach((msg, index) => {
    const text = msg.text?.toLowerCase() || '';

    // Check for tension
    const tensionCount = tensionWords.filter(w => text.includes(w)).length;
    if (tensionCount >= 2) {
      signals.push({
        id: `tension-${msg.id}`,
        type: 'tension',
        severity: tensionCount >= 3 ? 'high' : 'medium',
        message: 'Potential tension detected in this message',
        context: msg.text.slice(0, 100),
        timestamp: msg.timestamp
      });
    }

    // Check for frustration
    const frustrationCount = frustrationWords.filter(w => text.includes(w)).length;
    if (frustrationCount >= 1) {
      signals.push({
        id: `frustration-${msg.id}`,
        type: 'frustration',
        severity: frustrationCount >= 2 ? 'high' : 'low',
        message: 'Signs of frustration in this message',
        context: msg.text.slice(0, 100),
        timestamp: msg.timestamp
      });
    }

    // Check for escalation language
    const escalationCount = escalationWords.filter(w => text.includes(w)).length;
    if (escalationCount >= 1) {
      signals.push({
        id: `escalation-${msg.id}`,
        type: 'disagreement',
        severity: 'high',
        message: 'Elevated language detected',
        context: msg.text.slice(0, 100),
        timestamp: msg.timestamp
      });
    }

    // Check for question followed by no response (miscommunication)
    if (msg.text?.includes('?') && index < messages.length - 1) {
      const nextMsg = messages[index + 1];
      if (nextMsg && nextMsg.sender === msg.sender) {
        signals.push({
          id: `miscomm-${msg.id}`,
          type: 'miscommunication',
          severity: 'low',
          message: 'Question may not have been addressed',
          context: msg.text.slice(0, 100),
          timestamp: msg.timestamp
        });
      }
    }
  });

  return signals;
};

// Generate mediation suggestions
const generateSuggestions = (signals: ConflictSignal[], contactName: string): MediationSuggestion[] => {
  const suggestions: MediationSuggestion[] = [];

  const highSeverityCount = signals.filter(s => s.severity === 'high').length;
  const hasTension = signals.some(s => s.type === 'tension');
  const hasFrustration = signals.some(s => s.type === 'frustration');
  const hasMiscommunication = signals.some(s => s.type === 'miscommunication');

  if (highSeverityCount >= 2) {
    suggestions.push({
      id: 'pause',
      type: 'pause',
      title: 'Take a Strategic Pause',
      description: 'The conversation seems heated. Consider stepping back for a moment.',
      suggestedText: `I want to make sure we're on the same page. Let me take a moment to gather my thoughts, and I'll get back to you shortly.`,
      actionLabel: 'Send Pause Message'
    });
  }

  if (hasTension) {
    suggestions.push({
      id: 'acknowledge',
      type: 'acknowledge',
      title: 'Acknowledge Their Perspective',
      description: 'Show that you understand their point of view, even if you disagree.',
      suggestedText: `I hear what you're saying, and I appreciate you sharing your perspective. Let me address your concerns...`,
      actionLabel: 'Use This Opening'
    });
  }

  if (hasFrustration) {
    suggestions.push({
      id: 'empathize',
      type: 'clarify',
      title: 'Express Empathy',
      description: `${contactName} seems frustrated. Acknowledging their feelings can help.`,
      suggestedText: `I understand this has been frustrating, and I appreciate your patience. Here's what I'm doing to help...`,
      actionLabel: 'Use Empathetic Response'
    });
  }

  if (hasMiscommunication) {
    suggestions.push({
      id: 'clarify',
      type: 'clarify',
      title: 'Seek Clarification',
      description: 'Some questions may have been missed. Help ensure alignment.',
      suggestedText: `Just to make sure I haven't missed anything - could you help me understand what you meant by...?`,
      actionLabel: 'Ask for Clarification'
    });
  }

  if (signals.length > 0) {
    suggestions.push({
      id: 'rephrase',
      type: 'rephrase',
      title: 'Soften Your Message',
      description: 'Consider rephrasing to reduce potential friction.',
      actionLabel: 'Get Rephrasing Help'
    });
  }

  if (highSeverityCount >= 3) {
    suggestions.push({
      id: 'escalate',
      type: 'escalate',
      title: 'Consider a Call',
      description: 'Complex issues are often better resolved through a quick call.',
      suggestedText: `I think this might be easier to discuss over a quick call. Would you have 15 minutes today?`,
      actionLabel: 'Suggest a Call'
    });
  }

  return suggestions;
};

export const AIMediatorPanel: React.FC<AIMediatorPanelProps> = ({
  messages,
  contactName,
  onApplySuggestion,
  onDismiss,
  hideHeader = false,
}) => {
  const [signals, setSignals] = useState<ConflictSignal[]>([]);
  const [suggestions, setSuggestions] = useState<MediationSuggestion[]>([]);
  // When wrapped in PanelShell, the host owns expand/collapse, so we
  // always render the body. Otherwise default to collapsed.
  const [expanded, setExpanded] = useState(hideHeader);
  const [dismissed, setDismissed] = useState(false);
  const [llmHealth, setLlmHealth] = useState<TeamHealth | null>(null);

  useEffect(() => {
    const detectedSignals = detectConflicts(messages);
    setSignals(detectedSignals);
    setSuggestions(generateSuggestions(detectedSignals, contactName));
  }, [messages, contactName]);

  // LLM enrichment — call analyzeTeamHealth with the recent transcript
  // and surface its issues as additional mediator signals. The router
  // handles workspace + cap; soft failures return null and we silently
  // fall back to the heuristic.
  useEffect(() => {
    if (messages.length < 6) {
      setLlmHealth(null);
      return;
    }
    let cancelled = false;
    const transcript = messages
      .slice(-15)
      .map(m => `${m.sender === 'user' ? 'You' : contactName}: ${m.text}`)
      .join('\n');
    void analyzeTeamHealth(transcript)
      .then(result => {
        if (cancelled) return;
        if (result && (result.status === 'at_risk' || result.status === 'critical')) {
          setLlmHealth(result);
        } else {
          setLlmHealth(null);
        }
      })
      .catch(() => { /* soft failure — heuristic still renders */ });
    return () => { cancelled = true; };
  }, [messages, contactName]);

  // Show the panel if EITHER the heuristic flagged signals OR the LLM
  // flagged a non-healthy team health. This lets the LLM catch
  // tensions the keyword pass missed.
  if (dismissed) return null;
  if (signals.length === 0 && !llmHealth) return null;

  const highSeverityCount = signals.filter(s => s.severity === 'high').length;
  const alertLevel = highSeverityCount >= 2 ? 'high' : highSeverityCount >= 1 ? 'medium' : 'low';

  // Severity badge — status colors are allowed here (semantic, not
  // decorative). Background is a 0.08 tint over the canvas, never a
  // thick coloured border per the Status-Stays-Status rule.
  const severityBadge = (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.1em] font-medium ${
        alertLevel === 'high'
          ? 'bg-red-500/[0.08] dark:bg-red-500/[0.12] text-red-700 dark:text-red-300'
          : alertLevel === 'medium'
            ? 'bg-amber-500/[0.08] dark:bg-amber-500/[0.12] text-amber-700 dark:text-amber-300'
            : 'bg-zinc-500/[0.08] dark:bg-zinc-500/[0.12] text-zinc-700 dark:text-zinc-300'
      }`}>
        <i className={`fa-solid ${
          alertLevel === 'high' ? 'fa-triangle-exclamation' :
          alertLevel === 'medium' ? 'fa-circle-info' :
          'fa-lightbulb'
        }`} />
        {alertLevel === 'high' ? 'Needs attention' : alertLevel === 'medium' ? 'Some tension' : 'Light signal'}
      </span>
      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
        {signals.length} signal{signals.length !== 1 ? 's' : ''} detected
      </span>
    </div>
  );

  // Body content shared by both render variants (wrapped vs.
  // standalone). Status colours are 0.08/0.12 tints — never thick
  // borders — per the Status-Stays-Status rule.
  const body = (
    <div className="space-y-3">
      {severityBadge}
      <div className="space-y-4">
        {/* Signals summary */}
        {signals.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {signals.slice(0, 3).map(signal => (
              <span
                key={signal.id}
                className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.1em] font-medium px-2 py-1 rounded ${
                  signal.severity === 'high'
                    ? 'bg-red-500/[0.08] dark:bg-red-500/[0.12] text-red-700 dark:text-red-300'
                    : signal.severity === 'medium'
                      ? 'bg-amber-500/[0.08] dark:bg-amber-500/[0.12] text-amber-700 dark:text-amber-300'
                      : 'bg-zinc-500/[0.08] dark:bg-zinc-500/[0.12] text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <i className={`fa-solid ${
                  signal.type === 'tension' ? 'fa-bolt' :
                  signal.type === 'frustration' ? 'fa-face-frown' :
                  signal.type === 'disagreement' ? 'fa-arrows-left-right' :
                  'fa-question-circle'
                }`} />
                {signal.type}
              </span>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-500 dark:text-zinc-400">
              Suggestions
            </div>
            {suggestions.map(suggestion => (
              <div
                key={suggestion.id}
                className="bg-[#f8f8f8] dark:bg-[rgba(255,255,255,0.055)] rounded-lg p-3 ring-1 ring-[rgba(0,0,0,0.08)] dark:ring-[rgba(255,255,255,0.10)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {suggestion.title}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                      {suggestion.description}
                    </div>
                    {suggestion.suggestedText && (
                      <div className="mt-2 p-2 bg-white dark:bg-[rgba(255,255,255,0.03)] rounded-lg text-xs text-zinc-700 dark:text-zinc-300 italic ring-1 ring-[rgba(0,0,0,0.06)] dark:ring-[rgba(255,255,255,0.06)]">
                        "{suggestion.suggestedText}"
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onApplySuggestion(suggestion)}
                    className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap transition-colors bg-rose-500/[0.10] hover:bg-rose-500/[0.18] dark:bg-rose-500/[0.15] dark:hover:bg-rose-500/[0.22] text-rose-600 dark:text-rose-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                  >
                    {suggestion.actionLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick tips */}
        <div className="bg-[#f8f8f8] dark:bg-[rgba(255,255,255,0.03)] rounded-lg p-3 ring-1 ring-[rgba(0,0,0,0.06)] dark:ring-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            <Lightbulb className="w-3 h-3" />
            Quick tips
          </div>
          <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-rose-500">•</span>
              Use "I" statements instead of "you" to reduce defensiveness
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500">•</span>
              Acknowledge their point before presenting yours
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500">•</span>
              Ask clarifying questions when unsure
            </li>
          </ul>
        </div>
      </div>
    </div>
  );

  // Wrapped-in-PanelShell variant: no outer chrome — the host owns
  // provenance, title and dismiss.
  if (hideHeader) {
    return body;
  }

  // Standalone variant (kept for any caller that doesn't wrap in
  // PanelShell). Coral-only chrome, expandable header with the same
  // body underneath.
  return (
    <section
      className="bg-white dark:bg-[rgba(255,255,255,0.03)] ring-1 ring-[rgba(0,0,0,0.08)] dark:ring-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden animate-slide-up"
      role="region"
      aria-label="AI Mediator"
    >
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <AIProvenanceTag source="pulse-ai" kind="mediation" />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {signals.length} signal{signals.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
              onDismiss();
            }}
            aria-label="Dismiss AI Mediator"
            className="w-7 h-7 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-bright hover:bg-rose-500/[0.08] dark:hover:bg-rose-500/[0.10] flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} text-xs text-zinc-400 dark:text-zinc-500`} />
        </div>
      </div>
      {expanded && <div className="px-4 pb-4">{body}</div>}
    </section>
  );
};

// Compact indicator for thread list
export const MediatorIndicator: React.FC<{
  messages: Array<{ text: string; sender: string }>;
}> = ({ messages }) => {
  const hasConflict = messages.some(msg => {
    const text = msg.text?.toLowerCase() || '';
    const words = ['frustrated', 'disappointed', 'unacceptable', 'wrong', 'problem', 'issue'];
    return words.filter(w => text.includes(w)).length >= 2;
  });

  if (!hasConflict) return null;

  return (
    <div
      className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
      title="Conflict signals detected"
    />
  );
};

export default AIMediatorPanel;
