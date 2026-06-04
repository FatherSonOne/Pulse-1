// src/services/memoryIngestService.ts
// Auto-archive ingest layer for the Memory section.
//
// Three modes:
//   1. Pure adapter functions   — convert source rows → ArchiveItem (no DB writes).
//   2. On-demand bulk import    — pull existing rows from a source table and archive them.
//   3. Realtime auto-ingest     — Supabase realtime listener (extension point).
//
// Idempotency is enforced at the DB layer via the partial unique index on
// (user_id, source_table, source_id) introduced in migration 20260518000001.
// Insert collisions resolve to no-op rather than throw.

import { supabase } from './supabase';
import type { ArchiveType } from '../types';

const TRUNCATE_BODY = 4000;
const truncate = (s: string | null | undefined, n = TRUNCATE_BODY): string => {
  const v = (s || '').trim();
  return v.length > n ? v.slice(0, n - 1).trimEnd() + '…' : v;
};

const stripHtml = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

interface ArchivePayload {
  type: ArchiveType;
  title: string;
  content: string;
  date: Date;
  tags: string[];
  relatedContactId?: string;
  starred?: boolean;
  aiSummary?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  sourceTable: string;
  sourceId: string;
}

const insertArchive = async (payload: ArchivePayload): Promise<string | null> => {
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp?.user?.id;
  if (!userId) return null;

  // Pre-check: does an archive already exist for this source row?
  const { data: existing } = await supabase
    .from('archives')
    .select('id')
    .eq('user_id', userId)
    .eq('source_table', payload.sourceTable)
    .eq('source_id', payload.sourceId)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from('archives')
    .insert([{
      user_id: userId,
      archive_type: payload.type,
      title: payload.title,
      content: payload.content,
      date: payload.date.toISOString(),
      tags: payload.tags,
      related_contact_id: payload.relatedContactId || null,
      visibility: 'private',
      starred: payload.starred || false,
      view_count: 0,
      created_by: userId,
      ai_summary: payload.aiSummary || null,
      sentiment: payload.sentiment || null,
      source_table: payload.sourceTable,
      source_id: payload.sourceId,
    }])
    .select('id')
    .single();

  if (error) {
    if ((error as any).code === '23505') return null;
    console.warn('[memoryIngestService] insert failed:', error.message);
    return null;
  }
  return data?.id || null;
};

// ─── Source → archive adapters ──────────────────────────────────────

// cached_emails — Pulse's actual email cache (1500+ rows for active users)
export interface CachedEmailRow {
  id: string;
  thread_id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  snippet: string | null;
  body_text: string | null;
  body_html: string | null;
  labels: string[] | null;
  is_starred: boolean | null;
  is_archived: boolean | null;
  is_trashed: boolean | null;
  ai_summary: string | null;
  ai_category: string | null;
  ai_sentiment: string | null;
  received_at: string;
}

const cachedEmailToArchive = (e: CachedEmailRow, relatedContactId?: string): ArchivePayload => {
  const fromName = e.from_name || e.from_email.split('@')[0];
  const subject = e.subject?.trim() || `(no subject) · ${fromName}`;
  const bodyRaw = e.body_text || (e.body_html ? stripHtml(e.body_html) : '') || e.snippet || '';
  const tags = ['email'];
  if (e.ai_category) tags.push(e.ai_category);
  if (Array.isArray(e.labels)) tags.push(...e.labels.slice(0, 3));
  const sentimentMap: Record<string, 'positive' | 'neutral' | 'negative'> = {
    positive: 'positive', negative: 'negative', neutral: 'neutral',
  };
  return {
    type: 'email',
    title: `${subject} · ${fromName}`,
    content: truncate(bodyRaw),
    date: new Date(e.received_at),
    tags,
    // Best-effort link to an existing CRM contact by sender address. Null when
    // the sender isn't already a contact (external/automated senders stay
    // unlinked — we never auto-create contacts at ingest).
    relatedContactId: relatedContactId || undefined,
    starred: !!e.is_starred,
    aiSummary: e.ai_summary || undefined,
    sentiment: e.ai_sentiment ? sentimentMap[e.ai_sentiment.toLowerCase()] : undefined,
    sourceTable: 'cached_emails',
    sourceId: e.id,
  };
};

