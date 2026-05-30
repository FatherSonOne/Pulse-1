/**
 * CommandBar — ⌘K command palette for the Triage Cockpit.
 *
 * Phase 7: driven by real commands from CockpitHub (New / Prioritize / Export /
 * Refresh). The input also doubles as a queue search — when the query is
 * non-empty a "Filter queue by …" action applies it to the FilterState.
 *
 * Coral budget (CLAUDE.md §4): palette is chrome → rose/neutral tokens only.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Filter, X } from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  section: string;
  icon: React.ReactNode;
  run: () => void;
}

interface CommandBarProps {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
  /** Apply the typed query as a queue search (the "jump/search" action). */
  onApplySearch?: (query: string) => void;
}

export function CommandBar({ open, onClose, commands, onApplySearch }: CommandBarProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [query, commands]);

  const sections = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const list = map.get(item.section) ?? [];
      list.push(item);
      map.set(item.section, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (!open) return null;

  const trimmed = query.trim();
  const run = (item: CommandItem) => { item.run(); onClose(); };
  const applySearch = () => {
    if (trimmed && onApplySearch) { onApplySearch(trimmed); onClose(); }
  };

  return (
    <div
      className="ck-cmdk-backdrop"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="ck-cmdk-panel scale-in"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
          if (e.key === 'Enter' && trimmed && filtered.length === 0) applySearch();
        }}
      >
        <div className="ck-cmdk-search">
          <Search size={16} aria-hidden />
          <input
            ref={inputRef}
            className="ck-cmdk-input"
            type="text"
            placeholder="Search or run a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search or run a command"
          />
          <button className="ck-hbtn" style={{ width: 26, height: 26 }} onClick={onClose} aria-label="Close command palette">
            <X size={15} />
          </button>
        </div>

        <div className="ck-cmdk-list" role="listbox" aria-label="Commands">
          {trimmed && onApplySearch && (
            <button className="ck-cmdk-item" role="option" aria-selected={false} onClick={applySearch}>
              <span className="ck-cmdk-icon"><Filter size={15} /></span>
              Filter queue by “{trimmed}”
            </button>
          )}
          {sections.length === 0 && !trimmed ? (
            <div className="ck-cmdk-empty">No commands.</div>
          ) : (
            sections.map(([section, items]) => (
              <div key={section}>
                <div className="ck-cmdk-section">{section}</div>
                {items.map((item) => (
                  <button key={item.id} className="ck-cmdk-item" role="option" aria-selected={false} onClick={() => run(item)}>
                    <span className="ck-cmdk-icon">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="ck-cmdk-foot">
          <span><span className="ck-keycap">↵</span> run</span>
          <span><span className="ck-keycap">esc</span> close</span>
        </div>
      </div>
    </div>
  );
}

export default CommandBar;
