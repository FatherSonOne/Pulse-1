import React from 'react';
import { RefreshCw } from 'lucide-react';

interface SyncPreferencesProps {
  slackChannels: Array<{ id: string; name: string }>;
}

export const SyncPreferences: React.FC<SyncPreferencesProps> = ({ slackChannels }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
            <RefreshCw /> Sync Preferences
        </h4>
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium dark:text-white text-zinc-900">Sync Frequency</p>
                    <p className="text-xs text-zinc-500">How often Pulse checks for new data in background</p>
                </div>
                <select
                    aria-label="Sync Frequency"
                    defaultValue={localStorage.getItem('pulse_sync_frequency') || 'realtime'}
                    onChange={(e) => localStorage.setItem('pulse_sync_frequency', e.target.value)}
                    className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm dark:text-white text-zinc-900 focus:outline-none"
                >
                    <option value="realtime">Real-time (Instant)</option>
                    <option value="15min">Every 15 minutes</option>
                    <option value="hourly">Every hour</option>
                    <option value="manual">Manual only</option>
                </select>
            </div>
            <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium dark:text-white text-zinc-900">Slack Channels</p>
                    <p className="text-xs text-zinc-500">Select which channels to import</p>
                </div>
                <button
                    onClick={() => {
                      // Show channel list if available, otherwise prompt to connect Slack first
                      if (slackChannels.length > 0) {
                        alert(`Connected channels:\n${slackChannels.map(c => `#${c.name}`).join('\n')}`);
                      } else {
                        alert('Connect Slack first to manage channels.');
                      }
                    }}
                    className="text-sm text-blue-500 hover:underline"
                >Manage ({slackChannels.length || 'All'})</button>
            </div>
        </div>
    </div>
  );
};
