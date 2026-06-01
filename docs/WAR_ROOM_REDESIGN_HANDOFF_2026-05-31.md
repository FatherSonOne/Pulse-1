# War Room Redesign — UI/UX Handoff Spec

**Date:** 2026-05-31
**Status:** Ready for a `/section-redesign` (or `huashu-design`) mockup session
**Author:** Appraisal + audit pass (3-branch wiring investigation, Nexus-orchestrated)
**Companion work this session:** dead-code trim landed in `4a2b104`
(`refactor(warroom): remove orphaned effects, stubs, and duplicate voice variants`)

---

## 0. How to use this doc

This is a **capability-to-UI registry**. The left side ("Under the Hood") is the
**verified, working backend/engine** — every claim here was traced to a real call
site, not assumed. The right side ("Needs Frontend UI") is what the redesign must
surface. A redesign session should:

1. Read §1 (identity + constraints) and §2 (the engine inventory) to understand
   what is *already real and must not be rebuilt*.
2. Use §4 (the data model) as the source of truth for **what fields exist to render**.
3. Drive mockups from §5 (the capability → UI mapping table) and §6 (UX problems).
4. Respect §7 (non-negotiables) and §8 (housekeeping already decided).
5. Produce 3 differentiated directions (paths A/B/C) per the established
   `_design-playground/` pattern.

**Golden rule for this redesign: the engine is done; the front door is not.**
War Room is one of the most genuinely-built sections in Pulse (full RAG +
realtime voice + content generators + annotations + organization), but the live
surface exposes a fraction of it (screenshots show a near-empty Knowledge Bank
with one doc). **This is a surfacing/IA/onboarding redesign, not a build.**

---

## 1. Section identity & mount

| Property | Value |
|----------|-------|
| **What it is** | A NotebookLM-class **Knowledge Workspace**: upload source documents → ground an AI over them → chat (`/summarize`, `/analyze`, `/brainstorm`), generate artifacts (study guide / FAQ / timeline / podcast), and talk to a **realtime voice agent** grounded on the active docs. |
| **Sidebar label** | "War Room" (under INTELLIGENCE) |
| **Internal view** | `AppView.LIVE_AI` (`Sidebar.tsx:110`) |
| **Entry component** | `src/components/LiveDashboard.tsx` (lazy-loaded at `App.tsx:941`) |
| **State** | `src/store/warRoomStore.ts` (Zustand, replaced ~50 `useState` hooks) |
| **Primary data service** | `src/services/ragService.ts` |
| **AI routing** | All AI goes through Supabase edge fn `ai-router` (server-side; never call models from React) |

### Design constraints (Pulse-wide, non-negotiable)
- **Coral is signal, not decoration.** `--pulse-coral` + derived tokens are
  reserved for **AI-output surfaces only** (AI responses, provenance, RAG-ranking,
  reasoning traces). Do NOT use coral for chrome, buttons, dividers, generic accent.
  The War Room AI chat / generators / voice transcript ARE legitimate coral surfaces.
- **Tokens are canonical** at `src/styles/pulse-tokens.css`; consume via `var(--pulse-*)`,
  never redeclare colors locally.
- **AI provenance chip pattern** already exists (`ProvenanceTag.tsx`) — reuse it,
  don't reinvent.
- Section must keep working on **mobile/native** (Capacitor) — store already tracks
  `isMobile`, `showMobileMenu`, swipe gestures.

---

## 2. Under-the-hood inventory (VERIFIED REAL — do not rebuild)

Every row below is wired and functional end-to-end. Status legend:
✅ real + reachable · 🟡 real but under-surfaced · 🔌 real service, UI is the gap.

