// Notification Preferences Panel
import React, { useState } from 'react';

interface NotificationChannel {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  description: string;
}

interface NotificationRule {
  id: string;
  name: string;
  description: string;
  category: 'messages' | 'mentions' | 'threads' | 'reminders' | 'system';
  channels: {
    push: boolean;
    email: boolean;
    inApp: boolean;
    sound: boolean;
  };
  conditions?: {
    priority?: 'all' | 'high' | 'none';
    contacts?: 'all' | 'favorites' | 'none';
    timeWindow?: { start: string; end: string };
  };
}

interface QuietHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  allowUrgent: boolean;
  days: string[];
}

interface NotificationPreferencesProps {
  channels: NotificationChannel[];
  rules: NotificationRule[];
  quietHours: QuietHours;
  onUpdateChannel?: (id: string, enabled: boolean) => void;
  onUpdateRule?: (id: string, updates: Partial<NotificationRule>) => void;
  onUpdateQuietHours?: (updates: Partial<QuietHours>) => void;
  onTestNotification?: (channel: string) => void;
  compact?: boolean;
}

const defaultChannels: NotificationChannel[] = [
  { id: 'push', name: 'Push Notifications', icon: 'fa-bell', enabled: true, description: 'Desktop and mobile push alerts' },
  { id: 'email', name: 'Email Digest', icon: 'fa-envelope', enabled: false, description: 'Daily summary of activity' },
  { id: 'inApp', name: 'In-App Alerts', icon: 'fa-comment', enabled: true, description: 'Notifications within the app' },
  { id: 'sound', name: 'Sound Effects', icon: 'fa-volume-high', enabled: true, description: 'Audio alerts for messages' }
];

const defaultRules: NotificationRule[] = [
  {
    id: 'new-message',
    name: 'New Messages',
    description: 'When you receive a new message',
    category: 'messages',
    channels: { push: true, email: false, inApp: true, sound: true },
    conditions: { contacts: 'all' }
  },
  {
    id: 'mentions',
    name: 'Mentions',
    description: 'When someone mentions you',
    category: 'mentions',
    channels: { push: true, email: true, inApp: true, sound: true },
    conditions: { priority: 'all' }
  },
  {
    id: 'thread-reply',
    name: 'Thread Replies',
    description: 'Replies to threads you participate in',
    category: 'threads',
    channels: { push: true, email: false, inApp: true, sound: false }
  },
  {
    id: 'reminders',
    name: 'Reminders',
    description: 'Scheduled reminders and follow-ups',
    category: 'reminders',
    channels: { push: true, email: true, inApp: true, sound: true }
  },
  {
    id: 'system',
    name: 'System Updates',
    description: 'App updates and important announcements',
    category: 'system',
    channels: { push: false, email: true, inApp: true, sound: false }
  }
];

const categoryConfig = {
  messages: { icon: 'fa-message', color: 'blue', label: 'Messages' },
  mentions: { icon: 'fa-at', color: 'purple', label: 'Mentions' },
  threads: { icon: 'fa-comments', color: 'green', label: 'Threads' },
  reminders: { icon: 'fa-bell', color: 'amber', label: 'Reminders' },
  system: { icon: 'fa-gear', color: 'zinc', label: 'System' }
};

