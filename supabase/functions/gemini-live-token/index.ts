// Supabase Edge Function — Gemini Live ephemeral token minter.
// Mints a short-lived auth token for the Gemini Live (BidiGenerateContent)
// WebSocket API, so the client never holds the master GEMINI_API_KEY.
//
// Auth: caller must present a valid Supabase JWT (user JWT, not anon).
// Response: { token, expiresAt, newSessionExpireTime }
//
// Uses Google's @google/genai SDK (authTokens.create) because the raw REST
// endpoint for ephemeral tokens is still labeled "preview" and doesn't have
// a stable public contract. The SDK abstracts the v1alpha plumbing.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GoogleGenAI } from 'https://esm.sh/@google/genai@1.10.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

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
    console.error('[gemini-live-token] auth failed:', authErr?.message);
    return json({ error: 'unauthorized' }, 401);
  }

  // ── Key check ───────────────────────────────────────────────────
  if (!GEMINI_API_KEY) {
    console.error('[gemini-live-token] GEMINI_API_KEY not configured');
    return json({ error: 'server_misconfigured' }, 500);
  }

  // ── Parse options from request body (all optional) ──────────────
  let body: { uses?: number; durationMinutes?: number } = {};
  try {
    body = await req.json();
  } catch { /* empty body is fine */ }

  // Defaults: token is valid for 30 minutes, one session max.
  // Short `newSessionExpireTime` limits the window in which a leaked token
  // can start a new Gemini Live session (it can still keep an existing one
  // alive for the full expireTime).
  const durationMs = Math.min((body.durationMinutes ?? 30), 60) * 60 * 1000;
  const now = Date.now();

  // ── Mint ephemeral token via @google/genai SDK ──────────────────
  try {
    const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // SDK call — uses v1alpha behind the scenes
    // deno-lint-ignore no-explicit-any
    const authToken: any = await (client as any).authTokens.create({
      config: {
        uses: body.uses ?? 1,
        expireTime: new Date(now + durationMs).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(), // 1 min
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    // The SDK returns an AuthToken with `.name` — that string is the bearer
    // the client uses when connecting to Gemini Live.
    const tokenValue = authToken?.name || authToken?.token;
    if (!tokenValue) {
      console.error('[gemini-live-token] SDK returned no token:', authToken);
      return json({ error: 'no_token_returned', detail: JSON.stringify(authToken) }, 500);
    }

    console.log(`[gemini-live-token] minted token for user=${user.id}`);

    return json({
      token: tokenValue,
      expiresAt: new Date(now + durationMs).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[gemini-live-token] mint failed:', message);
    return json({
      error: 'token_mint_failed',
      detail: message,
    }, 500);
  }
});
