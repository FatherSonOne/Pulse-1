# War Room Redesign — Implementation Handoff (Path A · Notebook)

**Date:** 2026-06-01
**Direction locked:** Path A — "Notebook" (sources-led 3-pane)
**Status:** Ready to implement
**Owner:** TBD (this doc is the handoff — self-contained)
**Companion docs:**
- Capability/appraisal spec → `docs/WAR_ROOM_REDESIGN_HANDOFF_2026-05-31.md` (the "what's real" registry — READ FIRST)
- Mockup → `_design-playground/warroom-redesign.html` (flip to **A · Notebook**); verify `_design-playground/_verify-warroom.mjs`

---

## 0. TL;DR

War Room is a NotebookLM-class knowledge workspace with a **fully-built engine** (RAG, realtime voice, 4 generators + advanced AI, annotations, organization) sitting behind a **near-empty front door**. This redesign surfaces that engine in a sources-led 3-pane "Notebook" — **Sources · Chat · Studio** — with three P0 wins: (1) **active-context** becomes a first-class, always-visible control, (2) **citations** render inline under every grounded answer, (3) the **generator suite + voice** become visible and inviting instead of hidden behind modal flags / a floating widget.

**Non-negotiable principle (CLAUDE.md §4 + spec §7): the engine is done — this is UI/IA/UX only.** Do NOT rebuild RAG, voice, or generators. Preserve every `warRoomStore` slice and `ragService` type. If a mockup implies a new data field, **flag it** (see §10) — don't invent a contract.

**Crucial discovery:** the current `StudioLayout.tsx` is *already* a 3-pane (`[IntelDesk] | [canvas] | [TheBoard]`). Path A keeps those bones. The work is re-IA + re-skin + re-home voice + add citations/active-context-first-class/Studio-rail — **lower risk than a greenfield build.**

**Rollout:** new flag `warRoomNotebook` (default **OFF**) in `FeatureContext`. `LiveDashboard` picks `NotebookShell` (flag ON) vs legacy `StudioLayout` (flag OFF). Flip ON after soak; delete legacy one release later.

---

## 1. Source of Truth

| Reference | Path | Why |
|---|---|---|
| Mockup (Path A) | `_design-playground/warroom-redesign.html` | The visual + IA spec. The mockup IS the spec. |
| Verify script | `_design-playground/_verify-warroom.mjs` | Headless screenshot harness; zero-console-error bar |
| Capability registry | `docs/WAR_ROOM_REDESIGN_HANDOFF_2026-05-31.md` | What's real under the hood — do not rebuild |
| Design tokens | `src/styles/pulse-tokens.css` | Consume `var(--pulse-*)`; never redeclare colors |
| Coral budget | CLAUDE.md §4 | Coral = AI-output surfaces only |
| Branch discipline | CLAUDE.md §1, §3 | Work on `main`; commit each phase; no `-a` sweeps |
| Memory | `~/.claude/projects/f--pulse1/memory/project_pulse_warroom_redesign_direction.md` | The locked decision |

---

## 2. Mental Model

```
┌──────────────────────────────────────────────────────────────────────────┐
│  NotebookShell  (flag: warRoomNotebook)                                    │
│  ┌───────────────┬──────────────────────────────────┬───────────────────┐ │
│  │ SOURCES       │ CHAT (the spine)                 │ STUDIO            │ │
│  │ (left)        │                                  │ (right)           │ │
│  │               │  ┌────────────────────────────┐  │                   │ │
│  │ ActiveContext │  │ EmptyState (teaches engine)│  │ GeneratorRail     │ │
│  │  "4 of 6      │  │  or MessageList:           │  │  · Study Guide    │ │
│  │   grounding   │  │   user / AI bubbles        │  │  · FAQ            │ │
│  │   the AI"     │  │   + CitationChip [1][2]    │  │  · Timeline       │ │
│  │               │  │   + SourcesUsedPanel       │  │  · Podcast        │ │
│  │ tag filter    │  │   + ReasoningTrace         │  │  · Comparative ADV│ │
│  │ doc rows      │  │   + pin-to-board           │  │  · Knowledge GraphADV│ │
│  │ (toggle ⇒     │  ├────────────────────────────┤  │                   │ │
│  │  context)     │  │ DockedVoice (inline strip) │  │ ArtifactsSection  │ │
│  │               │  ├────────────────────────────┤  │  · generated      │ │
│  │ + Upload      │  │ Composer: / autocomplete   │  │  · pinned (Board) │ │
│  │               │  │  + suggestion chips + mic  │  │                   │ │
│  └───────────────┴──────────────────────────────────┴───────────────────┘ │
│  (ActionPalette ⌘K retained · DocumentViewer + modals via WarRoomModalStack)│
└──────────────────────────────────────────────────────────────────────────┘
```

