import { supabase } from './supabase';
import { AppView } from '../types';

export type NudgeKind = 'friction-to-decision' | 'stale-reply' | 'decisions-waiting' | 'focus-gap' | 'capture-streak' | 'invite-teammate';
export type NudgeProvider = 'pulse' | 'claude' | 'gemini';

export interface NudgeAction {
  label: string;
  // Caller resolves the dispatch — usually `setView(action.view)` or a custom
  // event. The service stays UI-free: it returns hints, not handlers.
  view?: AppView;
  event?: { type: string; detail?: unknown };
  focusNoteId?: string;
  focusDecisionId?: string;
  /** Route to a Settings section + focus token (deterministic activation
   *  chrome). The widget resolves this via navigateToTeamInvite. */
  settings?: { section: string; focus?: string };
}

export interface Nudge {
  id: string;
  kind: NudgeKind;
  text: string;
  cta: NudgeAction;
  priority: number; // higher = surface first
  provider: NudgeProvider;
}

interface NudgeContext {
  workspaceId: string;
  authUserId: string;
  // Optional: caller-supplied awaiting-reply derived state — saves a duplicate
  // fetch since the dashboard already computes this.
  staleAwaitingReply?: { contactName: string; ageDays: number; threadId: string } | null;
  // Caller-supplied workspace/permission state (already in React context, no
  // duplicate fetch). Drives the first-30-days invite-teammate nudge (AC2):
  // member-count proxy for the collaborative-depth signal — NOT a message
  // query (the NSM weekly-message half is deferred to the unshipped cron).
  memberCount?: number;
  workspaceCreatedAt?: string | null;
  canManageMembers?: boolean;
}

const ONE_DAY_MS = 86_400_000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;

