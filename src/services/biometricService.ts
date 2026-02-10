/**
 * Biometric Authentication Service
 * Handles Face ID, Touch ID, and fingerprint authentication
 */

import { Capacitor } from '@capacitor/core';

interface BiometricInfo {
  isAvailable: boolean;
  biometryType?: 'touchId' | 'faceId' | 'fingerprint' | 'face' | 'iris' | 'none';
  strongBiometryIsAvailable: boolean;
}

interface BiometricOptions {
  reason?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  cancelTitle?: string;
  fallbackTitle?: string;
  confirmationRequired?: boolean;
}

interface AuthResult {
  success: boolean;
  error?: string;
  errorCode?: string;
}

class BiometricService {
  private isNative: boolean;
  private isEnabled: boolean;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.isEnabled = this.loadSettings();
  }

  /**
   * Load biometric settings from localStorage
   */
  private loadSettings(): boolean {
    const setting = localStorage.getItem('biometric_auth_enabled');
    return setting === 'true';
  }

  /**
   * Save biometric settings
   */
  private saveSettings(enabled: boolean) {
    localStorage.setItem('biometric_auth_enabled', enabled.toString());
    this.isEnabled = enabled;
  }

  /**
   * Check if biometric authentication is available
   */
  async isAvailable(): Promise<BiometricInfo> {
    if (!this.isNative) {
      // Web: Check for WebAuthn API
      return {
        isAvailable: this.checkWebAuthn(),
        biometryType: 'none',
        strongBiometryIsAvailable: false
      };
    }

    try {
      // Use NativeBiometric plugin
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');

      const result = await NativeBiometric.isAvailable();

      return {
        isAvailable: result.isAvailable,
        biometryType: this.mapBiometryType(result.biometryType),
        strongBiometryIsAvailable: result.isAvailable
      };
    } catch (error) {
      console.error('[Biometric] Error checking availability:', error);
      return {
        isAvailable: false,
        biometryType: 'none',
        strongBiometryIsAvailable: false
      };
    }
  }

  /**
   * Check WebAuthn API support
   */
  private checkWebAuthn(): boolean {
    return !!(
      window.PublicKeyCredential &&
      navigator.credentials &&
      navigator.credentials.create
    );
  }

  /**
   * Map biometry type to standard format
   */
  private mapBiometryType(type: any): BiometricInfo['biometryType'] {
    // Map various plugin responses to standard types
    if (type === 0 || type === 'none') return 'none';
    if (type === 1 || type === 'touchId' || type === 'TOUCH_ID') return 'touchId';
    if (type === 2 || type === 'faceId' || type === 'FACE_ID') return 'faceId';
    if (type === 'fingerprint' || type === 'FINGERPRINT') return 'fingerprint';
    if (type === 'face' || type === 'FACE') return 'face';
    if (type === 'iris' || type === 'IRIS') return 'iris';
    return 'none';
  }

  /**
   * Authenticate user with biometrics
   */
  async authenticate(options: BiometricOptions = {}): Promise<AuthResult> {
    if (!this.isEnabled) {
      return {
        success: false,
        error: 'Biometric authentication is disabled',
        errorCode: 'DISABLED'
      };
    }

    const availability = await this.isAvailable();
    if (!availability.isAvailable) {
      return {
        success: false,
        error: 'Biometric authentication not available',
        errorCode: 'NOT_AVAILABLE'
      };
    }

    try {
      if (this.isNative) {
        return await this.authenticateNative(options, availability.biometryType);
      } else {
        return await this.authenticateWeb(options);
      }
    } catch (error: any) {
      console.error('[Biometric] Authentication error:', error);
      return {
        success: false,
        error: error.message || 'Authentication failed',
        errorCode: error.code || 'UNKNOWN'
      };
    }
  }

  /**
   * Authenticate using native biometrics
   */
  private async authenticateNative(
    options: BiometricOptions,
    biometryType?: string
  ): Promise<AuthResult> {
    try {
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');

      const reason = options.reason || this.getDefaultReason(biometryType);

      const result = await NativeBiometric.verifyIdentity({
        reason,
        title: options.title,
        subtitle: options.subtitle,
        description: options.description,
        negativeButtonText: options.cancelTitle || 'Cancel',
        maxAttempts: 3
      });

      if (result.verified) {
        return {
          success: true
        };
      } else {
        return {
          success: false,
          error: 'Authentication failed',
          errorCode: 'FAILED'
        };
      }
    } catch (error: any) {
      // Handle specific error codes
      if (error.code === 'USER_CANCELED') {
        return {
          success: false,
          error: 'Authentication cancelled by user',
          errorCode: 'USER_CANCELED'
        };
      }

      if (error.code === 'AUTHENTICATION_FAILED') {
        return {
          success: false,
          error: 'Authentication failed',
          errorCode: 'FAILED'
        };
      }

      throw error;
    }
  }

  /**
   * Authenticate using Web Authentication API
   */
  private async authenticateWeb(options: BiometricOptions): Promise<AuthResult> {
    try {
      // WebAuthn implementation
      // This is a simplified version - production would need full WebAuthn flow
      console.log('[Biometric] WebAuthn authentication not fully implemented');

      return {
        success: false,
        error: 'WebAuthn authentication requires server-side setup',
        errorCode: 'NOT_IMPLEMENTED'
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Get default reason text based on biometry type
   */
  private getDefaultReason(biometryType?: string): string {
    switch (biometryType) {
      case 'touchId':
        return 'Authenticate with Touch ID';
      case 'faceId':
        return 'Authenticate with Face ID';
      case 'fingerprint':
        return 'Authenticate with fingerprint';
      case 'face':
        return 'Authenticate with face recognition';
      case 'iris':
        return 'Authenticate with iris scan';
      default:
        return 'Authenticate to continue';
    }
  }

  /**
   * Enable biometric authentication
   */
  enable() {
    this.saveSettings(true);
  }

  /**
   * Disable biometric authentication
   */
  disable() {
    this.saveSettings(false);
  }

  /**
   * Toggle biometric authentication
   */
  toggle(): boolean {
    const newState = !this.isEnabled;
    this.saveSettings(newState);
    return newState;
  }

  /**
   * Check if biometric authentication is enabled
   */
  isBiometricEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get user-friendly biometry name
   */
  getBiometryName(type?: BiometricInfo['biometryType']): string {
    switch (type) {
      case 'touchId':
        return 'Touch ID';
      case 'faceId':
        return 'Face ID';
      case 'fingerprint':
        return 'Fingerprint';
      case 'face':
        return 'Face Recognition';
      case 'iris':
        return 'Iris Scan';
      default:
        return 'Biometric Authentication';
    }
  }
}

// Export singleton instance
export const biometricService = new BiometricService();

/**
 * React hook for biometric authentication
 */
export function useBiometric() {
  const authenticate = async (options?: BiometricOptions) => {
    return await biometricService.authenticate(options);
  };

  return {
    authenticate,
    isAvailable: () => biometricService.isAvailable(),
    enable: () => biometricService.enable(),
    disable: () => biometricService.disable(),
    toggle: () => biometricService.toggle(),
    isEnabled: biometricService.isBiometricEnabled(),
    getBiometryName: (type?: BiometricInfo['biometryType']) => biometricService.getBiometryName(type)
  };
}
