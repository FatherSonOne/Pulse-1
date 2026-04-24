// Centralized AI service — the ONLY way to call an LLM from client code.
//
// All direct calls to @google/genai, GoogleGenerativeAI, anthropic, etc. should
// be removed and replaced with `invokeAI(task, params, { workspaceId })`.
//
// The router lives at supabase/functions/ai-router/ and enforces:
//   - workspace membership (can't invoke on another workspace)
//   - hard-cap metering (blocks at ai_messages limit)
//   - task-to-model routing (Gemini Flash / Claude Haiku / Claude Sonnet)
//   - automatic fallback on provider outage
//   - prompt caching (Claude ephemeral, ~90% cost reduction)

import { supabase } from '../supabase';
import type { AITask, AIInvokeParams, AIResult } from './types';
import {
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
  AIRouterError,
} from './errors';

export interface InvokeAIOptions {
  workspaceId: string;
  /** Abort signal to cancel the request. */
  signal?: AbortSignal;
}

export async function invokeAI(
  task: AITask,
  params: AIInvokeParams,
  opts: InvokeAIOptions,
): Promise<AIResult> {
  if (!opts.workspaceId) {
    throw new AIRouterError('workspaceId is required', 'missing_workspace');
  }
  if (!params.messages?.length) {
    throw new AIRouterError('messages array is required', 'invalid_params');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new AIRouterError('Not authenticated', 'unauthorized');
  }

  // Use supabase.functions.invoke — it sets both apikey + Authorization headers
  // which the Supabase edge-function gateway requires.
  const { data, error } = await supabase.functions.invoke('ai-router', {
    body: { task, params, workspace_id: opts.workspaceId },
  });

  if (error) {
    // FunctionsHttpError exposes .context.response for non-2xx responses
    const ctx = (error as { context?: { response?: Response } }).context;
    const response = ctx?.response;
    const status = response?.status ?? 0;

    let body: Record<string, unknown> | null = null;
    if (response) {
      try {
        body = await response.clone().json();
      } catch { /* not JSON */ }
    }

    if (status === 402) {
      if (body?.error === 'trial_expired') throw new AITrialExpiredError();
      throw new AICapExceededError(
        (body?.usage as number) ?? 0,
        (body?.limit as number) ?? 0,
        (body?.reset_at as string) ?? '',
      );
    }
    if (status === 502) {
      throw new AIProviderUnavailableError((body?.detail as string) || 'unknown');
    }
    const code = (body?.error as string) || 'unknown';
    throw new AIRouterError(
      `AI request failed (${status}): ${code}${body?.detail ? ` — ${body.detail}` : ''}`,
      code,
    );
  }

  return {
    text: data.text,
    provider: data.provider,
    model: data.model,
    tokens: data.tokens,
    task: data.task,
    usedFallback: data.used_fallback,
    usage: data.usage,
    ...(data.grounding_chunks ? { groundingChunks: data.grounding_chunks } : {}),
    ...(data.search_queries ? { searchQueries: data.search_queries } : {}),
  };
}

// ─── Convenience helpers for common patterns ────────────────────────────

/** Simple single-turn call — wraps a prompt in a user message. */
export async function invokeAIPrompt(
  task: AITask,
  prompt: string,
  opts: InvokeAIOptions & { systemPrompt?: string; jsonMode?: boolean; temperature?: number },
): Promise<string> {
  const result = await invokeAI(
    task,
    {
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: opts.systemPrompt,
      jsonMode: opts.jsonMode,
      temperature: opts.temperature,
    },
    opts,
  );
  return result.text;
}

/** JSON-mode call that parses the response. Throws if parsing fails. */
export async function invokeAIJson<T = unknown>(
  task: AITask,
  prompt: string,
  opts: InvokeAIOptions & { systemPrompt?: string; temperature?: number },
): Promise<T> {
  const text = await invokeAIPrompt(task, prompt, { ...opts, jsonMode: true });
  try {
    return JSON.parse(text) as T;
  } catch {
    // Fallback — strip markdown fences if model wrapped the JSON
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    return JSON.parse(cleaned) as T;
  }
}

export type { AITask, AIInvokeParams, AIResult, AIMessage } from './types';
export {
  AIRouterError,
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
} from './errors';
