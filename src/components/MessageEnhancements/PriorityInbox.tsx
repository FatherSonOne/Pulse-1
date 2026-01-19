import React, { useState, useMemo, useCallback } from 'react';

// Types
interface InboxMessage {
  id: string;
  conversationId: string;
  sender: string;
  senderAvatar?: string;
  preview: string;
  timestamp: Date;
  isRead: boolean;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  category: 'primary' | 'social' | 'updates' | 'promotions';
  hasAttachment: boolean;
  isStarred: boolean;
  labels: string[];
  aiScore: number; // 0-100 importance score
  aiReason?: string;
}

interface InboxFilter {
  priority?: InboxMessage['priority'];
  category?: InboxMessage['category'];
  isUnread?: boolean;
  isStarred?: boolean;
  hasAttachment?: boolean;
  label?: string;
}

interface PriorityInboxProps {
  onMessageClick?: (message: InboxMessage) => void;
  onMessageStar?: (messageId: string) => void;
  onMessageArchive?: (messageId: string) => void;
  onMessageDelete?: (messageId: string) => void;
}

// Mock data generator
const generateMockMessages = (): InboxMessage[] => [
  {
    id: 'm1',
    conversationId: 'conv1',
    sender: 'Alice Chen',
    preview: 'URGENT: The deployment is failing on production. Need your help ASAP!',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    isRead: false,
    priority: 'urgent',
    category: 'primary',
    hasAttachment: false,
    isStarred: true,
    labels: ['work', 'urgent'],
    aiScore: 98,
    aiReason: 'Production issue requiring immediate attention'
  },
  {
    id: 'm2',
    conversationId: 'conv2',
    sender: 'Bob Wilson',
    preview: 'Can we schedule a call to discuss the Q1 roadmap? I have some ideas...',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    isRead: false,
    priority: 'high',
    category: 'primary',
    hasAttachment: false,
    isStarred: false,
    labels: ['work', 'planning'],
    aiScore: 85,
    aiReason: 'Strategic planning discussion from team lead'
  },
  {
    id: 'm3',
    conversationId: 'conv3',
    sender: 'Carol Martinez',
    preview: 'Here are the design files you requested. Let me know what you think!',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    isRead: true,
    priority: 'normal',
    category: 'primary',
    hasAttachment: true,
    isStarred: false,
    labels: ['design'],
    aiScore: 72,
    aiReason: 'Requested deliverable with attachments'
  },
  {
    id: 'm4',
    conversationId: 'conv4',
    sender: 'Dave Thompson',
    preview: 'Great job on the presentation yesterday! The client loved it.',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    isRead: true,
    priority: 'low',
    category: 'social',
    hasAttachment: false,
    isStarred: false,
    labels: ['feedback'],
    aiScore: 45,
    aiReason: 'Positive feedback, no action required'
  },
  {
    id: 'm5',
    conversationId: 'conv5',
    sender: 'System Updates',
    preview: 'Your weekly analytics report is ready. Click to view insights...',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
    isRead: true,
    priority: 'low',
    category: 'updates',
    hasAttachment: true,
    isStarred: false,
    labels: ['automated'],
    aiScore: 30,
    aiReason: 'Automated report, review when convenient'
  },
  {
    id: 'm6',
    conversationId: 'conv6',
    sender: 'Emma Davis',
    preview: 'Meeting reminder: Sprint planning tomorrow at 10 AM. Please review the backlog.',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
    isRead: false,
    priority: 'high',
    category: 'primary',
    hasAttachment: false,
    isStarred: false,
    labels: ['meeting', 'sprint'],
    aiScore: 82,
    aiReason: 'Meeting preparation required before tomorrow'
  },
  {
    id: 'm7',
    conversationId: 'conv7',
    sender: 'Newsletter',
    preview: 'This week in tech: AI breakthroughs, new frameworks, and more...',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    isRead: true,
    priority: 'low',
    category: 'promotions',
    hasAttachment: false,
    isStarred: false,
    labels: ['newsletter'],
    aiScore: 15,
    aiReason: 'Marketing content'
  }
];

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#0a0a0f',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  filterBar: {
    display: 'flex',
    gap: '8px',
    padding: '12px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    overflowX: 'auto' as const
  },
  filterChip: {
    padding: '6px 12px',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.2s ease'
  },
  filterChipActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: 'rgba(139, 92, 246, 0.4)',
    color: '#a78bfa'
  },
  categoryTabs: {
    display: 'flex',
    gap: '0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
  },
  categoryTab: {
    padding: '12px 20px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  categoryTabActive: {
    color: '#a78bfa',
    borderBottomColor: '#8B5CF6'
  },
  messageList: {
    flex: 1,
    overflowY: 'auto' as const
  },
  messageItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  messageItemUnread: {
    backgroundColor: 'rgba(139, 92, 246, 0.05)'
  },
  avatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#a78bfa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 600,
    flexShrink: 0
  },
  messageContent: {
    flex: 1,
    minWidth: 0
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px'
  },
  senderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  sender: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f1f5f9'
  },
  senderUnread: {
    fontWeight: 700
  },
  priorityBadge: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '9px',
    fontWeight: 700,
    textTransform: 'uppercase' as const
  },
  timestamp: {
    fontSize: '11px',
    color: '#64748b',
    flexShrink: 0
  },
  preview: {
    fontSize: '13px',
    color: '#94a3b8',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },
  previewUnread: {
    color: '#cbd5e1'
  },
  messageMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '6px'
  },
  label: {
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    color: '#a78bfa',
    fontSize: '10px',
    fontWeight: 500
  },
  aiScore: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '10px',
    color: '#64748b'
  },
  actions: {
    display: 'flex',
    gap: '4px',
    opacity: 0,
    transition: 'opacity 0.2s ease'
  },
  actionButton: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    transition: 'all 0.2s ease'
  },
  starButton: {
    color: '#fbbf24'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: '#64748b'
  },
  smartSection: {
    padding: '12px 20px',
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
    borderBottom: '1px solid rgba(139, 92, 246, 0.1)'
  },
  smartTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#a78bfa',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  unreadDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#8B5CF6',
    flexShrink: 0
  }
};

