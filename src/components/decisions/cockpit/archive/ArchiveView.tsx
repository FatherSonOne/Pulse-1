/**
 * ArchiveView — the Archive tab: a week-grouped timeline rail + a focal
 * retrospective/summary pane, plus a velocity metric strip. Fetches archived
 * items via the dedicated services (the active sets exclude archived), mirrors
 * the legacy ArchiveView's date-range / group / search / metrics logic, and
 * reopens via reopenTask / reopenDecision.
 *
 * Coral budget (CLAUDE.md §4): chrome is rose/neutral; only the AI look-back
 * note in the decision focal is coral.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { subDays, startOfYear, isWithinInterval, startOfWeek, startOfMonth, format, differenceInDays } from 'date-fns';
import { RotateCcw, Archive as ArchiveIcon } from 'lucide-react';
import { taskService, type Task } from '../../../../services/taskService';
import { decisionService, type DecisionWithVotes } from '../../../../services/decisionService';
import { ArchiveMetrics, type ArchiveMetricValues } from './ArchiveMetrics';
import { ArchiveRow } from './ArchiveRow';
import { ActivityLog } from '../focal/ActivityLog';
import { CommentsSection } from '../focal/CommentsSection';
import type { User } from '../../../../types';

export type ArchiveItem = (Task | DecisionWithVotes) & {
  type: 'task' | 'decision';
  completedDate: Date;
};

type DateRange = '7d' | '30d' | '90d' | 'year';
type GroupBy = 'week' | 'month' | 'none';

interface ArchiveViewProps {
  workspaceId: string;
  currentUserId: string;
  members: User[];
  /** Called after a reopen so the parent can refresh its active lists. */
  onChanged?: () => void;
}

