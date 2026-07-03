// useRelayTriage — Pulse "what voice needs me now?" data hook.
//
// Stage 2.1d.3 of the Voxer→Relay rework. Powers the Triage stream that lands
// when /relay opens (replacing the placeholder shipped in 2.1d.2). Pulls from
// the five voice surfaces in parallel, normalises each into a TriageItem, and
// returns a single time-sorted feed plus a "needs reply" count for the banner.
//
// Out of scope (per stage brief):
//  - Realtime subscriptions (one-shot fetch on mount + manual refresh()).
//  - Mark-read / archive actions (rows just open the matching mode).
//  - RLS tightening or schema changes.
//
// Surfaces queried:
//  1. voxer_recordings  (legacy 1:1 DM-style, user_id is auth uuid TEXT)
//  2. voice_thread_messages_with_metadata (threaded; sender_name pre-joined)
//  3. quick_vox_messages (1-tap, sender/recipient are pulse_users.id)
//  4. broadcasts        (Pulse Radio; live + last 24h slice)
//  5. vox_notes         (personal memos)
//
// Auth note: User.id from useAuth() is the Supabase auth user UUID. The
// thread/quick_vox/notes/broadcast tables key off pulse_users.id (a separate
// canonical Pulse user UUID), so we resolve auth_user_id → pulse_users.id once
// at the top, then fan out the five queries with the correct id types.
// voxer_recordings.user_id is the auth UUID directly, so it skips that hop.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { voxModeService } from '../services/relay/voxModeService';

export type TriageItemKind = 'classic' | 'thread' | 'quick' | 'broadcast' | 'note';

export interface TriageItem {
  id: string;
  kind: TriageItemKind;
  /** Display name for the sender or note title. */
  senderName: string;
  /** Optional pulse user ID; used for reply/open routing. */
  senderId?: string;
  /** Stable seed for the deterministic avatar colour — per-contact, not per-row.
   *  Differs from senderId when display identity ≠ routing identity (classic DMs
   *  draw by contact_id but route by the existing path). */
  avatarSeed?: string;
  /** Optional avatar image URL, resolved from the contact. */
  avatarUrl?: string;
  /** Optional phone — a fallback identity shown when no name resolves. */
  phone?: string;
  /** Audience label, e.g. 'DM', 'THREAD', 'BROADCAST', 'NOTE', '#channel'. */
  audienceLabel: string;
  /** Audio duration in seconds. */
  durationSec: number;
  /** Created timestamp (used for relative formatting + sorting). */
  createdAt: Date;
  /** Whether this item is awaiting MY reply. */
  needsReply: boolean;
  /** Optional one-line AI summary (for the inline summary chip + body line). */
  summary?: string;
  /** Public audio URL (for future playback). */
  audioUrl: string;
  /** Original kind-specific row, in case the consumer needs more fields. */
  raw: Record<string, any>;
}

export interface UseRelayTriageReturn {
  items: TriageItem[];
  needsReplyCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /**
   * Mark a single triage item as read. Optimistically clears `needsReply`
   * locally before round-tripping the per-kind mutation, then rolls the
   * count back if the persistence fails. Notes / broadcasts are no-ops.
   */
  markRead: (item: TriageItem) => Promise<void>;
  /** Same as `markRead` but for a batch — used by the bulk action. */
  markManyRead: (items: TriageItem[]) => Promise<void>;
  /**
   * Hide a triage item from the feed without deleting the source row.
   * Returns the kind+id pair so the caller can wire an Undo toast.
   */
  dismiss: (item: TriageItem) => Promise<void>;
  /** Restore a previously-dismissed item — paired with `dismiss` for Undo. */
  undismiss: (item: TriageItem) => Promise<void>;
  /**
   * Hard-delete the underlying row (per-kind: voxer_recordings / quick / note
   * / broadcast hard delete; thread soft-delete via is_deleted). Optimistic
   * removal from the feed; rolls back on RLS reject.
   */
  remove: (item: TriageItem) => Promise<boolean>;
}

const PER_SOURCE_LIMIT = 30;

const noopRefresh = async () => {};
const noopMarkRead = async (_item: TriageItem) => {};
const noopMarkManyRead = async (_items: TriageItem[]) => {};
const noopDismiss = async (_item: TriageItem) => {};
const noopRemove = async (_item: TriageItem): Promise<boolean> => false;

/**
 * Coerce a Supabase row's `created_at`/`recorded_at`/`published_at` cell into
 * a Date, defensively falling back to "now" when the column is missing or the
 * server returned something we can't parse.
 */
