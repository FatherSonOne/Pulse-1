import React, { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { supabase } from '../../services/supabase';
import { ToggleItem } from './shared/ToggleItem';
import { SettingsCard } from './shared/SettingsCard';
import { MonoLabel } from './shared/MonoLabel';

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

      <SettingsCard className="space-y-6">
        <ToggleItem
          label="Live Presence"
          desc="Let others see when you are online"
          active={activityPresenceVisible}
          onToggle={async () => {
            const v = !activityPresenceVisible;
            setActivityPresenceVisible(v);
            settingsService.set('activityMonitorPresenceVisible', v);
            // Update user_profiles so other users see the change
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase.from('user_profiles').update({
                  online_status: v ? 'online' : 'offline',
                }).eq('id', user.id);
              }
            } catch (err) {
              console.error('Error updating presence visibility:', err);
            }
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
          <MonoLabel as="label" className="mb-3 block">Activity Data Retention</MonoLabel>
          <select
            value={activityRetentionDays}
            onChange={(e) => {
              const v = Number(e.target.value);
              setActivityRetentionDays(v);
              settingsService.set('activityMonitorRetentionDays', v);
            }}
            title="Activity data retention period"
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={-1}>Keep forever</option>
          </select>
        </div>
      </SettingsCard>
    </div>
  );
};
