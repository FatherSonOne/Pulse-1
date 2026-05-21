# Pulse Contacts Phase C — Accord Lite Spec (2026-05-18)

> Unified specification for the Phase C contact-card sharing protocol — Pulse-to-Pulse plus non-Pulse vCard delivery, Received inbox, forwarding, revocation, and bulk Accept.
> **Inputs**: magi verdict 2026-05-18 (`docs/contacts-phase-c-magi-verdict-2026-05-18.md`), Phase 1 Discovery (plea + echo + researcher), handoff doc 2026-05-18 (`docs/CONTACTS_OVERHAUL_HANDOFF_2026-05-18.md`).
> **Skipped**: L0 Vision (locked in handoff brief §4; this spec inherits Phase C goal "Bet the Future — contact-card sharing protocol with virality loops").
> **Scope mode**: Lite (per user request) — single-feature spec across 2 primary teams (Backend + Frontend) with Mobile / Data / DevOps participation.
> **Status**: Ready for Phase 5 schema + vision parallel work.

---

## L1 Requirements

Requirements are numbered `R-1`…`R-N` and trace to magi decisions (`D-1`…`D-12`) and Phase 1 personas (Maya, Ron, Aiko, Lee, Sasha, Adversarial Adam).

### Sender flow — creating and sharing a card

**R-1: Single-recipient card share with intro note.**
A Pulse user (Maya) shall be able to select one of their existing contacts and share that contact's card with one recipient (Pulse user or non-Pulse email). The share creation form includes a free-text intro note (default empty, max 500 chars). Maps to `D-1`, `D-8`. User impact: lets Maya warm-introduce one contact to one person in <3 taps.

**R-2: Per-share token policy toggle.**
The share-creation modal shall surface a "Make this link single-use" toggle, defaulted OFF (multi-use). When ON, the resulting `contact_cards` row is created with `token_policy = 'single_use'`. Maps to `D-10`. User impact: gives Maya/Lee a privacy lever for sensitive 1:1 shares; preserves Sasha/Aiko's default-multi-use for QR + broadcast cases.

**R-3: Per-share forwardability toggle.**
The share-creation modal shall surface an "Allow forwarding" toggle, defaulted ON. When OFF, the card's `is_forwardable = false`; recipients see no forward button and forward attempts return HTTP 403 at the edge function. Maps to `D-6`. User impact: lets Maya lock down sensitive intros while preserving Aiko's default-on viral path.

**R-4: Bulk card share (Sasha conference bundle).**
A Pulse user shall be able to select multiple contacts (≥2, ≤100) and share them as a bundle to one or more recipients via a dedicated bulk path. The bulk endpoint accepts a recipient list, an optional shared intro note, and a confirmation of total cards × recipients before sending. Bundle shares force `token_policy = 'multi_use'`. Maps to `D-7`. User impact: serves Sasha's 50-card conference scenario without forcing 50 sequential single shares.

**R-5: Send via existing native share sheet on mobile.**
On Capacitor (iOS / Android), the share-creation flow shall reuse `nativeShareService` + `@capacitor/share` to surface the OS share sheet with the canonical `https://go.pulse.logosvision.org/c/{token}` URL pre-populated. Maps to `D-1`, echo's "plumbing exists" finding. User impact: lets Maya share into iMessage / WhatsApp / Mail with the OS UX she already knows.

### Recipient flow — Pulse user receiving a card

**R-6: Universal Link / App Link resolution for installed Pulse clients.**
A `https://go.pulse.logosvision.org/c/{token}` URL opened on a device with Pulse installed shall route via Capacitor `App.addListener('appUrlOpen')` into the Received inbox card-detail view, bypassing the web fallback. Maps to `D-1`. User impact: Aiko / Maya tapping a shared link on their phone open Pulse, not a browser.

**R-7: Decoupled Accept — card vs sender connection.**
On Accept, the recipient shall see a single confirmation modal with two semantically distinct actions: (a) "Add [card subject display name] to my contacts" — primary, immutable; (b) "Also connect with [sender display name] on Pulse" — secondary checkbox, **default CHECKED**, recipient may uncheck. Both writes execute in the same transaction; sender-connect occurs only when checkbox is checked at confirm. Maps to `D-2`. User impact: respects Maya/Aiko's common-case ergonomic while honoring Lee's "I want the card, not the sender" boundary.

**R-8: Received inbox as 4th top-level Contacts tab.**
The Phase C Received inbox shall be implemented as a 4th top-level tab in the Contacts navigation (positioned right of existing tabs), labeled "Received" with a numeric badge showing count of unread + unprocessed cards (capped at "99+"). Badge uses `--pulse-coral-bg-12` (deliberate coral-budget exception, see Cross-cutting). Tab ships at Phase C launch behind feature flag `VITE_CONTACTS_PHASE_C_ENABLED`. Maps to `D-5`. User impact: serves Aiko's daily-arrival expectation with system-wide discoverability of pending cards.

**R-9: Bulk Accept with selection + dedup outcome summary.**
The Received tab shall support multi-select on incoming cards with a single Accept action that processes the selection. Per-card dedup outcomes follow `D-12`: no-match creates a new `contacts` row; match writes a new row with `possible_duplicate_of` FK pointing to the match (NEVER overwriting existing data); pre-Accept Skip option in the selection UI. Post-Accept summary shows `N added`, `M linked as possible duplicates`, `K skipped`, with a "Review duplicates" CTA leading to per-pair merge UI. Maps to `D-12`. User impact: lets Sasha process her 50-card pile in one summary screen rather than 50 modals.

### Recipient flow — non-Pulse user receiving a card

**R-10: Public landing page at canonical share URL.**
A `https://go.pulse.logosvision.org/c/{token}` URL opened in a browser without Pulse installed shall render a public landing page (no auth required) showing: card subject's display name verbatim (with `{`, `}`, `#` preserved per `contacts.user_id` policy), available card fields, sender display name (server-side-resolved per `D-1` Adversarial Adam defense), intro note text verbatim if present, "Save to Contacts" CTA, and "Get Pulse" CTA. Maps to `D-1`, `D-3`, `D-8`. User impact: Ron's success path — clear what he received, who sent it, how to keep it.

**R-11: Server-side vCard download with correct headers.**
The landing-page "Save to Contacts" CTA shall be an anchor (`<a href>`) targeting `render-contact-vcard` edge function (or equivalent route), which returns HTTP 200 with `Content-Type: text/vcard; charset=utf-8` and `Content-Disposition: attachment; filename="<sanitized-display-name>.vcf"`. `data:`-URI vCard delivery is FORBIDDEN. Maps to `D-3`. User impact: Ron taps "Save to Contacts" on Chrome iOS and the OS contacts sheet opens reliably (instead of failing per Chromium issue 604533).

