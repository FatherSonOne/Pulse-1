/**
 * API Proxy Service
 *
 * CRITICAL SECURITY LAYER - P0 Priority
 *
 * This service provides a secure proxy layer for all external API calls,
 * preventing API key exposure on the client side. All sensitive API keys
 * are managed server-side only.
 *
 * AI calls (Gemini / OpenAI / Anthropic) are routed through the central
 * `ai-router` edge function which handles provider selection, metering,
 * hard caps, prompt caching, and automatic fallback.
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
import { invokeAI } from './ai/aiService';
import { getCurrentWorkspaceId } from './ai/getWorkspaceId';
import type { AIMessage, AITask } from './ai/types';

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
 * NOTE: AI endpoints (Gemini / OpenAI / Anthropic) are now served by the
 * `ai-router` Supabase edge function and are no longer reached via the
 * backend URL below. Non-AI endpoints (CRM, health) continue to use it.
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

// ==================== Helpers ====================

/**
 * Flatten Gemini `contents` (string | Part[] | Content[]) into a prompt string.
 * The ai-router contract uses a plain `messages[{role, content}]` array, so
 * we extract text parts and concatenate them.
 */
function geminiContentsToPrompt(contents: unknown): string {
  if (typeof contents === 'string') return contents;
  if (!contents) return '';

  const parts: string[] = [];
  const arr = Array.isArray(contents) ? contents : [contents];

  for (const item of arr) {
    if (typeof item === 'string') {
      parts.push(item);
      continue;
    }
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      // Gemini Part shape: { text: string }
      if (typeof obj.text === 'string') {
        parts.push(obj.text);
        continue;
      }
      // Gemini Content shape: { role, parts: Part[] }
      if (Array.isArray(obj.parts)) {
        for (const p of obj.parts) {
          if (typeof p === 'string') parts.push(p);
          else if (p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string') {
            parts.push((p as { text: string }).text);
          }
        }
      }
    }
  }

  return parts.filter(Boolean).join('\n').trim();
}

/**
 * Convert OpenAI-style messages to the ai-router `AIMessage[]` shape.
 * System prompts are hoisted out and returned separately.
 */
function openAIMessagesToAIParams(
  messages: Array<{ role: string; content: string }>,
): { messages: AIMessage[]; systemPrompt?: string } {
  const systemParts: string[] = [];
  const chat: AIMessage[] = [];

  for (const m of messages) {
    if (!m || typeof m.content !== 'string') continue;
    if (m.role === 'system') {
      systemParts.push(m.content);
    } else if (m.role === 'assistant' || m.role === 'user') {
      chat.push({ role: m.role, content: m.content });
    } else {
      // Fallback — treat unknown roles as user turns.
      chat.push({ role: 'user', content: m.content });
    }
  }

  // Ensure at least one user message (router requires messages[])
  if (chat.length === 0 && systemParts.length > 0) {
    chat.push({ role: 'user', content: systemParts.join('\n\n') });
    return { messages: chat };
  }

  return {
    messages: chat,
    systemPrompt: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
  };
}

// ==================== API Proxy Service ====================

class APIProxyService {
  private userId: string | null = null;
  private sessionToken: string | null = null;
  private workspaceId: string | null = null;

  /**
   * Initialize the proxy service with user context.
   *
   * @param userId Current user id.
   * @param sessionToken Session token (used for non-AI backend endpoints).
   * @param workspaceId Optional workspace id. Falls back to
   *   `getCurrentWorkspaceId()` at call time when not provided here.
   */
  initialize(userId: string, sessionToken: string, workspaceId?: string): void {
    this.userId = userId;
    this.sessionToken = sessionToken;
    this.workspaceId = workspaceId ?? null;
  }

