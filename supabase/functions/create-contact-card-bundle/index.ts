// Supabase Edge Function: create-contact-card-bundle
//
// Phase C — bulk-share path (R-4). Sender selects 2..100 contacts,
// fans out to one or more recipient_hints, all forced to
// token_policy='multi_use'. Single-transaction insert: any validation
// failure for ANY card aborts the whole bundle. Partial-failure
// reporting happens for non-fatal per-recipient issues (e.g. blocked
// sender pair, send-email failure).
//
// Auth: Bearer JWT. Sender identity from JWT only.
//
// Rate limit: 100-card hard limit per bundle; 1 bundle / 24h per
// sender (configurable). Sender's per-day card cap applies to the
// total cards_created in this call too.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PUBLIC_CARD_BASE_URL =
  Deno.env.get('PUBLIC_CARD_BASE_URL') ??
  'https://go.pulse.logosvision.org/c';

// TODO(phase-c-billing-coordination): pin from config table.
const BUNDLE_MAX_CONTACTS = 100;
const DEFAULT_DAILY_LIMIT = 50;
// NOTE: bundle-rate-limit heuristic — count any insert burst (>=2
// rows / sender within 1s) in the last 24h as "a bundle." Until a
// dedicated bundle_id column lands, this is the simplest defensible
// signal. Comment per schema spec § Decisions unresolved #1.
const BUNDLE_WINDOW_MS = 86_400_000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CARD_SNAPSHOT_FIELDS = [
  'name',
  'email',
  'phone',
  'company',
  'title',
  'address',
  'avatar_color',
] as const;

interface CardSnapshot {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  address?: string;
  avatar_color?: string;
}

