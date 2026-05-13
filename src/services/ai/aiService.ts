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
  AIJsonParseError,
} from './errors';
import { maskParams, shouldMask } from './piiMasking';

export interface InvokeAIOptions {
  workspaceId: string;
  /** Abort signal to cancel the request. */
  signal?: AbortSignal;
  /** Override the task's default provider/model for this single call.
   *  Must be a model id from `aiModelCatalog` (validated server-side). */
  modelOverride?: string;
  /** Workspace-level PII masking enforcement (from `ai_pii_masking_enforced`).
   *  When true, prompts are scrubbed regardless of the user's personal toggle. */
  piiMaskingEnforced?: boolean;
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

  // PII masking — applied client-side BEFORE the prompt leaves the browser.
  // Effective masking = (workspace enforces) OR (user opted in).
  const maskingActive = await shouldMask({ enforced: opts.piiMaskingEnforced });
  const outboundParams = maskingActive ? maskParams(params) : params;

  // Use supabase.functions.invoke — it sets both apikey + Authorization headers
  // which the Supabase edge-function gateway requires.
  const { data, error } = await supabase.functions.invoke('ai-router', {
    body: {
      task,
      params: outboundParams,
      workspace_id: opts.workspaceId,
      ...(opts.modelOverride ? { model_override: opts.modelOverride } : {}),
    },
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
    opts, // forwards modelOverride if present
  );
  return result.text;
}

/** JSON-mode call that parses the response. Throws AIJsonParseError if all
 *  repair attempts fail. Repair tiers:
 *    1. raw                         — strict parse
 *    2. fence-stripped              — remove ```json … ``` wrappers
 *    3. balanced-substring extract  — slice from first { (or [) to its matching
 *                                     close brace, useful when the model adds
 *                                     prose before/after the object
 *  Truncated responses (model hit max_output_tokens mid-string) can't be
 *  recovered here — callers should catch AIJsonParseError and fall back. */
export async function invokeAIJson<T = unknown>(
  task: AITask,
  prompt: string,
  opts: InvokeAIOptions & { systemPrompt?: string; temperature?: number },
): Promise<T> {
  const text = await invokeAIPrompt(task, prompt, { ...opts, jsonMode: true });

  // Tier 1: strict parse
  try {
    return JSON.parse(text) as T;
  } catch { /* fall through */ }

  // Tier 2: strip markdown fences
  const fenceStripped = text
    .replace(/^\s*```(?:json)?\s*\n?/i, '')
    .replace(/\n?\s*```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(fenceStripped) as T;
  } catch { /* fall through */ }

  // Tier 3: extract first balanced { … } or [ … ]
  const extracted = extractBalancedJson(fenceStripped);
  if (extracted) {
    try {
      return JSON.parse(extracted) as T;
    } catch { /* fall through */ }
  }

  // All repairs failed — surface a typed error with the raw text so callers
  // can log it and decide whether to fall back to defaults.
  const finalErr = (() => {
    try { JSON.parse(fenceStripped); return new Error('unknown'); }
    catch (e) { return e as Error; }
  })();
  throw new AIJsonParseError(text, finalErr);
}

/** Walks `s` looking for the first {/[ and returns the substring up to and
 *  including its balanced matching brace. Respects string literals (so braces
 *  inside quoted strings don't count) and `\"` escapes. Returns null if no
 *  balanced container is found (e.g. truncated mid-string). */
function extractBalancedJson(s: string): string | null {
  const startIdx = s.search(/[{[]/);
  if (startIdx < 0) return null;
  const open = s[startIdx];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIdx; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(startIdx, i + 1);
    }
  }
  return null;
}

export type { AITask, AIInvokeParams, AIResult, AIMessage } from './types';
export {
  AIRouterError,
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
} from './errors';
