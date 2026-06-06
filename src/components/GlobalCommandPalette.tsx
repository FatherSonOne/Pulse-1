import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Search, ArrowRight, Clock } from 'lucide-react';
import { Command, useCommandPalette, canonicalizeShortcut } from '../contexts/CommandPaletteContext';
import { getRecentCommandIds, pushRecentCommand, getMostUsedCommandIds, isMac } from '../utils/recentCommands';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RECENT_GROUP_LABEL = 'Recent';

function defaultGroupFor(kind: Command['kind']): string {
  switch (kind) {
    case 'navigate': return 'Go to';
    case 'action':   return 'Actions';
    case 'help':     return 'Help';
    case 'search':   return 'Search';
    default:         return 'Other';
  }
}

/**
 * Group commands for rendering. When `recentIds` has entries AND the query is
 * empty, the most-recently-used commands float to a "Recent" group at the top.
 * Once the user types, recent ordering is dropped — search relevance wins.
 */
function groupCommands(
  commands: Command[],
  opts: { recentIds?: string[]; pinRecent?: boolean } = {}
): { label: string; items: Command[] }[] {
  const groups = new Map<string, Command[]>();

  if (opts.pinRecent && opts.recentIds && opts.recentIds.length > 0) {
    const byId = new Map(commands.map(c => [c.id, c]));
    const recents: Command[] = [];
    const consumed = new Set<string>();
    for (const id of opts.recentIds) {
      const cmd = byId.get(id);
      if (cmd) {
        recents.push(cmd);
        consumed.add(cmd.id);
        if (recents.length >= 5) break;
      }
    }
    if (recents.length > 0) {
      groups.set(RECENT_GROUP_LABEL, recents);
    }
    // Drop the recents from the rest so they don't appear twice.
    commands = commands.filter(c => !consumed.has(c.id));
  }

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

/**
 * Render `text` with chars that subsequence-match `query` wrapped in <strong>.
 * Same matching algorithm as scoreFuzzy in CommandPaletteContext (subsequence,
 * case-insensitive). Returns the original text untouched if there's no query
 * or no match. Cheap to recompute per row — labels are short.
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim().toLowerCase();
  if (!q) return text;
  const lower = text.toLowerCase();
  const matches: number[] = [];
  let qi = 0;
  for (let ti = 0; ti < lower.length && qi < q.length; ti++) {
    if (lower[ti] === q[qi]) {
      matches.push(ti);
      qi++;
    }
  }
  // Mismatch: render original. Avoids false-confident highlighting when the
  // command was returned by a desc/keyword match instead of label.
  if (qi < q.length) return text;
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const idx of matches) {
    if (idx > cursor) out.push(text.slice(cursor, idx));
    out.push(<strong key={idx} className="font-semibold text-rose-600 dark:text-rose-400">{text[idx]}</strong>);
    cursor = idx + 1;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

/** Cached at module scope so we render the right glyph without per-render work. */
const SHORTCUT_HINT = isMac() ? '⌘K' : 'Ctrl+K';

/**
 * A shortcut chip should render ONLY if the global runner could actually fire
 * it. The runner (CommandPaletteContext) accepts a keypress via eventToCanonical,
 * which rejects bare keys — it requires a mod/alt — and canonicalizeShortcut
 * returns null for multi-key sequences ('g e'). So a chip is "live" iff the
 * shortcut canonicalizes AND its canonical form carries a 'mod' or 'alt' token.
 * Rendering a chip the runner can't fire (e.g. 'c', 'g e') advertises a dead
 * binding — the single most-cited trust defect in the palette's usability review.
 */
function isLiveShortcut(shortcut: string): boolean {
  const canonical = canonicalizeShortcut(shortcut);
  if (!canonical) return false;
  return canonical.split('+').some(tok => tok === 'mod' || tok === 'alt');
}

// ─── CommandRow ───────────────────────────────────────────────────────────────

interface CommandRowProps {
  command: Command;
  active: boolean;
  onHover: () => void;
  onActivate: () => void;
  /** Current query — chars matching the label render bold inline. */
  query?: string;
  /** True when this command is in the user's top-N by usage count. */
  popular?: boolean;
  /** Forwarded so the parent can scroll the active row into view on arrow nav. */
  rowRef?: React.RefObject<HTMLLIElement>;
}

const CommandRow: React.FC<CommandRowProps> = ({ command, active, onHover, onActivate, query, popular, rowRef }) => {
  const Icon = !isFontAwesome(command.icon) ? command.icon : null;
  return (
    <li ref={rowRef}>
      <button
        type="button"
        // Rows are mouse-clickable but not Tab-reachable — keyboard nav uses
        // ↑/↓ inside the input. Keeps the focus trap tight (only the input
        // is in the tab cycle inside the modal palette).
        tabIndex={-1}
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
            className={`flex items-center gap-1.5 text-sm truncate ${
              active
                ? 'text-rose-700 dark:text-rose-300 font-medium'
                : 'text-zinc-800 dark:text-zinc-200'
            }`}
          >
            {/* Star precedes the label for the user's top-N most-used commands. */}
            {popular && (
              <span
                className="text-rose-500 dark:text-rose-400 shrink-0 text-[11px] leading-none"
                title="One of your most-used commands"
                aria-label="Most used"
              >★</span>
            )}
            <span className="truncate">{highlightMatch(command.label, query ?? '')}</span>
          </span>
          {command.desc && (
            <span className="block text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {command.desc}
            </span>
          )}
        </span>
        {command.shortcut && isLiveShortcut(command.shortcut) ? (
          // A real shortcut wins the right-aligned slot — more useful to the
          // user than the kind badge. Split on '+' so multi-key combos like
          // 'Ctrl+Shift+R' render as separate kbd chips. Chips only render for
          // shortcuts the runner can actually fire (isLiveShortcut) — a dead
          // 'g e' / 'c' hint falls through to the kind badge below.
          <span className="shrink-0 inline-flex items-center gap-1">
            {command.shortcut.split('+').map((key, i) => (
              <kbd
                key={`${key}-${i}`}
                className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded text-[10px] font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08]"
              >
                {key.trim()}
              </kbd>
            ))}
          </span>
        ) : (
          <span className="pulse-label text-zinc-400 dark:text-zinc-500 shrink-0 uppercase tracking-wider text-[10px]">
            {command.kind === 'action'   ? 'ACTION' :
             command.kind === 'navigate' ? 'GO TO'  :
             command.kind === 'search'   ? 'OPEN'   : 'HELP'}
          </span>
        )}
      </button>
    </li>
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
  /**
   * When true, focus the input + open the dropdown on mount. Used by the
   * GlobalCommandBar pill so the palette is ready to type the instant it
   * expands. Default false preserves the Dashboard hero behavior.
   */
  autoFocusOnMount?: boolean;
  /**
   * Called when the palette closes from inside (Escape, outside-click blur, or
   * after running a command). Lets a wrapper (GlobalCommandBar) collapse the
   * pill. Optional — the Dashboard usage doesn't pass it.
   */
  onClose?: () => void;
}

export const InlineCommandPalette: React.FC<InlineCommandPaletteProps> = ({
  placeholder = `Run a command — type to search · ${SHORTCUT_HINT} opens anywhere`,
  inputRef: forwardedRef,
  autoFocusOnMount = false,
  onClose,
}) => {
  const { getMatches } = useCommandPalette();
  const localRef = useRef<HTMLInputElement>(null);
  const inputRef = forwardedRef ?? localRef;
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>(() => getRecentCommandIds());
  const [popularIds, setPopularIds] = useState<Set<string>>(() => new Set(getMostUsedCommandIds(3)));
  const activeRowRef = useRef<HTMLLIElement>(null);

  const matches = useMemo(() => (open || query ? getMatches(query) : []), [open, query, getMatches]);
  const groups = useMemo(
    () => groupCommands(matches, { recentIds, pinRecent: query.trim().length === 0 }),
    [matches, recentIds, query]
  );
  const flatCommands = useMemo(() => groups.flatMap(g => g.items), [groups]);

  useEffect(() => {
    if (activeIdx >= flatCommands.length) {
      setActiveIdx(Math.max(0, flatCommands.length - 1));
    }
  }, [flatCommands.length, activeIdx]);

  // Scroll the active row into view as the user arrows through results.
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // Focus + open on mount when driven by the GlobalCommandBar pill, so the
  // palette is immediately typeable the moment the pill expands.
  useEffect(() => {
    if (autoFocusOnMount) {
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    // inputRef identity is stable; only run on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusOnMount]);

  const activate = (cmd: Command) => {
    pushRecentCommand(cmd.id);
    setRecentIds(getRecentCommandIds());
    setPopularIds(new Set(getMostUsedCommandIds(3)));
    cmd.run();
    setQuery('');
    setOpen(false);
    onClose?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flatCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = flatCommands[activeIdx];
      if (cmd) activate(cmd);
    } else if (e.key === 'Escape') {
      setQuery('');
      setOpen(false);
      inputRef.current?.blur();
      onClose?.();
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
          onBlur={() => setTimeout(() => { setOpen(false); onClose?.(); }, 150)}
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
            <kbd className="inline-flex items-center justify-center h-5 px-1.5 rounded text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.06]">{SHORTCUT_HINT}</kbd>
          </span>
        )}
      </div>

      {/* Inline dropdown — non-modal, anchored to the bar */}
      {open && flatCommands.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-2 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-white/[0.08] shadow-xl overflow-hidden z-50 animate-fade-in"
          // Suppress mousedown blur on the input so clicks register on rows.
          onMouseDown={e => e.preventDefault()}
        >
          <div className="max-h-[50vh] overflow-y-auto py-1">
            {groups.map(group => (
              <div key={group.label}>
                <div className="px-4 pt-3 pb-1 pulse-label text-zinc-400 dark:text-zinc-500 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  {group.label === RECENT_GROUP_LABEL && <Clock size={10} />}
                  {group.label}
                </div>
                <ul role="listbox">
                  {group.items.map(cmd => {
                    const idx = cursor++;
                    const isActive = idx === activeIdx;
                    return (
                      <CommandRow
                        key={cmd.id}
                        command={cmd}
                        active={isActive}
                        query={query}
                        popular={popularIds.has(cmd.id)}
                        rowRef={isActive ? activeRowRef : undefined}
                        onHover={() => setActiveIdx(idx)}
                        onActivate={() => activate(cmd)}
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
              {flatCommands.length} {flatCommands.length === 1 ? 'COMMAND' : 'COMMANDS'}
            </span>
          </div>
        </div>
      )}

      {/* Inline dropdown — empty state for an active query that matches nothing */}
      {open && query && flatCommands.length === 0 && (
        <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-white/[0.08] shadow-xl px-4 py-6 text-center z-50 animate-fade-in">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No commands match "{query}".</p>
          <p className="pulse-label text-zinc-400 dark:text-zinc-500 mt-1 uppercase tracking-wider text-[10px]">TRY A SHORTER QUERY</p>
        </div>
      )}
    </div>
  );
};

// ─── GlobalCommandBar (command drawer host) ────────────────────────────────────
// The command surface (Phase 5: the centered modal was retired). Renders nothing
// at rest — the launcher is a button in the sidebar header. When ⌘K (or the
// mobile button / g/ chord / sidebar launcher) dispatches pulse:command-palette-open,
// this opens a top-centered command drawer over a dismiss backdrop, portal'd to
// <body> so it's never clipped by the overflow-hidden view panes (Messages/
// Calendar). `suppressed` is set on views that own their own command surface (the
// Dashboard hero bar); there this is unwired and the view handles ⌘K itself. Hooks
// run every render so the early null-return stays Rules-of-Hooks safe. Collapses
// on Escape, outside-click, or after running a command.

export const GlobalCommandBar: React.FC<{ suppressed?: boolean }> = ({ suppressed = false }) => {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open on pulse:command-palette-open (dispatched by ⌘K, the mobile header
  // button, the g/ chord, and the sidebar command launcher) or an explicit
  // focus request. Not wired when suppressed (the host view owns ⌘K — the
  // Dashboard focuses its hero bar instead).
  useEffect(() => {
    if (suppressed) return;
    const onRequest = () => setExpanded(true);
    window.addEventListener('pulse:command-bar-focus', onRequest);
    window.addEventListener('pulse:command-palette-open', onRequest);
    return () => {
      window.removeEventListener('pulse:command-bar-focus', onRequest);
      window.removeEventListener('pulse:command-palette-open', onRequest);
    };
  }, [suppressed]);

  const collapse = () => setExpanded(false);

  // Renders nothing until opened — the launcher lives in the sidebar header.
  // When opened, a top-centered command drawer over a dismiss backdrop, portal'd
  // to <body> so it's never clipped by the overflow-hidden view panes.
  if (suppressed || !expanded) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[10000] bg-zinc-950/30 dark:bg-zinc-950/50 backdrop-blur-sm animate-fade-in"
      onMouseDown={collapse}
      role="presentation"
    >
      <div
        className="absolute top-[12vh] left-1/2 -translate-x-1/2 w-[min(92vw,36rem)] px-2"
        onMouseDown={e => e.stopPropagation()}
      >
        <InlineCommandPalette
          inputRef={inputRef}
          autoFocusOnMount
          onClose={collapse}
          placeholder={`Run a command — type to search · ${SHORTCUT_HINT}`}
        />
      </div>
    </div>,
    document.body
  );
};
