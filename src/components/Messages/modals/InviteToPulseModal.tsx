/**
 * InviteToPulseModal Component
 * Modal for inviting contacts to join Pulse via email, SMS, or shareable link
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface InviteTargetContact {
  name: string;
  email?: string;
  phone?: string;
}

interface InviteToPulseModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetContact: InviteTargetContact | null;
  isSent: boolean;
  isCopied: boolean;
  onSendEmail: () => void;
  onCopyLink: () => void;
  onSendSMS: () => void;
  onDone: () => void;
}

export const InviteToPulseModal: React.FC<InviteToPulseModalProps> = ({
  isOpen,
  onClose,
  targetContact,
  isSent,
  isCopied,
  onSendEmail,
  onCopyLink,
  onSendSMS,
  onDone,
}) => {
  if (!isOpen || !targetContact) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header with gradient */}
          <div className="relative p-6 text-center bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500">
            <div className="absolute inset-0 bg-black/10"></div>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white z-10 transition"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
            <div className="relative z-10">
              <div className="w-16 h-16 mx-auto mb-4 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                <i className="fa-solid fa-rocket text-3xl text-white"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Invite to Pulse</h3>
              <p className="text-white/80 text-sm">Share the future of communication</p>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            {isSent ? (
              /* Success State */
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-check text-3xl text-emerald-500"></i>
                </div>
                <h4 className="text-lg font-bold dark:text-white mb-2">Email Ready!</h4>
                <p className="text-zinc-500 text-sm mb-4">
                  Your email app should open with a pre-written invitation for {targetContact.name}.
                </p>
                <button
                  onClick={onDone}
                  className="px-6 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm font-bold hover:opacity-90 transition"
                >
                  Done
                </button>
              </div>
            ) : (
              /* Invite Options */
              <>
                <div className="mb-6">
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                    Invite <span className="font-bold text-zinc-900 dark:text-white">{targetContact.name}</span> to join you on Pulse, the AI-native communication platform that's changing how teams connect.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Email Invite */}
                  {targetContact.email && (
                    <button
                      onClick={onSendEmail}
                      className="w-full p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600 transition flex items-center gap-4 group"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-white flex items-center justify-center group-hover:scale-110 transition shadow-lg">
                        <i className="fa-solid fa-envelope text-lg"></i>
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-bold text-zinc-900 dark:text-white">Send Email Invite</div>
                        <div className="text-xs text-zinc-500">{targetContact.email}</div>
                      </div>
                      <i className="fa-solid fa-chevron-right text-zinc-400"></i>
                    </button>
                  )}

                  {/* Copy Shareable Link */}
                  <button
                    onClick={onCopyLink}
                    className="w-full p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 transition flex items-center gap-4 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center group-hover:scale-110 transition shadow-lg">
                      <i className={`fa-solid ${isCopied ? 'fa-check' : 'fa-copy'} text-lg`}></i>
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-zinc-900 dark:text-white">
                        {isCopied ? 'Copied!' : 'Copy Invite Message'}
                      </div>
                      <div className="text-xs text-zinc-500">Share on social or messaging apps</div>
                    </div>
                    <i className="fa-solid fa-chevron-right text-zinc-400"></i>
                  </button>

                  {/* SMS Invite */}
                  {targetContact.phone && (
                    <button
                      onClick={onSendSMS}
                      className="w-full p-4 rounded-xl bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border border-pink-200 dark:border-pink-800 hover:border-pink-400 dark:hover:border-pink-600 transition flex items-center gap-4 group"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-white flex items-center justify-center group-hover:scale-110 transition shadow-lg">
                        <i className="fa-solid fa-comment-sms text-lg"></i>
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-bold text-zinc-900 dark:text-white">Send Text Invite</div>
                        <div className="text-xs text-zinc-500">{targetContact.phone}</div>
                      </div>
                      <i className="fa-solid fa-chevron-right text-zinc-400"></i>
                    </button>
                  )}
                </div>

                {/* Features Preview */}
                <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs text-zinc-400 uppercase tracking-wider font-bold mb-3">What they'll get</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <i className="fa-solid fa-wand-magic-sparkles text-rose-500"></i>
                      <span>AI-powered messaging</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <i className="fa-solid fa-calendar text-blue-500"></i>
                      <span>Smart calendar</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <i className="fa-solid fa-microphone text-purple-500"></i>
                      <span>Meeting transcription</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <i className="fa-solid fa-users text-emerald-500"></i>
                      <span>Team collaboration</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InviteToPulseModal;
