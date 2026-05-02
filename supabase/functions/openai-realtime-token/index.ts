// Supabase Edge Function to generate OpenAI Realtime ephemeral tokens
// This proxy is needed because OpenAI's API doesn't support CORS for browser requests

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Authentication ────────────────────────────────────────────────────────
    // Every caller must present a valid Supabase JWT. This prevents
    // unauthenticated users from burning the server's OpenAI credits.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userToken = authHeader.slice(7);
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // supabase-js v2: pass the JWT explicitly. getUser() with no argument
    // looks for a session in client-side storage and returns null on the server.
    const { data: { user }, error: getUserError } = await supabaseClient.auth.getUser(userToken);
    if (!user) {
      console.warn('[openai-realtime-token] getUser rejected token:', getUserError?.message ?? 'unknown');
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── OpenAI key — always from server env, never from request body ──────────
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('[openai-realtime-token] OPENAI_API_KEY env var not set');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const model = body.model || 'gpt-4o-realtime-preview';
    const voice = body.voice || 'alloy';

    console.log(`[openai-realtime-token] user=${user.id} model=${model} voice=${voice}`);

    // Call OpenAI's realtime sessions endpoint
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, voice }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[openai-realtime-token] OpenAI API error:', response.status, errorText);

      let errorMessage = `OpenAI API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const token = data.client_secret?.value || data.value;

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'No token in response', data }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[openai-realtime-token] Ephemeral token generated successfully');

    return new Response(
      JSON.stringify({ token, expiresAt: data.client_secret?.expires_at }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[openai-realtime-token] Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
