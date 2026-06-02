/**
 * StudioPane — right column of the Notebook, built to the mockup.
 *
 * Header ("Studio") → source hint → always-on GeneratorRail → "On the board"
 * section (TheBoard pinned artifacts). No tabs — the rail is always visible
 * (handoff §4.1: GeneratorRail over ArtifactsSection). Generated content opens
 * in its own modal and can be pinned to the board here; no new store slice is
 * invented.
 */

import React from 'react';
import { TheBoard } from '../TheBoard';
import { GeneratorRail } from './GeneratorRail';
import type { BoardNote, NoteType, BoardNoteMeta } from '../useBoardNotes';
import { LayoutGrid } from 'lucide-react';

export interface StudioPaneProps {
  notes: BoardNote[];
  onAddNote: (content: string, type: NoteType, meta?: BoardNoteMeta) => void;
  onDeleteNote: (id: string) => void;
  onClearNotes: () => void;
  activeSourceCount: number;
  totalSourceCount: number;
}

export const StudioPane: React.FC<StudioPaneProps> = ({
  notes,
  onAddNote,
  onDeleteNote,
  onClearNotes,
  activeSourceCount,
  totalSourceCount,
}) => {
  const sourceHint =
    totalSourceCount === 0
      ? 'Add a source to generate from'
      : activeSourceCount > 0
        ? `Generate from your ${activeSourceCount} active source${activeSourceCount !== 1 ? 's' : ''}`
        : `Generate from all ${totalSourceCount} source${totalSourceCount !== 1 ? 's' : ''}`;

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 14px 6px', flexShrink: 0 }}>
        <LayoutGrid size={16} style={{ color: 'var(--pulse-ink-2)' }} />
        <span style={{ fontFamily: 'var(--pulse-font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pulse-ink)' }}>Studio</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 14px' }}>
        <div style={{ fontSize: 11, color: 'var(--pulse-ink-3)', marginBottom: 10 }}>{sourceHint}</div>

        <GeneratorRail />

        {/* On the board */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--pulse-border)' }}>
          <div
            style={{
              fontFamily: 'var(--pulse-font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--pulse-ink-3)',
              marginBottom: 8,
            }}
          >
            On the board {notes.length > 0 && `· ${notes.length}`}
          </div>
          <TheBoard notes={notes} onAddNote={onAddNote} onDeleteNote={onDeleteNote} onClearNotes={onClearNotes} />
        </div>
      </div>
    </>
  );
};

export default StudioPane;
