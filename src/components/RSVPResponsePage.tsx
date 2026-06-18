/**
 * RSVPResponsePage.tsx
 *
 * Public landing page for the Accept / Maybe / Decline links in RSVP invite
 * emails (#132). Route: /rsvp?event=<id>&email=<addr>&status=<accepted|maybe|declined>
 *
 * Invitees are anonymous, so the response is applied server-side via the
 * rsvp-respond edge function (see rsvpService.updateRSVP). The status from the
 * email button auto-submits on load; the invitee can then change their answer.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Check, HelpCircle, X, CalendarCheck, AlertCircle } from 'lucide-react';
import { updateRSVP, RSVPStatus } from '../services/rsvpService';

type RespondableStatus = 'accepted' | 'maybe' | 'declined';

const STATUS_META: Record<RespondableStatus, { label: string; verb: string; color: string; Icon: typeof Check }> = {
  accepted: { label: 'Accept',  verb: "You're going",      color: '#10b981', Icon: Check },
  maybe:    { label: 'Maybe',   verb: 'You might go',      color: '#f59e0b', Icon: HelpCircle },
  declined: { label: 'Decline', verb: "You're not going",  color: '#ef4444', Icon: X },
};

const ORDER: RespondableStatus[] = ['accepted', 'maybe', 'declined'];

const isRespondable = (s: string | null): s is RespondableStatus =>
  s === 'accepted' || s === 'maybe' || s === 'declined';

const RSVPResponsePage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get('event') ?? '';
  const email = params.get('email') ?? '';
  const initialStatus = params.get('status');

  const [status, setStatus] = useState<RSVPStatus | null>(null);
  const [eventTitle, setEventTitle] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<'missing' | 'not_invited' | 'failed' | null>(null);
  const [loaded, setLoaded] = useState(false);

  const respond = useCallback(async (next: RespondableStatus) => {
    if (!eventId || !email) { setError('missing'); setLoaded(true); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await updateRSVP(eventId, email, next);
      setStatus(res.status);
      setEventTitle(res.eventTitle);
    } catch (e) {
      setError((e as Error).message === 'not_invited' ? 'not_invited' : 'failed');
    } finally {
      setSubmitting(false);
      setLoaded(true);
    }
  }, [eventId, email]);

  // Auto-apply the choice the invitee already made in their email client.
  useEffect(() => {
    if (!eventId || !email) { setError('missing'); setLoaded(true); return; }
    if (isRespondable(initialStatus)) {
      void respond(initialStatus);
    } else {
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-500/30">
            <CalendarCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">RSVP</h1>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-xl">
          {children}
        </div>
      </div>
    </div>
  );

  if (!loaded || submitting) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-6 text-zinc-400">
          <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm">Recording your response…</span>
        </div>
      </Shell>
    );
  }

  if (error === 'missing' || error === 'not_invited') {
    return (
      <Shell>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
            {error === 'missing' ? 'Invalid RSVP link' : "Invitation not found"}
          </h2>
          <p className="text-sm text-zinc-500">
            {error === 'missing'
              ? 'This link is missing information. Please use the buttons in your invitation email.'
              : "We couldn't find an invitation for this email and event. Ask the organizer to resend it."}
          </p>
        </div>
      </Shell>
    );
  }

  const current = isRespondable(status) ? STATUS_META[status] : null;

  return (
    <Shell>
      <div className="text-center mb-6">
        {current ? (
          <>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: `${current.color}1a` }}
            >
              <current.Icon className="w-6 h-6" style={{ color: current.color }} />
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">{current.verb}</h2>
            {eventTitle && <p className="text-sm text-zinc-500">for <strong>{eventTitle}</strong></p>}
            <p className="mt-1 text-xs text-zinc-400">Response recorded. You can change it below.</p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Will you attend?</h2>
            {eventTitle && <p className="text-sm text-zinc-500">{eventTitle}</p>}
          </>
        )}
      </div>

      {error === 'failed' && (
        <div className="mb-4 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 text-center">
          Something went wrong. Please try again.
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {ORDER.map(key => {
          const meta = STATUS_META[key];
          const active = status === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => respond(key)}
              disabled={submitting}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition disabled:opacity-50 ${
                active
                  ? 'border-transparent text-white'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}
              style={active ? { background: meta.color } : undefined}
            >
              <meta.Icon className="w-5 h-5" />
              {meta.label}
            </button>
          );
        })}
      </div>
    </Shell>
  );
};

export default RSVPResponsePage;
