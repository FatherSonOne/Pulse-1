// CanvasTopBar — Phase 6: segmented mode toggle + folders dropdown + (Phase 7 placeholders).
// The toggle's Triage half hides when we're not in the inbox; the folders
// dropdown is the way back.
import React from 'react';
import { Search, Settings } from 'lucide-react';
import { useEmailStore } from '../../../../store/emailStore';
import { SegmentedModeToggle } from './SegmentedModeToggle';
import { FoldersDropdown } from './FoldersDropdown';
import { Keycap } from '../primitives';

interface CanvasTopBarProps {
  triageRemaining: number;
}

export const CanvasTopBar: React.FC<CanvasTopBarProps> = ({ triageRemaining }) => {
  const currentFolder = useEmailStore((s) => s.currentFolder);
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
};

export default CanvasTopBar;
