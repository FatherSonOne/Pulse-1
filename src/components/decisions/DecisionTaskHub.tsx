import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
import { DecisionTemplates } from './DecisionTemplates';
import { decisionService, DecisionWithVotes } from '../../services/decisionService';
import { taskService, Task } from '../../services/taskService';
import { decisionAnalyticsService, DecisionMetrics } from '../../services/decisionAnalyticsService';
import { proactiveSuggestionsService, Nudge } from '../../services/proactiveSuggestionsService';
import { taskIntelligenceService, AITaskPriority } from '../../services/taskIntelligenceService';
import { ragService, AIMessage, ThinkingStep } from '../../services/ragService';
import { useAIErrorHandler } from '../../hooks/useAIErrorHandler';
import { DecisionMission } from '../WarRoom/missions/DecisionMission';
import { ConversationalAssistant } from './ConversationalAssistant';
import { AlertsPanel } from './AlertsPanel';
import { RealTimeIndicator, ConnectionStatus } from './RealTimeIndicator';
import { ReassignTaskModal } from './ReassignTaskModal';
import { ExtendDeadlineDialog } from './ExtendDeadlineDialog';
import { User } from '../../types';
import { supabase } from '../../services/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
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

  // Filter state - unified using FilterBar's FilterState
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    priority: undefined,
    dateRange: undefined,
  });

  // AI features state
  const [metrics, setMetrics] = useState<DecisionMetrics | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(new Set());
  const [showNudges, setShowNudges] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [lastDismissedNudge, setLastDismissedNudge] = useState<string | null>(null);

  // Real-time state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

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

  // Templates state
  const [showTemplates, setShowTemplates] = useState(false);

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

  // Real-time subscriptions for decisions, tasks, and votes
  useEffect(() => {
    if (!effectiveWorkspaceId) return;

    setConnectionStatus('connecting');

    // Subscribe to decisions changes
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
        (payload) => {
          handleDecisionChange(payload);
        }
      )
      .subscribe((status) => {
        updateConnectionStatus(status);
      });

    // Subscribe to tasks changes
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
        (payload) => {
          handleTaskChange(payload);
        }
      )
      .subscribe((status) => {
        updateConnectionStatus(status);
      });

    // Subscribe to decision_votes changes (filtered to decisions in this workspace)
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
        (payload) => {
          handleVoteChange(payload);
        }
      )
      .subscribe((status) => {
        updateConnectionStatus(status);
      });

    // Cleanup on unmount
    return () => {
      decisionsChannel.unsubscribe();
      tasksChannel.unsubscribe();
      votesChannel.unsubscribe();
      setConnectionStatus('disconnected');
    };
  }, [effectiveWorkspaceId]);

  // Modal Escape key handling
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
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
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showDecisionMission, showAssistant, showPrioritizer, taskToReassign, taskToExtend]);

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
        alert(`📧 Send reminder for: ${nudge.relatedTitle}\n\nThis feature will send notifications to stakeholders.`);
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
  const updateConnectionStatus = useCallback((status: string) => {
    if (status === 'SUBSCRIBED') {
      setConnectionStatus('connected');
    } else if (status === 'CHANNEL_ERROR') {
      setConnectionStatus('error');
    } else if (status === 'CLOSED') {
      setConnectionStatus('disconnected');
    }
  }, []);

  const handleDecisionChange = useCallback((payload: any) => {
    loadDecisions();
    setTimeout(() => {
      generateMetrics();
      generateNudges();
    }, 500);
  }, [loadDecisions, generateMetrics, generateNudges]);

  const handleTaskChange = useCallback((payload: any) => {
    loadTasks();
    setTimeout(() => {
      generateNudges();
    }, 500);
  }, [loadTasks, generateNudges]);

  const handleVoteChange = useCallback((payload: any) => {
    loadDecisions();
    setTimeout(() => {
      generateMetrics();
    }, 500);
  }, [loadDecisions, generateMetrics]);

  // Task management handlers
  const handleTaskStatusChange = useCallback(async (taskId: string, newStatus: Task['status']) => {
    try {
      await taskService.updateTaskStatus(taskId, newStatus);
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
    if (!window.confirm(`Delete ${selectedTaskIds.size} selected task${selectedTaskIds.size > 1 ? 's' : ''}?`)) return;
    try {
      await Promise.all(
        Array.from(selectedTaskIds).map(id => taskService.deleteTask(id))
      );
      setSelectedTaskIds(new Set());
      await loadTasks();
    } catch (error) {
      console.error('Failed to bulk delete tasks:', error);
    }
  }, [selectedTaskIds, loadTasks]);

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

  // Handle template selection
  const handleTemplateSelect = useCallback(async (template: any, variables: any) => {
    try {
      const applied = await import('../../services/decisionTemplateService').then(m =>
        m.decisionTemplateService.applyTemplate(template, variables)
      );

      const newDecision = await decisionService.createDecision({
        workspace_id: effectiveWorkspaceId,
        title: applied.title,
        description: applied.description,
        decision_type: applied.decision_type as any,
        proposed_by: user?.id || '',
      });

      if (applied.suggested_tasks && applied.suggested_tasks.length > 0 && newDecision) {
        for (const task of applied.suggested_tasks) {
          const deadline = task.deadline_offset_days
            ? new Date(Date.now() + task.deadline_offset_days * 24 * 60 * 60 * 1000).toISOString()
            : undefined;

          await taskService.createTask({
            workspace_id: effectiveWorkspaceId,
            title: task.title,
            description: task.description,
            priority: task.priority || 'medium',
            deadline,
            status: 'todo',
            metadata: {
              generated_from_template: template.id,
              linked_decision: newDecision.id
            }
          });
        }
      }

      await Promise.all([loadDecisions(), loadTasks()]);
      setShowTemplates(false);
    } catch (error) {
      console.error('Error creating decision from template:', error);
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

    return filtered;
  }, [tasks, filters]);

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
              <span className="action-label">AI</span>
            </button>
            <button
              type="button"
              className="hub-action-button"
              onClick={() => setShowTemplates(true)}
              aria-label="Use decision template"
              title="Use Template"
            >
              <Sparkles size={18} aria-hidden="true" />
              <span className="action-label">Templates</span>
            </button>
            <button
              type="button"
              className="hub-action-button primary"
              onClick={() => setShowCreateTask(true)}
              aria-label="Create new task"
              title="Create Task"
            >
              <Plus size={18} aria-hidden="true" />
              <span className="action-label">Create</span>
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
      <FilterBar filters={filters} onChange={setFilters} />

      {/* Bulk Action Toolbar */}
      {selectedTaskIds.size > 0 && (
        <div className="hub-bulk-toolbar">
          <span className="hub-bulk-count">
            <CheckSquare size={16} />
            {selectedTaskIds.size} selected
          </span>
          <div className="hub-bulk-actions">
            <select
              className="hub-bulk-status-select"
              defaultValue=""
              aria-label="Bulk change task status"
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusChange(e.target.value as Task['status']);
                  e.target.value = '';
                }
              }}
            >
              <option value="" disabled>Change status...</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              type="button"
              className="hub-bulk-delete"
              onClick={handleBulkDelete}
              title="Delete selected tasks"
            >
              <Trash2 size={16} />
              Delete
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
          />
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
                await decisionService.updateDecision(decisionId, { status: newStatus });
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

      {/* Decision Templates Modal */}
      {showTemplates && createPortal(
        <DecisionTemplates
          workspaceId={effectiveWorkspaceId}
          onClose={() => setShowTemplates(false)}
          onSelectTemplate={handleTemplateSelect}
        />,
        document.body
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