export function ArchiveView({ workspaceId, currentUserId, members, onChanged }: ArchiveViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [decisions, setDecisions] = useState<DecisionWithVotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [groupBy, setGroupBy] = useState<GroupBy>('week');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [t, d] = await Promise.all([
        taskService.getArchivedTasks(workspaceId),
        decisionService.getArchivedDecisions(workspaceId),
      ]);
      setTasks(t);
      setDecisions(d);
    } catch (error) {
      console.error('Failed to load archive:', error);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const archivedItems = useMemo<ArchiveItem[]>(() => {
    const t: ArchiveItem[] = tasks.map((task) => ({
      ...task, type: 'task' as const,
      completedDate: new Date(task.archived_at || task.completed_at || task.updated_at),
    }));
    const d: ArchiveItem[] = decisions.map((dec) => ({
      ...dec, type: 'decision' as const,
      completedDate: new Date(dec.archived_at || dec.decided_at || dec.updated_at),
    }));
    return [...t, ...d];
  }, [tasks, decisions]);

  const dateFiltered = useMemo(() => {
    const now = new Date();
    const start =
      dateRange === '7d' ? subDays(now, 7) :
      dateRange === '90d' ? subDays(now, 90) :
      dateRange === 'year' ? startOfYear(now) :
      subDays(now, 30);
    return archivedItems.filter((i) => isWithinInterval(i.completedDate, { start, end: now }));
  }, [archivedItems, dateRange]);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dateFiltered;
    return dateFiltered.filter((i) => i.title.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
  }, [dateFiltered, search]);

  const groups = useMemo(() => {
    if (groupBy === 'none') return [['All items', searched]] as [string, ArchiveItem[]][];
    const map = new Map<string, ArchiveItem[]>();
    for (const item of searched) {
      const key = groupBy === 'week'
        ? format(startOfWeek(item.completedDate), 'MMM dd, yyyy')
        : format(startOfMonth(item.completedDate), 'MMMM yyyy');
      (map.get(key) ?? map.set(key, []).get(key)!).push(item);
    }
    return [...map.entries()].sort((a, b) => b[1][0].completedDate.getTime() - a[1][0].completedDate.getTime());
  }, [searched, groupBy]);

  const metrics = useMemo<ArchiveMetricValues>(() => {
    const t = dateFiltered.filter((i) => i.type === 'task') as (Task & ArchiveItem)[];
    const d = dateFiltered.filter((i) => i.type === 'decision') as (DecisionWithVotes & ArchiveItem)[];
    const completed = t.filter((x) => x.status === 'done');
    const resolved = d.filter((x) => x.status === 'decided');
    let totalDays = 0, counted = 0;
    completed.forEach((task) => {
      if (task.completed_at && task.extracted_at) {
        const days = differenceInDays(new Date(task.completed_at), new Date(task.extracted_at));
        if (days >= 0) { totalDays += days; counted++; }
      }
    });
    const total = dateFiltered.length;
    return {
      completedTasksCount: completed.length,
      avgCompletionDays: counted > 0 ? Math.round(totalDays / counted) : 0,
      resolvedDecisionsCount: resolved.length,
      successRate: total > 0 ? Math.round(((completed.length + resolved.length) / total) * 100) : 0,
    };
  }, [dateFiltered]);

  const flat = useMemo(() => groups.flatMap(([, items]) => items), [groups]);
  useEffect(() => {
    if (flat.length === 0) { if (selectedId) setSelectedId(undefined); return; }
    if (!flat.some((i) => i.id === selectedId)) setSelectedId(flat[0].id);
  }, [flat, selectedId]);
  const selected = flat.find((i) => i.id === selectedId);

  const handleReopen = useCallback(async (item: ArchiveItem) => {
    try {
      if (item.type === 'task') await taskService.reopenTask(item.id);
      else await decisionService.reopenDecision(item.id);
      toast.success('Reopened');
      await load();
      onChanged?.();
    } catch (error) {
      console.error('Failed to reopen:', error);
      toast.error('Could not reopen');
    }
  }, [load, onChanged]);

  return (
    <>
      <div className="ck-filterbar">
        <select className="ck-prop-edit" style={{ maxWidth: 150 }} value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRange)} aria-label="Date range">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="year">This year</option>
        </select>
        <select className="ck-prop-edit" style={{ maxWidth: 130 }} value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} aria-label="Group by">
          <option value="week">By week</option>
          <option value="month">By month</option>
          <option value="none">No grouping</option>
        </select>
        <input className="ck-prop-edit" style={{ maxWidth: 200 }} type="search" placeholder="Search archive…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search archive" />
        <div style={{ flex: 1 }} />
        <ArchiveMetrics metrics={metrics} />
      </div>

      <div className="ck-triage">
        <div className="ck-rail">
          <div className="ck-rail-head">
            <span className="ck-rail-count">Timeline · {flat.length}</span>
          </div>
          <div className="ck-rail-list" role="listbox" aria-label="Archive timeline">
            {loading ? (
              <div className="ck-activity-state" style={{ padding: 16 }}>Loading…</div>
            ) : flat.length === 0 ? (
              <div className="ck-activity-state" style={{ padding: 16 }}>Nothing archived in range.</div>
            ) : (
              groups.map(([label, items]) => (
                <div key={label}>
                  <div className="ck-qhead">
                    <span className="ck-qhead-dot" style={{ background: 'var(--dt-status-archived, var(--pulse-ink-3))' }} aria-hidden />
                    <span className="ck-qhead-label">{label}</span>
                    <span className="ck-qhead-count">{items.length}</span>
                  </div>
                  {items.map((item) => (
                    <ArchiveRow key={item.id} item={item} active={item.id === selectedId} onSelect={() => setSelectedId(item.id)} />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="ck-focal">
          {selected ? <ArchiveFocal item={selected} currentUserId={currentUserId} members={members} workspaceId={workspaceId} onReopen={() => handleReopen(selected)} /> : (
            <div className="ck-focal-placeholder">
              <span className="ck-caughtup-badge"><ArchiveIcon size={28} /></span>
              <span className="ck-focal-note">Select an archived item to review it.</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ArchiveFocal({ item, currentUserId, members, workspaceId, onReopen }: { item: ArchiveItem; currentUserId: string; members: User[]; workspaceId: string; onReopen: () => void }) {
  const isTask = item.type === 'task';
  const decision = !isTask ? (item as DecisionWithVotes) : null;
  // item.type ('task'|'decision') is exactly the ActivitySource union the
  // ActivityLog/CommentsSection consume.
  const source = item.type;
  return (
    <>
      <div className="ck-focal-body">
        <div className="ck-focal-pad">
          <div className="ck-focal-strip">
            <span className="ck-status-pill" style={{ color: 'var(--dt-status-archived, var(--pulse-ink-2))', background: 'var(--pulse-surface-raised)' }}>
              Archived · {item.completedDate.toLocaleDateString()}
            </span>
            <span className="ck-focal-type">{item.type}</span>
            <span className="ck-focal-id">{item.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <h2 className="ck-focal-h2">{item.title}</h2>
          {item.description && <p className="ck-focal-desc">{item.description}</p>}
          {decision?.final_decision && (
            <div className="ck-ai-block">
              <div className="ck-ai-block-head"><span className="ck-ai-chip">Outcome</span><span className="ck-ai-block-title">Look back</span></div>
              <p className="ck-ai-note"><strong>Decision:</strong> {decision.final_decision}</p>
            </div>
          )}
          {/* Activity + discussion on the archived item (Phase 9 gap / 2b). */}
          <ActivityLog source={source} itemId={item.id} members={members} />
          <CommentsSection source={source} itemId={item.id} workspaceId={workspaceId} currentUserId={currentUserId} members={members} />
        </div>
      </div>
      <div className="ck-focal-foot">
        <button type="button" className="ck-act-btn" onClick={onReopen}><RotateCcw size={15} /> <span>Reopen</span></button>
      </div>
    </>
  );
}
