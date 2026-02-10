import { useState, useEffect } from 'react';

/**
 * OnlineStatus Component
 * Displays a subtle indicator when the app is offline
 * Auto-hides when online, shows when offline
 */
export function OnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOffline, setShowOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Show "Back online" briefly
      setShowOffline(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't render anything when online (most of the time)
  if (isOnline && !showOffline) {
    return null;
  }

  return (
    <div
      className={`
        fixed top-4 left-1/2 -translate-x-1/2 z-[9999]
        px-4 py-2 rounded-full
        flex items-center gap-2
        text-sm font-medium
        shadow-lg
        transition-all duration-300
        ${isOnline
          ? 'bg-emerald-500 text-white'
          : 'bg-zinc-900 text-white dark:bg-zinc-800'
        }
      `}
    >
      <span className={`
        w-2 h-2 rounded-full
        ${isOnline ? 'bg-white' : 'bg-red-400 animate-pulse'}
      `} />
      <span>
        {isOnline ? 'Back online' : 'Offline mode'}
      </span>
    </div>
  );
}