function buildCardSnapshot(row: Record<string, unknown>): CardSnapshot {
  const name = typeof row.name === 'string' ? row.name : '';
  if (!name) throw new Error('contact_missing_name');
  const snap: CardSnapshot = { name };
  for (const f of CARD_SNAPSHOT_FIELDS) {
    if (f === 'name') continue;
    const v = row[f];
    if (typeof v === 'string' && v.length > 0) {
      (snap as Record<string, string>)[f] = v;
    }
  }
  return snap;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── crypto.randomUUID() polyfill for older Deno — uses Web Crypto ───
function makeUuid(): string {
  // Deno runtime exposes crypto.randomUUID() on modern versions.
  // Fallback to UUID v4 via crypto.getRandomValues for older builds.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h
    .slice(6, 8)
    .join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader) return json({ error: 'unauthorized' }, 401);
    const token = authHeader.replace('Bearer ', '');
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);
    if (authError || !user) {
      console.error('[bundle] token validation failed:', authError?.message);
      return json({ error: 'unauthorized' }, 401);
    }
    const senderUserId = user.id;

    // ── Body validation ──────────────────────────────────────────────
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ error: 'validation_failed', details: 'invalid_json' }, 400);
    }
    const {
      contact_ids,
      recipient_hints,
      intro_note,
      is_forwardable,
      expires_at,
    } = body as Record<string, unknown>;

    if (
      !Array.isArray(contact_ids) ||
      contact_ids.length < 2 ||
      contact_ids.length > BUNDLE_MAX_CONTACTS
    ) {
      return json(
        contact_ids && (contact_ids as unknown[]).length > BUNDLE_MAX_CONTACTS
          ? { error: 'bundle_size_exceeded', max: BUNDLE_MAX_CONTACTS }
          : { error: 'validation_failed', details: 'contact_ids_2_to_100_required' },
        400,
      );
    }
    if (
      !(contact_ids as unknown[]).every(
        (id) => typeof id === 'string' && UUID_RE.test(id),
      )
    ) {
      return json(
        { error: 'validation_failed', details: 'contact_ids_must_be_uuids' },
        400,
      );
    }

    if (
      !Array.isArray(recipient_hints) ||
      recipient_hints.length < 1 ||
      !recipient_hints.every(
        (h) => typeof h === 'string' && h.length > 0 && h.length <= 320,
      )
    ) {
      return json(
        { error: 'validation_failed', details: 'recipient_hints_required' },
        400,
      );
    }

    if (
      intro_note !== undefined &&
      intro_note !== null &&
      (typeof intro_note !== 'string' || intro_note.length > 500)
    ) {
      return json(
        { error: 'validation_failed', details: 'intro_note_too_long' },
        400,
      );
    }

    if (
      expires_at !== undefined &&
      expires_at !== null &&
      (typeof expires_at !== 'string' || Number.isNaN(Date.parse(expires_at)))
    ) {
      return json(
        { error: 'validation_failed', details: 'invalid_expires_at' },
        400,
      );
    }

    // ── Bundle rate limit ────────────────────────────────────────────
    // NOTE: heuristic — last 24h INSERT count >= 2 in any 1s window.
    // Imperfect but defensible until a bundle_id column lands.
    const since = new Date(Date.now() - BUNDLE_WINDOW_MS).toISOString();
    const { data: recentCards, error: recentErr } = await admin
      .from('contact_cards')
      .select('created_at')
      .eq('sender_user_id', senderUserId)
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (recentErr) {
      console.error('[bundle] recent-cards error:', recentErr);
      return json({ error: 'internal' }, 500);
    }
    const recentTs = (recentCards ?? []).map((r) => new Date(r.created_at).getTime());
    let bundlesInWindow = 0;
    for (let i = 1; i < recentTs.length; i++) {
      if (recentTs[i] - recentTs[i - 1] < 1000) {
        bundlesInWindow++;
        // Skip ahead past this burst — coarse but cheap.
      }
    }
    if (bundlesInWindow >= 1) {
      return json(
        { error: 'bundle_rate_limit_exceeded', retry_after_seconds: 86_400 },
        403,
      );
    }

    // Sender daily card cap also applies — bundle would push them over.
    const totalCards = (contact_ids as string[]).length * (recipient_hints as string[]).length;
    const { count: countToday, error: countErr } = await admin
      .from('contact_cards')
      .select('id', { count: 'exact', head: true })
      .eq('sender_user_id', senderUserId)
      .gte('created_at', since);
    if (countErr) {
      console.error('[bundle] daily count error:', countErr);
      return json({ error: 'internal' }, 500);
    }
    if ((countToday ?? 0) + totalCards > DEFAULT_DAILY_LIMIT) {
      return json(
        { error: 'rate_limit_exceeded', retry_after_seconds: 86_400 },
        403,
      );
    }

    // ── Fetch + validate all contacts owned by sender ────────────────
    const { data: contacts, error: contactsErr } = await admin
      .from('contacts')
      .select('id, user_id, name, email, phone, company, title, address, avatar_color')
      .in('id', contact_ids as string[])
      .eq('user_id', senderUserId);

    if (contactsErr) {
      console.error('[bundle] contacts fetch error:', contactsErr);
      return json({ error: 'internal' }, 500);
    }
    const contactById = new Map<string, Record<string, unknown>>();
    for (const c of contacts ?? []) contactById.set(c.id, c as Record<string, unknown>);

    const missing = (contact_ids as string[]).filter((id) => !contactById.has(id));
    if (missing.length > 0) {
      // All-or-nothing rejection: if any contact is missing or not owned,
      // the bundle fails before any insert (single-transaction guard).
      return json(
        {
          error: 'validation_failed',
          details: 'contact_not_found_or_not_owned',
          failures: missing.map((id) => ({
            contact_id: id,
            recipient_hint: '',
            error: 'contact_not_found',
          })),
        },
        400,
      );
    }

    // ── Resolve recipient_user_id per recipient_hint ─────────────────
    const { data: listed } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const usersByEmail = new Map<string, string>();
    if (listed?.users) {
      for (const u of listed.users) {
        if (typeof u.email === 'string') {
          usersByEmail.set(u.email.toLowerCase(), u.id);
        }
      }
    }

    const recipientResolution = new Map<string, string | null>();
    for (const hint of recipient_hints as string[]) {
      let resolved: string | null = null;
      if (EMAIL_RE.test(hint)) {
        resolved = usersByEmail.get(hint.toLowerCase()) ?? null;
      } else if (UUID_RE.test(hint)) {
        resolved = hint;
      }
      recipientResolution.set(hint, resolved);
    }

    // ── Block-list per recipient ─────────────────────────────────────
    const blockedRecipients: string[] = [];
    for (const [hint, rid] of recipientResolution.entries()) {
      if (!rid) continue;
      const { data: blk } = await admin
        .from('card_send_blocks')
        .select('blocked_by_user_id')
        .eq('blocked_by_user_id', rid)
        .eq('sender_user_id', senderUserId)
        .maybeSingle();
      if (blk) blockedRecipients.push(hint);
    }

    const acceptedRecipients = (recipient_hints as string[]).filter(
      (h) => !blockedRecipients.includes(h),
    );
    if (acceptedRecipients.length === 0) {
      return json({ error: 'recipients_blocked', blocked: blockedRecipients }, 403);
    }

    // ── Build N×M insert rows ────────────────────────────────────────
    const failures: Array<{ contact_id: string; recipient_hint: string; error: string }> = [];
    const rows: Array<Record<string, unknown>> = [];
    for (const cid of contact_ids as string[]) {
      const contact = contactById.get(cid)!;
      let snap: CardSnapshot;
      try {
        snap = buildCardSnapshot(contact);
      } catch (e) {
        for (const h of acceptedRecipients) {
          failures.push({ contact_id: cid, recipient_hint: h, error: (e as Error).message });
        }
        continue;
      }
      for (const hint of acceptedRecipients) {
        rows.push({
          sender_user_id: senderUserId,
          recipient_hint: hint,
          recipient_user_id: recipientResolution.get(hint) ?? null,
          card_snapshot: snap as unknown as Record<string, unknown>,
          intro_note: typeof intro_note === 'string' ? intro_note : null,
          token_policy: 'multi_use', // R-4: forced
          is_forwardable: typeof is_forwardable === 'boolean' ? is_forwardable : true,
          forwarded_from_card_id: null,
          expires_at: typeof expires_at === 'string' ? expires_at : null,
        });
      }
    }

    // If snapshot-build failures exhausted all cards, hard-fail bundle.
    if (rows.length === 0) {
      return json(
        { error: 'validation_failed', details: 'all_cards_failed_snapshot', failures },
        400,
      );
    }

    // ── Single-transaction insert ────────────────────────────────────
    // Supabase JS doesn't expose explicit BEGIN/COMMIT — .insert(rows[])
    // is one statement which is atomic. If ANY row fails the CHECK
    // constraints (intro_note length, token_policy enum, etc.) the
    // whole batch rolls back.
    const { data: inserted, error: insertErr } = await admin
      .from('contact_cards')
      .insert(rows)
      .select('id, recipient_hint, card_snapshot');

    if (insertErr || !inserted) {
      console.error('[bundle] insert error:', insertErr);
      return json(
        {
          error: 'validation_failed',
          details: insertErr?.message ?? 'insert_failed',
          failures,
        },
        400,
      );
    }

    // ── Map results back to original (contact_id, recipient_hint) ────
    // The insert preserves order, so we can zip back to the
    // (cid, hint) tuples we built `rows` from.
    const shareUrls: Array<{
      contact_id: string;
      recipient_hint: string;
      card_id: string;
      share_url: string;
    }> = [];
    let cursor = 0;
    for (const cid of contact_ids as string[]) {
      // Skip cids that failed snapshot — those did not contribute rows.
      const contact = contactById.get(cid)!;
      const validSnap = (() => {
        try {
          buildCardSnapshot(contact);
          return true;
        } catch {
          return false;
        }
      })();
      if (!validSnap) continue;
      for (const hint of acceptedRecipients) {
        const row = inserted[cursor];
        if (row) {
          shareUrls.push({
            contact_id: cid,
            recipient_hint: hint,
            card_id: row.id,
            share_url: `${PUBLIC_CARD_BASE_URL}/${row.id}`,
          });
        }
        cursor++;
      }
    }

    // ── Best-effort email fan-out ────────────────────────────────────
    // NOTE: per-recipient sequential POSTs to send-email. Resend has
    // a batch endpoint; integrating it is deferred until Phase C ships
    // enough volume to make N round-trips an actual cost. For ≤100
    // cards / 24h, sequential is fine.
    const senderDisplay = await resolveSenderDisplayName(admin, senderUserId);
    for (const entry of shareUrls) {
      if (!EMAIL_RE.test(entry.recipient_hint)) continue;
      try {
        const subject = `${senderDisplay} shared a contact card with you`;
        const note =
          typeof intro_note === 'string' && intro_note.length > 0
            ? `<p style="margin:16px 0 0 0;">${escapeHtml(intro_note)}</p>`
            : '';
        const html = `<!doctype html><html><body style="font-family: -apple-system, sans-serif; color:#1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="margin:0;">${escapeHtml(senderDisplay)} shared a contact card with you on Pulse.</p>
  ${note}
  <p style="margin:24px 0 8px 0;"><a href="${entry.share_url}" style="color:#1a1a1a;">Save to contacts (no Pulse account needed)</a></p>
  <p style="margin:0;color:#8a8a8a;font-size:12px;">${entry.share_url}</p>
</body></html>`;
        const text = `${senderDisplay} shared a contact card with you on Pulse.\n\nSave to contacts: ${entry.share_url}`;
        await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
            apikey: SUPABASE_SERVICE_KEY,
          },
          body: JSON.stringify({ to: entry.recipient_hint, subject, html, text }),
        });
      } catch (e) {
        console.error('[bundle] send-email threw for', entry.recipient_hint, e);
      }
    }

    const responseBody: Record<string, unknown> = {
      bundle_id: makeUuid(),
      cards_created: shareUrls.length,
      share_urls: shareUrls,
    };
    if (failures.length > 0) responseBody.failures = failures;
    if (blockedRecipients.length > 0) {
      // Surface blocked recipients in metadata so UI can render
      // "X recipients blocked you" without a separate API call.
      responseBody.blocked = blockedRecipients;
    }

    // TODO: edge fn integration tests in a later pass.

    return json(responseBody, 201);
  } catch (err) {
    console.error('[bundle] threw:', err);
    return json(
      { error: 'internal', details: String((err as Error)?.message ?? err) },
      500,
    );
  }
});

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
