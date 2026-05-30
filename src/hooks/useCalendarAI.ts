/**
 * useCalendarAI — extracted from Calendar.tsx during the impeccable critique
 * action plan (Step 9: distill). Owns all AI-panel state + handlers that
 * back the CalendarAIPanel surface.
 *
 * Scope:
 *   • Panel visibility (showAIPanel, aiPanelTab)
 *   • Natural-language input + parse-into-form handler
 *   • All "analyze X" handlers (suggestions, conflicts, focus blocks,
 *     travel buffers, relationships, analytics, goal alignment)
 *   • Goals (persisted to localStorage; syncs to calendarAIService.setGoals)
 *   • Meeting Prep modal + handler
 *   • Smart Reschedule modal + handlers
 *   • Add Focus Block (mutates parent events)
 *
 * Not in scope (still in Calendar.tsx, separate concerns):
 *   • Voice command input
 *   • Post-meeting follow-up prompts
 *   • Meeting effectiveness scores
 *
 * The hook takes parent state setters for the event form (so NL-parsed
 * events can pre-fill the create modal) and the event list (so focus
 * blocks + reschedules can write back). All AI panel props are returned
 * as a single object that Calendar.tsx destructures, so the AI-panel
 * mount JSX stays untouched.
 */
import { useState, useEffect, useCallback } from 'react';
import { CalendarEvent, Contact, Task } from '../types';
import {
  calendarAIService,
  SchedulingSuggestion,
  MeetingPrepBriefing,
  ConflictResolution,
  FocusTimeBlock,
  TravelBuffer,
  RelationshipInsight,
  RescheduleOption,
  GoalAlignment,
  CalendarAnalytics,
  Goal,
} from '../services/calendarAIService';

type AIPanelTab = 'assistant' | 'insights' | 'analytics' | 'goals';

export interface UseCalendarAIArgs {
  events: CalendarEvent[];
  contacts: Contact[];
  tasks: Task[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  // Event form pre-fill targets (for natural-language parsing)
  setNewEventTitle: (v: string) => void;
  setNewEventDate: (v: string) => void;
  setNewEventTime: (v: string) => void;
  setNewEventEndTime: (v: string) => void;
  setNewEventType: (v: CalendarEvent['type']) => void;
  setNewEventLocation: (v: string) => void;
  setNewEventDesc: (v: string) => void;
  setNewEventAllDay: (v: boolean) => void;
  setNewEventAttendees: (v: string[]) => void;
  setShowEventModal: (v: boolean) => void;
}

const DEFAULT_GOALS: Goal[] = [
  { id: 'goal-1', title: 'Deep Work', category: 'focus', priority: 1, targetHoursPerWeek: 20, color: 'bg-blue-500' },
  { id: 'goal-2', title: 'Team Meetings', category: 'collaboration', priority: 2, targetHoursPerWeek: 8, color: 'bg-green-500' },
  { id: 'goal-3', title: 'Client Work', category: 'client', priority: 3, targetHoursPerWeek: 10, color: 'bg-purple-500' },
];

export function useCalendarAI(args: UseCalendarAIArgs) {
  const {
    events, contacts, tasks, setEvents,
    setNewEventTitle, setNewEventDate, setNewEventTime, setNewEventEndTime,
    setNewEventType, setNewEventLocation, setNewEventDesc, setNewEventAllDay,
    setNewEventAttendees, setShowEventModal,
  } = args;

  // ─── Panel visibility + input ────────────────────────────────────────
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPanelTab, setAIPanelTab] = useState<AIPanelTab>('assistant');
  const [aiLoading, setAILoading] = useState(false);
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');

  // ─── AI result state ─────────────────────────────────────────────────
  const [schedulingSuggestions, setSchedulingSuggestions] = useState<SchedulingSuggestion[]>([]);
  const [meetingPrep, setMeetingPrep] = useState<MeetingPrepBriefing | null>(null);
  const [conflicts, setConflicts] = useState<ConflictResolution[]>([]);
  const [focusBlocks, setFocusBlocks] = useState<FocusTimeBlock[]>([]);
  const [travelBuffers, setTravelBuffers] = useState<TravelBuffer[]>([]);
  const [relationshipInsights, setRelationshipInsights] = useState<RelationshipInsight[]>([]);
  const [rescheduleOptions, setRescheduleOptions] = useState<RescheduleOption[]>([]);
  const [goalAlignments, setGoalAlignments] = useState<GoalAlignment[]>([]);
  const [analytics, setAnalytics] = useState<CalendarAnalytics | null>(null);

