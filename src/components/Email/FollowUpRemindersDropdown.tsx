// FollowUpRemindersDropdown.tsx - Dropdown follow-up reminders in top bar
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { CachedEmail } from '../../services/emailSyncService';

interface FollowUpItem {
  sentEmail: CachedEmail;
  daysSince: number;
  recipientName: string;
  recipientEmail: string;
  suggestedAction: 'gentle' | 'firm' | 'urgent';
}

interface FollowUpRemindersDropdownProps {
  onComposeFollowUp: (to: string, subject: string, originalEmail: CachedEmail) => void;
  onDismiss: (emailId: string) => void;
}

export const FollowUpRemindersDropdown: React.FC<FollowUpRemindersDropdownProps> = ({
  onComposeFollowUp,
  onDismiss,
}) => {
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadFollowUps();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const loadFollowUps = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get sent emails from last 14 days
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data: sentEmails } = await supabase
        .from('cached_emails')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_sent', true)
        .eq('is_trashed', false)
        .gte('received_at', fourteenDaysAgo.toISOString())
        .order('received_at', { ascending: false });

      if (!sentEmails || sentEmails.length === 0) {
        setFollowUps([]);
        return;
      }

      // Check each sent email for responses
      const needsFollowUp: FollowUpItem[] = [];

      for (const sentEmail of sentEmails) {
        // Skip if no recipients
        if (!sentEmail.to_emails || sentEmail.to_emails.length === 0) continue;

        const primaryRecipient = sentEmail.to_emails[0];
        // Extract email from object format { email, name }
        const recipientEmail = typeof primaryRecipient === 'string' 
          ? primaryRecipient 
          : (primaryRecipient?.email || '');
        const recipientNameFromData = typeof primaryRecipient === 'object' && primaryRecipient !== null
          ? (primaryRecipient?.name || null)
          : null;

        if (!recipientEmail) continue;

        // Check if we received a reply in the same thread
        const { data: replies } = await supabase
          .from('cached_emails')
          .select('id')
          .eq('user_id', user.id)
          .eq('thread_id', sentEmail.thread_id)
          .eq('from_email', recipientEmail)
          .gt('received_at', sentEmail.received_at)
          .limit(1);

        // No reply found
        if (!replies || replies.length === 0) {
          const sentDate = new Date(sentEmail.received_at);
          const now = new Date();
          const daysSince = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));

          // Only show if at least 2 days have passed
          if (daysSince >= 2) {
            let suggestedAction: 'gentle' | 'firm' | 'urgent' = 'gentle';
            if (daysSince >= 7) suggestedAction = 'firm';
            if (daysSince >= 10) suggestedAction = 'urgent';

            // Extract recipient name from email or use email prefix
            const recipientName = recipientNameFromData || recipientEmail.split('@')[0]
              .replace(/[._-]/g, ' ')
              .split(' ')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');

            needsFollowUp.push({
              sentEmail,
              daysSince,
              recipientName,
              recipientEmail: recipientEmail,
              suggestedAction,
            });
          }
        }
      }

      // Sort by days since (most urgent first)
      needsFollowUp.sort((a, b) => b.daysSince - a.daysSince);

      // Limit to top 5
      setFollowUps(needsFollowUp.slice(0, 5));
    } catch (error) {
      console.error('Error loading follow-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (emailId: string) => {
    setDismissed(prev => new Set([...prev, emailId]));
    onDismiss(emailId);
  };

  const handleFollowUp = (item: FollowUpItem) => {
    const subject = item.sentEmail.subject?.startsWith('Re:')
      ? item.sentEmail.subject
      : `Re: ${item.sentEmail.subject || '(no subject)'}`;

    onComposeFollowUp(item.recipientEmail, subject, item.sentEmail);
  };

  const handleToggle = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    if (newIsOpen && !hasBeenOpened) {
      setHasBeenOpened(true);
    }
  };

  const getActionStyles = (action: 'gentle' | 'firm' | 'urgent') => {
    switch (action) {
      case 'urgent':
        return {
          bg: 'bg-red-500/10 dark:bg-red-500/20',
          border: 'border-red-500/30',
          text: 'text-red-600 dark:text-red-400',
          icon: 'fa-circle-exclamation',
          label: 'Urgent follow-up needed',
        };
      case 'firm':
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-500/20',
          border: 'border-amber-500/30',
          text: 'text-amber-600 dark:text-amber-400',
          icon: 'fa-clock',
          label: 'Follow up recommended',
        };
      default:
        return {
          bg: 'bg-blue-500/10 dark:bg-blue-500/20',
          border: 'border-blue-500/30',
          text: 'text-blue-600 dark:text-blue-400',
          icon: 'fa-bell',
          label: 'Consider following up',
        };
    }
  };

  const visibleFollowUps = followUps.filter(f => !dismissed.has(f.sentEmail.id));
  const hasReminders = visibleFollowUps.length > 0;

  // Determine pulse animation class
  const pulseClass = hasReminders
    ? hasBeenOpened
      ? 'animate-pulse-slow' // Slow pulse after user has opened it
      : 'animate-pulse-aggressive' // Aggressive pulse when first loaded
    : '';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Follow-up Reminders Button */}
      <button
        onClick={handleToggle}
        className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
          isOpen
            ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
            : 'bg-stone-200 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white'
        } ${pulseClass}`}
        title={hasReminders ? `${visibleFollowUps.length} follow-up reminder${visibleFollowUps.length > 1 ? 's' : ''}` : 'No follow-up reminders'}
      >
        <i className="fa-solid fa-bell"></i>
        <span className="hidden sm:inline">Follow-ups</span>
        {hasReminders && (
          <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] flex items-center justify-center">
            {visibleFollowUps.length}
          </span>
        )}
        <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} text-xs`}></i>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[600px] bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-scaleIn origin-top-right">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 dark:border-zinc-800 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <i className="fa-solid fa-bell text-white text-sm"></i>
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 dark:text-white text-sm">Follow-up Reminders</h3>
                <p className="text-xs text-stone-500 dark:text-zinc-500">
                  {loading ? 'Loading...' : `${visibleFollowUps.length} email${visibleFollowUps.length > 1 ? 's' : ''} awaiting response`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-stone-700 dark:hover:text-white transition"
              title="Close"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="text-center">
                <i className="fa-solid fa-circle-notch fa-spin text-rose-500 text-2xl mb-2"></i>
                <p className="text-stone-600 dark:text-zinc-400 text-sm">Checking for follow-ups...</p>
              </div>
            </div>
          ) : visibleFollowUps.length === 0 ? (
            <div className="p-8 text-center">
              <i className="fa-solid fa-check-circle text-4xl text-green-500 mb-3"></i>
              <p className="text-stone-600 dark:text-zinc-400 text-sm">All caught up! No follow-ups needed.</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[500px] divide-y divide-stone-100 dark:divide-zinc-800/50">
              {visibleFollowUps.map((item) => {
                const styles = getActionStyles(item.suggestedAction);

                return (
                  <div
                    key={item.sentEmail.id}
                    className={`p-4 ${styles.bg} border-l-2 ${styles.border} hover:bg-opacity-20 transition`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full ${styles.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <i className={`fa-solid ${styles.icon} ${styles.text} text-xs`}></i>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-stone-900 dark:text-white text-sm truncate">
                            {item.recipientName}
                          </span>
                          <span className={`text-xs ${styles.text} font-medium`}>
                            {item.daysSince} days ago
                          </span>
                        </div>

                        <p className="text-sm text-stone-600 dark:text-zinc-400 truncate mb-2">
                          {item.sentEmail.subject || '(no subject)'}
                        </p>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              handleFollowUp(item);
                              setIsOpen(false);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white text-xs font-medium rounded-lg transition"
                          >
                            <i className="fa-solid fa-reply"></i>
                            Follow Up
                          </button>
                          <button
                            onClick={() => handleDismiss(item.sentEmail.id)}
                            className="px-3 py-1.5 text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white text-xs font-medium rounded-lg hover:bg-stone-200 dark:hover:bg-zinc-800 transition"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FollowUpRemindersDropdown;
