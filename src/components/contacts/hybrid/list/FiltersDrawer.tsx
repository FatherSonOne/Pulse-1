// ============================================
// FiltersDrawer — relocated facets for the Browse column (D1).
// Holds the smart lists, circles, archive toggle, and saved-filters panel that
// lived in the legacy facet sidebar. Tags + status live as chips in BrowseColumn.
// ArchivedToggle + SavedFiltersPanel are REUSED verbatim (passed in / imported).
//
// Section collapse state is persisted under the legacy `pulse_contacts_section_*`
// keys (repurposed per §4.2) so the operator's existing prefs carry over.
// See docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md §4.2.
// ============================================

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SmartListType } from '../../../../types/relationshipTypes';
import type { ContactCircle } from '../../../../types/contactCircleTypes';
import { ArchivedToggle } from '../../ArchivedToggle';
import { SMART_LISTS } from './smartLists';

interface FiltersDrawerProps {
  activeSmartList: SmartListType | null;
  smartListCounts: Record<SmartListType, number>;
  onSmartListChange: (list: SmartListType | null) => void;
  circles: ContactCircle[];
  activeCircleId: string | null;
  onCircleChange: (id: string | null) => void;
  showArchived: boolean;
  archivedCount: number;
  onToggleArchived: (next: boolean) => void;
  savedFiltersPanel?: React.ReactNode;
}

// Collapse persistence — same keys + read/write shape as the legacy Sidebar.
const readLs = (k: string, fallback: boolean): boolean => {
  try {
    const v = localStorage.getItem(`pulse_contacts_section_${k}`);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
};
const writeLs = (k: string, v: boolean) => {
  try {
    localStorage.setItem(`pulse_contacts_section_${k}`, v ? '1' : '0');
  } catch {
    /* ignore */
  }
};

const SectionToggle: React.FC<{ label: string; open: boolean; onToggle: () => void }> = ({
  label,
  open,
  onToggle,
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={open}
    className="w-full flex items-center justify-between px-1 pb-1.5 text-[10px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500"
    style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
  >
    <span>{label}</span>
    <ChevronDown
      size={12}
      className="transition-transform"
      style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
      aria-hidden="true"
    />
  </button>
);

export const FiltersDrawer: React.FC<FiltersDrawerProps> = ({
  activeSmartList,
  smartListCounts,
  onSmartListChange,
  circles,
  activeCircleId,
  onCircleChange,
  showArchived,
  archivedCount,
  onToggleArchived,
  savedFiltersPanel,
}) => {
  const [smartListsOpen, setSmartListsOpen] = useState(() => readLs('smart_lists', true));
  const [circlesOpen, setCirclesOpen] = useState(() => readLs('circles', true));
  const toggleSmartLists = () =>
    setSmartListsOpen((v) => {
      writeLs('smart_lists', !v);
      return !v;
    });
  const toggleCircles = () =>
    setCirclesOpen((v) => {
      writeLs('circles', !v);
      return !v;
    });

  return (
    <div className="space-y-4 px-1 py-2">
      {/* Smart Lists */}
      <div>
        <SectionToggle label="Smart Lists" open={smartListsOpen} onToggle={toggleSmartLists} />
        {smartListsOpen && (
          <div className="space-y-0.5">
            {SMART_LISTS.map((list) => {
              const Icon = list.Icon;
              const active = activeSmartList === list.id;
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => onSmartListChange(active ? null : list.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm border transition-colors ${
                    active
                      ? 'bg-[var(--pulse-rose-soft)] border-[var(--pulse-rose-soft)] text-[var(--pulse-rose)]'
                      : 'border-transparent text-zinc-600 dark:text-zinc-300 hover:bg-[var(--pulse-surface-raised)]'
                  }`}
                >
                  <Icon size={14} className="shrink-0" />
                  <span className="flex-1 truncate">{list.label}</span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {smartListCounts[list.id] || 0}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Circles (only when any exist, mirroring legacy) */}
      {circles.length > 0 && (
        <div>
          <SectionToggle label="Circles" open={circlesOpen} onToggle={toggleCircles} />
          {circlesOpen && (
            <div className="space-y-0.5">
              {circles.map((circle) => {
                const active = activeCircleId === circle.id;
                return (
                  <button
                    key={circle.id}
                    type="button"
                    title={circle.name}
                    onClick={() => onCircleChange(active ? null : circle.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm border transition-colors ${
                      active
                        ? 'bg-[var(--pulse-rose-soft)] border-[var(--pulse-rose-soft)] text-[var(--pulse-rose)]'
                        : 'border-transparent text-zinc-600 dark:text-zinc-300 hover:bg-[var(--pulse-surface-raised)]'
                    }`}
                  >
                    <span
                      className="shrink-0 w-2.5 h-2.5 rounded-full"
                      style={{ background: circle.color || 'var(--pulse-ink-3)' }}
                    />
                    <span className="flex-1 truncate">{circle.name}</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {circle.memberContactIds.length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Archive toggle — reused verbatim */}
      <div className="px-1">
        <ArchivedToggle
          showArchived={showArchived}
          archivedCount={archivedCount}
          onToggle={onToggleArchived}
        />
      </div>

      {/* Saved filters — the orchestrator builds the panel (state lives there) */}
      {savedFiltersPanel}
    </div>
  );
};

export default FiltersDrawer;