| # | Capability | What it actually does | Engine (service / edge fn / table) | Status |
|---|-----------|----------------------|-----------------------------------|--------|
| 1 | **Document ingest** | Upload → persist → chunk → embed → store vectors | `ragService` (upload), edge fn `gemini-embed`, tables `knowledge_docs` + `doc_embeddings` | ✅ |
| 2 | **Semantic retrieval (RAG)** | Vector similarity search over chunks per query | `ragService.searchSimilar` → RPC `match_documents` | 🔌 (retrieval happens; *which* chunks/citations rarely shown) |
| 3 | **AI chat + slash commands** | `/summarize`, `/analyze`, `/brainstorm` (+ free chat) grounded on retrieved chunks | `useStudioCommands` → `LiveDashboard.sendMessageDirect` → `geminiService.invokeAIPrompt` → edge fn `ai-router`; messages persisted to `ai_messages` | ✅ |
| 4 | **Inline AI artifacts** | AI responses parsed into rich artifact blocks (code, tables, etc.) | `artifactParser.ts` + `ArtifactRenderers.tsx` | ✅ |
| 5 | **Provenance / citations** | Per-message source attribution badge | `ProvenanceTag.tsx` | 🟡 |
| 6 | **Reasoning trace** | Extended-thinking steps captured per message | store `thinkingLogs` / `enableExtendedThinking`; `ThinkingStep` type | 🟡 (state exists; component was a dead stub, now removed) |
| 7 | **Prompt suggestions** | Suggested next prompts | store `suggestions: PromptSuggestion[]` | 🟡 |
| 8 | **Content generators** | Study Guide, FAQ, Timeline, **Podcast (real TTS)** from the active docs | `ContentGenerators/*` → `processWithModel` (→ `ai-router`); Podcast also → `elevenLabsService.generateSpeech` | 🔌 (buried behind modal flags) |
| 9 | **Advanced AI** | Comparative analysis of multiple docs + knowledge-graph extraction | `AdvancedAI/*` → `advancedAIService` → `invokeAIJson` (`ai-router`) | 🔌 |
| 10 | **Document viewer + annotations** | Read a doc; highlight text; threaded annotations | `DocumentViewer/` + `Annotations/*` (Popup, Sidebar, ReplyThread, Highlight) | ✅ |
| 11 | **Document search** | Search across the knowledge bank | `Search/DocumentSearch` | ✅ |
| 12 | **Organization** | Collections, tags, favorites, recent views | `Organization/*` → `organizationService` (Supabase) | 🔌 |
| 13 | **Realtime voice agent** | Live OpenAI GPT-Realtime convo (WebRTC + mic), grounded on active docs, with a `rag_search` tool | `RealtimeVoiceAgent` → `realtimeAgentService` (WebRTC, model `gpt-4o-realtime-preview`); token via edge fn `openai-realtime-token`; tools via `warRoomToolsService`; doc index via `contextBankService` | 🔌 (launches as a detached floating panel — see screenshot 3) |
| 14 | **Voice synthesis (TTS read-back)** | Speak AI responses aloud | `useVoiceSynthesis` (`VoiceSynthesis.tsx`) | 🟡 |
| 15 | **Projects / sessions** | Multiple projects, each with chat sessions + history | store `projects`/`sessions`; `ragService` (`AIProject`/`AISession`); `WarRoomSidebar` | ✅ |
| 16 | **Missions** | Guided multi-phase flows (e.g. Decision Mission) reusing the AI pipeline | `missions/*` (`MissionShell`, `DecisionMission`, `useMissionPhases`) — note: reached via Decisions cockpit `CreateOverlay`, not the War Room shell | ✅ (cross-surface) |
| 17 | **Export** | Export session/doc to Archives + file download | `warRoomExportService` | ✅ |
| 18 | **Audit log** | Records actions (share, export, mission events) | `warRoomAuditService` | ✅ |
| 19 | **Realtime collaboration** | Presence channel + artifact broadcast | `warRoomRealtimeService` (Supabase Realtime); store `presence` | 🟡 (infra real; presence renders hollow in single-user) |
| 20 | **Share** | Share a doc with others | `Collaboration/ShareModal` | ✅ |
| 21 | **Focus timer** | Pomodoro-style focus, persisted | `FocusTimer` → `focusModeService` | ✅ |

---

## 3. Current UI surface (what exists today)

### Layout shell (`LiveDashboard` → these)
- **`StudioHeader`** — top bar (agent selector, presence avatars, controls).
- **`StudioLayout`** — main 3-zone canvas:
  - **`IntelDesk`** (left/source panel) — the "Sources" / Knowledge Bank list
    (screenshots 1 & 2).
  - **`PulseStudio`** (center) — the AI chat canvas (messages, input, slash
    commands, `VoiceControl`, `FocusTimer`, suggestions).
  - **`TheBoard`** (right/notes) — artifacts/board notes (`useBoardNotes`, localStorage).
  - **`ActionPalette`** (Cmd+K) + **`VoiceOverlay`**.
