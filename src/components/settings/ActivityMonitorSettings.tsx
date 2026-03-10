import React, { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { settingsService } from '../../services/settingsService';

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

export const ActivityMonitorSettings: React.FC = () => {
  const [activityPresenceVisible, setActivityPresenceVisible] = useState(true);
  const [activityLeaderboard, setActivityLeaderboard] = useState(true);
  const [activityRetentionDays, setActivityRetentionDays] = useState(90);

  useEffect(() => {
    const load = async () => {
      const [presence, leaderboard, retention] = await Promise.all([
        settingsService.get('activityMonitorPresenceVisible'),
        settingsService.get('activityMonitorLeaderboard'),
        settingsService.get('activityMonitorRetentionDays'),
      ]);
      if (presence !== undefined) setActivityPresenceVisible(presence);
      if (leaderboard !== undefined) setActivityLeaderboard(leaderboard);
      if (retention !== undefined) setActivityRetentionDays(retention);
    };
    load();
  }, []);

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3><TrendingUp /> Activity Monitor</h3>
        <p>Control how your presence and activity data is shared and retained.</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-6">
        <ToggleItem
          label="Live Presence"
          desc="Let others see when you are online"
          active={activityPresenceVisible}
          onToggle={() => {
            const v = !activityPresenceVisible;
            setActivityPresenceVisible(v);
            settingsService.set('activityMonitorPresenceVisible', v);
          }}
        />
        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>
        <ToggleItem
          label="Leaderboard Participation"
          desc="Include your activity in the community leaderboard"
          active={activityLeaderboard}
          onToggle={() => {
            const v = !activityLeaderboard;
            setActivityLeaderboard(v);
            settingsService.set('activityMonitorLeaderboard', v);
          }}
        />
        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>
        <div>
          <label className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Activity Data Retention</label>
          <select
            value={activityRetentionDays}
            onChange={(e) => {
              const v = Number(e.target.value);
              setActivityRetentionDays(v);
              settingsService.set('activityMonitorRetentionDays', v);
            }}
            title="Activity data retention period"
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={-1}>Keep forever</option>
          </select>
        </div>
      </div>
    </div>
  );
};
