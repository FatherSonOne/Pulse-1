
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import toast from 'react-hot-toast';
import { User, AppView, BatchedNotification, CalendarEvent, Task, Thread, Contact } from '../types';
import { generateJournalInsight, generateDailyBriefing, generateThinkingResponse } from '../services/geminiService';
import { useRegisterCommands, Command as PaletteCommand } from '../contexts/CommandPaletteContext';
import { InlineCommandPalette } from './GlobalCommandPalette';
import { saveArchiveItem } from '../services/dbService';
import { dataService } from '../services/dataService';
import { useWorkspaceData } from '../contexts/WorkspaceContext';
import { briefingService, BriefingContext } from '../services/briefingService';
import { useAIErrorHandler } from '../hooks/useAIErrorHandler';
import { UsageWarningBanner } from './billing/UsageWarningBanner';
import { OrgSetupChecklist } from './settings/OrgSetupChecklist';
import QuickScheduler from './Dashboard/QuickScheduler';
import CollapsibleWidget from './Dashboard/CollapsibleWidget';
import { pulseService, SearchUserResult } from '../services/pulseService';
import { calculateTeamHealthMetrics, TeamHealthMetrics } from '../services/teamHealthService';
import { teamService, Team, TeamWithMembers, TeamMember as TeamMemberType } from '../services/teamService';
import { AttentionDashboard } from './attention';
import { attentionService } from '../services/attentionService';
import { emailSyncService } from '../services/emailSyncService';

import { Archive, ArrowRight, BookUser, Calendar, Check, CheckCircle2, CheckSquare, ChevronRight, Copy, Heart, List, Loader2, Mail, MessageSquare, MessagesSquare, Mic, Plus, Search, Send, Target, TrendingUp, UserCheck, UserPlus, Users, X } from 'lucide-react';

// Auto-refresh interval in milliseconds (5 minutes)
const BRIEFING_REFRESH_INTERVAL = 5 * 60 * 1000;

// ============= TYPES =============

interface ProductivityMetrics {
  tasksCompleted: number;
  tasksTotal: number;
  messagesSent: number;
  messagesReceived: number;
  meetingsAttended: number;
  focusTime: number;
  responseTime: number;
}

interface WeeklyData {
  day: string;
  tasks: number;
  messages: number;
  meetings: number;
  date?: Date;
}

interface GoalProgress {
  id: string;
  title: string;
  progress: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  icon?: string;
  category?: 'productivity' | 'communication' | 'wellness' | 'custom';
  color?: string;
  enabled?: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  avatarColor: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  lastActive?: Date;
  unreadCount?: number;
}

interface PriorityItem {
  type: 'task' | 'event' | 'message';
  id: string;
  title: string;
  urgency: 'urgent' | 'high' | 'medium' | 'low';
  dueTime?: Date;
  source?: string;
}

interface DashboardProps {
  user: User | null;
  apiKey: string;
  setView: (view: AppView, options?: { openTaskPanel?: boolean; openAddContact?: boolean }) => void;
  openSettings?: (section: string) => void;
}

interface BriefingHighlight {
  category: 'calendar' | 'task' | 'message' | 'email' | 'vox' | 'contact' | 'project';
  title: string;
  detail: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
}

interface BriefingSuggestion {
  action: string;
  reason: string;
  type: 'message' | 'event' | 'task' | 'email' | 'vox' | 'contact' | 'ai_assist';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  aiFeature?: string;
}

interface BriefingData {
  greeting: string;
  summary: string;
  highlights?: BriefingHighlight[];
  suggestions: BriefingSuggestion[];
  focusRecommendation?: string;
}

interface BriefingStats {
  unreadMessages: number;
  pendingTasks: number;
  todayMeetings: number;
  unplayedVoxes: number;
}

// ============= SKELETON COMPONENTS =============

const BriefingSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-xl p-6 sm:p-8 animate-pulse">
    <div className="h-3 bg-zinc-200/70 dark:bg-white/[0.06] rounded w-32 mb-5"></div>
    <div className="h-6 bg-zinc-200/70 dark:bg-white/[0.06] rounded w-1/2 mb-3"></div>
    <div className="space-y-2 mb-6">
      <div className="h-4 bg-zinc-200/70 dark:bg-white/[0.06] rounded w-full max-w-[65ch]"></div>
      <div className="h-4 bg-zinc-200/70 dark:bg-white/[0.06] rounded w-4/5 max-w-[55ch]"></div>
    </div>
    <div className="h-9 bg-zinc-200/70 dark:bg-white/[0.06] rounded w-72 mb-6"></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-10 bg-zinc-100/80 dark:bg-white/[0.04] rounded"></div>
      ))}
    </div>
  </div>
);

// ============= AI PROVENANCE CHIP =============
// The system signature: every AI artifact is attributable, dismissable, and visually identifiable.
// JetBrains Mono uppercase tracked, accent-soft-light bg, rose-deep text, optional leading dot.

interface ProvenanceChipProps {
  provider?: 'claude' | 'gemini' | 'pulse';
  kind: string;
  className?: string;
}

