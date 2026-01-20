// ============================================
// MONITORING & ANALYTICS INITIALIZATION
// Central initialization for all monitoring tools
// ============================================

import { initializeSentry, captureError, captureMessage } from './sentry';
import { initializeAnalytics, trackEvent, identifyUser } from './analytics';

export interface MonitoringConfig {
  enableSentry: boolean;
  enableAnalytics: boolean;
  environment: string;
  version: string;
}

// Initialize all monitoring tools
export function initializeMonitoring(config?: Partial<MonitoringConfig>): void {
  const {
    enableSentry = true,
    enableAnalytics = true,
    environment = import.meta.env.VITE_APP_MODE || 'development',
    version = import.meta.env.VITE_APP_VERSION || '1.0.0'
  } = config || {};

  console.log('Initializing monitoring:', {
    environment,
    version,
    sentry: enableSentry,
    analytics: enableAnalytics
  });

  // Initialize Sentry error tracking
  if (enableSentry) {
    try {
      initializeSentry();
      captureMessage('Application started', 'info', {
        environment,
        version
      });
    } catch (error) {
      console.error('Failed to initialize Sentry:', error);
    }
  }

  // Initialize PostHog analytics
  if (enableAnalytics) {
    try {
      initializeAnalytics();
      trackEvent('Application Loaded', {
        environment,
        version,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to initialize analytics:', error);
    }
  }

  // Set up global error handlers
  setupGlobalErrorHandlers();

  // Track performance metrics
  trackPerformanceMetrics();
}

// Set up global error handlers
function setupGlobalErrorHandlers(): void {
  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    captureError(
      new Error(`Unhandled Promise Rejection: ${event.reason}`),
      {
        type: 'unhandled_rejection',
        reason: event.reason
      }
    );
  });

  // Catch global errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    captureError(event.error || new Error(event.message), {
      type: 'global_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });
}

// Track performance metrics
function trackPerformanceMetrics(): void {
  // Wait for page load
  if (typeof window === 'undefined' || !window.performance) {
    return;
  }

  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      if (perfData) {
        const metrics = {
          dns_lookup: perfData.domainLookupEnd - perfData.domainLookupStart,
          tcp_connection: perfData.connectEnd - perfData.connectStart,
          tls_negotiation: perfData.requestStart - perfData.secureConnectionStart,
          ttfb: perfData.responseStart - perfData.requestStart,
          content_download: perfData.responseEnd - perfData.responseStart,
          dom_processing: perfData.domComplete - perfData.domInteractive,
          page_load: perfData.loadEventEnd - perfData.fetchStart
        };

        trackEvent('Performance Metrics', metrics);
      }

      // Track Core Web Vitals
      trackCoreWebVitals();
    }, 0);
  });
}

// Track Core Web Vitals
function trackCoreWebVitals(): void {
  if (typeof window === 'undefined') return;

  // Largest Contentful Paint (LCP)
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;

      trackEvent('Core Web Vital - LCP', {
        value: lastEntry.renderTime || lastEntry.loadTime,
        rating: lastEntry.renderTime > 2500 ? 'poor' : lastEntry.renderTime > 1000 ? 'needs-improvement' : 'good'
      });
    });

    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
  } catch (e) {
    // LCP not supported
  }

  // First Input Delay (FID)
  try {
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        const fid = entry.processingStart - entry.startTime;

        trackEvent('Core Web Vital - FID', {
          value: fid,
          rating: fid > 300 ? 'poor' : fid > 100 ? 'needs-improvement' : 'good'
        });
      });
    });

    fidObserver.observe({ entryTypes: ['first-input'] });
  } catch (e) {
    // FID not supported
  }

  // Cumulative Layout Shift (CLS)
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
    });

    clsObserver.observe({ entryTypes: ['layout-shift'] });

    // Report CLS on page unload
    window.addEventListener('beforeunload', () => {
      trackEvent('Core Web Vital - CLS', {
        value: clsValue,
        rating: clsValue > 0.25 ? 'poor' : clsValue > 0.1 ? 'needs-improvement' : 'good'
      });
    });
  } catch (e) {
    // CLS not supported
  }
}

// Re-export monitoring functions for convenience
export {
  // Sentry
  captureError,
  captureMessage,
  setUserContext,
  clearUserContext,
  addBreadcrumb,
  SentryErrorBoundary
} from './sentry';

export {
  // Analytics
  identifyUser,
  trackEvent,
  trackPageView,
  trackFeatureUsage,
  trackEngagement,
  trackConversion,
  trackError,
  updateUserProperties,
  incrementUserProperty,
  resetAnalytics,
  getFeatureFlag,
  onFeatureFlags,
  getExperimentVariant,
  startSessionRecording,
  stopSessionRecording,
  optOutTracking,
  optInTracking,
  // Custom tracking
  trackMessageSent,
  trackThreadView,
  trackReactionAdded,
  trackFocusModeToggled,
  trackToolActivated,
  trackCRMSync,
  trackAISummarization,
  trackPerformanceMetric
} from './analytics';
