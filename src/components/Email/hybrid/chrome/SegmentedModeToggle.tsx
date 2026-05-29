// SegmentedModeToggle — [Cockpit | Triage · N | Inbox] pill + ⌘E hint.
// All three tabs render in every email view (inbox + non-inbox folders) so
// the header chrome is stable — clicking any tab snaps currentFolder back
// to 'inbox' and switches the mode. The triageDisabled prop only controls
// the ⌘E hint (and mobile collapse), not the visibility of the Triage /
// Inbox buttons themselves.
// Phase 12.8: adds the third Inbox option — a plain chronological list of
// the inbox folder, no AI curation. ⌘E continues to toggle only between
// Cockpit ↔ Triage; Inbox is click-only on purpose (no destructive keypress
// can land users on an unexpected view).
import React from 'react';
import { Newspaper, Layers, Check, Inbox } from 'lucide-react';
import { useEmailStore } from '../../../../store/emailStore';
import { useEmailUIStore } from '../../../../store/emailUIStore';
import { Keycap } from '../primitives';

interface SegmentedModeToggleProps {
  triageRemaining: number;
  /** When true, hides the ⌘E hint (non-inbox folders, mobile). */
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
  const currentFolder = useEmailStore((s) => s.currentFolder);
  const setCurrentFolder = useEmailStore((s) => s.setCurrentFolder);

  // Cockpit / Triage / Inbox are all inbox-scoped views. Clicking any tab
  // while inside a non-inbox folder (Starred, Sent, etc.) must first snap
  // currentFolder back to 'inbox' or the mode change has no visible effect
  // (FolderListView keeps rendering).
  const ensureInbox = () => {
    if (currentFolder !== 'inbox') setCurrentFolder('inbox');
  };
  const goCockpit = () => { ensureInbox(); setMode('cockpit'); };
  const goTriage = () => { ensureInbox(); setMode('triage'); };
  const goInbox = () => { ensureInbox(); setMode('inbox'); };

  const isInbox = currentFolder === 'inbox';
  const hasItems = triageRemaining > 0;
  const switchLabel = isMac ? '⌘E' : 'Ctrl+E';

  // Active state only reads from `mode` while we're actually on the inbox;
  // when a non-inbox folder is selected, no tab is highlighted (the folder
  // dropdown is the active indicator instead).
  return (
    <>
      <div className="seg-toggle" role="tablist" aria-label="Email view mode">
        <button
          type="button"
          data-active={isInbox && mode === 'cockpit'}
          aria-pressed={isInbox && mode === 'cockpit'}
          aria-label="Cockpit view"
          role="tab"
          onClick={goCockpit}
        >
          <Newspaper className="w-3.5 h-3.5" />
          <span>Cockpit</span>
        </button>
        <button
          type="button"
          data-active={isInbox && mode === 'triage'}
          data-mobile-hide="true"
          aria-pressed={isInbox && mode === 'triage'}
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
        <button
          type="button"
          data-active={isInbox && mode === 'inbox'}
          aria-pressed={isInbox && mode === 'inbox'}
          aria-label="Inbox list view"
          role="tab"
          onClick={goInbox}
          title="Plain chronological list of the inbox, no AI curation"
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>Inbox</span>
        </button>
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
