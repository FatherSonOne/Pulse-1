/**
 * SourcesPane — left column of the Notebook, built to the mockup.
 *
 * Renders the source library DIRECTLY (active-context card → search → tag chips
 * → checkbox doc rows) instead of wrapping the legacy IntelDesk (which carried
 * its own toolbar). Wires to the SAME store handlers the rest of War Room uses
 * (onToggleDoc / onUpload / onViewDoc / onDeleteDoc / onAddAllDocs /
 * onClearAllDocs) — engine reuse, fresh presentation.
 *
 * The active-context card is coral (AI-grounding surface, CLAUDE.md §4).
 * `activeContextDocs.size === 0` is surfaced as "All N grounding" (invariant 2).
 */

import React, { useMemo, useRef, useState } from 'react';
import { KnowledgeDoc } from '../../../services/ragService';
import { Check, Eye, FolderOpen, Loader2, Search, Trash2, Upload } from 'lucide-react';

export interface SourcesPaneProps {
  documents: KnowledgeDoc[];
  activeContextDocs: Set<string>;
  uploadingFiles: Set<string>;
  uploadProgress: Map<string, number>;
  onToggleDoc: (id: string) => void;
  onDeleteDoc: (id: string) => void;
  onViewDoc: (id: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddAllDocs: () => void;
  onClearAllDocs: () => void;
}

function typeLabel(fileType: string | undefined): string {
  const t = (fileType || '').toLowerCase();
  if (t.includes('pdf')) return 'PDF';
  if (t.includes('doc')) return 'DOCX';
  if (t.includes('xls')) return 'XLSX';
  if (t.includes('png') || t.includes('jpg') || t.includes('jpeg') || t.includes('gif') || t.includes('image')) return 'IMG';
  if (t.includes('url') || t.includes('http')) return 'LINK';
  if (t.includes('md')) return 'MD';
  if (t.includes('txt') || t.includes('text')) return 'TXT';
  return 'DOC';
}

export const SourcesPane: React.FC<SourcesPaneProps> = ({
  documents,
  activeContextDocs,
  uploadingFiles,
  uploadProgress,
  onToggleDoc,
  onDeleteDoc,
  onViewDoc,
  onUpload,
  onAddAllDocs,
  onClearAllDocs,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('All');

  const completed = useMemo(() => documents.filter((d) => d.processing_status === 'completed'), [documents]);
  const activeCount = useMemo(
    () => completed.filter((d) => activeContextDocs.has(d.id)).length,
    [completed, activeContextDocs],
  );
  const usingAll = activeContextDocs.size === 0;

  const tags = useMemo(() => {
    const seen = new Set<string>();
    for (const d of documents) seen.add(typeLabel(d.file_type));
    return ['All', ...Array.from(seen).sort()];
  }, [documents]);

  const shown = useMemo(() => {
    let list = documents;
    if (tag !== 'All') list = list.filter((d) => typeLabel(d.file_type) === tag);
    if (search.trim()) list = list.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [documents, tag, search]);

  const uploadingArr = Array.from(uploadingFiles);

  const groundingLabel =
    completed.length === 0
      ? 'No sources grounding the AI yet'
      : usingAll
        ? `All ${completed.length} grounding the AI`
        : `${activeCount} of ${completed.length} grounding the AI`;
  const grounded = completed.length > 0 && (usingAll || activeCount > 0);

  return (
    <>
      {/* Header + active-context + search + tags */}
      <div style={{ padding: '14px 14px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderOpen size={16} style={{ color: 'var(--pulse-ink-2)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--pulse-ink)' }}>Sources</span>
            <span style={{ fontFamily: 'var(--pulse-font-mono)', fontSize: 11, color: 'var(--pulse-ink-3)' }}>
              {documents.length}
            </span>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 9px',
              borderRadius: 7,
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--pulse-ink-2)',
              border: '1px solid var(--pulse-border)',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <Upload size={13} />
            Add
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg,.gif"
            style={{ display: 'none' }}
            onChange={onUpload}
            aria-label="Upload source files"
          />
        </div>

        {/* Active-context card — first-class, coral */}
        <div
          style={{
            borderRadius: 10,
            padding: '8px 10px',
            marginBottom: 10,
            background: grounded ? 'var(--pulse-coral-bg-08)' : 'var(--pulse-surface-raised)',
            border: `1px solid ${grounded ? 'var(--pulse-rose-soft)' : 'var(--pulse-border)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className={grounded ? 'wr-data-pulse' : ''}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                flexShrink: 0,
                background: grounded ? 'var(--pulse-coral)' : 'var(--pulse-ink-3)',
                boxShadow: grounded ? '0 0 5px var(--pulse-coral)' : 'none',
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, color: grounded ? 'var(--pulse-coral-fg)' : 'var(--pulse-ink-2)' }}>
              {groundingLabel}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--pulse-ink-3)', marginTop: 3, marginLeft: 16, display: 'flex', gap: 8 }}>
            <button
              onClick={onAddAllDocs}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--pulse-coral-fg)', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
            >
              Add all
            </button>
            <button
              onClick={onClearAllDocs}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--pulse-ink-3)', cursor: 'pointer', fontSize: 10 }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--pulse-ink-3)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sources"
            style={{
              width: '100%',
              padding: '6px 8px 6px 28px',
              borderRadius: 7,
              fontSize: 12,
              background: 'var(--pulse-surface-raised)',
              color: 'var(--pulse-ink)',
              border: '1px solid var(--pulse-border)',
              outline: 'none',
            }}
          />
        </div>

        {/* Tag chips */}
        {tags.length > 2 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
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
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: `1px solid ${active ? 'var(--pulse-border-strong)' : 'var(--pulse-border)'}`,
                    background: active ? 'var(--pulse-surface-raised)' : 'transparent',
                    color: active ? 'var(--pulse-ink)' : 'var(--pulse-ink-3)',
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Doc list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* In-progress uploads */}
        {uploadingArr.map((name) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8 }}>
            <Loader2 size={14} className="animate-spin" style={{ color: 'var(--pulse-rose)' }} />
            <span style={{ flex: 1, fontSize: 12, color: 'var(--pulse-ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </span>
            <span style={{ fontFamily: 'var(--pulse-font-mono)', fontSize: 10, color: 'var(--pulse-rose)' }}>
              {uploadProgress.get(name) ?? 0}%
            </span>
          </div>
        ))}

        {shown.length === 0 && uploadingArr.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--pulse-ink-3)' }}>
            <FolderOpen size={22} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 12, marginBottom: 10 }}>No sources yet</div>
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                fontSize: 11,
                padding: '5px 12px',
                borderRadius: 7,
                border: '1px solid var(--pulse-rose)',
                background: 'transparent',
                color: 'var(--pulse-rose)',
                cursor: 'pointer',
              }}
            >
              + Add your first source
            </button>
          </div>
        ) : (
          shown.map((d) => {
            const isActive = activeContextDocs.has(d.id);
            const isReady = d.processing_status === 'completed';
            return (
              <div
                key={d.id}
                onClick={() => isReady && onToggleDoc(d.id)}
                className="wr-nb-source-row"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 9,
                  cursor: isReady ? 'pointer' : 'default',
                  border: `1px solid ${isActive ? 'var(--pulse-border-strong)' : 'transparent'}`,
                  background: isActive ? 'var(--pulse-surface-raised)' : 'transparent',
                  transition: 'background var(--pulse-duration) var(--pulse-ease)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--pulse-surface-raised)';
                  const acts = e.currentTarget.querySelector('[data-row-actions]') as HTMLElement | null;
                  if (acts) acts.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                  const acts = e.currentTarget.querySelector('[data-row-actions]') as HTMLElement | null;
                  if (acts) acts.style.opacity = '0';
                }}
              >
                {/* Checkbox */}
                <span
                  style={{
                    marginTop: 1,
                    width: 16,
                    height: 16,
                    borderRadius: 5,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? 'var(--pulse-rose)' : 'transparent',
                    border: `1px solid ${isActive ? 'transparent' : 'var(--pulse-border-strong)'}`,
                    color: isActive ? 'white' : 'var(--pulse-ink-3)',
                    opacity: isReady ? 1 : 0.4,
                  }}
                >
                  {isActive && <Check size={12} />}
                </span>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--pulse-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <span
                      style={{
                        fontFamily: 'var(--pulse-font-mono)',
                        fontSize: 9,
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: 'var(--pulse-surface-raised)',
                        color: 'var(--pulse-ink-3)',
                      }}
                    >
                      {typeLabel(d.file_type)}
                    </span>
                    {!isReady ? (
                      <span style={{ fontSize: 10, color: 'var(--pulse-tone-warning, #f59e0b)' }}>
                        {d.processing_status === 'failed' ? 'Failed' : 'Processing…'}
                      </span>
                    ) : (
                      d.ai_keywords && d.ai_keywords.length > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--pulse-ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                          {d.ai_keywords.slice(0, 2).join(', ')}
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* Hover actions */}
                <div
                  data-row-actions
                  style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity var(--pulse-duration) var(--pulse-ease)', flexShrink: 0 }}
                >
                  {isReady && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewDoc(d.id); }}
                      title="View source"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--pulse-ink-3)' }}
                    >
                      <Eye size={13} />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteDoc(d.id); }}
                    title="Remove source"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--pulse-ink-3)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
};

export default SourcesPane;
