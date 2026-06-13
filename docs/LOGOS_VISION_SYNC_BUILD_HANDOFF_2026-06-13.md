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

**Build status:** P0 + P1 shipped + verified 2026-06-13.
- **P0** (connection + flag scaffold): `GET /api/logos/health` → `{configured:true, ok:true, rows:1}`; flag `logosVisionSync` default OFF.
- **P1** (contact↔Logos mapping): server-side routes `GET /api/logos/clients` + `GET/POST/DELETE /api/logos/mappings` (auth-gated → 401 without a Pulse session; mapping CRUD via the Pulse service-role client since `logos_pulse_mappings` has RLS-on/no-policies); `src/services/logosMappingService.ts`; "Link to Logos client" card on `FocusColumn.tsx` (flag-gated, mirrors the Link-Slack pattern). Verified: DB round-trip (clients read + mapping insert/read/delete/cleanup), 401 guard, tsc clean. In-UI click-through is the live acceptance check.

**P2 (idempotency ledger over `crm_actions`) is next.**

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
- **Hook the clean DM/voice send seams** — fire-and-forget `POST /api/logos/case-log` with `{ recipientId, messageId, content, kind }`, mirroring the `messageChannelService.ts:322-326` `void notifyMappedMentions(...)` pattern:
  - `pulseService.sendMessage` — after the success guard (`pulseService.ts:425`), before `return data` (`:459`). `recipientId` + message id available.
  - `voxModeService.sendQuickVox` — after the error guard (`voxModeService.ts:2116-2119`), beside the existing `createNotification` (`:2123`). `recipientId` + `data.id`.
- Each hook: gated on `isLogosSyncEnabled()` (skip the POST when OFF); the **server** resolves contact→Logos client (P1), dedups (P2), and writes; unmapped → server returns 200 no-op. Frontend never blocks or refetches (respect the disappearing-message contract — `sendMessage` only returns the id; the realtime subscription owns the list).
- **Accept (spec §7 F1):** send to linked contact → exactly 1 `activities` row in ≤5s with body+author+timestamp+messageId ref; retry/re-render → no dup; unlinked contact → 0 rows, 0 errors; Logos write failure → Pulse send still succeeds.

### P4 — F2 Activity Feed Sync
- Generalize P3 into `mapPulseTouchpointToLogosActivity(touchpoint)` → `activities.type` (call/message/note; unknown → fallback `communication`, no error).
- Extend hooks to the weaker-identifier voice paths (`sendTeamVoxMessage` `:1291` via `mentions[]`+`channelId`; `sendVoiceThreadMessage` `:859` — thread-scoped, weakest) and any call-log/note-create emitters.
- **Accept (spec §7 F2):** call→`type='call'`+duration; note→`type='note'`; unknown→`communication`; idempotent per source-event; visible in `getActivities({clientId})`.

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
