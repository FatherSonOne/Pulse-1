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
import { Plus, Zap, Download, RotateCw } from 'lucide-react';
import { User } from '../../../types';
import { CockpitMasthead, type CockpitTab } from './CockpitMasthead';
import { useRegisterCommands, type Command } from '../../../contexts/CommandPaletteContext';
import { PropertyFilterBar, type ViewKind, type ViewAssignee, type SortKey } from './filters/PropertyFilterBar';
import { type SavedViewPreset } from './filters/SavedViews';
import { TriageView } from './triage/TriageView';
import { type QueueEntry, type QueueRetroItem } from './triage/queueModel';
import { type TaskActions } from './focal/TaskDetail';
import { type DecisionActions } from './focal/DecisionDetail';
import { type RetroActions } from './focal/RetrospectivePane';
import { FilterState } from '../FilterBar';
import { ReassignTaskModal } from '../ReassignTaskModal';
import { ExtendDeadlineDialog } from '../ExtendDeadlineDialog';
import { DecisionDecomposer } from '../DecisionDecomposer';
import { CreateOverlay, type CreateMode } from './create/CreateOverlay';
import type { FrameId } from '../wizard/types';
import { AlertsPanel } from '../AlertsPanel';
import { ConversationalAssistant } from '../ConversationalAssistant';
import { WorkspaceActivityPanel } from '../activity/WorkspaceActivityPanel';
import { AITaskPrioritizer } from '../../tasks/AITaskPrioritizer';
import { type AITaskPriority } from '../../../services/taskIntelligenceService';
import { dismissNudge, dismissMultipleNudges, snoozeNudge } from '../../../utils/dismissedNudgesStorage';
import { decisionService, DecisionWithVotes } from '../../../services/decisionService';
import { taskService, Task } from '../../../services/taskService';
import { decisionAnalyticsService, DecisionMetrics } from '../../../services/decisionAnalyticsService';
import { proactiveSuggestionsService, Nudge } from '../../../services/proactiveSuggestionsService';
import { decisionContextService, type RetrospectivePrompt } from '../../../services/decisionContextService';
import { dependenciesService } from '../../../services/dependenciesService';
import { nextRecurringTask } from '../../../services/taskRecurrence';
import { workspaceService } from '../../../services/workspaceService';
import { useDecisionTaskRealtime } from '../../../hooks/useDecisionTaskRealtime';
import { ArchiveView } from './archive/ArchiveView';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { listUserPlaces, getEntityPlaceMap } from '../../../services/locationService';
import { Place } from '../../../types/placeTypes';
import { getDismissedNudges } from '../../../utils/dismissedNudgesStorage';
import { isOverlayOpen } from '../../../lib/overlayStack';
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
  // ⌘K is the app-wide GlobalCommandPalette — the cockpit registers its
  // commands into it rather than running a second palette.
  // Command surface is the global bar/pill (centered modal retired in Phase 5).
  const openCommandPalette = () => window.dispatchEvent(new CustomEvent('pulse:command-palette-open'));

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
  // Cockpit-local view dimensions (not in the shared FilterState): kind +
  // assignee. SavedViews presets set these alongside FilterState.
  const [viewKind, setViewKind] = useState<ViewKind>('all');
  const [viewAssignee, setViewAssignee] = useState<ViewAssignee>('all');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [savedView, setSavedView] = useState<string>('all');

  // ── Place-aware filtering: flat task→place map + the workspace's places ──
  const [availablePlaces, setAvailablePlaces] = useState<Place[]>([]);
  const [taskPlaceMap, setTaskPlaceMap] = useState<Record<string, string>>({});

  // ── AI features ──
  const [metrics, setMetrics] = useState<DecisionMetrics | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(new Set());
  const [duePrompts, setDuePrompts] = useState<RetrospectivePrompt[]>([]);

  // ── Workspace members (assignee dropdowns) ──
  const [workspaceMembers, setWorkspaceMembers] = useState<User[]>([]);

  // ── Focal task modals ──
  const [taskToReassign, setTaskToReassign] = useState<Task | null>(null);
  const [taskToExtend, setTaskToExtend] = useState<Task | null>(null);

  // ── Decision decompose (Generate Tasks → DecisionDecomposer) ──
  const [decisionToDecompose, setDecisionToDecompose] = useState<DecisionWithVotes | null>(null);

  // ── Create overlay (New decision / Quick task / Ask AI) ──
  const [createMode, setCreateMode] = useState<{ mode: CreateMode; frameId?: FrameId } | null>(null);

  // ── Ancillary panels ──
  const [showAlerts, setShowAlerts] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showPrioritizer, setShowPrioritizer] = useState(false);

  // Debounced data → drives metric/nudge regeneration without thrash.
  const debouncedDecisions = useDebounce(decisions, 800);
  const debouncedTasks = useDebounce(tasks, 800);

  const effectiveWorkspaceId = workspaceId || currentWorkspace?.id || user?.id || '';

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

  const loadDuePrompts = useCallback(async () => {
    if (!effectiveWorkspaceId || !user?.id) return;
    try {
      const prompts = await decisionContextService.getDuePrompts(effectiveWorkspaceId, user.id);
      setDuePrompts(prompts);
    } catch (error) {
      console.error('Failed to load due retrospectives:', error);
    }
  }, [effectiveWorkspaceId, user?.id]);

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

  // CSV export (ported from DecisionTaskHub) — over the full sets, not filtered.
  const handleExportCSV = useCallback(() => {
    const filename = `decisions_tasks_${new Date().toISOString().split('T')[0]}.csv`;
    const headers = ['Type', 'Title', 'Status', 'Priority', 'Created', 'Deadline'];
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = [
      ...decisions.map((d) => ['Decision', esc(d.title), d.status, '-', new Date(d.created_at).toLocaleDateString(), d.decided_at ? new Date(d.decided_at).toLocaleDateString() : 'N/A']),
      ...tasks.map((t) => ['Task', esc(t.title), t.status, t.priority || 'N/A', new Date(t.extracted_at).toLocaleDateString(), t.deadline ? new Date(t.deadline).toLocaleDateString() : 'N/A']),
    ];
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [decisions, tasks]);

  // ── Saved views + filters ──
  const SAVED_VIEWS: SavedViewPreset[] = useMemo(
    () => [
      { id: 'all', label: 'All work' },
      { id: 'needs-you', label: 'Needs you' },
      { id: 'decisions', label: 'Decisions' },
      { id: 'mine', label: 'My tasks' },
    ],
    []
  );

  const clearAllFilters = useCallback(() => {
    setFilters({ search: '', status: 'all', priority: undefined, dateRange: undefined, placeId: undefined, tag: undefined });
    setViewKind('all');
    setViewAssignee('all');
  }, []);

  const applyPreset = useCallback((id: string) => {
    setSavedView(id);
    clearAllFilters();
    if (id === 'needs-you' || id === 'mine') setViewAssignee('me');
    if (id === 'mine') setViewKind('tasks');
    if (id === 'decisions') setViewKind('decisions');
  }, [clearAllFilters]);

  // ── ⌘K commands — registered into the app-wide GlobalCommandPalette ──
  const paletteCommands: Command[] = useMemo(
    () => [
      { id: 'dt-new-decision', label: 'New decision', desc: 'Open the decision wizard', icon: Plus, kind: 'action', group: 'Decisions & Tasks', keywords: ['create'], run: () => setCreateMode({ mode: 'decision' }) },
      { id: 'dt-quick-task', label: 'Quick task', desc: 'Create a task', icon: Plus, kind: 'action', group: 'Decisions & Tasks', keywords: ['create', 'new'], shortcut: 'c', run: () => setCreateMode({ mode: 'task' }) },
      { id: 'dt-prioritize', label: 'Prioritize tasks with AI', icon: Zap, kind: 'action', group: 'Decisions & Tasks', run: () => setShowPrioritizer(true) },
      { id: 'dt-export', label: 'Export decisions & tasks (CSV)', icon: Download, kind: 'action', group: 'Decisions & Tasks', run: handleExportCSV },
      { id: 'dt-refresh', label: 'Refresh decisions & tasks', icon: RotateCw, kind: 'action', group: 'Decisions & Tasks', run: handleRefresh },
    ],
    [handleExportCSV, handleRefresh]
  );
  useRegisterCommands('decisions-cockpit', { commands: paletteCommands });

  // Global section-action drain (Phase 3 of the palette globalization). A palette
  // command run from another view stashes { target:'decisions', action } in
  // sessionStorage and dispatches pulse:section-action, then navigates here.
  // CockpitHub is lazy-loaded, so on cold navigation the event fires before this
  // chunk mounts — the sessionStorage drain on mount is what catches it; the live
  // listener covers the warm path (already on this view). Intent is removed the
  // moment it's consumed so it can't re-fire on a later visit.
  useEffect(() => {
    const runAction = (action: string) => {
      if (action === 'decision') setCreateMode({ mode: 'decision' });
      else if (action === 'task') setCreateMode({ mode: 'task' });
      else if (action === 'prioritize') setShowPrioritizer(true);
    };
    try {
      const raw = sessionStorage.getItem('pulse_pending_section_action');
      if (raw) {
        const intent = JSON.parse(raw) as { target?: string; action?: string };
        if (intent?.target === 'decisions' && intent.action) {
          sessionStorage.removeItem('pulse_pending_section_action');
          runAction(intent.action);
        }
      }
    } catch {}
    const onSectionAction = (e: Event) => {
      const detail = (e as CustomEvent<{ target?: string; action?: string }>).detail;
      if (detail?.target === 'decisions' && detail.action) {
        try { sessionStorage.removeItem('pulse_pending_section_action'); } catch {}
        runAction(detail.action);
      }
    };
    window.addEventListener('pulse:section-action', onSectionAction);
    return () => window.removeEventListener('pulse:section-action', onSectionAction);
  }, []);

  // Queue row hover quick-actions. `done` marks a task done (realtime refreshes
  // the queue) or casts an Approve vote on a decision. Snooze lands in Phase 8.
  // When a recurring task is completed, spawn its next occurrence (client-side
  // regeneration). Returns silently when the task isn't recurring or the series
  // has ended (COUNT exhausted / past UNTIL → nextRecurringTask returns null). 2d.
  const regenerateRecurring = useCallback(
    async (task: Task) => {
      if (!task.recurrence_rule) return;
      const next = nextRecurringTask(task.recurrence_rule, task.deadline);
      if (!next) return;
      try {
        await taskService.createTask({
          workspace_id: task.workspace_id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          assignee_id: task.assignee_id,
          status: 'todo',
          deadline: next.dueDate.toISOString(),
          tags: task.tags,
          recurrence_rule: next.nextRule,
          recurrence_parent_id: task.recurrence_parent_id ?? task.id,
          created_by: user?.id,
          metadata: { ...(task.metadata ?? {}), recurred_from: task.id },
        });
        loadTasks();
        toast(`Next occurrence created · ${next.dueDate.toLocaleDateString()}`, { icon: '🔁' });
      } catch (e) {
        console.error('Failed to spawn next recurring task:', e);
      }
    },
    [user?.id, loadTasks]
  );

  const handleQuickAction = useCallback(
    async (entry: QueueEntry, action: 'done' | 'snooze') => {
      if (action === 'snooze') {
        toast('Snooze arrives in a later phase', { icon: '⏳' });
        return;
      }
      if (entry.kind === 'task') {
        try {
          await taskService.updateTaskStatus(entry.task.id, 'done');
          setTasks((prev) => prev.map((t) => (t.id === entry.task.id ? { ...t, status: 'done' } : t)));
          toast.success('Marked done');
          void regenerateRecurring(entry.task);
        } catch (error) {
          console.error('Failed to mark task done:', error);
          toast.error('Could not update task');
        }
        return;
      }
      // Decision: approve from the queue. (Retro rows have no quick-action.)
      if (entry.kind !== 'decision' || !user?.id) return;
      try {
        await decisionService.castVote({ decision_id: entry.decision.id, user_id: user.id, choice: 'approve' });
        toast.success('Approved');
        loadDecisions();
      } catch (error) {
        console.error('Failed to approve decision:', error);
        toast.error('Could not record vote');
      }
    },
    [user?.id, loadDecisions, regenerateRecurring]
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
          const completed = tasks.find((t) => t.id === taskId);
          if (completed) void regenerateRecurring(completed);
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
    [patchTaskLocal, effectiveWorkspaceId, loadTasks, tasks, regenerateRecurring]
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

  // ── Bulk actions over selected task ids (3b) ──
  const handleBulkComplete = useCallback(
    async (taskIds: string[]) => {
      if (taskIds.length === 0) return;
      const idSet = new Set(taskIds);
      const completed = tasks.filter((t) => idSet.has(t.id));
      setTasks((prev) => prev.map((t) => (idSet.has(t.id) ? { ...t, status: 'done' } : t)));
      try {
        await Promise.all(taskIds.map((id) => taskService.updateTaskStatus(id, 'done')));
        for (const t of completed) void regenerateRecurring(t);
        toast.success(`${taskIds.length} marked done`);
      } catch (error) {
        console.error('Bulk complete failed:', error);
        toast.error('Could not update some tasks');
        loadTasks();
      }
    },
    [tasks, regenerateRecurring, loadTasks]
  );

  const handleBulkDelete = useCallback(
    async (taskIds: string[]) => {
      if (taskIds.length === 0) return;
      const idSet = new Set(taskIds);
      setTasks((prev) => prev.filter((t) => !idSet.has(t.id)));
      try {
        await Promise.all(taskIds.map((id) => taskService.deleteTask(id)));
        toast.success(`${taskIds.length} deleted`);
      } catch (error) {
        console.error('Bulk delete failed:', error);
        toast.error('Could not delete some tasks');
        loadTasks();
      }
    },
    [loadTasks]
  );

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

  // ── Decision actions ──
  // Pre-compute linked task counts per decision (avoids N+1 in the focal pane).
  const linkedTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      const decisionId = task.metadata?.decision_id || task.metadata?.generated_from_decision;
      if (decisionId) counts[decisionId] = (counts[decisionId] || 0) + 1;
    }
    return counts;
  }, [tasks]);

  // Generate Tasks → DecisionDecomposer writes the tasks (ported verbatim).
  const handleDecompositionComplete = useCallback(
    async (generated: Partial<Task>[], brief: string) => {
      if (!decisionToDecompose) return;
      try {
        for (const taskData of generated) {
          await taskService.createTask({
            workspace_id: taskData.workspace_id!,
            title: taskData.title!,
            description: taskData.description,
            priority: taskData.priority,
            assignee_id: taskData.assignee_id,
            deadline: taskData.deadline,
            status: taskData.status || 'todo',
            metadata: {
              ...taskData.metadata,
              generated_from_decision: decisionToDecompose.id,
              decision_title: decisionToDecompose.title,
            },
          });
        }
        // `brief` + `tasks_generated_at` are real `decisions` columns the
        // Decision TS interface omits; cast through unknown (matches legacy).
        await decisionService.updateDecision(
          decisionToDecompose.id,
          { brief, tasks_generated_at: new Date().toISOString() } as unknown as Partial<DecisionWithVotes>
        );
        await Promise.all([loadTasks(), loadDecisions()]);
        setDecisionToDecompose(null);
      } catch (error) {
        console.error('Failed to create tasks from decomposition:', error);
        throw error;
      }
    },
    [decisionToDecompose, loadTasks, loadDecisions]
  );

  const decisionActions: DecisionActions = useMemo(
    () => ({
      currentUserId: user?.id || '',
      workspaceId: effectiveWorkspaceId,
      members: workspaceMembers,
      linkedTaskCounts,
      onVoted: loadDecisions,
      onGenerateTasks: (decision: DecisionWithVotes) => setDecisionToDecompose(decision),
    }),
    [user?.id, effectiveWorkspaceId, workspaceMembers, linkedTaskCounts, loadDecisions]
  );

  // ── Due retrospectives → queue `retro` items (title resolved from decisions) ──
  const retros: QueueRetroItem[] = useMemo(
    () =>
      duePrompts.map((p) => ({
        id: `retro-${p.id}`,
        kind: 'retro' as const,
        prompt: p,
        decisionTitle: decisions.find((d) => d.id === p.decisionId)?.title ?? 'a past decision',
      })),
    [duePrompts, decisions]
  );

  const retroActions: RetroActions = useMemo(
    () => ({
      workspaceId: effectiveWorkspaceId,
      currentUserId: user?.id || '',
      onResolved: () => { loadDuePrompts(); loadDecisions(); },
    }),
    [effectiveWorkspaceId, user?.id, loadDuePrompts, loadDecisions]
  );

  // Create entry points → the New overlay.
  const handleNewDecision = useCallback(() => setCreateMode({ mode: 'decision' }), []);
  const handleNewTask = useCallback(() => setCreateMode({ mode: 'task' }), []);
  const handleAskAI = useCallback(() => setCreateMode({ mode: 'ai' }), []);
  const handleCreated = useCallback(() => { loadDecisions(); loadTasks(); loadDuePrompts(); }, [loadDecisions, loadTasks, loadDuePrompts]);

  // ── Nudge (AlertsPanel) handlers ──
  const handleDismissNudge = useCallback((id: string) => {
    dismissNudge(id);
    setDismissedNudges((prev) => new Set(prev).add(id));
    setNudges((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleDismissAllNudges = useCallback(() => {
    const ids = nudges.map((n) => n.id);
    dismissMultipleNudges(ids);
    setDismissedNudges((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
    setShowAlerts(false);
  }, [nudges]);

  const handleNudgeAction = useCallback((nudge: Nudge) => {
    switch (nudge.actionType) {
      case 'send_reminder':
        toast.success(`Reminder queued for: ${nudge.relatedTitle}`);
        handleDismissNudge(nudge.id);
        break;
      case 'reassign': {
        const task = tasks.find((t) => t.id === nudge.relatedId);
        if (task) setTaskToReassign(task);
        break;
      }
      case 'extend_deadline': {
        const task = tasks.find((t) => t.id === nudge.relatedId);
        if (task) setTaskToExtend(task);
        break;
      }
      case 'review':
        handleDismissNudge(nudge.id);
        break;
      default:
        break;
    }
  }, [tasks, handleDismissNudge]);

  // ── AI prioritization (AITaskPrioritizer) — apply scores to task metadata ──
  const handlePrioritizationComplete = useCallback((prioritized: AITaskPriority[]) => {
    setTasks((prev) =>
      prev.map((task) => {
        const ai = prioritized.find((p) => p.taskId === task.id);
        return ai
          ? { ...task, metadata: { ...task.metadata, ai_priority_score: ai.aiScore, ai_suggested_assignee: ai.suggestedAssignee, ai_predicted_duration: ai.predictedDuration } }
          : task;
      })
    );
  }, []);

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

  // Due retrospectives (reload when the decision set changes — a freshly
  // Decided decision may have queued a look-back).
  useEffect(() => {
    loadDuePrompts();
  }, [loadDuePrompts, decisions.length]);

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

  // `c` opens Quick task (Linear/Raycast convention) when nothing else is open.
  // ⌘K is owned by the app-wide GlobalCommandPalette — not handled here.
  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isOverlayOpen()) return;
      if ((e.key === 'c' || e.key === 'C') && !createMode) {
        e.preventDefault();
        setCreateMode({ mode: 'task' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [createMode]);

  // ── Derived: filtered sets (Phase 3 queue rail consumes these) ──
  const filteredTasks = useMemo(() => {
    if (viewKind === 'decisions') return [];
    let filtered = tasks;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
      );
    }
    if (filters.status !== 'all') filtered = filtered.filter((t) => t.status === filters.status);
    if (filters.priority) filtered = filtered.filter((t) => t.priority === filters.priority);
    if (viewAssignee === 'me' && user?.id) filtered = filtered.filter((t) => t.assignee_id === user.id);
    if (filters.placeId !== undefined) {
      filtered = filtered.filter((t) => {
        const placeId = taskPlaceMap[t.id];
        return filters.placeId === null ? !placeId : placeId === filters.placeId;
      });
    }
    if (filters.dateRange) {
      const { start, end } = filters.dateRange;
      // extracted_tasks keys off extracted_at (created_at is optional/compat).
      filtered = filtered.filter((t) => {
        const ts = t.extracted_at || t.created_at;
        if (!ts) return false;
        const d = new Date(ts);
        return d >= start && d <= end;
      });
    }
    if (filters.tag) filtered = filtered.filter((t) => (t.tags ?? []).includes(filters.tag!));
    return filtered;
  }, [tasks, filters, taskPlaceMap, viewKind, viewAssignee, user?.id]);

  // Distinct labels across loaded tasks — drives the PropertyFilterBar Labels menu.
  const availableTags = useMemo(
    () => [...new Set(tasks.flatMap((t) => t.tags ?? []))].sort((a, b) => a.localeCompare(b)),
    [tasks]
  );

  // Sort reorders WITHIN the triage groups (queueModel re-buckets by status). 'recent'
  // is the default DB order (extracted_at desc) so it's a no-op passthrough. 3a.
  const sortedTasks = useMemo(() => {
    if (sortBy === 'recent') return filteredTasks;
    const rank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    const arr = [...filteredTasks];
    if (sortBy === 'priority') {
      arr.sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
    } else if (sortBy === 'due') {
      arr.sort((a, b) => {
        const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return da - db;
      });
    }
    return arr;
  }, [filteredTasks, sortBy]);

  const filteredDecisions = useMemo(() => {
    if (viewKind === 'tasks') return [];
    let filtered = decisions;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (d) => d.title.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q)
      );
    }
    if (filters.dateRange) {
      const { start, end } = filters.dateRange;
      filtered = filtered.filter((d) => {
        if (!d.created_at) return false;
        const dt = new Date(d.created_at);
        return dt >= start && dt <= end;
      });
    }
    return filtered;
  }, [decisions, filters, viewKind]);

  const loading = decisionsLoading || tasksLoading;
  const subtitle = loading
    ? 'Loading…'
    : `${filteredDecisions.length} decisions · ${filteredTasks.length} tasks`;

  return (
    <div className="ck-root">
      <CockpitMasthead
        tab={tab}
        setTab={setTab}
        onOpenCommand={openCommandPalette}
        onNewDecision={handleNewDecision}
        onNewTask={handleNewTask}
        onAskAI={handleAskAI}
        onAlerts={() => setShowAlerts((o) => !o)}
        onActivity={() => setShowActivity(true)}
        onAssistant={() => setShowAssistant((o) => !o)}
        subtitle={subtitle}
        alertCount={nudges.length}
      />

      {/* Triage tab → queue rail + focal. Archive tab keeps the Phase-2 status
          body (live counts + connection + Load more) until Phase 9 builds the
          timeline + retrospective. */}
      {tab === 'triage' ? (
        <>
          <PropertyFilterBar
            presets={SAVED_VIEWS}
            savedView={savedView}
            onSelectPreset={applyPreset}
            filters={filters}
            setFilters={setFilters}
            viewKind={viewKind}
            setViewKind={setViewKind}
            viewAssignee={viewAssignee}
            setViewAssignee={setViewAssignee}
            availablePlaces={availablePlaces}
            availableTags={availableTags}
            sortBy={sortBy}
            setSortBy={setSortBy}
            onClearAll={clearAllFilters}
          />
          <TriageView
            tasks={sortedTasks}
            decisions={filteredDecisions}
            retros={retros}
            currentUserId={user?.id}
            loading={loading}
            connectionStatus={connectionStatus}
            onQuickAction={handleQuickAction}
            taskActions={taskActions}
            decisionActions={decisionActions}
            retroActions={retroActions}
            onNewDecision={handleNewDecision}
            onAskAI={handleAskAI}
            hasMore={hasMoreDecisions || hasMoreTasks}
            loadingMore={loadingMore}
            onLoadMore={handleLoadMore}
            onBulkComplete={handleBulkComplete}
            onBulkDelete={handleBulkDelete}
          />
        </>
      ) : (
        <ArchiveView
          workspaceId={effectiveWorkspaceId}
          currentUserId={user?.id ?? ''}
          members={workspaceMembers}
          onChanged={() => { loadTasks(); loadDecisions(); loadDuePrompts(); }}
        />
      )}

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

      {decisionToDecompose && (
        <DecisionDecomposer
          decision={decisionToDecompose}
          workspaceId={effectiveWorkspaceId}
          workspaceMembers={workspaceMembers as any}
          onClose={() => setDecisionToDecompose(null)}
          onTasksGenerated={handleDecompositionComplete}
        />
      )}

      {createMode && (
        <CreateOverlay
          mode={createMode.mode}
          initialFrameId={createMode.frameId}
          workspaceId={effectiveWorkspaceId}
          currentUserId={user?.id || ''}
          workspaceMembers={workspaceMembers}
          onClose={() => setCreateMode(null)}
          onCreated={handleCreated}
        />
      )}

      {/* Ancillary panels */}
      {nudges.length > 0 && showAlerts && (
        <AlertsPanel
          nudges={nudges}
          onDismiss={handleDismissNudge}
          onDismissAll={handleDismissAllNudges}
          onAction={handleNudgeAction}
          onClose={() => setShowAlerts(false)}
          onSnooze={(id, minutes) => { snoozeNudge(id, minutes); setNudges((prev) => prev.filter((n) => n.id !== id)); }}
        />
      )}

      {showAssistant && user && (
        <ConversationalAssistant
          user={user}
          decisions={decisions}
          tasks={tasks}
          metrics={metrics}
          onClose={() => setShowAssistant(false)}
        />
      )}

      {showActivity && (
        <WorkspaceActivityPanel
          workspaceId={effectiveWorkspaceId}
          workspaceMembers={workspaceMembers}
          onOpenItem={() => setShowActivity(false)}
          onClose={() => setShowActivity(false)}
        />
      )}

      {showPrioritizer && (
        <AITaskPrioritizer
          tasks={tasks}
          onPrioritizationComplete={handlePrioritizationComplete}
          onClose={() => setShowPrioritizer(false)}
        />
      )}
    </div>
  );
}

export default CockpitHub;
