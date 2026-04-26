import React, { useState, useEffect } from 'react';
import { Moon, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsService } from '../../../services/settingsService';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const QuietHoursCard: React.FC = () => {
  const [isLoading, setIsLoading]     = useState(true);
  const [enabled, setEnabled]         = useState(false);
  const [start, setStart]             = useState('22:00');
  const [end, setEnd]                 = useState('07:00');
  const [days, setDays]               = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [isSaving, setIsSaving]       = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [e, s, en, d] = await Promise.all([
        settingsService.get('quietHoursEnabled'),
        settingsService.get('quietHoursStart'),
        settingsService.get('quietHoursEnd'),
        settingsService.get('quietHoursDays'),
      ]);
      if (cancelled) return;
      if (typeof e === 'boolean') setEnabled(e);
      if (typeof s === 'string')  setStart(s);
      if (typeof en === 'string') setEnd(en);
      if (Array.isArray(d))       setDays(d as number[]);
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleDay = (d: number) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };

  const handleSave = async () => {
    if (!TIME_REGEX.test(start) || !TIME_REGEX.test(end)) {
      toast.error('Times must be in HH:mm format');
      return;
    }
    if (enabled && days.length === 0) {
      toast.error('Pick at least one day');
      return;
    }
    setIsSaving(true);
    try {
      await Promise.all([
        settingsService.set('quietHoursEnabled', enabled),
        settingsService.set('quietHoursStart', start),
        settingsService.set('quietHoursEnd', end),
        settingsService.set('quietHoursDays', days),
      ]);
      toast.success('Quiet hours saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save quiet hours';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // "22:00 → 07:00" wraps midnight, label that explicitly so users know.
  const wrapsMidnight = enabled && start && end && start > end;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Moon className="w-4 h-4 text-zinc-500" />
        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Quiet hours</h4>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Suppress non-urgent push notifications during this window. Security alerts and direct mentions still come through.
      </p>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={isLoading}
          className="w-4 h-4 text-rose-500 border-zinc-300 rounded focus:ring-rose-500"
        />
        <span className="text-sm text-zinc-700 dark:text-zinc-300">Enable quiet hours</span>
      </label>

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <div>
          <label htmlFor="quiet-start" className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
            Start
          </label>
          <input
            id="quiet-start"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
        </div>
        <div>
          <label htmlFor="quiet-end" className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
            End
          </label>
          <input
            id="quiet-end"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
        </div>
      </div>

      {wrapsMidnight && (
        <p className="text-[11px] text-zinc-400">
          This window crosses midnight — quiet from {start} until {end} the next day.
        </p>
      )}

      <div className={enabled ? '' : 'opacity-50 pointer-events-none'}>
        <p className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
          Active days
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {DAY_LABELS.map((label, i) => {
            const active = days.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                aria-pressed={active}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                  active
                    ? 'bg-rose-500 text-white border-rose-500'
                    : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40"
        >
          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Quiet Hours'}
        </button>
      </div>
    </div>
  );
};
