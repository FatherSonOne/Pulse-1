// Supabase Edge Function: resolve-card-deeplink
//
// Phase C — public landing-page renderer for /c/{token} URLs.
// No auth required; runs as service role internally.
//
// Adversarial Adam defense (magi D-1):
//   - sender display name comes from a SERVER-SIDE JOIN to
//     auth.users, NEVER from URL params or request body.
//   - Extra URL params are silently ignored; never echoed to HTML.
//   - Strong CSP headers (default-src 'self', no unsafe-inline).
//
// HTTP semantics:
//   200  — server-rendered HTML landing page
//   410  — revoked / expired / consumed / blocked-sender (generic body)
//   404  — token never existed
//   500  — DB error / snapshot deserialization failure

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PUBLIC_CARD_BASE_URL =
  Deno.env.get('PUBLIC_CARD_BASE_URL') ??
  'https://go.pulse.logosvision.org/c';

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

// ─── HTTP / CSP headers ──────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// CSP per magi D-1 — no inline script execution; everything is
// statically rendered server-side.
const securityHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'self'; frame-ancestors 'none';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

function htmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      ...securityHeaders,
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

// ─── HTML helpers ────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function gonePage(): string {
  // Generic body — no sender name, no card-subject fields.
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Contact card unavailable</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; color: #1a1a1a; margin: 0; padding: 40px 20px; max-width: 480px; margin-left: auto; margin-right: auto; }
  h1 { font-size: 20px; font-weight: 600; margin: 0 0 8px 0; }
  p { color: #6b6b6b; margin: 0; line-height: 1.5; }
</style>
</head><body>
  <h1>Contact card unavailable</h1>
  <p>This contact card is no longer available.</p>
</body></html>`;
}

function notFoundPage(): string {
  // Distinct copy from 410 so an enumerating attacker still has to
  // pay the round-trip cost, but the message itself is benign.
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Not found</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; color: #1a1a1a; margin: 0; padding: 40px 20px; max-width: 480px; margin-left: auto; margin-right: auto; }
  h1 { font-size: 20px; font-weight: 600; margin: 0 0 8px 0; }
  p { color: #6b6b6b; margin: 0; line-height: 1.5; }
</style>
</head><body>
  <h1>Not found</h1>
  <p>No contact card matches this link.</p>
</body></html>`;
}

