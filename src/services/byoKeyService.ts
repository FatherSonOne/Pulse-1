/**
 * BYO OpenAI key service — Summit Phase 1.
 *
 * The plaintext key only exists in three places at runtime:
 *   1. The Settings form input while the user is typing.
 *   2. The Vault row (encrypted at rest, fetched on demand).
 *   3. The Summit component's in-memory state for the duration of a session.
 *
 * It never touches localStorage and never persists in React state outside
 * Summit. `getByoKeyStatus()` returns only the masked hint + validation
 * state; `fetchByoKey()` is the single place that returns plaintext.
 */
import { supabase } from './supabase';

const OPENAI_MODELS_URL = 'https://api.openai.com/v1/models';

export interface ByoKeyStatus {
  hasKey: boolean;
  hint?: string;
  lastOk?: boolean;
  validatedAt?: string;
}

/** Pings OpenAI's free /v1/models endpoint to confirm a key is live. */
export async function validateOpenAIKey(key: string): Promise<boolean> {
  try {
    const res = await fetch(OPENAI_MODELS_URL, {
      headers: { Authorization: `Bearer ${key}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getByoKeyStatus(): Promise<ByoKeyStatus> {
  const { data, error } = await supabase
    .from('user_openai_keys')
    .select('key_hint, last_validation_ok, last_validated_at')
    .maybeSingle();
  if (error || !data) return { hasKey: false };
  return {
    hasKey: true,
    hint: data.key_hint,
    lastOk: data.last_validation_ok ?? undefined,
    validatedAt: data.last_validated_at ?? undefined,
  };
}

export async function saveByoKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed.startsWith('sk-')) {
    throw new Error("That doesn't look like an OpenAI key — they start with 'sk-'.");
  }
  if (trimmed.length < 20) {
    throw new Error('Key is too short.');
  }
  const ok = await validateOpenAIKey(trimmed);
  if (!ok) {
    throw new Error('OpenAI rejected this key. Check that it is active and has Realtime API access.');
  }
  const hint = `sk-…${trimmed.slice(-4)}`;
  const { error } = await supabase.rpc('save_user_openai_key', {
    p_key: trimmed,
    p_hint: hint,
  });
  if (error) throw new Error(error.message);
}

export async function deleteByoKey(): Promise<void> {
  const { error } = await supabase.rpc('delete_user_openai_key');
  if (error) throw new Error(error.message);
}

/**
 * Returns the plaintext key for the current user, or null if none is stored.
 * Summit calls this once at launch and drops the result when the component
 * unmounts.
 */
export async function fetchByoKey(): Promise<string | null> {
  const { data, error } = await supabase.rpc('read_user_openai_key');
  if (error) return null;
  return (data as string | null) ?? null;
}
