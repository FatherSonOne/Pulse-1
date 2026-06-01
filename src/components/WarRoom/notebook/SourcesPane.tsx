/**
 * SourcesPane — left pane of the Notebook shell.
 *
 * Wraps the reused-verbatim `IntelDesk` (the real source library + per-doc
 * context toggle + upload + view/delete) and layers two Notebook additions on
 * top, per handoff §4.2 / Phase 1:
 *   1. ActiveContextBar — first-class "N of M grounding the AI" coral strip.
 *   2. Tag-filter chips — client-side filter by distinct file type (All + …),
 *      shown only when there's more than one type. Full tag/collection
 *      management still lives in the Organize modal (P2).
 *
 * IntelDesk is passed the already-filtered document list; every other prop is
 * forwarded untouched so the existing handlers/store wiring are preserved.
 */

import React, { useMemo, useState } from 'react';
import { IntelDesk, IntelDeskProps } from '../IntelDesk';
import { ActiveContextBar } from './ActiveContextBar';

export type SourcesPaneProps = IntelDeskProps;

/** Normalize a raw file_type into a short, human filter label. */
function typeLabel(fileType: string | undefined): string {
  const t = (fileType || '').toLowerCase();
  if (t.includes('pdf')) return 'PDF';
  if (t.includes('doc')) return 'Docs';
  if (t.includes('xls')) return 'Sheets';
  if (t.includes('png') || t.includes('jpg') || t.includes('jpeg') || t.includes('gif') || t.includes('image'))
    return 'Images';
  if (t.includes('url') || t.includes('http')) return 'Links';
  if (t.includes('txt') || t.includes('text') || t.includes('md')) return 'Text';
  return 'Other';
}

export const SourcesPane: React.FC<SourcesPaneProps> = (props) => {
  const { documents, activeContextDocs } = props;
  const [tag, setTag] = useState<string>('All');

  // ── Active-context counts (completed docs only — pending/failed can't ground) ──
  const completed = useMemo(
    () => documents.filter((d) => d.processing_status === 'completed'),
    [documents],
  );
  const activeCount = useMemo(
    () => completed.filter((d) => activeContextDocs.has(d.id)).length,
    [completed, activeContextDocs],
  );
  const usingAll = activeContextDocs.size === 0;

  // ── Tag chips from distinct file types ──────────────────────────────────────
  const tags = useMemo(() => {
    const seen = new Set<string>();
    for (const d of documents) seen.add(typeLabel(d.file_type));
    return ['All', ...Array.from(seen).sort()];
  }, [documents]);

  const filteredDocs = useMemo(
    () => (tag === 'All' ? documents : documents.filter((d) => typeLabel(d.file_type) === tag)),
    [documents, tag],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ActiveContextBar activeCount={activeCount} total={completed.length} usingAll={usingAll} />

      {/* Tag-filter chips — only meaningful with mixed file types */}
      {tags.length > 2 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            padding: '6px 12px',
            borderBottom: '1px solid var(--pulse-border)',
            flexShrink: 0,
          }}
        >
          {tags.map((t) => {
            const active = tag === t;
            return (
              <button
                key={t}
                onClick={() => setTag(t)}
                style={{
                  padding: '2px 9px',
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--pulse-font-mono)',
                  letterSpacing: '0.04em',
                  border: `1px solid ${active ? 'var(--pulse-border-strong)' : 'var(--pulse-border)'}`,
                  background: active ? 'var(--pulse-surface)' : 'transparent',
                  color: active ? 'var(--pulse-ink)' : 'var(--pulse-ink-3)',
                  transition: 'all var(--pulse-duration) var(--pulse-ease)',
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}

      {/* Reused-verbatim source library, fed the tag-filtered list */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <IntelDesk {...props} documents={filteredDocs} />
      </div>
    </div>
  );
};

export default SourcesPane;