// pulse_messages — in-Pulse chat messages
export interface PulseMessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  thread_id: string | null;
  content: string;
  content_type: string | null;
  created_at: string;
}

/**
 * Maps user_profile.id → display name. Built once per import via a batch query
 * over all unique counterpart IDs. Falls back to "user-XXXXXXXX" when a profile
 * is missing or has no readable name.
 */
export type NameResolver = (userId: string) => string;

const pulseMessageToArchive = (
  m: PulseMessageRow,
  currentUserId: string,
  resolveName: NameResolver,
): ArchivePayload => {
  const isOutgoing = m.sender_id === currentUserId;
  const counterpart = isOutgoing ? m.recipient_id : m.sender_id;
  const counterpartName = resolveName(counterpart);
  return {
    type: 'message',
    title: `${isOutgoing ? 'To' : 'From'} ${counterpartName} · ${truncate(m.content, 60)}`,
    content: m.content,
    date: new Date(m.created_at),
    tags: ['pulse', isOutgoing ? 'sent' : 'received'],
    relatedContactId: counterpart,
    sourceTable: 'pulse_messages',
    sourceId: m.id,
  };
};

/**
 * Pull display names for a set of user_profile IDs in one round-trip.
 * Returns a resolver function with a stable fallback for missing profiles.
 */
async function buildProfileResolver(userIds: string[]): Promise<NameResolver> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const cache = new Map<string, string>();
  if (unique.length === 0) return (id: string) => `user-${id.slice(0, 8)}`;

  const { data } = await supabase
    .from('user_profiles')
    .select('id, display_name, full_name, handle')
    .in('id', unique);

  for (const p of (data || []) as Array<{ id: string; display_name: string | null; full_name: string | null; handle: string | null }>) {
    const name = p.display_name?.trim() || p.full_name?.trim() || (p.handle ? `@${p.handle}` : '') || `user-${p.id.slice(0, 8)}`;
    cache.set(p.id, name);
  }

  return (id: string) => cache.get(id) || `user-${id.slice(0, 8)}`;
}

/**
 * Resolve a batch of email addresses to EXISTING CRM contact ids (contacts.id)
 * for the given user. Best-effort: only addresses already present in the
 * contacts table are returned; unmatched senders are simply absent (we never
 * auto-create contacts here). Case-insensitive — queries both the original and
 * lowercased forms and keys the result by lowercased address.
 *
 * Schema notes (verified against live DB):
 *   - contacts.email is text NOT NULL with an index but NO unique constraint,
 *     so an address may match multiple rows; first match wins (any valid id
 *     for that address is fine for a touchpoint pivot). Never upsert-on-email.
 *   - contacts.user_id is text holding the auth user id (matches the
 *     vacationResponderService resolution pattern). RLS additionally scopes to
 *     the caller's own contacts.
 *   - Egress-safe: selects only `id, email`.
 */
async function resolveContactIdsByEmail(
  userId: string,
  emails: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const cleaned = Array.from(
    new Set((emails || []).map(e => (e || '').trim()).filter(Boolean)),
  );
  if (cleaned.length === 0) return result;

  const variants = Array.from(new Set([...cleaned, ...cleaned.map(e => e.toLowerCase())]));

  const { data, error } = await supabase
    .from('contacts')
    .select('id, email')
    .eq('user_id', userId)
    .in('email', variants);

  if (error || !data) return result;

  for (const row of data as Array<{ id: string; email: string | null }>) {
    const key = (row.email || '').toLowerCase();
    if (key && row.id && !result.has(key)) result.set(key, row.id);
  }
  return result;
}

