/**
 * rsvpService.ts
 *
 * Manages RSVP / attendance records for calendar events.
 * Stores records in the `event_rsvp` table and triggers
 * in-app notifications via the existing notification pipeline.
 */

import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export type RSVPStatus = 'pending' | 'accepted' | 'declined' | 'maybe';

export interface Attendee {
  userId?: string;
  email: string;
  name?: string;
}

export interface RSVPRecord {
  id: string;
  event_id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  status: RSVPStatus;
  responded_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface RSVPSummary {
  accepted: number;
  declined: number;
  maybe: number;
  pending: number;
  total: number;
}

// ── Service ──────────────────────────────────────────────────────────────────

// ── Email helpers ─────────────────────────────────────────────────────────────

function buildRSVPEmailHTML(
  attendee: Attendee,
  eventTitle: string,
  eventStart: Date,
  eventId: string,
): string {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.pulse.com';
  const dateStr = eventStart.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const name = attendee.name || attendee.email;

  const btn = (label: string, status: string, color: string) =>
    `<a href="${appUrl}/rsvp?event=${eventId}&email=${encodeURIComponent(attendee.email)}&status=${status}" style="display:inline-block;padding:10px 22px;background:${color};color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:0 6px">${label}</a>`;

  return `<!DOCTYPE html><html><body style="font-family:Inter,system-ui,sans-serif;background:#f9fafb;padding:32px">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e5e7eb">
  <h2 style="color:#111;margin-top:0">You're invited!</h2>
  <p style="color:#374151">Hi ${name},</p>
  <p style="color:#374151">You've been invited to <strong>${eventTitle}</strong> on <strong>${dateStr}</strong>.</p>
  <div style="text-align:center;margin:28px 0">
    ${btn('Accept', 'accepted', '#10b981')}
    ${btn('Maybe', 'maybe', '#f59e0b')}
    ${btn('Decline', 'declined', '#ef4444')}
  </div>
  <p style="color:#9ca3af;font-size:12px;text-align:center">Powered by Pulse Calendar</p>
</div></body></html>`;
}

/**
 * Upserts RSVP rows for a list of attendees and queues in-app notifications.
 * Idempotent — calling again for an already-invited attendee only refreshes the row.
 * Pass optional eventTitle + eventStart to trigger email invites via Resend.
 */
export async function sendRSVPInvites(
  eventId: string,
  attendees: Attendee[],
  eventTitle?: string,
  eventStart?: Date,
): Promise<void> {
  if (!attendees.length) return;

  const rows = attendees.map(a => ({
    event_id:    eventId,
    user_id:     a.userId ?? null,
    email:       a.email,
    name:        a.name ?? null,
    status:      'pending' as RSVPStatus,
    responded_at: null,
  }));

  const { error } = await supabase
    .from('event_rsvp')
    .upsert(rows, { onConflict: 'event_id,email', ignoreDuplicates: false });

  if (error) throw error;

  // Trigger in-app notifications for Pulse users
  const pulseAttendees = attendees.filter(a => a.userId);
  if (pulseAttendees.length > 0) {
    await Promise.allSettled(
      pulseAttendees.map(a =>
        supabase.from('notifications').insert({
          user_id:    a.userId,
          type:       'calendar_invite',
          payload:    { event_id: eventId },
          read:       false,
          created_at: new Date().toISOString(),
        }),
      ),
    );
  }

  // Send email invitations via Resend (only when API key is configured)
  const resendKey = import.meta.env.VITE_RESEND_API_KEY as string | undefined;
  if (resendKey && eventTitle && eventStart) {
    await Promise.allSettled(
      attendees.map(a =>
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Pulse Calendar <calendar@pulse.logosvision.org>',
            to:   a.email,
            subject: `Invitation: ${eventTitle}`,
            html: buildRSVPEmailHTML(a, eventTitle, eventStart, eventId),
          }),
        }),
      ),
    );
  }
}

/**
 * Updates the RSVP status for a given email address.
 */
export async function updateRSVP(
  eventId: string,
  email: string,
  status: RSVPStatus,
  notes?: string,
): Promise<void> {
  const { error } = await supabase
    .from('event_rsvp')
    .update({
      status,
      responded_at: new Date().toISOString(),
      notes:        notes ?? null,
    })
    .eq('event_id', eventId)
    .eq('email', email);

  if (error) throw error;
}

/**
 * Returns all RSVP records for an event (organiser view).
 */
export async function getRSVPStatus(eventId: string): Promise<RSVPRecord[]> {
  const { data, error } = await supabase
    .from('event_rsvp')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as RSVPRecord[];
}

/**
 * Returns a summary count for an event.
 */
export async function getRSVPSummary(eventId: string): Promise<RSVPSummary> {
  const records = await getRSVPStatus(eventId);
  return {
    accepted: records.filter(r => r.status === 'accepted').length,
    declined: records.filter(r => r.status === 'declined').length,
    maybe:    records.filter(r => r.status === 'maybe').length,
    pending:  records.filter(r => r.status === 'pending').length,
    total:    records.length,
  };
}

/**
 * Returns all events where the current user was invited and their RSVP status.
 */
export async function getMyRSVPs(userId: string): Promise<RSVPRecord[]> {
  const { data, error } = await supabase
    .from('event_rsvp')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as RSVPRecord[];
}

/**
 * Removes a specific attendee from an event's RSVP list.
 * Only the event organiser should call this.
 */
export async function removeAttendee(eventId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from('event_rsvp')
    .delete()
    .eq('event_id', eventId)
    .eq('email', email);

  if (error) throw error;
}

/**
 * Subscribes to real-time RSVP changes for an event.
 * Returns an unsubscribe function.
 */
export function subscribeToRSVP(
  eventId: string,
  callback: (records: RSVPRecord[]) => void,
): () => void {
  const channel = supabase
    .channel(`rsvp-${eventId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'event_rsvp', filter: `event_id=eq.${eventId}` },
      async () => {
        const records = await getRSVPStatus(eventId);
        callback(records);
      },
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}
