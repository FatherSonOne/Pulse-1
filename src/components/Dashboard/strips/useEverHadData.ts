import { useCallback, useState } from 'react';

/**
 * Persistent "this strip has had data at least once in this workspace" flag.
 *
 * Fresh workspaces stay quiet — the empty state ("CAUGHT UP", "No open
 * decisions") only appears once the strip has genuinely seen activity. After
 * that, the empty state signals "actually clear" rather than "never had data."
 *
 * Returns [everSeen, markSeen]. Callers invoke markSeen() the first time their
 * data load returns non-empty rows; the flag persists in localStorage and is
 * scoped per (strip, workspace).
 */
export function useEverHadData(key: string | null | undefined): [boolean, () => void] {
  const storageKey = key ? `pulse_strip_seen:${key}` : null;

  const [everSeen, setEverSeen] = useState<boolean>(() => {
    if (!storageKey) return false;
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  const markSeen = useCallback(() => {
    if (!storageKey || everSeen) return;
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // localStorage unavailable (private mode, quota) — degrade gracefully
    }
    setEverSeen(true);
  }, [storageKey, everSeen]);

  return [everSeen, markSeen];
}
