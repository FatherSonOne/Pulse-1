/**
 * API Proxy Service
 *
 * CRITICAL SECURITY LAYER - P0 Priority
 *
 * This service provides a secure proxy layer for all external API calls,
 * preventing API key exposure on the client side. All sensitive API keys
 * are managed server-side only.
 *
 * Security Features:
 * - Server-side API key management
 * - Request validation and sanitization
 * - Rate limiting integration
 * - Request/response logging for security audit
 * - Error handling without exposing sensitive data
 */

import { rateLimitService } from './rateLimitService';
import { sanitizationService } from './sanitizationService';
import { retryService } from './retryService';

// ==================== Types ====================

export interface ProxyRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retryConfig?: {
    maxAttempts?: number;
    backoffMultiplier?: number;
  };
}

export interface ProxyResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  timestamp: string;
}

export interface GeminiProxyRequest {
  model: string;
  contents: any;
  config?: any;
}

export interface OpenAIProxyRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

// ==================== Configuration ====================

/**
 * Backend API endpoint configuration
 *
 * IMPORTANT: These endpoints must be implemented on your backend server.
 * See documentation in docs/backend-api-endpoints.md for implementation guide.
 */
const BACKEND_API_BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001/api';

const API_ENDPOINTS = {
  GEMINI_PROXY: `${BACKEND_API_BASE}/gemini/proxy`,
  GEMINI_STREAMING: `${BACKEND_API_BASE}/gemini/stream`,
  OPENAI_PROXY: `${BACKEND_API_BASE}/openai/proxy`,
  OPENAI_STREAMING: `${BACKEND_API_BASE}/openai/stream`,
  ANTHROPIC_PROXY: `${BACKEND_API_BASE}/anthropic/proxy`,
  CRM_PROXY: `${BACKEND_API_BASE}/crm/proxy`,
  HEALTH_CHECK: `${BACKEND_API_BASE}/health`,
} as const;

// Rate limit categories for different API types
const RATE_LIMIT_KEYS = {
  GEMINI: 'api_gemini',
  OPENAI: 'api_openai',
  ANTHROPIC: 'api_anthropic',
  CRM: 'api_crm',
} as const;

// ==================== API Proxy Service ====================

class APIProxyService {
  private userId: string | null = null;
  private sessionToken: string | null = null;

  /**
   * Initialize the proxy service with user context
   */
  initialize(userId: string, sessionToken: string): void {
    this.userId = userId;
    this.sessionToken = sessionToken;
  }

