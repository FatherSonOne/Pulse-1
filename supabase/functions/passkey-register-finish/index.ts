// Supabase Edge Function: passkey-register-finish
// Authed. Verifies the attestation from startRegistration() against the stored
// challenge and inserts the new credential into user_passkeys.
//
// Body: { challengeId: string, response: RegistrationResponseJSON, deviceLabel?: string }
// Returns: { verified: true, credentialId, deviceLabel }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { verifyRegistrationResponse } from 'https://esm.sh/@simplewebauthn/server@13';
import { isoBase64URL } from 'https://esm.sh/@simplewebauthn/server@13/helpers';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const RP_ID = Deno.env.get('PASSKEY_RP_ID') ?? 'pulse.logosvision.org';
const ORIGINS = (Deno.env.get('PASSKEY_ORIGINS') ?? 'https://pulse.logosvision.org,http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);

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

    const { challengeId, response, deviceLabel } = await req.json();
    if (!challengeId || !response) return json({ error: 'Missing challengeId or response' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Load the single-use challenge; must belong to this user, be a registration
    // challenge, unconsumed and unexpired.
    const { data: ch } = await admin
      .from('passkey_challenges')
      .select('id, challenge, kind, user_id, expires_at, consumed_at')
      .eq('id', challengeId)
      .single();
    if (!ch || ch.kind !== 'registration' || ch.user_id !== user.id) {
      return json({ error: 'Invalid challenge' }, 400);
    }
    if (ch.consumed_at || new Date(ch.expires_at) < new Date()) {
      return json({ error: 'Challenge expired' }, 400);
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: ch.challenge,
      expectedOrigin: ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });

    // Consume the challenge regardless of outcome (single-use).
    await admin.from('passkey_challenges').update({ consumed_at: new Date().toISOString() }).eq('id', ch.id);

    if (!verification.verified || !verification.registrationInfo) {
      return json({ error: 'Passkey could not be verified' }, 400);
    }

    const { credential, credentialBackedUp, aaguid } = verification.registrationInfo;

    const { error: insErr } = await admin.from('user_passkeys').insert({
      user_id: user.id,
      credential_id: credential.id,
      public_key: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? null,
      device_label: (typeof deviceLabel === 'string' && deviceLabel.trim()) ? deviceLabel.trim().slice(0, 80) : 'Passkey',
      aaguid: aaguid ?? null,
      backed_up: !!credentialBackedUp,
    });
    if (insErr) {
      // Unique violation = this credential is already enrolled.
      if ((insErr as { code?: string }).code === '23505') {
        return json({ error: 'This passkey is already enrolled' }, 409);
      }
      throw new Error('insert failed: ' + insErr.message);
    }

    return json({ verified: true, credentialId: credential.id, deviceLabel: deviceLabel ?? 'Passkey' });
  } catch (e) {
    console.error('[passkey-register-finish]', e);
    return json({ error: 'Could not complete passkey enrollment' }, 500);
  }
});
