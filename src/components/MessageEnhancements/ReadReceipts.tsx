import React, { useState, useMemo } from 'react';

// Types
type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

interface ReadReceipt {
  id: string;
  messageId: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  status: MessageStatus;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedReason?: string;
}

interface MessageDeliveryInfo {
  messageId: string;
  totalRecipients: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  receipts: ReadReceipt[];
}

interface ReadReceiptsProps {
  messageId: string;
  deliveryInfo?: MessageDeliveryInfo;
  onRetry?: (receiptId: string) => void;
  onClose?: () => void;
  showDetails?: boolean;
}

// Generate mock delivery info
const generateMockDeliveryInfo = (messageId: string): MessageDeliveryInfo => {
  const recipients = [
    { id: 'user-1', name: 'Alice Johnson' },
    { id: 'user-2', name: 'Bob Smith' },
    { id: 'user-3', name: 'Charlie Brown' },
    { id: 'user-4', name: 'Diana Prince' },
    { id: 'user-5', name: 'Eve Wilson' },
  ];

  const statuses: MessageStatus[] = ['read', 'read', 'delivered', 'delivered', 'sent'];
  const now = Date.now();

  const receipts: ReadReceipt[] = recipients.map((recipient, i) => {
    const status = statuses[i];
    const sentAt = new Date(now - 60000 * (5 - i));

    return {
      id: `receipt-${i}`,
      messageId,
      recipientId: recipient.id,
      recipientName: recipient.name,
      status,
      sentAt,
      deliveredAt: ['delivered', 'read'].includes(status) ? new Date(sentAt.getTime() + 1000 * (i + 1)) : undefined,
      readAt: status === 'read' ? new Date(sentAt.getTime() + 5000 * (i + 1)) : undefined,
    };
  });

  return {
    messageId,
    totalRecipients: recipients.length,
    sent: receipts.filter(r => r.status !== 'sending' && r.status !== 'failed').length,
    delivered: receipts.filter(r => ['delivered', 'read'].includes(r.status)).length,
    read: receipts.filter(r => r.status === 'read').length,
    failed: receipts.filter(r => r.status === 'failed').length,
    receipts,
  };
};

// Status icon component
const StatusIcon: React.FC<{ status: MessageStatus; size?: number }> = ({ status, size = 16 }) => {
  const iconStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
  };

  switch (status) {
    case 'sending':
      return (
        <span style={iconStyles} title="Sending...">
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
            <path
              d="M12 2 A10 10 0 0 1 22 12"
              stroke="#8b5cf6"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ animation: 'spin 1s linear infinite', transformOrigin: 'center' }}
            />
          </svg>
        </span>
      );
    case 'sent':
      return (
        <span style={{ ...iconStyles, color: '#9CA3AF' }} title="Sent">
          ✓
        </span>
      );
    case 'delivered':
      return (
        <span style={{ ...iconStyles, color: '#60A5FA' }} title="Delivered">
          ✓✓
        </span>
      );
    case 'read':
      return (
        <span style={{ ...iconStyles, color: '#34D399' }} title="Read">
          ✓✓
        </span>
      );
    case 'failed':
      return (
        <span style={{ ...iconStyles, color: '#EF4444' }} title="Failed">
          ✕
        </span>
      );
    default:
      return null;
  }
};

