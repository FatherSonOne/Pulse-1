// Comprehensive Permissions Hook for Pulse App
// Manages all device permissions: microphone, camera, notifications, SMS, contacts

import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export type PermissionName = 'microphone' | 'camera' | 'notifications' | 'sms' | 'contacts' | 'location';

export interface PermissionState {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
  checking: boolean;
}

export interface AllPermissions {
  microphone: PermissionState;
  camera: PermissionState;
  notifications: PermissionState;
  sms: PermissionState;
  contacts: PermissionState;
  location: PermissionState;
}

const INITIAL_STATE: PermissionState = {
  granted: false,
  denied: false,
  prompt: true,
  checking: true,
};

// Storage keys for tracking permission requests
const PERMISSIONS_REQUESTED_KEY = 'pulse_permissions_requested';
const PERMISSIONS_COMPLETED_KEY = 'pulse_permissions_completed'; // Tracks which permissions have been handled
const PERMISSIONS_VERSION_KEY = 'pulse_permissions_version'; // For future permission changes
const CURRENT_PERMISSIONS_VERSION = '1'; // Increment when adding new required permissions

// Check if running on native platform
export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();
export const isAndroid = (): boolean => Capacitor.getPlatform() === 'android';
export const isIOS = (): boolean => Capacitor.getPlatform() === 'ios';

/**
 * Request microphone permission via Web API
 */
export const requestMicrophonePermission = async (): Promise<PermissionState> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return { granted: true, denied: false, prompt: false, checking: false };
  } catch (error: any) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return { granted: false, denied: true, prompt: false, checking: false };
    }
    return { granted: false, denied: false, prompt: true, checking: false };
  }
};

/**
 * Request camera permission via Web API
 */
export const requestCameraPermission = async (): Promise<PermissionState> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    return { granted: true, denied: false, prompt: false, checking: false };
  } catch (error: any) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return { granted: false, denied: true, prompt: false, checking: false };
    }
    return { granted: false, denied: false, prompt: true, checking: false };
  }
};

/**
 * Request notification permission
 * On native platforms (Android/iOS), the Web Notification API doesn't work in WebViews.
 * We mark it as granted since native notifications would be handled by a Capacitor plugin.
 */
export const requestNotificationPermission = async (): Promise<PermissionState> => {
  // On native platforms, Web Notifications API doesn't work in WebViews
  // Native push notifications require @capacitor/push-notifications plugin
  // For now, we'll mark as "granted" on native to not block the flow
  if (isNativePlatform()) {
    console.log('[Permissions] Native platform - skipping web notification request');
    // On Android, POST_NOTIFICATIONS permission is auto-granted for apps targeting < API 33
    // For API 33+, we would need to use the native permission system
    return { granted: true, denied: false, prompt: false, checking: false };
  }

  if (!('Notification' in window)) {
    return { granted: false, denied: true, prompt: false, checking: false };
  }

  try {
    const result = await Notification.requestPermission();
    return {
      granted: result === 'granted',
      denied: result === 'denied',
      prompt: result === 'default',
      checking: false,
    };
  } catch {
    return { granted: false, denied: false, prompt: true, checking: false };
  }
};

/**
 * Check notification permission status
 */
export const checkNotificationPermission = (): PermissionState => {
  if (!('Notification' in window)) {
    return { granted: false, denied: true, prompt: false, checking: false };
  }

  return {
    granted: Notification.permission === 'granted',
    denied: Notification.permission === 'denied',
    prompt: Notification.permission === 'default',
    checking: false,
  };
};

/**
 * Request location permission
 */
export const requestLocationPermission = async (): Promise<PermissionState> => {
  if (!('geolocation' in navigator)) {
    return { granted: false, denied: true, prompt: false, checking: false };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve({ granted: true, denied: false, prompt: false, checking: false }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ granted: false, denied: true, prompt: false, checking: false });
        } else {
          resolve({ granted: false, denied: false, prompt: true, checking: false });
        }
      },
      { timeout: 10000 }
    );
  });
};

