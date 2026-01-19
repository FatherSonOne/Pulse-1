// ScheduleSendModal.tsx - Schedule email to send later
import React, { useState } from 'react';

interface ScheduleSendModalProps {
  onSchedule: (scheduledFor: Date) => void;
  onClose: () => void;
}

export const ScheduleSendModal: React.FC<ScheduleSendModalProps> = ({ onSchedule, onClose }) => {
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('09:00');

  // Quick schedule options
  const getQuickOptions = () => {
    const now = new Date();
    const today = new Date(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return [
      {
        label: 'Tomorrow morning',
        sublabel: '8:00 AM',
        icon: 'fa-sun',
        getDate: () => {
          const date = new Date(tomorrow);
          date.setHours(8, 0, 0, 0);
          return date;
        }
      },
      {
        label: 'Tomorrow afternoon',
        sublabel: '1:00 PM',
        icon: 'fa-cloud-sun',
        getDate: () => {
          const date = new Date(tomorrow);
          date.setHours(13, 0, 0, 0);
          return date;
        }
      },
      {
        label: 'Monday morning',
        sublabel: '8:00 AM',
        icon: 'fa-briefcase',
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
    const date = getDate();
    onSchedule(date);
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

  // Get min date for custom picker (today)
  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="absolute bottom-full right-0 mb-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-72 z-50 animate-slideInUp">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-white font-medium text-sm">
          <i className="fa-solid fa-paper-plane text-blue-500"></i>
          <span>Schedule send</span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
        >
          <i className="fa-solid fa-xmark text-xs"></i>
        </button>
      </div>

      {/* Quick options */}
      <div className="p-2">
        {quickOptions.map((option, idx) => (
          <button
            key={idx}
            onClick={() => handleQuickSchedule(option.getDate)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition text-left"
          >
            <i className={`fa-solid ${option.icon} w-4 text-blue-500 text-sm`}></i>
            <div className="flex-1">
              <div className="text-sm text-white">{option.label}</div>
              <div className="text-xs text-zinc-500">{option.sublabel}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-800 mx-3"></div>

      {/* Custom date/time */}
      <div className="p-3">
        <div className="text-xs text-zinc-500 mb-2 font-medium">Custom time</div>
        <div className="flex gap-2">
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            min={minDate}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
          <input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={handleCustomSchedule}
          disabled={!customDate}
          className="w-full mt-2 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium py-1.5 rounded-lg transition text-sm flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-clock"></i>
          Schedule
        </button>
      </div>
    </div>
  );
};

export default ScheduleSendModal;
