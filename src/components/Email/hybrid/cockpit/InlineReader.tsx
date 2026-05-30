// InlineReader — expanded reader inside a SignalRow (or hosted inside the
// EmailReaderPanel for Lane/Folder/Search rows). Renders the full email
// content plus AI-extracted blocks (Phase 12.7):
//   - Quick-reply chips from ai_suggested_replies
//   - MeetingExtractor — opens Google Calendar in a new tab on confirm
//   - ActionItemExtractor — wired in Phase 11b (2026-05-29) to
//     createTasksFromEmailItems, which writes into extracted_tasks
//     with email metadata so the tasks surface in DecisionTaskHub.
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, Send, Reply, Archive, MoonStar, CheckSquare, Maximize2 } from 'lucide-react';
import { EmailAiBlock } from './EmailAiBlock';
import { emailSyncService } from '../../../../services/emailSyncService';
import { useEmailStore } from '../../../../store/emailStore';
import { useEmailUIStore } from '../../../../store/emailUIStore';
import { useEmailComposeStore } from '../../../../store/emailComposeStore';
import type { EmailRow } from '../data/emailRow';
import { createTaskFromEmail, createTasksFromEmailItems } from '../data/createTaskFromEmail';
import { AiChip, Keycap } from '../primitives';
import { EmailBody } from '../EmailBody';

interface InlineReaderProps {
  email: EmailRow;
}

interface ExtractedMeetingShape {
  title?: string;
  date?: Date;
  location?: string;
  attendees?: string[];
}

function openGoogleCalendar(meeting: ExtractedMeetingShape, subjectFallback: string) {
  const startDate = meeting.date ? new Date(meeting.date) : new Date();
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour default
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', meeting.title || subjectFallback);
  url.searchParams.set('dates', `${fmt(startDate)}/${fmt(endDate)}`);
  if (meeting.location) url.searchParams.set('location', meeting.location);
  const attendees = (meeting.attendees || []).filter(Boolean);
  if (attendees.length) {
    url.searchParams.set('add', attendees.join(','));
    url.searchParams.set('details', `From email: ${subjectFallback}\n\nAttendees: ${attendees.join(', ')}`);
  } else {
    url.searchParams.set('details', `From email: ${subjectFallback}`);
  }
  window.open(url.toString(), '_blank');
}