// decisions — formal decision logs
export interface DecisionRow {
  id: string;
  proposal_text: string;
  status: string;
  decision_type: string;
  brief: string | null;
  description: string | null;
  created_at: string;
  resolved_at: string | null;
  ai_risk_level: string | null;
}

const decisionToArchive = (d: DecisionRow): ArchivePayload => {
  const body = [d.brief, d.description].filter(Boolean).join('\n\n') || d.proposal_text;
  const tags = ['decision', d.decision_type, d.status].filter(Boolean);
  if (d.ai_risk_level) tags.push(`risk:${d.ai_risk_level}`);
  return {
    type: 'decision_log',
    title: truncate(d.proposal_text, 100),
    content: truncate(body),
    date: new Date(d.resolved_at || d.created_at),
    tags,
    sourceTable: 'decisions',
    sourceId: d.id,
  };
};

// meetings — meeting transcripts/summaries
export interface MeetingRow {
  id: string;
  title: string;
  description: string | null;
  transcript: string | null;
  summary: string | null;
  sentiment_label: string | null;
  start_time: string | null;
  duration_minutes: number | null;
  attendees: any;
  created_at: string | null;
}

const meetingToArchive = (m: MeetingRow): ArchivePayload => {
  const body = m.transcript || m.summary || m.description || m.title;
  const tags = ['meeting'];
  if (m.duration_minutes) tags.push(`${m.duration_minutes}min`);
  const sentimentMap: Record<string, 'positive' | 'neutral' | 'negative'> = {
    positive: 'positive', negative: 'negative', neutral: 'neutral',
  };
  return {
    type: 'meeting_note',
    title: m.title,
    content: truncate(body),
    date: new Date(m.start_time || m.created_at || new Date().toISOString()),
    tags,
    aiSummary: m.summary || undefined,
    sentiment: m.sentiment_label ? sentimentMap[m.sentiment_label.toLowerCase()] : undefined,
    sourceTable: 'meetings',
    sourceId: m.id,
  };
};

// voxer_recordings — async voice messages with transcripts
export interface VoxerRecordingRow {
  id: string;
  title: string | null;
  transcript: string | null;
  duration: number;
  recorded_at: string;
  contact_id: string | null;
  contact_name: string | null;
  is_outgoing: boolean;
  starred: boolean;
  tags: string[] | null;
}

const voxerRecordingToArchive = (r: VoxerRecordingRow): ArchivePayload => {
  const dur = `${Math.floor(r.duration / 60)}:${String(r.duration % 60).padStart(2, '0')}`;
  const direction = r.is_outgoing ? 'To' : 'From';
  const counterpart = r.contact_name || (r.contact_id ? r.contact_id.slice(0, 8) : 'unknown');
  return {
    type: 'relay_message',
    title: r.title || `${direction} ${counterpart} · ${dur}`,
    content: r.transcript || `[voice ${dur}]`,
    date: new Date(r.recorded_at),
    tags: ['relay', 'voice', ...(r.tags || []).slice(0, 3)],
    starred: r.starred,
    relatedContactId: r.contact_id || undefined,
    sourceTable: 'voxer_recordings',
    sourceId: r.id,
  };
};

// vox_notes — voice notes (single-author memos)
export interface VoxNoteRow {
  id: string;
  audio_url: string;
  duration: number;
  transcript: string | null;
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  is_favorite: boolean | null;
  created_at: string | null;
}

const voxNoteToArchive = (n: VoxNoteRow): ArchivePayload => {
  const dur = `${Math.floor(n.duration / 60)}:${String(n.duration % 60).padStart(2, '0')}`;
  return {
    type: 'relay_note',
    title: n.title || `Voice note · ${dur}`,
    content: n.transcript || `[voice ${dur}]`,
    date: new Date(n.created_at || new Date().toISOString()),
    tags: ['relay', 'note', ...(n.tags || []).slice(0, 3)],
    starred: !!n.is_favorite,
    aiSummary: n.summary || undefined,
    sourceTable: 'vox_notes',
    sourceId: n.id,
  };
};