function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * Pull the first non-empty string off a row for use as a one-line summary.
 * The triage row uses `summary || transcript || 'No transcript'`, so we treat
 * either column as a valid summary source — full transcripts get truncated by
 * the row's CSS `truncate` class.
 */
function pickSummary(...candidates: Array<string | null | undefined>): string | undefined {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return undefined;
}

export function useRelayTriage(userId: string | undefined | null): UseRelayTriageReturn {
  const [items, setItems] = useState<TriageItem[]>([]);
  const [needsReplyCount, setNeedsReplyCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local-only set of dismissed `${kind}:${id}` strings. Filtered out of the
  // feed before render. Persisted to localStorage by voxModeService — we
  // mirror it here so the dismiss/undismiss callbacks can drive immediate
  // re-renders without re-querying storage.
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  const fetchAll = useCallback(async (): Promise<void> => {
    if (!userId) {
      setItems([]);
      setNeedsReplyCount(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1) Resolve auth user → pulse_users.id (the canonical Pulse uuid).
      //    voxer_recordings is keyed by the auth uuid (TEXT); everything else
      //    is keyed by pulse_users.id (UUID), so we need both.
      const pulseUserResp = await supabase
        .from('pulse_users')
        .select('id')
        .eq('auth_user_id', userId)
        .maybeSingle();
      const pulseUserId: string | null = pulseUserResp.data?.id ?? null;

      // 2) Discover thread participations + channel subscriptions in parallel
      //    so we can scope the heavier message/broadcast queries to surfaces
      //    the user actually belongs to.
      const [threadIdsResp, subscribedChannelIdsResp] = await Promise.all([
        pulseUserId
          ? supabase
              .from('voice_thread_participants')
              .select('thread_id')
              .eq('user_id', pulseUserId)
          : Promise.resolve({ data: [] as Array<{ thread_id: string }>, error: null }),
        pulseUserId
          ? supabase
              .from('pulse_channel_subscriptions')
              .select('channel_id')
              .eq('subscriber_id', pulseUserId)
          : Promise.resolve({ data: [] as Array<{ channel_id: string }>, error: null }),
      ]);

      const threadIds: string[] = (threadIdsResp.data ?? []).map((r: any) => r.thread_id).filter(Boolean);
      const subscribedChannelIds: string[] = (subscribedChannelIdsResp.data ?? [])
        .map((r: any) => r.channel_id)
        .filter(Boolean);

      // 3) Fan out the five voice-surface queries in parallel. Each query is
      //    capped at PER_SOURCE_LIMIT so the unified stream stays bounded; if
      //    a query 403s under RLS we log + treat that bucket as empty rather
      //    than failing the whole hook.
      const sinceIso24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const classicPromise = supabase
        .from('voxer_recordings')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .limit(PER_SOURCE_LIMIT);

      const threadPromise = threadIds.length > 0
        ? supabase
            .from('voice_thread_messages_with_metadata')
            .select('*')
            .in('thread_id', threadIds)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(PER_SOURCE_LIMIT)
        : Promise.resolve({ data: [] as any[], error: null });

      const quickPromise = pulseUserId
        ? supabase
            .from('quick_vox_messages')
            .select('*')
            .or(`sender_id.eq.${pulseUserId},recipient_id.eq.${pulseUserId}`)
            .order('created_at', { ascending: false })
            .limit(PER_SOURCE_LIMIT)
        : Promise.resolve({ data: [] as any[], error: null });

      // For broadcasts: include subscribed channels' last week + anything live
      // in the last 24h (so users see live broadcasts even if not subscribed).
      const broadcastFilters: string[] = [`is_live.eq.true`, `published_at.gte.${sinceIso24h}`];
      if (subscribedChannelIds.length > 0) {
        broadcastFilters.push(`channel_id.in.(${subscribedChannelIds.join(',')})`);
      }
      const broadcastPromise = supabase
        .from('broadcasts')
        .select('*')
        .or(broadcastFilters.join(','))
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(PER_SOURCE_LIMIT);

      const notePromise = pulseUserId
        ? supabase
            .from('vox_notes')
            .select('*')
            .eq('user_id', pulseUserId)
            .order('created_at', { ascending: false })
            .limit(PER_SOURCE_LIMIT)
        : Promise.resolve({ data: [] as any[], error: null });

      const [classicResp, threadResp, quickResp, broadcastResp, noteResp] = await Promise.all([
        classicPromise,
        threadPromise,
        quickPromise,
        broadcastPromise,
        notePromise,
      ]);

      // Soft-log RLS / query errors per-bucket; we still want partial results.
      const logBucketError = (label: string, err: any) => {
        if (err) console.warn(`[useRelayTriage] ${label} query failed:`, err.message ?? err);
      };
      logBucketError('voxer_recordings', (classicResp as any).error);
      logBucketError('voice_thread_messages_with_metadata', (threadResp as any).error);
      logBucketError('quick_vox_messages', (quickResp as any).error);
      logBucketError('broadcasts', (broadcastResp as any).error);
      logBucketError('vox_notes', (noteResp as any).error);

      const classicRows = (classicResp as any).data ?? [];
      const threadRows = (threadResp as any).data ?? [];
      const quickRows = (quickResp as any).data ?? [];
      const broadcastRows = (broadcastResp as any).data ?? [];
      const noteRows = (noteResp as any).data ?? [];

      // Classic sender identity: voxer_recordings stores the counterparty as
      // contact_id (TEXT) + a denormalised contact_name that is frequently null
      // on legacy/seed rows. Resolve contact_id → contacts for the live name +
      // avatar, batched in one round-trip like the quick-vox lookup below.
      // contacts.id is UUID and contact_id is TEXT, so we guard uuid-shape and
      // let Supabase cast on the `in` filter.
      const classicContactIds = Array.from(
        new Set(
          classicRows
            .map((r: any) => r.contact_id)
            .filter((id: any): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)),
        ),
      );
      const contactById = new Map<string, { name: string | null; avatar_url: string | null; phone: string | null }>();
      if (classicContactIds.length > 0) {
        const contactsResp = await supabase
          .from('contacts')
          .select('id, name, avatar_url, phone')
          .in('id', classicContactIds);
        for (const c of (contactsResp as any).data ?? []) {
          contactById.set(c.id, { name: c.name, avatar_url: c.avatar_url, phone: c.phone });
        }
      }

      // 4) Map each row to a TriageItem with the kind-appropriate needsReply
      //    heuristic. For threads we only count the LATEST message per thread
      //    toward needsReply (post-filter), so a 30-message thread doesn't
      //    inflate the banner count.
      const classicItems: TriageItem[] = classicRows.map((r: any) => {
        const cid = typeof r.contact_id === 'string' ? r.contact_id : undefined;
        const c = cid ? contactById.get(cid) : undefined;
        const resolvedName =
          (c?.name && c.name.trim()) ||
          (typeof r.contact_name === 'string' && r.contact_name.trim()) ||
          (c?.phone && c.phone.trim()) ||
          'Unknown contact';
        return {
          id: r.id,
          kind: 'classic' as const,
          senderName: resolvedName,
          // senderId (reply/open routing) intentionally unchanged from the
          // prior behaviour; avatarSeed carries the per-contact colour key.
          senderId: undefined,
          avatarSeed: cid,
          avatarUrl: c?.avatar_url ?? undefined,
          phone: c?.phone ?? undefined,
          audienceLabel: 'DM',
          durationSec: Number(r.duration ?? 0),
          createdAt: toDate(r.recorded_at ?? r.created_at),
          needsReply: r.is_outgoing === false && r.played === false,
          summary: pickSummary(r.transcript),
          audioUrl: r.audio_url ?? '',
          raw: r,
        };
      });

      // Thread needs-reply: latest message per thread where sender != me and I
      // haven't read it. We process the rows already sorted DESC by created_at,
      // so the first occurrence per thread_id is the latest.
      const seenThreadIds = new Set<string>();
      const threadItems: TriageItem[] = threadRows.map((r: any) => {
        const isLatestOfThread = !seenThreadIds.has(r.thread_id);
        if (r.thread_id) seenThreadIds.add(r.thread_id);
        const readBy: string[] = Array.isArray(r.read_by) ? r.read_by : [];
        const sentByMe = pulseUserId && r.sender_id === pulseUserId;
        const iHaveRead = pulseUserId ? readBy.includes(pulseUserId) : true;
        const needsReply = Boolean(isLatestOfThread && !sentByMe && !iHaveRead);
        return {
          id: r.id,
          kind: 'thread' as const,
          senderName: r.sender_name ?? 'Unknown',
          senderId: r.sender_id ?? undefined,
          audienceLabel: 'THREAD',
          durationSec: Number(r.duration ?? 0),
          createdAt: toDate(r.created_at),
          needsReply,
          summary: pickSummary(r.quoted_text, r.transcript),
          audioUrl: r.audio_url ?? '',
          raw: r,
        };
      });

      // Quick vox sender names: batch-fetch any pulse_users we don't already
      // have from the rows themselves. Rows store only sender_id, so a single
      // join keeps this O(1) extra round trip instead of N.
      const quickSenderIds = Array.from(
        new Set(quickRows.map((r: any) => r.sender_id).filter(Boolean)),
      );
      let pulseUserById = new Map<string, { display_name: string | null; handle: string | null }>();
      if (quickSenderIds.length > 0) {
        const usersResp = await supabase
          .from('pulse_users')
          .select('id, display_name, handle')
          .in('id', quickSenderIds);
        for (const u of (usersResp as any).data ?? []) {
          pulseUserById.set(u.id, { display_name: u.display_name, handle: u.handle });
        }
      }

      const quickItems: TriageItem[] = quickRows.map((r: any) => {
        const lookup = pulseUserById.get(r.sender_id);
        const senderName = lookup?.display_name || lookup?.handle || 'Unknown';
        const recipientIsMe = pulseUserId && r.recipient_id === pulseUserId;
        return {
          id: r.id,
          kind: 'quick' as const,
          senderName,
          senderId: r.sender_id ?? undefined,
          audienceLabel: 'QUICK',
          durationSec: Number(r.duration ?? 0),
          createdAt: toDate(r.created_at),
          needsReply: Boolean(recipientIsMe && r.played_at == null),
          // quick_vox_messages has a real transcript column (Whisper). It was
          // being dropped here, so every Quick Vox row read "No transcript"
          // even when one existed. Read it like the other surfaces do.
          summary: pickSummary(r.transcript),
          audioUrl: r.audio_url ?? '',
          raw: r,
        };
      });

      const broadcastItems: TriageItem[] = broadcastRows.map((r: any) => ({
        id: r.id,
        kind: 'broadcast' as const,
        senderName: r.author_name ?? 'Pulse Radio',
        senderId: r.author_id ?? undefined,
        audienceLabel: r.is_live ? 'LIVE' : 'BROADCAST',
        durationSec: Number(r.duration ?? 0),
        createdAt: toDate(r.published_at ?? r.created_at),
        needsReply: false,
        summary: pickSummary(r.description, r.transcript),
        audioUrl: r.audio_url ?? '',
        raw: r,
      }));

      const noteItems: TriageItem[] = noteRows.map((r: any) => ({
        id: r.id,
        kind: 'note' as const,
        senderName: r.title ?? 'Voice note',
        senderId: undefined,
        audienceLabel: 'NOTE',
        durationSec: Number(r.duration ?? 0),
        createdAt: toDate(r.created_at),
        needsReply: false,
        summary: pickSummary(r.summary, r.transcript),
        audioUrl: r.audio_url ?? '',
        raw: r,
      }));

      // 5) Unified DESC sort, then count needs-reply. We sort *after* mapping
      //    so the thread "latest message per thread" pass above can rely on
      //    the per-bucket DESC ordering Supabase already gave us.
      const merged: TriageItem[] = [
        ...classicItems,
        ...threadItems,
        ...quickItems,
        ...broadcastItems,
        ...noteItems,
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // 6) Strip out items the user has dismissed from triage. We re-pull
      //    the persisted set on every fetch so a dismissal made in another
      //    tab takes effect on the next refresh; the local state is
      //    primarily for immediate-render after a click.
      const persistedDismissed = await voxModeService.getDismissedTriageIds();
      setDismissedKeys(persistedDismissed);
      const visible = merged.filter(
        (i) => !persistedDismissed.has(`${i.kind}:${i.id}`),
      );
      const replyCount = visible.reduce((acc, i) => (i.needsReply ? acc + 1 : acc), 0);

      setItems(visible);
      setNeedsReplyCount(replyCount);
    } catch (err: any) {
      console.error('[useRelayTriage] fatal error', err);
      setError(err?.message ?? 'Failed to load triage stream');
      setItems([]);
      setNeedsReplyCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setNeedsReplyCount(0);
      setIsLoading(false);
      setError(null);
      return;
    }
    void fetchAll();
  }, [userId, fetchAll]);

  // Realtime: any INSERT into a triage source table triggers a refetch.
  // We re-run the whole 5-source fan-out rather than splice individual rows
  // so the per-source LIMIT(30) cap stays automatic and the per-kind
  // mapping/needs-reply heuristics live in exactly one place. Debounced
  // 250ms so a burst of inserts collapses into one refresh.
  useEffect(() => {
    if (!userId) return;
    const tables: string[] = [
      'voxer_recordings',
      'voice_thread_messages',
      'quick_vox_messages',
      'broadcasts',
      'vox_notes',
    ];
    let pending: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        pending = null;
        void fetchAll();
      }, 250);
    };
    const channels = tables.map((table) =>
      supabase
        .channel(`relay-triage-${table}`)
        .on(
          'postgres_changes' as any,
          { event: 'INSERT', schema: 'public', table },
          scheduleRefresh,
        )
        .subscribe(),
    );
    return () => {
      if (pending) clearTimeout(pending);
      channels.forEach((c) => {
        try { supabase.removeChannel(c); } catch { /* noop */ }
      });
    };
  }, [userId, fetchAll]);

  const markRead = useCallback(
    async (item: TriageItem) => {
      if (!item.needsReply) return;
      // Optimistically clear locally so the row removes/dims immediately;
      // roll back on persistence failure.
      let rolledBack = false;
      setItems((prev) =>
        prev.map((i) =>
          i.kind === item.kind && i.id === item.id ? { ...i, needsReply: false } : i,
        ),
      );
      setNeedsReplyCount((c) => Math.max(0, c - 1));
      try {
        const ok = await voxModeService.markTriageItemRead(item.kind, item.id);
        if (!ok) rolledBack = true;
      } catch (err) {
        console.warn('[useRelayTriage] markRead failed:', err);
        rolledBack = true;
      }
      if (rolledBack) {
        setItems((prev) =>
          prev.map((i) =>
            i.kind === item.kind && i.id === item.id ? { ...i, needsReply: true } : i,
          ),
        );
        setNeedsReplyCount((c) => c + 1);
      }
    },
    [],
  );

  const markManyRead = useCallback(
    async (batch: TriageItem[]) => {
      const candidates = batch.filter((i) => i.needsReply);
      if (candidates.length === 0) return;
      await Promise.all(candidates.map((i) => markRead(i)));
    },
    [markRead],
  );

  const dismiss = useCallback(
    async (item: TriageItem) => {
      const key = `${item.kind}:${item.id}`;
      // Optimistic — drop the row immediately so the click feels instant.
      setItems((prev) => prev.filter((i) => !(i.kind === item.kind && i.id === item.id)));
      if (item.needsReply) {
        setNeedsReplyCount((c) => Math.max(0, c - 1));
      }
      setDismissedKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      const ok = await voxModeService.dismissTriageItem(item.kind, item.id);
      if (!ok) {
        // Rollback — put the item back and restore the count.
        setItems((prev) => {
          if (prev.some((i) => i.kind === item.kind && i.id === item.id)) return prev;
          return [...prev, item].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          );
        });
        if (item.needsReply) setNeedsReplyCount((c) => c + 1);
        setDismissedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [],
  );

  const undismiss = useCallback(
    async (item: TriageItem) => {
      const key = `${item.kind}:${item.id}`;
      const ok = await voxModeService.undismissTriageItem(item.kind, item.id);
      if (!ok) return;
      setDismissedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setItems((prev) => {
        if (prev.some((i) => i.kind === item.kind && i.id === item.id)) return prev;
        return [...prev, item].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        );
      });
      if (item.needsReply) setNeedsReplyCount((c) => c + 1);
    },
    [],
  );

  const remove = useCallback(
    async (item: TriageItem): Promise<boolean> => {
      // Optimistic removal — drop the row before the round-trip so the
      // confirm-then-delete flow doesn't sit on a spinner. Roll back if
      // the per-kind DELETE is RLS-rejected or fails for any reason.
      const beforeNeedsReply = item.needsReply;
      setItems((prev) => prev.filter((i) => !(i.kind === item.kind && i.id === item.id)));
      if (beforeNeedsReply) setNeedsReplyCount((c) => Math.max(0, c - 1));
      const ok = await voxModeService.deleteTriageItem(item.kind, item.id);
      if (!ok) {
        setItems((prev) => {
          if (prev.some((i) => i.kind === item.kind && i.id === item.id)) return prev;
          return [...prev, item].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          );
        });
        if (beforeNeedsReply) setNeedsReplyCount((c) => c + 1);
      }
      return ok;
    },
    [],
  );

  return {
    items,
    needsReplyCount,
    isLoading,
    error,
    refresh: userId ? fetchAll : noopRefresh,
    markRead: userId ? markRead : noopMarkRead,
    markManyRead: userId ? markManyRead : noopMarkManyRead,
    dismiss: userId ? dismiss : noopDismiss,
    undismiss: userId ? undismiss : noopDismiss,
    remove: userId ? remove : noopRemove,
  };
}
