import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { HubHeader, HubMode } from './HubHeader';
import { FilterBar, FilterState } from './FilterBar';
import { ActiveView } from './ActiveView';
import { BoardView } from './BoardView';
import { ArchiveView } from './ArchiveView';
import { EnhancedDecisionCard } from './EnhancedDecisionCard';
import { AITaskPrioritizer } from '../tasks/AITaskPrioritizer';
import { SkeletonDecisionCard } from './SkeletonDecisionCard';
import { SkeletonTaskCard } from '../tasks/SkeletonTaskCard';
import { AIFeatureErrorBoundary } from './AIFeatureErrorBoundary';
import { TaskEditModal } from '../tasks/TaskEditModal';
import { CreateTaskModal } from '../tasks/CreateTaskModal';
import { DecisionDecomposer } from './DecisionDecomposer';
import { DecisionWizard } from './wizard/DecisionWizard';
import { WorkspaceActivityPanel } from './activity/WorkspaceActivityPanel';
import { ActivitySummaryStrip } from './activity/ActivitySummaryStrip';
import { ActivityDrawer } from './activity/ActivityDrawer';
import { decisionActivityService, type ActivitySource } from '../../services/decisionActivityService';
import { decisionContextService, type Criterion, type DecisionOption } from '../../services/decisionContextService';
import { DueRetrospectiveBanner } from './context/DueRetrospectiveBanner';
import { dependenciesService } from '../../services/dependenciesService';
import { decisionService, DecisionWithVotes } from '../../services/decisionService';
import { taskService, Task } from '../../services/taskService';
import { decisionAnalyticsService, DecisionMetrics } from '../../services/decisionAnalyticsService';
import { proactiveSuggestionsService, Nudge } from '../../services/proactiveSuggestionsService';
import { taskIntelligenceService, AITaskPriority } from '../../services/taskIntelligenceService';
import { ragService, AIMessage, ThinkingStep } from '../../services/ragService';
import { useAIErrorHandler } from '../../hooks/useAIErrorHandler';
import { useDecisionTaskRealtime } from '../../hooks/useDecisionTaskRealtime';
import { DecisionMission } from '../WarRoom/missions/DecisionMission';
import { ConversationalAssistant } from './ConversationalAssistant';
import { AlertsPanel } from './AlertsPanel';
import { RealTimeIndicator } from './RealTimeIndicator';
import { ReassignTaskModal } from './ReassignTaskModal';
import { ExtendDeadlineDialog } from './ExtendDeadlineDialog';
import { User } from '../../types';
import { supabase } from '../../services/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { listUserPlaces, getEntityPlaceMap, createPlace, attachPlaceToEntity } from '../../services/locationService';
import { Place } from '../../types/placeTypes';
import {
  getDismissedNudges,
  dismissNudge,
  dismissMultipleNudges,
  undoDismissNudge,
  snoozeNudge,
} from '../../utils/dismissedNudgesStorage';
import {
  Plus,
  Bell,
  Bot,
  X,
  Undo,
  Download,
  Sparkles,
  Trash2,
  CheckSquare,
  ChevronDown,
  LayoutTemplate,
  Activity,
} from 'lucide-react';
import './DecisionTaskHub.css';

// Custom debounce hook for performance optimization
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface DecisionTaskHubProps {
  user: User | null;
  workspaceId?: string;
}

/**
 * Phase 4: extract structured-context fields from a wizard Step 2 payload.
 * Each frame surfaces a different subset (per the contextFields array on
 * each DecisionFrame). The persisted shape is consistent: criteria as
 * weighted entries, options as labeled items, stakeholders as member ids.
 */
function extractDecisionContext(
  frameId: string,
  step2: Record<string, unknown>
): {
  criteria: Criterion[];
  options: DecisionOption[];
  stakeholders: string[];
} {
  const result = {
    criteria: [] as Criterion[],
    options: [] as DecisionOption[],
    stakeholders: [] as string[],
  };
  const s = step2 as Record<string, unknown>;

  // Stakeholders: most frames carry a `stakeholders: string[]` field.
  if (Array.isArray(s.stakeholders)) {
    result.stakeholders = s.stakeholders.filter((x): x is string => typeof x === 'string');
  }

  switch (frameId) {
    case 'pick_tool': {
      // candidates -> options, criteria -> criteria.
      const candidates = (s.candidates as string[] | undefined) ?? [];
      const criteria = (s.criteria as string[] | undefined) ?? [];
      result.options = candidates.map((label, i) => ({
        id: `opt-${i}`,
        label,
      }));
      result.criteria = criteria.map((label, i) => ({
        id: `crit-${i}`,
        label,
        weight: 3,
      }));
      break;
    }
    case 'allocate': {
      const recipients = (s.recipients as string[] | undefined) ?? [];
      const criteria = (s.criteria as string[] | undefined) ?? [];
      result.options = recipients.map((label, i) => ({ id: `rec-${i}`, label }));
      result.criteria = (criteria.length > 0 ? criteria : ['impact', 'fit']).map((label, i) => ({
        id: `crit-${i}`,
        label,
        weight: 3,
      }));
      break;
    }
    case 'conflict': {
      // partyPositions -> options labeled by party position.
      const positions = (s.partyPositions as Array<{ partyId: string; position: string }> | undefined) ?? [];
      result.options = positions.map((p, i) => ({
        id: p.partyId || `pos-${i}`,
        label: `Position ${i + 1}`,
        description: p.position,
      }));
      const parties = (s.parties as string[] | undefined) ?? [];
      // Parties are workspace member ids; merge into stakeholders.
      const merged = new Set([...result.stakeholders, ...parties.filter((x) => typeof x === 'string')]);
      result.stakeholders = Array.from(merged);
      break;
    }
    case 'hire':
    case 'build':
    case 'strategy':
    default:
      // No criteria/options for these frames; stakeholders only.
      break;
  }

  return result;
}

