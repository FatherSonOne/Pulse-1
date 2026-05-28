// useCockpitData — live data hook for the Cockpit.
// Ports DailyBriefing.loadBriefing heuristics (greeting + counts + top-priority
// + follow-up detection) and exposes a stable shape the Cockpit components
// consume regardless of the data source.
import { useEffect, useMemo, useState } from 'react';
import { useEmailStore } from '../../../../store/emailStore';
import { emailSyncService, type CachedEmail } from '../../../../services/emailSyncService';
import {
  cachedEmailToRow,
  categorize,
  formatTodayShort,
  getGreeting,
  synthesizeHeadline,
  type EmailLane,
  type EmailRow,
} from './emailRow';

export interface BriefingMeta {
  greeting: string;
  dateStr: string;
  newSinceMorning: number;
  needsYou: number;
  batched: number;
  headlineLead: string;
  headlineNames: string;
  body: string;
}

export interface AwaitingReplyRow {
  emailId: string;
  name: string;
  subject: string;
  days: number;
  cold: boolean;
}

export interface CockpitData {
  briefingMeta: BriefingMeta;
  signalEmails: EmailRow[];
  laneBuckets: Record<EmailLane, EmailRow[]>;
  awaitingReplies: AwaitingReplyRow[];
  loading: boolean;
  isEmpty: boolean;
}

const EMPTY_LANE_BUCKETS: Record<EmailLane, EmailRow[]> = {
  work: [], admin: [], tools: [], news: [], personal: [],
};

const FOLLOW_UP_WINDOW_DAYS = 14;
const COLD_THREAD_THRESHOLD_DAYS = 7;

export function useCockpitData(): CockpitData {
  const emails = useEmailStore((s) => s.emails);
  const loading = useEmailStore((s) => s.loading);

  // Awaiting-replies state is derived from sent emails (not on emailStore.emails);
  // fetched once + refreshed whenever the inbox state changes.
  const [awaitingReplies, setAwaitingReplies] = useState<AwaitingReplyRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await computeAwaitingReplies(emails);
      if (!cancelled) setAwaitingReplies(rows);
    })();
    return () => { cancelled = true; };
  }, [emails]);

  return useMemo<CockpitData>(() => {
    const now = new Date();

    const briefingMeta = computeBriefingMeta(emails, now);
    const signalEmails = emails
      .filter((e) => !e.is_read && (e.ai_priority_score || 0) >= 60)
      .sort((a, b) => (b.ai_priority_score || 0) - (a.ai_priority_score || 0))
      .slice(0, 5)
      .map((e) => cachedEmailToRow(e, now));

    const laneBuckets: Record<EmailLane, EmailRow[]> = { ...EMPTY_LANE_BUCKETS };
    for (const lane of Object.keys(laneBuckets) as EmailLane[]) {
      laneBuckets[lane] = [];
    }
    for (const e of emails) {
      const lane = categorize(e);
      laneBuckets[lane].push(cachedEmailToRow(e, now));
    }

    return {
      briefingMeta,
      signalEmails,
      laneBuckets,
      awaitingReplies,
      loading,
      isEmpty: !loading && emails.length === 0,
    };
  }, [emails, loading, awaitingReplies]);
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function computeBriefingMeta(emails: CachedEmail[], now: Date): BriefingMeta {
  const sixAm = new Date(now);
  sixAm.setHours(6, 0, 0, 0);

  const newSinceMorning = emails.filter((e) => new Date(e.received_at) > sixAm).length;
  const needsYou = emails.filter(
    (e) =>
      !e.is_read &&
      ((e.ai_priority_score || 0) >= 70 || e.ai_sentiment === 'urgent'),
  ).length;
  const batched = Math.max(0, emails.length - needsYou);

  const topThree = emails
    .filter((e) => !e.is_read)
    .sort((a, b) => (b.ai_priority_score || 0) - (a.ai_priority_score || 0))
    .slice(0, 3);
  const { headlineLead, headlineNames } = synthesizeHeadline(topThree);

  const body =
    needsYou > 0
      ? `Pulse AI scanned ${emails.length} email${emails.length === 1 ? '' : 's'} in your inbox. ${needsYou} need${needsYou === 1 ? 's' : ''} your attention — the rest can wait, or have been filed into a lane below.`
      : `Pulse AI scanned ${emails.length} email${emails.length === 1 ? '' : 's'} in your inbox. Nothing urgent surfaced — everything has been filed into a lane below.`;

  return {
    greeting: getGreeting(now),
    dateStr: formatTodayShort(now),
    newSinceMorning,
    needsYou,
    batched,
    headlineLead,
    headlineNames,
    body,
  };
}

/**
 * Port of DailyBriefing's follow-up heuristic: sent emails in the last 14 days
 * whose thread has no incoming reply. Returns the rows for the right-rail
 * "Awaiting replies" panel, with `cold = true` for threads idle > 7 days.
 */
async function computeAwaitingReplies(inboxEmails: CachedEmail[]): Promise<AwaitingReplyRow[]> {
  try {
    const fourteenDaysAgo = Date.now() - FOLLOW_UP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const sent = await emailSyncService.getEmailsByFolder('sent', 50, 0);
    const recent = sent.filter((e) => new Date(e.received_at).getTime() > fourteenDaysAgo);

    const inboxByThread = new Map<string, CachedEmail[]>();
    for (const e of inboxEmails) {
      if (!e.thread_id) continue;
      const list = inboxByThread.get(e.thread_id) || [];
      list.push(e);
      inboxByThread.set(e.thread_id, list);
    }

    const seenThreads = new Set<string>();
    const rows: AwaitingReplyRow[] = [];
    for (const s of recent) {
      if (!s.thread_id || seenThreads.has(s.thread_id)) continue;
      const replies = inboxByThread.get(s.thread_id) || [];
      const hasReply = replies.some(
        (r) => !r.is_sent && new Date(r.received_at) > new Date(s.received_at),
      );
      if (hasReply) continue;
      seenThreads.add(s.thread_id);

      const daysAgo = Math.floor((Date.now() - new Date(s.received_at).getTime()) / (24 * 60 * 60 * 1000));
      const firstRecipient = s.to_emails?.[0];
      rows.push({
        emailId: s.id,
        name: firstRecipient?.name || firstRecipient?.email || 'Unknown',
        subject: s.subject || '(no subject)',
        days: daysAgo,
        cold: daysAgo >= COLD_THREAD_THRESHOLD_DAYS,
      });

      if (rows.length >= 4) break;
    }
    return rows;
  } catch (err) {
    console.warn('[useCockpitData] computeAwaitingReplies failed:', err);
    return [];
  }
}