- **`WarRoomSidebar`** — projects/sessions navigation.
- **`WarRoomModalStack`** — lazy dispatcher for: DocumentViewer, DocumentSearch,
  the 4 ContentGenerators, OrganizationSidebar, ShareModal, AdvancedAIPanel,
  VoiceAgentPanel, export modal.
- **`StudioOnboarding`** — conditional onboarding overlay.

### What the screenshots show (the problem)
1. **Knowledge Bank modal** — clean, but a single doc and no obvious path to the
   engine behind it (generators, advanced AI, voice are all elsewhere/hidden).
2. **War Room empty state** — "1 source ready · 1 active" + a lone "Summarize this
   source" CTA + a thin hint line `/summarize · /analyze · /brainstorm · ⌘K for more`.
   The depth (RAG, generators, comparative analysis, knowledge graph) is invisible.
3. **Voice Agent** — launches as a **detached floating widget** ("Disconnected /
   Start voice", `0 messages · 0 tool calls · OPENAI GPT-REALTIME`), visually
   divorced from the doc context it's actually grounded on.

---

## 4. The data model the UI can render (source of truth for mockups)

The redesign can bind to all of this — it already exists in `warRoomStore.ts` and
`ragService` types. **Design to these fields; don't invent new data contracts
without flagging a backend change.**

**Core entities** (`ragService`): `AIProject`, `AISession`, `AIMessage`,
`KnowledgeDoc`, `ThinkingStep`, `PromptSuggestion`.

**Store slices** (`warRoomStore.ts`):
- **Projects:** `projects`, `selectedProjectId`
- **Sessions:** `sessions`, `selectedSessionId`, `messages`, `input`, `isLoading`,
  `activeAgent` (`AgentType`), `missionMessages`
- **Documents:** `documents: KnowledgeDoc[]`, `uploadingFiles`, `uploadProgress`,
  **`activeContextDocs: Set<string>`** (which docs ground the AI — central to the UX),
  `viewingDoc`, `viewerHighlightText`
- **Voice:** `voiceEnabled`, `voiceMode` (`push-to-talk | always-on | wake-word`),
  `voiceSynthesisEnabled`, `voiceGender`, `showVoiceAgentPanel`, `voiceAgentExpanded`,
  `visualizerType` (`listening | thinking | speaking | idle`), `audioData: number[]`,
  `isAIStreaming`
- **AI intelligence surfacing:** `thinkingLogs`, `enableExtendedThinking`,
  `suggestions`, `showSuggestions`, `currentTokens`
- **Content generators (modal flags):** `showStudyGuide`, `showFAQ`, `showTimeline`,
  `showPodcast`, `showMindMap`, `showChartGenerator`/`generatedChart`, `showAdvancedAI`
- **Organization/collab:** `showOrganize`/`organizingDocId`, `showShareModal`,
  `presence: Map<string, PresenceUser>`
- **UI/layout:** `isMobile`, `showMobileMenu`, `contextPanelOpen`, `isSidebarOpen`,
  `showActiveContext`, `expandedRooms`

> Note: `warRoomMode` / `currentMission` / `currentRoom` / `showWarRoomHub` slices
> exist but the "War Room hub" UI was removed in a prior Phase 1; treat these as
> **legacy mode state** — confirm before building UI on them (see §8).

---

## 5. ⭐ Capability → Frontend UI mapping (the core of this handoff)

This is the registry the redesign should work from: **engine that exists** →
**UI the redesign must create/fix**.

| Engine (exists) | The UI gap to solve | Priority |
|-----------------|---------------------|----------|
| RAG retrieval returns the chunks that grounded each answer (#2) | **Surface citations inline** — show *which source + passage* each AI claim came from, click-to-open in DocumentViewer with highlight (`viewerHighlightText` already supports this). Extend `ProvenanceTag`. | P0 |
| `activeContextDocs` set drives grounding (#1/#13) | **Make "active context" a first-class, always-visible control** — which docs are "in play" right now, toggleable, with count. Today it's a faint toggle. | P0 |
| 4 content generators + advanced AI, all real (#8/#9) | **A discoverable "Generate / Analyze" surface** — replace the hidden modal flags with a visible menu/rail so users know Study Guide, FAQ, Timeline, **Podcast**, Comparative Analysis, Knowledge Graph exist. | P0 |
| Realtime voice agent grounded on active docs (#13) | **Integrate voice into the workspace**, not a detached floating widget. Voice should visibly share the active-context docs + show its `rag_search` tool calls and transcript. Use `visualizerType`/`audioData` for the live viz. | P0 |
| AI chat + slash commands (#3) | **Empty state that teaches the engine** — the current lone "Summarize this source" + hint line undersells it. Show example prompts (`suggestions`), the 3 commands as affordances, and a "what can this do" path. | P0 |
| Reasoning trace (`thinkingLogs`, #6) | **Optional reasoning-trace disclosure** under AI messages (coral provenance surface). State exists; the old stub was removed — needs a real, tasteful component. | P1 |
| Prompt suggestions (#7) | **Suggestion chips** in the composer / empty state. | P1 |
| Projects + sessions + history (#15) | **Clear workspace/session navigation** — `WarRoomSidebar` exists; redesign its IA so projects↔sessions↔docs relationships are legible. | P1 |
| Document viewer + annotations (#10) | Keep, but **connect annotations to chat** (cite-from-highlight → ask AI). | P1 |
| Organization: collections/tags/favorites (#12) | **Surface organization** in the sources panel (filter/group), not a separate hidden sidebar. | P2 |
| Voice synthesis read-back (#14) | A simple **"read aloud" affordance** on AI messages. | P2 |
| Export + Archives (#17) | Keep; ensure a visible **export/save-to-Archives** action on sessions. | P2 |
| Realtime presence (#19) | **Defer rich multiplayer**; show presence only when >1 user. Don't design around it for v1. | P3 |

---

## 6. UX problems the redesign must solve (prioritized)

1. **Discoverability collapse (P0).** A deep engine behind a one-line front door.
   The redesign's central job: make the RAG depth, generators, advanced AI, and
   voice *visible and inviting* without clutter.
2. **Empty / cold-start state (P0).** New users land on "1 source, summarize this."
   Need seeded examples, a "drop your first doc" flow, and a clear value story.
3. **Voice is detached (P0).** The floating "Disconnected" widget reads as a
   separate toy, not the doc-grounded agent it is. Re-home it in the workspace.
4. **No visible grounding/citations (P0).** Users can't see *why* the AI said what
   it said or *which doc* it used — the single biggest trust gap for a knowledge tool.
5. **Modal-stack overload (P1).** ~8 capabilities hidden behind boolean modal flags.
   Rethink as a coherent IA (rail / command surface / contextual panels) instead of
   a pile of modals.
6. **Lane ambiguity (P1, strategic).** War Room vs **Glimpse** vs **Search** all do
   "AI over your content." The redesign should stake out War Room's distinct lane
   (durable knowledge base + grounded voice) — flag for a product decision.

---

## 7. Non-negotiables / constraints for the redesign

- **Do not rebuild the engine.** Everything in §2 works. This is UI/IA/UX only.
  If a mockup implies a new data field, **flag it** as a backend change, don't assume.
- **Preserve the data contract** in §4 (store + `ragService` types). Re-skinning is
  free; renaming/removing state slices is a code change with blast radius into
  `LiveDashboard`.
- **Keep the canonical voice path** (`VoiceAgentPanel` → `RealtimeVoiceAgent` →
  `realtimeAgentService`). The duplicate variants were deleted this session; don't
  resurrect a parallel voice UI — restyle the canonical one.
- **Coral budget** (§1) — coral only on AI-output surfaces.
- **Real-time messages** use the existing subscription/dedup; don't add full-list
  refetch-on-send (known race, see project memory).
- **Mobile/native** must keep working (Capacitor).
- **AI is server-side** (`ai-router`, `gemini-embed`, `openai-realtime-token` edge
  functions). No direct model calls from React.

---

## 8. Housekeeping already decided (context, not redesign work)

- ✅ **Dead code removed this session** (commit `4a2b104`): orphaned `effects/`
  (MatrixRain/GlitchEffect/ParticleField), `ThinkingPanel`/`TokenStream` stubs,
  `shared/PomodoroTimer`/`TopicLock`, the duplicate voice cluster
  (`VoiceAgentPanelRedesigned`, `VoiceAgentVisualizer(Enhanced)`,
  `VoiceAgentIntegration`, dead `OpenAIVoiceCommandModal`), and `WarRoom/AudioVisualizer`.
- ⏳ **`ModeSwitcher.tsx`** is an orphaned component whose *types*
  (`WarRoomMode`/`MissionType`/`RoomType`) are still imported by the store. Needs a
  type-relocation before the component can be deleted. The "War Room hub" / mode
  switching UI was already removed — **redesign should NOT build on mode state**
  (§4 note) without confirming.
- ❓ **`Collaboration/ActivityFeed` + `SharedWithMe`** are real (Supabase) but
  orphaned from the War Room shell — **pending a delete-vs-rewire decision**. If the
  redesign wants an activity/shared view, these are ready to wire in; otherwise they
  get deleted. **Decision needed.**
- 🪧 Orphaned settings flags `warRoomTokenStreaming` / `warRoomThinkingPanel` left in
  `settingsService` (removing them changes persisted-settings shape) — ignore for redesign.

---

## 9. Open questions for the redesign session

1. **Lane:** What is War Room's one-sentence job *vs* Glimpse and Search? (Drives
   the whole IA.)
2. **Voice placement:** Docked panel? Inline mode toggle in the composer? Full-screen
   "talk to your docs" mode? (Engine supports any.)
3. **Generators:** A persistent "Generate" rail, a `/`-command surface, or contextual
   per-doc actions? (All 6 generators are one `processWithModel`/`advancedAIService`
   call away.)
4. **Citations:** Inline footnote chips, a side "sources used" panel, or hover cards?
5. **Activity/Shared:** Wire `ActivityFeed`/`SharedWithMe` in, or cut them? (§8)
6. **Cold start:** What seeds an empty workspace — sample docs, a template, a guided
   first-upload?

---

## 10. Suggested mockup directions to explore (seed for paths A/B/C)

Not prescriptive — a starting spread for the redesign session:

- **Path A — "Notebook" (sources-led):** NotebookLM-style 3-pane (Sources · Chat ·
  Studio/Generators). Active-context + citations are the spine. Voice docks into the
  chat pane. Familiar, low-risk, maximizes discoverability of the generator suite.
- **Path B — "Briefing Room" (answer-led):** Chat/answer canvas is primary; sources +
  generators + voice are summonable contextual surfaces (command-driven, ⌘K-first).
  Leans into the existing `ActionPalette`. Cleaner, more "AI-native," higher learning
  curve.
- **Path C — "Grounded Voice" (conversation-led):** Voice + live transcript front and
  center (the differentiator vs Glimpse/Search), with docs and generated artifacts as
  the supporting rail. Bold bet on the realtime agent as the headline feature.

---

## 11. Appendix — key files & infra

**UI shell:** `LiveDashboard.tsx`, `WarRoom/StudioLayout.tsx`, `IntelDesk.tsx`,
`PulseStudio.tsx`, `TheBoard.tsx`, `StudioHeader.tsx`, `WarRoomSidebar.tsx`,
`WarRoomModalStack.tsx`, `ActionPalette.tsx`, `StudioOnboarding.tsx`.
**State:** `src/store/warRoomStore.ts`.
**Voice (canonical):** `VoiceAgentPanel.tsx` → `RealtimeVoiceAgent.tsx` →
`src/services/realtimeAgentService.ts`; `VoiceControl.tsx`, `VoiceOverlay.tsx`,
`VoiceSynthesis.tsx`, `VoiceSessionHistory.tsx`, `AudioAutoplayPrompt.tsx`.
**Capabilities:** `ContentGenerators/{StudyGuide,FAQ,Timeline,Podcast}Generator.tsx`,
`AdvancedAI/{AdvancedAIPanel,ComparativeAnalysis,KnowledgeGraphViewer}.tsx`,
`Annotations/*`, `Organization/*`, `Search/DocumentSearch.tsx`,
`DocumentViewer/DocumentViewer.tsx`, `FocusTimer.tsx`.
**Services:** `ragService`, `advancedAIService`, `organizationService`,
`collaborationService`, `focusModeService`, `warRoomRealtimeService`,
`warRoomExportService`, `warRoomAuditService`, `warRoomToolsService`,
`contextBankService`, `elevenLabsService`, `geminiService`/`aiService`.
**Edge functions:** `ai-router` (all text AI), `gemini-embed` (embeddings),
`openai-realtime-token` (voice session token).
**Tables:** `knowledge_docs`, `doc_embeddings`, `ai_messages` (+ `ai_projects`/
`ai_sessions` via `ragService`). RPC: `match_documents`.

---

*End of handoff. Pair this with a `/section-redesign War Room` session — it has
everything needed to go straight to triple-mockup exploration.*