// video_vox_messages — video glimpses
export interface VideoVoxMessageRow {
  id: string;
  sender_id: string | null;
  caption: string | null;
  transcript: string | null;
  summary: string | null;
  duration: number;
  topics: string[] | null;
  sentiment: string | null;
  created_at: string | null;
}

const videoVoxToArchive = (v: VideoVoxMessageRow): ArchivePayload => {
  const dur = `${v.duration}s`;
  const body = v.transcript || v.caption || v.summary || `[video glimpse ${dur}]`;
  const tags = ['glimpse', ...(v.topics || []).slice(0, 3)];
  const sentimentMap: Record<string, 'positive' | 'neutral' | 'negative'> = {
    positive: 'positive', negative: 'negative', neutral: 'neutral',
  };
  return {
    type: 'glimpse',
    title: v.caption || `Glimpse · ${dur}`,
    content: truncate(body),
    date: new Date(v.created_at || new Date().toISOString()),
    tags,
    aiSummary: v.summary || undefined,
    sentiment: v.sentiment ? sentimentMap[v.sentiment.toLowerCase()] : undefined,
    sourceTable: 'video_vox_messages',
    sourceId: v.id,
  };
};

// ─── Single-item ingest ─────────────────────────────────────────────

export const ingestCachedEmail = (e: CachedEmailRow, relatedContactId?: string) =>
  insertArchive(cachedEmailToArchive(e, relatedContactId));
export const ingestPulseMessage = (m: PulseMessageRow, userId: string, resolveName?: NameResolver) =>
  insertArchive(pulseMessageToArchive(m, userId, resolveName ?? ((id) => `user-${id.slice(0, 8)}`)));
export const ingestDecision = (d: DecisionRow) => insertArchive(decisionToArchive(d));
export const ingestMeeting = (m: MeetingRow) => insertArchive(meetingToArchive(m));
export const ingestVoxerRecording = (r: VoxerRecordingRow) => insertArchive(voxerRecordingToArchive(r));
export const ingestVoxNote = (n: VoxNoteRow) => insertArchive(voxNoteToArchive(n));
export const ingestVideoVox = (v: VideoVoxMessageRow) => insertArchive(videoVoxToArchive(v));

// ─── Bulk import (on-demand) ─────────────────────────────────────────

export interface ImportResult {
  attempted: number;
  inserted: number;
  skipped: number;
  errors: number;
}
export type SourceKey =
  | 'cached_emails' | 'pulse_messages' | 'decisions'
  | 'meetings' | 'voxer_recordings' | 'vox_notes' | 'video_vox_messages';

const empty = (): ImportResult => ({ attempted: 0, inserted: 0, skipped: 0, errors: 0 });
const sinceISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const runIngest = async <T>(
  rows: T[] | null,
  ingester: (row: T) => Promise<string | null>,
): Promise<ImportResult> => {
  const r = empty();
  if (!rows) return r;
  for (const row of rows) {
    r.attempted++;
    try {
      const id = await ingester(row);
      id ? r.inserted++ : r.skipped++;
    } catch {
      r.errors++;
    }
  }
  return r;
};

export async function importCachedEmails(days: number = 90): Promise<ImportResult> {
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp?.user?.id;
  if (!userId) return empty();
  const { data } = await supabase
    .from('cached_emails')
    .select('id, thread_id, from_email, from_name, subject, snippet, body_text, body_html, labels, is_starred, is_archived, is_trashed, ai_summary, ai_category, ai_sentiment, received_at')
    .eq('user_id', userId)
    .gte('received_at', sinceISO(days))
    .eq('is_trashed', false)
    .order('received_at', { ascending: false })
    .limit(500);
  const rows = (data as CachedEmailRow[] | null) || [];
  // Resolve every sender to an existing CRM contact in one round-trip, then
  // link each archive as it's ingested (null when the sender isn't a contact).
  const contactByEmail = await resolveContactIdsByEmail(userId, rows.map(r => r.from_email));
  return runIngest(rows, (e) =>
    ingestCachedEmail(e, contactByEmail.get((e.from_email || '').toLowerCase())),
  );
}

