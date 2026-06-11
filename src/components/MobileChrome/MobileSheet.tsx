// MobileSheet — shared shell for the slim bar's bottom sheets (navigation +
// quick actions). Portal'd scrim + panel with the dialog a11y the older
// BottomSheet.tsx (Calendar's snap-point sheet) never had: focus trap,
// Escape, focus restore on close, body scroll lock. Dark panels are opaque
// (dark:bg-zinc-950) per the floating-panel rule — translucent surfaces are
// for in-canvas cards only. z-[9500]: above the z-50-saturated section
// content and the palette dropdown (9000), below the 9999/10000 modal band.

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface MobileSheetProps {
  /** Mono uppercase header label; doubles as the dialog's accessible name. */
  title: string;
  onClose: () => void;
  /** Escape override for multi-step content (e.g. a picker that steps back
   *  before the sheet closes). Defaults to onClose. */
  onEscape?: () => void;
  children: React.ReactNode;
}

export const MobileSheet: React.FC<MobileSheetProps> = ({ title, onClose, onEscape, children }) => {
  const panelRef = useFocusTrap<HTMLDivElement>({ active: true, onEscape: onEscape ?? onClose });

  // Body scroll lock while the sheet is up (BottomSheet.tsx idiom).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9500] md:hidden">
      <div
        className="absolute inset-0 bg-zinc-950/50 backdrop-blur-md animate-capture-scrim-enter"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute bottom-0 inset-x-0 max-h-[80vh] flex flex-col rounded-t-2xl bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-white/[0.08] shadow-2xl overflow-hidden animate-sheet-up"
      >
        <div className="shrink-0 flex items-center justify-between pl-4 pr-2 py-1.5 border-b border-zinc-100 dark:border-white/[0.06]">
          <span className="font-mono text-[11px] font-medium tracking-[0.1em] uppercase text-zinc-500 dark:text-zinc-400">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Safe-area padding lives on the scroll content so the last row
            clears the home indicator instead of hiding behind it. */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mobile-scroll pb-[max(env(safe-area-inset-bottom),12px)]">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MobileSheet;
