// Message Pinning & Highlights System
import React, { useState, useMemo } from 'react';

interface PinnedMessage {
  id: string;
  messageId: string;
  text: string;
  sender: string;
  timestamp: string;
  pinnedBy: string;
  pinnedAt: string;
  category: 'important' | 'action' | 'reference' | 'decision' | 'custom';
  color?: string;
  note?: string;
}

interface HighlightedSegment {
  id: string;
  messageId: string;
  startIndex: number;
  endIndex: number;
  text: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
  label?: string;
  createdBy: string;
  createdAt: string;
}

interface MessagePinningProps {
  pinnedMessages: PinnedMessage[];
  highlights: HighlightedSegment[];
  onUnpin: (id: string) => void;
  onJumpToMessage: (messageId: string) => void;
  onEditPin?: (id: string, updates: Partial<PinnedMessage>) => void;
  onRemoveHighlight?: (id: string) => void;
  onCategoryChange?: (id: string, category: PinnedMessage['category']) => void;
  compact?: boolean;
}

const categoryConfig = {
  important: { icon: 'fa-star', color: 'amber', label: 'Important' },
  action: { icon: 'fa-bolt', color: 'red', label: 'Action Item' },
  reference: { icon: 'fa-bookmark', color: 'blue', label: 'Reference' },
  decision: { icon: 'fa-gavel', color: 'purple', label: 'Decision' },
  custom: { icon: 'fa-tag', color: 'zinc', label: 'Custom' }
};

const highlightColors = {
  yellow: 'bg-yellow-200 dark:bg-yellow-900/60',
  green: 'bg-green-200 dark:bg-green-900/60',
  blue: 'bg-blue-200 dark:bg-blue-900/60',
  pink: 'bg-pink-200 dark:bg-pink-900/60',
  purple: 'bg-purple-200 dark:bg-purple-900/60'
};

