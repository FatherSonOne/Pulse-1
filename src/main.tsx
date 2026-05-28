import React from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from './services/supabase'
import './i18n';
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import { LoadingProvider } from './contexts/LoadingContext'
import { initializeMonitoring } from './lib/monitoring'
import './index.css'
import './components/shared/PulseTypography.css'

// DEV-ONLY E2E test harness flag — short-circuits the App render at the bottom
// of this file so component-level a11y / keyboard journeys can be exercised in
// a real browser without the auth / OAuth / service-worker scaffolding.
// Guarded twice: import.meta.env.DEV at build-time (tree-shaken in prod) AND a
// URL query check. Never reachable in production builds.
const E2E_MAP_HARNESS =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('e2eHarness') === 'map';

// Bootstrap monitoring (Sentry + PostHog + perf metrics + global error
// handlers) before React mounts. Both SDKs internally gate on env vars
// (VITE_POSTHOG_API_KEY, VITE_SENTRY_DSN) AND on VITE_APP_MODE !== 'development',
// so local dev stays dormant. Wrapped in try/catch — startup must never throw.
// Skipped under the E2E map harness so the test rig keeps its dependency-light
// boot path.
if (!E2E_MAP_HARNESS) {
  try {
    initializeMonitoring();
  } catch (error) {
    console.error('[monitoring] Failed to initialize:', error);
  }
}

// DEVELOPMENT: Force clear service worker cache on version mismatch
const APP_VERSION = '28.2.0';
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
  const isCustomScheme = url.includes('io.qntmpulse.app://') || url.includes('pulse://');
  const isWebDomain = url.includes('pulse.logosvision.org') && (url.includes('code=') || url.includes('access_token='));

  if (!isCustomScheme && !isWebDomain) {
    console.log('[OAuth] Not an OAuth callback, ignoring');
    return;
  }

  try {
    // Parse the URL - tokens can be in hash fragment OR query params
    // Supabase typically uses hash fragment: #access_token=xxx&refresh_token=xxx
    
    // Normalize URL for parsing — replace custom schemes with https so the URL
    // constructor can parse query params and hash fragments correctly.
    let normalizedUrl = url;
    if (url.startsWith('io.qntmpulse.app://')) {
      normalizedUrl = url.replace(/^io\.qntmpulse\.app:\/\//, 'https://placeholder.com/');
    } else if (url.startsWith('pulse://')) {
      normalizedUrl = url.replace(/^pulse:\/\//, 'https://placeholder.com/');
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
      } else {
        console.error('[OAuth] exchangeCodeForSession returned no session and no error');
      }
      // Always return after attempting code exchange — do not fall through to
      // the implicit-flow path below, which is for a different auth flow.
      return;
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

// Electron desktop app: listen for OAuth callbacks delivered via the pulse://
// custom protocol handler in the main process.
if ((window as any).electronAPI?.isElectron) {
  (window as any).electronAPI.onOAuthCallback((url: string) => {
    console.log('[OAuth] Electron protocol callback received:', url);
    handleOAuthDeepLink(url);
  });
}

// Also detect mobile viewport for responsive CSS
const isMobileViewport = window.innerWidth <= 768;
if (isMobileViewport) {
  document.documentElement.classList.add('mobile-viewport');
}

if (E2E_MAP_HARNESS) {
  // Lazy-load so the harness module is excluded from the production graph.
  void import('./components/map/__e2e_harness/MapTestHarness').then(({ default: MapTestHarness }) => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <MapTestHarness />
      </React.StrictMode>
    );
  });
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <LoadingProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LoadingProvider>
    </React.StrictMode>
  )
}