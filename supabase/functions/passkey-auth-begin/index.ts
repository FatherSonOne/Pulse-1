// Supabase Edge Function: passkey-auth-begin
// Anonymous. Returns PublicKeyCredentialRequestOptions for a passkey sign-in.
// Usernameless / discoverable: allowCredentials is empty, so the platform offers
// whatever passkeys it holds for this rpID. Stores the challenge.
//
// Body: {} (none required)
// Returns: { options: PublicKeyCredentialRequestOptionsJSON, challengeId: string }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { generateAuthenticationOptions } from 'https://esm.sh/@simplewebauthn/server@13';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RP_ID = Deno.env.get('PASSKEY_RP_ID') ?? 'pulse.logosvision.org';

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
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    admin.rpc('purge_expired_passkey_challenges').then(() => {}, () => {});

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
      allowCredentials: [], // discoverable credentials
    });

    const { data: challenge, error: cErr } = await admin
      .from('passkey_challenges')
      .insert({ challenge: options.challenge, kind: 'authentication' })
      .select('id')
      .single();
    if (cErr) throw new Error('challenge store failed: ' + cErr.message);

    return json({ options, challengeId: challenge.id });
  } catch (e) {
    console.error('[passkey-auth-begin]', e);
    return json({ error: 'Could not start passkey sign-in' }, 500);
  }
});
