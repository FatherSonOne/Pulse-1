import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
      return deduped.filter(c => {
        const hay = (
          c.label +
          ' ' +
          (c.desc ?? '') +
          ' ' +
          (c.keywords?.join(' ') ?? '')
        ).toLowerCase();
        return hay.includes(q);
      });
    },
    // registryVersion is read implicitly via registry.current; including it
    // forces the memo dependants (palette UI) to recompute on any change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registryVersion]
  );

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
