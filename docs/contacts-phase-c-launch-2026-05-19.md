# Pulse Contacts Phase C — Launch Plan (2026-05-19)

> Release planning artifact produced by the `launch` skill at end of the Phase C pipeline (handoff → magi → accord → schema+vision → backend → UX → backend gap fill → guardian → launch). Targets the `feat/contact-card-sharing` branch / v25.2.0 cut.

## Versioning

- Current: **v25.1.3** (per `package.json` and latest GitHub Release from 2026-03-16)
- Proposed: **v25.2.0**
- Rationale: Phase C is a backwards-compatible, additive feature set (new edge functions, new tables, new UI surfaces, all gated behind `VITE_CONTACTS_PHASE_C_ENABLED=false`). Flag-off behavior is byte-identical to v25.1.3. SemVer MINOR is the unambiguous call. Aligns with the original Phase A v25.2.0 launch draft noted in the handoff doc — Phase A + B + C land together as the v25.2.0 cut.

---

## CHANGELOG entry

> No `CHANGELOG.md` in the repo today. Recommend creating one at `f:/pulse1/CHANGELOG.md` using Keep-a-Changelog conventions; the GitHub Release body has been the de-facto changelog through v25.1.3. The entry below is shaped to be the **first entry** of a new `CHANGELOG.md`.

```markdown
# Changelog

All notable changes to Pulse are documented in this file. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[SemVer](https://semver.org/spec/v2.0.0.html).

## [25.2.0] — 2026-05-19

### Added
- **Contacts Phase A — Selective import.** OAuth-scoped Google Contacts import with a label picker (`ConnectContactsModal`) and per-row kept/skipped trim (`TrimWizard`). New empty state, scope-loss toast surface, and `INVALID_GRANT` reconnect banner. Gated by `VITE_CONTACTS_PHASE_A_ENABLED` (default off).
- **Contacts Phase B — Bulk operations + workspace sharing.** Multi-select bulk archive/restore/delete/update from `BulkActionToolbar`; soft-archive column with `Show archived` toggle; `workspace_contacts` table for cross-user sharing with read-only safe-projection; `saved_filters` table with personal + workspace scopes; provenance chip in `ContactDetail` header + `WarRoom` source dot variants; auto-detect circles expanded with RFM 5-cohort + email-domain clustering (10-provider + role-prefix blocklist).
- **Contacts Phase C — Contact-card sharing protocol.** End-to-end sharing protocol for Pulse-to-Pulse and Pulse-to-anyone contact handoff:
  - **Sender flow:** `ShareCardModal` (single-recipient with intro note + 30-min Unsend window + per-share single/multi-use toggle + optional expiry) and `ShareCardBundleModal` (bulk-send, up to 100 cards per bundle for conference use cases).
  - **Recipient flow:** New 4th "Received" tab in Contacts (badge-counted, capped at "99+"); `CardLandingPage` for non-Pulse recipients (public Universal Link, no auth wall); `AcceptCardConfirmation` with decoupled "add subject" (primary) + "connect with sender on Pulse" (default-checked, opt-out) actions.
  - **Forwarding:** Sender controls per-card via `is_forwardable` (default true); each forward creates a new card row with `forwarded_from_card_id` provenance chain; `CardProvenanceLine` renders origin + immediate sender; chain revocation cascades from root.
  - **Deeplinks:** `https://go.pulse.logosvision.org/c/{token}` via Universal Links (iOS) + App Links (Android); installed Pulse clients deep-link into the Received tab, others land on the public web preview.
  - **vCard delivery:** Server-streamed via `render-contact-vcard` edge function with `Content-Disposition: attachment` (vCard 3.0 default, 4.0 on `Accept: text/vcard; version=4.0`); strip-list applied to `PHOTO`, `IMPP`, `RELATED`, `LANG`, `GENDER`, `KIND`, X- vendor extensions.
  - **Anti-spam:** `card_send_blocks` table (recipient-driven block list), silent `view_count` for abuse monitoring, configurable per-sender rate limits (50/day single, 100/bundle/day) enforced at `create-contact-card` and `create-contact-card-bundle`.
  - **Duplicate detection:** Bulk Accept reuses Phase B's `workspace_contacts` dedup matcher (normalized email + phone + name fingerprint); matches default to **link** (new contact row with `possible_duplicate_of` FK), never silent merge.
  - **Revocation:** `revoked_at` column with cascade-to-tree from chain root; revoked cards return HTTP 410 Gone (not 404, to defeat UUID probing); landing pages render generic "no longer available" with no sender leak.
  - **Expiry:** Optional `expires_at` (default null = never); cards within 3 days of expiry show a non-dismissible warning banner in the Received inbox.
  - **Intro notes:** Delivered through existing `send-email` edge function (Resend, DKIM/SPF-verified on `pulse.logosvision.org`) as plain text with minimal HTML; durable in the in-app Received inbox.
  - Gated by `VITE_CONTACTS_PHASE_C_ENABLED` (default off).
