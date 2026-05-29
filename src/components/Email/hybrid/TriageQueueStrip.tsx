// TriageQueueStrip — horizontal strip of avatars across the top of the
// Triage stage. Phase 12.6. Each chip represents one queued email; current
// item gets a rose ring, cleared items fade out, future items render flat.
// Click any chip to jump to that idx without firing an action.
import React from 'react';
import { useEmailStore } from '../../../store/emailStore';
import { Avatar } from './primitives';
import { cachedEmailToRow } from './data/emailRow';

interface TriageQueueStripProps {
  queueIds: string[];
  currentIdx: number;
  onJump: (idx: number) => void;
}

export const TriageQueueStrip: React.FC<TriageQueueStripProps> = ({
  queueIds,
  currentIdx,
  onJump,
}) => {
  const emails = useEmailStore((s) => s.emails);
  if (queueIds.length === 0) return null;

  const emailById = new Map(emails.map((e) => [e.id, e]));

  return (
    <div
      className="triage-queue-strip flex items-center gap-2 overflow-x-auto py-2 px-1"
      role="tablist"
      aria-label="Triage queue navigator"
    >
      {queueIds.map((id, idx) => {
        const email = emailById.get(id);
        // Even if the email was removed from the store, render a placeholder
        // chip so the queue counter stays consistent — clicking still works.
        const row = email ? cachedEmailToRow(email) : null;
        const isCurrent = idx === currentIdx;
        const isCleared = idx < currentIdx;
        const isUnreachable = !email;

        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isCurrent}
            aria-label={
              row
                ? `Triage item ${idx + 1} of ${queueIds.length}: ${row.from} — ${row.subject}`
                : `Triage item ${idx + 1} of ${queueIds.length} (no longer in inbox)`
            }
            onClick={() => onJump(idx)}
            disabled={isUnreachable}
            className={`relative shrink-0 transition ${
              isUnreachable ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
            } ${isCleared ? 'opacity-40' : ''}`}
            title={
              row
                ? `${row.from} · ${row.subject}`
                : 'Email no longer in inbox'
            }
          >
            <span
              className="inline-flex items-center justify-center rounded-full"
              style={
                isCurrent
                  ? { boxShadow: '0 0 0 2px var(--pulse-rose)' }
                  : undefined
              }
            >
              <Avatar name={row?.from || '?'} size={28} />
            </span>
            {isCurrent && (
              <span
                aria-hidden="true"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full pulse-rose-bg-color"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default TriageQueueStrip;
