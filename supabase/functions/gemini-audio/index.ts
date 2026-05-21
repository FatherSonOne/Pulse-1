// Supabase Edge Function: Gemini Audio
// Server-side wrapper around Gemini multimodal audio operations.
// Mirrors gemini-embed/ai-router patterns: auth-gated, workspace-scoped,
// server-held GEMINI_API_KEY, structured errors, hard-cap metering.
//
// Replaces three browser-side @google/genai SDK call sites in geminiService.ts
// and relayTranscriptionService.ts so the Gemini key never reaches the client.
//
// Request:  POST /functions/v1/gemini-audio
//   body:   {
//     action: 'transcribe' | 'meeting_note' | 'analyze_memo',
//     audio_base64: string,
//     mime_type?: string,         // defaults to 'audio/webm'
//     workspace_id: string,
//     punctuation?: boolean,      // transcribe only
//     diarization?: boolean,      // transcribe only
//   }
//
// Response (200):
//   transcribe / meeting_note: { text: string }
//   analyze_memo:              { data: { transcription, summary, actionItems, decisions } }
// Response (401): { error: "unauthorized" }
// Response (402): { error: "cap_exceeded" | "trial_expired", usage, limit, reset_at }
// Response (403): { error: "workspace_access_denied" }
// Response (400): { error: "invalid_body" | "invalid_action" | "audio_too_large" }
// Response (503): { error: "gemini_not_configured" }
// Response (502): { error: "upstream_error" | "request_failed", detail, status? }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

import { verifyWorkspaceAccess, checkAICap, incrementAIUsage } from './metering.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

const AUDIO_MODEL = 'gemini-2.5-flash';
const UPSTREAM_TIMEOUT_MS = 60_000;
// Edge Function body limit is ~6MB; base64 inflates by ~4/3 so cap raw audio ~4MB.
const MAX_AUDIO_BASE64_BYTES = 5_500_000;

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

type Action = 'transcribe' | 'meeting_note' | 'analyze_memo';

interface AudioRequest {
  action: Action;
  audio_base64: string;
  mime_type?: string;
  workspace_id: string;
  punctuation?: boolean;
  diarization?: boolean;
}

function buildTranscribePrompt(punctuation: boolean, diarization: boolean): string {
  let prompt = 'Transcribe the speech in this audio exactly as spoken.';
  if (punctuation) prompt += ' Include proper punctuation.';
  if (diarization) prompt += ' If multiple speakers, identify them as Speaker 1, Speaker 2, etc.';
  prompt += ' Return ONLY the transcription, no commentary or explanations.';
  return prompt;
}

const MEETING_NOTE_PROMPT =
  'You are an AI meeting scribe. Listen to this short audio segment of a meeting. ' +
  'Extract any key facts, action items, decisions, or important updates into a single concise sentence. ' +
  'If the audio is silence or irrelevant, return empty string.';

const ANALYZE_MEMO_PROMPT =
  'Listen to this audio. Return JSON with: full transcription, concise summary (1-2 sentences), ' +
  'list of action items (tasks), and list of decisions made.';

const ANALYZE_MEMO_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcription: { type: 'STRING' },
    summary: { type: 'STRING' },
    actionItems: { type: 'ARRAY', items: { type: 'STRING' } },
    decisions: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['transcription', 'summary', 'actionItems', 'decisions'],
};

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
  let body: AudioRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const { action, audio_base64, workspace_id } = body;
  if (action !== 'transcribe' && action !== 'meeting_note' && action !== 'analyze_memo') {
    return json({ error: 'invalid_action' }, 400);
  }
  if (!workspace_id) return json({ error: 'workspace_id required' }, 400);
  if (!audio_base64 || typeof audio_base64 !== 'string') {
    return json({ error: 'invalid_body', detail: 'audio_base64 required' }, 400);
  }
  if (audio_base64.length > MAX_AUDIO_BASE64_BYTES) {
    return json({ error: 'audio_too_large', limit: MAX_AUDIO_BASE64_BYTES }, 400);
  }

  const mimeType = (body.mime_type ?? 'audio/webm').split(';')[0].trim();

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
  let prompt: string;
  let extraConfig: Record<string, unknown> | undefined;

  if (action === 'transcribe') {
    prompt = buildTranscribePrompt(body.punctuation ?? true, body.diarization ?? false);
  } else if (action === 'meeting_note') {
    prompt = MEETING_NOTE_PROMPT;
  } else {
    prompt = ANALYZE_MEMO_PROMPT;
    extraConfig = {
      responseMimeType: 'application/json',
      responseSchema: ANALYZE_MEMO_SCHEMA,
    };
  }

  const upstreamBody: Record<string, unknown> = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: audio_base64 } },
          { text: prompt },
        ],
      },
    ],
  };
  if (extraConfig) upstreamBody.generationConfig = extraConfig;

  // ── Call Gemini ─────────────────────────────────────────────────
  try {
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${AUDIO_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(upstreamBody),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[gemini-audio:${action}] upstream ${res.status}:`, detail);
      return json({ error: 'upstream_error', detail, status: res.status }, 502);
    }

    const data = await res.json();
    const text = extractText(data);

    await incrementAIUsage(supabase, workspace_id, 1);

    if (action === 'analyze_memo') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text || '{}');
      } catch (e) {
        console.error('[gemini-audio:analyze_memo] JSON parse failed:', e, text);
        return json({ error: 'upstream_error', detail: 'invalid_json_from_model' }, 502);
      }
      return json({ data: parsed });
    }

    return json({ text });
  } catch (e) {
    console.error(`[gemini-audio:${action}] request failed:`, e);
    return json(
      { error: 'request_failed', detail: e instanceof Error ? e.message : 'unknown' },
      502,
    );
  }
});
