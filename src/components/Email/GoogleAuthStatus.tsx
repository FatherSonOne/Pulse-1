// GoogleAuthStatus.tsx - Visual Auth Status Indicator for Email Client
// Shows connection status, expiry warnings, and reconnect option

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

interface GoogleAuthStatusProps {
  onReconnect: () => void;
}

type AuthStatus = 'connected' | 'expiring-soon' | 'expired' | 'checking';

export const GoogleAuthStatus: React.FC<GoogleAuthStatusProps> = ({ onReconnect }) => {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [minutesLeft, setMinutesLeft] = useState<number>(0);

  useEffect(() => {
    checkAuthStatus();

    // Check every minute
    const interval = setInterval(checkAuthStatus, 60000);

    return () => clearInterval(interval);
  }, []);

  const checkAuthStatus = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        setStatus('expired');
        setMinutesLeft(0);
        return;
      }

      // Check Google provider token specifically
      const providerToken = session.provider_token;
      if (!providerToken) {
        setStatus('expired');
        setMinutesLeft(0);
        return;
      }

      // Calculate time until session expiry
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const timeUntilExpiry = expiresAt - Date.now();
      const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60000);

      if (timeUntilExpiry <= 0) {
        setStatus('expired');
        setMinutesLeft(0);
      } else if (minutesUntilExpiry < 10) {
        setStatus('expiring-soon');
        setMinutesLeft(minutesUntilExpiry);
      } else {
        setStatus('connected');
        setMinutesLeft(minutesUntilExpiry);
      }
    } catch (error) {
      console.error('[GoogleAuthStatus] Error checking status:', error);
      setStatus('expired');
    }
  };

  // Don't show anything if we're still checking initially
  if (status === 'checking' && minutesLeft === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {status === 'connected' && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20"
          title={`Session valid for ${minutesLeft} more minutes`}
        >
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            Google Connected
          </span>
        </div>
      )}

      {status === 'expiring-soon' && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20"
          title="Your Google session will expire soon"
        >
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
            Expires in {minutesLeft} min
          </span>
        </div>
      )}

      {status === 'expired' && (
        <button
          onClick={onReconnect}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors"
          title="Click to reconnect your Google account"
        >
          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
          <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
            Session Expired
          </span>
          <svg
            className="w-3 h-3 text-yellow-600 dark:text-yellow-400"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
    </div>
  );
};
