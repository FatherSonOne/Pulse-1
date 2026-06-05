# Pulse Contacts Phase C — Schema Design Spec (2026-05-18)

> Phase 5 schema spec for the Pulse Contacts Phase C contact-card sharing protocol
> (Pulse↔Pulse + non-Pulse vCard + Received inbox + forwarding + revocation + bulk Accept).
> **Inputs**: magi verdict 2026-05-18 (`docs/contacts-phase-c-magi-verdict-2026-05-18.md`),
> accord Lite spec 2026-05-18 (`docs/contacts-phase-c-accord-2026-05-18.md`),
> session handoff 2026-05-18 (`docs/CONTACTS_OVERHAUL_HANDOFF_2026-05-18.md`).
> **Output**: complete DDL + RLS + edge-function contracts + TypeScript types ready for Phase 6 codex implementation. No migration files written here — Phase 6 pastes the SQL blocks below verbatim onto a fresh branch.

---

## Migration plan

**Single migration**, recommended filename:

```
supabase/migrations/20260525000001_phase_c_contact_cards.sql
```

Date prefix follows Phase B's 14-digit `YYYYMMDDhhmmss`-style sequence
(`20260523000001`, `20260523000002`, `20260524000001…000003`). Phase C
lands one day forward of Phase B's last migration: `20260525000001`.

