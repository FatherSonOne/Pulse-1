import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabase';
import { taskService } from '../../../services/taskService';
import { AppView } from '../../../types';
import { useStripHighlight } from './useStripHighlight';
import { makeStripRowClick } from './stripNavigation';
import { useEverHadData } from './useEverHadData';

interface TasksDueStripProps {
  workspaceId: string | null | undefined;
  setView: (view: AppView) => void;
}

interface DueTaskRow {
  id: string;
  title: string;
  status: 'pending' | 'todo' | 'in_progress' | 'in_review' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: string | null;
  bucket: 'overdue' | 'today';
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const TasksDueStrip: React.FC<TasksDueStripProps> = ({ workspaceId, setView }) => {
  const [rows, setRows] = useState<DueTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [everSeen, markSeen] = useEverHadData(workspaceId ? `tasks:${workspaceId}` : null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const now = new Date();
    const todayEnd = endOfDay(now).toISOString();
    const todayStart = startOfDay(now).toISOString();

    const { data, error } = await supabase
      .from('extracted_tasks')
      .select('id, title, status, priority, deadline')
      .eq('workspace_id', workspaceId)
      .in('status', ['pending', 'todo', 'in_progress', 'in_review', 'blocked'])
      .is('archived_at', null)
      .not('deadline', 'is', null)
      .lte('deadline', todayEnd)
      .order('deadline', { ascending: true })
      .limit(12);

    if (error) {
      console.warn('[TasksDueStrip] load failed', error.message);
      setRows([]);
    } else {
      const mapped = (data || []).map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        deadline: t.deadline,
        bucket: t.deadline && t.deadline < todayStart ? 'overdue' as const : 'today' as const,
      }));
      if (mapped.length > 0) markSeen();
      setRows(mapped);
    }
    setLoading(false);
  }, [workspaceId, markSeen]);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    void load();

    const channel = supabase
      .channel(`dashboard:tasks:${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'extracted_tasks', filter: `workspace_id=eq.${workspaceId}` },
        () => { void load(); },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, load]);

  const handleComplete = useCallback(async (taskId: string) => {
    setCompleting(prev => new Set(prev).add(taskId));
    setRows(prev => prev.filter(r => r.id !== taskId));
    const ok = await taskService.updateTaskStatus(taskId, 'done');
    if (!ok) {
      toast.error('Could not mark task done. Try again.');
      void load();
    } else {
      toast.success('Task done');
    }
    setCompleting(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }, [load]);

  const { overdue, today } = useMemo(() => {
    const o: DueTaskRow[] = [];
    const t: DueTaskRow[] = [];
    rows.forEach(r => (r.bucket === 'overdue' ? o.push(r) : t.push(r)));
    return { overdue: o, today: t };
  }, [rows]);

  const ids = useMemo(() => rows.map(r => r.id), [rows]);
  const highlight = useStripHighlight(ids);

  if (loading) return null;

  if (rows.length === 0) {
    if (!everSeen) return null;
    return (
      <section aria-labelledby="strip-tasks-empty-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="strip-tasks-empty-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
            TASKS · CLEAR
          </h2>
        </div>
        <p className="px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          Nothing due today.
        </p>
      </section>
    );
  }

  const headerParts: string[] = [];
  if (overdue.length) headerParts.push(`${overdue.length} OVERDUE`);
  if (today.length) headerParts.push(`${today.length} DUE TODAY`);

  const formatDeadline = (iso: string | null, bucket: DueTaskRow['bucket']): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (bucket === 'today') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (days <= 0) return 'TODAY';
    if (days === 1) return '1D LATE';
    return `${days}D LATE`;
  };

  const renderRow = (t: DueTaskRow) => {
    const isNew = highlight.has(t.id);
    return (
    <li key={t.id}>
      <div className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-150 group">
        <button
          aria-label={`Mark "${t.title}" complete`}
          onClick={() => handleComplete(t.id)}
          disabled={completing.has(t.id)}
          className={`
            w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all duration-150
            ${t.bucket === 'overdue'
              ? 'border-red-300 dark:border-red-500/40 hover:bg-red-500 hover:border-red-500'
              : 'border-zinc-300 dark:border-zinc-600 hover:bg-emerald-500 hover:border-emerald-500'}
            ${isNew ? 'pulse-heartbeat-once' : ''}
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40
            disabled:opacity-50
          `}
        >
          <Check className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button
          data-strip-row
          onClick={makeStripRowClick(() => {
            sessionStorage.setItem('pulse_focus_task', t.id);
            setView(AppView.DECISIONS_TASKS);
          })}
          className="flex items-baseline gap-2 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
        >
          {t.bucket === 'overdue' && (
            <span className="pulse-label text-red-600 dark:text-red-400 shrink-0">OVERDUE</span>
          )}
          {t.priority === 'urgent' && (
            <span className="pulse-label text-rose-600 dark:text-rose-400 shrink-0">URGENT</span>
          )}
          {t.status === 'blocked' && (
            <span className="pulse-label text-orange-600 dark:text-orange-400 shrink-0">BLOCKED</span>
          )}
          <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{t.title}</span>
        </button>
        <span className={`pulse-label shrink-0 min-w-[3rem] text-right ${
          t.bucket === 'overdue' ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'
        }`}>
          {formatDeadline(t.deadline, t.bucket)}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors shrink-0" />
      </div>
    </li>
    );
  };

  return (
    <section aria-labelledby="strip-tasks-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="strip-tasks-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
          TASKS · {headerParts.join(' · ')}
        </h2>
        <button
          onClick={() => setView(AppView.DECISIONS_TASKS)}
          className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
        >
          OPEN TASKS
        </button>
      </div>
      <ul className="space-y-px">
        {overdue.map(renderRow)}
        {today.map(renderRow)}
      </ul>
    </section>
  );
};

export default TasksDueStrip;
