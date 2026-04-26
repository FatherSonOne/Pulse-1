import React, { useState, useEffect } from 'react';
import { settingsService } from '../../services/settingsService';
import { ShieldHalf, RefreshCw, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { ToggleItem } from './shared/ToggleItem';
import { DataRetentionCard } from './privacy/DataRetentionCard';
import { DataExportRequestCard } from './privacy/DataExportRequestCard';
import { DataErasureCard } from './privacy/DataErasureCard';

export const PrivacyDataSettings: React.FC = () => {
  const [analyticsTracking, setAnalyticsTracking] = useState(true);
  const [nudgeFrequencyHours, setNudgeFrequencyHours] = useState(24);

  useEffect(() => {
    const load = async () => {
      const [analytics, nudgeHz] = await Promise.all([
        settingsService.get('analyticsTracking'),
        settingsService.get('nudgeFrequencyHours'),
      ]);
      if (analytics !== undefined) setAnalyticsTracking(analytics);
      if (nudgeHz !== undefined) setNudgeFrequencyHours(nudgeHz);
    };
    load();
  }, []);

  const handleAnalyticsTrackingChange = (val: boolean) => {
    setAnalyticsTracking(val);
    settingsService.set('analyticsTracking', val);
  };

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3>
          <ShieldHalf /> Privacy & Data
        </h3>
        <p>
          Control your data collection settings, retention windows, and personal-data rights.
        </p>
      </div>

      {/* Data Collection */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Data Collection</h4>
        <ToggleItem
          label="Analytics Tracking"
          desc="Allow Pulse to collect anonymous usage data to improve the app"
          active={analyticsTracking}
          onToggle={() => handleAnalyticsTrackingChange(!analyticsTracking)}
        />
        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>
        <div>
          <label
            htmlFor="nudge-frequency"
            className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 block"
          >
            Nudge Reminder Frequency
          </label>
          <select
            id="nudge-frequency"
            value={nudgeFrequencyHours}
            onChange={(e) => {
              const v = Number(e.target.value);
              setNudgeFrequencyHours(v);
              settingsService.set('nudgeFrequencyHours', v);
            }}
            title="How often dismissed nudges reappear"
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={24}>Every 24 hours</option>
            <option value={72}>Every 3 days</option>
            <option value={168}>Every 7 days</option>
            <option value={-1}>Never remind</option>
          </select>
          <p className="text-xs text-zinc-400 mt-1.5">Controls how long dismissed feature hints stay hidden.</p>
        </div>
      </div>

      {/* Data Retention — per-type windows */}
      <DataRetentionCard />

      {/* Export — GDPR Article 20 */}
      <DataExportRequestCard />

      {/* Misc data management */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Data Management</h4>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium dark:text-white text-zinc-900">Rebuild Analytics Cache</p>
              <p className="text-xs text-zinc-500">Clear cached data and force a fresh reload</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const toastId = toast.loading('Rebuilding cache...');
                try {
                  const keysToRemove = Object.keys(localStorage).filter(k =>
                    k.startsWith('pulse-') && k !== 'pulse_settings' && k !== 'pulse-api-keys'
                  );
                  keysToRemove.forEach(k => localStorage.removeItem(k));
                  toast.success(`Cache cleared (${keysToRemove.length} entries)`, { id: toastId });
                } catch {
                  toast.error('Failed to clear cache', { id: toastId });
                }
              }}
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Rebuild
            </button>
          </div>

          <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium dark:text-white text-zinc-900">Restore Default Settings</p>
              <p className="text-xs text-zinc-500">Reset all settings to their original defaults</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!confirm('Reset all settings to defaults? This cannot be undone.')) return;
                const toastId = toast.loading('Restoring defaults...');
                try {
                  await settingsService.reset();
                  toast.success('Settings restored to defaults. Reloading...', { id: toastId });
                  setTimeout(() => window.location.reload(), 1500);
                } catch {
                  toast.error('Failed to reset settings', { id: toastId });
                }
              }}
              className="px-4 py-2 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 rounded-lg text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 transition flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Reset Defaults
            </button>
          </div>
        </div>
      </div>

      {/* Erasure — GDPR Article 17 */}
      <DataErasureCard />
    </div>
  );
};
