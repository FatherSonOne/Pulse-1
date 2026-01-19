import React, { useState, useMemo, useCallback } from 'react';

// Types
interface MessageVersion {
  id: string;
  versionNumber: number;
  content: string;
  timestamp: Date;
  editedBy: string;
  changeType: 'created' | 'edited' | 'deleted' | 'restored';
  diff?: {
    added: string[];
    removed: string[];
  };
}

interface VersionedMessage {
  id: string;
  currentContent: string;
  sender: string;
  createdAt: Date;
  lastEditedAt?: Date;
  versions: MessageVersion[];
  isDeleted: boolean;
}

interface MessageVersioningProps {
  messageId?: string;
  onRestoreVersion?: (messageId: string, versionId: string) => void;
  onCompareVersions?: (versionA: string, versionB: string) => void;
}

// Mock data generator
const generateMockVersionedMessages = (): VersionedMessage[] => [
  {
    id: '1',
    currentContent: 'The meeting has been rescheduled to 3:00 PM tomorrow. Please confirm your availability.',
    sender: 'Alice Chen',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    lastEditedAt: new Date(Date.now() - 1000 * 60 * 30),
    isDeleted: false,
    versions: [
      {
        id: 'v1-3',
        versionNumber: 3,
        content: 'The meeting has been rescheduled to 3:00 PM tomorrow. Please confirm your availability.',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        editedBy: 'Alice Chen',
        changeType: 'edited',
        diff: { added: ['3:00 PM tomorrow'], removed: ['2:00 PM today'] }
      },
      {
        id: 'v1-2',
        versionNumber: 2,
        content: 'The meeting has been rescheduled to 2:00 PM today. Please confirm your availability.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        editedBy: 'Alice Chen',
        changeType: 'edited',
        diff: { added: ['rescheduled to 2:00 PM today'], removed: ['at 10:00 AM'] }
      },
      {
        id: 'v1-1',
        versionNumber: 1,
        content: 'The meeting is at 10:00 AM. Please confirm your availability.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
        editedBy: 'Alice Chen',
        changeType: 'created'
      }
    ]
  },
  {
    id: '2',
    currentContent: 'Budget approved: $50,000 for Q1 marketing campaign.',
    sender: 'Bob Smith',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    lastEditedAt: new Date(Date.now() - 1000 * 60 * 60),
    isDeleted: false,
    versions: [
      {
        id: 'v2-2',
        versionNumber: 2,
        content: 'Budget approved: $50,000 for Q1 marketing campaign.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        editedBy: 'Bob Smith',
        changeType: 'edited',
        diff: { added: ['$50,000'], removed: ['$45,000'] }
      },
      {
        id: 'v2-1',
        versionNumber: 1,
        content: 'Budget approved: $45,000 for Q1 marketing campaign.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
        editedBy: 'Bob Smith',
        changeType: 'created'
      }
    ]
  },
  {
    id: '3',
    currentContent: '[Message deleted]',
    sender: 'Carol Davis',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
    lastEditedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    isDeleted: true,
    versions: [
      {
        id: 'v3-2',
        versionNumber: 2,
        content: '[Message deleted]',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
        editedBy: 'Carol Davis',
        changeType: 'deleted'
      },
      {
        id: 'v3-1',
        versionNumber: 1,
        content: 'Here are the confidential project details we discussed.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72),
        editedBy: 'Carol Davis',
        changeType: 'created'
      }
    ]
  }
];

