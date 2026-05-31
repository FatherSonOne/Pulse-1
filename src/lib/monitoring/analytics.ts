// ============================================
// USER ANALYTICS & PRODUCT ANALYTICS
// PostHog integration for user behavior tracking
// ============================================
//
// Calls are still gated by VITE_POSTHOG_API_KEY — without it the module
// stays dormant (the SDK is imported but never `.init()`-ed), so dev
// envs without telemetry credentials don't fire any captures.

import posthog from 'posthog-js';

let isInitialized = false;
function posthogOrNull(): typeof posthog | null {
  return isInitialized ? posthog : null;
}

const POSTHOG_API_KEY = import.meta.env.VITE_POSTHOG_API_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';
const ENVIRONMENT = import.meta.env.VITE_APP_MODE || 'development';
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

// Initialize PostHog
export function initializeAnalytics(): void {
  if (!POSTHOG_API_KEY || ENVIRONMENT === 'development') {
    console.log('Analytics disabled in development');
    return;
  }
  if (isInitialized) return;

  posthog.init(POSTHOG_API_KEY, {
    api_host: POSTHOG_HOST,

    // Feature flags
    enable_recording_console_log: false,

    // Session recording
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-sensitive]',
      recordCrossOriginIframes: false,
    },

    // Autocapture
    autocapture: {
      dom_event_allowlist: ['click', 'submit', 'change'],
      // Production lives at pulse.logosvision.org; localhost included so the
      // operator's own dev-mode QA still records sessions when PostHog is on.
      url_allowlist: [/pulse\.logosvision\.org/, /localhost/],
      element_allowlist: ['button', 'a', 'input', 'select', 'textarea'],
    },

    // Privacy
    opt_out_capturing_by_default: false,
    disable_session_recording: false,
    respect_dnt: true,

    // Performance
    loaded: (ph) => {
      if (ENVIRONMENT === 'development') {
        ph.debug();
      }
    },
  });

  isInitialized = true;
  console.log('Analytics initialized:', {
    environment: ENVIRONMENT,
    version: APP_VERSION,
  });
}

// Identify user
export function identifyUser(
  userId: string,
  properties?: Record<string, any>
): void {
  if (!POSTHOG_API_KEY) return;

  posthogOrNull()?.identify(userId, {
    app_version: APP_VERSION,
    environment: ENVIRONMENT,
    ...properties
  });
}

// Track event
export function trackEvent(
  eventName: string,
  properties?: Record<string, any>
): void {
  if (!POSTHOG_API_KEY) {
    console.log(`[Analytics] ${eventName}`, properties);
    return;
  }

  posthogOrNull()?.capture(eventName, {
    ...properties,
    app_version: APP_VERSION,
    environment: ENVIRONMENT,
    timestamp: new Date().toISOString()
  });
}

// Track page view
export function trackPageView(
  pageName: string,
  properties?: Record<string, any>
): void {
  trackEvent('$pageview', {
    page_name: pageName,
    ...properties
  });
}

// Track feature usage
export function trackFeatureUsage(
  featureName: string,
  action: string,
  properties?: Record<string, any>
): void {
  trackEvent('Feature Usage', {
    feature_name: featureName,
    action,
    ...properties
  });
}

// Track user engagement
export function trackEngagement(
  engagementType: string,
  properties?: Record<string, any>
): void {
  trackEvent('User Engagement', {
    engagement_type: engagementType,
    ...properties
  });
}

// Track conversion
export function trackConversion(
  conversionType: string,
  value?: number,
  properties?: Record<string, any>
): void {
  trackEvent('Conversion', {
    conversion_type: conversionType,
    value,
    ...properties
  });
}

// Track error
export function trackError(
  errorType: string,
  errorMessage: string,
  properties?: Record<string, any>
): void {
  trackEvent('Error Occurred', {
    error_type: errorType,
    error_message: errorMessage,
    ...properties
  });
}

// Update user properties
export function updateUserProperties(
  properties: Record<string, any>
): void {
  if (!POSTHOG_API_KEY) return;

  posthogOrNull()?.people.set(properties);
}

