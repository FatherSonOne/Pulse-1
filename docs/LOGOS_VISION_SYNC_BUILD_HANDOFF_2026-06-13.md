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
- **Key type:** **service-role** for the Logos project. RLS on every target table is *enabled but not forced* → service-role bypasses it; anon has zero policies (can't even read). The real write gates are the NOT NULL `org_id` + FK constraints, which apply to service-role too.

---

## 1. BLOCKING prerequisite (only the user can supply)

The build can be written and verified flag-OFF without this, but **nothing writes/reads Logos live until it exists**:

- `VITE_LOGOS_VISION_SUPABASE_URL` = `https://psjgmdnrehcwvppbeqjy.supabase.co`
- `VITE_LOGOS_VISION_SUPABASE_KEY` = **service-role** key for the Logos project

Until both are set, `logosVisionService` is `null` (`logosVisionService.ts:611-614`) and the whole feature no-ops by design.

---

## 2. Deviations from the spec handoff (live-driven — flagged per CLAUDE.md)

The spec's Section 5 was explicitly overridable. Live verification forces these changes:

1. **Case-log target = `activities`, not `case_notes`** (spec Q4 left open). Live: `case_notes` has 0 rows and requires NOT NULL `journey_id`(FK `client_journeys`), a text `client_id`, and `author_id` — it's journey-scoped clinical (SOAP/DAP) notes. `activities` is live/active (247 rows) and needs only `type`/`title`/`activity_date`/`org_id` + optional linkage, and has built-in provenance columns. `case_notes` (with `source='pulse_conversation'`, which IS an allowed CHECK value) is reserved for a later richer F1.
2. **F4 watches `client_journeys`, not `cases`.** Live: `cases` has **no `updated_at` UPDATE trigger** (`pg_trigger` confirmed) — a status change does not bump `updated_at`, so a watermark poll on `cases` silently misses updates. `client_journeys` HAS `trigger_client_journeys_updated_at` (maintained `updated_at`) **and** a `case_status` column.
3. **`activity_time` is `timestamptz` (nullable), not `'HH:mm'` text.** We simply don't write it.
4. **Latent bug in `createActivity`:** its insert block (`logosVisionService.ts:305-322`) omits `org_id` entirely. Against the live NOT NULL `activities.org_id`, **every call would fail with 23502.** This method must be extended before it can write (P3). The spec assumed it was write-ready; it isn't.
5. **`crmActionsService` is NOT a drop-in idempotency ledger.** `createAction` (`crmActionsService.ts:31`) immediately calls `executeAction` which **dispatches by `action_type` to existing per-platform CRM handlers** (HubSpot/etc.) and has **no dedup read on `triggered_by_message_id`**. Reusing it blindly would route Logos writes into the wrong handler. We use the `crm_actions` *table* as a dedup ledger with our own read-before-write guard, not the auto-executing `createAction`. (Also noted: `crm_actions.id` is `uuid` in DB but code inserts a `action-<uuid>` text string, and code writes an `updated_at` the base migration doesn't define — avoid both.)
6. **Send hooks fire from services, not components** → they can't use the `useFeatures()` React hook. We need a non-React flag read (mirror `lib/emailFeature.ts`'s `isEmailEnabled()`), reading the same `pulse_feature_flags` localStorage key.
7. **Connection options:** the constructor passes bare `createClient(url, key)` (`logosVisionService.ts:26-28`) → `persistSession`/`autoRefreshToken` default `true`. For a service-role client that must be `{ auth: { persistSession: false, autoRefreshToken: false } }` so it never collides with the user's Pulse auth session in localStorage.

---

## 3. Phase table

| Phase | Goal | Net-new artifacts | Size | Dep |
|---|---|---|---|---|
| **P0** | Connection + flag scaffold (flag OFF) | service-role client opts; real `healthCheck` wiring; `logosVisionSync` flag; `lib/logosSyncFeature.ts` | S | — |
| **P1** | Contact ↔ Logos mapping | `logosMappingService` over `logos_pulse_mappings`; "Link to Logos" UI on a contact | M | P0 |
| **P2** | Idempotency ledger | dedup helper over `crm_actions` table (own guard) | S | P0 |
| **P3** | F1 Conversation→Case Log | fix `createActivity` (org_id+author+provenance); hook `pulseService.sendMessage` + `sendQuickVox` | M | P1,P2 |
| **P4** | F2 Activity Feed Sync | `mapPulseTouchpointToLogosActivity`; extend hooks to team/thread + call/note emitters | M | P3 |
| **P5** | F3 AI Field Population | `invokeAIJson` extraction task; confirm-before-write UX; `updateClientFields`/`updateCaseFields` | L | P1 |
| **P6** | F4 Records Flow Back | `getJourneyUpdatesSince` delta read; `logos_case_state` Pulse mirror; score factor + feed | L | P1 |
| **P7** | Re-enable marketing surface | flip `SHOW_LOGOS_SYNC`; real "Connected" badge; honest single-tenant copy | S | P3+ |

**Thinnest end-to-end slice = P0→P1→P2→P3** (Conversation→Case Log genuinely working). P4–P7 layer on.

---

## 4. Phases in detail

### P0 — Connection + flag scaffold  *(flag OFF, no behavior change)*
- **Singleton opts:** add `{ auth: { persistSession: false, autoRefreshToken: false } }` to `createClient` (`logosVisionService.ts:26-28`); keep the `null` guard (`:611-614`) unchanged.
- **Flag:** add `logosVisionSync: boolean` to `FeatureFlags` (`FeatureContext.tsx:15-77`), default `false` (`DEFAULT_FEATURES` `:98-129`), `FEATURE_NAMES` `:306-320` (type-required), optional `FEATURE_DESCRIPTIONS`, and add to the `integrations` category (`:282-289`) so it auto-renders a toggle in `FeaturesLabsSettings.tsx`. Mirror `slackChannelsGrounding` exactly.
- **Non-React read:** new `src/lib/logosSyncFeature.ts` → `isLogosSyncEnabled()` reading `pulse_feature_flags` from localStorage (mirror `lib/emailFeature.ts`). Used by the service-side hooks in P3+.
- **Accept:** `logosVisionService.healthCheck()` returns `true` when env+key set (manual dev check); flag visible+toggleable in Settings; flag OFF = zero behavior change. tsc clean.

### P1 — Contact ↔ Logos mapping
- **Store:** revive `logos_pulse_mappings` (Pulse DB, exists, 0 rows; `pulse_entity_type`/`id` ↔ `logos_entity_type`/`id` + `sync_direction`/`sync_status`). **No migration needed.** New `src/services/logosMappingService.ts`: `resolveLogosClient(pulseContactId)`, `linkContact(pulseContactId, logosClientId, journeyId?)`, `unlink(...)`. Map `pulse_entity_type='contact'` ↔ `logos_entity_type IN ('client','journey')`.
- **UI:** minimal "Link to Logos client" control on a contact (Contacts detail/co-pilot). Lists Logos `clients` (read via `getClients()`), writes a mapping row. Honest empty-state when unmapped.
- **Accept:** link a Pulse contact → 1 mapping row; `resolveLogosClient` returns it; unmapped contact resolves to `null` cleanly.

### P2 — Idempotency ledger
- Thin helper (in `logosMappingService` or a new `logosLedger`): before a Logos write, `SELECT` `crm_actions` for an existing row with matching `triggered_by_message_id` + a Logos `action_type` (e.g. `'logos.activity'`); skip if present. After the write, `INSERT` a row with `status='completed'` (or `'failed'`+`error_message`). **Do not call `crmActionsService.createAction`** (auto-executes into wrong handler). Use `gen_random_uuid()` default for `id`; don't write `updated_at`.
- **Accept:** same `messageId` twice → 1 Logos row + 1 ledger row; failure path lands `status='failed'` with the error and never throws.

### P3 — F1 Conversation → Case Log
- **Fix `createActivity`** (`logosVisionService.ts:298-330`): add `org_id` (constant), default `created_by_id` to the owner team-member, and set provenance (`source_type:'pulse_conversation'` or similar, `source_entity_type:'pulse_message'`, `source_entity_id:<messageId>`). Leave `activity_time` unset. **This is the bug-fix that makes any write possible.**
- **Hook the clean DM/voice seams** (both expose a `recipientId` for contact resolution and a fresh message id for idempotency), fire-and-forget, mirroring the `messageChannelService.ts:322-326` `void notifyMappedMentions(...)` pattern:
  - `pulseService.sendMessage` — after the success guard (`pulseService.ts:425`), before `return data` (`:459`). Returns message id as `data`.
  - `voxModeService.sendQuickVox` — after the error guard (`voxModeService.ts:2116-2119`), beside the existing `createNotification` (`:2123`). Has `recipientId` + `data.id`.
- Each hook: gated on `isLogosSyncEnabled()`; resolve contact→Logos client via P1; skip silently if unmapped; route through P2 dedup; never block or refetch (respect the disappearing-message contract — `sendMessage` only returns the id; the realtime subscription owns the list).
- **Accept (spec §7 F1):** send to linked contact → exactly 1 `activities` row in ≤5s with body+author+timestamp+messageId ref; retry/re-render → no dup; unlinked contact → 0 rows, 0 errors; Logos write failure → Pulse send still succeeds.

### P4 — F2 Activity Feed Sync
- Generalize P3 into `mapPulseTouchpointToLogosActivity(touchpoint)` → `activities.type` (call/message/note; unknown → fallback `communication`, no error).
- Extend hooks to the weaker-identifier voice paths (`sendTeamVoxMessage` `:1291` via `mentions[]`+`channelId`; `sendVoiceThreadMessage` `:859` — thread-scoped, weakest) and any call-log/note-create emitters.
- **Accept (spec §7 F2):** call→`type='call'`+duration; note→`type='note'`; unknown→`communication`; idempotent per source-event; visible in `getActivities({clientId})`.

### P5 — F3 AI Field Population
- Server-side extraction via `invokeAIJson<T>(task, prompt, { workspaceId, systemPrompt })` (`src/services/ai/aiService.ts:192-197`) — **no client-side AI key** (router-enforced). Add an `AITask` value if needed.
- Net-new writes on `logosVisionService`: `updateClientFields(clientId, patch)` / `updateCaseFields(...)` — `.update()` with `org_id` echo. **Additive only:** never overwrite a non-empty Logos field without explicit "replace". Confirm-before-write UX; coral provenance chip on AI-suggested values (coral = AI only).
- **Accept (spec §7 F3):** ≥N messages → suggestion set; accept writes one field, reject writes nothing; non-empty field never silently overwritten; each write records provenance.

### P6 — F4 Records Flow Back  *(heaviest)*
- **Delta read:** new `getJourneyUpdatesSince(watermark)` on `logosVisionService` over `client_journeys` (maintained `updated_at` + `case_status`), filtered to mapped clients.
- **Pulse mirror:** net-new `logos_case_state` table (Pulse) — additive, reversible; schema-first dry-run per CLAUDE.md before apply. Poller lands deltas here; feed/score read the mirror, not a live cross-DB query per render.
- **Score feed:** add a Logos-case-outcome factor into `relationshipIntelligenceService.computeRelationshipScore` sum (`relationshipIntelligenceService.ts:486-488`). ⚠ The 5 current factors already total exactly 100 (25+20+25+15+15) — adding a 6th requires **re-weighting**, not just `+factor` (otherwise the `Math.min(...,100)` clamp at `:491` silently eats it). Document the re-weight direction.
- **Accept (spec §7 F4):** Logos journey/case-status change → Pulse feed entry within interval; deduped; resolved case adjusts score input in a documented direction; Logos unreachable → last-synced + staleness indicator, not an error.

### P7 — Re-enable marketing surface
- Flip `SHOW_LOGOS_SYNC` (`LandingPage.tsx:61`) to `true`; restore/adjust the "Know your network." copy (~`:2960`) to match what shipped, keeping "bidirectional" honest re: single-tenant.
- Make the "Connected/live" badge **real** — driven by `healthCheck()` / last-sync state, never hardcoded.
- **Accept:** badge reflects real connectivity; copy matches shipped behavior.

---

## 5. Risk register
- **Service-role key in a Vite build-time var** ships the key to the client bundle. Single-tenant owner-only tool, but document it; if it ever graduates to multi-user, move writes behind the two-header ecosystem bridge (server-side), never a client-embedded service key.
- **No UPDATE on `activities`** — it has a `BEFORE UPDATE` trigger referencing a non-existent `updated_at` column; an UPDATE would error. Insert-only.
- **`cases_plan_gate`** requires org plan ∈ {pro,impact}; currently `impact` (satisfied), and service-role bypasses anyway — but a plan downgrade would break authenticated reads of `cases`.
- **Score re-weight (P6)** changes existing relationship scores for all contacts — call it out before shipping.

## 6. Open decisions for the user (pre-P3)
1. **Case-log richness:** ship F1 on `activities` (recommended, this plan) and revisit `case_notes` later — or invest in journey-mapping now to write `case_notes` from day one?
2. **Mapping UX home:** "Link to Logos" on the Contacts co-pilot rail, or a dedicated Settings→Integrations surface?
3. **P5/P6 scope for v1:** are F3 (AI field write-back) and F4 (records flow back + score change) in the first cut, or is v1 = P0–P4 (outbound only) with F3/F4 fast-followed?

---

## 7. Key files (all verified this session)
- `src/services/logosVisionService.ts` — client; `createActivity:298` (needs org_id fix), `healthCheck:420`, singleton `:611-614`.
- `src/contexts/FeatureContext.tsx` + `src/components/settings/FeaturesLabsSettings.tsx` — flag pattern (mirror `slackChannelsGrounding`).
- `src/lib/emailFeature.ts` — non-React flag-read pattern to mirror.
- `src/services/messageChannelService.ts:322-326` — the fire-and-forget hook pattern.
- `src/services/pulseService.ts:390,425,459` + `src/services/relay/voxModeService.ts:859,1291,2083` — send seams.
- `src/services/crmActionsService.ts` — ledger (use table, not auto-exec `createAction`).
- `src/services/ai/aiService.ts:192` — `invokeAIJson` for P5.
- `src/services/relationshipIntelligenceService.ts:486-500` — score sum + persistence for P6.
- Pulse DB: `logos_pulse_mappings` (mapping store), `crm_actions` (dedup), net-new `logos_case_state` (P6).
- Logos DB: `activities` (write target), `client_journeys` (F4 watch), `clients`/`cases` (read).
