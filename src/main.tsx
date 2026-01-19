import React from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from './services/supabase'
import App from './App.tsx'
import './index.css'
import './components/shared/PulseTypography.css'

// Handle OAuth deep link callback for native apps
// This function extracts tokens from the redirect URL and establishes the session
const handleOAuthDeepLink = async (url: string) => {
  console.log('[OAuth] Deep link received:', url);

  // Check if this is an OAuth callback (contains our custom scheme OR our web domain)
  const isCustomScheme = url.includes('io.qntmpulse.app://');
  const isWebDomain = url.includes('pulse.logosvision.org') && (url.includes('code=') || url.includes('access_token='));

  if (!isCustomScheme && !isWebDomain) {
    console.log('[OAuth] Not an OAuth callback, ignoring');
    return;
  }

  try {
    // Parse the URL - tokens can be in hash fragment OR query params
    // Supabase typically uses hash fragment: #access_token=xxx&refresh_token=xxx
    
    // Normalize URL for parsing
    let normalizedUrl = url;
    if (url.includes('io.qntmpulse.app://')) {
        // Replace custom scheme with https for URL parsing
        normalizedUrl = url.replace(/^io\.qntmpulse\.app:\/\//, 'https://placeholder.com/');
    }
    
    const urlObj = new URL(normalizedUrl);

    // 1. Check for PKCE Authorization Code (most likely with newer Supabase versions)
    const code = urlObj.searchParams.get('code');
    if (code) {
      console.log('[OAuth] Found PKCE code, exchanging for session...');
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('[OAuth] Error exchanging code for session:', error);
      } else if (data?.session) {
        console.log('[OAuth] Session established from code, reloading app...');
        window.location.reload();
        return;
      }
    }

    // 2. Try hash fragment (Implicit Flow)
    let accessToken: string | null = null;
    let refreshToken: string | null = null;

    if (urlObj.hash && urlObj.hash.length > 1) {
      const hashParams = new URLSearchParams(urlObj.hash.substring(1));
      accessToken = hashParams.get('access_token');
      refreshToken = hashParams.get('refresh_token');
      if (accessToken) console.log('[OAuth] Found tokens in hash fragment');
    }

    // 3. Fallback to query params (Implicit Flow variants)
    if (!accessToken) {
      accessToken = urlObj.searchParams.get('access_token');
      refreshToken = urlObj.searchParams.get('refresh_token');
      if (accessToken) console.log('[OAuth] Found tokens in query params');
    }

    if (!accessToken || !refreshToken) {
      if (!code) {
        console.error('[OAuth] No tokens or code found in URL. URL structure:', {
          hash: urlObj.hash,
          search: urlObj.search,
          fullUrl: url
        });
      }
      return;
    }

    console.log('[OAuth] Setting session with tokens...');

    // Set the session - this alone doesn't trigger onAuthStateChange subscribers
    const { data: sessionData, error: setError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (setError) {
      console.error('[OAuth] Error setting session:', setError);
      return;
    }

    console.log('[OAuth] Session set, now refreshing to trigger subscribers...');

    // CRITICAL: refreshSession triggers onAuthStateChange which setSession does NOT do
    // This is a known Supabase behavior - see GitHub discussion #11548
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError) {
      console.error('[OAuth] Error refreshing session:', refreshError);
      // Even if refresh fails, we might have a valid session, try getSession
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('[OAuth] Session exists despite refresh error, proceeding...');
      }
    } else {
      console.log('[OAuth] Session refreshed successfully:', refreshData.user?.email);
    }

    // Small delay to ensure auth state propagates, then reload
    console.log('[OAuth] Reloading app to pick up authenticated state...');
    setTimeout(() => {
      window.location.reload();
    }, 500);

  } catch (err) {
    console.error('[OAuth] Failed to process deep link:', err);
  }
};

// Detect if running in Capacitor native app
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('capacitor', 'native-app');
  document.body.classList.add('no-pull-refresh');

  // Listen for deep link OAuth callbacks on native platforms
  CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    handleOAuthDeepLink(url);
  });

  // Also check if app was launched with a deep link URL (cold start)
  CapacitorApp.getLaunchUrl().then((result) => {
    if (result?.url) {
      console.log('[OAuth] App launched with URL:', result.url);
      handleOAuthDeepLink(result.url);
    }
  });

  // Permission requests are now handled by the usePermissions hook and PermissionRequestModal
  // in App.tsx for a better user experience with proper UI
  console.log('[App] Native platform detected, permission requests will be handled in-app');
}

// Also detect mobile viewport for responsive CSS
const isMobileViewport = window.innerWidth <= 768;
if (isMobileViewport) {
  document.documentElement.classList.add('mobile-viewport');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)