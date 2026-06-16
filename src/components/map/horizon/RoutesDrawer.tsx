// ─────────────────────────────────────────────────────────────────────────────
// RoutesDrawer — Direction-D "Horizon" floating-chrome (Tier-3 §8B / P10) route &
// planning surface. The dedicated home for the Surfaces cluster's "Routes" button.
//
// It does NOT reimplement the route engine: it EMBEDS the existing AiStrip (card
// layout) as `children`, so accept / reorder / dismiss / "Open in Maps" / week-plan
// jump all stay the single tested implementation (useMapAiProposals +
// buildMultiStopDirectionsUrl + proposeWeekPlan, already wired into PulseMapView's
// handlers). PulseMapView hides the floating AI card while this drawer is open, so
// AiStrip renders in exactly one place at a time — no duplicate state machine.
//
// When there's no route/plan to show, the drawer renders a teaching empty state
// (the engine needs ≥2 located stops). Shell mirrors LiveTeamDrawer / GeofencesDrawer
// (overlay + right panel + useDialogA11y); chrome stays neutral (CLAUDE.md §4).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef } from 'react';
import { Route, X } from 'lucide-react';
import { useDialogA11y } from '../sub/useDialogA11y';

export interface RoutesDrawerProps {
  isDarkMode: boolean;
  /** Whether the embedded engine has any route/plan to show — drives the empty state. */
  hasRouteContent: boolean;
  onClose: () => void;
  /** The route engine — typically <AiStrip layout="card" />. */
  children: React.ReactNode;
}

export const RoutesDrawer: React.FC<RoutesDrawerProps> = ({
  isDarkMode,
  hasRouteContent,
  onClose,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useDialogA11y({ containerRef: panelRef, onClose, initialFocusRef: closeBtnRef });
  const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div
      className="absolute inset-0 z-30 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="routes-drawer-title"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md h-full border-l shadow-2xl overflow-hidden flex flex-col ${
          isDarkMode ? 'bg-zinc-950 border-white/10 text-gray-200' : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        {/* Header — neutral chrome (coral reserved for the AI route engine below). */}
        <div className={`flex items-center justify-between px-4 py-3 border-b flex-shrink-0 ${
          isDarkMode ? 'border-white/10' : 'border-gray-100'
        }`}>
          <div className="flex items-center gap-2">
            <Route size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} aria-hidden="true" />
            <span id="routes-drawer-title" className="text-[11px] tracking-[0.1em] uppercase" style={monoStyle}>
              Routes
            </span>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`p-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
              isDarkMode ? 'hover:bg-white/10 text-gray-400 focus-visible:ring-zinc-400' : 'hover:bg-gray-100 text-gray-500 focus-visible:ring-zinc-500'
            }`}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {hasRouteContent ? (
            children
          ) : (
            <div className="flex flex-col items-center justify-center text-center h-full gap-3 px-6">
              <Route size={28} className="text-rose-500/70" aria-hidden="true" />
              <p className="text-sm font-medium">No route yet.</p>
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Pin two or more stops on Today and Pulse AI proposes the fastest loop
                here — accept it, reorder, then open it in Maps.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoutesDrawer;
