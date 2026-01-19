// EmailViewerNew.tsx - Email detail/thread view for cached emails
import React, { useState } from 'react';
import { CachedEmail, EmailThread, emailSyncService } from '../../services/emailSyncService';
import { emailAIService, EmailAnalysis } from '../../services/emailAIService';
import SnoozeModal from './SnoozeModal';
import RelationshipPanel from './RelationshipPanel';
import MeetingExtractor from './MeetingExtractor';
import ActionItemExtractor from './ActionItemExtractor';
import toast from 'react-hot-toast';

interface EmailViewerNewProps {
  email: CachedEmail;
  thread: EmailThread | null;
  onClose: () => void;
  onReply: (email: CachedEmail, prefilledBody?: string) => void;
  onArchive: () => void;
  onTrash: () => void;
  onToggleStar: () => void;
  onMarkUnread: () => void;
  onSnooze?: () => void;
}

export const EmailViewerNew: React.FC<EmailViewerNewProps> = ({
  email,
  thread,
  onClose,
  onReply,
  onArchive,
  onTrash,
  onToggleStar,
  onMarkUnread,
  onSnooze,
}) => {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set([email.id]));
  const [analyzing, setAnalyzing] = useState(false);
  const [localAnalysis, setLocalAnalysis] = useState<EmailAnalysis | null>(null);
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [showRelationshipPanel, setShowRelationshipPanel] = useState(false);
  const [showMeetingExtractor, setShowMeetingExtractor] = useState(true);
  const [showActionExtractor, setShowActionExtractor] = useState(true);

  // Handle snooze
  const handleSnooze = async (snoozeUntil: Date) => {
    try {
      await emailSyncService.snoozeEmail(email.id, snoozeUntil);
      toast.success(`Snoozed until ${snoozeUntil.toLocaleDateString()} at ${snoozeUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      setShowSnoozeModal(false);
      onSnooze?.();
      onClose();
    } catch (error) {
      console.error('Snooze error:', error);
      toast.error('Failed to snooze email');
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Get initials for avatar
  const getInitials = (name: string | null, emailAddr: string) => {
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return emailAddr.substring(0, 2).toUpperCase();
  };

  // Get avatar color
  const getAvatarColor = (emailAddr: string) => {
    const colors = [
      'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
      'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
      'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
      'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500'
    ];
    const hash = emailAddr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Toggle message expansion
  const toggleMessage = (msgId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  // Handle AI analysis
  const handleAnalyze = async () => {
    if (!emailAIService.isAvailable()) {
      toast.error('AI features require a Gemini API key. Add it in Settings.');
      return;
    }

    setAnalyzing(true);
    try {
      const analysis = await emailAIService.analyzeEmail(email);
      setLocalAnalysis(analysis);

      // Also save to database
      await emailAIService.analyzeAndSave(email);
      toast.success('AI analysis complete!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze email');
    } finally {
      setAnalyzing(false);
    }
  };

  // Get current analysis (from DB or local)
  const currentAnalysis = localAnalysis || (email.ai_summary ? {
    summary: email.ai_summary,
    category: email.ai_category as any || 'updates',
    priorityScore: email.ai_priority_score || 50,
    sentiment: email.ai_sentiment as any || 'neutral',
    actionItems: email.ai_action_items || [],
    entities: email.ai_entities || { dates: [], people: [], amounts: [], links: [], meetingRequests: false },
    suggestedReplies: email.ai_suggested_replies || []
  } : null);

  // Handle quick reply click
  const handleQuickReply = (replyText: string) => {
    onReply(email, replyText);
  };

  // Handle adding meeting to calendar
  const handleAddToCalendar = async (meeting: any) => {
    // For now, create a Google Calendar link
    const startDate = meeting.date || new Date();
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour default

    const calendarUrl = new URL('https://calendar.google.com/calendar/render');
    calendarUrl.searchParams.set('action', 'TEMPLATE');
    calendarUrl.searchParams.set('text', meeting.title);
    calendarUrl.searchParams.set('dates', `${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
    if (meeting.location) {
      calendarUrl.searchParams.set('location', meeting.location);
    }
    calendarUrl.searchParams.set('details', `From email: ${email.subject || '(no subject)'}\n\nAttendees: ${meeting.attendees.join(', ')}`);
    calendarUrl.searchParams.set('add', meeting.attendees.join(','));

    window.open(calendarUrl.toString(), '_blank');
    toast.success('Opening Google Calendar...');
    setShowMeetingExtractor(false);
  };

  // Handle creating tasks from action items
  const handleCreateTasks = (items: any[]) => {
    toast.success(`Created ${items.length} task${items.length > 1 ? 's' : ''}`);
    setShowActionExtractor(false);
  };

  // Messages to display (thread or single)
  const messages = thread?.messages || [email];

  return (
    <div
      className="h-full flex bg-white dark:bg-zinc-900"
      role="article"
      aria-label={`Email: ${email.subject || 'No subject'}`}
    >
      {/* Main email content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header toolbar */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b border-stone-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur"
          role="toolbar"
          aria-label="Email actions"
        >
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white transition"
          title="Back"
          aria-label="Go back to email list"
        >
          <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
        </button>

        <div className="flex-1"></div>

        <button
          onClick={onArchive}
          className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white transition"
          title="Archive"
          aria-label="Archive this email"
        >
          <i className="fa-solid fa-box-archive" aria-hidden="true"></i>
        </button>

        <button
          onClick={onTrash}
          className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-red-500 transition"
          title="Delete"
          aria-label="Delete this email"
        >
          <i className="fa-solid fa-trash" aria-hidden="true"></i>
        </button>

        <button
          onClick={onMarkUnread}
          className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white transition"
          title="Mark as unread"
          aria-label="Mark this email as unread"
        >
          <i className="fa-solid fa-envelope" aria-hidden="true"></i>
        </button>

        <button
          onClick={() => setShowSnoozeModal(true)}
          className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-amber-500 transition"
          title="Snooze"
          aria-label="Snooze this email"
        >
          <i className="fa-solid fa-clock" aria-hidden="true"></i>
        </button>

        <button
          className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white transition"
          title="Move to"
          aria-label="Move to folder"
        >
          <i className="fa-solid fa-folder" aria-hidden="true"></i>
        </button>

        <button
          className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white transition"
          title="More actions"
          aria-label="More actions"
          aria-haspopup="true"
        >
          <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
        </button>

        <div className="w-px h-5 bg-stone-200 dark:bg-zinc-700 mx-1" role="separator" aria-hidden="true"></div>

        <button
          onClick={() => setShowRelationshipPanel(!showRelationshipPanel)}
          className={`w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center transition ${
            showRelationshipPanel ? 'text-rose-500 bg-rose-500/10' : 'text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white'
          }`}
          title="Contact info"
          aria-label="Toggle contact info panel"
          aria-pressed={showRelationshipPanel}
        >
          <i className="fa-solid fa-user-circle" aria-hidden="true"></i>
        </button>
      </div>

      {/* Email content */}
      <div className="flex-1 overflow-y-auto">
        {/* Subject header */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-zinc-800">
          <div className="flex items-start gap-3">
            <h1 className="text-xl font-semibold text-stone-900 dark:text-white flex-1">
              {email.subject || '(no subject)'}
            </h1>
            <button
              onClick={onToggleStar}
              className={`transition ${email.is_starred ? 'text-yellow-500' : 'text-stone-400 dark:text-zinc-600 hover:text-yellow-500'}`}
              aria-label={email.is_starred ? 'Remove star from email' : 'Star this email'}
              aria-pressed={email.is_starred}
            >
              <i className={`fa-${email.is_starred ? 'solid' : 'regular'} fa-star text-lg`} aria-hidden="true"></i>
            </button>
          </div>

          {/* Labels */}
          {email.labels && email.labels.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              {email.labels.map((label) => (
                <span
                  key={label}
                  className="text-xs px-2 py-1 rounded bg-stone-200 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* AI Summary card */}
        {currentAnalysis ? (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-sm font-medium">
                <i className="fa-solid fa-wand-magic-sparkles"></i>
                <span>AI Summary</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Priority badge */}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  currentAnalysis.priorityScore >= 70 ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
                  currentAnalysis.priorityScore >= 40 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                  'bg-green-500/20 text-green-600 dark:text-green-400'
                }`}>
                  {currentAnalysis.priorityScore >= 70 ? 'High Priority' :
                   currentAnalysis.priorityScore >= 40 ? 'Medium' : 'Low Priority'}
                </span>
                {/* Category badge */}
                <span className="text-xs px-2 py-0.5 rounded-full bg-stone-200 dark:bg-zinc-700 text-stone-600 dark:text-zinc-300 capitalize">
                  {currentAnalysis.category}
                </span>
                {/* Sentiment badge */}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  currentAnalysis.sentiment === 'urgent' ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
                  currentAnalysis.sentiment === 'positive' ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                  currentAnalysis.sentiment === 'negative' ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400' :
                  'bg-stone-200 dark:bg-zinc-700 text-stone-600 dark:text-zinc-400'
                }`}>
                  {currentAnalysis.sentiment}
                </span>
              </div>
            </div>
            <p className="text-stone-700 dark:text-zinc-300 text-sm">{currentAnalysis.summary}</p>

            {/* Action items */}
            {currentAnalysis.actionItems && currentAnalysis.actionItems.length > 0 && (
              <div className="mt-3 pt-3 border-t border-purple-500/20">
                <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-2">Action Items</div>
                <ul className="space-y-1">
                  {currentAnalysis.actionItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-stone-600 dark:text-zinc-400">
                      <i className="fa-solid fa-circle-check text-purple-500 mt-0.5"></i>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Entities - meetings, dates, amounts */}
            {currentAnalysis.entities && (currentAnalysis.entities.meetingRequests ||
              currentAnalysis.entities.dates?.length > 0 ||
              currentAnalysis.entities.amounts?.length > 0) && (
              <div className="mt-3 pt-3 border-t border-purple-500/20 flex flex-wrap gap-3">
                {currentAnalysis.entities.meetingRequests && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                    <i className="fa-solid fa-calendar-check"></i>
                    <span>Meeting request detected</span>
                  </div>
                )}
                {currentAnalysis.entities.dates?.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400">
                    <i className="fa-regular fa-calendar"></i>
                    <span>{d.text}</span>
                  </div>
                ))}
                {currentAnalysis.entities.amounts?.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <i className="fa-solid fa-dollar-sign"></i>
                    <span>{a.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Suggested replies */}
            {currentAnalysis.suggestedReplies && currentAnalysis.suggestedReplies.length > 0 && (
              <div className="mt-3 pt-3 border-t border-purple-500/20">
                <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-2">Quick Replies</div>
                <div className="flex flex-wrap gap-2">
                  {currentAnalysis.suggestedReplies.map((reply, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickReply(reply)}
                      className="text-xs px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 hover:bg-purple-500/30 transition"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-stone-100 dark:bg-zinc-800/50 border border-stone-200 dark:border-zinc-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-stone-500 dark:text-zinc-400 text-sm">
                <i className="fa-solid fa-wand-magic-sparkles"></i>
                <span>AI can summarize this email, extract action items, and suggest replies</span>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white rounded-lg text-sm font-medium transition"
              >
                {analyzing ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-sparkles"></i>
                    Analyze with AI
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Meeting Extractor */}
        {showMeetingExtractor && (
          <div className="mx-6 mt-4">
            <MeetingExtractor
              email={email}
              onAddToCalendar={handleAddToCalendar}
              onDismiss={() => setShowMeetingExtractor(false)}
            />
          </div>
        )}

        {/* Action Item Extractor */}
        {showActionExtractor && (
          <div className="mx-6 mt-4">
            <ActionItemExtractor
              email={email}
              onCreateTasks={handleCreateTasks}
              onDismiss={() => setShowActionExtractor(false)}
            />
          </div>
        )}

        {/* Messages */}
        <div className="px-6 py-4 space-y-4">
          {messages.map((msg, idx) => {
            const isExpanded = expandedMessages.has(msg.id);

            return (
              <div key={msg.id} className="border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                {/* Message header */}
                <div
                  className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-stone-50 dark:hover:bg-zinc-800/30 transition ${isExpanded ? 'border-b border-stone-200 dark:border-zinc-800' : ''}`}
                  onClick={() => toggleMessage(msg.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleMessage(msg.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} message from ${msg.from_name || msg.from_email}`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${getAvatarColor(msg.from_email)}`}>
                    {getInitials(msg.from_name, msg.from_email)}
                  </div>

                  {/* Sender info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-900 dark:text-white">
                        {msg.from_name || msg.from_email}
                      </span>
                      {!isExpanded && (
                        <span className="text-sm text-stone-500 dark:text-zinc-500 truncate">
                          — {msg.snippet || msg.body_text?.substring(0, 60)}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-stone-500 dark:text-zinc-500">
                      to {msg.to_emails?.map(t => t.name || t.email).join(', ') || 'me'}
                    </div>
                  </div>

                  {/* Time */}
                  <div className="text-sm text-stone-500 dark:text-zinc-500 flex-shrink-0">
                    {formatDate(msg.received_at)}
                  </div>

                  {/* Expand icon */}
                  <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-stone-500 dark:text-zinc-500 text-sm`}></i>
                </div>

                {/* Message body */}
                {isExpanded && (
                  <div className="p-4">
                    {/* Body content */}
                    <div className="prose prose-stone dark:prose-invert prose-sm max-w-none">
                      <div className="whitespace-pre-wrap text-stone-700 dark:text-zinc-300">
                        {msg.body_text || msg.snippet}
                      </div>
                    </div>

                    {/* Attachments */}
                    {msg.has_attachments && msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-stone-200 dark:border-zinc-800">
                        <div className="text-sm text-stone-500 dark:text-zinc-500 mb-2">
                          {msg.attachments.length} Attachment{msg.attachments.length > 1 ? 's' : ''}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.attachments.map((att: any, attIdx: number) => (
                            <div
                              key={attIdx}
                              className="flex items-center gap-2 px-3 py-2 bg-stone-100 dark:bg-zinc-800 rounded-lg text-sm"
                            >
                              <i className="fa-solid fa-file text-stone-500 dark:text-zinc-500"></i>
                              <span className="text-stone-900 dark:text-white">{att.filename || 'Attachment'}</span>
                              <span className="text-stone-500 dark:text-zinc-500">{att.size || ''}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Message actions */}
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-stone-200 dark:border-zinc-800" role="group" aria-label="Message actions">
                      <button
                        onClick={() => onReply(msg)}
                        className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 rounded-lg text-sm text-stone-900 dark:text-white transition"
                        aria-label={`Reply to ${msg.from_name || msg.from_email}`}
                      >
                        <i className="fa-solid fa-reply" aria-hidden="true"></i>
                        Reply
                      </button>
                      <button
                        onClick={() => onReply(msg)}
                        className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 rounded-lg text-sm text-stone-900 dark:text-white transition"
                        aria-label="Reply to all recipients"
                      >
                        <i className="fa-solid fa-reply-all" aria-hidden="true"></i>
                        Reply All
                      </button>
                      <button
                        className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 rounded-lg text-sm text-stone-900 dark:text-white transition"
                        aria-label="Forward this message"
                      >
                        <i className="fa-solid fa-share" aria-hidden="true"></i>
                        Forward
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

        {/* Quick reply bar */}
        <div className="px-6 py-4 border-t border-stone-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur">
          <div
            onClick={() => onReply(email)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onReply(email);
              }
            }}
            className="flex items-center gap-3 px-4 py-3 bg-stone-100 dark:bg-zinc-800/50 rounded-xl cursor-pointer hover:bg-stone-200 dark:hover:bg-zinc-800 transition"
            role="button"
            tabIndex={0}
            aria-label="Click to reply to this email"
          >
            <i className="fa-solid fa-reply text-stone-500 dark:text-zinc-500" aria-hidden="true"></i>
            <span className="text-stone-500 dark:text-zinc-400">Click to reply...</span>
          </div>
        </div>

        {/* Snooze Modal */}
        {showSnoozeModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="snooze-modal-title"
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowSnoozeModal(false)}
              aria-hidden="true"
            />
            <div className="relative">
              <SnoozeModal
                onSnooze={handleSnooze}
                onClose={() => setShowSnoozeModal(false)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Relationship Panel */}
      {showRelationshipPanel && (
        <RelationshipPanel
          email={email}
          onClose={() => setShowRelationshipPanel(false)}
        />
      )}
    </div>
  );
};

export default EmailViewerNew;
