/**
 * FocusDigestCard Component
 * Displays a summary of messages received during a focus session
 * Features: Grouped by conversation/sender, priority indicators, quick actions
 * Appears when focus session ends
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
export interface DigestMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: Date;
  threadId: string;
  threadName: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  isRead: boolean;
}

export interface DigestGroup {
  threadId: string;
  threadName: string;
  senderName: string;
  senderAvatar?: string;
  messages: DigestMessage[];
  highestPriority: 'urgent' | 'high' | 'normal' | 'low';
  unreadCount: number;
}

interface FocusDigestCardProps {
  messages: DigestMessage[];
  sessionDuration: number; // in minutes
  onReply: (threadId: string, messageId: string) => void;
  onDismiss: (messageId: string) => void;
  onSnooze: (messageId: string, minutes: number) => void;
  onDismissAll: () => void;
  onViewThread: (threadId: string) => void;
  onClose: () => void;
  isVisible: boolean;
}

// Priority configuration
const priorityConfig = {
  urgent: {
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon: 'AlertTriangle',
    label: 'Urgent',
  },
  high: {
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    icon: 'AlertCircle',
    label: 'High',
  },
  normal: {
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon: 'MessageCircle',
    label: 'Normal',
  },
  low: {
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    icon: 'MessageSquare',
    label: 'Low',
  },
};

// Animation variants
const containerVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -20,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 1, 1],
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: 0.2,
    },
  },
};

const actionButtonVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.05 },
  tap: { scale: 0.95 },
};

export const FocusDigestCard: React.FC<FocusDigestCardProps> = ({
  messages,
  sessionDuration,
  onReply,
  onDismiss,
  onSnooze,
  onDismissAll,
  onViewThread,
  onClose,
  isVisible,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState<string | null>(null);

  // Group messages by thread/sender
  const groupedMessages = useMemo<DigestGroup[]>(() => {
    const groups: Map<string, DigestGroup> = new Map();

    messages.forEach((message) => {
      const key = message.threadId;

      if (!groups.has(key)) {
        groups.set(key, {
          threadId: message.threadId,
          threadName: message.threadName,
          senderName: message.senderName,
          senderAvatar: message.senderAvatar,
          messages: [],
          highestPriority: 'low',
          unreadCount: 0,
        });
      }

      const group = groups.get(key)!;
      group.messages.push(message);

      // Update highest priority
      const priorityOrder = ['urgent', 'high', 'normal', 'low'];
      if (priorityOrder.indexOf(message.priority) < priorityOrder.indexOf(group.highestPriority)) {
        group.highestPriority = message.priority;
      }

      if (!message.isRead) {
        group.unreadCount++;
      }
    });

    // Sort by priority and unread count
    return Array.from(groups.values()).sort((a, b) => {
      const priorityOrder = ['urgent', 'high', 'normal', 'low'];
      const priorityDiff = priorityOrder.indexOf(a.highestPriority) - priorityOrder.indexOf(b.highestPriority);
      if (priorityDiff !== 0) return priorityDiff;
      return b.unreadCount - a.unreadCount;
    });
  }, [messages]);

  // Statistics
  const stats = useMemo(() => {
    const urgentCount = messages.filter(m => m.priority === 'urgent').length;
    const highCount = messages.filter(m => m.priority === 'high').length;
    const totalUnread = messages.filter(m => !m.isRead).length;
    return { urgentCount, highCount, totalUnread, total: messages.length };
  }, [messages]);

  const toggleGroup = (threadId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(threadId)) {
      newExpanded.delete(threadId);
    } else {
      newExpanded.add(threadId);
    }
    setExpandedGroups(newExpanded);
  };

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const snoozeOptions = [
    { label: '15 min', minutes: 15 },
    { label: '30 min', minutes: 30 },
    { label: '1 hour', minutes: 60 },
    { label: '2 hours', minutes: 120 },
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-6 py-5 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Focus Session Digest</h2>
                    <p className="text-sm text-gray-400">
                      {sessionDuration} min session completed
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                  aria-label="Close digest"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800/60 text-sm">
                  <span className="text-gray-400">{stats.total}</span>
                  <span className="text-gray-500">messages</span>
                </div>
                {stats.urgentCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 text-sm">
                    <span className="text-red-400 font-medium">{stats.urgentCount}</span>
                    <span className="text-red-400/80">urgent</span>
                  </div>
                )}
                {stats.highCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/20 text-sm">
                    <span className="text-orange-400 font-medium">{stats.highCount}</span>
                    <span className="text-orange-400/80">high</span>
                  </div>
                )}
              </div>
            </div>

            {/* Message Groups */}
            <div className="overflow-y-auto max-h-[50vh] p-4 space-y-3">
              {groupedMessages.length === 0 ? (
                <motion.div
                  className="text-center py-12"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-gray-300 font-medium">All caught up!</p>
                  <p className="text-gray-500 text-sm mt-1">No messages during your focus session</p>
                </motion.div>
              ) : (
                groupedMessages.map((group, index) => (
                  <motion.div
                    key={group.threadId}
                    variants={itemVariants}
                    className={`rounded-xl border ${priorityConfig[group.highestPriority].borderColor} ${priorityConfig[group.highestPriority].bgColor} overflow-hidden`}
                  >
                    {/* Group Header */}
                    <button
                      className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors"
                      onClick={() => toggleGroup(group.threadId)}
                    >
                      {/* Avatar */}
                      <div className="relative">
                        {group.senderAvatar ? (
                          <img
                            src={group.senderAvatar}
                            alt={group.senderName}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-medium">
                            {group.senderName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {group.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">
                            {group.unreadCount}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{group.threadName}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${priorityConfig[group.highestPriority].bgColor} ${priorityConfig[group.highestPriority].color}`}>
                            {priorityConfig[group.highestPriority].label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 truncate">
                          {group.messages[0].content}
                        </p>
                      </div>

                      {/* Expand Icon */}
                      <motion.svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        animate={{ rotate: expandedGroups.has(group.threadId) ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </motion.svg>
                    </button>

                    {/* Expanded Messages */}
                    <AnimatePresence>
                      {expandedGroups.has(group.threadId) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-gray-700/50"
                        >
                          {group.messages.map((message) => (
                            <div
                              key={message.id}
                              className="px-4 py-3 hover:bg-white/5 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm text-gray-300">{message.senderName}</span>
                                    <span className="text-xs text-gray-500">{formatTimestamp(message.timestamp)}</span>
                                  </div>
                                  <p className="text-sm text-gray-400 line-clamp-2">{message.content}</p>
                                </div>

                                {/* Quick Actions */}
                                <div className="flex items-center gap-1">
                                  <motion.button
                                    variants={actionButtonVariants}
                                    whileHover="hover"
                                    whileTap="tap"
                                    onClick={() => onReply(message.threadId, message.id)}
                                    className="p-2 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors"
                                    aria-label="Reply"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                    </svg>
                                  </motion.button>

                                  {/* Snooze Menu */}
                                  <div className="relative">
                                    <motion.button
                                      variants={actionButtonVariants}
                                      whileHover="hover"
                                      whileTap="tap"
                                      onClick={() => setSnoozeMenuOpen(snoozeMenuOpen === message.id ? null : message.id)}
                                      className="p-2 rounded-lg hover:bg-yellow-500/20 text-yellow-400 transition-colors"
                                      aria-label="Snooze"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </motion.button>

                                    <AnimatePresence>
                                      {snoozeMenuOpen === message.id && (
                                        <motion.div
                                          initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                          animate={{ opacity: 1, scale: 1, y: 0 }}
                                          exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                          className="absolute right-0 top-full mt-1 w-32 py-1 rounded-lg bg-gray-800 border border-gray-700 shadow-xl z-10"
                                        >
                                          {snoozeOptions.map((option) => (
                                            <button
                                              key={option.minutes}
                                              onClick={() => {
                                                onSnooze(message.id, option.minutes);
                                                setSnoozeMenuOpen(null);
                                              }}
                                              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                                            >
                                              {option.label}
                                            </button>
                                          ))}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>

                                  <motion.button
                                    variants={actionButtonVariants}
                                    whileHover="hover"
                                    whileTap="tap"
                                    onClick={() => onDismiss(message.id)}
                                    className="p-2 rounded-lg hover:bg-gray-500/20 text-gray-400 transition-colors"
                                    aria-label="Dismiss"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </motion.button>
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* View Thread Button */}
                          <div className="px-4 py-3 border-t border-gray-700/50">
                            <button
                              onClick={() => onViewThread(group.threadId)}
                              className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
                            >
                              View full conversation
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer Actions */}
            {groupedMessages.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50">
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={onDismissAll}
                    className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                  >
                    Dismiss All
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                  >
                    Review Later
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FocusDigestCard;
