// contactCard.ts
// Phase C contact-card sharing protocol — domain + edge-function types.
//
// Source-of-truth: docs/contacts-phase-c-schema-2026-05-18.md
// Backed by:       supabase/migrations/20260525000001_phase_c_contact_cards.sql
//
// Conventions:
//   - sender_user_id is TEXT (matches contacts.user_id) — strings here.
//   - recipient_user_id is uuid (auth.users.id) — strings here.
//   - timestamps are ISO 8601 strings (Postgres timestamptz over JSON).
//   - card_snapshot is whitelist-enforced server-side; CardSnapshot
//     interface mirrors the allowed-fields list exactly.

// ─── Domain types ────────────────────────────────────────────────────

export type TokenPolicy = 'multi_use' | 'single_use';

/**
 * Whitelisted contact fields that may be snapshotted into a card.
 * The create-contact-card edge function serializer enforces this list
 * server-side and refuses any other field. Notes / case_notes /
 * private_notes / import_* / archived_at / is_vip / role MUST NEVER
 * appear here per accord open Q#2 + handoff guardrail #10.
 */
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
  id: string;                          // uuid (also the share token)
  sender_user_id: string;              // text — matches contacts.user_id
  recipient_hint: string | null;       // email or Pulse user_id
  recipient_user_id: string | null;    // uuid; eager-resolved Pulse user
  card_snapshot: CardSnapshot;
  intro_note: string | null;
  token_policy: TokenPolicy;
  is_forwardable: boolean;
  forwarded_from_card_id: string | null;
  expires_at: string | null;           // ISO 8601 timestamptz
  revoked_at: string | null;
  consumed_at: string | null;          // set on first Accept of single_use
  view_count: number;
  created_at: string;                  // ISO 8601 timestamptz
}

export interface CardSendBlock {
  blocked_by_user_id: string;          // uuid
  sender_user_id: string;              // text
  blocked_at: string;                  // ISO 8601 timestamptz
}

// ─── Derived view models ─────────────────────────────────────────────

/**
 * Coarse status surfaced to the sender's Sent Cards inbox.
 *
 *   active   — created, not yet viewed, not revoked, not expired
 *   viewed   — at least one landing-page render has occurred
 *   revoked  — sender (or chain root) revoked or unsent
 *   expired  — expires_at has passed
 *
 * R-23 AC-23-3: sender UI surfaces only "Viewed" / "Not yet viewed";
 * numeric view_count is NOT exposed (R-20).
 */
export type SentCardStatus = 'active' | 'viewed' | 'revoked' | 'expired';

export function deriveSentCardStatus(c: ContactCard): SentCardStatus {
  if (c.revoked_at) return 'revoked';
  if (c.expires_at && new Date(c.expires_at) < new Date()) return 'expired';
  if (c.view_count > 0) return 'viewed';
  return 'active';
}

/**
 * R-16: "Unsend" button is rendered iff the card is <30 min old AND
 * has zero views; otherwise the sender sees "Revoke". Both write the
 * same revoked_at column.
 */
export function canUnsend(c: ContactCard): boolean {
  if (c.revoked_at) return false;
  if (c.view_count > 0) return false;
  const ageMs = Date.now() - new Date(c.created_at).getTime();
  return ageMs < 30 * 60 * 1000;
}

// ─── Edge function request / response types ──────────────────────────

export interface CreateContactCardRequest {
  contact_id: string;                  // uuid; sender's own contact row
  recipient_hint: string;              // email or Pulse user_id
  intro_note?: string;                 // <= 500 chars
  token_policy?: TokenPolicy;          // default 'multi_use'
  is_forwardable?: boolean;            // default true
  expires_at?: string | null;          // ISO 8601 timestamptz; default null
  forwarded_from_card_id?: string;     // uuid; only when forwarding
}

export interface CreateContactCardResponse {
  id: string;                          // uuid
  share_url: string;                   // https://go.pulse.logosvision.org/c/{id}
  recipient_user_id: string | null;    // eager-resolved Pulse user, if any
  email_sent: boolean;                 // true if Resend was invoked
}

export interface CreateContactCardBundleRequest {
  contact_ids: string[];               // 2..100
  recipient_hints: string[];           // >= 1
  intro_note?: string;                 // <= 500 chars (shared across cards)
  is_forwardable?: boolean;            // default true
  expires_at?: string | null;
  // token_policy is forced to 'multi_use' server-side (R-4).
}

export interface BundleCardEntry {
  contact_id: string;
  recipient_hint: string;
  card_id: string;
  share_url: string;
}

export interface BundleCardFailure {
  contact_id: string;
  recipient_hint: string;
  error: string;
}

export interface CreateContactCardBundleResponse {
  bundle_id: string;                   // synthetic uuid for telemetry
  cards_created: number;
  share_urls: BundleCardEntry[];
  failures?: BundleCardFailure[];      // populated on partial failure
}

/**
 * Structured error body returned by all four Phase C edge functions.
 * The `error` field is a stable enum string — UI maps it to a
 * localized message. `details` is a free-form human string for logs.
 */
export interface ContactCardErrorResponse {
  error: string;
  details?: string;
  retry_after_seconds?: number;
  blocked?: string[];
  max?: number;
  failures?: BundleCardFailure[];
}

// ─── Bulk Accept (dedup-aware) ───────────────────────────────────────

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

// ─── vCard rendering ─────────────────────────────────────────────────

export type VCardVersion = '3.0' | '4.0';
