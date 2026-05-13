import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { AppView } from '../../../types';
import { useStripHighlight } from './useStripHighlight';
import { makeStripRowClick } from './stripNavigation';
import { useEverHadData } from './useEverHadData';

interface DecisionsOpenStripProps {
  workspaceId: string | null | undefined;
  setView: (view: AppView) => void;
}

interface OpenDecisionRow {
  id: string;
  title: string;
  status: 'proposed' | 'voting';
  decision_type: string;
  created_at: string;
}

const STATUS_TOKEN: Record<OpenDecisionRow['status'], { label: string; dot: string; pill: string }> = {
  proposed: {
    label: 'PROPOSED',
    dot: 'bg-violet-500',
    pill: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  voting: {
    label: 'VOTING',
    dot: 'bg-amber-500',
    pill: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
};

const daysOpen = (createdAt: string): string => {
  const ms = Date.now() - new Date(createdAt).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) {
    const hours = Math.floor(ms / 3_600_000);
    return hours <= 0 ? 'NEW' : `${hours}H`;
  }
  return `${days}D`;
};

const DecisionsOpenStrip: React.FC<DecisionsOpenStripProps> = ({ workspaceId, setView }) => {
  const [rows, setRows] = useState<OpenDecisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [everSeen, markSeen] = useEverHadData(workspaceId ? `decisions:${workspaceId}` : null);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    let active = true;

    const load = async () => {
      const { data, error } = await supabase
        .from('decisions')
        .select('id, proposal_text, status, decision_type, created_at')
        .eq('workspace_id', workspaceId)
        .in('status', ['proposed', 'voting'])
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(8);

      if (!active) return;
      if (error) {
        console.warn('[DecisionsOpenStrip] load failed', error.message);
        setRows([]);
      } else {
        const mapped = (data || []).map(d => ({
          id: d.id,
          title: (d as { proposal_text?: string }).proposal_text || 'Untitled decision',
          status: d.status,
          decision_type: d.decision_type,
          created_at: d.created_at,
        }));
        if (mapped.length > 0) markSeen();
        setRows(mapped);
      }
      setLoading(false);
    };

    void load();

    const channel = supabase
      .channel(`dashboard:decisions:${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'decisions', filter: `workspace_id=eq.${workspaceId}` },
        () => { void load(); },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  const counts = useMemo(() => {
    const out = { proposed: 0, voting: 0 };
    rows.forEach(r => { out[r.status]++; });
    return out;
  }, [rows]);

  const ids = useMemo(() => rows.map(r => r.id), [rows]);
  const highlight = useStripHighlight(ids);

  if (loading) return null;

  if (rows.length === 0) {
    if (!everSeen) return null;
    return (
      <section aria-labelledby="strip-decisions-empty-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="strip-decisions-empty-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
            DECISIONS · CLEAR
          </h2>
        </div>
        <p className="px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          No open decisions.{' '}
          <button
            onClick={() => setView(AppView.DECISIONS_TASKS)}
            className="text-rose-600 dark:text-rose-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
          >
            Log one
          </button>
        </p>
      </section>
    );
  }

  const headerParts: string[] = [];
  if (counts.voting) headerParts.push(`${counts.voting} VOTING`);
  if (counts.proposed) headerParts.push(`${counts.proposed} PROPOSED`);

  return (
    <section aria-labelledby="strip-decisions-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="strip-decisions-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
          DECISIONS · {headerParts.join(' · ')}
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
          const t = STATUS_TOKEN[d.status];
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
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.dot} ${isNew ? 'pulse-heartbeat-once' : ''}`} aria-hidden="true" />
                <span className="flex items-baseline gap-2 min-w-0 flex-1">
                  <span className={`pulse-label px-1.5 py-0.5 rounded shrink-0 ${t.pill}`}>{t.label}</span>
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

export default DecisionsOpenStrip;
