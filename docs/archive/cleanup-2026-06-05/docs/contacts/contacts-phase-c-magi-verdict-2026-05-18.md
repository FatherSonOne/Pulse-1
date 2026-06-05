# Pulse Contacts Phase C — Magi Verdict (2026-05-18)

> Multi-perspective deliberation output (Logos / Pathos / Sophia) on the 12 architectural decisions queued from Phase 1 Discovery. Produced via the `magi` skill on branch `feat/contact-card-sharing` (off `main` at `2ccc7c4`). Inputs: handoff doc §4 + Phase 1 plea / echo / researcher summaries. Phase 2 riff skipped per Phase B pattern; Phase 5b Risk Gate skipped per user direction.

**Mode**: Simple (three internal lenses). **Reversibility**: MEDIUM overall; Decisions 1, 3, 4, 10 are LOW reversibility (deeplink contract, file-delivery contract, vCard major-version, token model). **Result**: 8 high-confidence verdicts, 4 medium-confidence verdicts, 0 deadlocks.

---

## Decision #1 — Deeplink format

**Logos**: `pulse://card/{id}` is a custom scheme with no installation guarantee — iOS Safari prompts only if the app is installed; otherwise the nav silently fails. Universal Links (iOS) + App Links (Android) over `https://` resolve to the app when installed and to a web fallback when not — exactly the Ron-persona requirement. Infra cost is one `apple-app-site-association` + Digital Asset Links JSON on `go.pulse.logosvision.org` + Capacitor 8 `App` plugin wiring (Capacitor already runs in Pulse).
**Pathos**: Ron cannot be auth-walled — Phase 1 explicit. Custom scheme presents him a broken URL bar; https deeplink presents a normal landing page. The empathy cost of `pulse://` is borne entirely by the outside-the-ecosystem recipient we most need to convert.
**Sophia**: This is a viral-loop product. Every share that fails to render in iMessage / WhatsApp / email preview is lost acquisition. https links unfurl, generate OG previews, survive copy-paste through arbitrary chat surfaces; custom schemes do not.

**Verdict**: Phase C card deeplinks SHALL use `https://go.pulse.logosvision.org/c/{token}` as the canonical share URL, configured as Universal Links (iOS) + App Links (Android). Installed Pulse clients deep-link into the Received inbox; non-Pulse recipients land on a public web preview. The `pulse://` scheme is retained only for in-app internal navigation (e.g. notification-tap → card detail) and MUST NOT appear in any user-shareable artifact (clipboard copy, QR payload, email body, SMS body, vCard NOTE field).
**Confidence**: high (92)
**Dissent**: none.

---

## Decision #2 — Sender auto-promote on Accept

**Logos**: Two states must be decoupled: (a) card's contact subject added to recipient's People; (b) card's *sender* added as a Pulse peer. Conflating them violates least-surprise (Maya shares Bob; recipient wants Bob, not Maya). Default-checked checkbox preserves the common-case ergonomic while making the second write explicit and auditable.
**Pathos**: Lee (untrusted-sender skeptic) explicitly wants this decoupled. Default-checked respects Maya/Aiko's common case (they *do* usually want the sender) while giving Lee one click to opt out. Default-unchecked = friction for 80% case; silent auto-add = break 20% case Lee represents.
**Sophia**: iOS 26.2 AirDrop Code shipped exactly this UX (decoupled accept-card vs add-sender). Two strategic wins: iOS users have a mental model for the pattern, and defending the design in an App Store review or privacy audit is trivial — "matches Apple's own contact-sharing UX" is the citation.

**Verdict**: On Accept, recipient sees a single confirmation modal with two semantically distinct actions: (1) "Add [card subject] to my contacts" — primary, cannot be unchecked. (2) "Also connect with [sender display name] on Pulse" — secondary checkbox, **default CHECKED**, recipient may uncheck before confirming Accept. Both writes happen in the same transaction; the second is conditional on the checkbox state. Sender auto-promote MUST NOT occur silently or by deeplink-open alone.
**Confidence**: high (88)
**Dissent**: none.

