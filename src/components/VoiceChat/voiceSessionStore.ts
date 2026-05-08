/**
 * Voice session persistence — localStorage-backed history of past Pulse Chat sessions.
 *
 * Stored shape is JSON-safe (timestamps as unix ms, no Date objects). The session
 * cards on the idle canvas read from here; the parent component writes a record
 * on disconnect with whatever notes were captured during the call.
 */

export interface StoredVoiceNote {
  id: string;
  content: string;
  timestamp: number;
  type: 'auto' | 'manual' | 'highlight';
  speaker?: 'user' | 'assistant';
}

export interface VoiceSessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  captureCount: number;
  takeaway?: string;
  lastLine?: string;
  notes: StoredVoiceNote[];
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
