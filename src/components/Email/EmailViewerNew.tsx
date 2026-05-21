// EmailViewerNew.tsx - Email detail/thread view for cached emails
import React, { useState, useMemo, useEffect, useRef } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { CachedEmail, EmailThread, emailSyncService } from '../../services/emailSyncService';
import { emailAIService, EmailAnalysis } from '../../services/emailAIService';
import { getGmailService } from '../../services/gmailService';
import { blockedSendersService } from '../../services/blockedSendersService';
import { supabase } from '../../services/supabase';
import SnoozeModal from './SnoozeModal';
import RelationshipPanel from './RelationshipPanel';
import MeetingExtractor from './MeetingExtractor';
import ActionItemExtractor from './ActionItemExtractor';
import toast from 'react-hot-toast';

import { Archive, ArrowLeft, Calendar, CalendarCheck, CheckCircle2, CheckSquare, Clock, DollarSign, EllipsisVertical, ExternalLink, File, Flag, Folder, Inbox, Loader2, Mail, Printer, Reply, ReplyAll, Share, ShieldAlert, Trash2, UserCircle, UserX } from 'lucide-react';

interface EmailViewerNewProps {
  email: CachedEmail;
  thread: EmailThread | null;
  onClose: () => void;
  onReply: (email: CachedEmail, prefilledBody?: string) => void;
  onReplyAll?: (email: CachedEmail) => void;
  onForward?: (email: CachedEmail) => void;
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
  onReplyAll,
  onForward,
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
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [starPopKey, setStarPopKey] = useState(0);
  const [aiFreshKey, setAiFreshKey] = useState(0);
  const [snoozingOut, setSnoozingOut] = useState(false);
  const moveBtnRef = useRef<HTMLButtonElement | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);

  const handleStarClick = () => {
    if (!email.is_starred) setStarPopKey((k) => k + 1);
    onToggleStar();
  };

  // Close popovers on outside click / Escape
  useEffect(() => {
    if (!showMoveMenu && !showMoreMenu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        moveBtnRef.current && !moveBtnRef.current.contains(t) &&
        moreBtnRef.current && !moreBtnRef.current.contains(t) &&
        !(t as HTMLElement)?.closest?.('[data-viewer-menu]')
      ) {
        setShowMoveMenu(false);
        setShowMoreMenu(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowMoveMenu(false); setShowMoreMenu(false); setConfirmingBlock(false); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showMoveMenu, showMoreMenu]);

  const isImportant = (email.labels || []).some((l) => l === 'IMPORTANT');

  // Move-to: archive / trash / spam / inbox via Gmail label modify + DB write-through
  const handleMoveTo = async (destination: 'inbox' | 'archive' | 'spam' | 'trash') => {
    setShowMoveMenu(false);
    try {
      if (destination === 'archive') { await emailSyncService.archiveEmail(email.id); toast.success('Archived'); onClose(); return; }
      if (destination === 'trash')   { await emailSyncService.trashEmail(email.id);   toast.success('Moved to Trash'); onClose(); return; }
      if (!email.gmail_id) throw new Error('Gmail ID missing');
      const gmail = getGmailService();
      if (destination === 'spam')   await gmail.modifyMessageLabels(email.gmail_id, ['SPAM'], ['INBOX']);
      if (destination === 'inbox')  await gmail.modifyMessageLabels(email.gmail_id, ['INBOX'], ['SPAM', 'TRASH']);
      toast.success(destination === 'spam' ? 'Marked as spam' : 'Moved to Inbox');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to move email');
    }
  };

  // More: toggle important, print, show original, block sender, report spam
  const handleToggleImportant = async () => {
    setShowMoreMenu(false);
    try {
      if (!email.gmail_id) throw new Error('Gmail ID missing');
      const gmail = getGmailService();
      await gmail.modifyMessageLabels(email.gmail_id, isImportant ? [] : ['IMPORTANT'], isImportant ? ['IMPORTANT'] : []);
      toast.success(isImportant ? 'Removed from Important' : 'Marked Important');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update Important');
    }
  };

  const handlePrint = () => { setShowMoreMenu(false); window.print(); };

  const handleShowOriginal = () => {
    setShowMoreMenu(false);
    if (!email.gmail_id) { toast.error('Gmail ID missing'); return; }
    window.open(`https://mail.google.com/mail/u/0/#all/${email.gmail_id}`, '_blank', 'noopener');
  };

  const handleBlockSenderConfirm = async () => {
    setConfirmingBlock(false);
    setShowMoreMenu(false);
    try {
      await blockedSendersService.blockEmail(email.from_email, { reason: 'Blocked from email viewer' });
      toast.success(`${email.from_email} blocked`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to block sender');
    }
  };

  // Handle snooze — viewer slides out 240ms before close, signaling 'filed'
  const handleSnooze = async (snoozeUntil: Date) => {
    try {
      await emailSyncService.snoozeEmail(email.id, snoozeUntil);
      toast.success(`Snoozed until ${snoozeUntil.toLocaleDateString()} at ${snoozeUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      setShowSnoozeModal(false);
      onSnooze?.();
      setSnoozingOut(true);
      setTimeout(() => onClose(), 240);
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

  // Neutral tinted avatars — match the list (coral reserved for state, not decoration)
  const getAvatarColor = (emailAddr: string) => {
    const palette = [
      'bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300',
      'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
      'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
      'bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
      'bg-violet-100 text-violet-900 dark:bg-violet-950/40 dark:text-violet-200',
      'bg-stone-100 text-stone-700 dark:bg-zinc-900 dark:text-zinc-300',
    ];
    const hash = emailAddr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return palette[hash % palette.length];
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
      setAiFreshKey((k) => k + 1); // trigger one-shot 3-cycle pulse on the provenance dot

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

  // Handle creating a single task from the current email (CRM quick action)
  const handleCreateTask = async () => {
    setCreatingTask(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('tasks').insert({
        user_id: user.id,
        title: email.subject || 'Task from email',
        origin_message_id: email.id,
        priority: 'medium',
      });

      if (error) throw error;

      toast.success('Task created!');
      setShowQuickActions(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setCreatingTask(false);
    }
  };

  // Messages to display (thread or single)
  const messages = thread?.messages || [email];

  return (
    <div
      className={`h-full flex bg-white dark:bg-zinc-900 transition-[transform,opacity] duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        snoozingOut ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      }`}
      role="article"
      aria-label={`Email: ${email.subject || 'No subject'}`}
    >
      {/* Main email content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header toolbar — grouped: back · destructive · organize · overflow · contact */}
        <div
          className="flex items-center gap-1 px-4 py-3 border-b border-stone-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur"
          role="toolbar"
          aria-label="Email actions"
        >
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white transition"
            title="Back  ·  Esc"
            aria-label="Go back to email list"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex-1" />

          {/* Destructive group */}
          <div className="flex items-center" role="group" aria-label="Destructive actions">
            <button
              onClick={onArchive}
              className="w-9 h-9 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white transition"
              title="Archive  ·  E"
              aria-label="Archive this email"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={onTrash}
              className="w-9 h-9 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-rose-500 transition"
              title="Delete  ·  #"
              aria-label="Delete this email"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="w-px h-5 bg-stone-200 dark:bg-zinc-700 mx-1.5" role="separator" aria-hidden="true" />

          {/* Organize group */}
          <div className="flex items-center" role="group" aria-label="Organize actions">
            <button
              onClick={onMarkUnread}
              className="w-9 h-9 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white transition"
              title="Mark as unread  ·  Shift U"
              aria-label="Mark this email as unread"
            >
              <Mail className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSnoozeModal(true)}
              className="w-9 h-9 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-400 hover:text-amber-500 transition"
              title="Snooze  ·  H"
              aria-label="Snooze this email"
            >
              <Clock className="w-4 h-4" />
            </button>

            {/* Move-to popover */}
            <div className="relative">
              <button
                ref={moveBtnRef}
                onClick={() => { setShowMoveMenu((v) => !v); setShowMoreMenu(false); }}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
                  showMoveMenu
                    ? 'bg-stone-100 dark:bg-zinc-800 text-stone-800 dark:text-white'
                    : 'text-stone-500 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 hover:text-stone-800 dark:hover:text-white'
                }`}
                title="Move to"
                aria-label="Move to folder"
                aria-haspopup="menu"
                aria-expanded={showMoveMenu}
              >
                <Folder className="w-4 h-4" />
              </button>
              {showMoveMenu && (
                <div
                  data-viewer-menu
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-52 z-50 rounded-xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur border border-stone-200 dark:border-white/10 shadow-[0_10px_32px_rgba(0,0,0,0.10)] dark:shadow-[0_10px_32px_rgba(0,0,0,0.50)] py-1.5"
                >
                  <div className="px-3 pb-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-stone-400 dark:text-zinc-600">Move to</div>
                  {[
                    { id: 'inbox', label: 'Inbox', icon: <Inbox className="w-4 h-4" /> },
                    { id: 'archive', label: 'Archive', icon: <Archive className="w-4 h-4" /> },
                    { id: 'spam', label: 'Spam', icon: <ShieldAlert className="w-4 h-4" /> },
                    { id: 'trash', label: 'Trash', icon: <Trash2 className="w-4 h-4" /> },
                  ].map((item) => (
                    <button
                      key={item.id}
                      role="menuitem"
                      onClick={() => handleMoveTo(item.id as 'inbox' | 'archive' | 'spam' | 'trash')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-white/[0.04] hover:text-stone-900 dark:hover:text-white transition-colors"
                    >
                      <span className="text-stone-500 dark:text-zinc-500">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="w-px h-5 bg-stone-200 dark:bg-zinc-700 mx-1.5" role="separator" aria-hidden="true" />

          {/* Overflow */}
          <div className="relative">
            <button
              ref={moreBtnRef}
              onClick={() => { setShowMoreMenu((v) => !v); setShowMoveMenu(false); setConfirmingBlock(false); }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
                showMoreMenu
                  ? 'bg-stone-100 dark:bg-zinc-800 text-stone-800 dark:text-white'
                  : 'text-stone-500 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 hover:text-stone-800 dark:hover:text-white'
              }`}
              title="More actions"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={showMoreMenu}
            >
              <EllipsisVertical className="w-4 h-4" />
            </button>
            {showMoreMenu && (
              <div
                data-viewer-menu
                role="menu"
                className="absolute right-0 top-full mt-1.5 w-56 z-50 rounded-xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur border border-stone-200 dark:border-white/10 shadow-[0_10px_32px_rgba(0,0,0,0.10)] dark:shadow-[0_10px_32px_rgba(0,0,0,0.50)] py-1.5"
              >
                <button
                  role="menuitem"
                  onClick={handleToggleImportant}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-white/[0.04] hover:text-stone-900 dark:hover:text-white transition-colors"
                >
                  <Flag className={`w-4 h-4 ${isImportant ? 'text-amber-500' : 'text-stone-500 dark:text-zinc-500'}`} />
                  <span>{isImportant ? 'Remove Important' : 'Mark Important'}</span>
                </button>
                <button
                  role="menuitem"
                  onClick={handlePrint}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-white/[0.04] hover:text-stone-900 dark:hover:text-white transition-colors"
                >
                  <Printer className="w-4 h-4 text-stone-500 dark:text-zinc-500" />
                  <span>Print</span>
                </button>
                <button
                  role="menuitem"
                  onClick={handleShowOriginal}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-white/[0.04] hover:text-stone-900 dark:hover:text-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-stone-500 dark:text-zinc-500" />
                  <span>Show original</span>
                </button>
                <div className="my-1 mx-2 h-px bg-stone-200 dark:bg-white/10" role="separator" aria-hidden="true" />
                <button
                  role="menuitem"
                  onClick={() => { setShowMoreMenu(false); handleMoveTo('spam'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-white/[0.04] hover:text-stone-900 dark:hover:text-white transition-colors"
                >
                  <ShieldAlert className="w-4 h-4 text-stone-500 dark:text-zinc-500" />
                  <span>Report spam</span>
                </button>
                {!confirmingBlock ? (
                  <button
                    role="menuitem"
                    onClick={() => setConfirmingBlock(true)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                  >
                    <UserX className="w-4 h-4" />
                    <span>Block sender</span>
                  </button>
                ) : (
                  <div className="px-3 py-2.5">
                    <div className="flex items-start gap-2 mb-2.5">
                      <UserX className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-stone-900 dark:text-white">Block {email.from_email}?</div>
                        <div className="text-xs text-stone-500 dark:text-zinc-500 mt-0.5 leading-snug">Future emails go to spam. Existing emails stay.</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleBlockSenderConfirm}
                        className="flex-1 h-8 rounded-md bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium transition-colors"
                      >
                        Block
                      </button>
                      <button
                        onClick={() => setConfirmingBlock(false)}
                        className="flex-1 h-8 rounded-md text-xs font-medium text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-white/[0.04] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-stone-200 dark:bg-zinc-700 mx-1.5" role="separator" aria-hidden="true" />

          <button
            onClick={() => setShowRelationshipPanel(!showRelationshipPanel)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
              showRelationshipPanel
                ? 'text-rose-500 bg-rose-500/10'
                : 'text-stone-500 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 hover:text-stone-800 dark:hover:text-white'
            }`}
            title="Contact info"
            aria-label="Toggle contact info panel"
            aria-pressed={showRelationshipPanel}
          >
            <UserCircle className="w-4 h-4" />
          </button>
        </div>

      {/* CRM Quick Actions */}
      <div className="border-t border-stone-100 dark:border-zinc-800 px-4 py-2">
        <button
          onClick={() => setShowQuickActions(!showQuickActions)}
          className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-zinc-300 font-medium transition-colors"
          aria-expanded={showQuickActions}
          aria-label="Toggle quick actions"
        >
          <i className={`fa-solid fa-chevron-${showQuickActions ? 'up' : 'down'} text-xs`} aria-hidden="true" />
          Quick Actions
        </button>
        {showQuickActions && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <button
              onClick={handleCreateTask}
              disabled={creatingTask}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-stone-100 dark:bg-white/[0.04] text-stone-700 dark:text-zinc-300 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 border border-transparent hover:border-rose-500/20 transition-colors disabled:opacity-50"
              aria-label="Create task from this email"
            >
              {creatingTask
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <CheckSquare className="w-3.5 h-3.5" />
              }
              Create Task
            </button>
            <button
              onClick={() => setShowRelationshipPanel(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-stone-100 dark:bg-white/[0.04] text-stone-700 dark:text-zinc-300 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 border border-transparent hover:border-rose-500/20 transition-colors"
              aria-label="View contact info for email sender"
            >
              <UserCircle className="w-3.5 h-3.5" />
              View Contact
            </button>
          </div>
        )}
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
              onClick={handleStarClick}
              className={`transition-colors ${email.is_starred ? 'text-yellow-500' : 'text-stone-400 dark:text-zinc-600 hover:text-yellow-500'}`}
              aria-label={email.is_starred ? 'Remove star from email' : 'Star this email'}
              aria-pressed={email.is_starred}
            >
              <i
                key={starPopKey}
                className={`fa-${email.is_starred ? 'solid' : 'regular'} fa-star text-lg ${starPopKey > 0 ? 'pulse-email-star-pop inline-block' : ''}`}
                aria-hidden="true"
              />
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

        {/* AI Summary — Pulse provenance pattern: coral signal, mono header, no purple, no sparkles */}
        {currentAnalysis ? (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-rose-500/[0.04] dark:bg-rose-500/[0.06] border border-rose-500/15 dark:border-rose-500/20">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span
                  key={aiFreshKey}
                  className={`w-1.5 h-1.5 rounded-full bg-rose-500 ${aiFreshKey > 0 ? 'pulse-email-ai-fresh' : ''}`}
                  aria-hidden="true"
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-rose-600 dark:text-rose-400">
                  Gemini · Summary
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  title={`Priority ${currentAnalysis.priorityScore}/100. Inferred from sender, urgency words, deadlines, and thread state.`}
                  className={`font-mono text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded cursor-help ${
                    currentAnalysis.priorityScore >= 70 ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                    currentAnalysis.priorityScore >= 40 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                    'bg-stone-200/70 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400'
                  }`}
                >
                  {currentAnalysis.priorityScore >= 70 ? 'High' :
                   currentAnalysis.priorityScore >= 40 ? 'Medium' : 'Low'}
                </span>
                <span
                  title={`Category: ${currentAnalysis.category}. Topical bucket inferred from subject and content.`}
                  className="font-mono text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 cursor-help"
                >
                  {currentAnalysis.category}
                </span>
                <span
                  title={`Sentiment: ${currentAnalysis.sentiment}. Tonal read of the message body.`}
                  className={`font-mono text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded cursor-help ${
                    currentAnalysis.sentiment === 'urgent' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                    currentAnalysis.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                    currentAnalysis.sentiment === 'negative' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' :
                    'bg-stone-200/70 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400'
                  }`}
                >
                  {currentAnalysis.sentiment}
                </span>
              </div>
            </div>
            <p className="text-stone-800 dark:text-zinc-200 text-sm leading-relaxed max-w-[70ch]">{currentAnalysis.summary}</p>

            {/* Action items */}
            {currentAnalysis.actionItems && currentAnalysis.actionItems.length > 0 && (
              <div className="mt-3 pt-3 border-t border-rose-500/15">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500 mb-2">Action Items</div>
                <ul className="space-y-1.5">
                  {currentAnalysis.actionItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-stone-700 dark:text-zinc-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-rose-500 mt-1 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Entities — meetings, dates, amounts; status colors stay in vocabulary */}
            {currentAnalysis.entities && (currentAnalysis.entities.meetingRequests ||
              currentAnalysis.entities.dates?.length > 0 ||
              currentAnalysis.entities.amounts?.length > 0) && (
              <div className="mt-3 pt-3 border-t border-rose-500/15 flex flex-wrap gap-x-4 gap-y-1.5">
                {currentAnalysis.entities.meetingRequests && (
                  <div className="flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-stone-600 dark:text-zinc-400">
                    <CalendarCheck className="w-3.5 h-3.5" />
                    <span>Meeting detected</span>
                  </div>
                )}
                {currentAnalysis.entities.dates?.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-stone-600 dark:text-zinc-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{d.text}</span>
                  </div>
                ))}
                {currentAnalysis.entities.amounts?.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-stone-600 dark:text-zinc-400">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>{a.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Suggested replies — neutral chips, rose hover */}
            {currentAnalysis.suggestedReplies && currentAnalysis.suggestedReplies.length > 0 && (
              <div className="mt-3 pt-3 border-t border-rose-500/15">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500 mb-2">Quick Replies</div>
                <div className="flex flex-wrap gap-1.5">
                  {currentAnalysis.suggestedReplies.map((reply, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickReply(reply)}
                      className="text-xs px-2.5 py-1.5 rounded-md bg-stone-100 dark:bg-white/[0.04] text-stone-700 dark:text-zinc-300 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors border border-transparent hover:border-rose-500/20"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-stone-50 dark:bg-white/[0.02] border border-stone-200 dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 text-sm text-stone-600 dark:text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500/60" aria-hidden="true" />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-500">Pulse AI</span>
                <span className="text-stone-500 dark:text-zinc-500">Summarize, extract action items, suggest replies.</span>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex items-center gap-2 h-9 px-4 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-500/50 text-white rounded-lg text-sm font-medium transition-colors shadow-[0_1px_0_rgba(244,63,94,0.2),0_4px_12px_rgba(244,63,94,0.18)]"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing
                  </>
                ) : (
                  <span>Analyze</span>
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
                  {/* Avatar — neutral tint, mono initials */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-mono text-[12px] tracking-wider font-medium flex-shrink-0 ${getAvatarColor(msg.from_email)}`}>
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
                    {/* Body content — HTML sanitized with DOMPurify to prevent XSS */}
                    <div className="prose prose-stone dark:prose-invert prose-sm max-w-none">
                      {msg.body_html ? (
                        <div
                          className="text-stone-700 dark:text-zinc-300 [&_img]:max-w-full [&_a]:text-rose-600 dark:[&_a]:text-rose-400"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(msg.body_html, {
                              FORBID_TAGS: ['script', 'style', 'form'],
                              FORBID_ATTR: ['onerror', 'onclick', 'onload'],
                            }),
                          }}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap text-stone-700 dark:text-zinc-300">
                          {msg.body_text || msg.snippet}
                        </div>
                      )}
                    </div>

                    {/* Attachments with download */}
                    {msg.has_attachments && msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-stone-200 dark:border-zinc-800">
                        <div className="text-sm text-stone-500 dark:text-zinc-500 mb-2">
                          {msg.attachments.length} Attachment{msg.attachments.length > 1 ? 's' : ''}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.attachments.map((att: any, attIdx: number) => {
                            const formatSize = (bytes: number) => {
                              if (!bytes) return '';
                              if (bytes < 1024) return `${bytes} B`;
                              if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                              return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                            };

                            const handleDownload = async () => {
                              if (!att.attachmentId || !msg.gmail_id) return;
                              try {
                                const gmail = getGmailService();
                                const base64Data = await gmail.downloadAttachment(msg.gmail_id, att.attachmentId);
                                // Convert base64url to base64, then to blob
                                const base64 = base64Data.replace(/-/g, '+').replace(/_/g, '/');
                                const binary = atob(base64);
                                const bytes = new Uint8Array(binary.length);
                                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                                const blob = new Blob([bytes], { type: att.mimeType || 'application/octet-stream' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = att.filename || 'attachment';
                                a.click();
                                URL.revokeObjectURL(url);
                              } catch (err) {
                                console.error('Download failed:', err);
                                toast.error('Failed to download attachment');
                              }
                            };

                            return (
                              <button
                                type="button"
                                key={attIdx}
                                onClick={handleDownload}
                                disabled={!att.attachmentId}
                                className="flex items-center gap-2 px-3 py-2 bg-stone-100 dark:bg-zinc-800 rounded-lg text-sm hover:bg-stone-200 dark:hover:bg-zinc-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-default"
                                title={att.attachmentId ? `Download ${att.filename || 'attachment'}` : att.filename || 'Attachment'}
                              >
                                <File className="text-stone-500 dark:text-zinc-500" />
                                <span className="text-stone-900 dark:text-white">{att.filename || 'Attachment'}</span>
                                {att.size > 0 && <span className="text-stone-500 dark:text-zinc-500">{formatSize(att.size)}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Message actions — Reply is the primary; Reply All / Forward stay ghost */}
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-stone-200 dark:border-zinc-800" role="group" aria-label="Message actions">
                      <button
                        onClick={() => onReply(msg)}
                        className="group flex items-center gap-2 h-9 px-4 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_1px_0_rgba(244,63,94,0.2),0_4px_12px_rgba(244,63,94,0.18)] hover:-translate-y-[1px] hover:shadow-[0_2px_0_rgba(244,63,94,0.25),0_8px_22px_rgba(244,63,94,0.30)] active:translate-y-0 active:shadow-[0_1px_0_rgba(244,63,94,0.2),0_2px_8px_rgba(244,63,94,0.18)]"
                        aria-label={`Reply to ${msg.from_name || msg.from_email}`}
                      >
                        <Reply className="w-4 h-4 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-6" />
                        Reply
                      </button>
                      <button
                        onClick={() => onReplyAll ? onReplyAll(msg) : onReply(msg)}
                        className="flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-white/[0.04] hover:text-stone-900 dark:hover:text-white transition-colors"
                        aria-label="Reply to all recipients"
                      >
                        <ReplyAll className="w-4 h-4" />
                        Reply All
                      </button>
                      <button
                        onClick={() => onForward ? onForward(msg) : onReply(msg)}
                        className="flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-white/[0.04] hover:text-stone-900 dark:hover:text-white transition-colors"
                        aria-label="Forward this message"
                      >
                        <Share className="w-4 h-4" />
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
            <Reply className="text-stone-500 dark:text-zinc-500" />
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
              className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm"
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