// Priority colors
const priorityColors: Record<InboxMessage['priority'], { bg: string; color: string }> = {
  urgent: { bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171' },
  high: { bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' },
  normal: { bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' },
  low: { bg: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' }
};

// Category icons
const categoryIcons: Record<InboxMessage['category'], string> = {
  primary: 'fa-inbox',
  social: 'fa-users',
  updates: 'fa-bell',
  promotions: 'fa-tag'
};

// Format timestamp
const formatTimestamp = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Main Component
export const PriorityInbox: React.FC<PriorityInboxProps> = ({
  onMessageClick,
  onMessageStar,
  onMessageArchive,
  onMessageDelete
}) => {
  const [activeCategory, setActiveCategory] = useState<InboxMessage['category'] | 'all'>('all');
  const [filters, setFilters] = useState<InboxFilter>({});
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  const messages = useMemo(() => generateMockMessages(), []);

  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      if (activeCategory !== 'all' && msg.category !== activeCategory) return false;
      if (filters.priority && msg.priority !== filters.priority) return false;
      if (filters.isUnread && msg.isRead) return false;
      if (filters.isStarred && !msg.isStarred) return false;
      if (filters.hasAttachment && !msg.hasAttachment) return false;
      return true;
    }).sort((a, b) => {
      // Sort by AI score first, then by timestamp
      if (b.aiScore !== a.aiScore) return b.aiScore - a.aiScore;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [messages, activeCategory, filters]);

  const urgentMessages = filteredMessages.filter(m => m.priority === 'urgent' && !m.isRead);
  const otherMessages = filteredMessages.filter(m => !(m.priority === 'urgent' && !m.isRead));

  const toggleFilter = useCallback((key: keyof InboxFilter, value: any) => {
    setFilters(prev => {
      if (prev[key] === value) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const categories = [
    { id: 'all' as const, label: 'All', count: messages.length },
    { id: 'primary' as const, label: 'Primary', count: messages.filter(m => m.category === 'primary').length },
    { id: 'social' as const, label: 'Social', count: messages.filter(m => m.category === 'social').length },
    { id: 'updates' as const, label: 'Updates', count: messages.filter(m => m.category === 'updates').length },
    { id: 'promotions' as const, label: 'Promotions', count: messages.filter(m => m.category === 'promotions').length }
  ];

  const renderMessage = (message: InboxMessage) => {
    const isHovered = hoveredMessageId === message.id;
    const priorityStyle = priorityColors[message.priority];

    return (
      <div
        key={message.id}
        style={{
          ...styles.messageItem,
          ...(message.isRead ? {} : styles.messageItemUnread),
          backgroundColor: isHovered ? 'rgba(255, 255, 255, 0.03)' : (message.isRead ? 'transparent' : 'rgba(139, 92, 246, 0.05)')
        }}
        onClick={() => onMessageClick?.(message)}
        onMouseEnter={() => setHoveredMessageId(message.id)}
        onMouseLeave={() => setHoveredMessageId(null)}
      >
        {!message.isRead && <div style={styles.unreadDot} />}

        <div style={styles.avatar}>
          {message.sender.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>

        <div style={styles.messageContent}>
          <div style={styles.messageHeader}>
            <div style={styles.senderRow}>
              <span style={{ ...styles.sender, ...(message.isRead ? {} : styles.senderUnread) }}>
                {message.sender}
              </span>
              {message.priority !== 'normal' && (
                <span style={{
                  ...styles.priorityBadge,
                  backgroundColor: priorityStyle.bg,
                  color: priorityStyle.color
                }}>
                  {message.priority}
                </span>
              )}
              {message.hasAttachment && (
                <i className="fa-solid fa-paperclip" style={{ fontSize: '11px', color: '#64748b' }} />
              )}
            </div>
            <span style={styles.timestamp}>{formatTimestamp(message.timestamp)}</span>
          </div>

          <div style={{ ...styles.preview, ...(message.isRead ? {} : styles.previewUnread) }}>
            {message.preview}
          </div>

          <div style={styles.messageMeta}>
            {message.labels.slice(0, 2).map(label => (
              <span key={label} style={styles.label}>{label}</span>
            ))}
            <div style={styles.aiScore}>
              <i className="fa-solid fa-brain" />
              {message.aiScore}%
            </div>
          </div>
        </div>

        <div style={{ ...styles.actions, opacity: isHovered ? 1 : 0 }}>
          <button
            style={{ ...styles.actionButton, ...(message.isStarred ? styles.starButton : {}) }}
            onClick={e => { e.stopPropagation(); onMessageStar?.(message.id); }}
            title="Star"
          >
            <i className={`fa-${message.isStarred ? 'solid' : 'regular'} fa-star`} />
          </button>
          <button
            style={styles.actionButton}
            onClick={e => { e.stopPropagation(); onMessageArchive?.(message.id); }}
            title="Archive"
          >
            <i className="fa-solid fa-box-archive" />
          </button>
          <button
            style={styles.actionButton}
            onClick={e => { e.stopPropagation(); onMessageDelete?.(message.id); }}
            title="Delete"
          >
            <i className="fa-solid fa-trash" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <i className="fa-solid fa-inbox" />
          Priority Inbox
        </div>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          {filteredMessages.filter(m => !m.isRead).length} unread
        </div>
      </div>

      <div style={styles.categoryTabs}>
        {categories.map(cat => (
          <button
            key={cat.id}
            style={{
              ...styles.categoryTab,
              ...(activeCategory === cat.id ? styles.categoryTabActive : {})
            }}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.id !== 'all' && <i className={`fa-solid ${categoryIcons[cat.id as InboxMessage['category']]}`} />}
            {cat.label}
            <span style={{ opacity: 0.6 }}>({cat.count})</span>
          </button>
        ))}
      </div>

      <div style={styles.filterBar}>
        <button
          style={{
            ...styles.filterChip,
            ...(filters.isUnread ? styles.filterChipActive : {})
          }}
          onClick={() => toggleFilter('isUnread', true)}
        >
          <i className="fa-solid fa-envelope" />
          Unread
        </button>
        <button
          style={{
            ...styles.filterChip,
            ...(filters.isStarred ? styles.filterChipActive : {})
          }}
          onClick={() => toggleFilter('isStarred', true)}
        >
          <i className="fa-solid fa-star" />
          Starred
        </button>
        <button
          style={{
            ...styles.filterChip,
            ...(filters.hasAttachment ? styles.filterChipActive : {})
          }}
          onClick={() => toggleFilter('hasAttachment', true)}
        >
          <i className="fa-solid fa-paperclip" />
          Attachments
        </button>
        <button
          style={{
            ...styles.filterChip,
            ...(filters.priority === 'urgent' ? styles.filterChipActive : {})
          }}
          onClick={() => toggleFilter('priority', 'urgent')}
        >
          <i className="fa-solid fa-bolt" />
          Urgent
        </button>
        <button
          style={{
            ...styles.filterChip,
            ...(filters.priority === 'high' ? styles.filterChipActive : {})
          }}
          onClick={() => toggleFilter('priority', 'high')}
        >
          <i className="fa-solid fa-arrow-up" />
          High Priority
        </button>
      </div>

      <div style={styles.messageList}>
        {urgentMessages.length > 0 && (
          <>
            <div style={styles.smartSection}>
              <div style={styles.smartTitle}>
                <i className="fa-solid fa-bolt" />
                Needs Attention ({urgentMessages.length})
              </div>
            </div>
            {urgentMessages.map(renderMessage)}
          </>
        )}

        {otherMessages.length > 0 && (
          <>
            {urgentMessages.length > 0 && (
              <div style={styles.smartSection}>
                <div style={styles.smartTitle}>
                  <i className="fa-solid fa-inbox" />
                  Everything Else
                </div>
              </div>
            )}
            {otherMessages.map(renderMessage)}
          </>
        )}

        {filteredMessages.length === 0 && (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <div style={{ fontSize: '14px' }}>No messages match your filters</div>
          </div>
        )}
      </div>
    </div>
  );
};

// Compact priority badge for use in message lists
export const PriorityBadge: React.FC<{
  priority: InboxMessage['priority'];
  size?: 'small' | 'medium';
}> = ({ priority, size = 'small' }) => {
  const style = priorityColors[priority];
  const padding = size === 'small' ? '2px 6px' : '4px 10px';
  const fontSize = size === 'small' ? '9px' : '11px';

  return (
    <span style={{
      padding,
      borderRadius: '4px',
      backgroundColor: style.bg,
      color: style.color,
      fontSize,
      fontWeight: 700,
      textTransform: 'uppercase'
    }}>
      {priority}
    </span>
  );
};

export default PriorityInbox;
