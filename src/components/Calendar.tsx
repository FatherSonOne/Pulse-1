import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Contact, CalendarEvent, Task } from '../types';
import { fetchCalendarEvents, fetchTasks } from '../services/authService';
import { googleCalendarService, GoogleCalendar } from '../services/googleCalendarService';
import { YearView, MonthView, WeekView, DayView, CalendarHeader } from './CalendarViews';
import './Calendar.css';
import {
  calendarAIService,
  SchedulingSuggestion,
  MeetingPrepBriefing,
  ConflictResolution,
  FocusTimeBlock,
  MeetingFollowUp,
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

type ViewMode = 'month' | 'week' | 'day' | 'year';
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
  { id: 'event', name: 'Event', icon: 'fa-calendar' },
  { id: 'meet', name: 'Meeting', icon: 'fa-video' },
  { id: 'reminder', name: 'Reminder', icon: 'fa-bell' },
  { id: 'call', name: 'Call', icon: 'fa-phone' },
  { id: 'deadline', name: 'Deadline', icon: 'fa-flag' },
];

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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [visibleCalendars, setVisibleCalendars] = useState<Set<string>>(new Set(['user']));
  const [showTaskPanel, setShowTaskPanel] = useState(openTaskPanel);
  const [showEventModal, setShowEventModal] = useState(false);

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
  const [followUps, setFollowUps] = useState<MeetingFollowUp[]>([]);
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
  const [newEventReminder, setNewEventReminder] = useState<ReminderTime>('15min');
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

      // Merge with local events (avoid duplicates by checking googleEventId)
      setEvents(prev => {
        const localEvents = prev.filter(e => !e.googleEventId);
        // Also filter out duplicate Google events
        const existingGoogleIds = new Set(prev.filter(e => e.googleEventId).map(e => e.googleEventId));
        const newGoogleEvents = googleEvents.filter(e => !existingGoogleIds.has(e.googleEventId));
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
      setFollowUps(prev => [...prev, followUp]);
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

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'year') newDate.setFullYear(newDate.getFullYear() - 1);
    else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'year') newDate.setFullYear(newDate.getFullYear() + 1);
    else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const toggleCalendarVisibility = (id: string) => {
    const newSet = new Set(visibleCalendars);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setVisibleCalendars(newSet);
  };

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
    setNewEventReminder('15min');
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
                    <i className="fa-solid fa-sun mr-0.5 sm:mr-1 text-[6px] sm:text-[8px] opacity-75 hidden sm:inline"></i>
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
                    {ev.type === 'meet' && <i className="fa-solid fa-video mr-0.5 sm:mr-1 hidden sm:inline"></i>}
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
    <div className="pulse-calendar h-full flex flex-col bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-fade-in relative shadow-xl">

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
                <i className="fa-solid fa-plus text-blue-500 w-4"></i>
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
                <i className="fa-solid fa-video text-green-500 w-4"></i>
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
                <i className="fa-solid fa-pen text-blue-500 w-4"></i>
                Edit Event
              </button>
              <button
                onClick={handleDuplicateEvent}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-3 transition"
              >
                <i className="fa-regular fa-copy text-zinc-400 w-4"></i>
                Duplicate
              </button>
              <div className="border-t border-zinc-100 dark:border-zinc-800 my-1"></div>
              <button
                onClick={handleDeleteEvent}
                className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition"
              >
                <i className="fa-solid fa-trash w-4"></i>
                Delete Event
              </button>
            </>
          )}
        </div>
      )}

      {/* Event Modal - Enhanced */}
      {showEventModal && (
          <div className="absolute inset-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4 overflow-y-auto">
              <form onSubmit={handleCreateEvent} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-scale-in my-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold dark:text-white text-zinc-900">{editingEvent ? 'Edit Event' : 'New Event'}</h3>
                    <button type="button" onClick={() => { setShowEventModal(false); resetForm(); }} className="text-zinc-400 hover:text-zinc-600">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>

                  <div className="space-y-4">
                      {/* Event Type Selector */}
                      <div>
                          <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Event Type</label>
                          <div className="flex gap-2 flex-wrap">
                            {EVENT_TYPES.map(type => (
                              <button
                                key={type.id}
                                type="button"
                                onClick={() => setNewEventType(type.id as CalendarEvent['type'])}
                                className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition ${newEventType === type.id ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                              >
                                <i className={`fa-solid ${type.icon}`}></i> {type.name}
                              </button>
                            ))}
                          </div>
                      </div>

                      <div>
                          <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Title</label>
                          <input
                            type="text"
                            tabIndex={0}
                            autoFocus
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
                            placeholder="Event Title"
                            value={newEventTitle}
                            onChange={(e) => setNewEventTitle(e.target.value)}
                            required
                          />
                      </div>

                      {/* All Day Toggle */}
                      <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNewEventAllDay(!newEventAllDay); } }}>
                          <input
                            type="checkbox"
                            tabIndex={-1}
                            checked={newEventAllDay}
                            onChange={(e) => setNewEventAllDay(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
                        </label>
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">All Day Event</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Date</label>
                            <input
                                type="date"
                                tabIndex={0}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
                                value={newEventDate}
                                onChange={(e) => setNewEventDate(e.target.value)}
                                required
                            />
                          </div>
                          {!newEventAllDay && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Start</label>
                                <input
                                    type="time"
                                    step="60"
                                    tabIndex={0}
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
                                    value={newEventTime || '09:00'}
                                    onChange={(e) => setNewEventTime(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">End</label>
                                <input
                                    type="time"
                                    step="60"
                                    tabIndex={0}
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
                                    value={newEventEndTime || '10:00'}
                                    onChange={(e) => setNewEventEndTime(e.target.value)}
                                />
                              </div>
                            </div>
                          )}
                      </div>

                      {/* Location */}
                      <div>
                          <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Location</label>
                          <input
                            type="text"
                            tabIndex={0}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
                            placeholder="Add location or meeting link"
                            value={newEventLocation}
                            onChange={(e) => setNewEventLocation(e.target.value)}
                          />
                      </div>

                      {/* Color Picker */}
                      <div>
                          <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Color</label>
                          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Event color">
                            {EVENT_COLORS.map((color, index) => (
                              <button
                                key={color.id}
                                type="button"
                                tabIndex={0}
                                onClick={() => setNewEventColor(color.class)}
                                className={`w-8 h-8 rounded-full ${color.class} transition ring-2 ring-offset-2 focus:ring-blue-500 focus:outline-none ${newEventColor === color.class ? 'ring-blue-500' : 'ring-transparent hover:ring-zinc-300'}`}
                                title={color.name}
                                aria-label={color.name}
                              />
                            ))}
                          </div>
                      </div>

                      {/* Recurrence */}
                      <div>
                          <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Repeat</label>
                          <select
                            tabIndex={0}
                            value={newEventRecurrence}
                            onChange={(e) => setNewEventRecurrence(e.target.value as RecurrenceType)}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
                          >
                            <option value="none">Does not repeat</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                      </div>

                      {/* Reminder */}
                      <div>
                          <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Reminder</label>
                          <select
                            tabIndex={0}
                            value={newEventReminder}
                            onChange={(e) => setNewEventReminder(e.target.value as ReminderTime)}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
                          >
                            <option value="none">No reminder</option>
                            <option value="5min">5 minutes before</option>
                            <option value="15min">15 minutes before</option>
                            <option value="30min">30 minutes before</option>
                            <option value="1hour">1 hour before</option>
                            <option value="1day">1 day before</option>
                          </select>
                      </div>

                      {/* Attendees */}
                      <div>
                          <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Attendees</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {newEventAttendees.map(id => {
                              const contact = contacts.find(c => c.id === id);
                              return contact ? (
                                <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs">
                                  <span className={`w-4 h-4 rounded-full ${contact.avatarColor} flex items-center justify-center text-[8px] text-white font-bold`}>
                                    {contact.name.charAt(0)}
                                  </span>
                                  {contact.name}
                                  <button type="button" onClick={() => removeAttendee(id)} className="ml-1 text-zinc-400 hover:text-red-500">
                                    <i className="fa-solid fa-xmark text-[10px]"></i>
                                  </button>
                                </span>
                              ) : null;
                            })}
                          </div>
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {contacts.filter(c => !newEventAttendees.includes(c.id)).slice(0, 6).map(contact => (
                              <button
                                key={contact.id}
                                type="button"
                                onClick={() => addAttendee(contact.id)}
                                className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 transition whitespace-nowrap"
                              >
                                <span className={`w-5 h-5 rounded-full ${contact.avatarColor} flex items-center justify-center text-[10px] text-white font-bold`}>
                                  {contact.name.charAt(0)}
                                </span>
                                {contact.name}
                              </button>
                            ))}
                          </div>
                      </div>

                      <div>
                          <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Description</label>
                          <textarea
                             className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 outline-none resize-none h-20"
                             placeholder="Add description or notes..."
                             value={newEventDesc}
                             onChange={(e) => setNewEventDesc(e.target.value)}
                          />
                      </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                      <button type="button" onClick={() => { setShowEventModal(false); resetForm(); }} className="px-5 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition text-sm font-medium">Cancel</button>
                      <button type="submit" className="px-5 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-bold uppercase tracking-wide hover:opacity-90 transition flex items-center gap-2">
                        <i className={`fa-solid ${editingEvent ? 'fa-check' : 'fa-plus'}`}></i>
                        {editingEvent ? 'Save Changes' : 'Create Event'}
                      </button>
                  </div>
              </form>
          </div>
      )}

      {/* Event Detail Modal - Enhanced with Google Calendar fields */}
      {showEventDetail && selectedEvent && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-scale-in overflow-hidden max-h-[90vh] overflow-y-auto">
                  <div className={`${selectedEvent.color} p-6`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-white/80 text-xs uppercase tracking-wider mb-1">
                          {selectedEvent.type === 'meet' ? 'Meeting' : selectedEvent.type === 'reminder' ? 'Reminder' : 'Event'}
                          {selectedEvent.source === 'google' && <i className="fa-brands fa-google ml-2"></i>}
                        </div>
                        <h3 className="text-xl font-bold text-white">{selectedEvent.title}</h3>
                      </div>
                      <button onClick={() => setShowEventDetail(false)} className="text-white/80 hover:text-white">
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    {/* Time */}
                    <div className="flex items-center gap-3 text-sm">
                      <i className="fa-solid fa-clock text-zinc-400 w-5"></i>
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

                    {/* Google Meet Link */}
                    {selectedEvent.meetLink && (
                      <div className="flex items-center gap-3 text-sm">
                        <i className="fa-solid fa-video text-blue-500 w-5"></i>
                        <a
                          href={selectedEvent.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline font-medium"
                        >
                          Join Google Meet
                        </a>
                      </div>
                    )}

                    {/* Location */}
                    {selectedEvent.location && (
                      <div className="flex items-center gap-3 text-sm">
                        <i className="fa-solid fa-location-dot text-zinc-400 w-5"></i>
                        <span className="dark:text-white">{selectedEvent.location}</span>
                      </div>
                    )}

                    {/* Organizer */}
                    {selectedEvent.organizer && (
                      <div className="flex items-center gap-3 text-sm">
                        <i className="fa-solid fa-user-tie text-zinc-400 w-5"></i>
                        <span className="dark:text-white">
                          Organized by {selectedEvent.organizer.displayName || selectedEvent.organizer.email}
                        </span>
                      </div>
                    )}

                    {/* Attendees with Response Status */}
                    {selectedEvent.attendeesDetailed && selectedEvent.attendeesDetailed.length > 0 ? (
                      <div className="flex items-start gap-3 text-sm">
                        <i className="fa-solid fa-users text-zinc-400 w-5 mt-1"></i>
                        <div className="flex-1 space-y-1.5">
                          {selectedEvent.attendeesDetailed.map((attendee, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                attendee.responseStatus === 'accepted' ? 'bg-green-500' :
                                attendee.responseStatus === 'declined' ? 'bg-red-500' :
                                attendee.responseStatus === 'tentative' ? 'bg-amber-500' :
                                'bg-zinc-400'
                              }`}></span>
                              <span className="dark:text-white text-xs truncate">
                                {attendee.displayName || attendee.email}
                              </span>
                              <span className="text-zinc-400 text-xs capitalize">
                                ({attendee.responseStatus || 'pending'})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                      <div className="flex items-start gap-3 text-sm">
                        <i className="fa-solid fa-users text-zinc-400 w-5"></i>
                        <div className="flex flex-wrap gap-1">
                          {selectedEvent.attendees.map((a, i) => (
                            <span key={i} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs dark:text-white">{a}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recurrence */}
                    {selectedEvent.recurrence && selectedEvent.recurrence.length > 0 && (
                      <div className="flex items-center gap-3 text-sm">
                        <i className="fa-solid fa-repeat text-zinc-400 w-5"></i>
                        <span className="dark:text-white text-zinc-600">Recurring event</span>
                      </div>
                    )}

                    {/* Reminders */}
                    {selectedEvent.reminders && !selectedEvent.reminders.useDefault && selectedEvent.reminders.overrides && (
                      <div className="flex items-start gap-3 text-sm">
                        <i className="fa-solid fa-bell text-zinc-400 w-5 mt-0.5"></i>
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
                        <i className="fa-solid fa-align-left text-zinc-400 w-5"></i>
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
                          <i className="fa-brands fa-google"></i>
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
                        <i className="fa-solid fa-pen text-xs"></i> Edit
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
                        <i className="fa-solid fa-trash text-xs"></i> Delete
                      </button>
                    </div>
                  </div>
              </div>
          </div>
      )}

      {/* Upcoming Events Panel */}
      {showUpcoming && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-40 animate-slide-in-right flex flex-col">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold dark:text-white">Upcoming Events</h3>
              <button onClick={() => setShowUpcoming(false)} className="text-zinc-400 hover:text-zinc-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {upcomingEvents.length === 0 ? (
                <div className="text-center text-zinc-500 py-8">
                  <i className="fa-solid fa-calendar-check text-3xl mb-3 opacity-50"></i>
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
                      <i className="fa-solid fa-chevron-right text-zinc-300 group-hover:text-zinc-500 text-xs"></i>
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

      {/* Secondary Controls Bar */}
      <div className="bg-white dark:bg-zinc-950 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">

          {/* Search Bar - Responsive */}
          <div className="relative flex-1 min-w-[120px] max-w-[200px] lg:max-w-[240px]">
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm pl-7 sm:pl-9 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <i className="fa-solid fa-search absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px] sm:text-xs"></i>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            )}
          </div>

          {/* Event Type Filter - Compact on small screens */}
          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm outline-none min-w-0 max-w-[100px] sm:max-w-none"
          >
            <option value="all">All Types</option>
            {EVENT_TYPES.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {/* Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-2">
             {/* New Event Button */}
             <button
                onClick={() => setShowEventModal(true)}
                className="bg-zinc-900 dark:bg-white text-white dark:text-black px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wide sm:tracking-widest hover:opacity-90 transition flex items-center gap-1 sm:gap-2"
             >
                <i className="fa-solid fa-plus"></i>
                <span className="hidden sm:inline">Event</span>
             </button>
             {/* Upcoming Events */}
             <button
                onClick={() => setShowUpcoming(!showUpcoming)}
                className={`w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border transition ${showUpcoming ? 'bg-blue-500 border-blue-500 text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                title="Upcoming Events"
             >
                <i className="fa-solid fa-clock text-xs sm:text-sm"></i>
             </button>
             {/* Tasks */}
             <button
                onClick={() => setShowTaskPanel(!showTaskPanel)}
                className={`w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border transition ${showTaskPanel ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                title="Tasks"
             >
                <i className="fa-solid fa-list-check text-xs sm:text-sm"></i>
             </button>
             {/* Google Calendar Sync */}
             <button
                onClick={syncGoogleCalendar}
                disabled={syncingGoogle}
                className={`w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border transition ${googleConnected ? 'border-green-300 dark:border-green-700 text-green-500' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400'} ${syncingGoogle ? 'animate-pulse' : 'hover:text-zinc-900 dark:hover:text-white'}`}
                title={googleConnected ? `Synced with Google Calendar${lastSynced ? ` (${lastSynced.toLocaleTimeString()})` : ''}` : 'Google Calendar not connected'}
             >
                <i className={`fa-brands fa-google text-xs sm:text-sm ${syncingGoogle ? 'animate-spin' : ''}`}></i>
             </button>
             {/* Calendar Settings */}
             <button
                onClick={() => setShowCalendarSettings(!showCalendarSettings)}
                className={`w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border transition ${showCalendarSettings ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-black' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                title="Calendar Settings"
             >
                <i className="fa-solid fa-gear text-xs sm:text-sm"></i>
             </button>
             {/* AI Assistant */}
             <button
                onClick={() => {
                  setShowAIPanel(!showAIPanel);
                  if (!showAIPanel && !analytics) {
                    handleRunAllAnalyses();
                  }
                }}
                className={`w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg border transition ${showAIPanel ? 'bg-gradient-to-r from-purple-500 to-pink-500 border-purple-500 text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-purple-500 hover:border-purple-300'}`}
                title="AI Calendar Assistant"
             >
                <i className={`fa-solid fa-wand-magic-sparkles text-xs sm:text-sm ${aiLoading ? 'animate-pulse' : ''}`}></i>
             </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
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
                     <i className="fa-brands fa-google text-[8px] lg:text-[10px]"></i> <span className="truncate">Google Calendars</span>
                   </span>
                   <button
                     onClick={() => setShowCreateCalendarModal(true)}
                     className="text-blue-500 hover:text-blue-600 transition flex-shrink-0"
                     title="Create New Calendar"
                   >
                     <i className="fa-solid fa-plus text-[10px]"></i>
                   </button>
                 </h3>
                 <div className="space-y-2">
                   {googleCalendars.map(cal => (
                     <label key={cal.id} className="flex items-center gap-2 text-xs lg:text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer group">
                       <input
                         type="checkbox"
                         checked={visibleCalendars.has(cal.id)}
                         onChange={() => toggleCalendarVisibility(cal.id)}
                         className="w-3.5 h-3.5 lg:w-4 lg:h-4 rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 checked:bg-blue-500 checked:border-transparent transition flex-shrink-0"
                         style={{ accentColor: cal.backgroundColor }}
                       />
                       <span className="group-hover:text-zinc-900 dark:group-hover:text-white transition truncate flex items-center gap-1">
                         {cal.primary && <i className="fa-solid fa-star text-amber-400 text-[8px] flex-shrink-0"></i>}
                         <span className="truncate">{cal.summary}</span>
                       </span>
                     </label>
                   ))}
                 </div>
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
                   <i className="fa-brands fa-google text-blue-500"></i>
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
                   <i className="fa-solid fa-cog text-sm"></i>
                   Connect in Settings
                 </button>
                 {syncError && (
                   <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                     <i className="fa-solid fa-triangle-exclamation"></i>
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
                       <i className="fa-solid fa-plus text-[10px]"></i>
                     </button>
                     {selectedTeam && teams.length > 1 && (
                       <button
                         onClick={() => openEditTeam(selectedTeam)}
                         className="text-zinc-400 hover:text-zinc-600 transition"
                         title="Edit Team"
                       >
                         <i className="fa-solid fa-pen text-[10px]"></i>
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
                         <i className="fa-solid fa-users text-zinc-300 dark:text-zinc-600 text-2xl mb-2"></i>
                         <p className="text-xs text-zinc-500">No team members yet</p>
                         <button
                           onClick={() => openEditTeam(selectedTeam)}
                           className="text-xs text-blue-500 hover:text-blue-600 mt-2"
                         >
                           Add members
                         </button>
                       </div>
                     ) : (
                       teamMembers.map(contact => (
                          <div key={contact.id} className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300 group p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition">
                              <div className="flex items-center gap-2 flex-1">
                                  <div className={`w-6 h-6 rounded-full ${contact.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                                    {contact.name.charAt(0)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="group-hover:text-zinc-900 dark:group-hover:text-white truncate block transition">{contact.name}</span>
                                    <span className="text-[10px] text-zinc-400 truncate block">{contact.email}</span>
                                  </div>
                              </div>
                              {/* Send Calendar Invite Button */}
                              <button
                                onClick={() => {
                                  setInviteContact(contact);
                                  setShowInviteModal(true);
                                }}
                                className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition"
                                title="Schedule meeting with this contact"
                              >
                                <i className="fa-solid fa-calendar-plus text-[10px]"></i>
                              </button>
                          </div>
                       ))
                     )}
                 </div>
             </div>
         </div>

         {/* Calendar Grid - Premium Views */}
         <div className="flex-1 overflow-hidden bg-white dark:bg-zinc-950">
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
               />
             )}

             {viewMode === 'week' && (
               <WeekView
                 currentDate={currentDate}
                 events={filteredEvents}
                 onDateClick={(date) => {
                   setNewEventDate(date.toISOString().split('T')[0]);
                   if (date.getHours() > 0) {
                     setNewEventTime(`${date.getHours().toString().padStart(2, '0')}:00`);
                   }
                   setShowEventModal(true);
                 }}
                 onEventClick={openEventDetail}
               />
             )}

             {viewMode === 'day' && (
               <DayView
                 currentDate={currentDate}
                 events={filteredEvents}
                 onDateClick={(date) => {
                   setNewEventDate(date.toISOString().split('T')[0]);
                   if (date.getHours() > 0) {
                     setNewEventTime(`${date.getHours().toString().padStart(2, '0')}:00`);
                   }
                   setShowEventModal(true);
                 }}
                 onEventClick={openEventDetail}
               />
             )}
         </div>

         {/* Tasks Panel */}
         {showTaskPanel && (
             <div className="w-80 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 p-6 animate-slide-in-right flex flex-col shadow-2xl z-20 absolute right-0 top-0 bottom-0 md:relative">
                 <div className="flex justify-between items-center mb-8">
                     <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                         Tasks
                     </h3>
                     <button onClick={() => setShowTaskPanel(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><i className="fa-solid fa-xmark"></i></button>
                 </div>

                 <div className="space-y-1">
                     {tasks.map(task => (
                         <div key={task.id} className="group flex items-start gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition cursor-pointer" onClick={() => toggleTask(task.id)}>
                             <div 
                                className={`mt-1 w-4 h-4 rounded border flex items-center justify-center transition ${task.completed ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white' : 'border-zinc-300 dark:border-zinc-600 group-hover:border-zinc-500'}`}
                             >
                                 {task.completed && <i className="fa-solid fa-check text-[10px] text-white dark:text-black"></i>}
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
                             <i className="fa-solid fa-plus"></i> Add new task
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
                <i className="fa-solid fa-xmark"></i>
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
                  <i className="fa-solid fa-xmark"></i>
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
                  <i className="fa-solid fa-paper-plane"></i>
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
                <i className="fa-brands fa-google text-blue-500"></i>
                Create New Calendar
              </h3>
              <button onClick={() => setShowCreateCalendarModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <i className="fa-solid fa-xmark"></i>
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
                    <i className="fa-solid fa-spinner animate-spin"></i>
                    Creating...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus"></i>
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
              <i className="fa-solid fa-gear text-zinc-400"></i>
              Calendar Settings
            </h3>
            <button onClick={() => setShowCalendarSettings(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
              <i className="fa-solid fa-xmark"></i>
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
                      <i className="fa-solid fa-check-circle"></i>
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
                    <i className="fa-brands fa-google"></i>
                    Connect Google Calendar
                  </button>
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
                    onChange={(e) => setNewEventReminder(e.target.value as ReminderTime)}
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

      {/* AI Assistant Panel */}
      {showAIPanel && (
        <div className="absolute right-0 top-0 bottom-0 w-[420px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 flex flex-col animate-slide-in-right">
          {/* AI Panel Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-wand-magic-sparkles text-purple-500"></i>
                AI Calendar Assistant
              </h3>
              <button onClick={() => setShowAIPanel(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Natural Language Input */}
            <div className="relative">
              <input
                type="text"
                value={naturalLanguageInput}
                onChange={(e) => setNaturalLanguageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNaturalLanguageSubmit()}
                placeholder="Try: 'Schedule a call with John tomorrow at 2pm'"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-12 text-sm outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleNaturalLanguageSubmit}
                disabled={aiLoading || !naturalLanguageInput.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition"
              >
                {aiLoading ? <i className="fa-solid fa-spinner animate-spin text-sm"></i> : <i className="fa-solid fa-arrow-right text-sm"></i>}
              </button>
            </div>
          </div>

          {/* AI Panel Tabs */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800">
            {[
              { id: 'assistant', label: 'Assistant', icon: 'fa-robot' },
              { id: 'insights', label: 'Insights', icon: 'fa-lightbulb' },
              { id: 'analytics', label: 'Analytics', icon: 'fa-chart-line' },
              { id: 'goals', label: 'Goals', icon: 'fa-bullseye' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setAIPanelTab(tab.id as typeof aiPanelTab)}
                className={`flex-1 px-3 py-3 text-xs font-medium flex items-center justify-center gap-1.5 transition ${aiPanelTab === tab.id ? 'text-purple-600 border-b-2 border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
              >
                <i className={`fa-solid ${tab.icon}`}></i>
                {tab.label}
              </button>
            ))}
          </div>

          {/* AI Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {aiLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3 text-purple-500">
                  <i className="fa-solid fa-spinner animate-spin text-xl"></i>
                  <span className="text-sm">AI is analyzing your calendar...</span>
                </div>
              </div>
            )}

            {/* Assistant Tab */}
            {aiPanelTab === 'assistant' && !aiLoading && (
              <div className="space-y-4">
                {/* Quick Actions */}
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleGetSuggestions(30)} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                      <i className="fa-solid fa-clock text-blue-500 mb-2"></i>
                      <p className="text-xs font-medium dark:text-white">Find Meeting Time</p>
                      <p className="text-[10px] text-zinc-500">30 min slot</p>
                    </button>
                    <button onClick={handleSuggestFocusBlocks} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                      <i className="fa-solid fa-brain text-indigo-500 mb-2"></i>
                      <p className="text-xs font-medium dark:text-white">Add Focus Time</p>
                      <p className="text-[10px] text-zinc-500">Protect deep work</p>
                    </button>
                    <button onClick={handleDetectConflicts} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                      <i className="fa-solid fa-triangle-exclamation text-amber-500 mb-2"></i>
                      <p className="text-xs font-medium dark:text-white">Check Conflicts</p>
                      <p className="text-[10px] text-zinc-500">Find overlaps</p>
                    </button>
                    <button onClick={handleAnalyzeTravelBuffers} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                      <i className="fa-solid fa-car text-green-500 mb-2"></i>
                      <p className="text-xs font-medium dark:text-white">Travel Buffers</p>
                      <p className="text-[10px] text-zinc-500">Check gaps</p>
                    </button>
                  </div>
                </div>

                {/* Scheduling Suggestions */}
                {schedulingSuggestions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <i className="fa-solid fa-lightbulb text-amber-500"></i>
                      Suggested Times
                    </h4>
                    <div className="space-y-2">
                      {schedulingSuggestions.slice(0, 5).map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setNewEventDate(suggestion.date.toISOString().split('T')[0]);
                            setNewEventTime(suggestion.startTime);
                            setNewEventEndTime(suggestion.endTime);
                            setShowEventModal(true);
                          }}
                          className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition flex items-center justify-between group"
                        >
                          <div>
                            <p className="text-sm font-medium dark:text-white">
                              {suggestion.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-xs text-zinc-500">{suggestion.startTime} - {suggestion.endTime}</p>
                            <p className="text-[10px] text-blue-500 mt-1">{suggestion.reason}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-green-500">{suggestion.score}%</span>
                            <i className="fa-solid fa-plus text-zinc-400 group-hover:text-blue-500 transition"></i>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Focus Blocks */}
                {focusBlocks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <i className="fa-solid fa-brain text-indigo-500"></i>
                      Suggested Focus Blocks
                    </h4>
                    <div className="space-y-2">
                      {focusBlocks.slice(0, 4).map((block) => (
                        <div key={block.id} className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                              {block.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-xs text-indigo-600 dark:text-indigo-400">{block.startTime} - {block.endTime}</p>
                            <p className="text-[10px] text-indigo-500 capitalize mt-1">{block.type.replace('_', ' ')}</p>
                          </div>
                          <button
                            onClick={() => handleAddFocusBlock(block)}
                            className="px-3 py-1.5 bg-indigo-500 text-white text-xs rounded-lg hover:bg-indigo-600 transition"
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conflicts */}
                {conflicts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
                      Conflicts Detected ({conflicts.length})
                    </h4>
                    <div className="space-y-2">
                      {conflicts.map((conflict, i) => (
                        <div key={i} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${conflict.priority === 'high' ? 'bg-red-100 text-red-700' : conflict.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-700'}`}>
                              {conflict.priority}
                            </span>
                          </div>
                          <p className="text-sm font-medium dark:text-white">{conflict.conflictingEvents[0].title}</p>
                          <p className="text-xs text-zinc-500 mb-2">conflicts with {conflict.conflictingEvents[1].title}</p>
                          {conflict.suggestedResolutions[0] && (
                            <button
                              onClick={() => handleSmartReschedule(conflict.conflictingEvents[0])}
                              className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                            >
                              <i className="fa-solid fa-magic mr-1"></i>
                              {conflict.suggestedResolutions[0].description}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Travel Buffers */}
                {travelBuffers.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <i className="fa-solid fa-car text-green-500"></i>
                      Travel Buffer Alerts
                    </h4>
                    <div className="space-y-2">
                      {travelBuffers.map((buffer, i) => (
                        <div key={i} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                          <p className="text-sm font-medium dark:text-white">{buffer.fromEvent.title} → {buffer.toEvent.title}</p>
                          <p className="text-xs text-green-600 dark:text-green-400">{buffer.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Insights Tab */}
            {aiPanelTab === 'insights' && !aiLoading && (
              <div className="space-y-4">
                <button onClick={handleAnalyzeRelationships} className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                  <i className="fa-solid fa-users text-purple-500 mr-2"></i>
                  <span className="text-sm font-medium dark:text-white">Refresh Relationship Insights</span>
                </button>

                {relationshipInsights.length > 0 && (
                  <div className="space-y-3">
                    {relationshipInsights.slice(0, 8).map((insight) => (
                      <div key={insight.contact.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-8 h-8 rounded-full ${insight.contact.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                            {insight.contact.name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium dark:text-white">{insight.contact.name}</p>
                            <p className="text-[10px] text-zinc-500">{insight.contact.email}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            insight.relationshipHealth === 'strong' ? 'bg-green-100 text-green-700' :
                            insight.relationshipHealth === 'healthy' ? 'bg-blue-100 text-blue-700' :
                            insight.relationshipHealth === 'needs_attention' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {insight.relationshipHealth.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 space-y-1">
                          <p><i className="fa-solid fa-calendar mr-1"></i> Last met: {insight.lastMeeting ? insight.lastMeeting.toLocaleDateString() : 'Never'}</p>
                          <p><i className="fa-solid fa-clock mr-1"></i> {insight.daysSinceLastContact} days since last contact</p>
                          {insight.upcomingMilestones.length > 0 && (
                            <p className="text-amber-600"><i className="fa-solid fa-star mr-1"></i> {insight.upcomingMilestones[0].description} in {insight.upcomingMilestones[0].daysUntil} days</p>
                          )}
                        </div>
                        {insight.suggestedActions.length > 0 && (
                          <button
                            onClick={() => {
                              setInviteContact(insight.contact);
                              setShowInviteModal(true);
                            }}
                            className="mt-2 text-xs text-purple-500 hover:text-purple-700 font-medium"
                          >
                            <i className="fa-solid fa-calendar-plus mr-1"></i>
                            Schedule catch-up
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Analytics Tab */}
            {aiPanelTab === 'analytics' && !aiLoading && (
              <div className="space-y-4">
                <button onClick={handleGenerateAnalytics} className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                  <i className="fa-solid fa-sync text-blue-500 mr-2"></i>
                  <span className="text-sm font-medium dark:text-white">Refresh Analytics</span>
                </button>

                {analytics && (
                  <div className="space-y-4">
                    {/* Overview Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                        <p className="text-2xl font-bold text-blue-600">{analytics.totalMeetingHours}h</p>
                        <p className="text-xs text-blue-500">Meeting Hours</p>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                        <p className="text-2xl font-bold text-green-600">{analytics.focusTimeHours}h</p>
                        <p className="text-xs text-green-500">Focus Time</p>
                      </div>
                    </div>

                    {/* Productivity Score */}
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium dark:text-white">Productivity Score</p>
                        <span className={`text-xl font-bold ${analytics.productivityScore >= 70 ? 'text-green-500' : analytics.productivityScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                          {analytics.productivityScore}%
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${analytics.productivityScore >= 70 ? 'bg-green-500' : analytics.productivityScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${analytics.productivityScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Meeting Overload Warning */}
                    {analytics.meetingOverload && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                        <p className="text-sm font-medium text-red-700 dark:text-red-300">
                          <i className="fa-solid fa-exclamation-triangle mr-2"></i>
                          Meeting Overload Detected
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">Over 50% of your time is in meetings</p>
                      </div>
                    )}

                    {/* Time by Category */}
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Time by Event Type</h4>
                      <div className="space-y-2">
                        {Object.entries(analytics.timeByCategory).map(([type, hours]) => (
                          <div key={type} className="flex items-center justify-between">
                            <span className="text-sm capitalize dark:text-zinc-300">{type}</span>
                            <span className="text-sm font-medium dark:text-white">{typeof hours === 'number' ? hours.toFixed(1) : hours}h</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recommendations */}
                    {analytics.recommendations.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">AI Recommendations</h4>
                        <div className="space-y-2">
                          {analytics.recommendations.map((rec, i) => (
                            <div key={i} className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                              <p className="text-xs text-purple-700 dark:text-purple-300">
                                <i className="fa-solid fa-lightbulb mr-2"></i>
                                {rec}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Goals Tab */}
            {aiPanelTab === 'goals' && !aiLoading && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Your Goals</h4>
                  <button
                    onClick={() => {
                      setEditingGoal(null);
                      setShowGoalModal(true);
                    }}
                    className="text-xs text-purple-500 hover:text-purple-700 font-medium"
                  >
                    <i className="fa-solid fa-plus mr-1"></i> Add Goal
                  </button>
                </div>

                {/* Goals List */}
                <div className="space-y-2">
                  {goals.map(goal => (
                    <div key={goal.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${goal.color}`}></div>
                          <span className="text-sm font-medium dark:text-white">{goal.title}</span>
                        </div>
                        <button
                          onClick={() => {
                            setEditingGoal(goal);
                            setShowGoalModal(true);
                          }}
                          className="text-zinc-400 hover:text-zinc-600"
                        >
                          <i className="fa-solid fa-pen text-xs"></i>
                        </button>
                      </div>
                      <p className="text-xs text-zinc-500">{goal.category} • {goal.targetHoursPerWeek}h/week target</p>
                    </div>
                  ))}
                </div>

                <button onClick={handleAnalyzeGoalAlignment} className="w-full p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-left hover:bg-purple-100 dark:hover:bg-purple-900/30 transition">
                  <i className="fa-solid fa-chart-pie text-purple-500 mr-2"></i>
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Analyze Goal Alignment</span>
                </button>

                {/* Goal Alignments */}
                {goalAlignments.length > 0 && (
                  <div className="space-y-3">
                    {goalAlignments.map(alignment => (
                      <div key={alignment.goal.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${alignment.goal.color}`}></div>
                            <span className="text-sm font-medium dark:text-white">{alignment.goal.title}</span>
                          </div>
                          <span className="text-xs font-bold">{Math.round(alignment.allocatedTime / 60)}h / {alignment.goal.targetHoursPerWeek}h</span>
                        </div>
                        <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full ${alignment.goal.color} transition-all`}
                            style={{ width: `${Math.min(100, (alignment.allocatedTime / alignment.targetTime) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-500">{alignment.recommendation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meeting Prep Modal */}
      {showMeetingPrepModal && meetingPrep && prepEvent && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-clipboard-list text-purple-500"></i>
                  Meeting Prep
                </h3>
                <p className="text-sm text-zinc-500 mt-1">{prepEvent.title}</p>
              </div>
              <button onClick={() => { setShowMeetingPrepModal(false); setMeetingPrep(null); setPrepEvent(null); }} className="text-zinc-400 hover:text-zinc-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Attendees */}
              {meetingPrep.attendees.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Attendees</h4>
                  <div className="space-y-2">
                    {meetingPrep.attendees.map(attendee => (
                      <div key={attendee.email} className="flex items-center gap-3 p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                          {(attendee.name || attendee.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium dark:text-white">{attendee.name || attendee.email}</p>
                          {attendee.lastInteraction && (
                            <p className="text-[10px] text-zinc-500">Last met: {attendee.lastInteraction.toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Agenda */}
              {meetingPrep.suggestedAgenda.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Suggested Agenda</h4>
                  <ol className="list-decimal list-inside space-y-1">
                    {meetingPrep.suggestedAgenda.map((item, i) => (
                      <li key={i} className="text-sm dark:text-zinc-300">{item}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Talking Points */}
              {meetingPrep.talkingPoints.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Talking Points</h4>
                  <ul className="space-y-2">
                    {meetingPrep.talkingPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <i className="fa-solid fa-check text-green-500 mt-1 text-xs"></i>
                        <span className="text-sm dark:text-zinc-300">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Questions to Ask */}
              {meetingPrep.questionsToAsk.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Questions to Ask</h4>
                  <ul className="space-y-2">
                    {meetingPrep.questionsToAsk.map((q, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <i className="fa-solid fa-question-circle text-blue-500 mt-1 text-xs"></i>
                        <span className="text-sm dark:text-zinc-300">{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Context Notes */}
              {meetingPrep.contextNotes && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Context</h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg">{meetingPrep.contextNotes}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
              <button onClick={() => { setShowMeetingPrepModal(false); setMeetingPrep(null); setPrepEvent(null); }} className="w-full py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-bold hover:opacity-90 transition">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Reschedule Modal */}
      {showRescheduleModal && rescheduleEvent && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-calendar-alt text-blue-500"></i>
                  Smart Reschedule
                </h3>
                <button onClick={() => { setShowRescheduleModal(false); setRescheduleEvent(null); setRescheduleOptions([]); }} className="text-zinc-400 hover:text-zinc-600">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <p className="text-sm text-zinc-500 mt-2">Reschedule: {rescheduleEvent.title}</p>
            </div>
            <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
              {rescheduleOptions.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No available time slots found</p>
              ) : (
                rescheduleOptions.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => handleApplyReschedule(option)}
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium dark:text-white">
                          {option.newStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {option.newStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {option.newEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-[10px] text-blue-500 mt-1">{option.reason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-green-500">{option.availabilityScore}%</span>
                        <i className="fa-solid fa-arrow-right text-zinc-400 group-hover:text-blue-500 transition"></i>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Goal Editor Modal */}
      {showGoalModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-bold dark:text-white">
                {editingGoal ? 'Edit Goal' : 'New Goal'}
              </h3>
              <button onClick={() => { setShowGoalModal(false); setEditingGoal(null); }} className="text-zinc-400 hover:text-zinc-600">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);
                const newGoal: Goal = {
                  id: editingGoal?.id || `goal-${Date.now()}`,
                  title: formData.get('title') as string,
                  category: formData.get('category') as string,
                  priority: parseInt(formData.get('priority') as string),
                  targetHoursPerWeek: parseInt(formData.get('hours') as string),
                  color: formData.get('color') as string || 'bg-blue-500',
                };
                if (editingGoal) {
                  setGoals(prev => prev.map(g => g.id === editingGoal.id ? newGoal : g));
                } else {
                  setGoals(prev => [...prev, newGoal]);
                }
                setShowGoalModal(false);
                setEditingGoal(null);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Goal Title</label>
                <input
                  type="text"
                  name="title"
                  defaultValue={editingGoal?.title}
                  required
                  placeholder="e.g., Deep Work"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Category</label>
                <input
                  type="text"
                  name="category"
                  defaultValue={editingGoal?.category}
                  required
                  placeholder="e.g., focus, meetings, client"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Hours/Week</label>
                  <input
                    type="number"
                    name="hours"
                    defaultValue={editingGoal?.targetHoursPerWeek || 10}
                    required
                    min="1"
                    max="40"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Priority</label>
                  <select
                    name="priority"
                    defaultValue={editingGoal?.priority || 1}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 dark:text-white outline-none"
                  >
                    <option value="1">High</option>
                    <option value="2">Medium</option>
                    <option value="3">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {EVENT_COLORS.map(color => (
                    <label key={color.id} className="cursor-pointer">
                      <input type="radio" name="color" value={color.class} defaultChecked={editingGoal?.color === color.class || (!editingGoal && color.id === 'blue')} className="sr-only peer" />
                      <div className={`w-8 h-8 rounded-full ${color.class} transition ring-2 ring-offset-2 ring-transparent peer-checked:ring-purple-500`}></div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-4 flex justify-between">
                {editingGoal && (
                  <button
                    type="button"
                    onClick={() => {
                      setGoals(prev => prev.filter(g => g.id !== editingGoal.id));
                      setShowGoalModal(false);
                      setEditingGoal(null);
                    }}
                    className="px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  >
                    Delete
                  </button>
                )}
                <div className="flex gap-3 ml-auto">
                  <button type="button" onClick={() => { setShowGoalModal(false); setEditingGoal(null); }} className="px-4 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">
                    Cancel
                  </button>
                  <button type="submit" className="px-5 py-2 bg-purple-500 text-white rounded-lg text-sm font-bold hover:bg-purple-600 transition">
                    {editingGoal ? 'Save' : 'Create'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;