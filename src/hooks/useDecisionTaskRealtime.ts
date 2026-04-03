import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { DecisionWithVotes } from '../services/decisionService';
import { Task } from '../services/taskService';
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
    } else if (status === 'TIMED_OUT') {
      setConnectionStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    if (!effectiveWorkspaceId) return;

    setConnectionStatus('connecting');

    const decisionsChannel = supabase
      .channel('decisions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'decisions',
          filter: `workspace_id=eq.${effectiveWorkspaceId}`
        },
        () => onDecisionChange()
      )
      .subscribe((status) => updateConnectionStatus(status));

    const tasksChannel = supabase
      .channel('extracted-tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'extracted_tasks',
          filter: `workspace_id=eq.${effectiveWorkspaceId}`
        },
        () => onTaskChange()
      )
      .subscribe((status) => updateConnectionStatus(status));

    const decisionIds = decisions.map(d => d.id);
    const votesChannel = supabase
      .channel('votes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'decision_votes',
          ...(decisionIds.length > 0 ? { filter: `decision_id=in.(${decisionIds.join(',')})` } : {})
        },
        () => onVoteChange()
      )
      .subscribe((status) => updateConnectionStatus(status));

    return () => {
      decisionsChannel.unsubscribe();
      tasksChannel.unsubscribe();
      votesChannel.unsubscribe();
      setConnectionStatus('disconnected');
    };
  }, [effectiveWorkspaceId]);

  return { connectionStatus };
}