---

## Decision #3 — vCard delivery method

**Logos**: `data:text/vcard;...` is blocked on Chrome iOS (Chromium 604533) and produces inconsistent behavior on Safari iOS + Android WebView. Server-side response with `Content-Type: text/vcard` + `Content-Disposition: attachment; filename="contact.vcf"` is the only delivery method that triggers the OS-level "Add to Contacts" sheet reliably across iOS Safari, Chrome iOS, Android Chrome, Firefox, and desktop. Deterministic engineering choice, not a trade-off.
**Pathos**: Ron's success path is: tap link → see card → tap "Save to Contacts" → OS contacts app opens. Any flow ending in "the file downloaded somewhere, find your Files app" is Derek-grade failure (5% baseline). User-facing cost of getting this wrong is catastrophic; engineering cost of doing it right is one edge function.
**Sophia**: Pulse already has `send-email` edge-function infra. Adding `vcard-render` (or extending `create-contact-card`) is one function, not a new platform capability.

**Verdict**: vCard delivery SHALL be implemented as a Supabase edge function endpoint (recommended `render-contact-vcard`) returning HTTP 200 with `Content-Type: text/vcard; charset=utf-8` and `Content-Disposition: attachment; filename="<sanitized-display-name>.vcf"`. Endpoint reads `card_snapshot` from `contact_cards`, formats per Decision #4, streams the response. `data:`-URI delivery is FORBIDDEN. Landing page "Save to Contacts" button is `<a href="/api/cards/{token}/vcard">` hitting this endpoint.
**Confidence**: high (95)
**Dissent**: none.

---

## Decision #4 — vCard version

