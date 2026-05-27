// Glimpse Component - Full-Featured Video Messaging
// Includes: Recording, Conversations, AI Transcripts, Reactions, Threading, Search

import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  FlipHorizontal,
  Send,
  Trash2,
  RotateCcw,
  AlertCircle,
  Video,
  MessageSquare,
  Search,
  Bookmark,
  Download,
  MoreVertical,
  Reply,
  Heart,
  ThumbsUp,
  Laugh,
  Frown,
  Flame,
  X,
  ChevronDown,
  FileText,
  Play,
  Pause,
  Clock,
  Users,
  Loader2,
  Check,
  CheckCheck,
  Eye,
  Square,
  TrendingUp,
  HelpCircle,
  MonitorPlay,
  Edit3,
  Sparkles,
  List,
} from 'lucide-react';
import { useGlimpseRecording } from '../../hooks/useGlimpseRecording';
import {
  useGlimpseConversations,
  useGlimpseMessages,
  useGlimpseSend,
  useGlimpseSearch,
} from '../../hooks/useGlimpse';
import { glimpseService } from '../../services/glimpse/glimpseService';
import { voxModeService } from '../../services/relay/voxModeService';
import { type GlimpseMessage, type GlimpseConversation } from '../../services/glimpse/glimpseTypes';
import type { PulseUser } from '../../services/relay/voxModeTypes';
import './Glimpse.css';

// Phase 2: Selection Mode
import { useVoxSelection, VoxSelectionItem } from '../../hooks/useVoxSelection';
import { VoxSelectToolbar } from '../Relay/VoxSelectToolbar';
import VoxMessageMenu from '../Relay/VoxMessageMenu';
import VoxDownloadModal from '../Relay/VoxDownloadModal';
import { archiveRelayConversation } from '../../services/relay/relayArchiveService';

// Phase 5: AI Enhancements
import { MessageAIPanel, VoxSmartReplies } from '../Relay/index';
import { summarizeConversation, generateSmartReplies, generateReplyDraft } from '../../services/relay/relayAIService';
import type { ConversationSummary, SmartReply, ReplyDraft } from '../../services/relay/relayAIService';
import { GlimpseReplyDraftPanel } from './GlimpseReplyDraftPanel';

// Phase 6: Final Polish
import { useRelayKeyboardShortcuts } from '../../hooks/useRelayKeyboardShortcuts';
import { VoxKeyboardShortcutsHelp } from '../Relay/VoxKeyboardShortcutsHelp';
import { usePlaybackSpeed, type PlaybackSpeed } from '../../hooks/usePlaybackSpeed';
import { PlaybackSpeedControl } from '../Relay/PlaybackSpeedControl';
import { VoxEmptyState } from '../Relay/VoxEmptyState';
import { getEmptyStateConfig } from '../Relay/voxEmptyStates';
import toast from 'react-hot-toast';

// ============================================
// TYPES
// ============================================

// Mode color (Glimpse — coral). Single source of state/signal in Pulse.
const MODE_COLOR = '#f43f5e';

// localStorage memory for last-used recipient set. Versioned so future schema
// shifts (e.g. moving to a server-side jsonb column) won't replay stale shapes.
const RECIPIENT_MEMORY_PREFIX = 'glimpse:lastRecipients:v1:';

