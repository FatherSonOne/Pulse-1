// Unified AI Service — thin compatibility shim over the central `ai-router`.
//
// Historically this module fanned out to OpenAI / Claude / Gemini with manual
// retry + provider fallback. That responsibility has moved server-side: the
// `ai-router` edge function now handles provider routing, automatic fallback,
// metering, and hard caps. All multi-provider logic has been collapsed.
//
// The public surface (types + exported functions) is preserved so existing
// call sites continue to compile. Provider-specific API keys on `AIConfig`
// are ignored — the router holds its own keys server-side.

import { invokeAIPrompt } from './ai/aiService';
import { getCurrentWorkspaceId } from './ai/getWorkspaceId';

export type AIProvider = 'openai' | 'claude' | 'gemini';

export interface AIConfig {
  /** @deprecated — router holds keys server-side. Ignored. */
  openaiKey?: string;
  /** @deprecated — router holds keys server-side. Ignored. */
  claudeKey?: string;
  /** @deprecated — router holds keys server-side. Ignored. */
  geminiKey?: string;
  /** @deprecated — router decides provider per task. Ignored. */
  preferredProvider?: AIProvider;
}

export interface AIResponse {
  text: string;
  provider: AIProvider;
  model: string;
}

/**
 * Generate a text response with automatic provider fallback.
 *
 * Provider selection + fallback is now handled by the `ai-router` edge
 * function. The `config` argument is retained for backward compatibility
 * but all fields are ignored. Retry/backoff is handled by the router too,
 * so the `options.maxRetries` parameter is ignored.
 *
 * @throws {AICapExceededError} When the workspace has hit its AI message cap.
 * @throws {AITrialExpiredError} When the trial has expired.
 * @throws {AIProviderUnavailableError} When all AI providers are down.
 * @throws {AIRouterError} For other router failures.
 */
export const generateWithFallback = async (
  config: AIConfig,
  prompt: string,
  options?: { maxRetries?: number; workspaceId?: string },
): Promise<AIResponse> => {
  void config;   // deprecated — router handles keys + provider choice
  void options?.maxRetries; // deprecated — router handles retries

  const wsId = options?.workspaceId ?? getCurrentWorkspaceId();
  if (!wsId) {
    throw new Error('No active workspace — AI unavailable');
  }

  // Generic text generation → general chat task. The router will pick an
  // appropriate model (typically Gemini Flash for speed) and fall back to
  // Claude on outage automatically.
  const text = await invokeAIPrompt('pulse_assistant_chat', prompt, {
    workspaceId: wsId,
    temperature: 0.7,
  });

  // Provider + model fields are retained for API compatibility. The actual
  // provider used server-side is reported in invokeAI's full result, but
  // callers of this function only consume `text`, so we surface stable
  // placeholder values rather than plumbing the full router result through.
  return {
    text: text || 'No response generated.',
    provider: 'gemini',
    model: 'ai-router',
  };
};

/**
 * Convenience one-shot call with automatic provider fallback.
 *
 * @param prompt The user prompt.
 * @param config Deprecated. Kept for API compatibility — all fields ignored.
 * @param workspaceId Optional workspace override. Falls back to
 *   `getCurrentWorkspaceId()`.
 */
export const askAI = async (
  prompt: string,
  config: AIConfig,
  workspaceId?: string,
): Promise<string> => {
  const response = await generateWithFallback(config, prompt, { workspaceId });
  return response.text;
};

// Re-export router error types so callers can catch them without a
// separate import.
export {
  AIRouterError,
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
} from './ai/errors';
