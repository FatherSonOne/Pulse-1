import React, { useState, useEffect } from 'react';
import { SettingsCard } from '../shared/SettingsCard';
import { MonoLabel } from '../shared/MonoLabel';
import {
  Archive,
  MessageSquare,
  Mic,
  Mail,
  CalendarDays,
  Users,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsService, PulseSettings } from '../../../services/settingsService';

type RetentionKey = Extract<
  keyof PulseSettings,
  | 'messagesRetentionDays'
  | 'voxesRetentionDays'
  | 'emailsRetentionDays'
  | 'calendarRetentionDays'
  | 'contactsRetentionDays'
>;

interface RetentionField {
  key:         RetentionKey;
  label:       string;
  description: string;
  icon:        React.ComponentType<{ className?: string }>;
}

const FIELDS: RetentionField[] = [
  { key: 'messagesRetentionDays', label: 'Messages',  description: 'Direct messages, channel posts, threads',                    icon: MessageSquare },
  { key: 'voxesRetentionDays',    label: 'Voxes',     description: 'Voice messages and recordings across all Vox modes',         icon: Mic },
  { key: 'emailsRetentionDays',   label: 'Emails',    description: 'Cached emails from connected mailboxes',                     icon: Mail },
  { key: 'calendarRetentionDays', label: 'Calendar',  description: 'Past calendar events synced from connected calendars',       icon: CalendarDays },
  { key: 'contactsRetentionDays', label: 'Contacts',  description: 'Cached contact records from address books and integrations', icon: Users },
];

const OPTIONS: { value: number; label: string }[] = [
  { value: 30,   label: '30 days' },
  { value: 90,   label: '90 days' },
  { value: 365,  label: '1 year' },
  { value: -1,   label: 'Forever' },
];

export const DataRetentionCard: React.FC = () => {
  const [enabled, setEnabled]     = useState(false);
  const [values, setValues]       = useState<Record<RetentionKey, number>>({
    messagesRetentionDays: 180,
    voxesRetentionDays:    90,
    emailsRetentionDays:   90,
    calendarRetentionDays: 365,
    contactsRetentionDays: -1,
  });
  const [saved, setSaved]         = useState<{ enabled: boolean; values: Record<RetentionKey, number> } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const e = await settingsService.get('dataRetentionEnabled');
      const fetched: Record<string, number> = {};
      for (const f of FIELDS) {
        fetched[f.key] = (await settingsService.get(f.key)) as number;
      }
      if (cancelled) return;
      const next = {
        messagesRetentionDays: fetched.messagesRetentionDays ?? 180,
        voxesRetentionDays:    fetched.voxesRetentionDays    ?? 90,
        emailsRetentionDays:   fetched.emailsRetentionDays   ?? 90,
        calendarRetentionDays: fetched.calendarRetentionDays ?? 365,
        contactsRetentionDays: fetched.contactsRetentionDays ?? -1,
      };
      setEnabled(typeof e === 'boolean' ? e : false);
      setValues(next);
      setSaved({ enabled: typeof e === 'boolean' ? e : false, values: next });
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleChange = (key: RetentionKey, value: number) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const dirty = saved && (
    saved.enabled !== enabled ||
    FIELDS.some(f => saved.values[f.key] !== values[f.key])
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await settingsService.set('dataRetentionEnabled', enabled);
      for (const f of FIELDS) {
        await settingsService.set(f.key, values[f.key]);
      }
      setSaved({ enabled, values: { ...values } });
      toast.success('Retention policy saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save retention policy';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsCard className="space-y-4">
      <div className="flex items-center gap-2">
        <Archive className="w-4 h-4 text-zinc-500" />
        <MonoLabel>Data retention</MonoLabel>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Automatically remove your data older than the retention window. Disabled = data is kept until you delete it manually.
      </p>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={isLoading}
          className="w-4 h-4 text-rose-500 border-zinc-300 rounded focus:ring-rose-500"
        />
        <span className="text-sm text-zinc-700 dark:text-zinc-300">Enable automatic retention</span>
      </label>

      {enabled && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Items older than the configured window are permanently removed. Restore is not possible after deletion.
          </p>
        </div>
      )}

      <div className={`space-y-3 ${enabled ? '' : 'opacity-60 pointer-events-none'}`}>
        {FIELDS.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.key} className="flex items-start gap-3">
              <Icon className="w-4 h-4 text-zinc-400 mt-2 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">{f.label}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{f.description}</p>
              </div>
              <div className="flex-shrink-0">
                <label htmlFor={`retention-${f.key}`} className="sr-only">{f.label} retention window</label>
                <select
                  id={`retention-${f.key}`}
                  value={values[f.key]}
                  onChange={(e) => handleChange(f.key, Number(e.target.value))}
                  disabled={!enabled || isLoading}
                  className="px-3 py-1.5 text-xs border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                >
                  {OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isLoading || !dirty}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Retention Policy'}
        </button>
      </div>
    </SettingsCard>
  );
};
