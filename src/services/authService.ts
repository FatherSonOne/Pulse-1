import { User, Contact, CalendarEvent, Task, Email } from '../types';
import { dataService } from './dataService';
import { supabase } from './supabase';
import type { User as SupabaseUser, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

// Get the correct redirect URL for OAuth
// On native platforms, use custom scheme to redirect back to the app
const getRedirectUrl = (path: string = '/') => {
  if (Capacitor.isNativePlatform()) {
    // For native apps, use custom URL scheme that Android intent filter will intercept
    // This returns the user to the native app after OAuth completes
    return `io.qntmpulse.app://auth${path}`;
  }

  // For the Electron desktop app, use the pulse:// custom protocol so the OS
  // can route the OAuth callback back into the running Electron process.
  if ((window as any).electronAPI?.isElectron) {
    return `pulse://auth/callback`;
  }

  // In development, always use current origin (localhost)
  // In production, use VITE_APP_URL if set, otherwise use current origin
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (isDevelopment) {
    // Force localhost redirect for development
    return `${window.location.origin}${path}`;
  }

  // Production: use VITE_APP_URL if set, otherwise current origin
  const appUrl = import.meta.env.VITE_APP_URL;
  if (appUrl) {
    return `${appUrl}${path}`;
  }

  return `${window.location.origin}${path}`;
};

// Extend Window for Google Identity Services
// Extend Window for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const USER_KEY = 'pulse_user_session';
const GOOGLE_CONTACTS_READONLY_SCOPE = 'https://www.googleapis.com/auth/contacts.readonly';

// "Keep me logged in" sentinel: if the user has opted out of persistent sessions,
// auto-logout when the browser is restarted (sessionStorage is cleared on close).
// We set a sessionStorage sentinel on every page load. If it's missing on load AND
// the user has opted out, this is a fresh browser launch → clear the session.
(() => {
  try {
    const keepLoggedIn = localStorage.getItem('pulse_keep_logged_in');
    const sessionAlive = sessionStorage.getItem('pulse_session_active');

    if (keepLoggedIn === 'false' && !sessionAlive) {
      // Fresh browser launch with "keep logged in" disabled — clear session
      localStorage.removeItem(USER_KEY);
      // Clear Supabase auth tokens (key prefix varies by project)
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
    }

    // Mark this tab/session as active
    sessionStorage.setItem('pulse_session_active', '1');
  } catch {
    // Ignore errors in environments where storage is unavailable
  }
})();

// Convert Supabase user to app User type
const mapSupabaseUser = (supabaseUser: SupabaseUser): User => {
  const metadata = supabaseUser.user_metadata || {};
  const appMetadata = supabaseUser.app_metadata || {};

  // Determine which providers are linked.
  // Supabase surfaces the primary provider in app_metadata.provider and lists all
  // linked identities in the identities array.
  const primaryProvider: string = appMetadata.provider || '';
  const identityProviders: string[] = (supabaseUser.identities || []).map(
    (i: { provider: string }) => i.provider
  );
  const allProviders = new Set([primaryProvider, ...identityProviders]);

  const isGoogleConnected  = allProviders.has('google');
  // Supabase uses the provider key 'azure' for Microsoft accounts
  const isMicrosoftConnected = allProviders.has('azure');

  // Check for admin role from app_metadata (set via Supabase dashboard or RLS)
  // or user_metadata (set by user profile)
  const role = appMetadata.role || metadata.role || 'user';
  const isAdmin = role === 'admin' || appMetadata.is_admin === true || metadata.is_admin === true;

  // Microsoft users: Supabase stores the display name in user_metadata.name or full_name.
  // For Microsoft accounts the avatar comes from metadata.avatar_url or picture.
  const displayName = metadata.full_name || metadata.name || supabaseUser.email?.split('@')[0] || 'User';

  return {
    id: supabaseUser.id,
    name: displayName,
    email: supabaseUser.email || '',
    avatarUrl: metadata.avatar_url || metadata.picture ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0D8ABC&color=fff`,
    googleConnected: isGoogleConnected,
    microsoftConnected: isMicrosoftConnected,
    connectedProviders: {
      google: isGoogleConnected,
      microsoft: isMicrosoftConnected,
      icloud: false // iCloud OAuth not supported by Supabase
    },
    role: role as 'admin' | 'moderator' | 'user',
    isAdmin
  };
};

// Google OAuth scopes for the SHARED LOGIN flow — Calendar, Contacts, and Drive.
//
// Gmail is deliberately EXCLUDED here. The gmail.readonly/compose/modify scopes
// are RESTRICTED, which makes Google's verification require a paid CASA security
// assessment. Keeping Gmail out of login means the only sensitive scopes left
// (calendar.*, contacts.readonly) are free to verify, so the app can publish to
// Production for ALL users with no CASA. Gmail is a separate, owner-only grant
// via a dedicated OAuth client kept in Testing — see GMAIL_SCOPES below and the
// Gmail connect flow. (Scope split, 2026-06.)
const GOOGLE_SCOPES = [
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/contacts.readonly', // Google People API for contacts
  'https://www.googleapis.com/auth/drive.file', // Google Drive API for archive export (only files created by app)
].join(' ');

// Gmail scopes — RESTRICTED (gmail.readonly/compose/modify) + sensitive
// (gmail.send). NOT part of login; requested only via the private Gmail grant
// (separate Testing OAuth client) when the owner enables the Email feature, so
// the production login flow stays CASA-free. Exported for the Gmail connect flow.
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ');

const scopeValueToString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(' ');
  return '';
};

/**
 * Returns true if the current session's Google OAuth scope set includes
 * the contacts.readonly scope. Google's January 2026 granular consent
 * rollout means users can decline this scope mid-auth while still granting
 * Gmail/Drive/Calendar — Pulse must check post-callback rather than
 * assuming the scope is present.
 *
 * The provider scope is stored on the session's metadata. Format varies
 * between provider responses; this helper handles space-delimited and
 * comma-delimited forms.
 */
export function hasContactsScope(session: Session | null | undefined): boolean {
  if (!session) return false;

  const sessionWithProviderMeta = session as Session & {
    provider_token_metadata?: { scope?: unknown };
    scope?: unknown;
  };
  const meta =
    session.user.app_metadata?.scope ??
    session.user.user_metadata?.scope ??
    sessionWithProviderMeta.provider_token_metadata?.scope ??
    sessionWithProviderMeta.scope ??
    '';
  const scopes = scopeValueToString(meta).split(/[\s,]+/).filter(Boolean);
  return scopes.includes(GOOGLE_CONTACTS_READONLY_SCOPE);
}

const hasGoogleProvider = (session: Session): boolean => {
  const provider = session.user.app_metadata?.provider;
  const identities = session.user.identities ?? [];
  return provider === 'google' || identities.some(identity => identity.provider === 'google');
};

const dispatchContactsScopeMissingIfNeeded = (session: Session | null): void => {
  if (
    session &&
    hasGoogleProvider(session) &&
    typeof window !== 'undefined' &&
    !hasContactsScope(session)
  ) {
    window.dispatchEvent(new CustomEvent('pulse:contacts:scope-missing'));
  }
};

// Real Google OAuth Login via Supabase
// Using 'offline' access_type ensures we get a refresh token for long-lived sessions
export const loginWithGoogle = async (): Promise<User> => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getRedirectUrl('/'),
      queryParams: {
        // 'offline' access type asks Google for a refresh token.
        access_type: 'offline',
        // Account chooser only — NOT forced consent. Google returns a refresh
        // token on the FIRST consent (when the user has no prior grant); we
        // persist it server-side on SIGNED_IN (Tier 3b → user_google_tokens)
        // and the backend refreshes provider tokens from that stored copy. So
        // forcing 'consent' on every login is no longer needed — it only
        // re-showed the full permission screen each time, which users hated.
        // If the stored grant is ever lost/expired (e.g. the 7-day refresh-
        // token expiry on an unverified/Testing OAuth app, or a revoke), the
        // Settings "reconnect" path (connectProvider) still forces consent to
        // re-seed the stored token.
        prompt: 'select_account',
        // Include granted scopes in token response
        include_granted_scopes: 'true',
      },
      scopes: GOOGLE_SCOPES
    }
  });

  if (error) {
    console.error('Google login error:', error);
    throw new Error(error.message);
  }

  // OAuth redirects, so we won't reach here immediately
  // The user will be set via onAuthStateChange after redirect
  // Return a placeholder that will be replaced
  return new Promise((resolve, reject) => {
    // This promise resolves when auth state changes after redirect
    const timeout = setTimeout(() => {
      reject(new Error('Login timeout - please try again'));
    }, 30000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        clearTimeout(timeout);
        subscription.unsubscribe();
        const user = mapSupabaseUser(session.user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        resolve(user);
      }
    });
  });
};

// Microsoft Graph API scopes for login — covers identity + mail + calendar + contacts
// These must also be added as API permissions in your Azure App Registration
const MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'Mail.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'Calendars.Read',
  'Calendars.ReadWrite',
  'Contacts.Read',
].join(' ');

// Login with Microsoft (Azure AD)
// Supabase handles the PKCE flow; tokens are stored in the Supabase session.
// The provider access_token in the session can be used for Graph API calls.
export const loginWithMicrosoft = async (): Promise<User> => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo: getRedirectUrl('/'),
      scopes: MICROSOFT_SCOPES,
    }
  });

  if (error) {
    console.error('Microsoft login error:', error);
    throw new Error(error.message);
  }

  // signInWithOAuth redirects the browser — this promise resolves after the
  // user returns from Microsoft and Supabase fires SIGNED_IN.
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Login timeout - please try again'));
    }, 30000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        clearTimeout(timeout);
        subscription.unsubscribe();
        const user = mapSupabaseUser(session.user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        resolve(user);
      }
    });
  });
};

// Email/Password Login
export const loginWithEmail = async (email: string, password: string): Promise<User> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error('Email login error:', error);
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Login failed - no user returned');
  }

  const user = mapSupabaseUser(data.user);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
};

// Thrown by signUpWithEmail when the project requires email confirmation and
// signUp returned a user but NO session — the caller is NOT logged in and must
// prompt the user to confirm via the emailed link. Supabase also returns a
// session-less obfuscated user when the email is already registered
// (anti-enumeration), so this same signal covers the duplicate-email case.
// Modeled as an error (not a changed return type) so the existing
// Promise<User> consumers — AuthContext's handleLogin wrapper included — keep
// type-checking; they already catch/rethrow.
export class EmailConfirmationRequiredError extends Error {
  constructor(public readonly emailAddress: string) {
    super('Email confirmation required');
    this.name = 'EmailConfirmationRequiredError';
  }
}

// Email/Password Signup
export const signUpWithEmail = async (email: string, password: string, name: string): Promise<User> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name
      }
    }
  });

  if (error) {
    console.error('Signup error:', error);
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Signup failed - no user returned');
  }

  // No session → not logged in. Confirmation pending (or email already taken).
  // Don't persist a bogus session; signal the UI so it stops the spinner and
  // tells the user to confirm, instead of waiting for a SIGNED_IN that never
  // fires.
  if (!data.session) {
    throw new EmailConfirmationRequiredError(email);
  }

  const user = mapSupabaseUser(data.user);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
};

// Session refresh threshold - refresh if less than 30 minutes remaining
// This gives plenty of buffer before expiry
const SESSION_REFRESH_THRESHOLD = 30 * 60 * 1000; // 30 minutes

// Get current session user (checks Supabase session first, then localStorage)
export const getSessionUser = async (): Promise<User | null> => {
  console.log('[Auth] Getting session user...');

  try {
    // Add timeout to prevent hanging if Supabase is slow or unreachable
    const timeoutPromise = new Promise<{ data: { session: null }, error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null }, error: new Error('Session check timeout') }), 10000)
    );

    const { data: { session }, error } = await Promise.race([
      supabase.auth.getSession(),
      timeoutPromise
    ]);

    if (error) {
      // Suppress expected "Invalid Refresh Token" errors (happens when user not logged in)
      // Only log these as debug-level to avoid console noise
      if (error.message?.includes('Refresh Token') || error.message?.includes('Invalid')) {
        console.debug('[Auth Debug] No valid session found (expected when not logged in)');
        localStorage.removeItem(USER_KEY);
        await supabase.auth.signOut().catch(() => {}); // Ignore signOut errors
        return null;
      }
      // Log other session errors as warnings (unexpected issues)
      console.warn('[Auth] Session check failed:', error.message);
    }

    if (session?.user) {
      console.log('[Auth] Active session found for:', session.user.email);

      // Check session expiry and refresh proactively
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const timeUntilExpiry = expiresAt - Date.now();

      console.log('[Auth] Session expires in:', Math.round(timeUntilExpiry / 60000), 'minutes');

      // Refresh if within threshold (30 minutes by default)
      // This is much more aggressive than waiting until 5 minutes
      if (timeUntilExpiry < SESSION_REFRESH_THRESHOLD && timeUntilExpiry > 0) {
        console.log('[Auth] Session expiring within threshold, refreshing proactively...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn('[Auth] Session refresh failed:', refreshError.message);
          // Don't fail the whole operation - we still have a valid session
        } else if (refreshData.session) {
          const newExpiresAt = refreshData.session.expires_at ? refreshData.session.expires_at * 1000 : 0;
          console.log('[Auth] Session refreshed successfully');
          console.log('[Auth] New expiry:', new Date(newExpiresAt).toISOString());
          console.log('[Auth] Session now valid for:', Math.round((newExpiresAt - Date.now()) / 60000), 'minutes');
        }
      }

      const user = mapSupabaseUser(session.user);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    }

    console.log('[Auth] No active session found');
  } catch (err: any) {
    // Handle invalid refresh token error (expected when user not logged in)
    if (err?.message?.includes('Refresh Token') || err?.name === 'AuthApiError') {
      console.debug('[Auth Debug] No valid session found (expected when not logged in)');
      localStorage.removeItem(USER_KEY);
      await supabase.auth.signOut().catch(() => {});
      return null;
    }
    // Log unexpected errors as warnings
    console.warn('[Auth] Session check error:', err);
  }

  // Fallback to localStorage for cached user (will be validated on next API call)
  const cached = localStorage.getItem(USER_KEY);
  if (cached) {
    console.log('[Auth] Using cached user from localStorage');
    return JSON.parse(cached);
  }

  console.log('[Auth] No cached user found');
  return null;
};

// Synchronous version for initial render (uses cached data)
export const getSessionUserSync = (): User | null => {
  const cached = localStorage.getItem(USER_KEY);
  return cached ? JSON.parse(cached) : null;
};

// Logout with timeout to prevent hanging
export const logoutUser = async (): Promise<void> => {
  // Clear local storage immediately so UI updates right away
  localStorage.removeItem(USER_KEY);

  try {
    // Add timeout to signOut to prevent hanging if network is slow
    const signOutPromise = supabase.auth.signOut();
    const timeoutPromise = new Promise<{ error: Error }>((resolve) =>
      setTimeout(() => resolve({ error: new Error('Sign out timeout') }), 5000)
    );

    const { error } = await Promise.race([signOutPromise, timeoutPromise]);
    if (error) {
      console.warn('Logout completed with warning:', error.message);
    }
  } catch (err) {
    console.warn('Logout exception (session cleared locally):', err);
  }
};

// Helper function to fetch with timeout
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = 5000): Promise<Response | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn('Request timed out:', url);
    }
    return null;
  }
};

// Revoke Google OAuth access completely (meets Google OAuth requirements)
export const revokeGoogleAccess = async (): Promise<void> => {
  // Clear local state immediately so UI updates right away
  localStorage.removeItem(USER_KEY);

  // Clear any Google-related localStorage items immediately
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.toLowerCase().includes('google') || key.toLowerCase().includes('gmail') || key.toLowerCase().includes('calendar'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));

  // Clear any Google Identity Services state
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }

  try {
    // Get current session to check if user is connected via Google
    // Add timeout to prevent hanging
    const sessionPromise = supabase.auth.getSession();
    const sessionTimeout = new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), 3000)
    );

    const { data: { session } } = await Promise.race([sessionPromise, sessionTimeout]);

    // Supabase stores tokens in session.provider_token and session.provider_refresh_token
    const accessToken = (session as any)?.provider_token || (session as any)?.access_token;
    const refreshToken = (session as any)?.provider_refresh_token || (session as any)?.refresh_token;

    // Try to revoke tokens in parallel with timeout (best effort, don't block on failure)
    const revokePromises: Promise<void>[] = [];

    if (accessToken) {
      revokePromises.push(
        fetchWithTimeout(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`,
          { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
          3000
        ).then(response => {
          if (response && !response.ok) {
            console.warn('Token revocation returned status:', response.status);
          }
        })
      );
    }

    if (refreshToken) {
      revokePromises.push(
        fetchWithTimeout(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`,
          { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
          3000
        ).then(response => {
          if (response && !response.ok) {
            console.warn('Refresh token revocation returned status:', response.status);
          }
        })
      );
    }

    // Wait for revoke attempts but don't fail if they timeout
    await Promise.allSettled(revokePromises);

    // Sign out from Supabase (this also clears the session)
    // logoutUser already has its own timeout
    await logoutUser();

  } catch (error) {
    console.warn('Error during Google access revocation (local state already cleared):', error);
    // Try to sign out anyway
    try {
      await logoutUser();
    } catch {
      // Ignore - local state is already cleared
    }
  }
};

// Disconnect Google account and redirect to Google account management
export const disconnectGoogleAccount = async (): Promise<void> => {
  // Revoke access (this function handles its own errors and timeouts)
  await revokeGoogleAccess();

  // Open Google Account management page where user can see and manage all connected apps
  // This meets Google's requirement for providing a way to manage account access
  window.open(
    'https://myaccount.google.com/permissions?continue=https://myaccount.google.com/security',
    '_blank',
    'noopener,noreferrer'
  );
};

// Subscribe to auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    console.log('[Auth] Auth state changed:', event);

    // Handle token refresh events
    if (event === 'TOKEN_REFRESHED') {
      if (session) {
        console.log('[Auth] Token refreshed successfully');
        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
        console.log('[Auth] New session expires:', new Date(expiresAt).toISOString());
      } else {
        console.log('[Auth] Token refresh failed, clearing session');
        localStorage.removeItem(USER_KEY);
        callback(null);
        return;
      }
    }

    // Handle sign out — clear the Google token negative cache so the next
    // sign-in picks up a fresh provider_token immediately.
    if (event === 'SIGNED_OUT') {
      console.log('[Auth] User signed out');
      localStorage.removeItem(USER_KEY);
      import('./googleCalendarService')
        .then(m => m.resetGoogleCalendarTokenCache?.())
        .catch(() => {});
      callback(null);
      return;
    }

    // Fresh sign-in (including the redirect back from a Google OAuth flow)
    // can produce a brand-new provider_token — clear the negative cache.
    if (event === 'SIGNED_IN') {
      import('./googleCalendarService')
        .then(m => m.resetGoogleCalendarTokenCache?.())
        .catch(() => {});
      // Persist the Google provider_refresh_token to the backend now, while it
      // is guaranteed present (Pulse forces consent + offline access on login).
      // Supabase drops it from the session after its first JWT refresh, so the
      // stored copy is what lets the backend keep refreshing provider tokens
      // past the ~1h mark without forcing a re-login (Tier 3b).
      const providerRefreshToken = (session as { provider_refresh_token?: string } | null)
        ?.provider_refresh_token;
      if (providerRefreshToken) {
        import('./google/googleTokenRefresh')
          .then(m => m.storeGoogleRefreshToken(providerRefreshToken))
          .catch(() => {});
      }
      dispatchContactsScopeMissingIfNeeded(session);
    }

    if (session?.user) {
      const user = mapSupabaseUser(session.user);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      callback(user);
    } else if (event !== 'TOKEN_REFRESHED') {
      // Only clear if not a token refresh event (which we handle above)
      localStorage.removeItem(USER_KEY);
      callback(null);
    }
  });

  return () => subscription.unsubscribe();
};

/**
 * Force refresh the current session
 * Call this when you need to ensure you have fresh tokens
 * (e.g., before making Google API calls)
 */
export const forceRefreshSession = async (): Promise<boolean> => {
  try {
    console.log('[Auth] Force refreshing session...');
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('[Auth] Force refresh failed:', error.message);
      return false;
    }
    
    if (data.session) {
      const expiresAt = data.session.expires_at ? data.session.expires_at * 1000 : 0;
      console.log('[Auth] Force refresh successful');
      console.log('[Auth] Session now expires:', new Date(expiresAt).toISOString());
      
      // Update cached user
      if (data.session.user) {
        const user = mapSupabaseUser(data.session.user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }
      
      return true;
    }
    
    return false;
  } catch (err) {
    console.error('[Auth] Force refresh error:', err);
    return false;
  }
};

/**
 * Check if the current session needs refresh
 * Returns true if session is valid and doesn't need refresh
 */
export const isSessionValid = async (): Promise<boolean> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return false;
    
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const timeUntilExpiry = expiresAt - Date.now();
    
    // Consider invalid if less than 5 minutes remaining
    return timeUntilExpiry > 5 * 60 * 1000;
  } catch {
    return false;
  }
};

// Connect additional provider (link account)
export const connectProvider = async (provider: 'google' | 'microsoft' | 'icloud'): Promise<boolean> => {
  if (provider === 'icloud') {
    console.warn('iCloud OAuth is not supported by Supabase');
    return false;
  }

  const supabaseProvider = provider === 'microsoft' ? 'azure' : provider;

  // Provider-specific options. The bare linkIdentity call (no scopes, no
  // offline query params) only links basic identity — it does NOT obtain the
  // Google API scopes or the refresh token, so the "reconnect via Settings"
  // recovery path that our error toasts point users to would silently fail to
  // restore Calendar/Gmail/Contacts access. Mirror loginWithGoogle here.
  const options =
    provider === 'google'
      ? {
          redirectTo: getRedirectUrl('/settings'),
          scopes: GOOGLE_SCOPES,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent select_account',
            include_granted_scopes: 'true',
          },
        }
      : {
          // Microsoft/Azure — offline_access is included in MICROSOFT_SCOPES.
          redirectTo: getRedirectUrl('/settings'),
          scopes: MICROSOFT_SCOPES,
        };

  const { error } = await supabase.auth.linkIdentity({
    provider: supabaseProvider,
    options,
  });

  if (error) {
    console.error(`Failed to connect ${provider}:`, error);
    return false;
  }

  return true;
};

// Mock Google Calendar Event Creation
export const createGoogleCalendarEvent = async (title: string, attendees: string[]): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`https://meet.google.com/abc-${Math.random().toString(36).substr(2, 4)}-xyz`);
    }, 1000);
  });
};