export async function importPulseMessages(days: number = 90): Promise<ImportResult> {
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp?.user?.id;
  if (!userId) return empty();
  const { data } = await supabase
    .from('pulse_messages')
    .select('id, sender_id, recipient_id, thread_id, content, content_type, created_at')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .eq('is_deleted', false)
    .gte('created_at', sinceISO(days))
    .order('created_at', { ascending: false })
    .limit(500);
  const rows = (data as PulseMessageRow[] | null) || [];
  // Resolve every counterpart in one round-trip before ingesting.
  const counterpartIds = rows.map(m => (m.sender_id === userId ? m.recipient_id : m.sender_id));
  const resolveName = await buildProfileResolver(counterpartIds);
  return runIngest(rows, (m) => ingestPulseMessage(m, userId, resolveName));
}

export async function importDecisions(days: number = 365): Promise<ImportResult> {
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp?.user?.id;
  if (!userId) return empty();
  const { data } = await supabase
    .from('decisions')
    .select('id, proposal_text, status, decision_type, brief, description, created_at, resolved_at, ai_risk_level')
    .eq('created_by', userId)
    .gte('created_at', sinceISO(days))
    .order('created_at', { ascending: false })
    .limit(500);
  return runIngest(data as DecisionRow[] | null, ingestDecision);
}

export async function importMeetings(days: number = 365): Promise<ImportResult> {
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp?.user?.id;
  if (!userId) return empty();
  const { data } = await supabase
    .from('meetings')
    .select('id, title, description, transcript, summary, sentiment_label, start_time, duration_minutes, attendees, created_at')
    .eq('created_by', userId)
    .order('start_time', { ascending: false, nullsFirst: false })
    .limit(500);
  return runIngest(data as MeetingRow[] | null, ingestMeeting);
}

export async function importVoxerRecordings(days: number = 365): Promise<ImportResult> {
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp?.user?.id;
  if (!userId) return empty();
  const { data } = await supabase
    .from('voxer_recordings')
    .select('id, title, transcript, duration, recorded_at, contact_id, contact_name, is_outgoing, starred, tags')
    .eq('user_id', userId)
    .gte('recorded_at', sinceISO(days))
    .order('recorded_at', { ascending: false })
    .limit(500);
  return runIngest(data as VoxerRecordingRow[] | null, ingestVoxerRecording);
}

export async function importVoxNotes(days: number = 365): Promise<ImportResult> {
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp?.user?.id;
  if (!userId) return empty();
  const { data } = await supabase
    .from('vox_notes')
    .select('id, audio_url, duration, transcript, title, summary, tags, is_favorite, created_at')
    .eq('user_id', userId)
    .gte('created_at', sinceISO(days))
    .order('created_at', { ascending: false })
    .limit(500);
  return runIngest(data as VoxNoteRow[] | null, ingestVoxNote);
}

export async function importVideoVoxMessages(days: number = 365): Promise<ImportResult> {
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp?.user?.id;
  if (!userId) return empty();
  const { data } = await supabase
    .from('video_vox_messages')
    .select('id, sender_id, caption, transcript, summary, duration, topics, sentiment, created_at')
    .eq('sender_id', userId)
    .gte('created_at', sinceISO(days))
    .order('created_at', { ascending: false })
    .limit(500);
  return runIngest(data as VideoVoxMessageRow[] | null, ingestVideoVox);
}

/**
 * Run all importers in parallel and return per-source tallies. Sources whose
 * tables are empty or whose user has no rows return zero counts (no error).
 */
