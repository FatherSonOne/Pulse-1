import React, { useState, useMemo } from 'react';

// Types
interface StatusEvent {
  id: string;
  type: 'sent' | 'delivered' | 'read' | 'replied' | 'forwarded' | 'reacted' | 'edited' | 'deleted' | 'pinned' | 'starred' | 'archived';
  timestamp: Date;
  actor?: string;
  details?: string;
  metadata?: Record<string, any>;
}

interface MessageStatus {
  messageId: string;
  currentStatus: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  events: StatusEvent[];
  recipientCount?: number;
  readByCount?: number;
  failureReason?: string;
}

interface MessageStatusTimelineProps {
  messageId: string;
  status?: MessageStatus;
  compact?: boolean;
  onRetry?: () => void;
}

// Mock data generator
const generateMockStatus = (messageId: string): MessageStatus => ({
  messageId,
  currentStatus: 'read',
  recipientCount: 3,
  readByCount: 2,
  events: [
    {
      id: 'e1',
      type: 'sent',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      details: 'Message sent successfully'
    },
    {
      id: 'e2',
      type: 'delivered',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 3000),
      details: 'Delivered to all recipients'
    },
    {
      id: 'e3',
      type: 'read',
      timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
      actor: 'Alice Chen',
      details: 'Opened message'
    },
    {
      id: 'e4',
      type: 'reacted',
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
      actor: 'Alice Chen',
      details: 'Reacted with 👍',
      metadata: { emoji: '👍' }
    },
    {
      id: 'e5',
      type: 'read',
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      actor: 'Bob Wilson',
      details: 'Opened message'
    },
    {
      id: 'e6',
      type: 'replied',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      actor: 'Bob Wilson',
      details: 'Sent a reply'
    },
    {
      id: 'e7',
      type: 'starred',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      actor: 'You',
      details: 'Starred this message'
    }
  ]
});

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    padding: '16px',
    backgroundColor: '#0a0a0f',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const
  },
  summary: {
    display: 'flex',
    gap: '16px',
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px'
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '4px'
  },
  summaryValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#f1f5f9'
  },
  summaryLabel: {
    fontSize: '10px',
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0',
    position: 'relative' as const
  },
  timelineEvent: {
    display: 'flex',
    gap: '12px',
    padding: '12px 0',
    position: 'relative' as const
  },
  timelineLine: {
    position: 'absolute' as const,
    left: '15px',
    top: '32px',
    bottom: '0',
    width: '2px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  eventIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    flexShrink: 0,
    position: 'relative' as const,
    zIndex: 1
  },
  eventContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px'
  },
  eventTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  eventDetails: {
    fontSize: '12px',
    color: '#64748b'
  },
  eventTime: {
    fontSize: '11px',
    color: '#4b5563'
  },
  failedBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(239, 68, 68, 0.2)'
  },
  retryButton: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#EF4444',
    color: 'white',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  compactContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  compactDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%'
  },
  compactText: {
    fontSize: '11px',
    color: '#64748b'
  },
  progressBar: {
    display: 'flex',
    gap: '4px',
    marginTop: '8px'
  },
  progressStep: {
    flex: 1,
    height: '4px',
    borderRadius: '2px',
    transition: 'background-color 0.3s ease'
  }
};

