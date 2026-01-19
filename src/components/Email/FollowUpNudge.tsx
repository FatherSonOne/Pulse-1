// FollowUpNudge.tsx - Smart follow-up reminder component
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { CachedEmail } from '../../services/emailSyncService';

interface FollowUpItem {
  sentEmail: CachedEmail;
  daysSince: number;
  recipientName: string;
  recipientEmail: string;
  suggestedAction: 'gentle' | 'firm' | 'urgent';
}

interface FollowUpNudgeProps {
  onComposeFollowUp: (to: string, subject: string, originalEmail: CachedEmail) => void;
  onDismiss: (emailId: string) => void;
}

export const FollowUpNudge: React.FC<FollowUpNudgeProps> = ({
  onComposeFollowUp,
  onDismiss,
}) => {
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    loadFollowUps();
  }, []);

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

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900/50 border border-stone-200 dark:border-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-circle-notch fa-spin text-rose-500"></i>
          <span className="text-stone-600 dark:text-zinc-400 text-sm">Checking for follow-ups...</span>
        </div>
      </div>
    );
  }

  if (visibleFollowUps.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-zinc-900/50 border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <i className="fa-solid fa-bell text-white text-sm"></i>
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 dark:text-white text-sm">Follow-up Reminders</h3>
            <p className="text-xs text-stone-500 dark:text-zinc-500">{visibleFollowUps.length} email{visibleFollowUps.length > 1 ? 's' : ''} awaiting response</p>
          </div>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-stone-700 dark:hover:text-white transition"
          title={isCollapsed ? 'Expand' : 'Collapse'}
          aria-label={isCollapsed ? 'Expand follow-up reminders' : 'Collapse follow-up reminders'}
        >
          <i className={`fa-solid fa-chevron-${isCollapsed ? 'down' : 'up'} text-sm`}></i>
        </button>
      </div>

      {/* Follow-up items */}
      {!isCollapsed && (
        <div className="max-h-96 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800/50">
        {visibleFollowUps.map((item) => {
          const styles = getActionStyles(item.suggestedAction);

          return (
            <div
              key={item.sentEmail.id}
              className={`p-4 ${styles.bg} border-l-2 ${styles.border}`}
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
                      onClick={() => handleFollowUp(item)}
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
  );
};

export default FollowUpNudge;
