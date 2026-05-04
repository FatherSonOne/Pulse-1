import { supabase } from './supabaseClient';
import { ecosystemNotifyService } from './ecosystemNotifyService';

export interface Decision {
  id: string;
  workspace_id: string;
  message_id?: string;
  title: string;
  description?: string;
  status: 'proposed' | 'voting' | 'decided' | 'cancelled';
  decision_type: 'general' | 'technical' | 'product' | 'process';
  proposed_by: string;
  decided_at?: string;
  final_decision?: string;
  archived_at?: string; // NEW: When decision was archived
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DecisionVote {
  id: string;
  decision_id: string;
  user_id: string;
  choice: 'approve' | 'reject' | 'abstain' | 'concern';
  comment?: string;
  voted_at: string;
}

export interface DecisionWithVotes extends Decision {
  votes: DecisionVote[];
  vote_counts: {
    approve: number;
    reject: number;
    abstain: number;
    concern: number;
  };
}

export const decisionService = {
  // Create a new decision.
  //
  // The decisions table column names diverge from the TS interface:
  //   - `proposal_text` in the DB <-> `title` in the interface
  //   - `created_by` in the DB    <-> `proposed_by` in the interface
  //   - `threshold` is NOT NULL in the DB and defaults to 1
  // We map at insert time so callers keep the friendlier interface.
  async createDecision(data: {
    workspace_id: string;
    message_id?: string;
    title: string;
    description?: string;
    decision_type?: string;
    proposed_by: string;
    /** Optional consensus threshold (number of votes needed). Defaults to 1. */
    threshold?: number;
  }): Promise<Decision | null> {
    const { data: decision, error } = await supabase
      .from('decisions')
      .insert({
        workspace_id: data.workspace_id,
        message_id: data.message_id,
        proposal_text: data.title,
        description: data.description ?? null,
        decision_type: data.decision_type || 'general',
        status: 'proposed',
        threshold: data.threshold ?? 1,
        created_by: data.proposed_by,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating decision:', error);
      return null;
    }

    // Cross-app: cache decision in Entomate for MIP context. Fire-and-forget.
    if (decision?.id) {
      void ecosystemNotifyService.notifyDecisionCreated({
        decisionId: decision.id,
        workspaceId: data.workspace_id,
        title: data.title,
        description: data.description ?? null,
        decisionType: data.decision_type ?? 'general',
        proposedBy: data.proposed_by,
      });
    }

    // Re-shape to match the Decision interface readers expect.
    return decision
      ? {
          ...decision,
          title: (decision as { proposal_text?: string }).proposal_text ?? data.title,
          proposed_by: (decision as { created_by?: string }).created_by ?? data.proposed_by,
        }
      : null;
  },

  // Get all decisions for a workspace (excludes archived by default)
  async getWorkspaceDecisions(
    workspaceId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ decisions: DecisionWithVotes[]; hasMore: boolean }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const { data: decisions, error } = await supabase
      .from('decisions')
      .select('*, votes:decision_votes(*)')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (error) {
      console.error('Error fetching decisions:', error);
      return { decisions: [], hasMore: false };
    }

    // Alias the underlying column names (proposal_text / created_by) onto
    // the friendlier interface fields (title / proposed_by) so existing
    // readers like card components keep working.
    const mapped = decisions.map((d: Record<string, unknown>) => ({
      ...d,
      title: (d.title as string) ?? (d.proposal_text as string) ?? '',
      proposed_by: (d.proposed_by as string) ?? (d.created_by as string) ?? '',
      vote_counts: this.calculateVoteCounts((d.votes as DecisionVote[]) || [])
    })) as DecisionWithVotes[];

    return {
      decisions: mapped,
      hasMore: (decisions?.length ?? 0) > limit,
    };
  },

  // Cast a vote on a decision
  async castVote(data: {
    decision_id: string;
    user_id: string;
    choice: DecisionVote['choice'];
    comment?: string;
  }): Promise<DecisionVote | null> {
    const { data: vote, error } = await supabase
      .from('decision_votes')
      .upsert({
        decision_id: data.decision_id,
        user_id: data.user_id,
        choice: data.choice,
        comment: data.comment,
        voted_at: new Date().toISOString()
      }, {
        onConflict: 'decision_id,user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error casting vote:', error);
      return null;
    }

    return vote;
  },

  // Finalize a decision
  async finalizeDecision(decisionId: string, finalDecision: string): Promise<boolean> {
    const { error } = await supabase
      .from('decisions')
      .update({
        status: 'decided',
        final_decision: finalDecision,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', decisionId);

    if (error) {
      console.error('Error finalizing decision:', error);
      return false;
    }

    return true;
  },

  // Update decision status
  async updateDecisionStatus(
    decisionId: string, 
    status: Decision['status']
  ): Promise<boolean> {
    const { error } = await supabase
      .from('decisions')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', decisionId);

    if (error) {
      console.error('Error updating decision status:', error);
      return false;
    }

    return true;
  },

  // Update a decision (generic partial update)
  async updateDecision(decisionId: string, updates: Partial<Decision>): Promise<boolean> {
    const { error } = await supabase
      .from('decisions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', decisionId);

    if (error) {
      console.error('Error updating decision:', error);
      return false;
    }

    return true;
  },

  // Helper to calculate vote counts
  calculateVoteCounts(votes: DecisionVote[]) {
    return {
      approve: votes.filter(v => v.choice === 'approve').length,
      reject: votes.filter(v => v.choice === 'reject').length,
      abstain: votes.filter(v => v.choice === 'abstain').length,
      concern: votes.filter(v => v.choice === 'concern').length
    };
  },

  // Subscribe to decision changes
  subscribeToDecisions(workspaceId: string, callback: (decision: Decision) => void) {
    return supabase
      .channel(`decisions:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'decisions',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          callback(payload.new as Decision);
        }
      )
      .subscribe();
  },

  /**
   * Phase 4: Archive completed decisions automatically
   * Archives decisions that have been decided/cancelled for more than 48 hours
   */
  async archiveCompletedDecisions(workspaceId: string): Promise<number> {
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    const { data, error } = await supabase
      .from('decisions')
      .update({ archived_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .in('status', ['decided', 'cancelled'])
      .is('archived_at', null)
      .lt('decided_at', fortyEightHoursAgo.toISOString())
      .select();

    if (error) {
      console.error('Error auto-archiving decisions:', error);
      return 0;
    }

    return data?.length || 0;
  },

  /**
   * Phase 4: Manually archive a decision
   */
  async archiveDecision(decisionId: string): Promise<boolean> {
    const { error } = await supabase
      .from('decisions')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', decisionId);

    if (error) {
      console.error('Error archiving decision:', error);
      return false;
    }

    return true;
  },

  /**
   * Phase 4: Reopen an archived decision
   */
  async reopenDecision(decisionId: string): Promise<boolean> {
    const { error } = await supabase
      .from('decisions')
      .update({
        archived_at: null,
        status: 'proposed', // Reset to proposed when reopened
        decided_at: null,
        final_decision: null
      })
      .eq('id', decisionId);

    if (error) {
      console.error('Error reopening decision:', error);
      return false;
    }

    return true;
  },

  /**
   * Phase 4: Get archived decisions for a workspace
   */
  async getArchivedDecisions(workspaceId: string): Promise<DecisionWithVotes[]> {
    const { data: decisions, error } = await supabase
      .from('decisions')
      .select('*, votes:decision_votes(*)')
      .eq('workspace_id', workspaceId)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false });

    if (error) {
      console.error('Error fetching archived decisions:', error);
      return [];
    }

    return decisions.map(d => ({
      ...d,
      vote_counts: this.calculateVoteCounts(d.votes || [])
    }));
  }
};
