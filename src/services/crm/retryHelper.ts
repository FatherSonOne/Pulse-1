// ============================================
// CRM API Retry Logic
// Handles rate limiting, token refresh, and transient errors
// ============================================

import { CRMIntegration } from '../../types/crmTypes';
import { refreshCRMToken } from './oauthHelper';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryableStatusCodes?: number[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Execute CRM operation with automatic retry and token refresh
 */
export async function withCRMRetry<T>(
  operation: () => Promise<T>,
  integration: CRMIntegration,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Handle 401 Unauthorized - Token expired
      if (
        error.response?.status === 401 ||
        error.message?.includes('401') ||
        error.message?.toLowerCase().includes('unauthorized') ||
        error.message?.toLowerCase().includes('expired')
      ) {
        console.log(
          `Token expired for ${integration.platform}, refreshing...`
        );
        try {
          await refreshCRMToken(integration);
          // Retry immediately after refresh (don't count as retry)
          return await operation();
        } catch (refreshError) {
          throw new Error(
            `Failed to refresh ${integration.platform} token: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`
          );
        }
      }

      // Handle 429 Rate Limiting
      if (
        error.response?.status === 429 ||
        error.message?.includes('429') ||
        error.message?.toLowerCase().includes('rate limit')
      ) {
        const retryAfter = error.response?.headers?.['retry-after'];
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(opts.baseDelay * Math.pow(2, attempt), opts.maxDelay);

        console.log(
          `Rate limited by ${integration.platform}, retrying after ${delay}ms...`
        );
        await sleep(delay);
        continue;
      }

      // Handle retryable status codes
      const statusCode = error.response?.status;
      if (statusCode && opts.retryableStatusCodes.includes(statusCode)) {
        if (attempt < opts.maxRetries - 1) {
          const delay = Math.min(
            opts.baseDelay * Math.pow(2, attempt),
            opts.maxDelay
          );
          console.log(
            `Retryable error (${statusCode}) from ${integration.platform}, retrying after ${delay}ms... (attempt ${attempt + 1}/${opts.maxRetries})`
          );
          await sleep(delay);
          continue;
        }
      }

      // Non-retryable error
      throw error;
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Execute with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}

/**
 * Batch requests with rate limiting
 */
export async function batchWithRateLimit<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    delayBetweenBatches?: number;
  } = {}
): Promise<R[]> {
  const { batchSize = 10, delayBetweenBatches = 1000 } = options;
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(operation));
    results.push(...batchResults);

    // Delay between batches (except for last batch)
    if (i + batchSize < items.length) {
      await sleep(delayBetweenBatches);
    }
  }

  return results;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse error message from various CRM API error formats
 */
export function parseCRMError(error: any): string {
  // Axios error
  if (error.response?.data) {
    const data = error.response.data;

    // HubSpot error format
    if (data.message) {
      return data.message;
    }

    // Salesforce error format
    if (Array.isArray(data) && data[0]?.message) {
      return data[0].message;
    }

    // Pipedrive error format
    if (data.error) {
      return typeof data.error === 'string'
        ? data.error
        : data.error.message || JSON.stringify(data.error);
    }

    // Zoho error format
    if (data.data?.[0]?.message) {
      return data.data[0].message;
    }
  }

  // Standard error
  if (error.message) {
    return error.message;
  }

  return 'Unknown CRM API error';
}

/**
 * Create standardized CRM error
 */
export class CRMError extends Error {
  constructor(
    public platform: string,
    public operation: string,
    public statusCode?: number,
    message?: string
  ) {
    super(message || `${platform} ${operation} failed`);
    this.name = 'CRMError';
  }
}