export const DecisionTaskHub: React.FC<DecisionTaskHubProps> = ({
  user,
  workspaceId
}) => {
  const { currentWorkspace } = useWorkspace();
  // AI-router error handler (cap exceeded / provider down → toast + CTA)
  const handleAIError = useAIErrorHandler();
  // Core state
  const [mode, setMode] = useState<HubMode>('active');
  const [decisions, setDecisions] = useState<DecisionWithVotes[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [hasMoreDecisions, setHasMoreDecisions] = useState(false);
  const [hasMoreTasks, setHasMoreTasks] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Bulk selection state
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [aiPriorities, setAiPriorities] = useState<AITaskPriority[]>([]);
  const [showPrioritizer, setShowPrioritizer] = useState(false);
  // Two-step inline confirmation for the bulk-delete button. First click arms;
  // second click within 4 seconds executes. Replaces window.confirm so the
  // operator never gets bumped out of Pulse's chrome into a native dialog.
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  // Bulk status dropdown open/close. Replaces the native <select> chrome
  // with a Pulse-styled popover so the bulk toolbar reads as instrument-grade.
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);

  // Filter state - unified using FilterBar's FilterState
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    priority: undefined,
    dateRange: undefined,
    placeId: undefined,
  });

  // B1: place-aware filtering. The picker writes through entity_places;
  // here we cache a flat taskId → placeId map so the FilterBar can offer
  // a "Location" filter without N+1 fetches.
  const [availablePlaces, setAvailablePlaces] = useState<Place[]>([]);
  const [taskPlaceMap, setTaskPlaceMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([listUserPlaces(), getEntityPlaceMap('task')]).then(([places, map]) => {
      if (cancelled) return;
      setAvailablePlaces(places);
      setTaskPlaceMap(map);
    });
    return () => { cancelled = true; };
  }, []);

  // AI features state
  const [metrics, setMetrics] = useState<DecisionMetrics | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(new Set());
  const [showNudges, setShowNudges] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [lastDismissedNudge, setLastDismissedNudge] = useState<string | null>(null);

  // Modal state
  const [showDecisionMission, setShowDecisionMission] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<DecisionWithVotes | null>(null);
  const [missionMessages, setMissionMessages] = useState<AIMessage[]>([]);
  const [missionLoading, setMissionLoading] = useState(false);
  const [missionThinkingLogs, setMissionThinkingLogs] = useState<Map<string, ThinkingStep[]>>(new Map());

  // Sprint 6: New modals state
  const [taskToReassign, setTaskToReassign] = useState<Task | null>(null);
  const [taskToExtend, setTaskToExtend] = useState<Task | null>(null);

  // Task CRUD modals state
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);

  // Decision decomposition state
  const [decisionToDecompose, setDecisionToDecompose] = useState<DecisionWithVotes | null>(null);

  // Decision Wizard state. Replaces the legacy DecisionTemplates modal trigger.
  // initialFrameId is set when the operator clicked one of the empty-state
  // quick-launch chips so the wizard opens straight to that frame's Step 2.
  const [wizardOpen, setWizardOpen] = useState<{ frameId?: import('./wizard/types').FrameId } | null>(null);

  // Phase 2: workspace-wide activity panel.
  const [activityPanelOpen, setActivityPanelOpen] = useState(false);

  // Phase 3: per-item activity + comments drawer.
  const [itemDrawer, setItemDrawer] = useState<{
    source: ActivitySource;
    itemId: string;
    itemTitle: string;
  } | null>(null);

  const openItemDrawer = useCallback(
    (source: ActivitySource, itemId: string, itemTitle: string) => {
      setItemDrawer({ source, itemId, itemTitle });
    },
    []
  );

  // Workspace members for assignee dropdowns
  const [workspaceMembers, setWorkspaceMembers] = useState<User[]>([]);

  // Debounced versions to throttle expensive AI regeneration
  const debouncedDecisions = useDebounce(decisions, 800);
  const debouncedTasks = useDebounce(tasks, 800);

  // Use current workspace from context, fall back to prop then user.id (Phase 1 compat)
  const effectiveWorkspaceId = workspaceId || currentWorkspace?.id || user?.id || '';

  // Load dismissed nudges from localStorage on mount
  useEffect(() => {
    const dismissed = getDismissedNudges();
    setDismissedNudges(dismissed);
  }, []);

  // Load data on mount and when filters change
  useEffect(() => {
    if (effectiveWorkspaceId) {
      loadDecisions();
      loadTasks();
    }
  }, [effectiveWorkspaceId]);

  // Load workspace members for assignee dropdowns
  useEffect(() => {
    if (!effectiveWorkspaceId) return;
    const loadMembers = async () => {
      try {
        const { data } = await supabase
          .from('workspace_members')
          .select('*, profiles(*)')
          .eq('workspace_id', effectiveWorkspaceId);
        if (data) {
          setWorkspaceMembers(
            data
              .filter((m: any) => m.profiles)
              .map((m: any) => m.profiles as User)
          );
        }
      } catch (error) {
        console.error('Failed to load workspace members:', error);
      }
    };
    loadMembers();
  }, [effectiveWorkspaceId]);

  // Generate metrics and nudges when data changes (debounced to avoid rapid re-runs)
  useEffect(() => {
    if (debouncedDecisions.length > 0) {
      generateMetrics();
    }
    if (debouncedDecisions.length > 0 || debouncedTasks.length > 0) {
      generateNudges();
    }
  }, [debouncedDecisions, debouncedTasks]);

  // Real-time subscriptions for decisions, tasks, and votes — channels are
  // namespaced by workspace_id inside the hook to prevent stale subscriptions
  // from a previous workspace leaking into the current one on switch.
  // Handlers are defined further down (handleDecisionChange / handleTaskChange /
  // handleVoteChange) — declared via useCallback so referential identity is
  // stable and the hook's useEffect doesn't tear down on every render.

  // Modal Escape key + global shortcuts.
  // `c` opens the Create Task modal — the primary action on this surface,
  // mirroring Linear/Raycast convention. Bails when the user is typing in
  // an input/textarea/contenteditable so it doesn't fire mid-search.
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      return target.isContentEditable;
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showDecisionMission) {
          setShowDecisionMission(false);
        } else if (showAssistant) {
          setShowAssistant(false);
        } else if (showPrioritizer) {
          setShowPrioritizer(false);
        } else if (taskToReassign) {
          setTaskToReassign(null);
        } else if (taskToExtend) {
          setTaskToExtend(null);
        }
        return;
      }

      if (isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'c' || event.key === 'C') {
        const anyOverlay = showDecisionMission || showAssistant || showPrioritizer ||
          taskToReassign !== null || taskToExtend !== null || taskToEdit !== null ||
          showCreateTask || decisionToDecompose !== null || wizardOpen !== null;
        if (anyOverlay) return;
        event.preventDefault();
        setShowCreateTask(true);
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [showDecisionMission, showAssistant, showPrioritizer, taskToReassign, taskToExtend, taskToEdit, showCreateTask, decisionToDecompose, wizardOpen]);

  // Prevent background scroll
  useEffect(() => {
    const hasAnyOverlay = showDecisionMission || showAssistant || showPrioritizer || taskToReassign !== null || taskToExtend !== null;

    if (hasAnyOverlay) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [showDecisionMission, showAssistant, showPrioritizer, taskToReassign, taskToExtend]);

  // Focus trap for modals (accessibility)
  useEffect(() => {
    const hasModalOpen = showDecisionMission || showAssistant || taskToReassign !== null || taskToExtend !== null;

    if (!hasModalOpen) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const modalElement = document.querySelector(
        showDecisionMission ? '.decision-mission-modal' :
        showAssistant ? '.conversational-assistant' :
        taskToReassign ? '.reassign-modal-overlay' :
        '.extend-deadline-overlay'
      );

      if (!modalElement) return;

      const focusableElements = modalElement.querySelectorAll(focusableSelectors);
      const firstFocusable = focusableElements[0] as HTMLElement;
      const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => {
      document.removeEventListener('keydown', handleTabKey);
    };
  }, [showDecisionMission, showAssistant, taskToReassign, taskToExtend]);

  const loadDecisions = useCallback(async () => {
    setDecisionsLoading(true);
    try {
      const { decisions: allDecisions, hasMore } = await decisionService.getWorkspaceDecisions(effectiveWorkspaceId);

      setDecisions(allDecisions);
      setHasMoreDecisions(hasMore);

      // Update selectedDecision if it exists to maintain reference
      setSelectedDecision(prev => {
        if (!prev) return null;
        const updated = allDecisions.find(d => d.id === prev.id);
        return updated || prev;
      });
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
      const { tasks: allTasks, hasMore } = await taskService.getWorkspaceTasks(effectiveWorkspaceId);
      setTasks(allTasks);
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
      const calculatedMetrics = await decisionAnalyticsService.calculateDecisionVelocity(decisions);
      setMetrics(calculatedMetrics);
    } catch (error) {
      console.error('❌ Failed to generate metrics:', error);
    }
  }, [decisions]);

  const generateNudges = useCallback(async () => {
    if (!user) return;

    try {
      const generatedNudges = await proactiveSuggestionsService.generateNudges(
        decisions,
        tasks,
        user,
        ''
      );

      const activeNudges = generatedNudges.filter(n => !dismissedNudges.has(n.id));
      setNudges(activeNudges);
    } catch (error) {
      console.error('❌ Failed to generate nudges:', error);
    }
  }, [user, decisions, tasks, dismissedNudges]);

  const handleVote = useCallback(() => {
    loadDecisions();
  }, [loadDecisions]);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      if (hasMoreDecisions) {
        const { decisions: more, hasMore } = await decisionService.getWorkspaceDecisions(
          effectiveWorkspaceId,
          { offset: decisions.length }
        );
        setDecisions(prev => [...prev, ...more]);
        setHasMoreDecisions(hasMore);
      }
      if (hasMoreTasks) {
        const { tasks: more, hasMore } = await taskService.getWorkspaceTasks(
          effectiveWorkspaceId,
          { offset: tasks.length }
        );
        setTasks(prev => [...prev, ...more]);
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

  // Enhanced dismiss handling with persistence
  const handleDismissNudge = useCallback((nudgeId: string) => {
    dismissNudge(nudgeId);
    setDismissedNudges(prev => new Set(prev).add(nudgeId));
    setNudges(nudges.filter(n => n.id !== nudgeId));
    setLastDismissedNudge(nudgeId);

    setTimeout(() => {
      setLastDismissedNudge(null);
    }, 5000);
  }, [nudges]);

  const handleDismissAllNudges = useCallback(() => {
    const nudgeIds = nudges.map(n => n.id);
    dismissMultipleNudges(nudgeIds);
    setDismissedNudges(prev => {
      const updated = new Set(prev);
      nudgeIds.forEach(id => updated.add(id));
      return updated;
    });
    setShowNudges(false);
  }, [nudges]);

  const handleUndoDismiss = useCallback(() => {
    if (!lastDismissedNudge) return;

    undoDismissNudge(lastDismissedNudge);
    setDismissedNudges(prev => {
      const updated = new Set(prev);
      updated.delete(lastDismissedNudge);
      return updated;
    });
    setLastDismissedNudge(null);

    generateNudges();
  }, [lastDismissedNudge, generateNudges]);

  // Decision Mission handlers
  const handleOpenDecisionMission = useCallback((decision?: DecisionWithVotes) => {
    setShowDecisionMission(true);
    setSelectedDecision(decision || null);
    setMissionMessages([]);
    setMissionThinkingLogs(new Map());

    if (decision) {
      const contextMessage: AIMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `I've loaded the decision: "${decision.title}"\n\nStatus: ${decision.status}\nType: ${decision.decision_type}\n\nHow can I help you with this decision?`,
        created_at: new Date().toISOString()
      };
      setMissionMessages([contextMessage]);
    }
  }, []);

  const handleToggleAssistant = useCallback(() => {
    setShowAssistant(prev => !prev);
  }, []);

  const handleCloseAssistant = useCallback(() => {
    setShowAssistant(false);
  }, []);


  const handleTogglePrioritizer = useCallback(() => {
    setShowPrioritizer(prev => !prev);
  }, []);

  const handleCloseMission = useCallback(() => {
    setShowDecisionMission(false);
    setSelectedDecision(null);
    setMissionMessages([]);
    setMissionThinkingLogs(new Map());
  }, []);

  // CSV Export
  const handleExportCSV = useCallback(() => {
    const filename = `decisions_tasks_${new Date().toISOString().split('T')[0]}.csv`;
    const headers = ['Type', 'Title', 'Status', 'Priority', 'Created', 'Deadline'];
    const rows = [
      ...decisions.map(d => [
        'Decision',
        `"${d.title.replace(/"/g, '""')}"`,
        d.status,
        '-',
        new Date(d.created_at).toLocaleDateString(),
        d.decided_at ? new Date(d.decided_at).toLocaleDateString() : 'N/A'
      ]),
      ...tasks.map(t => [
        'Task',
        `"${t.title.replace(/"/g, '""')}"`,
        t.status,
        t.priority || 'N/A',
        new Date(t.extracted_at).toLocaleDateString(),
        t.deadline ? new Date(t.deadline).toLocaleDateString() : 'N/A'
      ])
    ];
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [decisions, tasks]);

  const handleAssistantAction = useCallback((action: { type: string; data: any }) => {
    switch (action.type) {
      case 'create_decision':
        handleOpenDecisionMission();
        break;
      case 'update_task':
        loadTasks();
        break;
      case 'send_reminder':
        break;
      default:
        break;
    }
  }, [handleOpenDecisionMission, loadTasks]);

  // Enhanced nudge action handlers
  const handleNudgeAction = useCallback(async (nudge: Nudge) => {

    switch (nudge.actionType) {
      case 'send_reminder':
        toast.success(`Reminder queued for: ${nudge.relatedTitle}`, {
          duration: 3500,
        });
        handleDismissNudge(nudge.id);
        break;

      case 'review':
        if (nudge.type === 'decision_stale' && nudge.relatedId) {
          const decision = decisions.find(d => d.id === nudge.relatedId);
          if (decision) {
            handleOpenDecisionMission(decision);
          }
        }
        handleDismissNudge(nudge.id);
        break;

      case 'reassign':
        if (nudge.relatedId) {
          const task = tasks.find(t => t.id === nudge.relatedId);
          if (task) {
            setTaskToReassign(task);
          }
        }
        break;

      case 'extend_deadline':
        if (nudge.relatedId) {
          const task = tasks.find(t => t.id === nudge.relatedId);
          if (task) {
            setTaskToExtend(task);
          }
        }
        break;

      default:
        break;
    }
  }, [decisions, tasks, handleDismissNudge, handleOpenDecisionMission]);

  // Real-time event handlers
  const handleDecisionChange = useCallback(() => {
    loadDecisions();
    setTimeout(() => {
      generateMetrics();
      generateNudges();
    }, 500);
  }, [loadDecisions, generateMetrics, generateNudges]);

  const handleTaskChange = useCallback(() => {
    loadTasks();
    setTimeout(() => {
      generateNudges();
    }, 500);
  }, [loadTasks, generateNudges]);

  const handleVoteChange = useCallback(() => {
    loadDecisions();
    setTimeout(() => {
      generateMetrics();
    }, 500);
  }, [loadDecisions, generateMetrics]);

  const { connectionStatus } = useDecisionTaskRealtime({
    effectiveWorkspaceId,
    decisions,
    onDecisionChange: handleDecisionChange,
    onTaskChange: handleTaskChange,
    onVoteChange: handleVoteChange,
  });

  // Task management handlers
  const handleTaskStatusChange = useCallback(async (taskId: string, newStatus: Task['status']) => {
    try {
      await taskService.updateTaskStatus(taskId, newStatus);
      // Phase 5: when a task moves to done, surface any newly unblocked
      // downstream tasks so the operator knows their queue just opened up.
      if (newStatus === 'done') {
        const unblocked = await dependenciesService.getNewlyUnblockedTasks(taskId, effectiveWorkspaceId);
        if (unblocked.length > 0) {
          const titles = unblocked.slice(0, 2).map((t) => t.title).join(', ');
          const more = unblocked.length > 2 ? `, +${unblocked.length - 2} more` : '';
          toast.success(`Just unblocked: ${titles}${more}`, { duration: 5000 });
        }
      }
      await loadTasks();
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  }, [loadTasks]);

  const handleTaskDelete = useCallback(async (taskId: string) => {
    try {
      await taskService.deleteTask(taskId);
      await loadTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  }, [loadTasks]);

  const handleTaskEdit = useCallback((task: Task) => {
    setTaskToEdit(task);
  }, []);

  // Bulk selection handlers
  const handleToggleTaskSelect = useCallback((taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedTaskIds(new Set());
  }, []);

  const handleBulkStatusChange = useCallback(async (newStatus: Task['status']) => {
    try {
      await Promise.all(
        Array.from(selectedTaskIds).map(id => taskService.updateTaskStatus(id, newStatus))
      );
      setSelectedTaskIds(new Set());
      await loadTasks();
    } catch (error) {
      console.error('Failed to bulk update tasks:', error);
    }
  }, [selectedTaskIds, loadTasks]);

  const handleBulkDelete = useCallback(async () => {
    // First click: arm the confirmation state and auto-disarm after 4s.
    if (!confirmingBulkDelete) {
      setConfirmingBulkDelete(true);
      window.setTimeout(() => setConfirmingBulkDelete(false), 4000);
      return;
    }
    // Second click within the window: execute.
    setConfirmingBulkDelete(false);
    try {
      await Promise.all(
        Array.from(selectedTaskIds).map(id => taskService.deleteTask(id))
      );
      const count = selectedTaskIds.size;
      setSelectedTaskIds(new Set());
      await loadTasks();
      toast.success(`${count} task${count > 1 ? 's' : ''} deleted.`, { duration: 2500 });
    } catch (error) {
      console.error('Failed to bulk delete tasks:', error);
      toast.error('Some tasks could not be deleted. Try again.', { duration: 4000 });
    }
  }, [confirmingBulkDelete, selectedTaskIds, loadTasks]);

  const handleTaskSave = useCallback(async (taskId: string, updates: Partial<Task>) => {
    try {
      await taskService.updateTask(taskId, updates);
      await loadTasks();
      setTaskToEdit(null);
    } catch (error) {
      console.error('Failed to save task:', error);
      throw error;
    }
  }, [loadTasks]);

  const handleTaskCreate = useCallback(async (newTask: Partial<Task>) => {
    try {
      await taskService.createTask({
        workspace_id: newTask.workspace_id!,
        title: newTask.title!,
        description: newTask.description,
        priority: newTask.priority,
        assignee_id: newTask.assignee_id,
        deadline: newTask.deadline,
        status: newTask.status,
        metadata: newTask.metadata
      });
      await loadTasks();
      setShowCreateTask(false);
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }, [loadTasks]);

  // Archive handlers
  const handleTaskReopen = useCallback(async (taskId: string) => {
    try {
      await taskService.reopenTask(taskId);
      await loadTasks();
    } catch (error) {
      console.error('Failed to reopen task:', error);
    }
  }, [loadTasks]);

  const handleDecisionReopen = useCallback(async (decisionId: string) => {
    try {
      await decisionService.reopenDecision(decisionId);
      await loadDecisions();
    } catch (error) {
      console.error('Failed to reopen decision:', error);
    }
  }, [loadDecisions]);

  // Handle decision decomposition
  const handleOpenDecomposer = useCallback((decision: DecisionWithVotes) => {
    setDecisionToDecompose(decision);
  }, []);

  // Handle wizard submit. Creates a decision row + linked task rows. When
  // saveAsTemplate is set, also writes a row to decision_templates so the
  // operator can re-run the wizard from that saved template later.
  const handleWizardSubmit = useCallback(async (output: import('./wizard/types').WizardOutput) => {
    try {
      const newDecision = await decisionService.createDecision({
        workspace_id: output.decision.workspace_id,
        title: output.decision.title,
        description: output.decision.description,
        decision_type: output.decision.decision_type as any,
        proposed_by: output.decision.proposed_by,
      });

      // Phase 2: log decision creation to the activity feed.
      if (newDecision) {
        const meta = output.decision.metadata as { frame_id?: string; step2?: Record<string, unknown>; step4?: { decideByDate?: string | null; retrospectiveDays?: number } } | undefined;
        const frameId = meta?.frame_id;
        await decisionActivityService.logDecisionEvent({
          decisionId: newDecision.id,
          workspaceId: output.decision.workspace_id,
          userId: output.decision.proposed_by || null,
          action: 'created',
          newValue: output.decision.title,
          metadata: { frame_id: frameId },
        });

        // Phase 4: write structured-context columns derived from frame inputs.
        if (frameId && meta?.step2) {
          const ctx = extractDecisionContext(frameId, meta.step2);
          await decisionContextService.updateContext(newDecision.id, {
            criteria: ctx.criteria,
            options: ctx.options,
            stakeholders: ctx.stakeholders,
            decideByDate: meta.step4?.decideByDate ?? null,
            frameId,
          });
        }
      }

      if (output.tasks.length > 0 && newDecision) {
        for (const task of output.tasks) {
          await taskService.createTask({
            workspace_id: task.workspace_id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            deadline: task.deadline,
            status: task.status,
            assignee_id: task.assignee_id,
            metadata: {
              ...(task.metadata ?? {}),
              linked_decision: newDecision.id,
            },
          });
        }
      }

      // Attach the wizard's optional venue to the new decision via the
      // universal Place schema. Failure is logged but non-fatal: the
      // decision and tasks already exist; the operator can pick a place
      // later from the activity drawer.
      if (output.venue && newDecision) {
        try {
          const place = await createPlace({
            lat: output.venue.lat,
            lng: output.venue.lng,
            address: output.venue.address,
            name: output.venue.name,
            type: 'venue',
          });
          await attachPlaceToEntity('decision', newDecision.id, place.id, 'venue');
        } catch (placeErr) {
          console.error('Wizard venue attach failed:', placeErr);
        }
      }

      // Optional: persist the wizard state as a reusable template.
      if (output.saveAsTemplate && newDecision) {
        const { decisionTemplateService } = await import('../../services/decisionTemplateService');
        await decisionTemplateService.saveWizardAsTemplate({
          workspaceId: effectiveWorkspaceId,
          userId: user?.id || '',
          templateName: output.saveAsTemplate.name,
          description: output.saveAsTemplate.description,
          config: output.saveAsTemplate.config,
          sharedWithWorkspace: output.saveAsTemplate.sharedWithWorkspace,
          titleTemplate: output.decision.title,
          descriptionTemplate: output.decision.description,
          suggestedTasks: output.tasks.map(t => ({
            title: t.title,
            description: t.description,
            priority: t.priority,
            deadline_offset_days: t.deadline ? Math.round(
              (new Date(t.deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
            ) : undefined,
          })),
          defaultDecisionType: output.decision.decision_type,
          category: output.saveAsTemplate.config.frameId,
        });
      }

      await Promise.all([loadDecisions(), loadTasks()]);
    } catch (error) {
      console.error('Error creating decision from wizard:', error);
      throw error;
    }
  }, [effectiveWorkspaceId, user, loadDecisions, loadTasks]);

  const handleDecompositionComplete = useCallback(async (tasks: Partial<Task>[], brief: string) => {
    if (!decisionToDecompose) return;

    try {
      for (const taskData of tasks) {
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
            decision_title: decisionToDecompose.title
          }
        });
      }

      await decisionService.updateDecision(decisionToDecompose.id, {
        brief,
        tasks_generated_at: new Date().toISOString()
      });

      await Promise.all([loadTasks(), loadDecisions()]);
      setDecisionToDecompose(null);
    } catch (error) {
      console.error('Failed to create tasks from decomposition:', error);
      throw error;
    }
  }, [decisionToDecompose, loadTasks, loadDecisions]);

  const handlePrioritizationComplete = useCallback((prioritized: AITaskPriority[]) => {
    setAiPriorities(prioritized);

    const updatedTasks = tasks.map(task => {
      const aiData = prioritized.find(p => p.taskId === task.id);
      if (aiData) {
        return {
          ...task,
          metadata: {
            ...task.metadata,
            ai_priority_score: aiData.aiScore,
            ai_suggested_assignee: aiData.suggestedAssignee,
            ai_predicted_duration: aiData.predictedDuration
          }
        };
      }
      return task;
    });

    setTasks(updatedTasks);
  }, [tasks]);

  // Reassign task handler
  const handleReassignTask = useCallback(async (taskId: string, newAssignee: string) => {
    try {
      await taskService.updateTask(taskId, { assignee_id: newAssignee });
      await loadTasks();
      setTaskToReassign(null);
    } catch (error) {
      console.error('Failed to reassign task:', error);
      throw error;
    }
  }, [loadTasks]);

  // Extend deadline handler
  const handleExtendDeadline = useCallback(async (taskId: string, newDeadline: string) => {
    try {
      await taskService.updateTask(taskId, { deadline: newDeadline });
      await loadTasks();
      setTaskToExtend(null);
    } catch (error) {
      console.error('Failed to extend deadline:', error);
      throw error;
    }
  }, [loadTasks]);

  const handleMissionSendMessage = useCallback(async (message: string) => {
    const userMessage: AIMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      created_at: new Date().toISOString()
    };
    setMissionMessages(prev => [...prev, userMessage]);
    setMissionLoading(true);

    try {
      const response = await ragService.chat(
        message,
        [],
        '',
        (logs) => {
          setMissionThinkingLogs(new Map([[userMessage.id, logs]]));
        }
      );

      const aiMessage: AIMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: response,
        created_at: new Date().toISOString()
      };
      setMissionMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      // Surface cap / trial / provider issues via toast + upgrade CTA.
      // On handled errors skip appending a generic error bubble — the toast
      // is already showing the user what happened.
      const handled = handleAIError(error);
      if (!handled) {
        const errorMessage: AIMessage = {
          id: `msg-${Date.now()}-error`,
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
          created_at: new Date().toISOString()
        };
        setMissionMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setMissionLoading(false);
    }
  }, [user, handleAIError]);

  const handleDecisionAction = useCallback((decision: DecisionWithVotes, action: string) => {
    if (action === 'generate-tasks') {
      handleOpenDecomposer(decision);
    } else if (action.startsWith('vote-')) {
      handleVote();
    }
  }, [handleOpenDecomposer, handleVote]);

  // Filter tasks based on FilterState
  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    // Apply priority filter
    if (filters.priority) {
      filtered = filtered.filter(t => t.priority === filters.priority);
    }

    // Apply place filter — null asks for tasks without any place; a string
    // asks for tasks attached to that exact place_id.
    if (filters.placeId !== undefined) {
      filtered = filtered.filter(t => {
        const taskPlaceId = taskPlaceMap[t.id];
        if (filters.placeId === null) return !taskPlaceId;
        return taskPlaceId === filters.placeId;
      });
    }

    return filtered;
  }, [tasks, filters, taskPlaceMap]);

  // Filter decisions based on FilterState
  const filteredDecisions = useMemo(() => {
    let filtered = decisions;

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(d =>
        d.title.toLowerCase().includes(searchLower) ||
        d.description?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [decisions, filters]);

  // Pre-compute linked task counts per decision to avoid N+1 queries in cards
  const linkedTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      const decisionId = task.metadata?.decision_id || task.metadata?.generated_from_decision;
      if (decisionId) {
        counts[decisionId] = (counts[decisionId] || 0) + 1;
      }
    }
    return counts;
  }, [tasks]);

  // Computed values
  const urgentNudges = useMemo(
    () => nudges.filter(n => n.priority === 'urgent'),
    [nudges]
  );

  const importantNudges = useMemo(
    () => nudges.filter(n => n.priority === 'important'),
    [nudges]
  );

  const suggestionNudges = useMemo(
    () => nudges.filter(n => n.priority === 'suggestion'),
    [nudges]
  );

  return (
    <div className="decision-task-hub">
      {/* Header with mode switcher */}
      <HubHeader
        mode={mode}
        onModeChange={setMode}
        onRefresh={handleRefresh}
        actions={
          <>
            {connectionStatus === 'error' && <RealTimeIndicator status={connectionStatus} />}
            {nudges.length > 0 && (
              <button
                type="button"
                className="hub-action-button notification-badge"
                onClick={() => setShowNudges(!showNudges)}
                aria-label={`${nudges.length} notifications`}
                title="Alerts & Nudges"
              >
                <Bell size={18} aria-hidden="true" />
                <span className="badge-count">{nudges.length}</span>
              </button>
            )}
            <button
              type="button"
              className="hub-action-button"
              onClick={() => setActivityPanelOpen(true)}
              aria-label="Open workspace activity"
              title="Activity"
            >
              <Activity size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hub-action-button"
              onClick={handleExportCSV}
              aria-label="Export to CSV"
              title="Export CSV"
            >
              <Download size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hub-action-button"
              onClick={handleToggleAssistant}
              aria-label="Toggle AI Assistant"
              title="AI Assistant"
            >
              <Bot size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hub-action-button"
              onClick={() => setWizardOpen({})}
              aria-label="Open decision wizard"
              title="New decision (templates)"
            >
              <LayoutTemplate size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hub-action-button primary"
              onClick={() => setShowCreateTask(true)}
              aria-label="Create new task"
              title="Create task (C)"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          </>
        }
      />

      {/* Alerts Panel - Slide-down Dropdown */}
      {nudges.length > 0 && showNudges && (
        <AlertsPanel
          nudges={nudges}
          onDismiss={handleDismissNudge}
          onDismissAll={handleDismissAllNudges}
          onAction={handleNudgeAction}
          onClose={() => setShowNudges(false)}
          onSnooze={(id, minutes) => {
            snoozeNudge(id, minutes);
            setNudges(prev => prev.filter(n => n.id !== id));
          }}
        />
      )}

      {/* Filter Bar */}
      <FilterBar filters={filters} onChange={setFilters} availablePlaces={availablePlaces} />

      {/* Bulk Action Toolbar */}
      {selectedTaskIds.size > 0 && (
        <div className="hub-bulk-toolbar">
          <span className="hub-bulk-count">
            <CheckSquare size={16} />
            {selectedTaskIds.size} selected
          </span>
          <div className="hub-bulk-actions">
            <div className="hub-bulk-status-dropdown">
              <button
                type="button"
                className="hub-bulk-status-trigger"
                onClick={() => setBulkStatusOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={bulkStatusOpen}
                aria-label="Change status of selected tasks"
              >
                <span>Change status</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {bulkStatusOpen && (
                <>
                  <div
                    className="hub-bulk-status-backdrop"
                    onClick={() => setBulkStatusOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    className="hub-bulk-status-menu"
                    role="menu"
                    aria-label="Status options"
                  >
                    {([
                      { value: 'todo' as const,         label: 'To Do',       color: 'var(--dt-status-todo)' },
                      { value: 'in_progress' as const,  label: 'In Progress', color: 'var(--dt-status-in-progress)' },
                      { value: 'in_review' as const,    label: 'In Review',   color: 'var(--dt-status-in-review)' },
                      { value: 'done' as const,         label: 'Done',        color: 'var(--dt-status-done)' },
                      { value: 'cancelled' as const,    label: 'Cancelled',   color: 'var(--dt-status-cancelled)' },
                    ]).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitem"
                        className="hub-bulk-status-item"
                        onClick={() => {
                          handleBulkStatusChange(option.value);
                          setBulkStatusOpen(false);
                        }}
                      >
                        <span
                          className="hub-bulk-status-dot"
                          style={{ background: option.color }}
                          aria-hidden="true"
                        />
                        <span className="dt-label">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              className={`hub-bulk-delete${confirmingBulkDelete ? ' is-confirming' : ''}`}
              onClick={handleBulkDelete}
              title={confirmingBulkDelete ? 'Click again to confirm' : 'Delete selected tasks'}
              aria-pressed={confirmingBulkDelete}
            >
              <Trash2 size={16} />
              {confirmingBulkDelete ? `Confirm delete (${selectedTaskIds.size})` : 'Delete'}
            </button>
            <button
              type="button"
              className="hub-bulk-clear"
              onClick={handleClearSelection}
              title="Clear selection"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="hub-content">
        {/* Skeleton loading states */}
        {(decisionsLoading || tasksLoading) && (
          <div className="hub-loading-skeletons">
            {[...Array(3)].map((_, i) => (
              <SkeletonDecisionCard key={`skel-d-${i}`} />
            ))}
            {[...Array(4)].map((_, i) => (
              <SkeletonTaskCard key={`skel-t-${i}`} />
            ))}
          </div>
        )}

        {!decisionsLoading && !tasksLoading && mode === 'active' && (
          <>
            {user?.id && (
              <DueRetrospectiveBanner
                workspaceId={effectiveWorkspaceId}
                userId={user.id}
              />
            )}
            <ActivitySummaryStrip
              workspaceId={effectiveWorkspaceId}
              onOpenWorkspaceActivity={() => setActivityPanelOpen(true)}
            />
            <ActiveView
              decisions={filteredDecisions}
              tasks={filteredTasks}
              currentUserId={user?.id}
              workspaceId={effectiveWorkspaceId}
              linkedTaskCounts={linkedTaskCounts}
              selectedTaskIds={selectedTaskIds}
              onToggleTaskSelect={handleToggleTaskSelect}
              onStatusChange={handleTaskStatusChange}
              onDelete={handleTaskDelete}
              onEdit={handleTaskEdit}
              onDecisionAction={handleDecisionAction}
              onOpenTemplates={() => setWizardOpen({})}
              onOpenAIMission={() => handleOpenDecisionMission()}
            />
          </>
        )}
        {!decisionsLoading && !tasksLoading && mode === 'board' && (
          <BoardView
            decisions={filteredDecisions}
            tasks={filteredTasks}
            filters={filters}
            currentUserId={user?.id || ''}
            workspaceId={effectiveWorkspaceId}
            linkedTaskCounts={linkedTaskCounts}
            onTaskStatusChange={handleTaskStatusChange}
            onDecisionStatusChange={async (decisionId, newStatus) => {
              try {
                const previous = decisions.find((d) => d.id === decisionId);
                await decisionService.updateDecision(decisionId, { status: newStatus });
                // Phase 2: log status change + the decided event for the
                // weekly rollup. Fire-and-forget; activity logging shouldn't
                // block the UX.
                decisionActivityService.logDecisionEvent({
                  decisionId,
                  workspaceId: effectiveWorkspaceId,
                  userId: user?.id || null,
                  action: 'status_changed',
                  oldValue: previous?.status ?? null,
                  newValue: newStatus,
                });
                if (newStatus === 'decided') {
                  decisionActivityService.logDecisionEvent({
                    decisionId,
                    workspaceId: effectiveWorkspaceId,
                    userId: user?.id || null,
                    action: 'decided',
                  });
                  // Phase 4: schedule the retrospective prompt now that the
                  // decision is decided. Pull the delay from the original
                  // wizard step4 stored on the decision metadata.
                  const meta = previous?.metadata as { step4?: { retrospectiveDays?: number } } | undefined;
                  const days = meta?.step4?.retrospectiveDays ?? 0;
                  if (days > 0 && user?.id) {
                    decisionContextService.scheduleRetrospective({
                      decisionId,
                      workspaceId: effectiveWorkspaceId,
                      userId: user.id,
                      delayDays: days,
                    });
                  }
                }
                loadDecisions();
              } catch (error) {
                console.error('Error updating decision status:', error);
              }
            }}
            onDecisionDecompose={setDecisionToDecompose}
            onTaskDelete={handleTaskDelete}
            onTaskEdit={handleTaskEdit}
          />
        )}
        {!decisionsLoading && !tasksLoading && mode === 'archive' && (
          <ArchiveView
            decisions={filteredDecisions}
            tasks={filteredTasks}
            filters={filters}
            onTaskReopen={handleTaskReopen}
            onDecisionReopen={handleDecisionReopen}
          />
        )}

        {/* Load More */}
        {(hasMoreDecisions || hasMoreTasks) && !decisionsLoading && !tasksLoading && (
          <div className="hub-load-more">
            <button
              type="button"
              className="hub-load-more-button"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>

      {/* AI Assistant Sidebar */}
      {showAssistant && user && (
        <AIFeatureErrorBoundary featureName="Conversational AI Assistant">
          <ConversationalAssistant
            user={user}
            decisions={decisions}
            tasks={tasks}
            metrics={metrics}
            onClose={handleCloseAssistant}
            onActionExecute={handleAssistantAction}
          />
        </AIFeatureErrorBoundary>
      )}

      {/* Decision Mission Modal */}
      {showDecisionMission && createPortal(
        <div
          className="decision-mission-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="decision-mission-title"
        >
          <div
            className="decision-mission-overlay"
            onClick={handleCloseMission}
            aria-hidden="true"
          />
          <div className="decision-mission-container">
            <div className="decision-mission-header">
              <h2 id="decision-mission-title">{selectedDecision ? `Decision: ${selectedDecision.title}` : 'Create Decision with AI'}</h2>
              <button
                type="button"
                onClick={handleCloseMission}
                className="close-button"
                title="Close Decision Mission"
                aria-label="Close Decision Mission"
              >
                <X size={20} />
              </button>
            </div>
            <div className="decision-mission-content">
              <DecisionMission
                key="decision-mission-stable"
                messages={missionMessages}
                isLoading={missionLoading}
                thinkingLogs={missionThinkingLogs}
                onSendMessage={handleMissionSendMessage}
                sessionTitle="Decision Mission"
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reassign Task Modal */}
      {taskToReassign && createPortal(
        <ReassignTaskModal
          task={taskToReassign}
          currentAssignee={taskToReassign.assignee_id}
          workspaceMembers={workspaceMembers}
          onClose={() => setTaskToReassign(null)}
          onReassign={handleReassignTask}
        />,
        document.body
      )}

      {/* Extend Deadline Dialog */}
      {taskToExtend && createPortal(
        <ExtendDeadlineDialog
          task={taskToExtend}
          onClose={() => setTaskToExtend(null)}
          onExtend={handleExtendDeadline}
        />,
        document.body
      )}

      {/* Undo Dismiss Snackbar */}
      {lastDismissedNudge && (
        <div className="undo-snackbar">
          <span>Nudge dismissed</span>
          <button
            type="button"
            className="undo-snackbar-button"
            onClick={handleUndoDismiss}
            title="Undo dismiss"
          >
            <Undo size={16} />
            <span>Undo</span>
          </button>
          <button
            type="button"
            className="undo-snackbar-close"
            onClick={() => setLastDismissedNudge(null)}
            title="Close"
            aria-label="Close notification"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Task Edit Modal */}
      {taskToEdit && createPortal(
        <TaskEditModal
          task={taskToEdit}
          onClose={() => setTaskToEdit(null)}
          onSave={handleTaskSave}
          workspaceMembers={workspaceMembers}
        />,
        document.body
      )}

      {/* Create Task Modal */}
      {showCreateTask && createPortal(
        <CreateTaskModal
          workspaceId={effectiveWorkspaceId}
          currentUserId={user?.id || ''}
          onClose={() => setShowCreateTask(false)}
          onCreate={handleTaskCreate}
          workspaceMembers={workspaceMembers}
        />,
        document.body
      )}

      {/* Decision Decomposer Modal */}
      {decisionToDecompose && createPortal(
        <DecisionDecomposer
          decision={decisionToDecompose}
          workspaceId={effectiveWorkspaceId}
          workspaceMembers={workspaceMembers}
          onClose={() => setDecisionToDecompose(null)}
          onTasksGenerated={handleDecompositionComplete}
          apiKey=""
        />,
        document.body
      )}

      {/* Decision Wizard (Phase 1.9) replaces the legacy DecisionTemplates modal. */}
      {wizardOpen !== null && (
        <DecisionWizard
          workspaceId={effectiveWorkspaceId}
          currentUserId={user?.id || ''}
          workspaceMembers={workspaceMembers}
          initialFrameId={wizardOpen.frameId}
          onClose={() => setWizardOpen(null)}
          onSubmit={handleWizardSubmit}
        />
      )}

      {/* Phase 2: workspace-wide activity panel. */}
      {activityPanelOpen && (
        <WorkspaceActivityPanel
          workspaceId={effectiveWorkspaceId}
          workspaceMembers={workspaceMembers}
          onOpenItem={openItemDrawer}
          onClose={() => setActivityPanelOpen(false)}
        />
      )}

      {/* Phase 3: per-item activity + comments drawer. */}
      {itemDrawer && (
        <ActivityDrawer
          source={itemDrawer.source}
          itemId={itemDrawer.itemId}
          itemTitle={itemDrawer.itemTitle}
          workspaceId={effectiveWorkspaceId}
          currentUserId={user?.id || ''}
          workspaceMembers={workspaceMembers}
          onClose={() => setItemDrawer(null)}
        />
      )}

      {/* AI Task Prioritizer - Overlay Panel */}
      <AIFeatureErrorBoundary featureName="AI Task Prioritizer">
        {showPrioritizer && tasks.length > 0 && createPortal(
          <AITaskPrioritizer
            tasks={filteredTasks}
            onPrioritizationComplete={handlePrioritizationComplete}
            onClose={() => setShowPrioritizer(false)}
          />,
          document.body
        )}
      </AIFeatureErrorBoundary>
    </div>
  );
};
