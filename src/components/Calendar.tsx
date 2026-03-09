import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Contact, CalendarEvent, Task } from '../types';
import { fetchCalendarEvents, fetchTasks } from '../services/authService';
import { dataService } from '../services/dataService';
import { googleCalendarService, GoogleCalendar } from '../services/googleCalendarService';
import { outlookCalendarService } from '../services/outlookCalendarService';
import { unifiedCalendarService } from '../services/unifiedCalendarService';
import { YearView, MonthView, WeekView, DayView, CalendarHeader, AgendaView, OverlayEvent } from './CalendarViews';
import DayDetailModal from './DayDetailModal';
import useSwipeGesture from '../hooks/useSwipeGesture';
import usePullToRefresh from '../hooks/usePullToRefresh';
import BottomSheet from './BottomSheet';
import PullToRefreshIndicator from './PullToRefreshIndicator';
import NaturalLanguageEventInput from './NaturalLanguageEventInput';
import SuggestedEventsPanel from './SuggestedEventsPanel';
import PostMeetingPrompt from './PostMeetingPrompt';
import { postMeetingService, MeetingFollowUp as PostMeetingFollowUp } from '../services/postMeetingService';
import CustomEventTypesManager from './CustomEventTypesManager';
import { customEventTypesService } from '../services/customEventTypesService';
import { EventCreationModal } from './Calendar/EventCreationModal';
import { CalendarAIPanel } from './Calendar/CalendarAIPanel';
import CommandPalette from './CommandPalette';
import ShortcutsHelp from './ShortcutsHelp';
import JumpToDate from './JumpToDate';
import ConflictResolutionBanner, { EventConflict, detectConflicts } from './ConflictResolutionBanner';
import './Calendar.css';
import { AlignLeft, AlertTriangle, ArrowLeftRight, ArrowRight, Bell, Brain, Calendar as CalendarIcon, CalendarCheck, CalendarDays, CalendarPlus, Car, Check, CheckCircle, ChevronRight, ClipboardList, Clock, Copy, Ellipsis, ExternalLink, FileDown, Grid3X3, HelpCircle, Lightbulb, ListChecks, Loader2, MapPin, Maximize2, Pen, PieChart, Plus, RefreshCw, Repeat, Search, Send, Settings, Sliders, Star, Sun, Trash2, Unplug, UserCog, Users, Video, Wand2, X } from 'lucide-react';
import {
  calendarAIService,
  SchedulingSuggestion,
  MeetingPrepBriefing,
  ConflictResolution,
  FocusTimeBlock,
  TravelBuffer,
  RelationshipInsight,
  MeetingEffectiveness,
  RescheduleOption,
  GoalAlignment,
  CalendarAnalytics,
  Goal,
} from '../services/calendarAIService';

interface CalendarProps {
  contacts: Contact[];
  openTaskPanel?: boolean;
  onNavigateToIntegrations?: () => void;
}

type ViewMode = 'month' | 'week' | 'day' | 'year' | 'agenda';
type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
type ReminderTime = 'none' | '5min' | '15min' | '30min' | '1hour' | '1day';

// Event color presets
const EVENT_COLORS = [
  { id: 'zinc', name: 'Default', class: 'bg-zinc-800 dark:bg-zinc-700' },
  { id: 'blue', name: 'Blue', class: 'bg-blue-600' },
  { id: 'green', name: 'Green', class: 'bg-emerald-600' },
  { id: 'red', name: 'Red', class: 'bg-red-600' },
  { id: 'purple', name: 'Purple', class: 'bg-purple-600' },
  { id: 'amber', name: 'Amber', class: 'bg-amber-600' },
  { id: 'pink', name: 'Pink', class: 'bg-pink-600' },
  { id: 'indigo', name: 'Indigo', class: 'bg-indigo-600' },
];

// Event type presets
const EVENT_TYPES = [
  { id: 'event',     name: 'Event',       icon: 'fa-calendar',          color: '#6b7280' },
  { id: 'meet',      name: 'Meeting',     icon: 'fa-video',             color: '#3b82f6' },
  { id: 'call',      name: 'Call',        icon: 'fa-phone',             color: '#10b981' },
  { id: 'focus',     name: 'Focus Time',  icon: 'fa-brain',             color: '#8b5cf6' },
  { id: 'personal',  name: 'Personal',    icon: 'fa-user',              color: '#f59e0b' },
  { id: 'deadline',  name: 'Deadline',    icon: 'fa-flag',              color: '#ef4444' },
  { id: 'travel',    name: 'Travel',      icon: 'fa-plane',             color: '#06b6d4' },
  { id: 'social',    name: 'Social',      icon: 'fa-users',             color: '#ec4899' },
  { id: 'health',    name: 'Health',      icon: 'fa-heart-pulse',       color: '#f97316' },
  { id: 'reminder',  name: 'Reminder',    icon: 'fa-bell',              color: '#a3a3a3' },
];

// Smart auto-categorization based on event title/description/location
const autoDetectEventType = (title: string, description?: string, location?: string): string => {
  const text = `${title} ${description || ''} ${location || ''}`.toLowerCase();

  // Video / online meeting
  if (/zoom|google meet|teams|webex|whereby|facetime|skype|video call|video meeting/.test(text)) return 'meet';
  // In-person meeting / call
  if (/standup|sync|1:1|one.on.one|check.in|review|retro|sprint|scrum|board meeting|all.hands/.test(text)) return 'meet';
  if (/call|phone|dial/.test(text) && !/recall|callback/.test(text)) return 'call';
  // Focus / deep work
  if (/focus|deep work|heads.down|no.interrupt|coding|writing|study|research|prep/.test(text)) return 'focus';
  // Travel
  if (/flight|airport|hotel|commute|drive to|travel|trip|vacation|conf(?:erence)?\s+trip/.test(text)) return 'travel';
  // Deadline
  if (/deadline|due|submit|launch|release|ship|milestone/.test(text)) return 'deadline';
  // Health
  if (/doctor|dentist|therapy|gym|workout|exercise|yoga|run|physio|appointment|checkup/.test(text)) return 'health';
  // Social
  if (/lunch|dinner|breakfast|coffee|happy hour|party|birthday|wedding|social|outing/.test(text)) return 'social';
  // Personal
  if (/personal|family|kids?|school|errand|grocery|haircut|car/.test(text)) return 'personal';

  return 'event';
};

// Time zone list (simplified)
const TIME_ZONES = [
  { id: 'local', name: 'Local Time', offset: '' },
  { id: 'utc', name: 'UTC', offset: '+0:00' },
  { id: 'est', name: 'Eastern', offset: '-5:00' },
  { id: 'pst', name: 'Pacific', offset: '-8:00' },
  { id: 'gmt', name: 'London', offset: '+0:00' },
  { id: 'cet', name: 'Central Europe', offset: '+1:00' },
  { id: 'ist', name: 'India', offset: '+5:30' },
  { id: 'jst', name: 'Japan', offset: '+9:00' },
];

// Team interface for custom team groupings
interface Team {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
}

