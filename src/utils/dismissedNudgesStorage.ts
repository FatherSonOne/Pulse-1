/**
 * Dismissed Nudges Storage Manager
 * Persists dismissed nudge IDs in localStorage with 24h TTL
 */

const STORAGE_KEY = 'pulse-dismissed-nudges';
const TTL_HOURS = 24;

export interface DismissedNudge {
  id: string;
  dismissedAt: number; // timestamp in milliseconds
}

/**
 * Get all dismissed nudges that haven't expired (< 24h old)
 */
export const getDismissedNudges = (): Set<string> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Set();

    const dismissed: DismissedNudge[] = JSON.parse(stored);
    const cutoff = Date.now() - TTL_HOURS * 60 * 60 * 1000;

    // Filter out expired dismissals and return Set of active IDs
    const activeDismissals = dismissed.filter(n => n.dismissedAt > cutoff);

    // If we filtered any out, update storage
    if (activeDismissals.length !== dismissed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activeDismissals));
    }

    return new Set(activeDismissals.map(n => n.id));
  } catch (error) {
    console.error('Error reading dismissed nudges from storage:', error);
    return new Set();
  }
};

/**
 * Dismiss a nudge by ID
 */
export const dismissNudge = (nudgeId: string): void => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const dismissed: DismissedNudge[] = stored ? JSON.parse(stored) : [];

    // Check if already dismissed
    if (dismissed.some(n => n.id === nudgeId)) {
      return;
    }

    // Add new dismissal
    dismissed.push({
      id: nudgeId,
      dismissedAt: Date.now(),
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
  } catch (error) {
    console.error('Error dismissing nudge:', error);
  }
};

/**
 * Dismiss multiple nudges at once
 */
export const dismissMultipleNudges = (nudgeIds: string[]): void => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const dismissed: DismissedNudge[] = stored ? JSON.parse(stored) : [];
    const existingIds = new Set(dismissed.map(n => n.id));

    const now = Date.now();
    const newDismissals: DismissedNudge[] = nudgeIds
      .filter(id => !existingIds.has(id))
      .map(id => ({ id, dismissedAt: now }));

    const updated = [...dismissed, ...newDismissals];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error dismissing multiple nudges:', error);
  }
};

/**
 * Undo dismissal of a nudge
 */
export const undoDismissNudge = (nudgeId: string): void => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const dismissed: DismissedNudge[] = JSON.parse(stored);
    const updated = dismissed.filter(n => n.id !== nudgeId);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error undoing nudge dismissal:', error);
  }
};

/**
 * Clear all dismissed nudges (useful for "Mark all as unread")
 */
export const clearAllDismissedNudges = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing dismissed nudges:', error);
  }
};

/**
 * Get count of dismissed nudges
 */
export const getDismissedCount = (): number => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return 0;

    const dismissed: DismissedNudge[] = JSON.parse(stored);
    const cutoff = Date.now() - TTL_HOURS * 60 * 60 * 1000;

    return dismissed.filter(n => n.dismissedAt > cutoff).length;
  } catch (error) {
    console.error('Error getting dismissed count:', error);
    return 0;
  }
};

/**
 * Check if a specific nudge is dismissed
 */
export const isNudgeDismissed = (nudgeId: string): boolean => {
  const dismissedSet = getDismissedNudges();
  return dismissedSet.has(nudgeId);
};
