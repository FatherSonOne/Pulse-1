import { supabase } from './supabaseClient';
import { decisionService } from './decisionService';
import { taskService } from './taskService';

/**
 * Dev-only seed for the Decisions & Tasks surface. Generates a mixed payload
 * across every status section so the Active and Board views can be
 * exercised against realistic data.
 *
 * Every row is tagged with `metadata.is_sample = true` so cleanup deletes
 * only what this service inserted — never real workspace data.
 */
export const SAMPLE_TAG_KEY = 'is_sample';
export const SAMPLE_TAG_VALUE = true;

interface SeedInput {
  workspaceId: string;
  userId: string;
}

interface LoadResult {
  decisions: number;
  tasks: number;
  votes: number;
}

interface ClearResult {
  decisions: number;
  tasks: number;
}

const daysFromNow = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

const hoursAgo = (hours: number): string => {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
};

export const seedSampleDataService = {
  /**
   * Inserts a curated set of decisions + tasks covering every status
   * section. Returns counts so the UI can confirm the operation.
   *
   * Order of operations matters: decisions are inserted first because
   * some tasks reference them via metadata.generated_from_decision.
   */
  async loadSampleData({ workspaceId, userId }: SeedInput): Promise<LoadResult> {
    let decisionCount = 0;
    let taskCount = 0;
    let voteCount = 0;

    // ────────────────────────────────────────────────────────────────────
    // DECISIONS
    // ────────────────────────────────────────────────────────────────────

    // 1. Proposed — fresh idea, not yet up for vote.
    const proposed = await decisionService.createDecision({
      workspace_id: workspaceId,
      title: 'Pick a billing system for Q3 launch',
      description: 'Stripe vs Lago vs Paddle. Need recurring + metered + tax. Decision needed before pricing page goes live.',
      decision_type: 'product',
      proposed_by: userId,
    });
    if (proposed) {
      decisionCount += 1;
      await decisionService.updateDecision(proposed.id, {
        metadata: { [SAMPLE_TAG_KEY]: SAMPLE_TAG_VALUE, frame_id: 'pick_tool' },
      });
    }

    // 2. Voting — actively seeking input.
    const voting = await decisionService.createDecision({
      workspace_id: workspaceId,
      title: 'Move daily standup to async (Loom + thread)',
      description: 'Synchronous standup is eating the morning focus block. Trial async for 2 weeks; revisit.',
      decision_type: 'process',
      proposed_by: userId,
    });
    if (voting) {
      decisionCount += 1;
      await decisionService.updateDecision(voting.id, {
        metadata: { [SAMPLE_TAG_KEY]: SAMPLE_TAG_VALUE },
      });
      await decisionService.updateDecisionStatus(voting.id, 'voting');
      // Self-vote pair so the card renders with vote counts.
      const approveVote = await decisionService.castVote({
        decision_id: voting.id,
        user_id: userId,
        choice: 'approve',
        comment: 'Async beats sync for focus time.',
      });
      if (approveVote) voteCount += 1;
    }

    // 3. Decided — concluded. Will land in Decided unless linked tasks exist.
    const decided = await decisionService.createDecision({
      workspace_id: workspaceId,
      title: 'Adopt Claude Sonnet 4.6 as the default model',
      description: 'Quality + cost ratio outperforms Opus on 80% of tasks. Opus stays available for hard tasks.',
      decision_type: 'technical',
      proposed_by: userId,
    });
    if (decided) {
      decisionCount += 1;
      await decisionService.updateDecision(decided.id, {
        metadata: { [SAMPLE_TAG_KEY]: SAMPLE_TAG_VALUE },
      });
      await decisionService.finalizeDecision(
        decided.id,
        'Sonnet 4.6 default; Opus 4.7 available behind the model picker for power users.'
      );
    }

    // ────────────────────────────────────────────────────────────────────
    // TASKS
    // ────────────────────────────────────────────────────────────────────

    const tasksToCreate: Array<Parameters<typeof taskService.createTask>[0]> = [
      // To Do (3)
      {
        workspace_id: workspaceId,
        title: 'Draft the Q3 launch checklist',
        description: 'Marketing, billing, support, status page, observability gates.',
        priority: 'high',
        status: 'todo',
        metadata: { [SAMPLE_TAG_KEY]: SAMPLE_TAG_VALUE },
      },
      {
        workspace_id: workspaceId,
        title: 'Schedule investor sync for next Tuesday',
        description: 'Confirm time with B & R, send agenda 24h ahead.',
        priority: 'medium',
        status: 'todo',
        deadline: daysFromNow(1),
        metadata: { [SAMPLE_TAG_KEY]: SAMPLE_TAG_VALUE },
      },
      {
        workspace_id: workspaceId,
        title: 'Review onboarding copy after Sonnet decision',
        description: 'Update model references on /docs and /pricing.',
        priority: 'medium',
        status: 'todo',
        metadata: {
          [SAMPLE_TAG_KEY]: SAMPLE_TAG_VALUE,
          ...(decided?.id ? { generated_from_decision: decided.id, decision_title: decided.title } : {}),
        },
      },

      // In Progress (2)
      {
        workspace_id: workspaceId,
        title: 'Wire up Stripe invoices to the billing dashboard',
        description: 'PDF download + email delivery. Test with sandbox account first.',
        priority: 'high',
        status: 'in_progress',
        deadline: daysFromNow(3),
        metadata: { [SAMPLE_TAG_KEY]: SAMPLE_TAG_VALUE },
      },
      {
        workspace_id: workspaceId,
        title: 'Migrate Capacitor 6 → 7',
        description: 'Audit plugins, run on Pixel 8 + iPhone 14, update splash assets.',
        priority: 'medium',
        status: 'in_progress',
        metadata: { [SAMPLE_TAG_KEY]: SAMPLE_TAG_VALUE },
      },

      // In Review (1)
      {
        workspace_id: workspaceId,
        title: 'PR #142: realtime channel cleanup on workspace switch',
        description: 'Stale subscriptions leaked across switches. Fix + regression test.',
        priority: 'medium',
        status: 'in_review',
        metadata: { [SAMPLE_TAG_KEY]: SAMPLE_TAG_VALUE },
      },

      // Blocked (1)
      {
        workspace_id: workspaceId,
        title: 'Sign vendor MSA with Notion',
        description: 'Legal flagged the auto-renewal clause. Waiting on counter-redline.',
        priority: 'high',
        status: 'blocked',
        deadline: daysFromNow(-2), // overdue, to demonstrate the Overdue group too
        metadata: {
          [SAMPLE_TAG_KEY]: SAMPLE_TAG_VALUE,
          blocked_reason: 'Awaiting redlined MSA from Notion legal',
        },
      },

      // Done (2) — recent so they appear in "Recently Completed" on Active view
      {
        workspace_id: workspaceId,
        title: 'Ship voice command auto-execute confirm gate',
        description: '2s cancel-window for destructive voice commands.',
        priority: 'medium',
        status: 'done',
        metadata: {
          [SAMPLE_TAG_KEY]: SAMPLE_TAG_VALUE,
          completed_at: hoursAgo(20),
        },
      },
      {
        workspace_id: workspaceId,
        title: 'Push v0.4.2 to TestFlight',
        description: 'Internal testers only. Watch crash-free rate before promoting.',
        priority: 'high',
        status: 'done',
        metadata: {
          [SAMPLE_TAG_KEY]: SAMPLE_TAG_VALUE,
          completed_at: hoursAgo(4),
        },
      },
    ];

    for (const data of tasksToCreate) {
      const created = await taskService.createTask(data);
      if (created) taskCount += 1;
    }

    return { decisions: decisionCount, tasks: taskCount, votes: voteCount };
  },

  /**
   * Deletes only rows tagged with `metadata.is_sample = true` for this
   * workspace. Real workspace data is never touched.
   *
   * Decision votes are cleared first to avoid FK constraint surprises;
   * Postgres ON DELETE CASCADE handles it on most schemas, but the
   * explicit clear keeps cleanup safe across schema versions.
   */
  async clearSampleData({ workspaceId }: { workspaceId: string }): Promise<ClearResult> {
    // Find sample decisions for this workspace.
    const { data: sampleDecisions } = await supabase
      .from('decisions')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq(`metadata->>${SAMPLE_TAG_KEY}`, String(SAMPLE_TAG_VALUE));

    const decisionIds = (sampleDecisions ?? []).map((d) => d.id);

    if (decisionIds.length > 0) {
      await supabase.from('decision_votes').delete().in('decision_id', decisionIds);
    }

    const { data: deletedDecisions, error: dErr } = await supabase
      .from('decisions')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq(`metadata->>${SAMPLE_TAG_KEY}`, String(SAMPLE_TAG_VALUE))
      .select('id');
    if (dErr) console.error('clearSampleData decisions error:', dErr);

    const { data: deletedTasks, error: tErr } = await supabase
      .from('extracted_tasks')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq(`metadata->>${SAMPLE_TAG_KEY}`, String(SAMPLE_TAG_VALUE))
      .select('id');
    if (tErr) console.error('clearSampleData tasks error:', tErr);

    return {
      decisions: deletedDecisions?.length ?? 0,
      tasks: deletedTasks?.length ?? 0,
    };
  },

  /**
   * Quick check: does this workspace already have sample rows? Lets the UI
   * disable Load when sample data is present (avoids accidental duplicates).
   */
  async hasSampleData({ workspaceId }: { workspaceId: string }): Promise<boolean> {
    const [{ count: dCount }, { count: tCount }] = await Promise.all([
      supabase
        .from('decisions')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq(`metadata->>${SAMPLE_TAG_KEY}`, String(SAMPLE_TAG_VALUE)),
      supabase
        .from('extracted_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq(`metadata->>${SAMPLE_TAG_KEY}`, String(SAMPLE_TAG_VALUE)),
    ]);

    return (dCount ?? 0) > 0 || (tCount ?? 0) > 0;
  },
};
