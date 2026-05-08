/**
 * ActionPalette — Phase 5: Cmd+K Action Palette
 *
 * Searchable modal palette for War Room actions.
 * Open with Cmd+K (Mac) or Ctrl+K (Windows/Linux).
 *
 * Categories:
 *   Generate — AI content generators (Study Guide, FAQ, Timeline, Podcast)
 *   Navigate — Switch War Room mode
 *   Board    — Board & panel shortcuts
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WarRoomMode } from './ModeSwitcher';

import { Search } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaletteCategory = 'generate' | 'navigate' | 'board';

export interface PaletteAction {
  id: string;
  label: string;
  description?: string;
  icon: string;
  category: PaletteCategory;
  accent?: string;
  execute: () => void;
}

export interface ActionPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: PaletteAction[];
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<PaletteCategory, { label: string; icon: string; color: string }> = {
  generate:  { label: 'Generate',   icon: 'fa-wand-magic-sparkles', color: '#f59e0b' },
  navigate:  { label: 'Navigate',   icon: 'fa-compass',             color: '#3b82f6' },
  board:     { label: 'Board',      icon: 'fa-thumbtack',           color: '#8b5cf6' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const ActionPalette: React.FC<ActionPaletteProps> = ({ isOpen, onClose, actions }) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter and group actions
  const filtered = query.trim()
    ? actions.filter(
        (a) =>
          a.label.toLowerCase().includes(query.toLowerCase()) ||
          a.description?.toLowerCase().includes(query.toLowerCase()),
      )
    : actions;

  // Group by category preserving order: generate → navigate → board
  const CATEGORY_ORDER: PaletteCategory[] = ['generate', 'navigate', 'board'];
  type GroupedActions = { category: PaletteCategory; items: PaletteAction[] };
  const grouped: GroupedActions[] = CATEGORY_ORDER.reduce<GroupedActions[]>((acc, cat) => {
    const items = filtered.filter((a) => a.category === cat);
    if (items.length > 0) acc.push({ category: cat, items });
    return acc;
  }, []);

  // Flat list for keyboard navigation
  const flat = filtered;

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  // Clamp selected index when list changes
  useEffect(() => {
    setSelectedIdx((prev) => Math.min(prev, Math.max(flat.length - 1, 0)));
  }, [flat.length]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, flat.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const action = flat[selectedIdx];
        if (action) { action.execute(); onClose(); }
      }
    },
    [flat, selectedIdx, onClose],
  );

  if (!isOpen) return null;

  // Build a map of action index (in flat array) for highlighting
  let flatIdx = 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 580,
          maxWidth: '92vw',
          backgroundColor: 'var(--pulse-surface)',
          border: '1px solid var(--pulse-border-strong)',
          borderRadius: '12px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '70vh',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: '1px solid var(--pulse-border)',
          }}
        >
          <Search className="fa" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            placeholder="Search actions…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--pulse-ink)',
              fontFamily: 'var(--pulse-font)',
              fontSize: 15,
            }}
          />
          <kbd
            style={{
              fontFamily: 'var(--pulse-font-mono)',
              fontSize: 10,
              color: 'var(--pulse-ink-3)',
              border: '1px solid var(--pulse-border)',
              borderRadius: 4,
              padding: '2px 6px',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
          {grouped.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: 'var(--pulse-ink-3)',
                fontFamily: 'var(--pulse-font-mono)',
                fontSize: 12,
              }}
            >
              No actions found
            </div>
          ) : (
            grouped.map(({ category, items }) => {
              const cfg = CATEGORY_CONFIG[category];
              return (
                <div key={category}>
                  {/* Category header */}
                  <div
                    style={{
                      padding: '8px 16px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <i
                      className={`fa ${cfg.icon}`}
                      style={{ fontSize: 10, color: cfg.color }}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--pulse-font-mono)',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: cfg.color,
                      }}
                    >
                      {cfg.label}
                    </span>
                  </div>

                  {/* Action rows */}
                  {items.map((action) => {
                    const idx = flatIdx++;
                    const isSelected = idx === selectedIdx;
                    const accent = action.accent ?? cfg.color;
                    return (
                      <div
                        key={action.id}
                        data-idx={idx}
                        onClick={() => { action.execute(); onClose(); }}
                        onMouseEnter={() => setSelectedIdx(idx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '9px 16px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? `${accent}14` : 'transparent',
                          borderLeft: isSelected ? `2px solid ${accent}` : '2px solid transparent',
                          transition: 'background var(--pulse-duration) var(--pulse-ease)',
                        }}
                      >
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: '8px',
                            backgroundColor: isSelected ? `${accent}22` : 'var(--ps-bg-surface, rgba(0,0,0,0.04))',
                            border: `1px solid ${isSelected ? accent + '60' : 'var(--pulse-border)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <i
                            className={`fa ${action.icon}`}
                            style={{ fontSize: 13, color: isSelected ? accent : 'var(--pulse-ink-2)' }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              color: isSelected ? 'var(--pulse-ink)' : 'var(--pulse-ink-2)',
                              fontWeight: isSelected ? 600 : 400,
                              fontFamily: 'var(--pulse-font)',
                            }}
                          >
                            {action.label}
                          </div>
                          {action.description && (
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--pulse-ink-3)',
                                fontFamily: 'var(--pulse-font-mono)',
                                marginTop: 1,
                              }}
                            >
                              {action.description}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '7px 16px',
            borderTop: '1px solid var(--pulse-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          {[['↑↓', 'navigate'], ['↵', 'select'], ['esc', 'close']].map(([key, label]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <kbd
                style={{
                  fontFamily: 'var(--pulse-font-mono)',
                  fontSize: 9,
                  color: 'var(--pulse-ink-3)',
                  border: '1px solid var(--pulse-border)',
                  borderRadius: 4,
                  padding: '1px 5px',
                }}
              >
                {key}
              </kbd>
              <span style={{ fontSize: 10, color: 'var(--pulse-ink-3)', fontFamily: 'var(--pulse-font-mono)' }}>
                {label}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActionPalette;

// ─── Mode actions builder ─────────────────────────────────────────────────────

const MODE_ICONS: Record<string, string> = {
  'command-center': 'fa-shield-halved',
  intel:            'fa-satellite-dish',
  analyst:          'fa-chart-line',
  strategist:       'fa-chess',
  brainstorm:       'fa-lightbulb',
  focus:            'fa-crosshairs',
  debrief:          'fa-clipboard-list',
};

const MODE_ACCENTS: Record<string, string> = {
  'command-center': '#f43f5e',
  intel:            '#3b82f6',
  analyst:          '#3b82f6',
  strategist:       '#8b5cf6',
  brainstorm:       '#f59e0b',
  focus:            '#fb7185',
  debrief:          '#10b981',
};

export function buildModeActions(
  modes: WarRoomMode[],
  currentMode: WarRoomMode,
  onModeChange: (m: WarRoomMode) => void,
): PaletteAction[] {
  return modes
    .filter((m) => m !== currentMode)
    .map((m) => ({
      id: `mode-${m}`,
      label: `Switch to ${m.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`,
      icon: MODE_ICONS[m] ?? 'fa-circle',
      category: 'navigate' as PaletteCategory,
      accent: MODE_ACCENTS[m],
      execute: () => onModeChange(m),
    }));
}
