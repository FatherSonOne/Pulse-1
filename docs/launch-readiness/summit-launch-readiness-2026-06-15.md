# Pulse Section Launch Readiness — Summit (2026-06-15)

## Executive Summary

Summit is Pulse's real-time two-way voice surface ("talk to Pulse AI"), built on the OpenAI Realtime GA stack with a server-side ephemeral-token mint, tier-gated hosted minutes, a BYO-OpenAI-key escape hatch, and in-conversation artifact capture (Decisions / Tasks / References / Open Questions) that persists to real Supabase tables. **The verdict is LAUNCH WITH CAVEATS**: the core voice loop, the data layer, and the failsafe inventory are genuinely real and well-engineered — every table the client writes to exists with correct RLS, and the four service files are wired, not theatrical. **The single biggest risk is the hosted-minutes meter**: it is a no-retry, fire-and-forget, client-trusted call (`Summit.tsx:1007-1028`) whose write is the *only* source the server gate reads — so a dropped session-end event lets a user start unlimited future sessions against a never-incrementing monthly cap, a real revenue/quota leak that should be closed before broad hosted-tier exposure.

## Phase 1: Forensic Capability Audit

### 1c. Capability Matrix

| # | Capability | UI Location | Handler | Service / Edge Fn | DB Table | Status | Failure Mode |
|---|-----------|-------------|---------|-------------------|----------|--------|--------------|
| 1 | Server-side ephemeral client_secret mint | Summit connect → RealtimeVoiceAgent | `realtimeAgentService.ts:1468-1557 generateEphemeralToken` | `openai-realtime-token` (v60, verify_jwt=false) | — | ✅ REAL | Edge fn 401 → "Sign-in expired" (`realtimeAgentService.ts:1545`); UPSTREAM_ERROR relayed (`index.ts:197-207`) |
| 2 | Client mint + WebRTC handshake (post-mint client→OpenAI, sanctioned) | Summit connect | `realtimeAgentService.ts:767 /v1/realtime/calls` | OpenAI Realtime GA (`gpt-realtime`) | — | ✅ REAL | Edge fn fail → handleConnect 5s toast + reset (`Summit.tsx:949-951`) |
| 3 | BYO OpenAI key (Vault-encrypted, server-minted) | Settings → AI; Summit BYO path | `byoKeyService.ts:80`; mint body sk- (`realtimeAgentService.ts:1524`) | `read_user_openai_key()` SECURITY DEFINER | `user_openai_keys` + `vault.secrets` | ✅ REAL | Plaintext fetch null → falls through to hosted path silently (`Summit.tsx:294-296`) — graceful but no BYO-failed toast |
| 4 | Pre-flight tier + cap gate (server-side) | n/a (edge) | `openai-realtime-token/index.ts:91-167` | `openai-realtime-token` | `entitlements`, `usage_records`, `workspace_members` | ✅ REAL | Returns 402/403 before minting; mirrored client-side |
| 5 | Entitlement gate (tier + trial + minute caps + BYO) | Summit token-resolution effect + intro modal | `useSummitEntitlement.ts:82-119` | `billingService.getEntitlements` | `entitlements`, `usage_records` | ✅ REAL | Solo → capMinutes 0 → 'wrong_tier'; free → 'no_subscription' |
| 6 | Section visibility gate (`experimentalEnabled`, default OFF) | Sidebar Experimental group; MobileNavSheet | `FeatureContext.tsx:54,156`; `Sidebar.tsx:403-404` | — | — | ✅ REAL | Default OFF: Summit hidden in sidebar until Settings→Features flip |
| 7 | Command Palette (Cmd+K) bypass of section gate (desktop) | Global Cmd+K `nav-summit` | `App.tsx:279,288,296`; router `App.tsx:1426` (verified unconditional) | — | — | ⚠️ FRAGILE | No `experimentalEnabled` filter; router renders `<Summit>` unconditionally → section-disabled contract leaks on desktop. NOT free voice (entitlement gate + server mint still block). Mobile correctly locked (`MobileNavSheet.tsx:54,74`) |
| 8 | Hosted-minutes usage metering (session end) | Summit session end → meter | `Summit.tsx:1007-1028` (verified fire-and-forget `void (async)()`) | `summit-session-end` (v23) → `increment_usage` | `usage_records` (metric=summit_minutes) | ⚠️ FRAGILE | Single attempt, catch=console.warn only (`:1025`); dropped end-event → minutes never recorded → unlimited future sessions bounded only by per-session cap |
| 9 | `increment_usage` "idempotent" comment claim | n/a (code comment + SQL) | `Summit.tsx:1022-1024` comment vs `billing_system.sql:509` | `increment_usage` RPC | `usage_records` | 🎭 THEATRICAL | SQL is `quantity = usage_records.quantity + p_quantity` (additive, verified). Comment is FALSE; latent double-bill if a retry is ever added. No live defect today (no retry exists) |
| 10 | Per-session cap warn + auto-disconnect | Live canvas | `Summit.tsx:1348-1359` | — | — | ✅ REAL | Warns at cap-60s, auto-disconnects at sessionMaxSec |
| 11 | Runaway-mic failsafes (visibility/inactivity timers + echo auto-mute) | Live canvas | `Summit.tsx:1366-1431`; `RealtimeVoiceAgent.tsx:585-604` | — | — | ✅ REAL | Layered timers; guards route through the fragile meter on teardown |
| 12 | Ephemeral token mid-session expiry | Live session | OpenAI teardown only | — | — | ⚠️ FRAGILE | No proactive re-mint; relies on per-session cap (≤1800s) ending before ek_ TTL |
| 13 | voiceSessionStore — Supabase persistence | Mount load (`:521`) + session-end save (`:1003`) | `voiceSessionStore.ts:189-258` | `saveVoiceSessionRemote` / `loadVoiceSessionsRemote` | `summit_sessions` (13 cols verified) | ✅ REAL | Read fail → localStorage cache (`:201-203`); write fail → console.warn, local already written — graceful degrade |
| 14 | voiceSessionStore — localStorage cache | n/a | `voiceSessionStore.ts:86-116,177-183` | — | localStorage `pulse_voice_sessions` | ✅ REAL | try/catch swallows quota/private-mode (`:102-104`); cap MAX_SESSIONS=12 |
| 15 | artifactExtractor — heuristic transcript classification | Live transcript → artifact bucket | `artifactExtractor.ts:102-126` | — (pure fn, regex) | `summit_sessions` (JSON) | ✅ REAL | Conservative by design; false negatives accepted, user adds manually. Honestly labeled "Heuristic classifier" — not fake-AI |
| 16 | toolCallRouter — mirror realtime tool calls → artifact panel | `handleHistoryUpdate` (`Summit.tsx:736`) | `toolCallRouter.ts:141-194` | — | — | ✅ REAL | Unknown tools marked routed & skipped (`:167-170`); deduped via `routedToolPairsRef` |
| 17 | toolCallRouter — arg-name mismatch with tool schemas | Mirrored artifact card text | `toolCallRouter.ts:49-89` | — | — | ⚠️ FRAGILE | Reads `args.title`/`args.description` but schema is `decision`/`context` (verified `warRoomToolsService.ts:337`); reads `args.deadline` but schema is `dueDate` (`:266`). Card falls to "Decision recorded" / drops due date. **Cosmetic — persistence unaffected** (each tool's own execute() reads correct args) |
| 18 | Realtime tools persist server-side (create_task/create_decision) | RealtimeVoiceAgent (mounted by Summit `:1895`) | `warRoomToolsService.ts:271-380` | `taskService.createTask` / `decisionService.createDecision` | `extracted_tasks`, `decisions` | ✅ REAL | Tools need approval (`needsApproval:true`); no-workspace returns string not throw |
| 19 | ArtifactPanel add/edit/delete/captures | ArtifactPanel | `ArtifactPanel.tsx:122-328` → `Summit.tsx:587-635` | — | `summit_sessions` (JSON `:993`) | ✅ REAL | Edits persist into session JSON |
| 20 | ArtifactPanel edit/delete of already-pushed tool row | ArtifactPanel TOOL tag | `ArtifactPanel.tsx:230-241` | — | — | ⚠️ FRAGILE | Edit/delete of a tool-created standalone row does NOT retract the already-persisted server row — silent divergence |
| 21 | CapturesPanel (Cmd+J) read into ArtifactPanel | ArtifactPanel | `ArtifactPanel` embeds CapturesPanel filtered by sessionId | shared capture service | `pulse_notes` | ✅ REAL | Read-only on Summit side; write path is shared capture service |
| 22 | EndSessionSheet — Save Markdown (Blob download) | EndSessionSheet markdown dest | `EndSessionSheet.tsx:215-232`; `summitExportService.ts:56-99`; `Summit.tsx:183-194` | `summitExportService.renderMarkdown` + downloadMarkdown | — | ✅ REAL | try/catch marks 'failed' + toast (`:1135`); deferred revokeObjectURL avoids Safari/FF cancel |
| 23 | EndSessionSheet — Push decisions | EndSessionSheet decisions dest | `EndSessionSheet.tsx:269-297`; `summitExportService.ts:105-130` | `decisionService.createDecision` | `decisions` | ✅ REAL | Per-row try/catch; requires workspace+sign-in else explicit 'failed' (`Summit.tsx:1179-1181`) |
| 24 | EndSessionSheet — Push tasks | EndSessionSheet tasks dest | `EndSessionSheet.tsx:299-327`; `summitExportService.ts:136-163` | `taskService.createTask` | `extracted_tasks` | ✅ REAL | Per-task try/catch; requires workspace+sign-in |
| 25 | EndSessionSheet — Export to War Room (archive) | EndSessionSheet warRoom dest | `EndSessionSheet.tsx:235-267`; `summitExportService.ts:169-193` | `archiveService.createArchive` | `archives` | ✅ REAL | Structured error returned; UI toasts exact error |
| 26 | EndSessionSheet — Email draft (mailto + clipboard) | EndSessionSheet email dest | `Summit.tsx:1154-1167` | mailto + clipboard fallback (`:206-213`) | — | ✅ REAL | mailto-too-long → clipboard fallback |
| 27 | Tool-sourced artifacts excluded from end-session push | EndSessionSheet | `Summit.tsx:1169-1172`; `EndSessionSheet.tsx:121-128` | — | — | ✅ REAL | source:'tool' filtered to avoid double-write (validated by #18) |
| 28 | SessionsCanvas — recent grid (real saved sessions) | Sessions canvas | `SessionsCanvas.tsx:192-307` | `loadVoiceSessionsRemote` | `summit_sessions` | ✅ REAL | localStorage fallback on remote fail |
| 29 | SessionsCanvas — open / notes / export menu / re-export | Sessions canvas | `SessionsCanvas.tsx:224-292`; `Summit.tsx:1585-1642` | `summitExportService` | — | ✅ REAL | Escape/outside-click dismiss (`:117-133`) |
| 30 | SessionsCanvas — delete (no confirm) | Sessions canvas Trash2 | `SessionsCanvas.tsx:293-301` (verified direct onClick); `Summit.tsx:1577-1582` | `deleteVoiceSession` + `deleteVoiceSessionRemote` | `summit_sessions` | ⚠️ FRAGILE | Single-click permanent hard DELETE, no confirm, no undo |
| 31 | SessionsCanvas — live hero meter + prompt chips | Sessions canvas hero | `SessionsCanvas.tsx:138-342`; `Summit.tsx:1518-1575` | — | — | ✅ REAL | Thin empty state when live-no-captures (`:345-350`) |
| 32 | Prompt chips (Summarize unread / Review meetings / Draft replies) | Intro / idle canvas chips | `Summit.tsx:130-134,1562-1575` | `handlePromptSelect` (injects ContextFile, then connect) | — | ⚠️ FRAGILE | NO data pre-fetch; chip is an opening-prompt string. Live data depends entirely on model calling runtime tools. Summit imports nothing from messages/calendar/email |
| 33 | SessionsCanvas empty-hero model label | Sessions canvas hero | `SessionsCanvas.tsx:337` (verified `GPT-4O REALTIME`) | — | — | ⚠️ FRAGILE | Stale label; real model is `gpt-realtime` (`realtimeAgentService.ts:387/1517`) |
| 34 | TranscriptBreathing rail | Live rail | `TranscriptBreathing.tsx:41-107` (stateless) | — | — | ✅ REAL | Stateless presentation |
| 35 | TranscriptBreathing model label | Live rail header | `TranscriptBreathing.tsx:67`; `Summit.tsx:1512-1516` | — | — | ⚠️ FRAGILE | Stale `GPT-4O · …` label; real model `gpt-realtime` |
| 36 | Settings toggles + Context drawer applied mid-session | In-session settings/context drawer | `RealtimeVoiceAgent.tsx:231,235` (connect-only) | class supports `setParticipantMode`/`updateConfig`/`setContextDocuments` but never wired | — | 🔌 DISCONNECTED | useImperativeHandle (`:352-373`) exposes only connect/disconnect/mute/pause; no useEffect watches aiMode/voiceSettings/contextFiles. **Mid-session changes are no-ops until next Connect** (verifier confirmed) |
| 37 | summit-60 manual override | n/a (DB-side data) | none in src/ (grep clean) | manual `entitlements` row edit | `entitlements` | ✅ REAL (data-only) | Read transparently via `useSummitEntitlement.ts:105`; at risk of being clobbered by `rebuild_entitlements` (data fragility, not a code path) |

**Status tally across 37 capabilities:** ✅ REAL = 25 · ⚠️ FRAGILE = 10 · 🔌 DISCONNECTED = 1 · 🎭 THEATRICAL = 1 · 💀 DEAD = 0.

### 1d. Data Integrity

Verified against live ground truth (information_schema.columns, pg_constraint, pg_policies, pg_proc) on project `ucaeuszgoihoyrvhewxk`, traced through actual client/edge code.

| Table | Exists | RLS | Scoping | id-type | TS↔Schema | Notes |
|-------|:---:|:---:|---------|---------|-----------|-------|
| `summit_sessions` | ✅ | ✅ | Per-user: `user_id=auth.uid()` AND `user_has_workspace_access(workspace_id)` — personal even in shared ws | `id uuid` PK; `user_id uuid`; `workspace_id uuid` | Clean 1:1 (13 cols match upsert) | Source of truth; localStorage is write-through cache. `user_id` is uuid (NOT the text convention). **0 live rows** — failing insert downgraded to console.warn (`:246`), so a silent RLS reject is invisible |
| `usage_records` | ✅ | ✅ | SELECT-only for users (ws membership); writes service-role only | `id uuid`; `workspace_id uuid`; UNIQUE(workspace_id,metric,period_start) | Clean — `metric` CHECK includes `summit_minutes` (verified) | The Summit minutes meter. Gate READS it; `summit-session-end` WRITES via `increment_usage` (additive, NOT idempotent — verified SQL `:509`) |
| `entitlements` | ✅ | ✅ | Workspace-scoped, PK `workspace_id`; rebuilt by `rebuild_entitlements()` SECURITY DEFINER | `workspace_id uuid` PK; `max_summit_minutes_mo int` (nullable); `max_summit_session_sec int` (nullable) | Clean — both summit cols present | Solo exclusion by data: caps seeded only on pulse_team/pulse_growth; NULL elsewhere → WRONG_TIER. **Manual summit-60 override is ephemeral** — clobbered on rebuild |
| `plans` | ✅ | ✅ | Reference table | `id text` PK ('pulse_team' etc.) | Clean (`max_summit_minutes_mo: number\|null`) | Source of caps `rebuild_entitlements` rolls in. Trial caps (15/300) are runtime constants, not stored here |
| `user_openai_keys` | ✅ | ✅ | Strictly personal `user_id=auth.uid()` all ops | `user_id uuid` PK (FK auth.users); `vault_secret_id uuid` | Clean (never returns secret) | BYO path; sk- in vault.secrets. 1 live row |
| `pulse_notes` | ✅ | ✅ | INSERT/UPD/DEL: `user_id=auth.uid()` + ws access; SELECT ws-wide | `id uuid`; `user_id uuid`; `kind` CHECK (decision/learning/friction/question/task) | Clean on Summit read path | Cmd+J capture layer read into ArtifactPanel. `kind` CHECK has NO generic 'note'/'reference' — any Summit-side write must satisfy CHECK + NOT NULL source_section/tags |
| `decisions` | ✅ | ✅ | Workspace-scoped | `id uuid`; `created_by text` NOT NULL; `proposal_text text` NOT NULL | RESOLVED in service: `decisionService` maps title→proposal_text, proposed_by→created_by, supplies status/threshold. Raw insert with TS names WOULD fail; Summit never inserts raw | No integrity risk on current path (self-documented `decisionService.ts:44-49`) |
| `extracted_tasks` | ✅ | ✅ | Workspace-scoped (canonical task table) | `id uuid`; `title text` NOT NULL; NO `created_by` column | RESOLVED: `taskService` folds created_by into metadata jsonb (`:53,62`) | Summit correctly targets this, NOT legacy `tasks` |
| `archives` | ✅ | ✅ | `user_id text` NOT NULL (inconsistent-id convention) | `id uuid`; `user_id text`; `archive_type text`; `created_by uuid` | Not read line-by-line — `archiveService` maps `type`→`archive_type` app-wide (543 live rows) | Lowest-confidence mapper (not directly inspected) but proven path |
| `workspace_members` | ✅ | ✅ | `workspace_id uuid` + `user_id uuid` both NOT NULL | uuid/uuid | Clean | Membership gate for both Summit edge fns |
| `tasks` (legacy) | ✅ | ✅ | `user_id text` — being phased out | `id uuid`; `user_id text` | N/A — Summit does NOT write here | Listed to confirm mis-target ruled out |

**Risks:**
1. **Metering trust + gap window (REAL billing risk):** hosted minutes metered after-the-fact by a client-trusted, fire-and-forget call (`Summit.tsx:1011`); the gate (`openai-realtime-token`) only reads accumulated `usage_records`, which is written *only* by the dropped client event — a missed end-event → minutes never recorded → user can start unlimited sessions bounded only by per-session length. Low data-integrity risk, real revenue/quota leak.
2. **summit-60 override clobber:** manual `entitlements.max_summit_minutes_mo` edit is derived solely from plan rows by `rebuild_entitlements`; any billing event for that workspace silently turns Summit off. Confirm whether the override lives on a plan row (durable) or entitlements row (ephemeral).
3. **summit_sessions 0 live rows + silent insert failure:** a failing insert is downgraded to console.warn — needs one live smoke test that a completed session lands a row.
4. **archives mapper unverified:** the one Summit write-destination service mapper (`type`→`archive_type`, `user_id text`) not read line-by-line; low risk given 543 live rows app-wide.
5. **Realtime path is correctly server-side:** only client→OpenAI traffic is the sanctioned post-mint WebRTC handshake. Not a direct-API-call bug. Called out so it isn't mis-flagged.

### 1e. Failsafe Inventory

| Scenario | Handling | Grade |
|----------|----------|:---:|
| Supabase `summit_sessions` read fails (offline/RLS/network) | Returns localStorage cache (`voiceSessionStore.ts:201-203`) | A |
| Supabase `summit_sessions` write fails | console.warn + return; localStorage already written synchronously by caller — no user-visible loss (`:245-247`) | A |
| localStorage unavailable (private mode / quota) | try/catch swallows; Supabase remains source of truth (`:102-104`) | A |
| Decision/task push partially fails at session end | Per-row try/catch; precise toast "3 of 4 pushed" (`summitExportService.ts:125,158`; `Summit.tsx:1176-1199`) | A |
| Push with no workspace / anonymous user | Explicit 'workspace or sign-in required' fail (`Summit.tsx:1179-1191`) — not silent drop | A |
| Markdown export Blob/download fails | try/catch marks 'failed' + toast; deferred revokeObjectURL avoids Safari/FF cancel (`Summit.tsx:1135,192-193`) | A |
| War Room archive returns no id | `{ok:false,error:'Archive creation returned no id'}`; UI toasts (`summitExportService.ts:183-184`) | A |
| Edge fn fails / OpenAI mint non-OK | `{error,code:UPSTREAM_ERROR}` relayed; client throws; 5s toast + reset (`index.ts:197-207`; `Summit.tsx:949-951`) | A |
| JWT / sign-in expired (401) | Edge 401 → "Sign-in expired"; handleConnect clears key + banner (`realtimeAgentService.ts:1545`; `Summit.tsx:940-944`) | A |
| Workspace not loaded / not a member | Client guards + server NOT_MEMBER 403 (`Summit.tsx:299-303`; `index.ts:99-107`) | A |
| Runaway open mic burning OpenAI cost | Layered visibility/inactivity timers + echo auto-mute (`Summit.tsx:1348-1431`; `RealtimeVoiceAgent.tsx:585-604`) | A |
| Single session exceeds per-session cap | Warn at cap-60s, auto-disconnect at cap (`Summit.tsx:1350-1359`) | A |
| Free/Solo/trial/over-cap opens Summit | Reason-specific entitlement messages + upgrade CTA in intro modal (`Summit.tsx:307-314,2118-2138`) | A |
| Malformed tool output JSON | `safeParseJSON` returns null; meta omits refId gracefully (`toolCallRouter.ts:34-40`) | A |
| Duplicate tool-call history re-fire | `routedToolPairsRef` Set dedupes; unknown tools marked routed (`Summit.tsx:747`) | A |
| Realtime tool emits schema-named args router doesn't read | Card falls to "Decision recorded" / drops dueDate — no crash; server persistence correct (`toolCallRouter.ts:52,81`) | C |
| BYO key on file but plaintext fetch returns null | Falls through BYO→hosted, entitlement handles it — graceful but silent, no "BYO failed" toast (`Summit.tsx:294-296`) | B |
| Experimental section OFF but user opens Summit via Cmd+K | Section gate leaks (`App.tsx:288` no filter, router unconditional `:1426`); entitlement gate is the only backstop — entitled/BYO user gets full voice despite "disabled" section. Mobile NOT leaky | C |
| Ephemeral token expires mid-session | No proactive re-mint; bounded by per-session cap; OpenAI teardown → toast + persistSession | C |
| SessionsCanvas delete misclick | Single-click permanent hard DELETE, no confirm/undo (`SessionsCanvas.tsx:296`) | C |
| Duplicate/retried session-end report | `increment_usage` additive (`billing_system.sql:509`) → would double-count; safe only because client fires once; no dedupe | C |
| summit-session-end metering call fails | Non-fatal catch (`Summit.tsx:1020-1026`); next load re-reads; one session's minutes lost — but NO retry | B |
| **Client never reports session end (crash / OS-kill / network drop)** | Fire-and-forget, NO retry/beacon/ledger (`Summit.tsx:1007-1028`, console.warn `:1025`); minutes lost AND the gate then grants free future minutes | **F** |

## Phase 2: User Trust Assessment

### 2a. The "Real User" Test

**Solo professional (note: Solo tier excludes hosted Summit by design — this persona is on BYO or trial):**
1. *"Can I just talk to it and have it talk back naturally?"* — Yes. Real OpenAI Realtime GA loop, server-minted token, barge-in inherited from the engine. ✅
2. *"If I add my own OpenAI key, does it actually use it and not bill me through Pulse?"* — Yes. BYO is Vault-encrypted, server-minted, bypasses all metering (`useSummitEntitlement.ts:82-95`). BYO failure is silent though. ✅ (with B-grade silence)
3. *"Will my session and its takeaways survive a refresh / be there tomorrow?"* — Yes, persisted to `summit_sessions` with localStorage cache; but 0 live rows means this hasn't been smoke-tested end-to-end. ⚠️
4. *"If I delete a session by accident, can I get it back?"* — No. Single-click permanent delete, no confirm, no undo. ❌
5. *"When I click those starter chips ('Summarize my unread Pulse messages'), does it actually read my inbox?"* — Not directly; the chip is a prompt string and depends on the model choosing to call runtime tools. The promise over-reaches the wiring. ⚠️

**Small-team lead (Team/Growth, hosted minutes):**
1. *"Are my minutes counted accurately so I'm not surprised by a bill / cutoff?"* — Mostly, but a crash/close at session end loses minutes and quietly grants free future sessions. The meter is the weakest link. ❌ (F-grade scenario)
2. *"Do spoken decisions/tasks land in our real Decisions & Tasks?"* — Yes, real writes to `decisions`/`extracted_tasks` with per-row success/fail reporting. ✅
3. *"If a push half-fails, do I know which items didn't make it?"* — Yes, precise "3 of 4 pushed" toast. ✅
4. *"Can the team see the section is a v2 experiment, or will people stumble into it?"* — Mostly gated, but desktop Cmd+K bypasses the section gate. ⚠️
5. *"Can I export a record for someone not in Pulse?"* — Yes: Markdown download + email draft + War Room archive. ✅

### 2b. Trust Killers

- **Hosted-minute meter loses minutes on abnormal session end and then grants free future sessions** — `Summit.tsx:1007-1028` (verified fire-and-forget `void (async)()`, single attempt, catch=console.warn `:1025`). The server gate reads only the row this dropped call writes (`openai-realtime-token/index.ts:135-167`). This is the one F-grade failsafe and a real revenue/quota leak.
- **Permanent single-click session delete, no confirm, no undo** — `SessionsCanvas.tsx:296` (verified direct `onClick={() => onSessionDelete?.(s.id)}`) → hard DELETE `voiceSessionStore.ts:253-258`.
- **Stale "GPT-4O" model labels post-`gpt-realtime` GA** — `SessionsCanvas.tsx:337` ("GPT-4O REALTIME", verified) and `Summit.tsx:1512-1516` rail label. A user who knows the model reads this as "the app doesn't know what it's running."
- **A FALSE "idempotent" code comment over additive billing SQL** — `Summit.tsx:1022-1024` vs `billing_system.sql:509` (`quantity = usage_records.quantity + p_quantity`, verified additive). Not a live defect, but a documented trap for the next engineer who adds a retry → double-bill.
- **Prompt chips imply cross-section data access the surface doesn't statically wire** — `Summit.tsx:1562-1575`; Summit imports nothing from messages/calendar/email. Reads as a capability claim Summit can't keep on its own.
- **Mid-session Settings/Context changes silently do nothing** — `RealtimeVoiceAgent` useImperativeHandle (`:352-373`) never exposes the live-update methods; user toggles a setting and nothing changes until reconnect, with no feedback.

### 2c. Stickiness Factors

| Factor | State | Evidence |
|--------|-------|----------|
| Conversation leaves durable structured artifacts in the user's system of record | **Present** | Real writes to `decisions`/`extracted_tasks`/`archives` (caps 23-25) |
| Cross-session searchable session archive | **Present** | SessionsCanvas reads real `summit_sessions` (`:192-307`), but capped at 12 |
| BYO-key escape hatch (cost control / privacy) | **Present** | Vault-encrypted, server-minted (cap 3) |
| Voice ITSELF grounded in the user's live work data in the hands-free loop | **Partial** | Depends on model calling runtime tools at session time; chips don't pre-fetch (cap 32) |
| Persistent cross-session memory / personality | **Missing** | No carry-over context across sessions; each session is cold |
| Audio playback / verification of extracted artifacts | **Missing** | "AUDIO NOT STORED" (`SessionsCanvas.tsx:339`) — no way to verify a decision against the recording |
| Mid-session steering (change mode/voice/context without reconnect) | **Missing** | DISCONNECTED (cap 36) |
| Multi-format derivative artifacts (briefing/FAQ/mind map) | **Missing** | Only Markdown / push / archive |

## Phase 3: Competitive Intelligence

### 3a. Incumbent Tools

**Real-time voice analogs (direct):**
- **ChatGPT Advanced Voice Mode** (Free / Plus $20 / Pro $200): best-in-class latency + barge-in, inline voice-in-chat, video-in-voice, read-only connectors (Gmail/Outlook/Drive/Slack, NOT in EU/UK). Voice quality widely panned as "robotic/rushed"; connectors not wired into the live voice loop.
- **Google Gemini Live** (Free tier includes Live; AI Pro $20 / Ultra $250): deepest automatic Workspace grounding (Gmail/Calendar/Docs by default), ~32× cheaper Live API. But grounding lives in text/chat — separate from the spoken loop; Live streams disconnect after minutes; Google-ecosystem-locked.
- **Microsoft 365 Copilot Voice** ($20-22/mo; M365 add-on $30/user): strongest "talk to your email + calendar hands-free" pitch, native Graph grounding, voice email triage. But a severe trust crisis (44% lapsed-user distrust; ToS says "entertainment purposes only"); Microsoft-locked.
- **Perplexity Voice (iOS/Comet) & Pi**: Perplexity is a Siri-replacement for cross-app actions incl. light calendar/email; paywall dropped Mar 2026. Pi is the warmth/memory benchmark, fully free — but no work-data grounding and no structured artifact output. Neither captures durable decisions/tasks.

**Notetaker analogs (artifact-capture adjacent):** Otter.ai, Fireflies.ai, Granola, Read.ai, Fathom, Notion AI Meeting Notes, NotebookLM. These capture artifacts from *recorded meetings*, not from talking *with* an AI — and they ship the exact failure mode Summit's artifact layer must avoid: hallucinated/mis-attributed action items (Otter), wrong-person assignment, 85-96% accuracy ceilings, and (Fireflies BIPA suit, Read.ai bans) compliance/consent crises.

### 3b. Feature Gap Matrix

| Feature | Pulse Summit | ChatGPT AVM | Gemini Live | Copilot Voice | Perplexity/Pi | Class |
|---------|:---:|:---:|:---:|:---:|:---:|------|
| Low-latency speech-to-speech + barge-in | ✅ (OpenAI Realtime) | ✅ | ✅ | ✅ | ✅ | Table-Stakes |
| Multiple natural voices | ✅ (engine) | ✅ | ✅ | ✅ | ✅ | Table-Stakes |
| Hands-free continuous conversation | ✅ | ✅ | ✅ | ✅ | ✅ | Table-Stakes |
| Live on-screen transcript | ✅ (TranscriptBreathing) | ✅ | ✅ | ✅ | partial | Table-Stakes |
| Cross-platform (mobile + desktop) | ✅ (Capacitor + web) | ✅ | ✅ | ✅ | ✅ | Table-Stakes |
| Free or ~$20 entry tier for voice | ❌ (Team/Growth; Solo excluded) | ✅ | ✅ | ✅ | ✅ | Table-Stakes |
| Web/search grounding | partial (runtime tools) | ✅ | ✅ | ✅ | ✅ | Table-Stakes |
| Voice grounded in YOUR work data in the live loop | partial | ❌ (text-only) | ❌ (separate) | partial | ❌ | Delighter |
| Camera/video "see what you see" in voice | ❌ | ✅ | partial | ❌ | ❌ | Delighter |
| Auto pre-meeting/pre-task context assembly | ❌ | ❌ | ✅ (Personal Intelligence) | partial | ❌ | Delighter |
| Persistent cross-session memory/personality | ❌ | partial | partial | partial | ✅ (Pi) | Delighter |
| Structured artifact capture from the conversation | ✅ (decisions/tasks) | ❌ | ❌ | ❌ | ❌ | **Unique** |
| Artifacts flow into a system of record that acts on them | ✅ (Decisions & Tasks, contacts, calendar) | ❌ | ❌ | partial (Graph) | ❌ | **Unique** |
| Ecosystem-neutral grounding (Gmail+Outlook+Slack in one corpus) | ✅ (Pulse ingest) | partial | ❌ (Google) | ❌ (MS) | ❌ | **Unique** |
| Cited / source-linked artifacts | partial (War Room RAG reuse possible) | ❌ | partial | ✅ (web cites) | ✅ | Delighter |
| Audio playback / verification | ❌ (not stored) | n/a | n/a | n/a | n/a | Expected |
| Cross-app agentic execution (book/send/schedule) | ❌ (Pulse-scoped) | partial (Agent) | partial | partial | ✅ | Delighter |

### 3d. Moats & Gaps

**Real moats (verified against code, not just claimed):**
- **The full triad in ONE hands-free loop** — real-time two-way voice + grounding in the user's own Pulse corpus + native structured artifact capture. No incumbent closes all three; ChatGPT/Gemini/Copilot ground in text/chat while voice stays conversational, and notetakers capture from recorded meetings, not from talking *with* the AI. (Genuine.)
- **Closed loop to action** — artifacts land in `decisions`/`extracted_tasks`/`archives`, the same tables the rest of Pulse triages. Verified real writes (caps 23-25, 18). Incumbents hand off via connectors/Zapier. (Genuine.)
- **Ecosystem-neutral corpus** — Pulse already ingests Gmail + Outlook + Slack; Gemini/Copilot are vendor-locked. (Genuine at the platform level.)
- **Server-side AI routing + DB security baseline** (338 tables RLS-on, search_path-pinned definers) is a stronger privacy-by-architecture story than most competitors — *if* Pulse markets it.

**Claimed-but-not-yet-real moat (caution):**
- **"Voice grounded in YOUR work data in the live loop"** is the headline differentiator, but Summit imports nothing from messages/calendar/email; grounding depends entirely on the model invoking `search_messages`/`rag_search` at runtime, and the prompt chips don't pre-fetch (`Summit.tsx:1562-1575`). The moat is *architecturally reachable* but not *demonstrated* — this is the gap between the pitch and the wiring.

**Gaps:**
- **CRITICAL** — Free-tier expectation: Gemini Live and Pi are free, Perplexity dropped its paywall; Summit voice behind Team/Growth (Solo excluded) fights a market trained for $0-20 voice. This is a positioning decision, not a bug, but it caps adoption.
- **CRITICAL** — Hallucinated/mis-attributed artifacts: a hallucinated "decision" becomes a *tracked, actionable* item — worse than a hallucinated summary line. Summit must verify extraction quality (and reuse War Room RAG for citations) before marketing artifact capture.
- **IMPORTANT** — No audio playback/verification path ("AUDIO NOT STORED"): users can't verify an extracted decision against the recording; a dealbreaker for high-stakes calls.
- **IMPORTANT** — Speaker attribution: artifacts attributed to the wrong person (Otter's biggest failure) — confirm Summit has reliable per-speaker attribution before tasks land with an owner.
- **IMPORTANT** — No published accuracy benchmark or compliance claim (SOC 2 / GDPR / consent / deletion) — a hard gate post-Fireflies-BIPA and Read.ai bans, *before* marketing artifact extraction.
- **NICE-TO-HAVE** — Camera/video-in-voice, persistent cross-session memory, multi-format derivative artifacts.

## Phase 4: Launch Readiness Scorecard

| # | Dimension | Score | Evidence |
|---|-----------|:---:|----------|
| 1 | Core Functionality | 9/10 | Real Realtime GA loop, server-minted token, BYO, real artifact persistence; only mid-session steering is disconnected |
| 2 | Data Reliability | 8/10 | All tables exist with correct RLS; localStorage+Supabase dual-write; but 0 live rows untested + silent insert-failure downgrade |
| 3 | Error Resilience | 7/10 | Mostly A-grade failsafes; dragged down by one F (crash loses minutes + grants free) and several C's (no re-mint, no-confirm delete) |
| 4 | User Confidence | 6/10 | Precise push-fail toasts and entitlement messaging are strong; undercut by silent BYO failure, silent mid-session no-ops, no delete undo |
| 5 | Completeness | 7/10 | End-to-end capture→artifact→export is whole; gaps are grounding-in-loop, audio verification, mid-session steering |
| 6 | Performance | 8/10 | Inherits OpenAI Realtime latency; per-session caps bound cost; no proactive token re-mint for long sessions |
| 7 | Competitive Parity | 6/10 | Hits voice table-stakes via the engine; misses free-tier expectation and video-in-voice; wins on artifact loop |
| 8 | Platform Parity | 7/10 | Desktop + mobile (Capacitor); mobile artifact panel is a sheet (`:368-371`); desktop Cmd+K section-gate leak |
| 9 | Theme Parity | 8/10 | Scoped dark token block (`Summit.css:32-47`), modal-bg bug FIXED (`--pulse-surface-modal`); minor: hidden RealtimeVoiceAgent uses raw Tailwind (not user-visible) |
| 10 | Onboarding | 7/10 | "Welcome to Summit" intro modal + reason-specific upgrade CTAs; prompt chips over-promise; thin live-no-captures empty state |
| 11 | Polish | 6/10 | Stale GPT-4O labels (×2), no-confirm delete, false idempotency comment, cosmetic tool-arg mismatch |
| 12 | Stickiness | 6/10 | Strong: artifacts in system of record. Missing: cross-session memory, audio verification, live grounding demonstrated |

**Overall: 85/120 (71%)**

**Launch Decision: LAUNCH WITH CAVEATS** — Summit is a real, well-built surface that clears the 70% bar, but it ships behind a default-OFF experimental flag and carries one revenue-integrity leak (metering) that must be closed before broad hosted-tier exposure. Launch to BYO/trial users now; gate broad hosted rollout on Sprint 0.

## Phase 5: Roadmap to Launch-Ready

### Sprint 0 — Launch Blockers

| # | Item | Type | Effort | User Impact /5 | Trust Impact /5 |
|---|------|------|--------|:---:|:---:|
| S0-1 | Make hosted-minute metering crash-resilient (sendBeacon + server-authoritative session ledger) | Reliability/Billing | M | 3 | 5 |
| S0-2 | Remove the FALSE "idempotent" comment + add a dedup/ledger guard before any retry is introduced | Correctness | S | 1 | 4 |

### Sprint 1 — Core Reliability

| # | Item | Type | Effort | User Impact /5 | Trust Impact /5 |
|---|------|------|--------|:---:|:---:|
| S1-1 | Add confirm + undo (toast with Undo) to session delete | UX safety | S | 4 | 4 |
| S1-2 | Decide & enforce the Cmd+K section gate (filter palette OR guard router on `experimentalEnabled`) | Gating | S | 2 | 3 |
| S1-3 | Live smoke test: confirm a completed session lands a `summit_sessions` row; surface insert failures (toast, not console.warn) | Verification | S | 2 | 4 |
| S1-4 | Wire mid-session Settings/Context changes (expose `setParticipantMode`/`updateConfig`/`setContextDocuments` via useImperativeHandle + useEffect watchers) | Feature wiring | M | 3 | 3 |

### Sprint 2 — Completeness

| # | Item | Type | Effort | User Impact /5 | Trust Impact /5 |
|---|------|------|--------|:---:|:---:|
| S2-1 | Make prompt chips actually pre-fetch (call search_messages/rag_search before connect) or reword to honest "ask me to…" | Feature/Copy | M | 4 | 3 |
| S2-2 | Confirm runtime grounding tools query real messages/calendar/email; document coverage | Verification | M | 4 | 3 |
| S2-3 | Surface a "BYO key failed" toast instead of silent fall-through to hosted | UX feedback | S | 2 | 3 |
| S2-4 | Document/codify the summit-60 override so `rebuild_entitlements` doesn't clobber it (move to a plan row or add a durable override mechanism) | Data durability | M | 1 | 3 |

### Sprint 3 — Polish & Parity

| # | Item | Type | Effort | User Impact /5 | Trust Impact /5 |
|---|------|------|--------|:---:|:---:|
| S3-1 | Replace stale "GPT-4O"/"GPT-4O REALTIME" labels with the real `gpt-realtime` (or a friendly name), driven from one constant | Polish | S | 1 | 2 |
| S3-2 | Fix toolCallRouter arg-name mapping (`decision`/`context`/`dueDate` + fallbacks) so mirrored cards aren't generic | Polish | S | 2 | 2 |
| S3-3 | Proactive ephemeral-token re-mint for long sessions; wire server-returned `max_session_sec` as authoritative | Reliability | M | 2 | 2 |
| S3-4 | Retract already-pushed tool rows on ArtifactPanel edit/delete (or warn it's persisted) | Correctness | M | 2 | 3 |

### Sprint 4 — Differentiation

| # | Item | Type | Effort | User Impact /5 | Trust Impact /5 |
|---|------|------|--------|:---:|:---:|
| S4-1 | Cited artifacts: link each extracted decision/task to the spoken moment (reuse War Room RAG/citation engine) | Moat | L | 4 | 5 |
| S4-2 | Persistent cross-session memory (carry prior context/personality) | Moat | L | 4 | 3 |
| S4-3 | Published accuracy benchmark + compliance story (consent capture, deletion path, SOC2/GDPR claim) | Trust/GTM | L | 3 | 5 |
| S4-4 | Reconsider free/Solo voice allotment to meet the commoditized $0-20 voice expectation | Pricing | M | 5 | 2 |

---

### Implementation Handoff

**S0-1 — Crash-resilient hosted-minute metering**
- **Problem:** Hosted minutes are metered by a no-retry, fire-and-forget client call. A crash/OS-kill/network-drop at session end loses the minutes, and because the server gate (`openai-realtime-token/index.ts:135-167`) reads ONLY the `usage_records` row that this dropped call writes, the user can then start unlimited future sessions bounded only by per-session length — a real revenue/quota leak (F-grade failsafe).
- **Location:** `src/components/Summit/Summit.tsx:1007-1028` (fire-and-forget `void (async)()`, single `supabase.functions.invoke('summit-session-end', …)`, catch → `console.warn` `:1025`); server side `supabase/functions/summit-session-end/index.ts:85-94` (`increment_usage` via service-role).
- **Fix approach:** (1) Add a `navigator.sendBeacon`/`fetch(..., {keepalive:true})` fallback fired on `visibilitychange`/`pagehide` so a closing tab still posts duration. (2) Make the increment server-authoritative: have the edge fn (or a short-lived server "session open" record written at mint time in `openai-realtime-token`) reconcile elapsed time so a missing client end-event can be recovered, rather than trusting the client. (3) Keep the client call as the fast path but add a small bounded retry/queue (e.g., persist a pending end-event to localStorage and replay on next load). Do NOT add a naive retry without S0-2's dedup guard, or the additive SQL will double-count.
- **Verification:** Start a hosted session, kill the tab mid-teardown (DevTools → close), reload, confirm `usage_records.quantity` for `summit_minutes` reflects the elapsed minutes. Then confirm a second start is blocked once cap is reached. Add a dry-run check that `increment_usage` is not called twice for one session.
- **Dependencies:** Coordinated change to `summit-session-end` edge fn; respects existing membership check (`:69-78`); the `usage_records` UNIQUE(workspace_id,metric,period_start) and `increment_usage` signature (p_workspace_id uuid, p_metric text, p_quantity bigint, p_period_start date, p_period_end date) — verify via pg_proc before touching.
- **Effort:** M

**S0-2 — Remove false idempotency comment + dedup guard**
- **Problem:** `Summit.tsx:1022-1024` asserts the server increment is "idempotent on (workspace_id, metric, period_start)." The SQL is `quantity = usage_records.quantity + p_quantity` (`supabase/migrations/20260405000001_billing_system.sql:509`) — ADDITIVE, NOT idempotent. No live double-count today (no retry exists), but the comment is a trap: the moment S0-1 adds any retry, this double-bills.
- **Location:** Comment at `src/components/Summit/Summit.tsx:1022-1024`; SQL `increment_usage` `supabase/migrations/20260405000001_billing_system.sql:494-509`; caller `supabase/functions/summit-session-end/index.ts:85`.
- **Fix approach:** (1) Delete/correct the comment to state the truth (additive). (2) Before S0-1 introduces a retry, add a dedup key: either pass a unique `session_id` to `summit-session-end` and record applied session_ids (e.g., an `applied_sessions` set / a per-session row with ON CONFLICT DO NOTHING) so a replayed end-event is a no-op, OR convert metering to the server-authoritative ledger from S0-1 (preferred — makes dedup structural). Dry-run any SQL change in a rolled-back transaction (`DO $$ … RAISE EXCEPTION 'rollback' $$`) per Pulse migration discipline, then apply once.
- **Verification:** Call `summit-session-end` twice with the same session_id; assert `usage_records.quantity` increments exactly once. Confirm the comment now matches the SQL.
- **Dependencies:** Must land with or before S0-1's retry. Touches the billing migration surface — verify schema against ground truth, never guess column names.
- **Effort:** S

**S1-1 — Confirm + undo on session delete**
- **Problem:** `SessionsCanvas.tsx:296` calls `onSessionDelete?.(s.id)` on a single click with no confirm; `Summit.tsx:1577-1582` immediately runs `deleteVoiceSession` (localStorage) + `deleteVoiceSessionRemote` (hard DELETE from `summit_sessions`) + a success toast with no Undo. A misclick is unrecoverable.
- **Location:** `src/components/Summit/SessionsCanvas.tsx:293-301` (delete button); `src/components/Summit/Summit.tsx:1577-1582` (`handleSessionDelete`); `src/components/Summit/voiceSessionStore.ts:108-116,253-258` (delete impls).
- **Fix approach:** Add a confirmation step (inline "Delete?" two-step on the button, or a small modal) AND/OR convert the post-delete toast to an Undo toast that restores the in-memory + cached session and skips the remote DELETE until the undo window lapses (soft-delete pattern: keep the row, flip a `deleted_at`, hard-purge later — or hold the deleted payload in state and re-upsert on Undo). Prefer Undo over confirm for lower friction; confirm is the minimum.
- **Verification:** Delete a session, click Undo within the window, confirm it reappears in the grid and in `summit_sessions`. Without Undo, confirm it's gone after the window.
- **Dependencies:** None hard; if soft-delete chosen, `summit_sessions` would need a `deleted_at` column (verify/add via migration + dry-run).
- **Effort:** S

**S1-2 — Enforce the Cmd+K section gate**
- **Problem:** The desktop Command Palette routes `nav-summit → setView(AppView.LIVE)` with no `experimentalEnabled` filter (verified `App.tsx:288` filter is only current-view + SMS), and the router renders `<Summit>` unconditionally (verified `App.tsx:1426`). The "Experimental section disabled" contract leaks on desktop. NOT free voice (entitlement + server mint still block), but the contract is inconsistent with sidebar/mobile which DO enforce it.
- **Location:** `src/App.tsx:279` (`nav-summit` registration), `:288` (filter), `:296` (`run`), `:1426` (router case); compare `src/components/Sidebar.tsx:403-404` and `src/components/MobileNavSheet.tsx:54,74` which DO gate.
- **Fix approach:** Decide the contract with the user first (per Pulse Rule A this is a behavior change). Option A (minimal): add `&& (features.experimentalEnabled || n.view !== AppView.LIVE)` (and likewise for other experimental views) to the palette filter at `App.tsx:288`. Option B (defense-in-depth): also guard the router case so `AppView.LIVE` with `!experimentalEnabled` redirects to dashboard. Recommend A; B only if the section gate is meant to be authoritative.
- **Verification:** With Experimental OFF, confirm `nav-summit` no longer appears in Cmd+K and (if Option B) the router redirects. With Experimental ON, confirm normal access.
- **Dependencies:** `FeatureContext` already in scope in App.tsx. Confirm no other experimental views (Map, War Room) should get the same treatment in one pass.
- **Effort:** S

**S1-3 — Live smoke test of session persistence + surface insert failures**
- **Problem:** `summit_sessions` has 0 live rows despite the feature shipping; a failing insert is downgraded to `console.warn` (`voiceSessionStore.ts:246`), so a silent RLS rejection would be invisible to both the user and the audit. Persistence is plausibly correct but unverified end-to-end.
- **Location:** `src/components/Summit/voiceSessionStore.ts:226` (upsert), `:245-247` (console.warn on error); save call `Summit.tsx:1003`; load `Summit.tsx:521`.
- **Fix approach:** (1) Run a real completed session (BYO is fine) and confirm a row lands via Supabase. (2) If RLS rejects, fix the policy/scoping; if it succeeds, add a lightweight surfacing of write failure (a non-blocking toast "Couldn't save session history" on error, while keeping the localStorage fallback) so future silent failures aren't invisible. Keep the graceful-degrade behavior; only add visibility.
- **Verification:** Complete a session → `select count(*) from summit_sessions where user_id = <uid>` returns ≥1; force an RLS failure (e.g., wrong workspace) and confirm the toast fires.
- **Dependencies:** Live auth/session; Supabase access to project `ucaeuszgoihoyrvhewxk`.
- **Effort:** S

**S1-4 — Wire mid-session Settings/Context changes**
- **Problem:** Toggling AI mode / voice / context files mid-session is a no-op until the next Connect. The `RealtimeVoiceAgent` class fully supports live updates (`realtimeAgentService.ts:416-423 setParticipantMode`, `:1419-1424 updateConfig` — both call `sendSessionUpdate` if connected), but the React wrapper's `useImperativeHandle` (`RealtimeVoiceAgent.tsx:352-373`) exposes ONLY connect/disconnect/mute/pause, and no useEffect watches `aiMode`/`voiceSettings`/`contextFiles`. The only call sites are inside `connect()` (`:231,235`).
- **Location:** `src/components/WarRoom/RealtimeVoiceAgent.tsx:231,235` (connect-only calls), `:352-373` (useImperativeHandle to extend); consumer `src/components/Summit/Summit.tsx` agentRef.
- **Fix approach:** Add `setParticipantMode`/`updateConfig`/`setContextDocuments` to the useImperativeHandle surface, then in Summit add useEffects that, when the relevant prop changes AND the session is connected, call the corresponding agentRef method. Alternatively add useEffect watchers inside RealtimeVoiceAgent that call the existing class methods directly when props change. Per Rule A, this is additive (no removal) — safe. Verify the class methods' connected-guard so a not-yet-connected change is still applied at connect.
- **Verification:** Connect, change voice/mode/context mid-session, confirm the model's behavior changes without a reconnect (check `sendSessionUpdate` fires; transcript reflects new mode/voice).
- **Dependencies:** None destructive; reuses existing class methods. Don't fork the canonical RealtimeVoiceAgent — extend it.
- **Effort:** M

---

**Top 3 most critical actions:**
1. **S0-1** — Close the hosted-minute metering leak (sendBeacon + server-authoritative ledger) before broad hosted rollout — the one F-grade failsafe and a real revenue leak.
2. **S0-2** — Correct the false "idempotent" comment and add a dedup guard so the additive billing SQL can't double-bill once a retry is added.
3. **S1-1** — Add confirm/undo to permanent single-click session delete — cheap, high trust impact, prevents irreversible data loss.