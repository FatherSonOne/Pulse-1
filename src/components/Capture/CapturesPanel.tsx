import React, { useCallback, useEffect, useState } from 'react';
import { useWorkspaceData } from '../../contexts/WorkspaceContext';
import {
  captureService,
  type CaptureNote,
  type CaptureSourceSection,
} from '../../services/captureService';

interface CapturesPanelProps {
  /**
   * Section identifier used to scope which captures appear here.
   * Pass 'war_room' inside the War Room shell, 'summit' inside Summit, etc.
   * Pass `undefined` to show all workspace captures (rare).
   */
  sourceSection?: CaptureSourceSection;
  /**
   * Per-entity scope (a specific war-room id, summit session id, thread id).
   * When set, only captures whose `source_id` matches are returned.
   */
  sourceId?: string;
  /** Optional title override; defaults to "NOTES". */
  title?: string;
  /** Cap on rows rendered. Defaults to 20. */
  limit?: number;
  /** Hide the "+ Capture" trigger when consumers want a read-only feed. */
  readOnly?: boolean;
}

/**
 * Drop-in captures feed for any section. Reads `pulse_notes` filtered by
 * source. The trigger button opens the global Capture modal — captures
 * created from here inherit the section's source_section / source_id by
 * default (because the modal reads current AppView), so a War Room note
 * lands tagged to the War Room.
 *
 * Wiring example (Summit):
 *   <CapturesPanel sourceSection="summit" sourceId={sessionId} />
 */
const CapturesPanel: React.FC<CapturesPanelProps> = ({
  sourceSection,
  sourceId,
  title = 'NOTES',
  limit = 20,
  readOnly = false,
}) => {
  const { currentWorkspace } = useWorkspaceData();
  const [rows, setRows] = useState<CaptureNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentWorkspace?.id) return;

    let result: CaptureNote[];
    if (sourceSection && sourceId) {
      result = await captureService.listBySource(currentWorkspace.id, sourceSection, sourceId);
    } else {
      result = await captureService.listRecent(currentWorkspace.id, limit);
    }
    setRows(result.slice(0, limit));
    setLoading(false);
  }, [currentWorkspace?.id, sourceSection, sourceId, limit]);

  useEffect(() => {
    void load();
    const handleSaved = () => { void load(); };
    window.addEventListener('pulse:capture-saved', handleSaved);
    return () => window.removeEventListener('pulse:capture-saved', handleSaved);
  }, [load]);

  if (loading) return null;

  return (
    <section aria-labelledby="captures-panel-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 id="captures-panel-heading" className="pulse-label text-zinc-500 dark:text-zinc-400">
          {title} · {rows.length}
        </h3>
        {!readOnly && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('pulse:capture-open', {
              detail: sourceSection ? { sourceSection, sourceId } : undefined,
            }))}
            className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded inline-flex items-center gap-1"
          >
            + CAPTURE
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 font-mono text-[10px]">⌘J</kbd>
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 px-2 py-1.5">
          {readOnly ? 'No notes here yet.' : 'No notes here yet. Press ⌘J to capture.'}
        </p>
      ) : (
        <ul className="space-y-px">
          {rows.map(n => {
            const date = new Date(n.created_at);
            const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
            const timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <li key={n.id}>
                <div className="flex items-baseline gap-2.5 px-3 py-2 rounded hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-150">
                  <span className="pulse-label text-zinc-400 dark:text-zinc-500 shrink-0 min-w-[46px]">
                    {dateLabel}
                  </span>
                  {n.kind && (
                    <span className="pulse-label text-rose-600 dark:text-rose-400 shrink-0">
                      {n.kind.toUpperCase()}
                    </span>
                  )}
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 flex-1 min-w-0 leading-relaxed">
                    {n.content}
                  </p>
                  <span className="pulse-label text-zinc-400 dark:text-zinc-500 shrink-0">
                    {timeLabel}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default CapturesPanel;
