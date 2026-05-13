// Supabase Edge Function: Gemini Speech (TTS)
// Server-side wrapper around gemini-2.5-flash-preview-tts.
// Mirrors gemini-audio/video/image patterns: auth-gated, workspace-scoped,
// server-held GEMINI_API_KEY, structured errors, hard-cap metering.
//
// Replaces the single browser-side SDK call site in geminiService.ts:generateSpeech.
//
// Response contract preserves legacy shape: `{ audio: <raw_base64_pcm> }` — a
// 24kHz mono 16-bit PCM base64 string with NO data-URL prefix. Existing
// callers (Messages.tsx, LiveDashboard.tsx) feed this into audioService's
// `decodeAudioData` which expects raw base64.
//
// Request:  POST /functions/v1/gemini-speech
//   body:   {
//     text: string,
//     voice?: string,          // defaults to 'Kore'
//     workspace_id: string,
//   }
//
// Response (200): { audio: string }       // raw base64 PCM
// Response (401): { error: "unauthorized" }
// Response (402): { error: "cap_exceeded" | "trial_expired", ... }
// Response (403): { error: "workspace_access_denied" }
// Response (400): { error: "invalid_body" | "text_too_long" }
// Response (503): { error: "gemini_not_configured" }
// Response (502): { error: "upstream_error" | "no_audio_in_response" | "request_failed", detail, status? }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

import { verifyWorkspaceAccess, checkAICap, incrementAIUsage } from './metering.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const DEFAULT_VOICE = 'Kore';
const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_TEXT_LENGTH = 8_000;

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

interface SpeechRequest {
  text: string;
  voice?: string;
  workspace_id: string;
}

interface GeminiInlinePart { inlineData?: { data?: string; mimeType?: string } }

function extractAudio(geminiJson: Record<string, unknown>): string | null {
  const candidates = (geminiJson.candidates as Array<Record<string, unknown>> | undefined) ?? [];
  const parts =
    ((candidates[0]?.content as Record<string, unknown> | undefined)?.parts as
      | GeminiInlinePart[]
      | undefined) ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) return part.inlineData.data;
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
  let body: SpeechRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const { text, workspace_id } = body;
  if (!workspace_id) return json({ error: 'workspace_id required' }, 400);
  if (!text || typeof text !== 'string') {
    return json({ error: 'invalid_body', detail: 'text required' }, 400);
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return json({ error: 'text_too_long', limit: MAX_TEXT_LENGTH }, 400);
  }

  const voice = body.voice && typeof body.voice === 'string' ? body.voice : DEFAULT_VOICE;

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

  // ── Call Gemini ─────────────────────────────────────────────────
  const upstreamBody = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };

  try {
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(upstreamBody),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[gemini-speech] upstream ${res.status}:`, detail);
      return json({ error: 'upstream_error', detail, status: res.status }, 502);
    }

    const data = await res.json();
    const audio = extractAudio(data);
    if (!audio) {
      console.error('[gemini-speech] no audio in response:', JSON.stringify(data).slice(0, 500));
      return json({ error: 'no_audio_in_response' }, 502);
    }

    await incrementAIUsage(supabase, workspace_id, 1);
    return json({ audio });
  } catch (e) {
    console.error('[gemini-speech] request failed:', e);
    return json(
      { error: 'request_failed', detail: e instanceof Error ? e.message : 'unknown' },
      502,
    );
  }
});
