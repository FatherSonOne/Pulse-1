/**
 * RSVPPanel.tsx
 *
 * Shows attendee list with RSVP status badges for an event.
 * Organiser view shows "Resend invite" and "Remove" actions.
 * Supports real-time status updates via rsvpService subscription.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Plus, RefreshCw, Trash2, UserCheck } from 'lucide-react';
import {
  RSVPRecord,
  RSVPSummary,
  Attendee,
  getRSVPStatus,
  getRSVPSummary,
  sendRSVPInvites,
  removeAttendee,
  subscribeToRSVP,
} from '../../services/rsvpService';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  accepted: { label: 'Accepted', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  declined: { label: 'Declined', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  maybe:    { label: 'Maybe',    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  pending:  { label: 'Pending',  cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
};

const StatusBadge: React.FC<{ status: RSVPRecord['status'] }> = ({ status }) => {
  const { label, cls } = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
};

// ── Avatar helper ─────────────────────────────────────────────────────────────

const Avatar: React.FC<{ name: string; avatarUrl?: string }> = ({ name, avatarUrl }) => {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />;
  }
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hue = name.charCodeAt(0) % 360;
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={{ background: `hsl(${hue},65%,50%)` }}
    >
      {initials}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

interface RSVPPanelProps {
  eventId: string;
  isOrganizer: boolean;
}

export const RSVPPanel: React.FC<RSVPPanelProps> = ({ eventId, isOrganizer }) => {
  const [records, setRecords] = useState<RSVPRecord[]>([]);
  const [summary, setSummary] = useState<RSVPSummary>({ accepted: 0, declined: 0, maybe: 0, pending: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add attendee form
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const [recs, sum] = await Promise.all([
        getRSVPStatus(eventId),
        getRSVPSummary(eventId),
      ]);
      setRecords(recs);
      setSummary(sum);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
    const unsub = subscribeToRSVP(eventId, (updated) => {
      setRecords(updated);
      setSummary({
        accepted: updated.filter(r => r.status === 'accepted').length,
        declined: updated.filter(r => r.status === 'declined').length,
        maybe:    updated.filter(r => r.status === 'maybe').length,
        pending:  updated.filter(r => r.status === 'pending').length,
        total:    updated.length,
      });
    });
    return unsub;
  }, [eventId, load]);

  async function handleResend(email: string, name: string | null) {
    try {
      await sendRSVPInvites(eventId, [{ email, name: name ?? undefined }]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleRemove(email: string) {
    try {
      await removeAttendee(eventId, email);
      setRecords(prev => prev.filter(r => r.email !== email));
      setSummary(prev => ({ ...prev, total: prev.total - 1 }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleAddAttendee(e: React.FormEvent) {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setAdding(true);
    try {
      const attendee: Attendee = { email: addEmail.trim(), name: addName.trim() || undefined };
      await sendRSVPInvites(eventId, [attendee]);
      setAddEmail('');
      setAddName('');
      setShowAddForm(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-400">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm">Loading attendees…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Summary row */}
      {summary.total > 0 && (
        <div className="flex items-center gap-3 text-xs text-[var(--pulse-ink-3)] pb-1 border-b border-[var(--pulse-border)]">
          {summary.accepted > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-medium">{summary.accepted} accepted</span>}
          {summary.declined > 0 && <span className="text-red-500 font-medium">{summary.declined} declined</span>}
          {summary.maybe > 0    && <span className="text-amber-500 font-medium">{summary.maybe} maybe</span>}
          {summary.pending > 0  && <span>{summary.pending} pending</span>}
        </div>
      )}

      {/* Attendee list */}
      {records.length === 0 ? (
        <div className="text-center py-6">
          <UserCheck className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">No attendees yet</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
          {records.map(record => (
            <div
              key={record.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition group"
            >
              <Avatar name={record.name ?? record.email} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                  {record.name ?? record.email}
                </div>
                {record.name && (
                  <div className="text-xs text-zinc-400 truncate">{record.email}</div>
                )}
              </div>
              <StatusBadge status={record.status} />
              {isOrganizer && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={() => handleResend(record.email, record.name)}
                    className="p-1 text-zinc-400 hover:text-rose-500 transition"
                    title="Resend invite"
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(record.email)}
                    className="p-1 text-zinc-400 hover:text-red-500 transition"
                    title="Remove attendee"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add attendee */}
      {isOrganizer && (
        <div className="border-t border-[var(--pulse-border)] pt-3">
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 text-sm text-rose-500 hover:text-rose-600 font-medium transition"
            >
              <Plus className="w-4 h-4" />
              Add attendee
            </button>
          ) : (
            <form onSubmit={handleAddAttendee} className="space-y-2">
              <input
                type="text"
                placeholder="Name (optional)"
                value={addName}
                onChange={e => setAddName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-400 dark:text-zinc-200 transition"
              />
              <input
                type="email"
                placeholder="Email address"
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                required
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-400 dark:text-zinc-200 transition"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                >
                  {adding ? 'Inviting…' : 'Invite'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default RSVPPanel;
