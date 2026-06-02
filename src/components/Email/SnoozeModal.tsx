// SnoozeModal.tsx - Quick snooze time picker
import React, { useState } from 'react';

import { Clock, X } from 'lucide-react';

interface SnoozeModalProps {
  onSnooze: (snoozeUntil: Date) => void;
  onClose: () => void;
}

export const SnoozeModal: React.FC<SnoozeModalProps> = ({ onSnooze, onClose }) => {
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('09:00');

  // Quick snooze options
  const getQuickOptions = () => {
    const now = new Date();
    const today = new Date(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return [
      {
        label: 'Later today',
        sublabel: '6:00 PM',
        icon: 'fa-sun',
        getDate: () => {
          const date = new Date(today);
          date.setHours(18, 0, 0, 0);
          return date > now ? date : null;
        }
      },
      {
        label: 'Tomorrow',
        sublabel: '8:00 AM',
        icon: 'fa-forward',
        getDate: () => {
          const date = new Date(tomorrow);
          date.setHours(8, 0, 0, 0);
          return date;
        }
      },
      {
        label: 'This weekend',
        sublabel: 'Saturday 9:00 AM',
        icon: 'fa-couch',
        getDate: () => {
          const date = new Date(now);
          const daysUntilSaturday = (6 - date.getDay() + 7) % 7 || 7;
          date.setDate(date.getDate() + daysUntilSaturday);
          date.setHours(9, 0, 0, 0);
          return date;
        }
      },
      {
        label: 'Next week',
        sublabel: 'Monday 8:00 AM',
        icon: 'fa-calendar-week',
        getDate: () => {
          const date = new Date(now);
          const daysUntilMonday = (1 - date.getDay() + 7) % 7 || 7;
          date.setDate(date.getDate() + daysUntilMonday);
          date.setHours(8, 0, 0, 0);
          return date;
        }
      }
    ];
  };

  const quickOptions = getQuickOptions();

  const handleQuickSnooze = (getDate: () => Date | null) => {
    const date = getDate();
    if (date) {
      onSnooze(date);
    }
  };

  const handleCustomSnooze = () => {
    if (!customDate) return;
    const [hours, minutes] = customTime.split(':').map(Number);
    const date = new Date(customDate);
    date.setHours(hours, minutes, 0, 0);
    if (date > new Date()) {
      onSnooze(date);
    }
  };

  // Get min date for custom picker (today)
  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-fadeIn">
      <div className="bg-[var(--pulse-surface)] border border-[color:var(--pulse-border)] rounded-xl shadow-2xl w-80 animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--pulse-border)]">
          <div className="flex items-center gap-2 text-[var(--pulse-ink)] font-medium">
            <Clock className="text-[var(--pulse-ink-2)]" />
            <span>Snooze until</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded hover:bg-[var(--pulse-surface-raised)] flex items-center justify-center text-[var(--pulse-ink-3)] hover:text-[var(--pulse-ink)] transition"
          >
            <X />
          </button>
        </div>

        {/* Quick options */}
        <div className="p-2">
          {quickOptions.map((option, idx) => {
            const date = option.getDate();
            if (!date) return null;

            return (
              <button
                key={idx}
                onClick={() => handleQuickSnooze(option.getDate)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--pulse-surface-raised)] transition text-left"
              >
                <i className={`fa-solid ${option.icon} w-5 text-[var(--pulse-ink-3)]`}></i>
                <div className="flex-1">
                  <div className="text-sm text-[var(--pulse-ink)]">{option.label}</div>
                  <div className="text-xs text-[var(--pulse-ink-3)]">{option.sublabel}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-[color:var(--pulse-border)] mx-4"></div>

        {/* Custom date/time */}
        <div className="p-4">
          <div className="text-xs text-[var(--pulse-ink-3)] mb-2 font-medium">Pick date & time</div>
          <div className="flex gap-2">
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              min={minDate}
              className="flex-1 bg-[var(--pulse-surface)] border border-[color:var(--pulse-border)] rounded-lg px-3 py-2 text-sm text-[var(--pulse-ink)] focus:outline-none focus:border-[color:var(--pulse-rose)]"
            />
            <input
              type="time"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              className="w-24 bg-[var(--pulse-surface)] border border-[color:var(--pulse-border)] rounded-lg px-3 py-2 text-sm text-[var(--pulse-ink)] focus:outline-none focus:border-[color:var(--pulse-rose)]"
            />
          </div>
          <button
            onClick={handleCustomSnooze}
            disabled={!customDate}
            className="w-full mt-3 bg-[var(--pulse-rose)] hover:bg-[var(--pulse-rose-deep)] disabled:opacity-50 text-white font-medium py-2 rounded-lg transition flex items-center justify-center gap-2"
          >
            <Clock />
            Snooze
          </button>
        </div>
      </div>
    </div>
  );
};

export default SnoozeModal;
