import React, { useState, useEffect } from 'react';
import { settingsService } from '../../services/settingsService';
import { supabase } from '../../services/supabase';
import { ShieldHalf, Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const ToggleItem = ({ label, desc, active, onToggle }: { label: string; desc: string; active: boolean; onToggle: () => void }) => (
  <div className="flex justify-between items-center group cursor-pointer" onClick={onToggle}>
    <div>
      <div className="dark:text-white text-zinc-900 font-medium text-sm">{label}</div>
      <div className="text-zinc-500 text-xs">{desc}</div>
    </div>
    <button
      className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${active ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${active ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  </div>
);

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
          Control your data collection settings and manage your personal information.
        </p>
      </div>

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
          <label className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Nudge Reminder Frequency</label>
          <select
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

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">Data Management</h4>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium dark:text-white text-zinc-900">Rebuild Analytics Cache</p>
              <p className="text-xs text-zinc-500">Clear cached data and force a fresh reload</p>
            </div>
            <button
              onClick={() => {
                const toastId = toast.loading('Rebuilding cache...');
                try {
                  // Clear all pulse- prefixed localStorage keys except API keys and settings
                  const keysToRemove = Object.keys(localStorage).filter(k =>
                    k.startsWith('pulse-') && k !== 'pulse_settings' && k !== 'pulse-api-keys'
                  );
                  keysToRemove.forEach(k => localStorage.removeItem(k));
                  toast.success(`Cache cleared (${keysToRemove.length} entries)`, { id: toastId });
                } catch {
                  toast.error('Failed to clear cache', { id: toastId });
                }
              }}
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              <RefreshCw className="mr-2" /> Rebuild
            </button>
          </div>

          <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium dark:text-white text-zinc-900">Export My Data</p>
              <p className="text-xs text-zinc-500">Download a JSON copy of your settings and profile</p>
            </div>
            <button
              onClick={async () => {
                const toastId = toast.loading('Preparing export...');
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) throw new Error('Not authenticated');
                  const { data: profile } = await supabase.from('pulse_profiles').select('*').eq('id', user.id).single();
                  const allSettings = await settingsService.getAll?.() || {};
                  const exportData = { exportedAt: new Date().toISOString(), email: user.email, profile: profile || {}, settings: allSettings };
                  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `pulse-export-${new Date().toISOString().split('T')[0]}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success('Data exported!', { id: toastId });
                } catch {
                  toast.error('Export failed', { id: toastId });
                }
              }}
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              <Download className="mr-2" /> Export JSON
            </button>
          </div>
        </div>
      </div>

      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-red-600 dark:text-red-400 mb-1">Delete My Account</h4>
          <p className="text-xs text-red-500/80">Permanently remove your account and all associated data. Open Privacy Dashboard to complete this action with confirmation.</p>
        </div>
        <button
          onClick={() => {
            // Navigate to Privacy Dashboard where the full confirmation flow lives
            toast('Open Privacy Dashboard → Privacy tab to delete your account.', { icon: 'ℹ️' });
          }}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm transition"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
};
