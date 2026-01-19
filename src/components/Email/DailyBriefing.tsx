// DailyBriefing.tsx - Morning email summary card
import React, { useState, useEffect } from 'react';
import { emailSyncService, CachedEmail } from '../../services/emailSyncService';
import { emailAIService } from '../../services/emailAIService';

interface DailyBriefingProps {
  onEmailClick: (email: CachedEmail) => void;
  onViewAll: () => void;
}

interface BriefingData {
  newCount: number;
  urgentCount: number;
  meetingCount: number;
  followUpCount: number;
  priorityEmails: CachedEmail[];
  greeting: string;
}

export const DailyBriefing: React.FC<DailyBriefingProps> = ({
  onEmailClick,
  onViewAll,
}) => {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Load briefing data
  useEffect(() => {
    loadBriefing();
  }, []);

  const loadBriefing = async () => {
    setLoading(true);
    try {
      // Get all inbox emails
      const emails = await emailSyncService.getEmailsByFolder('inbox');

      // Get emails from last 24 hours
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentEmails = emails.filter(e => new Date(e.received_at) > yesterday);

      // Count urgent emails (high priority score or urgent sentiment)
      const urgentEmails = emails.filter(e =>
        (e.ai_priority_score && e.ai_priority_score >= 70) ||
        e.ai_sentiment === 'urgent'
      );

      // Count meeting requests (detected by AI)
      const meetingEmails = emails.filter(e =>
        e.ai_entities?.meetingRequests ||
        e.subject?.toLowerCase().includes('meeting') ||
        e.subject?.toLowerCase().includes('calendar') ||
        e.subject?.toLowerCase().includes('invite')
      );

      // Get emails needing follow-up (sent without response)
      const followUpCount = 0; // TODO: Implement follow-up detection

      // Get top priority emails (up to 3)
      const priorityEmails = emails
        .filter(e => !e.is_read)
        .sort((a, b) => (b.ai_priority_score || 50) - (a.ai_priority_score || 50))
        .slice(0, 3);

      setBriefing({
        newCount: recentEmails.length,
        urgentCount: urgentEmails.length,
        meetingCount: meetingEmails.length,
        followUpCount,
        priorityEmails,
        greeting: getGreeting(),
      });
    } catch (error) {
      console.error('Error loading briefing:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-rose-500/10 via-orange-500/10 to-amber-500/10 dark:from-rose-500/5 dark:via-orange-500/5 dark:to-amber-500/5 border border-rose-200/50 dark:border-rose-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-circle-notch fa-spin text-rose-500"></i>
          <span className="text-stone-600 dark:text-zinc-400">Loading your daily briefing...</span>
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  if (collapsed) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        className="bg-gradient-to-r from-rose-500/10 to-orange-500/10 dark:from-rose-500/5 dark:to-orange-500/5 border border-rose-200/50 dark:border-rose-500/20 rounded-xl px-4 py-3 cursor-pointer hover:from-rose-500/15 hover:to-orange-500/15 dark:hover:from-rose-500/10 dark:hover:to-orange-500/10 transition"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
              <i className="fa-solid fa-envelope-open-text text-white text-sm"></i>
            </div>
            <span className="font-medium text-stone-700 dark:text-zinc-300">Daily Briefing</span>
            <span className="text-sm text-stone-500 dark:text-zinc-500">
              {briefing.newCount} new · {briefing.urgentCount} urgent
            </span>
          </div>
          <i className="fa-solid fa-chevron-down text-stone-400 dark:text-zinc-500"></i>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-rose-500/10 via-orange-500/10 to-amber-500/10 dark:from-rose-500/5 dark:via-orange-500/5 dark:to-amber-500/5 border border-rose-200/50 dark:border-rose-500/20 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-rose-200/30 dark:border-rose-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <i className="fa-solid fa-envelope-open-text text-white"></i>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-white">Your Email Pulse</h2>
            <p className="text-sm text-stone-500 dark:text-zinc-500">Daily briefing</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onViewAll}
            className="text-sm text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-medium transition"
          >
            View All
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="w-8 h-8 rounded-lg hover:bg-rose-500/10 flex items-center justify-center text-stone-400 dark:text-zinc-500 hover:text-stone-600 dark:hover:text-white transition"
          >
            <i className="fa-solid fa-chevron-up text-sm"></i>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Greeting */}
        <p className="text-xl text-stone-800 dark:text-zinc-200 mb-6">
          {briefing.greeting}! <span className="text-stone-500 dark:text-zinc-500">Here's your inbox summary.</span>
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white/60 dark:bg-zinc-800/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-stone-900 dark:text-white">{briefing.newCount}</div>
            <div className="text-xs text-stone-500 dark:text-zinc-500 mt-1">new emails</div>
          </div>
          <div className="bg-white/60 dark:bg-zinc-800/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{briefing.urgentCount}</div>
            <div className="text-xs text-stone-500 dark:text-zinc-500 mt-1">urgent</div>
          </div>
          <div className="bg-white/60 dark:bg-zinc-800/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-500">{briefing.meetingCount}</div>
            <div className="text-xs text-stone-500 dark:text-zinc-500 mt-1">meetings</div>
          </div>
          <div className="bg-white/60 dark:bg-zinc-800/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-amber-500">{briefing.followUpCount}</div>
            <div className="text-xs text-stone-500 dark:text-zinc-500 mt-1">follow up</div>
          </div>
        </div>

        {/* Priority emails */}
        {briefing.priorityEmails.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <i className="fa-solid fa-bolt text-amber-500"></i>
              <span className="text-sm font-semibold text-stone-700 dark:text-zinc-300">Top Priority</span>
            </div>
            <div className="space-y-2">
              {briefing.priorityEmails.map((email, index) => (
                <button
                  key={email.id}
                  onClick={() => onEmailClick(email)}
                  className="w-full flex items-start gap-3 p-3 bg-white/70 dark:bg-zinc-800/70 hover:bg-white dark:hover:bg-zinc-800 rounded-xl text-left transition group"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-900 dark:text-white text-sm truncate">
                        "{email.subject || '(no subject)'}"
                      </span>
                    </div>
                    <div className="text-xs text-stone-500 dark:text-zinc-500 mt-0.5">
                      from {email.from_name || email.from_email}
                      {email.ai_summary && (
                        <span className="text-stone-400 dark:text-zinc-600"> — {email.ai_summary}</span>
                      )}
                    </div>
                  </div>
                  <i className="fa-solid fa-chevron-right text-stone-400 dark:text-zinc-600 group-hover:text-rose-500 transition opacity-0 group-hover:opacity-100"></i>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No priority emails message */}
        {briefing.priorityEmails.length === 0 && briefing.newCount === 0 && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
              <i className="fa-solid fa-check text-green-500 text-xl"></i>
            </div>
            <p className="text-stone-600 dark:text-zinc-400 font-medium">You're all caught up!</p>
            <p className="text-sm text-stone-500 dark:text-zinc-500">No urgent emails need your attention.</p>
          </div>
        )}

        {/* Open Priority Inbox button */}
        {briefing.urgentCount > 0 && (
          <button
            onClick={onViewAll}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white py-3 rounded-xl font-semibold transition shadow-lg shadow-rose-500/20"
          >
            <i className="fa-solid fa-inbox"></i>
            Open Priority Inbox
          </button>
        )}
      </div>
    </div>
  );
};

export default DailyBriefing;
