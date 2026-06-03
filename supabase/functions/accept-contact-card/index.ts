// Supabase Edge Function: accept-contact-card
//
// Phase C — recipient-side Accept. Creates a new contacts row for the
// card subject (with Phase B-style dedup linking) and, when
// connect_with_sender = true, additionally adds the sender as a
// contact. For single_use cards, atomically flips consumed_at via
// `UPDATE ... WHERE consumed_at IS NULL RETURNING *`. Multi-use cards
// do NOT set consumed_at.
//
// Auth: Bearer token (Pulse JWT). Recipient identity is read from
// JWT — never from the body.
//
// Request body (matches contactCardService.acceptCard wrapper):
//   {
//     card_ids: string[],           // uuid array; 1+ entries (the PK
//                                   //   doubles as the share token).
//     connect_with_sender: boolean, // magi D-2: default-checked client
//                                   //   side, but server treats the
//                                   //   field as a strict opt-in —
//                                   //   sender promote happens only
//                                   //   when this is `true`.
//     merge_strategy?: 'link' | 'merge' | 'skip',
//                                   // optional; defaults to 'link'
//                                   //   per magi D-12. Wrapper does
//                                   //   not currently send this, but
//                                   //   the field is accepted for
//                                   //   forward-compat with the
//                                   //   "Review duplicates" UI.
//   }
//
// Response (BulkAcceptResult — see src/types/contactCard.ts):
//   {
//     added: number,
//     linked: number,
//     skipped: number,
//     per_card: Array<{
//       card_id: string,
//       outcome: 'added' | 'linked' | 'skipped',
//       new_contact_id?: string,
//       possible_duplicate_of?: string,
//     }>,
//   }
//
// HTTP semantics (magi D-9 UUID-probing defense):
//   200  — happy path; partial failures surface in per_card outcomes
//   401  — no JWT
//   403  — recipient_user_id set on card AND doesn't match auth.uid()
//   404  — card_id not found at all (only when ALL cards 404)
//   410  — card already consumed (single_use) / revoked / expired
//          (only when ALL cards in the batch are gone)
//   500  — DB error

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Card_snapshot whitelist (defensive re-pick) ─────────────────────
// Even though create-contact-card whitelists on write, we re-whitelist
// on read so a maliciously crafted snapshot (DB poisoned via another
// channel) can never leak notes / case_notes / private_notes etc. into
// the recipient's contacts row.
const SNAPSHOT_FIELDS = [
  'name',
  'email',
  'phone',
  'company',
  'title',
  'address',
  'avatar_color',
] as const;
type SnapshotField = (typeof SNAPSHOT_FIELDS)[number];

interface CardSnapshot {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  address?: string;
  avatar_color?: string;
}

function pickSnapshot(raw: unknown): CardSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const name = typeof row.name === 'string' ? row.name : '';
  if (!name) return null;
  const out: CardSnapshot = { name };
  for (const f of SNAPSHOT_FIELDS) {
    if (f === 'name') continue;
    const v = row[f];
    if (typeof v === 'string' && v.length > 0) {
      (out as Record<SnapshotField, string>)[f] = v;
    }
  }
  return out;
}

// ─── Phase B–style dedup matcher ─────────────────────────────────────
// Mirrors src/services/contactEnrichmentService.ts:319-344 — normalized
// email (lowercase + trim), normalized phone (digits only), name
// fingerprint (lowercase, alpha+space only). Cheap O(n) scan; the
// recipient's contacts list is bounded by the per-user import limits
// from Phase B (5k+ ceiling, but bulk Accept is typically <100).

function normalizeEmail(e: string | undefined | null): string {
  if (!e) return '';
  return e.toLowerCase().trim();
}

function normalizePhone(p: string | undefined | null): string {
  if (!p) return '';
  return p.replace(/\D/g, '');
}

function nameFingerprint(n: string | undefined | null): string {
  if (!n) return '';
  // NOTE: keeps brace / hash as alpha-stripped — fingerprint is for
  // matching only; the original display name still passes through
  // verbatim per the Pulse contact-name policy when we insert the row.
  return n
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim();
}

