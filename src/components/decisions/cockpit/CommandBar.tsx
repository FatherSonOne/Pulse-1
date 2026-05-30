/**
 * CommandBar — ⌘K command palette for the Triage Cockpit.
 *
 * Phase 1: functional shell — opens/closes, focus-managed, Escape + backdrop
 * dismiss, a filterable stub list. The real actions (New, Prioritize, Export,
 * Refresh, jump-to-item, search) are wired in Phase 7; here each item just
 * closes the palette so the open/close contract is verifiable.
 *
 * Coral budget (CLAUDE.md §4): palette is chrome → rose/neutral tokens only.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Zap, Download, RotateCw, X } from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  section: string;
  icon: React.ReactNode;
  /** Phase 7 wires real handlers; Phase 1 items just dismiss. */
  run?: () => void;
}

interface CommandBarProps {
  open: boolean;
  onClose: () => void;
}

const STUB_ITEMS: CommandItem[] = [
  { id: 'new-decision', label: 'New decision', section: 'Create', icon: <Plus size={15} /> },
  { id: 'quick-task', label: 'Quick task', section: 'Create', icon: <Plus size={15} /> },
  { id: 'prioritize', label: 'Prioritize tasks with AI', section: 'Actions', icon: <Zap size={15} /> },
  { id: 'export', label: 'Export CSV', section: 'Actions', icon: <Download size={15} /> },
  { id: 'refresh', label: 'Refresh', section: 'Actions', icon: <RotateCw size={15} /> },
];

export function CommandBar({ open, onClose }: CommandBarProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when the palette opens; reset query when it closes.
  useEffect(() => {
    if (open) {
      // rAF so the element is mounted before we focus.
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STUB_ITEMS;
    return STUB_ITEMS.filter((i) => i.label.toLowerCase().includes(q));
  }, [query]);

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

  const handleRun = (item: CommandItem) => {
    item.run?.();
    onClose();
  };

  return (
    <div
      className="ck-cmdk-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ck-cmdk-panel scale-in"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
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
          {sections.length === 0 ? (
            <div className="ck-cmdk-empty">No commands match “{query}”.</div>
          ) : (
            sections.map(([section, items]) => (
              <div key={section}>
                <div className="ck-cmdk-section">{section}</div>
                {items.map((item) => (
                  <button
                    key={item.id}
                    className="ck-cmdk-item"
                    role="option"
                    aria-selected={false}
                    onClick={() => handleRun(item)}
                  >
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
