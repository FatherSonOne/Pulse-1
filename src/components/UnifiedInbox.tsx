import { useState, useEffect, useMemo, useCallback } from 'react';
import { MessageSource, UnifiedMessage } from '../types';
import { dataService } from '../services/dataService';
import {
  Search,
  Filter,
  RefreshCw,
  Star,
  Mail,
  MailOpen,
  Archive,
  Trash2,
  Clock,
  Tag,
  CheckSquare,
  Square,
  MoreHorizontal,
  Reply,
  Forward,
  Bell,
  BellOff,
  ChevronDown,
  X,
  Sparkles,
  AlertCircle,
  Zap,
  Users,
  Calendar
} from 'lucide-react';
import './UnifiedInbox.css';

/**
 * Enhanced Unified Inbox Component
 * Features: Advanced filtering, bulk actions, smart prioritization, snooze, quick replies
 */

const sourceColors: Record<MessageSource, string> = {
  slack: '#4A154B',
  email: '#EA4335',
  sms: '#34A853',
  pulse: '#4285F4',
  discord: '#5865F2',
  teams: '#464EB8',
  figma: '#F24E1E',
  jira: '#0052CC',
};

const sourceIcons: Record<MessageSource, string> = {
  slack: '💬',
  email: '📧',
  sms: '📱',
  pulse: '🎙️',
  discord: '🎮',
  teams: '👥',
  figma: '🎨',
  jira: '📋',
};

// Priority levels with colors
type Priority = 'urgent' | 'high' | 'normal' | 'low';
const priorityConfig: Record<Priority, { color: string; icon: string; label: string }> = {
  urgent: { color: '#DC2626', icon: '🔴', label: 'Urgent' },
  high: { color: '#F59E0B', icon: '🟠', label: 'High' },
  normal: { color: '#3B82F6', icon: '🔵', label: 'Normal' },
  low: { color: '#6B7280', icon: '⚪', label: 'Low' },
};

// Enhanced display message with additional features
interface DisplayMessage {
  id: string;
  platform: MessageSource;
  content: string;
  timestamp: Date;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  is_snoozed: boolean;
  snooze_until?: Date;
  priority: Priority;
  tags: string[];
  has_attachment: boolean;
  reply_count: number;
  is_mentioned: boolean;
  metadata: {
    senderName: string;
    senderEmail?: string;
    senderAvatar?: string;
    channelName: string;
    threadId?: string;
  };
}

// Filter presets
type FilterPreset = 'all' | 'unread' | 'starred' | 'urgent' | 'mentions' | 'snoozed' | 'archived';

// Snooze options
const snoozeOptions = [
  { label: 'Later today', hours: 3 },
  { label: 'Tomorrow morning', hours: 18 },
  { label: 'Tomorrow afternoon', hours: 24 },
  { label: 'Next week', hours: 168 },
  { label: 'Custom...', hours: -1 },
];

// Quick reply templates
const quickReplies = [
  { label: '👍 Thanks!', message: 'Thanks for reaching out! I\'ll get back to you soon.' },
  { label: '📅 Schedule', message: 'Let me check my calendar and get back to you with availability.' },
  { label: '✅ On it', message: 'Got it! I\'m working on this now.' },
  { label: '🤔 Need more info', message: 'Could you provide more details about this?' },
  { label: '📞 Call me', message: 'This might be easier to discuss on a call. Are you free?' },
];