const Calendar: React.FC<CalendarProps> = ({ contacts, openTaskPanel = false, onNavigateToIntegrations }) => {
  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  /** Show swipe hint the first time user enters WeekView on mobile */
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'agenda' : 'month');
  const viewModeRef = useRef(viewMode);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [visibleCalendars, setVisibleCalendars] = useState<Set<string>>(new Set(['user']));
  /** Per-calendar color overrides — persisted in localStorage as JSON */
  const [calendarColors, setCalendarColors] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('cal_calendar_colors') || '{}'); } catch { return {}; }
  });
  const [colorPickerOpenFor, setColorPickerOpenFor] = useState<string | null>(null);
  const [showTaskPanel, setShowTaskPanel] = useState(openTaskPanel);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showJumpToDate, setShowJumpToDate] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  /** Set of contact IDs whose busy-time overlay is visible on WeekView/DayView */
  const [overlayMemberIds, setOverlayMemberIds] = useState<Set<string>>(new Set());
  /** Whether the free-time finder panel is open */
  const [showFreeTimeFinder, setShowFreeTimeFinder] = useState(false);

  // Team Management State
  const [teams, setTeams] = useState<Team[]>([
    { id: 'default-team', name: 'My Team', color: 'bg-blue-500', memberIds: [] }
  ]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('default-team');
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('bg-blue-500');
  const [newTeamMembers, setNewTeamMembers] = useState<string[]>([]);

  // Calendar Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteContact, setInviteContact] = useState<Contact | null>(null);

  // Create New Google Calendar Modal
  const [showCreateCalendarModal, setShowCreateCalendarModal] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newCalendarDescription, setNewCalendarDescription] = useState('');
  const [creatingCalendar, setCreatingCalendar] = useState(false);

  // Calendar Settings Panel (in-page)
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);

  // Resizable Sidebar
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isResizing, setIsResizing] = useState(false);
  const minSidebarWidth = 200;
  const maxSidebarWidth = 400;

  // AI Assistant Panel State
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPanelTab, setAIPanelTab] = useState<'assistant' | 'insights' | 'analytics' | 'goals'>('assistant');
  const [aiLoading, setAILoading] = useState(false);
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');

  // AI Feature States
  const [schedulingSuggestions, setSchedulingSuggestions] = useState<SchedulingSuggestion[]>([]);
  const [meetingPrep, setMeetingPrep] = useState<MeetingPrepBriefing | null>(null);
  const [conflicts, setConflicts] = useState<ConflictResolution[]>([]);
  const [focusBlocks, setFocusBlocks] = useState<FocusTimeBlock[]>([]);
  const [followUps, setFollowUps] = useState<PostMeetingFollowUp[]>([]);
  const [activeFollowUpPrompt, setActiveFollowUpPrompt] = useState<PostMeetingFollowUp | null>(null);
  const [travelBuffers, setTravelBuffers] = useState<TravelBuffer[]>([]);
  const [relationshipInsights, setRelationshipInsights] = useState<RelationshipInsight[]>([]);
  const [meetingScores, setMeetingScores] = useState<Map<string, MeetingEffectiveness>>(new Map());
  const [rescheduleOptions, setRescheduleOptions] = useState<RescheduleOption[]>([]);
  const [goalAlignments, setGoalAlignments] = useState<GoalAlignment[]>([]);
  const [analytics, setAnalytics] = useState<CalendarAnalytics | null>(null);

  // Goals State
  const [goals, setGoals] = useState<Goal[]>([
    { id: 'goal-1', title: 'Deep Work', category: 'focus', priority: 1, targetHoursPerWeek: 20, color: 'bg-blue-500' },
    { id: 'goal-2', title: 'Team Meetings', category: 'collaboration', priority: 2, targetHoursPerWeek: 8, color: 'bg-green-500' },
    { id: 'goal-3', title: 'Client Work', category: 'client', priority: 3, targetHoursPerWeek: 10, color: 'bg-purple-500' },
  ]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Meeting Prep Modal
  const [showMeetingPrepModal, setShowMeetingPrepModal] = useState(false);
  const [prepEvent, setPrepEvent] = useState<CalendarEvent | null>(null);

  // Smart Reschedule Modal
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleEvent, setRescheduleEvent] = useState<CalendarEvent | null>(null);

  // Voice Command State
  const [voiceCommandResult, setVoiceCommandResult] = useState<{ action: string; response: string; data?: any } | null>(null);

  // New Event Form State
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventEndTime, setNewEventEndTime] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventAttendees, setNewEventAttendees] = useState<string[]>([]);
  const [newEventColor, setNewEventColor] = useState(EVENT_COLORS[0].class);
  const [newEventType, setNewEventType] = useState<CalendarEvent['type']>('event');
  const [newEventRecurrence, setNewEventRecurrence] = useState<RecurrenceType>('none');
  const [newEventReminder, setNewEventReminder] = useState<ReminderTime>(
    () => (localStorage.getItem('cal_default_reminder') as ReminderTime | null) ?? '15min'
  );
  /** Persist the chosen reminder so it becomes the new default for all future events */
  const setAndPersistReminder = useCallback((val: ReminderTime) => {
    setNewEventReminder(val);
    localStorage.setItem('cal_default_reminder', val);
  }, []);
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventAllDay, setNewEventAllDay] = useState(false);

  // Quick Scheduler State
  const [showQuickScheduler, setShowQuickScheduler] = useState(false);
  const [quickSchedulerDate, setQuickSchedulerDate] = useState<Date | null>(null);

  // Drag and Drop State
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);

  // Event Detail View
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);

  // Day Detail Modal State
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [dayDetailDate, setDayDetailDate] = useState<Date | null>(null);
  const [dayDetailEvents, setDayDetailEvents] = useState<CalendarEvent[]>([]);

  // Custom Event Types Manager
  const [showCustomTypesManager, setShowCustomTypesManager] = useState(false);
  const [customEventTypes, setCustomEventTypes] = useState(customEventTypesService.getAll());

  const refreshCustomTypes = useCallback(() => {
    setCustomEventTypes(customEventTypesService.getAll());
  }, []);

  // All event types: built-in + custom merged
  const allEventTypes = useMemo(() => [
    ...EVENT_TYPES,
    ...customEventTypes.map(ct => ({
      id: ct.id,
      name: ct.name,
      icon: ct.icon,
      color: ct.color,
    })),
  ], [customEventTypes]);

  // Settings Panel
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTimeZone, setSelectedTimeZone] = useState(TIME_ZONES[0].id);
  const [weekStartsOn, setWeekStartsOn] = useState<'sunday' | 'monday'>('sunday');
  const [showWeekNumbers, setShowWeekNumbers] = useState(false);

  // Search/Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEventType, setFilterEventType] = useState<string>('all');

  // Upcoming Events Panel
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showNLInput, setShowNLInput] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: 'day' | 'event';
    date?: Date;
    eventId?: string;
  }>({ visible: false, x: 0, y: 0, type: 'day' });

  // Edit Event State
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Google Calendar State
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendar[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loadedMonths, setLoadedMonths] = useState<Set<string>>(new Set());
  const [historicalSyncComplete, setHistoricalSyncComplete] = useState(false);

  // Outlook Calendar State
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [syncingOutlook, setSyncingOutlook] = useState(false);
  const [outlookError, setOutlookError] = useState<string | null>(null);
  const [outlookUserEmail, setOutlookUserEmail] = useState<string | null>(null);

  // Load local events and check Google Calendar connection
  useEffect(() => {
    const loadData = async () => {
      // Load local events
      const e = await fetchCalendarEvents();
      const t = await fetchTasks();
      setEvents(e);
      setTasks(t);

      // Check Google Calendar connection
      try {
        const connected = await googleCalendarService.isConnected();
        setGoogleConnected(connected);
        if (connected) {
          // Fetch historical events on initial load (2 years back)
          await syncGoogleCalendar(true);
        }
      } catch (error) {
        console.log('Google Calendar not connected');
      }

      // Check Outlook connection
      const outlookConn = outlookCalendarService.isConnected();
      setOutlookConnected(outlookConn);
      if (outlookConn) {
        try {
          const profile = await outlookCalendarService.getUserProfile();
          if (profile?.mail) setOutlookUserEmail(profile.mail);
          await syncOutlookCalendar();
        } catch {
          console.log('Outlook Calendar check failed');
        }
      }
    };
    loadData();
  }, []);

  // Sync with Google Calendar
  const syncGoogleCalendar = useCallback(async (fetchHistorical = false) => {
    if (syncingGoogle) return;

    setSyncingGoogle(true);
    setSyncError(null);

    try {
      // Get calendar list
      const calendars = await googleCalendarService.getCalendarList();
      setGoogleCalendars(calendars);

      // Add Google calendars to visible set
      const newVisible = new Set(visibleCalendars);
      calendars.forEach(cal => {
        if (cal.primary) newVisible.add(cal.id);
      });
      setVisibleCalendars(newVisible);

      let googleEvents: CalendarEvent[];

      if (fetchHistorical && !historicalSyncComplete) {
        // Fetch historical events (2 years back, 1 year ahead)
        googleEvents = await googleCalendarService.getHistoricalEvents({
          yearsBack: 2,
        });
        setHistoricalSyncComplete(true);
        // Mark all fetched months as loaded
        const newLoadedMonths = new Set(loadedMonths);
        googleEvents.forEach(ev => {
          const key = `${ev.start.getFullYear()}-${ev.start.getMonth()}`;
          newLoadedMonths.add(key);
        });
        setLoadedMonths(newLoadedMonths);
      } else {
        // Get events for the current month view only
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        googleEvents = await googleCalendarService.getAllEvents({
          timeMin: startOfMonth,
          timeMax: endOfMonth,
        });

        // Mark this month as loaded
        const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
        setLoadedMonths(prev => new Set([...prev, monthKey]));
      }

      // Auto-categorize Google events that have a generic type
      const categorizedGoogleEvents = googleEvents.map(e => {
        if (!e.type || e.type === 'event') {
          const detected = autoDetectEventType(e.title, e.description, e.location);
          return detected !== 'event' ? { ...e, type: detected as CalendarEvent['type'] } : e;
        }
        return e;
      });

      // Merge with local events (avoid duplicates by checking googleEventId)
      setEvents(prev => {
        const localEvents = prev.filter(e => !e.googleEventId);
        // Also filter out duplicate Google events
        const existingGoogleIds = new Set(prev.filter(e => e.googleEventId).map(e => e.googleEventId));
        const newGoogleEvents = categorizedGoogleEvents.filter(e => !existingGoogleIds.has(e.googleEventId));
        return [...localEvents, ...prev.filter(e => e.googleEventId), ...newGoogleEvents];
      });

      setLastSynced(new Date());
      setGoogleConnected(true);
    } catch (error: any) {
      console.error('Failed to sync Google Calendar:', error);

      // Check for specific error codes
      if (error.code === 'GOOGLE_CALENDAR_NOT_CONNECTED' || error.message === 'GOOGLE_CALENDAR_NOT_CONNECTED') {
        // This is expected when user hasn't connected Google Calendar yet
        setGoogleConnected(false);
        setSyncError(null); // Don't show error, just show connect button
      } else {
        setSyncError(error.userMessage || error.message || 'Failed to sync');
        if (error.message?.includes('re-authenticate') || error.message?.includes('401')) {
          setGoogleConnected(false);
        }
      }
    } finally {
      setSyncingGoogle(false);
    }
  }, [syncingGoogle, currentDate, visibleCalendars, historicalSyncComplete, loadedMonths]);

  // Sync with Outlook Calendar
  const syncOutlookCalendar = useCallback(async () => {
    if (syncingOutlook) return;
    setSyncingOutlook(true);
    setOutlookError(null);
    try {
      const now   = new Date();
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end   = new Date(now.getFullYear() + 1, 11, 31);
      const outlookEvents = await outlookCalendarService.getAllCalendarsEvents(start, end);

      setEvents(prev => {
        // Remove stale Outlook events, keep Google + local
        const nonOutlook = prev.filter(e => e.source !== 'outlook');
        // Deduplicate by outlookEventId
        const existingIds = new Set(prev.filter(e => e.source === 'outlook').map(e => e.outlookEventId));
        const newEvents   = outlookEvents.filter(e => !existingIds.has(e.outlookEventId));
        return [...nonOutlook, ...newEvents];
      });

      setOutlookConnected(true);
    } catch (err: any) {
      console.error('[Outlook] Sync failed:', err);
      setOutlookError(err.message || 'Failed to sync Outlook Calendar');
      if (err.message?.includes('expired') || err.message?.includes('reconnect')) {
        setOutlookConnected(false);
      }
    } finally {
      setSyncingOutlook(false);
    }
  }, [syncingOutlook]);

  // Disconnect Outlook
  const disconnectOutlook = useCallback(() => {
    outlookCalendarService.disconnect();
    setOutlookConnected(false);
    setOutlookUserEmail(null);
    setEvents(prev => prev.filter(e => e.source !== 'outlook'));
  }, []);

  // Connect Outlook (triggers OAuth redirect)
  const connectOutlook = useCallback(async () => {
    try {
      await outlookCalendarService.connect();
    } catch (err: any) {
      setOutlookError(err.message || 'Could not start Outlook sign-in');
    }
  }, []);

  // Lazy load events when navigating to past/future months
  const loadMonthEvents = useCallback(async (year: number, month: number) => {
    const monthKey = `${year}-${month}`;
    if (loadedMonths.has(monthKey) || !googleConnected || syncingGoogle) return;

    try {
      const monthEvents = await googleCalendarService.getEventsByMonth(year, month);
      setLoadedMonths(prev => new Set([...prev, monthKey]));
      setEvents(prev => {
        const existingGoogleIds = new Set(prev.filter(e => e.googleEventId).map(e => e.googleEventId));
        const newEvents = monthEvents.filter(e => !existingGoogleIds.has(e.googleEventId));
        return [...prev, ...newEvents];
      });
    } catch (error) {
      console.error(`Failed to load events for ${year}-${month}:`, error);
    }
  }, [loadedMonths, googleConnected, syncingGoogle]);

  // Lazy load events when navigating to different months
  useEffect(() => {
    if (googleConnected && !historicalSyncComplete) {
      // If not synced historically, load current month
      loadMonthEvents(currentDate.getFullYear(), currentDate.getMonth());
    }
  }, [currentDate.getMonth(), currentDate.getFullYear(), googleConnected, historicalSyncComplete, loadMonthEvents]);

  // Handle openTaskPanel prop
  useEffect(() => {
    if (openTaskPanel) {
      setShowTaskPanel(true);
    }
  }, [openTaskPanel]);

  // Mobile detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Switch to appropriate view when screen size changes
      if (mobile && (viewModeRef.current === 'week' || viewModeRef.current === 'month')) {
        setViewMode('agenda');
      } else if (!mobile && viewModeRef.current === 'agenda') {
        setViewMode('month');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []); // listener registered once, reads latest viewMode via ref

  // Post-meeting follow-up monitoring
  useEffect(() => {
    // Start monitoring for ended meetings
    postMeetingService.startMonitoring(events);

    // Listen for meeting ended events
    const handleMeetingEnded = (event: Event) => {
      const customEvent = event as CustomEvent<PostMeetingFollowUp>;
      setActiveFollowUpPrompt(customEvent.detail);
      setFollowUps(postMeetingService.getPendingFollowUps());
    };

    // Listen for follow-up updates
    const handleFollowUpUpdated = () => {
      setFollowUps(postMeetingService.getPendingFollowUps());
    };

    window.addEventListener('pulse:meeting-ended', handleMeetingEnded as EventListener);
    window.addEventListener('pulse:followup-updated', handleFollowUpUpdated);

    return () => {
      postMeetingService.stopMonitoring();
      window.removeEventListener('pulse:meeting-ended', handleMeetingEnded as EventListener);
      window.removeEventListener('pulse:followup-updated', handleFollowUpUpdated);
    };
  }, [events]);

  // Navigation handlers — defined here so keyboard shortcut useEffect can reference them
  const handlePrev = useCallback(() => {
    const newDate = new Date(currentDate);
    if (viewMode === 'year') newDate.setFullYear(newDate.getFullYear() - 1);
    else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  }, [currentDate, viewMode]);

  const handleNext = useCallback(() => {
    const newDate = new Date(currentDate);
    if (viewMode === 'year') newDate.setFullYear(newDate.getFullYear() + 1);
    else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  }, [currentDate, viewMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+K / Ctrl+K — command palette (works even while typing)
      if (meta && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
        return;
      }

      // Cmd+J — jump to date (works even while typing)
      if (meta && e.key === 'j') {
        e.preventDefault();
        setShowJumpToDate(prev => !prev);
        return;
      }

      // Cmd+F — focus mode toggle (works even while typing)
      if (meta && e.key === 'f') {
        e.preventDefault();
        setFocusMode(prev => !prev);
        return;
      }

      // Don't fire remaining shortcuts when typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (showEventModal || showDayDetail) return;

      switch (e.key) {
        // View switching
        case 'd': case 'D': setViewMode('day'); break;
        case 'w': case 'W': setViewMode('week'); break;
        case 'm': case 'M': setViewMode('month'); break;
        case 'y': case 'Y': setViewMode('year'); break;
        case 'a': case 'A': setViewMode('agenda'); break;
        // Navigation
        case 't': case 'T': setCurrentDate(new Date()); break;
        case 'ArrowLeft':  if (!meta) { e.preventDefault(); handlePrev(); } break;
        case 'ArrowRight': if (!meta) { e.preventDefault(); handleNext(); } break;
        // New event
        case 'n': case 'c': case 'N': case 'C':
          setShowEventModal(true);
          break;
        // Edit selected event
        case 'e': case 'E':
          if (selectedEvent) openEventDetail(selectedEvent);
          break;
        // Delete selected event
        case 'Delete': case 'Backspace':
          if (selectedEvent) {
            setEvents(prev => prev.filter(ev => ev.id !== selectedEvent.id));
            dataService.deleteEvent(selectedEvent.id).catch(() => {});
            setSelectedEvent(null);
            setShowEventDetail(false);
          }
          break;
        // Search focus
        case '/':
          e.preventDefault();
          document.querySelector<HTMLInputElement>('input[placeholder="Search events..."]')?.focus();
          break;
        // AI panel
        case 'i': case 'I':
          if (meta) { e.preventDefault(); setShowAIPanel(prev => !prev); }
          break;
        // Shortcuts help sheet
        case '?':
          e.preventDefault();
          setShowShortcutsHelp(prev => !prev);
          break;
        // Escape — dismiss in priority order
        case 'Escape':
          if (showShortcutsHelp) { setShowShortcutsHelp(false); break; }
          if (showJumpToDate)    { setShowJumpToDate(false);    break; }
          if (focusMode)         { setFocusMode(false);         break; }
          setShowAIPanel(false);
          setShowCalendarSettings(false);
          setShowCommandPalette(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showEventModal, showDayDetail, showShortcutsHelp, showJumpToDate, focusMode, selectedEvent, handlePrev, handleNext]);

  // Swipe gesture navigation
  const navigateNext = useCallback(() => {
    const newDate = new Date(currentDate);
    if (viewMode === 'year') {
      newDate.setFullYear(newDate.getFullYear() + 1);
    } else if (viewMode === 'month' || viewMode === 'agenda') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  }, [currentDate, viewMode]);

  const navigatePrev = useCallback(() => {
    const newDate = new Date(currentDate);
    if (viewMode === 'year') {
      newDate.setFullYear(newDate.getFullYear() - 1);
    } else if (viewMode === 'month' || viewMode === 'agenda') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  }, [currentDate, viewMode]);

  const { handleTouchStart, handleTouchMove, handleTouchEnd: rawTouchEnd } = useSwipeGesture({
    onSwipeLeft: navigateNext,
    onSwipeRight: navigatePrev,
    minSwipeDistance: 75,
  });
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    rawTouchEnd(e);
    if (showSwipeHint) {
      setShowSwipeHint(false);
      localStorage.setItem('cal_swipe_hint_seen', '1');
    }
  }, [rawTouchEnd, showSwipeHint]);

  // Pull-to-refresh for mobile
  const handleRefresh = useCallback(async () => {
    await syncGoogleCalendar();
  }, [syncGoogleCalendar]);

  const pullToRefresh = usePullToRefresh({
    onRefresh: handleRefresh,
    enabled: isMobile && googleConnected,
    threshold: 80,
  });

  // ─── Background sync polling — every 5 minutes ───────────────────────────
  // Show a one-time swipe hint when user first opens WeekView on mobile
  useEffect(() => {
    if (!isMobile || viewMode !== 'week') return;
    if (localStorage.getItem('cal_swipe_hint_seen')) return;
    setShowSwipeHint(true);
    const timer = setTimeout(() => {
      setShowSwipeHint(false);
      localStorage.setItem('cal_swipe_hint_seen', '1');
    }, 3000);
    return () => clearTimeout(timer);
  }, [isMobile, viewMode]);

  const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    // Don't poll if neither provider is connected
    if (!googleConnected && !outlookConnected) return;

    const poll = async () => {
      // Silent sync — don't set the loading spinners (those are for manual clicks)
      try {
        if (googleConnected && !syncingGoogle) {
          await syncGoogleCalendar();
        }
      } catch { /* swallow — errors already logged inside syncGoogleCalendar */ }

      try {
        if (outlookConnected && !syncingOutlook) {
          await syncOutlookCalendar();
        }
      } catch { /* swallow */ }
    };

    const timer = setInterval(poll, SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
    // Re-register whenever connection state changes so we start/stop immediately
  }, [googleConnected, outlookConnected, syncGoogleCalendar, syncOutlookCalendar]);

  // ─── Conflict detection ───────────────────────────────────────────────────
  const [syncConflicts, setSyncConflicts] = useState<EventConflict[]>([]);
  // A set of conflict IDs dismissed by the user this session
  const [dismissedConflicts, setDismissedConflicts] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Only run when multiple providers are active
    if (!googleConnected && !outlookConnected) { setSyncConflicts([]); return; }
    const detected = detectConflicts(events).filter(c => !dismissedConflicts.has(c.id));
    setSyncConflicts(detected);
  }, [events, googleConnected, outlookConnected, dismissedConflicts]);

  const handleConflictKeepA = useCallback((conflict: EventConflict) => {
    // Remove eventB from state + DB
    setEvents(prev => prev.filter(ev => ev.id !== conflict.eventB.id));
    dataService.deleteEvent(conflict.eventB.id).catch(() => {});
    setDismissedConflicts(prev => new Set([...prev, conflict.id]));
  }, []);

  const handleConflictKeepB = useCallback((conflict: EventConflict) => {
    // Remove eventA from state + DB
    setEvents(prev => prev.filter(ev => ev.id !== conflict.eventA.id));
    dataService.deleteEvent(conflict.eventA.id).catch(() => {});
    setDismissedConflicts(prev => new Set([...prev, conflict.id]));
  }, []);

  const handleConflictDismiss = useCallback((conflict: EventConflict) => {
    setDismissedConflicts(prev => new Set([...prev, conflict.id]));
  }, []);

  // Sidebar resize handlers
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !sidebarRef.current) return;

      // Get the sidebar's parent container's left position
      const parentRect = sidebarRef.current.parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      // Calculate width relative to the parent container's left edge
      const newWidth = e.clientX - parentRect.left;

      if (newWidth >= minSidebarWidth && newWidth <= maxSidebarWidth) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Get team members for selected team
  const selectedTeam = useMemo(() =>
    teams.find(t => t.id === selectedTeamId) || teams[0],
    [teams, selectedTeamId]
  );

  const teamMembers = useMemo(() => {
    // Filter contacts that are in the selected team OR have isTeamMember flag
    if (selectedTeam.memberIds.length > 0) {
      return contacts.filter(c => selectedTeam.memberIds.includes(c.id));
    }
    // Default: show contacts marked as team members
    return contacts.filter(c => c.isTeamMember || c.contactType === 'team');
  }, [contacts, selectedTeam]);

  /**
   * Convert a Tailwind avatar color class (e.g. "bg-blue-500") to a hex color
   * usable for inline CSS. Falls back to #6b7280 (zinc-500) if unrecognised.
   */
  const avatarColorToHex = useCallback((cls: string): string => {
    const map: Record<string, string> = {
      'bg-red-500': '#ef4444',    'bg-red-400': '#f87171',
      'bg-orange-500': '#f97316', 'bg-amber-500': '#f59e0b',
      'bg-yellow-500': '#eab308', 'bg-lime-500': '#84cc16',
      'bg-green-500': '#22c55e',  'bg-emerald-500': '#10b981',
      'bg-teal-500': '#14b8a6',   'bg-cyan-500': '#06b6d4',
      'bg-sky-500': '#0ea5e9',    'bg-blue-500': '#3b82f6',
      'bg-indigo-500': '#6366f1', 'bg-violet-500': '#8b5cf6',
      'bg-purple-500': '#a855f7', 'bg-fuchsia-500': '#d946ef',
      'bg-pink-500': '#ec4899',   'bg-rose-500': '#f43f5e',
      'bg-blue-400': '#60a5fa',   'bg-green-400': '#4ade80',
      'bg-purple-400': '#c084fc', 'bg-pink-400': '#f472b6',
    };
    return map[cls] ?? '#6b7280';
  }, []);

  /**
   * Generate simulated busy-time overlay events for the currently visible
   * team members. We derive "busy blocks" from the week window centred on
   * currentDate by spreading each member's working hours across the visible
   * days with a deterministic but varied pattern (so different members look
   * different without real calendar data).
   */
  const overlayEvents = useMemo<OverlayEvent[]>(() => {
    if (overlayMemberIds.size === 0) return [];
    if (viewMode !== 'week' && viewMode !== 'day') return [];

    // Build a 7-day window centred on the current week (or just current day)
    const windowStart = new Date(currentDate);
    if (viewMode === 'week') {
      windowStart.setDate(windowStart.getDate() - windowStart.getDay());
    }
    const days = viewMode === 'week' ? 7 : 1;

    const result: OverlayEvent[] = [];

    teamMembers
      .filter(m => overlayMemberIds.has(m.id))
      .forEach((member, memberIdx) => {
        const color = avatarColorToHex(member.avatarColor);

        for (let d = 0; d < days; d++) {
          const day = new Date(windowStart);
          day.setDate(day.getDate() + d);

          // Skip weekends for realistic feel
          const dow = day.getDay();
          if (dow === 0 || dow === 6) continue;

          // Deterministic pseudo-random: hash memberIdx + day index
          const seed = (memberIdx + 1) * 31 + d;

          // Morning block: 9–11 or 10–12 depending on seed
          const morningStart = 9 + (seed % 2);
          const morningEnd   = morningStart + 1 + (seed % 3 === 0 ? 0.5 : 1);
          const blockStart1 = new Date(day);
          blockStart1.setHours(morningStart, 0, 0, 0);
          const blockEnd1 = new Date(day);
          blockEnd1.setHours(0, morningEnd * 60, 0, 0);
          blockEnd1.setTime(blockStart1.getTime() + (morningEnd - morningStart) * 60 * 60 * 1000);

          result.push({
            id: `overlay-${member.id}-${d}-am`,
            memberId: member.id,
            memberName: member.name,
            color,
            start: blockStart1,
            end: blockEnd1,
          });

          // Afternoon block if seed allows (avoids monotony)
          if (seed % 3 !== 2) {
            const afStart = 14 + (seed % 2);
            const afDuration = 1 + (seed % 2 === 0 ? 0.5 : 1);
            const blockStart2 = new Date(day);
            blockStart2.setHours(afStart, 0, 0, 0);
            const blockEnd2 = new Date(blockStart2.getTime() + afDuration * 60 * 60 * 1000);

            result.push({
              id: `overlay-${member.id}-${d}-pm`,
              memberId: member.id,
              memberName: member.name,
              color,
              start: blockStart2,
              end: blockEnd2,
            });
          }
        }
      });

    return result;
  }, [overlayMemberIds, teamMembers, currentDate, viewMode, avatarColorToHex]);

  // Team management functions
  const handleCreateTeam = () => {
    if (!newTeamName.trim()) return;

    const newTeam: Team = {
      id: `team-${Date.now()}`,
      name: newTeamName.trim(),
      color: newTeamColor,
      memberIds: newTeamMembers,
    };

    setTeams(prev => [...prev, newTeam]);
    setSelectedTeamId(newTeam.id);
    setShowTeamModal(false);
    resetTeamForm();
  };

  const handleUpdateTeam = () => {
    if (!editingTeam || !newTeamName.trim()) return;

    setTeams(prev => prev.map(t =>
      t.id === editingTeam.id
        ? { ...t, name: newTeamName.trim(), color: newTeamColor, memberIds: newTeamMembers }
        : t
    ));
    setShowTeamModal(false);
    resetTeamForm();
  };

  const handleDeleteTeam = (teamId: string) => {
    if (teams.length <= 1) return; // Keep at least one team
    setTeams(prev => prev.filter(t => t.id !== teamId));
    if (selectedTeamId === teamId) {
      setSelectedTeamId(teams[0].id);
    }
  };

  const resetTeamForm = () => {
    setNewTeamName('');
    setNewTeamColor('bg-blue-500');
    setNewTeamMembers([]);
    setEditingTeam(null);
  };

  const openEditTeam = (team: Team) => {
    setEditingTeam(team);
    setNewTeamName(team.name);
    setNewTeamColor(team.color);
    setNewTeamMembers(team.memberIds);
    setShowTeamModal(true);
  };

  // Calendar invite function
  const handleSendInvite = async (contact: Contact, eventDetails: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    description?: string;
  }) => {
    const start = new Date(`${eventDetails.date}T${eventDetails.startTime}`);
    const end = new Date(`${eventDetails.date}T${eventDetails.endTime}`);

    const newEvent: CalendarEvent = {
      id: Date.now().toString(),
      title: eventDetails.title,
      start,
      end,
      color: 'bg-blue-600',
      calendarId: 'user',
      allDay: false,
      description: eventDetails.description,
      attendees: [contact.email],
      type: 'meet',
    };

    // Create in Google Calendar if connected (will send invite)
    if (googleConnected) {
      try {
        const googleEvent = await googleCalendarService.createEvent(newEvent, 'primary', {
          sendUpdates: 'all' // This sends email invites to attendees
        });
        newEvent.id = googleEvent.id;
        newEvent.googleEventId = googleEvent.googleEventId;
        newEvent.calendarId = googleEvent.calendarId;
      } catch (error) {
        console.error('Failed to create Google Calendar event:', error);
      }
    }

    setEvents(prev => [...prev, newEvent]);
    setShowInviteModal(false);
    setInviteContact(null);
  };

  // Create new Google Calendar
  const handleCreateGoogleCalendar = async () => {
    if (!newCalendarName.trim() || !googleConnected) return;

    setCreatingCalendar(true);
    try {
      // Use Google Calendar API to create a new calendar
      const response = await googleCalendarService.createCalendar({
        summary: newCalendarName.trim(),
        description: newCalendarDescription,
      });

      // Refresh calendars list
      await syncGoogleCalendar();

      setShowCreateCalendarModal(false);
      setNewCalendarName('');
      setNewCalendarDescription('');
    } catch (error) {
      console.error('Failed to create Google Calendar:', error);
    } finally {
      setCreatingCalendar(false);
    }
  };

  // ============================================
  // AI FEATURE HANDLERS
  // ============================================

  // Initialize goals in the AI service
  useEffect(() => {
    calendarAIService.setGoals(goals);
  }, [goals]);

  // Natural language event parsing
  const handleNaturalLanguageSubmit = async () => {
    if (!naturalLanguageInput.trim()) return;

    setAILoading(true);
    try {
      const parsed = await calendarAIService.parseNaturalLanguageEvent(naturalLanguageInput, contacts);
      if (parsed && parsed.title) {
        // Pre-fill the event form
        setNewEventTitle(parsed.title || '');
        if (parsed.start) {
          setNewEventDate(parsed.start.toISOString().split('T')[0]);
          setNewEventTime(parsed.start.toTimeString().slice(0, 5));
        }
        if (parsed.end) {
          setNewEventEndTime(parsed.end.toTimeString().slice(0, 5));
        }
        setNewEventType(parsed.type || 'event');
        setNewEventLocation(parsed.location || '');
        setNewEventDesc(parsed.description || '');
        setNewEventAllDay(parsed.allDay || false);
        if (parsed.attendees) {
          const attendeeIds = contacts
            .filter(c => parsed.attendees?.includes(c.email))
            .map(c => c.id);
          setNewEventAttendees(attendeeIds);
        }
        setShowEventModal(true);
        setNaturalLanguageInput('');
      }
    } catch (error) {
      console.error('Failed to parse natural language:', error);
    } finally {
      setAILoading(false);
    }
  };

  // Get smart scheduling suggestions
  const handleGetSuggestions = async (duration: number = 30) => {
    setAILoading(true);
    try {
      const suggestions = await calendarAIService.suggestMeetingTimes(duration, [], {
        avoidBackToBack: true,
        prioritizeMornings: false,
      });
      setSchedulingSuggestions(suggestions);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
    } finally {
      setAILoading(false);
    }
  };

  // Generate meeting prep briefing
  const handleGenerateMeetingPrep = async (event: CalendarEvent) => {
    setAILoading(true);
    setPrepEvent(event);
    try {
      const prep = await calendarAIService.generateMeetingPrep(event, contacts, [], events);
      setMeetingPrep(prep);
      setShowMeetingPrepModal(true);
    } catch (error) {
      console.error('Failed to generate meeting prep:', error);
    } finally {
      setAILoading(false);
    }
  };

  // Detect conflicts
  const handleDetectConflicts = async () => {
    setAILoading(true);
    try {
      const detected = await calendarAIService.detectConflicts(events);
      setConflicts(detected);
    } catch (error) {
      console.error('Failed to detect conflicts:', error);
    } finally {
      setAILoading(false);
    }
  };

  // Suggest focus blocks
  const handleSuggestFocusBlocks = async () => {
    setAILoading(true);
    try {
      const suggestions = await calendarAIService.suggestFocusBlocks(events, tasks);
      setFocusBlocks(suggestions);
    } catch (error) {
      console.error('Failed to suggest focus blocks:', error);
    } finally {
      setAILoading(false);
    }
  };

  // Add focus block to calendar
  const handleAddFocusBlock = (block: FocusTimeBlock) => {
    const newEvent: CalendarEvent = {
      id: block.id,
      title: `Focus Time: ${block.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      start: block.date,
      end: new Date(block.date.getTime() + 90 * 60 * 1000),
      color: 'bg-indigo-600',
      calendarId: 'user',
      allDay: false,
      type: 'event',
      description: 'Protected focus time block - AI suggested',
    };
    setEvents(prev => [...prev, newEvent]);
    setFocusBlocks(prev => prev.filter(b => b.id !== block.id));
  };

  // Analyze travel buffers
  const handleAnalyzeTravelBuffers = async () => {
    setAILoading(true);
    try {
      const buffers = await calendarAIService.analyzeTravelBuffers(events);
      setTravelBuffers(buffers);
    } catch (error) {
      console.error('Failed to analyze travel buffers:', error);
    } finally {
      setAILoading(false);
    }
  };

  // Analyze relationships
  const handleAnalyzeRelationships = async () => {
    setAILoading(true);
    try {
      const insights = await calendarAIService.analyzeRelationships(contacts, events);
      setRelationshipInsights(insights);
    } catch (error) {
      console.error('Failed to analyze relationships:', error);
    } finally {
      setAILoading(false);
    }
  };

  // Generate analytics
  const handleGenerateAnalytics = async () => {
    setAILoading(true);
    try {
      const result = await calendarAIService.generateAnalytics(events, 'week');
      setAnalytics(result);
    } catch (error) {
      console.error('Failed to generate analytics:', error);
    } finally {
      setAILoading(false);
    }
  };

  // Analyze goal alignment
  const handleAnalyzeGoalAlignment = async () => {
    setAILoading(true);
    try {
      const alignments = await calendarAIService.analyzeGoalAlignment(events);
      setGoalAlignments(alignments);
    } catch (error) {
      console.error('Failed to analyze goal alignment:', error);
    } finally {
      setAILoading(false);
    }
  };

  // Smart reschedule
  const handleSmartReschedule = async (event: CalendarEvent) => {
    setAILoading(true);
    setRescheduleEvent(event);
    try {
      const options = await calendarAIService.generateRescheduleOptions(event, events);
      setRescheduleOptions(options);
      setShowRescheduleModal(true);
    } catch (error) {
      console.error('Failed to generate reschedule options:', error);
    } finally {
      setAILoading(false);
    }
  };

  // Apply reschedule
  const handleApplyReschedule = (option: RescheduleOption) => {
    if (!rescheduleEvent) return;

    setEvents(prev => prev.map(e =>
      e.id === rescheduleEvent.id
        ? { ...e, start: option.newStart, end: option.newEnd }
        : e
    ));
    setShowRescheduleModal(false);
    setRescheduleEvent(null);
    setRescheduleOptions([]);
  };

  // Process voice command
  const handleVoiceCommand = async (command: string) => {
    setAILoading(true);
    try {
      const result = await calendarAIService.processVoiceCommand(command, contacts, events);
      setVoiceCommandResult(result);

      // Handle actions
      if (result.action === 'create_event' && result.data) {
        const parsed = result.data;
        setNewEventTitle(parsed.title || '');
        if (parsed.start) {
          setNewEventDate(parsed.start.toISOString().split('T')[0]);
          setNewEventTime(parsed.start.toTimeString().slice(0, 5));
        }
        if (parsed.end) {
          setNewEventEndTime(parsed.end.toTimeString().slice(0, 5));
        }
        setShowEventModal(true);
      }
    } catch (error) {
      console.error('Failed to process voice command:', error);
    } finally {
      setAILoading(false);
    }
  };

  // Generate meeting follow-up
  const handleGenerateFollowUp = async (event: CalendarEvent, notes?: string) => {
    setAILoading(true);
    try {
      const followUp = await calendarAIService.generateMeetingFollowUp(event, notes);
      setFollowUps(prev => [...prev, followUp as unknown as PostMeetingFollowUp]);
    } catch (error) {
      console.error('Failed to generate follow-up:', error);
    } finally {
      setAILoading(false);
    }
  };

  // Run all AI analyses
  const handleRunAllAnalyses = async () => {
    setAILoading(true);
    try {
      await Promise.all([
        handleDetectConflicts(),
        handleAnalyzeTravelBuffers(),
        handleAnalyzeRelationships(),
        handleGenerateAnalytics(),
        handleAnalyzeGoalAlignment(),
        handleSuggestFocusBlocks(),
      ]);
    } catch (error) {
      console.error('Failed to run analyses:', error);
    } finally {
      setAILoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const toggleCalendarVisibility = (id: string) => {
    const newSet = new Set(visibleCalendars);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setVisibleCalendars(newSet);
  };

  const setCalendarColor = useCallback((calId: string, color: string) => {
    setCalendarColors(prev => {
      const next = { ...prev, [calId]: color };
      localStorage.setItem('cal_calendar_colors', JSON.stringify(next));
      return next;
    });
    setColorPickerOpenFor(null);
  }, []);

  // Close color picker popover when clicking elsewhere
  useEffect(() => {
    if (!colorPickerOpenFor) return;
    const close = () => setColorPickerOpenFor(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [colorPickerOpenFor]);

  // Close export menu when clicking elsewhere
  useEffect(() => {
    if (!showExportMenu) return;
    const close = () => setShowExportMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showExportMenu]);

  const toggleTask = (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t));
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle || !newEventDate) return;

    const start = new Date(`${newEventDate}T${newEventTime || '09:00'}`);
    const end = newEventEndTime
      ? new Date(`${newEventDate}T${newEventEndTime}`)
      : new Date(start.getTime() + 60 * 60 * 1000);

    if (editingEvent) {
      // Update existing event
      const updatedEvent = {
        ...editingEvent,
        title: newEventTitle,
        start,
        end,
        description: newEventDesc,
        allDay: newEventAllDay || !newEventTime,
        color: newEventColor,
        type: newEventType,
        location: newEventLocation,
        attendees: newEventAttendees.map(id => contacts.find(c => c.id === id)?.email || id),
      };

      // Update in Google Calendar if it's a Google event
      if (editingEvent.googleEventId && googleConnected) {
        try {
          await googleCalendarService.updateEvent(
            editingEvent.googleEventId,
            updatedEvent,
            editingEvent.calendarId || 'primary'
          );
        } catch (error) {
          console.error('Failed to update Google Calendar event:', error);
        }
      }

      setEvents(prev => prev.map(ev =>
        ev.id === editingEvent.id ? updatedEvent : ev
      ));
      setEditingEvent(null);
    } else {
      // Create new event
      const newEvent: CalendarEvent = {
          id: Date.now().toString(),
          title: newEventTitle,
          start,
          end,
          color: newEventColor,
          calendarId: 'user',
          allDay: newEventAllDay || !newEventTime,
          description: newEventDesc,
          location: newEventLocation,
          attendees: newEventAttendees.map(id => contacts.find(c => c.id === id)?.email || id),
          type: newEventType,
      };

      // Create in Google Calendar if connected
      if (googleConnected) {
        try {
          const googleEvent = await googleCalendarService.createEvent(newEvent);
          newEvent.id = googleEvent.id;
          newEvent.googleEventId = googleEvent.googleEventId;
          newEvent.calendarId = googleEvent.calendarId;
        } catch (error) {
          console.error('Failed to create Google Calendar event:', error);
          // Still add locally even if Google sync fails
        }
      }

      setEvents(prev => [...prev, newEvent]);

      // Generate recurring events if needed
      if (newEventRecurrence !== 'none') {
        const recurringEvents: CalendarEvent[] = [];
        const count = newEventRecurrence === 'daily' ? 30 : newEventRecurrence === 'weekly' ? 12 : 12;

        for (let i = 1; i <= count; i++) {
          const recurStart = new Date(start);
          const recurEnd = new Date(end);

          switch (newEventRecurrence) {
            case 'daily':
              recurStart.setDate(recurStart.getDate() + i);
              recurEnd.setDate(recurEnd.getDate() + i);
              break;
            case 'weekly':
              recurStart.setDate(recurStart.getDate() + (i * 7));
              recurEnd.setDate(recurEnd.getDate() + (i * 7));
              break;
            case 'monthly':
              recurStart.setMonth(recurStart.getMonth() + i);
              recurEnd.setMonth(recurEnd.getMonth() + i);
              break;
            case 'yearly':
              recurStart.setFullYear(recurStart.getFullYear() + i);
              recurEnd.setFullYear(recurEnd.getFullYear() + i);
              break;
          }

          recurringEvents.push({
            ...newEvent,
            id: `${newEvent.id}-${i}`,
            start: recurStart,
            end: recurEnd,
          });
        }

        setEvents(prev => [...prev, ...recurringEvents]);
      }
    }

    setShowEventModal(false);
    resetForm();
  };

  const resetForm = () => {
    setNewEventTitle('');
    setNewEventDate('');
    setNewEventTime('');
    setNewEventEndTime('');
    setNewEventDesc('');
    setNewEventAttendees([]);
    setNewEventColor(EVENT_COLORS[0].class);
    setNewEventType('event');
    setNewEventRecurrence('none');
    // Reset to persisted default (not always '15min')
    setNewEventReminder((localStorage.getItem('cal_default_reminder') as ReminderTime | null) ?? '15min');
    setNewEventLocation('');
    setNewEventAllDay(false);
    setEditingEvent(null);
  };

  // Filter events by search and type
  const filteredEvents = useMemo(() => {
    let filtered = events.filter(e => visibleCalendars.has(e.calendarId));

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query) ||
        e.location?.toLowerCase().includes(query)
      );
    }

    if (filterEventType !== 'all') {
      filtered = filtered.filter(e => e.type === filterEventType);
    }

    return filtered;
  }, [events, visibleCalendars, searchQuery, filterEventType]);

  /**
   * Export the currently-visible events as an RFC 5545 .ics file.
   * Scope: events within the current view window (week, day, month, or all).
   */
  const exportAsICS = useCallback(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const toICSDate = (d: Date) =>
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T` +
      `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

    // Determine the window to export
    const windowStart = new Date(currentDate);
    const windowEnd   = new Date(currentDate);
    if (viewMode === 'week') {
      windowStart.setDate(windowStart.getDate() - windowStart.getDay());
      windowStart.setHours(0, 0, 0, 0);
      windowEnd.setDate(windowStart.getDate() + 7);
    } else if (viewMode === 'day') {
      windowStart.setHours(0, 0, 0, 0);
      windowEnd.setDate(windowStart.getDate() + 1);
    } else if (viewMode === 'month') {
      windowStart.setDate(1); windowStart.setHours(0, 0, 0, 0);
      windowEnd.setMonth(windowEnd.getMonth() + 1); windowEnd.setDate(0);
    } else {
      windowStart.setFullYear(windowStart.getFullYear(), 0, 1);
      windowEnd.setFullYear(windowEnd.getFullYear(), 11, 31);
    }

    const scope = filteredEvents.filter(e =>
      e.start >= windowStart && e.start <= windowEnd
    );

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Pulse Calendar//EN',
      'CALSCALE:GREGORIAN',
    ];

    scope.forEach(ev => {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${ev.id}@pulse-calendar`);
      lines.push(`DTSTAMP:${toICSDate(new Date())}`);
      if (ev.allDay) {
        const ds = ev.start;
        const de = ev.end;
        lines.push(`DTSTART;VALUE=DATE:${ds.getFullYear()}${pad(ds.getMonth()+1)}${pad(ds.getDate())}`);
        lines.push(`DTEND;VALUE=DATE:${de.getFullYear()}${pad(de.getMonth()+1)}${pad(de.getDate())}`);
      } else {
        lines.push(`DTSTART:${toICSDate(ev.start)}`);
        lines.push(`DTEND:${toICSDate(ev.end)}`);
      }
      lines.push(`SUMMARY:${ev.title.replace(/\n/g, '\\n')}`);
      if (ev.description) lines.push(`DESCRIPTION:${ev.description.replace(/\n/g, '\\n')}`);
      if (ev.location)    lines.push(`LOCATION:${ev.location.replace(/\n/g, '\\n')}`);
      if (ev.meetLink)    lines.push(`URL:${ev.meetLink}`);
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const label = viewMode === 'week'  ? `week-of-${windowStart.toISOString().slice(0,10)}` :
                  viewMode === 'day'   ? currentDate.toISOString().slice(0,10) :
                  viewMode === 'month' ? `${currentDate.getFullYear()}-${pad(currentDate.getMonth()+1)}` :
                  String(currentDate.getFullYear());
    a.href     = url;
    a.download = `pulse-calendar-${label}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [currentDate, viewMode, filteredEvents]);

  /**
   * Free-time slots: working-hours windows (9 AM – 6 PM) where no visible
   * overlay member AND no user event is scheduled. Returned as 30-min slots
   * merged into contiguous blocks ≥ 30 min. Only computed for week/day views.
   */
  const freeTimeSlots = useMemo<{ start: Date; end: Date; dayLabel: string }[]>(() => {
    if (!showFreeTimeFinder) return [];
    if (viewMode !== 'week' && viewMode !== 'day') return [];

    const windowStart = new Date(currentDate);
    if (viewMode === 'week') {
      windowStart.setDate(windowStart.getDate() - windowStart.getDay());
    }
    const days = viewMode === 'week' ? 7 : 1;
    const WORK_START = 9;  // 9 AM
    const WORK_END   = 18; // 6 PM
    const SLOT_MIN   = 30; // minutes per slot chunk

    const allBusy = [...overlayEvents, ...filteredEvents.filter(e => !e.allDay).map(e => ({
      start: e.start, end: e.end,
    }))];

    const slots: { start: Date; end: Date; dayLabel: string }[] = [];

    for (let d = 0; d < days; d++) {
      const day = new Date(windowStart);
      day.setDate(day.getDate() + d);

      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends

      const dayLabel = day.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

      // Collect busy intervals for this day
      const dayBusy = allBusy
        .filter(b => {
          const sd = new Date(b.start);
          return sd.getFullYear() === day.getFullYear() &&
                 sd.getMonth() === day.getMonth() &&
                 sd.getDate() === day.getDate();
        })
        .map(b => ({ s: b.start.getTime(), e: b.end.getTime() }));

      // Walk through 30-min slots in working hours
      let freeStart: Date | null = null;

      const totalSlots = ((WORK_END - WORK_START) * 60) / SLOT_MIN;
      for (let si = 0; si <= totalSlots; si++) {
        const slotMs = new Date(day).setHours(WORK_START, si * SLOT_MIN, 0, 0);
        const slotEnd = slotMs + SLOT_MIN * 60 * 1000;
        const isFree = si < totalSlots &&
          !dayBusy.some(b => b.s < slotEnd && b.e > slotMs);

        if (isFree && !freeStart) {
          freeStart = new Date(slotMs);
        } else if (!isFree && freeStart) {
          const end = new Date(slotMs);
          const durationMin = (end.getTime() - freeStart.getTime()) / 60000;
          if (durationMin >= 30) {
            slots.push({ start: freeStart, end, dayLabel });
          }
          freeStart = null;
        }
      }
    }

    return slots.slice(0, 8); // cap at 8 suggestions
  }, [showFreeTimeFinder, viewMode, currentDate, overlayEvents, filteredEvents]);

  // Get upcoming events (next 7 days)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return filteredEvents
      .filter(e => e.start >= now && e.start <= weekFromNow)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 10);
  }, [filteredEvents]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, event: CalendarEvent) => {
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, date: Date) => {
    e.preventDefault();
    setDragOverDate(date);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    if (draggedEvent) {
      const daysDiff = Math.floor((targetDate.getTime() - draggedEvent.start.getTime()) / (1000 * 60 * 60 * 24));
      const newStart = new Date(draggedEvent.start);
      newStart.setDate(newStart.getDate() + daysDiff);
      const newEnd = new Date(draggedEvent.end);
      newEnd.setDate(newEnd.getDate() + daysDiff);

      setEvents(prev => prev.map(ev =>
        ev.id === draggedEvent.id
          ? { ...ev, start: newStart, end: newEnd }
          : ev
      ));
    }
    setDraggedEvent(null);
    setDragOverDate(null);
  }, [draggedEvent]);

  // Open event detail
  const openEventDetail = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventDetail(true);
  }, []);

  /** Handle drag-to-reschedule from WeekView / DayView */
  const handleEventReschedule = useCallback(async (event: CalendarEvent, newStart: Date, newEnd: Date) => {
    const updated: CalendarEvent = { ...event, start: newStart, end: newEnd };

    // Optimistically update local state
    setEvents(prev => prev.map(ev => ev.id === event.id ? updated : ev));

    // Persist to Google Calendar only if the event originated there AND we're actually connected.
    // Re-check connection live (not from stale state) to avoid spurious errors.
    if (event.googleEventId && event.source === 'google') {
      const stillConnected = await googleCalendarService.isConnected();
      if (stillConnected) {
        try {
          await googleCalendarService.updateEvent(
            event.googleEventId,
            updated,
            event.calendarId || 'primary'
          );
        } catch (err) {
          console.error('Failed to reschedule Google Calendar event:', err);
        }
      }
    }

    // Persist to Supabase only for locally-stored events (UUID id format).
    // Google-synced events use Google's own IDs which are not UUIDs.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(event.id)) {
      try {
        await dataService.updateEvent(event.id, updated);
      } catch (err) {
        console.error('Failed to persist rescheduled event:', err);
      }
    }
  }, []);

  // Add attendee
  const addAttendee = useCallback((contactId: string) => {
    if (!newEventAttendees.includes(contactId)) {
      setNewEventAttendees(prev => [...prev, contactId]);
    }
  }, [newEventAttendees]);

  const removeAttendee = useCallback((contactId: string) => {
    setNewEventAttendees(prev => prev.filter(id => id !== contactId));
  }, []);

  // Context Menu Handlers
  const handleContextMenu = (e: React.MouseEvent, type: 'day' | 'event', date?: Date, eventId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Calculate position relative to viewport with bounds checking
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 200;
    const menuHeight = 180;

    let x = e.clientX;
    let y = e.clientY;

    // Adjust if menu would go off right edge
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10;
    }

    // Adjust if menu would go off bottom edge
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10;
    }

    setContextMenu({
      visible: true,
      x,
      y,
      type,
      date,
      eventId
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, type: 'day' });
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    if (contextMenu.visible) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu.visible]);

  const handleQuickEvent = () => {
    if (contextMenu.date) {
      setNewEventDate(contextMenu.date.toISOString().split('T')[0]);
      setShowEventModal(true);
    }
    closeContextMenu();
  };

  const handleEditEvent = () => {
    if (contextMenu.eventId) {
      const event = events.find(e => e.id === contextMenu.eventId);
      if (event) {
        setEditingEvent(event);
        setNewEventTitle(event.title);
        setNewEventDate(event.start.toISOString().split('T')[0]);
        setNewEventTime(event.start.toTimeString().slice(0, 5));
        setNewEventDesc(event.description || '');
        setShowEventModal(true);
      }
    }
    closeContextMenu();
  };

  const handleDeleteEvent = () => {
    if (contextMenu.eventId) {
      setEvents(prev => prev.filter(e => e.id !== contextMenu.eventId));
    }
    closeContextMenu();
  };

  const handleDuplicateEvent = () => {
    if (contextMenu.eventId) {
      const event = events.find(e => e.id === contextMenu.eventId);
      if (event) {
        const duplicated: CalendarEvent = {
          ...event,
          id: Date.now().toString(),
          title: `${event.title} (Copy)`,
        };
        setEvents(prev => [...prev, duplicated]);
      }
    }
    closeContextMenu();
  };

  const getVisibleEvents = () => filteredEvents;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const shortDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const getEventsForDate = (year: number, month: number, day: number) => {
    return getVisibleEvents().filter(e =>
      e.start.getFullYear() === year &&
      e.start.getMonth() === month &&
      e.start.getDate() === day
    );
  };

  const renderMiniMonth = (monthIndex: number) => {
    const year = currentDate.getFullYear();
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;

    return (
      <div
        key={monthIndex}
        className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition cursor-pointer border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
        onClick={() => {
          setCurrentDate(new Date(year, monthIndex, 1));
          setViewMode('month');
        }}
      >
        <h4 className={`text-sm font-semibold mb-3 ${isCurrentMonth ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
          {monthNames[monthIndex]}
        </h4>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {shortDays.map((d, i) => (
            <div key={i} className="text-[9px] text-zinc-400 font-medium py-1">{d}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="text-[10px] py-1"></div>
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = isCurrentMonth && today.getDate() === day;
            const dayEvents = getEventsForDate(year, monthIndex, day);
            const hasAllDayEvents = dayEvents.some(e => e.allDay);
            const hasTimedEvents = dayEvents.some(e => !e.allDay);
            return (
              <div
                key={day}
                className={`text-[10px] py-1 rounded-full relative ${
                  isToday
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {day}
                {/* Show indicators for events - all-day events get a yellow/gold dot, timed events get red */}
                {!isToday && (hasAllDayEvents || hasTimedEvents) && (
                  <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                    {hasAllDayEvents && (
                      <div className="w-1 h-1 rounded-full bg-amber-500" title="All-day event"></div>
                    )}
                    {hasTimedEvents && (
                      <div className="w-1 h-1 rounded-full bg-red-500" title="Timed event"></div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonthCell = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dayEvents = getVisibleEvents().filter(e =>
        e.start.getDate() === day &&
        e.start.getMonth() === currentDate.getMonth() &&
        e.start.getFullYear() === currentDate.getFullYear()
    );

    // Separate all-day events from timed events
    const allDayEvents = dayEvents.filter(e => e.allDay);
    const timedEvents = dayEvents.filter(e => !e.allDay);

    return (
      <div
        key={day}
        className="min-h-[60px] sm:min-h-[80px] lg:min-h-[120px] border-b border-r border-zinc-100 dark:border-zinc-800 p-1 sm:p-1.5 lg:p-2 relative group hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition"
        onContextMenu={(e) => handleContextMenu(e, 'day', date)}
      >
        <span className={`text-xs sm:text-sm font-medium block mb-0.5 sm:mb-1 ${
            day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth()
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-zinc-400'
        }`}>
            {day}
        </span>
        <div className="space-y-0.5 sm:space-y-1">
            {/* All-day events first with distinct styling */}
            {allDayEvents.slice(0, 3).map(ev => (
                <div
                  key={ev.id}
                  className={`text-[8px] sm:text-[9px] lg:text-[10px] px-1 sm:px-1.5 py-0.5 sm:py-1 rounded-sm truncate cursor-pointer transition ${ev.color} text-white hover:opacity-90 border-l-2 border-white/50`}
                  onClick={(e) => { e.stopPropagation(); openEventDetail(ev); }}
                  onContextMenu={(e) => handleContextMenu(e, 'event', date, ev.id)}
                  title="All-day event"
                >
                    <Sun className="mr-0.5 sm:mr-1 text-[6px] sm:text-[8px] opacity-75 hidden sm:inline" />
                    <span className="truncate">{ev.title}</span>
                </div>
            ))}
            {/* Timed events */}
            {timedEvents.slice(0, 2).map(ev => (
                <div
                  key={ev.id}
                  className={`text-[8px] sm:text-[9px] lg:text-[10px] px-1 sm:px-1.5 py-0.5 sm:py-1 rounded-sm truncate cursor-pointer transition ${ev.color} text-white hover:opacity-90`}
                  onClick={(e) => { e.stopPropagation(); openEventDetail(ev); }}
                  onContextMenu={(e) => handleContextMenu(e, 'event', date, ev.id)}
                >
                    {ev.type === 'meet' && <Video className="mr-0.5 sm:mr-1 hidden sm:inline" />}
                    <span className="truncate">{ev.title}</span>
                </div>
            ))}
            {/* Show "more" indicator if there are additional events */}
            {(allDayEvents.length > 3 || timedEvents.length > 2) && (
              <div className="text-[8px] sm:text-[10px] text-zinc-400 dark:text-zinc-500 px-1">
                +{Math.max(0, allDayEvents.length - 3) + Math.max(0, timedEvents.length - 2)} more
              </div>
            )}
        </div>
      </div>
    );
  };

  return (
    <div className={`pulse-calendar h-full flex-1 min-h-0 flex flex-col bg-white dark:bg-zinc-950 overflow-hidden animate-fade-in relative${focusMode ? ' cal-focus-mode' : ''}`}>

      {/* Context Menu - Fixed positioning relative to viewport */}
      {contextMenu.visible && (
        <div
          className="fixed z-[100] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 py-2 min-w-[180px] animate-fade-in"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'day' ? (
            <>
              <button
                onClick={handleQuickEvent}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3 transition"
              >
                <Plus className="text-blue-500 w-4" />
                New Event
              </button>
              <button
                onClick={() => {
                  if (contextMenu.date) {
                    setNewEventDate(contextMenu.date.toISOString().split('T')[0]);
                    setNewEventTime('09:00');
                    setShowEventModal(true);
                  }
                  closeContextMenu();
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3 transition"
              >
                <Video className="text-green-500 w-4" />
                Schedule Meeting
              </button>
              <div className="border-t border-zinc-100 dark:border-zinc-800 my-1"></div>
              <div className="px-4 py-2 text-xs text-zinc-400">
                {contextMenu.date?.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={handleEditEvent}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3 transition"
              >
                <Pen className="text-blue-500 w-4" />
                Edit Event
              </button>
              <button
                onClick={handleDuplicateEvent}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3 transition"
              >
                <Copy className="text-zinc-400 w-4" />
                Duplicate
              </button>
              <div className="border-t border-zinc-100 dark:border-zinc-800 my-1"></div>
              <button
                onClick={handleDeleteEvent}
                className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition"
              >
                <Trash2 className="w-4" />
                Delete Event
              </button>
            </>
          )}
        </div>
      )}

      <EventCreationModal
        isOpen={showEventModal}
        editingEvent={editingEvent}
        newEventTitle={newEventTitle}
        onTitleChange={setNewEventTitle}
        newEventDate={newEventDate}
        onDateChange={setNewEventDate}
        newEventTime={newEventTime}
        onTimeChange={setNewEventTime}
        newEventEndTime={newEventEndTime}
        onEndTimeChange={setNewEventEndTime}
        newEventAllDay={newEventAllDay}
        onAllDayChange={setNewEventAllDay}
        newEventDesc={newEventDesc}
        onDescChange={setNewEventDesc}
        newEventLocation={newEventLocation}
        onLocationChange={setNewEventLocation}
        newEventColor={newEventColor}
        onColorChange={setNewEventColor}
        newEventType={newEventType}
        onTypeChange={setNewEventType}
        newEventRecurrence={newEventRecurrence}
        onRecurrenceChange={setNewEventRecurrence}
        newEventReminder={newEventReminder}
        onReminderChange={setAndPersistReminder}
        newEventAttendees={newEventAttendees}
        onAddAttendee={(id) => setNewEventAttendees(prev => [...prev, id])}
        onRemoveAttendee={(id) => setNewEventAttendees(prev => prev.filter(a => a !== id))}
        allEventTypes={allEventTypes}
        contacts={contacts}
        autoDetectEventType={autoDetectEventType}
        onSubmit={handleCreateEvent}
        onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
        onOpenCustomTypesManager={() => setShowCustomTypesManager(true)}
      />

      {/* Event Detail Modal - Enhanced with Google Calendar fields */}
      {showEventDetail && selectedEvent && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-scale-in overflow-hidden max-h-[90vh] overflow-y-auto">
                  <div className={`${selectedEvent.color} p-6`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-white/80 text-xs uppercase tracking-wider mb-1">
                          {(() => {
                            const typeMeta = allEventTypes.find(t => t.id === selectedEvent.type);
                            return typeMeta ? (
                              <>
                                <i className={`fa-solid ${typeMeta.icon}`} aria-hidden="true" />
                                <span>{typeMeta.name}</span>
                              </>
                            ) : <span>Event</span>;
                          })()}
                          {selectedEvent.source === 'google' && <ExternalLink className="ml-1" />}
                          {selectedEvent.source === 'outlook' && <Grid3X3 className="ml-1" />}
                        </div>
                        <h3 className="text-xl font-bold text-white">{selectedEvent.title}</h3>
                        {/* Conflict badge — shown when this event overlaps a cross-provider duplicate */}
                        {syncConflicts.some(c => c.eventA.id === selectedEvent.id || c.eventB.id === selectedEvent.id) && (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-amber-400/30 border border-amber-300/50 rounded-full text-[10px] font-semibold text-amber-100 uppercase tracking-wide">
                            <AlertTriangle className="text-[9px]" />
                            Possible duplicate
                          </div>
                        )}
                      </div>
                      <button onClick={() => setShowEventDetail(false)} className="text-white/80 hover:text-white">
                        <X />
                      </button>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    {/* Time */}
                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="text-zinc-400 w-5" />
                      <div className="dark:text-white">
                        {selectedEvent.allDay ? (
                          <span>All day</span>
                        ) : (
                          <span>
                            {selectedEvent.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                            {selectedEvent.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        <div className="text-zinc-500 text-xs">
                          {selectedEvent.start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    </div>

                    {/* Meeting Link (Google Meet or any URL) */}
                    {selectedEvent.meetLink && (
                      <div className="flex items-center gap-3 text-sm">
                        <Video className="text-blue-500 w-5" />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <a
                            href={selectedEvent.meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline font-medium truncate"
                          >
                            {selectedEvent.meetLink.includes('meet.google') ? 'Join Google Meet' :
                             selectedEvent.meetLink.includes('teams.microsoft') ? 'Join Teams Meeting' :
                             selectedEvent.meetLink.includes('zoom.us') ? 'Join Zoom Meeting' :
                             'Join Meeting'}
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(selectedEvent.meetLink!).catch(() => {});
                            }}
                            title="Copy link"
                            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                          >
                            <Copy className="text-[11px]" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Location */}
                    {selectedEvent.location && (
                      <div className="flex items-center gap-3 text-sm">
                        <MapPin className="text-zinc-400 w-5" />
                        <span className="dark:text-white">{selectedEvent.location}</span>
                      </div>
                    )}

                    {/* Organizer */}
                    {selectedEvent.organizer && (
                      <div className="flex items-center gap-3 text-sm">
                        <UserCog className="text-zinc-400 w-5" />
                        <span className="dark:text-white">
                          Organized by {selectedEvent.organizer.displayName || selectedEvent.organizer.email}
                        </span>
                      </div>
                    )}

                    {/* Attendees — avatar chips with response status */}
                    {selectedEvent.attendeesDetailed && selectedEvent.attendeesDetailed.length > 0 ? (
                      <div className="flex items-start gap-3 text-sm">
                        <Users className="text-zinc-400 w-5 mt-1" />
                        <div className="flex-1">
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                            {selectedEvent.attendeesDetailed.length} attendee{selectedEvent.attendeesDetailed.length !== 1 ? 's' : ''}
                            {' · '}{selectedEvent.attendeesDetailed.filter(a => a.responseStatus === 'accepted').length} accepted
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedEvent.attendeesDetailed.map((attendee, i) => {
                              const name = attendee.displayName || attendee.email || '?';
                              const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
                              const statusColor =
                                attendee.responseStatus === 'accepted'  ? 'ring-green-400' :
                                attendee.responseStatus === 'declined'  ? 'ring-red-400' :
                                attendee.responseStatus === 'tentative' ? 'ring-amber-400' :
                                'ring-zinc-300 dark:ring-zinc-600';
                              const bgColors = ['bg-blue-500','bg-purple-500','bg-emerald-500','bg-pink-500','bg-amber-500','bg-indigo-500'];
                              const bg = bgColors[i % bgColors.length];
                              return (
                                <div key={i} title={`${name} — ${attendee.responseStatus || 'pending'}`} className="flex items-center gap-1.5">
                                  <div className={`w-7 h-7 rounded-full ${bg} ring-2 ${statusColor} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                                    {initials}
                                  </div>
                                  <span className="text-xs text-zinc-600 dark:text-zinc-300 max-w-[80px] truncate">{name.split(' ')[0]}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                      <div className="flex items-start gap-3 text-sm">
                        <Users className="text-zinc-400 w-5 mt-1" />
                        <div className="flex-1">
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                            {selectedEvent.attendees.length} attendee{selectedEvent.attendees.length !== 1 ? 's' : ''}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedEvent.attendees.map((a, i) => {
                              const initials = a.split(/[@\s]/).filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
                              const bgColors = ['bg-blue-500','bg-purple-500','bg-emerald-500','bg-pink-500','bg-amber-500','bg-indigo-500'];
                              return (
                                <div key={i} title={a} className="flex items-center gap-1.5">
                                  <div className={`w-7 h-7 rounded-full ${bgColors[i % bgColors.length]} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                                    {initials}
                                  </div>
                                  <span className="text-xs text-zinc-600 dark:text-zinc-300 max-w-[80px] truncate">{a.split('@')[0]}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Recurrence */}
                    {selectedEvent.recurrence && selectedEvent.recurrence.length > 0 && (
                      <div className="flex items-center gap-3 text-sm">
                        <Repeat className="text-zinc-400 w-5" />
                        <span className="dark:text-white text-zinc-600">Recurring event</span>
                      </div>
                    )}

                    {/* Reminders */}
                    {selectedEvent.reminders && !selectedEvent.reminders.useDefault && selectedEvent.reminders.overrides && (
                      <div className="flex items-start gap-3 text-sm">
                        <Bell className="text-zinc-400 w-5 mt-0.5" />
                        <div className="flex-1">
                          {selectedEvent.reminders.overrides.map((reminder, i) => (
                            <div key={i} className="text-zinc-500 text-xs">
                              {reminder.method === 'email' ? 'Email' : 'Notification'} - {reminder.minutes} min before
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {selectedEvent.description && (
                      <div className="flex items-start gap-3 text-sm">
                        <AlignLeft className="text-zinc-400 w-5" />
                        <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{selectedEvent.description}</p>
                      </div>
                    )}

                    {/* Open in Google Calendar */}
                    {selectedEvent.htmlLink && (
                      <div className="pt-2">
                        <a
                          href={selectedEvent.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink />
                          Open in Google Calendar
                        </a>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
                      <button
                        onClick={() => {
                          setEditingEvent(selectedEvent);
                          setNewEventTitle(selectedEvent.title);
                          setNewEventDate(selectedEvent.start.toISOString().split('T')[0]);
                          setNewEventTime(selectedEvent.start.toTimeString().slice(0, 5));
                          setNewEventDesc(selectedEvent.description || '');
                          setNewEventColor(selectedEvent.color);
                          setNewEventType(selectedEvent.type);
                          setShowEventDetail(false);
                          setShowEventModal(true);
                        }}
                        className="flex-1 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition flex items-center justify-center gap-2"
                      >
                        <Pen className="text-xs" /> Edit
                      </button>
                      <button
                        onClick={async () => {
                          // Sync deletion with Google Calendar if it's a Google event
                          if (selectedEvent.googleEventId && googleConnected) {
                            try {
                              await googleCalendarService.deleteEvent(
                                selectedEvent.googleEventId,
                                selectedEvent.calendarId || 'primary',
                                'all'
                              );
                            } catch (error) {
                              console.error('Failed to delete from Google Calendar:', error);
                            }
                          }
                          setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
                          setShowEventDetail(false);
                        }}
                        className="px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm font-medium text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 transition flex items-center justify-center gap-2"
                      >
                        <Trash2 className="text-xs" /> Delete
                      </button>
                    </div>
                  </div>
              </div>
          </div>
      )}

      {/* Upcoming Events Panel */}
      {showUpcoming && (
          <div className="cal-upcoming-panel absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-40 animate-slide-in-right flex flex-col">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold dark:text-white">Upcoming Events</h3>
              <button onClick={() => setShowUpcoming(false)} className="text-zinc-400 hover:text-zinc-600">
                <X />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {upcomingEvents.length === 0 ? (
                <div className="text-center text-zinc-500 py-8">
                  <CalendarCheck className="text-3xl mb-3 opacity-50" />
                  <p className="text-sm">No upcoming events</p>
                </div>
              ) : (
                upcomingEvents.map(event => (
                  <button
                    key={event.id}
                    onClick={() => openEventDetail(event)}
                    className="w-full text-left p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-3 h-3 rounded-full ${event.color} mt-1 flex-shrink-0`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium dark:text-white truncate">{event.title}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {event.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          {!event.allDay && ` at ${event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </div>
                      </div>
                      <ChevronRight className="text-zinc-300 group-hover:text-zinc-500 text-xs" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
      )}

      {/* Premium Calendar Header */}
      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={() => setCurrentDate(new Date())}
        onViewChange={(view) => setViewMode(view)}
      />

      {/* Unified Toolbar — search, filters, actions, NL quick-add all in one row */}
      <div className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex flex-col">

        {/* Main toolbar row */}
        <div className="px-3 py-2 flex items-center gap-2">

          {/* Search */}
          <div className="relative flex-1 min-w-0 max-w-[220px]">
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs pl-8 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px]" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                <X className="text-[10px]" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-xs outline-none dark:text-white hidden sm:block"
          >
            <option value="all">All Types</option>
            {EVENT_TYPES.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>

          {/* Spacer */}
          <div className="flex-1" />

          {/* AI Quick Add (NL input toggle) */}
          {!isMobile && (
            <button
              onClick={() => setShowNLInput(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${showNLInput ? 'bg-violet-500 border-violet-500 text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-violet-600 hover:border-violet-300'}`}
              title="AI quick-add (type naturally)"
            >
              <Wand2 className="text-[10px]" />
              <span className="hidden lg:inline">Quick Add</span>
            </button>
          )}

          {/* Divider */}
          <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

          {/* New Event */}
          <button
            onClick={() => setShowEventModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-bold hover:opacity-90 transition"
          >
            <Plus className="text-[10px]" />
            <span className="hidden sm:inline">New</span>
          </button>

          {/* Icon buttons */}
          <div className="flex items-center gap-1">
            {/* Upcoming */}
            <button
              onClick={() => setShowUpcoming(!showUpcoming)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition ${showUpcoming ? 'bg-blue-500 border-blue-500 text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
              title="Upcoming Events"
            >
              <Clock className="text-xs" />
            </button>
            {/* Tasks */}
            <button
              onClick={() => setShowTaskPanel(!showTaskPanel)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition ${showTaskPanel ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
              title="Tasks"
            >
              <ListChecks className="text-xs" />
            </button>
            {/* Sync status indicator */}
            {(googleConnected || outlookConnected) && (
              <div className="relative group hidden md:flex">
                <button
                  onClick={() => { if (googleConnected) syncGoogleCalendar(); if (outlookConnected) syncOutlookCalendar(); }}
                  disabled={syncingGoogle || syncingOutlook}
                  aria-label={`Sync calendars${lastSynced ? ` — last synced ${lastSynced.toLocaleTimeString()}` : ''}`}
                  title={`Sync now${lastSynced ? ` · Last synced ${lastSynced.toLocaleTimeString()}` : ''}`}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg border transition relative
                    ${(syncingGoogle || syncingOutlook)
                      ? 'border-blue-300 dark:border-blue-700 text-blue-500'
                      : 'border-green-300 dark:border-green-700 text-green-500 hover:text-green-600'
                    }`}
                >
                  <i className={`fa-solid fa-rotate text-xs ${(syncingGoogle || syncingOutlook) ? 'animate-spin' : ''}`} aria-hidden="true" />
                  {/* Live dot */}
                  <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-zinc-950
                    ${(syncingGoogle || syncingOutlook) ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}
                    aria-hidden="true"
                  />
                </button>
                {/* Hover tooltip */}
                <div className="absolute right-0 top-full mt-2 w-52 bg-zinc-900 text-white rounded-xl shadow-2xl p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-xs">
                  <p className="font-semibold mb-1 text-zinc-200">Calendar Sync</p>
                  {googleConnected && (
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <ExternalLink className="text-[10px]" />
                      Google {syncingGoogle ? '· syncing…' : '· connected'}
                    </div>
                  )}
                  {outlookConnected && (
                    <div className="flex items-center gap-1.5 text-zinc-400 mt-0.5">
                      <Grid3X3 className="text-[10px]" />
                      Outlook {syncingOutlook ? '· syncing…' : '· connected'}
                    </div>
                  )}
                  {lastSynced && (
                    <p className="text-zinc-500 mt-1.5 border-t border-zinc-800 pt-1.5">
                      Last synced {lastSynced.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      <br />Auto-syncs every 5 min
                    </p>
                  )}
                </div>
              </div>
            )}
            {/* Google icon fallback when not connected (for discoverability) */}
            {!googleConnected && !outlookConnected && (
              <button
                onClick={syncGoogleCalendar}
                aria-label="Google Calendar not connected"
                title="Google Calendar not connected — connect in Settings"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-300 dark:text-zinc-600 cursor-default"
              >
                <ExternalLink className="text-xs" />
              </button>
            )}
            {/* Settings */}
            <button
              onClick={() => setShowCalendarSettings(!showCalendarSettings)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition ${showCalendarSettings ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-black' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
              title="Calendar Settings"
            >
              <Settings className="text-xs" />
            </button>
            {/* AI Panel */}
            <button
              onClick={() => {
                setShowAIPanel(!showAIPanel);
                if (!showAIPanel && !analytics) handleRunAllAnalyses();
              }}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition ${showAIPanel ? 'bg-gradient-to-r from-purple-500 to-pink-500 border-purple-500 text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-purple-500 hover:border-purple-300'}`}
              title="AI Calendar Assistant (⌘I)"
            >
              <i className={`fa-solid fa-wand-magic-sparkles text-xs ${aiLoading ? 'animate-pulse' : ''}`}></i>
            </button>
            {/* Keyboard shortcuts */}
            <button
              onClick={() => setShowShortcutsHelp(true)}
              aria-label="Keyboard shortcuts (?)"
              title="Keyboard shortcuts (?)"
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition text-[11px] font-bold hidden md:flex ${showShortcutsHelp ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-black' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-white'}`}
            >?</button>

            {/* Jump to date */}
            <button
              onClick={() => setShowJumpToDate(prev => !prev)}
              aria-label="Jump to date (⌘J)"
              title="Jump to date (⌘J)"
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition hidden md:flex ${showJumpToDate ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-black' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-white'}`}
            >
              <CalendarDays className="text-xs" />
            </button>

            {/* Focus mode */}
            <button
              onClick={() => setFocusMode(prev => !prev)}
              aria-label={focusMode ? 'Exit focus mode (⌘F)' : 'Focus mode (⌘F)'}
              title={focusMode ? 'Exit focus mode (⌘F)' : 'Focus mode (⌘F)'}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition hidden md:flex ${focusMode ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-indigo-600 hover:border-indigo-300'}`}
            >
              <Maximize2 className="text-xs" />
            </button>

            {/* ⋯ More / Export menu */}
            <div className="relative hidden md:block">
              <button
                onClick={(e) => { e.stopPropagation(); setShowExportMenu(prev => !prev); }}
                aria-label="More options"
                title="More options"
                className={`w-8 h-8 flex items-center justify-center rounded-lg border transition ${showExportMenu ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-black' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-white'}`}
              >
                <Ellipsis className="text-xs" />
              </button>
              {showExportMenu && (
                <div
                  className="absolute right-0 top-10 z-30 w-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden"
                  onMouseDown={e => e.stopPropagation()}
                >
                  <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Export</span>
                  </div>
                  <button
                    onClick={exportAsICS}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-left"
                  >
                    <FileDown className="text-indigo-500 w-4" />
                    <div>
                      <div className="font-medium">Export as .ics</div>
                      <div className="text-[10px] text-zinc-400 capitalize">
                        Current {viewMode} view ({filteredEvents.filter(e => {
                          const ws = new Date(currentDate);
                          const we = new Date(currentDate);
                          if (viewMode === 'week') { ws.setDate(ws.getDate() - ws.getDay()); ws.setHours(0,0,0,0); we.setDate(ws.getDate()+7); }
                          else if (viewMode === 'day') { ws.setHours(0,0,0,0); we.setDate(ws.getDate()+1); }
                          else if (viewMode === 'month') { ws.setDate(1); ws.setHours(0,0,0,0); we.setMonth(we.getMonth()+1); we.setDate(0); }
                          else { ws.setFullYear(ws.getFullYear(),0,1); we.setFullYear(we.getFullYear(),11,31); }
                          return e.start >= ws && e.start <= we;
                        }).length} events)
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* NL Quick-Add panel — slides in below toolbar when active */}
        {showNLInput && !isMobile && (
          <div className="px-3 pb-2 border-t border-zinc-100 dark:border-zinc-800/60 animate-fade-in">
            <NaturalLanguageEventInput
              contacts={contacts}
              onEventCreated={(eventData) => {
                setNewEventTitle(eventData.title || '');
                setNewEventDate(eventData.start ? eventData.start.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                setNewEventTime(eventData.start ? `${eventData.start.getHours().toString().padStart(2, '0')}:${eventData.start.getMinutes().toString().padStart(2, '0')}` : '09:00');
                setNewEventEndTime(eventData.end ? `${eventData.end.getHours().toString().padStart(2, '0')}:${eventData.end.getMinutes().toString().padStart(2, '0')}` : '10:00');
                setNewEventDesc(eventData.description || '');
                setNewEventLocation(eventData.location || '');
                setNewEventType(eventData.type || 'event');
                setShowEventModal(true);
                setShowNLInput(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Sync conflict resolution banner */}
      {syncConflicts.length > 0 && (
        <ConflictResolutionBanner
          conflicts={syncConflicts}
          onKeepA={handleConflictKeepA}
          onKeepB={handleConflictKeepB}
          onDismiss={handleConflictDismiss}
        />
      )}

      <div className="flex-1 min-h-0 flex overflow-hidden">
         {/* Resizable Sidebar - Hidden on small screens, collapsible on medium */}
         <div
           ref={sidebarRef}
           style={{ width: `${sidebarWidth}px`, minWidth: '160px', maxWidth: '400px' }}
           className="bg-zinc-50 dark:bg-zinc-900/30 border-r border-zinc-200 dark:border-zinc-800 p-3 lg:p-4 overflow-y-auto hidden lg:flex flex-col relative flex-shrink-0"
         >
             {/* Resize Handle */}
             <div
               onMouseDown={handleMouseDown}
               className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/50 transition ${isResizing ? 'bg-blue-500' : 'bg-transparent hover:bg-blue-500/30'}`}
             />

             <div className="mb-4 lg:mb-6">
                 <h3 className="text-[10px] lg:text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 lg:mb-3">My Calendars</h3>
                 <div className="space-y-2">
                     <label className="flex items-center gap-2 text-xs lg:text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer group">
                         <input
                            type="checkbox"
                            checked={visibleCalendars.has('user')}
                            onChange={() => toggleCalendarVisibility('user')}
                            className="w-3.5 h-3.5 lg:w-4 lg:h-4 rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 checked:bg-zinc-900 dark:checked:bg-white checked:border-transparent transition"
                         />
                         <span className="group-hover:text-zinc-900 dark:group-hover:text-white transition truncate">Local Events</span>
                     </label>
                 </div>
             </div>

             {/* Google Calendars */}
             {googleConnected && googleCalendars.length > 0 && (
               <div className="mb-4 lg:mb-6">
                 <h3 className="text-[10px] lg:text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 lg:mb-3 flex items-center justify-between">
                   <span className="flex items-center gap-1.5 truncate">
                     <ExternalLink className="text-[8px] lg:text-[10px]" /> <span className="truncate">Google Calendars</span>
                   </span>
                   <button
                     onClick={() => setShowCreateCalendarModal(true)}
                     className="text-blue-500 hover:text-blue-600 transition flex-shrink-0"
                     title="Create New Calendar"
                   >
                     <Plus className="text-[10px]" />
                   </button>
                 </h3>
                 {/* Color palette for the picker */}
                 {(() => {
                   const CAL_PALETTE = [
                     '#ef4444','#f97316','#eab308','#22c55e',
                     '#14b8a6','#3b82f6','#8b5cf6','#ec4899',
                     '#6b7280','#0ea5e9','#10b981','#f43f5e',
                   ];
                   return (
                     <div className="space-y-1">
                       {googleCalendars.map(cal => {
                         const dotColor = calendarColors[cal.id] || cal.backgroundColor || '#3b82f6';
                         const isPickerOpen = colorPickerOpenFor === cal.id;
                         return (
                           <div key={cal.id} className="relative">
                             <div className="flex items-center gap-2 group">
                               {/* Color dot — click to open picker */}
                               <button
                                 onClick={(e) => { e.stopPropagation(); setColorPickerOpenFor(isPickerOpen ? null : cal.id); }}
                                 className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-transparent hover:ring-zinc-300 dark:hover:ring-zinc-600 transition focus:outline-none focus-visible:ring-indigo-400"
                                 style={{ backgroundColor: dotColor }}
                                 aria-label={`Change color for ${cal.summary}`}
                                 title="Change calendar color"
                               />
                               <label className="flex items-center gap-1.5 flex-1 min-w-0 text-xs lg:text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer">
                                 <input
                                   type="checkbox"
                                   checked={visibleCalendars.has(cal.id)}
                                   onChange={() => toggleCalendarVisibility(cal.id)}
                                   className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 checked:border-transparent transition flex-shrink-0"
                                   style={{ accentColor: dotColor }}
                                 />
                                 <span className="group-hover:text-zinc-900 dark:group-hover:text-white transition truncate flex items-center gap-1">
                                   {cal.primary && <Star className="text-amber-400 text-[8px] flex-shrink-0" />}
                                   <span className="truncate">{cal.summary}</span>
                                 </span>
                               </label>
                             </div>
                             {/* Color picker popover */}
                             {isPickerOpen && (
                               <div className="absolute left-0 top-6 z-20 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl grid grid-cols-6 gap-1.5"
                                 onMouseDown={e => e.stopPropagation()}
                               >
                                 {CAL_PALETTE.map(hex => (
                                   <button
                                     key={hex}
                                     onClick={() => setCalendarColor(cal.id, hex)}
                                     className={`w-5 h-5 rounded-full transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 ${dotColor === hex ? 'ring-2 ring-offset-1 ring-zinc-700 dark:ring-white' : ''}`}
                                     style={{ backgroundColor: hex }}
                                     aria-label={hex}
                                   />
                                 ))}
                               </div>
                             )}
                           </div>
                         );
                       })}
                     </div>
                   );
                 })()}
                 {lastSynced && (
                   <p className="text-[9px] lg:text-[10px] text-zinc-400 mt-2 truncate">
                     Last synced: {lastSynced.toLocaleTimeString()}
                   </p>
                 )}
                 {syncError && (
                   <p className="text-[9px] lg:text-[10px] text-red-500 mt-2 truncate">{syncError}</p>
                 )}
               </div>
             )}

             {!googleConnected && (
               <div className="mb-8 p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                 <div className="flex items-center gap-2 mb-2">
                   <ExternalLink className="text-blue-500" />
                   <span className="text-sm font-medium dark:text-white">Google Calendar</span>
                 </div>
                 <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                   Connect to sync your events and enable AI scheduling
                 </p>
                 <button
                   onClick={() => {
                     if (onNavigateToIntegrations) {
                       onNavigateToIntegrations();
                     }
                   }}
                   className="w-full flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition shadow-sm"
                 >
                   <Settings className="text-sm" />
                   Connect in Settings
                 </button>
                 {syncError && (
                   <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                     <AlertTriangle />
                     {syncError}
                   </p>
                 )}
               </div>
             )}
             
             {/* Team Section with Team Selection */}
             <div className="flex-1">
                 <div className="flex items-center justify-between mb-4">
                   <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Team</h3>
                   <div className="flex items-center gap-2">
                     <button
                       onClick={() => setShowTeamModal(true)}
                       className="text-blue-500 hover:text-blue-600 transition"
                       title="Create New Team"
                     >
                       <Plus className="text-[10px]" />
                     </button>
                     {selectedTeam && teams.length > 1 && (
                       <button
                         onClick={() => openEditTeam(selectedTeam)}
                         className="text-zinc-400 hover:text-zinc-600 transition"
                         title="Edit Team"
                       >
                         <Pen className="text-[10px]" />
                       </button>
                     )}
                   </div>
                 </div>

                 {/* Team Selector Dropdown */}
                 {teams.length > 1 && (
                   <select
                     value={selectedTeamId}
                     onChange={(e) => setSelectedTeamId(e.target.value)}
                     className="w-full mb-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none"
                   >
                     {teams.map(team => (
                       <option key={team.id} value={team.id}>{team.name}</option>
                     ))}
                   </select>
                 )}

                 <div className="space-y-2">
                     {teamMembers.length === 0 ? (
                       <div className="text-center py-4">
                         <Users className="text-zinc-300 dark:text-zinc-600 text-2xl mb-2" />
                         <p className="text-xs text-zinc-500">No team members yet</p>
                         <button
                           onClick={() => openEditTeam(selectedTeam)}
                           className="text-xs text-blue-500 hover:text-blue-600 mt-2"
                         >
                           Add members
                         </button>
                       </div>
                     ) : (
                       <>
                       {teamMembers.map(contact => {
                         const overlayOn = overlayMemberIds.has(contact.id);
                         return (
                          <div key={contact.id} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 group p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className={`w-6 h-6 rounded-full ${contact.avatarColor} flex-shrink-0 flex items-center justify-center text-white text-xs font-bold`}>
                                    {contact.name.charAt(0)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="group-hover:text-zinc-900 dark:group-hover:text-white truncate block transition">{contact.name}</span>
                                    <span className="text-[10px] text-zinc-400 truncate block">{contact.email}</span>
                                  </div>
                              </div>
                              {/* Show-on-calendar overlay toggle (week/day only) */}
                              {(viewMode === 'week' || viewMode === 'day') && (
                                <button
                                  onClick={() => setOverlayMemberIds(prev => {
                                    const next = new Set(prev);
                                    if (next.has(contact.id)) next.delete(contact.id);
                                    else next.add(contact.id);
                                    return next;
                                  })}
                                  aria-label={overlayOn ? `Hide ${contact.name}'s schedule` : `Show ${contact.name}'s schedule`}
                                  title={overlayOn ? `Hide ${contact.name}'s schedule` : `Show ${contact.name}'s schedule`}
                                  className={`w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-md border transition ${
                                    overlayOn
                                      ? `${contact.avatarColor} border-transparent text-white`
                                      : 'border-zinc-300 dark:border-zinc-600 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
                                  }`}
                                >
                                  <i className={`fa-solid ${overlayOn ? 'fa-eye' : 'fa-eye-slash'} text-[10px]`} aria-hidden="true" />
                                </button>
                              )}
                              {/* Send Calendar Invite Button */}
                              <button
                                onClick={() => {
                                  setInviteContact(contact);
                                  setShowInviteModal(true);
                                }}
                                className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition flex-shrink-0"
                                title="Schedule meeting with this contact"
                              >
                                <CalendarPlus className="text-[10px]" />
                              </button>
                          </div>
                         );
                       })}
                       {/* Free-time finder button (only relevant in week/day) */}
                       {teamMembers.length > 0 && (viewMode === 'week' || viewMode === 'day') && (
                         <button
                           onClick={() => setShowFreeTimeFinder(f => !f)}
                           className={`mt-1 w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                             showFreeTimeFinder
                               ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                               : 'text-zinc-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-white'
                           }`}
                         >
                           <Clock className="text-[10px]" />
                           Find free time
                         </button>
                       )}

                       {/* Free-time results */}
                       {showFreeTimeFinder && (viewMode === 'week' || viewMode === 'day') && (
                         <div className="mt-2 border border-emerald-200 dark:border-emerald-800/60 rounded-xl overflow-hidden">
                           <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2">
                             <Wand2 className="text-emerald-500 text-[10px]" />
                             <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                               Available slots
                             </span>
                           </div>
                           {freeTimeSlots.length === 0 ? (
                             <div className="px-3 py-3 text-xs text-zinc-400 dark:text-zinc-500 text-center">
                               No free slots found this {viewMode === 'week' ? 'week' : 'day'}
                             </div>
                           ) : (
                             <div className="divide-y divide-emerald-100 dark:divide-emerald-900/40 max-h-40 overflow-y-auto">
                               {freeTimeSlots.map((slot, i) => {
                                 const fmt = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                                 const dur = Math.round((slot.end.getTime() - slot.start.getTime()) / 60000);
                                 return (
                                   <button
                                     key={i}
                                     className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition group"
                                     title="Click to create an event in this slot"
                                     onClick={() => {
                                       setNewEventDate(slot.start.toISOString().split('T')[0]);
                                       setNewEventTime(slot.start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
                                       setShowEventModal(true);
                                     }}
                                   >
                                     <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition">
                                       {fmt(slot.start)} – {fmt(slot.end)}
                                     </div>
                                     <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                       {slot.dayLabel} · {dur} min
                                     </div>
                                   </button>
                                 );
                               })}
                             </div>
                           )}
                         </div>
                       )}
                       </>
                     )}
                 </div>
             </div>
         </div>

         {/* Calendar Grid - Premium Views */}
         <div
           className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-zinc-950 relative"
           onTouchStart={handleTouchStart}
           onTouchMove={handleTouchMove}
           onTouchEnd={handleTouchEnd}
           ref={(el) => {
             if (isMobile && el) {
               pullToRefresh.bindToElement(el);
             }
           }}
         >
             {/* Pull to Refresh Indicator */}
             {isMobile && (
               <PullToRefreshIndicator
                 pullDistance={pullToRefresh.pullDistance}
                 isRefreshing={pullToRefresh.isRefreshing}
                 progress={pullToRefresh.progress}
               />
             )}
             {viewMode === 'year' && (
               <YearView
                 currentDate={currentDate}
                 events={filteredEvents}
                 onDateClick={(date) => {
                   setCurrentDate(date);
                   setViewMode('day');
                 }}
                 onEventClick={openEventDetail}
                 onViewChange={(view, date) => {
                   if (date) setCurrentDate(date);
                   setViewMode(view);
                 }}
               />
             )}

             {viewMode === 'month' && (
               <MonthView
                 currentDate={currentDate}
                 events={filteredEvents}
                 onDateClick={(date) => {
                   setQuickSchedulerDate(date);
                   setNewEventDate(date.toISOString().split('T')[0]);
                   setShowEventModal(true);
                 }}
                 onEventClick={openEventDetail}
                 onShowMoreEvents={(date, events) => {
                   setDayDetailDate(date);
                   setDayDetailEvents(events);
                   setShowDayDetail(true);
                 }}
                 onEventReschedule={handleEventReschedule}
               />
             )}

             {/* Mobile swipe hint — shown once on first WeekView visit */}
             {showSwipeHint && viewMode === 'week' && isMobile && (
               <div
                 className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                 aria-live="polite"
               >
                 <div className="flex items-center gap-2.5 px-4 py-2.5 bg-zinc-900/90 dark:bg-zinc-100/90 text-white dark:text-zinc-900 text-sm font-medium rounded-full shadow-xl backdrop-blur-sm animate-fade-in">
                   <ArrowLeftRight className="text-indigo-400 dark:text-indigo-600 text-xs" />
                   Swipe left or right to navigate weeks
                 </div>
               </div>
             )}

             {viewMode === 'week' && (
               <WeekView
                 currentDate={currentDate}
                 events={filteredEvents}
                 overlayEvents={overlayEvents}
                 onDateClick={(date) => {
                   setNewEventDate(date.toISOString().split('T')[0]);
                   if (date.getHours() > 0) {
                     setNewEventTime(`${date.getHours().toString().padStart(2, '0')}:00`);
                   }
                   setShowEventModal(true);
                 }}
                 onEventClick={openEventDetail}
                 onEventReschedule={handleEventReschedule}
               />
             )}

             {viewMode === 'day' && (
               <DayView
                 currentDate={currentDate}
                 events={filteredEvents}
                 overlayEvents={overlayEvents}
                 onDateClick={(date) => {
                   setNewEventDate(date.toISOString().split('T')[0]);
                   if (date.getHours() > 0) {
                     setNewEventTime(`${date.getHours().toString().padStart(2, '0')}:00`);
                   }
                   setShowEventModal(true);
                 }}
                 onEventClick={openEventDetail}
                 onEventReschedule={handleEventReschedule}
               />
             )}

             {viewMode === 'agenda' && (
               <AgendaView
                 currentDate={currentDate}
                 events={filteredEvents}
                 onEventClick={openEventDetail}
                 onDateClick={(date) => {
                   setNewEventDate(date.toISOString().split('T')[0]);
                   setShowEventModal(true);
                 }}
               />
             )}
         </div>

         {/* Tasks Panel */}
         {showTaskPanel && (
             <div className="cal-task-panel w-80 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 p-6 animate-slide-in-right flex flex-col shadow-2xl z-20 absolute right-0 top-0 bottom-0 md:relative">
                 <div className="flex justify-between items-center mb-8">
                     <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                         Tasks
                     </h3>
                     <button onClick={() => setShowTaskPanel(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><X /></button>
                 </div>

                 <div className="space-y-1">
                     {tasks.map(task => (
                         <div key={task.id} className="group flex items-start gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition cursor-pointer" onClick={() => toggleTask(task.id)}>
                             <div 
                                className={`mt-1 w-4 h-4 rounded border flex items-center justify-center transition ${task.completed ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white' : 'border-zinc-300 dark:border-zinc-600 group-hover:border-zinc-500'}`}
                             >
                                 {task.completed && <Check className="text-[10px] text-white dark:text-black" />}
                             </div>
                             <div className="flex-1">
                                 <div className={`text-sm ${task.completed ? 'text-zinc-400 line-through' : 'text-zinc-800 dark:text-zinc-200 font-medium'}`}>{task.title}</div>
                                 {task.dueDate && !task.completed && (
                                     <div className="text-xs mt-1 text-zinc-500">
                                         {task.dueDate.toLocaleDateString()}
                                     </div>
                                 )}
                             </div>
                         </div>
                     ))}
                     
                     <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                         <button className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition w-full p-2 rounded">
                             <Plus /> Add new task
                         </button>
                     </div>
                 </div>
             </div>
         )}
      </div>

      {/* Team Management Modal */}
      {showTeamModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-bold dark:text-white">
                {editingTeam ? 'Edit Team' : 'Create New Team'}
              </h3>
              <button onClick={() => { setShowTeamModal(false); resetTeamForm(); }} className="text-zinc-400 hover:text-zinc-600">
                <X />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g., Marketing Team"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Team Color</label>
                <div className="flex gap-2 flex-wrap">
                  {EVENT_COLORS.map(color => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setNewTeamColor(color.class)}
                      className={`w-8 h-8 rounded-full ${color.class} transition ring-2 ring-offset-2 ${newTeamColor === color.class ? 'ring-blue-500' : 'ring-transparent'}`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Team Members</label>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2">
                  {contacts.map(contact => (
                    <label key={contact.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTeamMembers.includes(contact.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewTeamMembers(prev => [...prev, contact.id]);
                          } else {
                            setNewTeamMembers(prev => prev.filter(id => id !== contact.id));
                          }
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <div className={`w-6 h-6 rounded-full ${contact.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                        {contact.name.charAt(0)}
                      </div>
                      <span className="text-sm dark:text-white">{contact.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-between">
              {editingTeam && teams.length > 1 && (
                <button
                  onClick={() => {
                    handleDeleteTeam(editingTeam.id);
                    setShowTeamModal(false);
                    resetTeamForm();
                  }}
                  className="px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                >
                  Delete Team
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button onClick={() => { setShowTeamModal(false); resetTeamForm(); }} className="px-4 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">
                  Cancel
                </button>
                <button
                  onClick={editingTeam ? handleUpdateTeam : handleCreateTeam}
                  className="px-5 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-bold hover:opacity-90 transition"
                >
                  {editingTeam ? 'Save Changes' : 'Create Team'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Invite Modal */}
      {showInviteModal && inviteContact && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold dark:text-white">Schedule Meeting</h3>
                <button onClick={() => { setShowInviteModal(false); setInviteContact(null); }} className="text-zinc-400 hover:text-zinc-600">
                  <X />
                </button>
              </div>
              <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <div className={`w-10 h-10 rounded-full ${inviteContact.avatarColor} flex items-center justify-center text-white font-bold`}>
                  {inviteContact.name.charAt(0)}
                </div>
                <div>
                  <div className="font-medium dark:text-white">{inviteContact.name}</div>
                  <div className="text-xs text-zinc-500">{inviteContact.email}</div>
                </div>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);
                handleSendInvite(inviteContact, {
                  title: formData.get('title') as string,
                  date: formData.get('date') as string,
                  startTime: formData.get('startTime') as string,
                  endTime: formData.get('endTime') as string,
                  description: formData.get('description') as string,
                });
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Meeting Title</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g., Project Discussion"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Date</label>
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Start</label>
                    <input
                      type="time"
                      name="startTime"
                      required
                      defaultValue="10:00"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">End</label>
                    <input
                      type="time"
                      name="endTime"
                      required
                      defaultValue="11:00"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white outline-none"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Description (Optional)</label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Add meeting details..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white outline-none resize-none"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => { setShowInviteModal(false); setInviteContact(null); }} className="px-4 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition flex items-center gap-2">
                  <Send />
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Google Calendar Modal */}
      {showCreateCalendarModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <ExternalLink className="text-blue-500" />
                Create New Calendar
              </h3>
              <button onClick={() => setShowCreateCalendarModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Calendar Name</label>
                <input
                  type="text"
                  value={newCalendarName}
                  onChange={(e) => setNewCalendarName(e.target.value)}
                  placeholder="e.g., Work Projects"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Description (Optional)</label>
                <textarea
                  value={newCalendarDescription}
                  onChange={(e) => setNewCalendarDescription(e.target.value)}
                  rows={3}
                  placeholder="What is this calendar for?"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white outline-none resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
              <button onClick={() => setShowCreateCalendarModal(false)} className="px-4 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">
                Cancel
              </button>
              <button
                onClick={handleCreateGoogleCalendar}
                disabled={creatingCalendar || !newCalendarName.trim()}
                className="px-5 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition flex items-center gap-2 disabled:opacity-50"
              >
                {creatingCalendar ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus />
                    Create Calendar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Settings Panel (Slide-in from right) */}
      {showCalendarSettings && (
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 animate-slide-in-right flex flex-col">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
              <Settings className="text-zinc-400" />
              Calendar Settings
            </h3>
            <button onClick={() => setShowCalendarSettings(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
              <X />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* View Preferences */}
            <div>
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">View Preferences</h4>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 block">Default View</label>
                  <select
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as ViewMode)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none"
                  >
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                    <option value="year">Year</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 block">Week Starts On</label>
                  <select
                    value={weekStartsOn}
                    onChange={(e) => setWeekStartsOn(e.target.value as 'sunday' | 'monday')}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none"
                  >
                    <option value="sunday">Sunday</option>
                    <option value="monday">Monday</option>
                  </select>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWeekNumbers}
                    onChange={(e) => setShowWeekNumbers(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Show Week Numbers</span>
                </label>
              </div>
            </div>

            {/* Time Zone */}
            <div>
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Time Zone</h4>
              <select
                value={selectedTimeZone}
                onChange={(e) => setSelectedTimeZone(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none"
              >
                {TIME_ZONES.map(tz => (
                  <option key={tz.id} value={tz.id}>{tz.name} {tz.offset && `(UTC${tz.offset})`}</option>
                ))}
              </select>
            </div>

            {/* Google Calendar */}
            <div>
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Google Calendar</h4>
              <div className="space-y-3">
                {googleConnected ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle />
                      Connected
                    </div>
                    <button
                      onClick={syncGoogleCalendar}
                      disabled={syncingGoogle}
                      className="w-full flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-3 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                    >
                      <i className={`fa-solid fa-sync ${syncingGoogle ? 'animate-spin' : ''}`}></i>
                      {syncingGoogle ? 'Syncing...' : 'Sync Now'}
                    </button>
                    {lastSynced && (
                      <p className="text-xs text-zinc-500 text-center">
                        Last synced: {lastSynced.toLocaleString()}
                      </p>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setShowCalendarSettings(false);
                      if (onNavigateToIntegrations) onNavigateToIntegrations();
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-blue-600 transition"
                  >
                    <ExternalLink />
                    Connect Google Calendar
                  </button>
                )}
              </div>
            </div>

            {/* Outlook Calendar */}
            <div>
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">
                <Grid3X3 className="mr-1.5 text-[#0078d4]" />
                Outlook Calendar
              </h4>
              <div className="space-y-3">
                {outlookConnected ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle />
                      Connected{outlookUserEmail ? ` — ${outlookUserEmail}` : ''}
                    </div>
                    <button
                      onClick={syncOutlookCalendar}
                      disabled={syncingOutlook}
                      className="w-full flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-3 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                    >
                      <i className={`fa-solid fa-sync ${syncingOutlook ? 'animate-spin' : ''}`}></i>
                      {syncingOutlook ? 'Syncing...' : 'Sync Now'}
                    </button>
                    <button
                      onClick={disconnectOutlook}
                      className="w-full flex items-center justify-center gap-2 border border-red-200 dark:border-red-900 text-red-500 rounded-lg px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-950 transition"
                    >
                      <Unplug />
                      Disconnect Outlook
                    </button>
                    {outlookError && (
                      <p className="text-xs text-red-500">{outlookError}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Sync events from your Microsoft 365 or Outlook.com calendar.
                      {!import.meta.env.VITE_MICROSOFT_CLIENT_ID && (
                        <span className="block mt-1 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="mr-1" />
                          Set VITE_MICROSOFT_CLIENT_ID to enable.
                        </span>
                      )}
                    </p>
                    <button
                      onClick={connectOutlook}
                      disabled={!import.meta.env.VITE_MICROSOFT_CLIENT_ID}
                      className="w-full flex items-center justify-center gap-2 bg-[#0078d4] text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-[#106ebe] transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Grid3X3 />
                      Sign in with Microsoft
                    </button>
                    {outlookError && (
                      <p className="text-xs text-red-500">{outlookError}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Event Defaults */}
            <div>
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Event Defaults</h4>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 block">Default Reminder</label>
                  <select
                    value={newEventReminder}
                    onChange={(e) => setAndPersistReminder(e.target.value as ReminderTime)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none"
                  >
                    <option value="none">No reminder</option>
                    <option value="5min">5 minutes before</option>
                    <option value="15min">15 minutes before</option>
                    <option value="30min">30 minutes before</option>
                    <option value="1hour">1 hour before</option>
                    <option value="1day">1 day before</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 block">Default Event Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {EVENT_COLORS.map(color => (
                      <button
                        key={color.id}
                        onClick={() => setNewEventColor(color.class)}
                        className={`w-8 h-8 rounded-full ${color.class} transition ring-2 ring-offset-2 ${newEventColor === color.class ? 'ring-blue-500' : 'ring-transparent'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <CalendarAIPanel
        showAIPanel={showAIPanel}
        onClose={() => setShowAIPanel(false)}
        aiPanelTab={aiPanelTab}
        onTabChange={setAIPanelTab}
        aiLoading={aiLoading}
        naturalLanguageInput={naturalLanguageInput}
        onNaturalLanguageChange={setNaturalLanguageInput}
        onNaturalLanguageSubmit={handleNaturalLanguageSubmit}
        onGetSuggestions={handleGetSuggestions}
        onSuggestFocusBlocks={handleSuggestFocusBlocks}
        onDetectConflicts={handleDetectConflicts}
        onAnalyzeTravelBuffers={handleAnalyzeTravelBuffers}
        onAddFocusBlock={handleAddFocusBlock}
        onSmartReschedule={handleSmartReschedule}
        schedulingSuggestions={schedulingSuggestions}
        focusBlocks={focusBlocks}
        conflicts={conflicts}
        travelBuffers={travelBuffers}
        onOpenEventModal={() => setShowEventModal(true)}
        onSetNewEventDate={setNewEventDate}
        onSetNewEventTime={setNewEventTime}
        onSetNewEventEndTime={setNewEventEndTime}
        onSetNewEventTitle={setNewEventTitle}
        onSetNewEventDesc={setNewEventDesc}
        onSetNewEventLocation={setNewEventLocation}
        onSetNewEventType={setNewEventType}
        relationshipInsights={relationshipInsights}
        onAnalyzeRelationships={handleAnalyzeRelationships}
        onOpenInviteModal={(contact) => { setInviteContact(contact); setShowInviteModal(true); }}
        analytics={analytics}
        onGenerateAnalytics={handleGenerateAnalytics}
        goals={goals}
        goalAlignments={goalAlignments}
        showGoalModal={showGoalModal}
        editingGoal={editingGoal}
        onOpenGoalModal={(goal) => { setEditingGoal(goal); setShowGoalModal(true); }}
        onCloseGoalModal={() => { setShowGoalModal(false); setEditingGoal(null); }}
        onSaveGoal={(newGoal) => {
          if (editingGoal) {
            setGoals(prev => prev.map(g => g.id === editingGoal.id ? newGoal : g));
          } else {
            setGoals(prev => [...prev, newGoal]);
          }
          setShowGoalModal(false);
          setEditingGoal(null);
        }}
        onDeleteGoal={(id) => { setGoals(prev => prev.filter(g => g.id !== id)); setShowGoalModal(false); setEditingGoal(null); }}
        onAnalyzeGoalAlignment={handleAnalyzeGoalAlignment}
        showMeetingPrepModal={showMeetingPrepModal}
        meetingPrep={meetingPrep}
        prepEvent={prepEvent}
        onCloseMeetingPrep={() => { setShowMeetingPrepModal(false); setPrepEvent(null); }}
        showRescheduleModal={showRescheduleModal}
        rescheduleEvent={rescheduleEvent}
        rescheduleOptions={rescheduleOptions}
        onCloseRescheduleModal={() => { setShowRescheduleModal(false); setRescheduleEvent(null); }}
        onApplyReschedule={handleApplyReschedule}
        activeFollowUpPrompt={activeFollowUpPrompt}
        onFollowUpCreateAction={(suggestion) => {
          if (suggestion.type === 'event') {
            setNewEventTitle(suggestion.title);
            setNewEventDate(suggestion.suggestedTime.toISOString().split('T')[0]);
            setNewEventTime(`${suggestion.suggestedTime.getHours().toString().padStart(2, '0')}:${suggestion.suggestedTime.getMinutes().toString().padStart(2, '0')}`);
            setNewEventDesc(suggestion.description || '');
            setShowEventModal(true);
          }
          postMeetingService.markAsActioned(activeFollowUpPrompt!.id);
          setActiveFollowUpPrompt(null);
        }}
        onFollowUpDismiss={(id) => { postMeetingService.dismissFollowUp(id); setActiveFollowUpPrompt(null); }}
        onFollowUpSkip={(id) => { postMeetingService.dismissFollowUp(id); setActiveFollowUpPrompt(null); }}
      />

      {/* Custom Event Types Manager */}
      {showCustomTypesManager && (
        <CustomEventTypesManager
          onClose={() => setShowCustomTypesManager(false)}
          onTypesChanged={refreshCustomTypes}
        />
      )}

      {/* Command Palette — Cmd+K / Ctrl+K */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        events={events}
        currentDate={currentDate}
        viewMode={viewMode}
        onViewChange={(view, date) => {
          setViewMode(view);
          if (date) setCurrentDate(date);
        }}
        onGoToToday={() => setCurrentDate(new Date())}
        onCreateEvent={(date) => {
          if (date) {
            setNewEventDate(date.toISOString().split('T')[0]);
          }
          setShowEventModal(true);
        }}
        onEventClick={openEventDetail}
      />

      {/* Keyboard Shortcuts Help — ? */}
      <ShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />

      {/* Jump to Date — Cmd+J */}
      <JumpToDate
        isOpen={showJumpToDate}
        currentDate={currentDate}
        onClose={() => setShowJumpToDate(false)}
        onJump={(date) => {
          setCurrentDate(date);
          // Switch to day view so the jumped date is front-and-centre
          setViewMode('day');
        }}
      />

      {/* Focus mode banner — visible only while focusMode is active */}
      {focusMode && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9996] flex items-center gap-3 px-4 py-2 rounded-full bg-indigo-600 text-white text-xs font-semibold shadow-xl"
          role="status"
          aria-live="polite"
        >
          <Maximize2 className="text-xs" />
          Focus mode — sidebars hidden
          <button
            onClick={() => setFocusMode(false)}
            aria-label="Exit focus mode"
            className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="text-xs" />
          </button>
          <span className="opacity-50 ml-1">⌘F or Esc</span>
        </div>
      )}
    </div>
  );
};

export default Calendar;