// Status colors
const statusColors: Record<string, { bg: string; color: string; icon: string }> = {
  sending: { bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', icon: 'fa-circle-notch fa-spin' },
  sent: { bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', icon: 'fa-check' },
  delivered: { bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399', icon: 'fa-check-double' },
  read: { bg: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', icon: 'fa-eye' },
  failed: { bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171', icon: 'fa-exclamation-triangle' }
};

// Event type icons and colors
const eventConfig: Record<StatusEvent['type'], { icon: string; color: string; bg: string; label: string }> = {
  sent: { icon: 'fa-paper-plane', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.2)', label: 'Sent' },
  delivered: { icon: 'fa-check-double', color: '#34d399', bg: 'rgba(16, 185, 129, 0.2)', label: 'Delivered' },
  read: { icon: 'fa-eye', color: '#a78bfa', bg: 'rgba(139, 92, 246, 0.2)', label: 'Read' },
  replied: { icon: 'fa-reply', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.2)', label: 'Replied' },
  forwarded: { icon: 'fa-share', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.2)', label: 'Forwarded' },
  reacted: { icon: 'fa-face-smile', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.2)', label: 'Reacted' },
  edited: { icon: 'fa-pen', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.2)', label: 'Edited' },
  deleted: { icon: 'fa-trash', color: '#f87171', bg: 'rgba(239, 68, 68, 0.2)', label: 'Deleted' },
  pinned: { icon: 'fa-thumbtack', color: '#f97316', bg: 'rgba(249, 115, 22, 0.2)', label: 'Pinned' },
  starred: { icon: 'fa-star', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.2)', label: 'Starred' },
  archived: { icon: 'fa-box-archive', color: '#64748b', bg: 'rgba(100, 116, 139, 0.2)', label: 'Archived' }
};

// Format time
const formatTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

// Progress steps
const progressSteps = ['sent', 'delivered', 'read'];

// Main Component
export const MessageStatusTimeline: React.FC<MessageStatusTimelineProps> = ({
  messageId,
  status: providedStatus,
  compact = false,
  onRetry
}) => {
  const status = useMemo(
    () => providedStatus || generateMockStatus(messageId),
    [providedStatus, messageId]
  );

  const currentStatusConfig = statusColors[status.currentStatus];
  const progressIndex = progressSteps.indexOf(status.currentStatus);

  if (compact) {
    return (
      <div style={styles.compactContainer}>
        <div style={{
          ...styles.compactDot,
          backgroundColor: currentStatusConfig.color
        }} />
        <span style={styles.compactText}>
          {status.currentStatus === 'read' && status.readByCount
            ? `Read by ${status.readByCount}`
            : status.currentStatus.charAt(0).toUpperCase() + status.currentStatus.slice(1)
          }
        </span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <i className="fa-solid fa-clock-rotate-left" />
          Message Status
        </div>
        <span style={{
          ...styles.statusBadge,
          backgroundColor: currentStatusConfig.bg,
          color: currentStatusConfig.color
        }}>
          <i className={`fa-solid ${currentStatusConfig.icon}`} style={{ marginRight: '4px' }} />
          {status.currentStatus}
        </span>
      </div>

      {/* Progress Bar */}
      <div style={styles.progressBar}>
        {progressSteps.map((step, i) => (
          <div
            key={step}
            style={{
              ...styles.progressStep,
              backgroundColor: i <= progressIndex
                ? statusColors[step].color
                : 'rgba(255, 255, 255, 0.1)'
            }}
          />
        ))}
      </div>

      {/* Failed Banner */}
      {status.currentStatus === 'failed' && (
        <div style={styles.failedBanner}>
          <i className="fa-solid fa-exclamation-triangle" style={{ color: '#f87171', fontSize: '16px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', color: '#f87171', fontWeight: 500 }}>
              Message failed to send
            </div>
            {status.failureReason && (
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {status.failureReason}
              </div>
            )}
          </div>
          {onRetry && (
            <button style={styles.retryButton} onClick={onRetry}>
              <i className="fa-solid fa-rotate-right" />
              Retry
            </button>
          )}
        </div>
      )}

      {/* Summary */}
      {status.recipientCount && status.recipientCount > 1 && (
        <div style={styles.summary}>
          <div style={styles.summaryItem}>
            <span style={styles.summaryValue}>{status.recipientCount}</span>
            <span style={styles.summaryLabel}>Recipients</span>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.summaryValue}>{status.recipientCount}</span>
            <span style={styles.summaryLabel}>Delivered</span>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.summaryValue}>{status.readByCount || 0}</span>
            <span style={styles.summaryLabel}>Read</span>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.summaryValue}>{status.events.filter(e => e.type === 'replied').length}</span>
            <span style={styles.summaryLabel}>Replied</span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div style={styles.timeline}>
        {status.events.map((event, index) => {
          const config = eventConfig[event.type];
          const isLast = index === status.events.length - 1;

          return (
            <div key={event.id} style={styles.timelineEvent}>
              {!isLast && <div style={styles.timelineLine} />}
              <div style={{
                ...styles.eventIcon,
                backgroundColor: config.bg,
                color: config.color
              }}>
                <i className={`fa-solid ${config.icon}`} />
              </div>
              <div style={styles.eventContent}>
                <div style={styles.eventTitle}>
                  {config.label}
                  {event.actor && (
                    <span style={{ color: '#94a3b8', fontWeight: 400 }}>
                      by {event.actor}
                    </span>
                  )}
                  {event.metadata?.emoji && (
                    <span style={{ fontSize: '16px' }}>{event.metadata.emoji}</span>
                  )}
                </div>
                {event.details && (
                  <div style={styles.eventDetails}>{event.details}</div>
                )}
                <div style={styles.eventTime}>{formatTime(event.timestamp)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Inline status indicator (for use in message bubbles)
export const StatusIndicator: React.FC<{
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  readCount?: number;
  onClick?: () => void;
}> = ({ status, readCount, onClick }) => {
  const config = statusColors[status];

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: 'transparent',
        color: config.color,
        cursor: onClick ? 'pointer' : 'default',
        fontSize: '11px'
      }}
      title={`Status: ${status}`}
    >
      <i className={`fa-solid ${config.icon}`} />
      {status === 'read' && readCount && readCount > 1 && (
        <span>{readCount}</span>
      )}
    </button>
  );
};

export default MessageStatusTimeline;
