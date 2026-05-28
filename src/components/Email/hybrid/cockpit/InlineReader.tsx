// InlineReader — expanded reader inside a SignalRow.
// Header (timestamp + thread count + email) → prose body → optional
// "Claude drafted reply" panel → action bar (Reply / Archive / Snooze / Task).
import React from 'react';
import { Clock, Send, Reply, Archive, MoonStar, CheckSquare } from 'lucide-react';
import type { MockEmail } from '../data/mockEmails';
import { AiChip, Keycap } from '../primitives';

interface InlineReaderProps {
  email: MockEmail;
}

export const InlineReader: React.FC<InlineReaderProps> = ({ email }) => {
  const paragraphs = email.body.split('\n\n');

  return (
    <div className="reader-expand px-5 py-4">
      <div className="flex items-center gap-2 mb-3 text-[11px] font-mono-pulse pulse-ink-3-color tracking-wide-mono">
        <Clock className="w-3 h-3" />
        <span>{email.whenLong}</span>
        {email.threadCount > 1 && (
          <>
            <span>·</span>
            <span>{email.threadCount} IN THREAD</span>
          </>
        )}
        <span>·</span>
        <span className="lowercase tracking-normal">{email.email}</span>
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
        <button type="button" className="px-3 py-1.5 rounded-md border pulse-border-color text-[12px] pulse-ink-color flex items-center gap-1.5">
          <Reply className="w-3 h-3" />Reply
        </button>
        <button type="button" className="px-3 py-1.5 rounded-md border pulse-border-color text-[12px] pulse-ink-2-color flex items-center gap-1.5">
          <Archive className="w-3 h-3" />Archive
        </button>
        <button type="button" className="px-3 py-1.5 rounded-md border pulse-border-color text-[12px] pulse-ink-2-color flex items-center gap-1.5">
          <MoonStar className="w-3 h-3" />Snooze
        </button>
        <button type="button" className="px-3 py-1.5 rounded-md border pulse-border-color text-[12px] pulse-ink-2-color flex items-center gap-1.5">
          <CheckSquare className="w-3 h-3" />→ Task
        </button>
      </div>
    </div>
  );
};

export default InlineReader;
