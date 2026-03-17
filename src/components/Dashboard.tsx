
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { User, AppView, BatchedNotification, CalendarEvent, Task, Thread, Contact } from '../types';
import { generateJournalInsight, generateSearchResponse, generateDailyBriefing, generateThinkingResponse } from '../services/geminiService';
import { saveArchiveItem } from '../services/dbService';
import { dataService } from '../services/dataService';
import { briefingService, BriefingContext } from '../services/briefingService';
import QuickScheduler from './Dashboard/QuickScheduler';
import CollapsibleWidget from './Dashboard/CollapsibleWidget';
import { pulseService, SearchUserResult } from '../services/pulseService';
import { calculateTeamHealthMetrics, TeamHealthMetrics } from '../services/teamHealthService';
import { teamService, Team, TeamWithMembers, TeamMember as TeamMemberType } from '../services/teamService';
import { AttentionDashboard } from './attention';
import { attentionService } from '../services/attentionService';
import { emailSyncService } from '../services/emailSyncService';

import { Archive, ArrowRight, BookUser, Calendar, Check, CheckCircle, CheckCircle2, CheckSquare, ChevronRight, Clock, Copy, Flame, Heart, Lightbulb, List, Loader2, Mail, MessageSquare, MessagesSquare, Mic, Plus, Search, Send, Sparkles, Target, TrendingUp, UserCheck, UserPlus, Users, X, Zap } from 'lucide-react';

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
  setView: (view: AppView, options?: { openTaskPanel?: boolean }) => void;
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

// WidgetSkeleton removed — was defined but never used

