import { supabase } from './supabaseClient';

export interface OutcomeBlocker {
  id: string;
  workspace_id: string;
  outcome_id?: string;
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'dismissed';
  reported_by: string;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OutcomeMilestone {
  id: string;
  outcome_id: string;
  title: string;
  description?: string;
  completed: boolean;
  completed_at?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceOutcome {
  id: string;
  workspace_id: string;
  goal: string;
  description?: string;
  status: 'on_track' | 'at_risk' | 'blocked' | 'completed';
  progress: number;
  target_date?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceWithOutcome {
  id: string;
  outcome_title?: string;
  outcome_description?: string;
  outcome_status: 'not_started' | 'in_progress' | 'blocked' | 'achieved' | 'abandoned';
  outcome_progress: number;
  outcome_target_date?: string;
  created_at: string;
  expires_at: string;
}

export const outcomeService = {
  // Set outcome for a workspace - returns WorkspaceOutcome or null
  async setWorkspaceOutcome(
    workspaceIdOrData: string | {
      workspace_id: string;
      outcome_title: string;
      outcome_description?: string;
      outcome_target_date?: string;
    },
    goal?: string
  ): Promise<WorkspaceOutcome | null> {
    // Handle both calling conventions
    const workspace_id = typeof workspaceIdOrData === 'string'
      ? workspaceIdOrData
      : workspaceIdOrData.workspace_id;
    const outcome_title = typeof workspaceIdOrData === 'string'
      ? goal!
      : workspaceIdOrData.outcome_title;
    const outcome_description = typeof workspaceIdOrData === 'string'
      ? undefined
      : workspaceIdOrData.outcome_description;
    const outcome_target_date = typeof workspaceIdOrData === 'string'
      ? undefined
      : workspaceIdOrData.outcome_target_date;

    // First create/update the workspace outcome
    const { error } = await supabase
      .from('ephemeral_workspaces')
      .update({
        outcome_title: outcome_title,
        outcome_description: outcome_description,
        outcome_status: 'not_started',
        outcome_progress: 0,
        outcome_target_date: outcome_target_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', workspace_id);

    if (error) {
      console.error('Error setting workspace outcome:', error);
      return null;
    }

    // Also create a workspace_outcomes record for the new schema
    const { data: outcomeData, error: outcomeError } = await supabase
      .from('workspace_outcomes')
      .upsert({
        workspace_id: workspace_id,
        goal: outcome_title,
        description: outcome_description,
        status: 'on_track',
        progress: 0,
        target_date: outcome_target_date,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (outcomeError) {
      console.error('Error creating workspace outcome record:', outcomeError);
      // Return a mock outcome object for local use
      return {
        id: `outcome-${workspace_id}`,
        workspace_id,
        goal: outcome_title,
        description: outcome_description,
        status: 'on_track',
        progress: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    return outcomeData;
  },

  // Update outcome progress
  async updateOutcomeProgress(
    workspaceId: string, 
    progress: number,
    status?: WorkspaceWithOutcome['outcome_status']
  ): Promise<boolean> {
    const updates: any = {
      outcome_progress: Math.max(0, Math.min(100, progress)),
      updated_at: new Date().toISOString()
    };

    if (status) {
      updates.outcome_status = status;
    } else {
      // Auto-update status based on progress
      if (progress === 100) {
        updates.outcome_status = 'achieved';
      } else if (progress > 0) {
        updates.outcome_status = 'in_progress';
      }
    }

    const { error } = await supabase
      .from('ephemeral_workspaces')
      .update(updates)
      .eq('id', workspaceId);

    if (error) {
      console.error('Error updating outcome progress:', error);
      return false;
    }

    return true;
  },

  // Get workspace with outcome info - returns WorkspaceOutcome format
  async getWorkspaceOutcome(workspaceId: string): Promise<WorkspaceOutcome | null> {
    // Try to get from workspace_outcomes table first
    const { data: outcomeData, error: outcomeError } = await supabase
      .from('workspace_outcomes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    if (!outcomeError && outcomeData) {
      return outcomeData;
    }

    // Fall back to ephemeral_workspaces for legacy data
    const { data, error } = await supabase
      .from('ephemeral_workspaces')
      .select('id, outcome_title, outcome_description, outcome_status, outcome_progress, outcome_target_date, created_at, expires_at')
      .eq('id', workspaceId)
      .single();

    if (error) {
      console.error('Error fetching workspace outcome:', error);
      return null;
    }

    if (!data || !data.outcome_title) {
      return null;
    }

    // Convert to WorkspaceOutcome format
    const statusMap: Record<string, WorkspaceOutcome['status']> = {
      'not_started': 'on_track',
      'in_progress': 'on_track',
      'blocked': 'blocked',
      'achieved': 'completed',
      'abandoned': 'at_risk'
    };

    return {
      id: data.id,
      workspace_id: workspaceId,
      goal: data.outcome_title,
      description: data.outcome_description,
      status: statusMap[data.outcome_status] || 'on_track',
      progress: data.outcome_progress || 0,
      target_date: data.outcome_target_date,
      created_at: data.created_at,
      updated_at: data.created_at
    };
  },

  // Create a blocker
  async createBlocker(data: {
    workspace_id: string;
    title: string;
    description?: string;
    severity?: OutcomeBlocker['severity'];
    reported_by: string;
  }): Promise<OutcomeBlocker | null> {
    const { data: blocker, error } = await supabase
      .from('outcome_blockers')
      .insert({
        ...data,
        status: 'active',
        severity: data.severity || 'medium'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating blocker:', error);
      return null;
    }

    // Auto-update workspace status if critical blocker
    if (data.severity === 'critical') {
      await this.updateWorkspaceStatus(data.workspace_id, 'blocked');
    }

    return blocker;
  },

  // Get all blockers for a workspace
  async getWorkspaceBlockers(workspaceId: string): Promise<OutcomeBlocker[]> {
    const { data: blockers, error } = await supabase
      .from('outcome_blockers')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching blockers:', error);
      return [];
    }

    return blockers;
  },

  // Resolve a blocker
  async resolveBlocker(
    blockerId: string, 
    resolutionNotes?: string
  ): Promise<boolean> {
    const { data: blocker, error: fetchError } = await supabase
      .from('outcome_blockers')
      .select('workspace_id, severity')
      .eq('id', blockerId)
      .single();

    if (fetchError || !blocker) {
      console.error('Error fetching blocker:', fetchError);
      return false;
    }

    const { error } = await supabase
      .from('outcome_blockers')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', blockerId);

    if (error) {
      console.error('Error resolving blocker:', error);
      return false;
    }

    // Check if there are any remaining active blockers
    const remainingBlockers = await this.getWorkspaceBlockers(blocker.workspace_id);
    const criticalBlockers = remainingBlockers.filter(b => b.severity === 'critical');

    // If no more critical blockers, unblock workspace
    if (criticalBlockers.length === 0) {
      await this.updateWorkspaceStatus(blocker.workspace_id, 'in_progress');
    }

    return true;
  },

  // Update workspace status
  async updateWorkspaceStatus(
    workspaceId: string, 
    status: WorkspaceWithOutcome['outcome_status']
  ): Promise<boolean> {
    const { error } = await supabase
      .from('ephemeral_workspaces')
      .update({
        outcome_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', workspaceId);

    if (error) {
      console.error('Error updating workspace status:', error);
      return false;
    }

    return true;
  },

  // Get outcome health summary
  async getOutcomeHealth(workspaceId: string) {
    const outcome = await this.getWorkspaceOutcome(workspaceId);
    const blockers = await this.getWorkspaceBlockers(workspaceId);

    if (!outcome) return null;

    const criticalBlockers = blockers.filter(b => b.severity === 'critical').length;
    const highBlockers = blockers.filter(b => b.severity === 'high').length;
    const totalBlockers = blockers.length;

    // Calculate days remaining
    let daysRemaining = null;
    if (outcome.outcome_target_date) {
      const targetDate = new Date(outcome.outcome_target_date);
      const now = new Date();
      daysRemaining = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Calculate health score (0-100)
    let healthScore = outcome.outcome_progress;
    healthScore -= (criticalBlockers * 20);
    healthScore -= (highBlockers * 10);
    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      outcome,
      blockers: {
        total: totalBlockers,
        critical: criticalBlockers,
        high: highBlockers,
        medium: blockers.filter(b => b.severity === 'medium').length,
        low: blockers.filter(b => b.severity === 'low').length
      },
      daysRemaining,
      healthScore,
      status: outcome.outcome_status,
      isOnTrack: healthScore >= 70 && criticalBlockers === 0
    };
  },

  // Subscribe to blocker changes
  subscribeToBlockers(workspaceId: string, callback: (blocker: OutcomeBlocker) => void) {
    return supabase
      .channel(`blockers:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'outcome_blockers',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          callback(payload.new as OutcomeBlocker);
        }
      )
      .subscribe();
  },

  // Subscribe to outcome updates
  subscribeToOutcomeUpdates(workspaceId: string, callback: (outcome: WorkspaceOutcome) => void) {
    const subscription = supabase
      .channel(`outcome:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_outcomes',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          callback(payload.new as WorkspaceOutcome);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  },

  // Get blockers for an outcome
  async getBlockers(outcomeId: string): Promise<OutcomeBlocker[]> {
    const { data, error } = await supabase
      .from('outcome_blockers')
      .select('*')
      .eq('outcome_id', outcomeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching blockers:', error);
      return [];
    }

    return data || [];
  },

  // Get milestones for an outcome
  async getMilestones(outcomeId: string): Promise<OutcomeMilestone[]> {
    const { data, error } = await supabase
      .from('outcome_milestones')
      .select('*')
      .eq('outcome_id', outcomeId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching milestones:', error);
      return [];
    }

    return data || [];
  },

  // Add a blocker to an outcome
  async addBlocker(
    outcomeId: string,
    description: string,
    severity: OutcomeBlocker['severity'],
    reportedBy: string
  ): Promise<OutcomeBlocker | null> {
    const { data, error } = await supabase
      .from('outcome_blockers')
      .insert({
        outcome_id: outcomeId,
        title: description,
        description: description,
        severity,
        status: 'active',
        reported_by: reportedBy
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding blocker:', error);
      return null;
    }

    return data;
  },

  // Add a milestone to an outcome
  async addMilestone(outcomeId: string, title: string): Promise<OutcomeMilestone | null> {
    const { data, error } = await supabase
      .from('outcome_milestones')
      .insert({
        outcome_id: outcomeId,
        title,
        completed: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding milestone:', error);
      return null;
    }

    return data;
  },

  // Toggle milestone completion
  async toggleMilestone(milestoneId: string): Promise<boolean> {
    // First get current state
    const { data: milestone, error: fetchError } = await supabase
      .from('outcome_milestones')
      .select('completed, outcome_id')
      .eq('id', milestoneId)
      .single();

    if (fetchError || !milestone) {
      console.error('Error fetching milestone:', fetchError);
      return false;
    }

    const { error } = await supabase
      .from('outcome_milestones')
      .update({
        completed: !milestone.completed,
        completed_at: !milestone.completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', milestoneId);

    if (error) {
      console.error('Error toggling milestone:', error);
      return false;
    }

    // Update outcome progress based on milestones
    await this.updateOutcomeProgressFromMilestones(milestone.outcome_id);

    return true;
  },

  // Update outcome progress based on milestone completion
  async updateOutcomeProgressFromMilestones(outcomeId: string): Promise<void> {
    const milestones = await this.getMilestones(outcomeId);
    if (milestones.length === 0) return;

    const completedCount = milestones.filter(m => m.completed).length;
    const progress = Math.round((completedCount / milestones.length) * 100);

    await supabase
      .from('workspace_outcomes')
      .update({
        progress,
        status: progress === 100 ? 'completed' : progress >= 70 ? 'on_track' : 'at_risk',
        updated_at: new Date().toISOString()
      })
      .eq('id', outcomeId);
  }
};
