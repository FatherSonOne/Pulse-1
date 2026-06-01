/**
 * StudioPane — right pane of the Notebook shell (handoff Phase 5, P0).
 *
 * Two tabs over a single surface:
 *   • Generate  — the GeneratorRail (Study Guide / FAQ / Timeline / Podcast +
 *     Comparative / Knowledge Graph), each launched via the canonical store
 *     flags rendered by WarRoomModalStack.
 *   • Artifacts — TheBoard (pinned findings / decisions / insights). This is
 *     the durable artifacts list; generated content opens in its own modal and
 *     can be pinned here. No new "generated artifacts" store slice is invented
 *     (handoff: don't invent contracts).
 *
 * Tab state is local-only.
 */

import React, { useState } from 'react';
import { TheBoard } from '../TheBoard';
import { GeneratorRail } from './GeneratorRail';
import type { BoardNote, NoteType, BoardNoteMeta } from '../useBoardNotes';
import { Sparkles, Pin } from 'lucide-react';

export interface StudioPaneProps {
  notes: BoardNote[];
  onAddNote: (content: string, type: NoteType, meta?: BoardNoteMeta) => void;
  onDeleteNote: (id: string) => void;
  onClearNotes: () => void;
  activeSourceCount: number;
  totalSourceCount: number;
}

type StudioTab = 'generate' | 'artifacts';

export const StudioPane: React.FC<StudioPaneProps> = ({
  notes,
  onAddNote,
  onDeleteNote,
  onClearNotes,
  activeSourceCount,
  totalSourceCount,
}) => {
  const [tab, setTab] = useState<StudioTab>('generate');

  const tabBtn = (id: StudioTab, label: string, icon: React.ReactNode) => {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '6px 12px',
          border: 'none',
          borderBottom: `2px solid ${active ? 'var(--pulse-ink)' : 'transparent'}`,
          background: 'transparent',
          color: active ? 'var(--pulse-ink)' : 'var(--pulse-ink-3)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          transition: 'color var(--pulse-duration) var(--pulse-ease)',
        }}
      >
        {icon}
        {label}
        {id === 'artifacts' && notes.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--pulse-ink-3)' }}>({notes.length})</span>
        )}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 8px',
          borderBottom: '1px solid var(--pulse-border)',
          flexShrink: 0,
        }}
      >
        {tabBtn('generate', 'Generate', <Sparkles size={13} />)}
        {tabBtn('artifacts', 'Artifacts', <Pin size={13} />)}
      </div>

      {/* Tab body */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'generate' ? (
          <GeneratorRail activeSourceCount={activeSourceCount} totalSourceCount={totalSourceCount} />
        ) : (
          <TheBoard notes={notes} onAddNote={onAddNote} onDeleteNote={onDeleteNote} onClearNotes={onClearNotes} />
        )}
      </div>
    </div>
  );
};

export default StudioPane;
