import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Contact, CalendarEvent, Task } from '../types';
import { fetchCalendarEvents, fetchTasks } from '../services/authService';
import { dataService } from '../services/dataService';
import { googleCalendarService, GoogleCalendar } from '../services/googleCalendarService';
import { outlookCalendarService } from '../services/outlookCalendarService';
import { supabase } from '../services/supabase';
import { downloadICS } from '../services/calendarExportService';
import { YearView, MonthView, WeekView, DayView, CalendarHeader, AgendaView, OverlayEvent } from './CalendarViews';
import { CalendarTimelineView } from './Calendar/CalendarTimelineView';
import DayDetailModal from './DayDetailModal';
import useSwipeGesture from '../hooks/useSwipeGesture';
import usePullToRefresh from '../hooks/usePullToRefresh';
import BottomSheet from './BottomSheet';
import PullToRefreshIndicator from './PullToRefreshIndicator';
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
import { CalendarContextMenu } from './Calendar/CalendarContextMenu';
import { CalendarSidebar } from './Calendar/CalendarSidebar';
import { CalendarInlineModals } from './Calendar/CalendarInlineModals';
import { CalendarSettingsPanel } from './Calendar/CalendarSettingsPanel';
import { RSVPPanel } from './Calendar/RSVPPanel';
import { EventCommentThread } from './Calendar/EventCommentThread';
import { ViewMode, RecurrenceType, ReminderTime, EVENT_COLORS, EVENT_TYPES, TIME_ZONES, Team, autoDetectEventType } from './Calendar/calendarTypes';
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

