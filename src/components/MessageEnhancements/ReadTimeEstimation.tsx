import React, { useState, useMemo, useCallback } from 'react';

// Types
interface ReadingStats {
  totalMessages: number;
  totalWords: number;
  avgReadTimePerMessage: number; // seconds
  readingSpeed: number; // words per minute
  unreadEstimate: number; // minutes
}

interface MessageReadTime {
  id: string;
  sender: string;
  preview: string;
  wordCount: number;
  estimatedSeconds: number;
  hasAttachments: boolean;
  attachmentType?: 'image' | 'document' | 'video' | 'audio';
  isRead: boolean;
}

interface ReadingPreferences {
  wordsPerMinute: number;
  includeImages: boolean;
  imageViewTime: number; // seconds per image
  includeDocuments: boolean;
  documentPageTime: number; // seconds per page
}

interface ReadTimeEstimationProps {
  messages?: MessageReadTime[];
  onMarkAsRead?: (messageId: string) => void;
  onPreferencesChange?: (prefs: ReadingPreferences) => void;
}

// Mock data generator
const generateMockMessages = (): MessageReadTime[] => [
  {
    id: '1',
    sender: 'Alice Chen',
    preview: 'Here\'s the quarterly report summary with all the key metrics and performance indicators we discussed in our last meeting...',
    wordCount: 450,
    estimatedSeconds: 108,
    hasAttachments: true,
    attachmentType: 'document',
    isRead: false
  },
  {
    id: '2',
    sender: 'Bob Smith',
    preview: 'Quick update on the project timeline - we\'re on track for the Friday deadline.',
    wordCount: 65,
    estimatedSeconds: 16,
    hasAttachments: false,
    isRead: false
  },
  {
    id: '3',
    sender: 'Carol Davis',
    preview: 'Check out these design mockups for the new feature. Let me know your thoughts!',
    wordCount: 42,
    estimatedSeconds: 35,
    hasAttachments: true,
    attachmentType: 'image',
    isRead: false
  },
  {
    id: '4',
    sender: 'David Wilson',
    preview: 'The technical specification document is ready for review. I\'ve included detailed architecture diagrams and API documentation...',
    wordCount: 890,
    estimatedSeconds: 214,
    hasAttachments: true,
    attachmentType: 'document',
    isRead: true
  },
  {
    id: '5',
    sender: 'Eve Thompson',
    preview: 'Meeting recording from yesterday\'s standup. Key decisions are timestamped.',
    wordCount: 28,
    estimatedSeconds: 127,
    hasAttachments: true,
    attachmentType: 'video',
    isRead: false
  },
  {
    id: '6',
    sender: 'Frank Miller',
    preview: 'Thanks!',
    wordCount: 1,
    estimatedSeconds: 2,
    hasAttachments: false,
    isRead: true
  }
];

