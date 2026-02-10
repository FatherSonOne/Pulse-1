/**
 * Haptic Feedback Service
 * Provides tactile feedback for user interactions
 *
 * Supports:
 * - Vibration API (Android, some browsers)
 * - Pattern-based vibrations
 * - Different intensity levels
 * - Capacitor Haptics (native mobile)
 */

import { Capacitor } from '@capacitor/core';

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

interface HapticPattern {
  duration: number | number[];
  intensity?: 'light' | 'medium' | 'heavy';
}

class HapticService {
  private isSupported: boolean;
  private isEnabled: boolean;
  private isNative: boolean;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.isSupported = this.checkSupport();
    this.isEnabled = this.loadSettings();
  }

  /**
   * Check if haptic feedback is supported
   */
  private checkSupport(): boolean {
    // Check for Vibration API
    if ('vibrate' in navigator) {
      return true;
    }

    // Check for native haptics (Capacitor)
    if (this.isNative) {
      return true;
    }

    return false;
  }

  /**
   * Load haptic settings from localStorage
   */
  private loadSettings(): boolean {
    const setting = localStorage.getItem('haptic_feedback_enabled');
    return setting !== 'false'; // Enabled by default
  }

  /**
   * Save haptic settings to localStorage
   */
  private saveSettings(enabled: boolean) {
    localStorage.setItem('haptic_feedback_enabled', enabled.toString());
    this.isEnabled = enabled;
  }

  /**
   * Get haptic pattern for type
   */
  private getPattern(type: HapticType): HapticPattern {
    const patterns: Record<HapticType, HapticPattern> = {
      light: { duration: 10, intensity: 'light' },
      medium: { duration: 20, intensity: 'medium' },
      heavy: { duration: 30, intensity: 'heavy' },
      success: { duration: [10, 50, 10], intensity: 'medium' },
      warning: { duration: [20, 100, 20], intensity: 'heavy' },
      error: { duration: [30, 50, 30, 50, 30], intensity: 'heavy' },
      selection: { duration: 5, intensity: 'light' }
    };

    return patterns[type];
  }

  /**
   * Trigger haptic feedback
   */
  async trigger(type: HapticType = 'light'): Promise<void> {
    if (!this.isSupported || !this.isEnabled) {
      return;
    }

    const pattern = this.getPattern(type);

    try {
      if (this.isNative) {
        // Use Capacitor Haptics for native platforms
        await this.triggerNativeHaptic(pattern);
      } else {
        // Use Vibration API for web
        this.triggerWebHaptic(pattern);
      }
    } catch (error) {
      console.error('[Haptic] Error triggering haptic:', error);
    }
  }

  /**
   * Trigger native haptic feedback (Capacitor)
   */
  private async triggerNativeHaptic(pattern: HapticPattern): Promise<void> {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');

      // Map intensity to Capacitor ImpactStyle
      const styleMap = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy
      };

      const style = styleMap[pattern.intensity || 'medium'];

      // Trigger haptic
      await Haptics.impact({ style });
    } catch (error) {
      console.error('[Haptic] Native haptic error:', error);
    }
  }

  /**
   * Trigger web haptic feedback (Vibration API)
   */
  private triggerWebHaptic(pattern: HapticPattern): void {
    if (!('vibrate' in navigator)) {
      return;
    }

    try {
      if (Array.isArray(pattern.duration)) {
        navigator.vibrate(pattern.duration);
      } else {
        navigator.vibrate(pattern.duration);
      }
    } catch (error) {
      console.error('[Haptic] Web vibration error:', error);
    }
  }

  /**
   * Trigger haptic for button press
   */
  async button(): Promise<void> {
    await this.trigger('light');
  }

  /**
   * Trigger haptic for selection change
   */
  async selection(): Promise<void> {
    await this.trigger('selection');
  }

  /**
   * Trigger haptic for success action
   */
  async success(): Promise<void> {
    await this.trigger('success');
  }

  /**
   * Trigger haptic for warning
   */
  async warning(): Promise<void> {
    await this.trigger('warning');
  }

  /**
   * Trigger haptic for error
   */
  async error(): Promise<void> {
    await this.trigger('error');
  }

  /**
   * Trigger haptic for notification
   */
  async notification(): Promise<void> {
    await this.trigger('medium');
  }

  /**
   * Enable haptic feedback
   */
  enable(): void {
    this.saveSettings(true);
  }

  /**
   * Disable haptic feedback
   */
  disable(): void {
    this.saveSettings(false);
  }

  /**
   * Toggle haptic feedback
   */
  toggle(): boolean {
    const newState = !this.isEnabled;
    this.saveSettings(newState);
    return newState;
  }

  /**
   * Check if haptic feedback is enabled
   */
  isHapticEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Check if device supports haptics
   */
  isHapticSupported(): boolean {
    return this.isSupported;
  }
}

// Export singleton instance
export const hapticService = new HapticService();

/**
 * React hook for haptic feedback
 */
export function useHaptic() {
  const trigger = async (type: HapticType = 'light') => {
    await hapticService.trigger(type);
  };

  return {
    trigger,
    button: () => hapticService.button(),
    selection: () => hapticService.selection(),
    success: () => hapticService.success(),
    warning: () => hapticService.warning(),
    error: () => hapticService.error(),
    notification: () => hapticService.notification(),
    enable: () => hapticService.enable(),
    disable: () => hapticService.disable(),
    toggle: () => hapticService.toggle(),
    isEnabled: hapticService.isHapticEnabled(),
    isSupported: hapticService.isHapticSupported()
  };
}
