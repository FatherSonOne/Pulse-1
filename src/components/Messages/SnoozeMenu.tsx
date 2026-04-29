/**
 * SnoozeMenu
 *
 * Phase 7b — dropdown menu attached to the conversation header that
 * lets the user snooze ("remind me about this thread") for a preset
 * duration. Persists via `threadReminderService.snoozeFor` (Session
 * 7a). The cron job in migration 20260427000001 fires reminders by
 * flipping status to 'fired' once `remind_at <= now()`.
 *
 * Used in the legacy `Messages.tsx` conversation header. Designed to
 * be drop-in: pass the active conversation id + kind, and a
 * `getReminderNote()` callback that can pull a useful default note
 * from current state (e.g. the current draft, last unread message).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, Clock, Sunrise, Calendar, BellOff } from 'lucide-react';
import {
  threadReminderService,
  type ConversationKind,
  type ThreadReminder,
} from '../../services/threadReminderService';

interface SnoozeMenuProps {
  conversationKind: ConversationKind;
  conversationId: string;
  /** Optional default note to attach to the reminder (e.g. last
   *  message preview or current draft). */
  defaultNote?: string;
  /** Called after a snooze is created. Useful for showing a toast. */
  onScheduled?: (reminder: ThreadReminder) => void;
  /** Called if the create call fails. */
  onError?: (error: Error) => void;
  className?: string;
}

interface PresetOption {
  key: 'hour' | '4hours' | 'tomorrow' | 'nextWeek';
  label: string;
  hint: string;
  icon: React.ReactNode;
}

const PRESETS: PresetOption[] = [
  {
    key: 'hour',
    label: 'In 1 hour',
    hint: 'Quick check-back',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  {
    key: '4hours',
    label: 'In 4 hours',
    hint: 'Later today',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  {
    key: 'tomorrow',
    label: 'Tomorrow',
    hint: '9:00 AM',
    icon: <Sunrise className="w-3.5 h-3.5" />,
  },
  {
    key: 'nextWeek',
    label: 'Next Monday',
    hint: '9:00 AM',
    icon: <Calendar className="w-3.5 h-3.5" />,
  },
];

export const SnoozeMenu: React.FC<SnoozeMenuProps> = ({
  conversationKind,
  conversationId,
  defaultNote,
  onScheduled,
  onError,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<PresetOption['key'] | null>(null);
  const [activeReminder, setActiveReminder] = useState<ThreadReminder | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load any existing pending reminder for this conversation so we can
  // show "Already snoozed" state and offer to cancel.
  useEffect(() => {
    let cancelled = false;
    void threadReminderService.listForConversation(conversationId).then((rows) => {
      if (cancelled) return;
      const pending = rows.find((r) => r.status === 'pending');
      setActiveReminder(pending ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Defer attaching so the trigger click doesn't immediately close.
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [open]);

  const handleSnooze = async (preset: PresetOption['key']) => {
    if (pendingPreset) return;
    setPendingPreset(preset);
    try {
      const reminder = await threadReminderService.snoozeFor(
        {
          conversationKind,
          conversationId,
          note: defaultNote,
        },
        preset,
      );
      setActiveReminder(reminder);
      onScheduled?.(reminder);
      setOpen(false);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      onError?.(e);
    } finally {
      setPendingPreset(null);
    }
  };

  const handleCancel = async () => {
    if (!activeReminder) return;
    try {
      await threadReminderService.cancel(activeReminder.id);
      setActiveReminder(null);
      setOpen(false);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const isSnoozed = !!activeReminder;
  const buttonTitle = isSnoozed
    ? `Snoozed until ${new Date(activeReminder.remind_at).toLocaleString()}`
    : 'Snooze this conversation';

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
          isSnoozed
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
        title={buttonTitle}
        aria-label={buttonTitle}
        aria-expanded={open}
      >
        <Bell className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden"
          role="menu"
        >
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
            <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              {isSnoozed ? 'Snoozed' : 'Remind me about this'}
            </h4>
          </div>

          {isSnoozed ? (
            <div className="p-3">
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-1">
                Reminder set for
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-3">
                {new Date(activeReminder.remind_at).toLocaleString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
              <button
                type="button"
                onClick={handleCancel}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
              >
                <BellOff className="w-3.5 h-3.5" />
                Cancel reminder
              </button>
            </div>
          ) : (
            <div className="py-1">
              {PRESETS.map((preset) => {
                const busy = pendingPreset === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => void handleSnooze(preset.key)}
                    disabled={!!pendingPreset}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50 disabled:cursor-wait"
                    role="menuitem"
                  >
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {preset.icon}
                    </span>
                    <span className="flex-1">
                      <div className="text-zinc-900 dark:text-zinc-100">{preset.label}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{preset.hint}</div>
                    </span>
                    {busy && <Check className="w-3.5 h-3.5 animate-pulse text-amber-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SnoozeMenu;