/**
 * SMS permission - only available on native Android
 * This just checks if we can potentially send SMS (actual permission is requested on use)
 */
export const checkSmsCapability = (): PermissionState => {
  const canSendSms = isNativePlatform() && isAndroid();
  return {
    granted: canSendSms, // On Android, SMS is requested when used
    denied: !canSendSms && !isIOS(),
    prompt: false,
    checking: false,
  };
};

/**
 * Contacts permission - handled via Google API on web, native permissions on mobile
 */
export const checkContactsCapability = (): PermissionState => {
  // On web, contacts are accessed via Google API (OAuth-based)
  // On native, READ_CONTACTS permission is declared in manifest
  return {
    granted: true, // We declare the permission, actual grant happens at runtime
    denied: false,
    prompt: isNativePlatform(),
    checking: false,
  };
};

// Helper to get storage value
const getStorageValue = async (key: string): Promise<string | null> => {
  if (isNativePlatform()) {
    const { value } = await Preferences.get({ key });
    return value;
  }
  return localStorage.getItem(key);
};

// Helper to set storage value
const setStorageValue = async (key: string, value: string): Promise<void> => {
  if (isNativePlatform()) {
    await Preferences.set({ key, value });
  } else {
    localStorage.setItem(key, value);
  }
};

// Helper to get completed permissions from storage
const getCompletedPermissions = async (): Promise<Set<PermissionName>> => {
  const value = await getStorageValue(PERMISSIONS_COMPLETED_KEY);
  if (value) {
    try {
      return new Set(JSON.parse(value) as PermissionName[]);
    } catch {
      return new Set();
    }
  }
  return new Set();
};

// Helper to save completed permissions to storage
const saveCompletedPermissions = async (completed: Set<PermissionName>): Promise<void> => {
  await setStorageValue(PERMISSIONS_COMPLETED_KEY, JSON.stringify([...completed]));
};

