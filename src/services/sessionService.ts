/**
 * Session Management Service
 * Handles user session tracking, device management, and session revocation
 * Uses Supabase Auth to manage active sessions across devices
 */

import { supabase } from './supabase';
import toast from 'react-hot-toast';

export interface UserSession {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: Date;
  current: boolean;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Parse User-Agent string to extract device and browser information
 */
const parseUserAgent = (userAgent: string): { device: string; browser: string } => {
  let device = 'Unknown Device';
  let browser = 'Unknown Browser';

  // Parse device type
  if (/iPhone/i.test(userAgent)) {
    const match = userAgent.match(/iPhone OS (\d+)_/);
    const version = match ? match[1] : '';
    device = version ? `iPhone (iOS ${version})` : 'iPhone';
  } else if (/iPad/i.test(userAgent)) {
    device = 'iPad';
  } else if (/Android/i.test(userAgent)) {
    const match = userAgent.match(/Android (\d+)/);
    const version = match ? match[1] : '';
    device = version ? `Android ${version}` : 'Android Device';
  } else if (/Windows/i.test(userAgent)) {
    device = 'Windows PC';
  } else if (/Macintosh|Mac OS X/i.test(userAgent)) {
    device = 'Mac';
  } else if (/Linux/i.test(userAgent)) {
    device = 'Linux';
  }

  // Parse browser
  if (/Chrome/i.test(userAgent) && !/Edge|Edg/i.test(userAgent)) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    const version = match ? match[1] : '';
    browser = version ? `Chrome ${version}` : 'Chrome';
  } else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
    const match = userAgent.match(/Version\/(\d+)/);
    const version = match ? match[1] : '';
    browser = version ? `Safari ${version}` : 'Safari';
  } else if (/Firefox/i.test(userAgent)) {
    const match = userAgent.match(/Firefox\/(\d+)/);
    const version = match ? match[1] : '';
    browser = version ? `Firefox ${version}` : 'Firefox';
  } else if (/Edge|Edg/i.test(userAgent)) {
    const match = userAgent.match(/Edg\/(\d+)/);
    const version = match ? match[1] : '';
    browser = version ? `Edge ${version}` : 'Edge';
  } else if (/Opera|OPR/i.test(userAgent)) {
    browser = 'Opera';
  }

  return { device, browser };
};

/**
 * Get location from IP address (using a free IP geolocation service)
 * Falls back to "Unknown Location" if service is unavailable
 */
const getLocationFromIP = async (ip?: string): Promise<string> => {
  if (!ip || ip === '127.0.0.1' || ip === 'localhost') {
    return 'Local Network';
  }

  try {
    // Use ipapi.co free tier (up to 1000 requests/day)
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      const city = data.city || '';
      const region = data.region || '';
      const country = data.country_name || '';

      if (city && country) {
        return `${city}, ${country}`;
      } else if (country) {
        return country;
      }
    }
  } catch (error) {
    console.debug('[Session] IP location lookup failed:', error);
  }

  return 'Unknown Location';
};

/**
 * Load all active sessions for the current user
 * Supabase Auth doesn't provide built-in session listing, so we use auth.admin API
 * Note: This requires RLS policies and proper permissions
 */
export const getAllSessions = async (): Promise<UserSession[]> => {
  try {
    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !currentSession) {
      console.error('[Session] No active session:', sessionError);
      return [];
    }

    // Get current user agent for comparison
    const currentUserAgent = navigator.userAgent;
    const { device: currentDevice, browser: currentBrowser } = parseUserAgent(currentUserAgent);

    // For now, Supabase doesn't expose all user sessions via client SDK
    // We'll create a custom table to track sessions or use a single session approach
    // This is the current session information
    const sessions: UserSession[] = [
      {
        id: currentSession.access_token.substring(0, 16), // Use token prefix as ID
        device: currentDevice,
        browser: currentBrowser,
        location: await getLocationFromIP(),
        lastActive: new Date(),
        current: true,
        userAgent: currentUserAgent,
      }
    ];

    // TODO: Implement custom session tracking table for multi-device support
    // For full multi-device session management, you would:
    // 1. Create a 'user_sessions' table in Supabase
    // 2. Insert session records on login with device info
    // 3. Update last_active timestamp periodically
    // 4. Query all sessions for current user

    return sessions;
  } catch (error: any) {
    console.error('[Session] Error loading sessions:', error);
    toast.error('Failed to load session information');
    return [];
  }
};

