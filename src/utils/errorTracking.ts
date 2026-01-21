/**
 * Error Tracking and Monitoring Infrastructure
 * Sentry integration for production error monitoring
 */

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

interface ErrorTrackingConfig {
  dsn: string;
  environment: string;
  tracesSampleRate?: number;
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
  enabled?: boolean;
}

/**
 * Initialize error tracking with Sentry
 */
export function initializeErrorTracking(config: ErrorTrackingConfig): void {
  if (!config.enabled || !config.dsn) {
    console.log('Error tracking disabled or DSN not configured');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    integrations: [
      new BrowserTracing({
        tracePropagationTargets: [
          'localhost',
          /^https:\/\/.*\.supabase\.co/,
          /^https:\/\/generativelanguage\.googleapis\.com/,
        ],
      }),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Performance Monitoring
    tracesSampleRate: config.tracesSampleRate ?? 0.1, // 10% of transactions

    // Session Replay
    replaysSessionSampleRate: config.replaysSessionSampleRate ?? 0.1, // 10% of sessions
    replaysOnErrorSampleRate: config.replaysOnErrorSampleRate ?? 1.0, // 100% of sessions with errors

    // Before sending events
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
      }

      // Add custom context
      if (event.user) {
        // Remove PII
        delete event.user.email;
        delete event.user.username;
      }

      return event;
    },

    // Ignore specific errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'atomicFindClose',
      // Network errors
      'NetworkError',
      'Failed to fetch',
      'Network request failed',
      // User cancelled actions
      'AbortError',
      'User cancelled',
    ],

    // Deny URLs (third-party scripts)
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
    ],
  });

  console.log(`Error tracking initialized for ${config.environment} environment`);
}

/**
 * Set user context for error tracking
 */
export function setUser(user: {
  id: string;
  role?: string;
  plan?: string;
}): void {
  Sentry.setUser({
    id: user.id,
    role: user.role,
    plan: user.plan,
  });
}

/**
 * Clear user context (on logout)
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Capture exception manually
 */
export function captureException(
  error: Error,
  context?: Record<string, any>
): void {
  if (context) {
    Sentry.setContext('custom', context);
  }
  Sentry.captureException(error);
}

/**
 * Capture message manually
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
): void {
  if (context) {
    Sentry.setContext('custom', context);
  }
  Sentry.captureMessage(message, level);
}

/**
 * Set custom tags
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * Set multiple tags
 */
export function setTags(tags: Record<string, string>): void {
  Sentry.setTags(tags);
}

/**
 * Set custom context
 */
export function setContext(name: string, context: Record<string, any>): void {
  Sentry.setContext(name, context);
}

/**
 * Start a new transaction for performance monitoring
 */
export function startTransaction(
  name: string,
  op: string
): Sentry.Transaction | undefined {
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Track API call performance
 */
export async function trackApiCall<T>(
  name: string,
  apiCall: () => Promise<T>
): Promise<T> {
  const transaction = startTransaction(name, 'api.call');

  try {
    const result = await apiCall();
    transaction?.setStatus('ok');
    return result;
  } catch (error) {
    transaction?.setStatus('internal_error');
    captureException(error as Error, { apiCall: name });
    throw error;
  } finally {
    transaction?.finish();
  }
}

/**
 * Error boundary fallback component
 */
export interface ErrorBoundaryFallbackProps {
  error: Error;
  resetError: () => void;
}

/**
 * Initialize error tracking from environment variables
 */
export function initializeFromEnv(): void {
  const config: ErrorTrackingConfig = {
    dsn: import.meta.env.VITE_SENTRY_DSN || '',
    environment: import.meta.env.VITE_ENV || 'development',
    tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    replaysSessionSampleRate: parseFloat(import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE || '0.1'),
    replaysOnErrorSampleRate: parseFloat(import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE || '1.0'),
    enabled: import.meta.env.VITE_ENABLE_ERROR_TRACKING === 'true',
  };

  initializeErrorTracking(config);
}

/**
 * Global error handler
 */
export function setupGlobalErrorHandlers(): void {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    captureException(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      { type: 'unhandledRejection' }
    );
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    captureException(event.error || new Error(event.message), {
      type: 'globalError',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
}

export default {
  initialize: initializeFromEnv,
  setUser,
  clearUser,
  addBreadcrumb,
  captureException,
  captureMessage,
  setTag,
  setTags,
  setContext,
  startTransaction,
  trackApiCall,
  setupGlobalErrorHandlers,
};