**Invariants the implementation MUST hold:**

1. **Engine untouched.** No new RAG/voice/generator logic. `ragService`, `realtimeAgentService`, `advancedAIService`, the 4 generators, `ai-router`/`gemini-embed`/`openai-realtime-token` edge functions are consumed as-is.
2. **`activeContextDocs` is the grounding contract.** Every AI surface (chat, voice, generators) reads the same `Set<string>`. Toggling a source must update the visible count and the AI's context in lockstep. (`activeContextDocs.size === 0` means "all docs" — preserve that fallback, see `WarRoomModalStack.tsx:397`.)
3. **One voice path only.** `DockedVoice` re-homes the canonical `VoiceAgentPanel → RealtimeVoiceAgent → realtimeAgentService`. Restyle, never fork. (Duplicate voice variants were already deleted in `4a2b104`.)
4. **Coral = AI only.** Citations, provenance, reasoning trace, voice transcript, generator-result surfaces, generator icons → coral. Sources chrome, Studio container, composer, buttons → neutral.
5. **Real-time send stays subscription-based.** Do NOT refetch the full message list after send (known race — memory `project_pulse_messages_pathd`). Trust existing dedup.
6. **Store contract frozen.** All 46 `warRoomStore` slices survive. New UI state is local unless it must persist.

---

## 3. Current State — Architecture Audit Summary

Total WarRoom surface: **~17,662 lines** across ~30 components + 12 services + 8 hooks.

| Concern | Files (lines) | One-line summary |
|---|---|---|
| **Orchestrator** | `LiveDashboard.tsx` (1,673) | All data logic: project/session/doc CRUD, send, upload, export, context toggles, audio. Renders `StudioLayout` + `WarRoomModalStack`. |
| **Store** | `warRoomStore.ts` (441) | Zustand, 46 state fields / 46 actions, 8 slices. `missionMessages` auto-persists to localStorage. |
| **Layout (today)** | `StudioLayout.tsx` (386) | **Already 3-pane**: `IntelDesk` \| canvas(`children`) \| `TheBoard`. Owns ⌘K `ActionPalette`, `VoiceOverlay`, and a **local** generator dispatch (`activeGen` state, lines 102/369-380). |
| **Chat canvas** | `PulseStudio.tsx` (~600) | Message list (`MarkdownContent` + `ProvenanceTag`), input w/ slash+@ autocomplete (`useStudioCommands`), suggestion chips, agent selector, focus timer, pin-to-board. |
| **Sources** | `IntelDesk.tsx` | Doc tree, per-doc context toggle, Add All/Clear All, upload, progress, view/delete, context-size estimate. |
| **Modals** | `WarRoomModalStack.tsx` (671) | 11 conditional modals (Export, **floating Voice panel**, DocumentViewer, 4 generators via **store flags**, AdvancedAI, Organize, **Knowledge Bank full-screen**, Share). |
| **Commands** | `useStudioCommands.ts` (240) | 8 slash commands (`/brainstorm /decide /analyze /summarize /plan /debrief /risks /compare`) + 4 `@agent` mentions, each injects a prompt prefix + agent hint. |
| **Voice** | `VoiceAgentPanel`→`RealtimeVoiceAgent`→`realtimeAgentService` + `VoiceControl`/`VoiceOverlay`/`VoiceSynthesis`/`VoiceSessionHistory`/`AudioAutoplayPrompt` | Canonical WebRTC GPT-Realtime path; tools via `warRoomToolsService` (`rag_search` + 7 more), context via `contextBankService`. Launched as a **`position:fixed` floating panel** (`WarRoomModalStack.tsx:295-338`). |
| **Generators** | `ContentGenerators/{StudyGuide,FAQ,Timeline,Podcast}Generator.tsx` | Real; each takes `documents`+`activeContextIds`+`apiKey`. **Dispatched two ways** (StudioLayout `activeGen` AND store flags). |
| **Advanced AI** | `AdvancedAI/{AdvancedAIPanel,ComparativeAnalysis,KnowledgeGraphViewer}.tsx` | Real; `showAdvancedAI` flag exists but **has no UI trigger today** (orphaned entry). |
| **Provenance** | `ProvenanceTag.tsx` (38) | `ps-provenance` mono chip — `MODEL · KIND`. Reuse + extend for citations. |
| **Misc real** | `DocumentViewer/` (+ `Annotations/*`), `Search/DocumentSearch`, `Organization/*`, `Collaboration/{ShareModal,PresenceAvatars,ActivityFeed,SharedWithMe}`, `FocusTimer`, `TheBoard`+`ArtifactRenderers`+`useBoardNotes`, `StudioOnboarding`, `useSwipeGesture` | See matrix §4. |

