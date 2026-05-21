import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { AppView } from '../../../types';
import { useStripHighlight } from './useStripHighlight';
import { makeStripRowClick } from './stripNavigation';
import { useEverHadData } from './useEverHadData';

interface WeekCapturesStripProps {
  workspaceId: string | null | undefined;
  authUserId: string | null | undefined;
  setView: (view: AppView) => void;
}

type CaptureKind = 'decision' | 'task' | 'learning' | 'friction' | 'question' | null;

interface CaptureRow {
  id: string;
  content: string;
  kind: CaptureKind;
  created_at: string;
}

// Kind palette — coral is reserved (≤10% of screen) so most kinds get tinted
// neutrals; the high-signal ones (friction, decision) get accent fills.
const KIND_TOKEN: Record<Exclude<CaptureKind, null> | 'note', { label: string; pill: string }> = {
  note: { label: 'NOTE', pill: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300' },
  decision: { label: 'DECISION', pill: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  task: { label: 'TASK', pill: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  learning: { label: 'LEARNING', pill: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  friction: { label: 'FRICTION', pill: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  question: { label: 'QUESTION', pill: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
};

const daysAgo = (createdAt: string): string => {
  const ms = Date.now() - new Date(createdAt).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) {
    const hours = Math.floor(ms / 3_600_000);
    return hours <= 0 ? 'NEW' : `${hours}H`;
  }
  return `${days}D`;
};

// Captures from the last 7 days. Renders any kind (the Friction Log filter
// emerges naturally as the operator starts kinding things). Click opens
// Archives → Notes tab focused on the row via `pulse_focus_note` sentinel.
const WeekCapturesStrip: React.FC<WeekCapturesStripProps> = ({
  workspaceId,
  authUserId,
  setView,
}) => {
  const [rows, setRows] = useState<CaptureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [everSeen, markSeen] = useEverHadData(
    workspaceId && authUserId ? `week_captures:${workspaceId}:${authUserId}` : null,
  );

  useEffect(() => {
    if (!workspaceId || !authUserId) {
      setLoading(false);
      return;
    }

    let active = true;

    const load = async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from('pulse_notes')
        .select('id, content, kind, created_at')
        .eq('workspace_id', workspaceId)
        .eq('user_id', authUserId)
        .is('archived_at', null)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(8);

      if (!active) return;
      if (error) {
        console.warn('[WeekCapturesStrip] load failed', error.message);
        setRows([]);
      } else {
        const mapped: CaptureRow[] = (data || []).map(n => ({
          id: n.id,
          content: (n.content || '').replace(/\s+/g, ' ').trim(),
          kind: (n.kind ?? null) as CaptureKind,
          created_at: n.created_at,
        }));
        if (mapped.length > 0) markSeen();
        setRows(mapped);
      }
      setLoading(false);
    };

    void load();

    const channel = supabase
      .channel(`dashboard:week_captures:${workspaceId}:${authUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pulse_notes', filter: `workspace_id=eq.${workspaceId}` },
        () => { void load(); },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, authUserId, markSeen]);

  const counts = useMemo(() => {
    const out: Partial<Record<keyof typeof KIND_TOKEN, number>> = {};
    rows.forEach(r => {
      const key = (r.kind ?? 'note') as keyof typeof KIND_TOKEN;
      out[key] = (out[key] ?? 0) + 1;
    });
    return out;
  }, [rows]);

  const ids = useMemo(() => rows.map(r => r.id), [rows]);
  const highlight = useStripHighlight(ids);

  if (loading) return null;

  if (rows.length === 0) {
    if (!everSeen) return null;
    return (
      <section aria-labelledby="strip-week-captures-empty-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="strip-week-captures-empty-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
            CAPTURES · QUIET WEEK
          </h2>
        </div>
        <p className="px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          Nothing captured in the last 7 days. Press{' '}
          <kbd className="pulse-label px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300">
            ⌘J
          </kbd>{' '}
          to capture anywhere.
        </p>
      </section>
    );
  }

  // Header summary: friction first (most signal in a retro), then the rest by
  // count. Caps to two segments so the line stays scannable.
  const headerSegments: string[] = [];
  if (counts.friction) headerSegments.push(`${counts.friction} FRICTION`);
  const restEntries = (Object.entries(counts) as Array<[keyof typeof KIND_TOKEN, number]>)
    .filter(([k]) => k !== 'friction')
    .sort((a, b) => b[1] - a[1]);
  if (restEntries[0]) headerSegments.push(`${restEntries[0][1]} ${KIND_TOKEN[restEntries[0][0]].label}`);

  return (
    <section aria-labelledby="strip-week-captures-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="strip-week-captures-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
          CAPTURES · 7D · {headerSegments.join(' · ')}
        </h2>
        <button
          onClick={() => {
            sessionStorage.setItem('pulse_archives_tab', 'notes');
            setView(AppView.ARCHIVES);
          }}
          className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
        >
          SEE ALL
        </button>
      </div>
      <ul className="space-y-px">
        {rows.map(r => {
          const tokenKey = (r.kind ?? 'note') as keyof typeof KIND_TOKEN;
          const t = KIND_TOKEN[tokenKey];
          const isNew = highlight.has(r.id);
          return (
            <li key={r.id}>
              <button
                data-strip-row
                onClick={makeStripRowClick(() => {
                  sessionStorage.setItem('pulse_focus_note', r.id);
                  setView(AppView.ARCHIVES);
                })}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 group"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 bg-zinc-400 dark:bg-zinc-500 ${isNew ? 'pulse-heartbeat-once' : ''}`}
                  aria-hidden="true"
                />
                <span className="flex items-baseline gap-2 min-w-0 flex-1">
                  <span className={`pulse-label px-1.5 py-0.5 rounded shrink-0 ${t.pill}`}>{t.label}</span>
                  <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                    {r.content || '(empty note)'}
                  </span>
                </span>
                <span className="pulse-label text-zinc-500 dark:text-zinc-400 shrink-0 min-w-[2.5rem] text-right">
                  {daysAgo(r.created_at)}
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

export default WeekCapturesStrip;
