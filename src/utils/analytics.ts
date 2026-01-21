/**
 * Analytics and Event Tracking Infrastructure
 * Privacy-compliant analytics with user consent
 */

interface AnalyticsConfig {
  enabled: boolean;
  trackingId?: string;
  debug?: boolean;
  anonymizeIp?: boolean;
  respectDoNotTrack?: boolean;
}

interface EventProperties {
  category?: string;
  label?: string;
  value?: number;
  [key: string]: any;
}

interface UserProperties {
  userId?: string;
  plan?: string;
  role?: string;
  signupDate?: string;
  [key: string]: any;
}

class Analytics {
  private config: AnalyticsConfig;
  private initialized: boolean = false;
  private consentGiven: boolean = false;
  private queue: Array<() => void> = [];

  constructor() {
    this.config = {
      enabled: false,
      debug: false,
      anonymizeIp: true,
      respectDoNotTrack: true,
    };
  }

  /**
   * Initialize analytics
   */
  initialize(config: AnalyticsConfig): void {
    this.config = { ...this.config, ...config };

    // Check Do Not Track
    if (this.config.respectDoNotTrack && this.isDoNotTrackEnabled()) {
      console.log('Analytics disabled: Do Not Track enabled');
      return;
    }

    if (!this.config.enabled || !this.config.trackingId) {
      console.log('Analytics disabled or tracking ID not configured');
      return;
    }

    this.loadGoogleAnalytics();
    this.initialized = true;

    if (this.config.debug) {
      console.log('Analytics initialized', this.config);
    }
  }

  /**
   * Load Google Analytics script
   */
  private loadGoogleAnalytics(): void {
    if (!this.config.trackingId) return;

    // Load gtag.js
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.config.trackingId}`;
    document.head.appendChild(script);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    function gtag(...args: any[]) {
      window.dataLayer.push(args);
    }
    gtag('js', new Date());
    gtag('config', this.config.trackingId, {
      anonymize_ip: this.config.anonymizeIp,
      send_page_view: false, // We'll send manually
    });

    (window as any).gtag = gtag;
  }

  /**
   * Check if Do Not Track is enabled
   */
  private isDoNotTrackEnabled(): boolean {
    return (
      navigator.doNotTrack === '1' ||
      (window as any).doNotTrack === '1' ||
      (navigator as any).msDoNotTrack === '1'
    );
  }

  /**
   * Set user consent
   */
  setConsent(consent: boolean): void {
    this.consentGiven = consent;

    if (consent && this.queue.length > 0) {
      // Process queued events
      this.queue.forEach((fn) => fn());
      this.queue = [];
    }

    if (this.config.debug) {
      console.log('Analytics consent:', consent);
    }
  }

  /**
   * Track page view
   */
  trackPageView(path: string, title?: string): void {
    if (!this.canTrack()) return;

    const event = () => {
      if ((window as any).gtag) {
        (window as any).gtag('event', 'page_view', {
          page_path: path,
          page_title: title || document.title,
        });
      }

      if (this.config.debug) {
        console.log('Page view tracked:', path, title);
      }
    };

    this.executeOrQueue(event);
  }

  /**
   * Track event
   */
  trackEvent(
    eventName: string,
    properties?: EventProperties
  ): void {
    if (!this.canTrack()) return;

    const event = () => {
      if ((window as any).gtag) {
        (window as any).gtag('event', eventName, properties);
      }

      if (this.config.debug) {
        console.log('Event tracked:', eventName, properties);
      }
    };

    this.executeOrQueue(event);
  }

  /**
   * Track user properties
   */
  setUserProperties(properties: UserProperties): void {
    if (!this.canTrack()) return;

    const event = () => {
      if ((window as any).gtag) {
        (window as any).gtag('set', 'user_properties', properties);
      }

      if (this.config.debug) {
        console.log('User properties set:', properties);
      }
    };

    this.executeOrQueue(event);
  }

  /**
   * Track conversion
   */
  trackConversion(conversionId: string, value?: number): void {
    if (!this.canTrack()) return;

    const event = () => {
      if ((window as any).gtag) {
        (window as any).gtag('event', 'conversion', {
          send_to: conversionId,
          value: value,
        });
      }

      if (this.config.debug) {
        console.log('Conversion tracked:', conversionId, value);
      }
    };

    this.executeOrQueue(event);
  }

  /**
   * Track timing
   */
  trackTiming(
    category: string,
    variable: string,
    value: number,
    label?: string
  ): void {
    if (!this.canTrack()) return;

    const event = () => {
      if ((window as any).gtag) {
        (window as any).gtag('event', 'timing_complete', {
          name: variable,
          value: value,
          event_category: category,
          event_label: label,
        });
      }

      if (this.config.debug) {
        console.log('Timing tracked:', category, variable, value, label);
      }
    };

    this.executeOrQueue(event);
  }

  /**
   * Track exception
   */
  trackException(description: string, fatal: boolean = false): void {
    if (!this.canTrack()) return;

    const event = () => {
      if ((window as any).gtag) {
        (window as any).gtag('event', 'exception', {
          description: description,
          fatal: fatal,
        });
      }

      if (this.config.debug) {
        console.log('Exception tracked:', description, fatal);
      }
    };

    this.executeOrQueue(event);
  }

  /**
   * Check if tracking is allowed
   */
  private canTrack(): boolean {
    return this.initialized && this.config.enabled && this.consentGiven;
  }

  /**
   * Execute event or queue it
   */
  private executeOrQueue(fn: () => void): void {
    if (this.consentGiven) {
      fn();
    } else {
      this.queue.push(fn);
    }
  }
}

// Create singleton instance
const analytics = new Analytics();

// Predefined event tracking functions
export const trackUserLogin = (method: string): void => {
  analytics.trackEvent('login', {
    method,
    category: 'authentication',
  });
};

export const trackUserSignup = (method: string): void => {
  analytics.trackEvent('sign_up', {
    method,
    category: 'authentication',
  });
};

export const trackMessageSent = (messageType: string): void => {
  analytics.trackEvent('message_sent', {
    message_type: messageType,
    category: 'engagement',
  });
};

export const trackDashboardView = (): void => {
  analytics.trackEvent('dashboard_view', {
    category: 'navigation',
  });
};

export const trackBriefingGenerated = (source: string): void => {
  analytics.trackEvent('briefing_generated', {
    source,
    category: 'feature_usage',
  });
};

export const trackDecisionMade = (priority: string): void => {
  analytics.trackEvent('decision_made', {
    priority,
    category: 'productivity',
  });
};

export const trackTaskCreated = (priority: string): void => {
  analytics.trackEvent('task_created', {
    priority,
    category: 'productivity',
  });
};

export const trackSearchPerformed = (query: string): void => {
  analytics.trackEvent('search', {
    search_term: query,
    category: 'engagement',
  });
};

export const trackFeatureUsed = (featureName: string): void => {
  analytics.trackEvent('feature_used', {
    feature_name: featureName,
    category: 'engagement',
  });
};

export const trackError = (errorMessage: string): void => {
  analytics.trackException(errorMessage, false);
};

/**
 * Initialize analytics from environment variables
 */
export function initializeAnalytics(): void {
  const config: AnalyticsConfig = {
    enabled: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    trackingId: import.meta.env.VITE_ANALYTICS_ID,
    debug: import.meta.env.VITE_ENV === 'development',
    anonymizeIp: true,
    respectDoNotTrack: true,
  };

  analytics.initialize(config);
}

export default analytics;
