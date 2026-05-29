// ScheduleSendModal.tsx — Schedule email to send later.
// Redesigned 2026-05-29 to Cockpit tokens (was missed in the Focal
// Canvas + Sidecar composer pass): zinc/blue hard-coded chrome →
// pulse-* tokens, FontAwesome quick-option icons → Lucide, primary
// Schedule button → rose accent matching the composer's Send.
import React, { useState } from 'react';
import { Briefcase, Clock, Send, Sun, Sunrise, X } from 'lucide-react';

interface ScheduleSendModalProps {
  onSchedule: (scheduledFor: Date) => void;
  onClose: () => void;
}

interface QuickOption {
  label: string;
  sublabel: string;
  Icon: React.ComponentType<{ className?: string }>;
  getDate: () => Date;
}

export const ScheduleSendModal: React.FC<ScheduleSendModalProps> = ({ onSchedule, onClose }) => {
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('09:00');

  const getQuickOptions = (): QuickOption[] => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return [
      {
        label: 'Tomorrow morning',
        sublabel: '8:00 AM',
        Icon: Sunrise,
        getDate: () => {
          const date = new Date(tomorrow);
          date.setHours(8, 0, 0, 0);
          return date;
        }
      },
      {
        label: 'Tomorrow afternoon',
        sublabel: '1:00 PM',
        Icon: Sun,
        getDate: () => {
          const date = new Date(tomorrow);
          date.setHours(13, 0, 0, 0);
          return date;
        }
      },
      {
        label: 'Monday morning',
        sublabel: '8:00 AM',
        Icon: Briefcase,
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

  const handleQuickSchedule = (getDate: () => Date) => {
    onSchedule(getDate());
  };

  const handleCustomSchedule = () => {
    if (!customDate) return;
    const [hours, minutes] = customTime.split(':').map(Number);
    const date = new Date(customDate);
    date.setHours(hours, minutes, 0, 0);
    if (date > new Date()) {
      onSchedule(date);
    }
  };

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div
      className="absolute bottom-full right-0 mb-2 rounded-xl w-72 z-50 animate-slideInUp border pulse-border-color overflow-hidden"
      style={{
        background: 'var(--pulse-canvas)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.18), 0 0 0 1px var(--pulse-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b pulse-border-color"
        style={{ background: 'var(--pulse-canvas-soft)' }}
      >
        <div className="flex items-center gap-2 pulse-ink-color font-medium text-sm">
          <Send className="w-3.5 h-3.5 pulse-rose-color" />
          <span>Schedule send</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center pulse-ink-3-color hover:pulse-ink-color hover:pulse-surface-raised transition"
          aria-label="Close schedule menu"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick options */}
      <div className="p-2">
        {quickOptions.map((option, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleQuickSchedule(option.getDate)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:pulse-surface-raised transition text-left"
          >
            <option.Icon className="w-4 h-4 pulse-ink-2-color shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm pulse-ink-color">{option.label}</div>
              <div className="text-xs pulse-ink-3-color font-mono-pulse tracking-wide-mono">
                {option.sublabel}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t pulse-border-color mx-3" />

      {/* Custom date/time */}
      <div className="p-3">
        <div className="text-[10px] pulse-ink-3-color mb-2 font-mono-pulse tracking-wide-mono uppercase">
          Custom time
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            min={minDate}
            className="flex-1 rounded-lg px-2 py-1.5 text-xs pulse-ink-color border pulse-border-color focus:outline-none focus:pulse-rose-border"
            style={{ background: 'var(--pulse-surface-raised)' }}
          />
          <input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            className="w-20 rounded-lg px-2 py-1.5 text-xs pulse-ink-color border pulse-border-color focus:outline-none focus:pulse-rose-border"
            style={{ background: 'var(--pulse-surface-raised)' }}
          />
        </div>
        <button
          type="button"
          onClick={handleCustomSchedule}
          disabled={!customDate}
          className="w-full mt-2 font-medium py-1.5 rounded-lg transition text-sm flex items-center justify-center gap-2 text-white disabled:cursor-not-allowed"
          style={{
            background: customDate ? 'var(--pulse-rose)' : 'var(--pulse-surface-raised)',
            color: customDate ? '#fff' : 'var(--pulse-ink-3)',
          }}
        >
          <Clock className="w-3.5 h-3.5" />
          Schedule
        </button>
      </div>
    </div>
  );
};

export default ScheduleSendModal;