const BriefingSkeleton: React.FC = () => (
  <div className="gradient-dashboard-hero border border-rose-800/30 rounded-xl sm:rounded-2xl p-8 animate-pulse relative overflow-hidden glow-rose-sm">
    <div className="absolute inset-0 bg-gradient-to-br from-rose-900/30 via-pink-900/20 to-transparent pointer-events-none"></div>
    <div className="relative z-10 flex flex-col md:flex-row gap-12">
      <div className="flex-1">
        <div className="h-3 bg-zinc-800/50 rounded w-24 mb-4"></div>
        <div className="h-8 bg-zinc-800/50 rounded w-2/3 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-zinc-800/50 rounded w-full"></div>
          <div className="h-4 bg-zinc-800/50 rounded w-5/6"></div>
        </div>
      </div>
      <div className="flex-1 space-y-3">
        <div className="h-3 bg-zinc-800/50 rounded w-20 mb-4"></div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 glass-card rounded-lg"></div>
        ))}
      </div>
    </div>
  </div>
);

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
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent': return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'high': return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
      case 'medium': return 'border-rose-500 bg-rose-50 dark:bg-rose-900/20';
      default: return 'border-zinc-300 bg-zinc-50 dark:bg-zinc-900';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'task': return 'fa-check-circle';
      case 'event': return 'fa-calendar';
      case 'message': return 'fa-message';
      default: return 'fa-circle';
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 animate-pulse">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-xl"></div>
        ))}
      </div>
    );
  }

  return (
    <section className="animate-slide-up">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-lg glow-rose-sm">
            <Zap className="text-white text-xs" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Today's Priorities</h2>
        </div>
        <span className="text-xs text-gradient-rose font-semibold">{priorities.length} items</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 dashboard-stagger">
        {priorities.map((item) => (
          <div
            key={item.id}
            onClick={() => onItemClick(item)}
            className={`border-l-4 rounded-xl p-3 sm:p-4 cursor-pointer hover:shadow-lg transition-all duration-150 group active:scale-[0.98] min-h-[72px] card-hover-lift backdrop-blur-sm ${getUrgencyColor(item.urgency)}`}
          >
            <div className="flex items-start gap-2 sm:gap-3">
              <div className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
                item.type === 'task' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
                item.type === 'event' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
              }`}>
                <i className={`fa-solid ${getTypeIcon(item.type)} text-sm`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{item.title}</h4>
                {item.dueTime && (
                  <p className="text-xs text-zinc-500 mt-1">
                    {item.dueTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {item.source && (
                  <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded uppercase">
                    {item.source}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

      </div>
    </section>
  );
};

// ============= MAIN DASHBOARD COMPONENT =============

const Dashboard: React.FC<DashboardProps> = ({ user, apiKey, setView }) => {
  // Also check localStorage for API key (in case user updates it in Settings)
  // Prefer the prop, but fall back to localStorage
  const [localApiKey, setLocalApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const effectiveApiKey = apiKey || localApiKey;
  
  // Listen for localStorage changes (e.g., when user updates API key in Settings)
  useEffect(() => {
    const handleStorageChange = () => {
      const newKey = localStorage.getItem('gemini_api_key') || '';
      if (newKey !== localApiKey) {
        setLocalApiKey(newKey);
      }
    };
    
    // Listen to storage events (from other tabs/windows)
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically for changes (in case Settings updates same-tab localStorage)
    const interval = setInterval(() => {
      const newKey = localStorage.getItem('gemini_api_key') || '';
      if (newKey !== localApiKey) {
        handleStorageChange();
      }
    }, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [localApiKey, apiKey]);
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

  // Widget expansion state
  const [expandedWidgets, setExpandedWidgets] = useState<Set<string>>(
    new Set(['journal', 'scheduler', 'analytics', 'goals', 'team'])
  );

  // Journal State
  const [journalText, setJournalText] = useState('');
  const [journalInsight, setJournalInsight] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [recentJournals, setRecentJournals] = useState<Array<{id: string; title: string; date: Date; content: string}>>([]);

  // Search/Tools State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{text: string, sources: any[]} | null>(null);
  const [loadingTools, setLoadingTools] = useState(false);

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
        avatarColor: 'bg-gradient-to-tr from-emerald-500 to-cyan-500',
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
        const outcomes = await dataService.getOutcomes();
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

  // Real-time subscriptions
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    dataService.subscribeToDashboardUpdates({
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
  }, []);

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
    if (effectiveApiKey && !isLoading) {
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
  }, [effectiveApiKey, isLoading]);

  // Also load quick stats separately for faster initial display
  useEffect(() => {
    if (effectiveApiKey) {
      loadBriefingStats();
    }
  }, [effectiveApiKey]);

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

    // Check if API key is available
    if (!effectiveApiKey || effectiveApiKey.trim() === '') {
      console.warn('[Dashboard] No Gemini API key available. Please set it in Settings or environment variables.');
      if (!briefing) {
        setBriefing({
          greeting: "Welcome back.",
          summary: "Please configure your Gemini API key in Settings to enable AI-powered briefing generation.",
          suggestions: [],
          highlights: [],
          focusRecommendation: "Go to Settings to add your Gemini API key from https://aistudio.google.com/apikey"
        });
      }
      if (!silent) setLoadingBriefing(false);
      return;
    }

    try {
      // Gather comprehensive context from all data sources
      const context = await briefingService.gatherBriefingContext();
      const contextString = briefingService.buildContextString(context);

      // Generate AI briefing with full context
      const data = await generateDailyBriefing(effectiveApiKey, contextString);

      if (data) {
        setBriefing(data);
        setLastBriefingRefresh(new Date());
      } else {
        console.warn('[Dashboard] Briefing generation returned no data');
      }

      // Also refresh stats
      await loadBriefingStats();
    } catch (error: any) {
      console.error('Failed to load daily briefing:', error);
      // Set a fallback briefing with helpful message
      const errorMessage = error?.message || String(error);
      if (!briefing) {
        setBriefing({
          greeting: "Welcome back.",
          summary: errorMessage?.includes('API key') 
            ? "There's an issue with your Gemini API key. Please check Settings and ensure your API key is valid."
            : "Unable to generate AI briefing at this time. Your dashboard is still functional.",
          suggestions: [],
          highlights: [],
          focusRecommendation: errorMessage?.includes('API key')
            ? "Verify your Gemini API key in Settings"
            : "Check your tasks and calendar for today."
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
    if (!journalText.trim() || !effectiveApiKey) return;
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !effectiveApiKey) return;
    setLoadingTools(true);
    try {
      const { text, groundingChunks } = await generateSearchResponse(effectiveApiKey, searchQuery);
      setSearchResult({ text, sources: groundingChunks });
    } catch (e) {
      console.error(e);
    }
    setLoadingTools(false);
  };

  const handlePulseAiQuery = async (query: string) => {
    if (!query.trim() || !effectiveApiKey) return;
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
        setView(AppView.VOXER);
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
        setView(AppView.VOXER);
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
      }
      return updated;
    });
  }, [user?.id]);

  const handleToggleGoal = useCallback((goalId: string) => {
    setGoals(prev => {
      const updated = prev.map(g =>
        g.id === goalId ? { ...g, enabled: g.enabled === false ? true : false } : g
      );
      // Save to localStorage
      if (user?.id) {
        localStorage.setItem(`pulse_goals_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
  }, [user?.id]);

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

  // Quick Actions with brand colors
  const quickActions = useMemo(() => [
    { id: 'task', label: 'New Task', icon: 'fa-check', color: 'bg-gradient-to-br from-rose-500 to-pink-500', view: AppView.CALENDAR, openTaskPanel: true },
    { id: 'message', label: 'Send Message', icon: 'fa-message', color: 'bg-gradient-to-br from-pink-500 to-rose-400', view: AppView.MESSAGES },
    { id: 'meeting', label: 'Schedule Meet', icon: 'fa-video', color: 'bg-gradient-to-br from-rose-400 to-pink-600', view: AppView.CALENDAR },
    { id: 'email', label: 'Compose Email', icon: 'fa-envelope', color: 'bg-gradient-to-br from-pink-600 to-rose-500', view: AppView.EMAIL },
    { id: 'vox', label: 'Quick Vox', icon: 'fa-microphone', color: 'bg-gradient-to-br from-orange-500 to-amber-500', view: AppView.VOXER },
    { id: 'contact', label: 'New Contact', icon: 'fa-user-plus', color: 'bg-gradient-to-br from-emerald-500 to-teal-500', view: AppView.CONTACTS, openAddContact: true },
    { id: 'warroom', label: 'War Room', icon: 'fa-book-open', color: 'bg-gradient-to-br from-violet-500 to-purple-600', view: AppView.LIVE },
    { id: 'search', label: 'Search', icon: 'fa-magnifying-glass', color: 'bg-gradient-to-br from-sky-500 to-blue-500', view: AppView.MULTI_MODAL },
  ], []);

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

  const wordCount = journalText.trim().split(/\s+/).filter(Boolean).length;
  const charCount = journalText.length;
  const contextualGreeting = getContextualGreeting(user?.name);

  return (
    <div className="space-y-4 sm:space-y-6 overflow-y-auto h-full pr-1 sm:pr-2 animate-fade-in pb-10 mobile-scroll">

      {/* Top AI Web Search Bar */}
      <div className="relative">
        <form onSubmit={handleSearch}>
          <div className="relative flex items-center">
            <Search className="absolute left-4 text-zinc-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search the web with AI..."
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-11 pr-28 py-3.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20 focus:ring-offset-0 focus:outline-none transition-all shadow-sm"
            />
            <button
              type="submit"
              className="absolute right-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white px-4 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90 transition flex items-center gap-1.5"
            >
              {loadingTools ? <Loader2 className="animate-spin w-3 h-3" /> : <><Sparkles className="w-3 h-3" />Search</>}
            </button>
          </div>
        </form>
        {searchResult && (
          <div className="mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2 mb-2 text-xs text-zinc-400 font-medium uppercase tracking-wide">
              <Sparkles className="w-3 h-3 text-rose-400" /> AI Web Search
            </div>
            <div>{searchResult.text}</div>
            {searchResult.sources?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-2">
                {searchResult.sources.slice(0, 3).map((s: any, i: number) => (
                  <a key={i} href={s.web?.uri} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-rose-500 hover:text-rose-400 underline underline-offset-2 truncate max-w-[200px]">
                    {s.web?.title || s.web?.uri}
                  </a>
                ))}
              </div>
            )}
            <button onClick={() => setSearchResult(null)} className="mt-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">Dismiss</button>
          </div>
        )}
      </div>

      {/* Daily Briefing Hero - Enhanced with Beautiful Gradients */}
      {loadingBriefing || isLoading ? (
        <BriefingSkeleton />
      ) : (
        <section className="gradient-dashboard-hero texture-noise grain-effect border border-rose-800/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 text-white relative overflow-hidden animate-slide-up glow-rose-md shadow-2xl">
          {/* Organic Gradient Base Layer with Smooth Transitions */}
          <div className="absolute inset-0 bg-gradient-to-br from-rose-950 via-pink-950/90 to-purple-950/80 pointer-events-none"></div>

          {/* Layered Blurred Gradient Orbs - Softer Edges */}
          <div className="absolute -top-[40%] -right-[30%] w-[800px] h-[800px] bg-gradient-radial from-rose-500/25 via-rose-600/15 to-transparent rounded-full blur-[120px] pointer-events-none animate-pulse-glow-slow opacity-80"></div>
          <div className="absolute -bottom-[35%] -left-[25%] w-[700px] h-[700px] bg-gradient-radial from-pink-500/20 via-pink-600/12 to-transparent rounded-full blur-[100px] pointer-events-none animate-pulse-glow-slow opacity-70" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-[20%] right-[15%] w-[500px] h-[500px] bg-gradient-radial from-purple-500/15 via-purple-600/8 to-transparent rounded-full blur-[90px] pointer-events-none animate-pulse-glow-slow opacity-60" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-[25%] left-[40%] w-[600px] h-[600px] bg-gradient-radial from-rose-600/18 via-pink-700/10 to-transparent rounded-full blur-[110px] pointer-events-none animate-pulse-glow-slow opacity-50" style={{ animationDelay: '3s' }}></div>

          {/* Subtle Noise Texture Overlay */}
          <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
              backgroundSize: '200px 200px'
            }}
          ></div>

          {/* Animated Gradient Mesh - Organic Movement */}
          <div className="absolute inset-0 opacity-30 pointer-events-none mix-blend-soft-light"
            style={{
              background: `
                radial-gradient(ellipse at 20% 30%, rgba(244, 63, 94, 0.15), transparent 50%),
                radial-gradient(ellipse at 80% 70%, rgba(236, 72, 153, 0.12), transparent 50%),
                radial-gradient(ellipse at 40% 80%, rgba(168, 85, 247, 0.10), transparent 50%)
              `,
              animation: 'gradient-shift 15s ease-in-out infinite'
            }}
          ></div>

          {/* Soft Vignette Effect */}
          <div className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.25) 100%)'
            }}
          ></div>

          {briefing ? (
            <div className="relative z-10">
              {/* Header with refresh button and stats */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3 text-rose-400 font-medium text-xs uppercase tracking-widest">
                    <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
                    <i className={`fa-solid ${contextualGreeting.icon}`}></i>
                    Daily Overview
                    {lastBriefingRefresh && (
                      <span className="text-zinc-400 normal-case ml-2">
                        Updated {lastBriefingRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold mb-3 sm:mb-4 text-white tracking-tight">{contextualGreeting.greeting}</h1>
                  <p className="text-zinc-200 leading-relaxed text-sm sm:text-base max-w-2xl">{briefing.summary}</p>
                  {briefing.focusRecommendation && (
                    <div
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/40 transition-all duration-200 group"
                      onClick={() => {
                        // Smart navigation: detect what the recommendation refers to
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
                          setView(AppView.VOXER);
                        } else {
                          sessionStorage.setItem('pulse_focus_nudge', 'email');
                          setView(AppView.EMAIL);
                        }
                      }}
                      title="Click to go directly to this item"
                    >
                      <Target className="text-rose-400" />
                      <span className="text-sm text-rose-300 font-medium">{briefing.focusRecommendation}</span>
                      <ArrowRight className="text-rose-400/60 text-xs group-hover:text-rose-400 transition-colors" />
                    </div>
                  )}
                </div>
                <button
                  onClick={handleRefreshBriefing}
                  disabled={loadingBriefing}
                  className="w-10 h-10 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition disabled:opacity-50"
                  title="Refresh briefing"
                >
                  <i className={`fa-solid fa-sync ${loadingBriefing ? 'fa-spin' : ''}`}></i>
                </button>
              </div>

              {/* Quick Stats Row - Enhanced with Glassmorphism */}
              {briefingStats && (
                <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
                  {[
                    { value: briefingStats.unreadMessages, label: 'Unread' },
                    { value: briefingStats.pendingTasks, label: 'Tasks' },
                    { value: briefingStats.todayMeetings, label: 'Meetings' },
                    { value: briefingStats.unplayedVoxes, label: 'Voxes' },
                  ].map(({ value, label }) => (
                    <div
                      key={label}
                      className="glass-rose-hover transition-all duration-150 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center group cursor-pointer card-hover-lift border border-rose-500/20"
                      style={{ background: 'rgba(244, 63, 94, 0.06)', backdropFilter: 'blur(16px)' }}
                    >
                      <div className="text-lg sm:text-2xl font-bold text-white">{value}</div>
                      <div className="text-[9px] sm:text-[10px] text-white/60 group-hover:text-white uppercase tracking-wider transition-colors">{label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Main content: Highlights + Suggestions */}
              <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8">
                {/* Highlights Section */}
                {briefing.highlights && briefing.highlights.length > 0 && (
                  <div className="flex-1 space-y-2 sm:space-y-3">
                    <h3 className="text-[10px] sm:text-xs font-bold text-rose-400/80 uppercase tracking-widest flex items-center gap-2">
                      <Flame />
                      Key Highlights
                    </h3>
                    <div className="grid gap-2 dashboard-stagger">
                      {briefing.highlights.slice(0, 4).map((highlight, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleHighlightAction(highlight.category)}
                          className="glass-card hover:glass-rose-strong border-gradient-rose-subtle rounded-lg sm:rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3 transition-all duration-150 cursor-pointer group card-hover-lift active:scale-[0.98] min-h-[56px]"
                        >
                          <div className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${getPriorityColor(highlight.priority)}`}>
                            <i className={`fa-solid ${getCategoryIcon(highlight.category)} text-sm`}></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-medium text-sm sm:text-sm text-zinc-900 line-clamp-1">{highlight.title}</div>
                              {highlight.priority === 'urgent' && (
                                <span className="px-1.5 py-0.5 text-[9px] bg-red-500/20 text-red-400 rounded uppercase font-bold shrink-0">Urgent</span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-900 mt-0.5 line-clamp-2 sm:line-clamp-1">{highlight.detail}</div>
                          </div>
                          <ChevronRight className="text-xs text-zinc-400 group-hover:text-rose-400 transition" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions Section */}
                <div className="flex-1 space-y-2 sm:space-y-3">
                  <h3 className="text-[10px] sm:text-xs font-bold text-rose-400/80 uppercase tracking-widest flex items-center gap-2">
                    <Lightbulb />
                    Action Items
                  </h3>
                  <div className="grid gap-2 dashboard-stagger">
                    {briefing.suggestions.slice(0, 4).map((suggestion, idx) => (
                      <div
                        key={idx}
                        className={`glass-card hover:glass-rose-strong border-gradient-rose-subtle rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all duration-150 group card-hover-lift active:scale-[0.98] min-h-[56px] ${
                          suggestion.type === 'ai_assist' ? 'border-gradient-rose-strong' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0 pr-2 sm:pr-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              {suggestion.type === 'ai_assist' && (
                                <Sparkles className="text-rose-400 text-sm animate-pulse" />
                              )}
                              <div className="font-medium text-sm text-zinc-900 line-clamp-1">{suggestion.action}</div>
                              {suggestion.priority === 'urgent' && (
                                <span className="px-1.5 py-0.5 text-[9px] bg-red-500/20 text-red-400 rounded uppercase font-bold shrink-0">Urgent</span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-900 mt-0.5 line-clamp-2 sm:line-clamp-1">{suggestion.reason}</div>
                          </div>
                          <button
                            onClick={() => suggestion.type === 'ai_assist' && suggestion.aiFeature ? handleAIFeatureClick(suggestion.aiFeature) : handleSuggestionAction(suggestion.type)}
                            className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-rose-600/30 to-pink-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 group-hover:text-white group-hover:from-rose-500 group-hover:to-pink-500 group-hover:border-rose-500 transition shrink-0 active:scale-95"
                          >
                            <i className={`fa-solid ${
                              suggestion.type === 'ai_assist' ? 'fa-sparkles' :
                              suggestion.type === 'message' ? 'fa-reply' :
                              suggestion.type === 'event' ? 'fa-calendar-check' :
                              suggestion.type === 'task' ? 'fa-list-check' :
                              suggestion.type === 'email' ? 'fa-envelope' :
                              suggestion.type === 'vox' ? 'fa-microphone' :
                              suggestion.type === 'contact' ? 'fa-user-plus' :
                              'fa-arrow-right'
                            } text-sm sm:text-xs`}></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center relative z-10">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-600/30 to-pink-600/20 border border-rose-500/20 flex items-center justify-center">
                  <i className={`fa-solid ${contextualGreeting.icon} text-xl text-rose-400`}></i>
                </div>
              </div>
              <h1 className="text-2xl font-light mb-2 text-white">{contextualGreeting.greeting}</h1>
              <p className="text-zinc-500 font-light">Your dashboard is ready. Add some data to generate your AI briefing.</p>
              <button
                onClick={handleRefreshBriefing}
                disabled={loadingBriefing}
                className="mt-4 px-6 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg text-rose-400 text-sm font-medium transition disabled:opacity-50"
              >
                {loadingBriefing ? 'Generating...' : 'Generate AI Briefing'}
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

      {/* Attention & Focus Dashboard */}
      {user?.id && (
        <CollapsibleWidget
          id="attention-focus"
          title="Attention & Focus"
          icon="fa-brain"
          iconColor="text-purple-500"
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
                  <h3 className="text-sm font-bold uppercase tracking-widest dark:text-white text-zinc-900">Saved</h3>
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

            <textarea
              className="w-full bg-transparent border-0 p-0 text-base focus:ring-0 resize-none mb-2 min-h-[200px] dark:text-zinc-200 text-zinc-800 placeholder-zinc-400 dark:placeholder-zinc-500 leading-relaxed font-light"
              placeholder="Write your thoughts..."
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
            />

            <div className="flex justify-end gap-4 text-[10px] text-zinc-500 font-mono mb-4">
              <span>{wordCount} words</span>
              <span>{charCount} chars</span>
            </div>

            {journalInsight && (
              <div className="mb-4 pl-4 border-l-2 border-purple-500 text-sm text-zinc-600 dark:text-zinc-400 italic animate-fade-in">
                "{journalInsight}"
              </div>
            )}

            <div className="flex gap-3 items-center pt-4 border-t border-zinc-100 dark:border-zinc-900">
              <button
                onClick={handleJournalAnalyze}
                disabled={saving || !journalText}
                className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-300 rounded-lg text-xs font-semibold uppercase tracking-wider transition disabled:opacity-50"
              >
                Analyze AI
              </button>
              <div className="flex-1"></div>
              <button
                onClick={handleShare}
                disabled={!journalText}
                className={`w-9 h-9 rounded-lg transition flex items-center justify-center ${journalCopied ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400'}`}
                title={journalCopied ? 'Copied!' : 'Copy to clipboard'}
              >
                {journalCopied ? <Check /> : <Copy />}
              </button>
              <button
                onClick={handleArchive}
                disabled={saving || !journalText}
                className="px-6 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-bold uppercase tracking-widest hover:opacity-90 transition disabled:opacity-50"
              >
                Save
              </button>
            </div>

            {/* Recent Journal Entries */}
            {recentJournals.length > 0 && (
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-900">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Recent</h4>
                  <button
                    onClick={() => setView(AppView.ARCHIVES)}
                    className="text-[10px] text-zinc-500 hover:text-rose-500 transition"
                  >
                    See all
                  </button>
                </div>
                <div className="space-y-2">
                  {recentJournals.map(journal => (
                    <button
                      key={journal.id}
                      onClick={() => setView(AppView.ARCHIVES)}
                      className="w-full text-left p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 border-l-2 border-rose-500/20 dark:border-rose-500/15 hover:border-rose-500/60 dark:hover:border-rose-500/50 transition-colors duration-150 group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 dark:text-zinc-500 shrink-0">
                          {journal.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate flex-1 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition">
                          {journal.content.replace('Entry: ', '').slice(0, 60)}...
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
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
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold uppercase text-zinc-500">Batched ({batchedNotifications.length})</span>
                  <button onClick={() => setBatchedNotifications([])} className="text-xs text-rose-500 hover:underline">Clear All</button>
                </div>
                <div className="space-y-2">
                  {batchedNotifications.slice(0, 3).map(n => (
                    <div key={n.id} className="flex items-start gap-3 p-2 bg-white dark:bg-zinc-950 rounded-lg border border-zinc-100 dark:border-zinc-800">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase mt-0.5 min-w-[40px]">{n.source}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-zinc-700 dark:text-zinc-300 truncate">{n.message}</div>
                        <div className="text-[10px] text-zinc-500">{n.time.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-zinc-500 text-sm py-4">No batched notifications.</div>
            )}
          </CollapsibleWidget>

          {/* Mini Pulse AI */}
          <div className="dashboard-widget-surface backdrop-blur-lg rounded-2xl p-5 relative overflow-hidden border border-zinc-200/80 dark:border-zinc-800/60 card-elevated hover:border-rose-500/30 transition-all duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-rose-500" />
              </div>
              <h3 className="font-medium text-base dark:text-white text-zinc-900">Ask Pulse AI</h3>
            </div>
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {["Summarize my day", "What's urgent?", "Draft a reply"].map(chip => (
                <button key={chip} onClick={() => handlePulseAiQuery(chip)}
                  className="text-xs px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 border border-zinc-200 dark:border-zinc-700 transition-all">
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
                  placeholder="Ask anything..."
                  className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-rose-500/40 focus:outline-none transition-all pr-8"
                />
                <button type="submit" className="absolute right-2 top-2 text-zinc-400 hover:text-rose-400 transition">
                  {loadingPulseAi ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </form>
            {/* Response */}
            {pulseAiResponse && (
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 animate-fade-in">
                <p className="line-clamp-4">{pulseAiResponse}</p>
                <div className="flex items-center justify-between mt-2">
                  <button onClick={() => setView(AppView.LIVE_AI)}
                    className="text-xs text-rose-500 hover:text-rose-400 font-medium">
                    Open Pulse AI →
                  </button>
                  <button onClick={() => setPulseAiResponse(null)} className="text-xs text-zinc-400 hover:text-zinc-500">Clear</button>
                </div>
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          <div className="dashboard-widget-surface backdrop-blur-lg rounded-2xl p-5 border border-zinc-200/80 dark:border-zinc-800/60 card-elevated hover:border-rose-500/30 transition-all duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/20 rounded-full flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-rose-500" />
                </div>
                <h3 className="font-medium text-base dark:text-white text-zinc-900">Upcoming Events</h3>
              </div>
              <button onClick={() => setView(AppView.CALENDAR)} className="text-xs text-rose-500 hover:text-rose-400 font-medium">View all</button>
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

          {/* Unread Pulse */}
          <div className="dashboard-widget-surface backdrop-blur-lg rounded-2xl p-5 border border-zinc-200/80 dark:border-zinc-800/60 card-elevated hover:border-rose-500/30 transition-all duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/20 rounded-full flex items-center justify-center">
                <Zap className="w-4 h-4 text-rose-500" />
              </div>
              <h3 className="font-medium text-base dark:text-white text-zinc-900">Unread Pulse</h3>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Messages', count: messageUnreadCount, icon: MessageSquare, view: AppView.MESSAGES },
                { label: 'Email', count: emailUnreadCount, icon: Mail, view: AppView.EMAIL },
                { label: 'Vox', count: voxUnreadCount, icon: Mic, view: AppView.VOXER },
              ].map(({ label, count, icon: Icon, view }) => (
                <button key={label} onClick={() => setView(view)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-zinc-200 dark:border-zinc-700/50 hover:border-rose-500/30 transition-all group">
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-zinc-400 group-hover:text-rose-400 transition-colors" />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {count > 0 ? (
                      <span className="text-xs font-semibold text-white bg-rose-500 px-2 py-0.5 rounded-full min-w-[1.5rem] text-center">{count}</span>
                    ) : (
                      <span className="text-xs text-zinc-400">All clear</span>
                    )}
                    <ChevronRight className="w-3 h-3 text-zinc-400 group-hover:text-rose-400 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Quick Actions Floating Button - Rendered via Portal */}
      {ReactDOM.createPortal(
        <div className="fixed bottom-6 right-6 z-[9999]" style={{ position: 'fixed' }}>
          <div className={`flex flex-col-reverse gap-2 mb-2 transition-all ${showQuickActions ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
            {quickActions.map(action => (
              <button
                key={action.id}
                onClick={() => {
                  const params: Record<string, boolean> = {};
                  if (action.openTaskPanel) params.openTaskPanel = true;
                  if (action.openAddContact) params.openAddContact = true;
                  setView(action.view, Object.keys(params).length > 0 ? params : undefined);
                  setShowQuickActions(false);
                }}
                className={`${action.color} text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform`}
                title={action.label}
              >
                <i className={`fa-solid ${action.icon}`}></i>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all ${showQuickActions ? 'bg-zinc-800 rotate-45' : 'bg-gradient-to-br from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600'} text-white`}
          >
            <Plus className="text-xl" />
          </button>
        </div>,
        document.body
      )}

      {/* Productivity Analytics Section */}
      <CollapsibleWidget
        id="analytics"
        title="Productivity Analytics"
        icon="fa-chart-line"
        iconColor="text-pink-500"
        isExpanded={expandedWidgets.has('analytics')}
        onToggle={toggleWidget}
        headerAction={
          <div className="flex items-center gap-2">
            {(['day', 'week', 'month'] as const).map(range => (
              <button
                key={range}
                onClick={(e) => { e.stopPropagation(); setAnalyticsTimeRange(range); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  analyticsTimeRange === range
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-black'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-rose-500 dark:hover:text-rose-400'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        }
        className="animate-spring-enter"
      >
        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 dashboard-stagger">
          <div className="dashboard-widget-surface backdrop-blur-lg rounded-xl p-4 border border-zinc-200/80 dark:border-zinc-800/60 card-elevated hover:border-rose-500/30 transition-all duration-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">Tasks Done</span>
              <CheckCircle className="text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{productivityMetrics.tasksCompleted}</div>
            <div className="text-[10px] text-zinc-500">of {productivityMetrics.tasksTotal} total</div>
          </div>
          <div className="dashboard-widget-surface backdrop-blur-lg rounded-xl p-4 border border-zinc-200/80 dark:border-zinc-800/60 card-elevated hover:border-rose-500/30 transition-all duration-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">Messages</span>
              <MessageSquare className="text-pink-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{productivityMetrics.messagesSent + productivityMetrics.messagesReceived}</div>
            <div className="text-[10px] text-zinc-500">{productivityMetrics.messagesSent} sent, {productivityMetrics.messagesReceived} received</div>
          </div>
          <div className="dashboard-widget-surface backdrop-blur-lg rounded-xl p-4 border border-zinc-200/80 dark:border-zinc-800/60 card-elevated hover:border-rose-500/30 transition-all duration-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">Focus Time</span>
              <Target className="text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{formatFocusTime(productivityMetrics.focusTime)}</div>
            <div className="text-[10px] text-zinc-500">
              {events.some(e => e.type === 'focus') ? 'Deep work today' : 'Est. from tasks'}
            </div>
          </div>
          <div className="dashboard-widget-surface backdrop-blur-lg rounded-xl p-4 border border-zinc-200/80 dark:border-zinc-800/60 card-elevated hover:border-rose-500/30 transition-all duration-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">Avg Response</span>
              <Clock className="text-pink-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
              {productivityMetrics.responseTime > 0 ? `${productivityMetrics.responseTime}m` : '—'}
            </div>
            <div className="text-[10px] text-zinc-500">
              {productivityMetrics.responseTime > 0 ? 'Avg response time' : 'No data yet'}
            </div>
          </div>
        </div>

        {/* Weekly Chart */}
        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Weekly Activity</h4>
            <div className="flex gap-2">
              {(['tasks', 'messages', 'meetings'] as const).map(metric => (
                <button
                  key={metric}
                  onClick={() => setSelectedMetric(metric)}
                  className={`px-2 py-1 rounded text-xs transition ${
                    selectedMetric === metric
                      ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-semibold'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {metric.charAt(0).toUpperCase() + metric.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-2 h-32">
            {weeklyData.map((day) => (
              <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-t relative overflow-hidden" style={{ height: '100%' }}>
                  <div
                    className="absolute bottom-0 w-full bg-gradient-to-t from-rose-600 to-pink-400 rounded-t transition-all duration-500"
                    style={{ height: `${(day[selectedMetric] / maxChartValue) * 100}%` }}
                  ></div>
                </div>
                <span className="text-[10px] font-medium text-zinc-500">{day.day}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <span className="text-xs text-zinc-500">Total this week:</span>
            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
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
          iconColor="text-rose-500"
          isExpanded={expandedWidgets.has('goals')}
          onToggle={toggleWidget}
          className="animate-spring-enter"
          headerAction={
            <button
              onClick={(e) => { e.stopPropagation(); setShowGoalEditor(true); }}
              className="text-xs text-rose-500 hover:text-rose-600 font-semibold"
            >
              Edit Goals
            </button>
          }
          className="animate-slide-up"
        >
          <div className="space-y-4 dashboard-stagger">
            {goals
              .filter(goal => goal.enabled !== false)
              .map(goal => {
                const colorClasses = {
                  blue: 'bg-blue-500',
                  green: 'bg-green-500',
                  purple: 'bg-purple-500',
                  red: 'bg-red-500',
                  indigo: 'bg-indigo-500',
                  emerald: 'bg-emerald-500',
                  cyan: 'bg-cyan-500',
                  teal: 'bg-teal-500',
                  amber: 'bg-amber-500',
                  rose: 'bg-rose-500',
                };
                const iconColor = goal.color || 'rose';
                const progressPercent = Math.min((goal.progress / goal.target) * 100, 100);
                
                return (
                  <div key={goal.id} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {goal.icon && (
                          <i className={`fa-solid ${goal.icon} text-xs text-zinc-500`}></i>
                        )}
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{goal.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">
                          {goal.progress}/{goal.target} {goal.unit}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          goal.trend === 'up' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          goal.trend === 'down' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}>
                          <i className={`fa-solid ${goal.trend === 'up' ? 'fa-arrow-up' : goal.trend === 'down' ? 'fa-arrow-down' : 'fa-minus'} mr-0.5`}></i>
                          {goal.trend}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          progressPercent >= 100 ? 'bg-emerald-500' :
                          progressPercent >= 70 ? (colorClasses[iconColor as keyof typeof colorClasses] || 'bg-rose-500') :
                          progressPercent >= 40 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            {goals.filter(goal => goal.enabled !== false).length === 0 && (
              <div className="text-center py-8 text-zinc-500">
                <Target className="mb-2 text-2xl" />
                <p className="text-sm">No goals enabled. Click "Edit Goals" to get started.</p>
              </div>
            )}
          </div>
        </CollapsibleWidget>

        {/* Team Activity */}
        <CollapsibleWidget
          id="team"
          title="Team Activity"
          icon="fa-users"
          iconColor="text-pink-400"
          isExpanded={expandedWidgets.has('team')}
          onToggle={toggleWidget}
          className="animate-spring-enter"
          headerAction={
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              {teams.length > 0 && (
                <select
                  value={selectedTeamId || ''}
                  onChange={(e) => setSelectedTeamId(e.target.value || null)}
                  className="text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  onClick={e => e.stopPropagation()}
                >
                  <option value="">All Contacts</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedTeamId) {
                    // Load selected team data into builder
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
                className="text-xs text-rose-500 hover:text-rose-600 font-semibold"
              >
                {selectedTeamId ? 'Edit Team' : teams.length > 0 ? 'New Team' : 'Build Team'}
              </button>
            </div>
          }
          className="animate-slide-up"
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
                  avatarColor: m.avatarColor || 'bg-gradient-to-tr from-emerald-500 to-cyan-500',
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
                <div className="text-center py-8 text-zinc-500">
                  <Users className="mb-2 text-2xl" />
                  <p className="text-sm mb-3">
                    {selectedTeamId ? 'No members in this team yet.' : 'No team members yet.'}
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
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-lg transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rose-500/30 active:scale-95"
                  >
                    {selectedTeamId ? 'Add Members' : 'Build Your Team'}
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-3 dashboard-stagger">
                {membersToDisplay.slice(0, 5).map(member => (
                  <div
                    key={member.id}
                    onClick={() => setView(AppView.MESSAGES)}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 border-l-2 border-rose-500/20 dark:border-rose-500/15 hover:border-rose-500/60 dark:hover:border-rose-500/50 transition-colors duration-150 cursor-pointer group"
                  >
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-full ${member.avatarColor} flex items-center justify-center text-white font-bold`}>
                        {member.name.charAt(0)}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-zinc-950 ${getStatusColor(member.status)}`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-zinc-900 dark:text-white truncate">{member.name}</span>
                        {member.unreadCount && member.unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full">
                            {member.unreadCount}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500 capitalize">{member.status}</span>
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-500 flex items-center justify-center transition">
                      <MessageSquare className="text-xs" />
                    </button>
                  </div>
                ))}
              </div>
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
              </div>
            ) : teamHealthMetrics ? (
              <div className="space-y-6">
                {/* Communication Health */}
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-950/40 dark:to-cyan-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="text-emerald-600 dark:text-emerald-400" />
                    <h4 className="font-semibold text-sm text-zinc-900 dark:text-white">Communication Health</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Engagement Score</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{teamHealthMetrics.communicationHealth.engagementScore}</span>
                        <span className="text-xs text-zinc-500">/100</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Avg Response Time</div>
                      <div className="text-lg font-semibold text-zinc-900 dark:text-white">
                        {teamHealthMetrics.communicationHealth.avgResponseTime > 0 
                          ? `${Math.round(teamHealthMetrics.communicationHealth.avgResponseTime)}m`
                          : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Messages</div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">
                        {teamHealthMetrics.communicationHealth.messageVolume.sent} sent • {teamHealthMetrics.communicationHealth.messageVolume.received} received
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Active Conversations</div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">
                        {teamHealthMetrics.communicationHealth.activeConversations} {teamHealthMetrics.communicationHealth.unreadCount > 0 && `• ${teamHealthMetrics.communicationHealth.unreadCount} unread`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Votes/Decisions */}
                <div className="p-4 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40 rounded-xl border border-rose-200 dark:border-rose-800/60">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckSquare className="text-rose-600 dark:text-rose-400" />
                    <h4 className="font-semibold text-sm text-zinc-900 dark:text-white">Votes & Decisions</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Active Decisions</div>
                      <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{teamHealthMetrics.votes.activeDecisions}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Pending Votes</div>
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{teamHealthMetrics.votes.pendingVotes}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Consensus Rate</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-semibold text-zinc-900 dark:text-white">{teamHealthMetrics.votes.consensusRate}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Decisions Made</div>
                      <div className="text-lg font-semibold text-zinc-900 dark:text-white">{teamHealthMetrics.votes.decisionsMade}</div>
                    </div>
                  </div>
                </div>

                {/* Projects/Outcomes */}
                <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40 rounded-xl border border-purple-200 dark:border-purple-800/60">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="text-purple-600 dark:text-purple-400" />
                    <h4 className="font-semibold text-sm text-zinc-900 dark:text-white">Projects & Outcomes</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Active Outcomes</div>
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{teamHealthMetrics.projects.activeOutcomes}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Avg Progress</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-semibold text-zinc-900 dark:text-white">{teamHealthMetrics.projects.avgProgress}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Completion Rate</div>
                      <div className="text-lg font-semibold text-zinc-900 dark:text-white">{teamHealthMetrics.projects.completionRate}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Blockers</div>
                      <div className="text-lg font-semibold text-red-600 dark:text-red-400">{teamHealthMetrics.projects.blockers}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <TrendingUp className="mb-2 text-2xl" />
                <p className="text-sm">No team health data available yet.</p>
              </div>
            )}
          </CollapsibleWidget>
        )}
      </div>

      {/* Team Builder Modal */}
      {showTeamBuilder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => {
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
                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                  <Users className="text-pink-500" />
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
                    className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
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
                    className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-4 border-b border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => setTeamBuilderTab('pulse')}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    teamBuilderTab === 'pulse'
                      ? 'text-pink-500 border-b-2 border-pink-500'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <UserCheck className="mr-2" />Pulse Users
                </button>
                <button
                  onClick={() => setTeamBuilderTab('contacts')}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    teamBuilderTab === 'contacts'
                      ? 'text-pink-500 border-b-2 border-pink-500'
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
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Selected Members */}
              {teamBuilderSelectedMembers.length > 0 && (
                <div className="mb-4 p-3 bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-800 rounded-xl">
                  <div className="text-xs font-medium text-pink-700 dark:text-pink-300 mb-2">
                    Selected ({teamBuilderSelectedMembers.length})
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
                              ? 'bg-pink-100 dark:bg-pink-900/30 border border-pink-300 dark:border-pink-700'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              (user.display_name || user.full_name || 'U').charAt(0)
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm dark:text-white truncate flex items-center gap-2">
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
                                ? 'bg-pink-500 hover:bg-pink-600 text-white'
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
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
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
                              ? 'bg-pink-100 dark:bg-pink-900/30 border border-pink-300 dark:border-pink-700'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full ${contact.avatarColor} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                            {contact.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm dark:text-white truncate">{contact.name}</div>
                            {contact.phone && (
                              <div className="text-xs text-zinc-500 truncate">{contact.phone}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!contact.pulseUserId && (
                              <button
                                disabled
                                className="px-2 py-1 text-xs font-medium text-zinc-400 dark:text-zinc-600 cursor-not-allowed rounded"
                                title="Invite to Pulse — coming soon"
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
                                  ? 'bg-pink-500 hover:bg-pink-600 text-white'
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowGoalEditor(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col animate-scale-in border border-zinc-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
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
                    ? 'border-green-500 text-green-600 dark:text-green-400'
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
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
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
                  const colorClasses = {
                    blue: 'bg-blue-500',
                    green: 'bg-green-500',
                    purple: 'bg-purple-500',
                    red: 'bg-red-500',
                    indigo: 'bg-indigo-500',
                    emerald: 'bg-emerald-500',
                    cyan: 'bg-cyan-500',
                    teal: 'bg-teal-500',
                    amber: 'bg-amber-500',
                    rose: 'bg-rose-500',
                  };
                  const iconColor = goal.color || 'rose';
                  const progressPercent = Math.min((goal.progress / goal.target) * 100, 100);
                  const isEnabled = goal.enabled !== false;

                  return (
                    <div
                      key={goal.id}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        isEnabled
                          ? 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                          : 'bg-zinc-100/50 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-lg ${colorClasses[iconColor as keyof typeof colorClasses] || 'bg-rose-500'} flex items-center justify-center text-white`}>
                            <i className={`fa-solid ${goal.icon || 'fa-bullseye'} text-sm`}></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-semibold text-sm ${isEnabled ? 'dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}`}>
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
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
                            isEnabled
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500'
                          }`}
                          title={isEnabled ? 'Disable goal' : 'Enable goal'}
                        >
                          <i className={`fa-solid ${isEnabled ? 'fa-toggle-on' : 'fa-toggle-off'} text-lg`}></i>
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
                            <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  progressPercent >= 100 ? 'bg-emerald-500' :
                                  progressPercent >= 70 ? colorClasses[iconColor as keyof typeof colorClasses] || 'bg-rose-500' :
                                  progressPercent >= 40 ? 'bg-yellow-500' :
                                  'bg-red-500'
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
                                className="w-20 px-2 py-1 text-sm bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
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
                  className="px-6 py-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-lg font-semibold transition shadow-lg shadow-rose-500/25"
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