export const InlineReader: React.FC<InlineReaderProps> = ({ email }) => {
  const handleArchive = useEmailStore((s) => s.handleArchive);
  const openReply = useEmailComposeStore((s) => s.openReply);

  const [threadCount, setThreadCount] = useState<number>(email.threadCount);
  // Per-subsection visibility (showMeeting / showActions) was lifted into
  // <EmailAiBlock /> in round 7 so the composite AI surface owns its own
  // section-dismissal state. InlineReader no longer needs to track it.

  // Lazy-fetch the full thread when the reader expands, if this looks like
  // a multi-message thread. Updates the displayed count once known.
  useEffect(() => {
    if (!email.threadId) return;
    let cancelled = false;
    (async () => {
      try {
        const thread = await emailSyncService.getThread(email.threadId!);
        if (cancelled || !thread) return;
        const count = thread.message_count || thread.messages?.length || 1;
        setThreadCount(count);
      } catch (err) {
        console.warn('[InlineReader] thread fetch failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [email.threadId]);

  const handleArchiveClick = async () => {
    if (!email._raw) {
      toast('Mock row — archive is a no-op here.');
      return;
    }
    await handleArchive(email._raw);
  };

  const handleReplyClick = () => {
    if (!email._raw) {
      toast('Mock row — reply is a no-op here.');
      return;
    }
    openReply(email._raw);
  };

  const handleSnoozeClick = () => {
    if (!email._raw) {
      toast('Mock row — snooze is a no-op here.');
      return;
    }
    useEmailUIStore.getState().setSnoozeTargetEmailId(email._raw.id);
  };

  const handleTaskClick = () => {
    void createTaskFromEmail(email);
  };

  // Phase 12.7 — quick replies from ai_suggested_replies. Clicking one opens
  // the composer prefilled with that text so the user can review + send.
  const quickReplies = email.aiActions
    .filter((a) => a.kind === 'reply')
    .map((a) => a.label)
    .filter((label) => label && label.length > 0)
    .slice(0, 3);

  const handleQuickReply = (text: string) => {
    if (!email._raw) {
      toast('Mock row — quick reply is a no-op here.');
      return;
    }
    openReply(email._raw, text);
  };

  // Calendar + Tasks extractor callbacks (Phase 12.7).
  // Subsection-dismiss-on-success is owned by EmailAiBlock (round 7) —
  // these handlers run the side effects (open calendar, create tasks)
  // and return a Promise<boolean> so EmailAiBlock can auto-dismiss the
  // subsection when the action lands.
  const handleAddToCalendar = (meeting: ExtractedMeetingShape) => {
    openGoogleCalendar(meeting, email.subject);
    toast.success('Opening Google Calendar…');
  };

  const handleCreateTasks = async (items: unknown[]): Promise<number> => {
    // ActionItemExtractor ships items shaped as { text, priority,
    // dueDate: Date | null, assignee: string | null, ... }. Map onto
    // the helper's ExtractedTaskItem shape (title + ISO deadline);
    // drop assignee for now — the extractor returns a free-text name,
    // not a user UUID, so resolving it to assignee_id needs its own
    // workspace-member lookup pass (post-launch follow-up).
    const mapped = (items as Array<{
      text?: string;
      priority?: 'high' | 'medium' | 'low';
      dueDate?: Date | null;
    }>).map((it) => ({
      title: (it.text || '').trim(),
      priority: it.priority,
      deadline: it.dueDate ? it.dueDate.toISOString() : undefined,
    }));
    return await createTasksFromEmailItems(email, mapped);
  };

  // Phase 12.10 — "Open full page" affordance. The InlineReader is rendered
  // both inline (Signal expansion) and inside the EmailReaderPanel; this
  // button is only useful in the inline context, so it's hidden when the
  // reader is already inside the panel (detect by walking up the DOM tree
  // is fragile — instead we hide via CSS scope: .reader-panel hides it).
  const handleOpenFullPage = () => {
    if (!email._raw) {
      toast('Mock row — full-page reader is a no-op here.');
      return;
    }
    useEmailUIStore.getState().openReaderPanel(email._raw.id, { maximized: true });
  };

  return (
    <div className="reader-expand px-5 py-4">
      <div className="flex items-center gap-2 mb-3 text-[11px] font-mono-pulse pulse-ink-3-color tracking-wide-mono">
        <Clock className="w-3 h-3" />
        <span>{email.whenLong}</span>
        {threadCount > 1 && (
          <>
            <span>·</span>
            <span>{threadCount} IN THREAD</span>
          </>
        )}
        <span>·</span>
        <span className="lowercase tracking-normal">{email.fromEmail}</span>
        <button
          type="button"
          onClick={handleOpenFullPage}
          className="open-full-page-btn ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wide-mono pulse-ink-3-color hover:pulse-rose-color hover:pulse-rose-bg-soft-color transition"
          title="Open full page"
          aria-label="Open this email in the full-page reader"
        >
          <Maximize2 className="w-3 h-3" />
          FULL PAGE
        </button>
      </div>

      {/* Round 7 — replaces the round-6 stack of three separate
          rose-bordered cards (GeminiSummaryCard + MeetingExtractor +
          ActionItemExtractor) with one composite EmailAiBlock that
          hosts Summary, Meeting, and Tasks as sibling subsections
          inside a single rose-bordered shell. Resolves the three
          stacked-rose-washes issue and the action-items duplication
          (Gemini's read-only ai_action_items vs ActionItemExtractor's
          interactive regex-extracted list) — ownership of action items
          is now unambiguously the Tasks subsection. Subsection dismissal
          state is owned by EmailAiBlock so a per-subsection Skip
          dismisses only that subsection, not the whole composite. */}
      <EmailAiBlock
        email={email}
        onAddToCalendar={handleAddToCalendar}
        onCreateTasks={handleCreateTasks}
      />

      {/* Email body — extracted to <EmailBody /> shared primitive so the
          DOMPurify sanitization, HTML-sniff fallback, and empty-state
          render are not duplicated across InlineReader + TriageCard. */}
      <EmailBody email={email} />

      {email.draft && (
        <div className="mt-3 p-3 rounded-lg pulse-rose-bg-soft-color border pulse-rose-border">
          <div className="flex items-center gap-2 mb-1.5">
            <AiChip variant="muted">Claude drafted reply</AiChip>
            <span className="text-[11px] pulse-ink-3-color">edit before sending</span>
          </div>
          <p className="text-[13px] pulse-ink-2-color leading-relaxed italic mb-2">"{email.draft}"</p>
          <div className="flex items-center gap-2">
            <button type="button" className="px-3 py-1.5 rounded-md pulse-rose-bg-color text-white text-[12px] font-medium flex items-center gap-1.5">
              <Send className="w-3 h-3" />Send <Keycap>⌘↵</Keycap>
            </button>
            <button type="button" className="px-3 py-1.5 rounded-md border pulse-border-color text-[12px] pulse-ink-2-color">
              Edit
            </button>
            <button type="button" className="px-3 py-1.5 rounded-md border pulse-border-color text-[12px] pulse-ink-3-color">
              Dismiss draft
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={handleReplyClick} className="px-3 py-1.5 rounded-md border pulse-border-color text-[12px] pulse-ink-color flex items-center gap-1.5">
          <Reply className="w-3 h-3" />Reply
        </button>
        <button type="button" onClick={handleArchiveClick} className="px-3 py-1.5 rounded-md border pulse-border-color text-[12px] pulse-ink-2-color flex items-center gap-1.5">
          <Archive className="w-3 h-3" />Archive
        </button>
        <button type="button" onClick={handleSnoozeClick} className="px-3 py-1.5 rounded-md border pulse-border-color text-[12px] pulse-ink-2-color flex items-center gap-1.5">
          <MoonStar className="w-3 h-3" />Snooze
        </button>
        <button type="button" onClick={handleTaskClick} className="px-3 py-1.5 rounded-md border pulse-border-color text-[12px] pulse-ink-2-color flex items-center gap-1.5">
          <CheckSquare className="w-3 h-3" />→ Task
        </button>
      </div>
    </div>
  );
};

export default InlineReader;
