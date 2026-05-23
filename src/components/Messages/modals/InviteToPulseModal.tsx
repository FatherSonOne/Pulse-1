/**
 * InviteToPulseModal Component
 * Modal for inviting contacts to join Pulse via email, SMS, or shareable link
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

import { Calendar, Check, ChevronRight, Copy, Mail, MessageSquare, Mic, Rocket, Users, Wand2, X } from 'lucide-react';

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
  const dialogRef = useFocusTrap<HTMLDivElement>({ active: isOpen, onEscape: onClose });

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
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Invite ${targetContact.name} to Pulse`}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white dark:bg-[rgba(255,255,255,0.03)] w-full max-w-md rounded-2xl shadow-2xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header with gradient */}
          <div className="relative p-6 text-center bg-gradient-to-br from-[#f43f5e] to-[#ec4899]">
            <div className="absolute inset-0 bg-black/10"></div>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white z-10 transition"
            >
              <X className="text-lg" />
            </button>
            <div className="relative z-10">
              <div className="w-16 h-16 mx-auto mb-4 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                <Rocket className="text-3xl text-white" />
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
                  <Check className="text-3xl text-emerald-500" />
                </div>
                <h4 className="text-lg font-bold dark:text-white mb-2">Email Ready!</h4>
                <p className="text-zinc-500 text-sm mb-4">
                  Your email app should open with a pre-written invitation for {targetContact.name}.
                </p>
                <button
                  onClick={onDone}
                  className="px-6 py-2 bg-[rgba(255,255,255,0.03)] dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm font-bold hover:opacity-90 transition"
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
                      className="w-full p-4 rounded-xl bg-[rgba(244,63,94,0.06)] dark:bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.20)] hover:border-[#f43f5e] transition flex items-center gap-4 group"
                    >
                      <div className="w-12 h-12 rounded-full bg-[var(--pulse-rose-soft)] text-[var(--pulse-coral-fg)] flex items-center justify-center transition">
                        <Mail className="text-lg" />
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-bold text-zinc-900 dark:text-white">Send Email Invite</div>
                        <div className="text-xs text-zinc-500">{targetContact.email}</div>
                      </div>
                      <ChevronRight className="text-zinc-400" />
                    </button>
                  )}

                  {/* Copy Shareable Link */}
                  <button
                    onClick={onCopyLink}
                    className="w-full p-4 rounded-xl bg-[rgba(244,63,94,0.06)] dark:bg-[rgba(244,63,94,0.08)] border border-[rgba(244,63,94,0.20)] hover:border-[#f43f5e] transition flex items-center gap-4 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#f43f5e] to-[#ec4899] text-white flex items-center justify-center transition shadow-lg">
                      {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-zinc-900 dark:text-white">
                        {isCopied ? 'Copied!' : 'Copy Invite Message'}
                      </div>
                      <div className="text-xs text-zinc-500">Share on social or messaging apps</div>
                    </div>
                    <ChevronRight className="text-zinc-400" />
                  </button>

                  {/* SMS Invite */}
                  {targetContact.phone && (
                    <button
                      onClick={onSendSMS}
                      className="w-full p-4 rounded-xl bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border border-pink-200 dark:border-pink-800 hover:border-pink-400 dark:hover:border-pink-600 transition flex items-center gap-4 group"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-white flex items-center justify-center transition shadow-lg">
                        <MessageSquare className="text-lg" />
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-bold text-zinc-900 dark:text-white">Send Text Invite</div>
                        <div className="text-xs text-zinc-500">{targetContact.phone}</div>
                      </div>
                      <ChevronRight className="text-zinc-400" />
                    </button>
                  )}
                </div>

                {/* Features Preview */}
                <div className="mt-6 pt-6 border-t border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.06)]">
                  <p className="text-xs text-zinc-400 uppercase tracking-wider font-bold mb-3">What they'll get</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <Wand2 className="text-rose-500" />
                      <span>AI-powered messaging</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <Calendar className="text-[#f43f5e]" />
                      <span>Smart calendar</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <Mic className="text-[#a1a1aa]" />
                      <span>Meeting transcription</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <Users className="text-emerald-500" />
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