- **Messages Tools Redesign (Beta).** Three feature-flagged surfaces (`pulseComposerV2`, `messageContextMenuV2`, `toolsMenuV2`) with Smart Compose ghost-text, format-on-selection popover, `/t` template slash commands, long-press / right-click context menu with state-aware top-5 actions, and a slim 4-tile Tools menu (Thread Summary, Insights, Thread Audit, Translate Settings). AI tiles carry coral provenance chips per the AI-output token policy.
- **Emoji picker rebuild.** Full Unicode CLDR catalog (1,914 emojis across 9 groups) via `unicode-emoji-json`; theme-aware portal rendering; beside-bubble anchor; search by emoji name; roving tabindex; recent emojis persisted to localStorage.
- **Branch-safety scaffolding.** `scripts/branch-safety/` (post-checkout banner, worktree helper, installer); locked default-serial session policy in `CLAUDE.md`; allowlist for `docs/*.md` rescued 11 prior-session docs.
- **Learn Git & GitHub playground.** Interactive HTML playground at `docs/learn-github-playground.html` plus a new "Working in your IDE + Git Graph" section.
- **`/task-start` slash command.** Claude task-bootstrap slash command for repo onboarding.

### Changed
- **`BulkActionToolbar` Share CTA disambiguation.** With Phase C live, the prior "Share" affordance is split into "Send as card" (Phase C peer flow, primary) and "Share to workspace" (Phase B workspace pool, preserved). Eliminates the prior label-vs-behavior dark pattern flagged by `echo`'s Phase 1 walkthrough.
- Coral budget: `--pulse-coral-bg-12` now formally permitted for the Received-tab unread badge (signal-of-pending exception, documented alongside the Map redesign's Committed-coral exception).

### Fixed
- React.memo undefined error in vendor bundle from `@react-google-maps/api` CJS/ESM interop (carried from v25.1.3 line; reconfirmed clean in this build).
- PWA service-worker reload loop on landing page (index.html no longer precached).
- Real-time send race + conversation preview refresh on delete + hover-bar / context-menu emoji-picker wiring + bubble-anchor menu position + hover-bar reachability + dual-menu suppression (7 post-merge fixes from the Messages redesign).

### Security
- Adversarial-defense hardening on Phase C: landing pages perform server-side `auth.users` JOIN via `resolve-card-deeplink`; sender identity is never read from URL params. Revoked / expired / never-existed cards all return HTTP 410 Gone with identical body to defeat UUID probing.

### Database
- 5 new migrations: `20260523000001_rejected_import_labels`, `20260523000002_contacts_provenance_columns` (Phase A); `20260524000001_phase_b_archive_column`, `20260524000002_phase_b_workspace_contacts`, `20260524000003_phase_b_saved_filters` (Phase B); `20260525000001_phase_c_contact_cards`, `20260525000002_phase_c_decline_state` (Phase C). All additive. `contacts.user_id` remains TEXT per Pulse convention; all new RLS predicates cast `auth.uid()::text`.

[25.2.0]: https://github.com/FatherSonOne/Pulse-1/releases/tag/v25.2.0
[25.1.3]: https://github.com/FatherSonOne/Pulse-1/releases/tag/v25.1.3
```

---

## Release notes (user-facing)

```markdown
## Pulse v25.2.0 — Contacts, refreshed.

We rebuilt the entire contacts story end to end. Three phases, one release.

### Phase A — Choose what comes in
Google Contacts import no longer dumps your whole address book into Pulse. Connect once, pick the labels you actually want, then trim the result before anything is saved. Lost your contacts scope? You'll get a clear reconnect banner instead of silent failure.

### Phase B — Tools to keep it organized
Multi-select your contacts and archive, restore, delete, or update them in bulk. Share a contact pool with your whole workspace. Build a filter once and save it — personally, or for your whole team. Soft-archive keeps the records around; toggle "Show archived" when you need them back. And the auto-detect Circles got smarter — RFM-style cohorts plus email-domain clustering.

### Phase C — Share contacts the way you wished you could
Pulse can now hand off a contact card to anyone, Pulse user or not.

- **Send a card.** Open any contact, pick a recipient, write an optional intro note. They get an email and (if they're on Pulse) a card in their new **Received** tab.
- **Bundle for events.** Heading to a conference? Send up to 100 cards in one shot with one confirmation.
- **No Pulse, no problem.** Recipients without a Pulse account land on a simple web page and tap "Save to Contacts" — the card downloads as a normal vCard that iOS and Android both understand.
- **You stay in control.** 30-minute Unsend, forever Revoke, per-card "make this link single-use", optional expiry. Revoke a card and any forwards of it disappear too.
- **Accept on your terms.** When someone sends you a card, the confirmation screen separates "add this person to my contacts" from "connect with the sender on Pulse" — accept either, both, or just the contact.
- **No duplicates surprise.** If someone shares a contact you already have, Pulse links the new record rather than silently overwriting your existing one. Review and merge later if you want.

You'll see Phase C light up in your workspace once the feature is rolled out to your tier. Look for the **Received** tab in Contacts.

### Plus
- Messages got a new compose bar (Smart Compose, slash commands, format-on-selection), a long-press / right-click menu on every bubble, and a slim Tools menu with AI Summary, Insights, and Thread Audit.
- The emoji picker is back to being a real emoji picker — the full Unicode catalog, search by name, light + dark mode.
- A new Learn Git & GitHub playground in the docs for new contributors.

### Try it
Phase C will roll out in stages over the next ~10 days. Once your workspace is enabled, open any contact and look for **Share as card** in the actions. Send one to a friend who's not on Pulse — that's the test we care most about.
```

---

## Rollout plan

Five stages over ~10 days, target Tue–Thu deploys.

### Stage 1 — Internal (Pulse staff workspaces only)
- **Audience:** Quantum Ecosystems internal workspaces (`fm1@qntmecos.com` org `8fc94762-…` + `meetmate@qntmecos.com` + jehovahsneaky83 personal). ~5 accounts, ~3 workspaces.
- **Duration:** 48 hours minimum.
- **Pre-stage checklist:**
  - [ ] Both Phase C migrations applied to **staging** Supabase + smoke-tested
  - [ ] Migrations applied to production Supabase `pulse-chat` (ref `ucaeuszgoihoyrvhewxk`) — schema is additive, rollout begins before any flag flip
  - [ ] All 7 Phase C edge functions deployed and visible in `list_edge_functions`
  - [ ] Universal Links payload live at `https://go.pulse.logosvision.org/.well-known/apple-app-site-association` + `/.well-known/assetlinks.json` — manual curl verification
  - [ ] Resend domain `pulse.logosvision.org` shows healthy DKIM/SPF in dashboard within last 24h
  - [ ] `npx tsc --noEmit` clean on `v25.2.0` tag
  - [ ] `npm run test` (Vitest, 27 unit) green
  - [ ] `npm run test:e2e -- contacts-phase-c.spec.ts` green with `VITE_CONTACTS_PHASE_C_ENABLED=true`
  - [ ] Sentry release `pulse@25.2.0` registered + source maps uploaded
- **Flag flip:** Set `VITE_CONTACTS_PHASE_C_ENABLED=true` for internal workspaces via `phase_c_workspace_allowlist`.
- **Success criteria:**
  - ≥ 5 end-to-end card sends across ≥ 2 personas (Pulse-to-Pulse, Pulse-to-non-Pulse)
  - 0 P0/P1 Sentry events tagged `feature:phase-c`
  - All 7 edge functions p95 latency < 400ms over 48h
  - `card_create_success_rate` ≥ 99%
  - At least 1 successful Unsend, 1 successful Revoke, 1 successful vCard download on non-Pulse device (iOS Safari + Android Chrome)
- **Failure criteria (halt + rollback):**
  - Any P0 Sentry event tagged `feature:phase-c` (auth bypass, RLS leak, sender-spoof)
  - Edge function 5xx rate > 1% on any single function over 1h
  - vCard delivery fails on iOS Safari or Android Chrome (catastrophic per Ron persona)
  - Universal Links resolution misconfiguration evident (e.g. 100% web-fallback when app is installed)

### Stage 2 — Friends-and-family (≤25 workspaces)
- **Audience:** Hand-picked external workspaces tagged `early_access` (~25 workspaces, ~50-100 active users).
- **Duration:** 72 hours.
- **Pre-stage checklist:**
  - [ ] Stage 1 success criteria green for full 48h window
  - [ ] In-app changelog modal authored, visible on first login post-flag
  - [ ] Support team briefed on Phase C edge cases via internal Slack canvas
  - [ ] Rollback drill executed — flag flip off → confirm UI absence → flip on, total roundtrip < 5 min
- **Flag flip:** Add Stage 2 workspace IDs to `phase_c_workspace_allowlist`.
- **Success criteria:**
  - ≥ 30 cards sent across the cohort
  - Card create error rate < 0.5% over 72h (traffic floor: ≥ 50 create attempts)
  - `resolve-card-deeplink` p95 latency < 200ms
  - ≥ 1 non-Pulse recipient acceptance recorded
  - Resend bounce rate on intro-note emails < 2%
  - No P0/P1 support tickets matching `(card OR vcard OR received tab OR shared contact)`
- **Failure criteria:**
  - Card create error rate ≥ 0.5%
  - Any RLS leak surfaced (instant halt)
  - Resend bounce rate ≥ 5%
  - ≥ 3 P2 tickets clustering on the same root cause

### Stage 3 — Canary (10% of paid workspaces)
- **Audience:** Random-sampled 10% of paid-tier workspaces, excluding Stage 1+2 cohorts.
- **Duration:** 96 hours.
- **Pre-stage checklist:**
  - [ ] Stage 2 success criteria green
  - [ ] Billing sign-off on 50/day single + 100/bundle/day rate-limit numbers (written)
  - [ ] Privacy review on `view_count` telemetry + Resend open tracking signed off
  - [ ] Beacon dashboard published showing 7 edge fns + 2 new tables + Received-tab badge fetch
  - [ ] Sticky-session check confirmed: workspace flag state read at session start and cached
- **Flag flip:** Toggle 10% sample via `WHERE hashtext(workspace_id::text) % 10 = 0`.
- **Success criteria:**
  - Card create error rate < 0.5% over 96h
  - `accept-contact-card` 2xx rate ≥ 99%
  - Accept conversion: ≥ 30% of cards with `view_count > 0` produce an Accept event within 7 days (rolling)
  - Forward rate: ≥ 5% of accepted cards subsequently forwarded
  - No P0/P1 Sentry events for full 96h
  - DORA Change Failure Rate for v25.2.0 < 15%
- **Failure criteria:**
  - Card create error rate ≥ 0.5% → halt
  - Accept conversion < 15% → do NOT halt but escalate to product review before Stage 4
  - Any signal that chain-revocation cascade is leaving orphan rows

### Stage 4 — Beta (50% of all workspaces)
- **Audience:** Random-sampled 50% of all workspaces (free + paid).
- **Duration:** 72 hours.
- **Pre-stage checklist:**
  - [ ] Stage 3 success criteria green
  - [ ] In-app banner announcing "Contact sharing is here" published to flagged workspaces (auto-dismissable)
  - [ ] Support docs published covering Send / Accept / Revoke / Universal Links troubleshooting
  - [ ] Free-tier rate limit load-tested at 2x expected peak in staging (~5,000 create calls / 10 min burst)
- **Flag flip:** Expand to 50% sample (`% 2 = 0`).
- **Success criteria:**
  - All Stage 3 thresholds maintained
  - ≥ 5 free-tier rate-limit rejections observed (confirms limit is hooked up)
  - In-app banner CTR > 8%
- **Failure criteria:** Same as Stage 3, plus any spike in DB connection pool exhaustion on `contact_cards`.

### Stage 5 — GA (100%)
- **Audience:** Everyone.
- **Duration:** Indefinite (steady state).
- **Pre-stage checklist:**
  - [ ] Stage 4 green for full 72h
  - [ ] Release notes published as v25.2.0 GitHub Release body
  - [ ] CHANGELOG.md committed to `main`
  - [ ] In-app banner copy updated to drop the "rolling out" hedge
  - [ ] Telemetry retention confirmed for 30-day flag-removal window
- **Flag flip:** Set `VITE_CONTACTS_PHASE_C_ENABLED=true` globally; drop the per-workspace allowlist check.
- **Success criteria:** 30-day post-GA stability — card create error rate < 0.5% sustained, Accept conversion ≥ 30% sustained, zero RLS/security regressions, zero P0/P1 incidents.
- **Failure criteria:** Any P0 incident → re-enable per-workspace allowlist with Stage 4 cohort as ceiling, freeze new enablements pending fix.

---

## Rollback plan

Ascending escalation. Phase C is designed to be flag-disabled in under 60 seconds.

1. **Flag flip (≤1 min).** `VITE_CONTACTS_PHASE_C_ENABLED=false` for the affected cohort via `phase_c_workspace_allowlist`. Received tab hides, CTA hides, ShareCardModal becomes unreachable. Existing rows preserved.
2. **Edge function pause via Supabase dashboard (≤5 min).** If failure is contained to one function (e.g. `create-contact-card` 500s), pause that function in the dashboard.
3. **Landing-page kill-switch (≤5 min).** If `resolve-card-deeplink` needs to return generic 410 for all cards (mass spoofing campaign), deploy a one-line short-circuit conditional. Pre-stage as a draft PR.
4. **Rate-limit clamp (≤10 min).** Drop per-sender rate limit from 50/day to 5/day via config table (Decision #7 wasn't pinned in schema — flip the value, no migration).
5. **Migration revert (≤30 min, last resort).** Only if a Phase C migration itself is causing prod DB damage. Both are additive (CREATE TABLE / ALTER ADD COLUMN / CREATE INDEX); revert is `DROP TABLE ... CASCADE` + `ALTER TABLE contacts DROP COLUMN possible_duplicate_of`. **Data loss is permanent.** Do not invoke without explicit user sign-off.

Stage 1 pre-stage checklist includes a rollback drill (#1). #5 is not drilled because data-loss cost > rehearsal value.

---

## Feature flag plan

- **Initial state:** `VITE_CONTACTS_PHASE_C_ENABLED=false` (build-time default). `phase_c_workspace_allowlist` table empty.
- **Stage 1:** Add 3 internal workspace IDs to allowlist. Read path: `useFeatureFlag('contactsPhaseC')` checks env first AND allowlist row exists for current `workspace_id`. Sticky per session.
- **Stage 2:** Append ~25 workspace IDs.
- **Stage 3:** Replace allowlist with hash-bucket predicate (`% 10 = 0`).
- **Stage 4:** Expand to `% 2 = 0`.
- **Stage 5:** Set bundle-level default to `true`; drop allowlist read from path.
- **Eventual removal (target v25.3.0 or v25.2.1, post-30-day stability — target date 2026-06-18):**
  - Remove `VITE_CONTACTS_PHASE_C_ENABLED` env var declaration + all read sites
  - Drop `phase_c_workspace_allowlist` table
  - Cleanup ticket filed at Stage 1 start to prevent flag debt

---

## Pre-launch dependencies

| # | Item | Owner | Deadline | Blocking |
|---|------|-------|----------|----------|
| 1 | Billing sign-off on 50/day + 100/bundle/day rate limits | User (Billing) | Before Stage 3 | Stage 3 |
| 2 | DevOps confirm on `go.pulse.logosvision.org` durability (vs `qntmecos.com` migration) | DevOps | Before Stage 1 | Stage 1 |
| 3 | Privacy review on `view_count` telemetry + Resend open tracking | Privacy/Legal | Before Stage 3 | Stage 3 |
| 4 | Universal Links payload deployed (`apple-app-site-association` + `assetlinks.json`) | DevOps | Before Stage 1 | Stage 1 |
| 5 | Both Phase C migrations applied to staging Supabase + smoke-tested | DevOps | Before Stage 1 | Stage 1 |
| 6 | Both Phase C migrations applied to production Supabase | DevOps | Before Stage 1 | Stage 1 |
| 7 | All 7 Phase C edge functions deployed to production | DevOps | Before Stage 1 | Stage 1 |
| 8 | Resend domain health re-verified (DKIM/SPF) within 24h of Stage 2 flip | DevOps | Before Stage 2 | Stage 2 |
| 9 | Phase 7 backlog review (`increment_contact_card_view_count` RPC + JS BFS fallback threshold) | Next session | Before Stage 5 | Async (Stages 1-4) |
| 10 | CHANGELOG.md created and committed | Launch | Before Stage 5 release | Async (Stages 1-4) |
| 11 | In-app banner copy + targeting query | Product/Copy | Before Stage 4 | Stage 4 |
| 12 | Support docs published | Support/Copy | Before Stage 4 | Stage 4 |

---

## Monitoring + observability gates (must be wired before Stage 1 flag flip)

- Sentry release tag `pulse@25.2.0` registered with source maps; alert rule `event.tags.feature == "phase-c" AND level >= error` routes to on-call
- Sentry custom tag `phase_c_stage` per build/cohort (`internal | f-and-f | canary | beta | ga`)
- Beacon dashboard with one panel each for the 7 edge functions (p95 + error rate); separate panels for `contact_cards` row growth, `forwarded_from_card_id` chain depth, `card_recipient_state` growth
- Resend deliverability dashboard subscribed: alert on intro-note bounce rate > 2% or open rate < 20% over 24h
- Universal Links resolution metric instrumented (app-open events vs web-landing renders)
- Edge function timing alarms:
  - `resolve-card-deeplink` p95 > 200ms over 15 min → warning
  - any edge function p95 > 500ms over 15 min → warning
  - any edge function 5xx rate > 1% over 15 min → page
- Cascade-chain integrity check — scheduled query asserting "no `contact_cards` row has `revoked_at IS NULL` while its root has `revoked_at IS NOT NULL`". Hourly during Stages 1-3, nightly thereafter.

---

## Comms plan

| Stage | Internal | External | Channel |
|---|---|---|---|
| 1 (internal) | Pulse team only | None | Slack `#pulse-releases` |
| 2 (f-and-f) | Pulse team + on-call | Hand-picked cohort | Slack + direct email |
| 3 (canary) | Pulse team + on-call + support | None (silent expansion) | Slack |
| 4 (beta) | Pulse team + support + DevOps | In-app banner to flagged workspaces | Slack + in-app |
| 5 (GA) | All | GitHub Release + in-app banner updated + in-product changelog modal | GitHub + in-app + (optional) social/blog |

---

## TL;DR

- **Version:** v25.1.3 → **v25.2.0** (MINOR, additive, feature-flagged).
- **5-stage rollout** over ~10 days: Internal (48h) → F&F ≤25 ws (72h) → Canary 10% (96h) → Beta 50% (72h) → GA 100%.
- **Hard blockers for Stage 1:** Universal Links payload deployed at `go.pulse.logosvision.org` (DevOps); both migrations applied to staging + prod Supabase + smoke-tested; all 7 edge functions deployed; DevOps written confirmation that `qntmecos.com` migration won't run during the rollout window (or dual-host plan).
- **Hard blockers for Stage 3 (canary):** Billing sign-off on rate-limit numbers; Privacy review on `view_count` + Resend open tracking.
- **Can land async:** Phase 7 backlog cleanup, CHANGELOG.md file creation (required by Stage 5), in-app banner + support docs (required by Stage 4).
- **Rollback ≤1 min** via flag flip. Migration revert exists but is last-resort with permanent data loss.
- **Flag removal target: 2026-06-18** (Stage 5 + 30 days). Cleanup ticket filed at Stage 1 start.