  /**
   * Check if backend API is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(API_ENDPOINTS.HEALTH_CHECK, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      console.error('Backend API health check failed:', error);
      return false;
    }
  }

  /**
   * Make a proxied request with full security measures
   */
  private async proxyRequest<T>(
    endpoint: string,
    rateLimitKey: string,
    payload: any,
    options: ProxyRequestOptions = {}
  ): Promise<ProxyResponse<T>> {
    // 1. Check rate limits
    const rateLimitCheck = await rateLimitService.checkLimit(
      rateLimitKey,
      this.userId || 'anonymous'
    );

    if (!rateLimitCheck.allowed) {
      throw new Error(
        `Rate limit exceeded. Try again in ${Math.ceil(rateLimitCheck.retryAfter / 60)} minutes.`
      );
    }

    // 2. Sanitize input payload
    const sanitizedPayload = sanitizationService.sanitizeObject(payload);

    // 3. Prepare request
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add authentication if available
    if (this.sessionToken) {
      requestHeaders['Authorization'] = `Bearer ${this.sessionToken}`;
    }

    // Add user context
    if (this.userId) {
      requestHeaders['X-User-ID'] = this.userId;
    }

    // 4. Execute request with retry logic
    const executeRequest = async (): Promise<Response> => {
      const controller = new AbortController();
      const timeout = options.timeout || 30000; // 30 second default

      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(endpoint, {
          method: options.method || 'POST',
          headers: requestHeaders,
          body: JSON.stringify(sanitizedPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    };

    // Use retry service if retry config provided
    let response: Response;
    if (options.retryConfig) {
      response = await retryService.executeWithRetry(
        executeRequest,
        options.retryConfig.maxAttempts || 3,
        options.retryConfig.backoffMultiplier || 2
      );
    } else {
      response = await executeRequest();
    }

    // 5. Handle response
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Proxy request failed:', {
        status: response.status,
        endpoint,
        error: errorText,
      });

      // Don't expose internal error details to client
      throw new Error(
        `API request failed: ${response.status === 429 ? 'Rate limit exceeded' : 'Service unavailable'}`
      );
    }

    const data = await response.json();

    // 6. Record rate limit usage
    await rateLimitService.recordRequest(rateLimitKey, this.userId || 'anonymous');

    return {
      data,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== Gemini API Proxy Methods ====================

  /**
   * Proxy Gemini API generateContent request
   */
  async geminiGenerateContent(request: GeminiProxyRequest): Promise<any> {
    const response = await this.proxyRequest<any>(
      API_ENDPOINTS.GEMINI_PROXY,
      RATE_LIMIT_KEYS.GEMINI,
      {
        action: 'generateContent',
        ...request,
      },
      {
        retryConfig: { maxAttempts: 2, backoffMultiplier: 2 },
        timeout: 60000, // 60 seconds for AI generation
      }
    );

    return response.data;
  }

  /**
   * Proxy Gemini API streaming request
   */
  async geminiStreamContent(
    request: GeminiProxyRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    // Check rate limits first
    const rateLimitCheck = await rateLimitService.checkLimit(
      RATE_LIMIT_KEYS.GEMINI,
      this.userId || 'anonymous'
    );

    if (!rateLimitCheck.allowed) {
      throw new Error(
        `Rate limit exceeded. Try again in ${Math.ceil(rateLimitCheck.retryAfter / 60)} minutes.`
      );
    }

    const sanitizedRequest = sanitizationService.sanitizeObject(request);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }
    if (this.userId) {
      headers['X-User-ID'] = this.userId;
    }

    const response = await fetch(API_ENDPOINTS.GEMINI_STREAMING, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'streamContent',
        ...sanitizedRequest,
      }),
    });

    if (!response.ok) {
      throw new Error('Streaming request failed');
    }

    // Process streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response stream available');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        onChunk(chunk);
      }

      // Record usage after successful stream
      await rateLimitService.recordRequest(RATE_LIMIT_KEYS.GEMINI, this.userId || 'anonymous');
    } finally {
      reader.releaseLock();
    }
  }

  // ==================== OpenAI API Proxy Methods ====================

  /**
   * Proxy OpenAI API chat completion request
   */
  async openaiChatCompletion(request: OpenAIProxyRequest): Promise<any> {
    const response = await this.proxyRequest<any>(
      API_ENDPOINTS.OPENAI_PROXY,
      RATE_LIMIT_KEYS.OPENAI,
      {
        action: 'chatCompletion',
        ...request,
      },
      {
        retryConfig: { maxAttempts: 2, backoffMultiplier: 2 },
        timeout: 60000,
      }
    );

    return response.data;
  }

  /**
   * Proxy OpenAI streaming chat completion
   */
  async openaiStreamChatCompletion(
    request: OpenAIProxyRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const rateLimitCheck = await rateLimitService.checkLimit(
      RATE_LIMIT_KEYS.OPENAI,
      this.userId || 'anonymous'
    );

    if (!rateLimitCheck.allowed) {
      throw new Error(
        `Rate limit exceeded. Try again in ${Math.ceil(rateLimitCheck.retryAfter / 60)} minutes.`
      );
    }

    const sanitizedRequest = sanitizationService.sanitizeObject(request);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }
    if (this.userId) {
      headers['X-User-ID'] = this.userId;
    }

    const response = await fetch(API_ENDPOINTS.OPENAI_STREAMING, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'streamChatCompletion',
        ...sanitizedRequest,
      }),
    });

    if (!response.ok) {
      throw new Error('Streaming request failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response stream available');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        onChunk(chunk);
      }

      await rateLimitService.recordRequest(RATE_LIMIT_KEYS.OPENAI, this.userId || 'anonymous');
    } finally {
      reader.releaseLock();
    }
  }

  // ==================== Anthropic API Proxy Methods ====================

  /**
   * Proxy Anthropic API message request
   */
  async anthropicMessage(request: any): Promise<any> {
    const response = await this.proxyRequest<any>(
      API_ENDPOINTS.ANTHROPIC_PROXY,
      RATE_LIMIT_KEYS.ANTHROPIC,
      {
        action: 'message',
        ...request,
      },
      {
        retryConfig: { maxAttempts: 2, backoffMultiplier: 2 },
        timeout: 60000,
      }
    );

    return response.data;
  }

  // ==================== CRM API Proxy Methods ====================

  /**
   * Proxy CRM API requests (HubSpot, Salesforce, etc.)
   */
  async crmRequest(
    provider: 'hubspot' | 'salesforce' | 'pipedrive',
    action: string,
    data: any
  ): Promise<any> {
    const response = await this.proxyRequest<any>(
      API_ENDPOINTS.CRM_PROXY,
      RATE_LIMIT_KEYS.CRM,
      {
        provider,
        action,
        data,
      },
      {
        retryConfig: { maxAttempts: 3, backoffMultiplier: 2 },
        timeout: 30000,
      }
    );

    return response.data;
  }

  // ==================== Utility Methods ====================

  /**
   * Clear user context (e.g., on logout)
   */
  clearContext(): void {
    this.userId = null;
    this.sessionToken = null;
  }

  /**
   * Get current rate limit status for a specific API
   */
  async getRateLimitStatus(apiType: keyof typeof RATE_LIMIT_KEYS): Promise<any> {
    const key = RATE_LIMIT_KEYS[apiType];
    return rateLimitService.getStatus(key, this.userId || 'anonymous');
  }
}

// ==================== Export ====================

export const apiProxyService = new APIProxyService();

// Export endpoint configuration for documentation
export const API_PROXY_ENDPOINTS = API_ENDPOINTS;
export const API_PROXY_RATE_LIMITS = RATE_LIMIT_KEYS;