export const MessagePinning: React.FC<MessagePinningProps> = ({
  pinnedMessages,
  highlights,
  onUnpin,
  onJumpToMessage,
  onEditPin,
  onRemoveHighlight,
  onCategoryChange,
  compact = false
}) => {
  const [activeTab, setActiveTab] = useState<'pinned' | 'highlights'>('pinned');
  const [filterCategory, setFilterCategory] = useState<PinnedMessage['category'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');

  // Group pinned messages by category
  const groupedPins = useMemo(() => {
    if (!pinnedMessages || pinnedMessages.length === 0) return {} as Record<string, PinnedMessage[]>;
    const filtered = pinnedMessages.filter(pin => {
      if (filterCategory !== 'all' && pin.category !== filterCategory) return false;
      if (searchQuery && !pin.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    const groups: Record<string, PinnedMessage[]> = {};
    filtered.forEach(pin => {
      if (!groups[pin.category]) groups[pin.category] = [];
      groups[pin.category].push(pin);
    });
    return groups;
  }, [pinnedMessages, filterCategory, searchQuery]);

  // Group highlights by color
  const groupedHighlights = useMemo(() => {
    if (!highlights || highlights.length === 0) return {} as Record<string, HighlightedSegment[]>;
    const filtered = highlights.filter(h => {
      if (searchQuery && !h.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    const groups: Record<string, HighlightedSegment[]> = {};
    filtered.forEach(h => {
      if (!groups[h.color]) groups[h.color] = [];
      groups[h.color].push(h);
    });
    return groups;
  }, [highlights, searchQuery]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleSaveNote = (id: string) => {
    onEditPin?.(id, { note: editNote });
    setEditingId(null);
    setEditNote('');
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {pinnedMessages && pinnedMessages.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
            <i className="fa-solid fa-thumbtack text-xs" />
            <span className="text-xs font-medium">{pinnedMessages.length}</span>
          </div>
        )}
        {highlights && highlights.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400">
            <i className="fa-solid fa-highlighter text-xs" />
            <span className="text-xs font-medium">{highlights.length}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <i className="fa-solid fa-thumbtack text-amber-500 text-sm" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Pins & Highlights</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {pinnedMessages?.length || 0} pins, {highlights?.length || 0} highlights
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('pinned')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeTab === 'pinned'
                ? 'bg-white dark:bg-zinc-600 text-zinc-800 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
            }`}
          >
            <i className="fa-solid fa-thumbtack" />
            Pinned ({pinnedMessages?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('highlights')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              activeTab === 'highlights'
                ? 'bg-white dark:bg-zinc-600 text-zinc-800 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
            }`}
          >
            <i className="fa-solid fa-highlighter" />
            Highlights ({highlights?.length || 0})
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <i className="fa-solid fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white placeholder-zinc-400"
            />
          </div>
          {activeTab === 'pinned' && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as PinnedMessage['category'] | 'all')}
              className="px-2 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
            >
              <option value="all">All Categories</option>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {activeTab === 'pinned' ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {Object.keys(groupedPins).length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-3">
                  <i className="fa-solid fa-thumbtack text-zinc-400 text-lg" />
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No pinned messages</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                  Pin important messages to find them quickly
                </p>
              </div>
            ) : (
              Object.entries(groupedPins).map(([category, pins]) => {
                const config = categoryConfig[category as keyof typeof categoryConfig];
                return (
                  <div key={category}>
                    <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">
                      <div className="flex items-center gap-2">
                        <i className={`fa-solid ${config.icon} text-${config.color}-500 text-xs`} />
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          {config.label} ({pins.length})
                        </span>
                      </div>
                    </div>
                    {pins.map(pin => (
                      <div
                        key={pin.id}
                        className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-${config.color}-100 dark:bg-${config.color}-900/40`}>
                            <i className={`fa-solid ${config.icon} text-${config.color}-500 text-sm`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-zinc-800 dark:text-white line-clamp-2">
                                  {pin.text}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                    {pin.sender}
                                  </span>
                                  <span className="text-[10px] text-zinc-400">•</span>
                                  <span className="text-[10px] text-zinc-400">
                                    {formatDate(pin.timestamp)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => onJumpToMessage(pin.messageId)}
                                  className="p-1 text-zinc-400 hover:text-indigo-500 transition"
                                  title="Jump to message"
                                >
                                  <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                                </button>
                                <button
                                  onClick={() => onUnpin(pin.id)}
                                  className="p-1 text-zinc-400 hover:text-red-500 transition"
                                  title="Unpin"
                                >
                                  <i className="fa-solid fa-times text-xs" />
                                </button>
                              </div>
                            </div>

                            {/* Note */}
                            {editingId === pin.id ? (
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editNote}
                                  onChange={(e) => setEditNote(e.target.value)}
                                  placeholder="Add a note..."
                                  className="flex-1 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveNote(pin.id)}
                                  className="px-2 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : pin.note ? (
                              <div
                                className="mt-2 p-2 bg-zinc-50 dark:bg-zinc-900 rounded text-[10px] text-zinc-600 dark:text-zinc-400 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                onClick={() => {
                                  setEditingId(pin.id);
                                  setEditNote(pin.note || '');
                                }}
                              >
                                <i className="fa-solid fa-note-sticky mr-1" />
                                {pin.note}
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingId(pin.id);
                                  setEditNote('');
                                }}
                                className="mt-2 text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                              >
                                + Add note
                              </button>
                            )}

                            {/* Category selector */}
                            {onCategoryChange && (
                              <div className="flex items-center gap-1 mt-2">
                                {Object.entries(categoryConfig).map(([key, cfg]) => (
                                  <button
                                    key={key}
                                    onClick={() => onCategoryChange(pin.id, key as PinnedMessage['category'])}
                                    className={`p-1 rounded transition ${
                                      pin.category === key
                                        ? `bg-${cfg.color}-100 dark:bg-${cfg.color}-900/40 text-${cfg.color}-500`
                                        : 'text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400'
                                    }`}
                                    title={cfg.label}
                                  >
                                    <i className={`fa-solid ${cfg.icon} text-[10px]`} />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {Object.keys(groupedHighlights).length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-3">
                  <i className="fa-solid fa-highlighter text-zinc-400 text-lg" />
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No highlights</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                  Highlight text in messages to save key passages
                </p>
              </div>
            ) : (
              Object.entries(groupedHighlights).map(([color, items]) => (
                <div key={color}>
                  <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${highlightColors[color as keyof typeof highlightColors]}`} />
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 capitalize">
                        {color} ({items.length})
                      </span>
                    </div>
                  </div>
                  {items.map(highlight => (
                    <div
                      key={highlight.id}
                      className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-1 h-full rounded-full self-stretch ${highlightColors[highlight.color]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm text-zinc-800 dark:text-white px-1 rounded ${highlightColors[highlight.color]}`}>
                                "{highlight.text}"
                              </p>
                              {highlight.label && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded">
                                  {highlight.label}
                                </span>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-zinc-400">
                                  {formatDate(highlight.createdAt)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => onJumpToMessage(highlight.messageId)}
                                className="p-1 text-zinc-400 hover:text-indigo-500 transition"
                                title="Jump to message"
                              >
                                <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                              </button>
                              {onRemoveHighlight && (
                                <button
                                  onClick={() => onRemoveHighlight(highlight.id)}
                                  className="p-1 text-zinc-400 hover:text-red-500 transition"
                                  title="Remove highlight"
                                >
                                  <i className="fa-solid fa-times text-xs" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Pin button for individual messages
export const PinButton: React.FC<{
  isPinned: boolean;
  onClick: () => void;
  size?: 'sm' | 'md';
}> = ({ isPinned, onClick, size = 'sm' }) => {
  return (
    <button
      onClick={onClick}
      className={`p-1 rounded transition ${
        isPinned
          ? 'text-amber-500 bg-amber-100 dark:bg-amber-900/40'
          : 'text-zinc-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
      }`}
      title={isPinned ? 'Unpin' : 'Pin message'}
    >
      <i className={`fa-solid fa-thumbtack ${size === 'sm' ? 'text-xs' : 'text-sm'}`} />
    </button>
  );
};

// Highlight toolbar for text selection
export const HighlightToolbar: React.FC<{
  position: { x: number; y: number };
  onHighlight: (color: HighlightedSegment['color']) => void;
  onClose: () => void;
}> = ({ position, onHighlight, onClose }) => {
  const colors: Array<{ color: HighlightedSegment['color']; className: string }> = [
    { color: 'yellow', className: 'bg-yellow-400 hover:bg-yellow-500' },
    { color: 'green', className: 'bg-green-400 hover:bg-green-500' },
    { color: 'blue', className: 'bg-blue-400 hover:bg-blue-500' },
    { color: 'pink', className: 'bg-pink-400 hover:bg-pink-500' },
    { color: 'purple', className: 'bg-purple-400 hover:bg-purple-500' }
  ];

  return (
    <div
      className="fixed z-50 flex items-center gap-1 p-1.5 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700"
      style={{ left: position.x, top: position.y }}
    >
      {colors.map(({ color, className }) => (
        <button
          key={color}
          onClick={() => {
            onHighlight(color);
            onClose();
          }}
          className={`w-5 h-5 rounded-full ${className} transition-transform hover:scale-110`}
          title={`Highlight ${color}`}
        />
      ))}
      <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
      <button
        onClick={onClose}
        className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        <i className="fa-solid fa-times text-xs" />
      </button>
    </div>
  );
};

export default MessagePinning;
