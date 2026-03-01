/**
 * AI Health Monitor Dashboard
 *
 * Real-time status display for Gemini and Perplexity APIs with
 * quota tracking, fallback status, and auto-refresh.
 */

import React, { useState, useEffect } from 'react';
import { AnimatedIcon } from './ui/AnimatedIcon';
import {
  getHealthStatus,
  onHealthStatusChange,
  forceHealthCheck,
  getStatusMessage,
  getQuotaResetEstimate,
  shouldShowQuotaWarning,
  startHealthMonitoring,
  type APIHealthStatus,
} from '../services/geminiHealthMonitor';

export const AIHealthMonitor: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [status, setStatus] = useState<APIHealthStatus>(getHealthStatus());
  const [checking, setChecking] = useState(false);
  const [timeUntilReset, setTimeUntilReset] = useState<string>('');

  useEffect(() => {
    // Start monitoring when component mounts
    startHealthMonitoring();

    // Subscribe to status changes
    const unsubscribe = onHealthStatusChange(setStatus);

    // Update countdown timer every second
    const timerInterval = setInterval(() => {
      const resetTime = getQuotaResetEstimate();
      if (resetTime) {
        const now = new Date();
        const diff = resetTime.getTime() - now.getTime();
        if (diff > 0) {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeUntilReset(`${hours}h ${minutes}m`);
        } else {
          setTimeUntilReset('Soon');
        }
      } else {
        setTimeUntilReset('');
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(timerInterval);
    };
  }, []);

  const handleRefresh = async () => {
    setChecking(true);
    await forceHealthCheck();
    setChecking(false);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <StatusIndicator status={status} />
        <span className="text-gray-600 dark:text-gray-400">
          {status.provider === 'gemini' && '✓ Gemini'}
          {status.provider === 'perplexity' && '⚠ Fallback'}
          {status.provider === 'both' && '✓ Both APIs'}
          {status.provider === 'none' && '✗ No API'}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          AI Service Status
        </h3>
        <button
          onClick={handleRefresh}
          disabled={checking}
          className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50"
        >
          {checking ? '⟳ Checking...' : '↻ Refresh'}
        </button>
      </div>

      {/* Overall Status Message */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-750 rounded-md">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {getStatusMessage()}
        </p>
      </div>

      {/* Gemini Status */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <StatusDot status={status.gemini.available ? 'ok' : 'error'} />
            <span className="font-medium text-gray-900 dark:text-white">
              Google Gemini API
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {status.gemini.lastChecked
              ? `Checked ${formatRelativeTime(status.gemini.lastChecked)}`
              : 'Not checked'}
          </span>
        </div>

        {!status.gemini.available && (
          <div className="ml-6 space-y-1">
            <p className="text-sm text-red-600 dark:text-red-400">
              {status.gemini.errorCode === 429
                ? 'Quota Exceeded'
                : `Error: ${status.gemini.errorMessage}`}
            </p>
            {status.gemini.errorCode === 429 && timeUntilReset && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Quota resets in: {timeUntilReset}
              </p>
            )}
            {status.gemini.nextRetryAt && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Next check: {status.gemini.nextRetryAt.toLocaleTimeString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Perplexity Status */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <StatusDot status={status.perplexity.configured ? 'ok' : 'warning'} />
          <span className="font-medium text-gray-900 dark:text-white">
            Perplexity AI (Fallback)
          </span>
        </div>
        {!status.perplexity.configured && (
          <p className="ml-6 text-xs text-gray-500 dark:text-gray-400 mt-1">
            Not configured — add VITE_PERPLEXITY_API_KEY to enable fallback
          </p>
        )}
      </div>

      {/* Fallback Active Warning */}
      {status.fallbackActive && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <AnimatedIcon icon="gear" size={14} /> <strong>Fallback Mode Active</strong>
            <br />
            All AI requests are using Perplexity while Gemini quota recovers.
          </p>
        </div>
      )}

      {/* Action Links */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-3 text-xs">
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            → Check Gemini Quota
          </a>
          <a
            href="https://console.cloud.google.com/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            → Google Cloud Billing
          </a>
          <a
            href="https://www.perplexity.ai/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            → Perplexity API Settings
          </a>
        </div>
      </div>
    </div>
  );
};

const StatusIndicator: React.FC<{ status: APIHealthStatus }> = ({ status }) => {
  if (status.gemini.available) {
    return <span className="text-green-500">●</span>;
  }
  if (status.fallbackActive) {
    return <span className="text-amber-500">●</span>;
  }
  return <span className="text-red-500">●</span>;
};

const StatusDot: React.FC<{ status: 'ok' | 'warning' | 'error' }> = ({ status }) => {
  const colors = {
    ok: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };

  return <div className={`w-2 h-2 rounded-full ${colors[status]}`} />;
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} mins ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

export default AIHealthMonitor;