**Dead / orphaned (audit + spec §8):**
- `ModeSwitcher.tsx` — orphaned component; its types (`WarRoomMode`/`MissionType`/`RoomType`) still imported by `warRoomStore.ts:7`. Needs type relocation before deletion.
- Store flags with no live dispatch: `showMindMap`, `showChartGenerator`/`generatedChart`, `glitchTrigger`, `showWarRoomHub`, `showMissionLauncher`.
- `Collaboration/ActivityFeed` + `SharedWithMe` — real (Supabase) but unwired. **Decision needed** (§10).

---

## 4. Feature Disposition Matrix  ⭐ (core of this doc)

Disposition: **Preserved** (unchanged) · **Moved** (kept, new home) · **Deferred (v1.1)** · **Removed** (rationale required).

### 4.1 Layout & navigation
| Feature | Current | New home | Disposition | Notes |
|---|---|---|---|---|
| 3-pane shell | `StudioLayout` | `NotebookShell` | Moved | Same bones; re-skin + rename panes (Sources/Chat/Studio) |
| Sources pane | `StudioLayout` left → `IntelDesk` | `SourcesPane` wraps `IntelDesk` | Preserved+ | Add `ActiveContextBar` on top |
| Artifacts/Board pane | `StudioLayout` right → `TheBoard` | `StudioPane` → ArtifactsSection | Moved | Board folds under Studio; generators move ABOVE it |
| ⌘K Action Palette | `StudioLayout` `ActionPalette` | `NotebookShell` (same) | Preserved | Keep; it's the secondary launch path for generators |
| Projects/sessions nav | `WarRoomSidebar` | unchanged | Preserved | Out of scope for v1 IA; relationships already legible |
| Mobile swipe / collapse | `useSwipeGesture`, `isMobile` | `NotebookShell` | Preserved | Phase 8 parity check |
| Mode switching (`warRoomMode`, hub) | `ModeSwitcher` (orphaned) | — | Removed | UI already gone; relocate types, delete component (Phase 9) |

### 4.2 Sources & context (P0)
| Feature | Current | New home | Disposition | Notes |
|---|---|---|---|---|
| Doc upload + progress | `LiveDashboard` `handleFileUpload`, `IntelDesk` | `SourcesPane` | Preserved | Same handlers/store |
| Per-doc context toggle | `IntelDesk` `onToggleDoc` | `SourcesPane` row toggle | Moved | Promote visually; drives `activeContextDocs` |
| **Active-context summary** | faint toggle (`showActiveContext`) | `ActiveContextBar` (new) | Moved→first-class | "N of M grounding the AI" + count, always visible |
| Add All / Clear All | `IntelDesk` | `SourcesPane` | Preserved | Reuse `onAddAllDocs`/`onClearAllDocs` |
| Tag/collection filter | `Organization/*` (hidden sidebar) | `SourcesPane` filter chips | Moved (P2) | Surface group/filter inline; full Organize modal stays for management |
| Doc search | `Search/DocumentSearch` | `SourcesPane` search + ⌘K | Preserved | Reuse component |
| Knowledge Bank full-screen | `WarRoomModalStack:440` | retained modal | Preserved | The "browse everything" view; reachable from SourcesPane header |
| View / delete doc | `IntelDesk` + `DocumentViewer` | unchanged | Preserved | `viewingDoc` flow intact |

