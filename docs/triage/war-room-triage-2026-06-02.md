# War Room Triage Report — 2026-06-02

> Forensic damage assessment. This is a damage report, not an improvement plan and
> not a list of fixes. It documents what is standing, cracked, severed, stubbed, or
> dead in the War Room section as of 2026-06-02. Every classification below was
> traced to real code and (for the critical findings) re-verified by hand against
> the actual files, schema, and edge functions. No implementation was performed.

---

## Executive Summary

**Overall Health: FRAGILE** (sound skeleton, several silent functional cracks on the live path)

- Total files in scope: **~80** (War Room subsystem proper) + **9** Summit (sibling surface reusing the engine)
- Approx. classification of code files (`.ts`/`.tsx`, excluding barrels/CSS):
  - **Solid:** ~48 files (the engine, the new 3-pane UI, all generators, organization, the store, hooks, parsers)
  - **Cracked:** ~10 (voice token caller, project-scoped RAG search, prompt suggestions, AI-summary export, export timestamps, audit wiring, voice tool stubs, 2 notebook citation panels, 1 voice component)
  - **Severed:** 5 components (4 Annotations + ShareModal) + several service methods
  - **Dormant:** ~8 (the entire legacy `StudioLayout` rollback branch — intentional, deleted in Phase 11)
  - **Orphan:** 2 full files (`agentHandoffService`, `voiceGuardrailsService`) + 2 partial exports (`AgentSelector` component, `buildModeActions`)
  - **Stub:** 0 full files; 3 method-level stubs inside `warRoomToolsService`
  - **Gutted:** **0** — no accidental gutting found; every large deletion was a deliberate, git-documented architecture move

**Plain-English summary.** War Room is **structurally healthy but functionally cracked in several places that fail silently.** The big surprise that reframes everything: the "Notebook" redesign (the `notebook/` subfolder) was **defaulted ON at 100% on 2026-06-01 (Phase 10)** — it is no longer flag-OFF, it is the **live primary surface today**. The legacy `StudioLayout`/`PulseStudio`/`IntelDesk` path is now the rollback branch (`?ff_warRoomNotebook=off`), kept for one release and slated for deletion in Phase 11. So everything in this report split into "live Notebook path" vs "dormant legacy path." The underlying RAG + realtime-voice engine is **real and production-grade** (not mocked), and the new 3-pane UI is **complete and wired to it** — there are no hollow shells. But four to five features fail quietly on the live path:

1. **Hosted voice never connects in War Room** (works fine in Summit) — the token caller was orphaned by a 2026-05-10 edge-function hardening. **CRITICAL, verified.**
2. **Project-scoped RAG search always returns empty** — the result filter keys off a column the RPC doesn't return. **HIGH, verified.**
3. **Prompt suggestions never generate** — an argument-order mismatch passes an empty prompt. **MEDIUM, verified.**
4. **AI-summary export is broken** — same argument-order mismatch. **MEDIUM, verified.**
5. **The "Sources Used" citation panel renders hollow** (titles only, no excerpts/highlights) — the send path discards retrieval metadata.

Fix first: #1 (voice) and #2 (project RAG). Both are small, surgical, and high-impact. Everything classified Dormant is intentional and should not be touched per CLAUDE.md Rule A.

---

## 0. Critical Framing — What Changed Under the Brief

Two facts override the command brief's assumptions and my own session memory. Both were verified by hand:

