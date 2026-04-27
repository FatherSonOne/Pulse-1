// MessageAIPanel — unified AI artifact panel for Relay messages.
//
// Consolidates the four prior single-purpose panels (VoxConversationSummary,
// VoxAutoChapters, VoxMeetingNotes, AIAnalysisPanel) into one accordion-style
// component. A section renders if and only if its prop is present and non-empty.
// A panel with no sections returns null.
//
// Section order (intentional): summary → analysis → chapters → meetingNotes.
// Summary is most-glanceable; analysis is contextual to the current message;
// chapters is timeline navigation (long messages only); meeting notes is the
// full structured artifact.

import React, { useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  HeartPulse,
  HelpCircle,
  Lightbulb,
  Loader2,
  MapPin,
  MessageSquare,
  PlayCircle,
  TrendingUp,
  User,
  Users,
  X,
  Archive,
} from 'lucide-react';
import {
  ConversationSummary,
  Chapter,
  MeetingNotes,
  formatChapterTime,
} from '../../services/relay/relayAIService';
import {
  VoxAnalysis,
  ActionItem,
  SuggestedResponse,
  SentimentType,
  UrgencyLevel,
} from '../../services/relay/relayTypes';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';

// ============================================
// PROPS
// ============================================

export interface MessageAIPanelDefaultOpen {
  summary?: boolean;
  chapters?: boolean;
  meetingNotes?: boolean;
  analysis?: boolean;
}

export interface MessageAIPanelProps {
  /** Conversation-level summary section (renders if provided). */
  summary?: ConversationSummary;
  /** Auto-generated chapters section (renders if provided + non-empty). */
  chapters?: Chapter[];
  /** Meeting notes section (renders if provided). */
  meetingNotes?: MeetingNotes;
  /** Per-message AI analysis section (renders if provided). */
  analysis?: VoxAnalysis | null;
  /** Optional seek callback for chapter clicks. */
  onSeek?: (time: number) => void;
  /** Current playback time, for chapter active-state highlighting. */
  currentTime?: number;
  /** Optional dismiss for the entire panel. */
  onClose?: () => void;
  /** Optional archive handler for meeting notes section. */
  onArchive?: () => Promise<void>;
  /** Optional copy handler for meeting notes section. */
  onCopy?: () => void;
  /** Action item toggle (analysis section). */
  onActionItemToggle?: (itemId: string) => void;
  /** Action item click (analysis section). */
  onActionItemClick?: (item: ActionItem) => void;
  /** Suggested response selection (analysis section). */
  onResponseSelect?: (response: SuggestedResponse) => void;
  /** Follow-up selection (analysis section). */
  onFollowUpSelect?: (followUp: string) => void;
  /** Dark mode flag. */
  isDarkMode?: boolean;
  /** Initial expanded state per section. Defaults: summary open, others closed. */
  defaultOpen?: MessageAIPanelDefaultOpen;
  /** Additional Tailwind classes appended to the root. */
  className?: string;
}

// ============================================
// HELPERS
// ============================================