**Logos**: vCard 4.0 (RFC 6350) has cleaner semantics, but Outlook 2019/2021 (still dominant enterprise client in 2026) ingests 3.0 cleanly and chokes on 4.0 multi-value properties. Android default Contacts ingest is 3.0-stable; iOS accepts both. Serving 3.0 default + 4.0 on `Accept: text/vcard; version=4.0` is exactly the Postel principle. Researcher field-reliability matrix backs the strip-list: `PHOTO` base64 inflates 10x and silently dropped; `IMPP` and `RELATED` have <40% client support.
**Pathos**: Persona who suffers under 4.0-default is the corporate-Outlook user (non-trivial chunk of Aiko's daily intros — sales reps to enterprise targets). They never see a Pulse error; they see a card that imported with missing fields. Silent failure is worst pathos outcome.
**Sophia**: 3.0 is end-of-S-curve; 4.0 is rising slowly. 3.0 default in 2026 is correct; revisit when 4.0 client support crosses ~80%. Build the version-negotiation layer now so the flip is a config change, not a refactor.

**Verdict**: vCard responses SHALL default to vCard 3.0 with this strip-list: `PHOTO`, `IMPP`, `RELATED`, `LANG`, `GENDER`, `KIND`, and any X- vendor extensions. The endpoint MUST honor `Accept: text/vcard; version=4.0` by responding 4.0-formatted (no strip-list). Display names with brace/hash characters MUST pass through verbatim per the Pulse contact-name policy (no `{`, `}`, `#` stripping in `FN`/`N` fields). Telemetry TODO: store requested vCard version to inform 2028 default-flip review.
**Confidence**: high (87)
**Dissent**: Sophia notes default flips to 4.0 when ≥80% of received-card requests carry `version=4.0` in `Accept`, OR Outlook ships full 4.0 ingest (whichever first).

---

## Decision #5 — Received inbox IA (subview vs 4th top-level tab)

**Logos**: 4th top-level tab has a measurable cognitive-load cost (Hick's law, ~12% selection time on 4-way vs 3-way nav) and the nav slot is the most-valuable real estate Pulse owns. Subview of People with badge-bearing chip = 80% of discoverability for 0% of nav-bloat cost. Aiko's "must be top-level" demand is a preference, not a measured requirement.
**Pathos**: But Aiko is highest-frequency persona (3-5/day). Her IA preference carries disproportionate weight. Subview badge requires the user to be on the People tab to see it; top-level tab badge is visible from anywhere. Latency of "did anyone send me a card?" matters daily for Aiko.
**Sophia**: Phase C success metric is viral adoption — cards received, accepted, recipient sending their own. Discoverability of the inbox correlates directly with the activation funnel. A subview that costs 5% activation is more expensive than a tab that costs 12% selection time.

**Verdict**: The Phase C Received inbox SHALL be implemented as a **4th top-level tab in the Contacts navigation** ("Received" or "Cards"), positioned to the right of existing tabs with a numeric badge showing unread/unprocessed cards (capped at "99+"). The tab MUST be present from Phase C launch — not phased in via a subview. Tab uses existing `--pulse-coral-bg-12` for the badge (this is signal-of-pending, not AI provenance — deliberate coral-budget exception, see Cross-cutting).
**Confidence**: medium (74)
**Dissent**: Logos dissents on nav-bloat cost. Verdict would flip to subview if Phase C ships with sub-1% daily-receive rates after first 60 days. Build the tab with a feature flag so demotion is a config change.

---

## Decision #6 — Card forwarding

**Logos**: A forwarded card with no provenance is a phishing primer (Adversarial Adam's forgery vector). Two engineering controls solve it without killing the feature: `forwarded_from_card_id` FK preserves the chain; landing page renders provenance text. Original-sender opt-out per card (`is_forwardable boolean`) is the consent layer; default-true matches expectation, Maya can flip off for sensitive intros.
**Pathos**: Sasha (50-card bundles) and Aiko (3-5 intros/day) both rely on forwarding implicitly — "introduce X to Y" *is* forwarding. Killing the feature removes the primary professional-networking pattern. Transparency UI ("Aiko is sharing Maya's contact") protects Lee's skepticism without crippling Aiko's flow.
**Sophia**: Forwarding *is* the viral loop. Cards that can't forward are dead-end shares; cards that can forward compound. Chain data is also analytics gold (who's a hub, which cards spread).

**Verdict**: Forwarding SHALL be supported with these invariants: (1) Each forward creates a **new `contact_cards` row** (not a parent-row token reuse); (2) new row sets `forwarded_from_card_id` FK to parent; (3) parent's `is_forwardable` (default `true`) gates whether forward button renders in recipient's UI; (4) when `is_forwardable = false`, attempting forward returns 403 from edge function (not client-side check alone); (5) landing page MUST render single-sentence provenance line on any card with `forwarded_from_card_id IS NOT NULL` showing both immediate-sender display name and original-sender display name; (6) original sender (chain root) may revoke entire chain via `revoked_at` cascade — see Decision #9.
**Confidence**: high (84)
**Dissent**: none.

---

## Decision #7 — Anti-spam

**Logos**: 50 cards/day/sender free tier is a reasonable heuristic but unvalidated. Real primitive is the `card_send_blocks` table — recipient-driven block list returning 410 (per UUID-probing defense) when `(sender_user_id, recipient_hint)` matches a block row. Rate-limit enforced at edge function via single SQL count in 24h window. `view_count` as silent abuse-detection is cheap and high-value (view_count > 50 in 1h = probable forwarded-spam vector).
**Pathos**: Aiko (3-5/day) and Sasha (conference bundle of 50) sit on opposite sides of 50/day threshold. Sasha's conference-bundle is a real workflow the 50/day limit punishes. Phase C should special-case "verified bulk send" via one-time bundle endpoint that bypasses per-card rate limit but caps total bundle size + requires single intent confirmation.
**Sophia**: Free-tier rate limits are billing-tier carrots more than spam controls. Real spam control is block table + view-count abuse signal. Defer the rate-limit number to billing-tier work; do not pin in Phase C schema.

**Verdict**: Phase C SHALL implement three anti-spam controls: (1) `card_send_blocks` table with `(blocked_by_user_id, sender_user_id, blocked_at)` + unique index — matching `contact_cards` insert from edge function is rejected with HTTP 403; (2) silent `view_count` column on `contact_cards` incremented atomically per landing-page render, surfaced to internal abuse monitoring (no user-facing display); (3) configurable per-sender rate limit (default 50/day for free tier, to be pinned by Billing rather than Phase C) enforced at `create-contact-card` edge function. Separate bulk-send endpoint (`create-contact-card-bundle`) MUST exist for Sasha-grade use cases, requires explicit recipient-list-size confirmation, subject to higher per-bundle limit (recommended 100 cards/bundle, 1 bundle/day default). The 50/day and bundle numbers are TODO(phase-c-billing-coordination), not load-bearing in schema.
**Confidence**: medium (76)
**Dissent**: Sophia notes rate-limit numbers should load from a config table (not hardcoded) so Billing flips them without migration.

---

## Decision #8 — Intro note delivery channel

**Logos**: `send-email` edge function exists, DKIM/SPF on `pulse.logosvision.org` is verified, Resend delivery is operationally proven for Pulse transactional traffic. Adding intro note to existing send-email template is one parameter + one branch. Plain text + minimal HTML maximizes deliverability and matches Maya's "personal intro" tone.
**Pathos**: Maya's intro note is the warmest signal in the entire Phase C protocol — the difference between "stranger sent their contact" and "Maya thought we should connect". Burying it in a UI-only field (visible only after Pulse-app open) defeats the purpose. Email surfaces the note in the most-checked surface.
**Sophia**: Email-based intro notes also solve the Pulse-not-installed case for free — Ron sees Maya's hand-written intro before he lands on the card preview. This is the conversion lever for the non-Pulse-recipient persona.

**Verdict**: Intro notes SHALL be delivered through the existing `send-email` edge function as transactional email to the recipient's email address, sent at card-create time. Email body is **plain text with minimal HTML structure** (no images, no external CSS, no tracking pixels beyond existing send-email infra's open tracking). Subject pattern: `<sender display name> shared a contact card with you`. Body includes: (1) sender display name verbatim; (2) intro note text verbatim (escaped plain text); (3) canonical `https://go.pulse.logosvision.org/c/{token}` link; (4) single-line "Save to contacts (no Pulse account needed)" CTA. Intro notes MUST also render in the in-app Received inbox card detail — email is primary surface, inbox is durable surface.
**Confidence**: high (89)
**Dissent**: none.

---

## Decision #9 — Unsend / revocation window

**Logos**: 15-min unsend is implementable as a single `revoked_at timestamptz` column with no separate "unsend window" semantics — revocation always available, UI surfaces "Unsend" within window and "Revoke" after. Both write same column; distinction is purely linguistic. 410 Gone (not 404) is critical: Adversarial Adam's UUID-probing relies on 404 meaning "no card ever existed"; 410 says "a card existed, it is now gone" — matches semantic truth and prevents probing because valid tokens eventually return 410 regardless of guess success.
**Pathos**: 15 min is too short for Maya's "did I send to the wrong recipient?" case (typical realization latency is 5-30 min in adjacent product research). Extend to 30 min for "Unsend" linguistic frame; revocation always available beyond.
**Sophia**: Revocation as a feature is also a trust signal — "you control what you've shared, forever" is marketable. 30-min unsend, permanent revocation, both in Sent Cards inbox. Long-term retention lever, not just bug-fix.

**Verdict**: Phase C SHALL implement card revocation via `revoked_at timestamptz` on `contact_cards` (nullable, default NULL). Behavior: (1) Sender may revoke any card they sent, any time, no time limit. (2) UI distinguishes "Unsend" (button shown for cards <30 min old AND `view_count = 0`) from "Revoke" (all other unrevoked cards the sender owns); both write `revoked_at = now()`. (3) Revoked cards return HTTP 410 Gone from all read endpoints — never 404. (4) Revocation cascades to all `forwarded_from_card_id` descendants in single transaction: the originating sender revoking the root revokes the entire tree. (5) Mid-chain revocation (forwarder revoking their own forward) revokes only that subtree, not the root. (6) Landing-page rendering for a revoked card shows generic "This contact card is no longer available" — no sender name leak, no card-content leak.
**Confidence**: high (86)
**Dissent**: Pathos noted 15 min too tight; verdict adopts 30 min. Logos noted cascade semantics need explicit definition; verdict captures root-revokes-tree vs forwarder-revokes-subtree.

---

## Decision #10 — Token policy

**Logos**: Single-use breaks the QR case (one physical QR scanned by multiple attendees must work for all). Multi-use breaks Maya's "Priya screenshot leak" concern. Clean primitive is **per-share token policy at create time**: sender picks "Link" (multi-use, public URL semantics, fine for QR) or "Direct" (single-use, fine for 1:1 where leak matters). Schema column: `token_policy enum('single_use', 'multi_use')` default `'multi_use'`.
**Pathos**: Sasha (QR/conference) needs multi-use default. Maya (personal intros) needs single-use opt-in. Lee benefits from single-use being visible as a security toggle ("This link works once" vs "This link works for anyone with it"). Mental model maps to password-reset (single) vs Zoom invite (multi).
**Sophia**: Configurable-per-share is more engineering than single-policy, but alternative ships a model that gets one persona wrong. Per-share is the only policy that survives the full persona matrix. Default multi-use because QR/bundle is higher-volume; surface "Make this link single-use" as opt-in toggle.

**Verdict**: Phase C SHALL support **per-share configurable token policy** via `token_policy` column on `contact_cards` with values `'multi_use'` (default) and `'single_use'`. Behavior: (1) Multi-use redeemable (landing rendered, vCard downloaded, Accept performed) by any number of recipients, no time limit beyond `expires_at`/`revoked_at`. (2) Single-use atomically marked "consumed" on first Accept (not first landing-page view — view alone does not consume); subsequent Accept attempts return 410 Gone. (3) Single-use cards display "This card was sent privately and can only be saved once" on landing page. (4) Bulk-send endpoint (Decision #7) and QR-code paths force `token_policy = 'multi_use'`. (5) Share-creation modal surfaces "Make this link single-use" toggle — default off — directly below recipient input.
**Confidence**: medium (78)
**Dissent**: All three lenses agreed per-share is correct; medium confidence reflects implementation-cost worth verifying against Phase 4 accord scope, not the policy choice.

---

## Decision #11 — Expiry semantics

**Logos**: Hard cutoff at `expires_at` is simplest (single timestamp comparison on every read) but produces midnight-deletion failures. Grace period requires either a second column (`grace_period_ends_at`) or derived semantic ("read-only for 3 days after `expires_at`, then 410"). Derived-semantic uses one column + one constant — cheaper, no schema change later.
**Pathos**: Sasha's deferred-Maybe pile is the canonical case — she scans 50 cards, sets 30 aside as "Maybe later", forgets until next weekend. Hard cutoff loses the cards she paid attention to. 3-day warning banner gives signal to act without operational complexity of configurable grace period.
**Sophia**: Most cards won't have `expires_at` at all (default null, never expires). Expiry is a sender-control lever for specific cases (event-bound, time-sensitive). Building grace-period semantics for a feature 90% of cards won't use is over-engineering. Ship hard cutoff + 3-day warning; revisit grace if telemetry shows >5% of cards hit expiry while recipient has them open.

**Verdict**: Phase C SHALL implement card expiry with: (1) `expires_at timestamptz` on `contact_cards`, nullable, default NULL (most cards never expire). (2) Cards with `expires_at IS NOT NULL AND expires_at < now()` return HTTP 410 Gone. (3) Received-inbox UI MUST surface a non-dismissible warning banner on any card where `expires_at - now() < interval '3 days'`, showing exact expiry timestamp in recipient's local timezone. (4) **No grace period in the data model** — `expires_at` is hard cutoff. A grace period may be added later as a single constant in the read endpoint (`expires_at + interval '3 days'` for read-only mode) if telemetry justifies it; the column does not need to change. (5) Sender-side UI for setting `expires_at` MUST default to "Never expires" with explicit opt-in to a time-bound expiry.
**Confidence**: medium (72)
**Dissent**: Pathos noted a 3-day grace period (recipient can still Accept after expiry) would better serve Sasha's Maybe-pile case than just a warning. Verdict adopts warning-only but explicitly notes grace can be added as a single constant later without schema migration — if Phase 4 accord research shows Maybe-pile is the dominant use case, flip to 3-day read-only grace period without schema change.

---

## Decision #12 — Duplicate detection on bulk Accept

**Logos**: Phase B's `workspace_contacts` already has dedup logic — matches on (normalized email, normalized phone, name fingerprint) across recipient's existing contacts. Reusing for Phase C bulk Accept avoids second-source-of-truth on "same person". Three outcomes (merge / link / skip) map cleanly: **merge** = combine fields, sender's card wins on conflict; **link** = create new contact row, flag `possible_duplicate_of` an existing contact for later review; **skip** = no row, log skip in Accept summary.
**Pathos**: Sasha's 50-card bulk-Accept needs to be fast. Presenting 7 dedup-conflict modals mid-Accept is Derek-grade failure. Right UX is single summary screen after Accept: "47 added, 3 already in your contacts (linked), 0 skipped" — one-click "Review duplicates" leading to per-pair merge UI. Default on dedup hit is **link**, not merge — merge silently overwrites recipient's existing data (Lee will hate); link is reversible.
**Sophia**: Phase B's dedup pattern is the asset; Phase C should consume it, not re-invent. Strategic win is consistency — one mental model for dedup across Pulse — and engineering win is reuse. Long-term, `possible_duplicate_of` also feeds contact-quality surfaces in People.

**Verdict**: Phase C bulk Accept SHALL reuse Phase B `workspace_contacts` dedup matcher (normalized email + normalized phone + name fingerprint). Per-card outcomes: (1) **No match** → create new `contacts` row, normal flow. (2) **Match found** → default **LINK**: create new `contacts` row with `possible_duplicate_of uuid REFERENCES contacts(id)` FK pointing to existing match; do NOT overwrite existing contact fields. (3) **Merge** is per-pair action in post-Accept "Review duplicates" UI, not bulk default — recipient must explicitly approve each merge. (4) **Skip** is per-card pre-Accept option in bulk-Accept selection UI (Sasha can uncheck cards she already has). (5) Post-Accept summary screen: `N added`, `M linked as possible duplicates`, `K skipped`, with "Review duplicates" CTA. (6) `possible_duplicate_of` FK is the single new schema addition on `contacts`; MUST tolerate `contacts.user_id TEXT` type — FK target column type is uuid (fine), only `user_id` cast matters. RLS: recipients can only see `possible_duplicate_of` chains within their own contacts (cast `auth.uid()::text` consistently).
**Confidence**: high (83)
**Dissent**: none.

---

## Cross-cutting recommendations

- **Schema additions implied across the verdicts** (beyond Phase 1 sketch):
  - On `contact_cards`: add `token_policy enum('single_use','multi_use') NOT NULL DEFAULT 'multi_use'`, `is_forwardable boolean NOT NULL DEFAULT true`. Keep `forwarded_from_card_id`, `expires_at`, `revoked_at`, `view_count` from Phase 1.
  - On `contacts`: add `possible_duplicate_of uuid REFERENCES contacts(id) ON DELETE SET NULL`.
- **Edge functions required**:
  - `create-contact-card` (single)
  - `create-contact-card-bundle` (Sasha bulk path, Decision #7)
  - `render-contact-vcard` (Decision #3)
  - `resolve-card-deeplink` (Decision #1 server-side hydration to defeat Adversarial Adam's URL-param-trust attack — landing page MUST JOIN `contact_cards` to `auth.users` server-side, never read sender identity from URL params)
- **RLS pattern reminder**: every `contact_cards` policy must cast `auth.uid()::text` when joining anything that references `contacts.user_id`. `user_has_permission()` resolver is gated on Sub-PR 7 (deferred) — for Phase C, use `auth.uid()` for owner-only paths and leave `-- TODO(phase-7): replace with user_has_permission('cards.send')` comments at policy sites that will eventually need granular permission.
- **Coral budget exception**: Received-tab badge (Decision #5) uses `--pulse-coral-bg-12` despite being signal-of-pending (not AI provenance). Deliberate Phase 1 exception in the spirit of the Map redesign's "Committed-coral exception". Document in the spec so future audits don't strip it.
- **Phase B Share-CTA cleanup**: echo's discovery that `BulkActionToolbar`'s "Share" currently resolves to workspace-pool sharing must be addressed as part of Phase C delivery — when Phase C ships, the CTA either (a) opens the Phase C share flow, (b) re-labels to "Share to workspace" to disambiguate, or (c) splits into two CTAs. Label/behavior dark-pattern; Phase 4 accord must include as scope, not defer.
- **Dependency chain**: Decisions #6 (forwarding) and #9 (revocation) are coupled — chain-revocation cascade in #9 depends on #6's FK structure. Implement in the same migration, not separately.

## Open items requiring human input

1. **Decision #5 confidence is medium** — 4th-top-level-tab ruling rests on an assumed activation lift. If internal data exists on Phase B's Saved Filters tab adoption (a comparable IA addition), check before locking #5. If activation on Saved Filters was <5%, demote #5 to subview.
2. **Decision #7 rate-limit numbers (50/day, 100/bundle)** are unvalidated and need Billing sign-off — free-tier-vs-paid-tier split intersects directly with Stripe price IDs in `reference_stripe_config.md`. Phase C should not ship without Billing sign-off on specifics, even though schema is policy-agnostic.
3. **Decision #10 per-share toggle UX copy** — "Make this link single-use" is functional but flat. Brand/voice review by whoever owns Pulse copy should refine the share-creation modal text before launch. Non-blocking for accord; hits Phase 6 polish.
4. **Privacy review for `view_count` telemetry (Decision #7)** — surfacing per-card view counts to internal abuse monitoring is fine; column also opens the door to "Maya can see Priya viewed her card 4 times" features. Phase C MUST NOT expose `view_count` to sender-side UI without explicit privacy review. Recommend Phase 4 accord pin this as out-of-scope for Phase C and a separate decision later.
5. **vCard 4.0 fallback timing (Decision #4)** — 2028 default-flip review needs calendar entry. Recommend quarterly review starting Q1 2027 tracking Outlook 4.0-ingest support + `Accept: version=4.0` request share.
6. **Adversarial Adam's forgery model needs one more pass** — Phase 1 covered URL-param trust; not yet covered: sender-spoofing via display-name collision (two Pulse users named "Maya Chen", recipient can't disambiguate). Recommend adding a small disambiguator (workspace name or partial email) to landing-page sender display for recipients who have not previously corresponded with that sender. Not blocking for accord; capture as Phase 6 or Phase 7 hardening item.

---

**Status**: Ready for Phase 4 accord ingestion. 8 high-confidence verdicts may be pasted verbatim into the spec; 4 medium-confidence verdicts (#5, #7, #10, #11) are primary review targets in stakeholder discussion before accord locks; 6 open items are tracked above and either fold into accord scope or get explicit deferral notes in the spec.
