import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CalendarEvent } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week' | 'day' | 'year' | 'agenda';

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: string;
  category: 'navigation' | 'event' | 'view';
  action: () => void;
  keywords?: string[];
}

interface EventResult {
  id: string;
  label: string;
  description: string;
  icon: string;
  event: CalendarEvent;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  currentDate: Date;
  viewMode: ViewMode;
  onViewChange: (view: ViewMode, date?: Date) => void;
  onGoToToday: () => void;
  onCreateEvent: (date?: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatEventDate = (date: Date): string => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  if (isSameDay(date, today)) {
    return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (isSameDay(date, tomorrow)) {
    return `Tomorrow at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' at ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

// ─── Component ────────────────────────────────────────────────────────────────

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  events,
  currentDate,
  viewMode,
  onViewChange,
  onGoToToday,
  onCreateEvent,
  onEventClick,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Reset on open ──
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  // ── Static commands ──
  const commands = useMemo<CommandAction[]>(() => [
    {
      id: 'goto-today',
      label: 'Go to Today',
      icon: 'fa-calendar-day',
      category: 'navigation',
      keywords: ['today', 'now', 'current'],
      action: () => { onGoToToday(); onClose(); },
    },
    {
      id: 'new-event',
      label: 'Create New Event',
      description: 'Open the event creation form',
      icon: 'fa-plus',
      category: 'event',
      keywords: ['create', 'add', 'new', 'event', 'schedule'],
      action: () => { onCreateEvent(); onClose(); },
    },
    {
      id: 'view-month',
      label: 'Switch to Month View',
      icon: 'fa-calendar',
      category: 'view',
      keywords: ['month', 'monthly'],
      action: () => { onViewChange('month'); onClose(); },
    },
    {
      id: 'view-week',
      label: 'Switch to Week View',
      icon: 'fa-calendar-week',
      category: 'view',
      keywords: ['week', 'weekly'],
      action: () => { onViewChange('week'); onClose(); },
    },
    {
      id: 'view-day',
      label: 'Switch to Day View',
      icon: 'fa-calendar-day',
      category: 'view',
      keywords: ['day', 'daily'],
      action: () => { onViewChange('day'); onClose(); },
    },
    {
      id: 'view-agenda',
      label: 'Switch to Agenda View',
      icon: 'fa-list',
      category: 'view',
      keywords: ['agenda', 'list', 'schedule'],
      action: () => { onViewChange('agenda'); onClose(); },
    },
    {
      id: 'view-year',
      label: 'Switch to Year View',
      icon: 'fa-calendar-alt',
      category: 'view',
      keywords: ['year', 'yearly', 'overview'],
      action: () => { onViewChange('year'); onClose(); },
    },
  ], [onGoToToday, onCreateEvent, onViewChange, onClose]);

  // ── Filtered results ──
  const q = query.trim().toLowerCase();

  const filteredCommands = useMemo(() => {
    if (!q) return commands;
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q) ||
      cmd.keywords?.some(k => k.includes(q))
    );
  }, [commands, q]);

  const filteredEvents = useMemo<EventResult[]>(() => {
    if (!q || q.length < 2) return [];
    const now = Date.now();
    return events
      .filter(ev =>
        ev.title.toLowerCase().includes(q) ||
        ev.location?.toLowerCase().includes(q) ||
        ev.description?.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        // Upcoming first, then past
        const aDiff = Math.abs(a.start.getTime() - now);
        const bDiff = Math.abs(b.start.getTime() - now);
        return aDiff - bDiff;
      })
      .slice(0, 8)
      .map(ev => ({
        id: ev.id,
        label: ev.title,
        description: formatEventDate(ev.start) + (ev.location ? ` · ${ev.location}` : ''),
        icon: 'fa-calendar-check',
        event: ev,
      }));
  }, [events, q]);

  // Combined flat list of results for keyboard navigation
  const allResults = useMemo(() => [
    ...filteredCommands.map(c => ({ type: 'command' as const, item: c })),
    ...filteredEvents.map(e => ({ type: 'event' as const, item: e })),
  ], [filteredCommands, filteredEvents]);

  const total = allResults.length;

  // ── Keyboard navigation ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, total - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const result = allResults[selectedIndex];
      if (!result) return;
      if (result.type === 'command') {
        (result.item as CommandAction).action();
      } else {
        onEventClick((result.item as EventResult).event);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [allResults, selectedIndex, total, onEventClick, onClose]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [q]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const categoryLabel = (cat: string) => {
    if (cat === 'navigation') return 'Navigation';
    if (cat === 'event') return 'Events';
    if (cat === 'view') return 'Views';
    return cat;
  };

  // ── Render ──
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-xl mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <i className="fa-solid fa-magnifying-glass text-zinc-400 text-sm flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={allResults.length > 0}
            aria-haspopup="listbox"
            aria-controls="cmd-palette-results"
            aria-activedescendant={allResults.length > 0 ? `cmd-result-${selectedIndex}` : undefined}
            aria-autocomplete="list"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search events or type a command..."
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
            aria-label="Command palette search"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="text-[10px] text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 font-mono" aria-label="Escape to close">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          id="cmd-palette-results"
          ref={listRef}
          className="max-h-80 overflow-y-auto overscroll-contain"
          role="listbox"
          aria-label="Command palette results"
        >
          {allResults.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">
              {q ? `No results for "${query}"` : 'Type to search events or a command…'}
            </div>
          )}

          {/* Commands section */}
          {filteredCommands.length > 0 && (
            <div>
              {q === '' && (
                <div className="px-4 pt-2 pb-1 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
                  Quick Actions
                </div>
              )}
              {filteredCommands.map((cmd, i) => {
                const globalIdx = i;
                const isSelected = selectedIndex === globalIdx;
                return (
                  <button
                    key={cmd.id}
                    id={`cmd-result-${globalIdx}`}
                    data-index={globalIdx}
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-zinc-100 dark:bg-zinc-800'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                    }`}
                    onClick={() => cmd.action()}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                  >
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex-shrink-0" aria-hidden="true">
                      <i className={`fa-solid ${cmd.icon} text-xs`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {cmd.label}
                      </div>
                      {cmd.description && (
                        <div className="text-xs text-zinc-400 truncate">{cmd.description}</div>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 flex-shrink-0">
                      {categoryLabel(cmd.category)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Events section */}
          {filteredEvents.length > 0 && (
            <div>
              <div className="px-4 pt-2 pb-1 text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">
                Events
              </div>
              {filteredEvents.map((evResult, i) => {
                const globalIdx = filteredCommands.length + i;
                const isSelected = selectedIndex === globalIdx;
                return (
                  <button
                    key={evResult.id}
                    id={`cmd-result-${globalIdx}`}
                    data-index={globalIdx}
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-zinc-100 dark:bg-zinc-800'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                    }`}
                    onClick={() => { onEventClick(evResult.event); onClose(); }}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                  >
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex-shrink-0" aria-hidden="true">
                      <i className={`fa-solid ${evResult.icon} text-xs`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                        {evResult.label}
                      </div>
                      <div className="text-xs text-zinc-400 truncate">{evResult.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
          <span className="ml-auto">
            <kbd className="font-mono">⌘K</kbd> to reopen
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
