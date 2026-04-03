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
  Wand2,
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
      <div className="cal-ai-panel absolute right-0 top-0 bottom-0 w-[420px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* AI Panel Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
              <Wand2 className="text-purple-500" />
              AI Calendar Assistant
            </h3>
            <button onClick={props.onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white">
              <X />
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
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-12 text-sm outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={props.onNaturalLanguageSubmit}
              disabled={props.aiLoading || !props.naturalLanguageInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition"
            >
              {props.aiLoading ? <Loader2 className="animate-spin text-sm" /> : <ArrowRight className="text-sm" />}
            </button>
          </div>
        </div>

        {/* AI Panel Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          {[
            { id: 'assistant', label: 'Assistant', icon: 'fa-robot' },
            { id: 'insights',  label: 'Insights',  icon: 'fa-lightbulb' },
            { id: 'analytics', label: 'Analytics', icon: 'fa-chart-line' },
            { id: 'goals',     label: 'Goals',     icon: 'fa-bullseye' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => props.onTabChange(tab.id as typeof props.aiPanelTab)}
              className={`flex-1 px-3 py-3 text-xs font-medium flex items-center justify-center gap-1.5 transition ${props.aiPanelTab === tab.id ? 'text-purple-600 border-b-2 border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
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
              <div className="flex items-center gap-3 text-purple-500">
                <Loader2 className="animate-spin text-xl" />
                <span className="text-sm">AI is analyzing your calendar...</span>
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
            <div className="space-y-4">
              {/* Quick Actions */}
              <div>
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Quick Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => props.onGetSuggestions(30)} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                    <Clock className="text-blue-500 mb-2" />
                    <p className="text-xs font-medium dark:text-white">Find Meeting Time</p>
                    <p className="text-[10px] text-zinc-500">30 min slot</p>
                  </button>
                  <button onClick={props.onSuggestFocusBlocks} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                    <Brain className="text-indigo-500 mb-2" />
                    <p className="text-xs font-medium dark:text-white">Add Focus Time</p>
                    <p className="text-[10px] text-zinc-500">Protect deep work</p>
                  </button>
                  <button onClick={props.onDetectConflicts} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                    <AlertTriangle className="text-amber-500 mb-2" />
                    <p className="text-xs font-medium dark:text-white">Check Conflicts</p>
                    <p className="text-[10px] text-zinc-500">Find overlaps</p>
                  </button>
                  <button onClick={props.onAnalyzeTravelBuffers} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                    <Car className="text-green-500 mb-2" />
                    <p className="text-xs font-medium dark:text-white">Travel Buffers</p>
                    <p className="text-[10px] text-zinc-500">Check gaps</p>
                  </button>
                </div>
              </div>

              {/* Scheduling Suggestions */}
              {props.schedulingSuggestions.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Lightbulb className="text-amber-500" />
                    Suggested Times
                  </h4>
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
                          <Plus className="text-zinc-400 group-hover:text-blue-500 transition" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Focus Blocks */}
              {props.focusBlocks.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Brain className="text-indigo-500" />
                    Suggested Focus Blocks
                  </h4>
                  <div className="space-y-2">
                    {props.focusBlocks.slice(0, 4).map((block) => (
                      <div key={block.id} className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                            {block.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-xs text-indigo-600 dark:text-indigo-400">{block.startTime} - {block.endTime}</p>
                          <p className="text-[10px] text-indigo-500 capitalize mt-1">{block.type.replace('_', ' ')}</p>
                        </div>
                        <button
                          onClick={() => props.onAddFocusBlock(block)}
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
              {props.conflicts.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertTriangle className="text-amber-500" />
                    Conflicts Detected ({props.conflicts.length})
                  </h4>
                  <div className="space-y-2">
                    {props.conflicts.map((conflict, i) => (
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
                            onClick={() => props.onSmartReschedule(conflict.conflictingEvents[0])}
                            className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                          >
                            <Wand2 className="mr-1" />
                            {conflict.suggestedResolutions[0].description}
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
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Car className="text-green-500" />
                    Travel Buffer Alerts
                  </h4>
                  <div className="space-y-2">
                    {props.travelBuffers.map((buffer, i) => (
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
          {props.aiPanelTab === 'insights' && !props.aiLoading && (
            <div className="space-y-4">
              <button onClick={props.onAnalyzeRelationships} className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                <Users className="text-purple-500 mr-2" />
                <span className="text-sm font-medium dark:text-white">Refresh Relationship Insights</span>
              </button>

              {props.relationshipInsights.length > 0 && (
                <div className="space-y-3">
                  {props.relationshipInsights.slice(0, 8).map((insight) => (
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
                          insight.relationshipHealth === 'strong'          ? 'bg-green-100 text-green-700' :
                          insight.relationshipHealth === 'healthy'         ? 'bg-blue-100 text-blue-700' :
                          insight.relationshipHealth === 'needs_attention' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {insight.relationshipHealth.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 space-y-1">
                        <p><CalendarIcon className="mr-1" /> Last met: {insight.lastMeeting ? insight.lastMeeting.toLocaleDateString() : 'Never'}</p>
                        <p><Clock className="mr-1" /> {insight.daysSinceLastContact} days since last contact</p>
                        {insight.upcomingMilestones.length > 0 && (
                          <p className="text-amber-600"><Star className="mr-1" /> {insight.upcomingMilestones[0].description} in {insight.upcomingMilestones[0].daysUntil} days</p>
                        )}
                      </div>
                      {insight.suggestedActions.length > 0 && (
                        <button
                          onClick={() => props.onOpenInviteModal(insight.contact)}
                          className="mt-2 text-xs text-purple-500 hover:text-purple-700 font-medium"
                        >
                          <CalendarPlus className="mr-1" />
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
          {props.aiPanelTab === 'analytics' && !props.aiLoading && (
            <div className="space-y-4">
              <button onClick={props.onGenerateAnalytics} className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                <RefreshCw className="text-blue-500 mr-2" />
                <span className="text-sm font-medium dark:text-white">Refresh Analytics</span>
              </button>

              {props.analytics && (
                <div className="space-y-4">
                  {/* Overview Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                      <p className="text-2xl font-bold text-blue-600">{props.analytics.totalMeetingHours}h</p>
                      <p className="text-xs text-blue-500">Meeting Hours</p>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                      <p className="text-2xl font-bold text-green-600">{props.analytics.focusTimeHours}h</p>
                      <p className="text-xs text-green-500">Focus Time</p>
                    </div>
                  </div>

                  {/* Productivity Score */}
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium dark:text-white">Productivity Score</p>
                      <span className={`text-xl font-bold ${props.analytics.productivityScore >= 70 ? 'text-green-500' : props.analytics.productivityScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {props.analytics.productivityScore}%
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${props.analytics.productivityScore >= 70 ? 'bg-green-500' : props.analytics.productivityScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${props.analytics.productivityScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Meeting Overload Warning */}
                  {props.analytics.meetingOverload && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                      <p className="text-sm font-medium text-red-700 dark:text-red-300">
                        <AlertTriangle className="mr-2" />
                        Meeting Overload Detected
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">Over 50% of your time is in meetings</p>
                    </div>
                  )}

                  {/* Time by Category */}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Time by Event Type</h4>
                    <div className="space-y-2">
                      {Object.entries(props.analytics.timeByCategory).map(([type, hours]) => (
                        <div key={type} className="flex items-center justify-between">
                          <span className="text-sm capitalize dark:text-zinc-300">{type}</span>
                          <span className="text-sm font-medium dark:text-white">{typeof hours === 'number' ? hours.toFixed(1) : hours}h</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  {props.analytics.recommendations.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">AI Recommendations</h4>
                      <div className="space-y-2">
                        {props.analytics.recommendations.map((rec, i) => (
                          <div key={i} className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                            <p className="text-xs text-purple-700 dark:text-purple-300">
                              <Lightbulb className="mr-2" />
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
          {props.aiPanelTab === 'goals' && !props.aiLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Your Goals</h4>
                <button
                  onClick={() => props.onOpenGoalModal(null)}
                  className="text-xs text-purple-500 hover:text-purple-700 font-medium"
                >
                  <Plus className="mr-1" /> Add Goal
                </button>
              </div>

              {/* Goals List */}
              <div className="space-y-2">
                {props.goals.map(goal => (
                  <div key={goal.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${goal.color}`}></div>
                        <span className="text-sm font-medium dark:text-white">{goal.title}</span>
                      </div>
                      <button
                        onClick={() => props.onOpenGoalModal(goal)}
                        className="text-zinc-400 hover:text-zinc-600"
                      >
                        <Pen className="text-xs" />
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500">{goal.category} • {goal.targetHoursPerWeek}h/week target</p>
                  </div>
                ))}
              </div>

              <button onClick={props.onAnalyzeGoalAlignment} className="w-full p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-left hover:bg-purple-100 dark:hover:bg-purple-900/30 transition">
                <PieChart className="text-purple-500 mr-2" />
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Analyze Goal Alignment</span>
              </button>

              {/* Goal Alignments */}
              {props.goalAlignments.length > 0 && (
                <div className="space-y-3">
                  {props.goalAlignments.map(alignment => (
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
                          style={{ width: `${Math.min(100, (alignment.allocatedTime / (alignment.targetTime || 1)) * 100)}%` }}
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

      {/* ── Meeting Prep Modal ───────────────────────────────────────── */}
      {props.showMeetingPrepModal && props.meetingPrep && props.prepEvent && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                  <ClipboardList className="text-purple-500" />
                  Meeting Prep
                </h3>
                <p className="text-sm text-zinc-500 mt-1">{props.prepEvent.title}</p>
              </div>
              <button onClick={props.onCloseMeetingPrep} className="text-zinc-400 hover:text-zinc-600">
                <X />
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
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Suggested Agenda</h4>
                  <ol className="list-decimal list-inside space-y-1">
                    {props.meetingPrep.suggestedAgenda.map((item, i) => (
                      <li key={i} className="text-sm dark:text-zinc-300">{item}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Talking Points */}
              {props.meetingPrep.talkingPoints.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Talking Points</h4>
                  <ul className="space-y-2">
                    {props.meetingPrep.talkingPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="text-green-500 mt-1 text-xs" />
                        <span className="text-sm dark:text-zinc-300">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Questions to Ask */}
              {props.meetingPrep.questionsToAsk.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Questions to Ask</h4>
                  <ul className="space-y-2">
                    {props.meetingPrep.questionsToAsk.map((q, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <HelpCircle className="text-blue-500 mt-1 text-xs" />
                        <span className="text-sm dark:text-zinc-300">{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Context Notes */}
              {props.meetingPrep.contextNotes && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Context</h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg">{props.meetingPrep.contextNotes}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
              <button onClick={props.onCloseMeetingPrep} className="w-full py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-bold hover:opacity-90 transition">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Smart Reschedule Modal ───────────────────────────────────── */}
      {props.showRescheduleModal && props.rescheduleEvent && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                  <CalendarDays className="text-blue-500" />
                  Smart Reschedule
                </h3>
                <button onClick={props.onCloseRescheduleModal} className="text-zinc-400 hover:text-zinc-600">
                  <X />
                </button>
              </div>
              <p className="text-sm text-zinc-500 mt-2">Reschedule: {props.rescheduleEvent.title}</p>
            </div>
            <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
              {props.rescheduleOptions.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No available time slots found</p>
              ) : (
                props.rescheduleOptions.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => props.onApplyReschedule(option)}
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
                        <ArrowRight className="text-zinc-400 group-hover:text-blue-500 transition" />
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
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-bold dark:text-white">
                {props.editingGoal ? 'Edit Goal' : 'New Goal'}
              </h3>
              <button onClick={props.onCloseGoalModal} className="text-zinc-400 hover:text-zinc-600">
                <X />
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
                <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Goal Title</label>
                <input
                  type="text"
                  name="title"
                  defaultValue={props.editingGoal?.title}
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
                  defaultValue={props.editingGoal?.category}
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
                    defaultValue={props.editingGoal?.targetHoursPerWeek || 10}
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
                    defaultValue={props.editingGoal?.priority || 1}
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
                      <input type="radio" name="color" value={color.class} defaultChecked={props.editingGoal?.color === color.class || (!props.editingGoal && color.id === 'blue')} className="sr-only peer" />
                      <div className={`w-8 h-8 rounded-full ${color.class} transition ring-2 ring-offset-2 ring-transparent peer-checked:ring-purple-500`}></div>
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
                    className="px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  >
                    Delete
                  </button>
                )}
                <div className="flex gap-3 ml-auto">
                  <button type="button" onClick={props.onCloseGoalModal} className="px-4 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">
                    Cancel
                  </button>
                  <button type="submit" className="px-5 py-2 bg-purple-500 text-white rounded-lg text-sm font-bold hover:bg-purple-600 transition">
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
