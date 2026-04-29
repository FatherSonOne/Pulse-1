// Decision context service. Phase 4 of the Decisions and Tasks overhaul.
//
// Manages the structured-context fields on a decision (criteria, options,
// stakeholders, outcome) plus the comparison-view scoring grid and the
// outcome retrospective scheduler.

import { supabase } from './supabase';
import { decisionActivityService } from './decisionActivityService';

export interface Criterion {
  id: string;
  label: string;
  /** 1 = least important, 5 = most important. */
  weight: number;
}

export interface DecisionOption {
  id: string;
  label: string;
  description?: string;
}

export interface DecisionOutcome {
  recorded_at: string;
  rating: 'good' | 'neutral' | 'poor';
  reflection: string;
}

export interface OptionScore {
  id: string;
  decisionId: string;
  userId: string;
  optionId: string;
  criterionId: string;
  /** 1-5 (matches DB CHECK constraint). */
  score: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RetrospectivePrompt {
  id: string;
  decisionId: string;
  userId: string;
  fireAt: string;
  resolvedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

export const decisionContextService = {
  /** Update the structured-context fields on a decision. */
  async updateContext(
    decisionId: string,
    fields: {
      criteria?: Criterion[];
      options?: DecisionOption[];
      stakeholders?: string[];
      decideByDate?: string | null;
      frameId?: string;
    }
  ): Promise<boolean> {
    const patch: Record<string, unknown> = {};
    if (fields.criteria !== undefined) patch.criteria = fields.criteria;
    if (fields.options !== undefined) patch.options = fields.options;
    if (fields.stakeholders !== undefined) patch.stakeholders = fields.stakeholders;
    if (fields.decideByDate !== undefined) patch.decide_by_date = fields.decideByDate;
    if (fields.frameId !== undefined) patch.frame_id = fields.frameId;
    if (Object.keys(patch).length === 0) return true;

    const { error } = await supabase
      .from('decisions')
      .update(patch)
      .eq('id', decisionId);

    if (error) {
      console.error('Error updating decision context:', error);
      return false;
    }
    return true;
  },

  /** Read all option scores for a decision. */
  async getScores(decisionId: string): Promise<OptionScore[]> {
    const { data, error } = await supabase
      .from('decision_option_scores')
      .select('*')
      .eq('decision_id', decisionId);
    if (error) {
      console.error('Error loading option scores:', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      decisionId: r.decision_id,
      userId: r.user_id,
      optionId: r.option_id,
      criterionId: r.criterion_id,
      score: r.score,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  /** Upsert one stakeholder's score for one (option, criterion) cell. */
  async setScore(opts: {
    decisionId: string;
    workspaceId: string;
    userId: string;
    optionId: string;
    criterionId: string;
    score: number; // 1-5
    notes?: string;
  }): Promise<boolean> {
    const { error } = await supabase
      .from('decision_option_scores')
      .upsert(
        {
          decision_id: opts.decisionId,
          workspace_id: opts.workspaceId,
          user_id: opts.userId,
          option_id: opts.optionId,
          criterion_id: opts.criterionId,
          score: opts.score,
          notes: opts.notes ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'decision_id,user_id,option_id,criterion_id' }
      );
    if (error) {
      console.error('Error setting option score:', error);
      return false;
    }
    return true;
  },

  /** Compute a weighted aggregate score per option from all stakeholder scores. */
  aggregateOptionScores(
    scores: OptionScore[],
    criteria: Criterion[]
  ): Array<{ optionId: string; weightedScore: number; coverage: number }> {
    const optionIds = Array.from(new Set(scores.map((s) => s.optionId)));
    return optionIds
      .map((optionId) => {
        let weightedSum = 0;
        let weightTotal = 0;
        let cells = 0;
        for (const c of criteria) {
          const cellScores = scores.filter((s) => s.optionId === optionId && s.criterionId === c.id);
          if (cellScores.length === 0) continue;
          const avg = cellScores.reduce((sum, s) => sum + s.score, 0) / cellScores.length;
          weightedSum += avg * c.weight;
          weightTotal += c.weight;
          cells += 1;
        }
        const expectedCells = criteria.length;
        return {
          optionId,
          weightedScore: weightTotal > 0 ? weightedSum / weightTotal : 0,
          coverage: expectedCells > 0 ? cells / expectedCells : 0,
        };
      })
      .sort((a, b) => b.weightedScore - a.weightedScore);
  },

  /**
   * Record the outcome of a decision (the retrospective answer). Writes to
   * the decision row's outcome jsonb and logs an activity event.
   */
  async recordOutcome(opts: {
    decisionId: string;
    workspaceId: string;
    userId: string;
    rating: 'good' | 'neutral' | 'poor';
    reflection: string;
  }): Promise<boolean> {
    const outcome: DecisionOutcome = {
      recorded_at: new Date().toISOString(),
      rating: opts.rating,
      reflection: opts.reflection.trim(),
    };
    const { error } = await supabase
      .from('decisions')
      .update({ outcome })
      .eq('id', opts.decisionId);
    if (error) {
      console.error('Error recording outcome:', error);
      return false;
    }
    await decisionActivityService.logDecisionEvent({
      decisionId: opts.decisionId,
      workspaceId: opts.workspaceId,
      userId: opts.userId,
      action: 'outcome_recorded',
      newValue: opts.rating,
      metadata: { reflection: opts.reflection },
    });
    return true;
  },

  /**
   * Schedule a retrospective prompt. Called when a decision is marked Decided
   * AND the wizard's Step 4 retrospectiveDays > 0.
   */
  async scheduleRetrospective(opts: {
    decisionId: string;
    workspaceId: string;
    userId: string;
    delayDays: number;
  }): Promise<boolean> {
    if (opts.delayDays <= 0) return true;
    const fireAt = new Date();
    fireAt.setDate(fireAt.getDate() + opts.delayDays);
    const { error } = await supabase
      .from('decision_retrospective_prompts')
      .insert({
        decision_id: opts.decisionId,
        workspace_id: opts.workspaceId,
        user_id: opts.userId,
        fire_at: fireAt.toISOString(),
      });
    if (error) {
      console.error('Error scheduling retrospective:', error);
      return false;
    }
    return true;
  },

  /**
   * Find pending retrospective prompts that should surface now (fire_at <= now,
   * not resolved, not dismissed). The proactive nudges system polls this.
   */
  async getDuePrompts(workspaceId: string, userId: string): Promise<RetrospectivePrompt[]> {
    const { data, error } = await supabase
      .from('decision_retrospective_prompts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .is('resolved_at', null)
      .is('dismissed_at', null)
      .lte('fire_at', new Date().toISOString())
      .order('fire_at', { ascending: true });
    if (error) {
      console.error('Error loading retrospective prompts:', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      decisionId: r.decision_id,
      userId: r.user_id,
      fireAt: r.fire_at,
      resolvedAt: r.resolved_at,
      dismissedAt: r.dismissed_at,
      createdAt: r.created_at,
    }));
  },

  async resolvePrompt(promptId: string): Promise<void> {
    await supabase
      .from('decision_retrospective_prompts')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', promptId);
  },

  async dismissPrompt(promptId: string): Promise<void> {
    await supabase
      .from('decision_retrospective_prompts')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', promptId);
  },
};
