/**
 * RemindersInbox
 *
 * Phase 7b — global "what came due" inbox for thread reminders.
 *
 * Companion to `<SnoozeMenu>` (which sets reminders per-conversation):
 * this component surfaces the *fired* reminders so the user sees them
 * across all conversations in one place.
 *
 *   <RemindersInbox onJumpToConversation={(id) => ...} />
 *
 * Usage:
 *   - Mount once near the conversation-list header.
 *   - The component owns its own popover + state.
 *   - Realtime: subscribes to `subscribeToFires()` so newly-fired
 *     reminders bump the count immediately.
 *   - On click of a reminder card: dismisses (via `dismiss()`) and
 *     calls `onJumpToConversation(conversationId)` so the host can
 *     activate that conversation.
 *   - Re-snooze options reuse the same presets as `<SnoozeMenu>` for
 *     consistency.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, ChevronRight, Clock, Sunrise, Calendar, X } from 'lucide-react';
import {
  threadReminderService,
  type ThreadReminder,
} from '../../services/threadReminderService';

interface RemindersInboxProps {
  /** Called when the user clicks a fired reminder. The host should
   *  switch to that conversation. The component dismisses the
   *  reminder afterwards. */
  onJumpToConversation: (conversationId: string, kind: 'dm' | 'channel') => void;
  className?: string;
}

interface SnoozePreset {
  key: 'hour' | '4hours' | 'tomorrow' | 'nextWeek';
  label: string;
  icon: React.ReactNode;
}

const SNOOZE_PRESETS: SnoozePreset[] = [
  { key: 'hour', label: '+1h', icon: <Clock className="w-3 h-3" /> },
  { key: '4hours', label: '+4h', icon: <Clock className="w-3 h-3" /> },
  { key: 'tomorrow', label: 'Tomorrow', icon: <Sunrise className="w-3 h-3" /> },
  { key: 'nextWeek', label: 'Next week', icon: <Calendar className="w-3 h-3" /> },
];

