// Supabase Edge Function — OpenAI Whisper transcription proxy.
// Client posts audio as multipart/form-data; we forward to OpenAI with the
// server-side key, then return the transcription. Keeps OPENAI_API_KEY out
// of the browser bundle.
//
// Supported OpenAI endpoints (controlled by `endpoint` form field):
//   - transcriptions (default) — returns text transcription
//   - translations             — returns English translation
//
// Accepted form fields (pass-through to OpenAI unless marked):
//   file               — required — audio Blob/File
//   model              — default 'whisper-1'
//   language           — ISO-639-1, optional
//   prompt             — optional
//   response_format    — 'json' (default) | 'text' | 'srt' | 'verbose_json' | 'vtt'
//   temperature        — optional, 0-1
//   timestamp_granularities[]  — optional, for verbose_json
//   endpoint           — 'transcriptions' (default) | 'translations' — CONSUMED LOCALLY
//
// Response: OpenAI's raw response, proxied through.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// Max audio file size we'll accept (OpenAI hard cap is 25 MB).
const MAX_FILE_BYTES = 25 * 1024 * 1024;

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // ── Auth ────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401);
  }
  const token = authHeader.replace('Bearer ', '');
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
  if (authErr || !user) {
    return json({ error: 'unauthorized' }, 401);
  }

  if (!OPENAI_API_KEY) {
    console.error('[whisper-proxy] OPENAI_API_KEY not configured');
    return json({ error: 'server_misconfigured' }, 500);
  }

  // ── Parse incoming multipart form ───────────────────────────────
  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return json({
      error: 'invalid_multipart',
      detail: e instanceof Error ? e.message : String(e),
    }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return json({ error: 'file field required (audio blob)' }, 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return json({
      error: 'file_too_large',
      detail: `max ${MAX_FILE_BYTES} bytes, got ${file.size}`,
    }, 413);
  }

  // `endpoint` is consumed locally — decides transcriptions vs translations
  const endpoint = (form.get('endpoint') as string) === 'translations'
    ? 'translations'
    : 'transcriptions';

  // ── Build forwarded form for OpenAI ─────────────────────────────
  const openaiForm = new FormData();
  openaiForm.append('file', file, file.name || 'audio.webm');

  const forwardFields = [
    'model',
    'language',
    'prompt',
    'response_format',
    'temperature',
    'timestamp_granularities[]',
  ];

  for (const field of forwardFields) {
    const values = form.getAll(field);
    for (const v of values) {
      if (typeof v === 'string') openaiForm.append(field, v);
    }
  }
  // Default model if caller didn't supply one
  if (!openaiForm.has('model')) openaiForm.append('model', 'whisper-1');

  // ── Call OpenAI ─────────────────────────────────────────────────
  console.log(`[whisper-proxy] user=${user.id} endpoint=${endpoint} size=${file.size}`);

  const res = await fetch(`https://api.openai.com/v1/audio/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: openaiForm,
  });

  const contentType = res.headers.get('Content-Type') || 'application/json';
  const bodyText = await res.text();

  if (!res.ok) {
    console.error('[whisper-proxy] OpenAI error:', res.status, bodyText);
    return new Response(bodyText, {
      status: res.status,
      headers: { ...CORS, 'Content-Type': contentType },
    });
  }

  // Pass through whatever OpenAI returned (respects response_format)
  return new Response(bodyText, {
    status: 200,
    headers: { ...CORS, 'Content-Type': contentType },
  });
});
