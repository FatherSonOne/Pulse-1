import React, { useState, useMemo, useCallback } from 'react';

// Types
interface ThreadedMessage {
  id: string;
  text: string;
  sender: 'user' | 'contact';
  senderName: string;
  timestamp: Date;
  parentId?: string;
  replyCount?: number;
  reactions?: { emoji: string; count: number }[];
  isEdited?: boolean;
  attachments?: { type: string; name: string }[];
}

interface MessageThread {
  id: string;
  rootMessageId: string;
  messages: ThreadedMessage[];
  participants: string[];
  createdAt: Date;
  lastActivity: Date;
  title?: string;
  isResolved?: boolean;
  labels: string[];
}

interface ThreadBranch {
  id: string;
  parentThreadId: string;
  branchPoint: string; // message ID where branch occurred
  title: string;
  messages: ThreadedMessage[];
  createdAt: Date;
  createdBy: string;
  reason?: string;
}

interface MessageThreadingProps {
  messages?: ThreadedMessage[];
  threads?: MessageThread[];
  branches?: ThreadBranch[];
  activeThreadId?: string;
  onReplyToMessage?: (messageId: string, text: string) => void;
  onCreateBranch?: (messageId: string, title: string, reason?: string) => void;
  onResolveThread?: (threadId: string) => void;
  onSwitchThread?: (threadId: string) => void;
  onClose?: () => void;
}

// Mock data generator
const generateMockMessages = (): ThreadedMessage[] => {
  const now = Date.now();
  return [
    {
      id: 'msg-1',
      text: 'Hey team, I wanted to discuss the new feature implementation.',
      sender: 'contact',
      senderName: 'Alice',
      timestamp: new Date(now - 2 * 60 * 60 * 1000),
      replyCount: 3,
    },
    {
      id: 'msg-2',
      text: 'Sure, what aspects are you thinking about?',
      sender: 'user',
      senderName: 'You',
      timestamp: new Date(now - 1.9 * 60 * 60 * 1000),
      parentId: 'msg-1',
    },
    {
      id: 'msg-3',
      text: 'Mainly the database schema and API design.',
      sender: 'contact',
      senderName: 'Alice',
      timestamp: new Date(now - 1.8 * 60 * 60 * 1000),
      parentId: 'msg-1',
    },
    {
      id: 'msg-4',
      text: 'I can help with the API design. Let me share some ideas.',
      sender: 'contact',
      senderName: 'Bob',
      timestamp: new Date(now - 1.7 * 60 * 60 * 1000),
      parentId: 'msg-1',
    },
    {
      id: 'msg-5',
      text: 'Also, we need to consider the timeline for this.',
      sender: 'contact',
      senderName: 'Alice',
      timestamp: new Date(now - 1 * 60 * 60 * 1000),
      replyCount: 2,
    },
    {
      id: 'msg-6',
      text: 'I think we can aim for end of next week.',
      sender: 'user',
      senderName: 'You',
      timestamp: new Date(now - 0.9 * 60 * 60 * 1000),
      parentId: 'msg-5',
    },
    {
      id: 'msg-7',
      text: 'That works for me. I\'ll start on the schema today.',
      sender: 'contact',
      senderName: 'Alice',
      timestamp: new Date(now - 0.8 * 60 * 60 * 1000),
      parentId: 'msg-5',
    },
    {
      id: 'msg-8',
      text: 'Great progress everyone! Let\'s sync up tomorrow.',
      sender: 'user',
      senderName: 'You',
      timestamp: new Date(now - 30 * 60 * 1000),
    },
  ];
};

const generateMockThreads = (): MessageThread[] => {
  const now = Date.now();
  return [
    {
      id: 'thread-1',
      rootMessageId: 'msg-1',
      messages: [],
      participants: ['Alice', 'Bob', 'You'],
      createdAt: new Date(now - 2 * 60 * 60 * 1000),
      lastActivity: new Date(now - 1.7 * 60 * 60 * 1000),
      title: 'Feature Implementation Discussion',
      labels: ['planning', 'technical'],
    },
    {
      id: 'thread-2',
      rootMessageId: 'msg-5',
      messages: [],
      participants: ['Alice', 'You'],
      createdAt: new Date(now - 1 * 60 * 60 * 1000),
      lastActivity: new Date(now - 0.8 * 60 * 60 * 1000),
      title: 'Timeline Discussion',
      isResolved: true,
      labels: ['timeline'],
    },
  ];
};

