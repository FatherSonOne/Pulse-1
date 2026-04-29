// src/services/threadReminderService.ts
//
// Phase 7 — client for thread reminders ("snooze" / "remind me about
// this thread"). Backed by `thread_reminders` table from migration
// 20260427000001. The cron job in that migration auto-fires reminders
// every minute by setting status='fired' on rows where remind_at <= now().
//
// Consumers:
//   - UI: list pending + fired reminders, create new ones, dismiss/cancel.
//   - Notification dispatcher (future): subscribe to status='fired' rows
//     via realtime and surface as in-app or push notification.

import { supabase } from './supabase';

export type ConversationKind = 'dm' | 'channel';
export type ReminderStatus = 'pending' | 'fired' | 'dismissed' | 'cancelled';

export interface ThreadReminder {
  id: string;
  user_id: string;
  conversation_kind: ConversationKind;
  conversation_id: string;
  message_id: string | null;
  remind_at: string; // ISO timestamp
  note: string | null;
  status: ReminderStatus;
  fired_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateReminderInput {
  conversationKind: ConversationKind;
  conversationId: string;
  remindAt: Date;
  note?: string;
  messageId?: string;
}

class ThreadReminderService {
  // ── List ────────────────────────────────────────────────────

  /** All reminders for the current user, newest-first. */
  async listAll(): Promise<ThreadReminder[]> {
    const { data, error } = await supabase
      .from('thread_reminders')
      .select('*')
      .order('remind_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ThreadReminder[];
  }

  /** Pending reminders only (not yet fired/dismissed/cancelled). */
  async listPending(): Promise<ThreadReminder[]> {
    const { data, error } = await supabase
      .from('thread_reminders')
      .select('*')
      .eq('status', 'pending')
      .order('remind_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ThreadReminder[];
  }

  /** Reminders that have fired but the user hasn't acknowledged yet —
   *  these are what the UI surfaces as actionable notifications. */
  async listFired(): Promise<ThreadReminder[]> {
    const { data, error } = await supabase
      .from('thread_reminders')
      .select('*')
      .eq('status', 'fired')
      .order('fired_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ThreadReminder[];
  }

  /** Reminders for a specific conversation (any status). */
  async listForConversation(conversationId: string): Promise<ThreadReminder[]> {
    const { data, error } = await supabase
      .from('thread_reminders')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('remind_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ThreadReminder[];
  }

  // ── Mutations ───────────────────────────────────────────────

  /** Create a new reminder. The DB trigger enforces remind_at > now()
   *  with 60s skew tolerance — reject in UI before calling for a
   *  better error path. */
  async create(input: CreateReminderInput): Promise<ThreadReminder> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('thread_reminders')
      .insert({
        user_id: user.id,
        conversation_kind: input.conversationKind,
        conversation_id: input.conversationId,
        message_id: input.messageId ?? null,
        remind_at: input.remindAt.toISOString(),
        note: input.note ?? null,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;
    return data as ThreadReminder;
  }

  /** Cancel a pending reminder. */
  async cancel(id: string): Promise<void> {
    const { error } = await supabase
      .from('thread_reminders')
      .update({ status: 'cancelled' })
      .eq('id', id);
    if (error) throw error;
  }

  /** Dismiss a fired reminder (acknowledge it; takes it off the inbox). */
  async dismiss(id: string): Promise<void> {
    const { error } = await supabase
      .from('thread_reminders')
      .update({ status: 'dismissed' })
      .eq('id', id);
    if (error) throw error;
  }

  /** Delete entirely (used for "snooze cleanup" + tests). */
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('thread_reminders')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  /** Update remind_at — useful for "snooze longer" UX. */
  async reschedule(id: string, newRemindAt: Date): Promise<ThreadReminder> {
    const { data, error } = await supabase
      .from('thread_reminders')
      .update({
        remind_at: newRemindAt.toISOString(),
        // Re-arm if it had already fired.
        status: 'pending',
        fired_at: null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as ThreadReminder;
  }

  // ── Convenience: snooze presets ─────────────────────────────

  /** Snooze a thread for 1h / 4h / tomorrow / next-week. */
  async snoozeFor(
    input: Omit<CreateReminderInput, 'remindAt'>,
    duration: 'hour' | '4hours' | 'tomorrow' | 'nextWeek',
  ): Promise<ThreadReminder> {
    const remindAt = computeSnoozeTime(duration);
    return this.create({ ...input, remindAt });
  }

  // ── Realtime subscription ───────────────────────────────────

  /** Subscribe to fire events for the current user. Calls `onFired`
   *  whenever a reminder transitions to status='fired'. Returns an
   *  unsubscribe function. */
  subscribeToFires(
    onFired: (reminder: ThreadReminder) => void,
  ): () => void {
    const channel = supabase
      .channel('thread-reminders-fires')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'thread_reminders',
        },
        (payload) => {
          const row = payload.new as ThreadReminder;
          if (row.status === 'fired') {
            onFired(row);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }
}

/** Compute a target Date for snooze presets. Picks reasonable times
 *  (not just "+24 hours") — tomorrow = next 9am, next-week = next
 *  Monday 9am — so reminders surface at predictable times. */
function computeSnoozeTime(duration: 'hour' | '4hours' | 'tomorrow' | 'nextWeek'): Date {
  const now = new Date();
  switch (duration) {
    case 'hour':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case '4hours':
      return new Date(now.getTime() + 4 * 60 * 60 * 1000);
    case 'tomorrow': {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      t.setHours(9, 0, 0, 0);
      return t;
    }
    case 'nextWeek': {
      const t = new Date(now);
      const daysUntilMonday = (1 - t.getDay() + 7) % 7 || 7;
      t.setDate(t.getDate() + daysUntilMonday);
      t.setHours(9, 0, 0, 0);
      return t;
    }
  }
}

export const threadReminderService = new ThreadReminderService();
export default threadReminderService;