export const ReadTimeEstimation: React.FC<ReadTimeEstimationProps> = ({
  messages: propMessages,
  onMarkAsRead,
  onPreferencesChange
}) => {
  const [messages, setMessages] = useState<MessageReadTime[]>(propMessages || generateMockMessages);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<ReadingPreferences>({
    wordsPerMinute: 250,
    includeImages: true,
    imageViewTime: 10,
    includeDocuments: true,
    documentPageTime: 30
  });
  const [sortBy, setSortBy] = useState<'time' | 'sender' | 'length'>('time');

  const updatePreference = useCallback(<K extends keyof ReadingPreferences>(
    key: K,
    value: ReadingPreferences[K]
  ) => {
    setPreferences(prev => {
      const updated = { ...prev, [key]: value };
      onPreferencesChange?.(updated);
      return updated;
    });
  }, [onPreferencesChange]);

  const stats = useMemo((): ReadingStats => {
    const unreadMessages = messages.filter(m => !m.isRead);
    const totalWords = messages.reduce((sum, m) => sum + m.wordCount, 0);
    const unreadSeconds = unreadMessages.reduce((sum, m) => sum + m.estimatedSeconds, 0);

    return {
      totalMessages: messages.length,
      totalWords,
      avgReadTimePerMessage: messages.length > 0
        ? Math.round(messages.reduce((sum, m) => sum + m.estimatedSeconds, 0) / messages.length)
        : 0,
      readingSpeed: preferences.wordsPerMinute,
      unreadEstimate: Math.ceil(unreadSeconds / 60)
    };
  }, [messages, preferences.wordsPerMinute]);

  const sortedMessages = useMemo(() => {
    const sorted = [...messages];
    switch (sortBy) {
      case 'time':
        return sorted.sort((a, b) => b.estimatedSeconds - a.estimatedSeconds);
      case 'sender':
        return sorted.sort((a, b) => a.sender.localeCompare(b.sender));
      case 'length':
        return sorted.sort((a, b) => b.wordCount - a.wordCount);
      default:
        return sorted;
    }
  }, [messages, sortBy]);

  const unreadMessages = useMemo(() => sortedMessages.filter(m => !m.isRead), [sortedMessages]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getAttachmentIcon = (type?: MessageReadTime['attachmentType']): string => {
    switch (type) {
      case 'image': return 'fa-image';
      case 'document': return 'fa-file-lines';
      case 'video': return 'fa-video';
      case 'audio': return 'fa-headphones';
      default: return 'fa-paperclip';
    }
  };

  const getTimeColor = (seconds: number): string => {
    if (seconds < 30) return 'text-green-500 bg-green-50 dark:bg-green-900/20';
    if (seconds < 120) return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
    return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20';
  };

  const handleMarkAsRead = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m));
    onMarkAsRead?.(id);
  };

  const handleMarkAllAsRead = () => {
    setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
  };

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm">
              <i className="fa-solid fa-hourglass-half text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Time to Catch Up</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.unreadEstimate > 0 ? `~${stats.unreadEstimate} min` : 'All caught up!'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-zinc-800/50 transition"
          >
            <i className="fa-solid fa-gear text-zinc-500" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/50 dark:bg-zinc-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-zinc-900 dark:text-white">{unreadMessages.length}</p>
            <p className="text-xs text-zinc-500">Unread</p>
          </div>
          <div className="bg-white/50 dark:bg-zinc-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-zinc-900 dark:text-white">{stats.totalWords.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Words</p>
          </div>
          <div className="bg-white/50 dark:bg-zinc-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-zinc-900 dark:text-white">{formatTime(stats.avgReadTimePerMessage)}</p>
            <p className="text-xs text-zinc-500">Avg Read</p>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-4">
          <p className="text-sm font-medium text-zinc-900 dark:text-white">Reading Preferences</p>

          {/* Words per minute */}
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Reading Speed</span>
              <span>{preferences.wordsPerMinute} WPM</span>
            </div>
            <input
              type="range"
              min={100}
              max={500}
              value={preferences.wordsPerMinute}
              onChange={(e) => updatePreference('wordsPerMinute', Number(e.target.value))}
              className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-zinc-400 mt-1">
              <span>Slow</span>
              <span>Average</span>
              <span>Fast</span>
            </div>
          </div>

          {/* Image time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.includeImages}
                onChange={(e) => updatePreference('includeImages', e.target.checked)}
                className="rounded text-blue-500"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Include image viewing time</span>
            </div>
            {preferences.includeImages && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={preferences.imageViewTime}
                  onChange={(e) => updatePreference('imageViewTime', Number(e.target.value))}
                  className="w-14 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
                <span className="text-xs text-zinc-500">sec</span>
              </div>
            )}
          </div>

          {/* Document time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.includeDocuments}
                onChange={(e) => updatePreference('includeDocuments', e.target.checked)}
                className="rounded text-blue-500"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Include document reading time</span>
            </div>
            {preferences.includeDocuments && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={preferences.documentPageTime}
                  onChange={(e) => updatePreference('documentPageTime', Number(e.target.value))}
                  className="w-14 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
                <span className="text-xs text-zinc-500">sec/pg</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sort & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Sort by:</span>
          <div className="flex gap-1">
            {[
              { id: 'time' as const, label: 'Time', icon: 'fa-clock' },
              { id: 'sender' as const, label: 'Sender', icon: 'fa-user' },
              { id: 'length' as const, label: 'Length', icon: 'fa-text-width' }
            ].map(option => (
              <button
                key={option.id}
                onClick={() => setSortBy(option.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  sortBy === option.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <i className={`fa-solid ${option.icon} mr-1`} />
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {unreadMessages.length > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Message List */}
      <div className="space-y-2">
        {unreadMessages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
              <i className="fa-solid fa-check text-green-500" />
            </div>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">All caught up!</p>
            <p className="text-xs text-zinc-500">No unread messages</p>
          </div>
        ) : (
          unreadMessages.map(msg => (
            <div
              key={msg.id}
              className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700 transition group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                    {msg.sender.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{msg.sender}</p>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>{msg.wordCount} words</span>
                      {msg.hasAttachments && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <i className={`fa-solid ${getAttachmentIcon(msg.attachmentType)}`} />
                            {msg.attachmentType}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTimeColor(msg.estimatedSeconds)}`}>
                    <i className="fa-solid fa-clock mr-1" />
                    {formatTime(msg.estimatedSeconds)}
                  </span>
                  <button
                    onClick={() => handleMarkAsRead(msg.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
                    title="Mark as read"
                  >
                    <i className="fa-solid fa-check text-zinc-400 text-xs" />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                {msg.preview}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Reading Speed Guide */}
      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          <i className="fa-solid fa-lightbulb text-yellow-500 mr-1.5" />
          Reading Speed Guide
        </p>
        <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>&lt; 30s: Quick scan</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>30s-2m: Normal read</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span>&gt; 2m: Deep read</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Compact Read Time Badge
interface ReadTimeBadgeProps {
  seconds: number;
  showLabel?: boolean;
}

export const ReadTimeBadge: React.FC<ReadTimeBadgeProps> = ({ seconds, showLabel = true }) => {
  const formatTime = (s: number): string => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m`;
  };

  const getColor = (): string => {
    if (seconds < 30) return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
    if (seconds < 120) return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
  };

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${getColor()}`}>
      <i className="fa-solid fa-clock text-[10px]" />
      {showLabel && <span>{formatTime(seconds)} read</span>}
      {!showLabel && <span>{formatTime(seconds)}</span>}
    </span>
  );
};