  /** Resolve the workspace id to use for AI calls. */
  private resolveWorkspaceId(): string {
    const wsId = this.workspaceId ?? getCurrentWorkspaceId();
    if (!wsId) {
      throw new Error('No active workspace — AI unavailable');
    }
    return wsId;
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
   * Make a proxied request with full security measures.
   * Used for non-AI endpoints (CRM).
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
   * Proxy Gemini `generateContent` through the central ai-router.
   *
   * Signature preserved for backward compatibility. The response shape
   * mirrors Gemini's native result (`{ text, candidates, usageMetadata }`)
   * so existing callers that read `result.text` continue to work.
   */
  async geminiGenerateContent(request: GeminiProxyRequest): Promise<any> {
    const workspaceId = this.resolveWorkspaceId();
    const prompt = geminiContentsToPrompt(request.contents);

    // Pick task based on the caller's config hint. Default = generic chat.
    // Callers passing `responseMimeType: 'application/json'` get jsonMode.
    const config = (request.config ?? {}) as Record<string, unknown>;
    const jsonMode = config.responseMimeType === 'application/json';
    const temperature = typeof config.temperature === 'number' ? config.temperature : undefined;
    const systemPrompt = typeof config.systemInstruction === 'string'
      ? config.systemInstruction
      : undefined;

    const task: AITask = 'pulse_assistant_chat';

    const result = await invokeAI(
      task,
      {
        messages: [{ role: 'user', content: prompt }],
        systemPrompt,
        temperature,
        jsonMode,
      },
      { workspaceId },
    );

    // Record rate limit usage for compat with existing observability
    await rateLimitService.recordRequest(RATE_LIMIT_KEYS.GEMINI, this.userId || 'anonymous');

    // Shape response to look like Gemini's native SDK result so callers
    // that read `result.text` keep working.
    return {
      text: result.text,
      candidates: [
        {
          content: { parts: [{ text: result.text }], role: 'model' },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        promptTokenCount: result.tokens?.input ?? 0,
        candidatesTokenCount: result.tokens?.output ?? 0,
        totalTokenCount: (result.tokens?.input ?? 0) + (result.tokens?.output ?? 0),
      },
      provider: result.provider,
      model: result.model,
    };
  }

  /**
   * Proxy Gemini streaming request.
   *
   * The ai-router does not yet stream — the full response is emitted as a
   * single chunk via `onChunk` so existing streaming call sites continue
   * to work without modification.
   */
  async geminiStreamContent(
    request: GeminiProxyRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const result = await this.geminiGenerateContent(request);
    const text = typeof result?.text === 'string' ? result.text : '';
    if (text) onChunk(text);
  }

  // ==================== OpenAI API Proxy Methods ====================

  /**
   * Proxy OpenAI chat completion through the central ai-router.
   *
   * Signature preserved. The response shape mirrors OpenAI's chat completion
   * result (`{ choices: [{ message: { content } }] }`) so existing callers
   * keep working.
   */
  async openaiChatCompletion(request: OpenAIProxyRequest): Promise<any> {
    const workspaceId = this.resolveWorkspaceId();
    const { messages, systemPrompt } = openAIMessagesToAIParams(request.messages);

    const result = await invokeAI(
      'pulse_assistant_chat',
      {
        messages,
        systemPrompt,
        temperature: request.temperature,
        maxOutputTokens: request.max_tokens,
      },
      { workspaceId },
    );

    await rateLimitService.recordRequest(RATE_LIMIT_KEYS.OPENAI, this.userId || 'anonymous');

    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: result.model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: result.text },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: result.tokens?.input ?? 0,
        completion_tokens: result.tokens?.output ?? 0,
        total_tokens: (result.tokens?.input ?? 0) + (result.tokens?.output ?? 0),
      },
      provider: result.provider,
    };
  }

  /**
   * Proxy OpenAI streaming chat completion.
   *
   * The ai-router does not yet stream — the full response is emitted as a
   * single chunk via `onChunk`.
   */
  async openaiStreamChatCompletion(
    request: OpenAIProxyRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const result = await this.openaiChatCompletion(request);
    const text = result?.choices?.[0]?.message?.content;
    if (typeof text === 'string' && text) onChunk(text);
  }

  // ==================== Anthropic API Proxy Methods ====================

  /**
   * Proxy Anthropic message request through the central ai-router.
   *
   * Signature preserved. Accepts the Anthropic `messages.create` request
   * shape (`{ model, messages, system?, max_tokens?, temperature? }`) and
   * returns a result matching Anthropic's native response shape.
   */
  async anthropicMessage(request: any): Promise<any> {
    const workspaceId = this.resolveWorkspaceId();

    const rawMessages: Array<{ role: string; content: any }> = Array.isArray(request?.messages)
      ? request.messages
      : [];

    const messages: AIMessage[] = rawMessages
      .map(m => {
        const content = typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content)
            ? m.content.map((c: any) => (typeof c?.text === 'string' ? c.text : '')).join('\n')
            : '';
        const role = m.role === 'assistant' ? 'assistant' : 'user';
        return { role: role as 'user' | 'assistant', content };
      })
      .filter(m => m.content);

    const systemPrompt = typeof request?.system === 'string' ? request.system : undefined;

    const result = await invokeAI(
      'pulse_assistant_chat',
      {
        messages,
        systemPrompt,
        temperature: typeof request?.temperature === 'number' ? request.temperature : undefined,
        maxOutputTokens: typeof request?.max_tokens === 'number' ? request.max_tokens : undefined,
      },
      { workspaceId },
    );

    await rateLimitService.recordRequest(RATE_LIMIT_KEYS.ANTHROPIC, this.userId || 'anonymous');

    // Shape response to match Anthropic's native SDK result.
    return {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: result.text }],
      model: result.model,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: result.tokens?.input ?? 0,
        output_tokens: result.tokens?.output ?? 0,
      },
      provider: result.provider,
    };
  }

  // ==================== CRM API Proxy Methods ====================

  /**
   * Proxy CRM API requests (HubSpot, Salesforce, etc.)
   *
   * Non-AI call — continues to route through the backend proxy endpoint.
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
    this.workspaceId = null;
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