interface ContactRowLite {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

function findDuplicate(
  snap: CardSnapshot,
  existing: ContactRowLite[],
): ContactRowLite | null {
  const snapEmail = normalizeEmail(snap.email);
  const snapPhone = normalizePhone(snap.phone);
  const snapName = nameFingerprint(snap.name);
  for (const row of existing) {
    if (snapEmail && normalizeEmail(row.email) === snapEmail) return row;
    if (snapPhone && normalizePhone(row.phone) === snapPhone) return row;
    if (snapName && nameFingerprint(row.name) === snapName) return row;
  }
  return null;
}

// ─── Idempotency cache (mirrors create-contact-card) ─────────────────
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const idempotencyCache = new Map<
  string,
  { result: unknown; expiresAt: number }
>();

function cacheIdempotency(key: string, result: unknown) {
  idempotencyCache.set(key, {
    result,
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
  });
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

// ─── Sender display name (mirrors create-contact-card helper) ────────
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

async function resolveSenderEmail(
  admin: ReturnType<typeof createClient>,
  senderUserId: string,
): Promise<string | null> {
  try {
    const { data: u, error } = await admin.auth.admin.getUserById(senderUserId);
    if (error || !u?.user) return null;
    return typeof u.user.email === 'string' ? u.user.email : null;
  } catch {
    return null;
  }
}

// ─── contacts insert helpers ─────────────────────────────────────────
// `public.contacts` has several NOT NULL columns with defaults: `role`,
// `avatar_color`, `status`, `source`, `platform`, `external_id`. We set
// them explicitly so the row inserts cleanly when the server-default
// path is not taken (e.g. when the snapshot supplied an avatar_color).

interface ContactInsert {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  role: string;
  avatar_color: string;
  status: string;
  source: string;
  platform: string;
  external_id: string;
  address: string | null;
  possible_duplicate_of?: string | null;
}

function buildContactInsert(
  recipientUserId: string,
  snap: CardSnapshot,
  opts?: { possible_duplicate_of?: string | null; sourceTag?: string },
): ContactInsert {
  // contacts.email is NOT NULL; if the snapshot omits it (phone-only
  // contact), fall back to an empty string. Phase B's bulk import path
  // has the same workaround — see workspace_contacts handoff doc.
  return {
    user_id: recipientUserId,
    name: snap.name,
    email: snap.email ?? '',
    phone: snap.phone ?? null,
    company: snap.company ?? null,
    role: 'Contact',
    avatar_color: snap.avatar_color ?? '#6366f1',
    status: 'offline',
    source: 'local',
    platform: opts?.sourceTag ?? 'card_share',
    external_id: '',
    address: snap.address ?? null,
    possible_duplicate_of: opts?.possible_duplicate_of ?? null,
  };
}

// ─── Per-card processing ─────────────────────────────────────────────

type PerCardOutcome = 'added' | 'linked' | 'skipped' | 'gone' | 'forbidden' | 'not_found';

interface PerCardResult {
  card_id: string;
  outcome: PerCardOutcome;
  new_contact_id?: string;
  possible_duplicate_of?: string;
  error?: string;
}

interface ProcessCtx {
  admin: ReturnType<typeof createClient>;
  recipientUserId: string;
  connectWithSender: boolean;
  mergeStrategy: 'link' | 'merge' | 'skip';
  // Memoized snapshot of recipient's existing contacts (id, name,
  // email, phone). Loaded once at request start.
  existingContacts: ContactRowLite[];
  // Set of sender user IDs we've already promoted in this batch, so
  // multi-card-from-same-sender doesn't write the sender row twice.
  promotedSenders: Set<string>;
}

async function processCard(
  ctx: ProcessCtx,
  cardId: string,
): Promise<PerCardResult> {
  // ── Fetch + validate card ──────────────────────────────────────────
  const { data: card, error: cardErr } = await ctx.admin
    .from('contact_cards')
    .select(
      'id, sender_user_id, recipient_user_id, card_snapshot, token_policy, is_forwardable, expires_at, revoked_at, consumed_at',
    )
    .eq('id', cardId)
    .maybeSingle();

  if (cardErr) {
    console.error('[accept-contact-card] card fetch error:', cardErr);
    return { card_id: cardId, outcome: 'skipped', error: 'internal' };
  }
  if (!card) {
    return { card_id: cardId, outcome: 'not_found' };
  }

  // Recipient identity gate: if recipient_user_id is locked-in, the
  // caller MUST be that user. If null, the card is open to anyone with
  // the token (Pulse-account holder), per magi D-2 + accord §recipient.
  if (
    card.recipient_user_id &&
    card.recipient_user_id !== ctx.recipientUserId
  ) {
    return { card_id: cardId, outcome: 'forbidden' };
  }

  if (card.revoked_at) {
    return { card_id: cardId, outcome: 'gone' };
  }
  if (card.expires_at && new Date(card.expires_at) < new Date()) {
    return { card_id: cardId, outcome: 'gone' };
  }
  if (card.token_policy === 'single_use' && card.consumed_at) {
    return { card_id: cardId, outcome: 'gone' };
  }

  // ── Atomic single-use consume ──────────────────────────────────────
  // For single_use, claim the card BEFORE any contact writes. If the
  // RETURNING is empty, another concurrent Accept won the race.
  if (card.token_policy === 'single_use') {
    const { data: claimed, error: claimErr } = await ctx.admin
      .from('contact_cards')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', cardId)
      .is('consumed_at', null)
      .select('id')
      .maybeSingle();

    if (claimErr) {
      console.error('[accept-contact-card] consume error:', claimErr);
      return { card_id: cardId, outcome: 'skipped', error: 'internal' };
    }
    if (!claimed) {
      return { card_id: cardId, outcome: 'gone' };
    }
  }

  // ── Re-whitelist snapshot ──────────────────────────────────────────
  const snap = pickSnapshot(card.card_snapshot);
  if (!snap) {
    console.error('[accept-contact-card] snapshot missing name', cardId);
    return { card_id: cardId, outcome: 'skipped', error: 'bad_snapshot' };
  }

  // ── Dedup ──────────────────────────────────────────────────────────
  const dup = findDuplicate(snap, ctx.existingContacts);

  if (dup && ctx.mergeStrategy === 'skip') {
    return { card_id: cardId, outcome: 'skipped' };
  }

  if (dup && ctx.mergeStrategy === 'merge') {
    // Merge: combine fields, sender's card wins on conflict.
    // The dup is the EXISTING contact; update it in place.
    const updates: Record<string, unknown> = {
      name: snap.name,
      email: snap.email ?? dup.email ?? '',
    };
    if (snap.phone) updates.phone = snap.phone;
    if (snap.company) updates.company = snap.company;
    if (snap.title) updates.role = snap.title;
    if (snap.address) updates.address = snap.address;
    if (snap.avatar_color) updates.avatar_color = snap.avatar_color;
    const { error: mergeErr } = await ctx.admin
      .from('contacts')
      .update(updates)
      .eq('id', dup.id)
      .eq('user_id', ctx.recipientUserId);
    if (mergeErr) {
      console.error('[accept-contact-card] merge error:', mergeErr);
      return { card_id: cardId, outcome: 'skipped', error: 'internal' };
    }
    // Reflect into in-memory cache so the next card in the batch sees
    // the updated fields.
    dup.name = snap.name;
    if (snap.email) dup.email = snap.email;
    if (snap.phone) dup.phone = snap.phone;
    return {
      card_id: cardId,
      outcome: 'linked',
      possible_duplicate_of: dup.id,
    };
  }

  // ── Default: link or new add ───────────────────────────────────────
  const insertRow = buildContactInsert(ctx.recipientUserId, snap, {
    possible_duplicate_of: dup?.id ?? null,
    sourceTag: 'card_share',
  });

  const { data: inserted, error: insertErr } = await ctx.admin
    .from('contacts')
    .insert(insertRow)
    .select('id, name, email, phone')
    .single();

  if (insertErr || !inserted) {
    console.error('[accept-contact-card] insert error:', insertErr);
    return { card_id: cardId, outcome: 'skipped', error: 'internal' };
  }

  // Push into the in-memory existing-set so a subsequent card in the
  // batch that matches the same fingerprint dedups against this new row.
  ctx.existingContacts.push({
    id: inserted.id,
    name: inserted.name as string,
    email: (inserted.email as string) ?? null,
    phone: (inserted.phone as string) ?? null,
  });

  // ── Optional sender promote ────────────────────────────────────────
  // Magi D-2: sender is added only when connect_with_sender = true.
  // Best-effort; failure to add sender does not fail the card Accept.
  if (
    ctx.connectWithSender &&
    !ctx.promotedSenders.has(card.sender_user_id)
  ) {
    try {
      const senderDisplay = await resolveSenderDisplayName(
        ctx.admin,
        card.sender_user_id,
      );
      const senderEmail = await resolveSenderEmail(
        ctx.admin,
        card.sender_user_id,
      );
      // Dedup the sender against the recipient's existing contacts the
      // same way we dedup the card subject. If the sender is already
      // in contacts, no-op silently.
      const senderSnap: CardSnapshot = {
        name: senderDisplay,
        email: senderEmail ?? undefined,
      };
      const senderDup = findDuplicate(senderSnap, ctx.existingContacts);
      if (!senderDup) {
        const senderInsert = buildContactInsert(
          ctx.recipientUserId,
          senderSnap,
          { sourceTag: 'card_sender' },
        );
        const { data: senderInserted, error: senderErr } = await ctx.admin
          .from('contacts')
          .insert(senderInsert)
          .select('id, name, email, phone')
          .single();
        if (senderErr) {
          console.error(
            '[accept-contact-card] sender promote insert failed (non-fatal):',
            senderErr,
          );
        } else if (senderInserted) {
          ctx.existingContacts.push({
            id: senderInserted.id,
            name: senderInserted.name as string,
            email: (senderInserted.email as string) ?? null,
            phone: (senderInserted.phone as string) ?? null,
          });
        }
      }
      ctx.promotedSenders.add(card.sender_user_id);
    } catch (e) {
      console.error(
        '[accept-contact-card] sender promote threw (non-fatal):',
        e,
      );
    }
  }

  return dup
    ? {
        card_id: cardId,
        outcome: 'linked',
        new_contact_id: inserted.id,
        possible_duplicate_of: dup.id,
      }
    : { card_id: cardId, outcome: 'added', new_contact_id: inserted.id };
}

// ─── Main handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')
    return json({ error: 'method_not_allowed' }, 405);

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
      console.error(
        '[accept-contact-card] token validation failed:',
        authError?.message,
      );
      return json({ error: 'unauthorized' }, 401);
    }