// Deterministic synthesis from a small batched query set. No LLM call by
// default — predictable, cheap, runs once on dashboard mount. Returns the top
// nudges sorted by priority. A future re-rank pass can sort the same list
// with an LLM; the contract doesn't change.
export async function getPulseNudges(ctx: NudgeContext): Promise<Nudge[]> {
  const { workspaceId, authUserId } = ctx;
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

  // Five parallel reads, each scoped narrowly. Failures degrade silently —
  // an empty signal just suppresses its nudge.
  const [frictions, decisions, focusSessions, captures] = await Promise.all([
    supabase
      .from('pulse_notes')
      .select('id, content, created_at, routed_decision_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', authUserId)
      .eq('kind', 'friction')
      .is('archived_at', null)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: true })
      .limit(20),
    supabase
      .from('decisions')
      .select('id, proposal_text, created_at')
      .eq('workspace_id', workspaceId)
      .eq('status', 'voting')
      .is('archived_at', null)
      .limit(20),
    supabase
      .from('focus_sessions')
      .select('id, started_at, status')
      .eq('user_id', authUserId)
      .gte('started_at', sevenDaysAgo)
      .limit(50),
    supabase
      .from('pulse_notes')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', authUserId)
      .is('archived_at', null)
      .gte('created_at', sevenDaysAgo),
  ]);

  // If decisions came back, strip the ones the operator has already voted on
  // — same logic as the Team Decisions Waiting strip.
  let waitingDecisions: Array<{ id: string; proposal_text: string | null; created_at: string }> = [];
  if (decisions.data && decisions.data.length > 0) {
    const votes = await supabase
      .from('decision_votes')
      .select('decision_id')
      .eq('user_id', authUserId)
      .in('decision_id', decisions.data.map(d => d.id));
    const voted = new Set((votes.data ?? []).map(v => v.decision_id));
    waitingDecisions = decisions.data.filter(d => !voted.has(d.id));
  }

  const nudges: Nudge[] = [];

  // 1) Stale reply (highest priority — relational debt accrues fast)
  if (ctx.staleAwaitingReply && ctx.staleAwaitingReply.ageDays >= 3) {
    const r = ctx.staleAwaitingReply;
    nudges.push({
      id: `stale-reply:${r.threadId}`,
      kind: 'stale-reply',
      text: `${r.contactName} has been waiting on you for ${r.ageDays} day${r.ageDays === 1 ? '' : 's'}.`,
      cta: { label: 'Draft a reply', view: AppView.MESSAGES },
      priority: 100,
      provider: 'pulse',
    });
  }

  // 2) Unrouted frictions — operator captured pain, hasn't formalized any of it
  const unrouted = (frictions.data ?? []).filter(f => !f.routed_decision_id);
  if (unrouted.length >= 2) {
    const oldest = unrouted[0];
    nudges.push({
      id: `friction-to-decision:${oldest.id}`,
      kind: 'friction-to-decision',
      text: `You captured ${unrouted.length} frictions this week. Want to turn one into a decision?`,
      cta: {
        label: 'Route to decisions',
        view: AppView.ARCHIVES,
        focusNoteId: oldest.id,
      },
      priority: 70,
      provider: 'pulse',
    });
  }

  // 3) Decisions awaiting this user's vote — only surface if there are several
  if (waitingDecisions.length >= 3) {
    const oldest = waitingDecisions
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    nudges.push({
      id: `decisions-waiting:${oldest.id}`,
      kind: 'decisions-waiting',
      text: `${waitingDecisions.length} decisions are waiting on your vote.`,
      cta: {
        label: 'Decide',
        view: AppView.DECISIONS_TASKS,
        focusDecisionId: oldest.id,
      },
      priority: 60,
      provider: 'pulse',
    });
  }

  // 4) Focus gap — zero completed sessions in the last 7 days
  const completedFocus = (focusSessions.data ?? []).filter(f => f.status === 'completed').length;
  if (completedFocus === 0) {
    nudges.push({
      id: 'focus-gap',
      kind: 'focus-gap',
      text: "You've had no focus sessions this week. Block 90 minutes?",
      cta: { label: 'Start focus', view: AppView.MESSAGES },
      priority: 50,
      provider: 'pulse',
    });
  }

  // 5) Capture streak — operator captured nothing this week (when at least one
  // friction was captured prior, this nudge is *not* shown — it's only for the
  // cold-start "habit is slipping" case)
  const captureCount = (captures.data ?? []).length;
  if (captureCount === 0) {
    nudges.push({
      id: 'capture-streak',
      kind: 'capture-streak',
      text: 'No captures this week. Press ⌘J to log a thought.',
      cta: {
        label: 'Capture',
        event: { type: 'pulse:capture-open', detail: { sourceSection: 'dashboard' } },
      },
      priority: 30,
      provider: 'pulse',
    });
  }

  // 6) Invite a teammate — first-30-days activation nudge (AC2). Deterministic
  //    (NOT AI): fires only while the workspace is still solo (member-count
  //    proxy), within the first-30-days window, and the user can actually act
  //    (canManageMembers). Routes to the existing invite surface. Priority sits
  //    below relational/operational debt but above habit nudges so it surfaces
  //    for a fresh solo workspace (where those rarely fire) without crowding an
  //    active team's urgent items.
  const memberCount = ctx.memberCount;
  const createdAt = ctx.workspaceCreatedAt ? new Date(ctx.workspaceCreatedAt).getTime() : null;
  const withinFirst30Days =
    createdAt !== null && !Number.isNaN(createdAt) && Date.now() - createdAt <= THIRTY_DAYS_MS;
  if (
    ctx.canManageMembers === true &&
    typeof memberCount === 'number' &&
    memberCount < 2 &&
    withinFirst30Days
  ) {
    nudges.push({
      id: `invite-teammate:${workspaceId}`,
      kind: 'invite-teammate',
      text: 'Pulse gets better with your team — invite a teammate to start collaborating.',
      cta: {
        label: 'Invite a teammate',
        settings: { section: 'team', focus: 'invite' },
      },
      priority: 55,
      provider: 'pulse',
    });
  }

  return nudges.sort((a, b) => b.priority - a.priority).slice(0, 4);
}