export const MessageThreading: React.FC<MessageThreadingProps> = ({
  messages: propMessages,
  threads: propThreads,
  branches: propBranches,
  activeThreadId,
  onReplyToMessage,
  onCreateBranch,
  onResolveThread,
  onSwitchThread,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'flat' | 'threaded' | 'branches'>('threaded');
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showBranchModal, setShowBranchModal] = useState<string | null>(null);
  const [branchTitle, setBranchTitle] = useState('');
  const [branchReason, setBranchReason] = useState('');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  // Use provided or mock data
  const messages = useMemo(() => propMessages || generateMockMessages(), [propMessages]);
  const threads = useMemo(() => propThreads || generateMockThreads(), [propThreads]);
  const branches = useMemo(() => propBranches || [], [propBranches]);

  // Build message tree
  const messageTree = useMemo(() => {
    const rootMessages: ThreadedMessage[] = [];
    const childrenMap = new Map<string, ThreadedMessage[]>();

    messages.forEach(msg => {
      if (!msg.parentId) {
        rootMessages.push(msg);
      } else {
        const children = childrenMap.get(msg.parentId) || [];
        children.push(msg);
        childrenMap.set(msg.parentId, children);
      }
    });

    return { rootMessages, childrenMap };
  }, [messages]);

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

  const handleReply = useCallback(() => {
    if (selectedMessage && replyText.trim()) {
      onReplyToMessage?.(selectedMessage, replyText);
      setReplyText('');
      setSelectedMessage(null);
    }
  }, [selectedMessage, replyText, onReplyToMessage]);

  const handleCreateBranch = useCallback(() => {
    if (showBranchModal && branchTitle.trim()) {
      onCreateBranch?.(showBranchModal, branchTitle, branchReason || undefined);
      setBranchTitle('');
      setBranchReason('');
      setShowBranchModal(null);
    }
  }, [showBranchModal, branchTitle, branchReason, onCreateBranch]);

  const toggleThread = (threadId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  // Render a single message with its thread
  const renderMessage = (message: ThreadedMessage, depth: number = 0) => {
    const children = messageTree.childrenMap.get(message.id) || [];
    const isSelected = selectedMessage === message.id;
    const hasReplies = children.length > 0 || (message.replyCount && message.replyCount > 0);

    return (
      <div key={message.id} style={{ marginLeft: depth > 0 ? '24px' : 0 }}>
        <div
          style={{
            background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.03)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '8px',
            borderLeft: depth > 0 ? '2px solid rgba(139, 92, 246, 0.3)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            {/* Avatar */}
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: message.sender === 'user'
                ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              flexShrink: 0,
            }}>
              {message.senderName.charAt(0)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{message.senderName}</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{formatTime(message.timestamp)}</span>
                {message.isEdited && (
                  <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>(edited)</span>
                )}
              </div>

              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
                {message.text}
              </p>

              {/* Reactions */}
              {message.reactions && message.reactions.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                  {message.reactions.map((reaction, i) => (
                    <span
                      key={i}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                      }}
                    >
                      {reaction.emoji} {reaction.count}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '10px',
                fontSize: '0.8rem',
              }}>
                <button
                  onClick={() => setSelectedMessage(isSelected ? null : message.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: isSelected ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>↩️</span> Reply
                  {hasReplies && viewMode === 'flat' && (
                    <span style={{ opacity: 0.6 }}>({message.replyCount || children.length})</span>
                  )}
                </button>

                <button
                  onClick={() => setShowBranchModal(message.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>🌿</span> Branch
                </button>

                <button
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>📌</span> Pin
                </button>
              </div>
            </div>
          </div>

          {/* Reply Input */}
          {isSelected && (
            <div style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                  placeholder="Type your reply..."
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: 'white',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                  autoFocus
                />
                <button
                  onClick={handleReply}
                  disabled={!replyText.trim()}
                  style={{
                    background: replyText.trim() ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    color: 'white',
                    cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 'bold',
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Child messages (threaded view) */}
        {viewMode === 'threaded' && children.length > 0 && (
          <div>
            {children.map(child => renderMessage(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98), rgba(20, 20, 35, 0.98))',
      borderRadius: '16px',
      padding: '24px',
      color: 'white',
      maxWidth: '700px',
      width: '100%',
      maxHeight: '85vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>🌳</span>
            Message Threading
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            {threads.length} threads · {branches.length} branches
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* View Mode Toggle */}
          <div style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            padding: '2px',
          }}>
            {(['flat', 'threaded', 'branches'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  background: viewMode === mode ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  textTransform: 'capitalize',
                }}
              >
                {mode}
              </button>
            ))}
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
      </div>

      {/* Thread List (for branches view) */}
      {viewMode === 'branches' && (
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 'bold', opacity: 0.6, marginBottom: '10px' }}>
            ACTIVE THREADS
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => {
                  onSwitchThread?.(thread.id);
                  toggleThread(thread.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: activeThreadId === thread.id ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                  border: activeThreadId === thread.id ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid transparent',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>
                    {thread.title || 'Untitled Thread'}
                    {thread.isResolved && (
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '0.7rem',
                        background: 'rgba(34, 197, 94, 0.2)',
                        color: '#4ade80',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}>
                        Resolved
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                    {thread.participants.join(', ')} · {formatTime(thread.lastActivity)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {thread.labels.map(label => (
                    <span
                      key={label}
                      style={{
                        fontSize: '0.7rem',
                        background: 'rgba(255,255,255,0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {viewMode === 'flat' ? (
          // Flat view - all messages chronologically
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.map(msg => renderMessage(msg, 0))}
          </div>
        ) : viewMode === 'threaded' ? (
          // Threaded view - nested replies
          <div>
            {messageTree.rootMessages.map(msg => renderMessage(msg, 0))}
          </div>
        ) : (
          // Branches view - show only selected thread
          <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
            <p>Select a thread above to view its messages</p>
          </div>
        )}
      </div>

      {/* Thread Summary */}
      {viewMode === 'threaded' && threads.length > 0 && (
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}>
          <h4 style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '10px' }}>
            Thread Summary
          </h4>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {threads.slice(0, 3).map((thread) => (
              <div
                key={thread.id}
                onClick={() => onSwitchThread?.(thread.id)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  flex: '1 1 150px',
                  minWidth: '150px',
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px' }}>
                  {thread.title || 'Thread'}
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                  {thread.participants.length} participants
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Branch Modal */}
      {showBranchModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => setShowBranchModal(null)}
        >
          <div
            style={{
              background: 'rgba(30, 30, 50, 0.98)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🌿</span> Create Branch
            </h3>

            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '16px' }}>
              Start a separate discussion thread from this message. Useful for side conversations or exploring alternative ideas.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
                Branch Title *
              </label>
              <input
                type="text"
                value={branchTitle}
                onChange={(e) => setBranchTitle(e.target.value)}
                placeholder="e.g., Alternative approach discussion"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.7, display: 'block', marginBottom: '6px' }}>
                Reason (optional)
              </label>
              <textarea
                value={branchReason}
                onChange={(e) => setBranchReason(e.target.value)}
                placeholder="Why are you creating this branch?"
                rows={2}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'white',
                  fontSize: '0.9rem',
                  outline: 'none',
                  resize: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowBranchModal(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBranch}
                disabled={!branchTitle.trim()}
                style={{
                  background: branchTitle.trim() ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: branchTitle.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                }}
              >
                Create Branch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Thread indicator badge
export const ThreadIndicator: React.FC<{
  replyCount: number;
  participants: string[];
  onClick?: () => void;
}> = ({ replyCount, participants, onClick }) => {
  if (replyCount === 0) return null;

  return (
    <button
      onClick={onClick}
      style={{
        background: 'rgba(139, 92, 246, 0.15)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '8px',
        padding: '6px 12px',
        color: '#a78bfa',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.8rem',
      }}
    >
      <span>💬</span>
      <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
      <div style={{ display: 'flex', marginLeft: '4px' }}>
        {participants.slice(0, 3).map((p, i) => (
          <div
            key={p}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.6rem',
              fontWeight: 'bold',
              marginLeft: i > 0 ? '-6px' : 0,
              border: '2px solid rgba(30, 30, 50, 1)',
            }}
          >
            {p.charAt(0)}
          </div>
        ))}
        {participants.length > 3 && (
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.6rem',
              marginLeft: '-6px',
              border: '2px solid rgba(30, 30, 50, 1)',
            }}
          >
            +{participants.length - 3}
          </div>
        )}
      </div>
    </button>
  );
};

export default MessageThreading;
