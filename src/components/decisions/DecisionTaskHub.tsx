import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { EnhancedDecisionCard } from './EnhancedDecisionCard';
import { TaskList, TaskStatus } from '../TaskList';
import { EnhancedTaskCard } from '../tasks/EnhancedTaskCard';
import { AITaskPrioritizer } from '../tasks/AITaskPrioritizer';
import { TaskKanban } from '../tasks/TaskKanban';
import { SkeletonDecisionCard } from './SkeletonDecisionCard';
import { SkeletonTaskCard } from '../tasks/SkeletonTaskCard';
import { AIFeatureErrorBoundary } from './AIFeatureErrorBoundary';
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
  clearAllDismissedNudges,
} from '../../utils/dismissedNudgesStorage';
import {
  CheckSquare,
  Vote,
  Plus,
  Filter,
  RefreshCw,
  MessageSquare,
  TrendingUp,
  Bell,
  Bot,
  X,
  ChevronDown,
  ChevronUp,
  List as ListIcon,
  Columns,
  Calendar,
  AlertCircle,
  Zap,
  Undo,
  Download,
} from 'lucide-react';
import './DecisionTaskHub.css';

// Phase 3: Custom debounce hook for performance optimization
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

type ViewMode = 'list' | 'kanban' | 'timeline';
type TabType = 'decisions' | 'tasks';

