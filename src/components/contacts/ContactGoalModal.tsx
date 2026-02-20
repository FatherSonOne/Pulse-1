// ============================================
// CONTACT GOAL MODAL
// Set / edit a keep-in-touch goal for a contact.
// Includes frequency picker, channel selector, autopilot toggle, and notes.
// ============================================

import React, { useState, useEffect } from 'react';
import {
  ContactGoal,
  GoalFrequency,
  GOAL_FREQUENCY_CONFIG,
  calculateNextActionDate,
} from '../../types/contactGoalTypes';
import { Contact } from '../../types';

// ==================== TYPES ====================

interface ContactGoalModalProps {
  contact: Contact;
  existingGoal?: ContactGoal | null;
  onSave: (goal: Omit<ContactGoal, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>;
  onDelete?: (goalId: string) => Promise<void>;
  onClose: () => void;
}

// ==================== CHANNEL CONFIG ====================

const CHANNELS: Array<{ id: ContactGoal['channel']; label: string; icon: string }> = [
  { id: 'any',     label: 'Any',     icon: 'fa-solid fa-arrows-turn-to-dots' },
  { id: 'message', label: 'Message', icon: 'fa-solid fa-message' },
  { id: 'call',    label: 'Call',    icon: 'fa-solid fa-phone' },
  { id: 'meeting', label: 'Meeting', icon: 'fa-solid fa-video' },
  { id: 'email',   label: 'Email',   icon: 'fa-solid fa-envelope' },
];

const FREQUENCIES: GoalFrequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annually'];

// ==================== COMPONENT ====================

export const ContactGoalModal: React.FC<ContactGoalModalProps> = ({
  contact,
  existingGoal,
  onSave,
  onDelete,
  onClose,
}) => {
  const [frequency, setFrequency] = useState<GoalFrequency>(
    existingGoal?.frequency ?? 'monthly'
  );
  const [channel, setChannel] = useState<ContactGoal['channel']>(
    existingGoal?.channel ?? 'any'
  );
  const [notes, setNotes] = useState(existingGoal?.notes ?? '');
  const [autopilot, setAutopilot] = useState(existingGoal?.autopilotEnabled ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const nextDate = calculateNextActionDate(frequency);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave({
        ...(existingGoal?.id ? { id: existingGoal.id } : {}),
        userId: contact.pulseUserId ?? '', // resolved by caller
        contactId: contact.id,
        contactEmail: contact.email,
        frequency,
        channel,
        notes: notes.trim() || undefined,
        autopilotEnabled: autopilot,
        nextActionAt: existingGoal?.nextActionAt || nextDate.toISOString(),
        lastCompletedAt: existingGoal?.lastCompletedAt,
      });
      onClose();
    } catch {
      /* TODO: show error toast */
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!existingGoal || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(existingGoal.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">
              {existingGoal ? 'Edit goal' : 'Set a goal'} for {contact.name.split(' ')[0]}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Stay on top of this relationship automatically
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">

          {/* Frequency */}
          <div>
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
              Reach out
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {FREQUENCIES.map(freq => {
                const cfg = GOAL_FREQUENCY_CONFIG[freq];
                const isActive = frequency === freq;
                return (
                  <button
                    key={freq}
                    onClick={() => setFrequency(freq)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all
                      ${isActive
                        ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-600 dark:text-zinc-300'
                      }`}
                  >
                    <span className="text-base leading-none">{cfg.icon}</span>
                    <span className="text-[10px] font-medium leading-tight">{cfg.shortLabel}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1.5">
              Next action: {nextDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          </div>

          {/* Channel */}
          <div>
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
              Preferred channel
            </label>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map(ch => {
                const isActive = channel === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setChannel(ch.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all
                      ${isActive
                        ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                  >
                    <i className={`${ch.icon} text-[10px]`} />
                    {ch.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reminder note */}
          <div>
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
              Reminder note <span className="text-zinc-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={`e.g. "Ask about the product launch" or "Check in on the Q1 partnership"`}
              rows={2}
              className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          {/* Autopilot toggle */}
          <div className="flex items-start justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/40">
            <div className="flex-1 mr-3">
              <div className="flex items-center gap-1.5">
                <i className="fa-solid fa-robot text-indigo-500 text-xs" />
                <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
                  Autopilot
                </span>
              </div>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5 leading-relaxed">
                When it's time, AI will draft a message for you automatically in Today.
              </p>
            </div>
            <button
              onClick={() => setAutopilot(p => !p)}
              className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 mt-0.5 ${
                autopilot ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-600'
              }`}
              style={{ height: '22px', width: '40px' }}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  autopilot ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center justify-between">
          {existingGoal && onDelete ? (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-xs text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              {isDeleting ? 'Removing…' : 'Remove goal'}
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : existingGoal ? 'Update goal' : 'Set goal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactGoalModal;
