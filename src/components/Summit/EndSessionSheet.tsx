/**
 * EndSessionSheet — opt-in destinations modal that runs before disconnect.
 *
 * Surfaces the artifacts captured during the session and lets the user pick
 * where each goes: Markdown download, War Room archive, push to Decisions,
 * push to Tasks, email draft. All five are independently selectable. Hitting
 * "End session" runs the selected destinations and reports per-target status
 * back via the `progress` prop so the user sees which writes resolved while
 * others are still pending.
 *
 * If no artifacts and no notes, the sheet still opens but only offers a plain
 * confirm — keeps the UX consistent and avoids accidental end-clicks.
 */

import React, { useMemo, useState } from 'react';
import {
  X,
  FileDown,
  BookOpen,
  CheckCircle2,
  ListTodo,
  Loader2,
  Mail,
  Mountain,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { SessionArtifacts, StoredVoiceNote } from './voiceSessionStore';

export type EndSessionTargetKey =
  | 'markdown'
  | 'warRoom'
  | 'pushDecisions'
  | 'pushTasks'
  | 'email';

export type EndSessionTargetStatus = 'idle' | 'running' | 'success' | 'failed';

export type EndSessionProgress = Partial<
  Record<EndSessionTargetKey, EndSessionTargetStatus>
>;

export interface EndSessionDestinations {
  markdown: boolean;
  warRoom: boolean;
  pushDecisions: boolean;
  pushTasks: boolean;
  email: boolean;
  warRoomTitle: string;
}

interface EndSessionSheetProps {
  open: boolean;
  durationSec: number;
  artifacts: SessionArtifacts;
  notes: StoredVoiceNote[];
  /** Async confirm — runs the selected destinations, then resolves. */
  onConfirm: (destinations: EndSessionDestinations) => Promise<void>;
  /** Skip exports and end immediately. */
  onSkipAndEnd: () => void;
  /** Cancel — keep the session running. */
  onCancel: () => void;
  /** Per-target status, owned by the caller, surfaced as inline pills. */
  progress?: EndSessionProgress;
}

const formatDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const TargetStatusPill: React.FC<{ status?: EndSessionTargetStatus }> = ({ status }) => {
  if (!status || status === 'idle') return null;
  if (status === 'running') {
    return (
      <span className="pvc-end-target-status pvc-end-target-status--running" aria-live="polite">
        <Loader2 size={11} className="animate-spin" />
        Sending
      </span>
    );
  }
  if (status === 'success') {
    return (
      <span className="pvc-end-target-status pvc-end-target-status--ok" aria-live="polite">
        <Check size={11} />
        Done
      </span>
    );
  }
  return (
    <span className="pvc-end-target-status pvc-end-target-status--err" aria-live="polite">
      <AlertCircle size={11} />
      Failed
    </span>
  );
};

const EndSessionSheet: React.FC<EndSessionSheetProps> = ({
  open,
  durationSec,
  artifacts,
  notes,
  onConfirm,
  onSkipAndEnd,
  onCancel,
  progress,
}) => {
  const totalArtifacts = useMemo(
    () =>
      artifacts.decisions.length +
      artifacts.tasks.length +
      artifacts.references.length +
      artifacts.questions.length,
    [artifacts],
  );

  // Tool-sourced artifacts are already persisted (the AI called
  // create_decision / create_task during the session). Pushing them again
  // would duplicate rows, so push counts only see auto/manual items.
  const pushableDecisions = useMemo(
    () => artifacts.decisions.filter((a) => a.source !== 'tool').length,
    [artifacts.decisions],
  );
  const pushableTasks = useMemo(
    () => artifacts.tasks.filter((a) => a.source !== 'tool').length,
    [artifacts.tasks],
  );

  const hasContent = totalArtifacts > 0 || notes.length > 0;

  const [destinations, setDestinations] = useState<EndSessionDestinations>({
    markdown: false,
    warRoom: false,
    pushDecisions: pushableDecisions > 0,
    pushTasks: pushableTasks > 0,
    email: false,
    warRoomTitle: '',
  });

  const [running, setRunning] = useState(false);

  if (!open) return null;

  const toggle = (key: keyof EndSessionDestinations) => {
    setDestinations((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const anyDestinationSelected =
    destinations.markdown ||
    destinations.warRoom ||
    destinations.pushDecisions ||
    destinations.pushTasks ||
    destinations.email;

  const handleConfirm = async () => {
    setRunning(true);
    try {
      await onConfirm(destinations);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="pvc-end-sheet-backdrop" onClick={!running ? onCancel : undefined}>
      <div
        className="pvc-end-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="End session"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pvc-end-sheet-head">
          <div className="pvc-end-sheet-title">
            <Mountain size={16} aria-hidden="true" />
            <span>End session</span>
          </div>
          <button
            type="button"
            className="pvc-icon-btn"
            onClick={onCancel}
            disabled={running}
            aria-label="Cancel"
          >
            <X size={16} />
          </button>
        </header>

        <div className="pvc-end-sheet-summary">
          <div className="pvc-end-sheet-stat">
            <span className="pvc-end-sheet-stat-num">{formatDuration(durationSec)}</span>
            <span className="pvc-end-sheet-stat-label">DURATION</span>
          </div>
          <div className="pvc-end-sheet-stat">
            <span className="pvc-end-sheet-stat-num">{totalArtifacts}</span>
            <span className="pvc-end-sheet-stat-label">
              {totalArtifacts === 1 ? 'ARTIFACT' : 'ARTIFACTS'}
            </span>
          </div>
          <div className="pvc-end-sheet-stat">
            <span className="pvc-end-sheet-stat-num">{notes.length}</span>
            <span className="pvc-end-sheet-stat-label">
              {notes.length === 1 ? 'NOTE' : 'NOTES'}
            </span>
          </div>
        </div>

        {hasContent ? (
          <>
            <p className="pvc-end-sheet-prompt">Send anywhere before ending?</p>

            <ul className="pvc-end-sheet-targets">
              <li>
                <label className={`pvc-end-target ${destinations.markdown ? 'pvc-end-target--on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={destinations.markdown}
                    onChange={() => toggle('markdown')}
                    disabled={running}
                  />
                  <span className="pvc-end-target-icon">
                    <FileDown size={15} />
                  </span>
                  <span className="pvc-end-target-body">
                    <span className="pvc-end-target-label">
                      Save Markdown
                      <TargetStatusPill status={progress?.markdown} />
                    </span>
                    <span className="pvc-end-target-hint">Download the full session as .md</span>
                  </span>
                </label>
              </li>

              <li>
                <label className={`pvc-end-target ${destinations.warRoom ? 'pvc-end-target--on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={destinations.warRoom}
                    onChange={() => toggle('warRoom')}
                    disabled={running}
                  />
                  <span className="pvc-end-target-icon">
                    <BookOpen size={15} />
                  </span>
                  <span className="pvc-end-target-body">
                    <span className="pvc-end-target-label">
                      Send to War Room
                      <TargetStatusPill status={progress?.warRoom} />
                    </span>
                    <span className="pvc-end-target-hint">Archive entry for deeper study</span>
                    {destinations.warRoom && (
                      <input
                        type="text"
                        className="pvc-end-target-title"
                        value={destinations.warRoomTitle}
                        placeholder="Title (optional)"
                        onChange={(e) =>
                          setDestinations((p) => ({ ...p, warRoomTitle: e.target.value }))
                        }
                        onClick={(e) => e.stopPropagation()}
                        disabled={running}
                      />
                    )}
                  </span>
                </label>
              </li>

              <li>
                <label
                  className={`pvc-end-target ${destinations.pushDecisions ? 'pvc-end-target--on' : ''} ${
                    pushableDecisions === 0 ? 'pvc-end-target--disabled' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={destinations.pushDecisions}
                    onChange={() => toggle('pushDecisions')}
                    disabled={running || pushableDecisions === 0}
                  />
                  <span className="pvc-end-target-icon">
                    <CheckCircle2 size={15} />
                  </span>
                  <span className="pvc-end-target-body">
                    <span className="pvc-end-target-label">
                      Push {pushableDecisions} decision{pushableDecisions === 1 ? '' : 's'}
                      <TargetStatusPill status={progress?.pushDecisions} />
                    </span>
                    <span className="pvc-end-target-hint">
                      Creates proposals in Decisions &amp; Tasks
                      {artifacts.decisions.length > pushableDecisions && (
                        <> · {artifacts.decisions.length - pushableDecisions} already saved by AI</>
                      )}
                    </span>
                  </span>
                </label>
              </li>

              <li>
                <label
                  className={`pvc-end-target ${destinations.pushTasks ? 'pvc-end-target--on' : ''} ${
                    pushableTasks === 0 ? 'pvc-end-target--disabled' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={destinations.pushTasks}
                    onChange={() => toggle('pushTasks')}
                    disabled={running || pushableTasks === 0}
                  />
                  <span className="pvc-end-target-icon">
                    <ListTodo size={15} />
                  </span>
                  <span className="pvc-end-target-body">
                    <span className="pvc-end-target-label">
                      Push {pushableTasks} task{pushableTasks === 1 ? '' : 's'}
                      <TargetStatusPill status={progress?.pushTasks} />
                    </span>
                    <span className="pvc-end-target-hint">
                      Adds to Decisions &amp; Tasks with priority + due date
                      {artifacts.tasks.length > pushableTasks && (
                        <> · {artifacts.tasks.length - pushableTasks} already saved by AI</>
                      )}
                    </span>
                  </span>
                </label>
              </li>

              <li>
                <label className={`pvc-end-target ${destinations.email ? 'pvc-end-target--on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={destinations.email}
                    onChange={() => toggle('email')}
                    disabled={running}
                  />
                  <span className="pvc-end-target-icon">
                    <Mail size={15} />
                  </span>
                  <span className="pvc-end-target-body">
                    <span className="pvc-end-target-label">
                      Open email draft
                      <TargetStatusPill status={progress?.email} />
                    </span>
                    <span className="pvc-end-target-hint">
                      Opens your mail client; long sessions copy to clipboard instead
                    </span>
                  </span>
                </label>
              </li>
            </ul>
          </>
        ) : (
          <p className="pvc-end-sheet-empty">
            No artifacts or notes were captured. End the session?
          </p>
        )}

        <footer className="pvc-end-sheet-foot">
          <button
            type="button"
            className="pvc-end-sheet-btn pvc-end-sheet-btn--ghost"
            onClick={onSkipAndEnd}
            disabled={running}
          >
            Just end
          </button>
          {hasContent && (
            <button
              type="button"
              className="pvc-end-sheet-btn pvc-end-sheet-btn--primary"
              onClick={handleConfirm}
              disabled={running || !anyDestinationSelected}
            >
              {running ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Sending…
                </>
              ) : (
                'Send & end'
              )}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default EndSessionSheet;