  // ─── Goals (persisted to localStorage) ───────────────────────────────
  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const stored = localStorage.getItem('cal_goals');
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return DEFAULT_GOALS;
  });
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Persist goals + sync to AI service (the service uses them for alignment scoring)
  useEffect(() => {
    try { localStorage.setItem('cal_goals', JSON.stringify(goals)); } catch { /* ignore */ }
    calendarAIService.setGoals(goals);
  }, [goals]);

  // ─── Meeting Prep modal ──────────────────────────────────────────────
  const [showMeetingPrepModal, setShowMeetingPrepModal] = useState(false);
  const [prepEvent, setPrepEvent] = useState<CalendarEvent | null>(null);

  // ─── Smart Reschedule modal ──────────────────────────────────────────
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleEvent, setRescheduleEvent] = useState<CalendarEvent | null>(null);

  // ════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ════════════════════════════════════════════════════════════════════

  const handleNaturalLanguageSubmit = useCallback(async () => {
    if (!naturalLanguageInput.trim()) return;
    setAILoading(true);
    try {
      const parsed = await calendarAIService.parseNaturalLanguageEvent(naturalLanguageInput, contacts);
      if (parsed && parsed.title) {
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
  }, [naturalLanguageInput, contacts, setNewEventTitle, setNewEventDate, setNewEventTime, setNewEventEndTime, setNewEventType, setNewEventLocation, setNewEventDesc, setNewEventAllDay, setNewEventAttendees, setShowEventModal]);

  const handleGetSuggestions = useCallback(async (duration: number = 30) => {
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
  }, []);

  const handleGenerateMeetingPrep = useCallback(async (event: CalendarEvent) => {
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
  }, [contacts, events]);

  const handleDetectConflicts = useCallback(async () => {
    setAILoading(true);
    try {
      const detected = await calendarAIService.detectConflicts(events);
      setConflicts(detected);
    } catch (error) {
      console.error('Failed to detect conflicts:', error);
    } finally {
      setAILoading(false);
    }
  }, [events]);

  const handleSuggestFocusBlocks = useCallback(async () => {
    setAILoading(true);
    try {
      const suggestions = await calendarAIService.suggestFocusBlocks(events, tasks);
      setFocusBlocks(suggestions);
    } catch (error) {
      console.error('Failed to suggest focus blocks:', error);
    } finally {
      setAILoading(false);
    }
  }, [events, tasks]);

  const handleAddFocusBlock = useCallback((block: FocusTimeBlock) => {
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
  }, [setEvents]);

  const handleAnalyzeTravelBuffers = useCallback(async () => {
    setAILoading(true);
    try {
      const buffers = await calendarAIService.analyzeTravelBuffers(events);
      setTravelBuffers(buffers);
    } catch (error) {
      console.error('Failed to analyze travel buffers:', error);
    } finally {
      setAILoading(false);
    }
  }, [events]);

  const handleAnalyzeRelationships = useCallback(async () => {
    setAILoading(true);
    try {
      const insights = await calendarAIService.analyzeRelationships(contacts, events);
      setRelationshipInsights(insights);
    } catch (error) {
      console.error('Failed to analyze relationships:', error);
    } finally {
      setAILoading(false);
    }
  }, [contacts, events]);

  const handleGenerateAnalytics = useCallback(async () => {
    setAILoading(true);
    try {
      const result = await calendarAIService.generateAnalytics(events, 'week');
      setAnalytics(result);
    } catch (error) {
      console.error('Failed to generate analytics:', error);
    } finally {
      setAILoading(false);
    }
  }, [events]);

  const handleAnalyzeGoalAlignment = useCallback(async () => {
    setAILoading(true);
    try {
      const alignments = await calendarAIService.analyzeGoalAlignment(events);
      setGoalAlignments(alignments);
    } catch (error) {
      console.error('Failed to analyze goal alignment:', error);
    } finally {
      setAILoading(false);
    }
  }, [events]);

  const handleSmartReschedule = useCallback(async (event: CalendarEvent) => {
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
  }, [events]);

  const handleApplyReschedule = useCallback((option: RescheduleOption) => {
    setRescheduleEvent(prev => {
      if (!prev) return null;
      setEvents(es => es.map(e =>
        e.id === prev.id ? { ...e, start: option.newStart, end: option.newEnd } : e
      ));
      return null;
    });
    setShowRescheduleModal(false);
    setRescheduleOptions([]);
  }, [setEvents]);

  // ─── Modal close helpers ─────────────────────────────────────────────
  const closeMeetingPrep = useCallback(() => {
    setShowMeetingPrepModal(false);
    setPrepEvent(null);
    setMeetingPrep(null);
  }, []);

  const closeRescheduleModal = useCallback(() => {
    setShowRescheduleModal(false);
    setRescheduleEvent(null);
    setRescheduleOptions([]);
  }, []);

  // ─── Goal CRUD ───────────────────────────────────────────────────────
  const openGoalModal = useCallback((goal: Goal | null) => {
    setEditingGoal(goal);
    setShowGoalModal(true);
  }, []);

  const closeGoalModal = useCallback(() => {
    setShowGoalModal(false);
    setEditingGoal(null);
  }, []);

  const saveGoal = useCallback((goal: Goal) => {
    setGoals(prev => {
      const existing = prev.find(g => g.id === goal.id);
      return existing
        ? prev.map(g => g.id === goal.id ? goal : g)
        : [...prev, goal];
    });
    setShowGoalModal(false);
    setEditingGoal(null);
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    setShowGoalModal(false);
    setEditingGoal(null);
  }, []);

  return {
    // Panel state
    showAIPanel, setShowAIPanel,
    aiPanelTab, setAIPanelTab,
    aiLoading, setAILoading,
    naturalLanguageInput, setNaturalLanguageInput,
    // AI results
    schedulingSuggestions,
    meetingPrep,
    conflicts,
    focusBlocks,
    travelBuffers,
    relationshipInsights,
    rescheduleOptions,
    goalAlignments,
    analytics,
    // Goals
    goals,
    showGoalModal,
    editingGoal,
    openGoalModal,
    closeGoalModal,
    saveGoal,
    deleteGoal,
    // Meeting Prep modal
    showMeetingPrepModal,
    prepEvent,
    closeMeetingPrep,
    // Smart Reschedule modal
    showRescheduleModal,
    rescheduleEvent,
    closeRescheduleModal,
    // Handlers
    handleNaturalLanguageSubmit,
    handleGetSuggestions,
    handleGenerateMeetingPrep,
    handleDetectConflicts,
    handleSuggestFocusBlocks,
    handleAddFocusBlock,
    handleAnalyzeTravelBuffers,
    handleAnalyzeRelationships,
    handleGenerateAnalytics,
    handleAnalyzeGoalAlignment,
    handleSmartReschedule,
    handleApplyReschedule,
  };
}

export type UseCalendarAIReturn = ReturnType<typeof useCalendarAI>;