const ProvenanceChip: React.FC<ProvenanceChipProps> = ({ provider = 'pulse', kind, className = '' }) => {
  const label = provider === 'claude' ? 'CLAUDE' : provider === 'gemini' ? 'GEMINI' : 'PULSE AI';
  return (
    <span className={`pulse-label inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden="true"></span>
      {label} · {kind}
    </span>
  );
};

// ============= TIME-AWARE GREETING =============

function getContextualGreeting(userName?: string): { greeting: string; icon: string; timeOfDay: string } {
  const hour = new Date().getHours();
  const name = userName || 'there';

  if (hour >= 5 && hour < 12) {
    return {
      greeting: `Good morning, ${name}`,
      icon: 'fa-sun',
      timeOfDay: 'morning'
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      greeting: `Good afternoon, ${name}`,
      icon: 'fa-cloud-sun',
      timeOfDay: 'afternoon'
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      greeting: `Good evening, ${name}`,
      icon: 'fa-moon',
      timeOfDay: 'evening'
    };
  } else {
    return {
      greeting: `Burning the midnight oil, ${name}?`,
      icon: 'fa-stars',
      timeOfDay: 'night'
    };
  }
}

// CollapsibleWidget is now extracted — imported from ./Dashboard/CollapsibleWidget

// ============= TODAY'S PRIORITIES COMPONENT =============

interface TodaysPrioritiesProps {
  priorities: PriorityItem[];
  isLoading: boolean;
  onItemClick: (item: PriorityItem) => void;
}

const TodaysPriorities: React.FC<TodaysPrioritiesProps> = ({ priorities, isLoading, onItemClick }) => {
  const getUrgencyDotColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-rose-500';
      default: return 'bg-zinc-400';
    }
  };

  const getUrgencyLabel = (urgency: string) => {
    switch (urgency) {
      case 'urgent': return 'URGENT';
      case 'high': return 'HIGH';
      case 'medium': return 'MEDIUM';
      default: return 'LOW';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'task': return 'TASK';
      case 'event': return 'EVENT';
      case 'message': return 'MSG';
      default: return '';
    }
  };

  if (isLoading) {
    return (
      <section className="animate-pulse">
        <div className="h-3 bg-zinc-200/70 dark:bg-white/[0.06] rounded w-24 mb-4"></div>
        <div className="h-20 bg-zinc-100/80 dark:bg-white/[0.04] rounded-xl mb-2"></div>
        <div className="space-y-1.5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 bg-zinc-100/60 dark:bg-white/[0.03] rounded"></div>
          ))}
        </div>
      </section>
    );
  }

  if (priorities.length === 0) {
    return (
      <section>
        <h2 className="pulse-label text-zinc-500 dark:text-zinc-400 mb-3">PRIORITIES · TODAY</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing on fire. Use the time.</p>
      </section>
    );
  }

  const [primary, ...rest] = priorities;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="pulse-label text-zinc-500 dark:text-zinc-400">
          PRIORITIES · {priorities.length}
        </h2>
      </div>

      {/* Priority #1 — full-width, primary visual weight */}
      <button
        onClick={() => onItemClick(primary)}
        className="w-full text-left bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] hover:border-rose-500/40 dark:hover:border-rose-500/30 rounded-xl px-5 py-4 mb-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`w-2 h-2 rounded-full ${getUrgencyDotColor(primary.urgency)}`} aria-hidden="true"></span>
          <span className="pulse-label text-zinc-500 dark:text-zinc-500">
            {getUrgencyLabel(primary.urgency)}{getTypeLabel(primary.type) ? ` · ${getTypeLabel(primary.type)}` : ''}
            {primary.source ? ` · ${primary.source.toUpperCase()}` : ''}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-50 leading-snug truncate">
            {primary.title}
          </h3>
          {primary.dueTime && (
            <span className="pulse-label text-zinc-500 dark:text-zinc-500 shrink-0">
              {primary.dueTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </button>

      {/* Priorities #2-5 — single-line ranked list */}
      {rest.length > 0 && (
        <ul className="space-y-px">
          {rest.slice(0, 4).map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onItemClick(item)}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 group"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${getUrgencyDotColor(item.urgency)} shrink-0`} aria-hidden="true"></span>
                <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate flex-1">
                  {item.title}
                </span>
                {item.source && (
                  <span className="pulse-label text-zinc-400 dark:text-zinc-500 shrink-0">{item.source.toUpperCase()}</span>
                )}
                {item.dueTime && (
                  <span className="pulse-label text-zinc-500 dark:text-zinc-400 shrink-0">
                    {item.dueTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

// ============= MAIN DASHBOARD COMPONENT =============

const Dashboard: React.FC<DashboardProps> = ({ user, apiKey, setView, openSettings }) => {
  // Router handles AI key server-side — client just passes '' to services
  const effectiveApiKey = apiKey || '';
  // AI-router error handler (cap exceeded / provider down → toast + CTA)
  const handleAIError = useAIErrorHandler();
  // Active workspace — required for scoping realtime subscriptions so a
  // dashboard channel from one workspace doesn't keep streaming after the
  // user switches to another. dataService also tears down all channels on
  // workspace switch via the pulse:workspace-changed event bus.
  const { currentWorkspace } = useWorkspaceData();
  // Real data state
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New real data state
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [pulseUsers, setPulseUsers] = useState<SearchUserResult[]>([]);
  const [showTeamBuilder, setShowTeamBuilder] = useState(false);
  const [teamHealthMetrics, setTeamHealthMetrics] = useState<TeamHealthMetrics | null>(null);
  const [loadingTeamHealth, setLoadingTeamHealth] = useState(false);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamBuilderName, setTeamBuilderName] = useState('');
  const [teamBuilderDescription, setTeamBuilderDescription] = useState('');
  const [teamBuilderSearchQuery, setTeamBuilderSearchQuery] = useState('');
  const [teamBuilderSelectedMembers, setTeamBuilderSelectedMembers] = useState<Array<{ type: 'pulse_user' | 'contact'; id: string; name: string }>>([]);
  const [teamBuilderTab, setTeamBuilderTab] = useState<'pulse' | 'contacts'>('pulse');
  const [teamBuilderError, setTeamBuilderError] = useState<string | null>(null);
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState(false);
  const [journalCopied, setJournalCopied] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamBuilderContacts, setTeamBuilderContacts] = useState<Contact[]>([]);
  const [loadingTeamBuilderContacts, setLoadingTeamBuilderContacts] = useState(false);

  // Widget expansion state — default to one expanded widget; rest collapsed for triage focus
  const [expandedWidgets, setExpandedWidgets] = useState<Set<string>>(
    new Set(['scheduler'])
  );

  // Journal State
  const [journalText, setJournalText] = useState('');
  const [journalInsight, setJournalInsight] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [recentJournals, setRecentJournals] = useState<Array<{id: string; title: string; date: Date; content: string}>>([]);

  // The Dashboard's old "Search the web" widget was replaced by the global
  // command palette (rendered inline below). Its state is gone with the bar.

  // Mini Pulse AI State
  const [pulseAiQuery, setPulseAiQuery] = useState('');
  const [pulseAiResponse, setPulseAiResponse] = useState<string | null>(null);
  const [loadingPulseAi, setLoadingPulseAi] = useState(false);

  // Unread Pulse State
  const [emailUnreadCount, setEmailUnreadCount] = useState(0);
  const [voxUnreadCount, setVoxUnreadCount] = useState(0);

  // Daily Briefing State
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [briefingStats, setBriefingStats] = useState<BriefingStats | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [lastBriefingRefresh, setLastBriefingRefresh] = useState<Date | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const briefingRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Attention Budget State — attentionLoad derived from batchedNotifications
  const [batchedNotifications, setBatchedNotifications] = useState<BatchedNotification[]>([]);
  const attentionLoad = useMemo(() => {
    const count = batchedNotifications.length;
    // Tiered formula: 0 items = 10%, 5 items ≈ 40%, 10 items ≈ 65%, 15+ items = 85%
    if (count === 0) return 10;
    if (count <= 3) return 10 + count * 8;
    if (count <= 7) return 34 + (count - 3) * 7;
    if (count <= 12) return 62 + (count - 7) * 4;
    return Math.min(85 + (count - 12) * 2, 98);
  }, [batchedNotifications]);

  // Enhanced Analytics State
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState<'day' | 'week' | 'month'>('week');
  const [selectedMetric, setSelectedMetric] = useState<'tasks' | 'messages' | 'meetings'>('tasks');
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [goalEditorTab, setGoalEditorTab] = useState<'productivity' | 'communication' | 'wellness' | 'all'>('all');

  // Keyboard shortcut overlay
  const [showKbdOverlay, setShowKbdOverlay] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  // The Dashboard's command-palette state moved to App-level CommandPaletteProvider.
  // Cmd+K is owned by App.tsx; this view registers its own commands via
  // useRegisterCommands and renders the InlineCommandPalette in the hero slot.

  // Persistent activity badge — shows "SAVED hh:mm" briefly after any save.
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const markSaved = useCallback(() => setLastSavedAt(new Date()), []);
  useEffect(() => {
    if (!lastSavedAt) return;
    const t = setTimeout(() => setLastSavedAt(null), 4000);
    return () => clearTimeout(t);
  }, [lastSavedAt]);

  // ============= DATA LOADING =============

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [eventsData, tasksData, threadsData, prioritiesData, weeklyDataResult, teamData] = await Promise.all([
        dataService.getEvents(),
        dataService.getTasks(),
        dataService.getThreads(),
        dataService.getTodaysPriorities(),
        dataService.getWeeklyProductivityData(),
        dataService.getTeamMembers(),
      ]);

      // Get Pulse users separately
      let pulseUsersData: SearchUserResult[] = [];
      try {
        pulseUsersData = await pulseService.getRecentContacts(10);
        setPulseUsers(pulseUsersData);
      } catch (error) {
        console.error('Failed to load Pulse users:', error);
      }

      setEvents(eventsData);
      setTasks(tasksData);
      setThreads(threadsData);
      setPriorities(prioritiesData);
      setWeeklyData(weeklyDataResult);

      // Fetch unread counts for Unread Pulse widget
      try {
        const [emailUnread, voxRecordings] = await Promise.all([
          emailSyncService.getUnreadCount('inbox'),
          dataService.getVoxerRecordings(),
        ]);
        setEmailUnreadCount(emailUnread);
        setVoxUnreadCount(voxRecordings.filter((r: any) => !r.played).length);
      } catch {
        // Non-critical — leave counts at 0
      }

      // Filter out SMS-only contacts and use Pulse users instead
      // SMS contacts typically have names with { } or # symbols from the SMS system
      const filteredTeamData = teamData.filter(m => 
        !m.name.includes('{') && 
        !m.name.includes('}') && 
        !m.name.includes('#') &&
        !m.name.startsWith('{')
      );
      
      // Convert Pulse users to TeamMember format
      const pulseUserTeamMembers: TeamMember[] = pulseUsersData.map(user => ({
        id: user.id,
        name: user.display_name || user.full_name || 'Pulse User',
        avatarColor: 'bg-zinc-200 dark:bg-white/[0.08] text-zinc-700 dark:text-zinc-200',
        status: 'online' as const,
        unreadCount: 0,
      }));
      
      // Use Pulse users if available, otherwise use filtered contacts
      setTeamMembers(pulseUserTeamMembers.length > 0 ? pulseUserTeamMembers : filteredTeamData);

      // Load saved goals from localStorage first
      let savedGoals: GoalProgress[] | null = null;
      if (user?.id) {
        try {
          const saved = localStorage.getItem(`pulse_goals_${user.id}`);
          if (saved) {
            savedGoals = JSON.parse(saved);
          }
        } catch (error) {
          console.error('Failed to load saved goals:', error);
        }
      }

      // If we have saved goals, use them (but update progress from real data)
      if (savedGoals && savedGoals.length > 0) {
        const completedTasks = tasksData.filter(t => t.completed).length;
        const totalTasks = tasksData.length || 10;
        const meetingCount = eventsData.filter(e => e.type === 'meet').length;
        
        // Validate and update goals - ensure all required properties exist
        const updatedGoals = savedGoals.map(goal => {
          // Ensure enabled defaults to false if not set (user must explicitly enable)
          const validatedGoal = {
            ...goal,
            enabled: goal.enabled !== undefined ? goal.enabled : false,
            progress: goal.progress ?? 0,
            target: goal.target ?? 100,
            unit: goal.unit ?? '',
            trend: goal.trend || 'stable',
            icon: goal.icon || 'fa-bullseye',
            category: goal.category || 'custom',
            color: goal.color || 'rose',
          };
          
          // Update progress for goals that track real data
          if (validatedGoal.id === 'g1' && validatedGoal.title === 'Weekly Tasks') {
            validatedGoal.progress = completedTasks;
            validatedGoal.target = totalTasks || validatedGoal.target;
          }
          if (validatedGoal.id === 'g9' && validatedGoal.title === 'Meetings Limit') {
            validatedGoal.progress = meetingCount;
          }
          
          return validatedGoal;
        });
        
        setGoals(updatedGoals);
      } else {
        // Load outcomes/goals from database
        const outcomes = await dataService.getOutcomes(currentWorkspace?.id);
        const goalsFromOutcomes: GoalProgress[] = outcomes.slice(0, 4).map(o => ({
          id: o.id,
          title: o.title,
          progress: o.progress,
          target: 100,
          unit: '%',
          trend: o.status === 'active' ? 'stable' : o.status === 'achieved' ? 'up' : 'down',
        }));

        // Fallback to default goals if none exist
        if (goalsFromOutcomes.length === 0) {
          const completedTasks = tasksData.filter(t => t.completed).length;
          const totalTasks = tasksData.length || 10;
          const meetingCount = eventsData.filter(e => e.type === 'meet').length;
          
          const defaultGoals: GoalProgress[] = [
            // Productivity Goals
            { id: 'g1', title: 'Weekly Tasks', progress: completedTasks, target: totalTasks, unit: 'tasks', trend: completedTasks >= totalTasks * 0.7 ? 'up' : 'stable', icon: 'fa-list-check', category: 'productivity', color: 'blue', enabled: false },
            { id: 'g2', title: 'Focus Hours', progress: 22, target: 30, unit: 'hours', trend: 'stable', icon: 'fa-brain', category: 'productivity', color: 'purple', enabled: false },
            { id: 'g3', title: 'Deep Work Sessions', progress: 3, target: 5, unit: 'sessions', trend: 'up', icon: 'fa-moon', category: 'productivity', color: 'indigo', enabled: false },
            { id: 'g4', title: 'Tasks Completed Early', progress: 5, target: 10, unit: 'tasks', trend: 'up', icon: 'fa-hourglass-end', category: 'productivity', color: 'emerald', enabled: false },
            
            // Communication Goals
            { id: 'g5', title: 'Response Time', progress: 12, target: 15, unit: 'min avg', trend: 'down', icon: 'fa-clock', category: 'communication', color: 'rose', enabled: false },
            { id: 'g6', title: 'Messages Sent', progress: 150, target: 200, unit: 'messages', trend: 'up', icon: 'fa-message', category: 'communication', color: 'cyan', enabled: false },
            { id: 'g7', title: 'Team Check-ins', progress: 4, target: 5, unit: 'check-ins', trend: 'stable', icon: 'fa-handshake', category: 'communication', color: 'teal', enabled: false },
            { id: 'g8', title: 'Reply Rate', progress: 85, target: 90, unit: '%', trend: 'up', icon: 'fa-reply', category: 'communication', color: 'amber', enabled: false },
            
            // Wellness Goals
            { id: 'g9', title: 'Meetings Limit', progress: meetingCount, target: 10, unit: 'per week', trend: meetingCount <= 10 ? 'up' : 'down', icon: 'fa-calendar-days', category: 'wellness', color: 'red', enabled: false },
            { id: 'g10', title: 'Meeting-Free Days', progress: 2, target: 3, unit: 'days', trend: 'stable', icon: 'fa-calendar-xmark', category: 'wellness', color: 'orange', enabled: false },
            { id: 'g11', title: 'Break Reminders', progress: 5, target: 7, unit: 'reminders', trend: 'up', icon: 'fa-mug-saucer', category: 'wellness', color: 'lime', enabled: false },
            { id: 'g12', title: 'End of Day Review', progress: 4, target: 5, unit: 'reviews', trend: 'up', icon: 'fa-clipboard-check', category: 'wellness', color: 'pink', enabled: false },
          ];
          
          setGoals(defaultGoals);
          // Save default goals to localStorage
          if (user?.id) {
            localStorage.setItem(`pulse_goals_${user.id}`, JSON.stringify(defaultGoals));
          }
        } else {
          setGoals(goalsFromOutcomes);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Couldn\'t load dashboard. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Load teams from database
  const loadTeams = useCallback(async () => {
    if (!user?.id) return;
    
    setLoadingTeams(true);
    try {
      const userTeams = await teamService.getTeams();
      setTeams(userTeams);
      
      // Auto-select first team if none selected
      if (userTeams.length > 0 && !selectedTeamId) {
        setSelectedTeamId(userTeams[0].id);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
      toast.error('Couldn\'t load teams.');
    } finally {
      setLoadingTeams(false);
    }
  }, [user?.id, selectedTeamId]);

  // Load contacts when contacts tab is opened
  useEffect(() => {
    if (teamBuilderTab === 'contacts' && showTeamBuilder && teamBuilderContacts.length === 0 && !loadingTeamBuilderContacts) {
      setLoadingTeamBuilderContacts(true);
      dataService.getContacts()
        .then(allContacts => {
          const smsContacts = allContacts.filter(c => c.phone && !c.pulseUserId);
          setTeamBuilderContacts(smsContacts);
        })
        .catch(error => {
          console.error('Failed to load contacts:', error);
          setTeamBuilderContacts([]);
        })
        .finally(() => {
          setLoadingTeamBuilderContacts(false);
        });
    }
  }, [teamBuilderTab, showTeamBuilder]);

  // Load team members and health metrics when selected team changes
  useEffect(() => {
    if (selectedTeamId && user?.id) {
      const selectedTeam = teams.find(t => t.id === selectedTeamId);
      if (selectedTeam && selectedTeam.members.length > 0) {
        // Update team members display
        const teamMemberIds = selectedTeam.members.map(m => m.memberId);
        
        // Load health metrics for selected team
        setLoadingTeamHealth(true);
        calculateTeamHealthMetrics(teamMemberIds, user.id)
          .then(metrics => {
            setTeamHealthMetrics(metrics);
            setLoadingTeamHealth(false);
          })
          .catch(error => {
            console.error('Failed to load team health metrics:', error);
            setTeamHealthMetrics(null);
            setLoadingTeamHealth(false);
          });
      } else {
        setTeamHealthMetrics(null);
      }
    } else if (!selectedTeamId && teamMembers.length > 0 && user?.id) {
      // Fallback to current teamMembers if no team selected
      setLoadingTeamHealth(true);
      calculateTeamHealthMetrics(
        teamMembers.map(m => m.id),
        user.id
      ).then(metrics => {
        setTeamHealthMetrics(metrics);
        setLoadingTeamHealth(false);
      }).catch(error => {
        console.error('Failed to load team health metrics:', error);
        setTeamHealthMetrics(null);
        setLoadingTeamHealth(false);
      });
    } else {
      setTeamHealthMetrics(null);
    }
  }, [selectedTeamId, teams, teamMembers, user?.id]);

  // Load recent journal entries
  const loadRecentJournals = useCallback(async () => {
    try {
      const archives = await dataService.getArchives();
      const journals = archives
        .filter(a => a.type === 'journal')
        .slice(0, 3)
        .map(j => ({
          id: j.id,
          title: j.title,
          date: j.date,
          content: j.content
        }));
      setRecentJournals(journals);
    } catch (error) {
      console.error('Failed to load recent journals:', error);
    }
  }, []);

  useEffect(() => {
    loadRecentJournals();
  }, [loadRecentJournals]);

  // Keyboard shortcuts: ESC closes overlays; J focuses #1; K focuses #2; R refreshes briefing; / focuses search; ? toggles overlay.
  // Cmd+K is handled globally in App.tsx and opens the command palette.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // ESC closes overlays in priority order
      if (e.key === 'Escape') {
        if (showKbdOverlay) { setShowKbdOverlay(false); return; }
        if (showQuickActions) { setShowQuickActions(false); return; }
      }

      // The rest only fire when the user isn't typing
      if (isTyping) return;

      // ? toggles the shortcut overlay
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShowKbdOverlay(prev => !prev);
        return;
      }

      // / focuses the dashboard inline palette
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if ((e.key === 'j' || e.key === 'k') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (priorities.length === 0) return;
        e.preventDefault();
        const idx = e.key === 'j' ? 0 : Math.min(priorities.length - 1, 1);
        handlePriorityClick(priorities[idx]);
      }
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey && !loadingBriefing) {
        e.preventDefault();
        handleRefreshBriefing();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showQuickActions, showKbdOverlay, priorities, loadingBriefing]);

  // Listen for the global "show shortcuts" command from the palette.
  useEffect(() => {
    const handler = () => setShowKbdOverlay(true);
    window.addEventListener('pulse:show-shortcuts', handler);
    return () => window.removeEventListener('pulse:show-shortcuts', handler);
  }, []);

  // Draft protection: warn before browser navigation when journal has unsaved text
  useEffect(() => {
    if (!journalText.trim()) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required for legacy browsers; modern browsers ignore the string and show their own message.
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [journalText]);

  // Real-time subscriptions
  useEffect(() => {
    if (!currentWorkspace?.id) return;
    let unsubscribe: (() => void) | null = null;

    dataService.subscribeToDashboardUpdates(currentWorkspace.id, {
      onTaskUpdate: (task) => {
        setTasks(prev => {
          const idx = prev.findIndex(t => t.id === task.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = task;
            return updated;
          }
          return [...prev, task];
        });
      },
      onEventUpdate: (event) => {
        setEvents(prev => {
          const idx = prev.findIndex(e => e.id === event.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = event;
            return updated;
          }
          return [...prev, event];
        });
      },
    }).then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentWorkspace?.id]);

  // Computed Metrics
  const productivityMetrics = useMemo<ProductivityMetrics>(() => {
    const completedTasks = tasks.filter(t => t.completed).length;
    const totalTasks = tasks.length;
    const sentMessages = threads.reduce((sum, t) =>
      sum + t.messages.filter(m => m.sender === 'me').length, 0
    );
    const receivedMessages = threads.reduce((sum, t) =>
      sum + t.messages.filter(m => m.sender === 'other').length, 0
    );
    const todayMeetings = events.filter(e => {
      const d = new Date(e.start);
      const now = new Date();
      return d.getDate() === now.getDate() && e.type === 'meet';
    }).length;

    // focusTime: sum of 'focus'-type event durations today (minutes),
    // fallback to completed tasks × 30 min estimate if no focus events
    const today = new Date();
    const todayFocusEvents = events.filter(e => {
      const d = new Date(e.start);
      return e.type === 'focus' &&
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
    });
    const focusTime = todayFocusEvents.length > 0
      ? Math.round(todayFocusEvents.reduce((sum, e) => {
          const ms = new Date(e.end).getTime() - new Date(e.start).getTime();
          return sum + ms / 60000;
        }, 0))
      : completedTasks * 30; // estimated: ~30 min per completed task

    // responseTime: average minutes between receiving a message and replying,
    // computed across all threads. Returns 0 if insufficient data.
    const responseTimes: number[] = [];
    threads.forEach(thread => {
      const msgs = [...thread.messages].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      for (let i = 1; i < msgs.length; i++) {
        if (msgs[i].sender === 'me' && msgs[i - 1].sender === 'other') {
          const gapMin = (new Date(msgs[i].timestamp).getTime() - new Date(msgs[i - 1].timestamp).getTime()) / 60000;
          if (gapMin > 0 && gapMin < 480) responseTimes.push(gapMin); // ignore gaps > 8h
        }
      }
    });
    const responseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0; // 0 = no data

    return {
      tasksCompleted: completedTasks,
      tasksTotal: totalTasks,
      messagesSent: sentMessages,
      messagesReceived: receivedMessages,
      meetingsAttended: todayMeetings,
      focusTime,
      responseTime,
    };
  }, [tasks, threads, events]);

  // Weekly totals
  const weeklyTotals = useMemo(() => ({
    tasks: weeklyData.reduce((sum, d) => sum + d.tasks, 0),
    messages: weeklyData.reduce((sum, d) => sum + d.messages, 0),
    meetings: weeklyData.reduce((sum, d) => sum + d.meetings, 0),
  }), [weeklyData]);

  // Max value for chart scaling
  const maxChartValue = useMemo(() => {
    return Math.max(...weeklyData.map(d => d[selectedMetric]), 1);
  }, [weeklyData, selectedMetric]);

  // ============= BRIEFING =============

  // Load briefing on mount and set up auto-refresh
  useEffect(() => {
    if (!isLoading) {
      // Initial load
      loadDailyBriefing();

      // Set up auto-refresh interval
      briefingRefreshRef.current = setInterval(() => {
        loadDailyBriefing(true); // silent refresh
      }, BRIEFING_REFRESH_INTERVAL);

      return () => {
        if (briefingRefreshRef.current) {
          clearInterval(briefingRefreshRef.current);
        }
      };
    }
  }, [isLoading]);

  // Also load quick stats separately for faster initial display
  useEffect(() => {
    loadBriefingStats();
  }, []);

  const loadBriefingStats = async () => {
    try {
      const stats = await briefingService.getQuickStats();
      setBriefingStats(stats);
    } catch (error) {
      console.error('Failed to load briefing stats:', error);
    }
  };

  const loadDailyBriefing = async (silent = false) => {
    if (!silent) setLoadingBriefing(true);
    setBriefingError(null);

    try {
      // Gather comprehensive context from all data sources
      const context = await briefingService.gatherBriefingContext(currentWorkspace?.id);
      const contextString = briefingService.buildContextString(context);

      // Generate AI briefing with full context (router handles key server-side)
      const data = await generateDailyBriefing(effectiveApiKey, contextString);

      if (data) {
        setBriefing(data as BriefingData);
        setLastBriefingRefresh(new Date());
        markSaved();
      } else {
        console.warn('[Dashboard] Briefing generation returned no data');
        setBriefingError('No briefing returned. Try again.');
      }

      // Also refresh stats
      await loadBriefingStats();
    } catch (error: any) {
      console.error('Failed to load daily briefing:', error);
      // Let the global handler surface cap / trial / provider issues
      // (a cap-exceeded toast is far more actionable than silently falling
      // back to generic text). We still drop into the fallback briefing below
      // so the dashboard keeps rendering usable content.
      const handled = handleAIError(error);
      if (!handled) {
        setBriefingError('Couldn\'t refresh briefing. Network or service issue.');
      }
      // Set a fallback briefing with helpful message
      if (!briefing) {
        setBriefing({
          greeting: "Welcome back.",
          summary: "Unable to generate AI briefing at this time. Your dashboard is still functional.",
          suggestions: [],
          highlights: [],
          focusRecommendation: "Check your tasks and calendar for today."
        });
      }
    }

    if (!silent) setLoadingBriefing(false);
  };

  // Manual refresh handler
  const handleRefreshBriefing = () => {
    loadDailyBriefing();
  };

  // ============= HANDLERS =============

  const toggleWidget = useCallback((widgetId: string) => {
    setExpandedWidgets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(widgetId)) {
        newSet.delete(widgetId);
      } else {
        newSet.add(widgetId);
      }
      return newSet;
    });
  }, []);

  const handleJournalAnalyze = async () => {
    if (!journalText.trim()) return;
    setSaving(true);
    const insight = await generateJournalInsight(effectiveApiKey, journalText);
    setJournalInsight(insight || '');
    setSaving(false);
  };

  const handleArchive = async () => {
    if (!journalText.trim()) return;
    setSaving(true);

    const item = await saveArchiveItem({
      type: 'journal',
      title: `Journal - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      content: `Entry: ${journalText}\n\n${journalInsight ? `AI Insight: ${journalInsight}` : ''}`,
      tags: ['journal', 'quick-note', journalInsight ? 'analyzed' : 'raw']
    });

    setLastSavedId(item.id);
    markSaved();

    setTimeout(() => {
      setSaving(false);
      setJournalText('');
      setJournalInsight('');
      setLastSavedId(null);
      loadRecentJournals(); // Refresh recent journals after saving
    }, 1500);
  };

  const handleShare = () => {
    if (!journalText) return;
    navigator.clipboard.writeText(journalText).then(() => {
      setJournalCopied(true);
      setTimeout(() => setJournalCopied(false), 2000);
    });
  };

  const handlePulseAiQuery = async (query: string) => {
    if (!query.trim()) return;
    setLoadingPulseAi(true);
    setPulseAiQuery(query);
    try {
      const result = await generateThinkingResponse(effectiveApiKey, query);
      setPulseAiResponse(result || 'No response generated.');
    } catch (err) {
      setPulseAiResponse('Could not reach Pulse AI. Please try again.');
    } finally {
      setLoadingPulseAi(false);
    }
  };

  const handleSuggestionAction = (type: 'message' | 'event' | 'task' | 'email' | 'vox' | 'contact' | 'ai_assist') => {
    switch (type) {
      case 'message':
        sessionStorage.setItem('pulse_focus_nudge', 'message');
        setView(AppView.MESSAGES);
        break;
      case 'event':
      case 'task':
        setView(AppView.CALENDAR);
        break;
      case 'email':
        sessionStorage.setItem('pulse_focus_nudge', 'email');
        setView(AppView.EMAIL);
        break;
      case 'vox':
        setView(AppView.RELAY);
        break;
      case 'contact':
        setView(AppView.CONTACTS);
        break;
      case 'ai_assist':
        // Handled by handleAIFeatureClick
        break;
      default:
        setView(AppView.DASHBOARD);
    }
  };

  const handleAIFeatureClick = (featureType: string) => {
    switch (featureType) {
      case 'subtask_generation':
        // Navigate to calendar/tasks with AI subtask generation ready
        console.log('Navigate to task with AI subtask generation');
        setView(AppView.CALENDAR, { openTaskPanel: true });
        // Store the AI feature request for the calendar view to pick up
        sessionStorage.setItem('pulse_ai_feature_request', 'subtask_generation');
        break;
      case 'prioritization':
        // Navigate to tasks and trigger AI prioritization
        console.log('Navigate to AI task prioritization');
        setView(AppView.CALENDAR, { openTaskPanel: true });
        sessionStorage.setItem('pulse_ai_feature_request', 'prioritization');
        break;
      case 'natural_language':
        // Open create task modal in natural language mode
        console.log('Open create task in natural language mode');
        setView(AppView.CALENDAR, { openTaskPanel: true });
        sessionStorage.setItem('pulse_ai_feature_request', 'natural_language');
        break;
      case 'workload_balance':
        // Navigate to team view for workload balancing
        console.log('Navigate to workload balance view');
        setView(AppView.CALENDAR);
        sessionStorage.setItem('pulse_ai_feature_request', 'workload_balance');
        break;
      default:
        console.log('AI feature:', featureType);
        setView(AppView.CALENDAR);
    }
  };

  const handleHighlightAction = (category: BriefingHighlight['category'], title?: string) => {
    switch (category) {
      case 'calendar':
      case 'task':
        setView(AppView.CALENDAR);
        break;
      case 'message':
        sessionStorage.setItem('pulse_focus_nudge', 'message');
        setView(AppView.MESSAGES);
        break;
      case 'email':
        sessionStorage.setItem('pulse_focus_nudge', 'email');
        setView(AppView.EMAIL);
        break;
      case 'vox':
        setView(AppView.RELAY);
        break;
      case 'contact':
        setView(AppView.CONTACTS);
        break;
      case 'project':
        setView(AppView.DASHBOARD);
        break;
      default:
        setView(AppView.DASHBOARD);
    }
  };

  const getCategoryIcon = (category: BriefingHighlight['category']) => {
    switch (category) {
      case 'calendar': return 'fa-calendar';
      case 'task': return 'fa-check-circle';
      case 'message': return 'fa-message';
      case 'email': return 'fa-envelope';
      case 'vox': return 'fa-microphone';
      case 'contact': return 'fa-user';
      case 'project': return 'fa-folder';
      default: return 'fa-circle';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500 bg-red-50 dark:bg-red-900/20';
      case 'high': return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20';
      case 'medium': return 'text-rose-500 bg-rose-50 dark:bg-rose-900/20';
      default: return 'text-zinc-500 bg-zinc-50 dark:bg-zinc-900';
    }
  };

  const handlePriorityClick = (item: PriorityItem) => {
    if (item.type === 'task') setView(AppView.CALENDAR);
    if (item.type === 'event') setView(AppView.CALENDAR);
    if (item.type === 'message') setView(AppView.MESSAGES);
  };

  const handleUpdateGoal = useCallback((goalId: string, updates: Partial<GoalProgress>) => {
    setGoals(prev => {
      const updated = prev.map(g =>
        g.id === goalId ? { ...g, ...updates } : g
      );
      // Save to localStorage
      if (user?.id) {
        localStorage.setItem(`pulse_goals_${user.id}`, JSON.stringify(updated));
        markSaved();
      }
      return updated;
    });
  }, [user?.id, markSaved]);

  // Pending-disable confirmation: clicking once to disable a previously-enabled goal
  // sets a 3s window; clicking again within the window confirms. Prevents accidental disables.
  const [pendingDisableId, setPendingDisableId] = useState<string | null>(null);
  const pendingDisableTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleToggleGoal = useCallback((goalId: string) => {
    const target = goals.find(g => g.id === goalId);
    const isCurrentlyEnabled = target?.enabled !== false;

    // Enabling: instant. Disabling a previously-enabled goal: require a confirm click.
    if (isCurrentlyEnabled && pendingDisableId !== goalId) {
      setPendingDisableId(goalId);
      if (pendingDisableTimerRef.current) clearTimeout(pendingDisableTimerRef.current);
      pendingDisableTimerRef.current = setTimeout(() => setPendingDisableId(null), 3000);
      return;
    }

    if (pendingDisableTimerRef.current) {
      clearTimeout(pendingDisableTimerRef.current);
      pendingDisableTimerRef.current = null;
    }
    setPendingDisableId(null);

    setGoals(prev => {
      const updated = prev.map(g =>
        g.id === goalId ? { ...g, enabled: g.enabled === false ? true : false } : g
      );
      if (user?.id) {
        localStorage.setItem(`pulse_goals_${user.id}`, JSON.stringify(updated));
        markSaved();
      }
      return updated;
    });
  }, [user?.id, goals, pendingDisableId, markSaved]);

  const getStatusColor = useCallback((status: TeamMember['status']) => {
    switch (status) {
      case 'online': return 'bg-emerald-500';
      case 'busy': return 'bg-red-500';
      case 'away': return 'bg-yellow-500';
      default: return 'bg-zinc-400';
    }
  }, []);

  const formatFocusTime = useCallback((minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }, []);

  // Quick Actions — neutral surfaces, single primary action style
  const quickActions = useMemo(() => [
    { id: 'task', label: 'New Task', icon: 'fa-check', view: AppView.CALENDAR, openTaskPanel: true },
    { id: 'message', label: 'Send Message', icon: 'fa-message', view: AppView.MESSAGES },
    { id: 'meeting', label: 'Schedule Meet', icon: 'fa-video', view: AppView.CALENDAR },
    { id: 'email', label: 'Compose Email', icon: 'fa-envelope', view: AppView.EMAIL },
    { id: 'vox', label: 'Quick Relay', icon: 'fa-microphone', view: AppView.RELAY },
    { id: 'contact', label: 'New Contact', icon: 'fa-user-plus', view: AppView.CONTACTS, openAddContact: true },
    { id: 'warroom', label: 'War Room', icon: 'fa-book-open', view: AppView.LIVE },
    { id: 'search', label: 'Search', icon: 'fa-magnifying-glass', view: AppView.MULTI_MODAL },
  ], []);

  // Build dashboard-scoped commands (Quick Actions). Navigation rows live in
  // AppCommandRegistrar so they're available on every view, not just here.
  const dashboardCommands = useMemo<PaletteCommand[]>(() => {
    const actionDescs: Record<string, string> = {
      task: 'Open the task composer',
      message: 'Compose a new message',
      meeting: 'Schedule a video meeting',
      email: 'Open the email composer',
      vox: 'Record a quick voice message',
      contact: 'Add a new contact',
      warroom: 'Open the live war room',
      search: 'Open Pulse search',
    };

    return quickActions.map(a => ({
      id: `action-${a.id}`,
      label: a.label,
      desc: actionDescs[a.id] || 'Run this action',
      kind: 'action' as const,
      icon: a.icon,
      run: () => {
        const params: Record<string, boolean> = {};
        if (a.openTaskPanel) params.openTaskPanel = true;
        if (a.openAddContact) params.openAddContact = true;
        setView(a.view, Object.keys(params).length > 0 ? params : undefined);
      },
    }));
  }, [quickActions, setView]);

  useRegisterCommands('dashboard:actions', { commands: dashboardCommands });

  // Derived: upcoming events (next 3 future events sorted by start time)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter(e => new Date(e.start) > now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 3);
  }, [events]);

  // Derived: message unread count from threads
  const messageUnreadCount = useMemo(() => threads.filter(t => t.unread).length, [threads]);

  // Derived: threads awaiting the operator's reply.
  // Last message is from someone else and there's no reply from "me" after it. Sorted newest-first.
  const awaitingReply = useMemo(() => {
    const items = threads
      .map(thread => {
        if (!thread.messages || thread.messages.length === 0) return null;
        const sortedMsgs = [...thread.messages].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const lastMsg = sortedMsgs[0];
        if (lastMsg.sender !== 'other') return null;
        const ts = new Date(lastMsg.timestamp).getTime();
        const ageMin = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
        return {
          threadId: thread.id,
          contactName: thread.contactName || 'Unknown',
          preview: (lastMsg.text || '').replace(/\s+/g, ' ').trim(),
          source: lastMsg.source,
          receivedAt: ts,
          ageMin,
          unread: thread.unread,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return items.sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 5);
  }, [threads]);

  const formatAwaitingAge = useCallback((ageMin: number) => {
    if (ageMin < 1) return 'now';
    if (ageMin < 60) return `${ageMin}m`;
    const hours = Math.floor(ageMin / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }, []);

  const wordCount = journalText.trim().split(/\s+/).filter(Boolean).length;
  const charCount = journalText.length;
  const contextualGreeting = getContextualGreeting(user?.name);

  return (
    <div className="space-y-4 sm:space-y-6 overflow-y-auto h-full pr-1 sm:pr-2 animate-fade-in pb-10 mobile-scroll">

      {/* Usage-warning banner — surfaces before the user hits a hard cap */}
      <UsageWarningBanner />

      {/* Organization setup checklist — shown to admins while onboarding_step='named' */}
      {openSettings && <OrgSetupChecklist openSettings={openSettings} />}

      {/* Global command palette — inline mode. The bar IS the palette: type a
          command (Compose Email, Go to Calendar, View shortcuts, …) and hit
          Enter. Cmd+K everywhere opens the modal version of the same palette. */}
      <InlineCommandPalette inputRef={searchInputRef} />

      {/* Daily Briefing — quiet, triage-first */}
      {loadingBriefing || isLoading ? (
        <BriefingSkeleton />
      ) : (
        <section className="bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-xl p-6 sm:p-8 transition-colors duration-150">
          {briefing ? (
            <div>
              {/* Header: provenance + greeting + refresh */}
              <div className="flex items-start justify-between mb-3 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                    <ProvenanceChip provider="claude" kind="BRIEFING" />
                    {lastBriefingRefresh && !briefingError && (
                      <span className="pulse-label text-zinc-400 dark:text-zinc-500">
                        UPDATED {lastBriefingRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {briefingError && (
                      <button
                        onClick={handleRefreshBriefing}
                        disabled={loadingBriefing}
                        className="pulse-label inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/15 transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                        title={briefingError}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true"></span>
                        REFRESH FAILED · RETRY
                      </button>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
                    {contextualGreeting.greeting}
                  </h1>
                </div>
                <button
                  onClick={handleRefreshBriefing}
                  disabled={loadingBriefing}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                  title="Refresh briefing"
                  aria-label="Refresh briefing"
                >
                  <i className={`fa-solid fa-sync text-sm ${loadingBriefing ? 'fa-spin' : ''}`}></i>
                </button>
              </div>

              {/* Briefing prose, capped at 65ch */}
              <p className="text-sm sm:text-[15px] text-zinc-700 dark:text-zinc-300 leading-relaxed max-w-[65ch] mb-5">
                {briefing.summary}
              </p>

              {/* Primary action: focus recommendation */}
              {briefing.focusRecommendation && (
                <button
                  onClick={() => {
                    const rec = briefing.focusRecommendation?.toLowerCase() || '';
                    if (rec.includes('email') || rec.includes('inbox') || rec.includes('cash app') || rec.includes('message from')) {
                      sessionStorage.setItem('pulse_focus_nudge', 'email');
                      setView(AppView.EMAIL);
                    } else if (rec.includes('message') || rec.includes('chat') || rec.includes('conversation')) {
                      sessionStorage.setItem('pulse_focus_nudge', 'message');
                      setView(AppView.MESSAGES);
                    } else if (rec.includes('meeting') || rec.includes('calendar') || rec.includes('event') || rec.includes('task')) {
                      setView(AppView.CALENDAR);
                    } else if (rec.includes('voice') || rec.includes('vox')) {
                      setView(AppView.RELAY);
                    } else {
                      sessionStorage.setItem('pulse_focus_nudge', 'email');
                      setView(AppView.EMAIL);
                    }
                  }}
                  className="group inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 active:bg-rose-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 max-w-full"
                >
                  <Target className="w-4 h-4 shrink-0" />
                  <span className="truncate text-left">{briefing.focusRecommendation}</span>
                  <ArrowRight className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
                </button>
              )}

              {/* Single mono-tracked status line replacing the 4-stat grid */}
              {briefingStats && (
                <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-white/[0.06]">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pulse-label text-zinc-500 dark:text-zinc-400">
                    <span><span className="text-zinc-900 dark:text-zinc-100 font-semibold mr-1">{briefingStats.unreadMessages}</span>UNREAD</span>
                    <span><span className="text-zinc-900 dark:text-zinc-100 font-semibold mr-1">{briefingStats.pendingTasks}</span>TASKS</span>
                    <span><span className="text-zinc-900 dark:text-zinc-100 font-semibold mr-1">{briefingStats.todayMeetings}</span>MEETINGS</span>
                    <span><span className="text-zinc-900 dark:text-zinc-100 font-semibold mr-1">{briefingStats.unplayedVoxes}</span>VOXES</span>
                  </div>
                </div>
              )}

              {/* Highlights + Suggestions: two ranked lists, no cards */}
              {((briefing.highlights && briefing.highlights.length > 0) || briefing.suggestions.length > 0) && (
                <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-white/[0.06] grid gap-x-10 gap-y-6 lg:grid-cols-2">
                  {briefing.highlights && briefing.highlights.length > 0 && (
                    <div>
                      <h3 className="pulse-label text-zinc-500 dark:text-zinc-400 mb-3">HIGHLIGHTS</h3>
                      <ul className="space-y-1">
                        {briefing.highlights.slice(0, 4).map((highlight, idx) => (
                          <li key={idx}>
                            <button
                              onClick={() => handleHighlightAction(highlight.category)}
                              className="w-full text-left flex items-baseline gap-2.5 px-2 py-1.5 -mx-2 rounded hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 group"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 self-center ${
                                  highlight.priority === 'urgent' ? 'bg-red-500'
                                  : highlight.priority === 'high' ? 'bg-orange-500'
                                  : highlight.priority === 'medium' ? 'bg-rose-500'
                                  : 'bg-zinc-400'
                                }`}
                                aria-hidden="true"
                              ></span>
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm text-zinc-900 dark:text-zinc-100 truncate">{highlight.title}</span>
                                <span className="block text-xs text-zinc-500 dark:text-zinc-400 truncate">{highlight.detail}</span>
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors shrink-0 self-center" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {briefing.suggestions.length > 0 && (
                    <div>
                      <h3 className="pulse-label text-zinc-500 dark:text-zinc-400 mb-3">SUGGESTED</h3>
                      <ul className="space-y-1">
                        {briefing.suggestions.slice(0, 4).map((suggestion, idx) => (
                          <li key={idx}>
                            <button
                              onClick={() => suggestion.type === 'ai_assist' && suggestion.aiFeature ? handleAIFeatureClick(suggestion.aiFeature) : handleSuggestionAction(suggestion.type)}
                              className="w-full text-left flex items-baseline gap-2.5 px-2 py-1.5 -mx-2 rounded hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 group"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 self-center ${
                                  suggestion.priority === 'urgent' ? 'bg-red-500'
                                  : suggestion.priority === 'high' ? 'bg-orange-500'
                                  : 'bg-zinc-400'
                                }`}
                                aria-hidden="true"
                              ></span>
                              <span className="flex-1 min-w-0">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  {suggestion.type === 'ai_assist' && (
                                    <ProvenanceChip provider="pulse" kind="ASSIST" className="shrink-0" />
                                  )}
                                  <span className="block text-sm text-zinc-900 dark:text-zinc-100 truncate">{suggestion.action}</span>
                                </span>
                                <span className="block text-xs text-zinc-500 dark:text-zinc-400 truncate">{suggestion.reason}</span>
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors shrink-0 self-center" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Empty state — primary anchor for the dashboard. Bigger type, larger CTA, START HERE cue.
            <div className="py-2 sm:py-4">
              <div className="flex items-center gap-2 mb-4">
                <ProvenanceChip provider="claude" kind="BRIEFING" />
                <span className="pulse-label text-zinc-400 dark:text-zinc-500">START HERE</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-3">
                {contextualGreeting.greeting}
              </h1>
              <p className="text-[15px] text-zinc-600 dark:text-zinc-400 mb-6 max-w-[60ch] leading-relaxed">
                No briefing yet. Generate one to see what needs you today, drafted from your inbox, calendar, and threads.
              </p>
              <button
                onClick={handleRefreshBriefing}
                disabled={loadingBriefing}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white text-sm font-medium transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 shadow-sm shadow-rose-500/10"
              >
                {loadingBriefing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                {loadingBriefing ? 'Generating briefing' : 'Generate briefing'}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Today's Priorities Section */}
      <TodaysPriorities
        priorities={priorities}
        isLoading={isLoading}
        onItemClick={handlePriorityClick}
      />

      {/* Awaiting You — threads where someone is waiting on a response. Deterministic, complements AI priorities. */}
      {!isLoading && awaitingReply.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="pulse-label text-zinc-500 dark:text-zinc-400">
              AWAITING YOU · {awaitingReply.length}
            </h2>
            <button
              onClick={() => setView(AppView.MESSAGES)}
              className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
            >
              VIEW INBOX
            </button>
          </div>
          <ul className="space-y-px">
            {awaitingReply.map(item => (
              <li key={item.threadId}>
                <button
                  onClick={() => {
                    sessionStorage.setItem('pulse_focus_thread', item.threadId);
                    setView(AppView.MESSAGES);
                  }}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 group"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      item.unread ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="flex items-baseline gap-2 min-w-0 flex-1">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 shrink-0">
                      {item.contactName}
                    </span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate min-w-0">
                      {item.preview || 'sent a message'}
                    </span>
                  </span>
                  {item.source && (
                    <span className="pulse-label text-zinc-400 dark:text-zinc-500 shrink-0 hidden sm:inline">
                      {item.source.toUpperCase()}
                    </span>
                  )}
                  <span className="pulse-label text-zinc-500 dark:text-zinc-400 shrink-0 min-w-[2.5rem] text-right">
                    {formatAwaitingAge(item.ageMin)}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Attention & Focus Dashboard */}
      {user?.id && (
        <CollapsibleWidget
          id="attention-focus"
          title="Attention & Focus"
          icon="fa-brain"
          iconColor=""
          isExpanded={expandedWidgets.has('attention-focus')}
          onToggle={toggleWidget}
          className="animate-spring-enter"
          headerAction={
            <button
              onClick={() => setView(AppView.SETTINGS)}
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition"
            >
              Settings
            </button>
          }
        >
          <AttentionDashboard
            userId={user.id}
            onNotificationClick={(notification) => {
              // Navigate to the source of the notification
              if (notification.source === 'messages') {
                setView(AppView.MESSAGES);
              } else if (notification.source === 'email') {
                setView(AppView.EMAIL);
              }
            }}
          />
        </CollapsibleWidget>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 dashboard-stagger">

        {/* Enhanced Quick Journal */}
        <CollapsibleWidget
          id="journal"
          className="animate-spring-enter"
          title="Journal"
          icon="fa-book"
          iconColor="text-rose-500"
          isExpanded={expandedWidgets.has('journal')}
          onToggle={toggleWidget}
          headerAction={
            <button
              onClick={() => setView(AppView.ARCHIVES)}
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition"
            >
              View All
            </button>
          }
        >
          <div className="relative">
            {lastSavedId && (
              <div className="absolute inset-0 bg-white/95 dark:bg-zinc-950/95 z-20 flex items-center justify-center animate-fade-in rounded-lg">
                <div className="text-center">
                  <div className="w-10 h-10 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check className="text-emerald-500" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-widest dark:text-zinc-50 text-zinc-900">Saved</h3>
                  <button
                    onClick={() => setView(AppView.ARCHIVES)}
                    className="mt-2 text-xs text-zinc-400 hover:text-rose-500 transition flex items-center gap-1.5 mx-auto"
                  >
                    <Archive className="text-[10px]" />
                    <span>View in Archive</span>
                  </button>
                </div>
              </div>
            )}

            {/* Scaffolding: rotating greeting question + last-entry pulse-label cue */}
            {!journalText && (
              <div className="mb-4">
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <p className="text-base font-medium text-zinc-800 dark:text-zinc-200">
                    {contextualGreeting.timeOfDay === 'morning' && "What's on your mind?"}
                    {contextualGreeting.timeOfDay === 'afternoon' && "What's working today?"}
                    {contextualGreeting.timeOfDay === 'evening' && "What did you learn?"}
                    {contextualGreeting.timeOfDay === 'night' && "Anything left to capture?"}
                  </p>
                  <span className="pulse-label text-zinc-400 dark:text-zinc-500 shrink-0">
                    {recentJournals.length > 0
                      ? `LAST · ${(() => {
                          const days = Math.floor((Date.now() - recentJournals[0].date.getTime()) / 86_400_000);
                          if (days === 0) return 'TODAY';
                          if (days === 1) return 'YESTERDAY';
                          return `${days}D AGO`;
                        })()}`
                      : 'FIRST ENTRY'}
                  </span>
                </div>
                {/* Starter prompt chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Decision', seed: 'Decision: ' },
                    { label: 'Learning', seed: 'Learning: ' },
                    { label: 'Friction', seed: 'Friction: ' },
                  ].map(chip => (
                    <button
                      key={chip.label}
                      onClick={() => setJournalText(chip.seed)}
                      className="text-xs px-2.5 py-1 rounded-full bg-zinc-50 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              className="w-full bg-transparent border-0 p-0 text-base focus:ring-0 resize-none mb-2 min-h-[180px] dark:text-zinc-200 text-zinc-800 placeholder-zinc-400 dark:placeholder-zinc-500 leading-relaxed font-light"
              placeholder={journalText ? '' : 'Write here, or pick a starter above'}
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
            />

            <div className="flex justify-end gap-4 pulse-label text-zinc-500 dark:text-zinc-400 mb-4">
              <span>{wordCount} WORDS</span>
              <span>{charCount} CHARS</span>
            </div>

            {journalInsight && (
              <div className="mb-4 p-3 rounded-lg bg-zinc-50 dark:bg-white/[0.04] text-sm text-zinc-700 dark:text-zinc-300 animate-fade-in">
                <ProvenanceChip provider="claude" kind="INSIGHT" className="mb-2" />
                <p className="italic leading-relaxed">{journalInsight}</p>
              </div>
            )}

            <div className="flex gap-3 items-center pt-4 border-t border-zinc-100 dark:border-white/[0.06]">
              <button
                onClick={handleJournalAnalyze}
                disabled={saving || !journalText}
                className="pulse-label px-3 py-2 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors duration-150 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              >
                ANALYZE
              </button>
              <div className="flex-1"></div>
              <button
                onClick={handleShare}
                disabled={!journalText}
                className={`w-9 h-9 rounded-lg transition-colors duration-150 flex items-center justify-center disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${journalCopied ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'hover:bg-zinc-100 dark:hover:bg-white/[0.05] text-zinc-500 dark:text-zinc-400'}`}
                title={journalCopied ? 'Copied' : 'Copy to clipboard'}
              >
                {journalCopied ? <Check /> : <Copy />}
              </button>
              <button
                onClick={handleArchive}
                disabled={saving || !journalText}
                className="px-5 py-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950"
              >
                Save
              </button>
            </div>

            {/* Recent Journal Entries */}
            {recentJournals.length > 0 && (
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="pulse-label text-zinc-500 dark:text-zinc-400">RECENT</h4>
                  <button
                    onClick={() => setView(AppView.ARCHIVES)}
                    className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                  >
                    SEE ALL
                  </button>
                </div>
                <ul className="space-y-px">
                  {recentJournals.map(journal => (
                    <li key={journal.id}>
                      <button
                        onClick={() => setView(AppView.ARCHIVES)}
                        className="w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 group"
                      >
                        <span className="pulse-label text-zinc-400 dark:text-zinc-500 shrink-0">
                          {journal.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
                        </span>
                        <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate flex-1 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                          {journal.content.replace('Entry: ', '').slice(0, 60)}...
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleWidget>

        {/* Quick Scheduler Widget */}
        <CollapsibleWidget
          id="scheduler"
          title="Quick Scheduler"
          icon="fa-calendar-plus"
          iconColor="text-rose-500"
          isExpanded={expandedWidgets.has('scheduler')}
          onToggle={toggleWidget}
        >
          <QuickScheduler />
        </CollapsibleWidget>

        {/* Attention & Widgets Column */}
        <div className="flex flex-col gap-6 animate-spring-enter">

          {/* Attention Budget Widget */}
          <CollapsibleWidget
            id="attention-budget"
            title="Attention Budget"
            icon="fa-brain"
            iconColor="text-rose-400"
            isExpanded={expandedWidgets.has('attention-budget')}
            onToggle={toggleWidget}
            headerAction={
              <span className={`text-xs font-bold px-2 py-1 rounded ${attentionLoad > 80 ? 'bg-red-100 text-red-600' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                {attentionLoad > 80 ? 'Overloaded' : 'Healthy'}
              </span>
            }
          >
            <div className="mb-4">
              <div className="flex justify-between text-xs text-zinc-500 mb-2">
                <span>Cognitive Load</span>
                <span>{attentionLoad}%</span>
              </div>
              <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${attentionLoad > 80 ? 'bg-red-500' : attentionLoad > 50 ? 'bg-yellow-500' : 'bg-rose-500'}`}
                  style={{ width: `${attentionLoad}%` }}
                ></div>
              </div>
            </div>

            {batchedNotifications.length > 0 ? (
              <div className="pt-3 border-t border-zinc-100 dark:border-white/[0.06]">
                <div className="flex justify-between items-center mb-2">
                  <span className="pulse-label text-zinc-500 dark:text-zinc-400">BATCHED · {batchedNotifications.length}</span>
                  <button onClick={() => setBatchedNotifications([])} className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors">CLEAR</button>
                </div>
                <ul className="space-y-px">
                  {batchedNotifications.slice(0, 3).map(n => (
                    <li key={n.id} className="flex items-baseline gap-3 px-2 py-1.5 -mx-2 rounded">
                      <span className="pulse-label text-zinc-400 dark:text-zinc-500 shrink-0 min-w-[40px]">{n.source.toUpperCase()}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs text-zinc-700 dark:text-zinc-300 truncate">{n.message}</span>
                        <span className="pulse-label text-zinc-400 dark:text-zinc-500">{n.time.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-3">Nothing batched. Stay sharp.</p>
            )}
          </CollapsibleWidget>

          {/* Mini Pulse AI */}
          <div className="bg-white dark:bg-white/[0.03] rounded-xl p-5 border border-zinc-200 dark:border-white/[0.06] transition-colors duration-150">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Ask Pulse AI</h3>
              <ProvenanceChip provider="pulse" kind="ASSIST" />
            </div>
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {["Summarize my day", "What's urgent?", "Draft a reply"].map(chip => (
                <button
                  key={chip}
                  onClick={() => handlePulseAiQuery(chip)}
                  className="text-xs px-3 py-1 rounded-full bg-zinc-50 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                >
                  {chip}
                </button>
              ))}
            </div>
            {/* Input */}
            <form onSubmit={(e) => { e.preventDefault(); handlePulseAiQuery(pulseAiQuery); }}>
              <div className="relative">
                <input
                  type="text"
                  value={pulseAiQuery}
                  onChange={(e) => setPulseAiQuery(e.target.value)}
                  placeholder="Ask anything"
                  className="w-full bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-rose-500/40 focus:ring-2 focus:ring-rose-500/20 focus:outline-none transition-colors duration-150 pr-9"
                />
                <button type="submit" disabled={loadingPulseAi || !pulseAiQuery.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 disabled:opacity-40 transition-colors">
                  {loadingPulseAi ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </form>
            {/* Response */}
            {pulseAiResponse && (
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-white/[0.06] animate-fade-in">
                <ProvenanceChip provider="pulse" kind="ANSWER" className="mb-2" />
                <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 line-clamp-4">{pulseAiResponse}</p>
                <div className="flex items-center justify-between mt-2.5">
                  <button onClick={() => setView(AppView.LIVE_AI)} className="pulse-label text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors">
                    OPEN PULSE AI →
                  </button>
                  <button onClick={() => setPulseAiResponse(null)} className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">CLEAR</button>
                </div>
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          <div className="bg-white dark:bg-white/[0.03] rounded-xl p-5 border border-zinc-200 dark:border-white/[0.06] transition-colors duration-150">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Upcoming</h3>
              </div>
              <button onClick={() => setView(AppView.CALENDAR)} className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors">VIEW ALL</button>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-3">No upcoming events</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(event => {
                  const start = new Date(event.start);
                  const now = new Date();
                  const diffMs = start.getTime() - now.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  const diffHours = Math.floor(diffMins / 60);
                  const diffDays = Math.floor(diffHours / 24);
                  const countdown = diffDays > 0
                    ? `in ${diffDays}d`
                    : diffHours > 0
                    ? `in ${diffHours}h`
                    : diffMins > 0
                    ? `in ${diffMins}m`
                    : 'now';
                  const timeStr = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                  return (
                    <div key={event.id} className="flex items-center justify-between gap-2 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                        <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{event.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-right">
                        <span className="text-xs text-zinc-400">{timeStr}</span>
                        <span className="text-xs font-medium text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-full">{countdown}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Unread widget removed — replaced by the Awaiting You section above Priorities, which surfaces the actionable subset. */}

        </div>
      </div>

      {/* Quick Actions Floating Button — Rendered via Portal */}
      {ReactDOM.createPortal(
        <div className="fixed bottom-6 right-6 z-[9999]" style={{ position: 'fixed' }}>
          {showQuickActions && (
            <div
              className="absolute bottom-full right-0 mb-3 w-56 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.08] shadow-lg overflow-hidden animate-fade-in"
              role="menu"
            >
              <ul className="py-1">
                {quickActions.map(action => (
                  <li key={action.id}>
                    <button
                      onClick={() => {
                        const params: Record<string, boolean> = {};
                        if (action.openTaskPanel) params.openTaskPanel = true;
                        if (action.openAddContact) params.openAddContact = true;
                        setView(action.view, Object.keys(params).length > 0 ? params : undefined);
                        setShowQuickActions(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/[0.04] hover:text-rose-600 dark:hover:text-rose-400 focus-visible:outline-none focus-visible:bg-zinc-50 dark:focus-visible:bg-white/[0.04] transition-colors duration-150"
                      role="menuitem"
                    >
                      <i className={`fa-solid ${action.icon} w-4 text-center text-zinc-400 dark:text-zinc-500`}></i>
                      <span>{action.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKbdOverlay(true)}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              className="hidden sm:inline-flex w-9 h-9 rounded-full items-center justify-center bg-white dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-white/[0.10] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 shadow-sm"
            >
              <span className="font-mono text-sm">?</span>
            </button>
            <button
              onClick={() => setShowQuickActions(!showQuickActions)}
              aria-expanded={showQuickActions}
              aria-label={showQuickActions ? 'Close quick actions' : 'Open quick actions'}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 ${
                showQuickActions
                  ? 'bg-zinc-200 dark:bg-white/[0.08] text-zinc-700 dark:text-zinc-200 rotate-45'
                  : 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white shadow-md shadow-rose-500/20'
              }`}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Persistent activity badge — bottom-left corner. Shows briefly after any save. */}
      {lastSavedAt && ReactDOM.createPortal(
        <div
          className="fixed bottom-6 left-6 z-[9998] pulse-label inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400 shadow-sm animate-fade-in pointer-events-none"
          aria-live="polite"
          role="status"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
          SAVED {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>,
        document.body
      )}

      {/* Keyboard Shortcuts Overlay */}
      {showKbdOverlay && ReactDOM.createPortal(
        <div
          className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 animate-fade-in"
          onClick={() => setShowKbdOverlay(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <div
            className="bg-white dark:bg-zinc-950 rounded-xl w-full max-w-md shadow-2xl border border-zinc-200 dark:border-white/[0.08] overflow-hidden animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-white/[0.06]">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Keyboard shortcuts</h3>
              <button
                onClick={() => setShowKbdOverlay(false)}
                className="w-7 h-7 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                aria-label="Close shortcuts"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <dl className="px-5 py-4 space-y-2">
              {[
                { keys: ['⌘', 'K'], desc: 'Command palette' },
                { keys: ['/'], desc: 'Focus search' },
                { keys: ['J'], desc: 'Open top priority' },
                { keys: ['K'], desc: 'Open second priority' },
                { keys: ['R'], desc: 'Refresh briefing' },
                { keys: ['?'], desc: 'Toggle this list' },
                { keys: ['Esc'], desc: 'Close menus and overlays' },
              ].map(({ keys, desc }) => (
                <div key={desc} className="flex items-center justify-between gap-4 py-1">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{desc}</span>
                  <span className="flex items-center gap-1">
                    {keys.map(k => (
                      <kbd key={k} className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-2 rounded text-xs font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08]">
                        {k}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </dl>
            <div className="px-5 py-3 border-t border-zinc-100 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02]">
              <p className="pulse-label text-zinc-400 dark:text-zinc-500">PRESS <kbd className="font-mono normal-case tracking-normal">?</kbd> ANY TIME</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Productivity Analytics Section */}
      <CollapsibleWidget
        id="analytics"
        title="Productivity Analytics"
        icon="fa-chart-line"
        iconColor="text-rose-500"
        isExpanded={expandedWidgets.has('analytics')}
        onToggle={toggleWidget}
        headerAction={
          <div className="flex items-center gap-1" role="tablist" aria-label="Time range">
            {(['day', 'week', 'month'] as const).map(range => (
              <button
                key={range}
                onClick={(e) => { e.stopPropagation(); setAnalyticsTimeRange(range); }}
                role="tab"
                aria-selected={analyticsTimeRange === range}
                className={`pulse-label px-2.5 py-1 rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                  analyticsTimeRange === range
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        }
      >
        {/* Metric row — inline mono status line. The chart below is the visual anchor. */}
        <dl className="flex flex-wrap items-baseline gap-x-7 gap-y-2 mb-6">
          <div className="flex items-baseline gap-2">
            <dt className="pulse-label text-zinc-500 dark:text-zinc-400">TASKS</dt>
            <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {productivityMetrics.tasksCompleted}
              <span className="text-zinc-400 dark:text-zinc-500 font-normal">/{productivityMetrics.tasksTotal}</span>
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="pulse-label text-zinc-500 dark:text-zinc-400">MESSAGES</dt>
            <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {productivityMetrics.messagesSent + productivityMetrics.messagesReceived}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="pulse-label text-zinc-500 dark:text-zinc-400">FOCUS</dt>
            <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{formatFocusTime(productivityMetrics.focusTime)}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="pulse-label text-zinc-500 dark:text-zinc-400">AVG REPLY</dt>
            <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {productivityMetrics.responseTime > 0 ? `${productivityMetrics.responseTime}m` : '–'}
            </dd>
          </div>
        </dl>

        {/* Weekly chart — flat bars, no gradient, lives directly inside the widget (no nested card) */}
        <div className="pt-4 border-t border-zinc-100 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <h4 className="pulse-label text-zinc-500 dark:text-zinc-400">WEEKLY ACTIVITY</h4>
            <div className="flex gap-1" role="tablist" aria-label="Weekly metric">
              {(['tasks', 'messages', 'meetings'] as const).map(metric => (
                <button
                  key={metric}
                  onClick={() => setSelectedMetric(metric)}
                  role="tab"
                  aria-selected={selectedMetric === metric}
                  className={`pulse-label px-2 py-1 rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                    selectedMetric === metric
                      ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {metric.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-2 h-28">
            {weeklyData.map((day) => (
              <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-zinc-100 dark:bg-white/[0.05] rounded relative overflow-hidden" style={{ height: '100%' }}>
                  <div
                    className="absolute bottom-0 w-full bg-rose-500 rounded transition-all duration-500"
                    style={{ height: `${(day[selectedMetric] / maxChartValue) * 100}%` }}
                  ></div>
                </div>
                <span className="pulse-label text-zinc-400 dark:text-zinc-500">{day.day.toUpperCase()}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-baseline mt-4 pt-3 border-t border-zinc-100 dark:border-white/[0.06]">
            <span className="pulse-label text-zinc-500 dark:text-zinc-400">TOTAL · WEEK</span>
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {weeklyTotals[selectedMetric]} {selectedMetric}
            </span>
          </div>
        </div>
      </CollapsibleWidget>

      {/* Goals & Team Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 dashboard-stagger">
        {/* Goals Progress */}
        <CollapsibleWidget
          id="goals"
          title="Weekly Goals"
          icon="fa-bullseye"
          iconColor=""
          isExpanded={expandedWidgets.has('goals')}
          onToggle={toggleWidget}
          headerAction={
            <button
              onClick={(e) => { e.stopPropagation(); setShowGoalEditor(true); }}
              className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              EDIT GOALS
            </button>
          }
        >
          <div className="space-y-4">
            {goals
              .filter(goal => goal.enabled !== false)
              .map(goal => {
                const progressPercent = Math.min((goal.progress / Math.max(goal.target, 1)) * 100, 100);
                const trendIcon = goal.trend === 'up' ? 'fa-arrow-up' : goal.trend === 'down' ? 'fa-arrow-down' : 'fa-minus';
                const trendColor = goal.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : goal.trend === 'down' ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400';

                return (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {goal.icon && (
                          <i className={`fa-solid ${goal.icon} text-xs text-zinc-400 dark:text-zinc-500 w-3 text-center`}></i>
                        )}
                        <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{goal.title}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="pulse-label text-zinc-500 dark:text-zinc-400">
                          {goal.progress}/{goal.target}{goal.unit ? ` ${goal.unit.toUpperCase()}` : ''}
                        </span>
                        <span className={`pulse-label inline-flex items-center gap-0.5 ${trendColor}`}>
                          <i className={`fa-solid ${trendIcon} text-[9px]`}></i>
                          {goal.trend.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-zinc-100 dark:bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          progressPercent >= 100 ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            {goals.filter(goal => goal.enabled !== false).length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">No goals enabled.</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">Pick a few from <span className="text-zinc-700 dark:text-zinc-300">Edit Goals</span> to start tracking.</p>
              </div>
            )}
          </div>
        </CollapsibleWidget>

        {/* Team Activity */}
        <CollapsibleWidget
          id="team"
          title="Team Activity"
          icon="fa-users"
          iconColor=""
          isExpanded={expandedWidgets.has('team')}
          onToggle={toggleWidget}
          headerAction={
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              {teams.length > 0 && (
                <select
                  value={selectedTeamId || ''}
                  onChange={(e) => setSelectedTeamId(e.target.value || null)}
                  className="pulse-label bg-transparent border border-zinc-200 dark:border-white/[0.08] rounded px-2 py-1 text-zinc-600 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                  onClick={e => e.stopPropagation()}
                >
                  <option value="">ALL CONTACTS</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedTeamId) {
                    const team = teams.find(t => t.id === selectedTeamId);
                    if (team) {
                      setTeamBuilderName(team.name);
                      setTeamBuilderDescription(team.description || '');
                      setTeamBuilderSelectedMembers(team.members.map(m => ({
                        type: m.memberType,
                        id: m.memberId,
                        name: m.name || 'Unknown',
                      })));
                    }
                  } else {
                    setTeamBuilderName('');
                    setTeamBuilderDescription('');
                    setTeamBuilderSelectedMembers([]);
                  }
                  setShowTeamBuilder(true);
                }}
                className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              >
                {selectedTeamId ? 'EDIT TEAM' : teams.length > 0 ? 'NEW TEAM' : 'BUILD TEAM'}
              </button>
            </div>
          }
        >
          {(() => {
            // Get members to display based on selected team
            let membersToDisplay: TeamMember[] = [];
            
            if (selectedTeamId) {
              const selectedTeam = teams.find(t => t.id === selectedTeamId);
              if (selectedTeam) {
                membersToDisplay = selectedTeam.members.map(m => ({
                  id: m.memberId,
                  name: m.name || 'Unknown',
                  avatarColor: m.avatarColor || 'bg-zinc-200 dark:bg-white/[0.08] text-zinc-700 dark:text-zinc-200',
                  status: m.status || 'offline',
                  unreadCount: 0,
                }));
              }
            } else {
              // Fallback to teamMembers if no team selected
              membersToDisplay = teamMembers;
            }

            if (membersToDisplay.length === 0) {
              return (
                <div className="py-6">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                    {selectedTeamId ? 'This team has no members yet.' : 'No team yet. Build one to track activity.'}
                  </p>
                  <button
                    onClick={() => {
                      if (selectedTeamId) {
                        const team = teams.find(t => t.id === selectedTeamId);
                        if (team) {
                          setTeamBuilderName(team.name);
                          setTeamBuilderDescription(team.description || '');
                          setTeamBuilderSelectedMembers(team.members.map(m => ({
                            type: m.memberType,
                            id: m.memberId,
                            name: m.name || 'Unknown',
                          })));
                        }
                      }
                      setShowTeamBuilder(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950"
                  >
                    {selectedTeamId ? 'Add members' : 'Build team'}
                  </button>
                </div>
              );
            }

            return (
              <ul className="space-y-px">
                {membersToDisplay.slice(0, 5).map(member => (
                  <li key={member.id}>
                    <button
                      onClick={() => setView(AppView.MESSAGES)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 group"
                    >
                      <div className="relative shrink-0">
                        <div className={`w-9 h-9 rounded-full ${member.avatarColor} flex items-center justify-center text-white font-semibold text-sm`}>
                          {member.name.charAt(0)}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-950 ${getStatusColor(member.status)}`}></div>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{member.name}</span>
                          {member.unreadCount && member.unreadCount > 0 && (
                            <span className="pulse-label inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded bg-rose-500 text-white shrink-0">
                              {member.unreadCount}
                            </span>
                          )}
                        </div>
                        <span className="pulse-label text-zinc-400 dark:text-zinc-500">{member.status.toUpperCase()}</span>
                      </div>
                      <MessageSquare className="opacity-0 group-hover:opacity-100 w-4 h-4 text-zinc-400 dark:text-zinc-500 transition-opacity" />
                    </button>
                  </li>
                ))}
              </ul>
            );
          })()}
        </CollapsibleWidget>

        {/* Team Health Dashboard */}
        {teamMembers.length > 0 && (
          <CollapsibleWidget
            id="team-health"
            title="Team Health Dashboard"
            icon="fa-heart-pulse"
            iconColor="text-rose-400"
            isExpanded={expandedWidgets.has('team-health')}
            className="lg:col-span-2 animate-spring-enter"
            onToggle={toggleWidget}
          >
            {loadingTeamHealth ? (
              <div className="py-8 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-400 dark:text-zinc-500" />
              </div>
            ) : teamHealthMetrics ? (
              <div className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
                {/* Communication */}
                <section className="py-5 first:pt-0">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                    <h4 className="pulse-label text-zinc-500 dark:text-zinc-400">COMMUNICATION</h4>
                  </div>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                    <div>
                      <dt className="pulse-label text-zinc-500 dark:text-zinc-400 mb-1">ENGAGEMENT</dt>
                      <dd className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{teamHealthMetrics.communicationHealth.engagementScore}<span className="text-xs font-normal text-zinc-400 dark:text-zinc-500 ml-1">/ 100</span></dd>
                    </div>
                    <div>
                      <dt className="pulse-label text-zinc-500 dark:text-zinc-400 mb-1">AVG REPLY</dt>
                      <dd className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                        {teamHealthMetrics.communicationHealth.avgResponseTime > 0
                          ? `${Math.round(teamHealthMetrics.communicationHealth.avgResponseTime)}m`
                          : '–'}
                      </dd>
                    </div>
                    <div>
                      <dt className="pulse-label text-zinc-500 dark:text-zinc-400 mb-1">MESSAGES</dt>
                      <dd className="text-sm text-zinc-700 dark:text-zinc-300">
                        {teamHealthMetrics.communicationHealth.messageVolume.sent} sent · {teamHealthMetrics.communicationHealth.messageVolume.received} in
                      </dd>
                    </div>
                    <div>
                      <dt className="pulse-label text-zinc-500 dark:text-zinc-400 mb-1">ACTIVE</dt>
                      <dd className="text-sm text-zinc-700 dark:text-zinc-300">
                        {teamHealthMetrics.communicationHealth.activeConversations}
                        {teamHealthMetrics.communicationHealth.unreadCount > 0 && (
                          <span className="text-rose-600 dark:text-rose-400 ml-1">· {teamHealthMetrics.communicationHealth.unreadCount} unread</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>

                {/* Votes & Decisions */}
                <section className="py-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckSquare className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                    <h4 className="pulse-label text-zinc-500 dark:text-zinc-400">DECISIONS</h4>
                  </div>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                    <div>
                      <dt className="pulse-label text-zinc-500 dark:text-zinc-400 mb-1">ACTIVE</dt>
                      <dd className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{teamHealthMetrics.votes.activeDecisions}</dd>
                    </div>
                    <div>
                      <dt className="pulse-label text-zinc-500 dark:text-zinc-400 mb-1">PENDING VOTES</dt>
                      <dd className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                        {teamHealthMetrics.votes.pendingVotes}
                        {teamHealthMetrics.votes.pendingVotes > 0 && (
                          <span className="ml-2 align-middle inline-block w-1.5 h-1.5 rounded-full bg-orange-500" aria-hidden="true"></span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="pulse-label text-zinc-500 dark:text-zinc-400 mb-1">CONSENSUS</dt>
                      <dd className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{teamHealthMetrics.votes.consensusRate}<span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">%</span></dd>
                    </div>
                    <div>
                      <dt className="pulse-label text-zinc-500 dark:text-zinc-400 mb-1">RESOLVED</dt>
                      <dd className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{teamHealthMetrics.votes.decisionsMade}</dd>
                    </div>
                  </dl>
                </section>

                {/* Projects */}
                <section className="py-5 last:pb-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                    <h4 className="pulse-label text-zinc-500 dark:text-zinc-400">PROJECTS</h4>
                  </div>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                    <div>
                      <dt className="pulse-label text-zinc-500 dark:text-zinc-400 mb-1">ACTIVE</dt>
                      <dd className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{teamHealthMetrics.projects.activeOutcomes}</dd>
                    </div>
                    <div>
                      <dt className="pulse-label text-zinc-500 dark:text-zinc-400 mb-1">AVG PROGRESS</dt>
                      <dd className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{teamHealthMetrics.projects.avgProgress}<span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">%</span></dd>
                    </div>
                    <div>
                      <dt className="pulse-label text-zinc-500 dark:text-zinc-400 mb-1">COMPLETION</dt>
                      <dd className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{teamHealthMetrics.projects.completionRate}<span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">%</span></dd>
                    </div>
                    <div>
                      <dt className="pulse-label text-zinc-500 dark:text-zinc-400 mb-1">BLOCKERS</dt>
                      <dd className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                        {teamHealthMetrics.projects.blockers}
                        {teamHealthMetrics.projects.blockers > 0 && (
                          <span className="ml-2 align-middle inline-block w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true"></span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-6">No team health data yet.</p>
            )}
          </CollapsibleWidget>
        )}
      </div>

      {/* Team Builder Modal */}
      {showTeamBuilder && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => {
          setShowTeamBuilder(false);
          setTeamBuilderName('');
          setTeamBuilderDescription('');
          setTeamBuilderSearchQuery('');
          setTeamBuilderSelectedMembers([]);
          setTeamBuilderTab('pulse');
          setTeamBuilderError(null);
          setConfirmDeleteTeam(false);
        }}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col animate-scale-in border border-zinc-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-xl font-bold dark:text-zinc-50 flex items-center gap-2">
                  <Users className="text-rose-500" />
                  {selectedTeamId ? 'Edit Team' : 'Create New Team'}
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Add Pulse users and contacts to your team</p>
              </div>
              <button onClick={() => {
                setShowTeamBuilder(false);
                setTeamBuilderName('');
                setTeamBuilderDescription('');
                setTeamBuilderSearchQuery('');
                setTeamBuilderSelectedMembers([]);
                setTeamBuilderTab('pulse');
                setTeamBuilderError(null);
                setConfirmDeleteTeam(false);
              }} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                <X />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Team Configuration */}
              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Team Name *</label>
                  <input
                    type="text"
                    value={teamBuilderName}
                    onChange={(e) => setTeamBuilderName(e.target.value)}
                    placeholder="e.g., Engineering Team, Marketing Squad"
                    className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Description (Optional)</label>
                  <textarea
                    value={teamBuilderDescription}
                    onChange={(e) => setTeamBuilderDescription(e.target.value)}
                    placeholder="What is this team for?"
                    rows={2}
                    className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-4 border-b border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => setTeamBuilderTab('pulse')}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    teamBuilderTab === 'pulse'
                      ? 'text-rose-500 border-b-2 border-rose-500'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <UserCheck className="mr-2" />Pulse Users
                </button>
                <button
                  onClick={() => setTeamBuilderTab('contacts')}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    teamBuilderTab === 'contacts'
                      ? 'text-rose-500 border-b-2 border-rose-500'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <BookUser className="mr-2" />Contacts
                </button>
              </div>

              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm" />
                  <input
                    type="text"
                    value={teamBuilderSearchQuery}
                    onChange={(e) => setTeamBuilderSearchQuery(e.target.value)}
                    placeholder={teamBuilderTab === 'pulse' ? 'Search Pulse users by name or @handle...' : 'Search contacts...'}
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Selected Members */}
              {teamBuilderSelectedMembers.length > 0 && (
                <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl">
                  <div className="pulse-label text-rose-700 dark:text-rose-300 mb-2">
                    SELECTED · {teamBuilderSelectedMembers.length}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {teamBuilderSelectedMembers.map((member, idx) => (
                      <div
                        key={`${member.type}-${member.id}-${idx}`}
                        className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-zinc-800 rounded-lg text-xs"
                      >
                        <span className="text-zinc-700 dark:text-zinc-300">{member.name}</span>
                        <button
                          onClick={() => {
                            setTeamBuilderSelectedMembers(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-zinc-400 hover:text-red-500"
                        >
                          <X />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Member List - See full implementation in previous response */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {teamBuilderTab === 'pulse' ? (
                  (() => {
                    const filteredPulseUsers = pulseUsers.filter(user => {
                      const query = teamBuilderSearchQuery.toLowerCase();
                      const name = (user.display_name || user.full_name || '').toLowerCase();
                      const handle = (user.handle || '').toLowerCase();
                      return name.includes(query) || handle.includes(query);
                    });

                    if (filteredPulseUsers.length === 0) {
                      return (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <UserPlus className="text-2xl text-zinc-400" />
                          </div>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">No Pulse users found</p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">Start messaging Pulse users to see them here</p>
                        </div>
                      );
                    }

                    return filteredPulseUsers.map(user => {
                      const isSelected = teamBuilderSelectedMembers.some(m => m.type === 'pulse_user' && m.id === user.id);
                      return (
                        <div
                          key={user.id}
                          className={`flex items-center gap-3 p-3 rounded-xl transition ${
                            isSelected
                              ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-800'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-white/[0.08] text-zinc-700 dark:text-zinc-200 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              (user.display_name || user.full_name || 'U').charAt(0)
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm dark:text-zinc-50 truncate flex items-center gap-2">
                              {user.display_name || user.full_name || 'Pulse User'}
                              {user.is_verified && <CheckCircle2 className="text-rose-500 text-xs" />}
                            </div>
                            {user.handle && (
                              <div className="text-xs text-emerald-500 truncate">@{user.handle}</div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              if (isSelected) {
                                setTeamBuilderSelectedMembers(prev => prev.filter(m => !(m.type === 'pulse_user' && m.id === user.id)));
                              } else {
                                setTeamBuilderSelectedMembers(prev => [...prev, {
                                  type: 'pulse_user' as const,
                                  id: user.id,
                                  name: user.display_name || user.full_name || 'Pulse User',
                                }]);
                              }
                            }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                              isSelected
                                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                                : 'bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            {isSelected ? 'Added' : 'Add'}
                          </button>
                        </div>
                      );
                    });
                  })()
                ) : (
                  (() => {
                    const filteredContacts = teamBuilderContacts.filter(contact => {
                      const query = teamBuilderSearchQuery.toLowerCase();
                      const name = (contact.name || '').toLowerCase();
                      const phone = (contact.phone || '').toLowerCase();
                      return name.includes(query) || phone.includes(query);
                    });

                    if (loadingTeamBuilderContacts) {
                      return (
                        <div className="text-center py-12">
                          <Loader2 className="w-6 h-6 animate-spin text-zinc-400 dark:text-zinc-500 mx-auto" />
                        </div>
                      );
                    }

                    if (filteredContacts.length === 0) {
                      return (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BookUser className="text-2xl text-zinc-400" />
                          </div>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">No SMS-enabled contacts found</p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">Add contacts with phone numbers to see them here</p>
                        </div>
                      );
                    }

                    return filteredContacts.map(contact => {
                      const isSelected = teamBuilderSelectedMembers.some(m => m.type === 'contact' && m.id === contact.id);
                      return (
                        <div
                          key={contact.id}
                          className={`flex items-center gap-3 p-3 rounded-xl transition ${
                            isSelected
                              ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-800'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full ${contact.avatarColor} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                            {contact.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm dark:text-zinc-50 truncate">{contact.name}</div>
                            {contact.phone && (
                              <div className="text-xs text-zinc-500 truncate">{contact.phone}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!contact.pulseUserId && (
                              <button
                                disabled
                                className="px-2 py-1 text-xs font-medium text-zinc-400 dark:text-zinc-600 cursor-not-allowed rounded"
                                title="Invite to Pulse, coming soon"
                              >
                                <Send />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (isSelected) {
                                  setTeamBuilderSelectedMembers(prev => prev.filter(m => !(m.type === 'contact' && m.id === contact.id)));
                                } else {
                                  setTeamBuilderSelectedMembers(prev => [...prev, {
                                    type: 'contact' as const,
                                    id: contact.id,
                                    name: contact.name,
                                  }]);
                                }
                              }}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                                isSelected
                                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                                  : 'bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              {isSelected ? 'Added' : 'Add'}
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowTeamBuilder(false);
                  setTeamBuilderName('');
                  setTeamBuilderDescription('');
                  setTeamBuilderSearchQuery('');
                  setTeamBuilderSelectedMembers([]);
                  setTeamBuilderTab('pulse');
                  setTeamBuilderError(null);
                  setConfirmDeleteTeam(false);
                }}
                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
              >
                Cancel
              </button>
              <div className="flex flex-col gap-3">
                {/* Inline error/confirm feedback */}
                {teamBuilderError && (
                  <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 rounded-lg text-xs text-red-600 dark:text-red-400">
                    {teamBuilderError}
                  </div>
                )}
                {confirmDeleteTeam && (
                  <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-4">
                    <span>Delete this team permanently?</span>
                    <button onClick={() => setConfirmDeleteTeam(false)} className="font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition">Cancel</button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                {selectedTeamId && (
                  <button
                    onClick={async () => {
                      if (!confirmDeleteTeam) { setConfirmDeleteTeam(true); return; }
                      setConfirmDeleteTeam(false);
                      try {
                        await teamService.deleteTeam(selectedTeamId);
                        await loadTeams();
                        setSelectedTeamId(null);
                        setShowTeamBuilder(false);
                        setTeamBuilderName('');
                        setTeamBuilderDescription('');
                        setTeamBuilderSearchQuery('');
                        setTeamBuilderSelectedMembers([]);
                      } catch (error) {
                        console.error('Failed to delete team:', error);
                        setTeamBuilderError('Failed to delete team. Please try again.');
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition"
                  >
                    Delete Team
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (!teamBuilderName.trim()) {
                      setTeamBuilderError('Please enter a team name.');
                      return;
                    }
                    setTeamBuilderError(null);

                    try {
                      if (selectedTeamId) {
                        await teamService.updateTeam(selectedTeamId, {
                          name: teamBuilderName,
                          description: teamBuilderDescription || undefined,
                        });
                        
                        const currentTeam = teams.find(t => t.id === selectedTeamId);
                        if (currentTeam) {
                          const membersToRemove = currentTeam.members.filter(
                            m => !teamBuilderSelectedMembers.some(sm => sm.type === m.memberType && sm.id === m.memberId)
                          );
                          for (const member of membersToRemove) {
                            await teamService.removeMember(selectedTeamId, member.memberId);
                          }

                          const membersToAdd = teamBuilderSelectedMembers
                            .filter(sm => !currentTeam.members.some(m => m.memberType === sm.type && m.memberId === sm.id))
                            .map(m => ({ type: m.type, id: m.id }));
                          if (membersToAdd.length > 0) {
                            await teamService.addMembers(selectedTeamId, membersToAdd);
                          }
                        }
                      } else {
                        await teamService.createTeam(
                          teamBuilderName,
                          teamBuilderDescription || undefined,
                          undefined,
                          teamBuilderSelectedMembers.map(m => ({ type: m.type, id: m.id }))
                        );
                      }

                      await loadTeams();
                      setShowTeamBuilder(false);
                      setTeamBuilderName('');
                      setTeamBuilderDescription('');
                      setTeamBuilderSearchQuery('');
                      setTeamBuilderSelectedMembers([]);
                      setTeamBuilderTab('pulse');
                    } catch (error: any) {
                      console.error('Failed to save team:', error);
                      const errorMessage = error?.message || error?.error?.message || 'Unknown error';
                      setTeamBuilderError(`Failed to save team: ${errorMessage}`);
                    }
                  }}
                  className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-semibold transition shadow-lg shadow-rose-500/25"
                >
                  {selectedTeamId ? 'Save Changes' : 'Create Team'}
                </button>
                </div>{/* end buttons row */}
              </div>{/* end footer flex-col */}
            </div>
          </div>
        </div>
      )}

      {/* Goal Editor Modal */}
      {showGoalEditor && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowGoalEditor(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col animate-scale-in border border-zinc-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-xl font-bold dark:text-zinc-50 flex items-center gap-2">
                  <Target className="text-rose-500" />
                  Edit Goals
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Customize your weekly productivity targets</p>
              </div>
              <button onClick={() => setShowGoalEditor(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                <X />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 bg-zinc-50 dark:bg-zinc-950/50">
              <button
                onClick={() => setGoalEditorTab('all')}
                className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                  goalEditorTab === 'all'
                    ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <List className="mr-2" />
                All Goals
              </button>
              <button
                onClick={() => setGoalEditorTab('productivity')}
                className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                  goalEditorTab === 'productivity'
                    ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <TrendingUp className="mr-2" />
                Productivity
              </button>
              <button
                onClick={() => setGoalEditorTab('communication')}
                className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                  goalEditorTab === 'communication'
                    ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <MessagesSquare className="mr-2" />
                Communication
              </button>
              <button
                onClick={() => setGoalEditorTab('wellness')}
                className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                  goalEditorTab === 'wellness'
                    ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <Heart className="mr-2" />
                Wellness
              </button>
            </div>

            {/* Goals List - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {goals
                .filter(goal => goalEditorTab === 'all' || goal.category === goalEditorTab)
                .map(goal => {
                  const progressPercent = Math.min((goal.progress / Math.max(goal.target, 1)) * 100, 100);
                  const isEnabled = goal.enabled !== false;

                  return (
                    <div
                      key={goal.id}
                      className={`p-4 rounded-xl border transition-colors duration-150 ${
                        isEnabled
                          ? 'bg-zinc-50 dark:bg-white/[0.04] border-zinc-200 dark:border-white/[0.06]'
                          : 'bg-zinc-50/60 dark:bg-white/[0.02] border-zinc-200 dark:border-white/[0.04] opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-white/[0.06] flex items-center justify-center text-zinc-600 dark:text-zinc-300">
                            <i className={`fa-solid ${goal.icon || 'fa-bullseye'} text-sm`}></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-semibold text-sm ${isEnabled ? 'dark:text-zinc-50' : 'text-zinc-400 dark:text-zinc-500'}`}>
                                {goal.title}
                              </span>
                              {!isEnabled && (
                                <span className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 text-[10px] font-medium rounded">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-zinc-500">{goal.unit}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleGoal(goal.id)}
                          className={`h-10 rounded-lg flex items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 ${
                            pendingDisableId === goal.id
                              ? 'px-3 bg-red-500/10 text-red-600 dark:text-red-400 pulse-label'
                              : isEnabled
                                ? 'w-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                : 'w-10 bg-zinc-200 dark:bg-white/[0.06] text-zinc-400 dark:text-zinc-500'
                          }`}
                          title={
                            pendingDisableId === goal.id
                              ? 'Click again to disable'
                              : isEnabled ? 'Disable goal' : 'Enable goal'
                          }
                        >
                          {pendingDisableId === goal.id ? (
                            <span>CLICK TO CONFIRM</span>
                          ) : (
                            <i className={`fa-solid ${isEnabled ? 'fa-toggle-on' : 'fa-toggle-off'} text-lg`}></i>
                          )}
                        </button>
                      </div>

                      {isEnabled && (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              {goal.progress} / {goal.target}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              goal.trend === 'up' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                              goal.trend === 'down' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}>
                              <i className={`fa-solid ${goal.trend === 'up' ? 'fa-arrow-up' : goal.trend === 'down' ? 'fa-arrow-down' : 'fa-minus'} mr-1`}></i>
                              {goal.trend}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="h-1.5 bg-zinc-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  progressPercent >= 100 ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${progressPercent}%` }}
                              ></div>
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min="0"
                                max={goal.target * 2}
                                value={goal.progress}
                                onChange={(e) => handleUpdateGoal(goal.id, { progress: parseInt(e.target.value) })}
                                className="flex-1 accent-rose-500"
                              />
                              <input
                                type="number"
                                min="1"
                                value={goal.target}
                                onChange={(e) => handleUpdateGoal(goal.id, { target: parseInt(e.target.value) || 1 })}
                                className="w-20 px-2 py-1 text-sm bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-rose-500"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

              {goals.filter(goal => goalEditorTab === 'all' || goal.category === goalEditorTab).length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="text-2xl text-zinc-400" />
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No goals in this category yet</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex items-center justify-between">
              <div className="text-xs text-zinc-500">
                {goals.filter(g => g.enabled !== false).length} of {goals.length} goals enabled
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowGoalEditor(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Goals are already saved to localStorage via handleUpdateGoal and handleToggleGoal
                    // Just close the modal
                    setShowGoalEditor(false);
                  }}
                  className="px-5 py-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
