// CanvasTopBar — Phase 8: adds the search input between FoldersDropdown and
// the right utility cluster. Search input carries a data-hybrid-search
// attribute so the global `/` keybind can focus it.
import React, { useRef, useEffect } from 'react';
import { RefreshCw, Settings, Loader2, Search, X } from 'lucide-react';
import { useEmailStore } from '../../../../store/emailStore';
import { useEmailUIStore } from '../../../../store/emailUIStore';
import { GoogleAuthStatus } from '../../GoogleAuthStatus';
import { OfflineIndicatorCompact } from '../../OfflineIndicator';
import { SegmentedModeToggle } from './SegmentedModeToggle';
import { FoldersDropdown } from './FoldersDropdown';

interface CanvasTopBarProps {
  triageRemaining: number;
  onSync: () => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
}

export const CanvasTopBar: React.FC<CanvasTopBarProps> = ({
  triageRemaining,
  onSync,
  onSearchSubmit,
  onSearchClear,
}) => {
  const currentFolder = useEmailStore((s) => s.currentFolder);
  const syncing = useEmailStore((s) => s.syncing);
  const isOffline = useEmailStore((s) => s.isOffline);
  const pendingActionsCount = useEmailStore((s) => s.pendingActionsCount);
  const searchQuery = useEmailStore((s) => s.searchQuery);
  const setSearchQuery = useEmailStore((s) => s.setSearchQuery);

  const setShowReauthModal = useEmailUIStore((s) => s.setShowReauthModal);
  const setShowEmailSettings = useEmailUIStore((s) => s.setShowEmailSettings);

  const triageDisabled = currentFolder !== 'inbox';
  const inputRef = useRef<HTMLInputElement>(null);

  // Surface the input to the global `/` keybind via the data attribute below.
  // (We could expose a ref via context, but a single querySelector lookup is
  // simpler and the input is unique in the document.)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const node = inputRef.current;
    if (!node) return;
    (window as unknown as { __hybridSearchInput?: HTMLInputElement }).__hybridSearchInput = node;
    return () => {
      const w = window as unknown as { __hybridSearchInput?: HTMLInputElement };
      if (w.__hybridSearchInput === node) delete w.__hybridSearchInput;
    };
  }, []);

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

      <div className="flex-1 max-w-xl relative min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pulse-ink-3-color" />
        <input
          ref={inputRef}
          type="text"
          data-hybrid-search
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSearchSubmit();
            } else if (e.key === 'Escape' && searchQuery) {
              e.preventDefault();
              onSearchClear();
              inputRef.current?.blur();
            }
          }}
          placeholder="Search emails"
          aria-label="Search emails"
          className="w-full h-9 rounded-md pl-9 pr-9 text-[13px] pulse-ink-color border pulse-border-color focus:outline-none focus:pulse-rose-border transition"
          style={{
            background: 'var(--pulse-surface)',
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={onSearchClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded flex items-center justify-center pulse-ink-3-color hover:pulse-ink-color hover:pulse-surface-raised"
            aria-label="Clear search"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <div className="hidden md:contents">
          <GoogleAuthStatus onReconnect={() => setShowReauthModal(true)} />

          <OfflineIndicatorCompact
            isOffline={isOffline}
            pendingActionsCount={pendingActionsCount}
          />
        </div>

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
