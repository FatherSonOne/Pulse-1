// RelationshipPanel.tsx - Contact intelligence sidebar
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { CachedEmail } from '../../services/emailSyncService';
import { AiChip } from './hybrid/primitives';

import { Loader2, X } from 'lucide-react';

interface ContactInfo {
  id?: string;
  email: string;
  name: string | null;
  company: string | null;
  title: string | null;
  avatar_url: string | null;
  last_contacted_at: string | null;
  email_count: number;
  avg_response_time_hours: number | null;
  relationship_strength: number;
  ai_notes: string | null;
  custom_notes: string | null;
}

interface RelationshipPanelProps {
  email: CachedEmail;
  onClose: () => void;
}

interface RecentThread {
  subject: string;
  date: string;
  id: string;
}

export const RelationshipPanel: React.FC<RelationshipPanelProps> = ({
  email,
  onClose,
}) => {
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [recentThreads, setRecentThreads] = useState<RecentThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');

  // Load contact info
  useEffect(() => {
    loadContactInfo();
  }, [email.from_email]);

  const loadContactInfo = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get or create contact
      const { data: existingContact } = await supabase
        .from('email_contacts')
        .select('*')
        .eq('user_id', user.id)
        .eq('email', email.from_email)
        .single();

      if (existingContact) {
        setContact(existingContact);
        setNotes(existingContact.custom_notes || '');
      } else {
        // Create basic contact info from email
        const newContact: ContactInfo = {
          email: email.from_email,
          name: email.from_name,
          company: null,
          title: null,
          avatar_url: null,
          last_contacted_at: email.received_at,
          email_count: 1,
          avg_response_time_hours: null,
          relationship_strength: 50,
          ai_notes: null,
          custom_notes: null,
        };

        // Try to extract company from email domain
        const domain = email.from_email.split('@')[1];
        if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(domain)) {
          newContact.company = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
        }

        setContact(newContact);
      }

      // Load recent threads with this contact
      const { data: threads } = await supabase
        .from('cached_emails')
        .select('thread_id, subject, received_at')
        .eq('user_id', user.id)
        .eq('from_email', email.from_email)
        .order('received_at', { ascending: false })
        .limit(5);

      if (threads) {
        // Deduplicate by thread
        const uniqueThreads = threads.reduce((acc, t) => {
          if (!acc.find((x: { id: string }) => x.id === t.thread_id)) {
            acc.push({
              id: t.thread_id,
              subject: t.subject || '(no subject)',
              date: t.received_at,
            });
          }
          return acc;
        }, [] as RecentThread[]);

        setRecentThreads(uniqueThreads.slice(0, 3));
      }

      // Update email count
      const { count } = await supabase
        .from('cached_emails')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .or(`from_email.eq.${email.from_email},to_emails.cs.["${email.from_email}"]`);

      if (contact && count) {
        setContact(prev => prev ? { ...prev, email_count: count } : prev);
      }

    } catch (error) {
      console.error('Error loading contact:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save custom notes
  const saveNotes = async () => {
    if (!contact) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('email_contacts')
        .upsert({
          user_id: user.id,
          email: contact.email,
          name: contact.name,
          company: contact.company,
          custom_notes: notes,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,email'
        });

      setContact(prev => prev ? { ...prev, custom_notes: notes } : prev);
      setEditingNotes(false);
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  // Get initials for avatar
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  // Get relationship strength color
  const getStrengthColor = (strength: number) => {
    if (strength >= 70) return 'text-green-500';
    if (strength >= 40) return 'text-yellow-500';
    return 'pulse-ink-3-color';
  };

  // Get relationship strength bar fill (same thresholds as the number color)
  const getStrengthBarColor = (strength: number) => {
    if (strength >= 70) return '#22c55e';
    if (strength >= 40) return '#eab308';
    return 'var(--pulse-ink-3)';
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="w-72 border-l pulse-border-color pulse-surface p-4 flex items-center justify-center">
        <Loader2 className="pulse-rose-color animate-spin" />
      </div>
    );
  }

  if (!contact) return null;

  return (
    <div className="w-72 border-l pulse-border-color pulse-surface flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b pulse-border-color">
        <span className="font-mono-pulse tracking-wide-mono text-[11px] uppercase pulse-ink-3-color">Contact Info</span>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded hover:pulse-surface-raised flex items-center justify-center pulse-ink-3-color hover:pulse-ink-color transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Profile card */}
        <div className="text-center">
          {/* Avatar */}
          {contact.avatar_url ? (
            <img
              src={contact.avatar_url}
              alt={contact.name || contact.email}
              className="w-16 h-16 rounded-full mx-auto mb-3"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-3"
              style={{ background: 'linear-gradient(135deg, var(--pulse-rose), var(--pulse-pink))' }}
            >
              {getInitials(contact.name, contact.email)}
            </div>
          )}

          <h3 className="font-semibold pulse-ink-color">
            {contact.name || contact.email.split('@')[0]}
          </h3>

          {contact.title && (
            <p className="text-sm pulse-ink-2-color">{contact.title}</p>
          )}

          {contact.company && (
            <p className="text-sm pulse-ink-2-color">{contact.company}</p>
          )}

          <p className="text-xs pulse-ink-3-color mt-1">{contact.email}</p>
        </div>

        {/* Stats */}
        <div>
          <div className="grid grid-cols-2 gap-3">
            <div className="pulse-surface-raised border pulse-border-color rounded-lg p-3 text-center">
              <div className="text-lg font-bold pulse-ink-color tnum">{contact.email_count}</div>
              <div className="text-xs pulse-ink-3-color">emails</div>
            </div>
            <div className="pulse-surface-raised border pulse-border-color rounded-lg p-3 text-center">
              <div className={`text-lg font-bold tnum ${getStrengthColor(contact.relationship_strength)}`}>
                {contact.relationship_strength}%
              </div>
              <div className="text-xs pulse-ink-3-color">strength</div>
            </div>
          </div>

          {/* Strength meter bar (additive) — fill width = strength %, keeps the same color logic */}
          <div className="h-[5px] rounded-full pulse-surface-raised overflow-hidden mt-2" aria-label={`Relationship strength ${contact.relationship_strength}%`}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(0, Math.min(100, contact.relationship_strength))}%`,
                backgroundColor: getStrengthBarColor(contact.relationship_strength),
              }}
            ></div>
          </div>
        </div>

        {/* Last contact */}
        <div className="pulse-surface-raised border pulse-border-color rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs pulse-ink-3-color">Last contact</span>
            <span className="text-xs font-medium pulse-ink-color">
              {formatRelativeTime(contact.last_contacted_at)}
            </span>
          </div>
          {contact.avg_response_time_hours && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs pulse-ink-3-color">Avg response</span>
              <span className="text-xs font-medium pulse-ink-color">
                {contact.avg_response_time_hours < 1
                  ? `${Math.round(contact.avg_response_time_hours * 60)} min`
                  : `${Math.round(contact.avg_response_time_hours)} hrs`}
              </span>
            </div>
          )}
        </div>

        {/* Recent threads */}
        {recentThreads.length > 0 && (
          <div>
            <h4 className="font-mono-pulse tracking-wide-mono text-[11px] uppercase pulse-ink-3-color mb-2">
              Recent Threads
            </h4>
            <div className="space-y-2">
              {recentThreads.map((thread) => (
                <button
                  key={thread.id}
                  className="w-full text-left p-2 pulse-surface-raised border pulse-border-color hover:pulse-border-strong-color rounded-lg transition"
                >
                  <div className="text-sm pulse-ink-color truncate">
                    {thread.subject}
                  </div>
                  <div className="text-xs pulse-ink-3-color">
                    {formatRelativeTime(thread.date)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-mono-pulse tracking-wide-mono text-[11px] uppercase pulse-ink-3-color">
              Your Notes
            </h4>
            {!editingNotes && (
              <button
                onClick={() => setEditingNotes(true)}
                className="text-xs pulse-rose-color hover:opacity-80 font-medium"
              >
                Edit
              </button>
            )}
          </div>

          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this contact..."
                className="w-full pulse-surface border pulse-border-color rounded-lg p-2 text-sm pulse-ink-color placeholder:pulse-ink-3-color resize-none focus:outline-none focus:pulse-rose-border"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={saveNotes}
                  className="flex-1 pulse-rose-bg-color hover:opacity-90 text-white text-xs font-medium py-1.5 rounded-lg transition"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setNotes(contact.custom_notes || '');
                    setEditingNotes(false);
                  }}
                  className="flex-1 pulse-surface-raised border pulse-border-color hover:pulse-border-strong-color pulse-ink-color text-xs font-medium py-1.5 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            contact.custom_notes ? (
              <div className="pulse-surface-raised border pulse-border-color rounded-lg p-3 text-sm pulse-ink-2-color">
                {contact.custom_notes}
              </div>
            ) : contact.ai_notes ? (
              /* ai_notes is AI output → coral-permitted block */
              <div className="pulse-coral-bg-08-color border pulse-border-color rounded-lg p-3">
                <div className="mb-2">
                  <AiChip>AI Notes</AiChip>
                </div>
                <p className="m-0 text-sm pulse-ink-2-color">{contact.ai_notes}</p>
              </div>
            ) : (
              <div className="pulse-surface-raised border pulse-border-color rounded-lg p-3 text-sm pulse-ink-2-color">
                <span className="pulse-ink-3-color italic">No notes yet</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default RelationshipPanel;
