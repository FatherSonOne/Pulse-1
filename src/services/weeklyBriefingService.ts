/**
 * Weekly Briefing Service
 *
 * Aggregates the weekly Pulse Briefing — a single-paragraph narrative + a
 * list of signal lines drawn from analyticsService, relationshipHealthService,
 * conflictDetectionService, recognitionService, and predictiveAnalyticsService.
 *
 * The lead paragraph is rendered through the central ai-router (task
 * `message_summary`); the signals list is templated deterministically so it
 * stays specific and citation-grounded.
 *
 * Distinct from `dailyBriefingService` (daily AI context for the Pulse AI sidebar nudges).
 */

import {
  getDashboardData,
  getResponseTimeStats,
  getTopContacts,
  ResponseTimeStats,
  DashboardData,
} from './analyticsService';
import {
  getRelationshipHealthSummary,
  getAllRelationshipHealth,
  RelationshipHealth,
} from './relationshipHealthService';
import {
  getActiveConflicts,
  ConflictTracking,
} from './conflictDetectionService';
import {
  getAllRecognitionEvents,
  RecognitionEvent,
} from './recognitionService';
import {
  getLatestBurnoutIndicator,
  BurnoutIndicator,
} from './predictiveAnalyticsService';
import { invokeAIPrompt } from './ai/aiService';
import { getCurrentWorkspaceId } from './ai/getWorkspaceId';

export type SignalKind =
  | 'cooling'
  | 'at_risk'
  | 'velocity_shift'
  | 'conflict'
  | 'win'
  | 'burnout';

export interface BriefingSignal {
  id: string;
  kind: SignalKind;
  /** One-sentence rendered copy, ready to display. */
  text: string;
  /** Subject the signal is about — used for the drill-down link. */
  subjectId?: string;
  subjectName?: string;
  /** Confidence 0..1; below 0.6 the signal is suppressed. */
  confidence: number;
}

export interface BriefingWin {
  id: string;
  fromName: string | null;
  snippet: string;
}

export interface WeeklyBriefing {
  weekStart: string;
  weekEnd: string;
  /** AI-generated lead paragraph; `null` if AI failed or threshold not met. */
  lead: string | null;
  /** Provenance of the lead paragraph when present. */
  leadProvenance: 'pulse_ai' | 'template' | null;
  signals: BriefingSignal[];
  wins: BriefingWin[];
  totalMessages: number;
  daysWithActivity: number;
  hasEnoughData: boolean;
}

const MIN_MESSAGES = 10;
const MIN_DAYS = 3;
const MIN_CONFIDENCE = 0.6;
const MAX_SIGNALS = 8;

function isoMonday(d: Date): string {
  const day = d.getDay();
  const offset = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - offset);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function isoSunday(monday: string): string {
  const m = new Date(monday + 'T00:00:00Z');
  m.setUTCDate(m.getUTCDate() + 6);
  return m.toISOString().slice(0, 10);
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? `${n} ${one}` : `${n} ${many}`;
}

function durationLabel(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return '—';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

function pickSlowestChannel(
  byChannel: ResponseTimeStats['byChannel'] | undefined,
): { channel: string; minutes: number } | null {
  if (!byChannel) return null;
  const entries = Object.entries(byChannel)
    .map(([channel, minutes]) => ({ channel, minutes: Number(minutes) }))
    .filter(e => e.minutes > 0);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b.minutes - a.minutes);
  return entries[0];
}

function pickFastestChannel(
  byChannel: ResponseTimeStats['byChannel'] | undefined,
): { channel: string; minutes: number } | null {
  if (!byChannel) return null;
  const entries = Object.entries(byChannel)
    .map(([channel, minutes]) => ({ channel, minutes: Number(minutes) }))
    .filter(e => e.minutes > 0);
  if (entries.length === 0) return null;
  entries.sort((a, b) => a.minutes - b.minutes);
  return entries[0];
}

