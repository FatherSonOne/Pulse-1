/**
 * IntelMode — Phase 4: Source-Grounded Q&A
 *
 * AI answers ONLY from ingested sources. Every factual claim must cite a
 * numbered source [1][2]. Citations are parsed from the AI response and
 * rendered as clickable badges that expand a references panel inline.
 *
 * System prompt enforcement happens in LiveDashboard.sendMessageDirect
 * when warRoomMode === 'intel'.
 */

import React, { useState, useRef, useEffect } from 'react';
import { AIMessage, ThinkingStep } from '../../../services/ragService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntelModeProps {
  messages: AIMessage[];
  isLoading: boolean;
  thinkingLogs: Map<string, ThinkingStep[]>;
  onSendMessage: (text: string) => void;
  onNewSession?: () => void;
  sessionId: string;
  sessionTitle: string;
  /** docSummaries format, same as other modes */
  documents: { title: string; summary?: string }[];
  /** How many docs are currently active in context */
  activeContextCount?: number;
}

// ─── Citation parsing ─────────────────────────────────────────────────────────

interface ParsedCitation {
  index: number;
  title: string;
  passage: string;
}

interface ParsedMessage {
  body: string;
  citations: ParsedCitation[];
}

/** Split AI response into body text + structured References section */
function parseMessage(content: string): ParsedMessage {
  // Look for a References / Sources section at the end
  const refPattern = /\n+(?:References?|Sources?):?\n+([\s\S]+?)$/i;
  const refMatch = content.match(refPattern);

  const body = refMatch
    ? content.slice(0, content.indexOf(refMatch[0])).trim()
    : content;

  const citations: ParsedCitation[] = [];

  if (refMatch) {
    const lines = refMatch[1].split('\n').filter((l) => l.trim());
    for (const line of lines) {
      // Match: [n] Title - "passage" or [n] Title — passage
      const m = line.match(/^\[(\d+)\]\s+(.+?)\s+[-–—]\s+"?(.+?)"?\s*$/);
      if (m) {
        citations.push({
          index: parseInt(m[1], 10),
          title: m[2].trim(),
          passage: m[3].trim(),
        });
      }
    }
  }

  return { body, citations };
}

// ─── Inline citation renderer ─────────────────────────────────────────────────

const CitationBadge: React.FC<{
  num: number;
  active: boolean;
  onClick: () => void;
}> = ({ num, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 18,
      height: 18,
      borderRadius: 4,
      backgroundColor: active ? 'var(--wr-accent-secondary)' : 'rgba(6,182,212,0.2)',
      border: `1px solid ${active ? 'var(--wr-accent-secondary)' : 'rgba(6,182,212,0.4)'}`,
      color: active ? '#0a0a0f' : 'var(--wr-accent-secondary)',
      fontSize: 9,
      fontFamily: 'var(--wr-font-mono)',
      fontWeight: 700,
      cursor: 'pointer',
      verticalAlign: 'middle',
      margin: '0 1px',
      transition: 'all var(--wr-transition-fast)',
      flexShrink: 0,
    }}
  >
    {num}
  </button>
);

/** Render text body with [n] markers replaced by clickable citation badges */
function renderBody(
  text: string,
  citations: ParsedCitation[],
  activeCitation: number | null,
  onCitationClick: (n: number) => void,
): React.ReactNode[] {
  const segments = text.split(/(\[\d+\])/g);
  return segments.map((seg, i) => {
    const m = seg.match(/^\[(\d+)\]$/);
    if (m) {
      const n = parseInt(m[1], 10);
      const exists = citations.some((c) => c.index === n);
      return (
        <CitationBadge
          key={i}
          num={n}
          active={activeCitation === n}
          onClick={() => exists && onCitationClick(n)}
        />
      );
    }
    return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{seg}</span>;
  });
}

// ─── Message bubble ───────────────────────────────────────────────────────────