export default function UnifiedInbox() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<DisplayMessage | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [filterSource, setFilterSource] = useState<MessageSource | 'all'>('all');
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState<string | null>(null);
  const [showQuickReply, setShowQuickReply] = useState<string | null>(null);
  const [showTagMenu, setShowTagMenu] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'sender'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>({});
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Available tags
  const [availableTags] = useState(['important', 'follow-up', 'waiting', 'done', 'project-alpha', 'project-beta']);

  // Determine priority based on content and metadata
  const determinePriority = useCallback((msg: UnifiedMessage): Priority => {
    const content = (msg.text || msg.content || '').toLowerCase();
    const isUrgent = content.includes('urgent') || content.includes('asap') || content.includes('emergency');
    const isHigh = content.includes('important') || content.includes('deadline') || content.includes('today');
    const isMention = content.includes('@') || msg.senderName?.toLowerCase().includes('ceo');

    if (isUrgent) return 'urgent';
    if (isHigh || isMention) return 'high';
    if (msg.priority === 'low') return 'low';
    return 'normal';
  }, []);

  // Load messages from Supabase
  const loadMessages = useCallback(async () => {
    setLoading(true);

    try {
      const unifiedMessages = await dataService.getUnifiedMessages();

      const displayMessages: DisplayMessage[] = unifiedMessages
        .filter(msg => msg && msg.id)
        .map(msg => ({
          id: msg.id,
          platform: msg.source || 'pulse',
          content: msg.text || msg.content || '',
          timestamp: msg.timestamp || new Date(),
          is_read: msg.isRead || false,
          is_starred: msg.starred || false,
          is_archived: false,
          is_snoozed: false,
          priority: determinePriority(msg),
          tags: msg.tags || [],
          has_attachment: false,
          reply_count: 0,
          is_mentioned: (msg.text || msg.content || '').includes('@'),
          metadata: {
            senderName: msg.senderName || 'Unknown',
            senderEmail: msg.senderEmail,
            channelName: msg.channelId || msg.source || 'general',
            threadId: msg.threadId,
          }
        }));

      setMessages(displayMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  }, [determinePriority]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Check for snoozed messages that should be unsnoozed
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setMessages(prev => prev.map(msg => {
        if (msg.is_snoozed && msg.snooze_until && new Date(msg.snooze_until) <= now) {
          return { ...msg, is_snoozed: false, snooze_until: undefined };
        }
        return msg;
      }));
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // Filter and sort messages
  const filteredMessages = useMemo(() => {
    let result = messages.filter((msg) => {
      // Search filter
      const content = msg.content || '';
      const senderName = msg.metadata?.senderName || '';
      const matchesSearch = !searchQuery ||
        content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        senderName.toLowerCase().includes(searchQuery.toLowerCase());

      // Source filter
      const matchesSource = filterSource === 'all' || msg.platform === filterSource;

      // Preset filter
      let matchesPreset = true;
      switch (filterPreset) {
        case 'unread':
          matchesPreset = !msg.is_read;
          break;
        case 'starred':
          matchesPreset = msg.is_starred;
          break;
        case 'urgent':
          matchesPreset = msg.priority === 'urgent' || msg.priority === 'high';
          break;
        case 'mentions':
          matchesPreset = msg.is_mentioned;
          break;
        case 'snoozed':
          matchesPreset = msg.is_snoozed;
          break;
        case 'archived':
          matchesPreset = msg.is_archived;
          break;
      }

      // Don't show archived unless specifically viewing archived
      if (filterPreset !== 'archived' && msg.is_archived) {
        return false;
      }

      // Don't show snoozed unless specifically viewing snoozed
      if (filterPreset !== 'snoozed' && msg.is_snoozed) {
        return false;
      }

      // Date range filter
      if (dateRange.start && new Date(msg.timestamp) < dateRange.start) {
        return false;
      }
      if (dateRange.end && new Date(msg.timestamp) > dateRange.end) {
        return false;
      }

      return matchesSearch && matchesSource && matchesPreset;
    });

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'sender':
          comparison = (a.metadata?.senderName || '').localeCompare(b.metadata?.senderName || '');
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [messages, searchQuery, filterSource, filterPreset, sortBy, sortOrder, dateRange]);

  // Calculate stats
  const stats = useMemo(() => {
    const unread = messages.filter(m => !m.is_read && !m.is_archived).length;
    const urgent = messages.filter(m => m.priority === 'urgent' || m.priority === 'high').length;
    const starred = messages.filter(m => m.is_starred).length;
    const snoozed = messages.filter(m => m.is_snoozed).length;
    const bySource: Record<string, number> = {};
    messages.forEach(m => {
      bySource[m.platform] = (bySource[m.platform] || 0) + 1;
    });
    return { unread, urgent, starred, snoozed, bySource, total: messages.length };
  }, [messages]);

  // Handlers
  const handleSelectMessage = (message: DisplayMessage) => {
    setSelectedMessage(message);
    if (!message.is_read) {
      handleToggleRead(message.id);
    }
  };

  const handleToggleSelect = (messageId: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedMessages.size === filteredMessages.length) {
      setSelectedMessages(new Set());
    } else {
      setSelectedMessages(new Set(filteredMessages.map(m => m.id)));
    }
  };

  const handleToggleRead = (messageId: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, is_read: !msg.is_read } : msg
    ));
  };

  const handleToggleStar = (messageId: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, is_starred: !msg.is_starred } : msg
    ));
  };

  const handleArchive = (messageId: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, is_archived: true } : msg
    ));
  };

  const handleSnooze = (messageId: string, hours: number) => {
    const snoozeUntil = new Date();
    snoozeUntil.setHours(snoozeUntil.getHours() + hours);
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, is_snoozed: true, snooze_until: snoozeUntil } : msg
    ));
    setShowSnoozeMenu(null);
  };

  const handleAddTag = (messageId: string, tag: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId
        ? { ...msg, tags: msg.tags.includes(tag) ? msg.tags.filter(t => t !== tag) : [...msg.tags, tag] }
        : msg
    ));
  };

  const handleSetPriority = (messageId: string, priority: Priority) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, priority } : msg
    ));
  };

  const handleQuickReply = (messageId: string, replyMessage: string) => {
    console.log(`Quick reply to ${messageId}: ${replyMessage}`);
    setShowQuickReply(null);
    // In real implementation, this would send the reply
  };

  // Bulk actions
  const handleBulkAction = (action: 'read' | 'unread' | 'star' | 'unstar' | 'archive' | 'delete') => {
    setMessages(prev => prev.map(msg => {
      if (!selectedMessages.has(msg.id)) return msg;
      switch (action) {
        case 'read': return { ...msg, is_read: true };
        case 'unread': return { ...msg, is_read: false };
        case 'star': return { ...msg, is_starred: true };
        case 'unstar': return { ...msg, is_starred: false };
        case 'archive': return { ...msg, is_archived: true };
        case 'delete': return msg; // Would actually delete in real implementation
        default: return msg;
      }
    }));
    setSelectedMessages(new Set());
    setShowBulkActions(false);
  };

  // Generate AI summary
  const generateAiSummary = () => {
    const unreadUrgent = messages.filter(m => !m.is_read && (m.priority === 'urgent' || m.priority === 'high'));
    const summary = `You have ${stats.unread} unread messages across ${Object.keys(stats.bySource).length} platforms. ${unreadUrgent.length} require urgent attention. Top sources: ${Object.entries(stats.bySource).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} (${v})`).join(', ')}.`;
    setAiSummary(summary);
  };

  return (
    <div className="unified-inbox">
      {/* Header */}
      <div className="inbox-header">
        <div className="header-left">
          <h2>📬 Unified Inbox</h2>
          <p className="subtitle">
            {stats.unread > 0
              ? `${stats.unread} unread messages`
              : 'All caught up!'}
          </p>
        </div>
        <div className="header-actions">
          <button
            className="ai-summary-btn"
            onClick={generateAiSummary}
            title="Get AI Summary"
          >
            <Sparkles size={16} />
            AI Summary
          </button>
          <button
            className="icon-btn"
            onClick={loadMessages}
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            className={`icon-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Filters"
          >
            <Filter size={18} />
          </button>
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="ai-summary-banner">
          <Sparkles size={16} />
          <span>{aiSummary}</span>
          <button onClick={() => setAiSummary(null)} className="close-btn">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search and Quick Filters */}
      <div className="inbox-controls">
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search messages, senders, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="quick-filters">
          {(['all', 'unread', 'starred', 'urgent', 'mentions'] as FilterPreset[]).map((preset) => (
            <button
              key={preset}
              className={`quick-filter-btn ${filterPreset === preset ? 'active' : ''}`}
              onClick={() => setFilterPreset(preset)}
            >
              {preset === 'all' && '📥 All'}
              {preset === 'unread' && `📩 Unread (${stats.unread})`}
              {preset === 'starred' && `⭐ Starred (${stats.starred})`}
              {preset === 'urgent' && `🔴 Urgent (${stats.urgent})`}
              {preset === 'mentions' && '@ Mentions'}
            </button>
          ))}
          {stats.snoozed > 0 && (
            <button
              className={`quick-filter-btn ${filterPreset === 'snoozed' ? 'active' : ''}`}
              onClick={() => setFilterPreset('snoozed')}
            >
              ⏰ Snoozed ({stats.snoozed})
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="advanced-filters">
          <div className="filter-section">
            <label>Platform</label>
            <div className="source-filters">
              <button
                className={`filter-chip ${filterSource === 'all' ? 'active' : ''}`}
                onClick={() => setFilterSource('all')}
              >
                All
              </button>
              {Object.keys(sourceColors).map((source) => (
                <button
                  key={source}
                  className={`filter-chip ${filterSource === source ? 'active' : ''}`}
                  onClick={() => setFilterSource(source as MessageSource)}
                  style={{ '--chip-color': sourceColors[source as MessageSource] } as React.CSSProperties}
                >
                  {sourceIcons[source as MessageSource]} {source}
                  {stats.bySource[source] && <span className="count">({stats.bySource[source]})</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <label>Sort by</label>
            <div className="sort-options">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                <option value="date">Date</option>
                <option value="priority">Priority</option>
                <option value="sender">Sender</option>
              </select>
              <button
                className="sort-order-btn"
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>

          <div className="filter-section">
            <label>Date range</label>
            <div className="date-range">
              <input
                type="date"
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value ? new Date(e.target.value) : undefined }))}
              />
              <span>to</span>
              <input
                type="date"
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value ? new Date(e.target.value) : undefined }))}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedMessages.size > 0 && (
        <div className="bulk-actions-bar">
          <div className="selection-info">
            <button onClick={handleSelectAll} className="select-all-btn">
              {selectedMessages.size === filteredMessages.length ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
            <span>{selectedMessages.size} selected</span>
          </div>
          <div className="bulk-actions">
            <button onClick={() => handleBulkAction('read')} title="Mark as read">
              <MailOpen size={16} />
            </button>
            <button onClick={() => handleBulkAction('unread')} title="Mark as unread">
              <Mail size={16} />
            </button>
            <button onClick={() => handleBulkAction('star')} title="Star">
              <Star size={16} />
            </button>
            <button onClick={() => handleBulkAction('archive')} title="Archive">
              <Archive size={16} />
            </button>
            <button onClick={() => handleBulkAction('delete')} title="Delete" className="danger">
              <Trash2 size={16} />
            </button>
            <button onClick={() => setSelectedMessages(new Set())} title="Clear selection">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="inbox-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card unread">
          <div className="stat-value">{stats.unread}</div>
          <div className="stat-label">Unread</div>
        </div>
        <div className="stat-card urgent">
          <div className="stat-value">{stats.urgent}</div>
          <div className="stat-label">Urgent</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Object.keys(stats.bySource).length}</div>
          <div className="stat-label">Platforms</div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading messages...</p>
        </div>
      )}

      {/* Message List */}
      <div className="inbox-content">
        <div className="message-list">
          {filteredMessages.length === 0 && !loading ? (
            <div className="empty-state">
              <p>📭 No messages found</p>
              <p className="empty-subtitle">
                {messages.length === 0
                  ? 'Click refresh to load messages'
                  : 'Try a different search or filter'}
              </p>
            </div>
          ) : (
            filteredMessages.map((message) => (
              <div
                key={message.id}
                className={`message-card ${
                  selectedMessage?.id === message.id ? 'selected' : ''
                } ${!message.is_read ? 'unread' : ''} ${
                  message.priority === 'urgent' ? 'urgent' : ''
                } ${selectedMessages.has(message.id) ? 'checked' : ''}`}
              >
                {/* Checkbox */}
                <button
                  className="message-checkbox"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSelect(message.id);
                  }}
                >
                  {selectedMessages.has(message.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>

                {/* Main content */}
                <div className="message-main" onClick={() => handleSelectMessage(message)}>
                  <div className="message-header">
                    <span
                      className="source-badge"
                      style={{ backgroundColor: sourceColors[message.platform] }}
                    >
                      {sourceIcons[message.platform]}
                    </span>
                    <span
                      className="priority-indicator"
                      style={{ color: priorityConfig[message.priority].color }}
                      title={priorityConfig[message.priority].label}
                    >
                      {priorityConfig[message.priority].icon}
                    </span>
                    <span className="sender-name">{message.metadata?.senderName}</span>
                    <span className="message-time">
                      {new Date(message.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    {message.has_attachment && <span className="attachment-indicator">📎</span>}
                    {message.reply_count > 0 && (
                      <span className="reply-count">💬 {message.reply_count}</span>
                    )}
                  </div>

                  <div className="message-content">{message.content}</div>

                  <div className="message-footer">
                    <span className="channel-name">#{message.metadata?.channelName}</span>
                    {message.tags.length > 0 && (
                      <div className="message-tags">
                        {message.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                        {message.tags.length > 3 && (
                          <span className="more-tags">+{message.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                    {message.is_mentioned && <span className="mention-badge">@</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="message-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleStar(message.id);
                    }}
                    className={message.is_starred ? 'starred' : ''}
                    title={message.is_starred ? 'Unstar' : 'Star'}
                  >
                    <Star size={16} fill={message.is_starred ? '#F59E0B' : 'none'} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSnoozeMenu(showSnoozeMenu === message.id ? null : message.id);
                    }}
                    title="Snooze"
                  >
                    <Clock size={16} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowQuickReply(showQuickReply === message.id ? null : message.id);
                    }}
                    title="Quick Reply"
                  >
                    <Reply size={16} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTagMenu(showTagMenu === message.id ? null : message.id);
                    }}
                    title="Add Tag"
                  >
                    <Tag size={16} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArchive(message.id);
                    }}
                    title="Archive"
                  >
                    <Archive size={16} />
                  </button>
                </div>

                {/* Snooze Menu */}
                {showSnoozeMenu === message.id && (
                  <div className="dropdown-menu snooze-menu" onClick={(e) => e.stopPropagation()}>
                    <div className="menu-header">Snooze until...</div>
                    {snoozeOptions.map((option) => (
                      <button
                        key={option.label}
                        onClick={() => {
                          if (option.hours > 0) {
                            handleSnooze(message.id, option.hours);
                          }
                        }}
                      >
                        <Clock size={14} />
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick Reply Menu */}
                {showQuickReply === message.id && (
                  <div className="dropdown-menu quick-reply-menu" onClick={(e) => e.stopPropagation()}>
                    <div className="menu-header">Quick Reply</div>
                    {quickReplies.map((reply) => (
                      <button
                        key={reply.label}
                        onClick={() => handleQuickReply(message.id, reply.message)}
                      >
                        {reply.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Tag Menu */}
                {showTagMenu === message.id && (
                  <div className="dropdown-menu tag-menu" onClick={(e) => e.stopPropagation()}>
                    <div className="menu-header">Add Tag</div>
                    {availableTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleAddTag(message.id, tag)}
                        className={message.tags.includes(tag) ? 'active' : ''}
                      >
                        <Tag size={14} />
                        {tag}
                        {message.tags.includes(tag) && ' ✓'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Message Detail Panel */}
        {selectedMessage && (
          <div className="message-detail-panel">
            <div className="detail-header">
              <div className="detail-sender">
                <div className="sender-avatar">
                  {selectedMessage.metadata?.senderName?.charAt(0) || '?'}
                </div>
                <div className="sender-info">
                  <h3>{selectedMessage.metadata?.senderName}</h3>
                  <span className="sender-email">{selectedMessage.metadata?.senderEmail || 'No email'}</span>
                </div>
              </div>
              <button className="close-detail" onClick={() => setSelectedMessage(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="detail-meta">
              <span className="source-badge" style={{ backgroundColor: sourceColors[selectedMessage.platform] }}>
                {sourceIcons[selectedMessage.platform]} {selectedMessage.platform}
              </span>
              <span className="detail-time">
                {new Date(selectedMessage.timestamp).toLocaleString()}
              </span>
              <span
                className="priority-badge"
                style={{ backgroundColor: priorityConfig[selectedMessage.priority].color }}
              >
                {priorityConfig[selectedMessage.priority].label}
              </span>
            </div>

            <div className="detail-content">
              <p>{selectedMessage.content}</p>
            </div>

            {selectedMessage.tags.length > 0 && (
              <div className="detail-tags">
                {selectedMessage.tags.map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            )}

            <div className="detail-actions">
              <button className="action-btn primary">
                <Reply size={16} />
                Reply
              </button>
              <button className="action-btn">
                <Forward size={16} />
                Forward
              </button>
              <button className="action-btn">
                <Calendar size={16} />
                Schedule Follow-up
              </button>
              <div className="priority-selector">
                <label>Priority:</label>
                {(['urgent', 'high', 'normal', 'low'] as Priority[]).map(p => (
                  <button
                    key={p}
                    className={selectedMessage.priority === p ? 'active' : ''}
                    onClick={() => handleSetPriority(selectedMessage.id, p)}
                    style={{ color: priorityConfig[p].color }}
                  >
                    {priorityConfig[p].icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