// Mock Google Doc Creation
export const createGoogleDoc = async (title: string, content: string): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`https://docs.google.com/document/d/1${Math.random().toString(36).substr(2, 10)}/edit`);
    }, 1500);
  });
};

// Fetch Events from Supabase
export const fetchCalendarEvents = async (): Promise<CalendarEvent[]> => {
  return dataService.getEvents();
};

// Fetch Tasks from Supabase
export const fetchTasks = async (): Promise<Task[]> => {
  return dataService.getTasks();
};

// Mock Fetch Emails
export const fetchEmails = async (provider: string): Promise<Email[]> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const emails: Email[] = [
                // Gmail - Inbox
                { id: 'e1', provider: 'google', from: 'security@google.com', subject: 'Security Alert: New login', snippet: 'New login detected on your account from Chrome on Windows...', body: 'We detected a new login to your Google Account on a Windows device. If this was you, you don\'t need to do anything. If not, please secure your account immediately.', date: new Date(), read: false, folder: 'inbox', labels: ['important'] },
                { id: 'e2', provider: 'google', from: 'sarah.j@pulse.ai', subject: 'Project Q3 Update', snippet: 'Here are the latest metrics from Q3. Revenue is up by 15%...', body: 'Hi Alex,\n\nPlease find the attached report for Q3.\n\nKey Highlights:\n- Revenue up 15%\n- User acquisition cost down 5%\n\nLet\'s discuss in the standup.\n\nBest,\nSarah', date: new Date(Date.now() - 3600000), read: true, folder: 'inbox', labels: ['work'] },
                { id: 'e4', provider: 'google', from: 'newsletter@techweekly.com', subject: 'The Future of AI is Here', snippet: 'Top stories: Gemini 2.0 released, Quantum computing breakthroughs...', body: 'Weekly Tech Roundup...', date: new Date(Date.now() - 7200000), read: true, folder: 'inbox', labels: ['updates'] },
                { id: 'e8', provider: 'google', from: 'notifications@slack.com', subject: 'New message in #general', snippet: 'Jessica Lee posted: "Has anyone seen the new deployment logs?"', body: 'Go to Slack to view the message.', date: new Date(Date.now() - 14400000), read: true, folder: 'inbox', labels: ['updates'] },
                { id: 'e9', provider: 'google', from: 'invoice@aws.com', subject: 'AWS Invoice Available', snippet: 'Your invoice for the period of October is now available...', body: 'Total amount: $452.30', date: new Date(Date.now() - 25000000), read: false, folder: 'inbox', labels: ['finance'] },
                
                // Outlook - Inbox
                { id: 'e3', provider: 'microsoft', from: 'admin@outlook.com', subject: 'Welcome to Outlook', snippet: 'Get started with your new account and explore features...', body: 'Welcome to your new Outlook account. Use it to connect, organize, and get things done.', date: new Date(Date.now() - 86400000), read: true, folder: 'inbox' },
                { id: 'e5', provider: 'microsoft', from: 'hr@corporation.com', subject: 'Open Enrollment', snippet: 'It is time to select your benefits for the upcoming year...', body: 'Please log in to the portal to complete your enrollment.', date: new Date(Date.now() - 90000000), read: false, folder: 'inbox' },
                { id: 'e10', provider: 'microsoft', from: 'marcus.r@pulse.ai', subject: 'Figma Prototype Link', snippet: 'Here is the link to the updated prototype for client review...', body: 'Link: figma.com/file/xyz', date: new Date(Date.now() - 100000000), read: true, folder: 'inbox' },

                // iCloud - Inbox
                { id: 'e6', provider: 'icloud', from: 'billing@apple.com', subject: 'Your receipt from Apple', snippet: 'Receipt for iCloud+ 2TB Storage Plan...', body: 'Total: $9.99\nDate: Oct 24, 2024', date: new Date(Date.now() - 120000000), read: true, folder: 'inbox' },
                { id: 'e7', provider: 'icloud', from: 'mom@gmail.com', subject: 'Sunday Dinner', snippet: 'Are you coming over this Sunday? Dad is making lasagna...', body: 'Let me know!', date: new Date(Date.now() - 200000000), read: true, folder: 'inbox' },
            ];
            
            // Filter based on provider simulation
            resolve(emails.filter(e => e.provider === provider || provider === 'all'));
        }, 800);
    });
};
