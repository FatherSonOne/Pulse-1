# War Room Repair Plan — 2026-06-02

Source report: [docs/triage/war-room-triage-2026-06-02.md](./war-room-triage-2026-06-02.md) (read 2026-06-02)
Scope chosen: **Full restoration** · RAG fix = **push filter into RPC param** · Citations = **panel + inline** · Extras = **all four** (voice-tool rows, audit, ShareModal, orphan cleanup)

> This is a **planning** document produced by `/triage-repair`. No functional
> code has been changed by writing it. Every destructive item below carries a
> Rule-A pros/cons block and lands behind an explicit per-item gate at execution
> time. Approval of this plan's *direction* is **not** approval to delete or
> rewrite — each Wave-4 deletion is re-confirmed and asked again before it runs.

---

## 0. Verification Delta

The triage report is dated **today (2026-06-02)** and was re-verified against the
live tree and the live database before this plan was built.

- **Drift check:** latest War Room commit is still `ea07afb` (2026-06-01); HEAD
  `aa66472` is an unrelated email fix. **Zero drift** since the report.
- **Re-confirmed by hand (lead pass, current lines quoted):**

| Finding | Re-verified location | Status |
|---|---|---|
| §3.4 voice token — no `workspace_id` | [LiveDashboard.tsx:149-151](../../src/components/LiveDashboard.tsx#L149-L151) `body: { model, voice }` | **CONFIRMED** |
| §3.4 — `workspaceId` dropped down-chain | [VoiceAgentPanel.tsx:345-355](../../src/components/WarRoom/VoiceAgentPanel.tsx#L345-L355) renders `RealtimeVoiceAgent` w/o `workspaceId`; [WarRoomModalStack.tsx:333](../../src/components/WarRoom/WarRoomModalStack.tsx#L333) renders `VoiceAgentPanel` w/o it | **CONFIRMED** |
| §3.4 — `RealtimeVoiceAgent` *wants* `workspaceId` | prop at [RealtimeVoiceAgent.tsx:70](../../src/components/WarRoom/RealtimeVoiceAgent.tsx#L70)/[:111](../../src/components/WarRoom/RealtimeVoiceAgent.tsx#L111), consumed [:185](../../src/components/WarRoom/RealtimeVoiceAgent.tsx#L185) | **CONFIRMED** (props exist; nothing forwards them) |
| §3.4 — LiveDashboard has **no** workspace ctx | grep `currentWorkspace\|useWorkspace` in LiveDashboard.tsx → **0 matches** | **CONFIRMED** (must be added) |
| §3.3 project RAG — filter on `d.doc_id` | [ragService.ts:240](../../src/services/ragService.ts#L240) `data.filter(d => projectDocIds.has(d.doc_id))` | **CONFIRMED** |
| §3.3 — **live RPC** returns no `doc_id` | `match_documents(...)` RETURNS `TABLE(id uuid, content text, similarity float8, doc_title text, doc_url text)` — verified against the **live DB** (`pg_get_function_result`), not just the migration | **CONFIRMED + strengthened** |
| §3.3 — fix is clean | `doc_embeddings` carries `id, doc_id, content, chunk_index, …` (live `information_schema`) — both `doc_id` and `chunk_index` are present to return | **CONFIRMED** |
| §3.1 export summary — arg order | [LiveDashboard.tsx:1258-1261](../../src/components/LiveDashboard.tsx#L1258-L1261) `processWithModel(apiKey, "Create a concise summary…")` | **CONFIRMED** |
| §3.2 suggestions — arg order | [ragService.ts:335-341](../../src/services/ragService.ts#L335-L341) `processWithModel(apiKey, withFormattedOutput(...))` | **CONFIRMED** |
| both — `apiKey` is `''` | [LiveDashboard.tsx:63](../../src/components/LiveDashboard.tsx#L63) `({ apiKey = '', userId })`; `processWithModel` ignores `model`, `if (!prompt) return null` ([geminiService.ts:1220-1225](../../src/services/geminiService.ts#L1220-L1225)) | **CONFIRMED** (empty prompt → null) |
| §4.1 annotations — no `userId` | [WarRoomModalStack.tsx:351-360](../../src/components/WarRoom/WarRoomModalStack.tsx#L351-L360) renders `DocumentViewer` w/o `userId` | **CONFIRMED** |
| §4.2 ShareModal — no trigger | only refs to `setSharingDoc`/`setShowShareModal` are store defs, prop threading, and the modal's own **close** ([WarRoomModalStack.tsx:670-671](../../src/components/WarRoom/WarRoomModalStack.tsx#L670-L671) → `false`/`null`). Nothing opens it. | **CONFIRMED** |
| §7 orphans — zero importers | `agentHandoffService`, `voiceGuardrailsService` → 0 import refs in `src`; `buildModeActions` → only its def; `<AgentSelector>` → 0 JSX usages | **CONFIRMED** (final whole-repo grep still required at deletion) |
| §3.6 export timestamps | [warRoomExportService.ts:137,259,302](../../src/services/warRoomExportService.ts#L137) read `msg.timestamp` | **CONFIRMED** |
| Flag ON | [featureFlags.ts:236-242](../../src/lib/featureFlags.ts#L236-L242) `enabled:true, rolloutPercentage:100` | **CONFIRMED** |

- **STALE findings:** none.
- **CHANGED findings:** none.
- **Confidence carried at report's level (re-read per-item at execution, not lead-verified now):** §3.5 citation send-path line (`LiveDashboard.tsx:728`), §3.7 audit call-sites, §3.8 voice-tool internals, §4.3 collaboration emitters. These feed Wave-2/3 items and will be re-opened before their code is touched.

**Net:** the report is accurate and current. Live-DB checks *strengthen* §3.3.

---

## 1. Decisions Taken

Recorded verbatim from the Phase-3 question round (2026-06-02):

| # | Fork | Options offered | **Chosen** | Rationale / notes |
|---|------|-----------------|-----------|-------------------|
| D1 | Scope of this pass | Quick-wins sweep *(rec)* · Launch-blocker only · **Full restoration** | **Full restoration** | Everything in the report is in scope: the live-path sweep PLUS voice-tool real rows, audit wiring, ShareModal, and orphan deletions (each Rule-A gated). |
| D2 | Project-RAG fix (§3.3) | Add `doc_id` to RPC return *(rec)* · Client-side join · **Push filter into RPC param** | **Push filter into RPC param** | Most-correct: project filtering happens **before** the similarity `match_count` cutoff, so project docs aren't crowded out of the global top-N. Heaviest option (new param + client change + migration). **Plan augments it:** the same DROP+CREATE also adds `doc_id`+`chunk_index` to the RETURNS TABLE — otherwise option C alone leaves the voice-tool citation IDs (§3.3 cascade / §3.8) still reading `undefined`. |
| D3 | Citations depth (§3.5) | Fix panel only *(rec)* · **Also weave inline citations** · Defer | **Also weave inline citations** | Carry excerpt/source/similarity through the send path (panel) **and** thread `CitationChip` inline into the answer body — completes the half-shipped "inline citations" P0 from the implementation handoff. |
| D4 | Low-impact extras | (multi-select) | **All four:** voice-tool rows · audit wiring · ShareModal trigger · orphan cleanup | Consistent with D1. ShareModal keeps its verify-first gate; orphan cleanup keeps per-item Rule-A gates ("plan it" ≠ "approve deletion"). |

---

## 2. Work Items

Eleven work items, clustered from the report's findings. Complexity:
TRIVIAL (<5 min) · MODERATE (<30 min) · COMPLEX (>30 min). Each names its
verification. Destructive items (WI-11) carry the full Rule-A block.

---

### WI-1 — Hosted realtime voice: forward `workspace_id` (§3.4)
- **Findings:** §3.4 (CRITICAL). **Archetype:** Reconnect (cracked wiring).
- **Files / lines (real, current):**
  - [LiveDashboard.tsx:149-151](../../src/components/LiveDashboard.tsx#L149-L151) — container token invoke `body: { model, voice }`.
  - [LiveDashboard.tsx:63](../../src/components/LiveDashboard.tsx#L63) — component sig (no workspace ctx; must add `useWorkspace`).
  - [WarRoomModalStack.tsx:333](../../src/components/WarRoom/WarRoomModalStack.tsx#L333) — `<VoiceAgentPanel>` (no `workspaceId`).
  - [VoiceAgentPanel.tsx:345-355](../../src/components/WarRoom/VoiceAgentPanel.tsx#L345-L355) — `<RealtimeVoiceAgent>` (no `workspaceId`).
  - `notebook/DockedVoice.tsx` — the inline voice path (same omission).
  - [RealtimeVoiceAgent.tsx:70/111/185](../../src/components/WarRoom/RealtimeVoiceAgent.tsx#L70) — **already** accepts + consumes `workspaceId`; nothing to change here except confirm it receives it.
- **Approach:** Mirror Summit ([Summit.tsx:230-231](../../src/components/Summit/Summit.tsx#L230-L231)):
  1. In LiveDashboard, `import { useWorkspace } from '../contexts/WorkspaceContext'`, derive `const workspaceId = currentWorkspace?.id ?? ''`.
  2. Add `workspace_id: workspaceId` to the container invoke body (LiveDashboard:150) so the pre-mint that sets `openaiApiKey` stops 400-ing.
  3. Thread `workspaceId` down both voice paths → `WarRoomModalStack` (floating `VoiceAgentPanel`) **and** `DockedVoice` (inline) → into `RealtimeVoiceAgent`'s existing prop. (`RealtimeVoiceAgent` already forwards it for hosted-mode tier-gating at :185.)
- **Complexity:** MODERATE. **Dependencies:** none (foundation; restores the flagship). **Blast radius:** both War Room voice paths; Summit untouched (it already wires this).
- **Verification:** targeted `tsc` on changed scope (no NEW errors); **manual** voice-connect smoke in the running app (headless cannot exercise WebRTC — flag for live QA). Success = panel connects, no *"OpenAI Realtime unavailable"* toast.

---

### WI-2 — Project-scoped RAG via RPC param + return `doc_id`/`chunk_index` (§3.3, §3.8-citations)
- **Findings:** §3.3 (HIGH) + the §3.3→§3.8 voice-tool-citation cascade. **Archetype:** Cracked repair, schema-touching (D2 = option C, augmented).
- **Files / lines:**
  - **DB:** `match_documents` RPC (current: `(query_embedding, match_threshold, match_count, filter_user_id)` → `TABLE(id, content, similarity, doc_title, doc_url)`).
  - [ragService.ts:222-248](../../src/services/ragService.ts#L222-L248) — `searchSimilar` (remove the broken client `data.filter(d => projectDocIds.has(d.doc_id))`).
  - [warRoomToolsService.ts:111-114](../../src/services/warRoomToolsService.ts#L111-L114) — reads `result.doc_id`/`result.chunk_index` (currently `undefined`).
- **Approach:**
  1. **Migration (DROP+CREATE — return type change can't `CREATE OR REPLACE`):** add optional `filter_doc_ids uuid[] DEFAULT NULL` param; in the body, when non-null, constrain `de.doc_id = ANY(filter_doc_ids)` **before** the `ORDER BY similarity … LIMIT match_count`; add `de.doc_id` and `de.chunk_index` to the `RETURNS TABLE` and the `SELECT`.
  2. **Dry-run first** in a rolled-back txn (`DO $$ … RAISE EXCEPTION 'rollback' $$`) until clean, per CLAUDE.md §4 — verify (a) no other caller breaks on the new return shape, (b) the param defaults keep the existing no-project call working unchanged.
  3. **Client:** `searchSimilar` — when `projectId` set, fetch `project_docs.doc_id` and pass as `filter_doc_ids`; delete the post-hoc client filter. `warRoomToolsService` now reads real `doc_id`/`chunk_index`.
  4. Regenerate TS types after apply.
- **Complexity:** COMPLEX (schema + 2 client sites + dry-run). **Dependencies:** none (foundation). **Unblocks:** correct grounded chat per-project, voice-tool citation IDs, and gives **WI-5** real source rows to cite. **Blast radius:** every `searchSimilar` caller — must confirm the additive return columns + defaulted param don't disturb the unscoped path or other RPC consumers (check during dry-run).
- **Verification:** dry-run completes clean before apply; `tsc` on services; **manual** — select a project, send a grounded query, confirm non-empty sources (today returns `[]`).

---

### WI-3 — Arg-order bugs: suggestions + AI-summary export (§3.1, §3.2)
- **Findings:** §3.1, §3.2 (both MEDIUM impact). **Archetype:** Cracked repair (cluster — identical root cause). **Complexity:** TRIVIAL.
- **Files / lines:**
  - [LiveDashboard.tsx:1258-1261](../../src/components/LiveDashboard.tsx#L1258-L1261) — drop the leading `apiKey` arg: `processWithModel(\`Create a concise summary…\`)`.
  - [ragService.ts:335-341](../../src/services/ragService.ts#L335-L341) — drop the leading `apiKey` arg from the `processWithModel(apiKey, withFormattedOutput(...))` call. The now-dead `apiKey` param on `generateSuggestions(apiKey, sessionId, …)` ([:332](../../src/services/ragService.ts#L332)) can be removed in the same change; its one caller is [LiveDashboard.tsx:782-783](../../src/components/LiveDashboard.tsx#L782-L783) (also pass-through `apiKey`). Either drop the param + update the caller, or leave the param and just stop forwarding it — **keep the smaller change** (stop forwarding) unless removing it is clean.
- **Dependencies:** none. **Blast radius:** the suggestion chips + the export-summary button only.
- **Verification:** `tsc`; **manual** — suggestion chips populate in Composer/EmptyState; "Generate AI Summary" returns real text, not "Failed to generate summary".

---

### WI-4 — Annotations subsystem: thread `userId` into `DocumentViewer` (§4.1)
- **Findings:** §4.1 (MEDIUM). **Archetype:** Reconnect (one prop reactivates 4 built, table-backed components). **Complexity:** TRIVIAL.
- **Files / lines:** [WarRoomModalStack.tsx:351-360](../../src/components/WarRoom/WarRoomModalStack.tsx#L351-L360) — add `userId={userId}` to the `<DocumentViewer>` render (`userId` is already a prop of `WarRoomModalStack`). `DocumentViewer` gates all annotation/highlight paths on `userId` (lines 60/81/108/131/635).
- **Dependencies:** none. **Blast radius:** `DocumentViewer` annotation UI only; tables (`doc_highlights`, `doc_annotations`, `annotation_replies`) already exist.
- **Verification:** `tsc`; **manual** — open a doc, select text → highlight popup fires; annotation sidebar populates.

---

### WI-5 — Citations: full Sources-Used panel + inline chips (§3.5)
- **Findings:** §3.5 (MEDIUM) — D3 = both. **Archetype:** Cracked repair + complete the half-shipped P0. **Complexity:** COMPLEX (send-path + inline weave).
- **Files / lines (re-confirm at execution):**
  - [LiveDashboard.tsx:728](../../src/components/LiveDashboard.tsx#L728) — `citations.map(c => ({ title: c }))` discards retrieval metadata; the data exists at [LiveDashboard.tsx:592-593](../../src/components/LiveDashboard.tsx#L592-L593) (`d.content`, `d.similarity`). Carry `{ title, source, excerpt, similarity }`.
  - `notebook/SourcesUsedPanel.tsx` — already reads `{title, source?, excerpt?, similarity?}`; will render fully once populated.
  - `notebook/CitationChip.tsx` + `notebook/MessageList.tsx` — weave `CitationChip` inline into the answer body (currently footnote-panel only).
- **Dependencies:** **soft on WI-2** (project-scoped retrieval must return sources before there's anything to cite). Sequence after WI-2. **Blast radius:** message rendering; additive (no crash today, just hollow).
- **Verification:** `tsc`; **manual** — panel shows excerpts + `· source`; clicking a citation opens the doc *with* passage highlight (today fires with `excerpt=undefined`); inline chips render in the answer body.

---

### WI-6 — Export per-message timestamps: `msg.timestamp` → `msg.created_at` (§3.6)
- **Findings:** §3.6 (LOW). **Archetype:** Cracked repair (wrong field name). **Complexity:** TRIVIAL.
- **Files / lines:** [warRoomExportService.ts:137-138](../../src/services/warRoomExportService.ts#L137), [:259-260](../../src/services/warRoomExportService.ts#L259), [:302](../../src/services/warRoomExportService.ts#L302) — read `created_at` (the real `AIMessage` field per `ragService.ts:33-39`), not `timestamp`.
- **Note (not in scope unless trivial):** `pdf` is declared in the mime maps with no formatter (falls through to markdown) — leave as-is; documented in §4.
- **Dependencies:** none. **Blast radius:** export formatters only.
- **Verification:** `tsc`; **manual** — export with `includeTimestamps` shows real times; JSON `timestamp` no longer `undefined`.

---

### WI-7 — Voice tools write real rows (§3.8)
- **Findings:** §3.8 / §5 stubs (LOW impact — voice users). **Archetype:** Build-for-real. **Complexity:** MODERATE.
- **Files / lines:** [warRoomToolsService.ts](../../src/services/warRoomToolsService.ts) — `createTaskTool` (257-312), `createDecisionTool` (318-367), `setReminderTool` (531-546), and the `reportGroundingTool` analytics `console.log` (192).
- **Approach:** route `create_task` → `taskService`, `create_decision` → `decisionService` instead of writing a `[TASK CREATED]` chat string. **Schema-first:** verify the real insert signatures + required columns of `taskService`/`decisionService` before wiring (Pulse schema is inconsistent — `tasks.user_id` is `text`). `set_reminder` → wire a notification service **or** leave an honest "not yet available" response (don't return `✅ … created successfully!` for a no-op). Keep Summit's end-of-session `summitExportService` path as the reference for real-row writes.
- **Dependencies:** soft on WI-2 (citation IDs for `reportGrounding`). **Blast radius:** in-session voice tools only.
- **Verification:** `tsc`; **manual** — voice `create_task` produces a real `tasks` row (verify via DB), not a chat string.

---

### WI-8 — Wire the audit trail (§3.7)
- **Findings:** §3.7 (LOW). **Archetype:** Reconnect (8 of 11 methods have no callers). **Complexity:** MODERATE (per call-site).
- **Files / lines:** [warRoomAuditService.ts](../../src/services/warRoomAuditService.ts) — add calls at the event sites for `sessionCreated`, `sessionDeleted`, `messageSent`, `docUploaded`, `docDeleted`, `voiceSessionStarted`, `voiceSessionEnded`, `missionLaunched`. (Re-confirm each event site at execution.)
- **Dependencies:** none. **Blast radius:** additive logging; low risk.
- **Verification:** `tsc`; **manual/spot** — a session-create / message-send produces an audit row.

---

### WI-9 — ShareModal trigger (§4.2) — **verify-first gate**
- **Findings:** §4.2 (LOW). **Archetype:** Reconnect — but **gated on an investigation**. **Complexity:** MODERATE.
- **Pre-work (blocking):** confirm War Room doc/project sharing isn't already served by `contacts/WorkspaceShareModal`. If it **is** superseded → re-classify as Orphan and fold the ShareModal into a Rule-A delete-vs-keep instead of adding a trigger.
- **Files / lines (if building):** add a Share action on a doc/project that calls `setSharingDoc(doc)` + `setShowShareModal(true)`; the modal + store setters already exist ([WarRoomModalStack.tsx:663-671](../../src/components/WarRoom/WarRoomModalStack.tsx#L663), `warRoomStore.ts:354-355`).
- **Dependencies:** the verify step. **Blast radius:** new UI affordance + `document_shares`/`project_shares` write paths.
- **Verification:** `tsc`; **manual** — Share button opens the modal; a share writes a real row (and isn't a duplicate of WorkspaceShareModal).

---

### WI-10 — Smaller live-path cracks (§3.9)
- **Findings:** §3.9 (LOW). **Archetype:** Targeted repairs (cluster). **Complexity:** TRIVIAL.
- **Items (live path):**
  - `VoiceAgentPanel.tsx:295-309` — duplicate `<option>` keys (`shimmer`/`sage`/`coral`/`verse` twice) → dedupe.
  - `GeneratorRail.tsx:44` — "Knowledge Graph" tile opens `AdvancedAIPanel` on the default `compare` tab → pass `initialView`.
  - `WarRoomModalStack.tsx:392` — `PodcastGenerator` not passed `elevenLabsApiKey` → forward it (Web Speech still works without).
- **Explicitly NOT here (legacy path → owned by Phase 11, see §4):** `VoiceControl.tsx:132-138` dead mode-switch commands; `WarRoomSidebar.tsx:162-170` icon/color picker. Touching these now would edit the dormant rollback branch slated for deletion — out of scope per CLAUDE.md Rule A.
- **Dependencies:** none. **Verification:** `tsc`; visual spot-check.

---

### WI-11 — Orphan cleanup (§7) — **destructive · Rule-A gated · Wave 4 only**
- **Findings:** §7. **Archetype:** Confirm-then-delete. **Complexity:** TRIVIAL each. **Each sub-item is asked again before it runs.**

> **Rule-A block (applies to every deletion below):**
> - **Change:** remove the named file/region.
> - **Pros:** removes confirmed dead code; smaller surface; less confusion for future sessions.
> - **Cons:** loss is real if a dynamic/string-based reference exists that grep missed; "fewer lines" is not itself a win.
> - **Preserve vs sacrifice:** all are recoverable from git; nothing functional is sacrificed *if* the zero-reference proof holds at deletion time.
> - **Completeness proof required at execution:** a fresh whole-repo, case-insensitive grep (incl. dynamic `import()`/string refs) showing zero consumers — **immediately before** each `rm`. If anything references it, STOP and reclassify.

| Sub | Target | Action | Guard |
|----|--------|--------|-------|
| 11a | `src/services/agentHandoffService.ts` (489 ln) | DELETE file | fresh grep = 0 refs; superseded by engine `transfer_to_*` |
| 11b | `src/services/voiceGuardrailsService.ts` (305 ln) | DELETE file | fresh grep = 0 refs; `RealtimeVoiceAgent` inlines its own guardrail |
| 11c | `ActionPalette.tsx:370-385` `buildModeActions` | DELETE helper only (keep `ActionPalette`) | 0 callers |
| 11d | `WarRoom/AgentSelector.tsx` component body (13-97) | Remove dead `<AgentSelector>` component; **KEEP** `AgentType` type + `AGENTS` array (7 importers) | confirm the 7 type/array importers still resolve post-edit |

- **Dependencies:** must land **last** — after WI-1…10 are stable, so no in-flight item is depending on a soon-deleted symbol. **Verification:** `tsc` (no broken imports) after each deletion; per-item grep gate before.

---

## 3. Launch Order

See §5 for the full dependency graph, sequenced table, and wave breakdown.

---

## 4. Out of Scope / Deferred

Deliberately **not** done this pass — recorded so a future session doesn't read
these as missed work:

- **Dormant legacy `StudioLayout` rollback branch** — `PulseStudio`, `StudioLayout`,
  `StudioHeader`, `StudioOnboarding`, `WarRoomSidebar`, `IntelDesk`, `VoiceOverlay`,
  `FocusTimer`, and the legacy-only cracks (`VoiceControl` dead modes, `WarRoomSidebar`
  icon/color). These are the **intentional Phase-11 rollback path** (`?ff_warRoomNotebook=off`).
  **Do not touch** — deletion is owned by the handoff's Phase 11, not this repair pass.
- **§4.3 collaboration emitters** — `ragService.getThinkingLog` (write-only; never read),
  `broadcastCursor`/`onCursorEvent`, and the `edit`/`delete`/`vote` artifact-broadcast
  branches. Half-built real-time collab; no UI demands them today; net-new feature work,
  not a repair. Deferred.
- **`pdf` export formatter** (§3.6 note) — declared in mime maps, no formatter; falls
  through to markdown. Net-new, deferred.
- **§9c UI gaps** — message-list pagination/infinite-scroll, bulk doc selection in Sources.
  Net-new features, not repairs. Deferred.
- **FontAwesome v4↔v6 two-system inconsistency** (§0 of report) — cosmetic, renders fine
  via the FA6 shim. Not a defect. Deferred.

---

## 5. Launch Order

### 5a. Dependency graph
```
FOUNDATIONS (no deps, highest leverage)
  WI-1  voice connect ─────────────┐      (CRITICAL, independent)
  WI-2  project RAG + RPC return ──┼──► unblocks WI-5 (sources to cite)
  WI-3  arg-order bugs ────────────┘                 └► unblocks WI-7 (citation IDs, soft)

DEPENDENT / THEMATIC
  WI-5  citations (panel+inline) ──── needs WI-2
  WI-4  annotations reconnect ─────── independent (trivial)
  WI-6  export timestamps ────────── independent (trivial)
  WI-7  voice tools real rows ─────── soft-needs WI-2; schema-verify first
  WI-8  audit wiring ─────────────── independent
  WI-9  ShareModal ───────────────── gated on supersede-check first
  WI-10 smaller cracks ───────────── independent (trivial)

SUBTRACTIVE (last, after all above stable)
  WI-11 orphan cleanup ──────────── Rule-A gated; depends on nothing still pointing at targets
```

### 5b. Sequenced table
| Order | Item | Category | Complexity | Why here | Unblocks |
|------|------|----------|-----------|----------|----------|
| 1 | WI-1 voice connect | Cracked §3.4 | MODERATE | CRITICAL, no schema risk, restores flagship | the live realtime feature |
| 2 | WI-3 arg-order bugs | Cracked §3.1/3.2 | TRIVIAL | zero-risk momentum; 2 one-line fixes | chips + export summary |
| 3 | WI-2 project RAG + RPC | Cracked §3.3 | COMPLEX | HIGH; foundation; schema (dry-run gated) | WI-5, WI-7, grounded chat |
| 4 | WI-5 citations panel+inline | Cracked §3.5 | COMPLEX | needs WI-2's real sources | mockup parity, passage highlight |
| 5 | WI-4 annotations | Severed §4.1 | TRIVIAL | one prop, 4 components live | highlights/annotations/replies |
| 6 | WI-6 export timestamps | Cracked §3.6 | TRIVIAL | independent quick win | `includeTimestamps` |
| 7 | WI-7 voice tools real rows | Stub §3.8 | MODERATE | schema-verify first | real task/decision rows from voice |
| 8 | WI-8 audit wiring | Cracked §3.7 | MODERATE | additive logging | audit completeness |
| 9 | WI-9 ShareModal | Severed §4.2 | MODERATE | **verify-supersede first** | doc/project sharing |
| 10 | WI-10 smaller cracks | Cracked §3.9 | TRIVIAL | cleanup, live path only | UX polish |
| 11 | WI-11 orphan cleanup | Orphan §7 | TRIVIAL ea. | **destructive, last, Rule-A** | dead-code removal |

### 5c. Waves (each leaves a committable, verified state)

- **Wave 1 — Restore the flagship (live-path critical/high + trivial wins).**
  WI-1 → WI-3 → WI-2. Commits: `fix(warroom): forward workspace_id so hosted voice connects`;
  `fix(warroom): drop dead apiKey arg in suggestions + summary export`;
  `fix(warroom): project-scoped RAG via match_documents filter param`. After this wave,
  voice connects, project search returns sources, chips + summary work. **Highest leverage.**

- **Wave 2 — Complete the grounded-chat surface.**
  WI-5 → WI-4 → WI-6. Commits: `feat(warroom): carry citation excerpts + inline chips`;
  `fix(warroom): reactivate annotations by threading userId`;
  `fix(warroom): export real per-message timestamps`. Citation panel matches the mockup;
  annotations + export work.

- **Wave 3 — Reconnect the deeper features.**
  WI-7 → WI-8 → WI-9 (verify-gate) → WI-10. Commits: `feat(warroom): voice tools write real task/decision rows`;
  `feat(warroom): wire War Room audit trail`; `feat(warroom): surface Share action (or: cut superseded ShareModal)`;
  `fix(warroom): dedupe voice option keys + minor crack fixes`.

- **Wave 4 — Orphan cleanup (subtractive, Rule-A per item).**
  WI-11a → 11b → 11c → 11d, each with its own pre-delete grep + explicit ask + commit:
  `chore(warroom): delete orphaned agentHandoffService` etc. Lands only after Waves 1–3 are stable.

**Commit discipline:** one commit per work item (per CLAUDE.md §3); no batching unrelated
changes; conventional-commit messages with `Co-Authored-By` trailer.

---

## 6. Verification Strategy

**Whole-plan gates:**
- Type-check: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` (default heap OOMs → false "clean"). Repo carries **~1234 pre-existing errors** (vite/esbuild skip type-check) → **gate on "no NEW errors," not zero.** For speed, targeted check on changed scope.
- Migration (WI-2): **dry-run in a rolled-back transaction until clean, THEN apply once** (CLAUDE.md §4) — never apply-then-debug the live function. Regenerate TS types after apply.
- Tests where they exist: `npm run test` (Vitest). Pre-commit gitleaks must pass (no `--no-verify`).

**Per-item runtime checks** (several need a **live app** — headless can't exercise WebRTC voice or project-scoped retrieval visually): WI-1 voice connect; WI-2 non-empty project search; WI-3 chips + summary; WI-4 highlight/annotate; WI-5 excerpt render + passage highlight; WI-7 real DB row. These are flagged as **manual QA** in each item — "done" requires the check actually run, not assumed.

---

## Appendix — Live-DB ground truth captured this pass
- `match_documents(query_embedding vector, match_threshold float8, match_count int, filter_user_id uuid)` → `TABLE(id uuid, content text, similarity float8, doc_title text, doc_url text)` — **no `doc_id`** (live `pg_get_function_result`).
- `doc_embeddings` columns: `id uuid, doc_id uuid, content text, embedding (vector), chunk_index int, metadata jsonb, created_at timestamptz` — both `doc_id` and `chunk_index` available to add to the RPC return (WI-2).
