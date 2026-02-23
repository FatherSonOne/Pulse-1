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
import { DecisionMission } from '../WarRoom/missions/DecisionMission';
import { ConversationalAssistant } from './ConversationalAssistant';
import { RealTimeIndicator, ConnectionStatus } from './RealTimeIndicator';
import { ReassignTaskModal } from './ReassignTaskModal';
import { ExtendDeadlineDialog } from './ExtendDeadlineDialog';
import { User } from '../../types';
import { supabase } from '../../services/supabase';
import {
  getDismissedNudges,
  dismissNudge,
  dismissMultipleNudges,
  undoDismissNudge,
} from '../../utils/dismissedNudgesStorage';
import {
  Plus,
  RefreshCw,
  Bell,
  Bot,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Zap,
  Undo,
  Download,
  Sparkles,
  TrendingUp,
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
  // Core state
  const [mode, setMode] = useState<HubMode>('active');
  const [decisions, setDecisions] = useState<DecisionWithVotes[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
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
  const [showInsights, setShowInsights] = useState(false);
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

  // Use user.id as workspace_id if not provided
  const effectiveWorkspaceId = workspaceId || user?.id || '';

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

  // Generate metrics and nudges when data changes
  useEffect(() => {
    if (decisions.length > 0) {
      generateMetrics();
    }
    if (decisions.length > 0 || tasks.length > 0) {
      generateNudges();
    }
  }, [decisions, tasks]);

  // Real-time subscriptions for decisions, tasks, and votes
  useEffect(() => {
    if (!effectiveWorkspaceId) return;

    console.log('🔄 Setting up real-time subscriptions for workspace:', effectiveWorkspaceId);
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
          console.log('📊 Decision change detected:', payload);
          handleDecisionChange(payload);
        }
      )
      .subscribe((status) => {
        console.log('Decisions channel status:', status);
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
          console.log('✅ Task change detected:', payload);
          handleTaskChange(payload);
        }
      )
      .subscribe((status) => {
        console.log('Tasks channel status:', status);
        updateConnectionStatus(status);
      });

    // Subscribe to decision_votes changes
    const votesChannel = supabase
      .channel('votes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'decision_votes'
        },
        (payload) => {
          console.log('🗳️ Vote change detected:', payload);
          handleVoteChange(payload);
        }
      )
      .subscribe((status) => {
        console.log('Votes channel status:', status);
        updateConnectionStatus(status);
      });

    // Cleanup on unmount
    return () => {
      console.log('🔌 Cleaning up real-time subscriptions');
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
      console.log('🔍 Loading decisions for workspace:', effectiveWorkspaceId);
      const allDecisions = await decisionService.getWorkspaceDecisions(effectiveWorkspaceId);
      console.log('✅ Loaded decisions:', allDecisions.length, allDecisions);

      setDecisions(allDecisions);

      // Update selectedDecision if it exists to maintain reference
      setSelectedDecision(prev => {
        if (!prev) return null;
        const updated = allDecisions.find(d => d.id === prev.id);
        return updated || prev;
      });
    } catch (error) {
      console.error('❌ Failed to load decisions:', error);
      setDecisions([]);
    } finally {
      setDecisionsLoading(false);
    }
  }, [effectiveWorkspaceId]);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      console.log('🔍 Loading tasks for workspace:', effectiveWorkspaceId);
      const allTasks = await taskService.getWorkspaceTasks(effectiveWorkspaceId);
      console.log('✅ Loaded tasks:', allTasks.length, allTasks);
      setTasks(allTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [effectiveWorkspaceId]);

  const generateMetrics = useCallback(async () => {
    try {
      console.log('🔢 Generating metrics from decisions:', decisions.length);
      const calculatedMetrics = await decisionAnalyticsService.calculateDecisionVelocity(decisions);
      console.log('📊 Metrics generated:', calculatedMetrics);
      setMetrics(calculatedMetrics);
    } catch (error) {
      console.error('❌ Failed to generate metrics:', error);
    }
  }, [decisions]);

  const generateNudges = useCallback(async () => {
    if (!user) return;

    try {
      console.log('🔔 Generating nudges from:', decisions.length, 'decisions and', tasks.length, 'tasks');
      const apiKey = localStorage.getItem('gemini_api_key') ||
                     import.meta.env.VITE_GEMINI_API_KEY ||
                     import.meta.env.VITE_API_KEY ||
                     '';
      const generatedNudges = await proactiveSuggestionsService.generateNudges(
        decisions,
        tasks,
        user,
        apiKey
      );

      console.log('📌 Generated nudges:', generatedNudges.length);
      const activeNudges = generatedNudges.filter(n => !dismissedNudges.has(n.id));
      console.log('✅ Active nudges after filtering:', activeNudges.length);
      setNudges(activeNudges);
    } catch (error) {
      console.error('❌ Failed to generate nudges:', error);
    }
  }, [user, decisions, tasks, dismissedNudges]);

  const handleVote = useCallback(() => {
    loadDecisions();
  }, [loadDecisions]);

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

  const handleToggleInsights = useCallback(() => {
    setShowInsights(prev => !prev);
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
        d.deadline ? new Date(d.deadline).toLocaleDateString() : 'N/A'
      ]),
      ...tasks.map(t => [
        'Task',
        `"${t.title.replace(/"/g, '""')}"`,
        t.status,
        t.priority || 'N/A',
        new Date(t.created_at).toLocaleDateString(),
        t.due_date ? new Date(t.due_date).toLocaleDateString() : 'N/A'
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
    console.log('Assistant action executed:', action);

    switch (action.type) {
      case 'create_decision':
        handleOpenDecisionMission();
        break;
      case 'update_task':
        loadTasks();
        break;
      case 'send_reminder':
        console.log('Send reminder:', action.data);
        break;
      default:
        console.log('Unknown action type:', action.type);
    }
  }, [handleOpenDecisionMission, loadTasks]);

  // Enhanced nudge action handlers
  const handleNudgeAction = useCallback(async (nudge: Nudge) => {
    console.log('Handle nudge action:', nudge);

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
        console.log('Unknown action type:', nudge.actionType);
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
    console.log('📊 Processing decision change:', payload.eventType);
    loadDecisions();
    setTimeout(() => {
      generateMetrics();
      generateNudges();
    }, 500);
  }, [loadDecisions, generateMetrics, generateNudges]);

  const handleTaskChange = useCallback((payload: any) => {
    console.log('✅ Processing task change:', payload.eventType);
    loadTasks();
    setTimeout(() => {
      generateNudges();
    }, 500);
  }, [loadTasks, generateNudges]);

  const handleVoteChange = useCallback((payload: any) => {
    console.log('🗳️ Processing vote change:', payload.eventType);
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
        created_by: user?.id || '',
        template_id: applied.template_id
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
    const apiKey = user?.gemini_api_key || localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      alert('Please add your Gemini API key in settings to use the Decision Mission.');
      return;
    }

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
        apiKey,
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
      const errorMessage: AIMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        created_at: new Date().toISOString()
      };
      setMissionMessages(prev => [...prev, errorMessage]);
    } finally {
      setMissionLoading(false);
    }
  }, [user]);

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

      {/* AI Insights Dashboard */}
      <AIFeatureErrorBoundary featureName="AI Insights Dashboard">
        {metrics && (
          <div className={`insights-dashboard ${showInsights ? 'expanded' : 'collapsed'}`}>
            <div className="insights-header">
              <button
                className="insights-header-toggle"
                onClick={handleToggleInsights}
                aria-expanded={showInsights}
                aria-label={showInsights ? 'Collapse AI Insights Dashboard' : 'Expand AI Insights Dashboard'}
                style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', flex: 1, textAlign: 'left' }}
              >
                <div className="insights-header-left">
                  <TrendingUp size={20} aria-hidden="true" />
                  <h2>AI Insights Dashboard</h2>
                </div>
              </button>
              <div className="insights-header-right">
                <button
                  onClick={handleRefresh}
                  className="icon-button"
                  aria-label="Refresh insights data"
                  title="Refresh"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                </button>
                <button
                  className="icon-button"
                  onClick={handleToggleInsights}
                  aria-label={showInsights ? 'Collapse insights' : 'Expand insights'}
                >
                  {showInsights ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {showInsights && (
              <div className="insights-content">
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-label">Decision Velocity</div>
                    <div className="metric-value">{metrics.velocityPerWeek}/week</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Avg Resolution Time</div>
                    <div className="metric-value">{metrics.avgTimeToResolution}h</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Participation Rate</div>
                    <div className="metric-value">{metrics.participationRate}%</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Stale Decisions</div>
                    <div className="metric-value warning">{metrics.staleCount}</div>
                  </div>
                </div>

                {metrics.staleCount > 0 && (
                  <div className="attention-section">
                    <h3>
                      <AlertCircle size={18} />
                      Attention Needed
                    </h3>
                    <p>{metrics.staleCount} decisions have no recent activity</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </AIFeatureErrorBoundary>

      {/* Alerts Panel - Slide-down Dropdown */}
      {nudges.length > 0 && showNudges && (
        <div className="alerts-panel-dropdown">
          <div className="alerts-panel-header">
            <div className="alerts-panel-title">
              <Bell size={16} />
              <span>Alerts & Nudges</span>
              <span className="alerts-count-badge">{nudges.length}</span>
            </div>
            <button
              type="button"
              className="alerts-close-button"
              onClick={() => setShowNudges(false)}
              aria-label="Close alerts panel"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="alerts-panel-content">
            {[...urgentNudges, ...importantNudges, ...suggestionNudges].slice(0, 3).map(nudge => {
              const priority = nudge.priority === 'urgent' ? 'urgent' : nudge.priority === 'important' ? 'important' : 'suggestion';
              const icon = priority === 'urgent' ? '🔴' : priority === 'important' ? '🟡' : '🟢';

              return (
                <div key={nudge.id} className={`alert-item ${priority}`}>
                  <div className="alert-priority-indicator">{icon}</div>
                  <div className="alert-content">
                    <div className="alert-message">{nudge.message}</div>
                    {nudge.action && (
                      <button
                        className="alert-action-button"
                        onClick={() => handleNudgeAction(nudge)}
                        aria-label={`${nudge.action} for ${nudge.relatedTitle || 'this item'}`}
                      >
                        {nudge.action}
                      </button>
                    )}
                  </div>
                  <button
                    className="alert-dismiss-button"
                    onClick={() => handleDismissNudge(nudge.id)}
                    aria-label={`Dismiss alert: ${nudge.message}`}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              );
            })}

            {nudges.length > 3 && (
              <div className="alerts-see-all">
                <button
                  type="button"
                  className="see-all-button"
                  onClick={handleDismissAllNudges}
                  aria-label={`See all ${nudges.length} alerts`}
                >
                  See all {nudges.length} alerts
                </button>
                <button
                  type="button"
                  className="dismiss-all-button"
                  onClick={handleDismissAllNudges}
                  aria-label="Dismiss all alerts"
                >
                  Dismiss all
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* Main Content */}
      <div className="hub-content">
        {mode === 'active' && (
          <ActiveView
            decisions={filteredDecisions}
            tasks={filteredTasks}
            currentUserId={user?.id}
            onStatusChange={handleTaskStatusChange}
            onDelete={handleTaskDelete}
            onEdit={handleTaskEdit}
            onDecisionAction={handleDecisionAction}
          />
        )}
        {mode === 'board' && (
          <BoardView
            decisions={filteredDecisions}
            tasks={filteredTasks}
            filters={filters}
            currentUserId={user?.id || ''}
            workspaceId={effectiveWorkspaceId}
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
        {mode === 'archive' && (
          <ArchiveView
            decisions={filteredDecisions}
            tasks={filteredTasks}
            filters={filters}
            onTaskReopen={handleTaskReopen}
            onDecisionReopen={handleDecisionReopen}
          />
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
          workspaceMembers={[]}
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
          workspaceMembers={[]}
        />,
        document.body
      )}

      {/* Decision Decomposer Modal */}
      {decisionToDecompose && createPortal(
        <DecisionDecomposer
          decision={decisionToDecompose}
          workspaceId={effectiveWorkspaceId}
          workspaceMembers={[]}
          onClose={() => setDecisionToDecompose(null)}
          onTasksGenerated={handleDecompositionComplete}
          apiKey={localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY || ''}
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
            apiKey={localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY || ''}
          />,
          document.body
        )}
      </AIFeatureErrorBoundary>
    </div>
  );
};
