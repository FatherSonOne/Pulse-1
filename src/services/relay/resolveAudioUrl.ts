// resolveAudioUrl — Relay storage compatibility shim.
//
// As of 2026-04-27 the canonical Relay storage bucket is `relay`. The legacy
// `voxer` bucket is kept readable for 30 days so older voice messages keep
// playing without backfilling URLs in the database. Audio URLs persisted to
// our message tables are produced via `supabase.storage.from(<bucket>).
// getPublicUrl(...)`, which embeds the bucket segment — so reads naturally
// hit whichever bucket the asset lives in. This helper exists for the rare
// consumer that holds a path-shaped string (no bucket segment) or that
// wants belt-and-suspenders dual-read resilience.
//
// Behaviour:
//  - Full URLs that already contain `/storage/v1/object/.../relay/...` or
//    `/.../voxer/...` are returned as-is — they're self-describing.
//  - Bare paths (no protocol) are resolved against the Supabase URL,
//    preferring `relay`. The legacy fallback is exposed via
//    `legacyAudioUrl(path)` so a consumer can retry on 404.
//  - Anything else (data URLs, blob URLs, foreign hosts) passes through.
//
// We do NOT issue a HEAD request here — that would add a round-trip to every
// playback. The contract is: caller plays the resolved URL, and on
// load-error retries with `legacyAudioUrl(path)`.

import { supabase } from '../supabase';

const RELAY_BUCKET = 'relay';
const VOXER_BUCKET = 'voxer';

// How long a signed playback URL stays valid. Signing happens lazily at
// fetch/play time, so an hour is ample for one listen and a re-fetch re-signs.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function getSupabasePublicBase(): string | null {
  const url = (import.meta.env?.VITE_SUPABASE_URL as string | undefined)
    ?? (typeof process !== 'undefined' ? process.env?.SUPABASE_URL : undefined);
  if (!url) return null;
  return `${url.replace(/\/$/, '')}/storage/v1/object/public`;
}

/**
 * Normalise a stored `audio_url` to a playable URL, preferring the canonical
 * `relay` bucket when the input is a bare object path. Self-describing
 * URLs and non-Supabase URLs pass through unchanged.
 */
export function resolveAudioUrl(input: string | null | undefined): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  // Already a self-describing URL — caller already encoded the bucket.
  if (/^https?:\/\//i.test(trimmed) || /^(blob:|data:)/i.test(trimmed)) {
    return trimmed;
  }

  const base = getSupabasePublicBase();
  if (!base) return trimmed;
  const cleanPath = trimmed.replace(/^\//, '');
  return `${base}/${RELAY_BUCKET}/${cleanPath}`;
}

/**
 * Legacy fallback — resolve the same path against the `voxer` bucket. Use
 * this from a media element's `error` handler to recover when the canonical
 * `relay` URL 404s on a pre-cutover asset.
 */
export function legacyAudioUrl(input: string | null | undefined): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  // If the input is already a self-describing relay URL, swap the bucket
  // segment to voxer so the same path resolves against the legacy bucket.
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(
      /\/storage\/v1\/object\/(public|sign)\/relay\//,
      `/storage/v1/object/$1/${VOXER_BUCKET}/`,
    );
  }

  const base = getSupabasePublicBase();
  if (!base) return trimmed;
  const cleanPath = trimmed.replace(/^\//, '');
  return `${base}/${VOXER_BUCKET}/${cleanPath}`;
}

/**
 * Pull the storage bucket + object key out of a stored audio reference,
 * whatever shape it's in. Recognises the three forms we persist or hand
 * around:
 *   - a public URL   (`/storage/v1/object/public/relay/<key>`)
 *   - a signed URL   (`/storage/v1/object/sign/relay/<key>?token=…`)
 *   - a bare path    (`<key>` — no protocol, assumed to live in `relay`)
 * Returns null for anything not backed by our storage (data:, blob:, or a
 * foreign host) — the caller should play those as-is.
 */
function extractBucketAndKey(
  input: string,
): { bucket: string; key: string } | null {
  // Self-describing Supabase storage URL — capture bucket + key, drop query.
  const m = input.match(
    /\/storage\/v1\/object\/(?:public|sign|authenticated)\/(relay|voxer)\/([^?]+)/,
  );
  if (m) return { bucket: m[1], key: m[2] };

  // Any other absolute URL (data:, blob:, foreign host) is not ours to sign.
  if (/^https?:\/\//i.test(input) || /^(blob:|data:)/i.test(input)) return null;

  // Bare object path → canonical relay bucket.
  return { bucket: RELAY_BUCKET, key: input.replace(/^\//, '') };
}

/**
 * Resolve a stored audio reference to a *signed*, time-limited URL for
 * playback/download. This is the read-path counterpart to the storage
 * write-lockdown (sweep 3a): it lets Relay serve audio from a private bucket
 * without exposing objects via anonymous public URLs.
 *
 * Key property: `createSignedUrl` works whether the bucket is public or
 * private, so this can be rolled out per-consumer with ZERO playback
 * regression while the bucket is still public, then the bucket flipped
 * private in a later, trivial step.
 *
 * Resilience: on a signing failure it falls back to the legacy `voxer`
 * bucket, and finally to the original reference — so while the bucket is
 * still public, playback can never be worse off than before this existed.
 */
export async function getPlayableUrl(
  input: string | null | undefined,
): Promise<string> {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  // Already local (in-memory) audio — nothing to sign.
  if (/^(blob:|data:)/i.test(trimmed)) return trimmed;

  const parsed = extractBucketAndKey(trimmed);
  // Not our storage (e.g. a foreign CDN) — hand it back untouched.
  if (!parsed) return trimmed;

  const { bucket, key } = parsed;

  const sign = async (b: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from(b)
      .createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  };

  // Sign against the object's own bucket first, then the legacy bucket for
  // pre-cutover assets that were only ever written to `voxer`.
  const signed =
    (await sign(bucket)) ??
    (bucket === RELAY_BUCKET ? await sign(VOXER_BUCKET) : null);

  // Last resort: the original reference. Harmless while the bucket is public;
  // once it's private this returns a 403-ing URL, which the caller's existing
  // error handling already treats as "unplayable" rather than crashing.
  return signed ?? trimmed;
}
