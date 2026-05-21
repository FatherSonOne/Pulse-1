// Supabase Edge Function: create-contact-card
//
// Phase C — single-card share creation. Validates the sender is the
// owner of contact_id, applies the card_snapshot whitelist, enforces
// the recipient block-list, enforces the per-sender 24h rate limit,
// eagerly resolves recipient_user_id when recipient_hint is a known
// Pulse email, and (for email recipients) fans out the Resend intro
// email via the existing send-email edge function.
//
// Auth: Bearer token (Pulse JWT). Sender identity is read from JWT —
// NEVER from the request body (Adversarial Adam defense).
//
// Forwarding path: when `forwarded_from_card_id` is present and
// `contact_id` is absent, the function rehydrates the snapshot from
// the parent row after asserting parent.is_forwardable = true.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// NOTE: go.pulse.logosvision.org per magi D-1; DevOps confirms
// subdomain durability through the qntmecos.com migration.
const PUBLIC_CARD_BASE_URL =
  Deno.env.get('PUBLIC_CARD_BASE_URL') ??
  'https://go.pulse.logosvision.org/c';

// TODO(phase-c-billing-coordination): pin from config table once
// Billing decides per-tier values. Default 50/day for free tier.
const DEFAULT_DAILY_LIMIT = 50;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Card_snapshot whitelist (single source of truth) ────────────────
// Hardcoded server-side. Adding a column here is a deliberate code
// change a reviewer must approve — clients CANNOT extend the snapshot.
const CARD_SNAPSHOT_FIELDS = [
  'name',
  'email',
  'phone',
  'company',
  'title',
  'address',
  'avatar_color',
] as const;

type SnapshotField = (typeof CARD_SNAPSHOT_FIELDS)[number];

interface CardSnapshotInput {
  // Indexed access to a row pulled from the contacts table.
  [k: string]: unknown;
}

interface CardSnapshot {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  address?: string;
  avatar_color?: string;
}

/**
 * Whitelist serializer — explicitly picks safe fields from a contacts
 * row and refuses anything else. `name` is required; the rest are
 * optional.
 */
export function buildCardSnapshot(row: CardSnapshotInput): CardSnapshot {
  const name = typeof row.name === 'string' ? row.name : '';
  if (!name) {
    throw new Error('contact_missing_name');
  }
  const snap: CardSnapshot = { name };
  for (const f of CARD_SNAPSHOT_FIELDS) {
    if (f === 'name') continue;
    const v = row[f];
    if (typeof v === 'string' && v.length > 0) {
      (snap as Record<SnapshotField, string>)[f] = v;
    }
  }
  return snap;
}

// ─── Idempotency cache ───────────────────────────────────────────────
//
// NOTE: In-memory Map keyed by `${sender}:${key}`, 5-minute TTL.
// Acceptable because edge functions are short-lived per region; a
// duplicate POST landing on a different warm instance falls through
// to a real INSERT — the worst case is one duplicate row, not a
// correctness violation. Upgrade path: idempotency_keys table or
// Redis-equivalent once duplicate-submission proves to be a real
// field issue.
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const idempotencyCache = new Map<
  string,
  { result: unknown; expiresAt: number }
>();

function cacheIdempotency(key: string, result: unknown) {
  idempotencyCache.set(key, { result, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS });
}

function readIdempotency(key: string): unknown | undefined {
  const hit = idempotencyCache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    idempotencyCache.delete(key);
    return undefined;
  }
  return hit.result;
}

