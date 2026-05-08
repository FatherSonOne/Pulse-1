import React, { useState, useEffect } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsService } from '../../../services/settingsService';
import { SettingsCard } from '../shared/SettingsCard';
import { MonoLabel } from '../shared/MonoLabel';

type Schedule = 'off' | 'daily' | 'weekly';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DigestScheduleCard: React.FC = () => {
  const [isLoading, setIsLoading]   = useState(true);
  const [schedule, setSchedule]     = useState<Schedule>('off');
  const [time, setTime]             = useState('09:00');
  const [dayOfWeek, setDayOfWeek]   = useState(1);
  const [isSaving, setIsSaving]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, t, d] = await Promise.all([
        settingsService.get('digestSchedule'),
        settingsService.get('digestTime'),
        settingsService.get('digestDayOfWeek'),
      ]);
      if (cancelled) return;
      if (typeof s === 'string') setSchedule(s as Schedule);
      if (typeof t === 'string') setTime(t);
      if (typeof d === 'number') setDayOfWeek(d);
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    if (schedule !== 'off' && !TIME_REGEX.test(time)) {
      toast.error('Time must be in HH:mm format');
      return;
    }
    setIsSaving(true);
    try {
      await Promise.all([
        settingsService.set('digestSchedule', schedule),
        settingsService.set('digestTime', time),
        settingsService.set('digestDayOfWeek', dayOfWeek),
      ]);
      toast.success('Digest schedule saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save digest schedule';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const showTime = schedule !== 'off';
  const showDay  = schedule === 'weekly';

  return (
    <SettingsCard className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-zinc-500" />
        <MonoLabel>Digest schedule</MonoLabel>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Receive a periodic summary email of unread messages, mentions, and other activity.
      </p>

      <div>
        <p className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
          Frequency
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(['off', 'daily', 'weekly'] as Schedule[]).map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setSchedule(opt)}
              disabled={isLoading}
              aria-pressed={schedule === opt}
              className={`px-3 py-2 text-sm font-semibold rounded-lg border transition ${
                schedule === opt
                  ? 'bg-rose-500 text-white border-rose-500'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
              }`}
            >
              {opt === 'off' ? 'Off' : opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {showTime && (
        <div className={`grid grid-cols-1 ${showDay ? 'sm:grid-cols-2' : ''} gap-3`}>
          <div>
            <label htmlFor="digest-time" className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
              Send at
            </label>
            <input
              id="digest-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            />
            <p className="text-[10px] text-zinc-400 mt-1">In your account timezone.</p>
          </div>
          {showDay && (
            <div>
              <label htmlFor="digest-day" className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
                Day of week
              </label>
              <select
                id="digest-day"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              >
                {DAY_LABELS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40"
        >
          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Digest'}
        </button>
      </div>
    </SettingsCard>
  );
};
