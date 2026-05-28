// SegmentedModeToggle — [Cockpit | Triage · N] pill + ⌘E hint.
// Phase 6: collapses to a single "Cockpit" label when Triage isn't meaningful
// (i.e. user is viewing a non-inbox folder). The toggle still mounts so the
// layout doesn't shift; only the Triage button hides.
import React from 'react';
import { Newspaper, Layers, Check } from 'lucide-react';
import { useEmailUIStore } from '../../../../store/emailUIStore';
import { Keycap } from '../primitives';

interface SegmentedModeToggleProps {
  triageRemaining: number;
  /** When true, hides the Triage half + ⌘E hint (non-inbox folders, mobile). */
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

  const hasItems = triageRemaining > 0;
  const switchLabel = isMac ? '⌘E' : 'Ctrl+E';

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
