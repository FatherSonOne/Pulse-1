/**
 * PWA Service
 * Utilities for Progressive Web App features
 */

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class PWAService {
  private deferredPrompt: InstallPromptEvent | null = null;
  private installPromptShown = false;
  private readonly STORAGE_KEY = 'pwa_install_dismissed';
  private readonly VISIT_COUNT_KEY = 'pwa_visit_count';
  private readonly FIRST_VISIT_KEY = 'pwa_first_visit';
  private readonly USAGE_TIME_KEY = 'pwa_usage_time';

  constructor() {
    this.init();
  }

  private init() {
    // Listen for beforeinstallprompt event (Chrome, Edge, Samsung Internet)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as InstallPromptEvent;
      console.log('[PWA] Install prompt available');
    });

    // Track app install
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed');
      this.deferredPrompt = null;
      this.trackEvent('app_installed');
    });

    // Track visits
    this.incrementVisitCount();

    // Track usage time
    this.startTrackingUsageTime();
  }

  /**
   * Check if app can be installed
   */
  canInstall(): boolean {
    return this.deferredPrompt !== null && !this.isInstalled();
  }

  /**
   * Check if app is already installed
   */
  isInstalled(): boolean {
    // Check if running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }

    // Check if running in iOS standalone mode
    if ((window.navigator as any).standalone === true) {
      return true;
    }

    return false;
  }

  /**
   * Check if install prompt should be shown based on user behavior
   */
  shouldShowInstallPrompt(): boolean {
    // Don't show if already installed
    if (this.isInstalled()) {
      return false;
    }

    // Don't show if user dismissed it recently (within 7 days)
    const dismissedAt = localStorage.getItem(this.STORAGE_KEY);
    if (dismissedAt) {
      const dismissedDate = new Date(dismissedAt);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return false;
      }
    }

    // Check if user has visited enough times (2+ visits)
    const visitCount = this.getVisitCount();
    if (visitCount < 2) {
      return false;
    }

    // Check if user has used the app enough (5+ minutes)
    const usageTime = this.getUsageTime();
    if (usageTime < 5 * 60 * 1000) { // 5 minutes in milliseconds
      return false;
    }

    return true;
  }

  /**
   * Show the install prompt
   */
  async showInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferredPrompt) {
      console.log('[PWA] Install prompt not available');
      return 'unavailable';
    }

    try {
      // Show the install prompt
      await this.deferredPrompt.prompt();
      this.installPromptShown = true;

      // Wait for user response
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log('[PWA] User choice:', outcome);

      if (outcome === 'accepted') {
        this.trackEvent('install_accepted');
      } else {
        this.trackEvent('install_dismissed');
        this.markPromptDismissed();
      }

      this.deferredPrompt = null;
      return outcome;
    } catch (error) {
      console.error('[PWA] Error showing install prompt:', error);
      return 'unavailable';
    }
  }

  /**
   * Mark install prompt as dismissed
   */
  markPromptDismissed() {
    localStorage.setItem(this.STORAGE_KEY, new Date().toISOString());
  }

  /**
   * Get number of visits
   */
  private getVisitCount(): number {
    const count = localStorage.getItem(this.VISIT_COUNT_KEY);
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Increment visit count
   */
  private incrementVisitCount() {
    const count = this.getVisitCount();
    localStorage.setItem(this.VISIT_COUNT_KEY, (count + 1).toString());

    // Track first visit timestamp
    if (count === 0) {
      localStorage.setItem(this.FIRST_VISIT_KEY, new Date().toISOString());
    }
  }

  /**
   * Get total usage time in milliseconds
   */
  private getUsageTime(): number {
    const time = localStorage.getItem(this.USAGE_TIME_KEY);
    return time ? parseInt(time, 10) : 0;
  }

  /**
   * Start tracking usage time
   */
  private startTrackingUsageTime() {
    const startTime = Date.now();

    // Save usage time periodically
    const saveUsageTime = () => {
      const currentUsageTime = this.getUsageTime();
      const sessionTime = Date.now() - startTime;
      localStorage.setItem(this.USAGE_TIME_KEY, (currentUsageTime + sessionTime).toString());
    };

    // Save every 30 seconds
    const interval = setInterval(saveUsageTime, 30000);

    // Save on page unload
    window.addEventListener('beforeunload', () => {
      clearInterval(interval);
      saveUsageTime();
    });

    // Save on visibility change (tab switch, minimize)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        saveUsageTime();
      }
    });
  }

  /**
   * Check if device is iOS
   */
  isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }

  /**
   * Check if browser is Safari
   */
  isSafari(): boolean {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }

  /**
   * Check if device is iOS Safari (needs manual install instructions)
   */
  isIOSSafari(): boolean {
    return this.isIOS() && this.isSafari();
  }

  /**
   * Track analytics event
   */
  private trackEvent(eventName: string, properties?: Record<string, any>) {
    // Integrate with your analytics service here
    console.log('[PWA] Event:', eventName, properties);

    // Example: Google Analytics
    if ((window as any).gtag) {
      (window as any).gtag('event', eventName, properties);
    }
  }

  /**
   * Get install instructions for current platform
   */
  getInstallInstructions(): string[] {
    if (this.isIOSSafari()) {
      return [
        'Tap the Share button',
        'Scroll down and tap "Add to Home Screen"',
        'Tap "Add" to confirm'
      ];
    }

    // Chrome/Edge on Android or Desktop
    return [
      'Tap the menu button (⋮)',
      'Tap "Add to Home screen" or "Install app"',
      'Follow the prompts to install'
    ];
  }

  /**
   * Check if service worker is supported
   */
  isServiceWorkerSupported(): boolean {
    return 'serviceWorker' in navigator;
  }

  /**
   * Check if push notifications are supported
   */
  isPushSupported(): boolean {
    return 'PushManager' in window && 'serviceWorker' in navigator;
  }

  /**
   * Get notification permission status
   */
  getNotificationPermission(): NotificationPermission {
    return Notification.permission;
  }

  /**
   * Check if app is running in standalone mode
   */
  isStandalone(): boolean {
    return this.isInstalled();
  }
}

// Export singleton instance
export const pwaService = new PWAService();