const IntelMessageBubble: React.FC<{
  message: AIMessage;
}> = ({ message }) => {
  const [activeCitation, setActiveCitation] = useState<number | null>(null);
  const isAI = message.role === 'assistant';
  const parsed = isAI ? parseMessage(message.content) : null;

  const handleCitationClick = (n: number) => {
    setActiveCitation((prev) => (prev === n ? null : n));
  };

  const activeCitationData = parsed?.citations.find((c) => c.index === activeCitation);

  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--wr-border)',
        backgroundColor: isAI ? 'transparent' : 'rgba(244,63,94,0.04)',
      }}
    >
      {/* Role label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 7,
        }}
      >
        <i
          className={`fa ${isAI ? 'fa-satellite-dish' : 'fa-user'}`}
          style={{
            fontSize: 11,
            color: isAI ? 'var(--wr-accent-secondary)' : 'var(--wr-accent-primary)',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--wr-font-mono)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: isAI ? 'var(--wr-accent-secondary)' : 'var(--wr-accent-primary)',
          }}
        >
          {isAI ? 'Intel AI' : 'Operator'}
        </span>
      </div>

      {/* Message body */}
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.65,
          color: 'var(--wr-text-primary)',
        }}
      >
        {isAI && parsed
          ? renderBody(parsed.body, parsed.citations, activeCitation, handleCitationClick)
          : message.content}
      </div>

      {/* Active citation expansion */}
      {isAI && activeCitationData && (
        <div
          style={{
            marginTop: 10,
            padding: '9px 12px',
            backgroundColor: 'rgba(6,182,212,0.08)',
            borderLeft: '2px solid var(--wr-accent-secondary)',
            borderRadius: '0 var(--wr-radius-sm) var(--wr-radius-sm) 0',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--wr-font-mono)',
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--wr-accent-secondary)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 5,
            }}
          >
            <i className="fa fa-link" style={{ marginRight: 5 }} />
            [{activeCitation}] {activeCitationData.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--wr-text-secondary)',
              lineHeight: 1.6,
              fontStyle: 'italic',
            }}
          >
            "{activeCitationData.passage}"
          </div>
        </div>
      )}

      {/* Citation count badge */}
      {isAI && parsed && parsed.citations.length > 0 && (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--wr-font-mono)',
              fontSize: 9,
              color: 'var(--wr-text-muted)',
              letterSpacing: '0.06em',
            }}
          >
            {parsed.citations.length} source{parsed.citations.length !== 1 ? 's' : ''} cited:
          </span>
          {parsed.citations.map((c) => (
            <button
              key={c.index}
              onClick={() => handleCitationClick(c.index)}
              style={{
                fontSize: 9,
                padding: '1px 6px',
                borderRadius: 3,
                border: `1px solid ${activeCitation === c.index ? 'var(--wr-accent-secondary)' : 'var(--wr-border)'}`,
                background: activeCitation === c.index ? 'rgba(6,182,212,0.15)' : 'transparent',
                color: activeCitation === c.index ? 'var(--wr-accent-secondary)' : 'var(--wr-text-muted)',
                cursor: 'pointer',
                fontFamily: 'var(--wr-font-mono)',
                letterSpacing: '0.04em',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={c.title}
            >
              [{c.index}] {c.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── IntelMode (main export) ──────────────────────────────────────────────────

export const IntelMode: React.FC<IntelModeProps> = ({
  messages,
  isLoading,
  onSendMessage,
  sessionTitle,
  documents,
  activeContextCount,
}) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const sourceCount = activeContextCount ?? documents.length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    onSendMessage(text);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--wr-bg-primary)',
      }}
    >
      {/* ── Mode header ────────────────────────────────────────── */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--wr-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          backgroundColor: 'var(--wr-bg-secondary)',
        }}
      >
        <i className="fa fa-satellite-dish" style={{ fontSize: 14, color: 'var(--wr-accent-secondary)' }} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: 'var(--wr-font-mono)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--wr-accent-secondary)',
            }}
          >
            Intel Mode
          </div>
          <div
            style={{
              fontFamily: 'var(--wr-font-mono)',
              fontSize: 9,
              color: 'var(--wr-text-muted)',
              marginTop: 1,
            }}
          >
            {sessionTitle}
          </div>
        </div>

        {/* Source grounding indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 12,
            border: `1px solid ${sourceCount > 0 ? 'rgba(6,182,212,0.4)' : 'var(--wr-border)'}`,
            backgroundColor: sourceCount > 0 ? 'rgba(6,182,212,0.08)' : 'transparent',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: sourceCount > 0 ? 'var(--wr-accent-secondary)' : 'var(--wr-text-muted)',
              boxShadow: sourceCount > 0 ? '0 0 5px var(--wr-accent-secondary)' : 'none',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--wr-font-mono)',
              fontSize: 10,
              color: sourceCount > 0 ? 'var(--wr-accent-secondary)' : 'var(--wr-text-muted)',
              letterSpacing: '0.06em',
            }}
          >
            {sourceCount > 0
              ? `${sourceCount} source${sourceCount !== 1 ? 's' : ''} active`
              : 'No sources — ingest intel first'}
          </span>
        </div>

        {/* Strict mode badge */}
        <div
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            backgroundColor: 'rgba(244,63,94,0.12)',
            border: '1px solid rgba(244,63,94,0.3)',
            fontFamily: 'var(--wr-font-mono)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'var(--wr-accent-primary)',
          }}
        >
          STRICT
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {messages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 16,
              padding: 32,
              textAlign: 'center',
            }}
          >
            <i
              className="fa fa-satellite-dish"
              style={{ fontSize: 36, color: 'var(--wr-accent-secondary)', opacity: 0.3 }}
            />
            <div>
              <div
                style={{
                  fontFamily: 'var(--wr-font-mono)',
                  fontSize: 13,
                  color: 'var(--wr-text-secondary)',
                  marginBottom: 8,
                }}
              >
                Intel Mode Active
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--wr-text-muted)',
                  lineHeight: 1.6,
                  maxWidth: 320,
                }}
              >
                {sourceCount > 0
                  ? `Ask any question. Answers will be grounded in your ${sourceCount} active source${sourceCount !== 1 ? 's' : ''} with numbered citations.`
                  : 'Ingest sources via the Intel Desk first, then ask questions grounded in your documents.'}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => <IntelMessageBubble key={msg.id} message={msg} />)
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <i
              className="fa fa-satellite-dish wr-data-pulse"
              style={{ fontSize: 13, color: 'var(--wr-accent-secondary)' }}
            />
            <span
              style={{
                fontFamily: 'var(--wr-font-mono)',
                fontSize: 11,
                color: 'var(--wr-text-muted)',
                letterSpacing: '0.06em',
              }}
            >
              Scanning intel sources...
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────── */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--wr-border)',
          backgroundColor: 'var(--wr-bg-secondary)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sourceCount > 0 ? 'Query your intel sources…' : 'Ingest sources first…'}
            disabled={isLoading || sourceCount === 0}
            rows={2}
            style={{
              flex: 1,
              resize: 'none',
              padding: '8px 10px',
              borderRadius: 'var(--wr-radius-sm)',
              border: '1px solid var(--wr-border)',
              backgroundColor: 'var(--wr-bg-surface)',
              color: 'var(--wr-text-primary)',
              fontSize: 13,
              fontFamily: 'var(--wr-font-sans)',
              outline: 'none',
              lineHeight: 1.5,
              opacity: sourceCount === 0 ? 0.5 : 1,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || sourceCount === 0}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--wr-radius-sm)',
              border: 'none',
              backgroundColor:
                input.trim() && !isLoading && sourceCount > 0
                  ? 'var(--wr-accent-secondary)'
                  : 'var(--wr-bg-elevated)',
              color:
                input.trim() && !isLoading && sourceCount > 0
                  ? '#0a0a0f'
                  : 'var(--wr-text-muted)',
              fontSize: 11,
              fontFamily: 'var(--wr-font-mono)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              cursor: input.trim() && !isLoading && sourceCount > 0 ? 'pointer' : 'not-allowed',
              flexShrink: 0,
              transition: 'all var(--wr-transition-fast)',
            }}
          >
            <i className="fa fa-paper-plane" style={{ marginRight: 5 }} />
            TRANSMIT
          </button>
        </div>
        <div
          style={{
            marginTop: 5,
            fontFamily: 'var(--wr-font-mono)',
            fontSize: 9,
            color: 'var(--wr-text-muted)',
            letterSpacing: '0.04em',
          }}
        >
          Enter to send · Shift+Enter for newline · Citations appear as [1][2] — click to expand
        </div>
      </div>
    </div>
  );
};

export default IntelMode;