**R-12: vCard 3.0 default with 4.0 content negotiation.**
The `render-contact-vcard` endpoint shall default to vCard 3.0 output with these properties stripped: `PHOTO`, `IMPP`, `RELATED`, `LANG`, `GENDER`, `KIND`, and any `X-*` vendor extensions. When the request includes `Accept: text/vcard; version=4.0`, the endpoint shall respond with vCard 4.0 formatted output (no strip-list applied). Display names with brace/hash characters MUST pass through verbatim in `FN` / `N` fields. The endpoint records requested version into telemetry for 2027+ default-flip review. Maps to `D-4`. User impact: Outlook 2019/2021 users (sales reps to enterprise) get clean imports; iOS/Android still work; future migration path stays open.

**R-13: Resend-delivered intro email at card-create time.**
On card creation with a recipient email address, the existing `send-email` edge function on `pulse.logosvision.org` shall deliver a transactional email with subject `<sender display name> shared a contact card with you` and a plain-text-with-minimal-HTML body containing: sender display name verbatim, intro note text (escaped plain text), canonical `https://go.pulse.logosvision.org/c/{token}` link, single-line "Save to contacts (no Pulse account needed)" CTA. No images, no external CSS, no tracking pixels beyond existing send-email infrastructure's open tracking. Maps to `D-8`. User impact: Maya's warm intro arrives in Ron's most-checked surface, not buried in an unopened app.

### Forwarding & revocation

**R-14: Forwarding creates new card rows with provenance chain.**
A recipient viewing a card with `is_forwardable = true` shall see a "Forward" action. Each forward creates a **new** `contact_cards` row (not parent token reuse), with `forwarded_from_card_id` FK pointing to the parent row. Forward attempts on cards with `is_forwardable = false` return HTTP 403 from the edge function (not client-side check alone). Maps to `D-6`. User impact: Aiko's "introduce X to Y" pattern preserved; provenance auditable; sensitive cards stay locked.

**R-15: Provenance line on forwarded card landing pages.**
The landing page for any card where `forwarded_from_card_id IS NOT NULL` shall render a single-sentence provenance line showing both the immediate-sender display name and the original-sender (chain-root) display name (e.g. "Aiko Tanaka is forwarding a card originally shared by Maya Chen"). Maps to `D-6`. User impact: Lee's transparency requirement honored; phishing forgery vector mitigated.

**R-16: Unsend (sender, ≤30 min, 0 views) vs Revoke (sender, anytime).**
Sender's Sent Cards inbox shall expose card-level actions: "Unsend" rendered for cards where `now() - created_at < 30 min AND view_count = 0`; "Revoke" rendered for all other unrevoked cards the sender owns. Both write `revoked_at = now()` to the same column. Distinction is linguistic only. Maps to `D-9`. User impact: Maya's "did I send to the wrong recipient?" remorse window is wider than the original 15-min sketch, with permanent revocation always available as a trust signal.

**R-17: Chain-cascade revocation semantics.**
Revocation by the chain-root sender shall cascade to all descendant `forwarded_from_card_id` rows in a single transaction. Revocation by a mid-chain forwarder revokes only their own subtree, never the root or sibling branches. Maps to `D-6`, `D-9`. User impact: Maya can unilaterally yank a leaked intro chain; Aiko's mid-chain revoke does not affect Maya's other forwards.

**R-18: Revoked cards return HTTP 410 Gone.**
All read endpoints (landing page render, vCard download, edge-function fetch, Pulse-app deeplink resolution) shall return HTTP 410 Gone for any card with `revoked_at IS NOT NULL`. Distinct from HTTP 404 (token never existed). Landing page for revoked cards shows generic "This contact card is no longer available" with no sender-name leak, no card-content leak. Maps to `D-1`, `D-9` Adversarial Adam UUID-probing defense. User impact: defends against Adam probing UUIDs to enumerate valid tokens; preserves recipient privacy on revoked content.

### Anti-abuse & rate limits

**R-19: Recipient-driven sender block list.**
A recipient shall be able to block any sender from sending them further cards. Implementation: `card_send_blocks` table with `(blocked_by_user_id, sender_user_id, blocked_at)` and unique index on `(blocked_by_user_id, sender_user_id)`. The `create-contact-card` and `create-contact-card-bundle` edge functions check this table; matched rows cause HTTP 403 response to sender. Maps to `D-7`. User impact: Lee can stop a sender mid-stream without resorting to email-level filtering.

**R-20: Silent view_count abuse signal.**
The `contact_cards` table shall maintain an atomic `view_count int NOT NULL DEFAULT 0` column incremented per landing-page render. View counts are surfaced to internal abuse monitoring only — **never to sender-side UI** (see Out-of-Scope §). Maps to `D-7`. User impact (internal): abuse detection (e.g., `view_count > 50 in 1h` likely indicates spam-vector forwarding) without leaking surveillance signal to senders.

**R-21: Per-sender daily rate limit (configurable).**
The `create-contact-card` edge function shall enforce a per-sender, per-24h-window send count limit. Default value: **50 cards/24h** for free tier (TODO: `phase-c-billing-coordination` — Billing pins final values). The rate-limit number is loaded from a config table (recommended: extend an existing per-feature config row or add `feature_limits` table), never hardcoded in the edge function, so Billing can flip values without migration. Maps to `D-7`. User impact: Aiko's 3-5/day flow safely under limit; Sasha routes through bulk endpoint (R-4) which has its own limit (100 cards/bundle, 1 bundle/24h default).

### Inbox + IA + Phase B cleanup

**R-22: Phase B "Share" CTA disambiguation.**
The `BulkActionToolbar` "Share" CTA currently in Phase B (resolves only to workspace-pool sharing) shall be addressed at Phase C ship time by **splitting into two CTAs**: "Share to workspace" (existing Phase B behavior, unchanged) and "Share via card" (new Phase C peer-share flow, calls the R-4 bulk path). Maps to echo Phase 1 dark-pattern finding; required by handoff guardrail. User impact: eliminates label-vs-behavior dark pattern; gives Sasha discoverable entry to bulk card share from existing multi-select.

