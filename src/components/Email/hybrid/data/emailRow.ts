// EmailRow — view-model type the Cockpit components consume.
// Bridges between MockEmail (Phase 1 design fidelity) and CachedEmail (Phase 2 live data).
// Components ONLY know about EmailRow; the adapter below produces one from a CachedEmail.

import type { CachedEmail } from '../../../../services/emailSyncService';

export type EmailLane = 'work' | 'admin' | 'tools' | 'news' | 'personal';
export type EmailTone = 'warm' | 'cool' | 'cold' | 'hot';
export type AiActionKind = 'reply' | 'task' | 'snooze' | 'link' | 'meet' | 'rsvp';

export interface AiAction {
  id: string;
  label: string;
  kind: AiActionKind;
}

export interface EmailRow {
  id: string;
  from: string;          // display name
  fromEmail: string;     // raw email address
  org: string | null;    // org / company derived from email domain (null for personal addresses)
  subject: string;
  body: string;
  when: string;          // relative ("2h", "1d")
  whenLong: string;      // full timestamp ("Today · 11:42 AM")
  unread: boolean;
  starred: boolean;
  lane: EmailLane;
  tone: EmailTone;
  aiSummary: string | null;
  aiActions: AiAction[];
  threadCount: number;
  threadId: string | null;
  draft: string | null;
  /**
   * Original CachedEmail row when this EmailRow came from live data.
   * Mock-data EmailRows leave this undefined; row actions become no-ops in that case.
   */
  _raw?: CachedEmail;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function getRelativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  const delta = Math.max(0, now.getTime() - t);
  if (delta < MINUTE)        return 'now';
  if (delta < HOUR)          return `${Math.floor(delta / MINUTE)}m`;
  if (delta < DAY)           return `${Math.floor(delta / HOUR)}h`;
  if (delta < 7 * DAY)       return `${Math.floor(delta / DAY)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatLongTimestamp(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now.getTime() - DAY);
  const wasYesterday = d.toDateString() === yesterday.toDateString();
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay)      return `Today · ${timeStr}`;
  if (wasYesterday) return `Yesterday · ${timeStr}`;
  const days = Math.floor((now.getTime() - d.getTime()) / DAY);
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Pull an org/company label from the sender's email domain. Null for free-mail. */
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com',
  'hotmail.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me',
  'protonmail.com', 'pm.me', 'fastmail.com',
]);
export function deriveOrg(fromEmail: string, fromName: string | null): string | null {
  if (!fromEmail) return null;
  const domain = fromEmail.split('@')[1]?.toLowerCase();
  if (!domain || FREE_MAIL.has(domain)) return null;
  // Use the second-level domain as a rough org name (`linear.app` → `Linear`).
  const root = domain.split('.').slice(-2, -1)[0] || domain;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

/** Derive a tone label from ai_sentiment + reply timing. Defaults to 'cool'. */
export function deriveTone(email: CachedEmail): EmailTone {
  const sentiment = (email.ai_sentiment || '').toLowerCase();
  if (sentiment === 'urgent' || sentiment === 'angry')  return 'hot';
  if (sentiment === 'positive' || sentiment === 'warm') return 'warm';
  if (sentiment === 'neutral' || sentiment === 'cool')  return 'cool';
  // Cooling threads (no reply > 7 days) get 'cold'
  const age = Date.now() - new Date(email.received_at).getTime();
  if (age > 7 * DAY) return 'cold';
  return 'cool';
}

/**
 * Bucket a CachedEmail into one of the five Cockpit lanes.
 * Order matters: sender-domain check beats Gmail category labels because
 * tooling senders (github.com, linear.app, etc.) often get filed into
 * CATEGORY_UPDATES by Gmail and we want them under Tools instead.
 */
const TOOL_DOMAINS = [
  'github.com', 'gitlab.com', 'bitbucket.org', 'linear.app', 'notion.com',
  'slack.com', 'figma.com', 'vercel.com', 'render.com', 'netlify.com',
  'sentry.io', 'posthog.com', 'datadog.com', 'pagerduty.com', 'newrelic.com',
  'cloudflare.com', 'aws.amazon.com', 'gcp.com', 'circleci.com',
];

export function categorize(email: CachedEmail): EmailLane {
  const domain = email.from_email?.split('@')[1]?.toLowerCase() || '';
  if (TOOL_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d))) return 'tools';

  const labels = new Set((email.labels || []).map((l) => l.toUpperCase()));
  if (labels.has('CATEGORY_PROMOTIONS') || labels.has('CATEGORY_FORUMS')) return 'news';
  if (labels.has('CATEGORY_UPDATES')) return 'admin';
  if (labels.has('CATEGORY_SOCIAL')) return 'personal';
  // Free-mail senders without a category usually = personal correspondence
  if (FREE_MAIL.has(domain)) return 'personal';
  return 'work';
}

/** Convert a live CachedEmail into the view-model EmailRow the Cockpit consumes. */
export function cachedEmailToRow(email: CachedEmail, now: Date = new Date()): EmailRow {
  const aiActions: AiAction[] = (email.ai_suggested_replies || [])
    .slice(0, 2)
    .map((label, i) => ({ id: `sr-${i}`, label, kind: 'reply' as const }));

  return {
    id: email.id,
    from: email.from_name || email.from_email || 'Unknown sender',
    fromEmail: email.from_email || '',
    org: deriveOrg(email.from_email || '', email.from_name),
    subject: email.subject || '(no subject)',
    body: email.body_text || email.snippet || '',
    when: getRelativeTime(email.received_at, now),
    whenLong: formatLongTimestamp(email.received_at, now),
    unread: !email.is_read,
    starred: email.is_starred,
    lane: categorize(email),
    tone: deriveTone(email),
    aiSummary: email.ai_summary,
    aiActions,
    threadCount: 1, // updated when thread is lazily fetched in InlineReader
    threadId: email.thread_id || null,
    draft: null, // AI draft generation lands in v1.1 per handoff §4.5
    _raw: email,
  };
}

// ─── Briefing synthesis ─────────────────────────────────────────────────────

export function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatTodayShort(now: Date = new Date()): string {
  // "Wed May 27"
  return now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const NUMBER_WORD = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

/**
 * Build the editorial headline from the top-priority emails.
 * Mirrors the playground copy "Three things move today. / Maria's deck, Sarah's NDA, Priya's reply."
 *   - Empty pool → calmer "You're caught up." pair.
 *   - 1–6 unread priorities → "N things move today. / [Name1's subject, …]."
 */
export function synthesizeHeadline(
  topThree: CachedEmail[],
): { headlineLead: string; headlineNames: string } {
  if (topThree.length === 0) {
    return {
      headlineLead: "You're caught up.",
      headlineNames: 'Nothing urgent is waiting on you right now.',
    };
  }

  const word = NUMBER_WORD[topThree.length] || 'Several';
  const verb = topThree.length === 1 ? 'thing moves today.' : 'things move today.';
  const names = topThree
    .map((e) => {
      const firstName = ((e.from_name || e.from_email || '').split(/\s|@/)[0] || '').replace(/[,;]+$/, '');
      const subjectKeyword = extractSubjectKeyword(e.subject || '');
      return `${firstName}'s ${subjectKeyword}`;
    })
    .join(', ') + '.';

  return { headlineLead: `${word} ${verb}`, headlineNames: names };
}

function extractSubjectKeyword(subject: string): string {
  const cleaned = subject.replace(/^(Re|Fwd|Fw):\s*/i, '').trim();
  const firstWord = cleaned.split(/[\s—–-]+/)[0]?.toLowerCase().replace(/[.,!?:;()"']/g, '');
  return firstWord || 'reply';
}
