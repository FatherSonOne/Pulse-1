// TriageView — focal-card queue mode.
// Phase 3 builds the shell: top bar (queue counter + progress + Dismiss
// pill), stage area with mini-stack peek + TriageCard, action toast,
// keyboard legend, "Back to cockpit" link, and the Done state.
//
// Source for the queue in Phase 3 is the mock dataset (per handoff §6
// step 5); Phase 4 will derive it from emailStore.
import React, { useCallback, useMemo } from 'react';
import { Layers, Clock, X } from 'lucide-react';
import { useEmailUIStore, type TriageActedLast } from '../../../store/emailUIStore';
import { MOCK_EMAILS, TRIAGE_QUEUE_IDS } from './data/mockEmails';
import type { EmailRow } from './data/emailRow';
import { clamp, Keycap } from './primitives';
import { TriageCard, type TriageAction } from './TriageCard';
import { TriageActionToast } from './TriageActionToast';
import { TriageDone } from './TriageDone';

interface TriageViewProps {
  onDismiss?: () => void;
  compact?: boolean;
  headerTitle?: string;
  /** Optional override for the live queue. Defaults to mock data in Phase 3. */
  queue?: EmailRow[];
}

const SECONDS_PER_EMAIL = 18;

export const TriageView: React.FC<TriageViewProps> = ({
  onDismiss,
  compact = false,
  headerTitle = 'One at a time.',
  queue: queueOverride,
}) => {
  const triageState = useEmailUIStore((s) => s.triageState);
  const setTriageState = useEmailUIStore((s) => s.setTriageState);
  const resetTriageState = useEmailUIStore((s) => s.resetTriageState);

  const queue = useMemo<EmailRow[]>(() => {
    if (queueOverride) return queueOverride;
    return TRIAGE_QUEUE_IDS
      .map((id) => MOCK_EMAILS.find((e) => e.id === id))
      .filter((e): e is EmailRow => Boolean(e));
  }, [queueOverride]);

  const idx = triageState.idx;
  const actedLast = triageState.actedLast;
  const cur = queue[idx];
  const remaining = Math.max(0, queue.length - idx);
  const progress = queue.length === 0 ? 100 : (idx / queue.length) * 100;
  const isDone = idx >= queue.length;

  const advance = useCallback(
    (label: TriageAction) => {
      const current = queue[idx];
      if (!current) return;
      const acted: TriageActedLast = {
        label,
        sender: current.from,
        idx,
        emailId: current.id,
      };
      setTriageState((prev) => ({
        idx: clamp(prev.idx + 1, 0, queue.length),
        actedLast: acted,
      }));
    },
    [queue, idx, setTriageState],
  );

  const undo = useCallback(() => {
    setTriageState((prev) => ({
      idx: clamp(prev.idx - 1, 0, queue.length),
      actedLast: null,
    }));
  }, [queue.length, setTriageState]);

  const handleReset = useCallback(() => resetTriageState(), [resetTriageState]);

  return (
    <div className={`h-full w-full overflow-hidden flex flex-col fade-up`}>
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
              {isDone ? 'All clear.' : headerTitle}
            </div>
          </div>
        </div>

        <div className="flex-1 mx-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono-pulse tracking-wide-mono pulse-ink-3-color flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {idx}/{queue.length} REVIEWED · ~{Math.max(0, remaining * SECONDS_PER_EMAIL)}s LEFT
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
        ) : cur ? (
          <div className="relative w-full max-w-[840px] h-full">
            {queue[idx + 1] && (
              <div
                className="triage-stack-card"
                style={{ top: 14, height: '100%', transform: 'scale(0.97)', opacity: 0.55 }}
              />
            )}
            {queue[idx + 2] && (
              <div
                className="triage-stack-card"
                style={{ top: 26, height: '100%', transform: 'scale(0.94)', opacity: 0.25 }}
              />
            )}
            <TriageCard email={cur} onAction={advance} compact={compact} />
          </div>
        ) : (
          <div className="text-center pulse-ink-3-color text-sm">No emails to triage.</div>
        )}
      </div>

      {/* Keyboard legend */}
      {!compact && !isDone && (
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