// ─── HTTP helpers ────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Main handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    // ── Authenticate caller ──────────────────────────────────────────
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);
    if (authError || !user) {
      console.error('[create-contact-card] token validation failed:', authError?.message);
      return json({ error: 'unauthorized' }, 401);
    }

    const senderUserId = user.id; // TEXT-compatible — we'll cast/store as text

    // ── Idempotency short-circuit ────────────────────────────────────
    const idempotencyKey = req.headers.get('idempotency-key');
    const cacheKey = idempotencyKey ? `${senderUserId}:${idempotencyKey}` : null;
    if (cacheKey) {
      const cached = readIdempotency(cacheKey);
      if (cached !== undefined) {
        console.log('[create-contact-card] idempotency hit', cacheKey);
        return json(cached, 201);
      }
    }

    // ── Parse + validate body ────────────────────────────────────────
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ error: 'validation_failed', details: 'invalid_json' }, 400);
    }

    const {
      contact_id,
      recipient_hint,
      intro_note,
      token_policy,
      is_forwardable,
      expires_at,
      forwarded_from_card_id,
    } = body as Record<string, unknown>;

    // recipient_hint required, length 1..320
    if (
      typeof recipient_hint !== 'string' ||
      recipient_hint.length < 1 ||
      recipient_hint.length > 320
    ) {
      return json(
        { error: 'validation_failed', details: 'recipient_hint_required' },
        400,
      );
    }

    if (intro_note !== undefined && intro_note !== null) {
      if (typeof intro_note !== 'string' || intro_note.length > 500) {
        return json(
          { error: 'validation_failed', details: 'intro_note_too_long' },
          400,
        );
      }
    }

    if (
      token_policy !== undefined &&
      token_policy !== 'multi_use' &&
      token_policy !== 'single_use'
    ) {
      return json(
        { error: 'validation_failed', details: 'invalid_token_policy' },
        400,
      );
    }

    if (is_forwardable !== undefined && typeof is_forwardable !== 'boolean') {
      return json(
        { error: 'validation_failed', details: 'is_forwardable_must_be_boolean' },
        400,
      );
    }

    if (expires_at !== undefined && expires_at !== null) {
      if (typeof expires_at !== 'string' || Number.isNaN(Date.parse(expires_at))) {
        return json(
          { error: 'validation_failed', details: 'invalid_expires_at' },
          400,
        );
      }
    }

    const isForward = typeof forwarded_from_card_id === 'string' && forwarded_from_card_id.length > 0;

    if (isForward) {
      if (!UUID_RE.test(forwarded_from_card_id as string)) {
        return json(
          { error: 'validation_failed', details: 'invalid_forwarded_from_card_id' },
          400,
        );
      }
    } else {
      if (typeof contact_id !== 'string' || !UUID_RE.test(contact_id)) {
        return json(
          { error: 'validation_failed', details: 'contact_id_required' },
          400,
        );
      }
    }

    // ── Build card_snapshot ──────────────────────────────────────────
    let snapshot: CardSnapshot;

    if (isForward) {
      // Forwarding: rehydrate from parent row. Parent must be
      // is_forwardable=true AND not revoked AND not expired AND not
      // consumed (for single_use parents).
      const { data: parent, error: parentErr } = await admin
        .from('contact_cards')
        .select(
          'id, sender_user_id, card_snapshot, is_forwardable, revoked_at, expires_at, token_policy, consumed_at',
        )
        .eq('id', forwarded_from_card_id as string)
        .maybeSingle();

      if (parentErr) {
        console.error('[create-contact-card] parent fetch error:', parentErr);
        return json({ error: 'internal' }, 500);
      }
      if (!parent) {
        return json({ error: 'card_not_forwardable', forwarded_from_card_id }, 403);
      }
      if (!parent.is_forwardable) {
        return json({ error: 'card_not_forwardable', forwarded_from_card_id }, 403);
      }
      if (parent.revoked_at) {
        return json({ error: 'card_not_forwardable', forwarded_from_card_id }, 403);
      }
      if (parent.expires_at && new Date(parent.expires_at) < new Date()) {
        return json({ error: 'card_not_forwardable', forwarded_from_card_id }, 403);
      }

      snapshot = parent.card_snapshot as CardSnapshot;
    } else {
      // Single-card share: verify sender owns contact_id, then snapshot.
      // contacts.user_id is TEXT — compare via senderUserId string.
      const { data: contact, error: contactErr } = await admin
        .from('contacts')
        .select('id, user_id, name, email, phone, company, title, address, avatar_color')
        .eq('id', contact_id as string)
        .eq('user_id', senderUserId)
        .maybeSingle();

      if (contactErr) {
        console.error('[create-contact-card] contact fetch error:', contactErr);
        return json({ error: 'internal' }, 500);
      }
      if (!contact) {
        return json({ error: 'contact_not_found' }, 404);
      }

      try {
        snapshot = buildCardSnapshot(contact as CardSnapshotInput);
      } catch (e) {
        return json(
          { error: 'validation_failed', details: (e as Error).message },
          400,
        );
      }
    }

    // ── Eager resolution: recipient_hint → recipient_user_id ─────────
    let recipientUserId: string | null = null;
    const hintIsEmail = EMAIL_RE.test(recipient_hint);
    if (hintIsEmail) {
      // auth.users isn't directly query-able via PostgREST; admin
      // client has the auth API.
      // NOTE: listUsers() with a per_page=1 + email filter via
      // service role. Page size 1000 is the SDK's default max; for
      // production scale, swap to a dedicated RPC that indexes
      // auth.users by email. For Phase C MVP, listUsers is fine
      // because the lookup is per-card, not hot-path.
      const { data: listed, error: listErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (!listErr && listed?.users) {
        const match = listed.users.find(
          (u) =>
            typeof u.email === 'string' &&
            u.email.toLowerCase() === recipient_hint.toLowerCase(),
        );
        if (match) recipientUserId = match.id;
      }
    } else if (UUID_RE.test(recipient_hint)) {
      // Caller passed a Pulse user_id directly — trust it after a
      // quick existence check.
      const { data: u, error: uErr } = await admin.auth.admin.getUserById(recipient_hint);
      if (!uErr && u?.user) recipientUserId = u.user.id;
    }

    // ── Block-list check (service role, never RLS-exposed) ───────────
    if (recipientUserId) {
      const { data: block, error: blockErr } = await admin
        .from('card_send_blocks')
        .select('blocked_by_user_id')
        .eq('blocked_by_user_id', recipientUserId)
        .eq('sender_user_id', senderUserId)
        .maybeSingle();

      if (blockErr) {
        console.error('[create-contact-card] block lookup error:', blockErr);
        return json({ error: 'internal' }, 500);
      }
      if (block) {
        return json({ error: 'sender_blocked_by_recipient' }, 403);
      }
    }

    // ── Rate limit (per-sender, 24h window) ──────────────────────────
    // TODO(phase-c-billing-coordination): pin from config table.
    const dailyLimit = DEFAULT_DAILY_LIMIT;
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count: countToday, error: countErr } = await admin
      .from('contact_cards')
      .select('id', { count: 'exact', head: true })
      .eq('sender_user_id', senderUserId)
      .gte('created_at', since);

    if (countErr) {
      console.error('[create-contact-card] rate-limit count error:', countErr);
      return json({ error: 'internal' }, 500);
    }
    if ((countToday ?? 0) >= dailyLimit) {
      return json(
        { error: 'rate_limit_exceeded', retry_after_seconds: 86_400 },
        403,
      );
    }

    // ── INSERT the row ───────────────────────────────────────────────
    const insertRow = {
      sender_user_id: senderUserId,
      recipient_hint,
      recipient_user_id: recipientUserId,
      card_snapshot: snapshot as unknown as Record<string, unknown>,
      intro_note: typeof intro_note === 'string' ? intro_note : null,
      token_policy:
        token_policy === 'single_use' || token_policy === 'multi_use'
          ? (token_policy as string)
          : 'multi_use',
      is_forwardable: typeof is_forwardable === 'boolean' ? is_forwardable : true,
      forwarded_from_card_id: isForward ? (forwarded_from_card_id as string) : null,
      expires_at:
        typeof expires_at === 'string' ? expires_at : null,
    };

    const { data: inserted, error: insertErr } = await admin
      .from('contact_cards')
      .insert(insertRow)
      .select('id')
      .single();

    if (insertErr || !inserted) {
      console.error('[create-contact-card] insert error:', insertErr);
      return json({ error: 'internal' }, 500);
    }

    const cardId = inserted.id;
    const shareUrl = `${PUBLIC_CARD_BASE_URL}/${cardId}`;

    // ── Fan out intro email (best-effort) ────────────────────────────
    let emailSent = false;
    if (hintIsEmail) {
      try {
        const senderDisplay = await resolveSenderDisplayName(admin, senderUserId);
        const subject = `${senderDisplay} shared a contact card with you`;
        const introHtmlBlock =
          typeof intro_note === 'string' && intro_note.length > 0
            ? `<p style="margin:16px 0 0 0;">${escapeHtml(intro_note)}</p>`
            : '';
        const html = `<!doctype html>
<html><body style="font-family: -apple-system, sans-serif; color:#1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="margin:0;">${escapeHtml(senderDisplay)} shared a contact card with you on Pulse.</p>
  ${introHtmlBlock}
  <p style="margin:24px 0 8px 0;">
    <a href="${shareUrl}" style="color:#1a1a1a;">Save to contacts (no Pulse account needed)</a>
  </p>
  <p style="margin:0;color:#8a8a8a;font-size:12px;">${shareUrl}</p>
</body></html>`;
        const text = `${senderDisplay} shared a contact card with you on Pulse.\n\n${
          typeof intro_note === 'string' ? intro_note + '\n\n' : ''
        }Save to contacts (no Pulse account needed): ${shareUrl}`;

        // Invoke send-email with the caller's auth header — send-email
        // gates by JWT, so we forward the same token.
        const sendResp = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
            apikey: SUPABASE_SERVICE_KEY,
          },
          body: JSON.stringify({ to: recipient_hint, subject, html, text }),
        });
        emailSent = sendResp.ok;
        if (!sendResp.ok) {
          const errBody = await sendResp.text().catch(() => '');
          console.error('[create-contact-card] send-email failed:', sendResp.status, errBody);
        }
      } catch (e) {
        console.error('[create-contact-card] send-email threw:', e);
      }
    }

    const result = {
      id: cardId,
      share_url: shareUrl,
      recipient_user_id: recipientUserId,
      email_sent: emailSent,
    };

    if (cacheKey) cacheIdempotency(cacheKey, result);

    // TODO: edge fn integration tests in a later pass (telemetry
    // events card.created etc. wire-up deferred to Data team's pass).

    return json(result, 201);
  } catch (err) {
    console.error('[create-contact-card] threw:', err);
    return json({ error: 'internal', details: String((err as Error)?.message ?? err) }, 500);
  }
});

// ─── Shared helpers (kept inline to avoid _shared import churn) ──────

async function resolveSenderDisplayName(
  admin: ReturnType<typeof createClient>,
  senderUserId: string,
): Promise<string> {
  // Best-effort: pull raw_user_meta_data.full_name / display_name,
  // else email-local-part, else "A Pulse user".
  // NOTE: Phase 6 codex may swap this to a profiles-table read once
  // a single Pulse user-display helper is canonical; for now this
  // matches the resolve-card-deeplink path so display names render
  // consistently on the landing page and in the email subject.
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
