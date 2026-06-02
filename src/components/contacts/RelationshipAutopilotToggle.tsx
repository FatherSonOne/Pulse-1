// ============================================
// RELATIONSHIP AUTOPILOT TOGGLE
// Compact inline toggle for enabling/disabling autopilot on a goal.
// Used inside ContactDetail's goal section.
// ============================================

import React, { useState } from 'react';
import { ContactGoal, GoalFrequency, formatNextActionDate } from '../../types/contactGoalTypes';
import { setAutopilot } from '../../services/contactGoalService';

// ==================== TYPES ====================

interface RelationshipAutopilotToggleProps {
  goal: ContactGoal;
  userId: string;
  onGoalUpdated: (updated: ContactGoal) => void;
}

// ==================== COMPONENT ====================

export const RelationshipAutopilotToggle: React.FC<RelationshipAutopilotToggleProps> = ({
  goal,
  userId,
  onGoalUpdated,
}) => {
  const [isToggling, setIsToggling] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(goal.autopilotEnabled);

  async function handleToggle() {
    const newValue = !localEnabled;
    setLocalEnabled(newValue);
    setIsToggling(true);
    try {
      await setAutopilot(goal.id, userId, newValue);
      onGoalUpdated({ ...goal, autopilotEnabled: newValue });
    } catch {
      setLocalEnabled(!newValue); // revert on error
    } finally {
      setIsToggling(false);
    }
  }

  const nextDue = formatNextActionDate(goal.nextActionAt);

  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
      localEnabled
        ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/40'
        : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
    }`}>
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          localEnabled ? 'bg-rose-100 dark:bg-rose-900/40' : 'bg-zinc-200 dark:bg-zinc-700'
        }`}>
          <i className={`fa-solid fa-robot text-xs ${
            localEnabled ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500 dark:text-zinc-400'
          }`} />
        </div>
        <div className="min-w-0">
          <p className={`text-xs font-semibold truncate ${
            localEnabled ? 'text-rose-800 dark:text-rose-200' : 'text-zinc-700 dark:text-zinc-300'
          }`}>
            Autopilot {localEnabled ? 'on' : 'off'}
          </p>
          <p className={`text-[10px] truncate ${
            localEnabled ? 'text-rose-500 dark:text-rose-400' : 'text-zinc-400 dark:text-zinc-500'
          }`}>
            {localEnabled ? `Next: ${nextDue}` : 'Nudges you in Today when due'}
          </p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={isToggling}
        className={`relative flex-shrink-0 rounded-full transition-colors ${
          localEnabled ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-600'
        }`}
        style={{ width: '36px', height: '20px' }}
        title={localEnabled ? 'Disable autopilot' : 'Enable autopilot'}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            localEnabled ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
};

export default RelationshipAutopilotToggle;