    const recipientUserId = user.id;

    // ── Idempotency short-circuit ────────────────────────────────────
    const idempotencyKey = req.headers.get('idempotency-key');
    const cacheKey = idempotencyKey
      ? `${recipientUserId}:${idempotencyKey}`
      : null;
    if (cacheKey) {
      const cached = readIdempotency(cacheKey);
      if (cached !== undefined) {
        return json(cached, 200);
      }
    }

    // ── Parse + validate body ────────────────────────────────────────
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json(
        { error: 'validation_failed', details: 'invalid_json' },
        400,
      );
    }

    const { card_ids, connect_with_sender, merge_strategy } =
      body as Record<string, unknown>;

    if (!Array.isArray(card_ids) || card_ids.length === 0) {
      return json(
        { error: 'validation_failed', details: 'card_ids_required' },
        400,
      );
    }
    if (card_ids.length > 200) {
      return json(
        { error: 'validation_failed', details: 'too_many_card_ids' },
        400,
      );
    }
    for (const id of card_ids) {
      if (typeof id !== 'string' || !UUID_RE.test(id)) {
        return json(
          { error: 'validation_failed', details: 'invalid_card_id' },
          400,
        );
      }
    }

    const connectWithSender = connect_with_sender === true;

    // Default 'link' per magi D-12.
    let mergeStrategy: 'link' | 'merge' | 'skip' = 'link';
    if (merge_strategy !== undefined) {
      if (
        merge_strategy !== 'link' &&
        merge_strategy !== 'merge' &&
        merge_strategy !== 'skip'
      ) {
        return json(
          { error: 'validation_failed', details: 'invalid_merge_strategy' },
          400,
        );
      }
      mergeStrategy = merge_strategy;
    }

    // ── Pre-load recipient's existing contacts for dedup ─────────────
    const { data: existing, error: existingErr } = await admin
      .from('contacts')
      .select('id, name, email, phone')
      .eq('user_id', recipientUserId);

    if (existingErr) {
      console.error(
        '[accept-contact-card] existing contacts fetch error:',
        existingErr,
      );
      return json({ error: 'internal' }, 500);
    }

    const ctx: ProcessCtx = {
      admin,
      recipientUserId,
      connectWithSender,
      mergeStrategy,
      existingContacts: (existing ?? []) as ContactRowLite[],
      promotedSenders: new Set<string>(),
    };

    // ── Process each card ────────────────────────────────────────────
    const perCard: PerCardResult[] = [];
    for (const cardId of card_ids as string[]) {
      perCard.push(await processCard(ctx, cardId));
    }

    // ── Aggregate response counters ──────────────────────────────────
    let added = 0;
    let linked = 0;
    let skipped = 0;
    let goneCount = 0;
    let forbiddenCount = 0;
    let notFoundCount = 0;

    for (const r of perCard) {
      switch (r.outcome) {
        case 'added':
          added += 1;
          break;
        case 'linked':
          linked += 1;
          break;
        case 'skipped':
          skipped += 1;
          break;
        case 'gone':
          goneCount += 1;
          break;
        case 'forbidden':
          forbiddenCount += 1;
          break;
        case 'not_found':
          notFoundCount += 1;
          break;
      }
    }

    // Whole-batch hard errors take precedence when EVERY card hit the
    // same wall — the wrapper's test for the consumed/410 case relies
    // on this.
    if (perCard.length > 0 && goneCount === perCard.length) {
      return json({ error: 'gone' }, 410);
    }
    if (perCard.length > 0 && forbiddenCount === perCard.length) {
      return json({ error: 'forbidden' }, 403);
    }
    if (perCard.length > 0 && notFoundCount === perCard.length) {
      return json({ error: 'not_found' }, 404);
    }

    // Mixed batches: surface counts in BulkAcceptResult. "gone" /
    // "forbidden" / "not_found" outcomes from the per-card loop are
    // collapsed into `skipped` for the wrapper, since the wrapper's
    // PerCardOutcome type only knows 'added' | 'linked' | 'skipped'.
    const perCardOut = perCard.map((r) => {
      const outcome: 'added' | 'linked' | 'skipped' =
        r.outcome === 'added'
          ? 'added'
          : r.outcome === 'linked'
            ? 'linked'
            : 'skipped';
      const row: {
        card_id: string;
        outcome: 'added' | 'linked' | 'skipped';
        new_contact_id?: string;
        possible_duplicate_of?: string;
      } = { card_id: r.card_id, outcome };
      if (r.new_contact_id) row.new_contact_id = r.new_contact_id;
      if (r.possible_duplicate_of)
        row.possible_duplicate_of = r.possible_duplicate_of;
      return row;
    });

    // Roll "gone/forbidden/not_found" into skipped totals for the
    // aggregate counters so `added + linked + skipped === card_ids.length`.
    skipped += goneCount + forbiddenCount + notFoundCount;

    const result = {
      added,
      linked,
      skipped,
      per_card: perCardOut,
    };

    if (cacheKey) cacheIdempotency(cacheKey, result);

    // TODO(phase-7): emit card.accepted telemetry per per_card outcome.
    // TODO(phase-7): swap auth.uid() owner check on contacts insert
    //   for user_has_permission(workspace, 'contacts.write') once
    //   Sub-PR 7 ships custom-roles.

    return json(result, 200);
  } catch (err) {
    console.error('[accept-contact-card] threw:', err);
    return json(
      {
        error: 'internal',
        details: String((err as Error)?.message ?? err),
      },
      500,
    );
  }
});
