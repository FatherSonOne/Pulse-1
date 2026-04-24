/**
 * Gemini API Health Monitor
 *
 * Continuously monitors Gemini API health and quota status.
 */

export interface APIHealthStatus {
  provider: 'gemini' | 'none';
  gemini: {
    available: boolean;
    status: 'ok' | 'quota_exceeded' | 'error' | 'unchecked';
    lastChecked: Date | null;
    errorMessage?: string;
    errorCode?: number;
    nextRetryAt?: Date;
  };
  fallbackActive: boolean;
}

export interface QuotaInfo {
  requestsPerMinute: number;
  requestsPerDay: number;
  tier: 'free' | 'paid' | 'unknown';
  resetTime?: Date;
}

// Singleton state
let currentStatus: APIHealthStatus = {
  provider: 'none',
  gemini: {
    available: false,
    status: 'unchecked',
    lastChecked: null,
  },
  fallbackActive: false,
};

let monitorInterval: NodeJS.Timeout | null = null;
let statusChangeListeners: ((status: APIHealthStatus) => void)[] = [];

// Check interval: every 5 minutes
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Retry backoff: don't hammer API if it's down
const RETRY_BACKOFF_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check if Gemini API is currently working
 */
export async function checkGeminiHealth(): Promise<{
  available: boolean;
  status: 'ok' | 'quota_exceeded' | 'error';
  errorMessage?: string;
  errorCode?: number;
}> {
  const apiKey = localStorage.getItem('gemini_api_key') ||
                 import.meta.env.VITE_GEMINI_API_KEY ||
                 import.meta.env.VITE_API_KEY || '';

  if (!apiKey) {
    return {
      available: false,
      status: 'error',
      errorMessage: 'No Gemini API key configured',
    };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ping' }] }],
        }),
      }
    );

    if (response.ok) {
      return { available: true, status: 'ok' };
    }

    const data = await response.json();
    const errorMessage = data?.error?.message || response.statusText;

    if (response.status === 429) {
      return {
        available: false,
        status: 'quota_exceeded',
        errorMessage,
        errorCode: 429,
      };
    }

    return {
      available: false,
      status: 'error',
      errorMessage,
      errorCode: response.status,
    };
  } catch (err) {
    return {
      available: false,
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/**
 * Update current health status
 */
async function updateHealthStatus(): Promise<void> {
  const geminiHealth = await checkGeminiHealth();

  const nextRetryAt = geminiHealth.status === 'quota_exceeded'
    ? new Date(Date.now() + RETRY_BACKOFF_MS)
    : undefined;

  currentStatus = {
    provider: geminiHealth.available ? 'gemini' : 'none',
    gemini: {
      available: geminiHealth.available,
      status: geminiHealth.status,
      lastChecked: new Date(),
      errorMessage: geminiHealth.errorMessage,
      errorCode: geminiHealth.errorCode,
      nextRetryAt,
    },
    fallbackActive: false,
  };

  // Notify listeners
  statusChangeListeners.forEach(listener => listener(currentStatus));
}

/**
 * Start monitoring Gemini API health
 */
export function startHealthMonitoring(): void {
  if (monitorInterval) return; // Already running

  // Initial check
  updateHealthStatus();

  // Periodic checks
  monitorInterval = setInterval(updateHealthStatus, CHECK_INTERVAL_MS);

  console.info('[GeminiHealthMonitor] Started monitoring API health');
}

/**
 * Stop monitoring
 */
export function stopHealthMonitoring(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.info('[GeminiHealthMonitor] Stopped monitoring');
  }
}

/**
 * Get current health status (synchronous)
 */
export function getHealthStatus(): APIHealthStatus {
  return { ...currentStatus };
}

/**
 * Force an immediate health check
 */
export async function forceHealthCheck(): Promise<APIHealthStatus> {
  await updateHealthStatus();
  return getHealthStatus();
}

/**
 * Subscribe to health status changes
 */
export function onHealthStatusChange(callback: (status: APIHealthStatus) => void): () => void {
  statusChangeListeners.push(callback);

  // Return unsubscribe function
  return () => {
    statusChangeListeners = statusChangeListeners.filter(cb => cb !== callback);
  };
}

/**
 * Get recommended provider based on current health
 */
export function getRecommendedProvider(): 'gemini' | 'none' {
  if (currentStatus.gemini.available) return 'gemini';
  return 'none';
}

/**
 * Check if we should show a quota warning
 */
export function shouldShowQuotaWarning(): boolean {
  return currentStatus.gemini.status === 'quota_exceeded';
}

/**
 * Get user-friendly status message
 */
export function getStatusMessage(): string {
  const { gemini } = currentStatus;

  if (gemini.available) {
    return '✅ Gemini API is working normally';
  }

  if (gemini.status === 'quota_exceeded') {
    return '🔴 Gemini quota exceeded.';
  }

  if (gemini.status === 'error') {
    return `🔴 Gemini error: ${gemini.errorMessage}`;
  }

  return '🔴 No AI provider configured';
}

/**
 * Get quota reset estimate (if available from error message)
 */
export function getQuotaResetEstimate(): Date | null {
  if (currentStatus.gemini.status === 'quota_exceeded') {
    // Gemini free tier resets daily at midnight Pacific Time
    const now = new Date();
    const resetTime = new Date(now);
    resetTime.setUTCHours(8, 0, 0, 0); // Midnight PT = 8am UTC

    if (resetTime <= now) {
      resetTime.setDate(resetTime.getDate() + 1);
    }

    return resetTime;
  }
  return null;
}
