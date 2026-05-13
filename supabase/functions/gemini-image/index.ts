// Supabase Edge Function: Gemini Image
// Server-side wrapper around Gemini image generation/editing.
// Mirrors gemini-audio/video/embed/ai-router patterns: auth-gated,
// workspace-scoped, server-held GEMINI_API_KEY, structured errors, hard-cap.
//
// Replaces three browser-side @google/genai SDK call sites in geminiService.ts:
//   - generateImage      → gemini-2.5-flash-image
//   - editImage          → gemini-2.5-flash-image (image+text input)
//   - generateProImage   → gemini-3-pro-image-preview (with imageConfig)
//
// Request:  POST /functions/v1/gemini-image
//   body:   {
//     action: 'generate' | 'edit' | 'pro_generate',
//     prompt: string,
//     image_base64?: string,        // edit only — the source image
//     mime_type?: string,           // edit only — defaults to 'image/png'
//     aspect_ratio?: string,        // pro_generate only — e.g. '1:1', '16:9'
//     image_size?: string,          // pro_generate only — e.g. '1K', '2K'
//     workspace_id: string,
//   }
//
// Response (200): { image: "data:image/png;base64,..." }
// Response (401): { error: "unauthorized" }
// Response (402): { error: "cap_exceeded" | "trial_expired", ... }
// Response (403): { error: "workspace_access_denied" }
// Response (400): { error: "invalid_body" | "invalid_action" | "image_too_large" }
// Response (503): { error: "gemini_not_configured" }
// Response (502): { error: "upstream_error" | "no_image_in_response" | "request_failed", detail, status? }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

import { verifyWorkspaceAccess, checkAICap, incrementAIUsage } from './metering.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

const FLASH_IMAGE_MODEL = 'gemini-2.5-flash-image';
const PRO_IMAGE_MODEL = 'gemini-3-pro-image-preview';

const UPSTREAM_TIMEOUT_MS = 60_000;
const MAX_IMAGE_BASE64_BYTES = 5_500_000;

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

type Action = 'generate' | 'edit' | 'pro_generate';

interface ImageRequest {
  action: Action;
  prompt: string;
  image_base64?: string;
  mime_type?: string;
  aspect_ratio?: string;
  image_size?: string;
  workspace_id: string;
}

interface GeminiInlinePart { inlineData?: { data?: string; mimeType?: string } }

function extractImage(geminiJson: Record<string, unknown>): string | null {
  const candidates = (geminiJson.candidates as Array<Record<string, unknown>> | undefined) ?? [];
  const parts =
    ((candidates[0]?.content as Record<string, unknown> | undefined)?.parts as
      | GeminiInlinePart[]
      | undefined) ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
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
  let body: ImageRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const { action, prompt, workspace_id } = body;
  if (action !== 'generate' && action !== 'edit' && action !== 'pro_generate') {
    return json({ error: 'invalid_action' }, 400);
  }
  if (!workspace_id) return json({ error: 'workspace_id required' }, 400);
  if (!prompt || typeof prompt !== 'string') {
    return json({ error: 'invalid_body', detail: 'prompt required' }, 400);
  }
  if (action === 'edit') {
    if (!body.image_base64 || typeof body.image_base64 !== 'string') {
      return json({ error: 'invalid_body', detail: 'image_base64 required for edit' }, 400);
    }
    if (body.image_base64.length > MAX_IMAGE_BASE64_BYTES) {
      return json({ error: 'image_too_large', limit: MAX_IMAGE_BASE64_BYTES }, 400);
    }
  }

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
  let model: string;
  const parts: Array<Record<string, unknown>> = [];
  let extraConfig: Record<string, unknown> | undefined;

  if (action === 'generate') {
    model = FLASH_IMAGE_MODEL;
    parts.push({ text: prompt });
  } else if (action === 'edit') {
    model = FLASH_IMAGE_MODEL;
    const cleanMime = (body.mime_type ?? 'image/png').split(';')[0].trim();
    parts.push({ inlineData: { data: body.image_base64, mimeType: cleanMime } });
    parts.push({ text: prompt });
  } else {
    // pro_generate
    model = PRO_IMAGE_MODEL;
    parts.push({ text: prompt });
    extraConfig = {
      imageConfig: {
        aspectRatio: body.aspect_ratio ?? '1:1',
        imageSize: body.image_size ?? '1K',
      },
    };
  }

  const upstreamBody: Record<string, unknown> = {
    contents: [{ parts }],
  };
  if (extraConfig) upstreamBody.generationConfig = extraConfig;

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
      console.error(`[gemini-image:${action}] upstream ${res.status}:`, detail);
      return json({ error: 'upstream_error', detail, status: res.status }, 502);
    }

    const data = await res.json();
    const image = extractImage(data);
    if (!image) {
      console.error(`[gemini-image:${action}] no image in response:`, JSON.stringify(data).slice(0, 500));
      return json({ error: 'no_image_in_response' }, 502);
    }

    await incrementAIUsage(supabase, workspace_id, 1);
    return json({ image });
  } catch (e) {
    console.error(`[gemini-image:${action}] request failed:`, e);
    return json(
      { error: 'request_failed', detail: e instanceof Error ? e.message : 'unknown' },
      502,
    );
  }
});
