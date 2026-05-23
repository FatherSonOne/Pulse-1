/**
 * ConversationStatsModal Component
 * Modal displaying conversation statistics and metrics
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

import { BarChart, X } from 'lucide-react';

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
  const dialogRef = useFocusTrap<HTMLDivElement>({ active: isOpen, onEscape: onClose });

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
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Conversation statistics"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-[rgba(255,255,255,0.03)] w-full max-w-md rounded-2xl shadow-2xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] flex justify-between items-center">
            <h3 className="font-bold dark:text-white flex items-center gap-2">
              <BarChart className="text-[#f43f5e]" />
              Conversation Statistics
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-[#f2f2f2] dark:hover:bg-[rgba(255,255,255,0.055)] flex items-center justify-center transition"
            >
              <X className="text-zinc-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Main Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#f8f8f8] dark:bg-[rgba(255,255,255,0.055)] p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-[#f43f5e]">{stats.totalMessages}</div>
                <div className="text-xs text-zinc-500">Total Messages</div>
              </div>
              <div className="bg-[#f8f8f8] dark:bg-[rgba(255,255,255,0.055)] p-3 rounded-lg text-center">
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
                <span className="px-2 py-1 bg-[rgba(244,63,94,0.06)] dark:bg-[rgba(244,63,94,0.08)] text-[#e11d48] dark:text-[#fb7185] rounded text-xs">
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

export default React.memo(ConversationStatsModal);
