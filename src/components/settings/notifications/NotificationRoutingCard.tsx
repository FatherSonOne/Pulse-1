import React, { useState, useEffect, useMemo } from 'react';
import {
  Inbox,
  AtSign,
  MessageSquare,
  Mic,
  CheckSquare,
  Lightbulb,
  CalendarDays,
  CreditCard,
  ShieldAlert,
  Loader2,
  Mail,
  Bell,
  Monitor,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsService } from '../../../services/settingsService';

type DeliveryMode = 'email' | 'push' | 'inApp';

interface ChannelDef {
  key:         string;
  label:       string;
  description: string;
  icon:        React.ComponentType<{ className?: string }>;
}

const CHANNELS: ChannelDef[] = [
  { key: 'mentions',        label: 'Mentions',          description: '@mentions in messages and threads',           icon: AtSign },
  { key: 'directMessages',  label: 'Direct messages',   description: 'New 1:1 messages from teammates',             icon: MessageSquare },
  { key: 'voxes',           label: 'Voxes',             description: 'Voice messages received',                     icon: Mic },
  { key: 'taskAssignments', label: 'Task assignments',  description: 'A teammate assigns a task to you',            icon: CheckSquare },
  { key: 'decisions',       label: 'Decisions',         description: 'Invitations to weigh in on a decision',       icon: Lightbulb },
  { key: 'calendarEvents',  label: 'Calendar events',   description: 'Upcoming meetings and event updates',         icon: CalendarDays },
  { key: 'billing',         label: 'Billing',           description: 'Invoices, payment failures, plan changes',    icon: CreditCard },
  { key: 'securityAlerts',  label: 'Security alerts',   description: 'Sign-in from new device, 2FA changes',        icon: ShieldAlert },
];

const MODES: { key: DeliveryMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'email', label: 'Email',  icon: Mail },
  { key: 'push',  label: 'Push',   icon: Bell },
  { key: 'inApp', label: 'In-app', icon: Monitor },
];

const DEFAULT_ROUTE = { email: false, push: false, inApp: false };

type RoutingMap = Record<string, { email: boolean; push: boolean; inApp: boolean }>;

export const NotificationRoutingCard: React.FC = () => {
  const [routing, setRouting]     = useState<RoutingMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving]   = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<RoutingMap>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await settingsService.get('notificationRouting');
      if (cancelled) return;
      const initial: RoutingMap = {};
      for (const ch of CHANNELS) {
        initial[ch.key] = (stored as RoutingMap | undefined)?.[ch.key] ?? { ...DEFAULT_ROUTE };
      }
      setRouting(initial);
      setSavedSnapshot(initial);
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = (channel: string, mode: DeliveryMode) => {
    setRouting(prev => ({
      ...prev,
      [channel]: {
        ...(prev[channel] ?? DEFAULT_ROUTE),
        [mode]: !(prev[channel]?.[mode] ?? false),
      },
    }));
  };

  const dirty = useMemo(() => {
    if (isLoading) return false;
    return JSON.stringify(routing) !== JSON.stringify(savedSnapshot);
  }, [routing, savedSnapshot, isLoading]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await settingsService.set('notificationRouting', routing);
      setSavedSnapshot(routing);
      toast.success('Notification routing saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save routing';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Inbox className="w-4 h-4 text-zinc-500" />
        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Channel routing</h4>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Choose where each type of notification is delivered. Multiple modes can be active per channel.
      </p>

      {isLoading && (
        <div className="py-6 text-center">
          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin mx-auto" />
        </div>
      )}

      {!isLoading && (
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full min-w-[480px] text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="text-left font-semibold text-zinc-500 dark:text-zinc-400 pb-2 pr-3">Channel</th>
                {MODES.map(m => {
                  const Icon = m.icon;
                  return (
                    <th key={m.key} className="font-semibold text-zinc-500 dark:text-zinc-400 pb-2 px-2 text-center" style={{ minWidth: 60 }}>
                      <span className="inline-flex flex-col items-center gap-1">
                        <Icon className="w-4 h-4" />
                        <span>{m.label}</span>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {CHANNELS.map((ch, idx) => {
                const Icon = ch.icon;
                const route = routing[ch.key] ?? DEFAULT_ROUTE;
                return (
                  <tr key={ch.key} className={idx > 0 ? 'border-t border-zinc-100 dark:border-zinc-800' : ''}>
                    <td className="py-2.5 pr-3 align-top">
                      <div className="flex items-start gap-2">
                        <Icon className="w-3.5 h-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-zinc-900 dark:text-white font-medium">{ch.label}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{ch.description}</p>
                        </div>
                      </div>
                    </td>
                    {MODES.map(m => (
                      <td key={m.key} className="py-2.5 px-2 align-middle text-center">
                        <input
                          type="checkbox"
                          checked={route[m.key]}
                          onChange={() => toggle(ch.key, m.key)}
                          aria-label={`${ch.label} via ${m.label}`}
                          className="w-4 h-4 text-rose-500 border-zinc-300 rounded focus:ring-rose-500"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !dirty}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Routing'}
        </button>
      </div>
    </div>
  );
};
