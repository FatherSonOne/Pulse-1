// InlineReader — expanded reader inside a SignalRow (or hosted inside the
// EmailReaderPanel for Lane/Folder/Search rows). Renders the full email
// content plus AI-extracted blocks (Phase 12.7):
//   - Quick-reply chips from ai_suggested_replies
//   - MeetingExtractor — opens Google Calendar in a new tab on confirm
//   - ActionItemExtractor — toast stub for now; wires to DecisionTaskHub
//     in the same v1.1 sweep as the → Task button.
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, Send, Reply, Archive, MoonStar, CheckSquare, Sparkles, Maximize2 } from 'lucide-react';
import { emailSyncService } from '../../../../services/emailSyncService';
import { useEmailStore } from '../../../../store/emailStore';
import { useEmailUIStore } from '../../../../store/emailUIStore';
import { useEmailComposeStore } from '../../../../store/emailComposeStore';
import type { EmailRow } from '../data/emailRow';
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

  const paragraphs = email.body.split('\n\n');

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
    // TODO(post-hybrid-soak): wire to decisionTaskHub after the Email
    // Hybrid Phase 11 flag flip + legacy cleanup. Same stub used in
    // TriageView. See memory: project_pulse_decisions_tasks_revisit.md
    toast('Push to Decisions & Tasks coming soon.');
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
    // TODO(post-hybrid-soak): wire to decisionTaskHub. Same v1.1 sweep as
    // the → Task button. See memory: project_pulse_decisions_tasks_revisit.md
    toast.success(`Created ${items.length} task${items.length === 1 ? '' : 's'} (stub).`);
    setShowActions(false);
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

      {/* Quick reply chips (Phase 12.7) — Claude-suggested one-tap replies */}
      {quickReplies.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono-pulse tracking-wide-mono pulse-coral-fg-color">
            <Sparkles className="w-3 h-3" />
            QUICK REPLIES
          </span>
          {quickReplies.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleQuickReply(label)}
              className="px-2.5 py-1 rounded-full text-[11.5px] pulse-coral-bg-08-color pulse-coral-fg-color hover:pulse-rose-bg-soft-color border pulse-border-color transition"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Meeting + action items — only render when the email has a _raw
          CachedEmail (mock rows don't, and the extractors call AI services
          internally that expect a real email). */}
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

      <div className="prose-mock max-w-[640px]">
        {paragraphs.map((p, i) => {
          const lines = p.split('\n');
          return (
            <p key={i}>
              {lines.map((line, j) => (
                <React.Fragment key={j}>
                  {line}
                  {j < lines.length - 1 && <br />}
                </React.Fragment>
              ))}
            </p>
          );
        })}
      </div>

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