1. **`warRoomNotebook` is `enabled: true, rolloutPercentage: 100, targetUsers: ['all']`** — [`src/lib/featureFlags.ts:236-242`](../../src/lib/featureFlags.ts#L236-L242), commented *"Phase 10 (2026-06-01): defaulted ON. The Notebook (Path A) is now the primary War Room surface."* The memory note calling these "unfinished shells" is **stale** — they shipped.

2. **FontAwesome 6.4.0 is loaded** at [`index.html:39`](../../index.html#L39). FA6's `all.min.css` ships the v4 `fa`-prefix shim, so any residual `<i className="fa fa-…">` icons render correctly. (One sub-agent assumed these render as empty boxes after the lucide migration — verified false. Not a defect; at most a two-icon-system inconsistency.)

**Routing:** `App.tsx:18` lazy-imports `LiveDashboard`; rendered at `App.tsx:951` as `<LiveDashboard userId=… />` for the War Room view (`AppView.LIVE_AI`). The separate `<Summit>` surface is rendered at `App.tsx:866` (`AppView.LIVE`). Preloaded via `useRoutePreload.ts:22-23`.

---

## 1. Intended Purpose

War Room is Pulse's **NotebookLM-class research workspace**: the user creates a *project*, uploads or pastes *sources* (documents), and has *grounded* AI conversations where answers are retrieved from those sources via RAG (vector search) and cited. On top of grounded chat it offers:

- **Content generators** — turn the sources into a Study Guide, FAQ, Timeline, or two-host Podcast (with TTS playback).
- **Advanced AI** — Comparative Analysis across documents and an interactive Knowledge Graph of extracted entities.
- **The Board** — pin typed artifacts (Finding/Insight/Action/Question/Decision) from the conversation.
- **Realtime voice agent** — a live, speech-to-speech WebRTC conversation with the research assistant, grounded in the same sources and able to call tools.
- **Document organization** — favorites, tags, collections, recent views; in-document search, highlighting, and annotations.
- **Reasoning transparency** — a collapsible "thought for N steps" trace under AI answers, and a "Sources Used" citation panel.

The current live UI is the **Notebook** 3-pane layout: **Sources** (left) · **Chat** (center) · **Studio** (right, the generator rail + The Board). The same engine also powers **Summit**, a separate full-screen voice-first surface.

---

## 2. What's Solid (Your Foundations — Don't Touch, Build On)

### The engine (the most valuable, verified-real assets)
- **`ragService.ts`** [`src/services/ragService.ts`] — real RAG core: ingest → chunk (1000/100 overlap) → embed (via `gemini-embed` edge fn) → store in `doc_embeddings`; vector search via the `match_documents` RPC; full CRUD for projects/sessions/messages/thinking-logs. *Core is solid; three specific methods are cracked — see §3.*
- **`realtimeAgentService.ts`** [`src/services/realtimeAgentService.ts`] **[SOLID]** — genuine WebRTC speech-to-speech against OpenAI `/v1/realtime`, ephemeral tokens minted server-side, tool calling, guardrails, context summarization, token metering. Not a mock. 1,490 lines, heavily consumed.
- **`openai-realtime-token` edge function** **[SOLID]** — real JWT validation, workspace-membership check, tier-gating against `entitlements`, monthly-cap enforcement, mints against OpenAI `/v1/realtime/sessions`.
- **`warRoomStore.ts`** [`src/store/warRoomStore.ts`] **[SOLID]** — Zustand store, 7 slices, ~416 lines, consumed by 13+ components on both UI paths. The 2026-06-01 commit pruned dead flags (git-proven, not damage).
- All **edge functions** War Room invokes exist and resolve: `ai-router`, `gemini-embed`, `gemini-proxy`, `openai-realtime-token`, `gemini-live-token`. All Gemini calls are server-side per project convention.
- All **Supabase tables** exist with migrations: `knowledge_docs`, `doc_embeddings`, `project_docs`, `ai_projects`, `ai_sessions`, `ai_messages`, `ai_thinking_logs`, `ai_prompt_suggestions`, plus the organization/annotation tables (`doc_highlights`, `doc_annotations`, `annotation_replies`, `doc_tags`, `document_tags`, `document_collections`, `collection_docs`, `doc_favorites`, `doc_recent_views`, `document_shares`, `project_shares`, `share_invites`). No table is missing a migration.

### The live Notebook UI (shipped 2026-06-01, all wired to the engine)
- **`LiveDashboard.tsx`** **[SOLID]** (container, 1,744 lines) — owns all data loading, the RAG send pipeline (`sendMessageDirect`, 508-768, with real search + generation + persistence + error handling), realtime presence, and flag-selected shell mounting. *Two handlers inside are cracked — see §3.*
- **`notebook/NotebookShell.tsx`**, **`SourcesPane.tsx`**, **`ChatPane.tsx`**, **`StudioPane.tsx`**, **`Composer.tsx`**, **`GeneratorRail.tsx`**, **`MessageList.tsx`**, **`ReasoningTrace.tsx`**, **`DockedVoice.tsx`**, **`EmptyState.tsx`**, **`ProjectSwitcher.tsx`**, **`notebook.css`** — all **[SOLID]**, all reading the real store + `ragService`. No mocks, no TODOs, no no-op handlers. The redesign is complete and live.
- **`WarRoomModalStack.tsx`** **[SOLID]** — the single mount point for all overlays (generators, AdvancedAI, organization, DocumentViewer, search, voice panel). Rendered on both paths. Correctly suppresses the floating voice panel when voice is docked inline (`dockVoiceInline`), preventing double-WebRTC.
- **`TheBoard.tsx`** **[SOLID]** — pin/filter/export typed artifacts; live via `StudioPane`.
- **`ActionPalette.tsx`** **[SOLID]** — ⌘K palette, live via `NotebookShell`. (One dead export — see §7.)

### Content generators & advanced AI (all SOLID, all real `ai-router` calls)
- **`FAQGenerator`**, **`PodcastGenerator`** (Web Speech + ElevenLabs playback), **`StudyGuideGenerator`**, **`TimelineGenerator`** — all real `processWithModel` calls, JSON parsing, export, error handling. Triggered live from `GeneratorRail`.
- **`AdvancedAIPanel`** + **`ComparativeAnalysis`** + **`KnowledgeGraphViewer`** (force-directed canvas) — all real `advancedAIService` → `ai-router`.

### Document organization (SOLID, real tables, wired end-to-end)
- **`OrganizationSidebar`** + **`CollectionManager`** + **`FavoritesPanel`** + **`RecentViews`** + **`TagManager`** — reachable live via Knowledge Bank → "Organize" (passes a real `userId`); all back to real tables.
- **`DocumentViewer`** (core reader + search) **[SOLID]**; **`DocumentSearch`** (Fuse.js) **[SOLID]**.

### Renderers, hooks, parsers (SOLID, used on both paths)
- **`MarkdownContent`**, **`ProvenanceTag`** (the coral AI-attribution chip), **`ArtifactRenderers`** (typed inline cards), **`artifactParser`**, **`useBoardNotes`**, **`useStudioCommands`**, **`useSwipeGesture`** — all solid and consumed by the live `MessageList`/`Composer`.
- **`PresenceAvatars`** **[SOLID]** — reads `warRoomStore.presence`, populated by the real Supabase-realtime `joinSession` path.

### Summit (sibling surface — the gold-path voice host)
- **`Summit.tsx`** + `voiceSessionStore` + `toolCallRouter` + `artifactExtractor` + `ArtifactPanel` + `SessionsCanvas` + `EndSessionSheet` + `TranscriptBreathing` + `summitExportService` — **all [SOLID].** Summit resolves the voice token **correctly** (passes both `openaiApiKey` and `workspaceId`), so its realtime voice works. Its end-of-session export writes **real** `decisions`/`tasks`/`archives` rows. This is the reference implementation War Room's voice path should mirror.

---

## 3. What's Cracked (Fixable With Targeted Repairs)

Sorted trivial → complex. **All five top items are silent failures — they don't throw, they just quietly don't work.**

### 3.1 — AI-summary export sends an empty prompt — TRIVIAL
- **Where:** [`LiveDashboard.tsx:1251-1264`](../../src/components/LiveDashboard.tsx#L1251-L1264), `generateSummary`.
- **What's broken:** Calls `processWithModel(apiKey, "Create a concise summary…")` with **two args**. The real signature is `processWithModel(prompt, model?)` — [`geminiService.ts:1220-1225`](../../src/services/geminiService.ts#L1220-L1225) — where `model` is **ignored** (`void model`) and `if (!prompt) return null`. Since `apiKey` is the deprecated no-op prop (always `''`), the prompt is empty → returns null/garbage. The real instruction lands in the ignored `model` slot.
- **Reached via:** `handleExport('summary')` → the Export modal's "Generate AI Summary" button.
- **Fix complexity:** TRIVIAL (drop the `apiKey` arg).
- **Cascade:** export-summary feature only.

### 3.2 — Prompt suggestions never generate — TRIVIAL
- **Where:** [`ragService.ts:335`](../../src/services/ragService.ts#L335), `generateSuggestions`; called from `LiveDashboard.tsx:782`.
- **What's broken:** Identical arg-order bug — `processWithModel(apiKey, withFormattedOutput(...))`. `apiKey` is `''` → empty prompt → returns null → `getSuggestions` shows nothing. **Verified** against the `processWithModel` signature.
- **Fix complexity:** TRIVIAL (drop the leading `apiKey` arg).
- **Cascade:** the suggestion chips in the composer/empty-state are always empty.

### 3.3 — Project-scoped RAG search always returns empty — MODERATE (HIGH impact)
- **Where:** [`ragService.ts:228-245`](../../src/services/ragService.ts#L228-L245), `searchSimilar` project filter.
- **What's broken:** When a `projectId` is passed, the code filters `data.filter(d => projectDocIds.has(d.doc_id))`. But the `match_documents` RPC **returns `(id, content, similarity, doc_title, doc_url)`** — **no `doc_id`** — verified at [`migrations/20260119062007_remote_schema.sql:3328`](../../supabase/migrations/20260119062007_remote_schema.sql#L3328) (only definition; no later migration redefines it). So `d.doc_id` is `undefined`, `has(undefined)` is always false, and **every project-scoped knowledge search returns `[]`.** Unscoped (all-project) search at line 247 works. Same root cause makes `warRoomToolsService.ts:111-114` read `result.doc_id`/`result.chunk_index` as undefined, so voice-tool citations carry no source IDs.
- **Fix complexity:** MODERATE (either add `doc_id` to the RPC's RETURNS TABLE + its SELECT, or join chunk→doc on the client via `id`). Schema-touching → dry-run per CLAUDE.md §4.
- **Cascade:** grounded chat silently degrades to "no relevant sources" whenever a project is selected — the core value prop, half-broken.

### 3.4 — Hosted realtime voice never connects in War Room — MODERATE (CRITICAL impact)
- **Where:** [`LiveDashboard.tsx:149-151`](../../src/components/LiveDashboard.tsx#L149-L151) (token fetch), compounded at `WarRoomModalStack.tsx:333` and `VoiceAgentPanel.tsx:345` (no `workspaceId` forwarded).
- **What's broken:** LiveDashboard fetches the ephemeral token with `body: { model, voice }` — **no `workspace_id`, no `byo_key`.** The edge function rejects this at [`openai-realtime-token/index.ts:73-74`](../../supabase/functions/openai-realtime-token/index.ts#L73-L74): `if (!byoKey && !workspace_id) return json({ error: 'workspace_id required', code: 'NOT_MEMBER' }, 400)`. Result: `data.token` is empty → toast *"OpenAI Realtime unavailable"* → **voice never connects in War Room.** This is a regression introduced 2026-05-10 (`2f4991b`) when the edge function was hardened for Summit but LiveDashboard's caller was left un-migrated. **Verified end-to-end** (caller, edge function, and Summit's correct counterpart).
- **Fix complexity:** MODERATE (pass `currentWorkspace.id` as `workspace_id` in the invoke; thread `workspaceId` through `WarRoomModalStack` → `DockedVoice`/`VoiceAgentPanel` → `RealtimeVoiceAgent`, mirroring Summit which already does this correctly).
- **Cascade:** the entire War Room realtime voice agent. (Summit's voice is unaffected.)

### 3.5 — "Sources Used" citation panel renders hollow — MODERATE
- **Where:** [`notebook/SourcesUsedPanel.tsx`](../../src/components/WarRoom/notebook/SourcesUsedPanel.tsx) + [`notebook/CitationChip.tsx`](../../src/components/WarRoom/notebook/CitationChip.tsx); root cause at [`LiveDashboard.tsx:728`](../../src/components/LiveDashboard.tsx#L728).
- **What's broken:** The send path builds citations as `citations.map(c => ({ title: c }))` — only `title` is populated. The panel reads `{title, source?, excerpt?, similarity?}`, so the excerpt block and `· source` hint render empty for every real message, and the "open doc with passage highlight" click fires with `excerpt = undefined` (no highlight). The retrieval data exists (`d.content`, `d.similarity` at LiveDashboard:592-593) but is discarded into a `string[]` of titles. Also, `CitationChip` is only used in the footnote panel — **never woven inline into the answer body**, so the "inline citations" P0 from the handoff is half-shipped.
- **Fix complexity:** MODERATE (carry excerpt/source/similarity through the send path).
- **Cascade:** cosmetic-to-functional; citations look impoverished vs. the locked mockup; no crash.

### 3.6 — Export omits per-message timestamps — MODERATE
- **Where:** [`warRoomExportService.ts`](../../src/services/warRoomExportService.ts) lines 137-138, 259-260, 302.
- **What's broken:** Formatters read `msg.timestamp`, but `AIMessage` defines **`created_at`** (`ragService.ts:33-39`), not `timestamp`. The `includeTimestamps` option is structurally dead; JSON `timestamp` is always `undefined`. (`pdf` is declared in the mime maps but has no formatter — falls through to markdown.)
- **Fix complexity:** MODERATE (rename field reads to `created_at`).

### 3.7 — Audit trail ~73% unwired — MODERATE
- **Where:** [`warRoomAuditService.ts`](../../src/services/warRoomAuditService.ts).
- **What's broken:** Only 3 of 11 methods have callers (`exported`, `shared`, `decisionRecorded`). `sessionCreated`, `sessionDeleted`, `messageSent`, `docUploaded`, `docDeleted`, `voiceSessionStarted`, `voiceSessionEnded`, `missionLaunched` are never called — sessions/messages/docs/voice generate no audit trail despite the service existing for it.
- **Fix complexity:** MODERATE per call-site (add the calls where events fire).

### 3.8 — Voice tools report success while writing nothing — MODERATE
- **Where:** [`warRoomToolsService.ts`](../../src/services/warRoomToolsService.ts) — `createTaskTool` (257-312), `createDecisionTool` (318-367), `setReminderTool` (531-546).
- **What's broken:** `create_task`/`create_decision` write a formatted `[TASK CREATED]`/`[DECISION RECORDED]` **chat message string** (self-documented "In production, integrate with your task service"), not a real `tasks`/`decisions` row — yet they return `✅ … created successfully!`. `set_reminder` is a pure stub. *(Note: Summit's own end-of-session push writes real rows via `summitExportService`; only the in-session voice tools are stubbed.)*
- **Fix complexity:** MODERATE (route to `taskService`/`decisionService`).

### 3.9 — Smaller cracks
- **`VoiceControl.tsx`** **[CRACKED]** — its command handlers (132-138) dispatch `switch_mode:neural-terminal` etc., **PulseStudio modes that no longer exist** (deleted in the studio rebuild). Voice commands fire onto a dead switch. (Used only by legacy `PulseStudio`.)
- **`VoiceAgentPanel.tsx`** — duplicate `<option>` keys in the voice selector (`shimmer`/`sage`/`coral`/`verse` appear twice, 295-309). Harmless React key collision.
- **`WarRoomSidebar.tsx`** icon/color picker (162-170) — collects `selectedIcon`/`selectedColor` but `onCreateProject` is name-only; the LiveDashboard handler hardcodes `'#f43f5e'`. (Legacy path only.)
- **`GeneratorRail.tsx:44`** — the "Knowledge Graph" tile opens `AdvancedAIPanel` on the default `compare` tab (doesn't pass `initialView`). Minor UX.
- **`PodcastGenerator`** — `WarRoomModalStack:392` doesn't pass the optional `elevenLabsApiKey`, so ElevenLabs starts blank (Web Speech works with zero config).

---

## 4. What's Severed (Disconnected Wiring)

These are **complete, real, table-backed components/methods that nothing triggers.** Wiring gaps, not damage.

### 4.1 — The entire Annotations subsystem (4 components) — SEVERED by one missing prop
- **Components:** `AnnotationPopup`, `AnnotationsSidebar`, `AnnotationReplyThread`, `HighlightPopup` — all imported and rendered inside `DocumentViewer`, all backed by real tables (`doc_highlights`, `doc_annotations`, `annotation_replies`).
- **The break:** Every annotation path in `DocumentViewer` is gated on `userId` (lines 60, 81, 108, 131, 635), but the live container renders `<DocumentViewer>` **without `userId`** ([`WarRoomModalStack.tsx:351-360`](../../src/components/WarRoom/WarRoomModalStack.tsx#L351) passes only `doc/onClose/highlightText/scrollToOffset`). The annotation toolbar button exists but opens an empty sidebar; text-selection highlight never fires.
- **To reconnect:** thread `userId` (already in scope in `WarRoomModalStack` props) into the `DocumentViewer` render. **One prop reactivates the whole subsystem.**
- **Worth it?** Yes — it's fully built and table-backed.

### 4.2 — ShareModal — SEVERED (no trigger anywhere)
- **Where:** `Collaboration/ShareModal.tsx`, rendered at `WarRoomModalStack.tsx:663` gated on `showShareModal && sharingDoc`.
- **The break:** Exhaustive grep finds **no caller of `setSharingDoc(...)` or `setShowShareModal(true)`** anywhere in `src/`. The store setters (`warRoomStore.ts:354-355`) are dead-ended. No "Share" button reaches it. (Sharing elsewhere uses a separate `contacts/WorkspaceShareModal`.)
- **To reconnect:** add a Share action on a doc/project that calls `setSharingDoc`. **Worth it?** Maybe — verify it isn't superseded by `WorkspaceShareModal` first.

### 4.3 — Severed service methods (real code, zero callers)
- **`ragService.getThinkingLog`** (323) — logs are written (`saveThinkingLog`) but **never read back** from the DB.
- **`warRoomRealtimeService`** — `joinSession`/`leaveSession`/`broadcastArtifact('pin')` **are wired** (LiveDashboard 311/344/1651) and presence is live, **but** `broadcastCursor`, `onCursorEvent`, and the `edit`/`delete`/`vote` artifact-broadcast branches have no emitters. Collaboration is half-built: pin + presence live; cursors/edit/delete/vote severed. *(Reconciliation note: one sub-agent flagged this whole service as having "zero importers" — that was incorrect; three other agents and the container confirm `joinSession` is called. Corrected here to CRACKED-partial.)*
- **`warRoomToolsService.registerRAGTools`** (585) — exported, no callers (`registerWarRoomTools` is the one used).

---

## 5. What's Stubbed (Never Finished)

No fully-stubbed files. Stubs are **method-level**, all inside the realtime voice tools (already detailed in §3.8):

| Stub | Location | Pretends to | Work remaining | Priority |
|------|----------|-------------|----------------|----------|
| `createTaskTool` | `warRoomToolsService.ts:257` | create a task | route to `taskService` | Medium (voice users only) |
| `createDecisionTool` | `warRoomToolsService.ts:318` | record a decision | route to `decisionService` | Medium |
| `setReminderTool` | `warRoomToolsService.ts:531` | set a reminder | wire a notification service | Low |
| `reportGroundingTool` analytics | `warRoomToolsService.ts:192` | persist citations for analytics | the "store in Supabase" path is `console.log` | Low |

---

## 6. What's Gutted (Was Better Before)

**Nothing.** This is the cleanest finding in the report. Git forensics confirm **every large deletion was a deliberate, documented architecture move**, not accidental gutting:

- **`5534717` (2026-04-04)** *"feat(studio): replace WarRoom with PulseStudio"* — deleted ~8,800 lines of the OLD War Room (`WarRoomHub`, `WarRoomLayout`, `WarRoomRedesigned`, `ModeToolbar`, `MissionLauncher`, `FloatingModeDock`, `WarRoomHeader`, `InputArea`) and added the PulseStudio architecture. Intentional rebuild.
- **`4a2b104` (2026-05-31)** *"remove orphaned effects, stubs, and duplicate voice variants"* — removed ~4,200 lines of confirmed-orphan modules (AudioVisualizer, ThinkingPanel, TokenStream, duplicate VoiceAgent variants, GlitchEffect/MatrixRain/ParticleField, PomodoroTimer/TopicLock). Matches the "15 dead files trimmed" memory note.
- **`d82889d` (2026-06-01)** *"relocate mode types, drop dead flags"* — careful prune of dead store flags (`showMindMap`, `showChartGenerator`, `showWarRoomHub`, `showMissionLauncher`, `glitchTrigger`) and relocation of mode types. Git-proven careful, not a gut.
- **`cd28645` (2026-06-01)** *"cut orphaned ActivityFeed + SharedWithMe (D1)"* — the planned D1 decision from the redesign handoff.

The current orphans/severed items are **residue of the mode-switcher removal and the Notebook cutover**, not freshly broken code.

---

## 7. What's Orphaned (Dead Code)

| Item | Location | Truly orphaned? | Recommendation |
|------|----------|-----------------|----------------|
| **`agentHandoffService.ts`** (489 lines) | `src/services/` | Yes — zero importers; untouched since initial commit. Superseded by the engine's own `transfer_to_*` handoffs. Its 5 "specialist" personas have no backing agent definitions. | INVESTIGATE then likely DELETE |
| **`voiceGuardrailsService.ts`** (305 lines) | `src/services/` | Yes — zero importers. `RealtimeVoiceAgent` inlines its own single guardrail instead of importing this catalog. | INVESTIGATE then likely DELETE |
| **`AgentSelector` component** (the React component, 13-97) | `WarRoom/AgentSelector.tsx` | Yes for the component — zero `<AgentSelector>` JSX usages. **BUT** the `AgentType` type and `AGENTS` array exports are load-bearing (7 importers). | Keep the file; the component body is dead. Do NOT delete the file. |
| **`buildModeActions`** (370-385) | `WarRoom/ActionPalette.tsx` | Yes — zero callers; dead since the mode-switcher UI was removed. | DELETE the helper (not the component) |

> Per CLAUDE.md Rule A, none of these should be removed without an explicit, approved pros/cons. They are documented here as candidates, not as deletions.

### Dormant (intentional — NOT dead, NOT for removal)
The **legacy rollback branch** is complete, working code held behind `?ff_warRoomNotebook=off`, scheduled for Phase 11 deletion per the handoff doc:
`PulseStudio.tsx`, `StudioLayout.tsx`, `StudioHeader.tsx`, `StudioOnboarding.tsx`, `WarRoomSidebar.tsx`, `IntelDesk.tsx`, `VoiceOverlay.tsx`, `FocusTimer.tsx` (legacy-path-only trigger). Within these, two sub-features are severed regardless of flag: `StudioLayout`'s `VoiceOverlay` (`voiceOpen` never set true) and `IntelDesk`'s Intel banner (`currentMode` never passed — the mode slice is vestigial since the ModeSwitcher was deleted).

### Misfiled (live, but not a War Room feature)
- **`DesignPreview.tsx`** — lives under `WarRoom/` but is consumed by `settings/DeveloperSettings.tsx` (a style-gallery demo).
- **`DecisionMission` / `MissionShell` / `useMissionPhases` / `SessionExport`** — live under `WarRoom/missions/` but consumed by the **Decisions** section (`decisions/cockpit/create/CreateOverlay.tsx`). Relevant if anyone "cleans up" the WarRoom folder assuming everything under it serves LiveDashboard.

---

## 8. Connection Map

### 8a. Route → Render chain
```
App.tsx:951  <LiveDashboard userId/>            (lazy; AppView.LIVE_AI; preloaded useRoutePreload:22)
  └─ ErrorBoundary("War Room")
     └─ LiveDashboard  [SOLID container]
        ├─ useWarRoomStore (Zustand, 7 slices)            → reads/writes all UI state
        ├─ ragService                                     → ai_projects, ai_sessions, ai_messages,
        │                                                    knowledge_docs, doc_embeddings, project_docs,
        │                                                    ai_thinking_logs, ai_prompt_suggestions, match_documents(RPC)
        ├─ warRoomRealtimeService.joinSession             → Supabase presence + ai_messages changes  [pin/presence SOLID; cursor/edit/delete/vote SEVERED]
        ├─ warRoomExportService                           → archives (via archiveService)  [timestamp field CRACKED]
        ├─ useBoardNotes                                  → localStorage (typed artifacts)
        │
        ├─ FLAG warRoomNotebook = ON (default, Phase 10)   ★ LIVE PATH
        │   StudioShell  = NotebookShell  [SOLID]
        │   ChatComponent= ChatPane       [SOLID]
        │     ├─ SourcesPane [SOLID] → ProjectSwitcher [SOLID], KnowledgeDoc rows, active-context
        │     ├─ MessageList [SOLID] → MarkdownContent, ProvenanceTag, ArtifactRenderers,
        │     │                         ReasoningTrace [SOLID], SourcesUsedPanel [CRACKED-hollow], CitationChip [CRACKED-footnote-only]
        │     ├─ Composer [SOLID] + EmptyState [SOLID]
        │     ├─ DockedVoice [SOLID UI] → VoiceAgentPanel → RealtimeVoiceAgent
        │     │      └─ token fetch ✗ CRACKED (no workspace_id → 400 → voice never connects)
        │     └─ StudioPane [SOLID] → GeneratorRail [SOLID] + TheBoard [SOLID]
        │
        ├─ FLAG OFF (?ff_warRoomNotebook=off)              ☾ DORMANT rollback (Phase 11 deletes)
        │   StudioLayout → IntelDesk(Sources) + TheBoard + ActionPalette + VoiceOverlay(severed)
        │   StudioHeader, WarRoomSidebar, StudioOnboarding, PulseStudio(chat) + FocusTimer
        │
        └─ WarRoomModalStack [SOLID] (BOTH paths)
            ├─ Export modal → generateSummary ✗ CRACKED (empty prompt)
            ├─ Generators: FAQ/Podcast/StudyGuide/Timeline [SOLID] → ai-router
            ├─ AdvancedAIPanel [SOLID] → Comparative + KnowledgeGraph → ai-router
            ├─ Knowledge Bank → DocumentSearch [SOLID] + DocumentViewer [SOLID]
            │      └─ Annotations (4 components) ✗ SEVERED (userId never passed)
            │      └─ Organize → OrganizationSidebar [SOLID] (userId IS passed here)
            ├─ floating VoiceAgentPanel (suppressed when docked) → same voice CRACK
            └─ ShareModal ✗ SEVERED (no trigger)
```

### 8b. Data Flow Map (flagged links)
```
match_documents(RPC)  →  ragService.searchSimilar  →  (no store slice)  →  grounded chat
     returns (id, content, similarity, doc_title, doc_url) — NO doc_id
     ✗ project filter on d.doc_id → always [] when a project is selected   [CRACKED §3.3]

ai_prompt_suggestions →  ragService.generateSuggestions → suggestions slice → Composer/EmptyState chips
     ✗ empty-prompt arg-order bug → always null → chips never appear        [CRACKED §3.2]

ai_thinking_logs      →  saveThinkingLog (write)  →  thinkingLogs slice → ReasoningTrace [SOLID]
                          getThinkingLog (read)   →  ✗ NO CALLERS (write-only)            [SEVERED]

doc_highlights/doc_annotations/annotation_replies → annotationService → DocumentViewer
     ✗ userId never passed → all annotation paths gated off                 [SEVERED §4.1]
```

### 8c. Cross-section dependencies
```
WAR ROOM DEPENDS ON:
  - AuthContext / workspace context (userId, currentWorkspace) — INTACT (but workspace.id not forwarded to voice token → §3.4)
  - ragService, geminiService(ai-router), elevenLabsService, archiveService, activityService, settingsService — INTACT
  - Supabase realtime + storage — INTACT

OTHER SECTIONS DEPEND ON WAR ROOM:
  - Decisions → imports DecisionMission (WarRoom/missions) in CreateOverlay.tsx:15 — INTACT, live
  - Summit → imports RealtimeVoiceAgent (WarRoom/) — INTACT (and wires the token correctly)
  - Contacts → ProvenanceChip imports WarRoom/PulseStudio.css for 2 classes — INTACT but CSS-coupling smell
  - Developer Settings → imports DesignPreview (WarRoom/) — INTACT
  - Dashboard → SummitLastCaptureStrip reads Summit/voiceSessionStore — INTACT
```

---

## 9. UI Surface Audit

### 9a. Page-level (live Notebook path)
| Check | Status | Notes |
|-------|--------|-------|
| Route exists & resolves | ✅ | `App.tsx:951`, lazy + preloaded |
| Renders without crash | ✅ | TDZ crash was fixed `545bfde`; "actually usable" fix `ea07afb` |
| No blank sections | ✅ | 3-pane always mounts (handler-prop guards always satisfied) |
| Loading state | ✅ | per-list loaders in LiveDashboard |
| Empty state | ✅ | `EmptyState.tsx` teaching cold-start [SOLID] |
| Error state | ⚠️ | send path try/catch present; voice fails with a toast, not a recoverable state |
| Navigation in/out | ✅ | view switch in App.tsx |
| Section tint / coral budget | ✅ | coral reserved for AI-grounding surfaces; token-clean (`notebook.css` uses `--pulse-*` only) |

### 9b. Interactive elements (live path highlights)
| Element | Location | Handler | Connected? | Works? | Notes |
|---------|----------|---------|-----------|--------|-------|
| Send message | Composer | `onSendMessage`/`onSendDirect` | Yes | ✅ | real RAG (but project-scoped retrieval returns [], §3.3) |
| Suggestion chips | Composer/EmptyState | `handleUseSuggestion` | Yes | ❌ | suggestions never generate (§3.2) |
| Toggle doc into context | SourcesPane | `toggleDocInContext` | Yes | ✅ | |
| Upload source | SourcesPane | `handleFileUpload` | Yes | ✅ | real ingest/embed |
| Generator tiles (×6) | GeneratorRail | store flags | Yes | ✅ | KnowledgeGraph opens on Compare tab (§3.9) |
| Dock voice / mic | ChatPane/Composer | `setShowVoiceAgentPanel` | Yes | ❌ | panel opens, token fetch 400s → never connects (§3.4) |
| Citation chip / Sources Used | MessageList | `setViewingDoc` + highlight | Partial | ⚠️ | opens doc; excerpt/highlight empty (§3.5) |
| Generate AI Summary | Export modal | `handleExport('summary')` | Yes | ❌ | empty-prompt bug (§3.1) |
| Pin to board | MessageList | `onPinArtifact` | Yes | ✅ | broadcasts pin via realtime |
| Annotate / highlight doc | DocumentViewer | gated on `userId` | No | ❌ | userId never passed (§4.1) |
| Share doc | (none) | `setSharingDoc` | No | ❌ | no trigger exists (§4.2) |
| Organize doc | Knowledge Bank | `setShowOrganize` | Yes | ✅ | userId IS passed here |

### 9c. Missing/standard UI patterns
- [x] Search/filter (Sources search; in-doc Fuse.js search) — present
- [x] Sort/filter (The Board filters; organization) — present
- [x] Single-item actions (view/delete on docs) — present
- [x] Detail view (DocumentViewer) — present
- [x] Create/Add (project/session create; upload) — present
- [x] Delete confirmation (project/session) — present
- [x] Export (markdown/json; per-message timestamps broken §3.6) — present
- [x] Keyboard shortcuts (⌘K palette; composer nav) — present
- [x] Responsive/mobile (notebook.css collapse + swipe) — present
- [x] Refresh/sync (realtime presence + message sync) — present
- [x] Toast feedback — present
- [ ] **Pagination / infinite scroll for long message lists** — not observed (auto-scroll only); flag if sessions grow large
- [ ] **Bulk doc selection/actions in Sources** — single-select only
- [ ] **Inline clickable citations in answer body** — half-shipped (§3.5)

---

## 10. Repair Priority Queue

| # | Item | Category | Complexity | User impact | Enables |
|---|------|----------|-----------|-------------|---------|
| 1 | War Room hosted voice can't connect (pass `workspace_id`, thread `workspaceId`) | Cracked §3.4 | Moderate | **Critical** — whole voice agent dead in WR | The flagship realtime feature on the primary surface |
| 2 | Project-scoped RAG search returns `[]` (`doc_id` not in RPC) | Cracked §3.3 | Moderate (schema) | **High** — grounded chat silently empty per-project | Core value prop; also fixes voice-tool citation IDs |
| 3 | Prompt suggestions never generate (arg order) | Cracked §3.2 | Trivial | Medium | Composer/empty-state chips |
| 4 | AI-summary export empty prompt (arg order) | Cracked §3.1 | Trivial | Medium | Export-summary feature |
| 5 | Annotations subsystem inert (thread `userId` into DocumentViewer) | Severed §4.1 | Trivial | Medium | Highlights + annotations + replies (4 built components) |
| 6 | "Sources Used" hollow + no inline citations (carry excerpt/source/similarity) | Cracked §3.5 | Moderate | Medium | Matches locked mockup; passage highlighting |
| 7 | Export timestamps dead (`msg.timestamp`→`created_at`) | Cracked §3.6 | Trivial | Low | `includeTimestamps` option |
| 8 | Voice tools write nothing real (`create_task`/`create_decision`/`set_reminder`) | Stub §3.8 | Moderate | Low (voice users) | Real task/decision rows from voice |
| 9 | Audit trail 8/11 methods unwired | Cracked §3.7 | Moderate | Low | Activity/audit completeness |
| 10 | VoiceControl dead mode-switch commands | Cracked §3.9 | Trivial | Low (legacy path) | — (or remove with Phase 11) |
| 11 | ShareModal has no trigger | Severed §4.2 | Moderate | Low | Doc/project sharing (verify vs WorkspaceShareModal first) |
| — | Orphan removals (`agentHandoffService`, `voiceGuardrailsService`, `buildModeActions`, `AgentSelector` body) | Orphan §7 | Trivial | None | Cleanup only — requires Rule-A pros/cons |

> **Do not** start removing Dormant legacy-path files — they are the intentional Phase-11 rollback branch. Items 1–2 are the highest leverage: small diffs, restore two core features on the live surface.

---

## 11. Git Forensics

**Recent commits touching the War Room surface (most recent first):**
```
ea07afb 2026-06-01  fix(warroom): make the War Room actually usable — session + create handlers
545bfde 2026-06-01  fix(warroom): TDZ crash — declare useNotebookShell before artifactsPanelOpen
826b16f 2026-06-01  feat(warroom): fold project/session nav into the Sources pane
60c8895 2026-06-01  fix(warroom): rebuild Notebook to the mockup, not over the legacy bones
cd28645 2026-06-01  refactor(warroom): cut orphaned ActivityFeed + SharedWithMe (D1)
d82889d 2026-06-01  refactor(warroom): relocate mode types, drop dead flags
b425dd7 2026-06-01  feat(warroom): teaching cold-start state
3a561b7 2026-06-01  feat(warroom): dock the realtime voice agent into the chat pane
a408292 2026-06-01  feat(warroom): visible Studio rail; unify generator dispatch
5df82cd 2026-06-01  feat(warroom): reasoning-trace disclosure under AI answers
9552a8d 2026-06-01  feat(warroom): inline citations + sources-used panel
08eb1dc 2026-06-01  feat(warroom): port chat canvas into Notebook ChatPane
a67b721 2026-06-01  feat(warroom): promote active-context to a first-class Sources control
51c41b2 2026-06-01  feat(warroom): scaffold Notebook shell behind warRoomNotebook flag
c6d7dc0 2026-06-01  fix(warroom): restore shared/index.ts barrel for SessionExport
```

**Reading of the timeline.** The **entire Notebook redesign was built in a single intense session on 2026-06-01** (~15 commits, scaffold → active-context → chat → citations → reasoning → rail → voice-dock → cold-start → nav-fold → "actually usable"), then **defaulted ON the same day (Phase 10).** This explains the FRAGILE rating: the UI is brand-new and shipped fast, so the cracks (§3) are the predictable residue of a rapid cutover where (a) the voice token caller wasn't re-checked against the 2026-05-10 edge-function hardening, (b) the citation send-path was left title-only, and (c) the pre-existing `searchSimilar`/`generateSuggestions` arg-order and RPC-shape bugs were inherited unchanged from the older engine.

**Large deletions — all deliberate, none accidental:**
```
60c8895 2026-06-01  rebuild Notebook to the mockup (replaced first-pass notebook scaffolding)
cd28645 2026-06-01  cut orphaned ActivityFeed + SharedWithMe (planned D1 decision)
d82889d 2026-06-01  relocate mode types, drop dead flags
4a2b104 2026-05-31  remove orphaned effects, stubs, duplicate voice variants (~4,200 lines)
5534717 2026-04-04  replace WarRoom with PulseStudio (~8,800 lines old WarRoom removed)
f005214 2026-04-03  multi-section audit revisal (incl. WarRoom)
```

**AI/automated-session signature:** the 2026-06-01 burst and the `5534717`/`4a2b104` cleanups are large multi-file commits characteristic of Claude sessions. **No commit shows accidental gutting of live functionality** — the deletions removed dead/orphan code and old architecture, consistent with the handoff docs (`docs/WAR_ROOM_REDESIGN_HANDOFF_2026-05-31.md`, `docs/WAR_ROOM_IMPLEMENTATION_HANDOFF_2026-06-01.md`).

---

## Appendix — Verification Notes (what was hand-confirmed vs. agent-reported)

Directly re-read and confirmed by the lead pass (not just sub-agent report):
- `featureFlags.ts:236-242` — flag is ON at 100%. ✅
- `LiveDashboard.tsx:149-151` — token fetch body is `{ model, voice }`, no `workspace_id`. ✅
- `openai-realtime-token/index.ts:73-74` — rejects with `400 NOT_MEMBER` when no `workspace_id` and no `byo_key`. ✅
- `geminiService.ts:1220-1225` — `processWithModel(prompt, model)`, `model` ignored, `if (!prompt) return null`. ✅
- `ragService.ts:228-247` — project filter on `d.doc_id`. ✅
- `migrations/20260119062007_remote_schema.sql:3328` — `match_documents` returns `(id, content, similarity, doc_title, doc_url)`, **no `doc_id`**; only definition across all migrations. ✅
- `index.html:39` — FontAwesome 6.4.0 loaded (FA `<i>` icons render fine; "empty boxes" claim refuted). ✅

Corrected sub-agent discrepancy: `warRoomRealtimeService` is **not** "zero importers" (it is called by `LiveDashboard.joinSession`); reclassified to CRACKED-partial (pin/presence live, cursor/edit/delete/vote severed) on the corroborating evidence of three other agents + the container.

Confidence levels: §3.1–§3.4 and §3.6 are **verified** (read end-to-end). §3.5, §3.7, §3.8, §4 are **high-confidence agent findings with quoted evidence**; the live-runtime symptom (e.g. exact toast copy) was not exercised in a running app — this was a static forensic pass, not a manual QA session.