export const MessageVersioning: React.FC<MessageVersioningProps> = ({
  messageId,
  onRestoreVersion,
  onCompareVersions
}) => {
  const [versionedMessages] = useState<VersionedMessage[]>(generateMockVersionedMessages);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(messageId || null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'timeline' | 'diff'>('timeline');

  const currentMessage = useMemo(() =>
    versionedMessages.find(m => m.id === selectedMessage),
    [versionedMessages, selectedMessage]
  );

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getChangeTypeIcon = (type: MessageVersion['changeType']): string => {
    switch (type) {
      case 'created': return 'fa-plus-circle text-green-500';
      case 'edited': return 'fa-pen-circle text-blue-500';
      case 'deleted': return 'fa-trash text-red-500';
      case 'restored': return 'fa-rotate-left text-purple-500';
    }
  };

  const getChangeTypeLabel = (type: MessageVersion['changeType']): string => {
    switch (type) {
      case 'created': return 'Created';
      case 'edited': return 'Edited';
      case 'deleted': return 'Deleted';
      case 'restored': return 'Restored';
    }
  };

  const toggleVersionSelection = useCallback((versionId: string) => {
    setSelectedVersions(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(v => v !== versionId);
      }
      if (prev.length >= 2) {
        return [prev[1], versionId];
      }
      return [...prev, versionId];
    });
  }, []);

  const handleCompare = useCallback(() => {
    if (selectedVersions.length === 2) {
      onCompareVersions?.(selectedVersions[0], selectedVersions[1]);
    }
  }, [selectedVersions, onCompareVersions]);

  const handleRestore = useCallback((versionId: string) => {
    if (selectedMessage) {
      onRestoreVersion?.(selectedMessage, versionId);
    }
  }, [selectedMessage, onRestoreVersion]);

  const stats = useMemo(() => ({
    totalEdits: versionedMessages.reduce((sum, m) => sum + m.versions.length - 1, 0),
    deletedMessages: versionedMessages.filter(m => m.isDeleted).length,
    messagesWithHistory: versionedMessages.filter(m => m.versions.length > 1).length
  }), [versionedMessages]);

  return (
    <div className="space-y-4">
      {/* Stats Header */}
      <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-violet-200 dark:border-violet-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm">
            <i className="fa-solid fa-clock-rotate-left text-violet-500" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Message History</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-white">Version Control</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/50 dark:bg-zinc-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-violet-600 dark:text-violet-400">{stats.totalEdits}</p>
            <p className="text-xs text-zinc-500">Total Edits</p>
          </div>
          <div className="bg-white/50 dark:bg-zinc-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-violet-600 dark:text-violet-400">{stats.messagesWithHistory}</p>
            <p className="text-xs text-zinc-500">With History</p>
          </div>
          <div className="bg-white/50 dark:bg-zinc-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-red-500">{stats.deletedMessages}</p>
            <p className="text-xs text-zinc-500">Deleted</p>
          </div>
        </div>
      </div>

      {/* Message Selection */}
      {!selectedMessage && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Select a message to view history</p>
          {versionedMessages.map(msg => (
            <button
              key={msg.id}
              onClick={() => setSelectedMessage(msg.id)}
              className={`w-full p-3 rounded-lg border text-left transition ${
                msg.isDeleted
                  ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                  : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-violet-300 dark:hover:border-violet-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                    {msg.sender.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{msg.sender}</p>
                    <p className="text-xs text-zinc-500">{formatTimeAgo(msg.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-400">{msg.versions.length} versions</span>
                  {msg.isDeleted && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                      Deleted
                    </span>
                  )}
                </div>
              </div>
              <p className={`mt-2 text-sm truncate ${msg.isDeleted ? 'text-red-400 italic' : 'text-zinc-600 dark:text-zinc-400'}`}>
                {msg.currentContent}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Version History View */}
      {selectedMessage && currentMessage && (
        <div className="space-y-4">
          {/* Back Button & Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setSelectedMessage(null);
                setCompareMode(false);
                setSelectedVersions([]);
              }}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              <i className="fa-solid fa-arrow-left" />
              Back to messages
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode(viewMode === 'timeline' ? 'diff' : 'timeline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === 'diff'
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <i className={`fa-solid ${viewMode === 'timeline' ? 'fa-code-compare' : 'fa-timeline'} mr-1.5`} />
                {viewMode === 'timeline' ? 'Diff View' : 'Timeline'}
              </button>
              <button
                onClick={() => {
                  setCompareMode(!compareMode);
                  setSelectedVersions([]);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  compareMode
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                }`}
              >
                <i className="fa-solid fa-code-compare mr-1.5" />
                Compare
              </button>
            </div>
          </div>

          {/* Current Message */}
          <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
              <span className="font-medium text-zinc-900 dark:text-white">{currentMessage.sender}</span>
              <span>•</span>
              <span>Current version</span>
              {currentMessage.lastEditedAt && (
                <>
                  <span>•</span>
                  <span>Edited {formatTimeAgo(currentMessage.lastEditedAt)}</span>
                </>
              )}
            </div>
            <p className={`text-sm ${currentMessage.isDeleted ? 'text-red-400 italic' : 'text-zinc-700 dark:text-zinc-300'}`}>
              {currentMessage.currentContent}
            </p>
          </div>

          {/* Compare Mode Selection */}
          {compareMode && (
            <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800">
              <p className="text-xs font-medium text-violet-700 dark:text-violet-300 mb-2">
                <i className="fa-solid fa-info-circle mr-1.5" />
                Select 2 versions to compare
              </p>
              <div className="flex items-center gap-2">
                {selectedVersions.length === 2 ? (
                  <button
                    onClick={handleCompare}
                    className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700"
                  >
                    Compare Selected
                  </button>
                ) : (
                  <span className="text-xs text-violet-500">
                    {selectedVersions.length}/2 selected
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Version Timeline */}
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-200 dark:bg-zinc-700" />

            <div className="space-y-3">
              {currentMessage.versions.map((version, index) => (
                <div key={version.id} className="relative pl-10">
                  {/* Timeline Dot */}
                  <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${
                    compareMode && selectedVersions.includes(version.id)
                      ? 'bg-violet-500 ring-2 ring-violet-300'
                      : 'bg-white dark:bg-zinc-800 border-2 border-zinc-300 dark:border-zinc-600'
                  }`}>
                    {compareMode ? (
                      <input
                        type="checkbox"
                        checked={selectedVersions.includes(version.id)}
                        onChange={() => toggleVersionSelection(version.id)}
                        className="opacity-0 absolute inset-0 cursor-pointer"
                      />
                    ) : null}
                    {selectedVersions.includes(version.id) && (
                      <i className="fa-solid fa-check text-white text-[8px]" />
                    )}
                  </div>

                  {/* Version Card */}
                  <div className={`p-3 rounded-lg border transition ${
                    compareMode
                      ? selectedVersions.includes(version.id)
                        ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-300 dark:border-violet-700'
                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 cursor-pointer hover:border-violet-300'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                  }`}
                    onClick={() => compareMode && toggleVersionSelection(version.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <i className={`fa-solid ${getChangeTypeIcon(version.changeType)}`} />
                        <span className="text-xs font-medium text-zinc-900 dark:text-white">
                          v{version.versionNumber} - {getChangeTypeLabel(version.changeType)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">{formatDate(version.timestamp)}</span>
                        {version.changeType !== 'deleted' && index > 0 && !compareMode && (
                          <button
                            onClick={() => handleRestore(version.id)}
                            className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {version.content}
                    </p>

                    {/* Diff Display */}
                    {viewMode === 'diff' && version.diff && (
                      <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700 space-y-1">
                        {version.diff.removed.map((text, i) => (
                          <div key={`removed-${i}`} className="flex items-center gap-1.5 text-xs">
                            <span className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center">-</span>
                            <span className="text-red-600 dark:text-red-400 line-through">{text}</span>
                          </div>
                        ))}
                        {version.diff.added.map((text, i) => (
                          <div key={`added-${i}`} className="flex items-center gap-1.5 text-xs">
                            <span className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30 text-green-500 flex items-center justify-center">+</span>
                            <span className="text-green-600 dark:text-green-400">{text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Edit History Indicator
interface EditHistoryIndicatorProps {
  versionCount: number;
  lastEditedAt?: Date;
  onClick?: () => void;
}

export const EditHistoryIndicator: React.FC<EditHistoryIndicatorProps> = ({
  versionCount,
  lastEditedAt,
  onClick
}) => {
  if (versionCount <= 1) return null;

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-violet-500 transition"
    >
      <i className="fa-solid fa-pen text-[10px]" />
      <span>edited</span>
      {lastEditedAt && <span>({formatTimeAgo(lastEditedAt)})</span>}
    </button>
  );
};
