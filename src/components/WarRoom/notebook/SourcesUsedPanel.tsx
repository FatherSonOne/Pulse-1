/**
 * SourcesUsedPanel — "SOURCES USED · N PASSAGES" under a grounded answer
 * (handoff Phase 3, P0).
 *
 * Renders from `AIMessage.citations` (verified shape, D2:
 * `{ title, source?, excerpt?, similarity? }`). Each row shows a CitationChip
 * `[n]`, the source title (+ `source` as a location hint when present), and the
 * cited passage excerpt. Clicking a row opens the matched document in
 * DocumentViewer with the passage highlighted, via the `onOpen` callback
 * (wired to setViewingDoc + setViewerHighlightText upstream).
 *
 * Whole surface is coral (AI grounding). When a citation can't be matched to a
 * known document the row still renders (title + excerpt) but isn't clickable.
 */

import React from 'react';
import { AICitation, KnowledgeDoc } from '../../../services/ragService';
import { CitationChip } from './CitationChip';
import { Quote } from 'lucide-react';

export interface SourcesUsedPanelProps {
  citations: AICitation[];
  documents: KnowledgeDoc[];
  /** Open the matched doc with the passage highlighted. */
  onOpen: (doc: KnowledgeDoc, passage?: string) => void;
}

/** Resolve a citation to a known document by title (case-insensitive). */
export function matchDoc(citation: AICitation, documents: KnowledgeDoc[]): KnowledgeDoc | undefined {
  const t = (citation.title || '').trim().toLowerCase();
  if (!t) return undefined;
  return (
    documents.find((d) => d.title.trim().toLowerCase() === t) ||
    documents.find((d) => d.title.trim().toLowerCase().includes(t) || t.includes(d.title.trim().toLowerCase()))
  );
}

export const SourcesUsedPanel: React.FC<SourcesUsedPanelProps> = ({ citations, documents, onOpen }) => {
  if (!citations || citations.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 'var(--ps-radius-md, 10px)',
        background: 'var(--pulse-coral-bg-08)',
        border: '1px solid var(--pulse-rose-soft)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Quote size={13} style={{ color: 'var(--pulse-coral-fg)' }} />
        <span
          style={{
            fontFamily: 'var(--pulse-font-mono)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--pulse-coral-fg)',
          }}
        >
          Sources Used · {citations.length} passage{citations.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {citations.map((c, i) => {
          const doc = matchDoc(c, documents);
          const open = doc ? () => onOpen(doc, c.excerpt) : undefined;
          return (
            <div
              key={i}
              role={open ? 'button' : undefined}
              tabIndex={open ? 0 : undefined}
              onClick={open}
              onKeyDown={
                open
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        open();
                      }
                    }
                  : undefined
              }
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '4px 6px',
                borderRadius: 6,
                cursor: open ? 'pointer' : 'default',
              }}
              onMouseEnter={(e) => {
                if (open) e.currentTarget.style.background = 'var(--pulse-surface)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ marginTop: 2, flexShrink: 0 }}>
                <CitationChip n={i + 1} onClick={open} title={open ? 'Open source' : undefined} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--pulse-ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.title || 'Source'}
                  {c.source && (
                    <span style={{ color: 'var(--pulse-ink-3)', fontWeight: 400 }}> · {c.source}</span>
                  )}
                </div>
                {c.excerpt && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--pulse-ink-2)',
                      lineHeight: 1.4,
                      marginTop: 2,
                      fontStyle: 'italic',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {c.excerpt}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SourcesUsedPanel;
