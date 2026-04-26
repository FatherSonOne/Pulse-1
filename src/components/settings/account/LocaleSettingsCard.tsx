import React, { useState, useEffect, useMemo } from 'react';
import { Globe, Clock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { pulseService, UserProfile } from '../../../services/pulseService';

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'en',    label: 'English' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es',    label: 'Español' },
  { value: 'fr',    label: 'Français' },
  { value: 'de',    label: 'Deutsch' },
  { value: 'pt',    label: 'Português' },
  { value: 'it',    label: 'Italiano' },
  { value: 'nl',    label: 'Nederlands' },
  { value: 'ja',    label: '日本語' },
  { value: 'ko',    label: '한국어' },
  { value: 'zh',    label: '中文' },
];

// Use the platform's IANA list when available, fall back to a curated set.
function getTimezoneOptions(): string[] {
  const intl: any = Intl as any;
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      const list = intl.supportedValuesOf('timeZone') as string[];
      if (Array.isArray(list) && list.length > 0) return list;
    } catch { /* fall through */ }
  }
  return [
    'UTC',
    'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
    'America/Sao_Paulo',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Athens',
    'Africa/Johannesburg',
    'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai',
    'Australia/Sydney', 'Pacific/Auckland',
  ];
}

interface Props {
  initialProfile: UserProfile | null;
  onProfileUpdated?: (profile: UserProfile) => void;
}

export const LocaleSettingsCard: React.FC<Props> = ({ initialProfile, onProfileUpdated }) => {
  const detectedTz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch { return 'UTC'; }
  }, []);

  const [language, setLanguage] = useState<string>(initialProfile?.language ?? 'en');
  const [timezone, setTimezone] = useState<string>(initialProfile?.timezone ?? detectedTz);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!initialProfile) return;
    setLanguage(initialProfile.language ?? 'en');
    setTimezone(initialProfile.timezone ?? detectedTz);
  }, [initialProfile?.id, initialProfile?.language, initialProfile?.timezone, detectedTz]);

  const tzOptions = useMemo(() => getTimezoneOptions(), []);

  const dirty =
    !!initialProfile &&
    (language !== (initialProfile.language ?? 'en') || timezone !== (initialProfile.timezone ?? detectedTz));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await pulseService.updateProfile({ language, timezone });
      onProfileUpdated?.(updated);
      toast.success('Language and timezone updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update preferences';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const useDetectedTz = () => setTimezone(detectedTz);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-zinc-500" />
        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Language &amp; timezone</h4>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Affects date/time formatting and (where available) AI responses.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="locale-language" className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
            Language
          </label>
          <select
            id="locale-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          >
            {LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
            {!LANGUAGES.find(l => l.value === language) && (
              <option value={language}>{language}</option>
            )}
          </select>
        </div>

        <div>
          <label htmlFor="locale-timezone" className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-400" /> Timezone
          </label>
          <select
            id="locale-timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          >
            {tzOptions.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
            {!tzOptions.includes(timezone) && (
              <option value={timezone}>{timezone}</option>
            )}
          </select>
          {timezone !== detectedTz && (
            <button
              type="button"
              onClick={useDetectedTz}
              className="mt-1 text-[11px] text-rose-500 hover:text-rose-600 font-medium"
            >
              Use detected timezone ({detectedTz})
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !dirty}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};
