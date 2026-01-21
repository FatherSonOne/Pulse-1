/**
 * ConversationStatsModal Component
 * Modal displaying conversation statistics and metrics
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConversationStats {
  totalMessages: number;
  averageResponseTime: number;
  sentByMe: number;
  sentByThem: number;
  attachments: number;
  decisions: {
    approved: number;
    pending: number;
  };
  tasksCreated: number;
}

interface ConversationStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: ConversationStats | null;
}

export const ConversationStatsModal: React.FC<ConversationStatsModalProps> = ({
  isOpen,
  onClose,
  stats,
}) => {
  if (!isOpen || !stats) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="font-bold dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-chart-bar text-blue-500"></i>
              Conversation Statistics
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition"
            >
              <i className="fa-solid fa-xmark text-zinc-500"></i>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Main Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-500">{stats.totalMessages}</div>
                <div className="text-xs text-zinc-500">Total Messages</div>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-500">{stats.averageResponseTime}m</div>
                <div className="text-xs text-zinc-500">Avg Response</div>
              </div>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-lg font-bold dark:text-white">{stats.sentByMe}</div>
                <div className="text-xs text-zinc-500">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold dark:text-white">{stats.sentByThem}</div>
                <div className="text-xs text-zinc-500">Received</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold dark:text-white">{stats.attachments}</div>
                <div className="text-xs text-zinc-500">Attachments</div>
              </div>
            </div>

            {/* Decisions */}
            <div className="border-t pt-3">
              <div className="text-xs text-zinc-500 mb-2">Decisions</div>
              <div className="flex gap-3">
                <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-xs">
                  {stats.decisions.approved} Approved
                </span>
                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs">
                  {stats.decisions.pending} Pending
                </span>
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                  {stats.tasksCreated} Tasks
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConversationStatsModal;
