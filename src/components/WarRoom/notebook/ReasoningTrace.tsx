/**
 * ReasoningTrace — tasteful "show your work" disclosure (handoff Phase 4, P1).
 *
 * Collapsible, coral-but-muted. Reads the message's `thinkingLogs` steps and is
 * collapsed by default; expanding reveals the numbered steps with their
 * durations. Renders nothing when there are no steps (the log's presence is the
 * gate — logs only exist when extended thinking ran). Coral is on-budget
 * (reasoning is an AI-output surface, CLAUDE.md §4), kept muted so it reads as
 * secondary to the answer.
 */

import React from 'react';
import { ThinkingStep } from '../../../services/ragService';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';

export interface ReasoningTraceProps {
  steps: ThinkingStep[];
  expanded: boolean;
  onToggle: () => void;
}

export const ReasoningTrace: React.FC<ReasoningTraceProps> = ({ steps, expanded, onToggle }) => {
  if (!steps || steps.length === 0) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={onToggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 8px',
          borderRadius: 6,
          border: '1px solid var(--pulse-rose-soft)',
          background: 'var(--pulse-coral-bg-08)',
          color: 'var(--pulse-coral-fg)',
          cursor: 'pointer',
          fontFamily: 'var(--pulse-font-mono)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: 0.85,
        }}
      >
        <Brain size={11} />
        Thought for {steps.length} step{steps.length !== 1 ? 's' : ''}
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>

      {expanded && (
        <div
          style={{
            marginTop: 6,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--pulse-rose-soft)',
            background: 'var(--pulse-coral-bg-08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 8,
                fontSize: 12,
                color: 'var(--pulse-ink-2)',
                lineHeight: 1.45,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  fontFamily: 'var(--pulse-font-mono)',
                  fontSize: 10,
                  color: 'var(--pulse-coral-fg)',
                  opacity: 0.8,
                  minWidth: 44,
                }}
              >
                {typeof step.duration_ms === 'number' ? `${step.duration_ms}ms` : `#${i + 1}`}
              </span>
              <span style={{ minWidth: 0 }}>{step.thought}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReasoningTrace;
