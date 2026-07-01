// Passkey (WebAuthn / FIDO2) client service.
// Keeps every ceremony + Supabase call out of the components (mirrors the
// loginWithGoogle / updatePassword split in authService).
//
// Backend = four self-hosted edge functions (Option A). Session minting for
// sign-in happens server-side; here we just set the returned session, same as
// the existing OAuth path. See docs/PASSKEY_WEBAUTHN_BUILD_HANDOFF_2026-07-01.md.

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import { supabase } from './supabase';
import { markPendingAuthMethod } from './authService';

export interface PasskeyRow {
  id: string;
  credential_id: string;
  device_label: string | null;
  transports: string[] | null;
  backed_up: boolean;
  created_at: string;
  last_used_at: string | null;
}

/** True only when the platform can actually do a passkey (gates the UI). */
export async function passkeySupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !browserSupportsWebAuthn()) return false;
    return await platformAuthenticatorIsAvailable().catch(() => false);
  } catch {
    return false;
  }
}

/** Flatten a functions.invoke result into data or a thrown Error. */
async function invoke<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    // Edge functions return { error } with a non-2xx; supabase-js wraps it.
    let msg = error.message;
    try {
      const ctx = (error as { context?: { body?: string } }).context;
      if (ctx?.body) msg = JSON.parse(ctx.body)?.error ?? msg;
    } catch { /* keep msg */ }
    throw new Error(msg);
  }
  if (data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)) {
    throw new Error(String((data as unknown as { error: unknown }).error));
  }
  return data as T;
}

/** Enroll a new passkey on the signed-in account (Settings). */
export async function registerPasskey(deviceLabel?: string): Promise<PasskeyRow | void> {
  const { options, challengeId } = await invoke<{ options: unknown; challengeId: string }>(
    'passkey-register-begin', {},
  );
  const attResp = await startRegistration({ optionsJSON: options as Parameters<typeof startRegistration>[0]['optionsJSON'] });
  await invoke('passkey-register-finish', { challengeId, response: attResp, deviceLabel });
}

/**
 * Sign in with a passkey. Runs the assertion, exchanges it for a minted session,
 * and calls setSession — which fires SIGNED_IN and swaps the Login screen out,
 * exactly like the OAuth callback. Returns nothing; the auth state change drives the UI.
 */
export async function loginWithPasskey(): Promise<void> {
  // Mark intent before the ceremony so a genuine SIGNED_IN promotes 'passkey' to
  // the durable last-used record (same mechanism as the OAuth/email flows).
  markPendingAuthMethod('passkey');
  const { options, challengeId } = await invoke<{ options: unknown; challengeId: string }>(
    'passkey-auth-begin', {},
  );
  const asrResp = await startAuthentication({ optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'] });
  const { access_token, refresh_token } = await invoke<{ access_token: string; refresh_token: string }>(
    'passkey-auth-finish', { challengeId, response: asrResp },
  );
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw new Error(error.message);
}

/** List the signed-in user's enrolled passkeys (RLS: own rows only). */
export async function listPasskeys(): Promise<PasskeyRow[]> {
  const { data, error } = await supabase
    .from('user_passkeys')
    .select('id, credential_id, device_label, transports, backed_up, created_at, last_used_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PasskeyRow[];
}

/** Revoke a passkey (RLS: own rows only). */
export async function removePasskey(id: string): Promise<void> {
  const { error } = await supabase.from('user_passkeys').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