function buildCoolingSignals(rels: RelationshipHealth[]): BriefingSignal[] {
  return rels
    .filter(r => r.health_status === 'cooling' || r.health_status === 'at_risk')
    .sort((a, b) => {
      // At-risk first; within each bucket, longest gap first.
      if (a.health_status !== b.health_status) {
        return a.health_status === 'at_risk' ? -1 : 1;
      }
      const ad = a.days_since_last_message ?? 0;
      const bd = b.days_since_last_message ?? 0;
      return bd - ad;
    })
    .map(r => {
      const days = r.days_since_last_message ?? 0;
      const name = r.contact_name || r.contact_identifier || 'A contact';
      const text = r.health_status === 'at_risk'
        ? `${name} hasn't replied in ${days} days. Normally a ${r.interaction_frequency || 'regular'} contact.`
        : `${name} has gone quiet. Last reply ${days} days ago.`;
      return {
        id: `cooling-${r.id}`,
        kind: r.health_status === 'at_risk' ? ('at_risk' as const) : ('cooling' as const),
        text,
        subjectId: r.contact_identifier,
        subjectName: name,
        confidence: r.health_score != null ? Math.min(1, Math.abs(50 - r.health_score) / 50 + 0.5) : 0.7,
      };
    });
}

function buildConflictSignals(conflicts: ConflictTracking[]): BriefingSignal[] {
  return conflicts.map(c => {
    const participant = c.contact_identifier || 'a contact';
    const topic = c.trigger_topic || c.conflict_type || 'a recent thread';
    return {
      id: `conflict-${c.id}`,
      kind: 'conflict' as const,
      text: `Conflict detected with ${participant} on "${topic}". Severity: ${c.severity}.`,
      subjectId: c.contact_identifier,
      subjectName: participant,
      confidence: c.tension_score != null ? Math.min(1, c.tension_score) : 0.7,
    };
  });
}

function buildVelocitySignal(
  responseStats: ResponseTimeStats | undefined,
): BriefingSignal | null {
  if (!responseStats) return null;
  const slowest = pickSlowestChannel(responseStats.byChannel);
  const fastest = pickFastestChannel(responseStats.byChannel);
  if (!slowest || !fastest || slowest.channel === fastest.channel) return null;
  if (slowest.minutes < fastest.minutes * 3) return null;
  return {
    id: 'velocity-channel-spread',
    kind: 'velocity_shift',
    text: `${capitalize(fastest.channel)} is your fastest channel (${durationLabel(fastest.minutes)} avg); ${slowest.channel} sits at ${durationLabel(slowest.minutes)}.`,
    confidence: 0.8,
  };
}

function buildBurnoutSignal(burnout: BurnoutIndicator | null): BriefingSignal | null {
  if (!burnout) return null;
  if (burnout.risk_level === 'low') return null;
  // Confidence derived from the risk score (0..100) — higher score = stronger signal.
  const confidence = burnout.burnout_risk_score != null
    ? Math.min(1, Math.max(0.5, burnout.burnout_risk_score / 100))
    : 0.7;
  return {
    id: `burnout-${burnout.id}`,
    kind: 'burnout',
    text: burnout.risk_level === 'critical'
      ? 'Burnout signal is critical. Messaging hours are well above your baseline.'
      : `Burnout signal is ${burnout.risk_level}. Worth a break or a lighter day.`,
    confidence,
  };
}

