// InlineReader — expanded reader inside a SignalRow (or hosted inside the
// EmailReaderPanel for Lane/Folder/Search rows). Renders the full email
// content plus AI-extracted blocks (Phase 12.7):
//   - Quick-reply chips from ai_suggested_replies
//   - MeetingExtractor — opens Google Calendar in a new tab on confirm
//   - ActionItemExtractor — wired in Phase 11b (2026-05-29) to
//     createTasksFromEmailItems, which writes into extracted_tasks
//     with email metadata so the tasks surface in DecisionTaskHub.
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import DOMPurify from 'isomorphic-dompurify';
import { Clock, Send, Reply, Archive, MoonStar, CheckSquare, Maximize2 } from 'lucide-react';
import { GeminiSummaryCard } from './GeminiSummaryCard';
import { emailSyncService } from '../../../../services/emailSyncService';
import { useEmailStore } from '../../../../store/emailStore';
import { useEmailUIStore } from '../../../../store/emailUIStore';
import { useEmailComposeStore } from '../../../../store/emailComposeStore';
import type { EmailRow } from '../data/emailRow';
import { createTaskFromEmail, createTasksFromEmailItems } from '../data/createTaskFromEmail';
import { AiChip, Keycap } from '../primitives';
import MeetingExtractor from '../../MeetingExtractor';
import ActionItemExtractor from '../../ActionItemExtractor';

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
  // Extractor visibility — reset per email so dismissing for one doesn't
  // suppress the cards on the next one rendered through the same component.
  const [showMeeting, setShowMeeting] = useState<boolean>(true);
  const [showActions, setShowActions] = useState<boolean>(true);

  useEffect(() => {
    setShowMeeting(true);
    setShowActions(true);
  }, [email.id]);

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

  // Phase 12.11 + 12.13 — body rendering:
  //   1. Prefer email._raw.body_html when populated (most senders ship one
  //      alongside body_text). Sanitized with DOMPurify so embedded scripts
  //      / styles / inline event handlers can't execute.
  //   2. Some HTML-only senders (booking confirmations, marketing platforms)
  //      ship body_text that's literally raw HTML source — Gmail's text
  //      fallback just dumps the markup. Detect by sniffing for a leading
  //      `<` and a closing tag, then route through DOMPurify too. Without
  //      this guard the user sees raw `<center style="...">` source instead
  //      of the rendered email.
  //   3. Plain-text fallback for true plain-text emails — preserved
  //      whitespace + newlines via `white-space: pre-wrap`.
  const rawHtml = email._raw?.body_html?.trim();
  const rawText = email.body || email._raw?.snippet || '';
  const looksLikeHtml = (s: string) => {
    const trimmed = s.trim();
    if (!trimmed.startsWith('<')) return false;
    return /<[a-z][^>]*>/i.test(trimmed) && /<\/[a-z]+>|\/>/i.test(trimmed);
  };
  const htmlSource = rawHtml || (looksLikeHtml(rawText) ? rawText : '');
  const sanitizedHtml = useMemo(() => {
    if (!htmlSource) return '';
    return DOMPurify.sanitize(htmlSource, {
      FORBID_TAGS: ['script', 'style', 'form', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus'],
    });
  }, [htmlSource]);
  const fallbackText = rawText;

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
  const handleAddToCalendar = (meeting: ExtractedMeetingShape) => {
    openGoogleCalendar(meeting, email.subject);
    toast.success('Opening Google Calendar…');
    setShowMeeting(false);
  };

  const handleCreateTasks = (items: unknown[]) => {
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
    void createTasksFromEmailItems(email, mapped).then((created) => {
      if (created > 0) setShowActions(false);
    });
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

      {/* Phase 12.12 — Gemini Summary card unifies summary + status chips
          + action items list + quick replies in one block at the top of
          the reader. Replaces the loose Quick Replies row + duplicates the
          summary line that used to live in SignalRow's header. */}
      <GeminiSummaryCard email={email} />

      {/* Meeting + action items extractors — interactive widgets, distinct
          from the read-only Gemini Summary card above. Only render when
          the email has a _raw CachedEmail (mock rows don't, and the
          extractors call AI services internally that expect a real email). */}
      {showMeeting && email._raw && (
        <div className="mb-3">
          <MeetingExtractor
            email={email._raw}
            onAddToCalendar={handleAddToCalendar}
            onDismiss={() => setShowMeeting(false)}
          />
        </div>
      )}

      {showActions && email._raw && (
        <div className="mb-3">
          <ActionItemExtractor
            email={email._raw}
            onCreateTasks={handleCreateTasks}
            onDismiss={() => setShowActions(false)}
          />
        </div>
      )}

      {/* Email body — Phase 12.11 + 12.13: HTML-aware with DOMPurify
          sanitization; plain-text fallback; empty-state placeholder. */}
      {sanitizedHtml ? (
        <div
          className="email-body-html max-w-[760px]"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      ) : fallbackText.trim() ? (
        <div className="email-body-text max-w-[760px]">{fallbackText}</div>
      ) : (
        <div className="text-[12.5px] pulse-ink-3-color italic py-3">
          This email has no body content beyond the subject and AI summary above.
        </div>
      )}

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
