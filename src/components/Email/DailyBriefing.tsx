// DailyBriefing.tsx - Morning email summary card
import React, { useState, useEffect } from 'react';
import { emailSyncService, CachedEmail } from '../../services/emailSyncService';
import { emailAIService } from '../../services/emailAIService';
import './DailyBriefing.css';

import { Check, ChevronDown, ChevronRight, ChevronUp, Inbox, Loader2, MailOpen, Zap } from 'lucide-react';

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
  const [collapsed, setCollapsed] = useState(true);
  const [isReady, setIsReady] = useState(false);

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

      // Get emails needing follow-up: sent emails in last 14 days without a reply in the same thread
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const sentEmails = await emailSyncService.getEmailsByFolder('sent', 50, 0);
      const recentSent = sentEmails.filter(e => new Date(e.received_at) > fourteenDaysAgo);

      let followUpCount = 0;
      for (const sent of recentSent) {
        if (!sent.thread_id) continue;
        // Check if there's a newer non-sent email in the same thread (i.e. a reply)
        const hasReply = emails.some(e =>
          e.thread_id === sent.thread_id &&
          !e.is_sent &&
          new Date(e.received_at) > new Date(sent.received_at)
        );
        if (!hasReply) followUpCount++;
      }

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
      setIsReady(true);
    }
  };

  if (loading) {
    return (
      <div className="email-daily-briefing briefing-loading">
        <div className="briefing-loading-content">
          <Loader2 className="briefing-loading-spinner animate-spin" />
          <span className="briefing-loading-text">Loading your daily briefing...</span>
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  if (collapsed) {
    return (
      <div
        onClick={() => { setCollapsed(false); setIsReady(false); }}
        className={`email-daily-briefing collapsed${isReady ? ' briefing-ready' : ''}`}
      >
        <div className="briefing-header">
          <div className="briefing-header-content">
            <div className="briefing-icon-wrapper">
              <MailOpen className="briefing-icon" />
            </div>
            <div className="briefing-title-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: 9999, background: '#f43f5e', display: 'inline-block' }} aria-hidden="true" />
                <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(244, 63, 94, 0.85)', fontWeight: 500 }}>
                  Pulse AI · Briefing
                </span>
              </div>
              <h2>Daily Briefing</h2>
              <p>
                {briefing.newCount} new · {briefing.urgentCount} urgent
              </p>
            </div>
          </div>
          <ChevronDown />
        </div>
      </div>
    );
  }

  return (
    <div className="email-daily-briefing">
      {/* Header */}
      <div className="briefing-header">
        <div className="briefing-header-content">
          <div className="briefing-icon-wrapper">
            <MailOpen className="briefing-icon" />
          </div>
          <div className="briefing-title-section">
            <h2>Your Email Pulse</h2>
            <p>Daily briefing</p>
          </div>
        </div>
        <div className="briefing-header-actions">
          <button
            onClick={onViewAll}
            className="briefing-view-all-btn"
          >
            View All
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="briefing-collapse-btn"
          >
            <ChevronUp />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="briefing-content">
        {/* Greeting */}
        <p className="briefing-greeting">
          <span className="briefing-greeting-name">{briefing.greeting}!</span>{' '}
          <span className="briefing-greeting-text">Here's your inbox summary.</span>
        </p>

        {/* Stats grid */}
        <div className="briefing-stats-grid">
          <div className="briefing-stat-card stat-new">
            <div className="briefing-stat-value">{briefing.newCount}</div>
            <div className="briefing-stat-label">new emails</div>
          </div>
          <div className="briefing-stat-card stat-urgent">
            <div className="briefing-stat-value">{briefing.urgentCount}</div>
            <div className="briefing-stat-label">urgent</div>
          </div>
          <div className="briefing-stat-card stat-meetings">
            <div className="briefing-stat-value">{briefing.meetingCount}</div>
            <div className="briefing-stat-label">meetings</div>
          </div>
          <div className="briefing-stat-card stat-followup">
            <div className="briefing-stat-value">{briefing.followUpCount}</div>
            <div className="briefing-stat-label">follow up</div>
          </div>
        </div>

        {/* Priority emails */}
        {briefing.priorityEmails.length > 0 && (
          <div className="briefing-priority-section">
            <div className="briefing-section-header">
              <Zap className="briefing-section-icon" />
              <span className="briefing-section-title">Top Priority</span>
            </div>
            <div className="briefing-email-list">
              {briefing.priorityEmails.map((email, index) => (
                <button
                  key={email.id}
                  onClick={() => onEmailClick(email)}
                  className="briefing-email-item"
                >
                  <div className="briefing-email-rank">
                    {index + 1}
                  </div>
                  <div className="briefing-email-content">
                    <div className="briefing-email-subject">
                      "{email.subject || '(no subject)'}"
                    </div>
                    <div className="briefing-email-meta">
                      <span className="briefing-email-from">from {email.from_name || email.from_email}</span>
                      {email.ai_summary && (
                        <span className="briefing-email-summary"> — {email.ai_summary}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="briefing-email-arrow" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No priority emails message */}
        {briefing.priorityEmails.length === 0 && briefing.newCount === 0 && (
          <div className="briefing-empty-state">
            <div className="briefing-empty-icon">
              <Check />
            </div>
            <p className="briefing-empty-title">You're all caught up!</p>
            <p className="briefing-empty-text">No urgent emails need your attention.</p>
          </div>
        )}

        {/* Open Priority Inbox button */}
        {briefing.urgentCount > 0 && (
          <button
            onClick={onViewAll}
            className="briefing-priority-inbox-btn"
          >
            <Inbox />
            Open Priority Inbox
          </button>
        )}
      </div>
    </div>
  );
};

export default DailyBriefing;