export const DecisionTaskHub: React.FC<DecisionTaskHubProps> = ({
  user,
  workspaceId
}) => {
  // Core state
  const [activeTab, setActiveTab] = useState<TabType>('decisions');
  const [activeView, setActiveView] = useState<ViewMode>('list');
  const [decisions, setDecisions] = useState<DecisionWithVotes[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [aiPriorities, setAiPriorities] = useState<AITaskPriority[]>([]);
  const [showPrioritizer, setShowPrioritizer] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>(undefined);
  const [decisionStatusFilter, setDecisionStatusFilter] = useState<string | undefined>(undefined);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'created' | 'due_date' | 'priority' | 'ai_score'>('created');

  // AI features state
  const [metrics, setMetrics] = useState<DecisionMetrics | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(new Set());
  const [showInsights, setShowInsights] = useState(false); // Phase 1: Hidden by default
  const [showNudges, setShowNudges] = useState(false); // Phase 1: Hidden by default, shown via notification badge
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

  // Sprint 7: Virtualization state
  const [taskListHeight, setTaskListHeight] = useState(600);

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
  }, [effectiveWorkspaceId, decisionStatusFilter]);

  // Generate metrics and nudges when data changes
  useEffect(() => {
    if (decisions.length > 0) {
      generateMetrics();
    }
    if (decisions.length > 0 || tasks.length > 0) {
      generateNudges();
    }
  }, [decisions, tasks]);

  // Sprint 6: Real-time subscriptions for decisions, tasks, and votes
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
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
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

  // Fix 1.1.7: Modal Escape key handling
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

  // Phase 1.1 & 2.4: Prevent background scroll - simple overflow method (no position fixed)
  useEffect(() => {
    const hasAnyOverlay = showDecisionMission || showAssistant || showPrioritizer || taskToReassign !== null || taskToExtend !== null;

    if (hasAnyOverlay) {
      // Simple approach: just hide overflow without manipulating position
      // This prevents scroll jumps that occur with position:fixed approach
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      // Cleanup on unmount
      document.body.style.overflow = '';
    };
  }, [showDecisionMission, showAssistant, showPrioritizer, taskToReassign, taskToExtend]);

  // Phase 2.3: Focus trap for modals (accessibility)
  useEffect(() => {
    const hasModalOpen = showDecisionMission || showAssistant || taskToReassign !== null || taskToExtend !== null;

    if (!hasModalOpen) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      // Get all focusable elements in the modal
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

      // If shift + tab on first element, focus last
      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
      // If tab on last element, focus first
      else if (!e.shiftKey && document.activeElement === lastFocusable) {
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

      // Filter by status if set
      const filtered = decisionStatusFilter
        ? allDecisions.filter(d => d.status === decisionStatusFilter)
        : allDecisions;

      console.log('📊 Filtered decisions:', filtered.length);
      setDecisions(filtered);

      // Update selectedDecision if it exists to maintain reference
      setSelectedDecision(prev => {
        if (!prev) return null;
        const updated = filtered.find(d => d.id === prev.id);
        return updated || prev;
      });
    } catch (error) {
      console.error('❌ Failed to load decisions:', error);
      setDecisions([]);
    } finally {
      setDecisionsLoading(false);
    }
  }, [effectiveWorkspaceId, decisionStatusFilter]);

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
      const apiKey = localStorage.getItem('gemini_api_key') || '';
      const generatedNudges = await proactiveSuggestionsService.generateNudges(
        decisions,
        tasks,
        user,
        apiKey
      );

      console.log('📌 Generated nudges:', generatedNudges.length);
      // Filter out dismissed nudges
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
    if (activeTab === 'decisions') {
      loadDecisions();
    } else {
      loadTasks();
    }
    generateMetrics();
    generateNudges();
  }, [activeTab, loadDecisions, loadTasks, generateMetrics, generateNudges]);

  // Sprint 6: Enhanced dismiss handling with persistence
  const handleDismissNudge = useCallback((nudgeId: string) => {
    dismissNudge(nudgeId);
    setDismissedNudges(prev => new Set(prev).add(nudgeId));
    setNudges(nudges.filter(n => n.id !== nudgeId));
    setLastDismissedNudge(nudgeId);

    // Auto-hide undo notification after 5 seconds
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

    // Regenerate nudges to show the undismissed one
    generateNudges();
  }, [lastDismissedNudge, generateNudges]);

  // Decision Mission handlers (moved here to fix dependency order)
  const handleOpenDecisionMission = useCallback((decision?: DecisionWithVotes) => {
    // Phase 1: No scroll manipulation - sidebar should slide in smoothly without moving the page
    setShowDecisionMission(true);
    setSelectedDecision(decision || null);
    setMissionMessages([]);
    setMissionThinkingLogs(new Map());

    // If opening with an existing decision, add context message
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
    // Phase 1: No scroll manipulation - sidebar should slide in smoothly without moving the page
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

  // Phase 3: CSV Export
  const handleExportCSV = useCallback(() => {
    const filename = `${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;

    if (activeTab === 'decisions') {
      // Export decisions
      const headers = ['Title', 'Type', 'Status', 'Created', 'Deadline', 'Votes Count'];
      const rows = decisions.map(d => [
        `"${d.title.replace(/"/g, '""')}"`,
        d.decision_type,
        d.status,
        new Date(d.created_at).toLocaleDateString(),
        d.deadline ? new Date(d.deadline).toLocaleDateString() : 'N/A',
        d.votes?.length || 0
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      downloadCSV(csv, filename);
    } else {
      // Export tasks
      const headers = ['Title', 'Status', 'Priority', 'Assigned To', 'Due Date', 'Created'];
      const rows = tasks.map(t => [
        `"${t.title.replace(/"/g, '""')}"`,
        t.status,
        t.priority || 'N/A',
        t.assigned_to_name || 'Unassigned',
        t.due_date ? new Date(t.due_date).toLocaleDateString() : 'N/A',
        new Date(t.created_at).toLocaleDateString()
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      downloadCSV(csv, filename);
    }
  }, [activeTab, decisions, tasks]);

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAssistantAction = useCallback((action: { type: string; data: any }) => {
    console.log('Assistant action executed:', action);

    switch (action.type) {
      case 'create_decision':
        handleOpenDecisionMission();
        break;
      case 'update_task':
        // Refresh tasks to show any updates
        loadTasks();
        break;
      case 'send_reminder':
        // TODO: Implement reminder functionality
        console.log('Send reminder:', action.data);
        break;
      default:
        console.log('Unknown action type:', action.type);
    }
  }, [handleOpenDecisionMission, loadTasks]);

  const handleSetListView = useCallback(() => {
    setActiveView('list');
  }, []);

  const handleSetKanbanView = useCallback(() => {
    setActiveView('kanban');
  }, []);

  const handleSetTimelineView = useCallback(() => {
    setActiveView('timeline');
  }, []);

  // Sprint 6: Enhanced nudge action handlers
  const handleNudgeAction = useCallback(async (nudge: Nudge) => {
    console.log('Handle nudge action:', nudge);

    switch (nudge.actionType) {
      case 'send_reminder':
        // TODO: Implement email/notification reminder to stakeholders
        alert(`📧 Send reminder for: ${nudge.relatedTitle}\n\nThis feature will send notifications to stakeholders.`);
        handleDismissNudge(nudge.id);
        break;

      case 'review':
        // Navigate to the decision or task
        if (nudge.type === 'decision_stale' && nudge.relatedId) {
          const decision = decisions.find(d => d.id === nudge.relatedId);
          if (decision) {
            setActiveTab('decisions');
            handleOpenDecisionMission(decision);
          }
        } else {
          setActiveTab(nudge.type.includes('task') ? 'tasks' : 'decisions');
        }
        handleDismissNudge(nudge.id);
        break;

      case 'reassign':
        // Open reassign modal for the related task
        if (nudge.relatedId) {
          const task = tasks.find(t => t.id === nudge.relatedId);
          if (task) {
            setTaskToReassign(task);
          }
        }
        break;

      case 'extend_deadline':
        // Open deadline extension dialog
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

  // Sprint 6: Real-time event handlers
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

    // Reload decisions to get fresh data with votes
    loadDecisions();

    // Regenerate metrics after data changes
    setTimeout(() => {
      generateMetrics();
      generateNudges();
    }, 500);
  }, [effectiveWorkspaceId]);

  const handleTaskChange = useCallback((payload: any) => {
    console.log('✅ Processing task change:', payload.eventType);

    // Reload tasks to get fresh data
    loadTasks();

    // Regenerate nudges after task changes
    setTimeout(() => {
      generateNudges();
    }, 500);
  }, [effectiveWorkspaceId]);

  const handleVoteChange = useCallback((payload: any) => {
    console.log('🗳️ Processing vote change:', payload.eventType);

    // Reload decisions to update vote counts
    loadDecisions();

    // Update metrics
    setTimeout(() => {
      generateMetrics();
    }, 500);
  }, [effectiveWorkspaceId]);

  // Task management handlers
  const handleTaskStatusChange = useCallback(async (taskId: string, newStatus: Task['status']) => {
    try {
      await taskService.updateTaskStatus(taskId, newStatus);
      await loadTasks(); // Reload tasks
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  }, [loadTasks]);

  const handleTaskDelete = useCallback(async (taskId: string) => {
    try {
      await taskService.deleteTask(taskId);
      await loadTasks(); // Reload tasks
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  }, [loadTasks]);

  const handleTaskEdit = useCallback((task: Task) => {
    // TODO: Open task edit modal
    console.log('Edit task:', task);
  }, []);

  const handlePrioritizationComplete = useCallback((prioritized: AITaskPriority[]) => {
    setAiPriorities(prioritized);

    // Update tasks with AI scores in metadata
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

  // Sprint 6: Reassign task handler
  const handleReassignTask = useCallback(async (taskId: string, newAssignee: string) => {
    try {
      await taskService.updateTask(taskId, { assigned_to: newAssignee });
      await loadTasks(); // Reload to get fresh data
      setTaskToReassign(null);
    } catch (error) {
      console.error('Failed to reassign task:', error);
      throw error;
    }
  }, [loadTasks]);

  // Sprint 6: Extend deadline handler
  const handleExtendDeadline = useCallback(async (taskId: string, newDeadline: string) => {
    try {
      await taskService.updateTask(taskId, { due_date: newDeadline });
      await loadTasks(); // Reload to get fresh data
      setTaskToExtend(null);
    } catch (error) {
      console.error('Failed to extend deadline:', error);
      throw error;
    }
  }, [loadTasks]);

  const handleMissionSendMessage = useCallback(async (message: string) => {
    // Use Gemini API key (fallback to environment variable)
    const apiKey = user?.gemini_api_key || localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      alert('Please add your Gemini API key in settings to use the Decision Mission.');
      return;
    }

    // Add user message
    const userMessage: AIMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      created_at: new Date().toISOString()
    };
    setMissionMessages(prev => [...prev, userMessage]);
    setMissionLoading(true);

    try {
      // Call RAG service for AI response
      const response = await ragService.chat(
        message,
        [],
        apiKey,
        (logs) => {
          setMissionThinkingLogs(new Map([[userMessage.id, logs]]));
        }
      );

      // Add AI response
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
  }, []);

  // Filter and sort tasks
  const getFilteredTasks = () => {
    let filtered = tasks;

    if (statusFilter) {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    if (showOverdueOnly) {
      filtered = filtered.filter(t =>
        t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
      );
    }

    // Sort tasks
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'due_date':
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'ai_score':
          const aScore = a.ai_priority_score || 50;
          const bScore = b.ai_priority_score || 50;
          return bScore - aScore;
        case 'created':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return filtered;
  };

  // Sprint 7: Memoized computed values
  const votingCount = useMemo(
    () => decisions.filter(d => d.status === 'voting').length,
    [decisions]
  );

  const overdueCount = useMemo(
    () => tasks.filter(t =>
      t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
    ).length,
    [tasks]
  );

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

  const filteredTasks = useMemo(
    () => getFilteredTasks(),
    [tasks, statusFilter, showOverdueOnly, sortBy]
  );


  // Debug logging
  console.log('🎨 Render state:', {
    metrics,
    nudgesCount: nudges.length,
    decisionsCount: decisions.length,
    tasksCount: tasks.length,
    showInsights,
    showNudges,
    filteredTasks: filteredTasks.length
  });

  return (
    <div className="decision-task-hub">
      {/* Header - Simplified */}
      <div className="hub-header">
        <div className="hub-header-content">
          <h1 className="hub-title">Decisions & Tasks</h1>
          {/* Only show connection indicator if there's an error */}
          {connectionStatus === 'error' && <RealTimeIndicator status={connectionStatus} />}
        </div>
        <div className="hub-header-actions">
          {/* Notification badge for nudges */}
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
            aria-label={`Export ${activeTab} to CSV`}
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
            className="hub-action-button primary"
            onClick={() => handleOpenDecisionMission()}
            aria-label="Create new decision"
            title="Create Decision"
          >
            <Plus size={18} aria-hidden="true" />
            <span className="action-label">Create</span>
          </button>
        </div>
      </div>

      {/* AI Insights Dashboard */}
      <AIFeatureErrorBoundary featureName="AI Insights Dashboard">
        {metrics && (
          <div className={`insights-dashboard ${showInsights ? 'expanded' : 'collapsed'}`}>
            <div className="insights-header">
              <button
                className="insights-header-toggle"
                onClick={handleToggleInsights}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowInsights(!showInsights);
                  }
                }}
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

      {/* Phase 2: Alerts Panel - Slide-down Dropdown */}
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
            {/* Show top 3 nudges by priority */}
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

            {/* See all link if more than 3 */}
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

      {/* Main Content */}
      <div className="hub-main-content">
        {/* View Selector */}
        <div className="view-selector" role="group" aria-label="View mode selection">
          <button
            type="button"
            className={`view-button ${activeView === 'list' ? 'active' : ''}`}
            onClick={handleSetListView}
            aria-label="List view"
            aria-current={activeView === 'list' ? 'true' : 'false'}
            title="List view"
          >
            <ListIcon size={16} aria-hidden="true" />
            <span>List</span>
          </button>
          <button
            type="button"
            className={`view-button ${activeView === 'kanban' ? 'active' : ''}`}
            onClick={handleSetKanbanView}
            disabled={activeTab === 'decisions'}
            aria-label={activeTab === 'decisions' ? 'Kanban view (available for tasks only)' : 'Kanban board view'}
            aria-current={activeView === 'kanban' ? 'true' : 'false'}
            title={activeTab === 'decisions' ? 'Kanban available for tasks only' : 'Kanban board view'}
          >
            <Columns size={16} aria-hidden="true" />
            <span>Kanban</span>
          </button>
          <button
            type="button"
            className={`view-button ${activeView === 'timeline' ? 'active' : ''}`}
            onClick={handleSetTimelineView}
            disabled
            aria-label="Timeline view (coming soon)"
            aria-current={activeView === 'timeline' ? 'true' : 'false'}
            title="Coming soon"
          >
            <Calendar size={16} aria-hidden="true" />
            <span>Timeline</span>
          </button>
          {activeTab === 'tasks' && (
            <button
              type="button"
              className={`view-button ${showPrioritizer ? 'active' : ''}`}
              onClick={handleTogglePrioritizer}
              aria-label="Toggle AI Task Prioritization"
              aria-pressed={showPrioritizer ? 'true' : 'false'}
              title="AI Task Prioritization"
            >
              <Zap size={16} aria-hidden="true" />
              <span>AI Prioritize</span>
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="hub-tabs" role="tablist" aria-label="Decisions and Tasks tabs">
          <button
            type="button"
            className={`tab-button ${activeTab === 'decisions' ? 'active' : ''}`}
            onClick={() => setActiveTab('decisions')}
            role="tab"
            aria-selected={activeTab === 'decisions'}
            aria-label={`Decisions tab${votingCount > 0 ? `, ${votingCount} items need votes` : ''}`}
          >
            <Vote size={18} aria-hidden="true" />
            <span>Decisions</span>
            {votingCount > 0 && (
              <span className="tab-badge" aria-label={`${votingCount} voting`}>{votingCount}</span>
            )}
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
            role="tab"
            aria-selected={activeTab === 'tasks'}
            aria-label={`Tasks tab${overdueCount > 0 ? `, ${overdueCount} overdue` : ''}`}
          >
            <CheckSquare size={18} aria-hidden="true" />
            <span>Tasks</span>
            {overdueCount > 0 && (
              <span className="tab-badge urgent" aria-label={`${overdueCount} overdue`}>{overdueCount}</span>
            )}
          </button>
        </div>

        {/* Filter & Sort Bar */}
        <div className="filter-bar">
          <div className="filter-controls">
            {activeTab === 'decisions' ? (
              <select
                className="filter-select"
                value={decisionStatusFilter || ''}
                onChange={(e) => setDecisionStatusFilter(e.target.value || undefined)}
                aria-label="Filter decisions by status"
              >
                <option value="">All Decisions</option>
                <option value="proposed">Proposed</option>
                <option value="voting">Voting</option>
                <option value="decided">Decided</option>
                <option value="cancelled">Cancelled</option>
              </select>
            ) : (
              <>
                <select
                  className="filter-select"
                  value={statusFilter || ''}
                  onChange={(e) => setStatusFilter(e.target.value as TaskStatus || undefined)}
                  aria-label="Filter tasks by status"
                >
                  <option value="">All Tasks</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select
                  className="filter-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  aria-label="Sort tasks by"
                >
                  <option value="created">Created Date</option>
                  <option value="due_date">Due Date</option>
                  <option value="priority">Manual Priority</option>
                  <option value="ai_score">🤖 AI Priority</option>
                </select>

                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={showOverdueOnly}
                    onChange={(e) => setShowOverdueOnly(e.target.checked)}
                    aria-label="Show overdue tasks only"
                  />
                  <span>Overdue only</span>
                </label>
              </>
            )}
          </div>

          <button
            type="button"
            className="refresh-button"
            onClick={handleRefresh}
            aria-label="Refresh data"
            title="Refresh"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Content Area */}
        <div className="hub-content-area">
          {activeTab === 'decisions' && (
            <div className="decisions-section">
              {decisionsLoading ? (
                <div className="decisions-grid">
                  {[...Array(6)].map((_, i) => (
                    <SkeletonDecisionCard key={`skeleton-decision-${i}`} />
                  ))}
                </div>
              ) : decisions.length === 0 ? (
                <div className="empty-state">
                  <Vote size={64} color="#ccc" />
                  <h3>No decisions found</h3>
                  <p>
                    {decisionStatusFilter
                      ? `No ${decisionStatusFilter} decisions in this workspace`
                      : 'Create a decision to get team input and track decisions'}
                  </p>
                  <button
                    className="empty-state-button"
                    onClick={() => handleOpenDecisionMission()}
                  >
                    <Plus size={18} />
                    Create Your First Decision
                  </button>
                </div>
              ) : (
                <div className="decisions-grid">
                  {decisions.map((decision) => (
                    <EnhancedDecisionCard
                      key={decision.id}
                      decision={decision}
                      currentUserId={user?.id || ''}
                      workspaceId={effectiveWorkspaceId}
                      onVote={handleVote}
                      onOpenMission={handleOpenDecisionMission}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="tasks-section">
              {/* AI Task Prioritizer - Overlay Panel */}
              <AIFeatureErrorBoundary featureName="AI Task Prioritizer">
                {showPrioritizer && tasks.length > 0 && createPortal(
                  <AITaskPrioritizer
                    tasks={filteredTasks}
                    onPrioritizationComplete={handlePrioritizationComplete}
                    onClose={() => setShowPrioritizer(false)}
                    apiKey={localStorage.getItem('gemini_api_key') || ''}
                  />,
                  document.body
                )}
              </AIFeatureErrorBoundary>

              {tasksLoading ? (
                <div className="tasks-list-view">
                  {[...Array(10)].map((_, i) => (
                    <SkeletonTaskCard key={`skeleton-task-${i}`} />
                  ))}
                </div>
              ) : getFilteredTasks().length === 0 ? (
                <div className="empty-state">
                  <CheckSquare size={64} color="#ccc" />
                  <h3>No tasks found</h3>
                  <p>
                    {statusFilter || showOverdueOnly
                      ? 'Try adjusting your filters'
                      : 'Tasks will appear here when created from messages or decisions'}
                  </p>
                </div>
              ) : activeView === 'kanban' ? (
                <TaskKanban
                  tasks={filteredTasks}
                  onStatusChange={handleTaskStatusChange}
                  onDelete={handleTaskDelete}
                  onEdit={handleTaskEdit}
                />
              ) : (
                <div className="tasks-list-view">
                  {filteredTasks.map((task) => (
                    <EnhancedTaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleTaskStatusChange}
                      onDelete={handleTaskDelete}
                      onEdit={handleTaskEdit}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Phase 2: AI Assistant Sidebar with Metrics */}
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

      {/* Sprint 6: Reassign Task Modal */}
      {taskToReassign && createPortal(
        <ReassignTaskModal
          task={taskToReassign}
          currentAssignee={taskToReassign.assigned_to}
          onClose={() => setTaskToReassign(null)}
          onReassign={handleReassignTask}
        />,
        document.body
      )}

      {/* Sprint 6: Extend Deadline Dialog */}
      {taskToExtend && createPortal(
        <ExtendDeadlineDialog
          task={taskToExtend}
          onClose={() => setTaskToExtend(null)}
          onExtend={handleExtendDeadline}
        />,
        document.body
      )}

      {/* Sprint 6: Undo Dismiss Snackbar */}
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
    </div>
  );
};
