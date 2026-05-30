import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarPlus,
  Car,
  Check,
  ClipboardList,
  Clock,
  HelpCircle,
  Lightbulb,
  Loader2,
  Pen,
  PieChart,
  Plus,
  RefreshCw,
  Star,
  Users,
  X,
} from 'lucide-react';
import {
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
} from '../../services/calendarAIService';
import { CalendarEvent } from '../../types';
import { postMeetingService, MeetingFollowUp as PostMeetingFollowUp } from '../../services/postMeetingService';
import SuggestedEventsPanel from '../SuggestedEventsPanel';
import PostMeetingPrompt from '../PostMeetingPrompt';
import AIProvenanceChip from '../ui/AIProvenanceChip';
import { EVENT_COLORS } from './calendarTypes';

export interface CalendarAIPanelProps {
  // Panel visibility
  showAIPanel: boolean;
  onClose: () => void;

  // Tab state
  aiPanelTab: 'assistant' | 'insights' | 'analytics' | 'goals';
  onTabChange: (tab: 'assistant' | 'insights' | 'analytics' | 'goals') => void;

  // Natural language input
  aiLoading: boolean;
  naturalLanguageInput: string;
  onNaturalLanguageChange: (v: string) => void;
  onNaturalLanguageSubmit: () => void;

  // Quick action handlers (Assistant tab)
  onGetSuggestions: (duration: number) => void;
  onSuggestFocusBlocks: () => void;
  onDetectConflicts: () => void;
  onAnalyzeTravelBuffers: () => void;
  onAddFocusBlock: (block: FocusTimeBlock) => void;
  onSmartReschedule: (event: CalendarEvent) => void;

  // Data — assistant tab
  schedulingSuggestions: SchedulingSuggestion[];
  focusBlocks: FocusTimeBlock[];
  conflicts: ConflictResolution[];
  travelBuffers: TravelBuffer[];

  // Callbacks that open event creation from AI suggestions
  onOpenEventModal: () => void;
  onSetNewEventDate: (date: string) => void;
  onSetNewEventTime: (time: string) => void;
  onSetNewEventEndTime: (time: string) => void;
  onSetNewEventTitle: (title: string) => void;
  onSetNewEventDesc: (desc: string) => void;
  onSetNewEventLocation: (location: string) => void;
  onSetNewEventType: (type: CalendarEvent['type']) => void;

  // Insights tab
  relationshipInsights: RelationshipInsight[];
  onAnalyzeRelationships: () => void;
  onOpenInviteModal: (contact: RelationshipInsight['contact']) => void;

  // Analytics tab
  analytics: CalendarAnalytics | null;
  onGenerateAnalytics: () => void;

  // Goals tab
  goals: Goal[];
  goalAlignments: GoalAlignment[];
  showGoalModal: boolean;
  editingGoal: Goal | null;
  onOpenGoalModal: (goal: Goal | null) => void;
  onCloseGoalModal: () => void;
  onSaveGoal: (goal: Goal) => void;
  onDeleteGoal: (id: string) => void;
  onAnalyzeGoalAlignment: () => void;

  // Meeting Prep Modal
  showMeetingPrepModal: boolean;
  meetingPrep: MeetingPrepBriefing | null;
  prepEvent: CalendarEvent | null;
  onCloseMeetingPrep: () => void;

  // Smart Reschedule Modal
  showRescheduleModal: boolean;
  rescheduleEvent: CalendarEvent | null;
  rescheduleOptions: RescheduleOption[];
  onCloseRescheduleModal: () => void;
  onApplyReschedule: (option: RescheduleOption) => void;

  // Post-meeting follow-up prompt
  activeFollowUpPrompt: PostMeetingFollowUp | null;
  onFollowUpCreateAction: (suggestion: PostMeetingFollowUp['suggestions'][number]) => void;
  onFollowUpDismiss: (id: string) => void;
  onFollowUpSkip: (id: string) => void;
}