export async function importAllSources(emailDays: number = 90): Promise<Record<SourceKey, ImportResult>> {
  const [cached_emails, pulse_messages, decisions, meetings, voxer_recordings, vox_notes, video_vox_messages] = await Promise.all([
    importCachedEmails(emailDays),
    importPulseMessages(emailDays),
    importDecisions(365),
    importMeetings(365),
    importVoxerRecordings(365),
    importVoxNotes(365),
    importVideoVoxMessages(365),
  ]);
  return { cached_emails, pulse_messages, decisions, meetings, voxer_recordings, vox_notes, video_vox_messages };
}

export function totalsOf(results: Record<SourceKey, ImportResult>): ImportResult {
  return Object.values(results).reduce(
    (acc, r) => ({
      attempted: acc.attempted + r.attempted,
      inserted: acc.inserted + r.inserted,
      skipped: acc.skipped + r.skipped,
      errors: acc.errors + r.errors,
    }),
    empty(),
  );
}

// ─── Backfill (one-time repair) ──────────────────────────────────────

export interface BackfillResult {
  scanned: number;
  linked: number;
}

/**
 * Link already-archived emails that have no related_contact_id to an existing
 * CRM contact by sender address. Non-destructive and idempotent:
 *   - Only rows whose sender already matches a contact are updated; unmatched
 *     senders stay null (we never auto-create contacts).
 *   - Once a row is linked it's excluded by the `related_contact_id IS NULL`
 *     filter, so re-running is a no-op.
 *
 * Path: archives(email, null contact, source_table=cached_emails)
 *   → cached_emails.from_email (by source_id)
 *   → contacts.id (by email).
 */
export async function backfillEmailContactLinks(): Promise<BackfillResult> {
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp?.user?.id;
  if (!userId) return { scanned: 0, linked: 0 };

  const { data: archiveRows } = await supabase
    .from('archives')
    .select('id, source_id')
    .eq('user_id', userId)
    .eq('archive_type', 'email')
    .eq('source_table', 'cached_emails')
    .is('related_contact_id', null)
    .is('deleted_at', null)
    .limit(1000);

  const archives = (archiveRows as Array<{ id: string; source_id: string | null }> | null) || [];
  const scanned = archives.length;
  if (scanned === 0) return { scanned: 0, linked: 0 };

  const sourceIds = Array.from(new Set(archives.map(a => a.source_id).filter(Boolean))) as string[];
  if (sourceIds.length === 0) return { scanned, linked: 0 };

  const { data: emailRows } = await supabase
    .from('cached_emails')
    .select('id, from_email')
    .in('id', sourceIds);

  const sourceEmail = new Map<string, string>();
  ((emailRows as Array<{ id: string; from_email: string | null }> | null) || []).forEach(e => {
    if (e.id && e.from_email) sourceEmail.set(e.id, e.from_email);
  });

  const contactByEmail = await resolveContactIdsByEmail(userId, Array.from(sourceEmail.values()));

  // Group archive ids by resolved contact id → one update per distinct contact.
  const idsByContact = new Map<string, string[]>();
  for (const a of archives) {
    const email = a.source_id ? sourceEmail.get(a.source_id) : undefined;
    const contactId = email ? contactByEmail.get(email.toLowerCase()) : undefined;
    if (!contactId) continue;
    const arr = idsByContact.get(contactId) || [];
    arr.push(a.id);
    idsByContact.set(contactId, arr);
  }

  let linked = 0;
  for (const [contactId, ids] of idsByContact) {
    const { error } = await supabase
      .from('archives')
      .update({ related_contact_id: contactId, updated_at: new Date().toISOString() })
      .in('id', ids);
    if (!error) linked += ids.length;
  }

  return { scanned, linked };
}

// ─── Realtime auto-ingest (extension point) ─────────────────────────
//
// Wire by calling subscribeRealtimeIngest() once per session (e.g. in App.tsx).
// Each subscription registers a Postgres-changes listener and routes new rows
// through the corresponding adapter. Returns an unsubscribe function.

