import React from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from './services/supabase'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import { LoadingProvider } from './contexts/LoadingContext'
import './index.css'
import './components/shared/PulseTypography.css'

// DEVELOPMENT: Force clear service worker cache on version mismatch
const APP_VERSION = '28.1.0';
const VERSION_KEY = 'pulse_app_version';

async function clearOldCache() {
  const storedVersion = localStorage.getItem(VERSION_KEY);

  if (storedVersion !== APP_VERSION) {
    console.log(`[Cache] Version mismatch: ${storedVersion} -> ${APP_VERSION}. Clearing cache...`);

    try {
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log('[Cache] Unregistered service worker');
        }
      }

      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log(`[Cache] Cleared ${cacheNames.length} cache storage(s)`);
      }

      // Update version
      localStorage.setItem(VERSION_KEY, APP_VERSION);
      console.log('[Cache] Cache cleared successfully, reloading...');

      // Force hard reload
      window.location.reload();
    } catch (error) {
      console.error('[Cache] Error clearing cache:', error);
    }
  }
}

// Run cache check immediately
clearOldCache();

// PWA Service Worker Registration
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // Register PWA service worker
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[PWA] Service worker registered:', registration.scope);

        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available, show update prompt
                console.log('[PWA] New version available');

                // Show toast notification for update
                const updateToast = document.createElement('div');
                updateToast.className = 'pwa-update-toast';
                updateToast.innerHTML = `
                  <div style="
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #10b981;
                    color: white;
                    padding: 16px 24px;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                  ">
                    <span>🎉 New version available!</span>
                    <button onclick="window.location.reload()" style="
                      background: white;
                      color: #10b981;
                      border: none;
                      padding: 8px 16px;
                      border-radius: 8px;
                      font-weight: 600;
                      cursor: pointer;
                    ">Update Now</button>
                  </div>
                `;
                document.body.appendChild(updateToast);
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[PWA] Service worker registration failed:', error);
      });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'CACHE_UPDATED') {
        console.log('[PWA] Cache updated');
      }
    });

    // Listen for controller change (new service worker activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] New service worker activated');
    });
  });
}

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
    <LoadingProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LoadingProvider>
  </React.StrictMode>
)