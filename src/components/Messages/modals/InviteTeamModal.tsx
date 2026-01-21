/**
 * InviteTeamModal Component
 * Modal for inviting team members to Pulse via email
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type InviteStatus = 'idle' | 'sending' | 'success' | 'error';

interface InviteTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteEmail: string;
  onEmailChange: (email: string) => void;
  inviteStatus: InviteStatus;
  inviteMessage: string;
  onSendInvite: () => void;
}

export const InviteTeamModal: React.FC<InviteTeamModalProps> = ({
  isOpen,
  onClose,
  inviteEmail,
  onEmailChange,
  inviteStatus,
  inviteMessage,
  onSendInvite,
}) => {
  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSendInvite();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={handleClose}
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
              <i className="fa-solid fa-user-plus text-rose-500"></i>
              Invite Team Member
            </h3>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition"
            >
              <i className="fa-solid fa-xmark text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"></i>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Invite a team member to join Pulse. They'll receive an email with instructions to sign in with Google.
            </p>

            {/* Email Input */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => onEmailChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="teammate@example.com"
                disabled={inviteStatus === 'sending'}
                className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition disabled:opacity-50"
                autoFocus
              />
            </div>

            {/* Status Message */}
            {inviteMessage && (
              <div className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
                inviteStatus === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                inviteStatus === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}>
                <i className={`fa-solid ${
                  inviteStatus === 'success' ? 'fa-check-circle' :
                  inviteStatus === 'error' ? 'fa-exclamation-circle' :
                  'fa-circle-info'
                }`}></i>
                {inviteMessage}
              </div>
            )}

            {/* Features Preview */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
              <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                What they'll get
              </div>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-rose-500 text-xs"></i>
                  Access to team messaging & channels
                </li>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-rose-500 text-xs"></i>
                  AI-powered meeting notes & transcription
                </li>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-rose-500 text-xs"></i>
                  Shared contacts & calendar integration
                </li>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-rose-500 text-xs"></i>
                  Install Pulse as a desktop app (PWA)
                </li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={onSendInvite}
              disabled={!inviteEmail.trim() || inviteStatus === 'sending'}
              className="px-6 py-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {inviteStatus === 'sending' ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  Sending...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i>
                  Send Invite
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InviteTeamModal;
