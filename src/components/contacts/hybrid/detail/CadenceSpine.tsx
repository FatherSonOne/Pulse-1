// ============================================
// CadenceSpine — the "keep-in-touch goal" block for the Focus column.
// Reuses contactGoalService + RelationshipAutopilotToggle + ContactGoalModal
// verbatim; the JSX is a faithful port of the legacy ContactDetail goal section
// (lines ~386-460 + 683-698), self-contained so FocusColumn just drops it in.
// See docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md §4.3 (Goals + autopilot).
// ============================================

import React, { useEffect, useState } from 'react';
import { Check, Target } from 'lucide-react';
import { Contact } from '../../../../types';
import { ContactGoal, getGoalStatus, formatNextActionDate } from '../../../../types/contactGoalTypes';
import {
  getGoalForContact,
  upsertGoal,
  deleteGoal,
  markActionComplete,
} from '../../../../services/contactGoalService';
import { ContactGoalModal } from '../../ContactGoalModal';
import { RelationshipAutopilotToggle } from '../../RelationshipAutopilotToggle';

export const CadenceSpine: React.FC<{ contact: Contact; userId?: string }> = ({ contact, userId }) => {
  const [goal, setGoal] = useState<ContactGoal | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  useEffect(() => {
    if (!contact || !userId) return;
    getGoalForContact(userId, contact.id)
      .then(setGoal)
      .catch(() => setGoal(null));
  }, [contact?.id, userId]);

  const status = goal ? getGoalStatus(goal) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500"
          style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
        >
          Keep-in-touch cadence
        </span>
        <button
          onClick={() => setGoalModalOpen(true)}
          className="text-xs font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition"
        >
          {goal ? 'Edit' : '+ Set goal'}
        </button>
      </div>

      {goal ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                status === 'overdue'
                  ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300'
                  : status === 'due_soon'
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <i
                className={`fa-solid ${
                  status === 'overdue'
                    ? 'fa-circle-exclamation'
                    : status === 'due_soon'
                      ? 'fa-clock'
                      : 'fa-circle-check'
                } text-[10px]`}
              />
              {formatNextActionDate(goal.nextActionAt)}
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 capitalize">
              {goal.frequency.replace('biweekly', 'bi-weekly')} ·{' '}
              {goal.channel === 'any' ? 'any channel' : goal.channel}
            </span>
          </div>

          {goal.notes && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">"{goal.notes}"</p>
          )}

          {userId && (
            <RelationshipAutopilotToggle goal={goal} userId={userId} onGoalUpdated={setGoal} />
          )}

          <button
            onClick={async () => {
              if (!userId) return;
              await markActionComplete(goal.id, userId, goal.frequency);
              const updated = await getGoalForContact(userId, contact.id);
              setGoal(updated);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-xl border border-emerald-100 dark:border-emerald-800/40 transition"
          >
            <Check className="w-4 h-4" />
            Mark done, schedule next
          </button>
        </div>
      ) : (
        <button
          onClick={() => setGoalModalOpen(true)}
          className="w-full flex flex-col items-center justify-center gap-1.5 py-5 text-zinc-400 dark:text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-rose-300 dark:hover:border-rose-700 hover:text-rose-500 dark:hover:text-rose-400 transition group"
        >
          <Target className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-medium">Set a keep-in-touch goal</span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Get reminded when it's time to reach out
          </span>
        </button>
      )}

      {goalModalOpen && userId && (
        <ContactGoalModal
          contact={{ ...contact, pulseUserId: userId }}
          existingGoal={goal}
          onSave={async (goalData) => {
            const saved = await upsertGoal({ ...goalData, userId });
            setGoal(saved);
          }}
          onDelete={async (goalId) => {
            await deleteGoal(goalId, userId);
            setGoal(null);
          }}
          onClose={() => setGoalModalOpen(false)}
        />
      )}
    </div>
  );
};

export default CadenceSpine;
