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
} from 'lucide-react';
import VoxModeToolbar from '../Relay/VoxModeToolbar';
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
import { summarizeConversation, generateSmartReplies } from '../../services/relay/relayAIService';
import type { ConversationSummary, SmartReply } from '../../services/relay/relayAIService';

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

// Conversation List Item
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

  return (
    <button
      onClick={onClick}
      className={`vvb-conversation-item ${isDarkMode ? 'dark' : 'light'}`}
    >
      {/* Thumbnail or Avatar */}
      <div className="vvb-conv-thumb">
        {conversation.lastMessageThumbnail ? (
          <img src={conversation.lastMessageThumbnail} alt="" />
        ) : (
          <div
            className="vvb-conv-avatar"
            style={{ background: otherParticipants[0]?.avatarColor || '#06B6D4' }}
          >
            {otherParticipants[0]?.name?.[0] || '?'}
          </div>
        )}
      </div>

      <div className="vvb-conv-info">
        <div className="vvb-conv-header">
          <span className="vvb-conv-name">{displayName}</span>
          <span className="vvb-conv-time">
            {conversation.lastMessageAt
              ? formatRelativeTime(conversation.lastMessageAt)
              : 'NEW'}
          </span>
        </div>
        <p className="vvb-conv-preview">{formatConvoPreview(conversation)}</p>
      </div>
    </button>
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
          so a broken AI doesn't dominate the card. */}
      {(hasSummary || isProcessing) && (
        <div className="gl-summary">
          {hasSummary && (
            <>
              <span className="gl-ai-chip">CLAUDE · SUMMARY</span>
              <p className="gl-summary-text">{message.summary}</p>
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

      {/* Caption (when present, distinct from AI summary) */}
      {message.caption && hasSummary && (
        <p className="gl-summary-text" style={{ color: 'var(--gl-ink-cloth)', fontStyle: 'italic' }}>
          “{message.caption}”
        </p>
      )}
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

      {/* Topics */}
      {topics.length > 0 && (
        <div className="gl-topics">
          {topics.slice(0, 6).map((topic, i) => (
            <span key={i} className="gl-topic">{topic}</span>
          ))}
        </div>
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

      {/* Full transcript (collapsed by default) */}
      {message.transcript && (
        <details className="gl-transcript">
          <summary>Full transcript</summary>
          <p>{message.transcript}</p>
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
              style={{ background: contact.avatarColor || '#06B6D4' }}
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

// ============================================
// MAIN COMPONENT
// ============================================

const Glimpse: React.FC<GlimpseProps> = ({
  isDarkMode = true,
  onClose,
  maxDuration = 60,
  initialRecipientId,
  initialRecipientName,
  apiKey,
  contacts = [],
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
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

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
      {/* Header */}
      <VoxModeToolbar
        onBack={() => {
          if (viewMode === 'record' && state.status !== 'idle') {
            discardRecording();
            stopPreview();
          }
          if (viewMode === 'chat' || viewMode === 'record' || viewMode === 'search') {
            setViewMode('conversations');
            setActiveConversationId(null);
            setReplyingTo(null);
          } else {
            onClose?.();
          }
        }}
        modeTitle="Glimpse"
        modeSubtitle="Video · Transcribed · Triaged"
        modeIcon={<Video className="w-5 h-5" />}
        accentColor={MODE_COLOR}
        isDarkMode={isDarkMode}
        showAI={viewMode === 'chat'}
        onSummarize={viewMode === 'chat' ? handleSummarizeConversation : undefined}
        onSmartReplies={viewMode === 'chat' ? handleGenerateSmartReplies : undefined}
        isSummarizing={isGeneratingAI}
        isGeneratingReplies={isGeneratingAI}
        hasContent={viewMode === 'chat' ? (chatHook ? chatHook.messages.length > 0 : false) : false}
        isSelectionMode={isSelectionMode}
        onToggleSelection={() => isSelectionMode ? exitSelectionMode() : enterSelectionMode()}
        onShowHelp={() => setShowShortcutsHelp(true)}
        selectionCount={selectionCount}
        customActions={[
          ...(viewMode === 'conversations' ? [
            {
              icon: <Search className="w-4 h-4" />,
              title: 'Search',
              onClick: () => setViewMode('search'),
            },
            {
              icon: <Video className="w-4 h-4" />,
              label: 'Glimpse',
              title: 'Record a glimpse — camera',
              onClick: () => enterRecorder('cam'),
            },
            ...(canShareScreen ? [{
              icon: <MonitorPlay className="w-4 h-4" />,
              label: 'Walkthrough',
              title: 'Record a walkthrough — screen + camera',
              onClick: () => enterRecorder('cam-screen'),
            }] : []),
          ] : []),
          ...(viewMode === 'chat' ? [
            {
              icon: <Video className="w-4 h-4" />,
              label: 'Reply',
              title: 'Record reply',
              onClick: () => {
                setCaptureMode('cam');
                setViewMode('record');
              },
            },
          ] : []),
        ]}
      >
        {/* Unread badge (conversations view) */}
        {viewMode === 'conversations' && totalUnread > 0 && (
          <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-medium">
            {totalUnread} unread
          </span>
        )}
        {/* Phase 6: Keyboard Shortcuts Help */}
        <button
          type="button"
          onClick={() => setShowShortcutsHelp(true)}
          className="p-2 rounded-xl hover:bg-gray-800/60 text-gray-400 hover:text-white transition-all"
          title="Keyboard Shortcuts"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </VoxModeToolbar>

      {/* Main Content */}
      <main className="vvb-content">
        {/* CONVERSATIONS VIEW */}
        {viewMode === 'conversations' && (
          <div className="vvb-conversations">
            {conversationsLoading ? (
              <div className="vvb-loading">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p>Loading conversations...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="vvb-empty">
                <Video className="w-10 h-10" style={{ color: MODE_COLOR, opacity: 0.7 }} />
                <h3>No glimpses yet</h3>
                <p>Video for the moments words can't carry. Pulse handles the rest.</p>
                <div className="gl-empty-cta-row">
                  <button
                    type="button"
                    onClick={() => enterRecorder('cam')}
                    className="vvb-empty-cta"
                  >
                    <Video className="w-4 h-4" />
                    Record a glimpse
                  </button>
                  {canShareScreen && (
                    <button
                      type="button"
                      onClick={() => enterRecorder('cam-screen')}
                      className="vvb-empty-cta"
                    >
                      <MonitorPlay className="w-4 h-4" />
                      Record a walkthrough
                    </button>
                  )}
                </div>
              </div>
            ) : (
              conversations.map(conv => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  currentUserId={currentUserId}
                  onClick={() => handleSelectConversation(conv)}
                  isDarkMode={isDarkMode}
                />
              ))
            )}
          </div>
        )}

        {/* CHAT VIEW */}
        {viewMode === 'chat' && chatHook && (
          <div className="vvb-chat">
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
              <div className="vvb-messages-list">
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
              <p className="gl-mode-confirm">
                {captureMode === 'cam-screen' ? (
                  <><MonitorPlay className="w-3 h-3" /> Walkthrough · screen + camera</>
                ) : (
                  <><Video className="w-3 h-3" /> Glimpse · camera</>
                )}
              </p>
            )}

            {/* Recipient bar — anchor for the selector popover so it never
                pushes the recorder off the fold. */}
            {state.status === 'idle' && (
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
                    onClick={handleSend}
                    disabled={isSending || selectedRecipients.length === 0}
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

      {/* Smart Replies Panel */}
      {smartReplies.length > 0 && showSmartReplies && (
        <div className="fixed bottom-20 right-4 z-40 w-96">
          <button
            type="button"
            onClick={() => setShowSmartReplies(false)}
            aria-label="Dismiss smart replies"
            className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f2f2f2',
              color: isDarkMode ? '#b4b4b8' : '#52525b',
              border: '1px solid ' + (isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'),
            }}
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatConvoPreview(conversation: GlimpseConversation): string {
  if (conversation.lastMessageCaption) return conversation.lastMessageCaption;
  if (conversation.lastMessageDuration && conversation.lastMessageDuration > 0) {
    return `${formatDuration(conversation.lastMessageDuration)} glimpse`;
  }
  if (conversation.lastMessageAt) return 'Glimpse';
  return 'No glimpses yet';
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
