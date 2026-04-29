// Supabase Edge Function: AI Router
// Single entry point for all LLM calls in Pulse.
// Routes each task to its configured provider (Gemini Flash / Claude Haiku / Claude Sonnet)
// with automatic fallback, prompt caching for Claude, and hard-cap metering.
//
// Request:  POST /functions/v1/ai-router
//   body: { task: AITask, params: AIInvokeInput, workspace_id: string }
//
// Response (200): { text, provider, model, tokens, cached_hit, task }
// Response (402): { error: "cap_exceeded" | "trial_expired", usage, limit, reset_at }
// Response (401): { error: "unauthorized" }
// Response (403): { error: "workspace_access_denied" }
// Response (400): { error: "invalid_task" | "invalid_body" }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

import { TASK_MODELS, isValidTask, resolveOverride, type AITask } from './tasks.ts';
import { invokeGemini, invokeClaude, type AIInvokeInput, type AIResponse } from './providers.ts';
import { verifyWorkspaceAccess, checkAICap, incrementAIUsage } from './metering.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

interface RouterRequest {
  task: AITask;
  params: Omit<AIInvokeInput, 'model'>;
  workspace_id: string;
  /** Optional caller-supplied model id (e.g. 'claude-sonnet') — must be in
   *  MODEL_ALLOWLIST. When provided, replaces the task's primary provider+model.
   *  Fallback chain still uses the task default to keep outage handling sane. */
  model_override?: string;
}

async function invokeProvider(
  provider: 'gemini' | 'claude',
  input: AIInvokeInput,
): Promise<AIResponse> {
  return provider === 'claude' ? invokeClaude(input) : invokeGemini(input);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // ── Auth ────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authErr || !user) return json({ error: 'unauthorized' }, 401);

  // ── Parse ───────────────────────────────────────────────────────
  let body: RouterRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const { task, params, workspace_id, model_override } = body;
  if (!task || !isValidTask(task)) return json({ error: 'invalid_task' }, 400);
  if (!workspace_id) return json({ error: 'workspace_id required' }, 400);
  if (!params?.messages?.length) return json({ error: 'messages required' }, 400);

  // Resolve override (if any) before workspace check so we fail fast on bad input.
  let override: ReturnType<typeof resolveOverride> = null;
  if (model_override) {
    override = resolveOverride(model_override);
    if (!override) return json({ error: 'invalid_model_override', detail: model_override }, 400);
    // Capability gate — `web_search` task requires a webSearch-capable model.
    if (task === 'web_search' && !override.supports.webSearch) {
      return json({ error: 'model_capability_mismatch', detail: 'web_search requires Gemini' }, 400);
    }
  }

  // ── Workspace membership check ──────────────────────────────────
  const hasAccess = await verifyWorkspaceAccess(supabase, user.id, workspace_id);
  if (!hasAccess) return json({ error: 'workspace_access_denied' }, 403);

  // ── Hard cap check ──────────────────────────────────────────────
  const cap = await checkAICap(supabase, workspace_id);
  if (!cap.allowed) {
    return json({
      error: cap.reason,
      usage: cap.usage,
      limit: cap.limit,
      reset_at: cap.resetAt,
    }, 402);
  }

  // ── Route to provider ───────────────────────────────────────────
  const config = TASK_MODELS[task];
  // Resolve effective primary: override wins, otherwise task default.
  const primaryProvider = override ? override.provider : config.provider;
  const primaryModel = override ? override.model : config.model;
  const primarySupportsCache = override ? override.supports.promptCaching : true;
  const invokeInput: AIInvokeInput = {
    ...params,
    model: primaryModel,
    // Disable cache when the chosen model can't cache (Gemini today). Otherwise
    // honour caller param then task default.
    cacheSystemPrompt: primarySupportsCache
      ? (params.cacheSystemPrompt ?? config.cacheSystemPrompt)
      : false,
    maxOutputTokens: params.maxOutputTokens ?? config.maxOutputTokens,
    // web_search task auto-enables Google Search grounding. Other tasks can
    // opt-in by passing params.webSearch=true explicitly.
    webSearch: params.webSearch ?? (task === 'web_search'),
  };

  let response: AIResponse;
  let usedFallback = false;

  try {
    response = await invokeProvider(primaryProvider, invokeInput);
  } catch (primaryErr) {
    console.warn(`[ai-router] primary ${primaryProvider}/${primaryModel} failed for ${task}:`, primaryErr);

    if (!config.fallback) {
      return json({
        error: 'provider_unavailable',
        detail: primaryErr instanceof Error ? primaryErr.message : 'unknown',
      }, 502);
    }

    try {
      response = await invokeProvider(config.fallback.provider, {
        ...invokeInput,
        model: config.fallback.model,
        // Fallback models may not support caching; safer to disable on fallback
        cacheSystemPrompt: false,
      });
      usedFallback = true;
    } catch (fallbackErr) {
      console.error(`[ai-router] fallback also failed for ${task}:`, fallbackErr);
      return json({
        error: 'provider_unavailable',
        detail: fallbackErr instanceof Error ? fallbackErr.message : 'unknown',
      }, 502);
    }
  }

  // ── Meter (fire-and-forget — don't block response) ──────────────
  incrementAIUsage(supabase, workspace_id).catch(err =>
    console.error('[ai-router] meter write failed:', err),
  );

  // ── Respond ─────────────────────────────────────────────────────
  return json({
    text: response.text,
    provider: response.provider,
    model: response.model,
    tokens: response.tokens,
    task,
    used_fallback: usedFallback,
    usage: { current: cap.usage + 1, limit: cap.limit },
    ...(response.groundingChunks ? { grounding_chunks: response.groundingChunks } : {}),
    ...(response.searchQueries ? { search_queries: response.searchQueries } : {}),
  });
});
