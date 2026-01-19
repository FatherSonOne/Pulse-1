// RelationshipPanel.tsx - Contact intelligence sidebar
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { CachedEmail } from '../../services/emailSyncService';

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
    return 'text-stone-400 dark:text-zinc-500';
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
      <div className="w-72 border-l border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50 p-4 flex items-center justify-center">
        <i className="fa-solid fa-circle-notch fa-spin text-rose-500"></i>
      </div>
    );
  }

  if (!contact) return null;

  return (
    <div className="w-72 border-l border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-zinc-800">
        <span className="text-sm font-semibold text-stone-700 dark:text-zinc-300">Contact Info</span>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded hover:bg-stone-200 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-400 dark:text-zinc-500 hover:text-stone-600 dark:hover:text-white transition"
        >
          <i className="fa-solid fa-xmark text-xs"></i>
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
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">
              {getInitials(contact.name, contact.email)}
            </div>
          )}

          <h3 className="font-semibold text-stone-900 dark:text-white">
            {contact.name || contact.email.split('@')[0]}
          </h3>

          {contact.title && (
            <p className="text-sm text-stone-500 dark:text-zinc-500">{contact.title}</p>
          )}

          {contact.company && (
            <p className="text-sm text-stone-500 dark:text-zinc-500">{contact.company}</p>
          )}

          <p className="text-xs text-stone-400 dark:text-zinc-600 mt-1">{contact.email}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-stone-900 dark:text-white">{contact.email_count}</div>
            <div className="text-xs text-stone-500 dark:text-zinc-500">emails</div>
          </div>
          <div className="bg-white dark:bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className={`text-lg font-bold ${getStrengthColor(contact.relationship_strength)}`}>
              {contact.relationship_strength}%
            </div>
            <div className="text-xs text-stone-500 dark:text-zinc-500">strength</div>
          </div>
        </div>

        {/* Last contact */}
        <div className="bg-white dark:bg-zinc-800/50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-500 dark:text-zinc-500">Last contact</span>
            <span className="text-xs font-medium text-stone-700 dark:text-zinc-300">
              {formatRelativeTime(contact.last_contacted_at)}
            </span>
          </div>
          {contact.avg_response_time_hours && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-stone-500 dark:text-zinc-500">Avg response</span>
              <span className="text-xs font-medium text-stone-700 dark:text-zinc-300">
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
            <h4 className="text-xs font-semibold text-stone-500 dark:text-zinc-500 uppercase tracking-wide mb-2">
              Recent Threads
            </h4>
            <div className="space-y-2">
              {recentThreads.map((thread) => (
                <button
                  key={thread.id}
                  className="w-full text-left p-2 bg-white dark:bg-zinc-800/50 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-lg transition"
                >
                  <div className="text-sm text-stone-700 dark:text-zinc-300 truncate">
                    {thread.subject}
                  </div>
                  <div className="text-xs text-stone-400 dark:text-zinc-500">
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
            <h4 className="text-xs font-semibold text-stone-500 dark:text-zinc-500 uppercase tracking-wide">
              Your Notes
            </h4>
            {!editingNotes && (
              <button
                onClick={() => setEditingNotes(true)}
                className="text-xs text-rose-500 hover:text-rose-600 font-medium"
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
                className="w-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg p-2 text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:border-rose-500"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={saveNotes}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium py-1.5 rounded-lg transition"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setNotes(contact.custom_notes || '');
                    setEditingNotes(false);
                  }}
                  className="flex-1 bg-stone-200 dark:bg-zinc-800 hover:bg-stone-300 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-300 text-xs font-medium py-1.5 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-800/50 rounded-lg p-3 text-sm text-stone-600 dark:text-zinc-400">
              {contact.custom_notes || contact.ai_notes || (
                <span className="text-stone-400 dark:text-zinc-500 italic">No notes yet</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RelationshipPanel;
