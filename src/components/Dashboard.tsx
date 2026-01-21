
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { User, AppView, BatchedNotification, CalendarEvent, Task, Thread, Contact } from '../types';
import { generateJournalInsight, generateSearchResponse, generateDailyBriefing } from '../services/geminiService';
import { saveArchiveItem } from '../services/dbService';
import { dataService } from '../services/dataService';
import { briefingService, BriefingContext } from '../services/briefingService';
import QuickScheduler from './Dashboard/QuickScheduler';
import { pulseService, SearchUserResult } from '../services/pulseService';
import { calculateTeamHealthMetrics, TeamHealthMetrics } from '../services/teamHealthService';
import { teamService, Team, TeamWithMembers, TeamMember as TeamMemberType } from '../services/teamService';
import { AttentionDashboard } from './attention';
import { attentionService } from '../services/attentionService';

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
  type: 'message' | 'event' | 'task' | 'email' | 'vox' | 'contact';
  priority: 'urgent' | 'high' | 'medium' | 'low';
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

const WidgetSkeleton: React.FC<{ height?: string }> = ({ height = 'h-48' }) => (
  <div className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 ${height} animate-pulse`}>
    <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3 mb-4"></div>
    <div className="space-y-3">
      <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
      <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-5/6"></div>
      <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-4/6"></div>
    </div>
  </div>
);

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

// ============= COLLAPSIBLE WIDGET WRAPPER =============

interface CollapsibleWidgetProps {
  id: string;
  title: string;
  icon: string;
  iconColor?: string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const CollapsibleWidget: React.FC<CollapsibleWidgetProps> = ({
  id,
  title,
  icon,
  iconColor = 'text-rose-500',
  isExpanded,
  onToggle,
  headerAction,
  children,
  className = ''
}) => (
  <div className={`bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden transition-all duration-300 hover:border-rose-500/40 dark:hover:border-rose-500/30 card-elevated hover:glow-rose-sm ${className}`}>
    <div
      className="flex items-center justify-between p-4 cursor-pointer hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-all duration-300"
      onClick={() => onToggle(id)}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500/15 to-pink-500/15 dark:from-rose-500/20 dark:to-pink-500/20 flex items-center justify-center border border-rose-500/20 shadow-sm">
          <i className={`fa-solid ${icon} ${iconColor}`}></i>
        </div>
        <h3 className="font-semibold text-zinc-900 dark:text-white">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {headerAction && <div onClick={e => e.stopPropagation()}>{headerAction}</div>}
        <i className={`fa-solid fa-chevron-down text-zinc-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
      </div>
    </div>
    <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
      <div className="p-4 pt-0 border-t border-zinc-100 dark:border-zinc-800/50">
        {children}
      </div>
    </div>
  </div>
);

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
      case 'medium': return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
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
            <i className="fa-solid fa-bolt text-white text-xs"></i>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Today's Priorities</h2>
        </div>
        <span className="text-xs text-gradient-rose font-semibold">{priorities.length} items</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {priorities.map((item) => (
          <div
            key={item.id}
            onClick={() => onItemClick(item)}
            className={`border-l-4 rounded-xl p-3 sm:p-4 cursor-pointer hover:shadow-lg transition-all duration-300 group active:scale-[0.98] min-h-[72px] card-hover-lift backdrop-blur-sm ${getUrgencyColor(item.urgency)}`}
          >
            <div className="flex items-start gap-2 sm:gap-3">
              <div className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
                item.type === 'task' ? 'bg-blue-100 text-blue-600' :
                item.type === 'event' ? 'bg-purple-100 text-purple-600' :
                'bg-emerald-100 text-emerald-600'
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

  // Daily Briefing State
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [briefingStats, setBriefingStats] = useState<BriefingStats | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [lastBriefingRefresh, setLastBriefingRefresh] = useState<Date | null>(null);
  const briefingRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Attention Budget State
  const [attentionLoad, setAttentionLoad] = useState(65);
  const [batchedNotifications, setBatchedNotifications] = useState<BatchedNotification[]>([]);

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
    const unsubscribe = dataService.subscribeToDashboardUpdates({
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
    });

    return () => unsubscribe();
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

    return {
      tasksCompleted: completedTasks,
      tasksTotal: totalTasks,
      messagesSent: sentMessages,
      messagesReceived: receivedMessages,
      meetingsAttended: todayMeetings,
      focusTime: 180,
      responseTime: 12,
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
      const data = await generateDailyBriefing(apiKey, contextString);

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
      alert("Journal entry copied to clipboard!");
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

  const handleSuggestionAction = (type: 'message' | 'event' | 'task' | 'email' | 'vox' | 'contact') => {
    switch (type) {
      case 'message':
        setView(AppView.MESSAGES);
        break;
      case 'event':
      case 'task':
        setView(AppView.CALENDAR);
        break;
      case 'email':
        setView(AppView.EMAIL);
        break;
      case 'vox':
        setView(AppView.VOXER);
        break;
      case 'contact':
        setView(AppView.CONTACTS);
        break;
      default:
        setView(AppView.DASHBOARD);
    }
  };

  const handleHighlightAction = (category: BriefingHighlight['category']) => {
    switch (category) {
      case 'calendar':
      case 'task':
        setView(AppView.CALENDAR);
        break;
      case 'message':
        setView(AppView.MESSAGES);
        break;
      case 'email':
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
      case 'medium': return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
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

  const wordCount = journalText.trim().split(/\s+/).filter(Boolean).length;
  const charCount = journalText.length;
  const contextualGreeting = getContextualGreeting(user?.name);

  return (
    <div className="space-y-4 sm:space-y-6 overflow-y-auto h-full pr-1 sm:pr-2 animate-fade-in pb-10 mobile-scroll">

      {/* Daily Briefing Hero - Enhanced with Beautiful Gradients */}
      {loadingBriefing || isLoading ? (
        <BriefingSkeleton />
      ) : (
        <section className="gradient-dashboard-hero texture-noise grain-effect border border-rose-800/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 text-white relative overflow-hidden animate-slide-up glow-rose-md shadow-2xl">
          {/* Mesh Gradient Base Layer */}
          <div className="absolute inset-0 mesh-gradient pointer-events-none opacity-60"></div>

          {/* Enhanced Rose/Pink Gradient Overlays with Animated Pulse */}
          <div className="absolute inset-0 bg-gradient-to-br from-rose-900/50 via-pink-900/30 to-purple-950/25 pointer-events-none animate-pulse-glow-slow"></div>
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-gradient-to-br from-rose-500/35 via-pink-500/25 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse-glow-slow"></div>
          <div className="absolute -bottom-32 -left-32 w-[450px] h-[450px] bg-gradient-to-tr from-pink-600/30 via-rose-700/20 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse-glow-slow" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-gradient-to-bl from-purple-500/20 via-pink-600/12 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse-glow-slow" style={{ animationDelay: '1s' }}></div>
          <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-rose-600/18 via-pink-700/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>

          {/* Animated Light Rays */}
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-rose-500/20 to-transparent pointer-events-none" style={{ animation: 'pulse 3s ease-in-out infinite' }}></div>
          <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-pink-500/15 to-transparent pointer-events-none" style={{ animation: 'pulse 3s ease-in-out infinite', animationDelay: '1s' }}></div>

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
                      <span className="text-zinc-600 normal-case ml-2">
                        Updated {lastBriefingRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-light mb-3 sm:mb-4 text-white tracking-tight">{contextualGreeting.greeting}</h1>
                  <p className="text-zinc-400 leading-relaxed text-sm sm:text-base max-w-2xl font-light">{briefing.summary}</p>
                  {briefing.focusRecommendation && (
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                      <i className="fa-solid fa-bullseye text-rose-400"></i>
                      <span className="text-sm text-rose-300 font-medium">{briefing.focusRecommendation}</span>
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
                  <div className="glass-card hover:glass-rose transition-all duration-300 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center group cursor-pointer card-hover-lift">
                    <div className="text-lg sm:text-2xl font-bold text-gradient-rose">{briefingStats.unreadMessages}</div>
                    <div className="text-[9px] sm:text-[10px] text-zinc-400 group-hover:text-zinc-300 uppercase tracking-wider transition-colors">Unread</div>
                  </div>
                  <div className="glass-card hover:glass-rose transition-all duration-300 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center group cursor-pointer card-hover-lift">
                    <div className="text-lg sm:text-2xl font-bold text-gradient-rose-purple">{briefingStats.pendingTasks}</div>
                    <div className="text-[9px] sm:text-[10px] text-zinc-400 group-hover:text-zinc-300 uppercase tracking-wider transition-colors">Tasks</div>
                  </div>
                  <div className="glass-card hover:glass-rose transition-all duration-300 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center group cursor-pointer card-hover-lift">
                    <div className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-rose-300 to-pink-400 bg-clip-text text-transparent">{briefingStats.todayMeetings}</div>
                    <div className="text-[9px] sm:text-[10px] text-zinc-400 group-hover:text-zinc-300 uppercase tracking-wider transition-colors">Meetings</div>
                  </div>
                  <div className="glass-card hover:glass-rose transition-all duration-300 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center group cursor-pointer card-hover-lift">
                    <div className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-pink-300 to-purple-400 bg-clip-text text-transparent">{briefingStats.unplayedVoxes}</div>
                    <div className="text-[9px] sm:text-[10px] text-zinc-400 group-hover:text-zinc-300 uppercase tracking-wider transition-colors">Voxes</div>
                  </div>
                </div>
              )}

              {/* Main content: Highlights + Suggestions */}
              <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8">
                {/* Highlights Section */}
                {briefing.highlights && briefing.highlights.length > 0 && (
                  <div className="flex-1 space-y-2 sm:space-y-3">
                    <h3 className="text-[10px] sm:text-xs font-bold text-rose-400/80 uppercase tracking-widest flex items-center gap-2">
                      <i className="fa-solid fa-fire"></i>
                      Key Highlights
                    </h3>
                    <div className="grid gap-2">
                      {briefing.highlights.slice(0, 4).map((highlight, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleHighlightAction(highlight.category)}
                          className="glass-card hover:glass-rose-strong border-gradient-rose-subtle rounded-lg sm:rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3 transition-all duration-300 cursor-pointer group card-hover-lift active:scale-[0.98] min-h-[56px]"
                        >
                          <div className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${getPriorityColor(highlight.priority)}`}>
                            <i className={`fa-solid ${getCategoryIcon(highlight.category)} text-sm`}></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-medium text-sm sm:text-sm text-zinc-200 line-clamp-1">{highlight.title}</div>
                              {highlight.priority === 'urgent' && (
                                <span className="px-1.5 py-0.5 text-[9px] bg-red-500/20 text-red-400 rounded uppercase font-bold shrink-0">Urgent</span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2 sm:line-clamp-1">{highlight.detail}</div>
                          </div>
                          <i className="fa-solid fa-chevron-right text-xs text-zinc-600 group-hover:text-rose-400 transition"></i>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions Section */}
                <div className="flex-1 space-y-2 sm:space-y-3">
                  <h3 className="text-[10px] sm:text-xs font-bold text-rose-400/80 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-lightbulb"></i>
                    Action Items
                  </h3>
                  <div className="grid gap-2">
                    {briefing.suggestions.slice(0, 4).map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="glass-card hover:glass-rose-strong border-gradient-rose-subtle rounded-lg sm:rounded-xl p-3 sm:p-4 flex items-center justify-between transition-all duration-300 group card-hover-lift active:scale-[0.98] min-h-[56px]"
                      >
                        <div className="flex-1 min-w-0 pr-2 sm:pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-medium text-sm text-zinc-200 line-clamp-1">{suggestion.action}</div>
                            {suggestion.priority === 'urgent' && (
                              <span className="px-1.5 py-0.5 text-[9px] bg-red-500/20 text-red-400 rounded uppercase font-bold shrink-0">Urgent</span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2 sm:line-clamp-1">{suggestion.reason}</div>
                        </div>
                        <button
                          onClick={() => handleSuggestionAction(suggestion.type)}
                          className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-rose-600/30 to-pink-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 group-hover:text-white group-hover:from-rose-500 group-hover:to-pink-500 group-hover:border-rose-500 transition shrink-0 active:scale-95"
                        >
                          <i className={`fa-solid ${
                            suggestion.type === 'message' ? 'fa-reply' :
                            suggestion.type === 'event' ? 'fa-calendar' :
                            suggestion.type === 'email' ? 'fa-envelope' :
                            suggestion.type === 'vox' ? 'fa-microphone' :
                            suggestion.type === 'contact' ? 'fa-user' :
                            'fa-check'
                          } text-sm sm:text-xs`}></i>
                        </button>
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
          id="attention"
          title="Attention & Focus"
          icon="fa-brain"
          iconColor="text-purple-500"
          isExpanded={expandedWidgets.has('attention')}
          onToggle={toggleWidget}
          headerAction={
            <button
              onClick={() => setView(AppView.SETTINGS)}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

        {/* Enhanced Quick Journal */}
        <CollapsibleWidget
          id="journal"
          title="Journal"
          icon="fa-book"
          iconColor="text-rose-500"
          isExpanded={expandedWidgets.has('journal')}
          onToggle={toggleWidget}
          headerAction={
            <button
              onClick={() => setView(AppView.ARCHIVES)}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition"
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
                    <i className="fa-solid fa-check text-emerald-500"></i>
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-widest dark:text-white text-zinc-900">Saved</h3>
                  <button
                    onClick={() => setView(AppView.ARCHIVES)}
                    className="mt-2 text-xs text-zinc-400 hover:text-rose-500 transition flex items-center gap-1.5 mx-auto"
                  >
                    <i className="fa-solid fa-archive text-[10px]"></i>
                    <span>View in Archive</span>
                  </button>
                </div>
              </div>
            )}

            <textarea
              className="w-full bg-transparent border-0 p-0 text-base focus:ring-0 resize-none mb-2 min-h-[200px] dark:text-zinc-200 text-zinc-800 placeholder-zinc-300 dark:placeholder-zinc-700 leading-relaxed font-light"
              placeholder="Write your thoughts..."
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
            />

            <div className="flex justify-end gap-4 text-[10px] text-zinc-400 font-mono mb-4">
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
                className="w-9 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400 transition flex items-center justify-center"
              >
                <i className="fa-solid fa-copy"></i>
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
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Recent</h4>
                  <button
                    onClick={() => setView(AppView.ARCHIVES)}
                    className="text-[10px] text-zinc-400 hover:text-rose-500 transition"
                  >
                    See all
                  </button>
                </div>
                <div className="space-y-2">
                  {recentJournals.map(journal => (
                    <button
                      key={journal.id}
                      onClick={() => setView(AppView.ARCHIVES)}
                      className="w-full text-left p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition group"
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
        <QuickScheduler />

        {/* Attention & Widgets Column */}
        <div className="flex flex-col gap-6">

          {/* Attention Budget Widget */}
          <CollapsibleWidget
            id="attention"
            title="Attention Budget"
            icon="fa-brain"
            iconColor="text-rose-400"
            isExpanded={expandedWidgets.has('attention')}
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
                  <span className="text-xs font-bold uppercase text-zinc-400">Batched ({batchedNotifications.length})</span>
                  <button onClick={() => setBatchedNotifications([])} className="text-xs text-blue-500 hover:underline">Clear All</button>
                </div>
                <div className="space-y-2">
                  {batchedNotifications.slice(0, 3).map(n => (
                    <div key={n.id} className="flex items-start gap-3 p-2 bg-white dark:bg-zinc-950 rounded-lg border border-zinc-100 dark:border-zinc-800">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase mt-0.5 min-w-[40px]">{n.source}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-zinc-700 dark:text-zinc-300 truncate">{n.message}</div>
                        <div className="text-[10px] text-zinc-400">{n.time.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-zinc-400 text-sm py-4">No batched notifications.</div>
            )}
          </CollapsibleWidget>

          {/* Live Session CTA */}
          <div className="bg-zinc-100 dark:bg-zinc-900 rounded-2xl p-6 shadow-sm relative overflow-hidden group border border-zinc-200 dark:border-zinc-800">
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-900 dark:text-white">
                  <i className="fa-solid fa-microphone text-lg"></i>
                </div>
                <h3 className="font-medium text-lg dark:text-white text-zinc-900">Voice Assistant</h3>
              </div>
              <p className="text-zinc-500 text-sm mb-6 font-light">Interact with Pulse using real-time voice and video.</p>
              <button
                onClick={() => setView(AppView.LIVE)}
                className="bg-zinc-900 dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:opacity-90 transition"
              >
                Start Session
              </button>
            </div>
          </div>

          {/* Mini Search Widget */}
          <div className="bg-zinc-900 dark:bg-black rounded-2xl p-6 shadow-sm text-white relative border border-zinc-800">
            <h3 className="font-medium text-lg mb-4 relative z-10">Grounding Search</h3>

            <form onSubmit={handleSearch} className="relative z-10">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search the web..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-4 pr-10 py-3 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none transition"
                />
                <button type="submit" className="absolute right-3 top-3 text-zinc-400 hover:text-white transition">
                  {loadingTools ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-arrow-right"></i>}
                </button>
              </div>
            </form>

            {searchResult && (
              <div className="mt-4 pt-4 border-t border-zinc-800 text-sm leading-relaxed text-zinc-300 font-light animate-fade-in relative z-10">
                <div className="line-clamp-3">{searchResult.text}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
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
          <i className="fa-solid fa-plus text-xl"></i>
        </button>
      </div>

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
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        }
        className="animate-slide-up"
      >
        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-4 border border-rose-100 dark:border-rose-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase">Tasks Done</span>
              <i className="fa-solid fa-check-circle text-rose-500"></i>
            </div>
            <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{productivityMetrics.tasksCompleted}</div>
            <div className="text-[10px] text-rose-600/60">of {productivityMetrics.tasksTotal} total</div>
          </div>
          <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4 border border-pink-100 dark:border-pink-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-pink-600 dark:text-pink-400 uppercase">Messages</span>
              <i className="fa-solid fa-message text-pink-500"></i>
            </div>
            <div className="text-2xl font-bold text-pink-700 dark:text-pink-300">{productivityMetrics.messagesSent + productivityMetrics.messagesReceived}</div>
            <div className="text-[10px] text-pink-600/60">{productivityMetrics.messagesSent} sent, {productivityMetrics.messagesReceived} received</div>
          </div>
          <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-4 border border-rose-100 dark:border-rose-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase">Focus Time</span>
              <i className="fa-solid fa-bullseye text-rose-500"></i>
            </div>
            <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{formatFocusTime(productivityMetrics.focusTime)}</div>
            <div className="text-[10px] text-rose-600/60">Deep work today</div>
          </div>
          <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4 border border-pink-100 dark:border-pink-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-pink-600 dark:text-pink-400 uppercase">Avg Response</span>
              <i className="fa-solid fa-clock text-pink-500"></i>
            </div>
            <div className="text-2xl font-bold text-pink-700 dark:text-pink-300">{productivityMetrics.responseTime}m</div>
            <div className="text-[10px] text-pink-600/60">Message response time</div>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goals Progress */}
        <CollapsibleWidget
          id="goals"
          title="Weekly Goals"
          icon="fa-bullseye"
          iconColor="text-rose-500"
          isExpanded={expandedWidgets.has('goals')}
          onToggle={toggleWidget}
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
          <div className="space-y-4">
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
                          <i className={`fa-solid ${goal.icon} text-xs text-zinc-400`}></i>
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
                          progressPercent >= 70 ? (colorClasses[iconColor as keyof typeof colorClasses] || 'bg-blue-500') :
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
              <div className="text-center py-8 text-zinc-400">
                <i className="fa-solid fa-bullseye mb-2 text-2xl"></i>
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
                <div className="text-center py-8 text-zinc-400">
                  <i className="fa-solid fa-users mb-2 text-2xl"></i>
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
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-lg transition"
                  >
                    {selectedTeamId ? 'Add Members' : 'Build Your Team'}
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {membersToDisplay.slice(0, 5).map(member => (
                  <div
                    key={member.id}
                    onClick={() => setView(AppView.MESSAGES)}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition cursor-pointer group"
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
                      <i className="fa-solid fa-message text-xs"></i>
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
            onToggle={toggleWidget}
            className="animate-slide-up"
          >
            {loadingTeamHealth ? (
              <div className="py-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
              </div>
            ) : teamHealthMetrics ? (
              <div className="space-y-6">
                {/* Communication Health */}
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-950/20 dark:to-cyan-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2 mb-4">
                    <i className="fa-solid fa-message text-emerald-600 dark:text-emerald-400"></i>
                    <h4 className="font-semibold text-sm text-zinc-900 dark:text-white">Communication Health</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Engagement Score</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{teamHealthMetrics.communicationHealth.engagementScore}</span>
                        <span className="text-xs text-zinc-400">/100</span>
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
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-4">
                    <i className="fa-solid fa-check-to-slot text-blue-600 dark:text-blue-400"></i>
                    <h4 className="font-semibold text-sm text-zinc-900 dark:text-white">Votes & Decisions</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Active Decisions</div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{teamHealthMetrics.votes.activeDecisions}</div>
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
                <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 mb-4">
                    <i className="fa-solid fa-bullseye text-purple-600 dark:text-purple-400"></i>
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
              <div className="text-center py-8 text-zinc-400">
                <i className="fa-solid fa-chart-line mb-2 text-2xl"></i>
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
        }}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col animate-scale-in border border-zinc-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-users text-pink-500"></i>
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
              }} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                <i className="fa-solid fa-times"></i>
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
                  <i className="fa-solid fa-user-check mr-2"></i>Pulse Users
                </button>
                <button
                  onClick={() => setTeamBuilderTab('contacts')}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    teamBuilderTab === 'contacts'
                      ? 'text-pink-500 border-b-2 border-pink-500'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <i className="fa-solid fa-address-book mr-2"></i>Contacts
                </button>
              </div>

              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm"></i>
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
                          <i className="fa-solid fa-times"></i>
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
                            <i className="fa-solid fa-user-plus text-2xl text-zinc-400"></i>
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
                              {user.is_verified && <i className="fa-solid fa-circle-check text-blue-500 text-xs"></i>}
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
                            <i className="fa-solid fa-address-book text-2xl text-zinc-400"></i>
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
                                onClick={() => {
                                  alert('Invite to Pulse functionality coming soon!');
                                }}
                                className="px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded transition"
                                title="Invite to Pulse"
                              >
                                <i className="fa-solid fa-paper-plane"></i>
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
                }}
                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
              >
                Cancel
              </button>
              <div className="flex items-center gap-3">
                {selectedTeamId && (
                  <button
                    onClick={async () => {
                      if (!confirm('Are you sure you want to delete this team?')) return;
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
                        alert('Failed to delete team. Please try again.');
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
                      alert('Please enter a team name');
                      return;
                    }

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
                      alert(`Failed to save team: ${errorMessage}\n\nIf you see "relation does not exist", please run the database migration: supabase/migrations/021_user_teams.sql`);
                    }
                  }}
                  className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-semibold transition shadow-lg shadow-rose-500/25"
                >
                  {selectedTeamId ? 'Save Changes' : 'Create Team'}
                </button>
              </div>
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
                  <i className="fa-solid fa-bullseye text-rose-500"></i>
                  Edit Goals
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Customize your weekly productivity targets</p>
              </div>
              <button onClick={() => setShowGoalEditor(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                <i className="fa-solid fa-times"></i>
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
                <i className="fa-solid fa-list mr-2"></i>
                All Goals
              </button>
              <button
                onClick={() => setGoalEditorTab('productivity')}
                className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                  goalEditorTab === 'productivity'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <i className="fa-solid fa-chart-line mr-2"></i>
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
                <i className="fa-solid fa-comments mr-2"></i>
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
                <i className="fa-solid fa-heart mr-2"></i>
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
                                  progressPercent >= 70 ? colorClasses[iconColor as keyof typeof colorClasses] || 'bg-blue-500' :
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
                    <i className="fa-solid fa-bullseye text-2xl text-zinc-400"></i>
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