const daysOfWeek = [
  { id: 'mon', label: 'M' },
  { id: 'tue', label: 'T' },
  { id: 'wed', label: 'W' },
  { id: 'thu', label: 'T' },
  { id: 'fri', label: 'F' },
  { id: 'sat', label: 'S' },
  { id: 'sun', label: 'S' }
];

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  channels = defaultChannels,
  rules = defaultRules,
  quietHours,
  onUpdateChannel,
  onUpdateRule,
  onUpdateQuietHours,
  onTestNotification,
  compact = false
}) => {
  const [activeTab, setActiveTab] = useState<'channels' | 'rules' | 'schedule'>('channels');
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  // Group rules by category
  const groupedRules = rules.reduce((acc, rule) => {
    if (!acc[rule.category]) acc[rule.category] = [];
    acc[rule.category].push(rule);
    return acc;
  }, {} as Record<string, NotificationRule[]>);

  const enabledCount = channels.filter(c => c.enabled).length;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${
          quietHours?.enabled
            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
            : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
        }`}>
          <i className={`fa-solid ${quietHours?.enabled ? 'fa-moon' : 'fa-bell'} text-xs`} />
          <span className="text-xs font-medium">
            {quietHours?.enabled ? 'Quiet' : `${enabledCount} active`}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
              <i className="fa-solid fa-bell text-violet-500 text-sm" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Notifications</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {enabledCount} channels active
                {quietHours?.enabled && ' • Quiet hours on'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg p-1">
          {[
            { id: 'channels', label: 'Channels', icon: 'fa-tower-broadcast' },
            { id: 'rules', label: 'Rules', icon: 'fa-sliders' },
            { id: 'schedule', label: 'Schedule', icon: 'fa-clock' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-zinc-600 text-zinc-800 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white'
              }`}
            >
              <i className={`fa-solid ${tab.icon}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto">
        {activeTab === 'channels' && (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {channels.map(channel => (
              <div
                key={channel.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    channel.enabled
                      ? 'bg-violet-100 dark:bg-violet-900/40'
                      : 'bg-zinc-100 dark:bg-zinc-700'
                  }`}>
                    <i className={`fa-solid ${channel.icon} ${
                      channel.enabled ? 'text-violet-500' : 'text-zinc-400'
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-800 dark:text-white">
                      {channel.name}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {channel.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onTestNotification && channel.enabled && (
                    <button
                      onClick={() => onTestNotification(channel.id)}
                      className="px-2 py-1 text-[10px] text-zinc-500 hover:text-violet-500 transition"
                    >
                      Test
                    </button>
                  )}
                  <button
                    onClick={() => onUpdateChannel?.(channel.id, !channel.enabled)}
                    className={`w-10 h-6 rounded-full transition relative ${
                      channel.enabled ? 'bg-violet-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      channel.enabled ? 'left-5' : 'left-1'
                    }`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {Object.entries(groupedRules).map(([category, categoryRules]) => {
              const config = categoryConfig[category as keyof typeof categoryConfig];
              return (
                <div key={category}>
                  <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">
                    <div className="flex items-center gap-2">
                      <i className={`fa-solid ${config.icon} text-${config.color}-500 text-xs`} />
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {config.label}
                      </span>
                    </div>
                  </div>
                  {categoryRules.map(rule => (
                    <div key={rule.id} className="px-4 py-3">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedRuleId(expandedRuleId === rule.id ? null : rule.id)}
                      >
                        <div>
                          <p className="text-sm font-medium text-zinc-800 dark:text-white">
                            {rule.name}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {rule.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {Object.entries(rule.channels).map(([ch, enabled]) => (
                              <div
                                key={ch}
                                className={`w-6 h-6 rounded flex items-center justify-center text-xs ${
                                  enabled
                                    ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-500'
                                    : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400'
                                }`}
                              >
                                <i className={`fa-solid ${
                                  ch === 'push' ? 'fa-bell' :
                                  ch === 'email' ? 'fa-envelope' :
                                  ch === 'inApp' ? 'fa-comment' :
                                  'fa-volume-high'
                                }`} />
                              </div>
                            ))}
                          </div>
                          <i className={`fa-solid fa-chevron-${expandedRuleId === rule.id ? 'up' : 'down'} text-zinc-400 text-xs`} />
                        </div>
                      </div>

                      {/* Expanded options */}
                      {expandedRuleId === rule.id && (
                        <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg space-y-3">
                          <div>
                            <p className="text-[10px] font-medium text-zinc-500 mb-2">Notify via:</p>
                            <div className="flex gap-2">
                              {[
                                { key: 'push', label: 'Push', icon: 'fa-bell' },
                                { key: 'email', label: 'Email', icon: 'fa-envelope' },
                                { key: 'inApp', label: 'In-App', icon: 'fa-comment' },
                                { key: 'sound', label: 'Sound', icon: 'fa-volume-high' }
                              ].map(ch => (
                                <button
                                  key={ch.key}
                                  onClick={() => onUpdateRule?.(rule.id, {
                                    channels: {
                                      ...rule.channels,
                                      [ch.key]: !rule.channels[ch.key as keyof typeof rule.channels]
                                    }
                                  })}
                                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition ${
                                    rule.channels[ch.key as keyof typeof rule.channels]
                                      ? 'bg-violet-500 text-white'
                                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                                  }`}
                                >
                                  <i className={`fa-solid ${ch.icon}`} />
                                  {ch.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {rule.conditions && (
                            <div className="space-y-2">
                              {rule.conditions.priority !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-zinc-500">Priority filter</span>
                                  <select
                                    value={rule.conditions.priority}
                                    onChange={(e) => onUpdateRule?.(rule.id, {
                                      conditions: {
                                        ...rule.conditions,
                                        priority: e.target.value as 'all' | 'high' | 'none'
                                      }
                                    })}
                                    className="px-2 py-1 text-[10px] rounded border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
                                  >
                                    <option value="all">All messages</option>
                                    <option value="high">High priority only</option>
                                    <option value="none">Disabled</option>
                                  </select>
                                </div>
                              )}
                              {rule.conditions.contacts !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-zinc-500">From contacts</span>
                                  <select
                                    value={rule.conditions.contacts}
                                    onChange={(e) => onUpdateRule?.(rule.id, {
                                      conditions: {
                                        ...rule.conditions,
                                        contacts: e.target.value as 'all' | 'favorites' | 'none'
                                      }
                                    })}
                                    className="px-2 py-1 text-[10px] rounded border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
                                  >
                                    <option value="all">Everyone</option>
                                    <option value="favorites">Favorites only</option>
                                    <option value="none">No one</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="p-4 space-y-4">
            {/* Quiet hours toggle */}
            <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  quietHours?.enabled
                    ? 'bg-purple-100 dark:bg-purple-900/40'
                    : 'bg-zinc-100 dark:bg-zinc-700'
                }`}>
                  <i className={`fa-solid fa-moon ${
                    quietHours?.enabled ? 'text-purple-500' : 'text-zinc-400'
                  }`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-white">Quiet Hours</p>
                  <p className="text-xs text-zinc-500">Silence notifications during set times</p>
                </div>
              </div>
              <button
                onClick={() => onUpdateQuietHours?.({ enabled: !quietHours?.enabled })}
                className={`w-10 h-6 rounded-full transition relative ${
                  quietHours?.enabled ? 'bg-purple-500' : 'bg-zinc-300 dark:bg-zinc-600'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  quietHours?.enabled ? 'left-5' : 'left-1'
                }`} />
              </button>
            </div>

            {quietHours?.enabled && (
              <>
                {/* Time range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Start time
                    </label>
                    <input
                      type="time"
                      value={quietHours.startTime}
                      onChange={(e) => onUpdateQuietHours?.({ startTime: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      End time
                    </label>
                    <input
                      type="time"
                      value={quietHours.endTime}
                      onChange={(e) => onUpdateQuietHours?.({ endTime: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Days */}
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                    Active days
                  </label>
                  <div className="flex gap-1">
                    {daysOfWeek.map(day => (
                      <button
                        key={day.id}
                        onClick={() => {
                          const newDays = quietHours.days.includes(day.id)
                            ? quietHours.days.filter(d => d !== day.id)
                            : [...quietHours.days, day.id];
                          onUpdateQuietHours?.({ days: newDays });
                        }}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition ${
                          quietHours.days.includes(day.id)
                            ? 'bg-purple-500 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Allow urgent */}
                <label className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-zinc-800 dark:text-white">Allow urgent</p>
                    <p className="text-xs text-zinc-500">High priority messages break through</p>
                  </div>
                  <button
                    onClick={() => onUpdateQuietHours?.({ allowUrgent: !quietHours.allowUrgent })}
                    className={`w-10 h-6 rounded-full transition relative ${
                      quietHours.allowUrgent ? 'bg-purple-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      quietHours.allowUrgent ? 'left-5' : 'left-1'
                    }`} />
                  </button>
                </label>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Notification badge component
export const NotificationBadge: React.FC<{
  count: number;
  isMuted?: boolean;
}> = ({ count, isMuted = false }) => {
  if (count === 0 && !isMuted) return null;

  return (
    <div className={`flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
      isMuted
        ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
        : 'bg-red-500 text-white'
    }`}>
      {isMuted ? <i className="fa-solid fa-bell-slash text-[8px]" /> : count > 99 ? '99+' : count}
    </div>
  );
};

export default NotificationPreferences;