const Calendar: React.FC<CalendarProps> = ({ contacts, openTaskPanel = false, onNavigateToIntegrations }) => {
  // Current user ID from Supabase auth
  const [currentUserId, setCurrentUserId] = useState<string>('');

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

  // Team Management State — persisted to localStorage
  const [teams, setTeams] = useState<Team[]>(() => {
    try {
      const stored = localStorage.getItem('cal_teams');
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return [{ id: 'default-team', name: 'My Team', color: 'bg-blue-500', memberIds: [] }];
  });
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

  // Goals State — persisted to localStorage
  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const stored = localStorage.getItem('cal_goals');
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return [
      { id: 'goal-1', title: 'Deep Work', category: 'focus', priority: 1, targetHoursPerWeek: 20, color: 'bg-blue-500' },
      { id: 'goal-2', title: 'Team Meetings', category: 'collaboration', priority: 2, targetHoursPerWeek: 8, color: 'bg-green-500' },
      { id: 'goal-3', title: 'Client Work', category: 'client', priority: 3, targetHoursPerWeek: 10, color: 'bg-purple-500' },
    ];
  });
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
  const [newEventStatus, setNewEventStatus] = useState<'confirmed' | 'tentative' | 'cancelled'>('confirmed');

  // Drag and Drop State
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);

  // Event Detail View
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [eventDetailTab, setEventDetailTab] = useState<'details' | 'attendees' | 'comments'>('details');

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

  // Settings Panel (showCalendarSettings used below)
  const [selectedTimeZone, setSelectedTimeZone] = useState(TIME_ZONES[0].id);
  const [weekStartsOn, setWeekStartsOn] = useState<'sunday' | 'monday'>('sunday');
  const [showWeekNumbers, setShowWeekNumbers] = useState(false);

  // Search/Filter — debounced for performance
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEventType, setFilterEventType] = useState<string>('all');

  // Upcoming Events Panel
  const [showUpcoming, setShowUpcoming] = useState(false);

  // Hero motion: directional grid slide on prev/next navigation. Today gets its own
  // arrival ripple (one-shot ring expansion on the today day-number) instead of a slide
  // — confirms "you arrived" without re-orienting the grid the user just chose to revisit.
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [navAnim, setNavAnim] = useState<{ direction: 'forward' | 'backward'; tick: number } | null>(null);
  const [todayArrivalTick, setTodayArrivalTick] = useState(0);

  // Initial-fetch skeleton state — flips false once events array first populates or
  // the load resolves with zero events.
  const [eventsLoading, setEventsLoading] = useState(true);

  // +N more origin-aware reveal: capture click coordinates so DayDetailModal
  // scales in from the cell that triggered it.
  const [dayDetailOrigin, setDayDetailOrigin] = useState<{ x: number; y: number } | null>(null);

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
      try {
        const e = await fetchCalendarEvents();
        const t = await fetchTasks();
        setEvents(e);
        setTasks(t);
      } finally {
        // Skeleton goes away once the local fetch resolves, even if it returns
        // zero events. Remote sync below populates incrementally.
        setEventsLoading(false);
      }

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

  // Resolve current user ID from Supabase auth
  useEffect(() => {
    const resolve = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) setCurrentUserId(user.id);
      } catch { /* auth not available yet */ }
    };
    resolve();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? '');
    });
    return () => subscription.unsubscribe();
  }, []);

  // Persist teams to localStorage on change
  useEffect(() => {
    localStorage.setItem('cal_teams', JSON.stringify(teams));
  }, [teams]);

  // Persist goals to localStorage on change
  useEffect(() => {
    localStorage.setItem('cal_goals', JSON.stringify(goals));
  }, [goals]);

  // Debounce search input by 300ms
  useEffect(() => {
    if (!searchInput) { setSearchQuery(''); return; }
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
    setNavAnim({ direction: 'backward', tick: Date.now() });
    const newDate = new Date(currentDate);
    if (viewMode === 'year') newDate.setFullYear(newDate.getFullYear() - 1);
    else if (viewMode === 'month' || viewMode === 'agenda') newDate.setMonth(newDate.getMonth() - 1);
    else if (viewMode === 'week' || viewMode === 'timeline') newDate.setDate(newDate.getDate() - 14);
    else newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  }, [currentDate, viewMode]);

  const handleNext = useCallback(() => {
    setNavAnim({ direction: 'forward', tick: Date.now() });
    const newDate = new Date(currentDate);
    if (viewMode === 'year') newDate.setFullYear(newDate.getFullYear() + 1);
    else if (viewMode === 'month' || viewMode === 'agenda') newDate.setMonth(newDate.getMonth() + 1);
    else if (viewMode === 'week' || viewMode === 'timeline') newDate.setDate(newDate.getDate() + 14);
    else newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  }, [currentDate, viewMode]);

  // Apply directional slide class to the grid wrapper. Force reflow so consecutive
  // clicks restart the animation cleanly.
  useEffect(() => {
    if (!navAnim) return;
    const el = gridContainerRef.current;
    if (!el) return;
    el.classList.remove('cal-grid-nav-forward', 'cal-grid-nav-backward');
    // Trigger reflow — dot-access on offsetWidth is enough.
    void el.offsetWidth;
    el.classList.add(`cal-grid-nav-${navAnim.direction}`);
  }, [navAnim]);

  // Today arrival ripple — adds .cal-today-arrival to the grid wrapper for 700ms.
  // CSS attaches a one-shot ring expansion to .cal-day-cell.today .cal-day-number::after.
  // No-op when reduced-motion is set (the descendant ::after animation is gated globally).
  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
    setTodayArrivalTick(Date.now());
  }, []);

  useEffect(() => {
    if (!todayArrivalTick) return;
    const el = gridContainerRef.current;
    if (!el) return;
    el.classList.remove('cal-today-arrival');
    void el.offsetWidth;
    el.classList.add('cal-today-arrival');
    const t = window.setTimeout(() => {
      el.classList.remove('cal-today-arrival');
    }, 750);
    return () => window.clearTimeout(t);
  }, [todayArrivalTick]);

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
        case 't': case 'T': handleToday(); break;
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
  }, [showEventModal, showDayDetail, showShortcutsHelp, showJumpToDate, focusMode, selectedEvent, handlePrev, handleNext, handleToday]);

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
      id: `team-${crypto.randomUUID()}`,
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
      id: crypto.randomUUID(),
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

      // Update in Outlook if it's an Outlook event
      if (editingEvent.outlookEventId && outlookConnected) {
        try {
          await outlookCalendarService.updateEvent(
            editingEvent.outlookEventId,
            updatedEvent,
            editingEvent.calendarId || 'primary'
          );
        } catch (error) {
          console.error('Failed to update Outlook Calendar event:', error);
        }
      }

      // Persist update to Supabase (non-blocking)
      dataService.updateEvent(editingEvent.id, updatedEvent).catch(err =>
        console.error('Failed to persist event update:', err)
      );

      setEvents(prev => prev.map(ev =>
        ev.id === editingEvent.id ? updatedEvent : ev
      ));
      setEditingEvent(null);
    } else {
      // Create new event
      const newEvent: CalendarEvent = {
          id: crypto.randomUUID(),
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
          event_status: newEventStatus,
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

      // Persist to Supabase (non-blocking)
      if (!newEvent.googleEventId) {
        dataService.createEvent(newEvent).then(saved => {
          if (saved) {
            setEvents(prev => prev.map(ev => ev.id === newEvent.id ? { ...ev, id: saved.id } : ev));
          }
        }).catch(err => console.error('Failed to persist event:', err));
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
    setNewEventStatus('confirmed');
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

    const label = viewMode === 'week'  ? `week-of-${windowStart.toISOString().slice(0,10)}` :
                  viewMode === 'day'   ? currentDate.toISOString().slice(0,10) :
                  viewMode === 'month' ? `${currentDate.getFullYear()}-${pad(currentDate.getMonth()+1)}` :
                  String(currentDate.getFullYear());

    downloadICS(scope, `pulse-calendar-${label}.ics`);
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
    setEventDetailTab('details');
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
      const eventId = contextMenu.eventId;
      setEvents(prev => prev.filter(e => e.id !== eventId));
      dataService.deleteEvent(eventId).catch(err =>
        console.error('Failed to delete event from DB:', err)
      );
    }
    closeContextMenu();
  };

  const handleDuplicateEvent = () => {
    if (contextMenu.eventId) {
      const event = events.find(e => e.id === contextMenu.eventId);
      if (event) {
        const duplicated: CalendarEvent = {
          ...event,
          id: crypto.randomUUID(),
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
                  className={`text-[8px] sm:text-[9px] lg:text-[10px] px-1 sm:px-1.5 py-0.5 sm:py-1 rounded-sm truncate cursor-pointer transition ${ev.color} text-white hover:opacity-90 ring-1 ring-white/40`}
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

  // ── Stable callbacks for React.memo-wrapped sub-components ────────────────
  const handleCloseEventModal = useCallback(() => {
    setShowEventModal(false);
    setEditingEvent(null);
  }, []);

  const handleOpenInviteModal = useCallback((contact: Contact) => {
    setInviteContact(contact);
    setShowInviteModal(true);
  }, []);

  const handleOpenGoalModal = useCallback((goal: any) => {
    setEditingGoal(goal);
    setShowGoalModal(true);
  }, []);

  const handleCloseGoalModal = useCallback(() => {
    setShowGoalModal(false);
    setEditingGoal(null);
  }, []);

  const handleSaveGoal = useCallback((newGoal: any) => {
    if (editingGoal) {
      setGoals(prev => prev.map(g => g.id === editingGoal.id ? newGoal : g));
    } else {
      setGoals(prev => [...prev, newGoal]);
    }
    setShowGoalModal(false);
    setEditingGoal(null);
  }, [editingGoal]);

  const handleDeleteGoal = useCallback((id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    setShowGoalModal(false);
    setEditingGoal(null);
  }, []);

  const handleCloseMeetingPrep = useCallback(() => {
    setShowMeetingPrepModal(false);
    setPrepEvent(null);
  }, []);

  const handleCloseRescheduleModal = useCallback(() => {
    setShowRescheduleModal(false);
    setRescheduleEvent(null);
  }, []);

  const handleFollowUpCreateAction = useCallback((suggestion: any) => {
    if (suggestion.type === 'event') {
      setNewEventTitle(suggestion.title);
      setNewEventDate(suggestion.suggestedTime.toISOString().split('T')[0]);
      setNewEventTime(
        `${suggestion.suggestedTime.getHours().toString().padStart(2, '0')}:${suggestion.suggestedTime.getMinutes().toString().padStart(2, '0')}`
      );
      setNewEventDesc(suggestion.description || '');
      setShowEventModal(true);
    }
    postMeetingService.markAsActioned(activeFollowUpPrompt!.id);
    setActiveFollowUpPrompt(null);
  }, [activeFollowUpPrompt]);

  const handleFollowUpDismiss = useCallback((id: string) => {
    postMeetingService.dismissFollowUp(id);
    setActiveFollowUpPrompt(null);
  }, []);

  const handleFollowUpSkip = useCallback((id: string) => {
    postMeetingService.dismissFollowUp(id);
    setActiveFollowUpPrompt(null);
  }, []);

  return (
    <div className={`pulse-calendar h-full flex-1 min-h-0 flex flex-col bg-white dark:bg-zinc-950 overflow-hidden animate-fade-in relative${focusMode ? ' cal-focus-mode' : ''}`}>

      <CalendarContextMenu
        contextMenu={contextMenu}
        handleQuickEvent={handleQuickEvent}
        setNewEventDate={setNewEventDate}
        setNewEventTime={setNewEventTime}
        setShowEventModal={setShowEventModal}
        closeContextMenu={closeContextMenu}
        handleEditEvent={handleEditEvent}
        handleDuplicateEvent={handleDuplicateEvent}
        handleDeleteEvent={handleDeleteEvent}
      />

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
        newEventStatus={newEventStatus}
        onStatusChange={setNewEventStatus}
        allEventTypes={allEventTypes}
        contacts={contacts}
        autoDetectEventType={autoDetectEventType}
        onSubmit={handleCreateEvent}
        onClose={handleCloseEventModal}
        onOpenCustomTypesManager={() => setShowCustomTypesManager(true)}
      />

      {/* Event Detail Modal - Enhanced with Google Calendar fields */}
      {showEventDetail && selectedEvent && (
          <div className="absolute inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
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
                  {/* Tab bar */}
                  <div className="flex border-b border-zinc-100 dark:border-zinc-800 px-4">
                    {(['details', 'attendees', 'comments'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setEventDetailTab(tab)}
                        className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide border-b-2 transition -mb-px ${
                          eventDetailTab === tab
                            ? 'border-rose-500 text-rose-500'
                            : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                        }`}
                      >
                        {tab === 'details' ? 'Details' : tab === 'attendees' ? 'Attendees' : 'Comments'}
                      </button>
                    ))}
                  </div>

                  <div className="p-6">
                    {/* ── DETAILS TAB ────────────────────────────────── */}
                    {eventDetailTab === 'details' && (
                    <div className="space-y-4">
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

                    {/* Meeting Link — Pulse Meet gets a native Join button; others open external */}
                    {selectedEvent.meetLink && (() => {
                      const link = selectedEvent.meetLink!;
                      const isPulseMeet = link.includes('/meet/pulse-');
                      const now = new Date();
                      const minsUntilStart = (selectedEvent.start.getTime() - now.getTime()) / 60000;
                      const isActive = minsUntilStart <= 15 && now < selectedEvent.end;
                      const roomName = isPulseMeet ? link.split('/meet/')[1] : null;

                      if (isPulseMeet) {
                        return (
                          <div className="space-y-2">
                            {/* Join button */}
                            <button
                              type="button"
                              onClick={() => { window.location.href = link; }}
                              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                                isActive
                                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20'
                                  : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20'
                              }`}
                            >
                              <Video size={15} />
                              {isActive ? 'Join Now — Pulse Meet' : minsUntilStart > 0 ? `Join in ${Math.round(minsUntilStart)} min` : 'Join Pulse Meet'}
                            </button>
                            {/* Copy + room code row */}
                            <div className="flex items-center gap-2">
                              <span className="flex-1 text-[11px] text-zinc-400 dark:text-zinc-500 truncate font-mono">
                                {window.location.origin}{link}
                              </span>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(`${window.location.origin}${link}`).catch(() => {})}
                                title="Copy link"
                                className="shrink-0 p-1 rounded text-zinc-400 hover:text-rose-500 transition"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // External provider link
                      const label = link.includes('meet.google') ? 'Join Google Meet' :
                                    link.includes('teams.microsoft') ? 'Join Teams Meeting' :
                                    link.includes('zoom.us') ? 'Join Zoom Meeting' :
                                    'Join Meeting';
                      return (
                        <div className="flex items-center gap-3 text-sm">
                          <Video className="text-zinc-400 w-5 shrink-0" />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-rose-500 hover:underline font-medium truncate"
                            >
                              {label}
                            </a>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(link).catch(() => {})}
                              title="Copy link"
                              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                            >
                              <Copy size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })()}

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

                    </div>
                    )}

                    {/* ── ATTENDEES TAB ──────────────────────────────── */}
                    {eventDetailTab === 'attendees' && (
                      <RSVPPanel
                        eventId={selectedEvent.id}
                        isOrganizer={true}
                      />
                    )}

                    {/* ── COMMENTS TAB ───────────────────────────────── */}
                    {eventDetailTab === 'comments' && (
                      <div className="min-h-[280px]">
                        <EventCommentThread
                          eventId={selectedEvent.id}
                          currentUserId={currentUserId}
                        />
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
                          // Sync deletion with Outlook if it's an Outlook event
                          if (selectedEvent.outlookEventId && outlookConnected) {
                            try {
                              await outlookCalendarService.deleteEvent(
                                selectedEvent.outlookEventId,
                                selectedEvent.calendarId || 'primary'
                              );
                            } catch (error) {
                              console.error('Failed to delete from Outlook Calendar:', error);
                            }
                          }
                          // Persist deletion to Supabase
                          dataService.deleteEvent(selectedEvent.id).catch(err =>
                            console.error('Failed to delete event from DB:', err)
                          );
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
        onToday={handleToday}
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
              placeholder="Search events…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs pl-8 outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent dark:text-white"
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 w-3 h-3" />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearchQuery(''); }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-xs outline-none dark:text-white hidden sm:block focus:ring-2 focus:ring-rose-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            {EVENT_TYPES.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>

          {/* Spacer */}
          <div className="flex-1" />

          {/* New Event — primary CTA, the only solid coral at rest */}
          <button
            onClick={() => setShowEventModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-mono text-[11px] tracking-[0.1em] uppercase font-semibold transition shadow-[0_2px_8px_rgba(244,63,94,0.20)]"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">New Event</span>
          </button>

          {/* Distilled icon cluster — AI · Settings · Ellipsis */}
          <div className="flex items-center gap-1 ml-1">
            {/* AI Panel (⌘I) */}
            <button
              onClick={() => {
                setShowAIPanel(!showAIPanel);
                if (!showAIPanel && !analytics) handleRunAllAnalyses();
              }}
              aria-label="AI Calendar Assistant (⌘I)"
              title="AI Calendar Assistant (⌘I)"
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition ${showAIPanel ? 'bg-rose-500 border-rose-500 text-white shadow-[0_0_0_4px_rgba(244,63,94,0.12)]' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-rose-500 hover:border-rose-300 dark:hover:border-rose-400/40'}`}
            >
              <Wand2 className={`w-3.5 h-3.5 ${aiLoading ? 'animate-pulse' : ''}`} />
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowCalendarSettings(!showCalendarSettings)}
              aria-label="Calendar Settings"
              title="Calendar Settings"
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition relative ${showCalendarSettings ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-black' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
            >
              <Settings className="w-3.5 h-3.5" />
              {/* Live sync dot — visible only when syncing or in error */}
              {(syncingGoogle || syncingOutlook || syncError) && (
                <span
                  className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-zinc-950 ${
                    syncError ? 'bg-red-500' : 'bg-blue-500 animate-pulse'
                  }`}
                  aria-hidden="true"
                />
              )}
            </button>

            {/* ⋯ More menu — everything else, with text labels and shortcut hints */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowExportMenu(prev => !prev); }}
                aria-label="More options"
                title="More options"
                className={`w-8 h-8 flex items-center justify-center rounded-lg border transition ${showExportMenu ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-black' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-white'}`}
              >
                <Ellipsis className="w-3.5 h-3.5" />
              </button>
              {showExportMenu && (
                <div
                  className="absolute right-0 top-10 z-30 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden"
                  onMouseDown={e => e.stopPropagation()}
                >
                  <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="font-mono text-[10px] tracking-[0.1em] uppercase font-semibold text-zinc-400">Panels</span>
                  </div>
                  <button
                    onClick={() => { setShowUpcoming(!showUpcoming); setShowExportMenu(false); }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-left"
                  >
                    <span className="flex items-center gap-2.5"><Clock className="w-3.5 h-3.5 text-zinc-400" /> Upcoming events</span>
                  </button>
                  <button
                    onClick={() => { setShowTaskPanel(!showTaskPanel); setShowExportMenu(false); }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-left"
                  >
                    <span className="flex items-center gap-2.5"><ListChecks className="w-3.5 h-3.5 text-zinc-400" /> Tasks</span>
                  </button>

                  <div className="px-3 py-2 border-y border-zinc-100 dark:border-zinc-800 mt-1">
                    <span className="font-mono text-[10px] tracking-[0.1em] uppercase font-semibold text-zinc-400">Navigate</span>
                  </div>
                  <button
                    onClick={() => { setShowJumpToDate(prev => !prev); setShowExportMenu(false); }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-left"
                  >
                    <span className="flex items-center gap-2.5"><CalendarDays className="w-3.5 h-3.5 text-zinc-400" /> Jump to date</span>
                    <kbd className="font-mono text-[10px] tracking-wider text-zinc-400">⌘J</kbd>
                  </button>
                  <button
                    onClick={() => { setFocusMode(prev => !prev); setShowExportMenu(false); }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-left"
                  >
                    <span className="flex items-center gap-2.5"><Maximize2 className="w-3.5 h-3.5 text-zinc-400" /> {focusMode ? 'Exit focus mode' : 'Focus mode'}</span>
                    <kbd className="font-mono text-[10px] tracking-wider text-zinc-400">⌘F</kbd>
                  </button>
                  <button
                    onClick={() => { setShowShortcutsHelp(true); setShowExportMenu(false); }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-left"
                  >
                    <span className="flex items-center gap-2.5"><HelpCircle className="w-3.5 h-3.5 text-zinc-400" /> Keyboard shortcuts</span>
                    <kbd className="font-mono text-[10px] tracking-wider text-zinc-400">?</kbd>
                  </button>

                  {(googleConnected || outlookConnected) && (
                    <>
                      <div className="px-3 py-2 border-y border-zinc-100 dark:border-zinc-800 mt-1">
                        <span className="font-mono text-[10px] tracking-[0.1em] uppercase font-semibold text-zinc-400">Sync</span>
                      </div>
                      <button
                        onClick={() => {
                          if (googleConnected) syncGoogleCalendar();
                          if (outlookConnected) syncOutlookCalendar();
                          setShowExportMenu(false);
                        }}
                        disabled={syncingGoogle || syncingOutlook}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-left disabled:opacity-50"
                      >
                        <span className="flex items-center gap-2.5">
                          <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${(syncingGoogle || syncingOutlook) ? 'animate-spin' : ''}`} />
                          {(syncingGoogle || syncingOutlook) ? 'Syncing…' : 'Sync now'}
                        </span>
                        {lastSynced && !(syncingGoogle || syncingOutlook) && (
                          <span className="font-mono text-[10px] tracking-wider text-zinc-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {lastSynced.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        )}
                      </button>
                    </>
                  )}

                  <div className="px-3 py-2 border-y border-zinc-100 dark:border-zinc-800 mt-1">
                    <span className="font-mono text-[10px] tracking-[0.1em] uppercase font-semibold text-zinc-400">Export</span>
                  </div>
                  <button
                    onClick={() => { exportAsICS(); setShowExportMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-left"
                  >
                    <FileDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium">Export as .ics</div>
                      <div className="font-mono text-[10px] tracking-wider text-zinc-400 capitalize" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        Current {viewMode} · {filteredEvents.filter(e => {
                          const ws = new Date(currentDate);
                          const we = new Date(currentDate);
                          if (viewMode === 'week') { ws.setDate(ws.getDate() - ws.getDay()); ws.setHours(0,0,0,0); we.setDate(ws.getDate()+7); }
                          else if (viewMode === 'day') { ws.setHours(0,0,0,0); we.setDate(ws.getDate()+1); }
                          else if (viewMode === 'month') { ws.setDate(1); ws.setHours(0,0,0,0); we.setMonth(we.getMonth()+1); we.setDate(0); }
                          else { ws.setFullYear(ws.getFullYear(),0,1); we.setFullYear(we.getFullYear(),11,31); }
                          return e.start >= ws && e.start <= we;
                        }).length} events
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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
         <CalendarSidebar
           sidebarRef={sidebarRef}
           sidebarWidth={sidebarWidth}
           handleMouseDown={handleMouseDown}
           isResizing={isResizing}
           visibleCalendars={visibleCalendars}
           toggleCalendarVisibility={toggleCalendarVisibility}
           googleConnected={googleConnected}
           googleCalendars={googleCalendars}
           calendarColors={calendarColors}
           colorPickerOpenFor={colorPickerOpenFor}
           setColorPickerOpenFor={setColorPickerOpenFor}
           setCalendarColor={setCalendarColor}
           lastSynced={lastSynced}
           syncError={syncError}
           setShowCreateCalendarModal={setShowCreateCalendarModal}
           onNavigateToIntegrations={onNavigateToIntegrations}
           teams={teams}
           selectedTeam={selectedTeam}
           selectedTeamId={selectedTeamId}
           setSelectedTeamId={setSelectedTeamId}
           teamMembers={teamMembers}
           setShowTeamModal={setShowTeamModal}
           openEditTeam={openEditTeam}
           viewMode={viewMode}
           overlayMemberIds={overlayMemberIds}
           setOverlayMemberIds={setOverlayMemberIds}
           setInviteContact={setInviteContact}
           setShowInviteModal={setShowInviteModal}
           showFreeTimeFinder={showFreeTimeFinder}
           setShowFreeTimeFinder={setShowFreeTimeFinder}
           freeTimeSlots={freeTimeSlots}
           setNewEventDate={setNewEventDate}
           setNewEventTime={setNewEventTime}
           setShowEventModal={setShowEventModal}
         />

         {/* Calendar Grid - Premium Views */}
         <div
           className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-zinc-950 relative"
           onTouchStart={handleTouchStart}
           onTouchMove={handleTouchMove}
           onTouchEnd={handleTouchEnd}
           ref={(el) => {
             gridContainerRef.current = el;
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
                 loading={eventsLoading}
                 onDateClick={(date) => {
                   setNewEventDate(date.toISOString().split('T')[0]);
                   setShowEventModal(true);
                 }}
                 onEventClick={openEventDetail}
                 onShowMoreEvents={(date, events, origin) => {
                   setDayDetailDate(date);
                   setDayDetailEvents(events);
                   setDayDetailOrigin(origin ?? null);
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
                   <ArrowLeftRight className="text-zinc-400 dark:text-zinc-500 w-3.5 h-3.5" />
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

             {viewMode === 'timeline' && (
               <CalendarTimelineView
                 currentDate={currentDate}
                 events={filteredEvents}
                 onEventClick={openEventDetail}
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

      <CalendarInlineModals
        showTeamModal={showTeamModal}
        setShowTeamModal={setShowTeamModal}
        editingTeam={editingTeam}
        resetTeamForm={resetTeamForm}
        newTeamName={newTeamName}
        setNewTeamName={setNewTeamName}
        newTeamColor={newTeamColor}
        setNewTeamColor={setNewTeamColor}
        contacts={contacts}
        newTeamMembers={newTeamMembers}
        setNewTeamMembers={setNewTeamMembers}
        teams={teams}
        handleDeleteTeam={handleDeleteTeam}
        handleUpdateTeam={handleUpdateTeam}
        handleCreateTeam={handleCreateTeam}
        showInviteModal={showInviteModal}
        setShowInviteModal={setShowInviteModal}
        inviteContact={inviteContact}
        setInviteContact={setInviteContact}
        handleSendInvite={handleSendInvite}
        showCreateCalendarModal={showCreateCalendarModal}
        setShowCreateCalendarModal={setShowCreateCalendarModal}
        newCalendarName={newCalendarName}
        setNewCalendarName={setNewCalendarName}
        newCalendarDescription={newCalendarDescription}
        setNewCalendarDescription={setNewCalendarDescription}
        handleCreateGoogleCalendar={handleCreateGoogleCalendar}
        creatingCalendar={creatingCalendar}
      />

      <CalendarSettingsPanel
        showCalendarSettings={showCalendarSettings}
        setShowCalendarSettings={setShowCalendarSettings}
        viewMode={viewMode}
        setViewMode={setViewMode}
        weekStartsOn={weekStartsOn}
        setWeekStartsOn={setWeekStartsOn}
        showWeekNumbers={showWeekNumbers}
        setShowWeekNumbers={setShowWeekNumbers}
        selectedTimeZone={selectedTimeZone}
        setSelectedTimeZone={setSelectedTimeZone}
        googleConnected={googleConnected}
        syncGoogleCalendar={syncGoogleCalendar}
        syncingGoogle={syncingGoogle}
        lastSynced={lastSynced}
        onNavigateToIntegrations={onNavigateToIntegrations}
        outlookConnected={outlookConnected}
        outlookUserEmail={outlookUserEmail}
        outlookError={outlookError}
        syncOutlookCalendar={syncOutlookCalendar}
        syncingOutlook={syncingOutlook}
        disconnectOutlook={disconnectOutlook}
        connectOutlook={connectOutlook}
        newEventReminder={newEventReminder}
        setAndPersistReminder={setAndPersistReminder}
        newEventColor={newEventColor}
        setNewEventColor={setNewEventColor}
      />

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
        onOpenInviteModal={handleOpenInviteModal}
        analytics={analytics}
        onGenerateAnalytics={handleGenerateAnalytics}
        goals={goals}
        goalAlignments={goalAlignments}
        showGoalModal={showGoalModal}
        editingGoal={editingGoal}
        onOpenGoalModal={handleOpenGoalModal}
        onCloseGoalModal={handleCloseGoalModal}
        onSaveGoal={handleSaveGoal}
        onDeleteGoal={handleDeleteGoal}
        onAnalyzeGoalAlignment={handleAnalyzeGoalAlignment}
        showMeetingPrepModal={showMeetingPrepModal}
        meetingPrep={meetingPrep}
        prepEvent={prepEvent}
        onCloseMeetingPrep={handleCloseMeetingPrep}
        showRescheduleModal={showRescheduleModal}
        rescheduleEvent={rescheduleEvent}
        rescheduleOptions={rescheduleOptions}
        onCloseRescheduleModal={handleCloseRescheduleModal}
        onApplyReschedule={handleApplyReschedule}
        activeFollowUpPrompt={activeFollowUpPrompt}
        onFollowUpCreateAction={handleFollowUpCreateAction}
        onFollowUpDismiss={handleFollowUpDismiss}
        onFollowUpSkip={handleFollowUpSkip}
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
        onGoToToday={handleToday}
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

      {/* Day detail modal — opened by +N more in Month view. Origin-aware entry. */}
      <DayDetailModal
        show={showDayDetail}
        date={dayDetailDate}
        events={dayDetailEvents}
        origin={dayDetailOrigin}
        onClose={() => setShowDayDetail(false)}
        onEventClick={(event) => {
          setShowDayDetail(false);
          openEventDetail(event);
        }}
        onCreateEvent={() => {
          if (dayDetailDate) {
            setNewEventDate(dayDetailDate.toISOString().split('T')[0]);
            setShowDayDetail(false);
            setShowEventModal(true);
          }
        }}
      />

      {/* Focus mode banner — visible only while focusMode is active.
          Coral signal: focus mode IS active state, matches the cal-focus-mode top stripe. */}
      {focusMode && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9996] flex items-center gap-3 px-4 py-2 rounded-full bg-rose-500 text-white font-mono text-[11px] tracking-[0.1em] uppercase font-semibold shadow-[0_4px_24px_rgba(244,63,94,0.30)]"
          role="status"
          aria-live="polite"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Focus mode · sidebars hidden
          <button
            onClick={() => setFocusMode(false)}
            aria-label="Exit focus mode"
            className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <span className="opacity-60 ml-1 normal-case tracking-wider">⌘F or Esc</span>
        </div>
      )}
    </div>
  );
};

export default Calendar;