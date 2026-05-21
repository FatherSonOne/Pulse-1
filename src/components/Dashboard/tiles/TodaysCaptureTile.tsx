import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabase';
import GlanceTileShell from './GlanceTileShell';

interface TodaysCaptureTileProps {
  workspaceId: string | null | undefined;
  onClick?: () => void;
}

interface CaptureStats {
  total: number;
  decisions: number;
  tasks: number;
  unassignedTasks: number;
}

const startOfDay = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const TodaysCaptureTile: React.FC<TodaysCaptureTileProps> = ({ workspaceId, onClick }) => {
  const [stats, setStats] = useState<CaptureStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      const since = startOfDay();

      const [decisionsRes, tasksRes] = await Promise.all([
        supabase
          .from('decisions')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .gte('created_at', since),
        supabase
          .from('extracted_tasks')
          .select('id, assignee_id')
          .eq('workspace_id', workspaceId)
          .gte('extracted_at', since),
      ]);

      if (!active) return;

      const decisionsCount = decisionsRes.count ?? 0;
      const tasksList = tasksRes.data ?? [];
      const tasksCount = tasksList.length;
      const unassignedTasks = tasksList.filter(t => !t.assignee_id).length;

      setStats({
        total: decisionsCount + tasksCount,
        decisions: decisionsCount,
        tasks: tasksCount,
        unassignedTasks,
      });
      setLoading(false);
    };

    void load();
    return () => { active = false; };
  }, [workspaceId]);

  if (loading || !stats || stats.total === 0) return null;

  return (
    <GlanceTileShell
      label="CAPTURED TODAY"
      ariaLabel={`Captured today: ${stats.total} items, ${stats.unassignedTasks} unassigned`}
      onClick={onClick}
      headline={
        <span className="flex items-baseline gap-2">
          <span>{stats.total}</span>
          <span className="pulse-label text-zinc-400 dark:text-zinc-500">ITEMS</span>
          {stats.unassignedTasks > 0 && (
            <>
              <span className="pulse-label text-zinc-300 dark:text-zinc-600">·</span>
              <span className="pulse-label inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {stats.unassignedTasks} UNASSIGNED
              </span>
            </>
          )}
        </span>
      }
    >
      <div className="flex gap-3 text-xs">
        {stats.decisions > 0 && (
          <span className="text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{stats.decisions}</span>
            <span className="pulse-label ml-1">DEC</span>
          </span>
        )}
        {stats.tasks > 0 && (
          <span className="text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{stats.tasks}</span>
            <span className="pulse-label ml-1">TASK</span>
          </span>
        )}
      </div>
    </GlanceTileShell>
  );
};

export default TodaysCaptureTile;
