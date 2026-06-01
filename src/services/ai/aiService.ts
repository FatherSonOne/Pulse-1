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
import { captureError, addBreadcrumb } from '../../lib/monitoring/sentry';

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

  // AI-router SLI (see docs/PULSE_OBSERVABILITY_RUNBOOK.md §2.3): every client→
  // ai-router call funnels through this one helper (invokeAIPrompt/invokeAIJson +
  // all 29 geminiService exports delegate here), so this is the single
  // instrumentation point for AI-router latency + error rate.
  const startedAt = performance.now();

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
    // AI-router SLI: error-rate signal. Capture before the typed-error mapping
    // below so transport/edge failures are visible in Sentry (surface=ai-router).
    const durationMs = Math.round(performance.now() - startedAt);
    addBreadcrumb('ai-router call', 'ai', { outcome: 'failure', task, durationMs });
    captureError(error instanceof Error ? error : new Error(String((error as any)?.message ?? error)), {
      surface: 'ai-router',
      task,
      durationMs,
    });
    // FunctionsHttpError exposes .context.response for non-2xx responses,
    // but supabase-js will sometimes hand back a typed error with NO
    // populated response (network blip, abort, certain edge runtime
    // failures). In that case `status` defaults to 0 and the cap-exceeded
    // signal would slip past — components see a generic "AI request failed
    // (0): unknown" instead of the typed AICapExceededError that the toast
    // and circuit-breaker both branch on. We sniff the body and the error
    // message for the cap_exceeded / trial_expired tokens so the typed
    // error fires even when the HTTP status didn't come through.
    const ctx = (error as { context?: { response?: Response } }).context;
    const response = ctx?.response;
    const status = response?.status ?? 0;

    let body: Record<string, unknown> | null = null;
    if (response) {
      try {
        body = await response.clone().json();
      } catch { /* not JSON */ }
    }

    const bodyError = typeof body?.error === 'string' ? body.error : '';
    const errMsg = (error as Error)?.message ?? '';
    const looksCapExceeded =
      bodyError === 'cap_exceeded' ||
      /\bcap[_-]?exceeded\b/i.test(errMsg);
    const looksTrialExpired =
      bodyError === 'trial_expired' ||
      /\btrial[_-]?expired\b/i.test(errMsg);

    if (status === 402 || looksCapExceeded || looksTrialExpired) {
      if (looksTrialExpired) throw new AITrialExpiredError();
      throw new AICapExceededError(
        (body?.usage as number) ?? 0,
        (body?.limit as number) ?? 0,
        (body?.reset_at as string) ?? '',
      );
    }
    if (status === 502) {
      throw new AIProviderUnavailableError((body?.detail as string) || 'unknown');
    }
    const code = bodyError || 'unknown';
    throw new AIRouterError(
      `AI request failed (${status}): ${code}${body?.detail ? ` — ${body.detail}` : ''}`,
      code,
    );
  }

  // AI-router SLI: success + latency (full client→edge→model round-trip).
  addBreadcrumb('ai-router call', 'ai', {
    outcome: 'success',
    task,
    durationMs: Math.round(performance.now() - startedAt),
  });

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
  opts: InvokeAIOptions & {
    systemPrompt?: string;
    jsonMode?: boolean;
    temperature?: number;
    /** Cap the model's output. Inline UI (Smart Compose, quick suggestions)
     *  should set this aggressively low; without it the task default applies
     *  (1024-4096 tokens) and a single keystroke can stream back a paragraph. */
    maxOutputTokens?: number;
  },
): Promise<string> {
  const result = await invokeAI(
    task,
    {
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: opts.systemPrompt,
      jsonMode: opts.jsonMode,
      temperature: opts.temperature,
      maxOutputTokens: opts.maxOutputTokens,
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

  // Tier 4: strip trailing commas (`,}` / `,]`) — a frequent LLM JSON fault
  // that the strict parser rejects. The stripper is string-literal-aware, so
  // it only removes commas JSON actually forbids; it can never turn valid
  // data into different valid data. Try it on the tightest candidate we have.
  const candidate = extracted ?? fenceStripped;
  const decommatized = stripTrailingCommas(candidate);
  if (decommatized !== candidate) {
    try {
      return JSON.parse(decommatized) as T;
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

/** Removes commas that immediately precede a `}` or `]` (optionally across
 *  whitespace) — i.e. trailing commas, which JSON forbids but LLMs frequently
 *  emit. String-literal-aware: a comma inside a quoted string is never touched,
 *  so the transform only ever removes characters that would otherwise make the
 *  text unparseable. Returns the input unchanged when there's nothing to fix. */
function stripTrailingCommas(s: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      out += ch;
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === ',') {
      // Look ahead past whitespace; drop the comma if the next non-ws char closes.
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      if (j < s.length && (s[j] === '}' || s[j] === ']')) continue; // skip the comma
    }
    out += ch;
  }
  return out;
}

export type { AITask, AIInvokeParams, AIResult, AIMessage } from './types';
export {
  AIRouterError,
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
} from './errors';
