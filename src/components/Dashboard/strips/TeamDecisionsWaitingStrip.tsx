import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { AppView } from '../../../types';
import { useStripHighlight } from './useStripHighlight';
import { makeStripRowClick } from './stripNavigation';
import { useEverHadData } from './useEverHadData';

interface TeamDecisionsWaitingStripProps {
  workspaceId: string | null | undefined;
  authUserId: string | null | undefined;
  setView: (view: AppView) => void;
}

interface WaitingRow {
  id: string;
  title: string;
  created_at: string;
  decide_by_date: string | null;
}

const daysOpen = (createdAt: string): string => {
  const ms = Date.now() - new Date(createdAt).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) {
    const hours = Math.floor(ms / 3_600_000);
    return hours <= 0 ? 'NEW' : `${hours}H`;
  }
  return `${days}D`;
};

// Decisions waiting on this operator's vote: status='voting' + no decision_votes
// row for the current user. Solo workspaces will see every voting decision they
// proposed; multi-member workspaces will see only the ones they haven't weighed
// in on yet. Lives in the Team tab next to Team Activity.
const TeamDecisionsWaitingStrip: React.FC<TeamDecisionsWaitingStripProps> = ({
  workspaceId,
  authUserId,
  setView,
}) => {
  const [rows, setRows] = useState<WaitingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [everSeen, markSeen] = useEverHadData(
    workspaceId && authUserId ? `team_decisions_waiting:${workspaceId}:${authUserId}` : null,
  );

  useEffect(() => {
    if (!workspaceId || !authUserId) {
      setLoading(false);
      return;
    }

    let active = true;

    const load = async () => {
      // Two-step: fetch voting decisions in this workspace, then strip the ones
      // this user has already voted on. PostgREST doesn't expose a clean NOT
      // EXISTS join, and the typical voting-set size is small (single digits),
      // so two round-trips beats a server-side view here.
      const decisionsRes = await supabase
        .from('decisions')
        .select('id, proposal_text, created_at, decide_by_date')
        .eq('workspace_id', workspaceId)
        .eq('status', 'voting')
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!active) return;
      if (decisionsRes.error) {
        console.warn('[TeamDecisionsWaitingStrip] decisions load failed', decisionsRes.error.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const candidates = decisionsRes.data ?? [];
      if (candidates.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const votesRes = await supabase
        .from('decision_votes')
        .select('decision_id')
        .eq('user_id', authUserId)
        .in('decision_id', candidates.map(d => d.id));

      if (!active) return;
      const votedIds = new Set((votesRes.data ?? []).map(v => v.decision_id));
      const waiting = candidates
        .filter(d => !votedIds.has(d.id))
        .slice(0, 6)
        .map(d => ({
          id: d.id,
          title: (d as { proposal_text?: string }).proposal_text || 'Untitled decision',
          created_at: d.created_at,
          decide_by_date: (d as { decide_by_date?: string | null }).decide_by_date ?? null,
        }));

      if (waiting.length > 0) markSeen();
      setRows(waiting);
      setLoading(false);
    };

    void load();

    const channel = supabase
      .channel(`dashboard:team_decisions:${workspaceId}:${authUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'decisions', filter: `workspace_id=eq.${workspaceId}` },
        () => { void load(); },
      )
      .on(
        'postgres_changes',
        // decision_votes has no workspace_id column, so we listen to all and
        // re-filter inside `load`. The set is small.
        { event: '*', schema: 'public', table: 'decision_votes', filter: `user_id=eq.${authUserId}` },
        () => { void load(); },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, authUserId, markSeen]);

  const ids = useMemo(() => rows.map(r => r.id), [rows]);
  const highlight = useStripHighlight(ids);

  if (loading) return null;

  if (rows.length === 0) {
    if (!everSeen) return null;
    return (
      <section aria-labelledby="strip-team-decisions-empty-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="strip-team-decisions-empty-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
            DECISIONS · CAUGHT UP
          </h2>
        </div>
        <p className="px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          Nothing waiting on your vote.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="strip-team-decisions-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="strip-team-decisions-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
          DECISIONS · {rows.length} WAITING ON YOU
        </h2>
        <button
          onClick={() => setView(AppView.DECISIONS_TASKS)}
          className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
        >
          OPEN DECISIONS
        </button>
      </div>
      <ul className="space-y-px">
        {rows.map(d => {
          const isNew = highlight.has(d.id);
          return (
            <li key={d.id}>
              <button
                data-strip-row
                onClick={makeStripRowClick(() => {
                  sessionStorage.setItem('pulse_focus_decision', d.id);
                  setView(AppView.DECISIONS_TASKS);
                })}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 group"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500 ${isNew ? 'pulse-heartbeat-once' : ''}`}
                  aria-hidden="true"
                />
                <span className="flex items-baseline gap-2 min-w-0 flex-1">
                  <span className="pulse-label px-1.5 py-0.5 rounded shrink-0 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    VOTE
                  </span>
                  <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{d.title}</span>
                </span>
                <span className="pulse-label text-zinc-500 dark:text-zinc-400 shrink-0 min-w-[2.5rem] text-right">
                  {daysOpen(d.created_at)}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default TeamDecisionsWaitingStrip;
