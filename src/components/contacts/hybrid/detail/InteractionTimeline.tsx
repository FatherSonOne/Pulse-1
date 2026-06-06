// ============================================
// InteractionTimeline — the Focus column's interaction history.
// Faithful port of the legacy ContactDetail "Email History" section
// (cached_emails query + render). NOTE: the legacy timeline is EMAIL-ONLY;
// the handoff's "cross-channel (email/slack/vox/meet) on one spine" is
// aspirational — slack/vox/meet have no per-contact data source yet, so they
// arrive in a later phase. This renders the real email-derived timeline.
// See docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md §4.3.
// ============================================

import React, { useEffect, useState } from 'react';
import { Loader2, MailOpen } from 'lucide-react';
import { Contact } from '../../../../types';
import { supabase } from '../../../../services/supabase';

interface EmailHistoryItem {
  id: string;
  thread_id: string;
  subject: string;
  snippet: string;
  received_at: string;
  is_sent: boolean;
  is_read: boolean;
  from_email: string;
  from_name: string | null;
}

export const InteractionTimeline: React.FC<{ contact: Contact; userId?: string }> = ({
  contact,
  userId,
}) => {
  const [emailHistory, setEmailHistory] = useState<EmailHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!contact?.email || !userId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('cached_emails')
          .select('id, thread_id, subject, snippet, received_at, is_sent, is_read, from_email, from_name')
          .eq('user_id', userId)
          .or(`from_email.eq.${contact.email},to_emails.cs.["${contact.email}"]`)
          .order('received_at', { ascending: false })
          .limit(10);
        if (!cancelled) setEmailHistory(data ?? []);
      } catch (err) {
        if (!cancelled) console.warn('[InteractionTimeline] email history fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contact?.email, userId]);

  return (
    <div>
      <span
        className="block mb-3 text-[10px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500"
        style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
      >
        Interaction timeline
      </span>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
        </div>
      ) : emailHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-zinc-400 dark:text-zinc-500">
          <MailOpen className="w-6 h-6 mb-2" />
          <p className="text-sm">No emails found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {emailHistory.map((email) => (
            <div
              key={email.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800"
            >
              <div
                className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  email.is_sent ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
                }`}
              >
                <i className={`fa-solid text-xs ${email.is_sent ? 'fa-paper-plane' : 'fa-inbox'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-xs font-semibold truncate ${
                      !email.is_read ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {email.subject || '(no subject)'}
                  </p>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                    {email.received_at ? new Date(email.received_at).toLocaleDateString() : '—'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 truncate mt-0.5">{email.snippet}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InteractionTimeline;
