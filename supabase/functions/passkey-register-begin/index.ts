// Supabase Edge Function: passkey-register-begin
// Authed. Returns PublicKeyCredentialCreationOptions for enrolling a new passkey
// and stores the ceremony challenge. excludeCredentials = the user's existing
// credentials so the same authenticator isn't enrolled twice.
//
// Auth: caller's JWT (Authorization: Bearer <token>).
// Returns: { options: PublicKeyCredentialCreationOptionsJSON, challengeId: string }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { generateRegistrationOptions } from 'https://esm.sh/@simplewebauthn/server@13';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Canonical passkey origin/RP config — see the handoff. rpID is the registrable
// domain the app is served from; passkeys bind to it and cannot be migrated later.
const RP_ID = Deno.env.get('PASSKEY_RP_ID') ?? 'pulse.logosvision.org';
const RP_NAME = Deno.env.get('PASSKEY_RP_NAME') ?? 'Pulse';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);
    const token = authHeader.replace('Bearer ', '');

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Opportunistic housekeeping; never fail the request on it.
    admin.rpc('purge_expired_passkey_challenges').then(() => {}, () => {});

    // Exclude already-enrolled credentials on this account.
    const { data: existing } = await admin
      .from('user_passkeys')
      .select('credential_id, transports')
      .eq('user_id', user.id);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new TextEncoder().encode(user.id),
      userName: user.email ?? user.id,
      userDisplayName: (user.user_metadata?.full_name as string) ?? user.email ?? 'Pulse user',
      attestationType: 'none',
      excludeCredentials: (existing ?? []).map((c) => ({
        id: c.credential_id,
        transports: c.transports ?? undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    const { data: challenge, error: cErr } = await admin
      .from('passkey_challenges')
      .insert({ challenge: options.challenge, kind: 'registration', user_id: user.id, email: user.email })
      .select('id')
      .single();
    if (cErr) throw new Error('challenge store failed: ' + cErr.message);

    return json({ options, challengeId: challenge.id });
  } catch (e) {
    console.error('[passkey-register-begin]', e);
    return json({ error: 'Could not start passkey enrollment' }, 500);
  }
});
