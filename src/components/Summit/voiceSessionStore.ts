/**
 * Voice session persistence — localStorage cache + Supabase source of truth.
 *
 * Sync functions (load/save/delete) operate on localStorage so the UI paints
 * instantly without awaiting the network. Async *Remote variants hit
 * `summit_sessions` in Supabase and write through to localStorage so the
 * cache stays warm. Summit calls both: sync first for fast paint, async
 * after to reconcile.
 *
 * Stored shape is JSON-safe (timestamps as unix ms, no Date objects).
 */

import { supabase } from '../../services/supabase';

export interface StoredVoiceNote {
  id: string;
  content: string;
  timestamp: number;
  type: 'auto' | 'manual' | 'highlight';
  speaker?: 'user' | 'assistant';
}

/** Forward-path alias. New code should reference `StoredSessionNote`; the
 * `StoredVoiceNote` name will be retired once the Summit component drops
 * its in-memory `VoiceNote` interface. */
export type StoredSessionNote = StoredVoiceNote;

export type ArtifactKind = 'decision' | 'task' | 'reference' | 'question';

export interface SessionArtifact {
  id: string;
  kind: ArtifactKind;
  content: string;
  timestamp: number;
  /**
   * Where the artifact came from:
   *   - 'auto'   — heuristic classifier extracted it from a transcript line
   *   - 'manual' — user typed it into the panel
   *   - 'tool'   — realtime model called a tool (create_decision, search, …);
   *                tool-sourced items are already persisted in their target
   *                surface and must NOT be re-pushed at session end.
   */
  source: 'auto' | 'manual' | 'tool';
  speaker?: 'user' | 'assistant';
  meta?: {
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    refSection?: string;
    refId?: string;
    refUrl?: string;
    /** Name of the tool that created this artifact (when source === 'tool'). */
    toolName?: string;
  };
}

export interface SessionArtifacts {
  decisions: SessionArtifact[];
  tasks: SessionArtifact[];
  references: SessionArtifact[];
  questions: SessionArtifact[];
}

export const emptyArtifacts = (): SessionArtifacts => ({
  decisions: [],
  tasks: [],
  references: [],
  questions: [],
});

export interface VoiceSessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  captureCount: number;
  takeaway?: string;
  lastLine?: string;
  notes: StoredVoiceNote[];
  /** Structured artifacts captured during the session (added 2026-05). */
  artifacts?: SessionArtifacts;
}

const KEY = 'pulse_voice_sessions';
const MAX_SESSIONS = 12;

export function loadVoiceSessions(): VoiceSessionRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveVoiceSession(record: VoiceSessionRecord): VoiceSessionRecord[] {
  const existing = loadVoiceSessions();
  const next = [record, ...existing.filter((s) => s.id !== record.id)].slice(0, MAX_SESSIONS);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage may be unavailable (private mode, quota); fail silently
  }
  return next;
}

export function deleteVoiceSession(id: string): VoiceSessionRecord[] {
  const next = loadVoiceSessions().filter((s) => s.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function summarizeForTakeaway(notes: StoredVoiceNote[]): string | undefined {
  const candidate =
    notes.find((n) => n.type === 'highlight') ??
    notes.find((n) => n.type === 'auto') ??
    notes[0];
  if (!candidate) return undefined;
  const trimmed = candidate.content.trim();
  return trimmed.length > 140 ? trimmed.slice(0, 137) + '…' : trimmed;
}

export function formatRelative(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ──────────────── Supabase-backed (source of truth) ──────────────── */

interface RemoteRow {
  id: string;
  workspace_id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_sec: number;
  capture_count: number;
  artifact_count: number;
  takeaway: string | null;
  last_line: string | null;
  data: {
    notes?: StoredVoiceNote[];
    artifacts?: SessionArtifacts;
  } | null;
}

const rowToRecord = (row: RemoteRow): VoiceSessionRecord => ({
  id: row.id,
  startedAt: new Date(row.started_at).getTime(),
  endedAt: new Date(row.ended_at).getTime(),
  durationSec: row.duration_sec,
  captureCount: row.capture_count,
  takeaway: row.takeaway ?? undefined,
  lastLine: row.last_line ?? undefined,
  notes: row.data?.notes ?? [],
  artifacts: row.data?.artifacts,
});

const writeThroughCache = (records: VoiceSessionRecord[]): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(records.slice(0, MAX_SESSIONS)));
  } catch {
    /* private mode / quota — non-fatal */
  }
};

/**
 * Fetch the user's recent sessions from Supabase, write-through to localStorage,
 * and return them. Falls back to the cache on error so UX doesn't break offline.
 */
export async function loadVoiceSessionsRemote(
  userId: string,
  workspaceId: string,
): Promise<VoiceSessionRecord[]> {
  if (!userId || !workspaceId) return loadVoiceSessions();
  const { data, error } = await supabase
    .from('summit_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .order('ended_at', { ascending: false })
    .limit(MAX_SESSIONS);
  if (error || !Array.isArray(data)) {
    return loadVoiceSessions();
  }
  const records = (data as unknown as RemoteRow[]).map(rowToRecord);
  writeThroughCache(records);
  return records;
}

/**
 * Persist a session to Supabase. Caller has already updated localStorage via
 * the sync `saveVoiceSession`; this is the cloud write that survives device
 * loss. Fire-and-forget from the caller.
 */
export async function saveVoiceSessionRemote(
  record: VoiceSessionRecord,
  userId: string,
  workspaceId: string,
): Promise<void> {
  if (!userId || !workspaceId) return;
  const artifactCount = record.artifacts
    ? record.artifacts.decisions.length +
      record.artifacts.tasks.length +
      record.artifacts.references.length +
      record.artifacts.questions.length
    : 0;
  const { error } = await supabase.from('summit_sessions').upsert(
    {
      id: record.id,
      workspace_id: workspaceId,
      user_id: userId,
      started_at: new Date(record.startedAt).toISOString(),
      ended_at: new Date(record.endedAt).toISOString(),
      duration_sec: record.durationSec,
      capture_count: record.captureCount,
      artifact_count: artifactCount,
      takeaway: record.takeaway ?? null,
      last_line: record.lastLine ?? null,
      data: {
        notes: record.notes,
        artifacts: record.artifacts,
      },
    },
    { onConflict: 'id' },
  );
  if (error) {
    console.warn('[Summit] saveVoiceSessionRemote failed:', error.message);
  }
}

/**
 * Delete a session from Supabase. Caller has already updated localStorage.
 */
export async function deleteVoiceSessionRemote(id: string): Promise<void> {
  const { error } = await supabase.from('summit_sessions').delete().eq('id', id);
  if (error) {
    console.warn('[Summit] deleteVoiceSessionRemote failed:', error.message);
  }
}
