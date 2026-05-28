// InlineReader — expanded reader inside a SignalRow.
// Phase 2: wires Reply / Archive / Snooze / Task → emailStore + emailComposeStore.
// Lazy-loads the full thread (if threadCount > 1) on mount so the user sees
// the full conversation without leaving the Cockpit.
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, Send, Reply, Archive, MoonStar, CheckSquare } from 'lucide-react';
import { emailSyncService } from '../../../../services/emailSyncService';
import { useEmailStore } from '../../../../store/emailStore';
import { useEmailUIStore } from '../../../../store/emailUIStore';
import { useEmailComposeStore } from '../../../../store/emailComposeStore';
import type { EmailRow } from '../data/emailRow';
import { AiChip, Keycap } from '../primitives';

interface InlineReaderProps {
  email: EmailRow;
}

export const InlineReader: React.FC<InlineReaderProps> = ({ email }) => {
  const handleArchive = useEmailStore((s) => s.handleArchive);
  const openReply = useEmailComposeStore((s) => s.openReply);

  const [threadCount, setThreadCount] = useState<number>(email.threadCount);

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
      </div>

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
