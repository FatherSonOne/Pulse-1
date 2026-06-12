import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isOverlayOpen } from '../lib/overlayStack';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommandKind = 'navigate' | 'action' | 'help' | 'search';

export interface Command {
  id: string;
  label: string;
  desc?: string;
  /** Font Awesome class name like 'fa-message' OR a lucide icon ElementType. */
  icon: string | React.ElementType;
  kind: CommandKind;
  /** Words considered alongside the label for matching. */
  keywords?: string[];
  /** Group label shown in the palette. Defaults to a kind-derived label. */
  group?: string;
  /**
   * Optional shortcut hint, displayed right-aligned in the row. Author writes
   * it however they want users to read it: 'Ctrl+Shift+R', '⌘E', 'g e', etc.
   * Not interpreted by the palette — purely a presentation hint.
   */
  shortcut?: string;
  run: () => void;
}

/**
 * Dynamic providers contribute commands generated from the current query —
 * used for things like "events matching this string" or "contacts matching".
 */
export type CommandProvider = (query: string) => Command[];

interface RegistryEntry {
  staticCommands: Command[];
  provider?: CommandProvider;
}

// ─── Shortcut normalization ───────────────────────────────────────────────────
// Author writes shortcuts however they like ('Ctrl+Shift+R', '⌘E', 'Cmd+K').
// We canonicalize to a stable token like 'shift+ctrl+r' so we can match it
// against incoming KeyboardEvents on any platform.
//
// Rules:
//   • '⌘' / 'Cmd' / 'Meta' all map to 'mod' on Mac, 'ctrl' on Windows/Linux.
//   • 'Ctrl' maps to 'mod' too — author intent is "the platform meta key",
//     and forcing them to special-case Mac defeats the point.
//   • Modifier order is fixed: mod, shift, alt → key. Ensures that
//     'Shift+Ctrl+R' and 'Ctrl+Shift+R' produce the same canonical form.
//   • Multi-key sequences like 'g e' aren't supported here — they render
//     as chips but won't fire. The runner skips strings with whitespace.

export function canonicalizeShortcut(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const parts = trimmed.split('+').map(p => p.trim().toLowerCase()).filter(Boolean);
  if (parts.length === 0) return null;
  let mod = false, shift = false, alt = false;
  let key = '';
  for (const p of parts) {
    if (p === 'ctrl' || p === 'control' || p === 'cmd' || p === 'command' || p === 'meta' || p === '⌘') {
      mod = true;
    } else if (p === 'shift' || p === '⇧') {
      shift = true;
    } else if (p === 'alt' || p === 'option' || p === '⌥') {
      alt = true;
    } else {
      key = p;
    }
  }
  if (!key) return null;
  return [mod && 'mod', shift && 'shift', alt && 'alt', key].filter(Boolean).join('+');
}

function eventToCanonical(e: KeyboardEvent): string | null {
  const key = e.key.toLowerCase();
  // Skip pure-modifier presses.
  if (key === 'meta' || key === 'control' || key === 'shift' || key === 'alt') return null;
  const mod   = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;
  const alt   = e.altKey;
  // Require at least a mod or alt — bare letters shouldn't fire commands
  // (would clobber regular typing). Single-char shortcuts like '?' are
  // intentionally unsupported by the runner; sections that want them must
  // attach their own listeners.
  if (!mod && !alt) return null;
  return [mod && 'mod', shift && 'shift', alt && 'alt', key].filter(Boolean).join('+');
}

// ─── Fuzzy scoring ────────────────────────────────────────────────────────────
// Subsequence match: every char in `query` must appear in `target` in order,
// not necessarily adjacent. Returns null if no match. Higher score = better.
//
//   • Base    : 1 point per matched char.
//   • Run     : +2 per char that follows the previous match contiguously,
//               so "msg" against "Messages" beats "msg" against "Manage Group".
//   • Prefix  : +5 if the first matched char is at index 0 of `target`.
//   • Word    : +3 each time a matched char follows a separator (space, dash,
//               underscore) — so "go cal" matches "Go to Calendar" strongly.
//   • Length  : -0.05 per char of `target` so shorter targets break ties.
//
// This is fast enough to run on every keystroke for the 100s of commands the
// palette will realistically hold; no need for a library.
function scoreFuzzy(query: string, target: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let score = 0;
  let lastMatchIdx = -2;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1;
      if (ti === lastMatchIdx + 1) score += 2;          // contiguous run
      if (ti === 0 && qi === 0)    score += 5;          // prefix match
      const prev = ti > 0 ? t[ti - 1] : '';
      if (qi === 0 && (prev === ' ' || prev === '-' || prev === '_')) {
        score += 3;                                      // word-start match
      }
      lastMatchIdx = ti;
      qi++;
    }
  }
  if (qi < q.length) return null;
  score -= t.length * 0.05;
  return score;
}

// ─── Context shape ────────────────────────────────────────────────────────────

interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /**
   * Register a list of commands and/or a dynamic provider under a scope.
   * Subsequent registrations with the same scope replace the previous entry —
   * sections call this from a useEffect on mount and on every relevant data
   * change. Returns an unregister function for cleanup.
   */
  register: (
    scope: string,
    entry: { commands?: Command[]; provider?: CommandProvider }
  ) => () => void;
  /** Resolved list of commands matching `query`, used by the palette UI. */
  getMatches: (query: string) => Command[];
}

const noop = () => {};
const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  isOpen: false,
  open: noop,
  close: noop,
  toggle: noop,
  register: () => noop,
  getMatches: () => [],
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export const CommandPaletteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  // Map of scope → entry. We keep this in a ref so registrations don't trigger
  // re-renders of the provider (which would re-render the entire app tree),
  // and bump a `version` integer when the registry changes so consumers that
  // need to react (the palette itself) can read fresh data.
  const registry = useRef<Map<string, RegistryEntry>>(new Map());
  const [registryVersion, setRegistryVersion] = useState(0);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(v => !v), []);

  const register = useCallback(
    (scope: string, entry: { commands?: Command[]; provider?: CommandProvider }) => {
      registry.current.set(scope, {
        staticCommands: entry.commands ?? [],
        provider: entry.provider,
      });
      setRegistryVersion(v => v + 1);
      return () => {
        registry.current.delete(scope);
        setRegistryVersion(v => v + 1);
      };
    },
    []
  );

  const getMatches = useCallback(
    (rawQuery: string): Command[] => {
      const q = rawQuery.trim().toLowerCase();
      const all: Command[] = [];
      for (const entry of registry.current.values()) {
        all.push(...entry.staticCommands);
        if (entry.provider) {
          try {
            all.push(...entry.provider(rawQuery));
          } catch (err) {
            console.error('[CommandPalette] provider failed:', err);
          }
        }
      }
      // De-dupe by id (later registrations win silently). Without this,
      // misconfigured sections that re-register on every render flood results.
      const seen = new Set<string>();
      const deduped = all.filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      if (!q) return deduped;

      // Fuzzy subsequence match with scoring. Each candidate gets the best
      // score across (label, desc, keywords). Score = base hit + bonuses for
      // contiguous runs and word-start matches; null means no match → drop.
      type Scored = { command: Command; score: number };
      const scored: Scored[] = [];
      for (const c of deduped) {
        const labelScore    = scoreFuzzy(q, c.label);
        const descScore     = c.desc      ? scoreFuzzy(q, c.desc)    : null;
        const keywordScores = (c.keywords ?? []).map(k => scoreFuzzy(q, k));
        const candidates = [
          // Weight: label > keywords > desc.
          labelScore   !== null ? labelScore   * 1.0 : null,
          ...keywordScores.map(s => (s !== null ? s * 0.85 : null)),
          descScore    !== null ? descScore    * 0.6 : null,
        ].filter((v): v is number => v !== null);
        if (candidates.length === 0) continue;
        scored.push({ command: c, score: Math.max(...candidates) });
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.map(s => s.command);
    },
    // registryVersion is read implicitly via registry.current; including it
    // forces the memo dependants (palette UI) to recompute on any change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registryVersion]
  );

  // ─── Global shortcut runner ────────────────────────────────────────────────
  // When a registered command has a `shortcut` field, pressing the matching
  // combo from anywhere fires the command's `run()`. Skipped while the user
  // is typing in an input/textarea/contenteditable so shortcuts don't
  // hijack keystrokes during normal text entry. The palette itself opens via
  // its own Cmd+K listener in App.tsx and is unaffected.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
        target?.isContentEditable;
      if (inField) return;
      // A focus-trapped overlay (sheet/modal) is open — don't fire command
      // shortcuts against the surface hidden behind it.
      if (isOverlayOpen()) return;

      const canonical = eventToCanonical(e);
      if (!canonical) return;

      for (const entry of registry.current.values()) {
        for (const cmd of entry.staticCommands) {
          if (!cmd.shortcut) continue;
          const cmdCanonical = canonicalizeShortcut(cmd.shortcut);
          if (cmdCanonical && cmdCanonical === canonical) {
            e.preventDefault();
            cmd.run();
            return;
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // registryVersion ensures the handler closes over the latest registry
    // contents on each registration change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registryVersion]);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ isOpen, open, close, toggle, register, getMatches }),
    [isOpen, open, close, toggle, register, getMatches]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  );
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}

/**
 * Register commands while the calling component is mounted. The `commands`
 * and/or `provider` are re-registered whenever they change. Pass a stable
 * scope string (typically the section name) to avoid flicker.
 */
export function useRegisterCommands(
  scope: string,
  entry: { commands?: Command[]; provider?: CommandProvider }
) {
  const { register } = useCommandPalette();
  // Re-register on every change — the registry de-dupes by id and bumps the
  // version, so the palette stays consistent.
  useEffect(() => {
    return register(scope, entry);
  }, [scope, entry.commands, entry.provider, register]);
}