**R-23: Sender Sent Cards inbox.**
A Pulse user shall be able to view a list of cards they have sent, with columns: card-subject display name, recipient hint (email or Pulse display name), sent-at timestamp, status (Active / Viewed / Revoked / Expired), view count (sender's own cards only — this is NOT the `view_count` privacy concern from R-20; sender seeing their own sent-card analytics is allowed in scope-narrow form: a coarse "Viewed" / "Not yet viewed" badge only, **NOT a numeric count**). Inline Unsend / Revoke actions per R-16. Maps to `D-9`. User impact: Maya / Sasha have an audit trail of what they sent and can act on it.

**R-24: Expiry semantics — hard cutoff + 3-day warning.**
The `contact_cards.expires_at` column (nullable, default NULL — most cards never expire) shall be hard-cutoff: `expires_at < now()` returns HTTP 410 Gone. The Received-inbox UI shall surface a non-dismissible warning banner on any card where `expires_at - now() < interval '3 days'`, displaying the exact expiry timestamp in recipient's local timezone. Sender-side expiry-setting UI shall default to "Never expires" with explicit opt-in to a time-bound expiry. **No grace period in the data model** — extend later as a single read-endpoint constant if telemetry justifies. Maps to `D-11`. User impact: Sasha sees an in-app warning before her deferred-Maybe cards vanish; the sender UI defaults don't punish the 90% never-expires case.

---

## L2 Team Detail

### Backend (Postgres schema + RLS + edge functions)

**Owns:** R-1 through R-21, R-23 (data side), R-24 (data side).

**Schema additions** (one migration file, e.g. `20260601000001_contact_card_sharing.sql`):

- **`contact_cards`** (new table):
  ```sql
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  sender_user_id text NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE  -- TEXT cast required
  recipient_hint text                       -- email or Pulse user_id; nullable
  card_snapshot jsonb NOT NULL              -- snapshot of contact fields at share time
  intro_note text                            -- max 500 chars, enforce in app + check constraint
  token_policy text NOT NULL DEFAULT 'multi_use' CHECK (token_policy IN ('multi_use','single_use'))
  is_forwardable boolean NOT NULL DEFAULT true
  forwarded_from_card_id uuid REFERENCES contact_cards(id) ON DELETE SET NULL
  expires_at timestamptz                     -- nullable, default NULL
  revoked_at timestamptz                     -- nullable, default NULL
  view_count int NOT NULL DEFAULT 0
  consumed_at timestamptz                    -- single-use marker, set on first Accept
  created_at timestamptz NOT NULL DEFAULT now()
  ```
  Indexes: `(sender_user_id, created_at DESC)` for Sent inbox; `(recipient_hint)` for Received inbox lookup; `(forwarded_from_card_id)` for chain traversal.

- **`card_send_blocks`** (new table):
  ```sql
  blocked_by_user_id text NOT NULL
  sender_user_id text NOT NULL
  blocked_at timestamptz NOT NULL DEFAULT now()
  UNIQUE (blocked_by_user_id, sender_user_id)
  ```

- **`contacts`** (alter — single column):
  ```sql
  ALTER TABLE contacts ADD COLUMN possible_duplicate_of uuid REFERENCES contacts(id) ON DELETE SET NULL;
  ```

**RLS policies on `contact_cards`** (all cast `auth.uid()::text`; leave `-- TODO(phase-7): replace with user_has_permission('cards.send')` at each policy site):

- `contact_cards_sender_owner` — sender can SELECT / UPDATE (revoke only) / DELETE their own cards. `USING (sender_user_id = auth.uid()::text)`.
- `contact_cards_recipient_read` — Pulse-user recipient can SELECT cards where `recipient_hint` matches their auth identity (email or user_id). `USING (recipient_hint IN (SELECT email FROM auth.users WHERE id = auth.uid()::text) OR recipient_hint = auth.uid()::text)`.
- `contact_cards_public_read_by_token` — landing-page rendering does NOT use RLS — uses edge-function service role with explicit `id` + `revoked_at IS NULL` + `(expires_at IS NULL OR expires_at > now())` predicate. Document this in policy comments.

**RLS on `card_send_blocks`**: owner-only (recipient who created the block).

**Edge functions** (Deno runtime, four new functions):

1. **`create-contact-card`** — single-card create. Validates: sender authenticated, recipient hint format, rate limit (R-21) via SQL count `SELECT count(*) FROM contact_cards WHERE sender_user_id = $1 AND created_at > now() - interval '24h'`, block-list check (R-19). On success: insert row, return `id` + canonical URL. Optionally fan out to `send-email` if `recipient_hint` is an email (R-13).
2. **`create-contact-card-bundle`** — bulk create. Accepts `card_subject_ids[]` (≤100), `recipient_hints[]`, optional `intro_note`. Forces `token_policy = 'multi_use'`. Enforces bundle-rate-limit (default 100 cards × N recipients, 1 bundle/24h, configurable per R-21).
3. **`render-contact-vcard`** — public, no auth. Reads `card_snapshot` by `id` token. Returns 410 if revoked / expired. Returns 410 if single-use and `consumed_at IS NOT NULL`. Negotiates vCard 3.0 default vs 4.0 on `Accept` header (R-12). Sets `Content-Type` + `Content-Disposition` headers. Increments `view_count` atomically.
4. **`resolve-card-deeplink`** — public, no auth. Renders landing page server-side; JOINs `contact_cards` to `auth.users` for sender display name (never trusts URL params per Adversarial Adam, `D-1`). Returns 410 on revoked / expired. Renders forwarding provenance line per R-15.

**Sub-PR 7 deferral**: every policy and every permission check site that would eventually call `user_has_permission('cards.send')` gets a `TODO(phase-7)` comment. Phase C uses `auth.uid()` owner-check inline.

**Dependencies**: none external. Reuses `send-email` (R-13), Phase B `workspace_contacts` dedup matcher for R-9.

---

### Frontend (React components + state)

**Owns:** R-1, R-2, R-3, R-5 (UI surfaces), R-7, R-8, R-9, R-15 (display), R-16, R-22, R-23, R-24 (UI banner).

**New components** (recommended file layout under `src/components/contacts/cards/`):

- `ShareCardModal.tsx` — single-card share creation. Recipient input (email or Pulse-user picker), intro-note textarea (500-char counter), token-policy toggle, forwardability toggle, expiry picker (default "Never expires"). Triggers `cardService.createCard()`. Owns R-1, R-2, R-3, R-24 (sender side).
- `ShareCardBundleModal.tsx` — bulk path entry from `BulkActionToolbar` "Share via card" CTA. Confirms `N cards × M recipients`. Owns R-4.
- `ReceivedInboxTab.tsx` — 4th top-level tab content. Lists incoming cards, supports multi-select, exposes bulk Accept. Owns R-8, R-9.
- `ReceivedCardDetail.tsx` — single received-card view. Shows card subject, sender display name, intro note, provenance line if `forwarded_from_card_id`. "Accept" button surfaces the R-7 confirmation modal. Owns R-7, R-15.
- `AcceptCardModal.tsx` — R-7 confirmation. Two action rows; primary immutable, secondary default-checked toggle. Owns R-7.
- `SentCardsList.tsx` — sender's audit list. Inline Unsend / Revoke actions per R-16. Owns R-23, R-16.
- `ExpiryWarningBanner.tsx` — small non-dismissible banner on `ReceivedCardDetail` when `expires_at - now() < 3 days`. Owns R-24 (recipient side).
- `CardProvenanceLine.tsx` — single-line "Aiko is forwarding Maya's card" component, reused in landing page + in-app detail. Owns R-15.

**New service**: `src/services/contactCardService.ts` — thin client over four edge functions; uses existing service-role-key-free anon pattern.

**Modifications to existing components**:

- `src/components/contacts/ContactsRedesigned.tsx` — register 4th tab when `VITE_CONTACTS_PHASE_C_ENABLED`; badge query against `contact_cards` recipient-read view. R-8.
- `src/components/contacts/BulkActionToolbar.tsx` — split "Share" CTA into "Share to workspace" + "Share via card" per R-22.
- `src/components/contacts/ContactDetail.tsx` — add "Share via card" action on individual contact detail view; opens `ShareCardModal`.

**Design tokens** (per Pulse guardrail #2 — no new global tokens):
- Reuse `--pulse-coral-bg-12` for Received-tab unread badge (R-8 coral-budget exception).
- Reuse Phase A `.ps-provenance-dot[data-source=...]` variants for sender-source indicators on received cards (e.g. `data-source="card"`).
- All chrome via existing `--pulse-*` tokens.

**i18n** (per Phase A + Phase B pattern): add new top-level `cards` group in `src/i18n/locales/en.json` containing nested groups: `share/shareBundle/receivedTab/receivedDetail/acceptModal/sentList/expiryBanner/provenance`. Keys are disjoint from existing Phase A / Phase B groups. Initial keys: English only; downstream locales fall back to English per existing pattern.

**Dependencies**: Backend R-1..R-21 edge functions stable; Mobile R-6 deeplink handler wired for in-app navigation.

---

### Mobile (Capacitor App plugin + Universal Links / App Links + native share)

**Owns:** R-5, R-6.

**iOS Universal Links setup** (DevOps publishes; Mobile wires):
- Host `apple-app-site-association` JSON at `https://go.pulse.logosvision.org/.well-known/apple-app-site-association` with `applinks` matching `/c/*` pattern and the Pulse iOS bundle ID + team ID.
- Update Xcode project capabilities to include the `go.pulse.logosvision.org` domain.

**Android App Links setup** (DevOps publishes; Mobile wires):
- Host Digital Asset Links JSON at `https://go.pulse.logosvision.org/.well-known/assetlinks.json` with the Pulse Android package + SHA-256 fingerprint.
- Update `AndroidManifest.xml` intent filter to autoVerify on the `go.pulse.logosvision.org` host with `/c/*` path pattern.

**Capacitor wiring**: Extend `App.addListener('appUrlOpen')` handler (already configured for other Pulse deeplinks per handoff context) to recognize `https://go.pulse.logosvision.org/c/{token}` URLs and route into `ReceivedInboxTab` → `ReceivedCardDetail` with `token` param. R-6.

**Native share sheet**: `ShareCardModal` (R-5) calls existing `nativeShareService.shareUrl(canonicalUrl, title)` after a successful `cardService.createCard()`. Echo's Phase 1 finding confirmed `@capacitor/share` is already integrated; no new plugin work.

**Retain `pulse://` custom scheme** for in-app internal navigation only (e.g. notification-tap → card detail). MUST NOT appear in any user-shareable artifact.

**Dependencies**: DevOps R-DevOps-1 (DNS + AASA/assetlinks JSON deployment) before iOS / Android intent verification works.

---

### Data (telemetry + view_count surfacing)

**Owns:** Internal telemetry for R-20, R-12 vCard-version tracking, R-21 rate-limit observability.

**Telemetry surfaces** (write to existing `pulse_events` table or Phase C-scoped equivalent; no new analytics infra):

- `card.created` — per insert; properties: `sender_user_id`, `token_policy`, `is_forwardable`, `has_intro_note bool`, `bundle_size int` (1 for single, ≥2 for bundle).
- `card.viewed` — per landing-page render; properties: `card_id`, `is_revoked bool`, `is_expired bool`, `vcard_version_requested int`. Drives R-20 abuse signal.
- `card.accepted` — per Accept confirmation; properties: `recipient_user_id`, `connected_with_sender bool` (R-7 checkbox state).
- `card.revoked` — per `revoked_at` write; properties: `is_unsend bool` (computed: created_at within 30 min AND view_count = 0), `cascade_count int`.
- `card.forwarded` — per forward insert; properties: `chain_depth int`.
- `card.rate_limited` — per HTTP 403 from rate-limit; properties: `sender_user_id`, `limit_type` ('per_sender_daily' | 'bundle_daily').

**view_count as abuse signal**: Data team owns an internal-only query (no UI exposure): `SELECT id, view_count, recipient_hint, created_at FROM contact_cards WHERE view_count > 50 AND created_at > now() - interval '1 hour'` — surface to abuse-monitoring channel. Not productized as a sender-visible feature in Phase C.

**Dependencies**: Backend R-1..R-21 emit the events; Data writes the dashboards / abuse queries.

---

### DevOps (DNS, hosting, headers for the Universal / App Links payload + edge function deploy)

**Owns:** Hosting `apple-app-site-association` + `assetlinks.json` on `go.pulse.logosvision.org`.

**R-DevOps-1: Subdomain provisioning.**
Provision `go.pulse.logosvision.org` (CNAME or A record per existing Pulse DNS pattern). TLS via existing wildcard or Let's Encrypt. Must serve over HTTPS with no redirect chain (iOS / Android associate-domain verification fails on redirects).

**R-DevOps-2: Well-known JSON hosting.**
Serve at exactly:
- `https://go.pulse.logosvision.org/.well-known/apple-app-site-association` (`Content-Type: application/json`, no `.json` extension on URL — iOS requirement).
- `https://go.pulse.logosvision.org/.well-known/assetlinks.json` (`Content-Type: application/json`).

Both endpoints must return HTTP 200 with no auth, no redirects.

**R-DevOps-3: Path routing.**
`https://go.pulse.logosvision.org/c/{token}` resolves to the `resolve-card-deeplink` edge function (or to a static page that subsequently calls the edge function — implementation choice owned by DevOps + Backend jointly).

**R-DevOps-4: Edge function deployment.**
Deploy the four new edge functions (`create-contact-card`, `create-contact-card-bundle`, `render-contact-vcard`, `resolve-card-deeplink`) per existing Supabase edge-function pipeline. Service-role key format: `sb_secret_*` (41 chars) per guardrail.

**Dependencies**: none — DevOps work is the first dependency for Mobile (R-6 iOS / Android verification) and Backend (R-11 landing-page URL routing).

---

## L3 Acceptance Criteria

ACs are numbered `AC-N-M` (requirement N, criterion M). Verification method follows in brackets: `[Vitest]`, `[Playwright]`, `[Manual-iOS]`, `[Manual-Android]`, `[Code-inspection]`, `[Supabase-SQL]`.

### R-1 — Single-recipient card share with intro note

- **AC-1-1** Given a user with ≥1 contact, when they open `ShareCardModal` with a contact pre-selected and an empty intro note, then the "Send" button is enabled. [Playwright]
- **AC-1-2** Given the user types 500 characters into the intro note, when they type one more character, then input is rejected (visible counter + disabled keystroke). [Vitest unit on the textarea component]
- **AC-1-3** Given a successful send, when the response returns 201, then a `contact_cards` row exists with the sender's `user_id`, recipient hint set, and `intro_note` matching the input. [Supabase-SQL fixture round-trip]
- **AC-1-4** Given the recipient is a non-Pulse email, when the card is created, then a Resend email is triggered via `send-email` within 5s (verified by `send-email` log line). [Code-inspection + manual smoke]

### R-2 — Per-share token policy toggle

- **AC-2-1** Given the toggle is OFF (default), when the card is created, then `contact_cards.token_policy = 'multi_use'`. [Supabase-SQL]
- **AC-2-2** Given the toggle is ON, when the card is created, then `contact_cards.token_policy = 'single_use'`. [Supabase-SQL]
- **AC-2-3** Given a `single_use` card, when the same token is Accepted twice (two separate Pulse-recipient sessions), then the second Accept returns HTTP 410 and the second `contacts` row is NOT created. [Vitest integration against local Supabase]
- **AC-2-4** Given a `single_use` card, when the landing page is rendered (no Accept), then the card is NOT marked consumed (`consumed_at IS NULL`). [Vitest]

### R-3 — Per-share forwardability toggle

- **AC-3-1** Given a card with `is_forwardable = true`, when a recipient opens the detail view, then the "Forward" action is rendered. [Playwright]
- **AC-3-2** Given a card with `is_forwardable = false`, when a recipient opens the detail view, then no "Forward" action is rendered. [Playwright]
- **AC-3-3** Given a card with `is_forwardable = false`, when a recipient nevertheless POSTs to `create-contact-card` with `forwarded_from_card_id` pointing to it, then the edge function returns HTTP 403 (client-side hiding is not the only gate). [Vitest integration]

### R-4 — Bulk card share

- **AC-4-1** Given the user selects 2 contacts via `BulkActionToolbar` and clicks "Share via card", then `ShareCardBundleModal` opens with `2 cards × N recipients` confirmation. [Playwright]
- **AC-4-2** Given the user attempts to send a bundle of 101 cards, when they click confirm, then a client-side validation error blocks the send (101 > 100 limit). [Vitest]
- **AC-4-3** Given a successful bundle send, when responses return, then `cards.created.length === recipients.length × subjects.length` `contact_cards` rows exist, all with `token_policy = 'multi_use'`. [Supabase-SQL]
- **AC-4-4** Given a user who has already sent 1 bundle in the last 24h, when they attempt a second bundle, then `create-contact-card-bundle` returns HTTP 429 with a rate-limit body. [Vitest integration]

### R-5 — Native share sheet

- **AC-5-1** On iOS, when the user taps "Share via native sheet" after card create, then the iOS share sheet appears with the canonical URL as the share payload. [Manual-iOS]
- **AC-5-2** On Android, when the user taps "Share via native sheet" after card create, then the Android share intent appears with the canonical URL. [Manual-Android]

### R-6 — Universal Link / App Link resolution

- **AC-6-1** On iOS with Pulse installed, when the user taps `https://go.pulse.logosvision.org/c/{token}` in Mail, then Pulse opens directly to `ReceivedCardDetail` for that token. [Manual-iOS]
- **AC-6-2** On Android with Pulse installed, when the user taps the same URL in Gmail, then Pulse opens directly to `ReceivedCardDetail`. [Manual-Android]
- **AC-6-3** On iOS without Pulse installed, when the user taps the URL in Mail, then Safari loads the public landing page. [Manual-iOS]
- **AC-6-4** Capacitor `App.addListener('appUrlOpen')` is wired to recognize URLs matching `^https://go\.pulse\.logosvision\.org/c/[a-zA-Z0-9-]+$`. [Code-inspection]

### R-7 — Decoupled Accept

- **AC-7-1** Given an open `AcceptCardModal`, when the modal renders, then the "Add to my contacts" row has no checkbox (immutable primary action). [Playwright]
- **AC-7-2** Given an open `AcceptCardModal`, when the modal renders, then the "Also connect with [sender] on Pulse" row has a checkbox that is **checked by default**. [Playwright]
- **AC-7-3** Given the user unchecks the second action and clicks Confirm, when the request completes, then a `contacts` row exists for the card subject AND no peer-connection write occurred for the sender. [Supabase-SQL]
- **AC-7-4** Given the user keeps both actions and clicks Confirm, when the request completes, then a `contacts` row exists AND the sender appears in the recipient's peer list. [Supabase-SQL]

### R-8 — Received inbox as 4th top-level tab

- **AC-8-1** When `VITE_CONTACTS_PHASE_C_ENABLED=true` and Contacts loads, then a 4th tab labeled "Received" appears in the contacts nav. [Playwright]
- **AC-8-2** When `VITE_CONTACTS_PHASE_C_ENABLED=false`, then no 4th tab appears. [Playwright]
- **AC-8-3** Given 5 unread cards for the recipient, when the Contacts page renders, then the tab badge shows `5`. [Playwright]
- **AC-8-4** Given 150 unread cards, when the tab renders, then the badge shows `99+`. [Playwright]
- **AC-8-5** The badge background uses CSS variable `--pulse-coral-bg-12`. [Code-inspection on the badge component CSS]

### R-9 — Bulk Accept with dedup

- **AC-9-1** Given 3 cards in the Received tab, when the user selects all 3 and clicks "Accept selected", then a single transaction processes all 3. [Vitest integration]
- **AC-9-2** Given a card whose subject's normalized email matches an existing contact, when bulk Accept runs, then a new `contacts` row is inserted with `possible_duplicate_of` pointing to the existing match (existing match row is NOT mutated). [Supabase-SQL]
- **AC-9-3** Given a card the user pre-Skips via the selection checkbox, when bulk Accept runs, then no `contacts` row is created for that card and the summary shows it in `K skipped`. [Vitest]
- **AC-9-4** Given the bulk Accept summary screen, when displayed, then it shows three numeric counts ("N added / M linked / K skipped") and a "Review duplicates" CTA visible when `M > 0`. [Playwright]
- **AC-9-5** The dedup matcher reuses the Phase B `workspace_contacts` normalized-email + normalized-phone + name-fingerprint logic. [Code-inspection: import path matches Phase B service]

### R-10 — Public landing page

- **AC-10-1** Given a valid, unrevoked, unexpired card token, when an unauthenticated browser loads `/c/{token}`, then the page renders card subject, sender display name, intro note, "Save to Contacts" CTA, "Get Pulse" CTA. [Playwright headless]
- **AC-10-2** Given a card subject's display name is `{Lucca} Messana`, when the landing page renders, then the displayed name is exactly `{Lucca} Messana` with braces preserved. [Playwright]
- **AC-10-3** Given a malicious URL with `?sender=Maya+Chen` query param, when the landing page renders, then the sender name shown is the server-side-joined value from `auth.users`, NOT the URL param. [Vitest + code-inspection of `resolve-card-deeplink`]

### R-11 — Server-side vCard download

- **AC-11-1** When `GET /api/render-contact-vcard/{token}` returns successfully, then the response has `Content-Type: text/vcard; charset=utf-8` and `Content-Disposition: attachment; filename="<sanitized-name>.vcf"`. [Vitest integration]
- **AC-11-2** No `data:text/vcard` URI appears in any client-side React component or HTML template. [Code-inspection: ripgrep `'data:text/vcard'` returns no matches in `src/`]
- **AC-11-3** Given a Chrome iOS browser tapping "Save to Contacts" on the landing page, then the OS Contacts sheet opens. [Manual-iOS on Chrome]

### R-12 — vCard 3.0 default with 4.0 negotiation

- **AC-12-1** When the endpoint receives a request with no `Accept` header, then the response body begins with `BEGIN:VCARD\r\nVERSION:3.0`. [Vitest integration on edge function]
- **AC-12-2** When the endpoint receives `Accept: text/vcard; version=4.0`, then the response body begins with `BEGIN:VCARD\r\nVERSION:4.0`. [Vitest]
- **AC-12-3** When a 3.0 response is generated, then the body contains none of: `PHOTO`, `IMPP`, `RELATED`, `LANG`, `GENDER`, `KIND`, or any `X-` prefix line. [Vitest]
- **AC-12-4** When a name with brace characters is in `card_snapshot`, then the `FN:` and `N:` lines in the vCard contain the braces verbatim, escaped per vCard spec for newlines/commas only. [Vitest]
- **AC-12-5** The endpoint writes a `card.viewed` event with `vcard_version_requested` set to 3 or 4 per request. [Supabase-SQL on `pulse_events`]

### R-13 — Resend intro email

- **AC-13-1** Given a card create with non-Pulse `recipient_hint` email, when `create-contact-card` returns, then `send-email` is invoked with `to=recipient_hint`, subject `<sender display name> shared a contact card with you`. [Code-inspection + log-trace]
- **AC-13-2** The email body contains the canonical URL `https://go.pulse.logosvision.org/c/{token}`. [Vitest on email template render]
- **AC-13-3** The email body contains no `<img>` tags, no external `<link rel="stylesheet">`, no `<script>` tags. [Vitest on email template render]
- **AC-13-4** The email body renders intro note text escaped (no HTML interpretation). [Vitest: input `<b>hi</b>` renders as literal `<b>hi</b>` text]

### R-14 — Forwarding creates new card rows

- **AC-14-1** Given a card with `is_forwardable = true`, when a recipient forwards it, then a new `contact_cards` row is created with `forwarded_from_card_id = parent_id`. [Supabase-SQL]
- **AC-14-2** Given a card with `is_forwardable = false`, when the recipient POSTs forward, then HTTP 403 is returned and no row is created. [Vitest integration]
- **AC-14-3** Given a 3-level forward chain (A→B→C), when row C is created, then `forwarded_from_card_id = B.id` (not A.id — only immediate parent). [Supabase-SQL]

### R-15 — Provenance line on forwarded cards

- **AC-15-1** Given a card with `forwarded_from_card_id IS NOT NULL`, when the landing page renders, then a single-line provenance string appears in the page, mentioning both the immediate-sender display name and the chain-root display name. [Playwright]
- **AC-15-2** Given a non-forwarded card, when the landing page renders, then no provenance line appears. [Playwright]

### R-16 — Unsend vs Revoke

- **AC-16-1** Given a card sent 5 minutes ago with `view_count = 0`, when the sender views Sent Cards, then the action button is labeled "Unsend". [Playwright]
- **AC-16-2** Given a card sent 5 minutes ago with `view_count = 1`, when the sender views Sent Cards, then the action button is labeled "Revoke". [Playwright]
- **AC-16-3** Given a card sent 35 minutes ago with `view_count = 0`, when the sender views Sent Cards, then the action button is labeled "Revoke". [Playwright]
- **AC-16-4** Given either button is clicked, when the action completes, then `revoked_at` is set to current time (the column written is the same regardless of label). [Supabase-SQL]

### R-17 — Chain-cascade revocation

- **AC-17-1** Given a 3-level chain (A→B→C, same root sender on A), when the chain-root sender revokes A, then `revoked_at IS NOT NULL` on A, B, and C — all in one transaction. [Supabase-SQL with transactional fixture]
- **AC-17-2** Given a 3-level chain (A→B→C), when the B-level forwarder revokes B, then `revoked_at IS NOT NULL` on B and C only; A is untouched. [Supabase-SQL]
- **AC-17-3** Given a tree with two B-level forks (A→B1, A→B2), when forwarder of B1 revokes B1, then B2 is unaffected. [Supabase-SQL]

### R-18 — HTTP 410 Gone semantics

- **AC-18-1** When any read endpoint is called with a token where `revoked_at IS NOT NULL`, then the HTTP status is 410, not 404. [Vitest integration on each endpoint]
- **AC-18-2** When any read endpoint is called with a token where `expires_at < now()`, then the HTTP status is 410. [Vitest]
- **AC-18-3** When a 410 landing page is rendered, then the body shows only "This contact card is no longer available" and contains no sender display name and no card-subject fields. [Playwright + body-contains assertions]
- **AC-18-4** When any read endpoint is called with a token that has never existed (random UUID), then the HTTP status is 404. [Vitest]

### R-19 — Block list

- **AC-19-1** Given a `card_send_blocks` row for `(blocked_by=A, sender=B)`, when sender B calls `create-contact-card` with recipient_hint resolving to user A, then HTTP 403 is returned and no row is created. [Vitest integration]
- **AC-19-2** Given the same block row, when sender B calls `create-contact-card-bundle` including A in the recipient list, then HTTP 403 is returned. [Vitest]
- **AC-19-3** A unique index exists on `card_send_blocks(blocked_by_user_id, sender_user_id)`. [Supabase-SQL `\d card_send_blocks`]

### R-20 — view_count abuse signal

- **AC-20-1** Each landing-page render increments `view_count` by exactly 1 (atomic per request). [Vitest race-test: 10 concurrent renders → final count = 10]
- **AC-20-2** No React component or service in `src/` reads `view_count` and surfaces it to a sender-facing UI. [Code-inspection: ripgrep `view_count` in `src/components/` returns no matches in sender views]
- **AC-20-3** A `card.viewed` event is emitted per render with the card's current `view_count` value. [Supabase-SQL `pulse_events` row check]

### R-21 — Per-sender rate limit

- **AC-21-1** Given a sender who has created 50 cards in the last 24h, when they create card #51, then `create-contact-card` returns HTTP 429. [Vitest integration with time-traveled fixtures]
- **AC-21-2** The rate-limit numeric value (50/day default) is read from a config source, not a hardcoded constant. [Code-inspection on edge function]
- **AC-21-3** A `card.rate_limited` event is emitted on every 429 with `limit_type='per_sender_daily'`. [Supabase-SQL]

### R-22 — Phase B "Share" CTA disambiguation

- **AC-22-1** In `BulkActionToolbar`, when the user selects ≥1 contact, then the action area shows two distinct CTAs: "Share to workspace" and "Share via card". [Playwright]
- **AC-22-2** Clicking "Share to workspace" opens the Phase B `WorkspaceShareModal` (existing behavior unchanged). [Playwright]
- **AC-22-3** Clicking "Share via card" opens `ShareCardBundleModal`. [Playwright]

### R-23 — Sent Cards inbox

- **AC-23-1** Given a sender with ≥1 sent card, when they open Sent Cards, then a row appears per `contact_cards` row they own. [Playwright]
- **AC-23-2** Each row shows a coarse status: "Active" / "Viewed" / "Revoked" / "Expired" — derived from `revoked_at`, `expires_at`, and `view_count > 0`. [Vitest on status-derive util]
- **AC-23-3** Sent Cards rows show only a "Viewed" / "Not yet viewed" badge — NOT a numeric view count. [Code-inspection on the row component]

### R-24 — Expiry semantics

- **AC-24-1** Sender-side expiry picker defaults to "Never expires". [Playwright]
- **AC-24-2** Given a card with `expires_at = now() + 2 days`, when the recipient opens its detail view, then the `ExpiryWarningBanner` is visible and non-dismissible. [Playwright]
- **AC-24-3** Given a card with `expires_at = now() + 5 days`, when the recipient opens its detail view, then no warning banner is shown. [Playwright]
- **AC-24-4** Given a card with `expires_at = now() - 1 hour`, when any read endpoint is called, then HTTP 410 is returned. [Vitest]

---

## Traceability matrix

| R-N | Magi decisions | Owning team(s) | AC IDs |
|---|---|---|---|
| R-1 | D-1, D-8 | Backend, Frontend | AC-1-1 … AC-1-4 |
| R-2 | D-10 | Backend, Frontend | AC-2-1 … AC-2-4 |
| R-3 | D-6 | Backend, Frontend | AC-3-1 … AC-3-3 |
| R-4 | D-7 | Backend, Frontend | AC-4-1 … AC-4-4 |
| R-5 | D-1 (mobile surface) | Mobile, Frontend | AC-5-1, AC-5-2 |
| R-6 | D-1 | Mobile, DevOps | AC-6-1 … AC-6-4 |
| R-7 | D-2 | Frontend, Backend | AC-7-1 … AC-7-4 |
| R-8 | D-5 | Frontend | AC-8-1 … AC-8-5 |
| R-9 | D-12 | Backend, Frontend | AC-9-1 … AC-9-5 |
| R-10 | D-1, D-3, D-8 | Backend, Frontend | AC-10-1 … AC-10-3 |
| R-11 | D-3 | Backend | AC-11-1 … AC-11-3 |
| R-12 | D-4 | Backend, Data | AC-12-1 … AC-12-5 |
| R-13 | D-8 | Backend | AC-13-1 … AC-13-4 |
| R-14 | D-6 | Backend | AC-14-1 … AC-14-3 |
| R-15 | D-6 | Frontend, Backend | AC-15-1, AC-15-2 |
| R-16 | D-9 | Backend, Frontend | AC-16-1 … AC-16-4 |
| R-17 | D-6, D-9 | Backend | AC-17-1 … AC-17-3 |
| R-18 | D-1, D-9 | Backend | AC-18-1 … AC-18-4 |
| R-19 | D-7 | Backend | AC-19-1 … AC-19-3 |
| R-20 | D-7 | Backend, Data | AC-20-1 … AC-20-3 |
| R-21 | D-7 | Backend, Data | AC-21-1 … AC-21-3 |
| R-22 | echo Phase 1 finding | Frontend | AC-22-1 … AC-22-3 |
| R-23 | D-9 | Frontend, Backend | AC-23-1 … AC-23-3 |
| R-24 | D-11 | Backend, Frontend | AC-24-1 … AC-24-4 |

**Traceability coverage**: 24 requirements / 24 requirements with ≥1 magi-decision or Phase 1 finding linkage = **100%** (well above Lite-mode 70% threshold). All 24 requirements have ≥2 ACs.

---

## Assumptions & deferrals

This section captures each of magi's 6 open items plus assumptions accord introduced.

### A-1 — Decision #5 4th-tab activation lift (ASSUMPTION)

Magi medium-confidence verdict locked the 4th top-level tab. This spec **assumes** that activation lift will exceed the 5% threshold cited in magi's dissent footnote. **Flag for re-evaluation**: 60 days after Phase C launch, if Received-tab unique-daily-opens / Contacts-page unique-daily-opens < 5%, demote to People-tab subview. The feature flag `VITE_CONTACTS_PHASE_C_ENABLED` makes the demotion a config change, not a refactor.

### A-2 — Decision #7 rate-limit values (ASSUMPTION pinned for Phase 5)

This spec **assumes** the default values **50 cards/24h per sender** (free tier) and **100 cards × 1 bundle/24h per sender** (free tier bulk). Both numbers are **TODO(phase-c-billing-coordination)** and must be confirmed with Billing before Phase C ships. Schema design (config-table-driven, not hardcoded — R-21 AC-21-2) means Billing can flip these without migration.

### A-3 — Decision #10 share-modal copy refinement (DEFERRAL)

Magi noted "Make this link single-use" toggle copy is functional but flat. **Deferred to Phase 6 polish** (alongside whoever owns Pulse copy). Not blocking accord — the toggle behavior is what's locked here, not its label text.

### A-4 — view_count privacy boundary (OUT-OF-SCOPE explicit)

`view_count` is silent abuse signal only in Phase C. Sender-side UI exposure (e.g. "Maya can see Priya viewed her card 4 times") is **explicitly out of scope** for Phase C — R-23 AC-23-3 enforces a binary "Viewed / Not yet viewed" badge instead. A separate decision (privacy + brand review) is required before any future numeric exposure.

### A-5 — vCard 4.0 default-flip timing (DEFERRAL to 2027 Q1 calendar)

Magi locked 3.0 as default. Flip-to-4.0 review is **deferred to a Q1 2027 calendar item** tracking (a) Outlook 4.0-ingest support adoption and (b) the proportion of `Accept: version=4.0` requests captured by the R-12 AC-12-5 telemetry. No accord-level action required now.

### A-6 — Adversarial Adam display-name-collision hardening (DEFERRAL to Phase 6/7)

Magi noted sender-spoofing via display-name collision (two Pulse users both named "Maya Chen") is not covered by Phase 1's URL-param-trust defense. **Deferred to Phase 6 or Phase 7 hardening item.** Recommended disambiguator (workspace name or partial email shown alongside sender display name on landing page for recipients without prior correspondence) is noted but not specified at L2 in this spec.

### A-7 — Sub-PR 7 `user_has_permission()` resolver (DEFERRAL, inherited)

Per handoff guardrail #5, Sub-PR 7 is deferred. This spec uses `auth.uid()` owner-checks throughout Backend L2 and leaves `TODO(phase-7)` comments at every policy site that should eventually call `user_has_permission('cards.send')`. No blocker; standard pattern from Phase A + Phase B.

---

## Out of scope for Phase C

Explicit non-goals — these MUST NOT appear in Phase 5 schema or Phase 6 implementation:

- **Group cards / multi-subject cards.** Each `contact_cards` row represents a single contact subject. Bulk send (R-4) is N separate single-subject cards × M recipients, not a group-card primitive.
- **Card editing after send.** Senders cannot mutate `card_snapshot` after creation. The only post-send write a sender can make is `revoked_at`. To change a shared card's data, revoke + re-create.
- **Sender-side numeric view-count exposure.** Coarse "Viewed / Not yet viewed" only; numeric counts stay internal (A-4).
- **vCard 4.0 default.** 3.0 default through at least 2027 Q1 review (A-5).
- **AI features.** Phase C has no AI use case per handoff guardrail #3 — no `ai-router` calls, no intro-note suggestions, no recipient-recommendation prompts.
- **`cards.send` permission gating via `user_has_permission()`.** Sub-PR 7 deferred; use `auth.uid()` owner-checks with `TODO(phase-7)` comments (A-7).
- **Group / workspace-pool card sharing as a same-flow primitive.** The Phase B "Share to workspace" CTA stays as-is in R-22; it does NOT migrate to or share data structure with the Phase C `contact_cards` table.
- **Native Apple NameDrop / AirDrop Code integration.** Phase C ships Universal Links + App Links only; OS-level NDEF/NFC contact-card surfaces are a Phase 7+ consideration.
- **QR-code generation UI in-app.** Canonical URL is QR-encodable trivially; in-app generation surface is deferred. Sasha-grade QR use cases (R-4 bundle + `token_policy = 'multi_use'`) work via OS share sheet → third-party QR tool today.
- **Grace period for `expires_at`.** Hard cutoff only in Phase C; grace period may be added later as a read-endpoint constant if telemetry justifies (A-1 / R-24 note).

---

## Open questions to resolve before Phase 5 schema

These are **new** questions accord surfaces during L2 elaboration — separate from magi's 6 open items above.

1. **Recipient resolution semantics for `recipient_hint`.** When a sender enters `bob@example.com`, the create-card edge function needs to decide: (a) eagerly resolve to a Pulse `auth.users` row if one exists, storing `recipient_user_id` alongside `recipient_hint`, OR (b) leave hint as-is and resolve lazily at landing-page time. Choice affects whether Bob signing up to Pulse AFTER card creation automatically attaches the card to his account. Recommend (a) eager + nullable `recipient_user_id` column with later `recipient_user_id IS NULL OR equals auth.uid()` check, but this is **not yet locked** in L2 above.
2. **`card_snapshot` field whitelist.** L2 R-1 schema specifies `card_snapshot jsonb NOT NULL` but does not enumerate which contact columns are safe to snapshot. Per handoff guardrail #10, sensitive columns are `notes`, `case_notes`, `phone`, `address`. Phase 5 schema agent must produce an **explicit whitelist** of contact columns allowed into `card_snapshot` (recommended: `name`, `phone`, `email`, `company`, `title`, `address` — but `notes` and `case_notes` MUST NEVER snapshot, even by sender's own choice, to avoid leaking notes outside the sender's user_id space).
3. **Bundle recipient list ergonomics.** R-4 says "to one or more recipients" but L2 ShareCardBundleModal does not specify the input UI (multi-email picker? Pulse-user multi-select? CSV paste?). Recommend Phase 5 vision agent handle this. Schema-side it doesn't matter; the bundle endpoint accepts a string[] regardless.
4. **Email open tracking opt-in/opt-out.** R-13 reuses existing `send-email` infrastructure including its open tracking. If Phase C's intro emails inherit open-tracking by default, that crosses a privacy line distinct from `view_count`. Confirm with whoever owns the `send-email` privacy posture whether tracking is appropriate for transactional intro emails.
5. **`go.pulse.logosvision.org` ownership.** R-DevOps-1 assumes Pulse owns or can provision this subdomain. The host's QntmEcos attribution memory notes a planned migration to `qntmecos.com`. Confirm with DevOps that the subdomain choice is durable through that migration, or pick a different host now (e.g. `card.pulse.logosvision.org`).
6. **Feature flag scope.** `VITE_CONTACTS_PHASE_C_ENABLED` gates the Received tab and Share-via-card CTA, but does the same flag also gate the **edge function deployment** (so flag-off in production means the function does not exist), or do the edge functions deploy always and only the UI hides? Recommend UI-only flag with always-on backend (matches Phase A pattern) — but Phase 5 schema agent should confirm.

---

**End of Lite spec.** Hand off to Phase 5 schema (Backend L2 + R-1..R-21 + open question #2) and Phase 5 vision (Frontend L2 + R-5..R-9 + open question #3) in parallel. Phase 6 implementation may start after the open questions above are resolved and Billing has signed off on A-2 rate-limit numbers.
