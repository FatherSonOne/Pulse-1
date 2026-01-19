/**
 * Update Notification Component
 * Shows a prompt when a new version of the app is available
 */

import React from 'react';

interface UpdateNotificationProps {
  isVisible: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
  className?: string;
}

export function UpdateNotification({
  isVisible,
  onUpdate,
  onDismiss,
  className = '',
}: UpdateNotificationProps) {
  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 ${className}`}
      style={{ animation: 'slideUp 0.3s ease-out' }}
    >
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <i className="fa fa-download text-blue-400" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-white font-medium mb-1">Update Available</h4>
            <p className="text-gray-400 text-sm mb-3">
              A new version of Pulse is ready. Update now for the latest features and improvements.
            </p>

            <div className="flex gap-2">
              <button
                onClick={onUpdate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
              >
                Update Now
              </button>
              <button
                onClick={onDismiss}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded transition-colors"
              >
                Later
              </button>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-gray-500 hover:text-gray-400 p-1"
            aria-label="Dismiss"
          >
            <i className="fa fa-times" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Offline Banner Component
 * Shows when the app is offline
 */
interface OfflineBannerProps {
  pendingActions?: number;
  onRetry?: () => void;
  className?: string;
}

export function OfflineBanner({
  pendingActions = 0,
  onRetry,
  className = '',
}: OfflineBannerProps) {
  return (
    <div className={`bg-yellow-600/90 text-white px-4 py-2 ${className}`}>
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <i className="fa fa-wifi" style={{ opacity: 0.6 }} />
          <span className="text-sm font-medium">
            You're offline
            {pendingActions > 0 && (
              <span className="text-yellow-200 ml-2">
                ({pendingActions} pending {pendingActions === 1 ? 'action' : 'actions'})
              </span>
            )}
          </span>
        </div>

        {onRetry && (
          <button
            onClick={onRetry}
            className="text-sm font-medium hover:underline"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Syncing Indicator Component
 */
interface SyncingIndicatorProps {
  isSyncing: boolean;
  itemsRemaining?: number;
  className?: string;
}

export function SyncingIndicator({
  isSyncing,
  itemsRemaining = 0,
  className = '',
}: SyncingIndicatorProps) {
  if (!isSyncing && itemsRemaining === 0) return null;

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      {isSyncing ? (
        <>
          <i className="fa fa-sync fa-spin text-blue-400" />
          <span className="text-gray-400">
            Syncing{itemsRemaining > 0 ? ` (${itemsRemaining} remaining)` : '...'}
          </span>
        </>
      ) : (
        <>
          <i className="fa fa-clock text-yellow-400" />
          <span className="text-gray-400">
            {itemsRemaining} pending
          </span>
        </>
      )}
    </div>
  );
}

export default UpdateNotification;
