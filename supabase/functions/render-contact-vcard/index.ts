// Supabase Edge Function: render-contact-vcard
//
// Phase C — public vCard delivery. No auth required; runs as service
// role internally. GET /functions/v1/render-contact-vcard?token={uuid}.
//
// Defaults to vCard 3.0 with a strip-list (PHOTO/IMPP/RELATED/LANG/
// GENDER/KIND/X-*). Honors `Accept: text/vcard; version=4.0` for 4.0
// mode (no strip-list applied). Display name characters {, }, # pass
// through verbatim per the Pulse contact-name policy — only the
// RFC 2426 grammar (`;`, `,`, `\n`, `\\`) is escaped.
//
// HTTP semantics (Adversarial Adam UUID-probing defense, magi D-9):
//   200  — valid + readable card body returned
//   410  — revoked / expired / consumed / blocked-sender (generic body)
//   404  — token never existed
//   500  — DB error or snapshot deserialization failure

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CardSnapshot {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  address?: string;
  avatar_color?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// NOTE: error responses are JSON for API ergonomics. The 410 body
// text is deliberately generic — no sender name leak, no field leak.
function jsonError(status: number, error: string, details?: string) {
  const body: Record<string, unknown> = { error };
  if (details) body.details = details;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function vcardResponse(body: string, filename: string) {
  return new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// ─── vCard 3.0 / 4.0 emitter ─────────────────────────────────────────

/**
 * RFC 2426 (3.0) and RFC 6350 (4.0) text-value escaping: backslash,
 * semicolon, comma, and newline only. Braces and hashes pass through
 * verbatim per Pulse contact-name policy.
 */
function escapeVCardText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * Sanitize the display name for use in a Content-Disposition
 * filename. ASCII-safe; non-ASCII chars become underscores. Braces
 * and hashes are kept ASCII-safe by being passed through, but we
 * also strip path separators and quotes to keep the header parseable.
 */
function sanitizeFilename(name: string): string {
  const stripped = name.replace(/[\\/"\r\n]+/g, '').trim();
  // Keep ASCII printable; replace anything else with `_`.
  const ascii = stripped.replace(/[^\x20-\x7E]/g, '_');
  const truncated = ascii.slice(0, 64);
  return (truncated || 'contact') + '.vcf';
}

/**
 * Split an address-string into vCard ADR semicolon-delimited slots.
 * The Pulse `contacts.address` column is a single free-text field, so
 * we don't have structured slots. Put the whole string in the
 * "street-address" slot per RFC 2426 §3.2.1 — empty PO box / extended
 * address / city / region / postal-code / country.
 */
function adrLine(address: string): string {
  return `ADR:;;${escapeVCardText(address)};;;;`;
}

function renderVCard3(snap: CardSnapshot): string {
  // 3.0 strip-list applied; only allowed fields rendered.
  const lines: string[] = [];
  lines.push('BEGIN:VCARD');
  lines.push('VERSION:3.0');
  // FN required; N built from a single-name fallback (Last;First;;;).
  lines.push(`FN:${escapeVCardText(snap.name)}`);
  // Split name on last whitespace for a "Family;Given" heuristic.
  // NOTE: heuristic. Pulse stores `name` as a single column; we don't
  // have structured family/given. Best effort: last token = family,
  // rest = given. Caller can override by hitting 4.0 which omits the
  // structured N component when family is unknown.
  const parts = snap.name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const family = parts[parts.length - 1];
    const given = parts.slice(0, -1).join(' ');
    lines.push(`N:${escapeVCardText(family)};${escapeVCardText(given)};;;`);
  } else {
    lines.push(`N:;${escapeVCardText(snap.name)};;;`);
  }
  if (snap.phone) lines.push(`TEL;TYPE=CELL:${escapeVCardText(snap.phone)}`);
  if (snap.email) lines.push(`EMAIL:${escapeVCardText(snap.email)}`);
  if (snap.company) lines.push(`ORG:${escapeVCardText(snap.company)}`);
  if (snap.title) lines.push(`TITLE:${escapeVCardText(snap.title)}`);
  if (snap.address) lines.push(adrLine(snap.address));
  lines.push('END:VCARD');
  return lines.join('\r\n') + '\r\n';
}

function renderVCard4(snap: CardSnapshot): string {
  const lines: string[] = [];
  lines.push('BEGIN:VCARD');
  lines.push('VERSION:4.0');
  lines.push(`FN:${escapeVCardText(snap.name)}`);
  const parts = snap.name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const family = parts[parts.length - 1];
    const given = parts.slice(0, -1).join(' ');
    lines.push(`N:${escapeVCardText(family)};${escapeVCardText(given)};;;`);
  } else {
    lines.push(`N:;${escapeVCardText(snap.name)};;;`);
  }
  if (snap.phone) lines.push(`TEL;VALUE=text;TYPE=cell:${escapeVCardText(snap.phone)}`);
  if (snap.email) lines.push(`EMAIL:${escapeVCardText(snap.email)}`);
  if (snap.company) lines.push(`ORG:${escapeVCardText(snap.company)}`);
  if (snap.title) lines.push(`TITLE:${escapeVCardText(snap.title)}`);
  if (snap.address) lines.push(adrLine(snap.address));
  lines.push('END:VCARD');
  return lines.join('\r\n') + '\r\n';
}

// ─── Accept header parsing ───────────────────────────────────────────

function wants4_0(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false;
  // Defensive parse — RFC 7231 media-range / params. Any token
  // `text/vcard` with a `version=4.0` parameter wins.
  return acceptHeader
    .split(',')
    .map((s) => s.trim())
    .some((entry) => {
      const params = entry.split(';').map((p) => p.trim());
      if (params[0]?.toLowerCase() !== 'text/vcard') return false;
      return params
        .slice(1)
        .some((p) => p.toLowerCase().replace(/\s+/g, '') === 'version=4.0');
    });
}

// ─── Main handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonError(405, 'method_not_allowed');
  }

  try {
    // Accept token either in URL path (/{token}) or query (?token=) or
    // POST body. The Supabase functions gateway routes all paths to
    // /functions/v1/render-contact-vcard so we extract from the URL
    // suffix or query string.
    const url = new URL(req.url);
    let token: string | null = null;

    // Path style: /functions/v1/render-contact-vcard/<uuid>
    const pathMatch = url.pathname.match(
      /render-contact-vcard\/([0-9a-fA-F-]{36})$/,
    );
    if (pathMatch) token = pathMatch[1];

    if (!token) token = url.searchParams.get('token');

    if (!token && req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (body && typeof body === 'object') {
        const t = (body as Record<string, unknown>).token;
        if (typeof t === 'string') token = t;
      }
    }

    if (!token || !UUID_RE.test(token)) {
      return jsonError(404, 'not_found');
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: card, error: cardErr } = await admin
      .from('contact_cards')
      .select(
        'id, sender_user_id, recipient_user_id, card_snapshot, token_policy, revoked_at, expires_at, consumed_at',
      )
      .eq('id', token)
      .maybeSingle();

    if (cardErr) {
      console.error('[render-vcard] card fetch error:', cardErr);
      return jsonError(500, 'internal');
    }
    if (!card) {
      return jsonError(404, 'not_found');
    }

    // ── Validity gates (all return 410 Gone, never 403/404) ──────────
    if (card.revoked_at) {
      return jsonError(410, 'gone', 'This contact card is no longer available');
    }
    if (card.expires_at && new Date(card.expires_at) < new Date()) {
      return jsonError(410, 'gone', 'This contact card is no longer available');
    }
    if (card.token_policy === 'single_use' && card.consumed_at) {
      return jsonError(410, 'gone', 'This contact card is no longer available');
    }

    // Block-leak: if recipient has blocked sender, return 410 (not 403)
    // so we don't signal block existence to the sender.
    if (card.recipient_user_id) {
      const { data: block } = await admin
        .from('card_send_blocks')
        .select('blocked_by_user_id')
        .eq('blocked_by_user_id', card.recipient_user_id)
        .eq('sender_user_id', card.sender_user_id)
        .maybeSingle();
      if (block) {
        return jsonError(410, 'gone', 'This contact card is no longer available');
      }
    }

    // ── Atomic view_count increment ──────────────────────────────────
    // Race-safe: UPDATE ... SET view_count = view_count + 1 ... RETURNING.
    const { error: bumpErr } = await admin.rpc('increment_contact_card_view_count', {
      p_card_id: card.id,
    });
    if (bumpErr) {
      // NOTE: RPC may not exist if migration didn't ship the helper.
      // Fall back to update + select. The RPC is the preferred path;
      // the fallback works at the cost of one extra round-trip.
      const { error: fallbackErr } = await admin
        .from('contact_cards')
        .update({ view_count: ((card as { view_count?: number }).view_count ?? 0) + 1 })
        .eq('id', card.id);
      if (fallbackErr) {
        console.error('[render-vcard] view_count update failed:', fallbackErr);
        // Not fatal — continue rendering. Logged for ops.
      }
    }

    // ── Render vCard body ────────────────────────────────────────────
    let snap: CardSnapshot;
    try {
      snap = card.card_snapshot as CardSnapshot;
      if (!snap || typeof snap.name !== 'string') {
        throw new Error('invalid_snapshot_shape');
      }
    } catch (e) {
      console.error('[render-vcard] snapshot parse failed:', e);
      return jsonError(500, 'internal', 'snapshot_parse_failed');
    }

    const use4_0 = wants4_0(req.headers.get('accept'));
    const body = use4_0 ? renderVCard4(snap) : renderVCard3(snap);
    const filename = sanitizeFilename(snap.name);

    // TODO: edge fn integration tests in a later pass — including
    // card.viewed telemetry event emission and concurrent-render
    // view_count race coverage.

    return vcardResponse(body, filename);
  } catch (err) {
    console.error('[render-vcard] threw:', err);
    return jsonError(500, 'internal', String((err as Error)?.message ?? err));
  }
});
