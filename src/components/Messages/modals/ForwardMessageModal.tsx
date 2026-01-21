/**
 * ForwardMessageModal Component
 * Modal for forwarding messages to other conversations
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ForwardingMessage {
  id: string;
  text: string;
  sender: string;
  source: string;
  timestamp: Date;
  status: string;
}

interface Thread {
  id: string;
  contactName: string;
  avatarColor: string;
}

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ForwardingMessage | null;
  threads: Thread[];
  activeThreadId: string | null;
  onForward: (threadId: string) => void;
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  isOpen,
  onClose,
  message,
  threads,
  activeThreadId,
  onForward,
}) => {
  if (!isOpen || !message) return null;

  const availableThreads = threads.filter(t => t.id !== activeThreadId);

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
              <i className="fa-solid fa-share text-blue-500"></i>
              Forward Message
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition"
            >
              <i className="fa-solid fa-xmark text-zinc-500"></i>
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Message Preview */}
            <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg text-sm text-zinc-600 dark:text-zinc-300 mb-4 max-h-32 overflow-y-auto">
              {message.text}
            </div>

            {/* Thread Selection */}
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 font-medium">
              Select conversation:
            </div>

            {availableThreads.length > 0 ? (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {availableThreads.map(thread => (
                  <button
                    key={thread.id}
                    onClick={() => onForward(thread.id)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition group"
                  >
                    <div
                      className={`w-9 h-9 rounded-full ${thread.avatarColor} flex items-center justify-center text-white text-sm font-bold`}
                    >
                      {thread.contactName.charAt(0)}
                    </div>
                    <span className="text-sm dark:text-white font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                      {thread.contactName}
                    </span>
                    <i className="fa-solid fa-chevron-right text-xs text-zinc-400 ml-auto opacity-0 group-hover:opacity-100 transition"></i>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-400 dark:text-zinc-500">
                <i className="fa-solid fa-inbox text-2xl mb-2"></i>
                <p className="text-sm">No other conversations available</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ForwardMessageModal;
