/**
 * CockpitHub — orchestrator for the Decisions & Tasks "Triage Cockpit"
 * redesign (flag: `decisionsTriageCockpit`, default OFF).
 *
 * Phase 2: ported data layer from DecisionTaskHub — decisions/tasks load +
 * pagination, workspace members, place map, proactive nudges + velocity
 * metrics (debounced), and the 3-channel realtime subscription via
 * useDecisionTaskRealtime. Filtering (filteredTasks/filteredDecisions) is
 * derived here so Phase 3's queue rail can consume it directly. The body is
 * still a status placeholder; the queue rail + focal panes land in Phase 3+.
 *
 * The data logic is ported (not shared via a hook) per the handoff §5.2 so the
 * legacy DecisionTaskHub stays 100% untouched while both surfaces run
 * side-by-side behind the flag. Both read the same tables/services.
 *
 * Props match DecisionTaskHub so App.tsx can swap the two on the flag.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { User } from '../../../types';
import { CockpitMasthead, type CockpitTab } from './CockpitMasthead';
import { CommandBar } from './CommandBar';
import { TriageView } from './triage/TriageView';
import { type QueueEntry } from './triage/queueModel';
import { type TaskActions } from './focal/TaskDetail';
import { FilterState } from '../FilterBar';
import { ReassignTaskModal } from '../ReassignTaskModal';
import { ExtendDeadlineDialog } from '../ExtendDeadlineDialog';
import { decisionService, DecisionWithVotes } from '../../../services/decisionService';
import { taskService, Task } from '../../../services/taskService';
import { decisionAnalyticsService, DecisionMetrics } from '../../../services/decisionAnalyticsService';
import { proactiveSuggestionsService, Nudge } from '../../../services/proactiveSuggestionsService';
import { dependenciesService } from '../../../services/dependenciesService';
import { workspaceService } from '../../../services/workspaceService';
import { useDecisionTaskRealtime } from '../../../hooks/useDecisionTaskRealtime';
import { RealTimeIndicator } from '../RealTimeIndicator';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { listUserPlaces, getEntityPlaceMap } from '../../../services/locationService';
import { Place } from '../../../types/placeTypes';
import { getDismissedNudges } from '../../../utils/dismissedNudgesStorage';
import '../design-tokens.css';
import './cockpit.css';

interface CockpitHubProps {
  user: User | null;
  workspaceId?: string;
}

// Debounce hook (ported from DecisionTaskHub) — throttles expensive AI
// metric/nudge regeneration so rapid data churn doesn't thrash the router.
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

export function CockpitHub({ user, workspaceId }: CockpitHubProps) {
  const { currentWorkspace } = useWorkspace();

  // ── Cockpit shell state ──
  const [tab, setTab] = useState<CockpitTab>('triage');
  const [commandOpen, setCommandOpen] = useState(false);

  // ── Data state (ported) ──
  const [decisions, setDecisions] = useState<DecisionWithVotes[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [hasMoreDecisions, setHasMoreDecisions] = useState(false);
  const [hasMoreTasks, setHasMoreTasks] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Filters (shared FilterState contract) ──
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    priority: undefined,
    dateRange: undefined,
    placeId: undefined,
  });

  // ── Place-aware filtering: flat task→place map + the workspace's places ──
  const [availablePlaces, setAvailablePlaces] = useState<Place[]>([]);
  const [taskPlaceMap, setTaskPlaceMap] = useState<Record<string, string>>({});

  // ── AI features ──
  const [metrics, setMetrics] = useState<DecisionMetrics | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(new Set());

  // ── Workspace members (assignee dropdowns) ──
  const [workspaceMembers, setWorkspaceMembers] = useState<User[]>([]);

  // ── Focal task modals ──
  const [taskToReassign, setTaskToReassign] = useState<Task | null>(null);
  const [taskToExtend, setTaskToExtend] = useState<Task | null>(null);

  // Debounced data → drives metric/nudge regeneration without thrash.
  const debouncedDecisions = useDebounce(decisions, 800);
  const debouncedTasks = useDebounce(tasks, 800);

  const effectiveWorkspaceId = workspaceId || currentWorkspace?.id || user?.id || '';

  const closeCommand = useCallback(() => setCommandOpen(false), []);

  // ── Loaders ──
  const loadDecisions = useCallback(async () => {
    setDecisionsLoading(true);
    try {
      const { decisions: all, hasMore } = await decisionService.getWorkspaceDecisions(effectiveWorkspaceId);
      setDecisions(all);
      setHasMoreDecisions(hasMore);
    } catch (error) {
      console.error('Failed to load decisions:', error);
      setDecisions([]);
    } finally {
      setDecisionsLoading(false);
    }
  }, [effectiveWorkspaceId]);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const { tasks: all, hasMore } = await taskService.getWorkspaceTasks(effectiveWorkspaceId);
      setTasks(all);
      setHasMoreTasks(hasMore);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [effectiveWorkspaceId]);

  const generateMetrics = useCallback(async () => {
    try {
      const calculated = await decisionAnalyticsService.calculateDecisionVelocity(decisions);
      setMetrics(calculated);
    } catch (error) {
      console.error('Failed to generate metrics:', error);
    }
  }, [decisions]);

  const generateNudges = useCallback(async () => {
    if (!user) return;
    try {
      const generated = await proactiveSuggestionsService.generateNudges(decisions, tasks, user, '');
      setNudges(generated.filter((n) => !dismissedNudges.has(n.id)));
    } catch (error) {
      console.error('Failed to generate nudges:', error);
    }
  }, [user, decisions, tasks, dismissedNudges]);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      if (hasMoreDecisions) {
        const { decisions: more, hasMore } = await decisionService.getWorkspaceDecisions(
          effectiveWorkspaceId,
          { offset: decisions.length }
        );
        setDecisions((prev) => [...prev, ...more]);
        setHasMoreDecisions(hasMore);
      }
      if (hasMoreTasks) {
        const { tasks: more, hasMore } = await taskService.getWorkspaceTasks(
          effectiveWorkspaceId,
          { offset: tasks.length }
        );
        setTasks((prev) => [...prev, ...more]);
        setHasMoreTasks(hasMore);
      }
    } catch (error) {
      console.error('Failed to load more:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [effectiveWorkspaceId, decisions.length, tasks.length, hasMoreDecisions, hasMoreTasks]);

  const handleRefresh = useCallback(() => {
    loadDecisions();
    loadTasks();
    generateMetrics();
    generateNudges();
  }, [loadDecisions, loadTasks, generateMetrics, generateNudges]);

  // Queue row hover quick-actions. Phase 3 wires the safe, lean one — mark a
  // task done (realtime refreshes the queue). Decision approve (= vote) and
  // snooze land in Phases 5 / 8; until then they say so rather than no-op.
  const handleQuickAction = useCallback(
    async (entry: QueueEntry, action: 'done' | 'snooze') => {
      if (action === 'done' && entry.kind === 'task') {
        try {
          await taskService.updateTaskStatus(entry.task.id, 'done');
          setTasks((prev) =>
            prev.map((t) => (t.id === entry.task.id ? { ...t, status: 'done' } : t))
          );
          toast.success('Marked done');
        } catch (error) {
          console.error('Failed to mark task done:', error);
          toast.error('Could not update task');
        }
        return;
      }
      toast(action === 'done' ? 'Open to vote — coming in Phase 5' : 'Snooze arrives in a later phase', {
        icon: '⏳',
      });
    },
    []
  );

  // ── Focal task actions (property-table edits + footer actions) ──
  const patchTaskLocal = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
  }, []);

  const handleStatusChange = useCallback(
    async (taskId: string, status: Task['status']) => {
      patchTaskLocal(taskId, { status });
      try {
        await taskService.updateTaskStatus(taskId, status);
        if (status === 'done') {
          const unblocked = await dependenciesService.getNewlyUnblockedTasks(taskId, effectiveWorkspaceId);
          if (unblocked.length) {
            toast.success(`${unblocked.length} task${unblocked.length > 1 ? 's' : ''} unblocked`);
          }
        }
      } catch (error) {
        console.error('Failed to update task status:', error);
        toast.error('Could not update status');
        loadTasks();
      }
    },
    [patchTaskLocal, effectiveWorkspaceId, loadTasks]
  );

  const handlePatchTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {
      patchTaskLocal(taskId, updates);
      try {
        await taskService.updateTask(taskId, updates);
      } catch (error) {
        console.error('Failed to save task:', error);
        toast.error('Could not save changes');
        loadTasks();
      }
    },
    [patchTaskLocal, loadTasks]
  );

  const handleMarkDone = useCallback(
    (task: Task) => handleStatusChange(task.id, 'done'),
    [handleStatusChange]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      try {
        await taskService.deleteTask(taskId);
        toast.success('Task deleted');
      } catch (error) {
        console.error('Failed to delete task:', error);
        toast.error('Could not delete task');
        loadTasks();
      }
    },
    [loadTasks]
  );

  const handleOpenSource = useCallback((task: Task) => {
    const source = (task.metadata?.source as string | undefined) ?? 'its origin';
    toast(`Opening from ${source} arrives with cross-surface deep links`, { icon: '🔗' });
  }, []);

  const taskActions: TaskActions = useMemo(
    () => ({
      members: workspaceMembers,
      allTasks: tasks,
      currentUserId: user?.id,
      onStatusChange: handleStatusChange,
      onPatch: handlePatchTask,
      onMarkDone: handleMarkDone,
      onReassign: (task: Task) => setTaskToReassign(task),
      onExtend: (task: Task) => setTaskToExtend(task),
      onDelete: handleDeleteTask,
      onOpenSource: handleOpenSource,
    }),
    [workspaceMembers, tasks, user?.id, handleStatusChange, handlePatchTask, handleMarkDone, handleDeleteTask, handleOpenSource]
  );

  // ── Realtime handlers (ported) ──
  const handleDecisionChange = useCallback(() => {
    loadDecisions();
    setTimeout(() => {
      generateMetrics();
      generateNudges();
    }, 500);
  }, [loadDecisions, generateMetrics, generateNudges]);

  const handleTaskChange = useCallback(() => {
    loadTasks();
    setTimeout(() => generateNudges(), 500);
  }, [loadTasks, generateNudges]);

  const handleVoteChange = useCallback(() => {
    loadDecisions();
    setTimeout(() => generateMetrics(), 500);
  }, [loadDecisions, generateMetrics]);

  const { connectionStatus } = useDecisionTaskRealtime({
    effectiveWorkspaceId,
    decisions,
    onDecisionChange: handleDecisionChange,
    onTaskChange: handleTaskChange,
    onVoteChange: handleVoteChange,
  });

  // ── Effects ──
  // Dismissed nudges from localStorage on mount.
  useEffect(() => {
    setDismissedNudges(getDismissedNudges());
  }, []);

  // Initial data load (+ on workspace switch).
  useEffect(() => {
    if (effectiveWorkspaceId) {
      loadDecisions();
      loadTasks();
    }
  }, [effectiveWorkspaceId, loadDecisions, loadTasks]);

  // Workspace members for assignee dropdowns. Uses the canonical
  // get_enriched_workspace_members RPC (via workspaceService.getMembers) which
  // joins pulse_users for display names — the legacy hub's raw
  // `workspace_members → profiles(*)` join returned 0 (profiles is sparse).
  useEffect(() => {
    if (!effectiveWorkspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const members = await workspaceService.getMembers(effectiveWorkspaceId);
        if (cancelled) return;
        setWorkspaceMembers(
          members.map((mem) => ({
            id: mem.user_id,
            name: mem.name || mem.email || 'Member',
            email: mem.email || '',
            avatarUrl: mem.avatar_url,
            googleConnected: false,
            connectedProviders: {},
          } as User))
        );
      } catch (error) {
        console.error('Failed to load workspace members:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [effectiveWorkspaceId]);

  // Places + task→place map (one shot; no N+1 in the queue/filters).
  useEffect(() => {
    let cancelled = false;
    Promise.all([listUserPlaces(), getEntityPlaceMap('task')]).then(([places, map]) => {
      if (cancelled) return;
      setAvailablePlaces(places);
      setTaskPlaceMap(map);
    });
    return () => { cancelled = true; };
  }, []);

  // Regenerate metrics + nudges when (debounced) data changes.
  useEffect(() => {
    if (debouncedDecisions.length > 0) generateMetrics();
    if (debouncedDecisions.length > 0 || debouncedTasks.length > 0) generateNudges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDecisions, debouncedTasks]);

  // Global ⌘K / Ctrl+K toggles the command palette; Escape closes it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setCommandOpen((open) => !open);
        return;
      }
      if (e.key === 'Escape' && commandOpen) setCommandOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandOpen]);

  // ── Derived: filtered sets (Phase 3 queue rail consumes these) ──
  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
      );
    }
    if (filters.status !== 'all') filtered = filtered.filter((t) => t.status === filters.status);
    if (filters.priority) filtered = filtered.filter((t) => t.priority === filters.priority);
    if (filters.placeId !== undefined) {
      filtered = filtered.filter((t) => {
        const placeId = taskPlaceMap[t.id];
        return filters.placeId === null ? !placeId : placeId === filters.placeId;
      });
    }
    return filtered;
  }, [tasks, filters, taskPlaceMap]);

  const filteredDecisions = useMemo(() => {
    let filtered = decisions;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (d) => d.title.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [decisions, filters]);

  const loading = decisionsLoading || tasksLoading;
  const subtitle = loading
    ? 'Loading…'
    : `${filteredDecisions.length} decisions · ${filteredTasks.length} tasks`;

  return (
    <div className="ck-root">
      <CockpitMasthead
        tab={tab}
        setTab={setTab}
        onOpenCommand={() => setCommandOpen(true)}
        subtitle={subtitle}
        alertCount={nudges.length}
      />

      {/* Triage tab → queue rail + focal. Archive tab keeps the Phase-2 status
          body (live counts + connection + Load more) until Phase 9 builds the
          timeline + retrospective. */}
      {tab === 'triage' ? (
        <TriageView
          tasks={filteredTasks}
          decisions={filteredDecisions}
          currentUserId={user?.id}
          loading={loading}
          connectionStatus={connectionStatus}
          onQuickAction={handleQuickAction}
          taskActions={taskActions}
        />
      ) : (
        <div className="ck-body">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <RealTimeIndicator status={connectionStatus} />
            <div style={{ fontSize: 13, color: 'var(--pulse-ink-2)' }}>
              Archive — timeline + retrospective (Phase 9)
            </div>
            <div style={{ fontSize: 11, color: 'var(--pulse-ink-3)' }}>
              {`${filteredDecisions.length} decisions · ${filteredTasks.length} tasks · ${nudges.length} nudges · ${workspaceMembers.length} members`}
              {metrics ? ' · metrics computed' : ' · metrics pending'}
              {availablePlaces.length > 0 && ` · ${availablePlaces.length} places`}
            </div>
            {(hasMoreDecisions || hasMoreTasks) && (
              <button
                className="ck-cmdk-item"
                style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
            <button
              className="ck-cmdk-item"
              style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}
              onClick={handleRefresh}
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      <CommandBar open={commandOpen} onClose={closeCommand} />

      {taskToReassign && (
        <ReassignTaskModal
          task={taskToReassign}
          currentAssignee={taskToReassign.assignee_id}
          workspaceMembers={workspaceMembers}
          onClose={() => setTaskToReassign(null)}
          onReassign={async (taskId, newAssignee) => {
            await handlePatchTask(taskId, { assignee_id: newAssignee });
          }}
        />
      )}

      {taskToExtend && (
        <ExtendDeadlineDialog
          task={taskToExtend}
          onClose={() => setTaskToExtend(null)}
          onExtend={async (taskId, newDeadline) => {
            await handlePatchTask(taskId, { deadline: newDeadline });
          }}
        />
      )}
    </div>
  );
}

export default CockpitHub;
