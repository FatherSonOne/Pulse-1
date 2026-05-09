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
    <div className="flex items-center">
      {status === 'connected' && (
        <div
          className="flex items-center gap-1.5 h-7 px-2 rounded-md text-stone-500 dark:text-zinc-500"
          title={`Session valid for ${minutesLeft} more minutes`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]">
            Google
          </span>
        </div>
      )}

      {status === 'expiring-soon' && (
        <div
          className="flex items-center gap-1.5 h-7 px-2 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400"
          title="Your Google session will expire soon"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] tabular-nums">
            Expires {minutesLeft}m
          </span>
        </div>
      )}

      {status === 'expired' && (
        <button
          onClick={onReconnect}
          className="flex items-center gap-1.5 h-7 px-2 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors"
          title="Click to reconnect your Google account"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]">
            Reconnect
          </span>
        </button>
      )}
    </div>
  );
};