**Single migration justification.** Decisions #6 (forwarding) and #9
(revocation) are coupled per the magi cross-cutting recommendation
("chain-revocation cascade in #9 depends on #6's FK structure —
implement in the same migration, not separately"). The `contact_cards`
self-referential FK + `card_send_blocks` + the new `contacts` column
are interdependent and small (three table-level objects). Splitting
adds rollback complexity without buying isolation. Single migration
file.

**Rate-limit numbers (50/day, 100/bundle) are NOT in the migration.**
Per accord A-2 the values come from a config source readable by edge
functions; the schema layer is policy-agnostic. The recommendation
below is "extend an existing per-feature config row"; if no such row
exists, fall back to env vars on the edge function. No new
`feature_limits` table required for Phase C.

---

## Tables

### `contact_cards` (new)

```sql
CREATE TABLE IF NOT EXISTS public.contact_cards (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id          text        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_hint          text                 CHECK (recipient_hint IS NULL OR length(recipient_hint) BETWEEN 1 AND 320),
  recipient_user_id       uuid                 REFERENCES auth.users(id) ON DELETE SET NULL,
  card_snapshot           jsonb       NOT NULL,
  intro_note              text                 CHECK (intro_note IS NULL OR length(intro_note) <= 500),
  token_policy            text        NOT NULL DEFAULT 'multi_use'
                                       CHECK (token_policy IN ('multi_use', 'single_use')),
  is_forwardable          boolean     NOT NULL DEFAULT true,
  forwarded_from_card_id  uuid                 REFERENCES public.contact_cards(id) ON DELETE SET NULL,
  expires_at              timestamptz,
  revoked_at              timestamptz,
  consumed_at             timestamptz,
  view_count              integer     NOT NULL DEFAULT 0
                                       CHECK (view_count >= 0),
  created_at              timestamptz NOT NULL DEFAULT now()
);
```

**Column rationale**

- `id` — UUID v4 default; the share URL token is the `id` rendered as
  its canonical 36-char hyphenated form. No separate token column; the
  PK *is* the token (Adversarial Adam UUID-probing is defended by the
  410-vs-404 distinction, not by token entropy beyond v4).
- `sender_user_id text` — matches the existing `contacts.user_id TEXT`
  convention. Cast `auth.uid()::text` in every RLS comparison
  (guardrail #1). Cascade on auth-user delete: when a user is purged,
  their outbound cards die with them.
- `recipient_hint text` — email or Pulse user_id (or display name in
  edge cases — opaque to the DB). Nullable because some shares are
  generated as raw URLs first and then routed via OS share sheet
  (R-5). Length cap 320 chars = RFC 5321 max email length.
- `recipient_user_id uuid` — eager resolution per accord open Q#1
  default. When the create-card edge function recognizes
  `recipient_hint` as an existing Pulse `auth.users.email`, it sets
  this column at create time so a future signup/login that matches
  the same hint attaches to the card automatically. Nullable
  throughout the row's life; setting it during a later "claim on
  signup" is allowed via service-role write. `ON DELETE SET NULL` so
  recipient account deletion does not orphan-delete the card.
- `card_snapshot jsonb NOT NULL` — frozen at create time. Whitelist
  enforced in serializer, not DB (see "Card_snapshot field whitelist"
  section below). No CHECK constraint here — JSONB shape is owned by
  application service layer per the Phase B `saved_filters.predicate_json`
  pattern.
- `intro_note text` — 500-char cap enforced both client-side (R-1
  AC-1-2) and DB-side via CHECK. Plain text only; HTML escaping is
  the email-template's responsibility.
- `token_policy` — `multi_use` default per magi D-10. `single_use`
  cards atomically flip `consumed_at` on first Accept (NOT first
  landing render). Two-value enum encoded as `text` + CHECK (matches
  Pulse pattern; no Postgres-native `CREATE TYPE` for two-value
  enums).
- `is_forwardable` — magi D-6; default true per magi verdict.
- `forwarded_from_card_id` — self-referential FK preserves chain.
  `ON DELETE SET NULL` so a hard-delete on the parent (rare —
  revocation is the soft path) does not cascade-destroy the chain;
  it merely orphans descendants. Magi notes chain semantics: parent
  revocation cascades through the WITH RECURSIVE traversal at write
  time (see "Edge functions" section), not via DB cascade.
- `expires_at timestamptz` — nullable, default NULL (most cards never
  expire per D-11). Hard cutoff at read time; no grace period column.
- `revoked_at timestamptz` — nullable. Set by Unsend AND Revoke (same
  column per magi D-9). Read endpoints return HTTP 410 when not NULL.
- `consumed_at timestamptz` — single-use marker. NULL until first
  Accept on a `single_use` card. Distinct from `view_count > 0` —
  Accept consumes, view alone does not.
- `view_count integer` — atomic counter per landing render. CHECK
  guards against underflow (defensive — no decrement path planned).
- `created_at timestamptz` — Phase B-style default `now()`.

### `card_send_blocks` (new)

```sql
CREATE TABLE IF NOT EXISTS public.card_send_blocks (
  blocked_by_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_user_id      text        NOT NULL,
  blocked_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocked_by_user_id, sender_user_id)
);
```

**Column rationale**

- `blocked_by_user_id uuid` — the recipient who erected the block.
  Stored as `uuid` (matches `auth.users.id`) because the block is
  inserted from the recipient's own client where `auth.uid()` is a
  UUID. `ON DELETE CASCADE` — block dies with the blocker.
- `sender_user_id text` — the blocked sender. Stored as `text` to
  match the `contact_cards.sender_user_id text` and `contacts.user_id
  text` convention. No FK — leaving this loose lets the block survive
  sender-account deletion (defensive — re-registration under the same
  user_id rebuilds the block; loose FK avoids surprise auth-cascade
  unblocks).
- `blocked_at` — audit-only.
- Composite PK gives natural dedup + cascade behavior the magi D-7
  unique-index requirement asks for.

### Modifications to existing `contacts` table

```sql
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS possible_duplicate_of uuid
    REFERENCES public.contacts(id) ON DELETE SET NULL;
```

**Rationale**

- Per magi D-12, bulk Accept dedup writes `possible_duplicate_of`
  pointing to the existing match instead of overwriting it. The
  column is `uuid` (FK to `contacts.id` which is `uuid`) — *only the
  `contacts.user_id` column is TEXT*; `contacts.id` itself is `uuid`,
  so the FK is conventional.
- `ON DELETE SET NULL` — if the original match is hard-deleted, the
  duplicate-flag detaches but the row stays. Soft archive (Phase B)
  does not trigger this.
- RLS visibility: any policy that joins to or compares
  `possible_duplicate_of` MUST chain through
  `contacts.user_id = auth.uid()::text` (the existing
  `contacts_owner_all` policy already gates this — no new policy
  required for the column itself; it inherits parent-row gating).

**No new index on `possible_duplicate_of`.** The read pattern is
"on contact detail render, fetch the matched row if FK is non-null"
— a single-row fetch by PK with the existing PK index; per-row, not
per-list. If the post-Accept "Review duplicates" UI later scans by
this column at list scale (e.g. "all my flagged duplicates") and
shows hot-path latency in profile, add `(user_id, possible_duplicate_of)
WHERE possible_duplicate_of IS NOT NULL` then.

---

## Indexes

### On `contact_cards`

```sql
CREATE INDEX IF NOT EXISTS idx_contact_cards_sender_recent
  ON public.contact_cards (sender_user_id, created_at DESC);
-- Sender's Sent Cards inbox (R-23). DESC for recency-first list.

CREATE INDEX IF NOT EXISTS idx_contact_cards_recipient_user
  ON public.contact_cards (recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;
-- Received inbox primary path: SELECT WHERE recipient_user_id = auth.uid()
-- ORDER BY created_at DESC. Partial index skips rows with NULL recipient.

CREATE INDEX IF NOT EXISTS idx_contact_cards_recipient_hint
  ON public.contact_cards (recipient_hint)
  WHERE recipient_hint IS NOT NULL
    AND recipient_user_id IS NULL;
-- Hint-resolution lookup when an unresolved recipient signs up:
-- "any unclaimed cards waiting for this email?". Partial index
-- restricts to actually-unresolved rows (recipient_user_id IS NULL).

CREATE INDEX IF NOT EXISTS idx_contact_cards_chain
  ON public.contact_cards (forwarded_from_card_id)
  WHERE forwarded_from_card_id IS NOT NULL;
-- Cascade revocation traversal (R-17): WITH RECURSIVE walk down the
-- chain. Partial index skips ~90% of rows (roots).

CREATE INDEX IF NOT EXISTS idx_contact_cards_abuse_recent
  ON public.contact_cards (created_at DESC)
  WHERE view_count > 50;
-- Internal abuse query (R-20): "cards with anomalous view counts in
-- the last hour". Partial index keeps this cheap; abuse monitoring
-- runs ad-hoc, not user-facing.

CREATE INDEX IF NOT EXISTS idx_contact_cards_rate_limit_window
  ON public.contact_cards (sender_user_id, created_at DESC);
-- DUPLICATE-LIKE NOTE: same column ordering as idx_contact_cards_sender_recent.
-- Postgres will reuse idx_contact_cards_sender_recent for the
-- rate-limit count query SELECT count(*) WHERE sender_user_id=$1
-- AND created_at > now() - interval '24h'. Do NOT create a second
-- index; comment in migration explicitly noting reuse.
```

> **Drop `idx_contact_cards_rate_limit_window` from the migration —**
> it duplicates `idx_contact_cards_sender_recent`. The comment above
> is illustrative of the read path; only the five distinct indexes
> are created.

### On `card_send_blocks`

No extra indexes — the composite PK `(blocked_by_user_id, sender_user_id)`
is the only access pattern (point lookup at edge function:
"is sender X blocked by recipient Y?"). PK index suffices.

### On `contacts` (modification only)

No new index on `possible_duplicate_of` per rationale above.

**Index count summary**: 5 new on `contact_cards`, 0 on
`card_send_blocks`, 0 on `contacts`. **Total: 5 new indexes**.

---

## RLS policies

### `contact_cards`

```sql
ALTER TABLE public.contact_cards ENABLE ROW LEVEL SECURITY;

-- ----------- SENDER (owner) policies -----------

DROP POLICY IF EXISTS contact_cards_sender_select ON public.contact_cards;
CREATE POLICY contact_cards_sender_select
  ON public.contact_cards FOR SELECT
  TO authenticated
  USING (
    sender_user_id = auth.uid()::text
    -- TODO(phase-7): replace with public.user_has_permission(NULL, 'cards.send')
    -- once Sub-PR 7 ships custom-roles. Phase C uses owner-only check.
  );

DROP POLICY IF EXISTS contact_cards_sender_insert ON public.contact_cards;
CREATE POLICY contact_cards_sender_insert
  ON public.contact_cards FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()::text
    -- TODO(phase-7): replace with public.user_has_permission(NULL, 'cards.send')
  );

DROP POLICY IF EXISTS contact_cards_sender_update ON public.contact_cards;
CREATE POLICY contact_cards_sender_update
  ON public.contact_cards FOR UPDATE
  TO authenticated
  USING (sender_user_id = auth.uid()::text)
  WITH CHECK (sender_user_id = auth.uid()::text);
-- Senders may only revoke (write revoked_at) via this policy. Edge
-- functions enforce that no other column may be UPDATEd by sender —
-- service layer responsibility, not RLS. Magi out-of-scope §
-- "Card editing after send" is enforced by service layer.

DROP POLICY IF EXISTS contact_cards_sender_delete ON public.contact_cards;
CREATE POLICY contact_cards_sender_delete
  ON public.contact_cards FOR DELETE
  TO authenticated
  USING (sender_user_id = auth.uid()::text);
-- DELETE is reserved for hard-purge admin paths; UI Revoke writes
-- revoked_at via UPDATE, NEVER DELETE.

-- ----------- RECIPIENT (resolved Pulse user) policy -----------

DROP POLICY IF EXISTS contact_cards_recipient_select ON public.contact_cards;
CREATE POLICY contact_cards_recipient_select
  ON public.contact_cards FOR SELECT
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );
-- Resolved Pulse recipient reads their own Received inbox. Revoked
-- and expired rows are filtered by RLS so the recipient's app never
-- sees them; landing-page rendering for those uses edge function
-- service role and returns 410 Gone explicitly.
```

**No `contact_cards_public_read_by_token` RLS policy.** Public landing-
page rendering bypasses RLS entirely by going through the
`resolve-card-deeplink` edge function with the service-role key
(`sb_secret_*`). The edge function applies its own predicate
(`revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
AND NOT (token_policy='single_use' AND consumed_at IS NOT NULL)`) and
returns 410 Gone for any miss. Authenticated `anon` policies on
`contact_cards` are NOT granted because token-by-URL is not a "this
user is reading their own data" pattern — it is a "service routes by
token" pattern, which is service-role territory.

### `card_send_blocks`

```sql
ALTER TABLE public.card_send_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS card_send_blocks_select ON public.card_send_blocks;
CREATE POLICY card_send_blocks_select
  ON public.card_send_blocks FOR SELECT
  TO authenticated
  USING (blocked_by_user_id = auth.uid());

DROP POLICY IF EXISTS card_send_blocks_insert ON public.card_send_blocks;
CREATE POLICY card_send_blocks_insert
  ON public.card_send_blocks FOR INSERT
  TO authenticated
  WITH CHECK (blocked_by_user_id = auth.uid());

DROP POLICY IF EXISTS card_send_blocks_delete ON public.card_send_blocks;
CREATE POLICY card_send_blocks_delete
  ON public.card_send_blocks FOR DELETE
  TO authenticated
  USING (blocked_by_user_id = auth.uid());
```

**No UPDATE policy.** Blocks are immutable — to "edit" a block, the
user deletes and re-inserts. Keeps the audit trail clean and
eliminates a class of mistaken-edit RLS bugs.

The `sender_user_id` check at edge-function time happens via service
role, not via RLS — `create-contact-card` reads `card_send_blocks` as
service role (`SELECT 1 FROM card_send_blocks WHERE
blocked_by_user_id = $recipient_user_id AND sender_user_id =
$sender_user_id LIMIT 1`) and rejects with 403 on match. This avoids
exposing one user's block list to another user via RLS.

### `contacts` (modification)

No new policy on `contacts` for Phase C — the existing
`contacts_owner_all` policy already gates every column including the
new `possible_duplicate_of`. Verify in migration with a comment:

```sql
-- contacts.possible_duplicate_of is gated by the existing
-- contacts_owner_all policy (user_id = auth.uid()::text). No new
-- policy required. Verified against
-- supabase/migrations/20260119062007_remote_schema.sql:5496.
```

**RLS policy count summary**: 6 policies on `contact_cards`
(sender SELECT/INSERT/UPDATE/DELETE + recipient SELECT, with public
landing handled by service role outside RLS), 3 policies on
`card_send_blocks` (SELECT/INSERT/DELETE), 0 new policies on
`contacts`. **Total: 9 new RLS policies.**

---

## Card_snapshot field whitelist (accord open Q#2)

`card_snapshot` is `jsonb NOT NULL`. The serializer that builds it
runs in the `create-contact-card` and `create-contact-card-bundle`
edge functions and MUST hand-pick exactly these contact columns:

**ALLOWED into `card_snapshot`:**

| Source column on `contacts` | JSONB key            | Type    | Notes |
|-----------------------------|----------------------|---------|-------|
| `name`                      | `name`               | string  | Display name; preserve `{`, `}`, `#` verbatim per guardrail #1. |
| `email`                     | `email`              | string  | Snapshot-time email; recipient sees this. |
| `phone`                     | `phone`              | string  | Sensitive but IS the point of sharing. Snapshot-frozen. |
| `company`                   | `company`            | string  | Org affiliation. |
| `title`                     | `title`              | string  | Job title. |
| `address`                   | `address`            | string  | Sensitive but IS the point of sharing. Snapshot-frozen. |
| `avatar_color`              | `avatar_color`       | string  | UI rendering only; not PII. |

**EXPLICITLY EXCLUDED (must NEVER appear in `card_snapshot`):**

- `notes` — sender's private annotations; leaks sender's mental model.
- `case_notes` — same; explicitly named in guardrail #10.
- `private_notes` — name varies but treat anything `*_notes` as forbidden.
- `import_source`, `import_label` — provenance metadata, recipient
  has no business seeing.
- `archived_at`, `is_vip`, `role` — sender's organizational state,
  not the contact's identity.
- Anything not listed in ALLOWED above. Default-deny.

**Snapshot schema (TypeScript shape — see "TypeScript types" section):**

```ts
interface CardSnapshot {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  address?: string;
  avatar_color?: string;
}
```

The serializer lives at `supabase/functions/_shared/cardSnapshot.ts`
(or equivalent shared module — Phase 6 codex picks the exact path
matching repo convention) and is the **single** source of truth for
what enters `card_snapshot`. The edge function MUST NOT take a raw
contact row and spread it into JSONB — it must call this serializer
explicitly. Audit hook: a regex test in CI (`ripgrep "card_snapshot:
\\{ \\.\\.\\."` returns no matches in `supabase/functions/`).

---

## Edge functions

Four new edge functions live at `supabase/functions/<kebab-name>/index.ts`
per existing repo pattern.

### 1. `create-contact-card`

**Path / method**: `POST /functions/v1/create-contact-card`
**Auth**: `Authorization: Bearer <user JWT>` required. Service role used
internally for `card_send_blocks` lookup + rate-limit count.

**Request body**:

```ts
interface CreateContactCardRequest {
  contact_id: string;                  // uuid; sender's own contact row
  recipient_hint: string;              // email or Pulse user_id; required
  intro_note?: string;                 // <=500 chars
  token_policy?: 'multi_use' | 'single_use';   // default 'multi_use'
  is_forwardable?: boolean;            // default true
  expires_at?: string | null;          // ISO 8601 timestamptz; default null
  forwarded_from_card_id?: string;     // uuid; only when forwarding
}
```

**Success response (201)**:

```ts
interface CreateContactCardResponse {
  id: string;                          // uuid
  share_url: string;                   // https://go.pulse.logosvision.org/c/{id}
  recipient_user_id: string | null;    // eager-resolved Pulse user, if any
  email_sent: boolean;                 // true if Resend invoked
}
```

**Error variants**:

```ts
| { status: 403, error: 'sender_blocked_by_recipient' }
| { status: 403, error: 'card_not_forwardable',  forwarded_from_card_id: string }
| { status: 403, error: 'rate_limit_exceeded',  retry_after_seconds: number }
| { status: 404, error: 'contact_not_found' }
| { status: 400, error: 'validation_failed',    details: string }
| { status: 500, error: 'internal' }
```

**Rate-limit pseudocode** (R-21):

```ts
const dailyLimit = await getFeatureLimit(senderUserId, 'cards_per_day') ?? 50;
const { count } = await supabase
  .from('contact_cards')
  .select('id', { count: 'exact', head: true })
  .eq('sender_user_id', senderUserId)
  .gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
if (count >= dailyLimit) {
  return jsonResponse(403, {
    error: 'rate_limit_exceeded',
    retry_after_seconds: 86_400,
  });
}
```

`getFeatureLimit` resolves from config table OR env var; Phase 6
codex picks based on what already exists (Phase A used env-style
feature flags; if a `feature_limits` row exists, prefer it).

**Side effects**:
- INSERT one row in `contact_cards`.
- If `recipient_hint` matches a row in `auth.users.email`, set
  `recipient_user_id` to that user's id (eager resolution per
  accord open Q#1).
- If `recipient_hint` is an email (not a UUID), invoke `send-email`
  edge function with the R-13 template payload.
- Emit `card.created` telemetry event.

**Adversarial Adam defense**: `sender_user_id` is read from the JWT,
NEVER from the request body. The `contact_id` is JOIN-verified to be
owned by the JWT user before snapshot serialization. The
`forwarded_from_card_id` parent is fetched server-side and
`is_forwardable` checked there — client cannot bypass by omitting the
field.

**Idempotency**: not built-in for Phase C. Client-side single-submit
guard + UI feedback is sufficient. If duplicate-submission becomes a
field issue, add an `idempotency_key` column (deferred).

---

### 2. `create-contact-card-bundle`

**Path / method**: `POST /functions/v1/create-contact-card-bundle`
**Auth**: `Authorization: Bearer <user JWT>` required.

**Request body**:

```ts
interface CreateContactCardBundleRequest {
  contact_ids: string[];               // >=2, <=100; sender's own contact rows
  recipient_hints: string[];           // >=1; emails or Pulse user_ids
  intro_note?: string;                 // <=500 chars; shared across all cards
  is_forwardable?: boolean;            // default true; applies to all cards
  expires_at?: string | null;
  // token_policy forced to 'multi_use' regardless of caller input (R-4)
}
```

**Success response (201)**:

```ts
interface CreateContactCardBundleResponse {
  bundle_id: string;                   // synthetic uuid for telemetry; not persisted
  cards_created: number;               // contact_ids.length × recipient_hints.length
  share_urls: Array<{
    contact_id: string;
    recipient_hint: string;
    card_id: string;
    share_url: string;
  }>;
}
```

**Error variants**: same shape as `create-contact-card` plus:

```ts
| { status: 400, error: 'bundle_size_exceeded', max: 100 }
| { status: 403, error: 'bundle_rate_limit_exceeded', retry_after_seconds: 86400 }
| { status: 403, error: 'recipients_blocked',  blocked: string[] }
```

**Rate-limit**: 1 bundle / 24h / sender (default), configurable per A-2.
Counted as `SELECT 1 FROM contact_cards WHERE sender_user_id=$1 AND
created_at > now() - interval '24h' GROUP BY date_trunc('day', created_at)
HAVING count(*) > 50` — but the cleaner approach is a separate column
or a per-bundle audit table. For Phase C: count any 24h window that
contains a transaction-insert of `>=2 rows in <1s` as "a bundle".
Pragmatic alternative: maintain an in-memory or Redis-equivalent
"last bundle timestamp per sender" using Supabase Realtime
broadcasts. Phase 6 codex picks; recommendation is the
count-by-burst heuristic for v1.

**Side effects**: N×M rows in `contact_cards`. One bulk email-fanout
to all email recipient_hints (use `send-email` batch payload if
supported, else N sequential calls).

**Adversarial Adam defense**: identical to single-card path applied
across all contact_ids; block-list check applied per recipient with
partial-failure response (block one recipient = exclude only that
recipient, don't fail the whole bundle — UI shows blocked list in
response).

---

### 3. `render-contact-vcard`

**Path / method**: `GET /functions/v1/render-contact-vcard/{token}`
**Auth**: PUBLIC (no Authorization header required). Service role
internally for the database read.

**Request**: token in URL path; optional `Accept: text/vcard;
version=4.0` header.

**Success response (200)**:

```
Content-Type: text/vcard; charset=utf-8
Content-Disposition: attachment; filename="<sanitized-name>.vcf"

BEGIN:VCARD
VERSION:3.0
FN:Lucca Messana
N:Messana;{Lucca};;;
TEL;TYPE=CELL:+15551234567
EMAIL:lucca@example.com
ORG:Acme
TITLE:Engineer
ADR:;;100 Main St;Springfield;IL;62701;US
END:VCARD
```

Body MUST stream — content-length set on flush. 3.0 default; 4.0 on
`Accept: text/vcard; version=4.0`. Strip-list for 3.0: `PHOTO`,
`IMPP`, `RELATED`, `LANG`, `GENDER`, `KIND`, any `X-*`. Display name
braces preserved verbatim in `FN` / `N` per guardrail #1.

**Error variants**:

```
410 Gone:
  - revoked_at IS NOT NULL
  - expires_at < now()
  - token_policy='single_use' AND consumed_at IS NOT NULL
  - sender is blocked by recipient (leak-prevention path — return 410
    NOT 403, to avoid signaling block existence to the sender)
404 Not Found:
  - token does not exist (random UUID guess)
500 Internal:
  - DB error, snapshot deserialization failure
```

**Status code nuance**: per magi D-9 + accord R-18, distinction
between 410 (gone — was valid) and 404 (never existed) is the
Adversarial Adam UUID-probing defense. The `card_send_blocks`-leak
case is the one subtle path: revealing 403 would tell the blocked
sender "your block exists"; returning 410 instead conflates with
revocation. Spec adopts 410 for the block-leak case explicitly.

**Side effects**:
- Atomic `view_count` increment: `UPDATE contact_cards SET view_count
  = view_count + 1 WHERE id = $1 RETURNING view_count`.
- Emit `card.viewed` telemetry event with `vcard_version_requested`
  (3 or 4) and the post-increment count.

**Adversarial Adam defense**: token is the only input; sender
identity comes from `JOIN auth.users ON sender_user_id`. No URL
params are trusted. `Accept` header is parsed defensively
(`split(';').map(trim)`) — invalid 4.0 syntax falls back to 3.0
silently.

---

### 4. `resolve-card-deeplink`

**Path / method**: `GET /functions/v1/resolve-card-deeplink/{token}`
**Auth**: PUBLIC. Service role internally.

Effectively the HTML landing page renderer at
`https://go.pulse.logosvision.org/c/{token}` — DevOps routes the
domain path to this function.

**Success response (200)**: server-side rendered HTML page containing:
- Card subject's display name (preserved braces)
- Available card_snapshot fields (name, phone, email, company, title,
  address — never notes)
- Sender display name (JOINed from `auth.users.raw_user_meta_data`
  or fallback to email-local-part — Phase 6 codex picks based on
  existing Pulse user-display helpers)
- Intro note (escaped HTML-safe)
- Forwarding provenance line if `forwarded_from_card_id IS NOT NULL`
  (R-15: "Aiko Tanaka is forwarding a card originally shared by
  Maya Chen")
- "Save to Contacts" CTA → `<a href="/c/{token}/vcard">` hitting
  `render-contact-vcard`
- "Get Pulse" CTA → app-store links
- For installed-Pulse devices: Universal Link / App Link handoff
  via meta-tags + Capacitor App plugin's `appUrlOpen` listener
  (R-6)

**Error variants**: same as `render-contact-vcard` — 410 Gone for
revoked/expired/consumed/blocked-leak; 404 for never-existed; 500
internal.

**Adversarial Adam defense (D-1)**: This is the magi-flagged endpoint
for URL-param-trust attacks. The function MUST:

- Read ONLY `token` from URL path.
- JOIN `contact_cards` → `auth.users` on `sender_user_id` for the
  sender display name. Never use query params for sender identity.
- Reject any extra URL params silently (do not echo into output).
- Set strong CSP headers preventing query-param-driven XSS:
  `Content-Security-Policy: default-src 'self'; script-src 'self'`
  with no `'unsafe-inline'`.

**Side effects**:
- Emit `card.viewed` telemetry event (same event as vCard fetch —
  the spec deliberately conflates "saw landing page" with "fetched
  vCard" for abuse-signal simplicity; the event property
  `surface: 'landing' | 'vcard'` distinguishes if needed later).
- Atomic `view_count` increment (same SQL as `render-contact-vcard`).
  Note: a single user opening the landing then clicking "Save to
  Contacts" double-counts (2 events, 2 increments). This is desired
  — both are views.

**Idempotency**: not applicable (read-only from caller's perspective;
the view_count increment is the only write and double-counting is
acceptable).

---

## TypeScript types

Phase 6 codex copies the following into `src/types/contactCard.ts`
(or splits across `src/types/contactCard.ts` +
`supabase/functions/_shared/types.ts` per repo's existing type
convention — Phase B used both):

```ts
// ---------- Domain types ----------

export type TokenPolicy = 'multi_use' | 'single_use';

export interface CardSnapshot {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  address?: string;
  avatar_color?: string;
}

export interface ContactCard {
  id: string;                          // uuid
  sender_user_id: string;              // text (matches contacts.user_id)
  recipient_hint: string | null;
  recipient_user_id: string | null;    // uuid
  card_snapshot: CardSnapshot;
  intro_note: string | null;
  token_policy: TokenPolicy;
  is_forwardable: boolean;
  forwarded_from_card_id: string | null;
  expires_at: string | null;           // ISO 8601 timestamptz
  revoked_at: string | null;
  consumed_at: string | null;
  view_count: number;
  created_at: string;                  // ISO 8601 timestamptz
}

export interface CardSendBlock {
  blocked_by_user_id: string;          // uuid
  sender_user_id: string;              // text
  blocked_at: string;
}

// ---------- Derived view models ----------

export type SentCardStatus =
  | 'active'
  | 'viewed'
  | 'revoked'
  | 'expired';

export function deriveSentCardStatus(c: ContactCard): SentCardStatus {
  if (c.revoked_at) return 'revoked';
  if (c.expires_at && new Date(c.expires_at) < new Date()) return 'expired';
  if (c.view_count > 0) return 'viewed';
  return 'active';
}

export function canUnsend(c: ContactCard): boolean {
  if (c.revoked_at) return false;
  if (c.view_count > 0) return false;
  const ageMs = Date.now() - new Date(c.created_at).getTime();
  return ageMs < 30 * 60 * 1000;
}

// ---------- Edge function request / response types ----------

export interface CreateContactCardRequest {
  contact_id: string;
  recipient_hint: string;
  intro_note?: string;
  token_policy?: TokenPolicy;
  is_forwardable?: boolean;
  expires_at?: string | null;
  forwarded_from_card_id?: string;
}

export interface CreateContactCardResponse {
  id: string;
  share_url: string;
  recipient_user_id: string | null;
  email_sent: boolean;
}

export interface CreateContactCardBundleRequest {
  contact_ids: string[];               // >=2, <=100
  recipient_hints: string[];           // >=1
  intro_note?: string;
  is_forwardable?: boolean;
  expires_at?: string | null;
}

export interface CreateContactCardBundleResponse {
  bundle_id: string;
  cards_created: number;
  share_urls: Array<{
    contact_id: string;
    recipient_hint: string;
    card_id: string;
    share_url: string;
  }>;
}

export interface ContactCardErrorResponse {
  error: string;
  details?: string;
  retry_after_seconds?: number;
  blocked?: string[];
  max?: number;
}

// ---------- Bulk Accept (dedup-aware) ----------

export type DedupOutcome = 'added' | 'linked' | 'skipped';

export interface BulkAcceptResult {
  added: number;
  linked: number;
  skipped: number;
  per_card: Array<{
    card_id: string;
    outcome: DedupOutcome;
    new_contact_id?: string;
    possible_duplicate_of?: string;
  }>;
}
```

---

## Read patterns (for index justification cross-check)

| # | Query                                                                                                                | Used by                                  | Index relied on                                    |
|---|----------------------------------------------------------------------------------------------------------------------|------------------------------------------|----------------------------------------------------|
| 1 | `SELECT * FROM contact_cards WHERE sender_user_id=$1 ORDER BY created_at DESC LIMIT 50`                              | Sent Cards inbox (R-23)                  | `idx_contact_cards_sender_recent`                  |
| 2 | `SELECT count(*) FROM contact_cards WHERE sender_user_id=$1 AND created_at > now() - interval '24h'`                | Rate-limit check (R-21)                  | `idx_contact_cards_sender_recent`                  |
| 3 | `SELECT * FROM contact_cards WHERE recipient_user_id=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()) ORDER BY created_at DESC LIMIT 50` | Received inbox (R-8, R-9)                | `idx_contact_cards_recipient_user`                 |
| 4 | `SELECT id FROM contact_cards WHERE recipient_user_id IS NULL AND recipient_hint=$1`                                | Claim-on-signup (eager resolution rerun) | `idx_contact_cards_recipient_hint`                 |
| 5 | `WITH RECURSIVE chain AS (SELECT id FROM contact_cards WHERE id=$root UNION ALL SELECT cc.id FROM contact_cards cc JOIN chain ON cc.forwarded_from_card_id=chain.id) UPDATE contact_cards SET revoked_at=now() WHERE id IN (SELECT id FROM chain)` | Cascade revocation (R-17)                | `idx_contact_cards_chain`                          |
| 6 | `SELECT id, view_count, recipient_hint FROM contact_cards WHERE view_count > 50 AND created_at > now() - interval '1 hour'` | Internal abuse query (R-20)              | `idx_contact_cards_abuse_recent`                   |
| 7 | `SELECT 1 FROM card_send_blocks WHERE blocked_by_user_id=$1 AND sender_user_id=$2`                                  | Block-list check at create (R-19)        | PK on `card_send_blocks`                           |
| 8 | `SELECT * FROM contact_cards WHERE id=$token`                                                                        | Landing page / vCard render              | PK on `contact_cards`                              |

Every non-PK index above has a corresponding query in the table.

---

## Open question resolutions (from accord)

| # | Accord open question                                                       | Resolution adopted in this spec                                                                                                                                                                                              |
|---|----------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | Recipient resolution semantics for `recipient_hint`                        | **Eager**. `recipient_user_id uuid` nullable column on `contact_cards`. Set at create time when `recipient_hint` matches an `auth.users.email`. Future "claim on signup" runs a service-role UPDATE keyed by `recipient_hint`. |
| 2 | `card_snapshot` field whitelist                                            | Explicit whitelist (name, email, phone, company, title, address, avatar_color). Exclude notes/case_notes/private_notes/import_*/archived_at/is_vip/role. Enforced by shared serializer module, not DB constraint.            |
| 3 | Bundle recipient list ergonomics                                           | **Out of scope for schema** — vision agent owns. Schema accepts `string[]`; UI shape doesn't affect the data layer.                                                                                                          |
| 4 | Email open tracking opt-in/opt-out                                         | **Flag as needs-privacy-review**. Default: inherit existing `send-email` behavior (open tracking on if it's already on for other Pulse transactional mail). Changing it is a separate privacy decision, not a Phase C schema gate. |
| 5 | `go.pulse.logosvision.org` ownership / durability through qntmecos.com migration | **Flag as DevOps confirm**. Schema is host-agnostic — `share_url` is computed in edge function from a `PUBLIC_CARD_BASE_URL` env var. If the host flips later, only the env var changes; no migration required.            |
| 6 | Feature flag scope (UI-only vs UI + backend)                               | **UI-only flag, edge functions always deployed**. Matches Phase A pattern. `VITE_CONTACTS_PHASE_C_ENABLED` gates the React surfaces; the four edge functions deploy unconditionally. Anyone with a token can hit the public functions regardless of flag state. |

---

## Decisions still unresolved (escalate to user before Phase 6)

1. **Bundle rate-limit counting strategy.** This spec proposes a
   count-by-burst heuristic ("any 24h window with `>=2 inserts within
   1s` counts as a bundle") because there's no `bundle_id`-grouping
   column on `contact_cards`. The cleaner alternative is to add a
   nullable `bundle_id uuid` column on `contact_cards` so bundle
   membership is explicit. **Recommendation**: add the column.
   1-line schema addition; makes telemetry and rate-limit unambiguous.

2. **`contacts.user_id` cascade target.** `contact_cards.sender_user_id
   text REFERENCES auth.users(id)` works because `auth.users.id` IS a
   `uuid` cast to text at FK time — Postgres handles the implicit cast.
   But the `contacts` table itself doesn't FK on `user_id` (it's
   text), so deleting an auth user does NOT currently cascade-delete
   the user's contacts. Phase C `contact_cards.sender_user_id`
   cascades correctly (FK to `auth.users(id)`). **Recommendation**:
   leave as designed; the asymmetry is a pre-existing Pulse pattern,
   not a Phase C choice.

3. **`recipient_user_id` future RLS for claim-on-signup.** The
   `contact_cards_recipient_select` policy filters on
   `recipient_user_id = auth.uid()`. If a user signs up AFTER a card
   was sent to their email, the eager-resolution backfill (running
   as service role) sets their `recipient_user_id` post-hoc. Is that
   surprising? **Recommendation**: yes-but-acceptable. The behavior
   is: cards waiting on your email appear in your Received inbox the
   moment you sign up. That's the intended viral conversion behavior.
   Worth a one-line UI explainer ("These cards were waiting for you
   when you joined Pulse"), not a schema change.

4. **`expires_at < now()` evaluation in RLS.** The
   `contact_cards_recipient_select` policy includes
   `(expires_at IS NULL OR expires_at > now())`. `now()` is stable
   within a transaction, so a long-running React client query gets
   consistent results. But a card that expires DURING a session
   silently disappears from the recipient's app on refresh.
   **Recommendation**: acceptable. UI's R-24 banner gives 3-day
   warning; the edge case is rare.

5. **Bundle endpoint atomicity.** `create-contact-card-bundle`
   creates `N × M` rows. If row 47 of 50 fails (e.g. transient DB
   error), do we roll back the bundle or commit the 46 that
   succeeded? **Recommendation**: commit partial. Return the
   `share_urls` array with successes; failures are reported in an
   `errors: Array<{contact_id, recipient_hint, error}>` field on the
   response. Bundle creation is best-effort, not all-or-nothing.
   User-facing copy: "47 of 50 cards sent. 3 failed — retry?"

---

## Rollback considerations

**Single-statement rollback** (paste at the bottom of the migration as
a comment block for ops convenience):

```sql
-- ROLLBACK BLOCK (commented; uncomment + run as superuser):
-- BEGIN;
--   ALTER TABLE public.contacts DROP COLUMN IF EXISTS possible_duplicate_of;
--   DROP TABLE IF EXISTS public.card_send_blocks CASCADE;
--   DROP TABLE IF EXISTS public.contact_cards CASCADE;
-- COMMIT;
```

**Data preservation considerations**:

- `contact_cards.intro_note` contains user-authored text. A naive
  `DROP TABLE CASCADE` discards it. If Phase C is rolled back AFTER
  user content has been written, ops should dump
  `SELECT id, sender_user_id, recipient_hint, intro_note, created_at
  FROM contact_cards WHERE intro_note IS NOT NULL` to cold storage
  first. Phase 6 codex should add this as a runbook line, not a
  migration constraint.
- `card_snapshot` contains snapshotted contact data — same
  preservation logic applies (it's recipient-visible payload).
- `contacts.possible_duplicate_of` references — dropping the column
  loses the dedup-link flags from any bulk Accepts that already
  ran. Recipients keep the duplicate `contacts` rows (they were
  inserted, just unflagged), so no contact data is lost; only the
  "this might be a duplicate" hint vanishes.

**Irreversible aspects**:

- Resend transactional emails already sent to recipients cannot be
  un-sent. Rollback removes Pulse's ability to surface the cards,
  but recipients who saved the vCard already have the contact data
  in their device's address book.
- Universal Link / App Link `apple-app-site-association` +
  `assetlinks.json` deployment is a DevOps rollback (revert DNS +
  remove well-known JSON), separate from the database rollback.

**Recommended rollback gating**: keep the
`VITE_CONTACTS_PHASE_C_ENABLED` flag OFF in production for the first
72 hours post-deploy. A flag-off rollback is zero-DB-change and
restores the previous UX. Only consider a schema rollback if the
table itself is causing operational problems (RLS recursion,
write-amplification, etc.) — content rollback is what the feature
flag is for.

---

**End of Phase C schema spec.** Phase 6 codex consumes:
(1) the migration DDL in "Tables" + "Indexes" + "RLS policies",
(2) the four edge function contracts in "Edge functions",
(3) the TypeScript types verbatim. Open items in "Decisions still
unresolved" require a quick user-check before Phase 6 starts.
