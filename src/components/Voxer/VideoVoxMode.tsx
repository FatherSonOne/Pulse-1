// VideoVoxMode Component - Full-Featured Video Messaging
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
  Sparkles,
  Loader2,
  Check,
  CheckCheck,
  Eye,
} from 'lucide-react';
import { useVideoVoxRecording } from '../../hooks/useVideoVoxRecording';
import {
  useVideoVoxConversations,
  useVideoVoxMessages,
  useVideoVoxSend,
  useVideoVoxSearch,
} from '../../hooks/useVideoVox';
import { videoVoxService } from '../../services/voxer/videoVoxService';
import type { VideoVoxMessage, VideoVoxConversation, PulseUser } from '../../services/voxer/voxModeTypes';
import './VideoVoxMode.css';

// ============================================
// TYPES
// ============================================

interface VideoVoxModeProps {
  isDarkMode?: boolean;
  onClose?: () => void;
  maxDuration?: number;
  initialRecipientId?: string;
  initialRecipientName?: string;
  contacts?: Array<{ id: string; name: string; avatarColor?: string; handle?: string }>;
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
  conversation: VideoVoxConversation;
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
            style={{ background: otherParticipants[0]?.avatarColor || '#8B5CF6' }}
          >
            {otherParticipants[0]?.name?.[0] || '?'}
          </div>
        )}
      </div>

      <div className="vvb-conv-info">
        <div className="vvb-conv-header">
          <span className="vvb-conv-name">{displayName}</span>
          {conversation.lastMessageAt && (
            <span className="vvb-conv-time">
              {formatRelativeTime(conversation.lastMessageAt)}
            </span>
          )}
        </div>
        <p className="vvb-conv-preview">
          {conversation.lastMessageCaption || `${conversation.lastMessageDuration || 0}s video`}
        </p>
      </div>
    </button>
  );
};