export function subscribeRealtimeIngest(): () => void {
  const channels: Array<{ unsubscribe: () => void }> = [];

  const cachedEmailsChannel = supabase
    .channel('memory-ingest-cached-emails')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cached_emails' }, async (payload) => {
      const row = payload.new as CachedEmailRow & { is_trashed?: boolean };
      if (!row?.id || row.is_trashed) return;
      const { data: userResp } = await supabase.auth.getUser();
      const userId = userResp?.user?.id;
      let contactId: string | undefined;
      if (userId && row.from_email) {
        const m = await resolveContactIdsByEmail(userId, [row.from_email]);
        contactId = m.get(row.from_email.toLowerCase());
      }
      ingestCachedEmail(row, contactId).catch(() => {});
    })
    .subscribe();
  channels.push({ unsubscribe: () => supabase.removeChannel(cachedEmailsChannel) });

  const pulseMessagesChannel = supabase
    .channel('memory-ingest-pulse-messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pulse_messages' }, async (payload) => {
      const row = payload.new as PulseMessageRow & { is_deleted?: boolean };
      if (!row?.id || row.is_deleted) return;
      const { data: userResp } = await supabase.auth.getUser();
      const userId = userResp?.user?.id;
      if (!userId) return;
      // Only ingest messages this user is part of
      if (row.sender_id !== userId && row.recipient_id !== userId) return;
      const counterpart = row.sender_id === userId ? row.recipient_id : row.sender_id;
      const resolveName = await buildProfileResolver([counterpart]);
      ingestPulseMessage(row, userId, resolveName).catch(() => {});
    })
    .subscribe();
  channels.push({ unsubscribe: () => supabase.removeChannel(pulseMessagesChannel) });

  const decisionsChannel = supabase
    .channel('memory-ingest-decisions')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'decisions' }, async (payload) => {
      const row = payload.new as DecisionRow;
      if (!row?.id) return;
      ingestDecision(row).catch(() => {});
    })
    .subscribe();
  channels.push({ unsubscribe: () => supabase.removeChannel(decisionsChannel) });

  const meetingsChannel = supabase
    .channel('memory-ingest-meetings')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meetings' }, async (payload) => {
      const row = payload.new as MeetingRow;
      if (!row?.id) return;
      ingestMeeting(row).catch(() => {});
    })
    .subscribe();
  channels.push({ unsubscribe: () => supabase.removeChannel(meetingsChannel) });

  const voxerChannel = supabase
    .channel('memory-ingest-voxer-recordings')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'voxer_recordings' }, async (payload) => {
      const row = payload.new as VoxerRecordingRow;
      if (!row?.id) return;
      ingestVoxerRecording(row).catch(() => {});
    })
    .subscribe();
  channels.push({ unsubscribe: () => supabase.removeChannel(voxerChannel) });

  const voxNotesChannel = supabase
    .channel('memory-ingest-vox-notes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vox_notes' }, async (payload) => {
      const row = payload.new as VoxNoteRow;
      if (!row?.id) return;
      ingestVoxNote(row).catch(() => {});
    })
    .subscribe();
  channels.push({ unsubscribe: () => supabase.removeChannel(voxNotesChannel) });

  const videoVoxChannel = supabase
    .channel('memory-ingest-video-vox-messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'video_vox_messages' }, async (payload) => {
      const row = payload.new as VideoVoxMessageRow;
      if (!row?.id) return;
      const { data: userResp } = await supabase.auth.getUser();
      if (row.sender_id !== userResp?.user?.id) return;
      ingestVideoVox(row).catch(() => {});
    })
    .subscribe();
  channels.push({ unsubscribe: () => supabase.removeChannel(videoVoxChannel) });

  return () => channels.forEach(c => c.unsubscribe());
}
