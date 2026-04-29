// src/services/linkPreviewService.ts
//
// Phase 7 — client for the `link-preview` edge function. Fetches
// Open Graph metadata for a URL, with two layers of caching:
//
//   1. Server cache: link_previews table (7 day TTL on success,
//      1 hour TTL on failure). Shared across all users.
//   2. Client cache: in-memory Map keyed by URL hash. Avoids
//      round-tripping the edge function for URLs already resolved
//      in this session.
//
// The edge function returns a normalized shape regardless of
// success / failure / cache hit; consumers branch on `status`.

import { supabase } from './supabase';

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image_url?: string;
  site_name?: string;
  og_type?: string;
  status: 'ok' | 'fetch_failed' | 'parse_failed';
  cached: boolean;
}

// In-memory cache for the current session. Survives navigation but not
// reloads — that's intentional; the server cache handles cross-session.
const sessionCache = new Map<string, LinkPreview>();

// Reasonable URL regex for in-message extraction. Matches http(s):// +
// host + optional path/query. Doesn't try to be exhaustive — we only
// want strings that look like real links, not edge cases.
const URL_REGEX = /https?:\/\/[^\s<>"']+/g;

/**
 * Extract the first N URLs from a message body. Useful for previewing
 * links in a message without paying for every link mentioned.
 */
export function extractUrls(text: string, max: number = 3): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  // Dedupe while preserving order.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of matches) {
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= max) break;
  }
  return out;
}

class LinkPreviewService {
  /**
   * Get a preview for a single URL. Hits in-memory cache first, then
   * server cache (via edge function), then live fetch.
   */
  async getPreview(url: string): Promise<LinkPreview | null> {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;

    // In-memory cache check — keyed by the raw URL since the edge
    // function does its own canonicalization.
    if (sessionCache.has(trimmed)) {
      return sessionCache.get(trimmed)!;
    }

    try {
      const { data, error } = await supabase.functions.invoke<LinkPreview>(
        'link-preview',
        { body: { url: trimmed } },
      );

      if (error || !data) {
        console.error('[linkPreviewService] edge fn failed:', error);
        return null;
      }

      sessionCache.set(trimmed, data);
      return data;
    } catch (err) {
      console.error('[linkPreviewService] unexpected error:', err);
      return null;
    }
  }

  /**
   * Get previews for multiple URLs in parallel. Returns a map keyed
   * by the original URL so callers can match results back to source.
   * Failed lookups are simply omitted from the map.
   */
  async getPreviews(urls: string[]): Promise<Record<string, LinkPreview>> {
    const out: Record<string, LinkPreview> = {};
    const results = await Promise.allSettled(
      urls.map((url) => this.getPreview(url).then((preview) => ({ url, preview }))),
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.preview) {
        out[r.value.url] = r.value.preview;
      }
    }
    return out;
  }

  /**
   * Force refresh — bypasses both caches. Useful when a user explicitly
   * re-requests the preview (e.g., site updated their OG tags).
   */
  async refresh(url: string): Promise<LinkPreview | null> {
    sessionCache.delete(url);
    // Server cache invalidation happens via TTL; for explicit refresh
    // we'd need an admin RPC. For now this just bypasses the session
    // cache; the server cache will return until expires_at.
    return this.getPreview(url);
  }

  /** Drop everything in the in-memory cache (e.g. on logout). */
  clearCache(): void {
    sessionCache.clear();
  }
}

export const linkPreviewService = new LinkPreviewService();
export default linkPreviewService;
