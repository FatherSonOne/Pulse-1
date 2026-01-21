import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase environment variables are not set!');
  console.error('VITE_SUPABASE_URL:', supabaseUrl);
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '[SET]' : '[NOT SET]');
  console.error('Make sure .env.local exists and contains the required variables.');
  console.error('Available env vars:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')));
}

// Session storage key
const SUPABASE_AUTH_KEY = 'sb-auth-token';

// Token cache to prevent excessive localStorage reads
// This significantly improves performance by reducing redundant storage access
const tokenCache: Map<string, { value: string | null; timestamp: number }> = new Map();
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

// Custom storage adapter that uses Capacitor Preferences on native platforms
// This persists data properly when app is closed/reopened on mobile
const capacitorStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      // Check cache first to avoid redundant localStorage calls
      const cached = tokenCache.get(key);
      if (cached && (Date.now() - cached.timestamp) < TOKEN_CACHE_TTL) {
        return cached.value;
      }

      let value: string | null = null;

      if (Capacitor.isNativePlatform()) {
        const result = await Preferences.get({ key });
        value = result.value;
        // Only log on cache miss in development
        if (import.meta.env.DEV && value) {
          console.log(`[Storage] Cache miss - retrieved ${key} from Capacitor Preferences`);
        }
      } else {
        value = localStorage.getItem(key);
        // Only log on cache miss in development
        if (import.meta.env.DEV && value) {
          console.log(`[Storage] Cache miss - retrieved ${key} from localStorage`);
        }
      }

      // Update cache
      tokenCache.set(key, { value, timestamp: Date.now() });
      return value;
    } catch (error) {
      console.error(`[Storage] Error getting ${key}:`, error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      // Update cache immediately
      tokenCache.set(key, { value, timestamp: Date.now() });

      if (Capacitor.isNativePlatform()) {
        await Preferences.set({ key, value });
        if (import.meta.env.DEV) {
          console.log(`[Storage] Saved ${key} to Capacitor Preferences`);
        }
      } else {
        localStorage.setItem(key, value);
        if (import.meta.env.DEV) {
          console.log(`[Storage] Saved ${key} to localStorage`);
        }
      }
    } catch (error) {
      console.error(`[Storage] Error setting ${key}:`, error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      // Clear from cache
      tokenCache.delete(key);

      if (Capacitor.isNativePlatform()) {
        await Preferences.remove({ key });
        if (import.meta.env.DEV) {
          console.log(`[Storage] Removed ${key} from Capacitor Preferences`);
        }
      } else {
        localStorage.removeItem(key);
        if (import.meta.env.DEV) {
          console.log(`[Storage] Removed ${key} from localStorage`);
        }
      }
    } catch (error) {
      console.error(`[Storage] Error removing ${key}:`, error);
    }
  },
};

// Ensure we have valid values before initializing
// Use a dummy URL if not set to prevent initialization errors
const validUrl = supabaseUrl && supabaseUrl.startsWith('http')
  ? supabaseUrl
  : 'https://placeholder.supabase.co';
const validKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(
  validUrl,
  validKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: capacitorStorage,
      // Use PKCE flow for better security with mobile OAuth
      // This sends a 'code' parameter instead of tokens in URL
      flowType: 'pkce',
      // Detect URL changes for OAuth callback handling
      detectSessionInUrl: true,
      // Storage key for the session
      storageKey: SUPABASE_AUTH_KEY,
    },
    // Global settings for better session handling
    global: {
      headers: {
        'x-client-info': 'pulse-app',
      },
    },
  }
);

// Session refresh interval (check more frequently to prevent unexpected logouts)
const SESSION_CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes (more frequent checks)
const TOKEN_REFRESH_THRESHOLD = 30 * 60 * 1000; // Refresh if less than 30 minutes left (more proactive)

let sessionCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start automatic session refresh checking
 * This proactively refreshes tokens before they expire to prevent
 * users from being logged out unexpectedly
 */