export const CalendarAIPanel: React.FC<CalendarAIPanelProps> = (props) => {
  if (!props.showAIPanel) return null;

  return (
    <>
      {/* ── AI Side Panel ────────────────────────────────────────────── */}
      <div className="cal-ai-panel absolute right-0 top-0 bottom-0 w-[420px] bg-[var(--pulse-surface)] dark:bg-[var(--pulse-canvas)] border-l border-[var(--pulse-border)] shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* AI Panel Header */}
        <div className="p-4 border-b border-[var(--pulse-border)] bg-zinc-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col gap-1.5">
              <AIProvenanceChip vendor="CLAUDE" type="ASSISTANT" />
              <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Calendar
              </h3>
            </div>
            <button
              onClick={props.onClose}
              aria-label="Close AI panel"
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-white/5 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Natural Language Input */}
          <div className="relative">
            <input
              type="text"
              value={props.naturalLanguageInput}
              onChange={(e) => props.onNaturalLanguageChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && props.onNaturalLanguageSubmit()}
              placeholder="Try: 'Schedule a call with John tomorrow at 2pm'"
              className="w-full bg-[var(--pulse-surface)] dark:bg-[var(--pulse-surface)] border border-[var(--pulse-border-strong)] rounded-xl px-4 py-3 pr-12 text-sm outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              onClick={props.onNaturalLanguageSubmit}
              disabled={props.aiLoading || !props.naturalLanguageInput.trim()}
              aria-label="Submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:opacity-50 transition"
            >
              {props.aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* AI Panel Tabs */}
        <div className="flex border-b border-[var(--pulse-border)]">
          {[
            { id: 'assistant', label: 'Assistant', icon: 'fa-robot' },
            { id: 'insights',  label: 'Insights',  icon: 'fa-lightbulb' },
            { id: 'analytics', label: 'Analytics', icon: 'fa-chart-line' },
            { id: 'goals',     label: 'Goals',     icon: 'fa-bullseye' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => props.onTabChange(tab.id as typeof props.aiPanelTab)}
              className={`flex-1 px-3 py-3 font-mono text-[10px] tracking-[0.1em] uppercase flex items-center justify-center gap-1.5 transition ${props.aiPanelTab === tab.id ? 'text-rose-600 dark:text-rose-400 border-b-2 border-rose-500 bg-rose-500/5 dark:bg-rose-500/10' : 'text-zinc-500 hover:text-[var(--pulse-ink)] border-b-2 border-transparent'}`}
            >
              <i className={`fa-solid ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* AI Panel Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {props.aiLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3 text-rose-500">
                <Loader2 className="animate-spin text-xl" />
                <span className="font-mono text-[11px] tracking-[0.1em] uppercase">Analyzing calendar</span>
              </div>
            </div>
          )}

          {/* Suggested Events from Conversations */}
          <SuggestedEventsPanel
            onAcceptEvent={(eventData) => {
              props.onSetNewEventTitle(eventData.title || '');
              props.onSetNewEventDate(eventData.start ? eventData.start.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
              props.onSetNewEventTime(eventData.start ? `${eventData.start.getHours().toString().padStart(2, '0')}:${eventData.start.getMinutes().toString().padStart(2, '0')}` : '09:00');
              props.onSetNewEventEndTime(eventData.end ? `${eventData.end.getHours().toString().padStart(2, '0')}:${eventData.end.getMinutes().toString().padStart(2, '0')}` : '10:00');
              props.onSetNewEventDesc(eventData.description || '');
              props.onSetNewEventLocation(eventData.location || '');
              props.onSetNewEventType(eventData.type || 'event');
              props.onOpenEventModal();
            }}
          />

          {/* Assistant Tab */}
          {props.aiPanelTab === 'assistant' && !props.aiLoading && (
            <div className="space-y-5">
              {/* Quick Actions — horizontal mono-chip rail (Path A).
                  Was a 2x2 grid of icon+heading+subtext cards (the identical-card
                  antipattern). Rail compresses to a single row that scrolls on
                  narrow widths and reads as a toolbar, not a card stack. */}
              <div>
                <h4 className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500 mb-2">Quick actions</h4>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  <button
                    onClick={() => props.onGetSuggestions(30)}
                    title="Find a 30-minute meeting slot"
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--pulse-canvas-soft)] dark:bg-white/[0.03] hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-white/[0.055] text-[var(--pulse-ink-2)] hover:text-[var(--pulse-ink)] font-mono text-[10px] font-semibold uppercase tracking-[0.1em] border border-transparent hover:border-[var(--pulse-border)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)] transition whitespace-nowrap"
                  >
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    Find time
                  </button>
                  <button
                    onClick={props.onSuggestFocusBlocks}
                    title="Suggest deep-work focus blocks"
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--pulse-canvas-soft)] dark:bg-white/[0.03] hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-white/[0.055] text-[var(--pulse-ink-2)] hover:text-[var(--pulse-ink)] font-mono text-[10px] font-semibold uppercase tracking-[0.1em] border border-transparent hover:border-[var(--pulse-border)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)] transition whitespace-nowrap"
                  >
                    <Brain className="w-3.5 h-3.5" aria-hidden="true" />
                    Focus
                  </button>
                  <button
                    onClick={props.onDetectConflicts}
                    title="Detect schedule conflicts"
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--pulse-canvas-soft)] dark:bg-white/[0.03] hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-white/[0.055] text-[var(--pulse-ink-2)] hover:text-[var(--pulse-ink)] font-mono text-[10px] font-semibold uppercase tracking-[0.1em] border border-transparent hover:border-[var(--pulse-border)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)] transition whitespace-nowrap"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                    Conflicts
                  </button>
                  <button
                    onClick={props.onAnalyzeTravelBuffers}
                    title="Analyze travel buffers between events"
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--pulse-canvas-soft)] dark:bg-white/[0.03] hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-white/[0.055] text-[var(--pulse-ink-2)] hover:text-[var(--pulse-ink)] font-mono text-[10px] font-semibold uppercase tracking-[0.1em] border border-transparent hover:border-[var(--pulse-border)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)] transition whitespace-nowrap"
                  >
                    <Car className="w-3.5 h-3.5" aria-hidden="true" />
                    Travel
                  </button>
                </div>
              </div>

              {/* Scheduling Suggestions */}
              {props.schedulingSuggestions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AIProvenanceChip vendor="CLAUDE" type="SUGGESTIONS" />
                    <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500">{props.schedulingSuggestions.length} times</span>
                  </div>
                  <div className="space-y-2">
                    {props.schedulingSuggestions.slice(0, 5).map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          props.onSetNewEventDate(suggestion.date.toISOString().split('T')[0]);
                          props.onSetNewEventTime(suggestion.startTime);
                          props.onSetNewEventEndTime(suggestion.endTime);
                          props.onOpenEventModal();
                        }}
                        className="w-full p-3 bg-zinc-50 dark:bg-white/[0.03] rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-white/[0.055] transition flex items-center justify-between group border border-transparent hover:border-zinc-200 dark:hover:border-white/10"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--pulse-ink)]">
                            {suggestion.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="font-mono text-[11px] tracking-wide text-zinc-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {suggestion.startTime}–{suggestion.endTime}
                          </p>
                          <p className="text-[10px] text-[var(--pulse-ink-3)] mt-1 truncate">{suggestion.reason}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-[11px] tracking-wider font-semibold text-emerald-600 dark:text-emerald-400" style={{ fontVariantNumeric: 'tabular-nums' }}>{suggestion.score}%</span>
                          <Plus className="w-4 h-4 text-zinc-400 group-hover:text-rose-500 transition" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Focus Blocks */}
              {props.focusBlocks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AIProvenanceChip vendor="CLAUDE" type="FOCUS BLOCKS" />
                    <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500">{props.focusBlocks.length} suggested</span>
                  </div>
                  <div className="space-y-2">
                    {props.focusBlocks.slice(0, 4).map((block) => (
                      <div key={block.id} className="p-3 bg-zinc-50 dark:bg-white/[0.03] rounded-xl flex items-center justify-between border border-zinc-200 dark:border-white/[0.06]">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--pulse-ink)]">
                            {block.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="font-mono text-[11px] tracking-wide text-zinc-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {block.startTime}–{block.endTime}
                          </p>
                          <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-[var(--pulse-ink-3)] mt-1">{block.type.replace('_', ' ')}</p>
                        </div>
                        <button
                          onClick={() => props.onAddFocusBlock(block)}
                          className="px-3 py-1.5 bg-rose-500 text-white font-mono text-[11px] tracking-[0.1em] uppercase rounded-lg hover:bg-rose-600 transition"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conflicts */}
              {props.conflicts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AIProvenanceChip vendor="CLAUDE" type="CONFLICTS" />
                    <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-amber-600 dark:text-amber-400">{props.conflicts.length} detected</span>
                  </div>
                  <div className="space-y-2">
                    {props.conflicts.map((conflict, i) => (
                      <div key={i} className="p-3 bg-amber-500/[0.06] dark:bg-amber-500/[0.08] rounded-xl border border-amber-500/20 dark:border-amber-500/25">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded font-mono text-[10px] tracking-[0.1em] uppercase font-semibold ${
                            conflict.priority === 'high'   ? 'bg-red-500/15 text-red-700 dark:text-red-400' :
                            conflict.priority === 'medium' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' :
                                                              'bg-zinc-500/15 text-[var(--pulse-ink-2)]'
                          }`}>
                            {conflict.priority}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-[var(--pulse-ink)]">{conflict.conflictingEvents[0].title}</p>
                        <p className="text-xs text-zinc-500 mb-2">conflicts with {conflict.conflictingEvents[1].title}</p>
                        {conflict.suggestedResolutions[0] && (
                          <button
                            onClick={() => props.onSmartReschedule(conflict.conflictingEvents[0])}
                            className="font-mono text-[11px] tracking-[0.05em] text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-semibold"
                          >
                            {conflict.suggestedResolutions[0].description} →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Travel Buffers */}
              {props.travelBuffers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AIProvenanceChip vendor="CLAUDE" type="TRAVEL" />
                    <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500">{props.travelBuffers.length} alerts</span>
                  </div>
                  <div className="space-y-2">
                    {props.travelBuffers.map((buffer, i) => (
                      <div key={i} className="p-3 bg-zinc-50 dark:bg-white/[0.03] rounded-xl border border-zinc-200 dark:border-white/[0.06]">
                        <p className="text-sm font-semibold text-[var(--pulse-ink)]">{buffer.fromEvent.title} → {buffer.toEvent.title}</p>
                        <p className="text-xs text-[var(--pulse-ink-3)] mt-1">{buffer.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Insights Tab */}
          {props.aiPanelTab === 'insights' && !props.aiLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <AIProvenanceChip vendor="CLAUDE" type="INSIGHTS" />
                <button
                  onClick={props.onAnalyzeRelationships}
                  className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500 hover:text-rose-500 dark:hover:text-rose-400 transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
              </div>

              {props.relationshipInsights.length > 0 && (
                <div className="space-y-2.5">
                  {props.relationshipInsights.slice(0, 8).map((insight) => (
                    <div key={insight.contact.id} className="p-3 bg-zinc-50 dark:bg-white/[0.03] rounded-xl border border-zinc-200 dark:border-white/[0.06]">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-full ${insight.contact.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                          {insight.contact.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--pulse-ink)] truncate">{insight.contact.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate">{insight.contact.email}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded font-mono text-[10px] tracking-[0.1em] uppercase font-semibold border ${
                          insight.relationshipHealth === 'strong'          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400' :
                          insight.relationshipHealth === 'healthy'         ? 'bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-400' :
                          insight.relationshipHealth === 'needs_attention' ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400' :
                                                                              'bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-400'
                        }`}>
                          {insight.relationshipHealth.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 space-y-1">
                        <p className="flex items-center gap-1.5"><CalendarIcon className="w-3 h-3 shrink-0" /> Last met: {insight.lastMeeting ? insight.lastMeeting.toLocaleDateString() : 'Never'}</p>
                        <p className="flex items-center gap-1.5"><Clock className="w-3 h-3 shrink-0" /> {insight.daysSinceLastContact} days since last contact</p>
                        {insight.upcomingMilestones.length > 0 && (
                          <p className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><Star className="w-3 h-3 shrink-0" /> {insight.upcomingMilestones[0].description} in {insight.upcomingMilestones[0].daysUntil} days</p>
                        )}
                      </div>
                      {insight.suggestedActions.length > 0 && (
                        <button
                          onClick={() => props.onOpenInviteModal(insight.contact)}
                          className="mt-2 font-mono text-[11px] tracking-[0.05em] text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-semibold flex items-center gap-1.5"
                        >
                          <CalendarPlus className="w-3 h-3" />
                          Schedule catch-up →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Analytics Tab */}
          {props.aiPanelTab === 'analytics' && !props.aiLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <AIProvenanceChip vendor="CLAUDE" type="ANALYTICS" />
                <button
                  onClick={props.onGenerateAnalytics}
                  className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500 hover:text-rose-500 dark:hover:text-rose-400 transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
              </div>

              {props.analytics && (
                <div className="space-y-5">
                  {/* Typographic phrase — was a 2-card hero-metric template
                      (text-2xl numerals in stat cards). The phrase reads as
                      one thought, not two interchangeable cards.
                      TODO(impeccable): when calendarAIService starts returning
                      prior-week deltas, add a "vs last week" mono line below. */}
                  <p className="text-base leading-relaxed text-[var(--pulse-ink)]">
                    <span className="font-semibold tabular-nums">{props.analytics.totalMeetingHours}h</span> in meetings,{' '}
                    <span className="font-semibold tabular-nums">{props.analytics.focusTimeHours}h</span> in focus.
                  </p>

                  {/* Meeting Overload Warning — kept as a legitimate warning state */}
                  {props.analytics.meetingOverload && (
                    <div className="p-3 bg-[var(--pulse-tone-overdue-soft)] rounded-xl border border-[var(--pulse-tone-overdue-soft)]">
                      <p className="text-sm font-semibold text-[var(--pulse-tone-overdue)] flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                        Over 50% of your time is in meetings.
                      </p>
                    </div>
                  )}

                  {/* Time by Category — quiet two-column table */}
                  <div>
                    <h4 className="font-mono text-[11px] tracking-[0.1em] uppercase text-[var(--pulse-ink-3)] mb-2">By event type</h4>
                    <div className="space-y-1.5">
                      {Object.entries(props.analytics.timeByCategory).map(([type, hours]) => (
                        <div key={type} className="flex items-center justify-between text-sm">
                          <span className="capitalize text-[var(--pulse-ink-2)]">{type}</span>
                          <span className="font-mono text-xs font-semibold text-[var(--pulse-ink)] tabular-nums">{typeof hours === 'number' ? hours.toFixed(1) : hours}h</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Two ideas — recommendations as prose, not card stack.
                      Replaces the per-item bordered-card pattern that compounded
                      with the killed Productivity Score to form the hero-metric
                      template body. */}
                  {props.analytics.recommendations.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <AIProvenanceChip vendor="CLAUDE" type="IDEAS" />
                      </div>
                      <ul className="space-y-2.5">
                        {props.analytics.recommendations.map((rec, i) => (
                          <li key={i} className="text-sm text-[var(--pulse-ink-2)] flex items-start gap-2">
                            <Lightbulb className="w-3.5 h-3.5 shrink-0 text-[var(--pulse-tone-warning)] mt-0.5" aria-hidden="true" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Goals Tab */}
          {props.aiPanelTab === 'goals' && !props.aiLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500">Your Goals</h4>
                <button
                  onClick={() => props.onOpenGoalModal(null)}
                  className="font-mono text-[11px] tracking-[0.1em] uppercase text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Goal
                </button>
              </div>

              {/* Goals List */}
              <div className="space-y-2">
                {props.goals.map(goal => (
                  <div key={goal.id} className="p-3 bg-zinc-50 dark:bg-white/[0.03] rounded-xl border border-zinc-200 dark:border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${goal.color} shrink-0`}></div>
                        <span className="text-sm font-semibold text-[var(--pulse-ink)] truncate">{goal.title}</span>
                      </div>
                      <button
                        onClick={() => props.onOpenGoalModal(goal)}
                        aria-label={`Edit ${goal.title}`}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition shrink-0"
                      >
                        <Pen className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="font-mono text-[10px] tracking-[0.05em] uppercase text-zinc-500" style={{ fontVariantNumeric: 'tabular-nums' }}>{goal.category} · {goal.targetHoursPerWeek}h/week</p>
                  </div>
                ))}
              </div>

              <button
                onClick={props.onAnalyzeGoalAlignment}
                className="w-full p-3 bg-zinc-50 dark:bg-white/[0.03] rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-white/[0.055] transition border border-zinc-200 dark:border-white/[0.06] flex items-center gap-2"
              >
                <PieChart className="w-4 h-4 text-[var(--pulse-ink-3)]" />
                <span className="text-sm font-semibold text-[var(--pulse-ink)]">Analyze Goal Alignment</span>
              </button>

              {/* Goal Alignments */}
              {props.goalAlignments.length > 0 && (
                <div className="space-y-3">
                  <AIProvenanceChip vendor="CLAUDE" type="ALIGNMENT" />
                  {props.goalAlignments.map(alignment => (
                    <div key={alignment.goal.id} className="p-3 bg-zinc-50 dark:bg-white/[0.03] rounded-xl border border-zinc-200 dark:border-white/[0.06]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2.5 h-2.5 rounded-full ${alignment.goal.color} shrink-0`}></div>
                          <span className="text-sm font-semibold text-[var(--pulse-ink)] truncate">{alignment.goal.title}</span>
                        </div>
                        <span className="font-mono text-[11px] font-semibold text-[var(--pulse-ink-2)] shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(alignment.allocatedTime / 60)}h / {alignment.goal.targetHoursPerWeek}h</span>
                      </div>
                      <div className="h-1.5 bg-zinc-200 dark:bg-white/10 rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full ${alignment.goal.color} transition-all`}
                          style={{ width: `${Math.min(100, (alignment.allocatedTime / (alignment.targetTime || 1)) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-[var(--pulse-ink-3)] leading-relaxed">{alignment.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Meeting Prep Modal ───────────────────────────────────────── */}
      {props.showMeetingPrepModal && props.meetingPrep && props.prepEvent && (
        <div className="absolute inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-[var(--pulse-surface)] dark:bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-2xl w-full max-w-lg shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[var(--pulse-border)] flex items-center justify-between">
              <div className="flex flex-col gap-1.5">
                <AIProvenanceChip vendor="CLAUDE" type="MEETING PREP" />
                <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{props.prepEvent.title}</h3>
              </div>
              <button onClick={props.onCloseMeetingPrep} aria-label="Close" className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/5 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Attendees */}
              {props.meetingPrep.attendees.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Attendees</h4>
                  <div className="space-y-2">
                    {props.meetingPrep.attendees.map(attendee => (
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
              {props.meetingPrep.suggestedAgenda.length > 0 && (
                <div>
                  <h4 className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500 mb-3">Suggested Agenda</h4>
                  <ol className="list-decimal list-inside space-y-1.5 marker:text-zinc-400">
                    {props.meetingPrep.suggestedAgenda.map((item, i) => (
                      <li key={i} className="text-sm text-[var(--pulse-ink-2)] leading-relaxed">{item}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Talking Points */}
              {props.meetingPrep.talkingPoints.length > 0 && (
                <div>
                  <h4 className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500 mb-3">Talking Points</h4>
                  <ul className="space-y-2">
                    {props.meetingPrep.talkingPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 mt-1 shrink-0" />
                        <span className="text-sm text-[var(--pulse-ink-2)] leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Questions to Ask */}
              {props.meetingPrep.questionsToAsk.length > 0 && (
                <div>
                  <h4 className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500 mb-3">Questions to Ask</h4>
                  <ul className="space-y-2">
                    {props.meetingPrep.questionsToAsk.map((q, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <HelpCircle className="w-3.5 h-3.5 text-[var(--pulse-ink-3)] mt-1 shrink-0" />
                        <span className="text-sm text-[var(--pulse-ink-2)] leading-relaxed">{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Context Notes */}
              {props.meetingPrep.contextNotes && (
                <div>
                  <h4 className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500 mb-3">Context</h4>
                  <p className="text-sm text-[var(--pulse-ink-2)] bg-zinc-50 dark:bg-white/[0.03] p-3 rounded-lg border border-zinc-200 dark:border-white/[0.06] leading-relaxed">{props.meetingPrep.contextNotes}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-[var(--pulse-border)]">
              <button onClick={props.onCloseMeetingPrep} className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-mono text-[11px] tracking-[0.1em] uppercase font-semibold transition">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Smart Reschedule Modal ───────────────────────────────────── */}
      {props.showRescheduleModal && props.rescheduleEvent && (
        <div className="absolute inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-[var(--pulse-surface)] dark:bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-2xl w-full max-w-md shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-[var(--pulse-border)]">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1.5">
                  <AIProvenanceChip vendor="CLAUDE" type="RESCHEDULE" />
                  <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{props.rescheduleEvent.title}</h3>
                </div>
                <button onClick={props.onCloseRescheduleModal} aria-label="Close" className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/5 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-2 max-h-80 overflow-y-auto">
              {props.rescheduleOptions.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No available time slots found</p>
              ) : (
                props.rescheduleOptions.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => props.onApplyReschedule(option)}
                    className="w-full p-3 bg-zinc-50 dark:bg-white/[0.03] rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-white/[0.055] transition group border border-transparent hover:border-zinc-200 dark:hover:border-white/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--pulse-ink)]">
                          {option.newStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                        <p className="font-mono text-[11px] tracking-wide text-zinc-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {option.newStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{option.newEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-[10px] text-[var(--pulse-ink-3)] mt-1 truncate">{option.reason}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] tracking-wider font-semibold text-emerald-600 dark:text-emerald-400" style={{ fontVariantNumeric: 'tabular-nums' }}>{option.availabilityScore}%</span>
                        <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-rose-500 transition" />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Goal Editor Modal ────────────────────────────────────────── */}
      {props.showGoalModal && (
        <div className="absolute inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-[var(--pulse-surface)] dark:bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-2xl w-full max-w-md shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-[var(--pulse-border)] flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {props.editingGoal ? 'Edit Goal' : 'New Goal'}
              </h3>
              <button onClick={props.onCloseGoalModal} aria-label="Close" className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/5 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);
                const newGoal: Goal = {
                  id: props.editingGoal?.id || `goal-${Date.now()}`,
                  title: formData.get('title') as string,
                  category: formData.get('category') as string,
                  priority: parseInt(formData.get('priority') as string),
                  targetHoursPerWeek: parseInt(formData.get('hours') as string),
                  color: formData.get('color') as string || 'bg-blue-500',
                };
                props.onSaveGoal(newGoal);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500 font-semibold mb-1.5 block">Goal Title</label>
                <input
                  type="text"
                  name="title"
                  defaultValue={props.editingGoal?.title}
                  required
                  placeholder="e.g., Deep Work"
                  className="w-full bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-lg p-3 text-sm text-[var(--pulse-ink)] outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500 font-semibold mb-1.5 block">Category</label>
                <input
                  type="text"
                  name="category"
                  defaultValue={props.editingGoal?.category}
                  required
                  placeholder="e.g., focus, meetings, client"
                  className="w-full bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-lg p-3 text-sm text-[var(--pulse-ink)] outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500 font-semibold mb-1.5 block">Hours/Week</label>
                  <input
                    type="number"
                    name="hours"
                    defaultValue={props.editingGoal?.targetHoursPerWeek || 10}
                    required
                    min="1"
                    max="40"
                    className="w-full bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-lg p-3 text-sm text-[var(--pulse-ink)] outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  />
                </div>
                <div>
                  <label className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500 font-semibold mb-1.5 block">Priority</label>
                  <select
                    name="priority"
                    defaultValue={props.editingGoal?.priority || 1}
                    className="w-full bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-lg p-3 text-sm text-[var(--pulse-ink)] outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition"
                  >
                    <option value="1">High</option>
                    <option value="2">Medium</option>
                    <option value="3">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500 font-semibold mb-2 block">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {EVENT_COLORS.map(color => (
                    <label key={color.id} className="cursor-pointer">
                      <input type="radio" name="color" value={color.class} defaultChecked={props.editingGoal?.color === color.class || (!props.editingGoal && color.id === 'blue')} className="sr-only peer" />
                      <div className={`w-8 h-8 rounded-full ${color.class} transition ring-2 ring-offset-2 ring-transparent peer-checked:ring-rose-500 dark:ring-offset-zinc-900`}></div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-4 flex justify-between">
                {props.editingGoal && (
                  <button
                    type="button"
                    onClick={() => {
                      props.onDeleteGoal(props.editingGoal!.id);
                    }}
                    className="px-4 py-2 font-mono text-[11px] tracking-[0.1em] uppercase text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                  >
                    Delete
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button type="button" onClick={props.onCloseGoalModal} className="px-4 py-2 font-mono text-[11px] tracking-[0.1em] uppercase text-zinc-500 hover:text-[var(--pulse-ink)] transition">
                    Cancel
                  </button>
                  <button type="submit" className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-mono text-[11px] tracking-[0.1em] uppercase font-semibold transition">
                    {props.editingGoal ? 'Save' : 'Create'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Post-Meeting Follow-Up Prompt ────────────────────────────── */}
      {props.activeFollowUpPrompt && (
        <div className="fixed bottom-6 right-6 max-w-md z-[100] animate-fade-in">
          <PostMeetingPrompt
            followUp={props.activeFollowUpPrompt}
            onCreateAction={props.onFollowUpCreateAction}
            onDismiss={props.onFollowUpDismiss}
            onSkip={props.onFollowUpSkip}
          />
        </div>
      )}
    </>
  );
};

export default CalendarAIPanel;
