import React, { useState, useEffect, useMemo } from 'react';
import { Globe, Clock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { pulseService, UserProfile } from '../../../services/pulseService';
import { SettingsCard } from '../shared/SettingsCard';
import { MonoLabel } from '../shared/MonoLabel';

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

type TzOption = { value: string; city: string; note?: string };
type TzGroup = { region: string; zones: TzOption[] };

const CURATED_TIMEZONES: TzGroup[] = [
  {
    region: 'Americas',
    zones: [
      { value: 'America/Los_Angeles', city: 'Los Angeles', note: 'Pacific Time' },
      { value: 'America/Denver', city: 'Denver', note: 'Mountain Time' },
      { value: 'America/Phoenix', city: 'Phoenix', note: 'Mountain (no DST)' },
      { value: 'America/Chicago', city: 'Chicago', note: 'Central Time' },
      { value: 'America/New_York', city: 'New York', note: 'Eastern Time' },
      { value: 'America/Toronto', city: 'Toronto' },
      { value: 'America/Mexico_City', city: 'Mexico City' },
      { value: 'America/Bogota', city: 'Bogotá' },
      { value: 'America/Sao_Paulo', city: 'São Paulo' },
      { value: 'America/Argentina/Buenos_Aires', city: 'Buenos Aires' },
    ],
  },
  {
    region: 'Europe & Africa',
    zones: [
      { value: 'Europe/London', city: 'London' },
      { value: 'Europe/Dublin', city: 'Dublin' },
      { value: 'Europe/Lisbon', city: 'Lisbon' },
      { value: 'Europe/Paris', city: 'Paris' },
      { value: 'Europe/Berlin', city: 'Berlin' },
      { value: 'Europe/Madrid', city: 'Madrid' },
      { value: 'Europe/Rome', city: 'Rome' },
      { value: 'Europe/Amsterdam', city: 'Amsterdam' },
      { value: 'Europe/Athens', city: 'Athens' },
      { value: 'Europe/Istanbul', city: 'Istanbul' },
      { value: 'Europe/Moscow', city: 'Moscow' },
      { value: 'Africa/Lagos', city: 'Lagos' },
      { value: 'Africa/Cairo', city: 'Cairo' },
      { value: 'Africa/Johannesburg', city: 'Johannesburg' },
    ],
  },
  {
    region: 'Asia & Pacific',
    zones: [
      { value: 'Asia/Dubai', city: 'Dubai' },
      { value: 'Asia/Kolkata', city: 'Mumbai / Delhi' },
      { value: 'Asia/Bangkok', city: 'Bangkok' },
      { value: 'Asia/Singapore', city: 'Singapore' },
      { value: 'Asia/Hong_Kong', city: 'Hong Kong' },
      { value: 'Asia/Shanghai', city: 'Shanghai' },
      { value: 'Asia/Tokyo', city: 'Tokyo' },
      { value: 'Asia/Seoul', city: 'Seoul' },
      { value: 'Australia/Perth', city: 'Perth' },
      { value: 'Australia/Sydney', city: 'Sydney' },
      { value: 'Pacific/Auckland', city: 'Auckland' },
      { value: 'Pacific/Honolulu', city: 'Honolulu' },
    ],
  },
  {
    region: 'UTC',
    zones: [{ value: 'UTC', city: 'UTC' }],
  },
];

function getOffsetLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const raw = parts.find(p => p.type === 'timeZoneName')?.value ?? '';
    if (raw === 'GMT') return 'GMT±00:00';
    const m = raw.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (!m) return raw || 'GMT';
    const sign = m[1] === '-' ? '−' : '+';
    const hh = m[2].padStart(2, '0');
    const mm = m[3] ?? '00';
    return `GMT${sign}${hh}:${mm}`;
  } catch {
    return 'GMT';
  }
}

function formatTzLabel(tz: TzOption, offset: string): string {
  const suffix = tz.note ? ` — ${tz.note}` : '';
  return `(${offset}) ${tz.city}${suffix}`;
}

function cityFromIana(value: string): string {
  const last = value.split('/').pop() ?? value;
  return last.replace(/_/g, ' ');
}

function getAllIanaZones(): string[] {
  const intl: any = Intl as any;
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      const list = intl.supportedValuesOf('timeZone') as string[];
      if (Array.isArray(list) && list.length > 0) return list;
    } catch { /* fall through */ }
  }
  return [];
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
  const [showAllZones, setShowAllZones] = useState(false);

  useEffect(() => {
    if (!initialProfile) return;
    setLanguage(initialProfile.language ?? 'en');
    setTimezone(initialProfile.timezone ?? detectedTz);
  }, [initialProfile?.id, initialProfile?.language, initialProfile?.timezone, detectedTz]);

  const curatedSet = useMemo(() => {
    const s = new Set<string>();
    for (const g of CURATED_TIMEZONES) for (const z of g.zones) s.add(z.value);
    return s;
  }, []);

  const offsets = useMemo(() => {
    const map: Record<string, string> = {};
    for (const g of CURATED_TIMEZONES) for (const z of g.zones) map[z.value] = getOffsetLabel(z.value);
    if (!map[detectedTz]) map[detectedTz] = getOffsetLabel(detectedTz);
    if (!map[timezone]) map[timezone] = getOffsetLabel(timezone);
    return map;
  }, [detectedTz, timezone]);

  const allZones = useMemo(() => (showAllZones ? getAllIanaZones() : []), [showAllZones]);

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
    <SettingsCard className="space-y-4">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-zinc-500" />
        <MonoLabel>Language &amp; timezone</MonoLabel>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Affects date/time formatting and (where available) AI responses.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <MonoLabel as="label" htmlFor="locale-language" className="block mb-1.5">
            Language
          </MonoLabel>
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
          <MonoLabel as="label" htmlFor="locale-timezone" className="mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-400" /> Timezone
          </MonoLabel>
          <select
            id="locale-timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          >
            <optgroup label="Detected">
              <option value={detectedTz}>
                {`(${offsets[detectedTz] ?? getOffsetLabel(detectedTz)}) ${cityFromIana(detectedTz)} — your device`}
              </option>
            </optgroup>

            {timezone !== detectedTz && !curatedSet.has(timezone) && (
              <optgroup label="Current selection">
                <option value={timezone}>
                  {`(${offsets[timezone] ?? getOffsetLabel(timezone)}) ${cityFromIana(timezone)}`}
                </option>
              </optgroup>
            )}

            {CURATED_TIMEZONES.map(group => (
              <optgroup key={group.region} label={group.region}>
                {group.zones.map(tz => (
                  <option key={tz.value} value={tz.value}>
                    {formatTzLabel(tz, offsets[tz.value] ?? '')}
                  </option>
                ))}
              </optgroup>
            ))}

            {showAllZones && allZones.length > 0 && (
              <optgroup label="All timezones">
                {allZones
                  .filter(z => !curatedSet.has(z) && z !== detectedTz && z !== timezone)
                  .map(z => (
                    <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>
                  ))}
              </optgroup>
            )}
          </select>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {timezone !== detectedTz && (
              <button
                type="button"
                onClick={useDetectedTz}
                className="text-[11px] text-rose-500 hover:text-rose-600 font-medium"
              >
                Use detected timezone
              </button>
            )}
            {!showAllZones && (
              <button
                type="button"
                onClick={() => setShowAllZones(true)}
                className="text-[11px] text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium"
              >
                Browse all timezones…
              </button>
            )}
          </div>
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
    </SettingsCard>
  );
};
