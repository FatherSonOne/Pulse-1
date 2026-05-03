import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { DecisionWithVotes } from '../services/decisionService';
import { ConnectionStatus } from '../components/decisions/RealTimeIndicator';

interface UseDecisionTaskRealtimeParams {
  effectiveWorkspaceId: string;
  decisions: DecisionWithVotes[];
  onDecisionChange: () => void;
  onTaskChange: () => void;
  onVoteChange: () => void;
}

export function useDecisionTaskRealtime({
  effectiveWorkspaceId,
  decisions,
  onDecisionChange,
  onTaskChange,
  onVoteChange,
}: UseDecisionTaskRealtimeParams) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  const updateConnectionStatus = useCallback((status: string) => {
    if (status === 'SUBSCRIBED') {
      setConnectionStatus('connected');
    } else if (status === 'CHANNEL_ERROR') {
      setConnectionStatus('error');
    } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
      setConnectionStatus('disconnected');
    }
  }, []);

  // Re-subscribe when the decision-id set changes so the votes channel
  // always filters on the current list. Joining decision ids into a stable
  // key avoids re-subscribing on every render while still picking up adds
  // and removes.
  const decisionIdsKey = decisions.map(d => d.id).sort().join(',');

  useEffect(() => {
    if (!effectiveWorkspaceId) return;

    setConnectionStatus('connecting');

    // Channel names are namespaced by workspace_id so multiple hub instances
    // (e.g. across tabs or after a workspace switch) don't collide on the
    // global channel registry.
    const decisionsChannel = supabase
      .channel(`decisions-changes:${effectiveWorkspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'decisions',
          filter: `workspace_id=eq.${effectiveWorkspaceId}`,
        },
        () => onDecisionChange(),
      )
      .subscribe(updateConnectionStatus);

    const tasksChannel = supabase
      .channel(`extracted-tasks-changes:${effectiveWorkspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'extracted_tasks',
          filter: `workspace_id=eq.${effectiveWorkspaceId}`,
        },
        () => onTaskChange(),
      )
      .subscribe(updateConnectionStatus);

    const decisionIds = decisionIdsKey ? decisionIdsKey.split(',') : [];
    const votesChannel = supabase
      .channel(`votes-changes:${effectiveWorkspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'decision_votes',
          ...(decisionIds.length > 0 ? { filter: `decision_id=in.(${decisionIds.join(',')})` } : {}),
        },
        () => onVoteChange(),
      )
      .subscribe(updateConnectionStatus);

    return () => {
      supabase.removeChannel(decisionsChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(votesChannel);
      setConnectionStatus('disconnected');
    };
  }, [effectiveWorkspaceId, decisionIdsKey, onDecisionChange, onTaskChange, onVoteChange, updateConnectionStatus]);

  return { connectionStatus };
}