export const startSessionRefreshMonitor = () => {
  // Clear any existing interval
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }

  const checkAndRefreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.warn('[Session Monitor] Error getting session:', error.message);
        return;
      }

      if (!session) {
        console.log('[Session Monitor] No active session');
        return;
      }

      // Check if session is close to expiring
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const timeUntilExpiry = expiresAt - Date.now();

      if (timeUntilExpiry < TOKEN_REFRESH_THRESHOLD && timeUntilExpiry > 0) {
        console.log('[Session Monitor] Session expiring soon, refreshing...');
        console.log('[Session Monitor] Time until expiry:', Math.round(timeUntilExpiry / 60000), 'minutes');
        
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('[Session Monitor] Failed to refresh session:', refreshError.message);
        } else if (data.session) {
          const newExpiresAt = data.session.expires_at ? data.session.expires_at * 1000 : 0;
          console.log('[Session Monitor] Session refreshed successfully');
          console.log('[Session Monitor] New expiry:', new Date(newExpiresAt).toISOString());
        }
      } else if (timeUntilExpiry > 0) {
        console.log('[Session Monitor] Session valid for', Math.round(timeUntilExpiry / 60000), 'more minutes');
      }
    } catch (err) {
      console.error('[Session Monitor] Error:', err);
    }
  };

  // Check immediately on start
  checkAndRefreshSession();

  // Then check periodically
  sessionCheckInterval = setInterval(checkAndRefreshSession, SESSION_CHECK_INTERVAL);

  console.log('[Session Monitor] Started automatic session refresh monitoring');
};

/**
 * Stop the session refresh monitor
 */
export const stopSessionRefreshMonitor = () => {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
    console.log('[Session Monitor] Stopped');
  }
};

// Start monitoring when module loads (if in browser environment)
if (typeof window !== 'undefined') {
  // Delay start to allow app to initialize
  setTimeout(() => {
    startSessionRefreshMonitor();
  }, 3000);

  // Also refresh when app becomes visible (user returns to app)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      console.log('[Session Monitor] App became visible, checking session...');
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
          const timeUntilExpiry = expiresAt - Date.now();
          
          // If session expired or about to expire, refresh it
          if (timeUntilExpiry < TOKEN_REFRESH_THRESHOLD) {
            console.log('[Session Monitor] Refreshing session after app resumed...');
            supabase.auth.refreshSession();
          }
        }
      });
    }
  });
}

// Debug function to check session status
export const debugSessionStatus = async (): Promise<void> => {
  try {
    console.log('[Auth Debug] Checking session status...');
    console.log('[Auth Debug] Platform:', Capacitor.getPlatform());
    console.log('[Auth Debug] Native:', Capacitor.isNativePlatform());

    // Check stored session
    const storedSession = await capacitorStorage.getItem(SUPABASE_AUTH_KEY);
    console.log('[Auth Debug] Stored session exists:', !!storedSession);

    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('[Auth Debug] Session error:', error.message);
    } else if (session) {
      console.log('[Auth Debug] Active session for:', session.user?.email);
      console.log('[Auth Debug] Session expires at:', new Date(session.expires_at! * 1000).toISOString());
      console.log('[Auth Debug] Session expires in:', Math.round((session.expires_at! * 1000 - Date.now()) / 60000), 'minutes');
    } else {
      console.log('[Auth Debug] No active session');
    }
  } catch (err) {
    console.error('[Auth Debug] Error:', err);
  }
};

// Call debug on load (development only)
if (import.meta.env.DEV) {
  setTimeout(debugSessionStatus, 2000);
}

export interface ChatMessage {
  id: string;
  workspace_id: string;
  sender_id: string;
  encrypted_content: string;
  nonce: string;
  created_at: string;
}

export interface EphemeralWorkspace {
  id: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  duration_minutes: number;
  is_active: boolean;
}

export class SupabaseService {
  async createWorkspace(durationMinutes: number): Promise<EphemeralWorkspace> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60000);

    const { data, error } = await supabase
      .from('ephemeral_workspaces')
      .insert([
        {
          duration_minutes: durationMinutes,
          created_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) throw new Error(`Failed to create workspace: ${error.message}`);
    return data;
  }

  async storeMessage(
    workspaceId: string,
    senderId: string,
    encryptedContent: string,
    nonce: string
  ): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([
        {
          workspace_id: workspaceId,
          sender_id: senderId,
          encrypted_content: encryptedContent,
          nonce: nonce,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw new Error(`Failed to store message: ${error.message}`);
    return data;
  }

  async getWorkspaceMessages(workspaceId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
    return data || [];
  }

  async isWorkspaceActive(workspaceId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('ephemeral_workspaces')
      .select('is_active, expires_at')
      .eq('id', workspaceId)
      .single();

    if (error) return false;

    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    return data.is_active && now < expiresAt;
  }

  async deactivateWorkspace(workspaceId: string): Promise<void> {
    const { error } = await supabase
      .from('ephemeral_workspaces')
      .update({ is_active: false })
      .eq('id', workspaceId);

    if (error) throw new Error(`Failed to deactivate workspace: ${error.message}`);
  }

  subscribeToMessages(
    workspaceId: string,
    callback: (message: ChatMessage) => void
  ) {
    return supabase
      .channel(`chat_messages:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          callback(payload.new as ChatMessage);
        }
      )
      .subscribe();
  }
}

export const supabaseService = new SupabaseService();
