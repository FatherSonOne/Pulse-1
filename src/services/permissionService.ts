// Android Permission Service for Capacitor
// Handles runtime permission requests for microphone, camera, etc.

import { Capacitor } from '@capacitor/core';

export type PermissionType = 'microphone' | 'camera' | 'notifications' | 'sms' | 'contacts';

export interface PermissionStatus {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
}

/**
 * Check if running on native Android platform
 */
export const isNativeAndroid = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

/**
 * Check if running on any native platform (iOS or Android)
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Request microphone permission
 * On web, this triggers the browser's permission dialog
 * On Android, the WebView handles this through the manifest permissions
 */
export const requestMicrophonePermission = async (): Promise<PermissionStatus> => {
  try {
    // Use the Web API to request permission
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop the stream immediately - we just needed to trigger the permission
    stream.getTracks().forEach(track => track.stop());
    return { granted: true, denied: false, prompt: false };
  } catch (error: any) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return { granted: false, denied: true, prompt: false };
    }
    // Other errors (no device, etc.)
    console.error('Microphone permission error:', error);
    return { granted: false, denied: false, prompt: true };
  }
};

/**
 * Request camera permission for Pulse Meetings and Video Vox
 */
export const requestCameraPermission = async (): Promise<PermissionStatus> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    return { granted: true, denied: false, prompt: false };
  } catch (error: any) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return { granted: false, denied: true, prompt: false };
    }
    console.error('Camera permission error:', error);
    return { granted: false, denied: false, prompt: true };
  }
};

/**
 * Request both camera and microphone permissions for video calls
 */
export const requestMediaPermissions = async (): Promise<{
  microphone: PermissionStatus;
  camera: PermissionStatus;
}> => {
  try {
    // Request both at once for better UX during video calls
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    });
    stream.getTracks().forEach(track => track.stop());
    return {
      microphone: { granted: true, denied: false, prompt: false },
      camera: { granted: true, denied: false, prompt: false }
    };
  } catch (error: any) {
    // If combined request fails, try individually
    const [mic, cam] = await Promise.all([
      requestMicrophonePermission(),
      requestCameraPermission()
    ]);
    return { microphone: mic, camera: cam };
  }
};

/**
 * Check current permission status without prompting
 */
export const checkPermissionStatus = async (type: PermissionType): Promise<PermissionStatus> => {
  if (!navigator.permissions) {
    // Permissions API not available, return unknown state
    return { granted: false, denied: false, prompt: true };
  }

  try {
    const permissionName = type === 'microphone' ? 'microphone' :
                          type === 'camera' ? 'camera' : 'notifications';

    const result = await navigator.permissions.query({
      name: permissionName as PermissionName
    });

    return {
      granted: result.state === 'granted',
      denied: result.state === 'denied',
      prompt: result.state === 'prompt'
    };
  } catch (error) {
    // Some permissions may not be queryable
    return { granted: false, denied: false, prompt: true };
  }
};

/**
 * Request all permissions needed for Pulse app
 * Call this on app startup or before using voice/video features
 */
export const requestAllPermissions = async (): Promise<{
  microphone: PermissionStatus;
  camera: PermissionStatus;
}> => {
  console.log('[Permissions] Requesting all app permissions...');

  const results = await requestMediaPermissions();

  console.log('[Permissions] Results:', results);

  return results;
};

/**
 * Show a user-friendly message when permission is denied
 */
export const getPermissionDeniedMessage = (type: PermissionType): string => {
  const messages: Record<PermissionType, string> = {
    microphone: 'Microphone access is required for voice features. Please enable it in your device settings.',
    camera: 'Camera access is required for video features. Please enable it in your device settings.',
    notifications: 'Notification access is required for alerts. Please enable it in your device settings.',
    sms: 'SMS access is required to send text messages. Please enable it in your device settings.',
    contacts: 'Contacts access helps you find friends on Pulse. Please enable it in your device settings.'
  };
  return messages[type];
};

/**
 * Check if SMS sending is available on this device
 * SMS is only available on native Android platforms
 */
export const canSendSms = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

/**
 * Open native SMS app to send a message
 * This uses the SMS URL scheme to open the default messaging app
 */
export const openSmsApp = (phoneNumber: string, message?: string): void => {
  const formatted = phoneNumber.replace(/[^\d+]/g, '');
  let smsUrl = `sms:${formatted}`;
  if (message) {
    smsUrl += `?body=${encodeURIComponent(message)}`;
  }
  window.location.href = smsUrl;
};

export default {
  isNativeAndroid,
  isNativePlatform,
  requestMicrophonePermission,
  requestCameraPermission,
  requestMediaPermissions,
  checkPermissionStatus,
  requestAllPermissions,
  getPermissionDeniedMessage,
  canSendSms,
  openSmsApp
};
