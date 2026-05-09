import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Search, ArrowRight } from 'lucide-react';
import { Command, useCommandPalette } from '../contexts/CommandPaletteContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultGroupFor(kind: Command['kind']): string {
  switch (kind) {
    case 'navigate': return 'Go to';
    case 'action':   return 'Actions';
    case 'help':     return 'Help';
    case 'search':   return 'Search';
    default:         return 'Other';
  }
}

function groupCommands(commands: Command[]): { label: string; items: Command[] }[] {
  const groups = new Map<string, Command[]>();
  for (const c of commands) {
    const key = c.group ?? defaultGroupFor(c.kind);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function isFontAwesome(icon: string | React.ElementType): icon is string {
  return typeof icon === 'string';
}

// ─── CommandRow ───────────────────────────────────────────────────────────────

interface CommandRowProps {
  command: Command;
  active: boolean;
  onHover: () => void;
  onActivate: () => void;
}

const CommandRow: React.FC<CommandRowProps> = ({ command, active, onHover, onActivate }) => {
  const Icon = !isFontAwesome(command.icon) ? command.icon : null;
  return (
    <li>
      <button
        type="button"
        onClick={onActivate}
        onMouseEnter={onHover}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 ${
          active
            ? 'bg-rose-500/10'
            : 'hover:bg-zinc-50 dark:hover:bg-white/[0.04]'
        }`}
      >
        {isFontAwesome(command.icon) ? (
          <i
            className={`fa-solid ${command.icon} w-4 text-center shrink-0 ${
              active ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-400 dark:text-zinc-500'
            }`}
          />
        ) : Icon ? (
          <Icon
            size={14}
            className={`shrink-0 ${
              active ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-400 dark:text-zinc-500'
            }`}
          />
        ) : null}
        <span className="flex-1 min-w-0">
          <span
            className={`block text-sm truncate ${
              active
                ? 'text-rose-700 dark:text-rose-300 font-medium'
                : 'text-zinc-800 dark:text-zinc-200'
            }`}
          >
            {command.label}
          </span>
          {command.desc && (
            <span className="block text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {command.desc}
            </span>
          )}
        </span>
        <span className="pulse-label text-zinc-400 dark:text-zinc-500 shrink-0 uppercase tracking-wider text-[10px]">
          {command.kind === 'action'   ? 'ACTION' :
           command.kind === 'navigate' ? 'GO TO'  :
           command.kind === 'search'   ? 'OPEN'   : 'HELP'}
        </span>
      </button>
    </li>
  );
};

// ─── Modal palette (Cmd+K) ────────────────────────────────────────────────────

export const GlobalCommandPalette: React.FC = () => {
  const { isOpen, close, getMatches } = useCommandPalette();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset query + focus input each time the palette opens.
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      // RAF so the input mounts before we focus.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const matches = useMemo(() => (isOpen ? getMatches(query) : []), [isOpen, query, getMatches]);
  const groups = useMemo(() => groupCommands(matches), [matches]);

  // Clamp the active index when results shrink.
  useEffect(() => {
    if (activeIdx >= matches.length) {
      setActiveIdx(Math.max(0, matches.length - 1));
    }
  }, [matches.length, activeIdx]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = matches[activeIdx];
      if (cmd) { cmd.run(); close(); }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  if (!isOpen) return null;

  // Track running offset across groups so each row knows its global index for
  // ↑/↓ navigation alignment.
  let cursor = 0;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-start justify-center z-[10001] p-4 pt-[12vh] animate-fade-in"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="bg-white dark:bg-zinc-950 rounded-xl w-full max-w-lg shadow-2xl border border-zinc-200 dark:border-white/[0.08] overflow-hidden animate-scale-in flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-white/[0.06]">
          <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, jump to a section…"
            className="flex-1 bg-transparent border-0 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-0"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-label="Command palette search"
          />
          <kbd className="hidden sm:inline-flex pulse-label items-center justify-center min-w-[2rem] h-5 px-1.5 rounded text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.06] shrink-0">ESC</kbd>
        </div>

        {/* Rows */}
        <div className="max-h-[55vh] overflow-y-auto py-1">
          {matches.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No commands match.</p>
              <p className="pulse-label text-zinc-400 dark:text-zinc-500 mt-1">TRY A SHORTER QUERY</p>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.label}>
                <div className="px-4 pt-3 pb-1 pulse-label text-zinc-400 dark:text-zinc-500 uppercase tracking-wider text-[10px]">
                  {group.label}
                </div>
                <ul role="listbox">
                  {group.items.map(cmd => {
                    const idx = cursor++;
                    return (
                      <CommandRow
                        key={cmd.id}
                        command={cmd}
                        active={idx === activeIdx}
                        onHover={() => setActiveIdx(idx)}
                        onActivate={() => { cmd.run(); close(); }}
                      />
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-zinc-100 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02]">
          <div className="pulse-label inline-flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
            <kbd className="font-mono normal-case tracking-normal">↑↓</kbd> NAVIGATE
            <kbd className="font-mono normal-case tracking-normal ml-2">↵</kbd> RUN
          </div>
          <span className="pulse-label text-zinc-400 dark:text-zinc-500">
            {matches.length} {matches.length === 1 ? 'COMMAND' : 'COMMANDS'}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Inline palette (Dashboard bar mode) ──────────────────────────────────────
// Renders an input + dropdown that shares command resolution with the modal.
// Used in place of the old "Search the web" bar so the bar IS the palette.

interface InlineCommandPaletteProps {
  /** Optional placeholder; defaults to a useful nudge. */
  placeholder?: string;
  /** Forwarded ref so parents can focus via shortcut. */
  inputRef?: React.RefObject<HTMLInputElement>;
}

export const InlineCommandPalette: React.FC<InlineCommandPaletteProps> = ({
  placeholder = 'Run a command — type to search · ⌘K opens anywhere',
  inputRef: forwardedRef,
}) => {
  const { getMatches } = useCommandPalette();
  const localRef = useRef<HTMLInputElement>(null);
  const inputRef = forwardedRef ?? localRef;
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => (open || query ? getMatches(query) : []), [open, query, getMatches]);
  const groups = useMemo(() => groupCommands(matches), [matches]);

  useEffect(() => {
    if (activeIdx >= matches.length) {
      setActiveIdx(Math.max(0, matches.length - 1));
    }
  }, [matches.length, activeIdx]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = matches[activeIdx];
      if (cmd) {
        cmd.run();
        setQuery('');
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setQuery('');
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  let cursor = 0;

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-4 text-zinc-400 w-4 h-4 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setActiveIdx(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          // Slight delay so a click on a result still fires before close.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-xl pl-11 pr-32 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-rose-500/60 dark:focus:border-rose-500/40 focus:ring-2 focus:ring-rose-500/20 focus:outline-none transition-colors duration-150"
          aria-label="Command palette inline input"
          autoComplete="off"
          spellCheck={false}
        />
        {!query && (
          <span className="hidden sm:inline-flex absolute right-4 top-1/2 -translate-y-1/2 items-center gap-1 pointer-events-none">
            <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.06]">/</kbd>
            <kbd className="inline-flex items-center justify-center h-5 px-1.5 rounded text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.06]">⌘K</kbd>
          </span>
        )}
      </div>

      {/* Inline dropdown — non-modal, anchored to the bar */}
      {open && matches.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-2 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-white/[0.08] shadow-xl overflow-hidden z-50"
          // Suppress mousedown blur on the input so clicks register on rows.
          onMouseDown={e => e.preventDefault()}
        >
          <div className="max-h-[50vh] overflow-y-auto py-1">
            {groups.map(group => (
              <div key={group.label}>
                <div className="px-4 pt-3 pb-1 pulse-label text-zinc-400 dark:text-zinc-500 uppercase tracking-wider text-[10px]">
                  {group.label}
                </div>
                <ul role="listbox">
                  {group.items.map(cmd => {
                    const idx = cursor++;
                    return (
                      <CommandRow
                        key={cmd.id}
                        command={cmd}
                        active={idx === activeIdx}
                        onHover={() => setActiveIdx(idx)}
                        onActivate={() => {
                          cmd.run();
                          setQuery('');
                          setOpen(false);
                        }}
                      />
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-zinc-100 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02]">
            <div className="pulse-label inline-flex items-center gap-2 text-zinc-400 dark:text-zinc-500 uppercase tracking-wider text-[10px]">
              <ArrowRight size={10} /> ENTER TO RUN
            </div>
            <span className="pulse-label text-zinc-400 dark:text-zinc-500 uppercase tracking-wider text-[10px]">
              {matches.length} {matches.length === 1 ? 'COMMAND' : 'COMMANDS'}
            </span>
          </div>
        </div>
      )}

      {/* Inline dropdown — empty state for an active query that matches nothing */}
      {open && query && matches.length === 0 && (
        <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-white/[0.08] shadow-xl px-4 py-6 text-center z-50">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No commands match "{query}".</p>
          <p className="pulse-label text-zinc-400 dark:text-zinc-500 mt-1 uppercase tracking-wider text-[10px]">TRY A SHORTER QUERY</p>
        </div>
      )}
    </div>
  );
};

export default GlobalCommandPalette;
