/**
 * MessageList — Notebook chat transcript.
 *
 * Faithful port of PulseStudio's message render (handoff Phase 2). Renders the
 * user / AI bubbles with provenance, inline artifacts (artifactParser +
 * ArtifactRenderers), pin-to-board + copy actions, and auto-scroll.
 *
 * The basic citation strip and the inline thinking toggle are ported as-is and
 * are deliberately the seams that later phases enrich in place:
 *   • Phase 3 → CitationChip + SourcesUsedPanel replace the `.ps-citation` strip.
 *   • Phase 4 → ReasoningTrace replaces the inline thinking toggle/panel.
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';
import { parseMessageContent, hasLikelyArtifacts, MessageSegment } from '../artifactParser';
import { InlineArtifact } from '../ArtifactRenderers';
import { MarkdownContent } from '../MarkdownContent';
import { ProvenanceTag } from '../ProvenanceTag';
import type { NoteType } from '../useBoardNotes';

import { Brain, Copy, FileText, Pin, Sparkles, User as UserIcon } from 'lucide-react';

export interface MessageListProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  expandedThinking: Set<string>;
  toggleThinking: (id: string) => void;
  /** Display name of the active agent — used for provenance + artifact model. */
  agentName: string;
  onPinArtifact?: (content: string, type: NoteType) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  thinkingLogs,
  expandedThinking,
  toggleThinking,
  agentName,
  onPinArtifact,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const safeMessages = Array.isArray(messages) ? messages : [];

  // ── Artifact parsing cache (memoized per message content) ────────────────
  const parsedMessages = useMemo(() => {
    const cache = new Map<string, MessageSegment[]>();
    for (const msg of safeMessages) {
      if (msg.role === 'assistant' && hasLikelyArtifacts(msg.content)) {
        cache.set(msg.id, parseMessageContent(msg.content));
      }
    }
    return cache;
  }, [safeMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [safeMessages, isLoading]);

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
  };

  const renderMessage = (msg: AIMessage, idx: number) => {
    const isUser = msg.role === 'user';
    const thinking = thinkingLogs.get(msg.id);
    const isThinkingExpanded = expandedThinking.has(msg.id);
    const segments = parsedMessages.get(msg.id);
    const hasArtifacts = segments && segments.some((s) => s.kind === 'artifact');

    return (
      <div key={msg.id || idx} className={`ps-message ps-message--${msg.role}`}>
        <div className="ps-message-avatar">
          {isUser ? <UserIcon size={15} /> : <Sparkles size={15} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* AI provenance — Pulse signature */}
          {!isUser && (
            <ProvenanceTag
              model={agentName}
              kind={hasArtifacts ? undefined : 'response'}
              className="ps-message-provenance"
            />
          )}

          <div className="ps-message-content">
            {/* Thinking toggle (Phase 4 → ReasoningTrace) */}
            {thinking && thinking.length > 0 && (
              <button className="ps-thinking-toggle" onClick={() => toggleThinking(msg.id)}>
                <Brain size={12} />
                {isThinkingExpanded ? 'Hide' : 'Show'} thinking ({thinking.length} steps)
              </button>
            )}

            {/* Thinking steps */}
            {thinking && isThinkingExpanded && (
              <div className="ps-thinking-panel">
                {thinking.map((step, i) => (
                  <div key={i} className="ps-thinking-step">
                    <span className="ps-thinking-step-time">[{step.duration_ms}ms]</span>
                    {step.thought}
                  </div>
                ))}
              </div>
            )}

            {/* Message content — inline artifacts for AI messages */}
            {hasArtifacts ? (
              segments!.map((seg, si) =>
                seg.kind === 'text' ? (
                  <MarkdownContent key={si} content={seg.content} />
                ) : (
                  <InlineArtifact key={si} artifact={seg.artifact} model={agentName} onPin={onPinArtifact} />
                ),
              )
            ) : isUser ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            ) : (
              <MarkdownContent content={msg.content} />
            )}

            {/* Citations (Phase 3 → CitationChip + SourcesUsedPanel) */}
            {msg.citations && msg.citations.length > 0 && (
              <div className="ps-message-citations">
                {msg.citations.map((c: any, i: number) => (
                  <span key={i} className="ps-citation">
                    <FileText size={10} />
                    {c.title || c}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Message action buttons (pin, copy) — shown on hover */}
          {!isUser && (
            <div className="ps-message-actions">
              {onPinArtifact && (
                <button
                  className="ps-message-action-btn"
                  onClick={() => onPinArtifact(msg.content.substring(0, 500), 'finding')}
                  title="Pin to Artifacts"
                >
                  <Pin size={12} />
                </button>
              )}
              <button
                className="ps-message-action-btn"
                onClick={() => handleCopyMessage(msg.content)}
                title="Copy message"
              >
                <Copy size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="ps-messages">
      {safeMessages.map((msg, i) => renderMessage(msg, i))}

      {/* Loading indicator */}
      {isLoading && (
        <div className="ps-message ps-message--assistant">
          <div className="ps-message-avatar">
            <Sparkles size={15} />
          </div>
          <div className="ps-message-content">
            <div className="ps-typing">
              <div className="ps-typing-dot" />
              <div className="ps-typing-dot" />
              <div className="ps-typing-dot" />
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
