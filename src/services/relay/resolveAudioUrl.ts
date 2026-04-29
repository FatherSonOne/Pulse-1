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

const RELAY_BUCKET = 'relay';
const VOXER_BUCKET = 'voxer';

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
