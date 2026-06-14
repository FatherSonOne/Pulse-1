// TriageView — focal-card queue mode.
// Phase 4 wires actions to live emailStore + emailSyncService and reads the
// queue via useTriageQueue (frozen at session start by EmailHybridClient).
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Layers, Clock, X } from 'lucide-react';
import { useEmailStore } from '../../../store/emailStore';
import { useEmailUIStore, type TriageActedLast } from '../../../store/emailUIStore';
import { useEmailComposeStore } from '../../../store/emailComposeStore';
import { emailSyncService } from '../../../services/emailSyncService';
import { clamp, Keycap } from './primitives';
import { createTaskFromEmail } from './data/createTaskFromEmail';
import { TriageCard, type TriageAction } from './TriageCard';
import { TriageActionToast } from './TriageActionToast';
import { TriageDone } from './TriageDone';
import { TriageQueueStrip } from './TriageQueueStrip';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTriageQueue } from './data/useTriageQueue';

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

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
  const mode = useEmailUIStore((s) => s.emailHybridMode);
  const triageState = useEmailUIStore((s) => s.triageState);
  const setTriageState = useEmailUIStore((s) => s.setTriageState);
  const resetTriageState = useEmailUIStore((s) => s.resetTriageState);

  const handleArchive = useEmailStore((s) => s.handleArchive);
  const removeEmailFromList = useEmailStore((s) => s.removeEmailFromList);
  const openReply = useEmailComposeStore((s) => s.openReply);
  const showComposer = useEmailComposeStore((s) => s.showComposer);
  const showKeyboardShortcuts = useEmailUIStore((s) => s.showKeyboardShortcuts);
  const showEmailSettings = useEmailUIStore((s) => s.showEmailSettings);
  const showReauthModal = useEmailUIStore((s) => s.showReauthModal);

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
          // Wired in Phase 11b (2026-05-29). The double-toast race noted
          // 2026-05-28 is handled inside the helper — it dedupes by
          // email id, so a T-press during a queue advance can't create
          // two tasks even if the keydown fires on the next email.
          void createTaskFromEmail(row);
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

  // Phase 12.6 — pure navigation: jump / prev / next don't fire any side
  // effect, they only move the queue position. No toast. Clears actedLast
  // so the previous action banner doesn't linger on a new card.
  const jumpTo = useCallback(
    (targetIdx: number) => {
      setTriageState({
        idx: clamp(targetIdx, 0, data.queueIds.length),
        actedLast: null,
      });
    },
    [data.queueIds.length, setTriageState],
  );
  const navigatePrev = useCallback(() => {
    if (triageState.idx <= 0) return;
    jumpTo(triageState.idx - 1);
  }, [triageState.idx, jumpTo]);
  const navigateNext = useCallback(() => {
    if (triageState.idx >= data.queueIds.length - 1) return;
    jumpTo(triageState.idx + 1);
  }, [triageState.idx, data.queueIds.length, jumpTo]);

  const handleReset = useCallback(() => resetTriageState(), [resetTriageState]);

  // Triage keyboard shortcuts — only fire when in Triage mode + no overlay open.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if (mode !== 'triage') return;
      if (isTextInputTarget(e.target)) return;
      if (showComposer || showKeyboardShortcuts || showEmailSettings || showReauthModal) return;
      if (!data.currentRow || data.isDone) return;

      const hasCtrl = e.ctrlKey || e.metaKey;
      const key = e.key;
      const lower = key.toLowerCase();

      // ⌘↵ — accept AI draft (only when one is available)
      if (hasCtrl && key === 'Enter') {
        if (data.currentRow.draft) {
          e.preventDefault();
          advance('Send draft');
        }
        return;
      }

      // Phase 12.6 navigation — pure idx moves, no action firing.
      if (key === 'ArrowLeft') {
        e.preventDefault();
        navigatePrev();
        return;
      }
      if (key === 'ArrowRight') {
        e.preventDefault();
        navigateNext();
        return;
      }

      if (hasCtrl) return;

      switch (lower) {
        case 'e': e.preventDefault(); advance('Archive');  return;
        case 'r': e.preventDefault(); advance('Reply');    return;
        case 'h': e.preventDefault(); advance('Snooze');   return;
        case 't': e.preventDefault(); advance('→ Task');   return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    mode, data, advance, navigatePrev, navigateNext,
    showComposer, showKeyboardShortcuts, showEmailSettings, showReauthModal,
  ]);

  const { idx, currentRow, remaining, progress, isDone, queueIds } = data;
  const total = queueIds.length;
  const actedLast = triageState.actedLast;
  const hasQueue = total > 0;

  // Keep the confirmation toast mounted for one exit cycle so it fades out the
  // way it faded in (Emil: an element that animates in but pops out reads as
  // broken). actedLast clears on undo / navigation.
  const [shownActed, setShownActed] = useState(actedLast);
  const [toastLeaving, setToastLeaving] = useState(false);
  useEffect(() => {
    if (actedLast) {
      setShownActed(actedLast);
      setToastLeaving(false);
      return;
    }
    if (shownActed) {
      setToastLeaving(true);
      const t = window.setTimeout(() => {
        setShownActed(null);
        setToastLeaving(false);
      }, 160);
      return () => window.clearTimeout(t);
    }
  }, [actedLast, shownActed]);

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
            <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress / 100))})` }} />
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

      {/* Queue strip — Phase 12.6. Click any chip to jump; current chip
          has a rose ring; cleared chips fade; missing-from-store chips
          render disabled. Skipped when no queue exists yet. */}
      {hasQueue && !isDone && (
        <div className={`${compact ? 'px-5' : 'px-8'} shrink-0 border-b pulse-border-color`}>
          <TriageQueueStrip queueIds={queueIds} currentIdx={idx} onJump={jumpTo} />
        </div>
      )}

      {/* Stage */}
      <div
        className={`flex-1 overflow-hidden ${compact ? 'px-5 py-5' : 'px-8 py-6'} flex items-center justify-center relative`}
      >
        {/* Phase 12.6 — prev/next buttons stick to the stage edges so the
            user can browse without touching the keyboard. Disabled at the
            ends of the queue. */}
        {hasQueue && !isDone && (
          <>
            <button
              type="button"
              onClick={navigatePrev}
              disabled={idx === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full pulse-surface border pulse-border-color flex items-center justify-center pulse-ink-2-color hover:pulse-rose-color hover:pulse-rose-border disabled:opacity-30 disabled:hover:pulse-ink-2-color disabled:cursor-not-allowed transition"
              aria-label="Previous email"
              title="Previous (←)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={navigateNext}
              disabled={idx >= queueIds.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full pulse-surface border pulse-border-color flex items-center justify-center pulse-ink-2-color hover:pulse-rose-color hover:pulse-rose-border disabled:opacity-30 disabled:hover:pulse-ink-2-color disabled:cursor-not-allowed transition"
              aria-label="Next email"
              title="Next (→)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
        {shownActed && !isDone && (
          <TriageActionToast acted={shownActed} onUndo={undo} leaving={toastLeaving} />
        )}

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
            <span className="text-[12px] pulse-ink-2-color flex items-center gap-1.5">
              <Keycap>←</Keycap>
              <Keycap>→</Keycap> Navigate
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