export const ReadReceipts: React.FC<ReadReceiptsProps> = ({
  messageId,
  deliveryInfo: propDeliveryInfo,
  onRetry,
  onClose,
  showDetails = true,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'read' | 'delivered' | 'pending' | 'failed'>('all');

  // Use provided or mock data
  const deliveryInfo = useMemo(
    () => propDeliveryInfo || generateMockDeliveryInfo(messageId),
    [propDeliveryInfo, messageId]
  );

  // Filter receipts by tab
  const filteredReceipts = useMemo(() => {
    switch (activeTab) {
      case 'read':
        return deliveryInfo.receipts.filter(r => r.status === 'read');
      case 'delivered':
        return deliveryInfo.receipts.filter(r => r.status === 'delivered');
      case 'pending':
        return deliveryInfo.receipts.filter(r => ['sending', 'sent'].includes(r.status));
      case 'failed':
        return deliveryInfo.receipts.filter(r => r.status === 'failed');
      default:
        return deliveryInfo.receipts;
    }
  }, [deliveryInfo.receipts, activeTab]);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  // Calculate percentages for progress bar
  const readPercent = (deliveryInfo.read / deliveryInfo.totalRecipients) * 100;
  const deliveredPercent = (deliveryInfo.delivered / deliveryInfo.totalRecipients) * 100;
  const sentPercent = (deliveryInfo.sent / deliveryInfo.totalRecipients) * 100;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98), rgba(20, 20, 35, 0.98))',
      borderRadius: '16px',
      padding: '24px',
      color: 'white',
      maxWidth: '450px',
      width: '100%',
      maxHeight: '80vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>📬</span>
            Delivery Status
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            {deliveryInfo.totalRecipients} recipients
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        marginBottom: '20px',
      }}>
        {[
          { label: 'Sent', value: deliveryInfo.sent, color: '#9CA3AF', icon: '✓' },
          { label: 'Delivered', value: deliveryInfo.delivered, color: '#60A5FA', icon: '✓✓' },
          { label: 'Read', value: deliveryInfo.read, color: '#34D399', icon: '👁️' },
          { label: 'Failed', value: deliveryInfo.failed, color: '#EF4444', icon: '✕' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: `${stat.color}15`,
              borderRadius: '10px',
              padding: '12px 8px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: stat.color }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '2px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          height: '8px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '4px',
          overflow: 'hidden',
          display: 'flex',
        }}>
          <div style={{
            width: `${readPercent}%`,
            background: '#34D399',
            transition: 'width 0.3s ease',
          }} />
          <div style={{
            width: `${deliveredPercent - readPercent}%`,
            background: '#60A5FA',
            transition: 'width 0.3s ease',
          }} />
          <div style={{
            width: `${sentPercent - deliveredPercent}%`,
            background: '#9CA3AF',
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '8px',
          fontSize: '0.75rem',
        }}>
          <span style={{ color: '#34D399' }}>{Math.round(readPercent)}% read</span>
          <span style={{ color: '#60A5FA' }}>{Math.round(deliveredPercent)}% delivered</span>
        </div>
      </div>

      {showDetails && (
        <>
          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '16px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '10px',
            padding: '4px',
          }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'read', label: 'Read', count: deliveryInfo.read },
              { id: 'delivered', label: 'Delivered', count: deliveryInfo.delivered - deliveryInfo.read },
              { id: 'pending', label: 'Pending', count: deliveryInfo.sent - deliveryInfo.delivered },
              { id: 'failed', label: 'Failed', count: deliveryInfo.failed },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                style={{
                  flex: 1,
                  background: activeTab === tab.id ? 'rgba(138, 43, 226, 0.3)' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Receipts List */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {filteredReceipts.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                opacity: 0.5,
              }}>
                No recipients in this category
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredReceipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '10px',
                      padding: '12px',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      flexShrink: 0,
                    }}>
                      {receipt.recipientName.charAt(0)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>
                        {receipt.recipientName}
                      </div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                        {receipt.status === 'read' && receipt.readAt && `Read ${formatTime(receipt.readAt)}`}
                        {receipt.status === 'delivered' && receipt.deliveredAt && `Delivered ${formatTime(receipt.deliveredAt)}`}
                        {receipt.status === 'sent' && `Sent ${formatTime(receipt.sentAt)}`}
                        {receipt.status === 'sending' && 'Sending...'}
                        {receipt.status === 'failed' && (receipt.failedReason || 'Delivery failed')}
                      </div>
                    </div>

                    {/* Status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <StatusIcon status={receipt.status} size={18} />
                      {receipt.status === 'failed' && onRetry && (
                        <button
                          onClick={() => onRetry(receipt.id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.5)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            color: '#EF4444',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* CSS for animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// Compact status indicator for message bubbles
export const DeliveryStatusIndicator: React.FC<{
  status: MessageStatus;
  recipientCount?: number;
  readCount?: number;
  onClick?: () => void;
  showLabel?: boolean;
}> = ({ status, recipientCount = 1, readCount = 0, onClick, showLabel = false }) => {
  const getStatusInfo = () => {
    switch (status) {
      case 'sending':
        return { label: 'Sending', color: 'rgba(255,255,255,0.5)' };
      case 'sent':
        return { label: 'Sent', color: '#9CA3AF' };
      case 'delivered':
        return { label: 'Delivered', color: '#60A5FA' };
      case 'read':
        return {
          label: recipientCount > 1 ? `Read by ${readCount}/${recipientCount}` : 'Read',
          color: '#34D399',
        };
      case 'failed':
        return { label: 'Failed', color: '#EF4444' };
      default:
        return { label: '', color: 'transparent' };
    }
  };

  const info = getStatusInfo();

  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: 'transparent',
        border: 'none',
        padding: '2px 4px',
        cursor: onClick ? 'pointer' : 'default',
        color: info.color,
        fontSize: '0.75rem',
      }}
      title={info.label}
    >
      <StatusIcon status={status} size={14} />
      {showLabel && <span>{info.label}</span>}
    </button>
  );
};

// Typing indicator
export const TypingIndicator: React.FC<{
  users: string[];
}> = ({ users }) => {
  if (users.length === 0) return null;

  const getText = () => {
    if (users.length === 1) return `${users[0]} is typing`;
    if (users.length === 2) return `${users[0]} and ${users[1]} are typing`;
    return `${users[0]} and ${users.length - 1} others are typing`;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      fontSize: '0.8rem',
      color: 'rgba(255,255,255,0.6)',
    }}>
      <div style={{ display: 'flex', gap: '3px' }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.5)',
              animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <span>{getText()}</span>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
};

// Online status indicator
export const OnlineStatusDot: React.FC<{
  isOnline: boolean;
  lastSeen?: Date;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}> = ({ isOnline, lastSeen, size = 'md', showLabel = false }) => {
  const sizeMap = { sm: 8, md: 10, lg: 14 };
  const dotSize = sizeMap[size];

  const formatLastSeen = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
    }}>
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: isOnline ? '#34D399' : '#6B7280',
          boxShadow: isOnline ? '0 0 8px rgba(52, 211, 153, 0.5)' : 'none',
        }}
      />
      {showLabel && (
        <span style={{
          fontSize: size === 'sm' ? '0.7rem' : '0.8rem',
          color: isOnline ? '#34D399' : 'rgba(255,255,255,0.5)',
        }}>
          {isOnline ? 'Online' : lastSeen ? `Last seen ${formatLastSeen(lastSeen)}` : 'Offline'}
        </span>
      )}
    </div>
  );
};

export default ReadReceipts;