### 4.3 Chat & intelligence (P0/P1)
| Feature | Current | New home | Disposition | Notes |
|---|---|---|---|---|
| Message list + markdown | `PulseStudio` + `MarkdownContent` | `ChatPane` → MessageList | Preserved | Port render verbatim |
| Slash commands (8) + @agents (4) | `useStudioCommands` | `Composer` | Preserved | Keep autocomplete; mockup hint shows 3 — surface all 8 in palette/“more” |
| Suggestion chips | `suggestions`/`showSuggestions` | `Composer` + `EmptyState` | Preserved | Already wired |
| Agent selector | `AgentSelector` | `ChatPane` header | Preserved | general/skeptic/scribe/deep-diver |
| Inline artifacts | `artifactParser` + `ArtifactRenderers` | MessageList | Preserved | Code/table/list blocks |
| Pin-to-board | `PulseStudio` `onPinArtifact` | MessageList → StudioPane | Preserved | Broadcasts via `warRoomRealtimeService` |
| **Citations inline** | `ProvenanceTag` only (🟡) | `CitationChip` + `SourcesUsedPanel` (new) | Moved→P0 | Click-to-open `DocumentViewer` w/ `viewerHighlightText`. **Verify `AIMessage.citations` shape (§10).** |
| **Reasoning trace** | `thinkingLogs` state (stub removed) | `ReasoningTrace` (new, coral disclosure) | Moved→P1 | Reads `thinkingLogs`/`enableExtendedThinking` |
| Read-aloud (TTS) | `useVoiceSynthesis` | AI message action | Preserved (P2) | "Read aloud" affordance |
| Extended-thinking toggle | `enableExtendedThinking` | `ChatPane` header | Preserved | |

### 4.4 Studio — generators & advanced AI (P0)
| Feature | Current | New home | Disposition | Notes |
|---|---|---|---|---|
| Study Guide / FAQ / Timeline / Podcast | modal flags + StudioLayout `activeGen` | `GeneratorRail` cards | Moved→visible | **Consolidate dual dispatch to store flags** (`setShowStudyGuide` etc.) |
| Comparative Analysis | `AdvancedAIPanel` tab | `GeneratorRail` (ADV) | Moved→visible | |
| Knowledge Graph | `AdvancedAIPanel` tab | `GeneratorRail` (ADV) | Moved→visible | |
| **AdvancedAI open trigger** | none (orphaned `showAdvancedAI`) | `GeneratorRail` button | Moved→**fixed** | Wire the missing trigger |
| Generated-artifact display | ad hoc | StudioPane ArtifactsSection | Moved | e.g. podcast player chip |
| Mind Map / Chart generator | `showMindMap`/`showChartGenerator` (no UI) | — | Removed | Dead flags; no component wired. Remove in Phase 9. |

### 4.5 Voice (P0)
| Feature | Current | New home | Disposition | Notes |
|---|---|---|---|---|
| Realtime voice agent | `VoiceAgentPanel` (floating `fixed`) | `DockedVoice` inline strip in `ChatPane` | Moved→re-homed | **Restyle the canonical panel; don't fork.** Show active-context + `rag_search` tool calls + transcript |
| Voice viz | `audioData`/`visualizerType` | `DockedVoice` | Preserved | Coral bars |
| Voice modes | `voiceMode` (ptt/always-on/wake) | `DockedVoice` controls | Preserved | |
| Voice history/export | `VoiceSessionHistory` | `DockedVoice` tab | Preserved | |
| Autoplay-blocked prompt | `AudioAutoplayPrompt` | unchanged | Preserved | |
| VoiceOverlay (floating transcript) | `StudioLayout` | folded into `DockedVoice` | Moved | Avoid two transcript surfaces |

