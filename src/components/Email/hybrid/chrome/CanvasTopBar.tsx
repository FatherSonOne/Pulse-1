// CanvasTopBar — Phase 7: full right cluster wired to live state.
//   Left:  SegmentedModeToggle (Cockpit | Triage · N) + ⌘E hint
//          FoldersDropdown (Inbox ▾)
//   Right: GoogleAuthStatus · OfflineIndicatorCompact · Sync (RefreshCw)
//          · Settings (gear)
// Search input lands in Phase 8.
import React from 'react';
import { RefreshCw, Settings, Loader2 } from 'lucide-react';
import { useEmailStore } from '../../../../store/emailStore';
import { useEmailUIStore } from '../../../../store/emailUIStore';
import { GoogleAuthStatus } from '../../GoogleAuthStatus';
import { OfflineIndicatorCompact } from '../../OfflineIndicator';
import { SegmentedModeToggle } from './SegmentedModeToggle';
import { FoldersDropdown } from './FoldersDropdown';

interface CanvasTopBarProps {
  triageRemaining: number;
  onSync: () => void;
}

export const CanvasTopBar: React.FC<CanvasTopBarProps> = ({
  triageRemaining,
  onSync,
}) => {
  const currentFolder = useEmailStore((s) => s.currentFolder);
  const syncing = useEmailStore((s) => s.syncing);
  const isOffline = useEmailStore((s) => s.isOffline);
  const pendingActionsCount = useEmailStore((s) => s.pendingActionsCount);

  const setShowReauthModal = useEmailUIStore((s) => s.setShowReauthModal);
  const setShowEmailSettings = useEmailUIStore((s) => s.setShowEmailSettings);

  const triageDisabled = currentFolder !== 'inbox';

  return (
    <div
      className="flex items-center gap-3 px-5 py-2.5 border-b pulse-border-color shrink-0"
      style={{ background: 'var(--pulse-canvas)' }}
    >
      <SegmentedModeToggle
        triageRemaining={triageRemaining}
        triageDisabled={triageDisabled}
      />

      <FoldersDropdown />

      <div className="ml-auto flex items-center gap-1">
        <GoogleAuthStatus onReconnect={() => setShowReauthModal(true)} />

        <OfflineIndicatorCompact
          isOffline={isOffline}
          pendingActionsCount={pendingActionsCount}
        />

        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="w-9 h-9 rounded-lg pulse-ink-2-color hover:pulse-surface-raised flex items-center justify-center transition disabled:opacity-40"
          title={syncing ? 'Syncing…' : 'Sync emails'}
          aria-label={syncing ? 'Syncing emails' : 'Sync emails'}
          aria-busy={syncing}
        >
          {syncing
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => setShowEmailSettings(true)}
          className="w-9 h-9 rounded-lg pulse-ink-2-color hover:pulse-surface-raised flex items-center justify-center transition"
          title="Email settings"
          aria-label="Open email settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default CanvasTopBar;