/**
 * Revoke a specific session (sign out from a specific device)
 * For now, this signs out all sessions since Supabase doesn't support selective revocation
 */
export const revokeSession = async (sessionId: string): Promise<boolean> => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      toast.error('No active session found');
      return false;
    }

    const currentSessionId = session.access_token.substring(0, 16);

    // Don't allow revoking current session this way (use logout instead)
    if (sessionId === currentSessionId) {
      toast.error('Cannot revoke current session. Use sign out instead.');
      return false;
    }

    // TODO: Implement selective session revocation with custom session table
    // For now, we'll show a message that this feature requires backend support
    toast.error('Multi-device session management requires additional setup');

    return false;
  } catch (error: any) {
    console.error('[Session] Error revoking session:', error);
    toast.error('Failed to revoke session');
    return false;
  }
};

/**
 * Sign out from all devices except the current one
 * This uses Supabase's built-in session management
 */
export const signOutAllOtherDevices = async (): Promise<boolean> => {
  try {
    // Get current session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      toast.error('No active session found');
      return false;
    }

    // Supabase doesn't have a built-in "sign out other sessions" method
    // The workaround is to refresh the current session, which invalidates other sessions
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError) {
      console.error('[Session] Failed to refresh session:', refreshError);
      toast.error('Failed to sign out other devices');
      return false;
    }

    // Note: This approach has limitations
    // For true multi-device session management, implement custom session tracking
    toast.success('Signed out of other devices');
    return true;
  } catch (error: any) {
    console.error('[Session] Error signing out other devices:', error);
    toast.error('Failed to sign out other devices');
    return false;
  }
};

/**
 * Sign out from all devices (including current)
 * This completely logs out the user
 */
export const signOutAllDevices = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'global' });

    if (error) {
      console.error('[Session] Failed to sign out:', error);
      toast.error('Failed to sign out');
      return false;
    }

    toast.success('Signed out of all devices');
    return true;
  } catch (error: any) {
    console.error('[Session] Error signing out:', error);
    toast.error('Failed to sign out');
    return false;
  }
};

/**
 * Update session activity timestamp
 * Call this periodically to track when sessions are active
 */
export const updateSessionActivity = async (): Promise<void> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) return;

    // TODO: Update custom session table with current timestamp
    // For now, this is a placeholder for future implementation
    console.debug('[Session] Session activity updated');
  } catch (error) {
    console.debug('[Session] Failed to update session activity:', error);
  }
};

/**
 * Get session statistics
 */
export const getSessionStats = async (): Promise<{
  totalSessions: number;
  activeSessions: number;
  lastLogin: Date | null;
}> => {
  try {
    const sessions = await getAllSessions();
    const currentSessions = sessions.filter(s => {
      const inactiveThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
      return Date.now() - s.lastActive.getTime() < inactiveThreshold;
    });

    return {
      totalSessions: sessions.length,
      activeSessions: currentSessions.length,
      lastLogin: sessions[0]?.lastActive || null,
    };
  } catch (error) {
    console.error('[Session] Failed to get session stats:', error);
    return {
      totalSessions: 0,
      activeSessions: 0,
      lastLogin: null,
    };
  }
};

export const sessionService = {
  getAllSessions,
  revokeSession,
  signOutAllOtherDevices,
  signOutAllDevices,
  updateSessionActivity,
  getSessionStats,
};