### 4.6 Collaboration, export, focus
| Feature | Current | New home | Disposition | Notes |
|---|---|---|---|---|
| Session export → Archives | `warRoomExportService`, Export modal | StudioPane / session menu | Preserved | Keep visible export |
| Share doc | `ShareModal` | doc context action | Preserved | |
| Presence avatars | `PresenceAvatars` | `ChatPane` header (when >1 user) | Preserved (P3) | Hide in single-user — don't design around it |
| Activity feed / Shared-with-me | `ActivityFeed`/`SharedWithMe` (orphaned) | — | **Deferred / Decision** | Recommend CUT for v1 (solo-first); see §10 |
| Focus timer | `FocusTimer`/`focusModeService` | `ChatPane` (kept) | Preserved | |
| Onboarding | `StudioOnboarding` | replaced by `EmptyState` teaching | Moved | Cold-start is now the teacher (Phase 7) |
| Audit log | `warRoomAuditService` | unchanged | Preserved | Background service |

---

## 5. New Architecture

```
src/components/WarRoom/notebook/        ← new folder (commit empty-but-scaffolded in Phase 0)
  NotebookShell.tsx        orchestration; flag-gated; renders 3 panes + retains ActionPalette
  SourcesPane.tsx          wraps IntelDesk + ActiveContextBar + tag-filter chips + search
  ActiveContextBar.tsx     "N of M grounding the AI" strip (coral AI surface)
  ChatPane.tsx             header (agent selector, presence, thinking toggle) + MessageList + DockedVoice + Composer
  MessageList.tsx          ports PulseStudio message render + CitationChip + SourcesUsedPanel + ReasoningTrace
  CitationChip.tsx         inline [n] footnote chip → opens DocumentViewer w/ highlight (coral)
  SourcesUsedPanel.tsx     "SOURCES USED · N PASSAGES" under grounded answers (coral)
  ReasoningTrace.tsx       collapsible "THOUGHT FOR N STEPS" disclosure (coral, muted)
  DockedVoice.tsx          inline-docked restyle of VoiceAgentPanel (renders canonical RealtimeVoiceAgent)
  Composer.tsx             ports PulseStudio input: slash/@ autocomplete + suggestion chips + mic toggle
  EmptyState.tsx           cold-start teacher (drop-first-doc, example prompts, commands)
  StudioPane.tsx           GeneratorRail + ArtifactsSection (generated + TheBoard)
  GeneratorRail.tsx        6 launcher cards → store flags
```

