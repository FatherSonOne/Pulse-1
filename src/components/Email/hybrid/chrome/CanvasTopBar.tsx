// CanvasTopBar — Phase 3 thin top bar: segmented mode toggle + ⌘E hint.
// Phase 6 will add the folders dropdown; Phase 7 will fill in
// search / sync / settings on the right cluster.
import React from 'react';
import { Search, Settings } from 'lucide-react';
import { SegmentedModeToggle } from './SegmentedModeToggle';
import { Keycap } from '../primitives';

interface CanvasTopBarProps {
  triageRemaining: number;
}

export const CanvasTopBar: React.FC<CanvasTopBarProps> = ({ triageRemaining }) => (
  <div
    className="flex items-center gap-3 px-5 py-2.5 border-b pulse-border-color shrink-0"
    style={{ background: 'var(--pulse-canvas)' }}
  >
    <SegmentedModeToggle triageRemaining={triageRemaining} />

    {/* Phase 7 fills these in; Phase 3 ships them disabled so the layout is final. */}
    <div className="ml-auto flex items-center gap-2 opacity-40 pointer-events-none">
      <button
        type="button"
        className="px-2.5 py-1.5 rounded-md text-[12px] pulse-ink-2-color flex items-center gap-1.5"
        title="Search (Phase 7)"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search</span>
        <Keycap>/</Keycap>
      </button>
      <button
        type="button"
        className="px-2.5 py-1.5 rounded-md text-[12px] pulse-ink-2-color"
        title="Settings (Phase 7)"
      >
        <Settings className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

export default CanvasTopBar;
