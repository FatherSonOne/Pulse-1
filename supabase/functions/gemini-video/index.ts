// Supabase Edge Function: Gemini Video
// Server-side wrapper around Gemini multimodal video analysis.
// Mirrors gemini-audio/embed/ai-router patterns: auth-gated, workspace-scoped,
// server-held GEMINI_API_KEY, structured errors, hard-cap metering.
//
// Replaces two browser-side @google/genai SDK call sites:
//   - geminiService.ts:analyzeVideo       (gemini-3-pro-preview, free-text)
//   - glimpseService.ts:processWithAI     (gemini-2.5-flash, structured JSON)
//
// Veo (`generateVideo` long-polling) is NOT migrated here per Phase C plan
// decision 5B — its only caller is the internal Tools.tsx dev tool. The
// long-poll surface would double the API and adds little value.
//
// Request:  POST /functions/v1/gemini-video
//   body:   {
//     action: 'analyze',
//     video_base64: string,
//     mime_type?: string,         // defaults to 'video/webm'
//     prompt: string,
//     schema?: object,            // if present, returns { data: parsed }; else { text }
//     model?: 'gemini-2.5-flash' | 'gemini-3-pro-preview',
//     workspace_id: string,
//   }
//
// Response (200):
//   no schema:    { text: string }
//   with schema:  { data: <parsed JSON> }
// Response (401): { error: "unauthorized" }
// Response (402): { error: "cap_exceeded" | "trial_expired", ... }
// Response (403): { error: "workspace_access_denied" }
// Response (400): { error: "invalid_body" | "invalid_action" | "invalid_model" | "video_too_large" }
// Response (503): { error: "gemini_not_configured" }
// Response (502): { error: "upstream_error" | "request_failed", detail, status? }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

import { verifyWorkspaceAccess, checkAICap, incrementAIUsage } from './metering.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

const ALLOWED_MODELS = ['gemini-2.5-flash', 'gemini-3-pro-preview'] as const;
type AllowedModel = typeof ALLOWED_MODELS[number];
const DEFAULT_MODEL: AllowedModel = 'gemini-2.5-flash';

const UPSTREAM_TIMEOUT_MS = 90_000;
// Edge Function body limit ~6MB; base64 inflates ~4/3, so cap raw video ~4MB.
// Caller should keep clips short / lower bitrate.
const MAX_VIDEO_BASE64_BYTES = 5_500_000;

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

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`upstream timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

interface VideoRequest {
  action: 'analyze';
  video_base64: string;
  mime_type?: string;
  prompt: string;
  schema?: Record<string, unknown>;
  model?: string;
  workspace_id: string;
}

function extractText(geminiJson: Record<string, unknown>): string {
  const candidates = (geminiJson.candidates as Array<Record<string, unknown>> | undefined) ?? [];
  const parts =
    ((candidates[0]?.content as Record<string, unknown> | undefined)?.parts as
      | Array<{ text?: string }>
      | undefined) ?? [];
  return parts.map((p) => p.text ?? '').join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!GEMINI_API_KEY) return json({ error: 'gemini_not_configured' }, 503);

  // ── Auth ────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authErr || !user) return json({ error: 'unauthorized' }, 401);

  // ── Parse ───────────────────────────────────────────────────────
  let body: VideoRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const { action, video_base64, prompt, workspace_id, schema } = body;
  if (action !== 'analyze') return json({ error: 'invalid_action' }, 400);
  if (!workspace_id) return json({ error: 'workspace_id required' }, 400);
  if (!prompt || typeof prompt !== 'string') {
    return json({ error: 'invalid_body', detail: 'prompt required' }, 400);
  }
  if (!video_base64 || typeof video_base64 !== 'string') {
    return json({ error: 'invalid_body', detail: 'video_base64 required' }, 400);
  }
  if (video_base64.length > MAX_VIDEO_BASE64_BYTES) {
    return json({ error: 'video_too_large', limit: MAX_VIDEO_BASE64_BYTES }, 400);
  }

  const model: AllowedModel = (() => {
    if (!body.model) return DEFAULT_MODEL;
    if ((ALLOWED_MODELS as readonly string[]).includes(body.model)) {
      return body.model as AllowedModel;
    }
    return DEFAULT_MODEL;
  })();
  if (body.model && !(ALLOWED_MODELS as readonly string[]).includes(body.model)) {
    return json({ error: 'invalid_model', allowed: ALLOWED_MODELS }, 400);
  }

  const mimeType = (body.mime_type ?? 'video/webm').split(';')[0].trim();

  // ── Workspace + cap ─────────────────────────────────────────────
  const hasAccess = await verifyWorkspaceAccess(supabase, user.id, workspace_id);
  if (!hasAccess) return json({ error: 'workspace_access_denied' }, 403);

  const cap = await checkAICap(supabase, workspace_id);
  if (!cap.allowed) {
    return json(
      { error: cap.reason, usage: cap.usage, limit: cap.limit, reset_at: cap.resetAt },
      402,
    );
  }

  // ── Build Gemini request ────────────────────────────────────────
  const upstreamBody: Record<string, unknown> = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: video_base64 } },
          { text: prompt },
        ],
      },
    ],
  };
  if (schema) {
    upstreamBody.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: schema,
    };
  }

  // ── Call Gemini ─────────────────────────────────────────────────
  try {
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(upstreamBody),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[gemini-video:${model}] upstream ${res.status}:`, detail);
      return json({ error: 'upstream_error', detail, status: res.status }, 502);
    }

    const data = await res.json();
    const text = extractText(data);

    await incrementAIUsage(supabase, workspace_id, 1);

    if (schema) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text || '{}');
      } catch (e) {
        console.error('[gemini-video] JSON parse failed:', e, text);
        return json({ error: 'upstream_error', detail: 'invalid_json_from_model' }, 502);
      }
      return json({ data: parsed });
    }

    return json({ text });
  } catch (e) {
    console.error('[gemini-video] request failed:', e);
    return json(
      { error: 'request_failed', detail: e instanceof Error ? e.message : 'unknown' },
      502,
    );
  }
});