function buildWins(events: RecognitionEvent[]): BriefingWin[] {
  return events
    .filter(e => e.direction === 'received')
    .slice(0, 3)
    .map(e => ({
      id: e.id,
      fromName: e.from_contact_name ?? null,
      snippet: (e.message_excerpt || e.event_type || 'Kudos').slice(0, 80),
    }));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function templateLead(
  total: number,
  days: number,
  topChannel: string | null,
  signalCount: number,
): string {
  if (signalCount === 0) {
    return `Quiet week. ${plural(total, 'message', 'messages')} across ${plural(days, 'day', 'days')}, nothing worth flagging: relationships, response times and sentiment all held steady.`;
  }
  if (topChannel) {
    return `${plural(total, 'message', 'messages')} this week across ${plural(days, 'day', 'days')}. ${capitalize(topChannel)} carried most of the volume; ${plural(signalCount, 'signal', 'signals')} worth your attention.`;
  }
  return `${plural(total, 'message', 'messages')} this week across ${plural(days, 'day', 'days')}; ${plural(signalCount, 'signal', 'signals')} worth your attention.`;
}

async function aiLead(
  total: number,
  days: number,
  topChannel: string | null,
  signals: BriefingSignal[],
  wins: BriefingWin[],
): Promise<string | null> {
  const workspaceId = getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const signalSummary = signals.slice(0, 5).map(s => `- ${s.text}`).join('\n');
  const winsSummary = wins.length > 0
    ? wins.map(w => `- Kudos from ${w.fromName || 'a contact'}: ${w.snippet}`).join('\n')
    : 'No wins this week.';

  const prompt = `You are drafting the lead sentence of a weekly Pulse Briefing for a solo operator.
Volume: ${total} messages over ${days} active days. Top channel: ${topChannel ?? 'unknown'}.

Signals worth surfacing:
${signalSummary || 'None.'}

Wins:
${winsSummary}

Write ONE sentence (max 30 words) summarising the week. Be specific and declarative. No greetings, no exclamation points, no em dashes (use commas, colons, or semicolons). No second-person hedging. Output the sentence as plain text, no quotes, no markdown.`;

  try {
    const text = await invokeAIPrompt('message_summary', prompt, {
      workspaceId,
      temperature: 0.4,
    });
    const cleaned = text.trim().replace(/^["']|["']$/g, '').replace(/—/g, ',');
    if (!cleaned) return null;
    return cleaned;
  } catch {
    return null;
  }
}

export async function getWeeklyBriefing(weekOf?: Date): Promise<WeeklyBriefing> {
  const today = weekOf ?? new Date();
  const weekStart = isoMonday(today);
  const weekEnd = isoSunday(weekStart);

  const [dashboard, response, contacts, healthSummary, relationships, conflicts, recognitionEvents, burnout] = await Promise.all([
    getDashboardData(7),
    getResponseTimeStats(7),
    getTopContacts(10),
    getRelationshipHealthSummary(),
    getAllRelationshipHealth(),
    getActiveConflicts(),
    getAllRecognitionEvents(undefined, 20),
    getLatestBurnoutIndicator(),
  ]);

  void contacts;
  void healthSummary;

  const dashData: DashboardData | undefined = dashboard.success ? dashboard.data : undefined;
  const total = dashData?.total_messages ?? 0;
  const days = dashData?.daily_activity?.length ?? 0;
  const hasEnoughData = total >= MIN_MESSAGES && days >= MIN_DAYS;

  if (!hasEnoughData) {
    return {
      weekStart,
      weekEnd,
      lead: null,
      leadProvenance: null,
      signals: [],
      wins: [],
      totalMessages: total,
      daysWithActivity: days,
      hasEnoughData: false,
    };
  }

  const rawSignals: BriefingSignal[] = [
    ...buildCoolingSignals(((relationships.success ? relationships.data : []) ?? []) as RelationshipHealth[]),
    ...buildConflictSignals(((conflicts.success ? conflicts.data : []) ?? []) as ConflictTracking[]),
  ];
  const velocity = buildVelocitySignal(response.success ? response.data : undefined);
  if (velocity) rawSignals.push(velocity);
  const burnoutSignal = buildBurnoutSignal(burnout.success ? (burnout.data ?? null) : null);
  if (burnoutSignal) rawSignals.push(burnoutSignal);

  const signals = rawSignals
    .filter(s => s.confidence >= MIN_CONFIDENCE)
    .slice(0, MAX_SIGNALS);

  const wins = buildWins(((recognitionEvents.success ? recognitionEvents.data : []) ?? []) as RecognitionEvent[]);

  const channels = dashData?.channel_breakdown ?? {};
  const topChannelEntry = Object.entries(channels)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))[0];
  const topChannel = topChannelEntry ? topChannelEntry[0] : null;

  let lead = await aiLead(total, days, topChannel, signals, wins);
  let leadProvenance: 'pulse_ai' | 'template' = 'pulse_ai';
  if (!lead) {
    lead = templateLead(total, days, topChannel, signals.length);
    leadProvenance = 'template';
  }

  return {
    weekStart,
    weekEnd,
    lead,
    leadProvenance,
    signals,
    wins,
    totalMessages: total,
    daysWithActivity: days,
    hasEnoughData: true,
  };
}

export const briefingThresholds = {
  MIN_MESSAGES,
  MIN_DAYS,
  MIN_CONFIDENCE,
};