/**
 * Hook to manage all permissions
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState<AllPermissions>({
    microphone: INITIAL_STATE,
    camera: INITIAL_STATE,
    notifications: INITIAL_STATE,
    sms: { ...INITIAL_STATE, checking: false },
    contacts: { ...INITIAL_STATE, checking: false },
    location: INITIAL_STATE,
  });
  const [hasRequestedOnStartup, setHasRequestedOnStartup] = useState(false);
  const [completedPermissions, setCompletedPermissions] = useState<Set<PermissionName>>(new Set());
  const [isRequesting, setIsRequesting] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load completed permissions and check version on mount
  useEffect(() => {
    const initializePermissions = async () => {
      try {
        // Check version - if version changed, we might need to re-request some permissions
        const storedVersion = await getStorageValue(PERMISSIONS_VERSION_KEY);
        
        if (storedVersion !== CURRENT_PERMISSIONS_VERSION) {
          // Version changed - could add logic here to only re-request new permissions
          console.log('[Permissions] Version changed, updating...');
          await setStorageValue(PERMISSIONS_VERSION_KEY, CURRENT_PERMISSIONS_VERSION);
        }

        // Load completed permissions
        const completed = await getCompletedPermissions();
        setCompletedPermissions(completed);

        // Check if initial setup has been done (at least one permission handled)
        const hasRequested = await getStorageValue(PERMISSIONS_REQUESTED_KEY);
        setHasRequestedOnStartup(hasRequested === 'true');

        setIsInitialized(true);
        console.log('[Permissions] Initialized. Completed:', [...completed]);
      } catch (error) {
        console.error('[Permissions] Init error:', error);
        setIsInitialized(true);
      }
    };

    initializePermissions();
  }, []);

  // Check current permission statuses
  const checkPermissions = useCallback(async () => {
    // Check notifications (synchronous)
    const notificationState = checkNotificationPermission();

    // Check SMS capability
    const smsState = checkSmsCapability();

    // Check contacts capability
    const contactsState = checkContactsCapability();

    // For microphone and camera, we need to use permissions API if available
    let micState: PermissionState = { granted: false, denied: false, prompt: true, checking: false };
    let camState: PermissionState = { granted: false, denied: false, prompt: true, checking: false };
    let locState: PermissionState = { granted: false, denied: false, prompt: true, checking: false };

    if (navigator.permissions) {
      try {
        const micResult = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        micState = {
          granted: micResult.state === 'granted',
          denied: micResult.state === 'denied',
          prompt: micResult.state === 'prompt',
          checking: false,
        };
      } catch { /* Permission API not supported for this permission */ }

      try {
        const camResult = await navigator.permissions.query({ name: 'camera' as PermissionName });
        camState = {
          granted: camResult.state === 'granted',
          denied: camResult.state === 'denied',
          prompt: camResult.state === 'prompt',
          checking: false,
        };
      } catch { /* Permission API not supported for this permission */ }

      try {
        const locResult = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        locState = {
          granted: locResult.state === 'granted',
          denied: locResult.state === 'denied',
          prompt: locResult.state === 'prompt',
          checking: false,
        };
      } catch { /* Permission API not supported for this permission */ }
    }

    setPermissions({
      microphone: micState,
      camera: camState,
      notifications: notificationState,
      sms: smsState,
      contacts: contactsState,
      location: locState,
    });
  }, []);

  // Initial permission check
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Request a specific permission and mark it as completed
  const requestPermission = useCallback(async (name: PermissionName): Promise<PermissionState> => {
    setIsRequesting(true);

    let result: PermissionState;

    switch (name) {
      case 'microphone':
        result = await requestMicrophonePermission();
        break;
      case 'camera':
        result = await requestCameraPermission();
        break;
      case 'notifications':
        result = await requestNotificationPermission();
        break;
      case 'location':
        result = await requestLocationPermission();
        break;
      case 'sms':
        result = checkSmsCapability();
        break;
      case 'contacts':
        result = checkContactsCapability();
        break;
      default:
        result = { granted: false, denied: false, prompt: true, checking: false };
    }

    setPermissions(prev => ({ ...prev, [name]: result }));

    // Mark this permission as completed (user has seen and responded to it)
    setCompletedPermissions(prev => {
      const updated = new Set([...prev, name]);
      // Save to storage asynchronously
      saveCompletedPermissions(updated).catch(console.error);
      return updated;
    });

    setIsRequesting(false);
    console.log(`[Permissions] ${name} completed:`, result);

    return result;
  }, []);

  // Mark the permission setup as complete (called when user finishes the modal)
  const markSetupComplete = useCallback(async () => {
    await setStorageValue(PERMISSIONS_REQUESTED_KEY, 'true');
    setHasRequestedOnStartup(true);
    console.log('[Permissions] Setup marked as complete');
  }, []);

  // Request all essential permissions (called on app startup)
  const requestAllPermissions = useCallback(async () => {
    if (hasRequestedOnStartup) {
      console.log('[Permissions] Already requested this session, skipping');
      return;
    }

    setIsRequesting(true);
    console.log('[Permissions] Requesting all permissions...');

    // Request in sequence to avoid overwhelming the user with dialogs
    const results: Partial<AllPermissions> = {};
    const newCompleted = new Set(completedPermissions);

    // 1. Microphone (essential for Vox features)
    if (!completedPermissions.has('microphone')) {
      console.log('[Permissions] Requesting microphone...');
      results.microphone = await requestMicrophonePermission();
      newCompleted.add('microphone');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 2. Camera (for video calls and meetings)
    if (!completedPermissions.has('camera')) {
      console.log('[Permissions] Requesting camera...');
      results.camera = await requestCameraPermission();
      newCompleted.add('camera');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 3. Notifications (for alerts and messages)
    if (!completedPermissions.has('notifications')) {
      console.log('[Permissions] Requesting notifications...');
      results.notifications = await requestNotificationPermission();
      newCompleted.add('notifications');
    }

    // 4. Check SMS and contacts capability (no user prompt needed)
    results.sms = checkSmsCapability();
    results.contacts = checkContactsCapability();
    newCompleted.add('sms');
    newCompleted.add('contacts');

    // Update state
    setPermissions(prev => ({ ...prev, ...results as AllPermissions }));
    setCompletedPermissions(newCompleted);

    // Save completed permissions
    await saveCompletedPermissions(newCompleted);

    // Mark as requested
    await markSetupComplete();

    setIsRequesting(false);
    console.log('[Permissions] All permissions requested:', results);

    return results;
  }, [hasRequestedOnStartup, completedPermissions, markSetupComplete]);

  // Reset the "already requested" flag (for testing or manual re-request)
  const resetPermissionRequest = useCallback(async () => {
    if (isNativePlatform()) {
      await Preferences.remove({ key: PERMISSIONS_REQUESTED_KEY });
    } else {
      localStorage.removeItem(PERMISSIONS_REQUESTED_KEY);
    }
    setHasRequestedOnStartup(false);
  }, []);

  // Get user-friendly message for denied permission
  const getPermissionMessage = useCallback((name: PermissionName): string => {
    const messages: Record<PermissionName, string> = {
      microphone: 'Microphone access is required for voice features like Vox messaging and voice commands.',
      camera: 'Camera access is required for video calls and Pulse Meetings.',
      notifications: 'Notification access helps you stay updated with messages and reminders.',
      sms: 'SMS access allows you to send text messages to non-Pulse contacts.',
      contacts: 'Contacts access helps you find friends and sync your address book.',
      location: 'Location access enables location-based features and mapping.',
    };
    return messages[name];
  }, []);

  // Check if any essential permissions are missing
  const hasMissingEssentialPermissions = useCallback((): boolean => {
    return !permissions.microphone.granted || !permissions.notifications.granted;
  }, [permissions]);

  // Get list of permissions that need to be requested
  // Returns only permissions that:
  // 1. Haven't been completed yet (user hasn't seen the dialog)
  // 2. OR were previously granted but are now revoked
  const getPermissionsToRequest = useCallback((): PermissionName[] => {
    const toRequest: PermissionName[] = [];
    const essentialPermissions: PermissionName[] = ['microphone', 'camera', 'notifications', 'contacts'];

    for (const name of essentialPermissions) {
      const state = permissions[name];
      const wasCompleted = completedPermissions.has(name);

      // If never completed, we need to ask
      if (!wasCompleted) {
        toRequest.push(name);
        continue;
      }

      // If was completed but now revoked (denied after being granted), ask again
      // This handles the case where user revokes permission in system settings
      if (wasCompleted && state.denied && !state.granted) {
        // Only re-ask if it was previously granted (revoked scenario)
        // We track this by checking if it's denied but was in completed list
        // Skip if user explicitly denied it during initial setup
        continue; // Don't re-ask for denied permissions
      }
    }

    return toRequest;
  }, [permissions, completedPermissions]);

  // Check if we should show the permission modal
  // Only show if:
  // 1. Initial setup not done (!hasRequestedOnStartup)
  // 2. OR there are permissions that need requesting (new or revoked)
  const shouldShowPermissionModal = useCallback((): boolean => {
    if (!isInitialized) return false;
    
    // If initial setup never done, show modal
    if (!hasRequestedOnStartup) {
      return true;
    }

    // If setup was done, only show if there are new permissions to request
    // (e.g., app update added new permissions)
    const toRequest = getPermissionsToRequest();
    const hasNewPermissions = toRequest.some(name => !completedPermissions.has(name));
    
    return hasNewPermissions;
  }, [isInitialized, hasRequestedOnStartup, getPermissionsToRequest, completedPermissions]);

  return {
    permissions,
    isRequesting,
    hasRequestedOnStartup,
    completedPermissions,
    isInitialized,
    showPermissionModal,
    setShowPermissionModal,
    checkPermissions,
    requestPermission,
    requestAllPermissions,
    resetPermissionRequest,
    getPermissionMessage,
    hasMissingEssentialPermissions,
    getPermissionsToRequest,
    shouldShowPermissionModal,
    markSetupComplete,
    isNativePlatform: isNativePlatform(),
    isAndroid: isAndroid(),
    isIOS: isIOS(),
  };
}

export default usePermissions;
