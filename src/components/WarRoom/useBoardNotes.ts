/**
 * useBoardNotes — Phase 3
 *
 * Global note state for The Board panel. Persists to localStorage.
 * Initialize once in LiveDashboard and pass notes/handlers down via WarRoomLayout.
 */

import { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NoteType = 'finding' | 'insight' | 'action' | 'question' | 'decision';

export interface BoardNote {
  id: string;
  type: NoteType;
  content: string;
  /** Optional: link to a source document */
  sourceDocId?: string;
  sourceDocTitle?: string;
  /** Which War Room mode was active when note was created */
  mode?: string;
  createdAt: number;
}

export interface BoardNoteMeta {
  sourceDocId?: string;
  sourceDocTitle?: string;
  mode?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export const NOTE_TYPE_CONFIG: Record<NoteType, { label: string; icon: string; color: string }> = {
  finding:  { label: 'Finding',     icon: 'fa-magnifying-glass', color: '#06b6d4' },
  insight:  { label: 'Insight',     icon: 'fa-lightbulb',        color: '#f59e0b' },
  action:   { label: 'Action Item', icon: 'fa-circle-check',     color: '#10b981' },
  question: { label: 'Question',    icon: 'fa-circle-question',  color: '#8b5cf6' },
  decision: { label: 'Decision',    icon: 'fa-gavel',            color: '#f43f5e' },
};

const STORAGE_KEY = 'pulse-war-room-board-v1';

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadNotes(): BoardNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BoardNote[]) : [];
  } catch {
    return [];
  }
}

function persistNotes(notes: BoardNote[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Quota exceeded — silently fail; notes still live in memory
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseBoardNotesReturn {
  notes: BoardNote[];
  addNote: (content: string, type?: NoteType, meta?: BoardNoteMeta) => BoardNote;
  deleteNote: (id: string) => void;
  clearNotes: () => void;
  /** Restore a prior snapshot (used by the clear-board Undo). */
  restoreNotes: (notes: BoardNote[]) => void;
}

export function useBoardNotes(): UseBoardNotesReturn {
  const [notes, setNotes] = useState<BoardNote[]>(loadNotes);

  const addNote = useCallback(
    (content: string, type: NoteType = 'finding', meta?: BoardNoteMeta): BoardNote => {
      const note: BoardNote = {
        id: crypto.randomUUID(),
        type,
        content: content.trim(),
        createdAt: Date.now(),
        ...meta,
      };
      setNotes((prev) => {
        const updated = [note, ...prev];
        persistNotes(updated);
        return updated;
      });
      return note;
    },
    [],
  );

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      persistNotes(updated);
      return updated;
    });
  }, []);

  const clearNotes = useCallback(() => {
    setNotes([]);
    persistNotes([]);
  }, []);

  const restoreNotes = useCallback((restored: BoardNote[]) => {
    setNotes(restored);
    persistNotes(restored);
  }, []);

  return { notes, addNote, deleteNote, clearNotes, restoreNotes };
}