const getSentimentConfig = (sentiment: SentimentType) => {
  const configs = {
    positive: { color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'fa-face-smile', label: 'Positive' },
    negative: { color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', icon: 'fa-face-frown', label: 'Negative' },
    neutral: { color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800', icon: 'fa-face-meh', label: 'Neutral' },
    mixed: { color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'fa-face-meh-blank', label: 'Mixed' },
  };
  return configs[sentiment] || configs.neutral;
};

const getUrgencyConfig = (urgency: UrgencyLevel) => {
  const configs = {
    urgent: { color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', icon: 'fa-circle-exclamation', label: 'Urgent' },
    high: { color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', icon: 'fa-triangle-exclamation', label: 'High' },
    medium: { color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: 'fa-circle-info', label: 'Medium' },
    low: { color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800', icon: 'fa-circle', label: 'Low' },
  };
  return configs[urgency] || configs.low;
};

const getPriorityColor = (priority: string) => {
  const colors = {
    high: 'text-red-500 bg-red-50 dark:bg-red-900/20',
    medium: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
    low: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800',
  };
  return colors[priority as keyof typeof colors] || colors.low;
};

// ============================================
// SECTION HEADER (the accordion toggle button)
// ============================================

interface SectionHeaderProps {
  isOpen: boolean;
  onToggle: () => void;
  chipType: string;
  trailing?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ isOpen, onToggle, chipType, trailing }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={isOpen}
    className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition"
  >
    <div className="flex items-center gap-2">
      <AIProvenanceChip vendor="PULSE AI" type={chipType} />
      {trailing}
    </div>
    <ChevronDown className={`w-4 h-4 text-zinc-500 transition ${isOpen ? '' : '-rotate-90'}`} />
  </button>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const MessageAIPanel: React.FC<MessageAIPanelProps> = ({
  summary,
  chapters,
  meetingNotes,
  analysis,
  onSeek,
  currentTime = 0,
  onClose,
  onArchive,
  onCopy,
  onActionItemToggle,
  onActionItemClick,
  onResponseSelect,
  onFollowUpSelect,
  isDarkMode = false,
  defaultOpen,
  className = '',
}) => {
  // Visibility flags — a section renders iff its data is present and non-empty.
  const hasSummary = !!summary;
  const hasChapters = !!chapters && chapters.length > 0;
  const hasMeetingNotes = !!meetingNotes;
  const hasAnalysis = !!analysis;

  // No sections? Render nothing.
  if (!hasSummary && !hasChapters && !hasMeetingNotes && !hasAnalysis) {
    return null;
  }

  // Open-state: summary defaults open, all others default closed.
  const [openSummary, setOpenSummary] = useState(defaultOpen?.summary ?? true);
  const [openAnalysis, setOpenAnalysis] = useState(defaultOpen?.analysis ?? false);
  const [openChapters, setOpenChapters] = useState(defaultOpen?.chapters ?? false);
  const [openMeetingNotes, setOpenMeetingNotes] = useState(defaultOpen?.meetingNotes ?? false);

  // Build ordered list of rendered sections (for hairline separators).
  const renderedKeys: string[] = [];
  if (hasSummary) renderedKeys.push('summary');
  if (hasAnalysis) renderedKeys.push('analysis');
  if (hasChapters) renderedKeys.push('chapters');
  if (hasMeetingNotes) renderedKeys.push('meetingNotes');

  const sectionBorderClass = (key: string) =>
    renderedKeys.indexOf(key) > 0 ? 'border-t border-zinc-200 dark:border-zinc-800' : '';

  return (
    <div
      className={`relative rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 overflow-hidden ${className}`}
    >
      {/* Close button (top-right) */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss panel"
          className="absolute top-2 right-2 z-10 p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* SUMMARY SECTION */}
      {hasSummary && summary && (
        <section className={sectionBorderClass('summary')}>
          <SectionHeader
            isOpen={openSummary}
            onToggle={() => setOpenSummary((v) => !v)}
            chipType="SUMMARY"
          />
          {openSummary && (
            <div className="px-4 pb-4 space-y-4">
              {/* Stats bar */}
              <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{summary.messageCount} messages</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{summary.duration}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>{summary.participants.join(', ')}</span>
                </div>
              </div>

              {/* Overview */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider font-mono mb-2 text-zinc-500 dark:text-zinc-400">
                  Overview
                </h4>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {summary.overview}
                </p>
              </div>

              {/* Key Points */}
              {summary.keyPoints.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider font-mono mb-2 text-zinc-500 dark:text-zinc-400">
                    Key Points
                  </h4>
                  <ul className="space-y-2">
                    {summary.keyPoints.map((point, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-rose-500" />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {summary.actionItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider font-mono mb-2 text-zinc-500 dark:text-zinc-400">
                    Action Items
                  </h4>
                  <ul className="space-y-2">
                    {summary.actionItems.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-500" />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ANALYSIS SECTION */}
      {hasAnalysis && analysis && (
        <AnalysisSection
          analysis={analysis}
          isOpen={openAnalysis}
          onToggle={() => setOpenAnalysis((v) => !v)}
          onActionItemToggle={onActionItemToggle}
          onActionItemClick={onActionItemClick}
          onResponseSelect={onResponseSelect}
          onFollowUpSelect={onFollowUpSelect}
          borderClass={sectionBorderClass('analysis')}
        />
      )}

      {/* CHAPTERS SECTION */}
      {hasChapters && chapters && (
        <ChaptersSection
          chapters={chapters}
          currentTime={currentTime}
          onSeek={onSeek}
          isOpen={openChapters}
          onToggle={() => setOpenChapters((v) => !v)}
          isDarkMode={isDarkMode}
          borderClass={sectionBorderClass('chapters')}
        />
      )}

      {/* MEETING NOTES SECTION */}
      {hasMeetingNotes && meetingNotes && (
        <MeetingNotesSection
          notes={meetingNotes}
          isOpen={openMeetingNotes}
          onToggle={() => setOpenMeetingNotes((v) => !v)}
          onArchive={onArchive}
          onCopy={onCopy}
          isDarkMode={isDarkMode}
          borderClass={sectionBorderClass('meetingNotes')}
        />
      )}
    </div>
  );
};

// ============================================
// ANALYSIS SECTION (per-message AI analysis)
// ============================================

interface AnalysisSectionProps {
  analysis: VoxAnalysis;
  isOpen: boolean;
  onToggle: () => void;
  onActionItemToggle?: (itemId: string) => void;
  onActionItemClick?: (item: ActionItem) => void;
  onResponseSelect?: (response: SuggestedResponse) => void;
  onFollowUpSelect?: (followUp: string) => void;
  borderClass: string;
}

const AnalysisSection: React.FC<AnalysisSectionProps> = ({
  analysis,
  isOpen,
  onToggle,
  onActionItemToggle,
  onActionItemClick,
  onResponseSelect,
  onFollowUpSelect,
  borderClass,
}) => {
  const [expandedSubsections, setExpandedSubsections] = useState<Set<string>>(
    new Set(['summary', 'actionItems', 'responses']),
  );

  const toggleSubsection = (key: string) => {
    setExpandedSubsections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sentimentConfig = getSentimentConfig(analysis.sentiment);
  const urgencyConfig = getUrgencyConfig(analysis.urgency);

  const SubHeader: React.FC<{
    icon: string;
    title: string;
    sectionKey: string;
    count?: number;
    color?: string;
  }> = ({ icon, title, sectionKey, count, color = 'text-zinc-700 dark:text-zinc-300' }) => (
    <button
      type="button"
      onClick={() => toggleSubsection(sectionKey)}
      className="w-full flex items-center justify-between py-2 text-left group"
    >
      <div className="flex items-center gap-2">
        <i className={`fa-solid ${icon} text-sm ${color}`} />
        <span className={`text-sm font-semibold ${color}`}>{title}</span>
        {count !== undefined && count > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded">
            {count}
          </span>
        )}
      </div>
      <i
        className={`fa-solid fa-chevron-${expandedSubsections.has(sectionKey) ? 'up' : 'down'} text-xs text-zinc-400 group-hover:text-zinc-600`}
      />
    </button>
  );

  return (
    <section className={borderClass}>
      <SectionHeader
        isOpen={isOpen}
        onToggle={onToggle}
        chipType="ANALYSIS"
        trailing={
          <span className="text-[10px] text-zinc-500">
            {new Date(analysis.analyzedAt).toLocaleTimeString()}
          </span>
        }
      />
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {/* Sentiment & Urgency Badges */}
          <div className="flex gap-2 flex-wrap">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sentimentConfig.bg} ${sentimentConfig.color}`}
            >
              <i className={`fa-solid ${sentimentConfig.icon}`} />
              {sentimentConfig.label}
            </div>
            {analysis.urgency !== 'low' && (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${urgencyConfig.bg} ${urgencyConfig.color}`}
              >
                <i className={`fa-solid ${urgencyConfig.icon}`} />
                {urgencyConfig.label}
              </div>
            )}
            {analysis.emotion && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-500">
                <HeartPulse className="w-3.5 h-3.5" />
                {analysis.emotion}
              </div>
            )}
          </div>

          {/* Subsections (mirroring the original AIAnalysisPanel structure) */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {/* Summary */}
            <div className="py-2">
              <SubHeader icon="fa-align-left" title="Summary" sectionKey="summary" color="text-purple-600" />
              {expandedSubsections.has('summary') && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mt-2 pl-6">
                  {analysis.summary}
                </p>
              )}
            </div>

            {/* Key Points */}
            {analysis.keyPoints.length > 0 && (
              <div className="py-2">
                <SubHeader
                  icon="fa-list-check"
                  title="Key Points"
                  sectionKey="keyPoints"
                  count={analysis.keyPoints.length}
                  color="text-blue-600"
                />
                {expandedSubsections.has('keyPoints') && (
                  <ul className="mt-2 pl-6 space-y-1.5">
                    {analysis.keyPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                        <span className="text-blue-500 mt-1">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Action Items */}
            {analysis.actionItems.length > 0 && (
              <div className="py-2">
                <SubHeader
                  icon="fa-tasks"
                  title="Action Items"
                  sectionKey="actionItems"
                  count={analysis.actionItems.length}
                  color="text-emerald-600"
                />
                {expandedSubsections.has('actionItems') && (
                  <ul className="mt-2 pl-6 space-y-2">
                    {analysis.actionItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start gap-2 group cursor-pointer"
                        onClick={() => onActionItemClick?.(item)}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onActionItemToggle?.(item.id);
                          }}
                          className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center transition ${
                            item.completed
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-zinc-300 dark:border-zinc-600 group-hover:border-emerald-500'
                          }`}
                        >
                          {item.completed && <Check className="w-2 h-2" />}
                        </button>
                        <div className="flex-1">
                          <p
                            className={`text-sm ${
                              item.completed ? 'line-through text-zinc-400' : 'text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            {item.text}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${getPriorityColor(item.priority)}`}
                            >
                              {item.priority}
                            </span>
                            {item.assignedTo && (
                              <span className="text-[9px] text-zinc-400 inline-flex items-center gap-1">
                                <User className="w-2.5 h-2.5" />
                                {item.assignedTo}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Questions */}
            {analysis.questions.length > 0 && (
              <div className="py-2">
                <SubHeader
                  icon="fa-circle-question"
                  title="Questions Asked"
                  sectionKey="questions"
                  count={analysis.questions.length}
                  color="text-amber-600"
                />
                {expandedSubsections.has('questions') && (
                  <ul className="mt-2 pl-6 space-y-1.5">
                    {analysis.questions.map((question, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                        {question}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Suggested Responses */}
            {analysis.suggestedResponses.length > 0 && (
              <div className="py-2">
                <SubHeader
                  icon="fa-reply"
                  title="Suggested Responses"
                  sectionKey="responses"
                  count={analysis.suggestedResponses.length}
                  color="text-pink-600"
                />
                {expandedSubsections.has('responses') && (
                  <div className="mt-2 pl-6 space-y-2">
                    {analysis.suggestedResponses.map((response) => (
                      <button
                        key={response.id}
                        type="button"
                        onClick={() => onResponseSelect?.(response)}
                        className="w-full text-left p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-pink-300 dark:hover:border-pink-700 hover:bg-pink-50 dark:hover:bg-pink-900/10 transition group"
                      >
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-pink-700 dark:group-hover:text-pink-300">
                          "{response.text}"
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 capitalize">
                            {response.tone}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 capitalize">
                            {response.intent}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Follow-up Suggestions */}
            {analysis.suggestedFollowUps.length > 0 && (
              <div className="py-2">
                <SubHeader
                  icon="fa-lightbulb"
                  title="Follow-up Ideas"
                  sectionKey="followups"
                  count={analysis.suggestedFollowUps.length}
                  color="text-cyan-600"
                />
                {expandedSubsections.has('followups') && (
                  <div className="mt-2 pl-6 flex flex-wrap gap-2">
                    {analysis.suggestedFollowUps.map((followUp, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onFollowUpSelect?.(followUp)}
                        className="px-3 py-1.5 text-xs bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 rounded-full hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition"
                      >
                        {followUp}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Topics */}
            {analysis.topics.length > 0 && (
              <div className="py-2">
                <SubHeader icon="fa-tags" title="Topics" sectionKey="topics" count={analysis.topics.length} />
                {expandedSubsections.has('topics') && (
                  <div className="mt-2 pl-6 flex flex-wrap gap-1.5">
                    {analysis.topics.map((topic, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mentions */}
            {(analysis.mentions.people.length > 0 ||
              analysis.mentions.dates.length > 0 ||
              analysis.mentions.locations.length > 0) && (
              <div className="py-2">
                <SubHeader icon="fa-at" title="Mentions" sectionKey="mentions" />
                {expandedSubsections.has('mentions') && (
                  <div className="mt-2 pl-6 space-y-2">
                    {analysis.mentions.people.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">People:</span>
                        {analysis.mentions.people.map((person, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded inline-flex items-center gap-1"
                          >
                            <User className="w-2.5 h-2.5" />
                            {person}
                          </span>
                        ))}
                      </div>
                    )}
                    {analysis.mentions.dates.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">Dates:</span>
                        {analysis.mentions.dates.map((date, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded inline-flex items-center gap-1"
                          >
                            <Calendar className="w-2.5 h-2.5" />
                            {date.text}
                          </span>
                        ))}
                      </div>
                    )}
                    {analysis.mentions.locations.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">Places:</span>
                        {analysis.mentions.locations.map((loc, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded inline-flex items-center gap-1"
                          >
                            <MapPin className="w-2.5 h-2.5" />
                            {loc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-[10px] text-zinc-400 text-center pt-1">
            Analysis took {analysis.processingTime}ms
          </p>
        </div>
      )}
    </section>
  );
};

// ============================================
// CHAPTERS SECTION (timeline navigation)
// ============================================

interface ChaptersSectionProps {
  chapters: Chapter[];
  currentTime: number;
  onSeek?: (time: number) => void;
  isOpen: boolean;
  onToggle: () => void;
  isDarkMode: boolean;
  borderClass: string;
}

const ChaptersSection: React.FC<ChaptersSectionProps> = ({
  chapters,
  currentTime,
  onSeek,
  isOpen,
  onToggle,
  isDarkMode,
  borderClass,
}) => {
  const accentColor = '#f43f5e'; // rose-500 — matches AI provenance chip
  const isClickable = !!onSeek;

  // Determine which chapter is currently active.
  const activeChapterIndex = chapters.findIndex(
    (chapter, index) =>
      currentTime >= chapter.startTime &&
      (index === chapters.length - 1 || currentTime < chapters[index + 1].startTime),
  );

  return (
    <section className={borderClass}>
      <SectionHeader
        isOpen={isOpen}
        onToggle={onToggle}
        chipType="CHAPTERS"
        trailing={
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {chapters.length} {chapters.length === 1 ? 'topic' : 'topics'}
          </span>
        }
      />
      {isOpen && (
        <div className="px-2 pb-3">
          <div className="space-y-1">
            {chapters.map((chapter, index) => {
              const isActive = index === activeChapterIndex;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => onSeek && onSeek(chapter.startTime)}
                  disabled={!isClickable}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    isActive
                      ? isDarkMode
                        ? 'bg-zinc-700'
                        : 'bg-zinc-100'
                      : isClickable
                      ? isDarkMode
                        ? 'hover:bg-zinc-700/50'
                        : 'hover:bg-zinc-100'
                      : ''
                  } ${!isClickable && 'cursor-default'}`}
                  style={
                    isActive
                      ? { borderLeft: `3px solid ${accentColor}`, paddingLeft: '11px' }
                      : {}
                  }
                >
                  <div className="flex items-start gap-3">
                    {/* Chapter Number */}
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        background: isActive ? accentColor : `${accentColor}15`,
                        color: isActive ? 'white' : accentColor,
                      }}
                    >
                      {index + 1}
                    </div>

                    {/* Chapter Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h5
                          className={`text-sm font-semibold ${
                            isActive
                              ? isDarkMode
                                ? 'text-white'
                                : 'text-zinc-900'
                              : isDarkMode
                              ? 'text-zinc-400'
                              : 'text-zinc-600'
                          }`}
                        >
                          {chapter.title}
                        </h5>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Clock className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                            {formatChapterTime(chapter.startTime)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                        {chapter.summary}
                      </p>
                    </div>

                    {/* Play Icon (if clickable) */}
                    {isClickable && (
                      <PlayCircle
                        className={`w-5 h-5 ${
                          isActive ? 'text-zinc-700 dark:text-white' : 'text-zinc-400'
                        } flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity`}
                      />
                    )}
                  </div>

                  {/* Progress Bar */}
                  {isActive && (
                    <div className="mt-2 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          background: accentColor,
                          width: `${
                            ((currentTime - chapter.startTime) /
                              Math.max(chapter.endTime - chapter.startTime, 1)) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {onSeek && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center pt-2">
              Click any chapter to jump to that section
            </p>
          )}
        </div>
      )}
    </section>
  );
};

// ============================================
// MEETING NOTES SECTION
// ============================================

interface MeetingNotesSectionProps {
  notes: MeetingNotes;
  isOpen: boolean;
  onToggle: () => void;
  onArchive?: () => Promise<void>;
  onCopy?: () => void;
  isDarkMode: boolean;
  borderClass: string;
}

const MeetingNotesSection: React.FC<MeetingNotesSectionProps> = ({
  notes,
  isOpen,
  onToggle,
  onArchive,
  onCopy,
  borderClass,
}) => {
  const [isArchiving, setIsArchiving] = useState(false);
  const [archived, setArchived] = useState(false);
  const [copied, setCopied] = useState(false);
  const accentColor = '#f43f5e'; // rose-500

  const handleArchive = async () => {
    if (!onArchive || isArchiving || archived) return;
    setIsArchiving(true);
    try {
      await onArchive();
      setArchived(true);
      setTimeout(() => setArchived(false), 3000);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleCopy = () => {
    if (onCopy) {
      onCopy();
    } else {
      const lines: string[] = [
        `# ${notes.title}`,
        `Date: ${notes.date}`,
        `Participants: ${notes.participants.join(', ')}`,
        '',
        '## Summary',
        notes.summary,
        '',
      ];
      if (notes.keyDecisions.length > 0) {
        lines.push('## Key Decisions');
        notes.keyDecisions.forEach((d, i) => lines.push(`${i + 1}. ${d}`));
        lines.push('');
      }
      if (notes.actionItems.length > 0) {
        lines.push('## Action Items');
        notes.actionItems.forEach((item) => {
          let line = `- [ ] ${item.task}`;
          if (item.assignee) line += ` (${item.assignee})`;
          if (item.dueDate) line += ` — due ${item.dueDate}`;
          lines.push(line);
        });
        lines.push('');
      }
      if (notes.nextSteps.length > 0) {
        lines.push('## Next Steps');
        notes.nextSteps.forEach((s) => lines.push(`- ${s}`));
      }
      navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className={borderClass}>
      <SectionHeader isOpen={isOpen} onToggle={onToggle} chipType="MEETING NOTES" />
      {isOpen && (
        <div className="px-4 pb-4 space-y-5">
          {/* Title + metadata row (folded inline since chip already labels the section) */}
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-1">
              {notes.title}
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{notes.date}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {notes.participants.join(', ')}
                </span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono mb-2 text-zinc-500 dark:text-zinc-400">
              Summary
            </h4>
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {notes.summary}
            </p>
          </div>

          {/* Key Decisions */}
          {notes.keyDecisions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4" style={{ color: accentColor }} />
                <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-500 dark:text-zinc-400">
                  Key Decisions
                </h4>
              </div>
              <ul className="space-y-2.5">
                {notes.keyDecisions.map((decision, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: `${accentColor}20`, color: accentColor }}
                    >
                      {index + 1}
                    </div>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">
                      {decision}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items */}
          {notes.actionItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckSquare className="w-4 h-4" style={{ color: accentColor }} />
                <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-500 dark:text-zinc-400">
                  Action Items
                </h4>
              </div>
              <div className="space-y-2">
                {notes.actionItems.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ borderColor: accentColor }}
                      />
                      <div className="flex-1">
                        <p className="text-sm text-zinc-900 dark:text-white">{item.task}</p>
                        {(item.assignee || item.dueDate) && (
                          <div className="flex items-center gap-3 mt-1.5">
                            {item.assignee && (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                👤 {item.assignee}
                              </span>
                            )}
                            {item.dueDate && (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                📅 {item.dueDate}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Steps */}
          {notes.nextSteps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4" style={{ color: accentColor }} />
                <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-500 dark:text-zinc-400">
                  Next Steps
                </h4>
              </div>
              <ul className="space-y-2">
                {notes.nextSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: accentColor }}
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-zinc-200 dark:border-zinc-800">
            {/* Archive — primary */}
            {onArchive && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={isArchiving || archived}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-70"
                style={{
                  background: archived
                    ? '#22c55e'
                    : `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                  boxShadow: archived
                    ? '0 2px 8px rgba(34,197,94,0.3)'
                    : `0 2px 8px ${accentColor}30`,
                }}
                title="Save to Pulse Archives"
              >
                {isArchiving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : archived ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Archive className="w-4 h-4" />
                )}
                {isArchiving ? 'Archiving…' : archived ? 'Archived!' : 'Archive to Pulse'}
              </button>
            )}

            {/* Copy — secondary */}
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
              style={{ color: copied ? '#22c55e' : undefined }}
              title="Copy notes as plain text"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>

            <div className="flex-1" />

            {/* Stats */}
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {notes.actionItems.length > 0 &&
                `${notes.actionItems.length} action${notes.actionItems.length !== 1 ? 's' : ''}`}
              {notes.actionItems.length > 0 && notes.keyDecisions.length > 0 && ' · '}
              {notes.keyDecisions.length > 0 &&
                `${notes.keyDecisions.length} decision${notes.keyDecisions.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
      )}
    </section>
  );
};

export default MessageAIPanel;
