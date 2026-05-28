// TriageView — focal-card queue mode.
// Phase 4 wires actions to live emailStore + emailSyncService and reads the
// queue via useTriageQueue (frozen at session start by EmailHybridClient).
import React, { useCallback } from 'react';
import toast from 'react-hot-toast';
import { Layers, Clock, X } from 'lucide-react';
import { useEmailStore } from '../../../store/emailStore';
import { useEmailUIStore, type TriageActedLast } from '../../../store/emailUIStore';
import { useEmailComposeStore } from '../../../store/emailComposeStore';
import { emailSyncService } from '../../../services/emailSyncService';
import { clamp, Keycap } from './primitives';
import { TriageCard, type TriageAction } from './TriageCard';
import { TriageActionToast } from './TriageActionToast';
import { TriageDone } from './TriageDone';
import { useTriageQueue } from './data/useTriageQueue';

interface TriageViewProps {
  onDismiss?: () => void;
  compact?: boolean;
  headerTitle?: string;
}

const SECONDS_PER_EMAIL = 18;

function defaultSnoozeUntil(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0); // 9 AM tomorrow — same as legacy default
  return d;
}

export const TriageView: React.FC<TriageViewProps> = ({
  onDismiss,
  compact = false,
  headerTitle = 'One at a time.',
}) => {
  const data = useTriageQueue();
  const triageState = useEmailUIStore((s) => s.triageState);
  const setTriageState = useEmailUIStore((s) => s.setTriageState);
  const resetTriageState = useEmailUIStore((s) => s.resetTriageState);

  const handleArchive = useEmailStore((s) => s.handleArchive);
  const removeEmailFromList = useEmailStore((s) => s.removeEmailFromList);
  const openReply = useEmailComposeStore((s) => s.openReply);

  const performSideEffect = useCallback(
    (label: TriageAction, row: NonNullable<typeof data.currentRow>) => {
      const raw = row._raw;
      if (!raw) return; // mock rows have no side effect
      switch (label) {
        case 'Archive':
          void handleArchive(raw);
          return;
        case 'Snooze': {
          const until = defaultSnoozeUntil();
          emailSyncService
            .snoozeEmail(raw.id, until)
            .then(() => removeEmailFromList(raw.id))
            .catch(() => toast.error('Snooze failed — try again from the email.'));
          toast.success(`Snoozed ${row.from} until tomorrow 9 AM.`);
          return;
        }
        case '→ Task':
          // TODO(v1.1): wire to decisionTaskHub when a clean service hook exists.
          toast('Push to Decisions & Tasks lands in v1.1.');
          return;
        case 'Reply':
          openReply(raw);
          return; // Reply does not advance — handled in advance() below
        case 'Send draft':
          // AI-generated drafts are v1.1; in v1 this branch is unreachable in
          // production (no draft on live emails). Mock data triggers a toast.
          toast('AI-drafted send arrives with v1.1.');
          return;
      }
    },
    [handleArchive, openReply, removeEmailFromList],
  );

  const advance = useCallback(
    (label: TriageAction) => {
      const cur = data.currentRow;
      if (!cur) return;

      performSideEffect(label, cur);
      if (label === 'Reply') return; // explicit per handoff §6 step 3

      const acted: TriageActedLast = {
        label,
        sender: cur.from,
        idx: triageState.idx,
        emailId: cur.id,
      };
      setTriageState({
        idx: clamp(triageState.idx + 1, 0, data.queueIds.length),
        actedLast: acted,
      });
    },
    [data, performSideEffect, setTriageState, triageState.idx],
  );

  const undo = useCallback(() => {
    setTriageState({
      idx: clamp(triageState.idx - 1, 0, data.queueIds.length),
      actedLast: null,
    });
    toast('Rewound queue position. The Gmail-side action remains.', { icon: '↶' });
  }, [data.queueIds.length, setTriageState, triageState.idx]);

  const handleReset = useCallback(() => resetTriageState(), [resetTriageState]);

  const { idx, currentRow, remaining, progress, isDone, queueIds } = data;
  const total = queueIds.length;
  const actedLast = triageState.actedLast;
  const hasQueue = total > 0;

  return (
    <div className="h-full w-full overflow-hidden flex flex-col fade-up">
      {/* Top bar — counter + dismiss */}
      <div
        className={`flex items-center gap-3 ${compact ? 'px-5 pt-4 pb-3' : 'px-8 pt-6 pb-4'} border-b pulse-border-color shrink-0`}
      >
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg pulse-rose-bg-color text-white flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-rose-color">
              TRIAGE QUEUE
            </div>
            <div className="text-[13px] font-semibold pulse-ink-color">
              {isDone ? 'All clear.' : !hasQueue ? 'Nothing queued.' : headerTitle}
            </div>
          </div>
        </div>

        <div className="flex-1 mx-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono-pulse tracking-wide-mono pulse-ink-3-color flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {idx}/{total} REVIEWED · ~{Math.max(0, remaining * SECONDS_PER_EMAIL)}s LEFT
            </span>
            <span className="text-[10px] font-mono-pulse tracking-wide-mono pulse-ink-3-color">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="progress-rail">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="dismiss-pill"
              title="Exit triage (ESC)"
              aria-label="Exit triage and return to cockpit"
            >
              <span>Dismiss</span>
              <span className="x">
                <X className="w-3 h-3" />
              </span>
              <Keycap>ESC</Keycap>
            </button>
          )}
        </div>
      </div>

      {/* Stage */}
      <div
        className={`flex-1 overflow-hidden ${compact ? 'px-5 py-5' : 'px-8 py-6'} flex items-center justify-center relative`}
      >
        {actedLast && !isDone && <TriageActionToast acted={actedLast} onUndo={undo} />}

        {isDone ? (
          <TriageDone onReset={handleReset} onDismiss={onDismiss} />
        ) : !hasQueue ? (
          <div className="text-center max-w-[420px]">
            <div
              className="cockpit-headline text-2xl pulse-ink-color mb-2"
              style={{ fontFamily: 'var(--pulse-font-serif)' }}
            >
              Nothing to triage right now.
            </div>
            <div className="text-[13px] pulse-ink-2-color leading-relaxed">
              Your inbox has no unread, high-priority emails. Pulse re-builds the queue when new
              urgent mail arrives, or you can{' '}
              <button
                type="button"
                onClick={onDismiss}
                className="pulse-rose-color underline-offset-2 hover:underline"
              >
                head back to the Cockpit
              </button>
              .
            </div>
          </div>
        ) : currentRow ? (
          <div className="relative w-full max-w-[840px] h-full">
            {queueIds[idx + 1] && (
              <div
                className="triage-stack-card"
                style={{ top: 14, height: '100%', transform: 'scale(0.97)', opacity: 0.55 }}
              />
            )}
            {queueIds[idx + 2] && (
              <div
                className="triage-stack-card"
                style={{ top: 26, height: '100%', transform: 'scale(0.94)', opacity: 0.25 }}
              />
            )}
            <TriageCard email={currentRow} onAction={advance} compact={compact} />
          </div>
        ) : (
          <div className="text-center pulse-ink-3-color text-sm">
            That email was moved before you got to it. Skipping…
            <button
              type="button"
              onClick={() =>
                setTriageState({
                  idx: clamp(triageState.idx + 1, 0, total),
                  actedLast: null,
                })
              }
              className="ml-2 underline pulse-rose-color"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Keyboard legend */}
      {!compact && !isDone && hasQueue && (
        <div className="border-t pulse-border-color px-8 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-[10px] font-mono-pulse tracking-wide-mono pulse-ink-3-color">
              KEYBOARD
            </span>
            <span className="text-[12px] pulse-ink-2-color flex items-center gap-1.5">
              <Keycap>E</Keycap> Archive
            </span>
            <span className="text-[12px] pulse-ink-2-color flex items-center gap-1.5">
              <Keycap>R</Keycap> Reply
            </span>
            <span className="text-[12px] pulse-ink-2-color flex items-center gap-1.5">
              <Keycap>H</Keycap> Snooze
            </span>
            <span className="text-[12px] pulse-ink-2-color flex items-center gap-1.5">
              <Keycap>T</Keycap> → Task
            </span>
            <span className="text-[12px] pulse-ink-2-color flex items-center gap-1.5">
              <Keycap>⌘</Keycap>
              <Keycap>↵</Keycap> Accept AI
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] font-mono-pulse tracking-wide-mono pulse-ink-3-color hover:pulse-rose-color flex items-center gap-1.5"
          >
            BACK TO COCKPIT →
          </button>
        </div>
      )}
    </div>
  );
};

export default TriageView;