function renderLandingPage(args: {
  cardId: string;
  snap: CardSnapshot;
  introNote: string | null;
  senderDisplay: string;
  forwarderDisplay: string | null;
  rootSenderDisplay: string | null;
  isForwarded: boolean;
}): string {
  const { cardId, snap, introNote, senderDisplay, forwarderDisplay, rootSenderDisplay, isForwarded } =
    args;

  const safeName = escapeHtml(snap.name); // braces / # pass through, < > & quoted
  const safeSender = escapeHtml(senderDisplay);
  const safeIntro = introNote ? escapeHtml(introNote) : '';

  // Provenance line (R-15).
  const provenance =
    isForwarded && forwarderDisplay && rootSenderDisplay
      ? `<p class="prov">${escapeHtml(forwarderDisplay)} is forwarding a contact card originally shared by ${escapeHtml(rootSenderDisplay)}.</p>`
      : '';

  // Card fields. Whitelist-mirror — only safe-snapshot fields.
  const fields: string[] = [];
  if (snap.title) fields.push(`<dt>Title</dt><dd>${escapeHtml(snap.title)}</dd>`);
  if (snap.company) fields.push(`<dt>Company</dt><dd>${escapeHtml(snap.company)}</dd>`);
  if (snap.phone) fields.push(`<dt>Phone</dt><dd>${escapeHtml(snap.phone)}</dd>`);
  if (snap.email) fields.push(`<dt>Email</dt><dd>${escapeHtml(snap.email)}</dd>`);
  if (snap.address) fields.push(`<dt>Address</dt><dd>${escapeHtml(snap.address)}</dd>`);
  const fieldsBlock = fields.length > 0 ? `<dl>${fields.join('')}</dl>` : '';

  const introBlock = safeIntro
    ? `<blockquote class="intro">${safeIntro}</blockquote>`
    : '';

  const vcardUrl = `/functions/v1/render-contact-vcard?token=${encodeURIComponent(cardId)}`;

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeName} — Contact card on Pulse</title>
<meta name="apple-itunes-app" content="app-id=pulse" />
<meta property="og:title" content="${safeName} on Pulse" />
<meta property="og:description" content="${safeSender} shared a contact card with you." />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; color: #1a1a1a; margin: 0; padding: 32px 20px; max-width: 520px; margin-left: auto; margin-right: auto; line-height: 1.5; }
  .header { color: #6b6b6b; font-size: 14px; margin-bottom: 24px; }
  h1 { font-size: 28px; font-weight: 600; margin: 0 0 24px 0; }
  .prov { color: #6b6b6b; font-size: 13px; margin: 0 0 16px 0; }
  .intro { background: #f4f4f4; border-left: 3px solid #c0c0c0; margin: 16px 0; padding: 12px 16px; font-style: italic; color: #4a4a4a; }
  dl { margin: 16px 0; }
  dt { font-weight: 600; font-size: 13px; color: #6b6b6b; margin-top: 12px; }
  dd { margin: 4px 0 0 0; font-size: 16px; }
  .cta-row { display: flex; flex-direction: column; gap: 12px; margin-top: 32px; }
  .cta { display: block; padding: 14px 20px; border-radius: 12px; text-align: center; font-weight: 600; text-decoration: none; }
  .cta-primary { background: #1a1a1a; color: #ffffff; }
  .cta-secondary { background: #f4f4f4; color: #1a1a1a; }
  .footer { color: #8a8a8a; font-size: 12px; margin-top: 40px; text-align: center; }
</style>
</head><body>
  <div class="header">${safeSender} shared a contact card with you.</div>
  ${provenance}
  <h1>${safeName}</h1>
  ${introBlock}
  ${fieldsBlock}
  <div class="cta-row">
    <a class="cta cta-primary" href="${vcardUrl}">Save to Contacts</a>
    <a class="cta cta-secondary" href="https://pulse.logosvision.org/get">Get Pulse</a>
  </div>
  <p class="footer">Sent via Pulse</p>
</body></html>`;
}

// ─── Sender display resolver ─────────────────────────────────────────

async function resolveSenderDisplayName(
  admin: ReturnType<typeof createClient>,
  senderUserId: string,
): Promise<string> {
  try {
    const { data: u, error } = await admin.auth.admin.getUserById(senderUserId);
    if (error || !u?.user) return 'A Pulse user';
    const meta = (u.user.user_metadata ?? {}) as Record<string, unknown>;
    const candidates = [
      typeof meta.full_name === 'string' ? meta.full_name : null,
      typeof meta.display_name === 'string' ? meta.display_name : null,
      typeof meta.name === 'string' ? meta.name : null,
    ].filter((s): s is string => !!s && s.length > 0);
    if (candidates.length > 0) return candidates[0];
    if (typeof u.user.email === 'string' && u.user.email.length > 0) {
      return u.user.email.split('@')[0];
    }
    return 'A Pulse user';
  } catch {
    return 'A Pulse user';
  }
}

// ─── Main handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Token extraction — path-suffix or ?token= query or POST body.
    // URL params other than `token` are silently ignored (D-1).
    const url = new URL(req.url);
    let token: string | null = null;
    const pathMatch = url.pathname.match(
      /resolve-card-deeplink\/([0-9a-fA-F-]{36})$/,
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
      return htmlResponse(notFoundPage(), 404);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: card, error: cardErr } = await admin
      .from('contact_cards')
      .select(
        'id, sender_user_id, recipient_user_id, card_snapshot, intro_note, token_policy, revoked_at, expires_at, consumed_at, forwarded_from_card_id',
      )
      .eq('id', token)
      .maybeSingle();

    if (cardErr) {
      console.error('[resolve-deeplink] card fetch error:', cardErr);
      return new Response(JSON.stringify({ error: 'internal' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!card) {
      return htmlResponse(notFoundPage(), 404);
    }

    // ── Validity gates (410 for revoked/expired/consumed/blocked) ────
    if (card.revoked_at) return htmlResponse(gonePage(), 410);
    if (card.expires_at && new Date(card.expires_at) < new Date()) {
      return htmlResponse(gonePage(), 410);
    }
    if (card.token_policy === 'single_use' && card.consumed_at) {
      return htmlResponse(gonePage(), 410);
    }
    if (card.recipient_user_id) {
      const { data: block } = await admin
        .from('card_send_blocks')
        .select('blocked_by_user_id')
        .eq('blocked_by_user_id', card.recipient_user_id)
        .eq('sender_user_id', card.sender_user_id)
        .maybeSingle();
      if (block) return htmlResponse(gonePage(), 410);
    }

    // ── Atomic view_count increment ──────────────────────────────────
    const { error: bumpErr } = await admin.rpc('increment_contact_card_view_count', {
      p_card_id: card.id,
    });
    if (bumpErr) {
      // NOTE: see render-contact-vcard — same fallback rationale.
      const { error: fallbackErr } = await admin
        .from('contact_cards')
        .update({ view_count: ((card as { view_count?: number }).view_count ?? 0) + 1 })
        .eq('id', card.id);
      if (fallbackErr) {
        console.error('[resolve-deeplink] view_count update failed:', fallbackErr);
      }
    }

    // ── Resolve sender + forwarding chain ────────────────────────────
    const senderDisplay = await resolveSenderDisplayName(admin, card.sender_user_id);

    let forwarderDisplay: string | null = null;
    let rootSenderDisplay: string | null = null;
    const isForwarded = !!card.forwarded_from_card_id;

    if (isForwarded) {
      // Immediate sender is the current card's sender (this is the
      // person who hit Forward). Root sender is the chain root.
      forwarderDisplay = senderDisplay;

      // Walk to root via recursive lookups. Capped at depth=10 to
      // bound runtime even for adversarial chains.
      // NOTE: a single WITH RECURSIVE SQL query would be cleaner but
      // PostgREST doesn't expose CTEs ergonomically. 10 round-trips
      // is acceptable since landing-page renders are cheap (cached
      // via Universal Link / App Link warm-paths anyway).
      let currentParentId: string | null = card.forwarded_from_card_id;
      let rootSenderUserId: string | null = null;
      let depth = 0;
      while (currentParentId && depth < 10) {
        const { data: parent, error: parentErr } = await admin
          .from('contact_cards')
          .select('sender_user_id, forwarded_from_card_id')
          .eq('id', currentParentId)
          .maybeSingle();
        if (parentErr || !parent) break;
        rootSenderUserId = parent.sender_user_id;
        currentParentId = parent.forwarded_from_card_id;
        depth++;
      }
      if (rootSenderUserId) {
        rootSenderDisplay = await resolveSenderDisplayName(admin, rootSenderUserId);
      }
    }

    // ── Render ───────────────────────────────────────────────────────
    let snap: CardSnapshot;
    try {
      snap = card.card_snapshot as CardSnapshot;
      if (!snap || typeof snap.name !== 'string') {
        throw new Error('invalid_snapshot_shape');
      }
    } catch (e) {
      console.error('[resolve-deeplink] snapshot parse failed:', e);
      return new Response(JSON.stringify({ error: 'internal' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = renderLandingPage({
      cardId: card.id,
      snap,
      introNote: typeof card.intro_note === 'string' ? card.intro_note : null,
      senderDisplay,
      forwarderDisplay,
      rootSenderDisplay,
      isForwarded,
    });

    // TODO: edge fn integration tests in a later pass — including
    // card.viewed telemetry event + the Adversarial Adam URL-param
    // injection test (AC-10-3).

    // Reference PUBLIC_CARD_BASE_URL to keep the env-derived value
    // observable in logs even when we don't echo it into HTML.
    if (Deno.env.get('PULSE_DEBUG_LANDING') === '1') {
      console.log(`[resolve-deeplink] base=${PUBLIC_CARD_BASE_URL} card=${card.id}`);
    }

    return htmlResponse(html, 200);
  } catch (err) {
    console.error('[resolve-deeplink] threw:', err);
    return new Response(
      JSON.stringify({ error: 'internal', details: String((err as Error)?.message ?? err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