const readLastRecipients = (userId: string): string[] => {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(RECIPIENT_MEMORY_PREFIX + userId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

const writeLastRecipients = (userId: string, ids: string[]): void => {
  if (!userId) return;
  try {
    localStorage.setItem(RECIPIENT_MEMORY_PREFIX + userId, JSON.stringify(ids));
  } catch {
    // Quota / private mode — silent; recipient memory is best-effort.
  }
};

interface GlimpseProps {
  isDarkMode?: boolean;
  onClose?: () => void;
  maxDuration?: number;
  initialRecipientId?: string;
  initialRecipientName?: string;
  contacts?: Array<{ id: string; name: string; avatarColor?: string; handle?: string }>;
  apiKey?: string;
}

type ViewMode = 'conversations' | 'chat' | 'record' | 'search';

// ============================================
// EMOJI REACTIONS
// ============================================

const REACTION_EMOJIS = [
  { emoji: '❤️', icon: Heart, label: 'Love' },
  { emoji: '👍', icon: ThumbsUp, label: 'Like' },
  { emoji: '😂', icon: Laugh, label: 'Haha' },
  { emoji: '😢', icon: Frown, label: 'Sad' },
  { emoji: '🔥', icon: Flame, label: 'Fire' },
];

// ============================================
// SUB-COMPONENTS
// ============================================

// Triage Cockpit row — information-dense conversation entry with AI summary
// peek, action-count pill, and mono duration/timestamp. Replaces the previous
// SMS-style ConversationItem (Direction 01, 2026-05-20).
const ConversationItem: React.FC<{
  conversation: GlimpseConversation;
  currentUserId: string;
  onClick: () => void;
  isDarkMode: boolean;
}> = ({ conversation, currentUserId, onClick, isDarkMode }) => {
  const otherParticipants = conversation.participants.filter(p => p.id !== currentUserId);
  const displayName = conversation.title ||
    otherParticipants.map(p => p.name).join(', ') ||
    'Video Chat';

  const isUnread = (conversation.unreadCount ?? 0) > 0;
  const isGroup = otherParticipants.length > 1;
  const kindLabel = isGroup ? 'Group' : 'Glimpse';

  const processing =
    conversation.lastMessageProcessingStatus === 'pending' ||
    conversation.lastMessageProcessingStatus === 'transcribing';
  const hasSummary = !!conversation.lastMessageSummary;
  const actionCount = conversation.lastMessageActionCount ?? 0;

  // Summary text fallback chain: AI summary → caption → duration hint → empty.
  const summary =
    conversation.lastMessageSummary ||
    conversation.lastMessageCaption ||
    (conversation.lastMessageDuration
      ? `${formatDuration(conversation.lastMessageDuration)} ${isGroup ? 'group ' : ''}glimpse`
      : '');

  // Neutral avatar fallback — no cyan, surface-soft tinted neutral.
  const firstAvatar = otherParticipants[0];
  const fallbackInitials = isGroup
    ? `+${otherParticipants.length}`
    : (firstAvatar?.name?.[0] || '?').toUpperCase();

  // Build an aria-label that mirrors what sighted users see at a glance:
  // unread weight, action count, AI status, sender, kind, duration, and a
  // peek of the summary. Without these, AT users get a strictly worse inbox.
  const ariaParts = [
    isUnread && 'Unread',
    actionCount > 0 && `${actionCount} action ${actionCount === 1 ? 'item' : 'items'}`,
    processing && !hasSummary && 'AI transcribing',
    displayName,
    isGroup && 'group',
    conversation.lastMessageDuration && formatDuration(conversation.lastMessageDuration),
    conversation.lastMessageSummary && `Summary: ${conversation.lastMessageSummary}`,
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`gl-tc-row ${isDarkMode ? 'dark' : 'light'}`}
      data-unread={isUnread || undefined}
      aria-label={ariaParts.join(' · ')}
    >
      <div className="gl-tc-avatar">
        {firstAvatar?.avatarUrl ? (
          <img src={firstAvatar.avatarUrl} alt="" />
        ) : (
          <span className="gl-tc-avatar-fallback">{fallbackInitials}</span>
        )}
      </div>

      <div className="gl-tc-signal">
        <div className="gl-tc-from">
          {isUnread && <span className="gl-tc-unread-dot" aria-hidden="true" />}
          <span className="gl-tc-from-name">{displayName}</span>
          {/* Kind suffix only earns its place when it differentiates from the
              default 1:1 glimpse — otherwise it's reading noise on every row. */}
          {isGroup && <span className="gl-tc-kind">· {kindLabel}</span>}
        </div>
        {processing && !hasSummary ? (
          <div className="gl-tc-summary-skeleton" aria-hidden="true">
            <span /><span />
          </div>
        ) : summary ? (
          <p className="gl-tc-summary">{summary}</p>
        ) : (
          <p className="gl-tc-summary gl-tc-summary-empty">No glimpses yet</p>
        )}
      </div>

      <div className="gl-tc-actions">
        {actionCount > 0 && (
          <span className="gl-tc-action-pill">
            {actionCount} {actionCount === 1 ? 'Action' : 'Actions'}
          </span>
        )}
        {hasSummary && (
          // Muted in triage rows: the summary IS the AI signal — a coral chip
          // here just doubles the attention hit and busts the row's coral
          // budget. Provenance stays via the leading-dot pattern + label.
          <span className="gl-ai-chip muted gl-tc-ai-chip">Claude</span>
        )}
        {processing && !hasSummary && (
          // Pending state stays loud: this is signaling active work in
          // progress, which IS earned attention.
          <span className="gl-ai-chip pending gl-tc-ai-chip">Transcribing</span>
        )}
        {/* Absence of action items is inferred from absence of pill — no need
            to surface a "No actions" negative-signal label. */}
      </div>

      <div className="gl-tc-duration">
        {conversation.lastMessageDuration
          ? formatDuration(conversation.lastMessageDuration)
          : '·'}
      </div>

      <div className="gl-tc-when">
        {conversation.lastMessageAt
          ? formatRelativeTime(conversation.lastMessageAt)
          : 'NEW'}
      </div>
    </button>
  );
};

// Reel poster card — the inbox grid unit that replaces the Triage Cockpit
// table row (redesign 2026-05-27, Path D). Real thumbnail with a deterministic
// gradient fallback, unread bead, sender, duration, 2-line AI summary, muted
// provenance chip + coral action pill. One coral attention-hit per card.
// NOTE: ConversationItem above + the .gl-tc-* table styles are retained until
// the Reel grid is visually verified, per the redesign plan.
const ReelCard: React.FC<{
  conversation: GlimpseConversation;
  currentUserId: string;
  onClick: () => void;
}> = ({ conversation, currentUserId, onClick }) => {
  const otherParticipants = conversation.participants.filter(p => p.id !== currentUserId);
  const displayName = conversation.title ||
    otherParticipants.map(p => p.name).join(', ') ||
    'Video Chat';

  const isUnread = (conversation.unreadCount ?? 0) > 0;
  const isGroup = otherParticipants.length > 1;
  const processing =
    conversation.lastMessageProcessingStatus === 'pending' ||
    conversation.lastMessageProcessingStatus === 'transcribing';
  const hasSummary = !!conversation.lastMessageSummary;
  const actionCount = conversation.lastMessageActionCount ?? 0;

  // Same fallback chain as the old triage row: AI summary → caption → duration.
  const summary =
    conversation.lastMessageSummary ||
    conversation.lastMessageCaption ||
    (conversation.lastMessageDuration
      ? `${formatDuration(conversation.lastMessageDuration)} ${isGroup ? 'group ' : ''}glimpse`
      : 'No glimpses yet');

  const firstAvatar = otherParticipants[0];
  const fallbackInitials = isGroup
    ? `+${otherParticipants.length}`
    : (firstAvatar?.name?.[0] || '?').toUpperCase();
  const thumb = conversation.lastMessageThumbnail;

  // Mirror the old row's aria-label so AT users keep the same at-a-glance read.
  const ariaParts = [
    isUnread && 'Unread',
    actionCount > 0 && `${actionCount} action ${actionCount === 1 ? 'item' : 'items'}`,
    processing && !hasSummary && 'AI transcribing',
    displayName,
    isGroup && 'group',
    conversation.lastMessageDuration && formatDuration(conversation.lastMessageDuration),
    conversation.lastMessageSummary && `Summary: ${conversation.lastMessageSummary}`,
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onClick}
      className="gl-reel-card"
      data-unread={isUnread || undefined}
      aria-label={ariaParts.join(' · ')}
    >
      <div
        className="gl-reel-poster"
        style={thumb ? undefined : { backgroundImage: posterGradient(conversation.id) }}
      >
        {thumb && <img src={thumb} alt="" />}
        <span className="gl-reel-poster-play" aria-hidden="true">
          <Play className="w-4 h-4" />
        </span>
        {isGroup && (
          <span className="gl-reel-poster-badge">
            <Users className="w-3 h-3" />
            Group
          </span>
        )}
        {conversation.lastMessageDuration ? (
          <span className="gl-reel-poster-dur">
            {formatDuration(conversation.lastMessageDuration)}
          </span>
        ) : null}
        {isUnread && <span className="gl-reel-bead" aria-hidden="true" />}
      </div>

      <div className="gl-reel-body">
        <div className="gl-reel-from">
          <span
            className="gl-reel-avatar"
            style={firstAvatar?.avatarColor ? { background: firstAvatar.avatarColor } : undefined}
            aria-hidden="true"
          >
            {firstAvatar?.avatarUrl ? <img src={firstAvatar.avatarUrl} alt="" /> : fallbackInitials}
          </span>
          <span className="gl-reel-name">{displayName}</span>
          <span className="gl-reel-when">
            {conversation.lastMessageAt ? formatRelativeTime(conversation.lastMessageAt) : 'NEW'}
          </span>
        </div>

        {processing && !hasSummary ? (
          <span className="gl-ai-chip pending gl-tc-ai-chip">Transcribing</span>
        ) : (
          <p className="gl-reel-summary">{summary}</p>
        )}

        <div className="gl-reel-tags">
          {hasSummary && <span className="gl-ai-chip muted gl-tc-ai-chip">Claude</span>}
          {actionCount > 0 && (
            <span className="gl-tc-action-pill">
              {actionCount} {actionCount === 1 ? 'Action' : 'Actions'}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

// Tier-1 deterministic inbox briefing. Everything here is TEMPLATED from
// counts already on GlimpseConversation — not an LLM synthesis, so there is no
// fabricated prose. The coral border is earned: this is the inbox's AI-signal
// surface. A flagged Tier-2 "Claude watched your inbox" synthesis (a Supabase
// edge function, server-side only) is a separate follow-up; Tier 1 is the
// always-on, honest fallback.
const GlimpseBriefingCard: React.FC<{
  conversations: GlimpseConversation[];
  totalUnread: number;
  currentUserId: string;
  onOpen: (conversation: GlimpseConversation) => void;
}> = ({ conversations, totalUnread, currentUserId, onOpen }) => {
  const total = conversations.length;
  const needs = conversations.filter(
    c => (c.unreadCount ?? 0) > 0 || (c.lastMessageActionCount ?? 0) > 0
  );
  const actionTotal = conversations.reduce(
    (sum, c) => sum + (c.lastMessageActionCount ?? 0), 0
  );
  const processingCount = conversations.filter(
    c => c.lastMessageProcessingStatus === 'pending' ||
         c.lastMessageProcessingStatus === 'transcribing'
  ).length;

  const nameOf = (c: GlimpseConversation) => {
    const others = c.participants.filter(p => p.id !== currentUserId);
    return c.title || others.map(p => p.name).join(', ') || 'Video Chat';
  };

  // Templated digest — strictly from data. If it can't be stated from the
  // counts, it isn't printed.
  let digest: string;
  if (needs.length === 0) {
    digest = `You're all caught up — ${total} ${total === 1 ? 'glimpse' : 'glimpses'}, nothing needs you right now.`;
  } else {
    let s = `${needs.length} of ${total} ${total === 1 ? 'glimpse needs' : 'glimpses need'} you`;
    if (actionTotal > 0) {
      s += `, with ${actionTotal} action ${actionTotal === 1 ? 'item' : 'items'} to clear`;
    }
    s += processingCount > 0 ? `. ${processingCount} still transcribing.` : '.';
    digest = s;
  }

  return (
    <section className="gl-briefing" aria-label="Glimpse briefing">
      <header className="gl-briefing-head">
        <span className="gl-briefing-icon" aria-hidden="true">
          <Sparkles className="w-4 h-4" />
        </span>
        <div className="gl-briefing-titles">
          <span className="gl-briefing-title">Your Glimpse briefing</span>
          <span className="gl-briefing-sub">
            {total} {total === 1 ? 'SIGNAL' : 'SIGNALS'} · {needs.length} NEED YOU
          </span>
        </div>
        {totalUnread > 0 && (
          <span className="gl-briefing-meta">{totalUnread} unread</span>
        )}
      </header>

      <p className="gl-briefing-line">{digest}</p>

      {needs.length > 0 && (
        <div className="gl-briefing-needs">
          <span className="gl-label">Needs you</span>
          <div className="gl-briefing-need-list">
            {needs.slice(0, 6).map(c => {
              const ac = c.lastMessageActionCount ?? 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  className="gl-briefing-need"
                  onClick={() => onOpen(c)}
                >
                  {(c.unreadCount ?? 0) > 0 && (
                    <span className="gl-briefing-need-dot" aria-hidden="true" />
                  )}
                  <span className="gl-briefing-need-name">{nameOf(c)}</span>
                  {ac > 0 && <span className="gl-briefing-need-pill">{ac}</span>}
                </button>
              );
            })}
            {needs.length > 6 && (
              <span className="gl-briefing-need-more">+{needs.length - 6} more</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

// Extracted-tasks rail — sits beside the stacked cockpit thread (Path D).
// TASKS are a real, deduped roll-up of every message's actionItems, tappable
// to convert into a Pulse task (with ✓ converted state via convertedActionItems).
// DECISIONS are only real after the user runs Summarize (reads
// ConversationSummary.keyDecisions); before that, a quiet CTA — never an empty
// coral block. No LLM call fires on thread open.
type RailTask = { text: string; message: GlimpseMessage };
const GlimpseTaskRail: React.FC<{
  tasks: RailTask[];
  convertedActionItems: Map<string, Set<string>>;
  onAddTask: (message: GlimpseMessage, text: string) => Promise<'created' | 'already-exists' | 'failed'>;
  decisions?: string[];
  hasSummary: boolean;
  isSummarizing: boolean;
  onRunSummary: () => void;
  onReply: () => void;
  open: boolean;
}> = ({
  tasks,
  convertedActionItems,
  onAddTask,
  decisions,
  hasSummary,
  isSummarizing,
  onRunSummary,
  onReply,
  open,
}) => {
  const handleAdd = async (t: RailTask) => {
    const status = await onAddTask(t.message, t.text);
    if (status === 'created') toast.success('Added to tasks');
    else if (status === 'already-exists') toast('Already in tasks');
    else toast.error('Could not add to tasks');
  };

  return (
    <aside
      id="gl-thread-rail"
      className="gl-thread-rail"
      data-open={open}
      aria-label="Extracted tasks and decisions"
    >
      <span className="gl-label gl-rail-eyebrow">Extracted</span>

      <div className="gl-rail-group">
        <div className="gl-rail-heading">Tasks</div>
        {tasks.length === 0 ? (
          <p className="gl-rail-empty">No action items extracted yet.</p>
        ) : (
          <ul className="gl-rail-list">
            {tasks.map((t, i) => {
              const converted = !!convertedActionItems.get(t.message.id)?.has(t.text.trim());
              return (
                <li key={i}>
                  <button
                    type="button"
                    className={`gl-rail-task ${converted ? 'converted' : ''}`}
                    onClick={() => handleAdd(t)}
                    aria-pressed={converted}
                    title={converted ? 'Already in tasks' : 'Add to Pulse tasks'}
                  >
                    {converted ? (
                      <Check className="gl-rail-task-icon" />
                    ) : (
                      <Square className="gl-rail-task-icon" />
                    )}
                    <span>{t.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="gl-rail-group">
        <div className="gl-rail-heading">Decisions</div>
        {!hasSummary ? (
          <button
            type="button"
            className="gl-rail-cta"
            onClick={onRunSummary}
            disabled={isSummarizing}
          >
            {isSummarizing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isSummarizing ? 'Summarizing…' : 'Run summary to extract decisions'}
          </button>
        ) : decisions && decisions.length > 0 ? (
          <ul className="gl-rail-list">
            {decisions.map((d, i) => (
              <li key={i} className="gl-rail-decision">
                <span className="gl-rail-decision-dot" aria-hidden="true" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="gl-rail-empty">No decisions found in this conversation.</p>
        )}
      </div>

      <button type="button" className="gl-rail-reply" onClick={onReply}>
        <Video className="w-3.5 h-3.5" />
        Reply
      </button>
    </aside>
  );
};

// Glimpse Card — transcript-first
const MessageBubble: React.FC<{
  message: GlimpseMessage;
  isOwn: boolean;
  isDarkMode: boolean;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  onBookmark: () => void;
  onTranscriptClick: (timestamp: number) => void;
  showTranscript: boolean;
  onToggleTranscript: () => void;
  onShowMenu?: (anchorRect: DOMRect) => void;
  isBookmarked?: boolean;
  /** Set of action-item texts already converted to Pulse tasks. */
  convertedActionItems?: Set<string>;
  /** Convert an action item to a Pulse task; updates parent state. */
  onAddAsTask?: (actionItem: string) => Promise<'created' | 'already-exists' | 'failed'>;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  playbackSpeed?: PlaybackSpeed;
  onPlaybackSpeedChange?: (speed: PlaybackSpeed) => void;
}> = ({
  message,
  isOwn,
  onReaction,
  onReply,
  onBookmark,
  onShowMenu,
  isBookmarked = false,
  convertedActionItems,
  onAddAsTask,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection,
  playbackSpeed = 1.0,
  onPlaybackSpeedChange,
  isDarkMode,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const totalReactions = Object.values(message.reactions || {}).reduce(
    (sum, users) => sum + users.length,
    0
  );

  const isProcessing =
    message.processingStatus === 'pending' ||
    message.processingStatus === 'transcribing';
  const processingFailed = message.processingStatus === 'failed';
  const hasSummary = !!message.summary;
  const actionItems = message.actionItems || [];
  const topics = message.topics || [];

  const cardState = isProcessing
    ? 'processing'
    : processingFailed
      ? 'failed'
      : 'ready';

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed, showPlayer]);

  const handleConvertAction = async (item: string) => {
    if (!onAddAsTask) {
      // Fallback: copy to clipboard if no task wiring is available
      navigator.clipboard.writeText(item).catch(() => {});
      toast.success('Action copied to clipboard.');
      return;
    }
    const status = await onAddAsTask(item);
    if (status === 'created') toast.success('Added to tasks');
    else if (status === 'already-exists') toast('Already in tasks');
    else toast.error('Could not add to tasks');
  };

  return (
    <article className="gl-card" data-own={isOwn} data-state={cardState}>
      {/* Selection checkbox */}
      {isSelectionMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelection?.();
          }}
          className="gl-secondary-btn"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 5,
            background: isSelected ? MODE_COLOR : undefined,
            color: isSelected ? '#fafafa' : undefined,
            borderColor: isSelected ? MODE_COLOR : undefined,
          }}
          aria-pressed={isSelected}
          aria-label={isSelected ? 'Deselect message' : 'Select message'}
          title={isSelected ? 'Deselect' : 'Select'}
        >
          {isSelected ? <Check className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        </button>
      )}

      {/* Meta row */}
      <header className="gl-card-meta">
        <div className="left">
          <span className={`gl-sender ${!isOwn && message.status !== 'viewed' ? 'unread' : ''}`}>
            {isOwn ? 'You' : message.senderName} · GLIMPSE
          </span>
        </div>
        <div className="right">
          <span className="duration">{formatDuration(message.duration)}</span>
          {actionItems.length > 0 && (
            <span className="gl-label dim">·</span>
          )}
          {actionItems.length > 0 && (
            <span className="actions-count">
              {actionItems.length} ACTION {actionItems.length === 1 ? 'ITEM' : 'ITEMS'}
            </span>
          )}
          {onShowMenu && (
            <button
              type="button"
              className="gl-menu-btn"
              onClick={(e) => {
                e.stopPropagation();
                onShowMenu(e.currentTarget.getBoundingClientRect());
              }}
              aria-label="More actions"
              title="More actions"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Reply context */}
      {message.replyToId && message.quotedText && (
        <div className="gl-reply-context">
          <Reply className="w-3 h-3" />
          <span>{message.quotedText.substring(0, 80)}{message.quotedText.length > 80 ? '…' : ''}</span>
        </div>
      )}

      {/* Summary block — the headline. Provenance chip celebrates AI success;
          processing shows a soft pending state; failure demotes to a ghost row
          so a broken AI doesn't dominate the card. Caption now lives INSIDE
          the summary block (when both exist) so the card has one content
          spine instead of two parallel paragraphs. */}
      {(hasSummary || isProcessing) && (
        <div className="gl-summary">
          {hasSummary && (
            <>
              <span className="gl-ai-chip">CLAUDE · SUMMARY</span>
              <p className="gl-summary-text">{message.summary}</p>
              {message.caption && (
                <p className="gl-card-caption">“{message.caption}”</p>
              )}
            </>
          )}
          {isProcessing && !hasSummary && (
            <>
              <span className="gl-ai-chip pending">PULSE AI · TRANSCRIBING</span>
              <div className="gl-summary-skeleton" aria-hidden="true">
                <span /><span /><span />
              </div>
            </>
          )}
        </div>
      )}

      {/* Standalone caption — only when there's no AI summary block to host it. */}
      {message.caption && !hasSummary && !isProcessing && (
        <p className="gl-summary-text">{message.caption}</p>
      )}

      {/* AI failure: a quiet ghost row, not a screaming chip */}
      {processingFailed && !hasSummary && (
        <p className="gl-transcript-fail">transcript unavailable</p>
      )}

      {/* Action items — tap a row to convert it into a Pulse task. Converted
          items render with a check + dimmed text to show the work is done. */}
      {actionItems.length > 0 && (
        <ul className="gl-actions" aria-label="Extracted action items">
          {actionItems.map((item, i) => {
            const isConverted = !!convertedActionItems?.has(item.trim());
            return (
              <li key={i}>
                <button
                  type="button"
                  className={`gl-action-btn ${isConverted ? 'converted' : ''}`}
                  onClick={() => handleConvertAction(item)}
                  title={isConverted ? 'Already in tasks' : 'Add to Pulse tasks'}
                  aria-pressed={isConverted}
                >
                  {item}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Inline player */}
      {showPlayer && (
        <div className="gl-player">
          <video
            ref={videoRef}
            src={message.videoUrl}
            poster={message.thumbnailUrl}
            className="vvb-message-video"
            controls
            autoPlay
            playsInline
          />
        </div>
      )}

      {/* Proof row: thumb + actions */}
      <div className="gl-proof-row">
        <button
          type="button"
          className="gl-thumb"
          onClick={() => setShowPlayer((v) => !v)}
          aria-label={showPlayer ? 'Hide video' : 'Watch video'}
        >
          {message.thumbnailUrl && <img src={message.thumbnailUrl} alt="" />}
          <span className="gl-thumb-overlay">
            {showPlayer ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </span>
          <span className="gl-thumb-duration">{formatDuration(message.duration)}</span>
        </button>

        <div className="gl-quick-actions">
          <button
            type="button"
            className={`gl-action-pill ${showPlayer ? 'primary' : ''}`}
            onClick={() => setShowPlayer((v) => !v)}
          >
            {showPlayer ? <Pause className="icon" /> : <Play className="icon" />}
            <span>{showPlayer ? 'Hide' : 'Watch'}</span>
          </button>
          <button type="button" className="gl-action-pill" onClick={onReply}>
            <Reply className="icon" />
            <span>Reply</span>
          </button>
          <button
            type="button"
            className={`gl-action-pill ${isBookmarked ? 'bookmarked' : ''}`}
            onClick={onBookmark}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this glimpse'}
            aria-pressed={isBookmarked}
          >
            <Bookmark
              className="icon"
              fill={isBookmarked ? 'currentColor' : 'none'}
            />
          </button>
          {onPlaybackSpeedChange && showPlayer && (
            <PlaybackSpeedControl
              speed={playbackSpeed}
              onSpeedChange={onPlaybackSpeedChange}
              compact
              isDarkMode={isDarkMode}
            />
          )}
        </div>
      </div>

      {/* Full transcript (collapsed by default). Topics ride along inside the
          disclosure — they're metadata, not signal, and they don't earn a
          peer content block at rest. */}
      {(message.transcript || topics.length > 0) && (
        <details className="gl-transcript">
          <summary>
            Full transcript
            {topics.length > 0 && (
              <span className="gl-label dim" style={{ marginLeft: 8 }}>
                · {topics.length} {topics.length === 1 ? 'topic' : 'topics'}
              </span>
            )}
          </summary>
          {topics.length > 0 && (
            <div className="gl-topics">
              {topics.slice(0, 6).map((topic, i) => (
                <span key={i} className="gl-topic">{topic}</span>
              ))}
            </div>
          )}
          {message.transcript && <p>{message.transcript}</p>}
        </details>
      )}

      {/* Footer */}
      <footer className="gl-card-footer">
        <div className="gl-footer-left">
          <span className="gl-time">{formatTime(message.createdAt)}</span>
          {isOwn && (
            <span className={`gl-status-icon ${message.status === 'viewed' ? 'viewed' : ''}`}>
              {message.status === 'viewed' ? (
                <Eye className="w-3 h-3" />
              ) : message.status === 'delivered' ? (
                <CheckCheck className="w-3 h-3" />
              ) : (
                <Check className="w-3 h-3" />
              )}
            </span>
          )}
          {message.threadCount > 0 && (
            <span className="gl-label dim">
              {message.threadCount} {message.threadCount === 1 ? 'REPLY' : 'REPLIES'}
            </span>
          )}
        </div>
        <div className="gl-footer-right">
          {totalReactions > 0 && (
            <div className="gl-reactions">
              {Object.entries(message.reactions || {}).slice(0, 3).map(([emoji, users]) => (
                <button
                  key={emoji}
                  type="button"
                  className="gl-reaction"
                  onClick={() => onReaction(emoji)}
                >
                  <span>{emoji}</span>
                  <span className="count">{users.length}</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="gl-reaction-add"
              onClick={() => setShowReactionPicker((v) => !v)}
              aria-label="Add reaction"
              title="Add reaction"
            >
              <Heart className="w-3 h-3" />
            </button>
            {showReactionPicker && (
              <div
                className="gl-reaction-picker"
                style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, zIndex: 10 }}
              >
                {REACTION_EMOJIS.map(({ emoji, label }) => (
                  <button
                    key={emoji}
                    type="button"
                    className="gl-reaction-pick-btn"
                    onClick={() => {
                      onReaction(emoji);
                      setShowReactionPicker(false);
                    }}
                    title={label}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </footer>
    </article>
  );
};

// Recipient Selector
const RecipientSelector: React.FC<{
  contacts: Array<{ id: string; name: string; avatarColor?: string; handle?: string }>;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onDone?: () => void;
  isDarkMode: boolean;
}> = ({ contacts, selectedIds, onSelect, onDone, isDarkMode }) => {
  const [search, setSearch] = useState('');

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.handle?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`vvb-recipient-selector ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="vvb-recipient-header">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts..."
          className="vvb-recipient-search"
        />
        {onDone && (
          <button
            onClick={onDone}
            disabled={selectedIds.length === 0}
            className="vvb-recipient-done"
          >
            <Check className="w-4 h-4" />
            {selectedIds.length > 0 ? `Done (${selectedIds.length})` : 'Done'}
          </button>
        )}
      </div>

      <div className="vvb-recipient-list">
        {filtered.map(contact => (
          <button
            key={contact.id}
            onClick={() => onSelect(contact.id)}
            className={`vvb-recipient-item ${selectedIds.includes(contact.id) ? 'selected' : ''}`}
          >
            <div
              className="vvb-recipient-avatar"
              style={contact.avatarColor ? { background: contact.avatarColor } : undefined}
              data-fallback={contact.avatarColor ? undefined : true}
            >
              {contact.name[0]}
            </div>
            <div className="vvb-recipient-info">
              <span className="vvb-recipient-name">{contact.name}</span>
              {contact.handle && (
                <span className="vvb-recipient-handle">@{contact.handle}</span>
              )}
            </div>
            {selectedIds.includes(contact.id) && (
              <Check className="w-4 h-4 text-green-400" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

// Persistent Glimpse section header (Path D). Brand + a tab sub-nav
// (Inbox / Thread / Record / Search) + signals counter + help. Replaces the
// generic VoxModeToolbar so Glimpse reads as its own sectioned surface. The
// Thread tab is only enabled while a conversation is open.
type GlimpseTabId = 'inbox' | 'thread' | 'record' | 'search';
const GLIMPSE_TABS: { id: GlimpseTabId; label: string; icon: typeof List }[] = [
  { id: 'inbox', label: 'Inbox', icon: List },
  { id: 'thread', label: 'Thread', icon: Reply },
  { id: 'record', label: 'Record', icon: Video },
  { id: 'search', label: 'Search', icon: Search },
];

const GlimpseSectionHeader: React.FC<{
  viewMode: ViewMode;
  hasActiveThread: boolean;
  signals: number;
  totalUnread: number;
  onTab: (tab: GlimpseTabId) => void;
  onShowHelp: () => void;
  onClose?: () => void;
}> = ({ viewMode, hasActiveThread, signals, totalUnread, onTab, onShowHelp, onClose }) => {
  const activeTab: GlimpseTabId =
    viewMode === 'conversations' ? 'inbox' : viewMode === 'chat' ? 'thread' : viewMode;
  return (
    <header className="gl-section-header">
      <div className="gl-section-brand">
        <span className="gl-section-icon" aria-hidden="true"><Video className="w-4 h-4" /></span>
        <span className="gl-section-title">Glimpse</span>
      </div>

      <nav className="gl-section-tabs" aria-label="Glimpse sections">
        {GLIMPSE_TABS.map(t => {
          const Icon = t.icon;
          const disabled = t.id === 'thread' && !hasActiveThread;
          return (
            <button
              key={t.id}
              type="button"
              className="gl-section-tab"
              data-active={activeTab === t.id || undefined}
              aria-current={activeTab === t.id ? 'page' : undefined}
              disabled={disabled}
              title={disabled ? 'Open a glimpse to view its thread' : undefined}
              onClick={() => onTab(t.id)}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="gl-section-right">
        {signals > 0 && (
          <span className="gl-section-counter">
            <span className="gl-section-counter-n">
              {signals} {signals === 1 ? 'SIGNAL' : 'SIGNALS'}
            </span>
            {totalUnread > 0 && (
              <>
                <span className="gl-section-counter-sep" aria-hidden="true">·</span>
                <span className="gl-section-counter-unread">{totalUnread} UNREAD</span>
              </>
            )}
          </span>
        )}
        <button
          type="button"
          className="gl-section-help"
          onClick={onShowHelp}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        {onClose && (
          <button
            type="button"
            className="gl-section-help"
            onClick={onClose}
            aria-label="Close Glimpse"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};

// Contextual thread sub-header (Path D) — shown inside the chat view above the
// stacked cockpit cards. Back + contact identity + Summarize, with the
// secondary AI actions (Smart Replies, Draft) and selection mode tucked into a
// ⋯ menu so nothing from the old toolbar is lost.
const GlimpseThreadHeader: React.FC<{
  title: string;
  glimpseCount: number;
  isSummarizing: boolean;
  isGeneratingDraft: boolean;
  canDraft: boolean;
  isSelectionMode: boolean;
  onBack: () => void;
  onSummarize: () => void;
  onSmartReplies: () => void;
  onDraft: () => void;
  onToggleSelection: () => void;
}> = ({
  title,
  glimpseCount,
  isSummarizing,
  isGeneratingDraft,
  canDraft,
  isSelectionMode,
  onBack,
  onSummarize,
  onSmartReplies,
  onDraft,
  onToggleSelection,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = (title.trim()[0] || '?').toUpperCase();
  return (
    <div className="gl-thread-header">
      <button
        type="button"
        className="gl-thread-back"
        onClick={onBack}
        aria-label="Back to inbox"
        title="Back to inbox"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>
      <span className="gl-thread-avatar" aria-hidden="true">{initials}</span>
      <div className="gl-thread-id">
        <span className="gl-thread-name">{title}</span>
        <span className="gl-thread-sub">
          {glimpseCount} {glimpseCount === 1 ? 'glimpse' : 'glimpses'}
        </span>
      </div>

      <div className="gl-thread-header-actions">
        <button
          type="button"
          className="gl-thread-summarize"
          onClick={onSummarize}
          disabled={isSummarizing}
        >
          {isSummarizing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          Summarize
        </button>
        <div className="gl-thread-more-wrap">
          <button
            type="button"
            className="gl-thread-more"
            onClick={() => setMenuOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="More thread actions"
            title="More actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div
                className="gl-thread-menu-backdrop"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="gl-thread-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="gl-thread-menu-item"
                  onClick={() => { setMenuOpen(false); onSmartReplies(); }}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Smart replies
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="gl-thread-menu-item"
                  disabled={!canDraft || isGeneratingDraft}
                  title={canDraft ? undefined : 'Nothing to reply to yet'}
                  onClick={() => { setMenuOpen(false); onDraft(); }}
                >
                  {isGeneratingDraft ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Edit3 className="w-3.5 h-3.5" />
                  )}
                  Draft a reply
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="gl-thread-menu-item"
                  onClick={() => { setMenuOpen(false); onToggleSelection(); }}
                >
                  <Square className="w-3.5 h-3.5" />
                  {isSelectionMode ? 'Exit selection' : 'Select messages'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

// Stable reference for the default `contacts` prop. A fresh `[]` literal in the
// destructure below would be a new reference every render, which made the
// contact-loader effect (deps: [contacts]) re-fire on every re-render — during
// recording/sending that meant a storm of identical getAllPulseUsers() requests
// (dozens per second, visible in the API logs). A module-level constant keeps
// the dependency stable so the effect runs once.
const EMPTY_CONTACTS: NonNullable<GlimpseProps['contacts']> = [];

const Glimpse: React.FC<GlimpseProps> = ({
  isDarkMode = true,
  onClose,
  maxDuration = 60,
  initialRecipientId,
  initialRecipientName,
  apiKey,
  contacts = EMPTY_CONTACTS,
}) => {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>(
    initialRecipientId ? 'record' : 'conversations'
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(
    initialRecipientId ? [initialRecipientId] : []
  );
  const [caption, setCaption] = useState('');
  const [replyingTo, setReplyingTo] = useState<GlimpseMessage | null>(null);
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(new Set());
  // Thread task rail open/collapsed — only consulted below the 860px breakpoint
  // (CSS keeps the rail always-visible on wide panes regardless of this state).
  const [railOpen, setRailOpen] = useState(true);
  const [showRecipientSelector, setShowRecipientSelector] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [pulseContacts, setPulseContacts] = useState<Array<{ id: string; name: string; avatarColor?: string; handle?: string }>>(contacts);

  // Phase 2: Selection Mode State
  const {
    isSelectionMode,
    selectedItems,
    selectionCount,
    toggleSelection,
    selectAll,
    deselectAll,
    enterSelectionMode,
    exitSelectionMode,
    isSelected,
    getTotalDuration,
  } = useVoxSelection();

  // Phase 5: AI Enhancement States
  const [showSummary, setShowSummary] = useState(false);
  const [conversationSummary, setConversationSummary] = useState<ConversationSummary | null>(null);
  const [showSmartReplies, setShowSmartReplies] = useState(false);
  const [smartReplies, setSmartReplies] = useState<SmartReply[]>([]);
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [showReplyDraft, setShowReplyDraft] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);

  // Phase 6: Final Polish States
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const { playbackSpeed: globalPlaybackSpeed, setPlaybackSpeed: setGlobalPlaybackSpeed, applyToElement } = usePlaybackSpeed();
  const emptyConfig = getEmptyStateConfig('glimpse');

  // VoxMessageMenu state
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadItem, setDownloadItem] = useState<VoxSelectionItem | null>(null);


  // Hooks
  const { conversations, isLoading: conversationsLoading, totalUnread } = useGlimpseConversations();
  const { sendToRecipients, isSending, progress, error: sendError } = useGlimpseSend();
  const { results: searchResults, isSearching, search: performSearch } = useGlimpseSearch();
  const [searchQuery, setSearchQuery] = useState('');

  // Recording hook (cam + cam-screen)
  const {
    state,
    isRecording,
    isPreviewing,
    duration,
    previewUrl,
    captureMode,
    setCaptureMode,
    pipCorner,
    swapPipCorner,
    mirrorPreview,
    startPreview,
    stopPreview,
    flipCamera,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    discardRecording,
    getRecording,
    videoRef,
  } = useGlimpseRecording({
    maxDuration,
    videoQuality: '720p',
    facingMode: 'user',
    captureMode: 'cam',
    onScreenShareEnded: (reason) => {
      if (reason === 'user-cancel') {
        toast('Screen sharing canceled. Tap to try again.');
      } else {
        toast('Screen share ended. Continuing with camera only.');
      }
    },
  });

  // Chat messages (when viewing a conversation). The hook MUST be called
  // unconditionally — Rules of Hooks. Empty conversationId puts the hook in
  // no-op mode (no fetch, no subscription, empty messages).
  const chatHook = useGlimpseMessages({ conversationId: activeConversationId || '' });

  // Inbox triage split (redesign 2026-05-27): "Needs you" = unread or has
  // extracted action items; "FYI" = everything else. Drives the Reel grid's
  // two sections and matches the briefing card's split exactly.
  const { needsConversations, fyiConversations } = React.useMemo(() => {
    const needs: GlimpseConversation[] = [];
    const fyi: GlimpseConversation[] = [];
    for (const c of conversations) {
      if ((c.unreadCount ?? 0) > 0 || (c.lastMessageActionCount ?? 0) > 0) needs.push(c);
      else fyi.push(c);
    }
    return { needsConversations: needs, fyiConversations: fyi };
  }, [conversations]);

  // Thread task rail — a deduped roll-up of every message's extracted
  // actionItems (first occurrence keeps its owning message so convert + ✓
  // state route to the right record). Real now; no new fetch.
  const railTasks = React.useMemo(() => {
    const seen = new Set<string>();
    const out: RailTask[] = [];
    for (const m of chatHook.messages) {
      for (const item of m.actionItems || []) {
        const text = item.trim();
        const key = text.toLowerCase();
        if (!text || seen.has(key)) continue;
        seen.add(key);
        out.push({ text, message: m });
      }
    }
    return out;
  }, [chatHook.messages]);

  // VoxMessageMenu handler functions
  const handleArchiveMessage = async (message: any) => {
    const item: VoxSelectionItem = {
      id: message.id,
      type: 'video',
      url: message.videoUrl || message.audioUrl || '',
      duration: message.duration || 0,
      timestamp: message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt || Date.now()),
      mode: 'glimpse',
      contactName: message.senderName,
    };
    try {
      await archiveRelayConversation([item], message.senderName || 'Glimpse');
      toast.success('Archived to Pulse Archives');
    } catch {
      toast.error('Failed to archive');
    }
  };

  const handleDownloadMessage = (message: any) => {
    const item: VoxSelectionItem = {
      id: message.id,
      type: 'video',
      url: message.videoUrl || message.audioUrl || '',
      duration: message.duration || 0,
      timestamp: message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt || Date.now()),
      mode: 'glimpse',
      contactName: message.senderName,
    };
    setDownloadItem(item);
    setShowDownloadModal(true);
  };

  // Phase 5: AI Handler Functions (defined before keyboard shortcuts to avoid TDZ)
  const handleSummarizeConversation = async () => {
    if (!chatHook || chatHook.messages.length === 0) {
      toast.error('No messages to summarize');
      return;
    }

    if (!apiKey) {
      toast.error('Gemini API key not configured');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const messageData = chatHook.messages.map(msg => ({
        id: msg.id,
        transcription: msg.transcript || '',
        sender: (msg.senderId === currentUserId ? 'me' : 'other') as 'me' | 'other',
        senderName: msg.senderName,
        timestamp: msg.createdAt,
        duration: msg.duration,
      }));

      const summary = await summarizeConversation(apiKey, messageData);
      if (summary) {
        setConversationSummary(summary);
        setShowSummary(true);
        toast.success('Conversation summarized!');
      } else {
        toast.error('AI summarizer unavailable. Try again later.');
      }
    } catch (error: any) {
      console.error('Summarization error:', error);
      const msg = error?.message || '';
      if (msg.includes('API key') || msg.includes('API_KEY') || msg.includes('invalid') || msg.includes('unauthorized')) {
        toast.error('AI features require API configuration');
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('ECONNREFUSED')) {
        toast.error('Network error. Please try again.');
      } else {
        toast.error('AI summarizer unavailable (beta)');
      }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleGenerateSmartReplies = async () => {
    if (!chatHook || chatHook.messages.length === 0) {
      toast.error('No messages to analyze');
      return;
    }

    if (!apiKey) {
      toast.error('Gemini API key not configured');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const recentMessages = chatHook.messages.slice(-5);
      const lastMessage = recentMessages[recentMessages.length - 1];
      const context = recentMessages.map(msg => ({
        id: msg.id,
        transcription: msg.transcript || '',
        sender: (msg.senderId === currentUserId ? 'me' : 'other') as 'me' | 'other',
        senderName: msg.senderName,
        timestamp: msg.createdAt,
        duration: msg.duration,
      }));

      const replies = await generateSmartReplies(apiKey, {
        id: lastMessage.id,
        transcription: lastMessage.transcript || '',
        sender: (lastMessage.senderId === currentUserId ? 'me' : 'other') as 'me' | 'other',
        senderName: lastMessage.senderName,
        timestamp: lastMessage.createdAt,
        duration: lastMessage.duration,
      }, context);

      if (replies.length > 0) {
        setSmartReplies(replies);
        setShowSmartReplies(true);
        toast.success('Smart replies generated!');
      } else {
        toast.error('Smart replies unavailable. Try again later.');
      }
    } catch (error: any) {
      console.error('Smart replies error:', error);
      const msg = error?.message || '';
      if (msg.includes('API key') || msg.includes('API_KEY') || msg.includes('invalid') || msg.includes('unauthorized')) {
        toast.error('AI features require API configuration');
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('ECONNREFUSED')) {
        toast.error('Network error. Please try again.');
      } else {
        toast.error('Smart replies unavailable (beta)');
      }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // "Draft" — generate a single longer-form reply draft (option C from #27).
  // Distinct from Smart Replies (3 quick options): one considered draft the
  // user can edit, copy, or carry into a Glimpse reply as the caption.
  const handleGenerateReplyDraft = async () => {
    if (!chatHook || chatHook.messages.length === 0) {
      toast.error('No messages to draft a reply for');
      return;
    }
    // The slot is pointless if you've never received an incoming message.
    const hasIncoming = chatHook.messages.some(msg => msg.senderId !== currentUserId);
    if (!hasIncoming) {
      toast('Nothing to reply to yet');
      return;
    }

    setIsGeneratingDraft(true);
    try {
      const recent = chatHook.messages.slice(-5).map(msg => ({
        id: msg.id,
        transcription: msg.transcript || '',
        sender: (msg.senderId === currentUserId ? 'me' : 'other') as 'me' | 'other',
        senderName: msg.senderName,
        timestamp: msg.createdAt,
        duration: msg.duration,
      }));

      // Lightweight relationship hint — sender name is enough to personalize
      // tone without coupling to the full RelationshipProfile loader. The
      // service treats every field as optional, so this stays graceful.
      const lastIncoming = [...recent].reverse().find(m => m.sender === 'other');
      const draft = await generateReplyDraft(
        recent,
        lastIncoming ? { contactName: lastIncoming.senderName } : undefined,
      );

      if (draft) {
        setReplyDraft(draft);
        setShowReplyDraft(true);
        toast.success('Draft ready');
      } else {
        toast.error('Could not draft a reply. Try again.');
      }
    } catch (error: unknown) {
      console.error('Reply draft error:', error);
      const msg = (error as { message?: string })?.message || '';
      if (msg.includes('API key') || msg.includes('API_KEY') || msg.includes('invalid') || msg.includes('unauthorized')) {
        toast.error('AI features require API configuration');
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('ECONNREFUSED')) {
        toast.error('Network error. Please try again.');
      } else {
        toast.error('Reply drafter unavailable (beta)');
      }
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  // Carry a draft into the recorder as the caption for a new Glimpse reply.
  // Hooks into the existing reply flow: the source message becomes the
  // replyingTo target and the draft prefills the caption input.
  const handleUseDraftAsCaption = (draftText: string) => {
    const lastIncoming = chatHook?.messages
      .slice()
      .reverse()
      .find(msg => msg.senderId !== currentUserId);
    if (lastIncoming) {
      setReplyingTo(lastIncoming);
    }
    setCaption(draftText);
    setCaptureMode('cam');
    setShowReplyDraft(false);
    setViewMode('record');
  };

  const handleSelectAllMessages = () => {
    if (!chatHook || !activeConversationId) return;
    const allItems: VoxSelectionItem[] = chatHook.messages.map(msg => ({
      id: msg.id,
      type: 'video' as const,
      url: msg.videoUrl,
      duration: msg.duration,
      timestamp: msg.createdAt,
      sender: (msg.senderId === currentUserId ? 'me' : 'other') as 'me' | 'other',
      transcript: msg.transcript,
      mode: 'glimpse' as const,
      contactId: activeConversationId,
      contactName: conversations.find(c => c.id === activeConversationId)?.title || 'Glimpse',
    }));
    selectAll(allItems);
  };

  // Phase 6: Keyboard Shortcuts (after handler functions are defined)
  useRelayKeyboardShortcuts({
    onToggleRecording: () => {
      if (state.status === 'idle') startPreview();
      else if (state.status === 'previewing') startRecording();
      else if (state.status === 'recording') stopRecording();
    },
    onStopRecording: () => {
      // Priority 1: close any open modal/overlay first
      if (showMessageMenu) { setShowMessageMenu(null); return; }
      if (showSummary) { setShowSummary(false); return; }
      if (showSmartReplies) { setShowSmartReplies(false); return; }
      if (showDownloadModal) { setShowDownloadModal(false); return; }
      if (showRecipientSelector) { setShowRecipientSelector(false); return; }
      // Priority 2: discard active recording
      if (state.status === 'recording') { stopRecording(); return; }
      // Priority 3: exit selection mode
      if (isSelectionMode) { exitSelectionMode(); return; }
      // Priority 4: navigate back through views
      if (viewMode === 'chat' || viewMode === 'record' || viewMode === 'search') {
        setViewMode('conversations'); return;
      }
      onClose?.();
    },
    onGoBack: () => {
      if (viewMode === 'chat' || viewMode === 'record' || viewMode === 'search') {
        setViewMode('conversations');
      } else {
        onClose?.();
      }
    },
    onDownload: () => {
      if (isSelectionMode && selectionCount > 0) {
        // Download handled by selection toolbar
      }
    },
    onArchive: () => {
      if (isSelectionMode && selectionCount > 0) {
        (async () => {
          try {
            await archiveRelayConversation(Array.from(selectedItems), conversations.find(c => c.id === activeConversationId)?.title || 'Glimpse');
            exitSelectionMode();
            toast.success(`Archived ${selectionCount} message${selectionCount > 1 ? 's' : ''}`);
          } catch {
            toast.error('Failed to archive');
          }
        })();
      } else {
        toast.error('Select messages first (click selection button)');
      }
    },
    onSummarize: handleSummarizeConversation,
    onShowHelp: () => setShowShortcutsHelp(true),
  }, true);

  // Phase 6: Apply playback speed to video elements
  useEffect(() => {
    const videoElements = document.querySelectorAll<HTMLVideoElement>('.vvb-message-video');
    videoElements.forEach(video => {
      applyToElement(video);
    });
  }, [globalPlaybackSpeed, applyToElement]);

  // Get current user ID
  useEffect(() => {
    glimpseService.ensureUserId().then(setCurrentUserId);
  }, []);

  // Load Pulse contacts
  useEffect(() => {
    const loadContacts = async () => {
      const users = await voxModeService.getPulseUsersAsContacts();
      setPulseContacts(users.length > 0 ? users : contacts);
    };
    loadContacts();
  }, [contacts]);

  // Format helpers
  const formatDurationDisplay = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Progress ring
  const progressPercent = (duration / maxDuration) * 100;
  const ringRadius = 38;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (progressPercent / 100) * ringCircumference;

  // Paused/capturing convenience flags — `isRecording` from the hook is
  // strictly `status === 'recording'`, so it goes false the moment we pause.
  // `isCapturing` covers both states for shared chrome (duration counter,
  // stage overlays, REC badge).
  const isPaused = state.status === 'paused';
  const isCapturing = isRecording || isPaused;

  // Walkthrough capture relies on getDisplayMedia which Android Chrome /
  // Capacitor webview don't expose — hide the entry points there instead of
  // letting users tap a CTA that errors.
  const canShareScreen =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof (navigator.mediaDevices as MediaDevices & { getDisplayMedia?: unknown }).getDisplayMedia === 'function';

  // Handlers
  const handleRecordClick = () => {
    if (state.status === 'idle') {
      startPreview();
    } else if (state.status === 'previewing') {
      startRecording();
    } else if (state.status === 'recording' || state.status === 'paused') {
      stopRecording();
    }
  };

  // Open the recorder for a fresh New Glimpse / New Walkthrough — pre-fills
  // selectedRecipients from last-used memory, filtered against the current
  // pulseContacts list so deleted/invalid IDs are silently dropped. Reply
  // entry points keep their conversation-derived recipients and bypass this.
  const enterRecorder = (mode: 'cam' | 'cam-screen') => {
    setCaptureMode(mode);
    const remembered = readLastRecipients(currentUserId);
    const validIds = new Set(pulseContacts.map(c => c.id));
    setSelectedRecipients(remembered.filter(id => validIds.has(id)));
    setViewMode('record');
  };

  const handleSend = async () => {
    const recording = getRecording();
    if (!recording || selectedRecipients.length === 0) return;

    const message = await sendToRecipients(
      selectedRecipients,
      recording.video,
      recording.thumbnail,
      duration,
      {
        caption: caption || undefined,
        replyToId: replyingTo?.id,
        quotedText: replyingTo?.transcript?.substring(0, 100),
      }
    );

    if (message) {
      writeLastRecipients(currentUserId, selectedRecipients);
      discardRecording();
      setCaption('');
      setReplyingTo(null);
      setViewMode('conversations');
    }
  };

  const handleSelectConversation = (conversation: GlimpseConversation) => {
    setActiveConversationId(conversation.id);
    setSelectedRecipients(conversation.participantIds.filter(id => id !== currentUserId));
    setViewMode('chat');
  };

  // Leaving an in-progress recording discards it (matches the old toolbar back).
  const leaveRecordIfNeeded = () => {
    if (viewMode === 'record' && state.status !== 'idle') {
      discardRecording();
      stopPreview();
    }
  };

  // Path D tab navigation. Record always opens a fresh glimpse (cam); the
  // record view itself offers the Glimpse / Walkthrough toggle so both capture
  // types stay reachable. activeConversationId is kept so the Thread tab can
  // return to the open conversation.
  const handleTabSelect = (tab: GlimpseTabId) => {
    if (tab !== 'record') leaveRecordIfNeeded();
    if (tab === 'inbox') {
      setViewMode('conversations');
      setReplyingTo(null);
    } else if (tab === 'thread') {
      if (activeConversationId) setViewMode('chat');
    } else if (tab === 'record') {
      enterRecorder('cam');
    } else {
      setViewMode('search');
    }
  };

  // Back from a thread → inbox (keep activeConversationId so Thread tab stays
  // available to return to it).
  const handleThreadBack = () => {
    setViewMode('conversations');
    setReplyingTo(null);
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;
  const activeThreadTitle = activeConversation
    ? (activeConversation.title ||
        activeConversation.participants
          .filter(p => p.id !== currentUserId)
          .map(p => p.name)
          .join(', ') ||
        'Video Chat')
    : 'Video Chat';

  const handleToggleRecipient = (id: string) => {
    setSelectedRecipients(prev =>
      prev.includes(id)
        ? prev.filter(r => r !== id)
        : [...prev, id]
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    await chatHook?.toggleReaction(messageId, emoji);
  };

  const handleReply = (message: GlimpseMessage) => {
    setReplyingTo(message);
    setViewMode('record');
  };

  const handleBookmark = async (messageId: string) => {
    // Route through the chat hook so the local bookmarkedIds set updates
    // optimistically and the bookmark icon fills/empties without a refetch.
    if (!chatHook) return;
    const result = await chatHook.toggleBookmark(messageId);
    if (result === 'added') toast.success('Bookmarked');
    else if (result === 'removed') toast.success('Bookmark removed');
    else toast.error('Could not update bookmark');
  };

  const toggleTranscript = (messageId: string) => {
    setExpandedTranscripts(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const themeClass = isDarkMode ? 'dark' : 'light';

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={`video-vox-mode ${themeClass}`}>
      {/* Header — Path D persistent tab sub-nav */}
      <GlimpseSectionHeader
        viewMode={viewMode}
        hasActiveThread={!!activeConversationId}
        signals={conversations.length}
        totalUnread={totalUnread}
        onTab={handleTabSelect}
        onShowHelp={() => setShowShortcutsHelp(true)}
        onClose={onClose}
      />

      {/* Main Content */}
      <main className="vvb-content">
        {/* CONVERSATIONS VIEW — Inbox: Briefing + Reel grid (Path D) */}
        {viewMode === 'conversations' && (
          <div className="vvb-conversations">
            {conversationsLoading ? (
              <div className="vvb-loading">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p>Loading conversations...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="gl-tc-empty">
                <span className="gl-tc-empty-stamp">No incoming signals</span>
                <p className="gl-tc-empty-body">
                  When someone sends a glimpse, it lands here with a transcript,
                  summary, and action items already extracted. You'll see what
                  to watch, and what to skip, before pressing play.
                </p>
                <button
                  type="button"
                  onClick={() => enterRecorder('cam')}
                  className="gl-tc-empty-cta"
                >
                  <Video className="w-4 h-4" />
                  Record your first glimpse
                </button>
                {canShareScreen && (
                  <button
                    type="button"
                    onClick={() => enterRecorder('cam-screen')}
                    className="gl-tc-empty-link"
                  >
                    <MonitorPlay className="w-3.5 h-3.5" />
                    or record a walkthrough
                  </button>
                )}
              </div>
            ) : (
              <div className="gl-inbox">
                <GlimpseBriefingCard
                  conversations={conversations}
                  totalUnread={totalUnread}
                  currentUserId={currentUserId}
                  onOpen={handleSelectConversation}
                />

                {needsConversations.length > 0 && (
                  <section className="gl-reel-section" aria-label="Needs you">
                    <span className="gl-label gl-reel-section-label needs">
                      Needs you · {needsConversations.length}
                    </span>
                    <div className="gl-reel-grid">
                      {needsConversations.map(conv => (
                        <ReelCard
                          key={conv.id}
                          conversation={conv}
                          currentUserId={currentUserId}
                          onClick={() => handleSelectConversation(conv)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {fyiConversations.length > 0 && (
                  <section className="gl-reel-section" aria-label="FYI">
                    <span className="gl-label gl-reel-section-label">
                      FYI · {fyiConversations.length}
                    </span>
                    <div className="gl-reel-grid">
                      {fyiConversations.map(conv => (
                        <ReelCard
                          key={conv.id}
                          conversation={conv}
                          currentUserId={currentUserId}
                          onClick={() => handleSelectConversation(conv)}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        )}

        {/* CHAT VIEW */}
        {viewMode === 'chat' && chatHook && (
          <div className="vvb-chat">
            <GlimpseThreadHeader
              title={activeThreadTitle}
              glimpseCount={chatHook.messages.length}
              isSummarizing={isGeneratingAI}
              isGeneratingDraft={isGeneratingDraft}
              canDraft={chatHook.messages.some(m => m.senderId !== currentUserId)}
              isSelectionMode={isSelectionMode}
              onBack={handleThreadBack}
              onSummarize={handleSummarizeConversation}
              onSmartReplies={handleGenerateSmartReplies}
              onDraft={handleGenerateReplyDraft}
              onToggleSelection={() => isSelectionMode ? exitSelectionMode() : enterSelectionMode()}
            />
            {chatHook.isLoading ? (
              <div className="vvb-loading">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : chatHook.messages.length === 0 ? (
              <VoxEmptyState
                {...emptyConfig}
                color={MODE_COLOR}
                isDarkMode={isDarkMode}
                action={{ label: 'Record Video', onClick: () => setViewMode('record') }}
              />
            ) : (
              <div className="gl-thread">
                <button
                  type="button"
                  className="gl-rail-toggle"
                  onClick={() => setRailOpen(o => !o)}
                  aria-expanded={railOpen}
                  aria-controls="gl-thread-rail"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Tasks &amp; decisions
                  {railTasks.length > 0 && (
                    <span className="gl-rail-toggle-count">{railTasks.length}</span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 gl-rail-toggle-chev ${railOpen ? 'open' : ''}`} />
                </button>

                <div className="gl-thread-cards">
                {chatHook.messages.map(message => (
                  <React.Fragment key={message.id}>
                    <MessageBubble
                      message={message}
                      isOwn={message.senderId === currentUserId}
                      isDarkMode={isDarkMode}
                      onReaction={(emoji) => handleReaction(message.id, emoji)}
                      onReply={() => handleReply(message)}
                      onBookmark={() => handleBookmark(message.id)}
                      isBookmarked={chatHook.bookmarkedIds.has(message.id)}
                      convertedActionItems={chatHook.convertedActionItems.get(message.id)}
                      onAddAsTask={(item) => chatHook.addActionItemAsTask(message, item)}
                      onShowMenu={(rect) => {
                        setMenuAnchorRect(rect);
                        setShowMessageMenu(showMessageMenu === message.id ? null : message.id);
                      }}
                      onTranscriptClick={() => {}}
                      showTranscript={expandedTranscripts.has(message.id)}
                      onToggleTranscript={() => toggleTranscript(message.id)}
                      isSelectionMode={isSelectionMode}
                      isSelected={isSelected(message.id)}
                      onToggleSelection={() => {
                        const selectionItem: VoxSelectionItem = {
                          id: message.id,
                          type: 'video' as const,
                          url: message.videoUrl,
                          duration: message.duration,
                          timestamp: message.createdAt,
                          sender: message.senderId === currentUserId ? 'me' : 'other',
                          transcript: message.transcript,
                          mode: 'glimpse' as const,
                          contactId: activeConversationId || undefined,
                          contactName: conversations.find(c => c.id === activeConversationId)?.title,
                        };
                        toggleSelection(selectionItem);
                      }}
                      playbackSpeed={globalPlaybackSpeed}
                      onPlaybackSpeedChange={(newSpeed) => {
                        setGlobalPlaybackSpeed(newSpeed);
                      }}
                    />
                    {showMessageMenu === message.id && menuAnchorRect && (
                      <VoxMessageMenu
                        isDarkMode={isDarkMode}
                        accentColor={MODE_COLOR}
                        anchorRect={menuAnchorRect}
                        onArchive={() => handleArchiveMessage(message)}
                        onDownload={() => handleDownloadMessage(message)}
                        onDelete={async () => {
                          const success = await chatHook.deleteMessage(message.id);
                          if (success) {
                            toast.success('Message deleted');
                          } else {
                            toast.error('Failed to delete message');
                          }
                          setShowMessageMenu(null);
                        }}
                        onClose={() => setShowMessageMenu(null)}
                      />
                    )}
                  </React.Fragment>
                ))}
                  <button
                    type="button"
                    className="gl-thread-reply"
                    onClick={() => { setCaptureMode('cam'); setViewMode('record'); }}
                  >
                    <Video className="w-4 h-4" />
                    Record reply
                  </button>
                </div>

                <GlimpseTaskRail
                  tasks={railTasks}
                  convertedActionItems={chatHook.convertedActionItems}
                  onAddTask={(m, t) => chatHook.addActionItemAsTask(m, t)}
                  decisions={conversationSummary?.keyDecisions}
                  hasSummary={!!conversationSummary}
                  isSummarizing={isGeneratingAI}
                  onRunSummary={handleSummarizeConversation}
                  onReply={() => { setCaptureMode('cam'); setViewMode('record'); }}
                  open={railOpen}
                />
              </div>
            )}
          </div>
        )}

        {/* SEARCH VIEW */}
        {viewMode === 'search' && (
          <div className="vvb-search-view">
            <form onSubmit={handleSearch} className="vvb-search-form">
              <Search className="w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search videos by content..."
                className="vvb-search-input"
              />
            </form>

            {isSearching ? (
              <div className="vvb-loading">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p>Searching...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="vvb-search-results">
                {searchResults.map(result => (
                  <div key={result.message.id} className="vvb-search-result">
                    <img
                      src={result.message.thumbnailUrl}
                      alt=""
                      className="vvb-search-thumb"
                    />
                    <div className="vvb-search-info">
                      <span className="vvb-search-sender">{result.message.senderName}</span>
                      <p className="vvb-search-match">
                        <span className="vvb-match-type">{result.matchType}:</span>
                        {result.matchText}
                      </p>
                      <span className="vvb-search-date">
                        {formatRelativeTime(result.message.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="vvb-empty">
                <Search className="w-12 h-12 opacity-50" />
                <p>No results found</p>
              </div>
            ) : null}
          </div>
        )}

        {/* RECORD VIEW */}
        {viewMode === 'record' && (
          <div className="gl-record">
            {/* Mode confirmation strip — sits above the recipient bar so the
                recipient popover (which drops down from the bar) doesn't
                cover the active capture mode. */}
            {state.status === 'idle' && (
              <div className="gl-mode-toggle" role="group" aria-label="Recording type">
                <button
                  type="button"
                  className="gl-mode-toggle-btn"
                  data-active={captureMode === 'cam' || undefined}
                  onClick={() => setCaptureMode('cam')}
                  aria-pressed={captureMode === 'cam'}
                >
                  <Video className="w-3.5 h-3.5" />
                  Glimpse · camera
                </button>
                {canShareScreen && (
                  <button
                    type="button"
                    className="gl-mode-toggle-btn"
                    data-active={captureMode === 'cam-screen' || undefined}
                    onClick={() => setCaptureMode('cam-screen')}
                    aria-pressed={captureMode === 'cam-screen'}
                  >
                    <MonitorPlay className="w-3.5 h-3.5" />
                    Walkthrough · screen + camera
                  </button>
                )}
              </div>
            )}

            {/* Recipient bar — anchor for the selector popover so it never
                pushes the recorder off the fold. Visible in both pre-record
                (idle) and post-record (ready) states — without ready, users
                who record without selecting recipients first get trapped
                with no way out except discarding the recording. */}
            {(state.status === 'idle' || state.status === 'ready') && (
              <div className="gl-recipient-anchor">
                <div className="gl-recipient-bar">
                  <button
                    type="button"
                    onClick={() => setShowRecipientSelector(!showRecipientSelector)}
                    className="gl-recipient-bar-toggle"
                    aria-expanded={showRecipientSelector}
                  >
                    <Users className="icon w-4 h-4" />
                    <span className="label">
                      {selectedRecipients.length === 0
                        ? 'Select recipients'
                        : `${selectedRecipients.length} selected`}
                    </span>
                    {selectedRecipients.length > 0 && (
                      <span className="count">{selectedRecipients.length}</span>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${showRecipientSelector ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--gl-ink-cloth)' }}
                    />
                  </button>
                  {selectedRecipients.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedRecipients([])}
                      className="gl-recipient-clear"
                      title="Clear recipients"
                      aria-label="Clear recipients"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {showRecipientSelector && (
                  <RecipientSelector
                    contacts={pulseContacts}
                    selectedIds={selectedRecipients}
                    onSelect={handleToggleRecipient}
                    onDone={() => setShowRecipientSelector(false)}
                    isDarkMode={isDarkMode}
                  />
                )}
              </div>
            )}

            {/* Replying-to chip */}
            {replyingTo && (
              <div className="gl-replying-to">
                <Reply className="w-4 h-4" />
                <span>Replying to {replyingTo.senderName}</span>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  title="Cancel reply"
                  aria-label="Cancel reply"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Video stage */}
            <div className="gl-stage" data-state={state.status} data-mode={captureMode}>
              {state.status === 'ready' && previewUrl ? (
                <video src={previewUrl} controls loop playsInline />
              ) : (
                <video
                  ref={videoRef}
                  className={mirrorPreview ? 'mirror' : ''}
                  playsInline
                  muted
                />
              )}

              {/* Idle overlay */}
              {state.status === 'idle' && !state.error && (
                <div className="gl-idle">
                  <div className="gl-idle-icon">
                    {captureMode === 'cam-screen' ? (
                      <Square className="w-6 h-6" />
                    ) : (
                      <Video className="w-6 h-6" />
                    )}
                  </div>
                  <p className="gl-idle-text">
                    {captureMode === 'cam-screen'
                      ? 'tap to start screen + camera'
                      : 'tap to start camera'}
                  </p>
                </div>
              )}

              {/* Top meta */}
              {(isPreviewing || isCapturing || state.status === 'ready') && (
                <div className="gl-stage-top">
                  <div className={`gl-rec-badge ${isCapturing ? 'visible' : ''} ${isPaused ? 'paused' : ''}`}>
                    <span className="gl-rec-dot" />
                    <span>{isPaused ? 'PAUSED' : 'REC'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {captureMode === 'cam-screen' && (isPreviewing || isCapturing) && (
                      <span className="gl-mode-chip">CAM + SCREEN</span>
                    )}
                    {(isCapturing || state.status === 'ready') && (
                      <div className="gl-duration">
                        {formatDurationDisplay(duration)} / {formatDurationDisplay(maxDuration)}
                        {isPaused && <span className="gl-duration-paused">PAUSED</span>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Stage controls (right side): flip OR pip-corner */}
              {(isPreviewing || isCapturing) && captureMode === 'cam' && (
                <button
                  type="button"
                  onClick={flipCamera}
                  className="gl-flip-btn"
                  title="Flip camera"
                  aria-label="Flip camera"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              )}
              {(isPreviewing || isCapturing) && captureMode === 'cam-screen' && (
                <button
                  type="button"
                  onClick={swapPipCorner}
                  className="gl-flip-btn"
                  title={`Move PIP (currently ${pipCorner.toUpperCase()})`}
                  aria-label="Move picture-in-picture corner"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              {/* Error */}
              {state.error && (
                <div className="gl-stage-error">
                  <AlertCircle className="w-8 h-8" />
                  <p>{state.error}</p>
                  <button type="button" onClick={startPreview} className="gl-retry-btn">
                    Try again
                  </button>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="gl-controls">
              {state.status === 'ready' ? (
                <>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add a caption (optional)"
                    className="gl-caption-input"
                    maxLength={200}
                  />

                  <div className="gl-secondary-controls">
                    <button
                      type="button"
                      onClick={discardRecording}
                      className="gl-secondary-btn danger"
                      title="Discard"
                      aria-label="Discard recording"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        discardRecording();
                        startPreview();
                      }}
                      className="gl-secondary-btn"
                      title="Re-record"
                      aria-label="Re-record"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={
                      selectedRecipients.length === 0
                        ? () => setShowRecipientSelector(true)
                        : handleSend
                    }
                    disabled={isSending}
                    className="gl-send-btn"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending {progress}%</span>
                      </>
                    ) : selectedRecipients.length === 0 ? (
                      <>
                        <Users className="w-4 h-4" />
                        <span>Select recipients</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send glimpse</span>
                      </>
                    )}
                  </button>

                  {sendError && <p className="gl-send-error">{sendError}</p>}
                </>
              ) : (
                <>
                  <div className="gl-record-row">
                    {/* Left spacer keeps the record button centered when the
                        right-side pause button isn't visible. */}
                    <span className="gl-record-side" aria-hidden="true" />
                    <div className="gl-record-cluster">
                      {isCapturing && (
                        <svg className="gl-progress-ring" viewBox="0 0 84 84">
                          <circle className="track" cx="42" cy="42" r={ringRadius} />
                          <circle
                            className="progress"
                            cx="42"
                            cy="42"
                            r={ringRadius}
                            strokeDasharray={ringCircumference}
                            strokeDashoffset={ringOffset}
                          />
                        </svg>
                      )}
                      <button
                        type="button"
                        onClick={handleRecordClick}
                        className="gl-record-btn"
                        data-state={isCapturing ? 'recording' : state.status}
                        aria-label={isCapturing ? 'Stop recording' : 'Start recording'}
                        title={isCapturing ? 'Stop recording' : 'Start recording'}
                      >
                        <span className="gl-record-icon" />
                      </button>
                    </div>
                    <span className="gl-record-side">
                      {isCapturing && (
                        <button
                          type="button"
                          onClick={isPaused ? resumeRecording : pauseRecording}
                          className="gl-secondary-btn gl-pause-btn"
                          title={isPaused ? 'Resume recording' : 'Pause recording'}
                          aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
                        >
                          {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                        </button>
                      )}
                    </span>
                  </div>

                  <p className="gl-hint">
                    {state.status === 'idle' &&
                      (captureMode === 'cam-screen'
                        ? 'tap to start screen + camera'
                        : 'tap to start camera')}
                    {isPreviewing && 'tap to record'}
                    {isRecording && 'tap to stop · pause to step away'}
                    {isPaused && 'paused · tap play to resume, square to stop'}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Phase 2: Selection Toolbar */}
      {isSelectionMode && viewMode === 'chat' && chatHook && (
        <VoxSelectToolbar
          selectedItems={selectedItems}
          selectionCount={selectionCount}
          totalDuration={getTotalDuration()}
          onSelectAll={handleSelectAllMessages}
          onDeselectAll={deselectAll}
          onExitSelection={exitSelectionMode}
          contactName={conversations.find(c => c.id === activeConversationId)?.title || 'Video Chat'}
          isDarkMode={isDarkMode}
          accentColor={MODE_COLOR}
          allSelected={selectionCount === chatHook.messages.length && chatHook.messages.length > 0}
        />
      )}

      {/* Phase 5: AI Enhancement Modals */}

      {/* Conversation Summary Modal */}
      {conversationSummary && showSummary && (
        <div className="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <MessageAIPanel
              summary={conversationSummary}
              isDarkMode={isDarkMode}
              onClose={() => setShowSummary(false)}
            />
          </div>
        </div>
      )}

      {/* Reply Draft Panel — single longer-form draft (issue #27 option C) */}
      {replyDraft && showReplyDraft && (
        <div className="fixed bottom-20 right-4 z-40 w-96 max-w-[calc(100vw-32px)]">
          <GlimpseReplyDraftPanel
            draft={replyDraft}
            isDarkMode={isDarkMode}
            onUseAsCaption={handleUseDraftAsCaption}
            onDismiss={() => setShowReplyDraft(false)}
          />
        </div>
      )}

      {/* Smart Replies Panel */}
      {smartReplies.length > 0 && showSmartReplies && (
        <div className="fixed bottom-20 right-4 z-40 w-96">
          <button
            type="button"
            onClick={() => setShowSmartReplies(false)}
            aria-label="Dismiss smart replies"
            className="gl-floating-dismiss absolute -top-2 -right-2 z-10"
          >
            <X className="w-3 h-3" />
          </button>
          <VoxSmartReplies
            replies={smartReplies}
            onSelectReply={(reply) => {
              navigator.clipboard.writeText(reply);
              toast.success('Smart reply copied. Paste into your next message.');
              setSmartReplies([]);
              setShowSmartReplies(false);
            }}
            isDarkMode={isDarkMode}
            accentColor={MODE_COLOR}
          />
        </div>
      )}

      {/* Phase 6: Keyboard Shortcuts Help Modal */}
      <VoxKeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
        isDarkMode={isDarkMode}
      />

      {/* VoxDownloadModal */}
      {showDownloadModal && downloadItem && (
        <VoxDownloadModal
          isOpen={showDownloadModal}
          onClose={() => { setShowDownloadModal(false); setDownloadItem(null); }}
          items={[downloadItem]}
          isDarkMode={isDarkMode}
          accentColor={MODE_COLOR}
        />
      )}
    </div>
  );
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Deterministic poster gradient for glimpses without a real thumbnail — the
// same conversation id always renders the same frame, so the Reel grid stays
// stable across re-renders. Real lastMessageThumbnail wins when present.
const POSTER_HUES = ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#0ea5e9', '#06b6d4', '#14b8a6', '#64748b'];
function posterGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const a = POSTER_HUES[h % POSTER_HUES.length];
  const b = POSTER_HUES[(h >> 3) % POSTER_HUES.length];
  // 8-digit hex (#rrggbbaa) — ~25%/20% tints over the black letterbox.
  return `linear-gradient(150deg, ${a}40, transparent 62%), linear-gradient(330deg, ${b}33, transparent 58%)`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

export default Glimpse;