// Message Bubble
const MessageBubble: React.FC<{
  message: VideoVoxMessage;
  isOwn: boolean;
  isDarkMode: boolean;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  onBookmark: () => void;
  onTranscriptClick: (timestamp: number) => void;
  showTranscript: boolean;
  onToggleTranscript: () => void;
}> = ({
  message,
  isOwn,
  isDarkMode,
  onReaction,
  onReply,
  onBookmark,
  onTranscriptClick,
  showTranscript,
  onToggleTranscript,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Get total reaction count
  const totalReactions = Object.values(message.reactions || {}).reduce(
    (sum, users) => sum + users.length,
    0
  );

  return (
    <div className={`vvb-message ${isOwn ? 'own' : 'other'} ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Reply context */}
      {message.replyToId && message.quotedText && (
        <div className="vvb-reply-context">
          <Reply className="w-3 h-3" />
          <span>{message.quotedText.substring(0, 50)}...</span>
        </div>
      )}

      {/* Video Container */}
      <div className="vvb-message-video-wrap">
        <div
          className="vvb-message-video-container"
          onClick={togglePlay}
        >
          <video
            ref={videoRef}
            src={message.videoUrl}
            poster={message.thumbnailUrl}
            className="vvb-message-video"
            playsInline
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onEnded={() => setIsPlaying(false)}
          />

          {/* Play/Pause overlay */}
          {!isPlaying && (
            <div className="vvb-play-overlay">
              <Play className="w-8 h-8" />
            </div>
          )}

          {/* Duration badge */}
          <div className="vvb-duration-badge">
            {formatDuration(message.duration)}
          </div>

          {/* AI Processing indicator */}
          {message.processingStatus === 'transcribing' && (
            <div className="vvb-processing-badge">
              <Sparkles className="w-3 h-3 animate-pulse" />
              <span>AI Processing...</span>
            </div>
          )}
        </div>

        {/* Quick reaction bar */}
        <div className="vvb-quick-reactions">
          {REACTION_EMOJIS.slice(0, 3).map(({ emoji }) => (
            <button
              key={emoji}
              onClick={() => onReaction(emoji)}
              className="vvb-quick-reaction"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => setShowReactions(!showReactions)}
            className="vvb-more-reactions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {/* Full reaction picker */}
        {showReactions && (
          <div className="vvb-reaction-picker">
            {REACTION_EMOJIS.map(({ emoji, label }) => (
              <button
                key={emoji}
                onClick={() => {
                  onReaction(emoji);
                  setShowReactions(false);
                }}
                title={label}
                className="vvb-reaction-btn"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Caption */}
      {message.caption && (
        <p className="vvb-message-caption">{message.caption}</p>
      )}

      {/* Message info row */}
      <div className="vvb-message-info">
        <span className="vvb-message-time">
          {formatTime(message.createdAt)}
        </span>

        {/* Status indicators */}
        {isOwn && (
          <span className="vvb-message-status">
            {message.status === 'viewed' ? (
              <Eye className="w-3 h-3 text-blue-400" />
            ) : message.status === 'delivered' ? (
              <CheckCheck className="w-3 h-3 text-gray-400" />
            ) : (
              <Check className="w-3 h-3 text-gray-400" />
            )}
          </span>
        )}

        {/* Reactions summary */}
        {totalReactions > 0 && (
          <div className="vvb-reactions-summary">
            {Object.entries(message.reactions || {}).slice(0, 3).map(([emoji, users]) => (
              <span key={emoji} className="vvb-reaction-count">
                {emoji} {users.length}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Transcript section */}
      {message.transcript && (
        <div className="vvb-transcript-section">
          <button
            onClick={onToggleTranscript}
            className="vvb-transcript-toggle"
          >
            <FileText className="w-4 h-4" />
            <span>Transcript</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showTranscript ? 'rotate-180' : ''}`} />
          </button>

          {showTranscript && (
            <div className="vvb-transcript-content">
              <p>{message.transcript}</p>

              {/* AI Summary */}
              {message.summary && (
                <div className="vvb-ai-summary">
                  <Sparkles className="w-3 h-3" />
                  <span>Summary: {message.summary}</span>
                </div>
              )}

              {/* Topics */}
              {message.topics && message.topics.length > 0 && (
                <div className="vvb-topics">
                  {message.topics.map((topic, i) => (
                    <span key={i} className="vvb-topic-tag">{topic}</span>
                  ))}
                </div>
              )}

              {/* Action Items */}
              {message.actionItems && message.actionItems.length > 0 && (
                <div className="vvb-action-items">
                  <strong>Action Items:</strong>
                  <ul>
                    {message.actionItems.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="vvb-message-actions">
        <button onClick={onReply} title="Reply">
          <Reply className="w-4 h-4" />
        </button>
        <button onClick={onBookmark} title="Bookmark">
          <Bookmark className="w-4 h-4" />
        </button>
        {message.threadCount > 0 && (
          <span className="vvb-thread-count">
            {message.threadCount} {message.threadCount === 1 ? 'reply' : 'replies'}
          </span>
        )}
      </div>
    </div>
  );
};

// Recipient Selector
const RecipientSelector: React.FC<{
  contacts: Array<{ id: string; name: string; avatarColor?: string; handle?: string }>;
  selectedIds: string[];
  onSelect: (id: string) => void;
  isDarkMode: boolean;
}> = ({ contacts, selectedIds, onSelect, isDarkMode }) => {
  const [search, setSearch] = useState('');

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.handle?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`vvb-recipient-selector ${isDarkMode ? 'dark' : 'light'}`}>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search contacts..."
        className="vvb-recipient-search"
      />

      <div className="vvb-recipient-list">
        {filtered.map(contact => (
          <button
            key={contact.id}
            onClick={() => onSelect(contact.id)}
            className={`vvb-recipient-item ${selectedIds.includes(contact.id) ? 'selected' : ''}`}
          >
            <div
              className="vvb-recipient-avatar"
              style={{ background: contact.avatarColor || '#8B5CF6' }}
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

const VideoVoxMode: React.FC<VideoVoxModeProps> = ({
  isDarkMode = true,
  onClose,
  maxDuration = 60,
  initialRecipientId,
  initialRecipientName,
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
  const [replyingTo, setReplyingTo] = useState<VideoVoxMessage | null>(null);
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(new Set());
  const [showRecipientSelector, setShowRecipientSelector] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Hooks
  const { conversations, isLoading: conversationsLoading, totalUnread } = useVideoVoxConversations();
  const { sendToRecipients, isSending, progress, error: sendError } = useVideoVoxSend();
  const { results: searchResults, isSearching, search: performSearch } = useVideoVoxSearch();
  const [searchQuery, setSearchQuery] = useState('');

  // Recording hook
  const {
    state,
    isRecording,
    isPreviewing,
    duration,
    previewUrl,
    startPreview,
    stopPreview,
    flipCamera,
    startRecording,
    stopRecording,
    discardRecording,
    getRecording,
    videoRef,
  } = useVideoVoxRecording({
    maxDuration,
    videoQuality: '720p',
    facingMode: 'user',
  });

  // Chat messages (when viewing a conversation)
  const chatHook = activeConversationId
    ? useVideoVoxMessages({ conversationId: activeConversationId })
    : null;

  // Get current user ID
  useEffect(() => {
    videoVoxService.ensureUserId().then(setCurrentUserId);
  }, []);

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

  // Handlers
  const handleRecordClick = () => {
    if (state.status === 'idle') {
      startPreview();
    } else if (state.status === 'previewing') {
      startRecording();
    } else if (state.status === 'recording') {
      stopRecording();
    }
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
      discardRecording();
      setCaption('');
      setReplyingTo(null);
      setViewMode('conversations');
    }
  };

  const handleSelectConversation = (conversation: VideoVoxConversation) => {
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

  const handleReply = (message: VideoVoxMessage) => {
    setReplyingTo(message);
    setViewMode('record');
  };

  const handleBookmark = async (messageId: string) => {
    await videoVoxService.toggleBookmark(messageId);
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
      <header className="vvb-header">
        <div className="vvb-header-left">
          <button
            onClick={() => {
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
            className="vvb-back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="vvb-title-group">
            <h1 className="vvb-title">
              <span>🎬</span>
              Video Vox
            </h1>
            <p className="vvb-subtitle">
              {viewMode === 'conversations' && `${totalUnread} unread`}
              {viewMode === 'chat' && 'Conversation'}
              {viewMode === 'record' && (
                selectedRecipients.length > 0
                  ? `To ${selectedRecipients.length} ${selectedRecipients.length === 1 ? 'person' : 'people'}`
                  : 'Select recipients'
              )}
              {viewMode === 'search' && 'Search Videos'}
            </p>
          </div>
        </div>

        <div className="vvb-header-right">
          {viewMode === 'conversations' && (
            <>
              <button
                onClick={() => setViewMode('search')}
                className="vvb-header-btn"
                title="Search"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setSelectedRecipients([]);
                  setViewMode('record');
                }}
                className="vvb-header-btn primary"
                title="New Video"
              >
                <Video className="w-5 h-5" />
              </button>
            </>
          )}
          {viewMode === 'chat' && (
            <button
              onClick={() => setViewMode('record')}
              className="vvb-header-btn primary"
              title="Record Reply"
            >
              <Video className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

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
                <Video className="w-12 h-12 opacity-50" />
                <h3>No video conversations yet</h3>
                <p>Record and send your first video message!</p>
                <button
                  onClick={() => setViewMode('record')}
                  className="vvb-empty-cta"
                >
                  <Video className="w-5 h-5" />
                  Record Video
                </button>
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
            ) : (
              <div className="vvb-messages-list">
                {chatHook.messages.map(message => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={message.senderId === currentUserId}
                    isDarkMode={isDarkMode}
                    onReaction={(emoji) => handleReaction(message.id, emoji)}
                    onReply={() => handleReply(message)}
                    onBookmark={() => handleBookmark(message.id)}
                    onTranscriptClick={() => {}}
                    showTranscript={expandedTranscripts.has(message.id)}
                    onToggleTranscript={() => toggleTranscript(message.id)}
                  />
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
          <>
            {/* Recipient selector toggle */}
            {state.status === 'idle' && (
              <button
                onClick={() => setShowRecipientSelector(!showRecipientSelector)}
                className="vvb-recipient-toggle"
              >
                <Users className="w-4 h-4" />
                {selectedRecipients.length === 0
                  ? 'Select recipients'
                  : `${selectedRecipients.length} selected`}
                <ChevronDown className={`w-4 h-4 ${showRecipientSelector ? 'rotate-180' : ''}`} />
              </button>
            )}

            {/* Recipient selector dropdown */}
            {showRecipientSelector && state.status === 'idle' && (
              <RecipientSelector
                contacts={contacts}
                selectedIds={selectedRecipients}
                onSelect={handleToggleRecipient}
                isDarkMode={isDarkMode}
              />
            )}

            {/* Reply context */}
            {replyingTo && (
              <div className="vvb-replying-to">
                <Reply className="w-4 h-4" />
                <span>Replying to {replyingTo.senderName}</span>
                <button onClick={() => setReplyingTo(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Video Bubble */}
            <div className={`vvb-video-bubble ${isRecording ? 'recording' : ''}`}>
              <div className="vvb-video-inner">
                {/* Video Preview/Recording */}
                {state.status === 'ready' && previewUrl ? (
                  <video
                    src={previewUrl}
                    className="vvb-video"
                    controls
                    loop
                    playsInline
                  />
                ) : (
                  <video
                    ref={videoRef}
                    className="vvb-video mirror"
                    playsInline
                    muted
                  />
                )}

                {/* Idle state overlay */}
                {state.status === 'idle' && (
                  <div className="vvb-idle-state">
                    <div className="vvb-idle-icon">
                      <Video className="w-8 h-8 text-white" />
                    </div>
                    <p className="vvb-idle-text">Tap to start camera</p>
                  </div>
                )}

                {/* Recording indicator and duration */}
                {(isPreviewing || isRecording) && (
                  <div className="vvb-overlay-top">
                    <div className={`vvb-rec-badge ${isRecording ? 'visible' : ''}`}>
                      <div className="vvb-rec-dot" />
                      <span className="vvb-rec-text">REC</span>
                    </div>
                    {(isRecording || state.status === 'ready') && (
                      <div className="vvb-duration">
                        {formatDurationDisplay(duration)} / {formatDurationDisplay(maxDuration)}
                      </div>
                    )}
                  </div>
                )}

                {/* Flip camera button */}
                {(isPreviewing || isRecording) && (
                  <button
                    onClick={flipCamera}
                    className="vvb-flip-btn"
                    title="Flip camera"
                  >
                    <FlipHorizontal className="w-4 h-4" />
                  </button>
                )}

                {/* Error state */}
                {state.error && (
                  <div className="vvb-error">
                    <AlertCircle className="w-10 h-10 vvb-error-icon" />
                    <p className="vvb-error-text">{state.error}</p>
                    <button onClick={startPreview} className="vvb-retry-btn">
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="vvb-controls">
              {state.status === 'ready' ? (
                /* Post-recording controls */
                <>
                  <div className="vvb-caption-wrap">
                    <input
                      type="text"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Add a caption..."
                      className="vvb-caption-input"
                      maxLength={200}
                    />
                  </div>

                  <div className="vvb-controls-row">
                    <button
                      onClick={discardRecording}
                      className="vvb-ctrl-btn danger"
                      title="Discard"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => {
                        discardRecording();
                        startPreview();
                      }}
                      className="vvb-ctrl-btn"
                      title="Re-record"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>

                  <button
                    onClick={handleSend}
                    disabled={isSending || selectedRecipients.length === 0}
                    className="vvb-send-btn"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending... {progress}%
                      </>
                    ) : selectedRecipients.length === 0 ? (
                      <>
                        <Users className="w-5 h-5" />
                        Select Recipients
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send Video
                      </>
                    )}
                  </button>

                  {sendError && (
                    <p className="text-red-400 text-sm text-center">{sendError}</p>
                  )}
                </>
              ) : (
                /* Recording controls */
                <>
                  <div className="vvb-controls-row">
                    {/* Record button */}
                    <div className="vvb-record-container">
                      {/* Progress ring */}
                      {isRecording && (
                        <svg className="vvb-progress-ring" viewBox="0 0 84 84">
                          <defs>
                            <linearGradient id="vvb-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#8B5CF6" />
                              <stop offset="100%" stopColor="#EC4899" />
                            </linearGradient>
                          </defs>
                          <circle
                            className="track"
                            cx="42"
                            cy="42"
                            r={ringRadius}
                          />
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
                        onClick={handleRecordClick}
                        disabled={state.status === 'idle' && selectedRecipients.length === 0 && contacts.length > 0}
                        className={`vvb-record-btn ${isRecording ? 'recording' : ''}`}
                      >
                        <div className="vvb-record-icon" />
                      </button>
                    </div>
                  </div>

                  <p className="vvb-hint">
                    {state.status === 'idle' && selectedRecipients.length === 0 && contacts.length > 0 && 'Select recipients first'}
                    {state.status === 'idle' && (selectedRecipients.length > 0 || contacts.length === 0) && 'Tap to start camera'}
                    {isPreviewing && 'Tap to start recording'}
                    {isRecording && 'Tap to stop recording'}
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </main>
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

export default VideoVoxMode;