export const RemindersInbox: React.FC<RemindersInboxProps> = ({
  onJumpToConversation,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [fired, setFired] = useState<ThreadReminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Load fired list (initial + after refetch) ──────────────
  const refresh = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const rows = await threadReminderService.listFired();
        setFired(rows);
      } catch (err) {
        console.error('[RemindersInbox] list failed:', err);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Realtime: bump on any new fire ─────────────────────────
  useEffect(() => {
    const unsubscribe = threadReminderService.subscribeToFires((reminder) => {
      setFired((prev) => {
        if (prev.some((r) => r.id === reminder.id)) return prev;
        return [reminder, ...prev];
      });
    });
    return unsubscribe;
  }, []);

  // ── Click-outside to close ─────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const t = window.setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [open]);

  // ── Handlers ───────────────────────────────────────────────
  const handleJump = async (reminder: ThreadReminder) => {
    if (busyId) return;
    setBusyId(reminder.id);
    try {
      onJumpToConversation(reminder.conversation_id, reminder.conversation_kind);
      // Dismiss the reminder so it doesn't keep showing in the inbox.
      await threadReminderService.dismiss(reminder.id);
      setFired((prev) => prev.filter((r) => r.id !== reminder.id));
      setOpen(false);
    } catch (err) {
      console.error('[RemindersInbox] jump+dismiss failed:', err);
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (reminder: ThreadReminder) => {
    if (busyId) return;
    setBusyId(reminder.id);
    try {
      await threadReminderService.dismiss(reminder.id);
      setFired((prev) => prev.filter((r) => r.id !== reminder.id));
    } catch (err) {
      console.error('[RemindersInbox] dismiss failed:', err);
    } finally {
      setBusyId(null);
    }
  };

  const handleResnooze = async (reminder: ThreadReminder, preset: SnoozePreset['key']) => {
    if (busyId) return;
    setBusyId(reminder.id);
    try {
      await threadReminderService.snoozeFor(
        {
          conversationKind: reminder.conversation_kind,
          conversationId: reminder.conversation_id,
          messageId: reminder.message_id ?? undefined,
          note: reminder.note ?? undefined,
        },
        preset,
      );
      // Dismiss the original — we replaced it with a fresh pending reminder.
      await threadReminderService.dismiss(reminder.id);
      setFired((prev) => prev.filter((r) => r.id !== reminder.id));
    } catch (err) {
      console.error('[RemindersInbox] resnooze failed:', err);
    } finally {
      setBusyId(null);
    }
  };

  const count = fired.length;

  // Phase F — self-hide when zero reminders due. The "All caught up" empty
  // popover is redundant noise in the header; users can find Reminders via
  // search/keyboard, and the Triage Brief surfaces caught-up state already.
  if (count === 0 && !loading) {
    return null;
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative h-8 w-8 flex items-center justify-center rounded-md text-rose-600 dark:text-rose-bright hover:bg-rose-500/10 dark:hover:bg-rose-500/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
        title={`${count} reminder${count > 1 ? 's' : ''} due`}
        aria-label="Reminders"
        aria-expanded={open}
      >
        <BellRing className="w-3.5 h-3.5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white font-mono text-[9px] font-medium flex items-center justify-center tabular-nums">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 max-h-[480px] bg-white dark:bg-black/90 border border-zinc-200 dark:border-white/[0.06] rounded-xl shadow-xl z-50 overflow-hidden flex flex-col backdrop-blur-md"
          role="dialog"
        >
          <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-white/[0.06] flex items-center justify-between">
            <h4 className="font-mono uppercase tracking-[0.1em] text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
              DUE REMINDERS
            </h4>
            {count > 0 && (
              <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-500 tabular-nums">
                {count} PENDING
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && fired.length === 0 ? (
              <div className="p-6 text-center font-mono uppercase tracking-[0.1em] text-[10px] text-zinc-500 dark:text-zinc-500">
                LOADING…
              </div>
            ) : fired.length === 0 ? (
              <div className="p-6 text-center">
                <p className="font-mono uppercase tracking-[0.1em] text-[10px] text-zinc-500 dark:text-zinc-500">
                  ALL CAUGHT UP
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {fired.map((reminder) => (
                  <ReminderRow
                    key={reminder.id}
                    reminder={reminder}
                    busy={busyId === reminder.id}
                    onJump={() => void handleJump(reminder)}
                    onDismiss={() => void handleDismiss(reminder)}
                    onResnooze={(preset) => void handleResnooze(reminder, preset)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Single reminder row ──────────────────────────────────────

interface ReminderRowProps {
  reminder: ThreadReminder;
  busy: boolean;
  onJump: () => void;
  onDismiss: () => void;
  onResnooze: (preset: SnoozePreset['key']) => void;
}

const ReminderRow: React.FC<ReminderRowProps> = ({
  reminder,
  busy,
  onJump,
  onDismiss,
  onResnooze,
}) => {
  const [resnoozeOpen, setResnoozeOpen] = useState(false);
  const firedTime = reminder.fired_at
    ? new Date(reminder.fired_at).toLocaleString([], {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'recently';

  return (
    <li className="p-3 hover:bg-zinc-100/60 dark:hover:bg-white/[0.04] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onJump}
          disabled={busy}
          className="flex-1 text-left min-w-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.1em] text-rose-600 dark:text-rose-bright font-medium mb-0.5">
            <BellRing className="w-2.5 h-2.5" />
            <span>Due {firedTime}</span>
            <span className="text-zinc-400 dark:text-zinc-500">·</span>
            <span className="text-zinc-500 dark:text-zinc-400 normal-case tracking-normal">
              {reminder.conversation_kind === 'dm' ? 'Pulse DM' : 'Channel'}
            </span>
          </div>
          <p className="text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2">
            {reminder.note || 'Open this conversation'}
          </p>
          <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
            Open conversation
            <ChevronRight className="w-3 h-3" />
          </div>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50"
          aria-label="Dismiss reminder"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Re-snooze row */}
      <div className="mt-2">
        {!resnoozeOpen ? (
          <button
            type="button"
            onClick={() => setResnoozeOpen(true)}
            disabled={busy}
            className="text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition disabled:opacity-50"
          >
            Snooze again
          </button>
        ) : (
          <div className="flex flex-wrap gap-1">
            {SNOOZE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => onResnooze(preset.key)}
                disabled={busy}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.04] hover:bg-zinc-200 dark:hover:bg-white/[0.08] text-[11px] text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              >
                {preset.icon}
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setResnoozeOpen(false)}
              disabled={busy}
              className="px-2 py-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </li>
  );
};

export default RemindersInbox;
