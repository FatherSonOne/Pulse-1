// OfflineIndicator.tsx - Shows offline status and pending sync actions
import React from 'react';

interface OfflineIndicatorProps {
  isOffline: boolean;
  pendingActionsCount: number;
  lastSyncTime: Date | null;
  onSync?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOffline,
  pendingActionsCount,
  lastSyncTime,
  onSync
}) => {
  // Format last sync time
  const formatSyncTime = (date: Date | null): string => {
    if (!date) return 'Never';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!isOffline && pendingActionsCount === 0) {
    // Show subtle "last synced" indicator when online and synced
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-zinc-600"
        role="status"
        aria-live="polite"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
        <span>Synced {formatSyncTime(lastSyncTime)}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
        isOffline
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
      }`}
      role="alert"
      aria-live="assertive"
    >
      {isOffline ? (
        <>
          <i className="fa-solid fa-wifi-slash" aria-hidden="true" />
          <span>Offline</span>
          {pendingActionsCount > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-500/20 rounded text-xs">
              {pendingActionsCount} pending
            </span>
          )}
        </>
      ) : (
        <>
          <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" />
          <span>{pendingActionsCount} to sync</span>
          {onSync && (
            <button
              onClick={onSync}
              className="ml-1 px-2 py-0.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition"
              aria-label="Sync pending changes now"
            >
              Sync Now
            </button>
          )}
        </>
      )}
    </div>
  );
};

/**
 * Compact version for header
 */
export const OfflineIndicatorCompact: React.FC<{
  isOffline: boolean;
  pendingActionsCount: number;
}> = ({ isOffline, pendingActionsCount }) => {
  if (!isOffline && pendingActionsCount === 0) {
    return null;
  }

  return (
    <div
      className={`w-8 h-8 rounded-lg flex items-center justify-center relative ${
        isOffline
          ? 'bg-amber-500/10 text-amber-500'
          : 'bg-blue-500/10 text-blue-500'
      }`}
      title={isOffline ? `Offline (${pendingActionsCount} pending)` : `${pendingActionsCount} changes to sync`}
      role="status"
      aria-label={isOffline ? `Offline with ${pendingActionsCount} pending changes` : `${pendingActionsCount} changes pending sync`}
    >
      {isOffline ? (
        <i className="fa-solid fa-wifi-slash text-sm" aria-hidden="true" />
      ) : (
        <i className="fa-solid fa-cloud-arrow-up text-sm" aria-hidden="true" />
      )}
      {pendingActionsCount > 0 && (
        <span
          className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
          aria-hidden="true"
        >
          {pendingActionsCount > 9 ? '9+' : pendingActionsCount}
        </span>
      )}
    </div>
  );
};

export default OfflineIndicator;
