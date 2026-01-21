import React, { useState, useEffect, useCallback } from 'react';
import { EnhancedDecisionCard } from './EnhancedDecisionCard';
import { TaskList, TaskStatus } from '../TaskList';
import { EnhancedTaskCard } from '../tasks/EnhancedTaskCard';
import { AITaskPrioritizer } from '../tasks/AITaskPrioritizer';
import { TaskKanban } from '../tasks/TaskKanban';
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
  X,
  ChevronDown,
  ChevronUp,
  List,
  Columns,
  Calendar,
  AlertCircle,
  Zap,
  Undo,
} from 'lucide-react';
import './DecisionTaskHub.css';

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
  const [showInsights, setShowInsights] = useState(true);
  const [showNudges, setShowNudges] = useState(true);
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

  const loadDecisions = async () => {
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
    } catch (error) {
      console.error('❌ Failed to load decisions:', error);
      setDecisions([]);
    } finally {
      setDecisionsLoading(false);
    }
  };

  const loadTasks = async () => {
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
  };

  const generateMetrics = async () => {
    try {
      console.log('🔢 Generating metrics from decisions:', decisions.length);
      const calculatedMetrics = await decisionAnalyticsService.calculateDecisionVelocity(decisions);
      console.log('📊 Metrics generated:', calculatedMetrics);
      setMetrics(calculatedMetrics);
    } catch (error) {
      console.error('❌ Failed to generate metrics:', error);
    }
  };

  const generateNudges = async () => {
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
  };

  const handleVote = () => {
    loadDecisions();
  };

  const handleRefresh = () => {
    if (activeTab === 'decisions') {
      loadDecisions();
    } else {
      loadTasks();
    }
    generateMetrics();
    generateNudges();
  };

  // Sprint 6: Enhanced dismiss handling with persistence
  const handleDismissNudge = (nudgeId: string) => {
    dismissNudge(nudgeId);
    setDismissedNudges(prev => new Set(prev).add(nudgeId));
    setNudges(nudges.filter(n => n.id !== nudgeId));
    setLastDismissedNudge(nudgeId);

    // Auto-hide undo notification after 5 seconds
    setTimeout(() => {
      setLastDismissedNudge(null);
    }, 5000);
  };

  const handleDismissAllNudges = () => {
    const nudgeIds = nudges.map(n => n.id);
    dismissMultipleNudges(nudgeIds);
    setDismissedNudges(prev => {
      const updated = new Set(prev);
      nudgeIds.forEach(id => updated.add(id));
      return updated;
    });
    setShowNudges(false);
  };

  const handleUndoDismiss = () => {
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
  };

  // Sprint 6: Enhanced nudge action handlers
  const handleNudgeAction = async (nudge: Nudge) => {
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
  };

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
  const handleTaskStatusChange = async (taskId: string, newStatus: Task['status']) => {
    try {
      await taskService.updateTaskStatus(taskId, newStatus);
      await loadTasks(); // Reload tasks
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    try {
      await taskService.deleteTask(taskId);
      await loadTasks(); // Reload tasks
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleTaskEdit = (task: Task) => {
    // TODO: Open task edit modal
    console.log('Edit task:', task);
  };

  const handlePrioritizationComplete = (prioritized: AITaskPriority[]) => {
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
  };

  // Sprint 6: Reassign task handler
  const handleReassignTask = async (taskId: string, newAssignee: string) => {
    try {
      await taskService.updateTask(taskId, { assigned_to: newAssignee });
      await loadTasks(); // Reload to get fresh data
      setTaskToReassign(null);
    } catch (error) {
      console.error('Failed to reassign task:', error);
      throw error;
    }
  };

  // Sprint 6: Extend deadline handler
  const handleExtendDeadline = async (taskId: string, newDeadline: string) => {
    try {
      await taskService.updateTask(taskId, { due_date: newDeadline });
      await loadTasks(); // Reload to get fresh data
      setTaskToExtend(null);
    } catch (error) {
      console.error('Failed to extend deadline:', error);
      throw error;
    }
  };

  // Decision Mission handlers
  const handleOpenDecisionMission = (decision?: DecisionWithVotes) => {
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
        timestamp: new Date().toISOString()
      };
      setMissionMessages([contextMessage]);
    }
  };

  const handleMissionSendMessage = async (message: string) => {
    if (!user?.openai_api_key) {
      alert('Please add your OpenAI API key in settings to use the Decision Mission.');
      return;
    }

    // Add user message
    const userMessage: AIMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    setMissionMessages(prev => [...prev, userMessage]);
    setMissionLoading(true);

    try {
      // Call RAG service for AI response
      const response = await ragService.chat(
        message,
        [],
        user.openai_api_key,
        (logs) => {
          setMissionThinkingLogs(new Map([[userMessage.id, logs]]));
        }
      );

      // Add AI response
      const aiMessage: AIMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };
      setMissionMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      const errorMessage: AIMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMissionMessages(prev => [...prev, errorMessage]);
    } finally {
      setMissionLoading(false);
    }
  };

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

  const votingCount = decisions.filter(d => d.status === 'voting').length;
  const overdueCount = tasks.filter(t =>
    t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
  ).length;

  // Count nudges by priority
  const urgentNudges = nudges.filter(n => n.priority === 'urgent');
  const importantNudges = nudges.filter(n => n.priority === 'important');
  const suggestionNudges = nudges.filter(n => n.priority === 'suggestion');

  // Debug logging
  console.log('🎨 Render state:', {
    metrics,
    nudgesCount: nudges.length,
    decisionsCount: decisions.length,
    tasksCount: tasks.length,
    showInsights,
    showNudges
  });

  return (
    <div className="decision-task-hub">
      {/* Header */}
      <div className="hub-header">
        <div className="hub-header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 className="hub-title">Decisions & Tasks</h1>
            <RealTimeIndicator status={connectionStatus} />
          </div>
          <p className="hub-subtitle">
            AI-powered command center for team coordination
          </p>
        </div>
        <div className="hub-header-actions">
          <button
            type="button"
            className="hub-action-button"
            onClick={() => setShowAssistant(!showAssistant)}
            title="AI Assistant"
          >
            <MessageSquare size={18} />
            <span>AI Assistant</span>
          </button>
          <button
            type="button"
            className="hub-action-button primary"
            onClick={handleOpenDecisionMission}
            title="Create Decision"
          >
            <Plus size={18} />
            <span>Create Decision</span>
          </button>
        </div>
      </div>

      {/* AI Insights Dashboard */}
      {metrics && (
        <div className={`insights-dashboard ${showInsights ? 'expanded' : 'collapsed'}`}>
          <div className="insights-header" onClick={() => setShowInsights(!showInsights)}>
            <div className="insights-header-left">
              <TrendingUp size={20} />
              <h2>AI Insights Dashboard</h2>
            </div>
            <div className="insights-header-right">
              <button onClick={handleRefresh} className="icon-button" title="Refresh">
                <RefreshCw size={16} />
              </button>
              <button className="icon-button">
                {showInsights ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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

      {/* Proactive Nudges */}
      {nudges.length > 0 && showNudges && (
        <div className="nudges-panel">
          <div className="nudges-header">
            <div className="nudges-header-left">
              <Bell size={18} />
              <h3>Suggestions & Nudges</h3>
              <span className="nudges-count">({nudges.length})</span>
            </div>
            <div className="nudges-header-actions">
              <button
                type="button"
                className="icon-button"
                onClick={handleDismissAllNudges}
                title="Dismiss all nudges"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="nudges-content">
            {urgentNudges.length > 0 && (
              <div className="nudge-group">
                <div className="nudge-group-header urgent">🔴 Urgent ({urgentNudges.length})</div>
                {urgentNudges.map(nudge => (
                  <div key={nudge.id} className="nudge-item urgent">
                    <div className="nudge-message">{nudge.message}</div>
                    {nudge.action && (
                      <div className="nudge-actions">
                        <button
                          className="nudge-action-button"
                          onClick={() => handleNudgeAction(nudge)}
                        >
                          {nudge.action}
                        </button>
                        <button
                          className="nudge-dismiss-button"
                          onClick={() => handleDismissNudge(nudge.id)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {importantNudges.length > 0 && (
              <div className="nudge-group">
                <div className="nudge-group-header important">🟡 Important ({importantNudges.length})</div>
                {importantNudges.map(nudge => (
                  <div key={nudge.id} className="nudge-item important">
                    <div className="nudge-message">{nudge.message}</div>
                    {nudge.action && (
                      <div className="nudge-actions">
                        <button
                          className="nudge-action-button"
                          onClick={() => handleNudgeAction(nudge)}
                        >
                          {nudge.action}
                        </button>
                        <button
                          className="nudge-dismiss-button"
                          onClick={() => handleDismissNudge(nudge.id)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {suggestionNudges.length > 0 && (
              <div className="nudge-group">
                <div className="nudge-group-header suggestion">🟢 Suggestions ({suggestionNudges.length})</div>
                {suggestionNudges.slice(0, 2).map(nudge => (
                  <div key={nudge.id} className="nudge-item suggestion">
                    <div className="nudge-message">{nudge.message}</div>
                    {nudge.action && (
                      <div className="nudge-actions">
                        <button
                          className="nudge-action-button"
                          onClick={() => handleNudgeAction(nudge)}
                        >
                          {nudge.action}
                        </button>
                        <button
                          className="nudge-dismiss-button"
                          onClick={() => handleDismissNudge(nudge.id)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="hub-main-content">
        {/* View Selector */}
        <div className="view-selector">
          <button
            type="button"
            className={`view-button ${activeView === 'list' ? 'active' : ''}`}
            onClick={() => setActiveView('list')}
            title="List view"
          >
            <List size={16} />
            <span>List</span>
          </button>
          <button
            type="button"
            className={`view-button ${activeView === 'kanban' ? 'active' : ''}`}
            onClick={() => setActiveView('kanban')}
            disabled={activeTab === 'decisions'}
            title={activeTab === 'decisions' ? 'Kanban available for tasks only' : 'Kanban board view'}
          >
            <Columns size={16} />
            <span>Kanban</span>
          </button>
          <button
            type="button"
            className={`view-button ${activeView === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveView('timeline')}
            disabled
            title="Coming soon"
          >
            <Calendar size={16} />
            <span>Timeline</span>
          </button>
          {activeTab === 'tasks' && (
            <button
              type="button"
              className={`view-button ${showPrioritizer ? 'active' : ''}`}
              onClick={() => setShowPrioritizer(!showPrioritizer)}
              title="AI Task Prioritization"
            >
              <Zap size={16} />
              <span>AI Prioritize</span>
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="hub-tabs">
          <button
            className={`tab-button ${activeTab === 'decisions' ? 'active' : ''}`}
            onClick={() => setActiveTab('decisions')}
          >
            <Vote size={18} />
            <span>Decisions</span>
            {votingCount > 0 && (
              <span className="tab-badge">{votingCount}</span>
            )}
          </button>
          <button
            className={`tab-button ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            <CheckSquare size={18} />
            <span>Tasks</span>
            {overdueCount > 0 && (
              <span className="tab-badge urgent">{overdueCount}</span>
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
                  />
                  <span>Overdue only</span>
                </label>
              </>
            )}
          </div>

          <button
            className="refresh-button"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Content Area */}
        <div className="hub-content-area">
          {activeTab === 'decisions' && (
            <div className="decisions-section">
              {decisionsLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading decisions...</p>
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
                    onClick={handleOpenDecisionMission}
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
              {/* AI Task Prioritizer */}
              {showPrioritizer && tasks.length > 0 && (
                <AITaskPrioritizer
                  tasks={getFilteredTasks()}
                  onPrioritizationComplete={handlePrioritizationComplete}
                  apiKey={localStorage.getItem('gemini_api_key') || ''}
                />
              )}

              {tasksLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading tasks...</p>
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
                  tasks={getFilteredTasks()}
                  onStatusChange={handleTaskStatusChange}
                  onDelete={handleTaskDelete}
                  onEdit={handleTaskEdit}
                />
              ) : (
                <div className="tasks-list-view">
                  {getFilteredTasks().map((task) => (
                    <EnhancedTaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleTaskStatusChange}
                      onDelete={handleTaskDelete}
                      onEdit={handleTaskEdit}
                      allTasks={tasks}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Assistant Sidebar */}
      {showAssistant && user && (
        <ConversationalAssistant
          user={user}
          decisions={decisions}
          tasks={tasks}
          onClose={() => setShowAssistant(false)}
          onActionExecute={(action) => {
            console.log('Execute action:', action);
            // Refresh data after action execution
            loadDecisions();
            loadTasks();
          }}
        />
      )}

      {/* Decision Mission Modal */}
      {showDecisionMission && (
        <div className="decision-mission-modal">
          <div className="decision-mission-overlay" onClick={() => setShowDecisionMission(false)} />
          <div className="decision-mission-container">
            <div className="decision-mission-header">
              <h2>{selectedDecision ? `Decision: ${selectedDecision.title}` : 'Create Decision with AI'}</h2>
              <button
                type="button"
                onClick={() => setShowDecisionMission(false)}
                className="close-button"
                title="Close Decision Mission"
                aria-label="Close Decision Mission"
              >
                <X size={20} />
              </button>
            </div>
            <div className="decision-mission-content">
              <DecisionMission
                messages={missionMessages}
                isLoading={missionLoading}
                thinkingLogs={missionThinkingLogs}
                onSendMessage={handleMissionSendMessage}
                sessionTitle="Decision Mission"
              />
            </div>
          </div>
        </div>
      )}

      {/* Sprint 6: Reassign Task Modal */}
      {taskToReassign && (
        <ReassignTaskModal
          task={taskToReassign}
          currentAssignee={taskToReassign.assigned_to}
          onClose={() => setTaskToReassign(null)}
          onReassign={handleReassignTask}
        />
      )}

      {/* Sprint 6: Extend Deadline Dialog */}
      {taskToExtend && (
        <ExtendDeadlineDialog
          task={taskToExtend}
          onClose={() => setTaskToExtend(null)}
          onExtend={handleExtendDeadline}
        />
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
