// Supabase Edge Function: Gemini Embed
// Server-side wrapper around Google's text-embedding-004 endpoint.
// Mirrors the ai-router pattern: auth-gated, server-held key, timeout, clean errors.
//
// Why server-side: the client-side equivalent in geminiService.ts exposes the
// Gemini API key in the URL (visible in DevTools / error logs), has no workspace
// scoping, and burns a separate billing project. Routing through here lets us
// share the GEMINI_API_KEY secret already used by ai-router and gate by JWT.
//
// Request:  POST /functions/v1/gemini-embed
//   body:   { text: string }                 — single embedding
//     or:   { texts: string[] }              — batch (max 100, max ~50KB each)
//
// Response (200): { embeddings: (number[] | null)[] }   // index-aligned with input
// Response (401): { error: "unauthorized" }
// Response (400): { error: "invalid_body" | "no_texts" | "batch_too_large" | "text_too_large_or_invalid" }
// Response (503): { error: "embeddings_not_configured" }     // GEMINI_API_KEY missing
// Response (502): { error: "upstream_error" | "request_failed", detail, status? }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

const EMBED_MODEL = 'text-embedding-004';
const MAX_BATCH = 100;
const MAX_TEXT_BYTES = 50_000;
const UPSTREAM_TIMEOUT_MS = 15_000;

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!GEMINI_API_KEY) return json({ error: 'embeddings_not_configured' }, 503);

  // ── Auth ────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authErr || !user) return json({ error: 'unauthorized' }, 401);

  // ── Parse ───────────────────────────────────────────────────────
  let body: { text?: string; texts?: string[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const texts = body.texts ?? (body.text ? [body.text] : []);
  if (texts.length === 0) return json({ error: 'no_texts' }, 400);
  if (texts.length > MAX_BATCH) return json({ error: 'batch_too_large', limit: MAX_BATCH }, 400);

  for (const t of texts) {
    if (typeof t !== 'string' || t.length === 0 || t.length > MAX_TEXT_BYTES) {
      return json({ error: 'text_too_large_or_invalid', limit: MAX_TEXT_BYTES }, 400);
    }
  }

  // ── Call Gemini ─────────────────────────────────────────────────
  try {
    if (texts.length === 1) {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: { parts: [{ text: texts[0] }] } }),
        },
      );
      if (!res.ok) {
        const detail = await res.text();
        console.error(`[gemini-embed] upstream ${res.status}:`, detail);
        return json({ error: 'upstream_error', detail, status: res.status }, 502);
      }
      const data = await res.json();
      return json({ embeddings: [data.embedding?.values ?? null] });
    }

    // Batch path — single round-trip via batchEmbedContents.
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: texts.map((t) => ({
            model: `models/${EMBED_MODEL}`,
            content: { parts: [{ text: t }] },
          })),
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[gemini-embed] upstream batch ${res.status}:`, detail);
      return json({ error: 'upstream_error', detail, status: res.status }, 502);
    }
    const data = await res.json();
    const embeddings: (number[] | null)[] = (data.embeddings ?? []).map(
      (e: { values?: number[] }) => e.values ?? null,
    );
    return json({ embeddings });
  } catch (e) {
    console.error('[gemini-embed] request failed:', e);
    return json(
      { error: 'request_failed', detail: e instanceof Error ? e.message : 'unknown' },
      502,
    );
  }
});