// Increment user property
export function incrementUserProperty(
  property: string,
  value: number = 1
): void {
  if (!POSTHOG_API_KEY) return;

  posthogOrNull()?.people.increment(property, value);
}

// Reset analytics on logout
export function resetAnalytics(): void {
  if (!POSTHOG_API_KEY) return;

  posthogOrNull()?.reset();
}

// Feature flag helpers
export function getFeatureFlag(
  flagKey: string,
  defaultValue?: boolean
): boolean {
  if (!POSTHOG_API_KEY) return defaultValue || false;

  return posthogOrNull()?.isFeatureEnabled(flagKey) || defaultValue || false;
}

export function onFeatureFlags(
  callback: (flags: string[], variants: Record<string, string | boolean>) => void
): void {
  if (!POSTHOG_API_KEY) return;

  posthogOrNull()?.onFeatureFlags(callback);
}

// A/B testing helpers
export function getExperimentVariant(
  experimentKey: string
): string | undefined {
  if (!POSTHOG_API_KEY) return undefined;

  return posthogOrNull()?.getFeatureFlagPayload(experimentKey) as string | undefined;
}

// Session recording control
export function startSessionRecording(): void {
  if (!POSTHOG_API_KEY) return;

  posthogOrNull()?.startSessionRecording();
}

export function stopSessionRecording(): void {
  if (!POSTHOG_API_KEY) return;

  posthogOrNull()?.stopSessionRecording();
}

// Opt out of tracking
export function optOutTracking(): void {
  if (!POSTHOG_API_KEY) return;

  posthogOrNull()?.opt_out_capturing();
}

// Opt in to tracking
export function optInTracking(): void {
  if (!POSTHOG_API_KEY) return;

  posthogOrNull()?.opt_in_capturing();
}

// Custom analytics for specific features

export function trackMessageSent(
  messageType: 'text' | 'voice' | 'file',
  properties?: Record<string, any> & {
    /**
     * Active workspace at send time. Pulse DMs aren't workspace-scoped at
     * the RPC level (user-to-user), so this is the sender's currently
     * selected workspace context — best-effort, omit when none is set.
     * Enables the NSM "Weekly Active Collaborative Workspaces" GROUP BY.
     */
    workspace_id?: string;
    /**
     * Owning organization, when distinct from the workspace. Pulse models
     * org == workspace today, so this is reserved for forward-compat and
     * should be omitted unless a real org id is in hand.
     */
    organization_id?: string;
  }
): void {
  trackEvent('Message Sent', {
    message_type: messageType,
    ...properties
  });
}

export function trackThreadView(
  threadId: string,
  messageCount: number
): void {
  trackEvent('Thread Viewed', {
    thread_id: threadId,
    message_count: messageCount
  });
}

export function trackReactionAdded(
  reactionType: string,
  messageId: string
): void {
  trackEvent('Reaction Added', {
    reaction_type: reactionType,
    message_id: messageId
  });
}

export function trackFocusModeToggled(
  enabled: boolean,
  duration?: number
): void {
  trackEvent('Focus Mode Toggled', {
    enabled,
    duration
  });
}

export function trackToolActivated(
  toolName: string,
  context?: string
): void {
  trackEvent('Tool Activated', {
    tool_name: toolName,
    context
  });
}

export function trackCRMSync(
  crmType: string,
  success: boolean,
  syncedCount?: number
): void {
  trackEvent('CRM Sync', {
    crm_type: crmType,
    success,
    synced_count: syncedCount
  });
}

export function trackAISummarization(
  contentType: string,
  success: boolean,
  processingTime?: number
): void {
  trackEvent('AI Summarization', {
    content_type: contentType,
    success,
    processing_time: processingTime
  });
}

export function trackPerformanceMetric(
  metricName: string,
  value: number,
  unit: string = 'ms'
): void {
  trackEvent('Performance Metric', {
    metric_name: metricName,
    value,
    unit
  });
}

// Export PostHog instance for advanced usage (feature flag payloads,
// custom capture options). Pre-initialization the SDK no-ops on most calls
// per the package's own guards.
export { posthog };
