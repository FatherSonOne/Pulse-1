// ─────────────────────────────────────────────────────────────────────────────
// Live broadcast sheet — slide-up wrapper around LiveTeamView. Replaces the
// previous peer-lens treatment of live presence: instead of a fourth lens,
// the active broadcasters surface as a bottom sheet over whichever lens is
// in view. useDialogA11y wires focus trap, Escape close, and focus restore.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef } from 'react';
import { Radio, X } from 'lucide-react';
import { Contact } from '../../../types';
import { UserLocation } from '../../../services/locationService';
import LiveTeamView from './LiveTeamView';
import { useDialogA11y } from './useDialogA11y';

export interface LiveBroadcastSheetProps {
  contacts: Contact[];
  liveLocations: Map<string, UserLocation>;
  isDarkMode: boolean;
  onClose: () => void;
  onContactAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
}

export const LiveBroadcastSheet: React.FC<LiveBroadcastSheetProps> = ({
  contacts,
  liveLocations,
  isDarkMode,
  onClose,
  onContactAction,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useDialogA11y({ containerRef: sheetRef, onClose, initialFocusRef: closeBtnRef });

  return (
    <div
      className="absolute inset-0 z-30 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-broadcasters-title"
    >
      <div
        ref={sheetRef}
        className={`w-full max-w-2xl rounded-t-2xl border-t border-x shadow-2xl overflow-hidden map-sheet-up ${
          isDarkMode ? 'bg-zinc-950 border-white/10' : 'bg-white border-gray-200'
        }`}
        style={{ maxHeight: '70%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-4 py-3 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-rose-500" aria-hidden="true" />
            <span
              id="live-broadcasters-title"
              className="text-[11px] tracking-[0.1em] uppercase"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Broadcasting now
            </span>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`p-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
              isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="h-[60vh] overflow-y-auto">
          <LiveTeamView
            contacts={contacts}
            liveLocations={liveLocations}
            isDarkMode={isDarkMode}
            onContactAction={onContactAction}
          />
        </div>
      </div>
    </div>
  );
};
