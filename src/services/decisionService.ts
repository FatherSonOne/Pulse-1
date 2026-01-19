import { supabase } from './supabaseClient';

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
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DecisionVote {
  id: string;
  decision_id: string;
  user_id: string;
  vote: 'approve' | 'reject' | 'abstain' | 'concern';
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
  // Create a new decision
  async createDecision(data: {
    workspace_id: string;
    message_id?: string;
    title: string;
    description?: string;
    decision_type?: Decision['decision_type'];
    proposed_by: string;
  }): Promise<Decision | null> {
    const { data: decision, error } = await supabase
      .from('decisions')
      .insert({
        ...data,
        status: 'proposed',
        decision_type: data.decision_type || 'general'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating decision:', error);
      return null;
    }

    return decision;
  },

  // Get all decisions for a workspace
  async getWorkspaceDecisions(workspaceId: string): Promise<DecisionWithVotes[]> {
    const { data: decisions, error } = await supabase
      .from('decisions')
      .select('*, votes:decision_votes(*)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching decisions:', error);
      return [];
    }

    return decisions.map(d => ({
      ...d,
      vote_counts: this.calculateVoteCounts(d.votes || [])
    }));
  },

  // Cast a vote on a decision
  async castVote(data: {
    decision_id: string;
    user_id: string;
    vote: DecisionVote['vote'];
    comment?: string;
  }): Promise<DecisionVote | null> {
    const { data: vote, error } = await supabase
      .from('decision_votes')
      .upsert({
        decision_id: data.decision_id,
        user_id: data.user_id,
        vote: data.vote,
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

  // Helper to calculate vote counts
  calculateVoteCounts(votes: DecisionVote[]) {
    return {
      approve: votes.filter(v => v.vote === 'approve').length,
      reject: votes.filter(v => v.vote === 'reject').length,
      abstain: votes.filter(v => v.vote === 'abstain').length,
      concern: votes.filter(v => v.vote === 'concern').length
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
  }
};
