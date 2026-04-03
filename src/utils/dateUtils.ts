/**
 * Date utility functions for message timestamps and date dividers
 */

/**
 * Check if two dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Format date as "Today", "Yesterday", or formatted date
 */
export function formatDateDivider(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today.getTime() - messageDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    // Show day of week for last 7 days
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  } else if (date.getFullYear() === now.getFullYear()) {
    // Same year: "Monday, Jan 10"
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  } else {
    // Different year: "Monday, Jan 10, 2024"
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  }
}

/**
 * Format timestamp as relative time or absolute time
 * - "Just now" for < 1 minute
 * - "5 min ago" for < 1 hour
 * - "2 hours ago" for < 24 hours
 * - "10:30 AM" for today
 * - "Yesterday 10:30 AM" for yesterday
 * - "Mon 10:30 AM" for last 7 days
 * - "Jan 10 10:30 AM" for older
 */
export function formatSmartTimestamp(date: Date | undefined): string {
  const now = new Date();
  if (!date) return '';

  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  } else if (diffHours < 24 && isSameDay(date, now)) {
    return timeStr;
  } else if (diffDays === 1) {
    return `Yesterday ${timeStr}`;
  } else if (diffDays < 7) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    return `${dayName} ${timeStr}`;
  } else if (date.getFullYear() === now.getFullYear()) {
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${dateStr} ${timeStr}`;
  } else {
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${dateStr} ${timeStr}`;
  }
}

/**
 * Format full timestamp for hover tooltip
 */
export function formatFullTimestamp(date: Date | undefined): string {
  if (!date) return '';
  
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}


/**
 * Format a timestamp as a compact relative time string.
 * Used by Analytics views (Observatory dashboard).
 * Returns: "5m ago", "3h ago", "2d ago", or a localized date for older.
 */
export function formatTimeAgo(timestamp: string | undefined): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Check if a date divider should be shown between two messages
 */
export function shouldShowDateDivider(prevDate: Date | null, currentDate: Date): boolean {
  if (!prevDate) return true;
  return !isSameDay(prevDate, currentDate);
}
