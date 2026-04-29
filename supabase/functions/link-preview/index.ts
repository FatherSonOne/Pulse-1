// Supabase Edge Function: Link Preview
//
// Phase 7 — fetches and parses Open Graph tags for a URL, returning a
// link preview card (title, description, image, site name). Caches
// results in `link_previews` so subsequent fetches for the same URL
// are free.
//
// Request:  POST /functions/v1/link-preview
//   body: { url: string }
//
// Response (200):
//   {
//     url: string,
//     title?: string,
//     description?: string,
//     image_url?: string,
//     site_name?: string,
//     og_type?: string,
//     status: 'ok' | 'fetch_failed' | 'parse_failed',
//     cached: boolean
//   }
// Response (400): { error: "invalid_body" | "invalid_url" }
// Response (401): { error: "unauthorized" }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

interface LinkPreviewRequest {
  url: string;
}

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image_url?: string;
  site_name?: string;
  og_type?: string;
  status: 'ok' | 'fetch_failed' | 'parse_failed';
}

// SHA-256 hex of a string. Used as the cache key so we get fast lookups
// without indexing a long URL TEXT field.
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Normalize URL for consistent caching. Lowercases protocol+host, strips
// trailing slashes from the path. Doesn't touch query — the query is
// often what makes a URL meaningful (e.g., YouTube ?v=...).
function canonicalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    let path = u.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${path}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

// Pull a single OG / Twitter / standard meta tag value from raw HTML.
// We don't pull in a full HTML parser (cheerio etc) because we only
// need a handful of tags and they follow a strict shape — regex is
// fast enough for our cache-fill use case.
function extractMeta(html: string, key: 'og:title' | 'og:description' | 'og:image' | 'og:site_name' | 'og:type' | 'twitter:title' | 'twitter:description' | 'twitter:image' | 'description' | 'title'): string | undefined {
  // Standard <title> tag (only used when key === 'title')
  if (key === 'title') {
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return m?.[1]?.trim();
  }

  // <meta property="og:foo" content="bar"> OR <meta name="description" content="bar">
  // The `property` attr is the OpenGraph convention; `name` is the standard meta convention.
  const attr = key.startsWith('og:') ? 'property' : 'name';
  // Allow either order: property first or content first.
  const re1 = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${key}["']`,
    'i',
  );
  const m1 = html.match(re1);
  if (m1) return decodeHtmlEntities(m1[1]);
  const m2 = html.match(re2);
  if (m2) return decodeHtmlEntities(m2[1]);
  return undefined;
}

// HTML entity decoder — covers the common ones that show up in OG tags.
// Avoids pulling in a full library for what's typically &amp; / &quot; / &#39;.
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'");
}

async function fetchAndParse(url: string): Promise<LinkPreview> {
  // Fetch with sane limits — we don't want to download a 100MB page.
  let html: string;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Many sites serve different markup to bots vs browsers; a
        // browser UA gets us OG tags more reliably.
        'User-Agent': 'Mozilla/5.0 (compatible; PulseBot/1.0; +https://pulse.app)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { url, status: 'fetch_failed' };
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      // Not HTML — can't extract OG tags.
      return { url, status: 'parse_failed' };
    }

    // Read at most 512 KB. OG tags live in <head>; large pages with
    // long bodies don't add useful info.
    const reader = res.body?.getReader();
    if (!reader) return { url, status: 'fetch_failed' };
    const decoder = new TextDecoder('utf-8');
    let bytesRead = 0;
    const MAX_BYTES = 512 * 1024;
    let buf = '';
    while (bytesRead < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      buf += decoder.decode(value, { stream: true });
      // Stop reading once we hit </head> — OG tags are guaranteed before then.
      if (buf.includes('</head>')) break;
    }
    try { reader.cancel(); } catch { /* ignore */ }
    html = buf;
  } catch (err) {
    console.error('[link-preview] fetch failed:', err);
    return { url, status: 'fetch_failed' };
  }

  try {
    const title = extractMeta(html, 'og:title')
      ?? extractMeta(html, 'twitter:title')
      ?? extractMeta(html, 'title');
    const description = extractMeta(html, 'og:description')
      ?? extractMeta(html, 'twitter:description')
      ?? extractMeta(html, 'description');
    const image = extractMeta(html, 'og:image')
      ?? extractMeta(html, 'twitter:image');
    const siteName = extractMeta(html, 'og:site_name');
    const ogType = extractMeta(html, 'og:type');

    if (!title && !description && !image) {
      return { url, status: 'parse_failed' };
    }

    return {
      url,
      title,
      description,
      image_url: image,
      site_name: siteName,
      og_type: ogType,
      status: 'ok',
    };
  } catch (err) {
    console.error('[link-preview] parse failed:', err);
    return { url, status: 'parse_failed' };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // ── Auth ────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authErr || !user) return json({ error: 'unauthorized' }, 401);

  // ── Parse ───────────────────────────────────────────────────────
  let body: LinkPreviewRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  if (!body.url || typeof body.url !== 'string') {
    return json({ error: 'invalid_url' }, 400);
  }

  const canonical = canonicalizeUrl(body.url);
  if (!canonical) return json({ error: 'invalid_url' }, 400);

  const urlHash = await sha256Hex(canonical);

  // ── Cache hit? ──────────────────────────────────────────────────
  const { data: cached } = await supabase
    .from('link_previews')
    .select('*')
    .eq('url_hash', urlHash)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (cached) {
    return json({
      url: cached.url,
      title: cached.title,
      description: cached.description,
      image_url: cached.image_url,
      site_name: cached.site_name,
      og_type: cached.og_type,
      status: cached.status,
      cached: true,
    });
  }

  // ── Cache miss — fetch and parse ────────────────────────────────
  const preview = await fetchAndParse(canonical);

  // ── Upsert cache (always, even for failures — we don't want to
  //    re-hammer broken URLs every render). ──
  await supabase.from('link_previews').upsert(
    {
      url_hash: urlHash,
      url: canonical,
      title: preview.title ?? null,
      description: preview.description ?? null,
      image_url: preview.image_url ?? null,
      site_name: preview.site_name ?? null,
      og_type: preview.og_type ?? null,
      status: preview.status,
      fetched_at: new Date().toISOString(),
      // Failures get a shorter TTL so we retry sooner.
      expires_at: new Date(
        Date.now() + (preview.status === 'ok' ? 7 * 24 * 60 * 60 * 1000 : 1 * 60 * 60 * 1000),
      ).toISOString(),
    },
    { onConflict: 'url_hash' },
  );

  return json({ ...preview, cached: false });
});
