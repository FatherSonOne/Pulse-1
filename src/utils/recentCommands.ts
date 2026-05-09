// Persistent command-palette history for the global ⌘K palette.
//
//   • Recents — most-recent-first list (capped at MAX).
//   • Counts  — per-id usage tally that survives recents falling off the list.
//
// Both live in localStorage under separate keys. The Recents list is what we
// pin into the "Recent" empty-state group; the Counts feed the "popular"
// star badge for the user's top-N most-used commands.

const RECENTS_KEY = 'pulse:command-palette:recents';
const COUNTS_KEY  = 'pulse:command-palette:counts';
const MAX = 20;

export function getRecentCommandIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function readCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(COUNTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function pushRecentCommand(id: string): void {
  if (!id) return;
  try {
    const recents = getRecentCommandIds().filter(existing => existing !== id);
    recents.unshift(id);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, MAX)));

    const counts = readCounts();
    counts[id] = (counts[id] ?? 0) + 1;
    localStorage.setItem(COUNTS_KEY, JSON.stringify(counts));
  } catch {
    // Storage quota or disabled — silently ignore.
  }
}

/**
 * Returns the top-N most-used command ids, sorted by count descending. Used
 * to mark "popular" rows with a star. Ties broken by id alphabetical for
 * deterministic rendering across reloads.
 */
export function getMostUsedCommandIds(limit = 3): string[] {
  const counts = readCounts();
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id]) => id);
}

export function clearRecentCommands(): void {
  try {
    localStorage.removeItem(RECENTS_KEY);
    localStorage.removeItem(COUNTS_KEY);
  } catch {
    // ignore
  }
}

// Platform detection — used to render shortcut hints. Falls back to Mac glyph
// only when navigator is unavailable (SSR), since Pulse is web-app delivery.
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return true;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

/** Renders "⌘K" on Mac, "Ctrl+K" elsewhere. */
export function shortcutHint(key: string): string {
  return isMac() ? `⌘${key.toUpperCase()}` : `Ctrl+${key.toUpperCase()}`;
}
