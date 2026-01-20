// ============================================
// SENTRY ERROR TRACKING
// Production error monitoring and reporting
// ============================================

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

// Sentry configuration
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
const ENVIRONMENT = import.meta.env.VITE_APP_MODE || 'development';

// Initialize Sentry
export function initializeSentry(): void {
  // Only initialize in production or if explicitly enabled
  if (!SENTRY_DSN || ENVIRONMENT === 'development') {
    console.log('Sentry monitoring disabled in development');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: `pulse-messages@${APP_VERSION}`,

    // Performance monitoring
    integrations: [
      new BrowserTracing({
        tracePropagationTargets: [
          'localhost',
          /^https:\/\/.*\.pulsemessages\.com/,
          /^https:\/\/.*\.supabase\.co/
        ],
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes
        )
      }),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true
      })
    ],

    // Performance monitoring sample rate
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Session replay sample rate
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Error filtering
    beforeSend(event, hint) {
      // Filter out expected errors
      const error = hint.originalException;

      if (error && typeof error === 'object') {
        const errorMessage = (error as Error).message || '';

        // Don't send these errors to Sentry
        const ignoredErrors = [
          'ResizeObserver loop limit exceeded',
          'Non-Error promise rejection captured',
          'Network request failed',
          'Failed to fetch',
          'cancelled'
        ];

        if (ignoredErrors.some(ignored => errorMessage.includes(ignored))) {
          return null;
        }
      }

      // Add user context if available
      const user = getUserContext();
      if (user) {
        event.user = user;
      }

      return event;
    },

    // Breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filter sensitive data from breadcrumbs
      if (breadcrumb.category === 'console') {
        return null;
      }

      if (breadcrumb.category === 'fetch' && breadcrumb.data?.url) {
        // Remove sensitive query parameters
        breadcrumb.data.url = sanitizeUrl(breadcrumb.data.url);
      }

      return breadcrumb;
    },

    // Ignore specific URLs
    ignoreErrors: [
      // Browser extensions
      'chrome-extension://',
      'moz-extension://',
      // Random network errors
      'NetworkError',
      'Network request failed',
      // ResizeObserver
      'ResizeObserver loop'
    ]
  });

  console.log('Sentry initialized:', {
    environment: ENVIRONMENT,
    version: APP_VERSION
  });
}

// Get user context for error reporting
function getUserContext(): Sentry.User | null {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;

    const user = JSON.parse(userStr);
    return {
      id: user.id,
      email: user.email,
      username: user.username || user.email
    };
  } catch {
    return null;
  }
}

// Sanitize URLs to remove sensitive data
function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const sensitiveParams = ['token', 'api_key', 'apikey', 'password', 'secret'];

    sensitiveParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[REDACTED]');
      }
    });

    return urlObj.toString();
  } catch {
    return url;
  }
}

// Manual error capture
export function captureError(
  error: Error,
  context?: Record<string, any>
): void {
  if (ENVIRONMENT === 'development') {
    console.error('Error captured:', error, context);
    return;
  }

  Sentry.captureException(error, {
    extra: context
  });
}

// Capture message for info/warning
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
): void {
  if (ENVIRONMENT === 'development') {
    console.log(`[${level}] ${message}`, context);
    return;
  }

  Sentry.captureMessage(message, {
    level,
    extra: context
  });
}

// Set user context
export function setUserContext(user: {
  id: string;
  email: string;
  username?: string;
}): void {
  Sentry.setUser(user);
}

// Clear user context
export function clearUserContext(): void {
  Sentry.setUser(null);
}

// Add breadcrumb
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info'
  });
}

// Start performance transaction
export function startTransaction(
  name: string,
  op: string
): Sentry.Transaction {
  return Sentry.startTransaction({
    name,
    op
  });
}

// Wrap component with error boundary
export const SentryErrorBoundary = Sentry.ErrorBoundary;

// Performance monitoring helpers
export const withProfiler = Sentry.withProfiler;

// Export Sentry instance for advanced usage
export { Sentry };

// Import React Router dependencies for instrumentation
import React, { useEffect } from 'react';
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes
} from 'react-router-dom';
