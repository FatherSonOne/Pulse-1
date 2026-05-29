// SegmentedModeToggle — [Cockpit | Triage · N | Inbox] pill + ⌘E hint.
// Phase 6: collapses to a single "Cockpit" label when Triage isn't meaningful
// (i.e. user is viewing a non-inbox folder).
// Phase 12.8: adds the third Inbox option — a plain chronological list of
// the inbox folder, no AI curation. ⌘E continues to toggle only between
// Cockpit ↔ Triage; Inbox is click-only on purpose (no destructive keypress
// can land users on an unexpected view).
import React from 'react';
import { Newspaper, Layers, Check, Inbox } from 'lucide-react';
import { useEmailUIStore } from '../../../../store/emailUIStore';
import { Keycap } from '../primitives';

interface SegmentedModeToggleProps {
  triageRemaining: number;
  /** When true, hides the Triage + Inbox halves + ⌘E hint (non-inbox folders, mobile). */
  triageDisabled?: boolean;
}

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPad|iPhone|iPod/.test(navigator.platform);

export const SegmentedModeToggle: React.FC<SegmentedModeToggleProps> = ({
  triageRemaining,
  triageDisabled = false,
}) => {
  const mode = useEmailUIStore((s) => s.emailHybridMode);
  const setMode = useEmailUIStore((s) => s.setEmailHybridMode);

  const goCockpit = () => setMode('cockpit');
  const goTriage = () => setMode('triage');
  const goInbox = () => setMode('inbox');

  const hasItems = triageRemaining > 0;
  const switchLabel = isMac ? '⌘E' : 'Ctrl+E';

  // When triage is disabled (non-inbox folder), the seg-toggle collapses to a
  // single Cockpit label — the user is browsing a folder via the dropdown,
  // not the Cockpit/Triage/Inbox views. Click "Cockpit" treated as the
  // currently-active label.
  return (
    <>
      <div className="seg-toggle" role="tablist" aria-label="Email view mode">
        <button
          type="button"
          data-active={triageDisabled || mode === 'cockpit'}
          aria-pressed={triageDisabled || mode === 'cockpit'}
          aria-label="Cockpit view"
          role="tab"
          onClick={goCockpit}
        >
          <Newspaper className="w-3.5 h-3.5" />
          <span>Cockpit</span>
        </button>
        {!triageDisabled && (
          <button
            type="button"
            data-active={mode === 'triage'}
            data-mobile-hide="true"
            aria-pressed={mode === 'triage'}
            aria-label={`Triage view${hasItems ? `, ${triageRemaining} to clear` : ', cleared'}`}
            role="tab"
            onClick={goTriage}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Triage</span>
            {hasItems ? (
              <span className="seg-count has-items">{triageRemaining}</span>
            ) : (
              <span className="seg-count cleared" title="Triage queue cleared">
                <Check className="w-2.5 h-2.5" />
              </span>
            )}
          </button>
        )}
        {!triageDisabled && (
          <button
            type="button"
            data-active={mode === 'inbox'}
            aria-pressed={mode === 'inbox'}
            aria-label="Inbox list view"
            role="tab"
            onClick={goInbox}
            title="Plain chronological list of the inbox, no AI curation"
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Inbox</span>
          </button>
        )}
      </div>

      {!triageDisabled && (
        <span className="toggle-hint" title="Switch view">
          <Keycap>{switchLabel}</Keycap>
          <span>switch</span>
        </span>
      )}
    </>
  );
};

export default SegmentedModeToggle;