**Reused verbatim (import, don't copy):** `IntelDesk`, `TheBoard`+`useBoardNotes`, `DocumentViewer`, `DocumentSearch`, all 4 `ContentGenerators/*`, `AdvancedAIPanel`, `VoiceAgentPanel`/`RealtimeVoiceAgent`/`realtimeAgentService`, `useStudioCommands`, `AgentSelector`, `MarkdownContent`, `artifactParser`/`ArtifactRenderers`, `ProvenanceTag` (extended), `ActionPalette`, `WarRoomModalStack`, `useSwipeGesture`, `FocusTimer`.

**State plan:** No new store slices required for the core. All panes read `useWarRoomStore`. Two optional local-only states:
- `StudioPane` tab (`'generate' | 'artifacts'`) — local `useState`.
- `DockedVoice` expanded — reuse existing `voiceAgentExpanded`.
Generator open is driven by the **existing** store flags (`setShowStudyGuide`/`setShowFAQ`/`setShowTimeline`/`setShowPodcast`/`setShowAdvancedAI`) → rendered by `WarRoomModalStack`. This unifies the dual dispatch (remove StudioLayout's local `activeGen`).

**Citation mechanics (P0, has a data dependency):** `CitationChip` onClick → `setViewingDoc(doc)` + `setViewerHighlightText(passage)` (already wired end-to-end, `WarRoomModalStack.tsx:485-489`). `SourcesUsedPanel` renders from `AIMessage.citations`. **Before building Phase 3, verify what `citations` carries** (see §10 Decision D2).

---

## 6. Implementation Phases

Each is independently mergeable to `main`. Commit per phase (CLAUDE.md §3). `tsc` gate = **no NEW errors** (repo has ~1234 pre-existing; use `NODE_OPTIONS=--max-old-space-size=8192`).

### Phase 0 — Scaffold + flag
**Goal:** Flag-gated empty shell that renders today's UI unchanged.
1. Add `warRoomNotebook: boolean` (default `false`) to `FeatureContext` (mirror `emailHybrid`/`decisionsTriageCockpit`).
2. Create `src/components/WarRoom/notebook/` with `NotebookShell.tsx` that, for now, renders the **same `StudioLayout` children** it's handed.
3. In `LiveDashboard`, branch: `warRoomNotebook ? <NotebookShell …/> : <StudioLayout …/>`.
4. `git add` the new folder immediately (CLAUDE.md §1).
**Acceptance:** flag OFF = byte-identical behavior; flag ON = same content in `NotebookShell`. `tsc` clean.
**Commit:** `feat(warroom): scaffold Notebook shell behind warRoomNotebook flag`

### Phase 1 — SourcesPane + ActiveContextBar (P0)
**Goal:** Active context is first-class.
1. `SourcesPane` wraps `IntelDesk` (pass through all existing props).
2. `ActiveContextBar` above the list: `{activeContextDocs.size} of {documents.length} grounding the AI` + animated coral dot; reads store live.
3. Tag-filter chips (All + distinct `file_type`/tags) filtering the list client-side.
**Acceptance:** toggling a source updates the bar count instantly; `activeContextDocs.size===0` shows "all sources". Mobile collapse intact.
**Commit:** `feat(warroom): promote active-context to a first-class Sources control`

### Phase 2 — ChatPane + Composer parity
**Goal:** Move chat into `ChatPane` with zero feature loss.
1. Port `PulseStudio` message render → `MessageList`; input → `Composer`.
2. Preserve `useStudioCommands` autocomplete, suggestion chips, agent selector, focus timer, pin-to-board, send + real-time dedup (NO full-list refetch).
**Acceptance:** send/receive works; slash `/summarize` etc. still inject prefixes; pin-to-board still broadcasts.
**Commit:** `feat(warroom): port chat canvas into Notebook ChatPane`

### Phase 3 — Citations inline (P0)  *(do Decision D2 first)*
**Goal:** Every grounded answer shows its sources.
1. Build `CitationChip` (`[n]`, coral) + `SourcesUsedPanel` ("SOURCES USED · N PASSAGES").
2. Render under AI messages from `AIMessage.citations`; click → `DocumentViewer` w/ `viewerHighlightText`.
3. Extend `ProvenanceTag` usage for the `GROUNDED · N SOURCES` chip.
**Acceptance:** grounded answer lists sources; click opens the right doc highlighted; ungrounded answer shows no panel.
**Commit:** `feat(warroom): inline citations + sources-used panel`

### Phase 4 — Reasoning trace (P1)
**Goal:** Tasteful "show your work."
1. `ReasoningTrace` collapsible (coral muted), reads `thinkingLogs[messageId]`, gated by `enableExtendedThinking`.
**Acceptance:** collapsed by default; expands to numbered steps; absent when no log.
**Commit:** `feat(warroom): reasoning-trace disclosure under AI answers`

### Phase 5 — StudioPane + GeneratorRail (P0)
**Goal:** Generators + advanced AI become visible; unify dispatch.
1. `StudioPane` right pane: `GeneratorRail` (Study Guide/FAQ/Timeline/Podcast + Comparative/Knowledge Graph) over ArtifactsSection (generated artifacts + `TheBoard`).
2. Rail cards call the store flags (`setShowStudyGuide`…, `setShowAdvancedAI`) → `WarRoomModalStack` renders.
3. **Wire the orphaned `showAdvancedAI` trigger.** **Remove `StudioLayout`'s local `activeGen` dispatch** so generators open one way only.
**Acceptance:** all 6 capabilities launch from the rail; AdvancedAI now reachable; no double-open.
**Commit:** `feat(warroom): visible Studio rail; unify generator dispatch`

### Phase 6 — Docked voice (P0)
**Goal:** Re-home voice into the workspace.
1. `DockedVoice` renders the canonical `VoiceAgentPanel`/`RealtimeVoiceAgent` **inline** in `ChatPane` (remove `position:fixed` floating shell at `WarRoomModalStack.tsx:295-338` for the flag-ON path).
2. Show shared `activeContextDocs`, live `rag_search` tool-call chips, transcript, coral visualizer (`audioData`/`visualizerType`). Fold `VoiceOverlay` into it.
**Acceptance:** voice connects; transcript + tool calls visible; grounded on same active context; only one voice UI exists.
**Commit:** `feat(warroom): dock the realtime voice agent into the chat pane`

### Phase 7 — Empty / cold-start state (P0)
**Goal:** The front door teaches the engine.
1. `EmptyState` for zero-doc and zero-message: drop-first-doc CTA, example prompts (`suggestions`), the slash commands as affordances, a one-line "what this can do".
2. Supersede `StudioOnboarding` overlay where redundant.
**Acceptance:** new workspace explains value + next step; no lone "Summarize this source".
**Commit:** `feat(warroom): teaching cold-start state`

### Phase 8 — Mobile / native parity
**Goal:** Capacitor keeps working.
1. Verify `useSwipeGesture` panel open/close, `<640px` auto-collapse, `isMobile` paths in `NotebookShell`.
**Acceptance:** panels collapse on small screens; swipe opens Sources/Studio; no layout break on native.
**Commit:** `fix(warroom): mobile/native parity for Notebook shell`

### Phase 9 — Housekeeping
**Goal:** Kill dead code (only after confirming unused).
1. Relocate `WarRoomMode`/`MissionType`/`RoomType` types out of `ModeSwitcher.tsx` (e.g. to `warRoom.types.ts`); update `warRoomStore.ts:7`; delete `ModeSwitcher.tsx`.
2. Remove dead flags `showMindMap`, `showChartGenerator`/`generatedChart`, `glitchTrigger`, `showWarRoomHub`, `showMissionLauncher` **if** grep confirms no consumer.
3. Resolve Decision D1 (ActivityFeed/SharedWithMe wire-or-cut).
**Acceptance:** `tsc` no new errors; no orphaned imports.
**Commit:** `refactor(warroom): relocate mode types, drop dead flags`

### Phase 10 — Flag flip + soak
Default `warRoomNotebook` **ON**; keep legacy `StudioLayout` path for one release.
**Commit:** `feat(warroom): default Notebook ON`

### Phase 11 — Legacy delete
After soak: remove the legacy `StudioLayout` branch + the now-unused dual-dispatch remnants; retire the flag.
**Commit:** `refactor(warroom): remove legacy StudioLayout path`

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `AIMessage.citations` lacks passage text → can't show excerpts | Med | High (P0 feature) | Decision D2: verify shape first; fall back to doc-name + click-to-open if no excerpt |
| Floating-voice removal breaks an entry point on mobile | Med | Med | Keep flag-OFF floating path; only re-home for flag-ON; test Capacitor (Phase 8) |
| Dual generator dispatch left half-migrated | Med | Med | Phase 5 explicitly removes `StudioLayout.activeGen`; single source = store flags |
| Coral budget creep on Studio chrome | Med | Low | §2 invariant 4; review before each commit; coral only on AI zones |
| Removing "dead" flags that have a hidden consumer | Low | Med | Phase 9 grep-confirms each flag before deletion |
| Real-time message race reintroduced | Low | High | Invariant 5: no full-list refetch on send |
| Type relocation from `ModeSwitcher` breaks store import | Low | Med | Move types + update `warRoomStore.ts:7` in same commit; `tsc` gate |
| `tsc` false-clean (OOM) masks new errors | Med | Med | `NODE_OPTIONS=--max-old-space-size=8192`; gate on no-NEW-errors |
| Presence renders hollow in single-user | High | Low | Hide presence unless >1 user (P3) |
| Parallel Claude session sweeps uncommitted notebook/ files | Low | High | `git add` folder in Phase 0; commit each phase |

---

## 8. Acceptance Criteria

**Behavioral**
- [ ] Toggling a source updates "N of M grounding" + the AI's context.
- [ ] Grounded answers show citations; click opens the source highlighted.
- [ ] All 6 generators + AdvancedAI launch from the Studio rail.
- [ ] Voice docks inline, shares active context, shows tool calls + transcript.
- [ ] Slash commands (all 8) + @agents still work.
- [ ] Cold-start state teaches the engine.

**Visual**
- [ ] Matches Path A mockup; consistent with Decisions/Email shipped language (mono labels, pills, containers, keycaps).
- [ ] Coral confined to AI surfaces (audit each pane).
- [ ] Light + dark both clean.

**Code health**
- [ ] `tsc` no NEW errors. No orphaned imports. One generator dispatch path. One voice UI.

**Performance / platform**
- [ ] No full-list refetch on send. Mobile/native panels + swipe intact.

---

## 9. Out of Scope (Deferred to v1.1)
1. Rich multiplayer (presence beyond avatar count; live cursors).
2. Mind Map & Chart generators (no component exists — flags removed, not built).
3. Annotations↔chat "cite-from-highlight → ask AI" (keep annotations as-is; deeper wiring later).
4. Missions (cross-surface via Decisions `CreateOverlay`) — untouched.
5. Lane consolidation vs Glimpse/Search (product decision, not this build — Decision D3).

## 10. Decisions Log / Decisions Needed

| ID | Decision | Status | Rationale / needed input |
|---|---|---|---|
| — | Path A (Notebook) over B/C | **Locked** | Lowest risk; current layout already 3-pane; maximizes generator discoverability |
| — | Flag `warRoomNotebook`, default OFF | Locked | Matches `emailHybrid`/`decisionsTriageCockpit` rollout pattern |
| — | One voice path (dock canonical) | Locked | Spec §7; duplicates already deleted (`4a2b104`) |
| **D1** | ActivityFeed + SharedWithMe: wire or cut? | **NEEDS USER** | Recommend **cut** for v1 (solo-first lane); re-wire when multiplayer ships |
| **D2** | Does `AIMessage.citations` carry passage text + location? | **VERIFY before Phase 3** | Determines whether SourcesUsedPanel shows excerpts or just doc-name+open. If absent, small `ragService` send-time change (flag as backend touch). |
| **D3** | War Room's one-sentence lane vs Glimpse/Search | Open (product) | Drives long-term IA; not blocking this build |

---

## Appendix A — File inventory & disposition
- **New:** `notebook/{NotebookShell,SourcesPane,ActiveContextBar,ChatPane,MessageList,CitationChip,SourcesUsedPanel,ReasoningTrace,DockedVoice,Composer,EmptyState,StudioPane,GeneratorRail}.tsx`
- **Reused (import):** IntelDesk, TheBoard, useBoardNotes, DocumentViewer, DocumentSearch, ContentGenerators/*, AdvancedAI/*, VoiceAgentPanel, RealtimeVoiceAgent, useStudioCommands, AgentSelector, MarkdownContent, artifactParser, ArtifactRenderers, ProvenanceTag(+), ActionPalette, WarRoomModalStack, useSwipeGesture, FocusTimer, VoiceSynthesis, VoiceSessionHistory, AudioAutoplayPrompt
- **Refactored:** StudioLayout (legacy path until Phase 11), WarRoomModalStack (voice un-float for flag-ON), warRoomStore (type import in Phase 9)
- **Deleted (Phase 9/11):** ModeSwitcher, dead flags, legacy StudioLayout branch
- **Decision-pending:** ActivityFeed, SharedWithMe

## Appendix B — Implementation reading order
1. This doc → §2 invariants, §4 matrix, §6 phases.
2. `docs/WAR_ROOM_REDESIGN_HANDOFF_2026-05-31.md` (what's real).
3. `_design-playground/warroom-redesign.html` (Path A).
4. `src/components/WarRoom/StudioLayout.tsx` (the bones you're evolving).
5. `src/components/LiveDashboard.tsx` (data layer + render branch point).
6. `src/store/warRoomStore.ts` (slices you must preserve).
7. `src/components/WarRoom/WarRoomModalStack.tsx` (modals + voice float to re-home).
8. `src/components/WarRoom/useStudioCommands.ts` + `PulseStudio.tsx` (chat behaviors to port).

---

*Self-contained. Hand to a builder agent. No code has been changed, no flag added, no scaffolding created by this doc — it is the plan, not the implementation.*
