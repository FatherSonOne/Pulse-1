// ─────────────────────────────────────────────────────────────────────────────
// AtlasModeToggle — Direction D (Horizon, P5) Atlas-as-a-MODE control.
//
// In the legacy chrome Atlas was a third lens TAB (a peer of Today/Week). Under
// Horizon it's an ORTHOGONAL boolean: toggle it on from ANY time detent to zoom
// out to the whole pinned network (useFitBounds refits as the marker set expands)
// and swap the AI card to the network insight. Neutral chrome — Atlas is a view
// mode, not AI/live signal, so it does NOT earn coral (CLAUDE.md §4).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Globe } from 'lucide-react';

export interface AtlasModeToggleProps {
  atlasMode: boolean;
  onChange: (next: boolean) => void;
  isDarkMode: boolean;
}

export const AtlasModeToggle: React.FC<AtlasModeToggleProps> = ({ atlasMode, onChange, isDarkMode }) => {
  return (
    <button
      type="button"
      aria-pressed={atlasMode}
      aria-keyshortcuts="a"
      onClick={() => onChange(!atlasMode)}
      title={`Atlas — zoom out to everyone pinned · press a${atlasMode ? ' to exit' : ''}`}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
        isDarkMode ? 'focus-visible:ring-zinc-400' : 'focus-visible:ring-zinc-500'
      } ${
        atlasMode
          ? isDarkMode
            ? 'bg-white/15 text-white'
            : 'bg-gray-200 text-gray-900'
          : isDarkMode
            ? 'text-gray-400 hover:bg-white/5'
            : 'text-gray-500 hover:bg-gray-100'
      }`}
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      <Globe size={11} aria-hidden="true" />
      <span>Atlas</span>
      <kbd
        aria-hidden="true"
        className={`ml-0.5 px-1 rounded text-[9px] leading-none font-normal ${
          atlasMode
            ? isDarkMode ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-800'
            : isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'
        }`}
      >
        a
      </kbd>
    </button>
  );
};
