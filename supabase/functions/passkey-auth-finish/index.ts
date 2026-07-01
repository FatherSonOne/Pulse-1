// Supabase Edge Function: passkey-auth-finish
// Anonymous. Verifies the assertion from startAuthentication() against the stored
// challenge, bumps the signature counter (clone detection), and — the crux —
// MINTS a Supabase session for the credential's owner via the proven bridge:
//   admin.generateLink('magiclink') -> verifyOtp(token_hash)  (spiked 2026-07-01)
// so the client gets { access_token, refresh_token } with no password / no OAuth.
//
// Body: { challengeId: string, response: AuthenticationResponseJSON }
// Returns: { access_token, refresh_token } | uniform { error } on any failure.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { verifyAuthenticationResponse } from 'https://esm.sh/@simplewebauthn/server@13';
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

// Uniform failure — never reveal whether a credential existed (enumeration-safe).
const FAIL = () => json({ error: 'Passkey sign-in failed' }, 401);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { challengeId, response } = await req.json();
    if (!challengeId || !response?.id) return FAIL();

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Single-use authentication challenge.
    const { data: ch } = await admin
      .from('passkey_challenges')
      .select('id, challenge, kind, expires_at, consumed_at')
      .eq('id', challengeId)
      .single();
    if (!ch || ch.kind !== 'authentication' || ch.consumed_at || new Date(ch.expires_at) < new Date()) {
      return FAIL();
    }

    // Resolve the asserted credential (base64url rawId) to its stored public key.
    const { data: cred } = await admin
      .from('user_passkeys')
      .select('id, user_id, credential_id, public_key, counter, transports')
      .eq('credential_id', response.id)
      .single();

    // Consume the challenge up front (single-use), whatever happens next.
    await admin.from('passkey_challenges').update({ consumed_at: new Date().toISOString() }).eq('id', ch.id);

    if (!cred) return FAIL();

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: ch.challenge,
      expectedOrigin: ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: false,
      credential: {
        id: cred.credential_id,
        publicKey: isoBase64URL.toBuffer(cred.public_key),
        counter: Number(cred.counter),
        transports: cred.transports ?? undefined,
      },
    });

    if (!verification.verified) return FAIL();

    // Clone/replay detection: counter must be strictly increasing (0 == authenticator
    // that doesn't implement a counter, which is allowed).
    const newCounter = verification.authenticationInfo.newCounter;
    if (newCounter !== 0 && newCounter <= Number(cred.counter)) {
      console.warn('[passkey-auth-finish] counter regression for credential', cred.id);
      return FAIL();
    }

    await admin.from('user_passkeys')
      .update({ counter: newCounter, last_used_at: new Date().toISOString() })
      .eq('id', cred.id);

    // ── Mint the session (proven bridge) ────────────────────────────────
    const { data: owner, error: uErr } = await admin.auth.admin.getUserById(cred.user_id);
    if (uErr || !owner?.user?.email) return FAIL();

    const { data: link, error: lErr } = await admin.auth.admin.generateLink({
      type: 'magiclink', email: owner.user.email,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (lErr || !tokenHash) return FAIL();

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: verified, error: vErr } = await anon.auth.verifyOtp({
      token_hash: tokenHash, type: 'magiclink',
    });
    if (vErr || !verified?.session) return FAIL();

    return json({
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    });
  } catch (e) {
    console.error('[passkey-auth-finish]', e);
    return FAIL();
  }
});
