/**
 * TheBoard — Phase 3: Intelligence Board Panel
 *
 * The right panel of WarRoomLayout. Stores accumulated notes and findings
 * across all War Room modes. Notes persist in localStorage via useBoardNotes.
 *
 * Note types: Finding · Insight · Action Item · Question · Decision
 *
 * Phase 4 will add: pin-from-AI-message button in each mode's chat bubbles.
 */

import React, { useState, useRef } from 'react';
import { BoardNote, NoteType, NOTE_TYPE_CONFIG, BoardNoteMeta } from './useBoardNotes';

import { Download, Link, Pin, Trash2, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TheBoardProps {
  notes: BoardNote[];
  currentMode?: string;
  onAddNote: (content: string, type: NoteType, meta?: BoardNoteMeta) => void;
  onDeleteNote: (id: string) => void;
  onClearNotes: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1)  return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function exportToMarkdown(notes: BoardNote[]): string {
  const lines: string[] = [
    '# Intelligence Board',
    `_Exported ${new Date().toLocaleString()}_`,
    '',
  ];

  const byType = Object.keys(NOTE_TYPE_CONFIG) as NoteType[];
  for (const type of byType) {
    const typed = notes.filter((n) => n.type === type);
    if (typed.length === 0) continue;
    const cfg = NOTE_TYPE_CONFIG[type];
    lines.push(`## ${cfg.label}s`, '');
    for (const note of typed) {
      const src = note.sourceDocTitle ? ` _(Source: ${note.sourceDocTitle})_` : '';
      const mode = note.mode ? ` · _${note.mode}_` : '';
      lines.push(`- ${note.content}${src}${mode}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function downloadMarkdown(notes: BoardNote[]): void {
  const md = exportToMarkdown(notes);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `intelligence-board-${new Date().toISOString().split('T')[0]}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── NoteCard ─────────────────────────────────────────────────────────────────

const NoteCard: React.FC<{
  note: BoardNote;
  onDelete: () => void;
}> = ({ note, onDelete }) => {
  const cfg = NOTE_TYPE_CONFIG[note.type];

  return (
    <div
      style={{
        padding: '9px 12px',
        borderBottom: '1px solid var(--wr-border)',
        backgroundColor: `${cfg.color}08`,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <i
          className={`fa ${cfg.icon}`}
          style={{ fontSize: 11, color: cfg.color, flexShrink: 0 }}
        />
        <span
          style={{
            fontFamily: 'var(--wr-font-mono)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: cfg.color,
            flex: 1,
          }}
        >
          {cfg.label}
        </span>
        <span
          style={{
            fontFamily: 'var(--wr-font-mono)',
            fontSize: 9,
            color: 'var(--wr-text-muted)',
          }}
        >
          {formatTime(note.createdAt)}
        </span>
        <button
          onClick={onDelete}
          title="Remove note"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '1px 3px',
            color: 'var(--wr-text-muted)',
            fontSize: 10,
            flexShrink: 0,
          }}
        >
          <X className="fa" />
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          fontSize: 12,
          color: 'var(--wr-text-primary)',
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {note.content}
      </div>

      {/* Source link */}
      {note.sourceDocTitle && (
        <div
          style={{
            marginTop: 5,
            fontSize: 10,
            color: 'var(--wr-text-muted)',
            fontFamily: 'var(--wr-font-mono)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Link className="fa" />
          {note.sourceDocTitle}
        </div>
      )}
    </div>
  );
};

// ─── TheBoard (main export) ───────────────────────────────────────────────────

const NOTE_TYPES = Object.keys(NOTE_TYPE_CONFIG) as NoteType[];
const TYPE_FILTER_ALL = 'all' as const;
type TypeFilter = NoteType | typeof TYPE_FILTER_ALL;

export const TheBoard: React.FC<TheBoardProps> = ({
  notes,
  currentMode,
  onAddNote,
  onDeleteNote,
  onClearNotes,
}) => {
  const [noteText, setNoteText]       = useState('');
  const [noteType, setNoteType]       = useState<NoteType>('finding');
  const [filter, setFilter]           = useState<TypeFilter>(TYPE_FILTER_ALL);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filtered = filter === TYPE_FILTER_ALL ? notes : notes.filter((n) => n.type === filter);

  const handleAdd = () => {
    if (!noteText.trim()) return;
    onAddNote(noteText, noteType, { mode: currentMode });
    setNoteText('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleAdd();
    }
  };

  const cfg = NOTE_TYPE_CONFIG[noteType];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Add note form ─────────────────────────────────────── */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--wr-border)',
          flexShrink: 0,
        }}
      >
        {/* Type selector */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 7, flexWrap: 'wrap' }}>
          {NOTE_TYPES.map((t) => {
            const c = NOTE_TYPE_CONFIG[t];
            const active = noteType === t;
            return (
              <button
                key={t}
                onClick={() => setNoteType(t)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 12,
                  border: `1px solid ${active ? c.color : 'var(--wr-border)'}`,
                  backgroundColor: active ? `${c.color}22` : 'transparent',
                  color: active ? c.color : 'var(--wr-text-muted)',
                  fontSize: 9,
                  fontFamily: 'var(--wr-font-mono)',
                  fontWeight: active ? 700 : 400,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all var(--wr-transition-fast)',
                }}
              >
                <i className={`fa ${c.icon}`} style={{ fontSize: 9 }} />
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Add ${cfg.label.toLowerCase()}… (⌘Enter to save)`}
          rows={3}
          style={{
            width: '100%',
            resize: 'none',
            padding: '7px 9px',
            borderRadius: 'var(--wr-radius-sm)',
            border: `1px solid ${noteText ? cfg.color + '60' : 'var(--wr-border)'}`,
            backgroundColor: 'var(--wr-bg-surface)',
            color: 'var(--wr-text-primary)',
            fontSize: 12,
            fontFamily: 'var(--wr-font-sans)',
            outline: 'none',
            lineHeight: 1.5,
            boxSizing: 'border-box',
            transition: 'border-color var(--wr-transition-fast)',
          }}
        />

        <button
          onClick={handleAdd}
          disabled={!noteText.trim()}
          style={{
            marginTop: 6,
            width: '100%',
            padding: '6px',
            backgroundColor: noteText.trim() ? cfg.color : 'var(--wr-bg-elevated)',
            border: 'none',
            borderRadius: 'var(--wr-radius-sm)',
            color: noteText.trim() ? 'white' : 'var(--wr-text-muted)',
            fontSize: 11,
            fontFamily: 'var(--wr-font-mono)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            cursor: noteText.trim() ? 'pointer' : 'not-allowed',
            transition: 'all var(--wr-transition-fast)',
          }}
        >
          <i className={`fa ${cfg.icon}`} style={{ marginRight: 6 }} />
          PIN {cfg.label.toUpperCase()}
        </button>
      </div>

      {/* ── Filter bar ────────────────────────────────────────── */}
      {notes.length > 0 && (
        <div
          style={{
            padding: '5px 12px',
            borderBottom: '1px solid var(--wr-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => setFilter(TYPE_FILTER_ALL)}
            style={{
              fontSize: 9,
              padding: '2px 7px',
              borderRadius: 4,
              border: `1px solid ${filter === TYPE_FILTER_ALL ? 'var(--wr-border-active)' : 'var(--wr-border)'}`,
              background: filter === TYPE_FILTER_ALL ? 'var(--wr-bg-elevated)' : 'transparent',
              color: filter === TYPE_FILTER_ALL ? 'var(--wr-text-primary)' : 'var(--wr-text-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--wr-font-mono)',
              letterSpacing: '0.06em',
            }}
          >
            ALL ({notes.length})
          </button>
          {NOTE_TYPES.filter((t) => notes.some((n) => n.type === t)).map((t) => {
            const c = NOTE_TYPE_CONFIG[t];
            const count = notes.filter((n) => n.type === t).length;
            const active = filter === t;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                title={c.label}
                style={{
                  fontSize: 9,
                  padding: '2px 7px',
                  borderRadius: 4,
                  border: `1px solid ${active ? c.color : 'var(--wr-border)'}`,
                  background: active ? `${c.color}22` : 'transparent',
                  color: active ? c.color : 'var(--wr-text-muted)',
                  cursor: 'pointer',
                  fontFamily: 'var(--wr-font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <i className={`fa ${c.icon}`} style={{ fontSize: 8 }} />
                {count}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Notes list ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {filtered.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 120,
              gap: 10,
              padding: 24,
              textAlign: 'center',
            }}
          >
            <Pin className="fa" />
            <div
              style={{
                fontFamily: 'var(--wr-font-mono)',
                fontSize: 11,
                color: 'var(--wr-text-secondary)',
              }}
            >
              {filter === TYPE_FILTER_ALL ? 'No intel pinned yet' : `No ${NOTE_TYPE_CONFIG[filter].label.toLowerCase()}s`}
            </div>
          </div>
        ) : (
          filtered.map((note) => (
            <NoteCard key={note.id} note={note} onDelete={() => onDeleteNote(note.id)} />
          ))
        )}
      </div>

      {/* ── Footer: export + clear ────────────────────────────── */}
      {notes.length > 0 && (
        <div
          style={{
            padding: '7px 12px',
            borderTop: '1px solid var(--wr-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => downloadMarkdown(notes)}
            title="Export board as Markdown"
            style={{
              flex: 1,
              padding: '5px',
              borderRadius: 'var(--wr-radius-sm)',
              border: '1px solid var(--wr-border)',
              background: 'transparent',
              color: 'var(--wr-text-secondary)',
              fontSize: 10,
              fontFamily: 'var(--wr-font-mono)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              letterSpacing: '0.06em',
            }}
          >
            <Download className="fa" />
            EXPORT .MD
          </button>

          {showConfirmClear ? (
            <>
              <button
                onClick={() => { onClearNotes(); setShowConfirmClear(false); }}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--wr-radius-sm)',
                  border: '1px solid var(--wr-accent-danger)',
                  background: 'transparent',
                  color: 'var(--wr-accent-danger)',
                  fontSize: 10,
                  fontFamily: 'var(--wr-font-mono)',
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}
              >
                CONFIRM
              </button>
              <button
                onClick={() => setShowConfirmClear(false)}
                style={{
                  padding: '5px 8px',
                  borderRadius: 'var(--wr-radius-sm)',
                  border: '1px solid var(--wr-border)',
                  background: 'transparent',
                  color: 'var(--wr-text-muted)',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                <X className="fa" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowConfirmClear(true)}
              title="Clear all notes"
              style={{
                padding: '5px 8px',
                borderRadius: 'var(--wr-radius-sm)',
                border: '1px solid var(--wr-border)',
                background: 'transparent',
                color: 'var(--wr-text-muted)',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              <Trash2 className="fa" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TheBoard;
