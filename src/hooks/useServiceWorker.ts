/**
 * Service Worker Hook
 * Manage PWA service worker registration, updates, and communication
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isOnline: boolean;
  hasUpdate: boolean;
  isUpdating: boolean;
  registration: ServiceWorkerRegistration | null;
  error: Error | null;
}

export interface UseServiceWorkerOptions {
  swUrl?: string;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

export function useServiceWorker(options: UseServiceWorkerOptions = {}) {
  const {
    swUrl = '/sw.js',
    onSuccess,
    onUpdate,
    onError,
    onOffline,
    onOnline,
  } = options;

  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: 'serviceWorker' in navigator,
    isRegistered: false,
    isOnline: navigator.onLine,
    hasUpdate: false,
    isUpdating: false,
    registration: null,
    error: null,
  });

  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Register service worker
  const register = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW Hook] Service workers not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register(swUrl, {
        scope: '/',
      });

      registrationRef.current = registration;

      setState((prev) => ({
        ...prev,
        isRegistered: true,
        registration,
        error: null,
      }));

      console.log('[SW Hook] Service worker registered');
      onSuccess?.(registration);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New update available
              setState((prev) => ({ ...prev, hasUpdate: true }));
              onUpdate?.(registration);
              console.log('[SW Hook] Update available');
            }
          });
        }
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Registration failed');
      setState((prev) => ({ ...prev, error: err }));
      onError?.(err);
      console.error('[SW Hook] Registration error:', error);
    }
  }, [swUrl, onSuccess, onUpdate, onError]);

  // Unregister service worker
  const unregister = useCallback(async () => {
    if (registrationRef.current) {
      const success = await registrationRef.current.unregister();
      if (success) {
        setState((prev) => ({
          ...prev,
          isRegistered: false,
          registration: null,
        }));
        registrationRef.current = null;
        console.log('[SW Hook] Service worker unregistered');
      }
      return success;
    }
    return false;
  }, []);

  // Update service worker
  const update = useCallback(async () => {
    if (!registrationRef.current) return;

    setState((prev) => ({ ...prev, isUpdating: true }));

    try {
      await registrationRef.current.update();
      console.log('[SW Hook] Update check complete');
    } catch (error) {
      console.error('[SW Hook] Update check failed:', error);
    } finally {
      setState((prev) => ({ ...prev, isUpdating: false }));
    }
  }, []);

  // Skip waiting and activate new service worker
  const skipWaiting = useCallback(() => {
    if (registrationRef.current?.waiting) {
      registrationRef.current.waiting.postMessage({ type: 'SKIP_WAITING' });
      setState((prev) => ({ ...prev, hasUpdate: false }));

      // Reload page to use new service worker
      window.location.reload();
    }
  }, []);

  // Send message to service worker
  const sendMessage = useCallback((message: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!navigator.serviceWorker.controller) {
        reject(new Error('No service worker controller'));
        return;
      }

      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
    });
  }, []);

  // Get service worker version
  const getVersion = useCallback(async (): Promise<string | null> => {
    try {
      const response = await sendMessage({ type: 'GET_VERSION' });
      return response.version;
    } catch {
      return null;
    }
  }, [sendMessage]);

  // Clear all caches
  const clearCache = useCallback(async () => {
    sendMessage({ type: 'CLEAR_CACHE' });
    console.log('[SW Hook] Cache clear requested');
  }, [sendMessage]);

  // Prefetch URLs
  const prefetchUrls = useCallback((urls: string[]) => {
    sendMessage({ type: 'CACHE_URLS', urls });
    console.log('[SW Hook] Prefetch requested:', urls.length, 'URLs');
  }, [sendMessage]);

  // Prefetch document for offline access
  const prefetchDocument = useCallback((docId: string) => {
    sendMessage({ type: 'PREFETCH_DOCUMENT', docId });
    console.log('[SW Hook] Document prefetch requested:', docId);
  }, [sendMessage]);

  // Online/offline event handlers
  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
      onOnline?.();
      console.log('[SW Hook] Online');
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
      onOffline?.();
      console.log('[SW Hook] Offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onOnline, onOffline]);

  // Listen for controller change (new SW activated)
  useEffect(() => {
    const handleControllerChange = () => {
      console.log('[SW Hook] Controller changed');
      window.location.reload();
    };

    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  // Listen for messages from service worker
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('[SW Hook] Message from SW:', event.data);

      if (event.data.type === 'SYNC_QUEUE') {
        // Trigger queue processing in the app
        window.dispatchEvent(new CustomEvent('sw-sync-queue', { detail: event.data }));
      }

      if (event.data.type === 'SYNC_DOCUMENTS') {
        // Trigger document sync in the app
        window.dispatchEvent(new CustomEvent('sw-sync-documents', { detail: event.data }));
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  // Auto-register on mount
  useEffect(() => {
    register();
  }, [register]);

  return {
    ...state,
    register,
    unregister,
    update,
    skipWaiting,
    sendMessage,
    getVersion,
    clearCache,
    prefetchUrls,
    prefetchDocument,
  };
}

/**
 * Hook to show update notification
 */
export function useServiceWorkerUpdate() {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  const sw = useServiceWorker({
    onUpdate: () => {
      setShowUpdatePrompt(true);
    },
  });

  const dismissUpdate = useCallback(() => {
    setShowUpdatePrompt(false);
  }, []);

  const applyUpdate = useCallback(() => {
    sw.skipWaiting();
    setShowUpdatePrompt(false);
  }, [sw]);

  return {
    ...sw,
    showUpdatePrompt,
    dismissUpdate,
    applyUpdate,
  };
}

export default useServiceWorker;
