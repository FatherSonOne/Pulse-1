/**
 * ScheduleMessageModal Component
 * Modal for scheduling messages to be sent at a later time
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScheduledMessage {
  id: string;
  text: string;
  scheduledFor: Date;
}

interface ScheduleMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageText: string;
  scheduleDate: string;
  scheduleTime: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  scheduledMessages: ScheduledMessage[];
  onSchedule: () => void;
}

export const ScheduleMessageModal: React.FC<ScheduleMessageModalProps> = ({
  isOpen,
  onClose,
  messageText,
  scheduleDate,
  scheduleTime,
  onDateChange,
  onTimeChange,
  scheduledMessages,
  onSchedule,
}) => {
  if (!isOpen) return null;

  const canSchedule = messageText.trim() && scheduleDate && scheduleTime;

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
              <i className="fa-solid fa-clock text-blue-500"></i>
              Schedule Message
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
            {/* Message Preview */}
            <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg text-sm text-zinc-600 dark:text-zinc-300">
              {messageText || 'No message to schedule'}
            </div>

            {/* Date/Time Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={e => onDateChange(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={e => onTimeChange(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                />
              </div>
            </div>

            {/* Scheduled Messages List */}
            {scheduledMessages.length > 0 && (
              <div className="border-t pt-3">
                <div className="text-xs text-zinc-500 mb-2">
                  Scheduled Messages ({scheduledMessages.length})
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {scheduledMessages.map(msg => (
                    <div
                      key={msg.id}
                      className="flex justify-between items-center text-xs bg-zinc-50 dark:bg-zinc-800 p-2 rounded"
                    >
                      <span className="truncate flex-1">{msg.text}</span>
                      <span className="text-zinc-400 ml-2">
                        {msg.scheduledFor.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
            >
              Cancel
            </button>
            <button
              onClick={onSchedule}
              disabled={!canSchedule}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Schedule
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ScheduleMessageModal;
