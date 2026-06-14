# Logos Vision ↔ Pulse Bidirectional Sync — Phased Build Plan

**Date:** 2026-06-13
**Status:** Plan, awaiting approval. **No code written.** Each phase ships flag-OFF and additive.
**Companion spec:** `docs/LOGOS_VISION_SYNC_HANDOFF_2026-06-13.md` (gap analysis + target behaviors). This doc is the *implementation* sequence.
**Scope:** full bidirectional, **single-tenant** (the owner's one Logos workspace). Multi-user routing deferred.

> Every file:line citation below was read from current code in this session, and every schema/RLS fact was verified against the **live** Logos (`psjgmdnrehcwvppbeqjy`) and Pulse (`ucaeuszgoihoyrvhewxk`) databases — not the repo's stale SQL files.

---

## 0. Resolved ground truth (the write constants)

These are the live values every Pulse→Logos write must carry (single tenant confirmed: `tenant_organizations` has exactly 1 row, `team_members` has exactly 1 row):

- **`org_id`** = `3815131e-d6e5-45a5-a47f-005c5f4dd17c` (`QuantumEcos`, plan `impact`) — NOT NULL on `activities`/`cases`/`case_notes`/`clients`/`client_journeys`.
- **`created_by_id` / `author_id`** = `542536f1-e0ca-44a4-bbe7-109d0c425805` (Frank Messana, `qntmecos@gmail.com`).
- **Key type:** **service-role** for the Logos project. RLS on every target table is *enabled but not forced* → service-role bypasses it; anon has zero policies (can't even read). The real write gates are the NOT NULL `org_id` + FK constraints, which apply to service-role too. **The service-role key lives server-side (`server.js`), NEVER in a `VITE_` bundle — decided 2026-06-13; see §1.**

---

## 1. Connection architecture — DECIDED 2026-06-13: server-side proxy

**Correction to the spec:** the env vars are NOT unset. `.env.local` already defines `VITE_LOGOS_VISION_SUPABASE_URL` (`:47`) and `VITE_LOGOS_VISION_SUPABASE_KEY` (`:48`) — but the configured key is the Logos **anon** key (decoded payload `role:anon`). Under the live Logos RLS (zero anon policies), that key reads **0 rows with no error** (so `healthCheck` false-positives "Connected") and is **rejected on write**. The current config is present-but-non-functional for the sync.

**Decision (key placement fork):** privileged Logos access runs **server-side** — never a service-role key in a `VITE_` browser bundle. Mirrors the existing `server.js` `SUPABASE_SERVICE_ROLE_KEY` pattern ([server.js:21](../server.js#L21)) and the refactor note at [render.yaml:77-82](../render.yaml#L77).

- **New server secret (only the user can supply):** `LOGOS_VISION_SERVICE_ROLE_KEY` (Logos project service-role; `sb_secret_*` or legacy JWT). Set in **Render** (`render.yaml`, `sync:false`) for prod. Locally, `server.js` loads `.env` **then** `.env.local` (latter overrides; mirrors Vite), so the key may live in either file. **Verified 2026-06-13:** `GET /api/logos/health` → `{configured:true, ok:true, rows:1}` (`rows>0` confirms a true service-role key, not anon).
- **Server URL:** `LOGOS_VISION_SUPABASE_URL` (`https://psjgmdnrehcwvppbeqjy.supabase.co`) server-side.
- **Frontend:** keeps the anon key only; calls new `${VITE_BACKEND_URL}/api/logos/*` routes — same transport as Slack/Gmail/Twilio. The browser `logosVisionService` is demoted to a thin fetch wrapper (or retired) for the privileged paths.
- **Until the secret is set,** `/api/logos/*` returns a clean "not configured" and the feature no-ops (flag OFF).

This propagates: **every RLS-gated Logos read/write (P1, P3, P4, P5, P6) goes through a `server.js` route, not the browser Supabase client.**

---

## 2. Deviations from the spec handoff (live-driven — flagged per CLAUDE.md)

The spec's Section 5 was explicitly overridable. Live verification forces these changes:

1. **Case-log target = `activities`, not `case_notes`** (spec Q4 left open). Live: `case_notes` has 0 rows and requires NOT NULL `journey_id`(FK `client_journeys`), a text `client_id`, and `author_id` — it's journey-scoped clinical (SOAP/DAP) notes. `activities` is live/active (247 rows) and needs only `type`/`title`/`activity_date`/`org_id` + optional linkage, and has built-in provenance columns. `case_notes` (with `source='pulse_conversation'`, which IS an allowed CHECK value) is reserved for a later richer F1.
2. **F4 watches `client_journeys`, not `cases`.** Live: `cases` has **no `updated_at` UPDATE trigger** (`pg_trigger` confirmed) — a status change does not bump `updated_at`, so a watermark poll on `cases` silently misses updates. `client_journeys` HAS `trigger_client_journeys_updated_at` (maintained `updated_at`) **and** a `case_status` column.
3. **`activity_time` is `timestamptz` (nullable), not `'HH:mm'` text.** We simply don't write it.
4. **Latent bug in `createActivity`:** its insert block (`logosVisionService.ts:305-322`) omits `org_id` entirely. Against the live NOT NULL `activities.org_id`, **every call would fail with 23502.** This method must be extended before it can write (P3). The spec assumed it was write-ready; it isn't.
5. **`crmActionsService` is NOT a drop-in idempotency ledger.** `createAction` (`crmActionsService.ts:31`) immediately calls `executeAction` which **dispatches by `action_type` to existing per-platform CRM handlers** (HubSpot/etc.) and has **no dedup read on `triggered_by_message_id`**. Reusing it blindly would route Logos writes into the wrong handler. We use the `crm_actions` *table* as a dedup ledger with our own read-before-write guard, not the auto-executing `createAction`. (Also noted: `crm_actions.id` is `uuid` in DB but code inserts a `action-<uuid>` text string, and code writes an `updated_at` the base migration doesn't define — avoid both.)
6. **Send hooks fire from services, not components** → they can't use the `useFeatures()` React hook. We need a non-React flag read (mirror `lib/emailFeature.ts`'s `isEmailEnabled()`), reading the same `pulse_feature_flags` localStorage key.
7. **Privileged access is server-side, not a browser client (DECIDED — see §1).** The original scaffold (`logosVisionService.ts`) opens a browser Supabase client via `import.meta.env`; a service-role key there would ship to every visitor. Instead the service-role Logos client lives in `server.js` with `{ auth: { persistSession: false, autoRefreshToken: false } }` (the bare `createClient(url,key)` at `:26-28` defaults both to `true`, which must be disabled for a server client); the frontend calls `/api/logos/*` routes.
8. **F1 trigger ≠ Pulse-DM send (DECIDED 2026-06-13).** The plan's send-hook (`pulseService.sendMessage`/`sendQuickVox`) targets `auth.users` ids; resolving those to a `contacts` row needs `contacts.pulse_user_id`, which is populated on **0/26 contacts** — and linked CRM contacts are external (no Pulse account), so the DM hook structurally can't reach them. F1 instead triggers from the contact-context surfaces that carry `contact.id`: **note-save auto-log + a manual "Log to Logos" button** on `FocusColumn`.

---

## 3. Phase table

| Phase | Goal | Net-new artifacts | Size | Dep |
|---|---|---|---|---|
| **P0** | Connection + flag scaffold (flag OFF) | `server.js` service-role Logos client + `GET /api/logos/health`; `LOGOS_VISION_SERVICE_ROLE_KEY` in render.yaml; `logosVisionSync` flag; `lib/logosSyncFeature.ts` | S | — |
| **P1** | Contact ↔ Logos mapping | `logosMappingService` over `logos_pulse_mappings`; "Link to Logos" UI on a contact | M | P0 |
| **P2** | Idempotency ledger | dedup helper over `crm_actions` table (own guard) | S | P0 |
| **P3** | F1 Conversation→Case Log | fix `createActivity` (org_id+author+provenance); hook `pulseService.sendMessage` + `sendQuickVox` | M | P1,P2 |
| **P4** | F2 Activity Feed Sync | `mapPulseTouchpointToLogosActivity`; extend hooks to team/thread + call/note emitters | M | P3 |
| **P5** | F3 AI Field Population | `invokeAIJson` extraction task; confirm-before-write UX; `updateClientFields`/`updateCaseFields` | L | P1 |
| **P6** | F4 Records Flow Back | `getJourneyUpdatesSince` delta read; `logos_case_state` Pulse mirror; score factor + feed | L | P1 |
| **P7** | Re-enable marketing surface | flip `SHOW_LOGOS_SYNC`; real "Connected" badge; honest single-tenant copy | S | P3+ |

**Thinnest end-to-end slice = P0→P1→P2→P3** (Conversation→Case Log genuinely working). P4–P7 layer on.

**Build status:** P0–P7 resolved + verified 2026-06-13 (v1 single-tenant complete).
- **P0** (connection + flag scaffold): `GET /api/logos/health` → `{configured:true, ok:true, rows:1}`; flag `logosVisionSync` default OFF.
- **P1** (contact↔Logos mapping): server-side routes `GET /api/logos/clients` + `GET/POST/DELETE /api/logos/mappings` (auth-gated → 401 without a Pulse session; mapping CRUD via the Pulse service-role client since `logos_pulse_mappings` has RLS-on/no-policies); `src/services/logosMappingService.ts`; "Link to Logos client" card on `FocusColumn.tsx` (flag-gated, mirrors the Link-Slack pattern). Verified: DB round-trip (clients read + mapping insert/read/delete/cleanup), 401 guard, tsc clean. In-UI click-through is the live acceptance check.
- **P2+P3** (ledger + F1 Conversation→Case Log): `POST /api/logos/case-log` (auth-gated) resolves contact→client mapping, dedups via `crm_actions` on `sourceId`, writes a Logos `activities` row (`type='note'`, org/author constants, `source_*` provenance), records the ledger outcome. Trigger = note-save auto-log + manual "Log to Logos" on `FocusColumn` (NOT the DM hook — Deviation #8). Verified 2026-06-13: DB write+dedup+cleanup smoke, POST 401 guard, tsc clean. In-UI note-save→Logos activity is the live acceptance.

- **P4** (F2 Activity Feed): same `case-log` route extended — `kind→type` (`email`/`note`) + `recipientEmail` server-side resolution (`skipped:'no_contact'` when unknown). Triggers: **email** send (`EmailHybridClient` → `kind:'email'`, the real F2 value for external contacts) + **Slack DM** (`FocusColumn` → `kind:'slack'`, cheap completeness). Verified: email→contact resolve + no-contact skip + `type='email'` write smoke + 401 guard, tsc clean.

- **P5** (F3 AI Field Population): `GET /api/logos/client` + `POST /api/logos/client-fields` (column whitelist + mapped-guard + `crm_actions` `logos.field_update` ledger); `suggestLogosClientUpdates` via `invokeAIJson('contact_enrichment')` (no edge-fn deploy — reused existing task); coral "Suggest updates (AI)" panel on `FocusColumn` (current→suggested + confidence, per-field Accept/Reject; additive — explicit accept required, current value shown, no-ops dropped). Client fields only (no contact→case mapping). Verified: mapped-guard + whitelist-drop + write + **revert** smoke + 401 guards, tsc clean. AI suggestion quality = live acceptance.

- **P6** (F4 Records Flow Back — display): `GET /api/logos/case-state?clientId=` bridges `clients.id → contact_id → client_journeys` (verified: `client_journeys.client_id` = Logos `contacts.id`, NOT clients.id); `getLogosCaseState`; FocusColumn shows read-only "Logos case: «status» · risk «level» · engagement «n»". Verified: bridge smoke (Dr. Robert Williams → active_services/high/55) + 401 guard, tsc clean. **DEFERRED:** `logos_case_state` mirror + poller (scale optimization; v1 reads on-demand). The relationship-score re-weight once deferred here is now **SHIPPED** (see F4-score below).

- **P7** (re-enable marketing): **DECISION 2026-06-13 — kept HIDDEN** (`SHOW_LOGOS_SYNC=false`, `LandingPage.tsx:61`). The sync is built but single-tenant/owner-only, so it is intentionally NOT re-advertised on the public landing; the existing panel copy is also stale vs. what shipped. The `LandingPage.tsx` comment now records the rationale + re-enable conditions (must become multi-tenant AND have corrected copy + a real `/api/logos/health`-driven badge).

- **F4-score** (relationship-score re-weight): `GET /api/logos/case-factor?email=` (email→contact→mapping→client→`client_journeys`) → 0–100 factor (`engagement_score` + risk adj `low+5/mod 0/high−8/critical−15`); `computeRelationshipScore(profileId, caseFactor?)` blends `0.75·base + 0.25·caseFactor` ONLY when the flag-gated `runDailyAnalysis` passes a factor (contact linked + has a journey). Flag-OFF or unlinked = byte-for-byte the prior score. Verified: case-factor chain + blend-math smoke (factor 47, blend 72), 401 guard, tsc clean (0 new errors).
- **Polish** (5): conservative AI prompt (prefer NULL-fills, cap replace-confidence ≤0.4, email/phone caution) + red "replaces" badge; silent-sync-failure indicator on the card; case-state staleness ("unavailable" vs blank); `current_stage` over `case_status` (humanized). (`status='Completed'` already matched Logos — no change.)

**v1 (single-tenant) is COMPLETE — all four behaviors incl. the F4 score re-weight + a 5-item polish pass, LIVE-VERIFIED this session.** Playwright drove the real UI end-to-end (link → case-log → AI suggestions → case-state; every `/api/logos/*` call 200, real Gemini suggestions rendered). Remaining deferred (not blockers): `logos_case_state` mirror/poller; a dedicated `ai-router` task for clean P5 metering; **multi-tenant graduation** (route via the two-header ecosystem bridge, then re-enable the public panel with corrected copy + a real badge).

---

## 4. Phases in detail

### P0 — Connection + flag scaffold  *(flag OFF, no behavior change)*
- **Server-side Logos client:** in `server.js`, add `createClient(LOGOS_VISION_SUPABASE_URL, LOGOS_VISION_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })` (mirror the existing `SUPABASE_SERVICE_KEY` clients, e.g. `server.js:309`) behind a "not configured" guard, plus a `GET /api/logos/health` route returning real connectivity (`clients` select 1). Add `LOGOS_VISION_SERVICE_ROLE_KEY` to `render.yaml` envVars (`sync:false`).
- **Flag:** add `logosVisionSync: boolean` to `FeatureFlags` (`FeatureContext.tsx:15-77`), default `false` (`DEFAULT_FEATURES` `:98-129`), `FEATURE_NAMES` `:306-320` (type-required), optional `FEATURE_DESCRIPTIONS`, and add to the `integrations` category (`:282-289`) so it auto-renders a toggle in `FeaturesLabsSettings.tsx`. Mirror `slackChannelsGrounding` exactly.
- **Non-React read:** new `src/lib/logosSyncFeature.ts` → `isLogosSyncEnabled()` reading `pulse_feature_flags` from localStorage (mirror `lib/emailFeature.ts`). Used by the service-side hooks in P3+.
- **Accept:** `GET /api/logos/health` returns `true` when the server secret is set (curl/dev check — report real output); flag visible+toggleable in Settings; flag OFF = zero behavior change. tsc clean + `server.js` starts.

### P1 — Contact ↔ Logos mapping
- **Store:** revive `logos_pulse_mappings` (Pulse DB, exists, 0 rows; `pulse_entity_type`/`id` ↔ `logos_entity_type`/`id` + `sync_direction`/`sync_status`). **No migration needed.** New `src/services/logosMappingService.ts`: `resolveLogosClient(pulseContactId)`, `linkContact(pulseContactId, logosClientId, journeyId?)`, `unlink(...)`. Map `pulse_entity_type='contact'` ↔ `logos_entity_type IN ('client','journey')`.
- **UI:** minimal "Link to Logos client" control on a contact (Contacts detail/co-pilot). Lists Logos `clients` (read via `getClients()`), writes a mapping row. Honest empty-state when unmapped.
- **Accept:** link a Pulse contact → 1 mapping row; `resolveLogosClient` returns it; unmapped contact resolves to `null` cleanly.

### P2 — Idempotency ledger
- Thin helper (in `logosMappingService` or a new `logosLedger`): before a Logos write, `SELECT` `crm_actions` for an existing row with matching `triggered_by_message_id` + a Logos `action_type` (e.g. `'logos.activity'`); skip if present. After the write, `INSERT` a row with `status='completed'` (or `'failed'`+`error_message`). **Do not call `crmActionsService.createAction`** (auto-executes into wrong handler). Use `gen_random_uuid()` default for `id`; don't write `updated_at`.
- **Accept:** same `messageId` twice → 1 Logos row + 1 ledger row; failure path lands `status='failed'` with the error and never throws.

### P3 — F1 Conversation → Case Log
- **Server write route:** `POST /api/logos/case-log` in `server.js` (server-side Logos client) inserts into `activities` with `org_id` (the constant), `created_by_id` = owner team-member, provenance (`source_type:'pulse_conversation'`, `source_entity_type:'pulse_message'`, `source_entity_id:<messageId>`), `activity_time` unset. Port `createActivity`'s column mapping (`logosVisionService.ts:298-330`) into the handler but **add the missing `org_id`** — without it the live insert 23502s. The route does contact→Logos-client resolution (P1) and dedup (P2) **server-side**, and no-ops with 200 when the secret is unconfigured.
- **Trigger = contact note-save + manual "Log to Logos" (NOT the DM/Vox send hooks — see Deviation #8).** Both originate in `FocusColumn.tsx` and carry `contact.id` directly, so no recipient→contact resolution is needed:
  - `saveNotes` (after a successful note change, gated on `features.logosVisionSync` + a present mapping): `void logToLogos({ kind:'note', sourceId:'note:'+contact.id+':'+djb2(content) })` — content-hash dedups identical notes.
  - A "Log to Logos" affordance in the Logos card (mapped branch): inline textarea → `logToLogos({ kind:'manual', sourceId:'manual:'+crypto.randomUUID() })` — always unique, always logs.
- The frontend `logToLogos` (in `logosMappingService.ts`) POSTs `{ pulseContactId, kind, content, sourceId }` with the Supabase bearer; the **server** resolves contact→Logos client (P1), dedups (P2), writes the activity, and records the ledger. Fire-and-forget — a Logos failure never affects note-save.
- **Accept (spec §7 F1, adapted):** note-save / manual-log on a linked contact → exactly 1 `activities` row (`type='note'`, provenance `source_entity_id=sourceId`); same `sourceId` again → `skipped:'duplicate'`; unmapped contact → 200 no-op, 0 rows; Logos failure → note-save still succeeds. **Verified 2026-06-13** via DB smoke (write + dedup + cleanup) + 401 guard.

### P4 — F2 Activity Feed Sync
- Extend the **same `/api/logos/case-log` route** to map `kind`→`activities.type` (`email`→`'email'`, else `'note'`) and to accept **`recipientEmail`** as an alternative to `pulseContactId`, resolving it server-side to a contact (owner-scoped `contacts WHERE user_id=<auth> AND email IN [raw,lower]`, mirroring `resolveContactIdsByEmail`). No-op (`skipped:'no_contact'`) when the address isn't a known contact.
- **Triggers** (the touchpoints that work for external CRM contacts):
  - **Email** (the substance — clients are emailed, not DM'd): hook the single send funnel `EmailHybridClient.tsx:465` after `gmail.sendEmail` → `logToLogos({ kind:'email', recipientEmail: params.to[0], sourceId:'email:'+gmailMsgId })`. `contact.id` is gone at that seam, hence the server email→contact resolution.
  - **Slack DM** (cheap completeness; niche for external contacts): hook `FocusColumn.handleSlackSend` → `logToLogos({ kind:'slack', pulseContactId: contact.id, ... })`.
- Both gated on `logosVisionSync`, fire-and-forget. (Pulse-DM/Vox NOT hooked — Deviation #8.)
- **Accept (spec §7 F2):** email a linked contact → `type='email'` activity; Slack DM a linked+Slack-linked contact → `type='note'`; email to a non-contact → no-op; dedup per `sourceId`. **Verified 2026-06-13:** email→contact resolution + no-contact skip + `type='email'` write smoke + 401 guard.

### P5 — F3 AI Field Population
- Server-side extraction via `invokeAIJson<T>(task, prompt, { workspaceId, systemPrompt })` (`src/services/ai/aiService.ts:192-197`) — **no client-side AI key** (router-enforced). Add an `AITask` value if needed.
- Net-new **server routes** `POST /api/logos/client-fields` / `/api/logos/case-fields` (server-side Logos client `.update()` with `org_id` echo). **Additive only:** never overwrite a non-empty Logos field without explicit "replace". Confirm-before-write UX on the Pulse side; coral provenance chip on AI-suggested values (coral = AI only).
- **Accept (spec §7 F3):** ≥N messages → suggestion set; accept writes one field, reject writes nothing; non-empty field never silently overwritten; each write records provenance.

### P6 — F4 Records Flow Back  *(heaviest)*
- **Delta read:** new server route `GET /api/logos/journey-updates?since=<watermark>` over `client_journeys` (maintained `updated_at` + `case_status`), filtered to mapped clients. A server-side poller (or a Pulse-side scheduled fetch) advances the watermark.
- **Pulse mirror:** net-new `logos_case_state` table (Pulse) — additive, reversible; schema-first dry-run per CLAUDE.md before apply. Poller lands deltas here; feed/score read the mirror, not a live cross-DB query per render.
- **Score feed:** add a Logos-case-outcome factor into `relationshipIntelligenceService.computeRelationshipScore` sum (`relationshipIntelligenceService.ts:486-488`). ⚠ The 5 current factors already total exactly 100 (25+20+25+15+15) — adding a 6th requires **re-weighting**, not just `+factor` (otherwise the `Math.min(...,100)` clamp at `:491` silently eats it). Document the re-weight direction.
- **Accept (spec §7 F4):** Logos journey/case-status change → Pulse feed entry within interval; deduped; resolved case adjusts score input in a documented direction; Logos unreachable → last-synced + staleness indicator, not an error.

### P7 — Re-enable marketing surface
- Flip `SHOW_LOGOS_SYNC` (`LandingPage.tsx:61`) to `true`; restore/adjust the "Know your network." copy (~`:2960`) to match what shipped, keeping "bidirectional" honest re: single-tenant.
- Make the "Connected/live" badge **real** — driven by `healthCheck()` / last-sync state, never hardcoded.
- **Accept:** badge reflects real connectivity; copy matches shipped behavior.

---

## 5. Risk register
- **Service-role key is a server secret** (`LOGOS_VISION_SERVICE_ROLE_KEY` in Render `server.js` env), NOT in the browser bundle (decided §1). Residual risk: it's a single shared owner key → single-tenant by construction; graduating to multi-user means routing per-user identity, not broadening the shared key. CRM-OAuth refactor note (`render.yaml:77-82`) is the precedent for moving browser-coupled clients server-side.
- **No UPDATE on `activities`** — it has a `BEFORE UPDATE` trigger referencing a non-existent `updated_at` column; an UPDATE would error. Insert-only.
- **`cases_plan_gate`** requires org plan ∈ {pro,impact}; currently `impact` (satisfied), and service-role bypasses anyway — but a plan downgrade would break authenticated reads of `cases`.
- **Score re-weight (P6)** changes existing relationship scores for all contacts — call it out before shipping.

## 6. Resolved decisions (2026-06-13)
1. **Case-log target → `activities`.** Conversation→Case Log (F1) and Activity Feed (F2) write to `activities` — lightest path, live/active, built-in provenance columns. `case_notes` (journey-scoped clinical notes) deferred.
2. **Mapping UX → on the contact.** The "Link to Logos client" affordance lives on the contact's Focus/co-pilot view (contextual). The global on/off stays in Settings (the `logosVisionSync` flag). Exact contacts surface confirmed at P1.
3. **v1 scope → all four behaviors (P0–P7).** F1–F4 all in v1, including F3 (AI field write-back — confirm-before-write UX required) and F4 (records flow back + the relationship-score re-weight that changes ALL contacts' scores — must be called out before shipping P6). Heaviest path chosen deliberately; every phase still ships flag-OFF and additive (no big-bang).

---

## 7. Key files (all verified this session)
- `server.js` — **new home of the privileged Logos client + `/api/logos/*` routes** (service-role; mirror the `SUPABASE_SERVICE_KEY` clients at `:309`). `render.yaml` — add `LOGOS_VISION_SERVICE_ROLE_KEY`.
- `src/services/logosVisionService.ts` — existing browser client; `createActivity:298` (port its column map server-side + add org_id), `healthCheck:420`, singleton `:611-614`. Demoted to a thin fetch wrapper (or retired) for privileged paths.
- `src/contexts/FeatureContext.tsx` + `src/components/settings/FeaturesLabsSettings.tsx` — flag pattern (mirror `slackChannelsGrounding`).
- `src/lib/emailFeature.ts` — non-React flag-read pattern to mirror.
- `src/services/messageChannelService.ts:322-326` — the fire-and-forget hook pattern.
- `src/services/pulseService.ts:390,425,459` + `src/services/relay/voxModeService.ts:859,1291,2083` — send seams.
- `src/services/crmActionsService.ts` — ledger (use table, not auto-exec `createAction`).
- `src/services/ai/aiService.ts:192` — `invokeAIJson` for P5.
- `src/services/relationshipIntelligenceService.ts:486-500` — score sum + persistence for P6.
- Pulse DB: `logos_pulse_mappings` (mapping store), `crm_actions` (dedup), net-new `logos_case_state` (P6).
- Logos DB: `activities` (write target), `client_journeys` (F4 watch), `clients`/`cases` (read).

---

## 10. RESUME — next session (start at P5)

> This section is the authoritative pick-up point and supersedes the older §4 sketches for P5–P7 where they differ. P0–P4 are shipped; do **not** rebuild the infra below.

### Current state (end of 2026-06-13 session)
- **Shipped + verified, flag `logosVisionSync` default OFF:** P0 `5cd1b3f` · P1 `a6be73c` · P2+P3 `98810ac` · P4 `b9fd5b7`. (`git log --oneline | grep logos-sync`.)
- **Env is set** (`LOGOS_VISION_SUPABASE_URL` + `LOGOS_VISION_SERVICE_ROLE_KEY` in `.env`/`.env.local` local + Render prod). `server.js` loads `.env` then `.env.local` (override).
- **Sanity check before resuming:** `PORT=3099 node server.js` then `GET /api/logos/health` → expect `{configured:true, ok:true, rows:1}` (rows>0 proves service-role).

### Reusable infra already built (REUSE — don't rebuild)
- **Server routes** (`server.js`, all auth-gated via `requireUser(req)`→401): `GET /api/logos/health`, `GET /api/logos/clients?q=`, `GET|POST|DELETE /api/logos/mappings`, `POST /api/logos/case-log`. Helpers: `logosServiceClient()` (Logos service-role, persistSession off), `logosConfigured()`, `requireUser()`. Constants `LOGOS_ORG_ID` / `LOGOS_AUTHOR_ID`.
- **Frontend service** `src/services/logosMappingService.ts`: `listLogosClients`, `getLogosMappings`, `linkContactToLogos`, `unlinkContactFromLogos`, `logToLogos`. Pattern = `${BACKEND_URL}/api/logos/*` + Supabase bearer (`authHeaders()`).
- **Flag**: `logosVisionSync` (FeatureContext, Integrations) + non-React `isLogosSyncEnabled()` (`src/lib/logosSyncFeature.ts`).
- **Dedup ledger**: `crm_actions`, `action_type='logos.activity'`, dedup on `triggered_by_message_id = sourceId`. (Use the TABLE, never `crmActionsService.createAction`.)
- **Email→contact resolver** (in the case-log route): `contacts WHERE user_id=<auth> AND email IN [raw,lower]`.
- **UI home**: the Logos card in `FocusColumn.tsx` (mapped branch: Link/Unlink + "Log to Logos").

### P5 — F3 AI Field Population (heaviest; has an OPEN UX decision)
Goal: AI reads a linked contact's Pulse signal (notes / recent emails) → proposes updates to the Logos **client/case** fields → user confirms → write. Additive only; coral = AI provenance.
- **AI seam (server-side mandate, CLAUDE.md §4):** `invokeAIJson<T>(task, prompt, { workspaceId, systemPrompt })` at `src/services/ai/aiService.ts:192` (verify line). Routes through the `ai-router` edge fn — never a client-side key. Add an `AITask` value if needed. Extraction may run client-side (it's just an ai-router call); the field WRITE must be server-side service-role.
- **Net-new server routes:** `POST /api/logos/client-fields` / `/api/logos/case-fields` → `logosServiceClient().from('clients'|'cases').update({...}).eq('id', id)` echoing `org_id`. Writable `clients` cols (verified live this session): `contact_person, email, phone, location, address, website, notes, donor_stage, employer, communication_notes, preferred_contact_method`. `cases`: `status, priority, category, resolution, due_date`. (Avoid `name`.)
- **⚠ Additive-only:** never overwrite a non-empty Logos field without explicit "replace". Read current → present `{field, current, suggested, confidence}` → write only accepted fields. Record a `crm_actions` row (`action_type='logos.field_update'`) per write for provenance.
- **OPEN UX DECISION (resolve first via a quick ask):** where does confirm-before-write live? (a) an "AI suggestions" expandable in the FocusColumn Logos card (mapped branch) — least surface, consistent; (b) a dedicated modal/panel. Recommend (a). Each suggested value → coral provenance chip; accept writes one field, reject writes nothing.
- **Verify:** invokeAIJson returns a structured set; server field-write smoke (update one `clients` field via service-role → read back → revert); non-empty-field guard; provenance row written.

### P6 — F4 Records Flow Back (heaviest)
Goal: Logos case-state changes surface in Pulse + adjust the relationship score.
- **Watch `client_journeys`** (NOT `cases` — Deviation #2): trigger-maintained `updated_at` + `case_status`. New route `GET /api/logos/journey-updates?since=<ISO>` → `client_journeys WHERE updated_at > since`, filtered to mapped clients.
  - **⚠ VERIFY THE JOIN FIRST:** mappings key on the Logos **client** id (uuid); `client_journeys.client_id` is **text** (verified live). Confirm how journeys join to `clients.id` (text vs uuid — may need a cast or a contact bridge) before building.
- **Net-new Pulse mirror `logos_case_state`** (additive/reversible). **Schema-first (CLAUDE.md §4):** dry-run the migration in a rolled-back `DO $$ … RAISE EXCEPTION 'rollback' $$` until clean, THEN apply once. Suggested cols: `id, pulse_contact_id, logos_client_id, logos_journey_id, case_status, risk_level, engagement_score, updated_at, synced_at`. A server poller (or a Pulse scheduled fetch) advances a watermark + upserts here; feed/score read the mirror, not a live cross-DB query per render.
- **Score feed:** `relationshipIntelligenceService.computeRelationshipScore` — sum at `:486-491`, persist at `:494-500` (verify lines). The 5 factors total exactly **100**, so a case-outcome factor REQUIRES **re-weighting** (not `+factor`; the `Math.min(…,100)` clamp at `:491` would silently eat overflow). **⚠ This changes ALL contacts' scores** — surface before shipping.
- **OPEN DECISIONS:** poll cadence/trigger (manual refresh vs interval — realtime not on `client_journeys`); the documented re-weight direction.
- **Verify:** journey-updates delta read smoke; `logos_case_state` upsert smoke; score recompute with the factor on a test profile; "last-synced + staleness" (not an error) when Logos unreachable.

### P7 — Re-enable marketing (small)
- Flip `SHOW_LOGOS_SYNC` (`LandingPage.tsx:61`, verify line) → `true`; restore/adjust the "Know your network." copy (~`:2960`), keeping "bidirectional" honest re: single-tenant.
- Make the "Connected" badge **real** — drive from `GET /api/logos/health`, never hardcoded.
- **Honesty gate:** only re-advertise what shipped. F1/F2 are real; gate F3/F4 copy on P5/P6 actually landing.

### Conventions to keep (held all session)
- Per phase: **investigate seams firsthand → present change-list for approval → build → verify with a real smoke (report ACTUAL output) → commit explicit paths only** (never `git add -A` / `commit -a`; the user holds WIP). Headless smokes: write a temp `_pN_smoke.mjs` loading `.env`+`.env.local`, exercise via the real service clients, **clean up test rows**, delete the temp file. Co-author: `Claude Opus 4.8 (1M context)`.
- This doc is `*_HANDOFF_*` so it stays git-tracked (`docs/*.md` is otherwise gitignored — `.gitignore:161-173`).
