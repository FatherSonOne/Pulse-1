/**
 * DockedVoice — the realtime voice agent, docked inline (handoff Phase 6, P0).
 *
 * Re-homes the CANONICAL VoiceAgentPanel → RealtimeVoiceAgent →
 * realtimeAgentService path into an inline strip in the chat pane, instead of
 * the floating `position:fixed` shell that WarRoomModalStack renders on the
 * legacy path. We restyle the container only — the panel itself (transcript,
 * rag_search tool calls, coral visualizer, voice modes, history/export) is
 * reused verbatim, so there is exactly one voice implementation (invariant 3).
 *
 * Grounding is shared: the same `activeContextDocs` set is passed as
 * `activeContextIds`, so voice answers ground on the same sources as chat.
 *
 * When flag-ON, WarRoomModalStack suppresses its floating voice block
 * (dockVoiceInline), so only this docked instance mounts — no double WebRTC.
 */

import React, { Suspense, lazy } from 'react';
import { KnowledgeDoc } from '../../../services/ragService';
import { ErrorBoundary } from '../../shared/ErrorBoundary';
import { Loader2, MicOff } from 'lucide-react';

const VoiceAgentPanel = lazy(() =>
  import('../VoiceAgentPanel').then((m) => ({ default: m.VoiceAgentPanel })),
);

export interface DockedVoiceProps {
  userId: string;
  projectId?: string;
  sessionId?: string;
  openaiApiKey: string;
  /** Workspace id forwarded to the realtime voice token mint (hosted tier-gating). */
  workspaceId?: string;
  documents: KnowledgeDoc[];
  activeContextIds: Set<string>;
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  /** 'stage' = render the radial voice centerpiece instead of the inline strip. */
  chrome?: 'full' | 'stage';
}

export const DockedVoice: React.FC<DockedVoiceProps> = ({
  userId,
  projectId,
  sessionId,
  openaiApiKey,
  workspaceId,
  documents,
  activeContextIds,
  expanded,
  onToggleExpand,
  onClose,
  chrome = 'full',
}) => {
  return (
    <div
      style={chrome === 'stage'
        ? {
            // Thin coral frame so the Live view reads as a contained AI module,
            // not a blank page. On-budget: the voice stage is an AI surface.
            flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
            background: 'var(--pulse-surface)',
            border: '1px solid var(--pulse-rose-glow)',
            borderRadius: 16,
            margin: '8px 12px 12px',
            boxShadow: '0 0 32px var(--pulse-rose-softer)',
            overflow: 'hidden',
          }
        : { padding: '8px 12px', borderTop: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)', flexShrink: 0 }}
    >
      <ErrorBoundary
        componentName="Voice Agent"
        fallback={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 10,
              borderRadius: 10,
              border: '1px solid var(--pulse-border)',
              color: '#f59e0b',
              fontSize: 13,
            }}
          >
            <MicOff size={16} />
            Voice agent unavailable
            <button
              onClick={onClose}
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 6,
                border: '1px solid var(--pulse-border)',
                background: 'transparent',
                color: 'var(--pulse-ink-2)',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        }
      >
        <Suspense
          fallback={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, color: 'var(--pulse-ink-3)', fontSize: 13 }}>
              <Loader2 size={16} className="animate-spin" />
              Loading voice agent…
            </div>
          }
        >
          <VoiceAgentPanel
            userId={userId}
            projectId={projectId}
            sessionId={sessionId}
            openaiApiKey={openaiApiKey}
            workspaceId={workspaceId}
            onClose={onClose}
            onRequestClose={onClose}
            chrome={chrome}
            isExpanded={expanded}
            onToggleExpand={onToggleExpand}
            documents={documents}
            activeContextIds={activeContextIds}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

export default DockedVoice;
