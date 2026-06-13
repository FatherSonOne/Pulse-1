# Experimental Trio: Cut-or-Keep Decision (Summit, Map, War Room)

Date: 2026-06-13
Owner: solo (Pulse)
Status: decision-ready
Scope: the three surfaces in the Sidebar "Experimental" section, all gated behind `features.experimentalEnabled` (default OFF).

---

## TL;DR

Keep all three. Do not cut. The breadth-of-direction concern the critique raised is already solved by the single master switch, not by deletion.

- **War Room: KEEP-GATED, and it is the INVEST target.** Most launch-ready, clearest differentiator, real engine end to end.
- **Summit: KEEP-GATED as-is.** Complete voice surface with a real entitlement system; near-zero marginal maintenance.
- **Map: KEEP-GATED as-is.** ~85% real and load-bearing for other sections; finish autopilot/ETA later, not for v1.

Cutting any of the three deletes working code for a "focus" win that the gate already delivers. Per repo Rule A (no destructive change without an approved pros/cons) and Rule B (prove the gap before judging), the burden is on cutting, and the code does not justify it.

---

## The shared fact that reframes the whole question

All three surfaces live behind ONE runtime master switch, not three half-built flags:

- `experimentalEnabled` is defined in `src/contexts/FeatureContext.tsx:54` and defaults to `false` at `src/contexts/FeatureContext.tsx:119`.
- The Sidebar section is master-gated on it: `src/components/Sidebar/Sidebar.tsx` computes `sectionDisabled = section.label === 'Experimental' && !features.experimentalEnabled` (around line 400) and renders the items disabled/greyed when off.
- It is a real user-facing toggle, not a build constant: `src/components/settings/FeaturesLabsSettings.tsx:25-26` wires `active={features.experimentalEnabled}` / `onToggle={() => toggleFeature('experimentalEnabled')}`. Shipped in commit `ea04255` ("feat(experimental): Settings toggle to enable/disable the Experimental nav section"); the on-state note reads "features coming in v2.0" (`Sidebar.tsx:123`, commit `11d56ad`).

Consequence: a default v1 user never sees Summit, Map, or War Room. The "accumulated breadth" the critique flagged is already hidden by default. So the real question is not "show or delete" — it is "delete working code, or leave it gated for the curious / for v2." Deletion is the only option with downside.

All three route AI server-side (no client keys), consistent with the repo's "Gemini routing is server-side" rule: text via `ai-router` (`src/services/ai/aiService.ts:67`), voice via the `openai-realtime-token` edge function.

---

## Summit — KEEP-GATED

Routed at `AppView.LIVE` (`src/App.tsx:1426`, renders `<Summit>`). Lives in `src/components/Summit/`.

### Maturity: high (complete voice surface)
- `Summit.tsx` is 2,437 lines and is a full session UI: sessions canvas, transcript, artifact panel, end-session sheet, export service (`summitExportService.ts`), tool-call router (`toolCallRouter.ts`), artifact extractor.
- Voice runs on the shared GA realtime stack: Summit lazy-loads `RealtimeVoiceAgent` from War Room (`Summit.tsx:93-94`), which connects via `realtimeAgentService.ts` using `gpt-realtime` and the GA `/v1/realtime/calls` endpoint (`realtimeAgentService.ts:760-767`, with the explicit comment that `/v1/realtime?model=` is deprecated). Migration landed in commit `0a2b3d9`.
- No mock layer. The only `Math.random()` calls (`Summit.tsx:534`, `:590`) are local id generation, not fake data.

### Entitlement / gating: real, two layers
- Section gate: `experimentalEnabled` (above).
- Voice gate: `useSummitEntitlement` (`src/hooks/useSummitEntitlement.ts`) computes BYO-key vs hosted-tier vs trial, with caps. Summit reads `summitEnt.hasAccess` / `summitEnt.reason` and shows the correct deny copy: "Summit requires a Pulse Team or Growth plan..." (`Summit.tsx:308`) and the BYO-key escape hatch (`Summit.tsx:310`). BYO key always wins (`useSummitEntitlement.ts:9-11`). Shipped in commit `2f4991b`.

### Maintenance cost: low
Voice plumbing is shared with War Room (one `RealtimeVoiceAgent`, one `realtimeAgentService`). Maintaining War Room voice maintains Summit voice. The Summit-specific surface is stable (last touches were a mobile sheet fix `1bc29ff` and server-side routing `1264714`).

### Unique value: medium-high
A tier-gated, BYO-capable live voice session surface with artifact capture and archive export. It is the natural monetization hook for Team/Growth (the entitlement system is already built around that). Cutting it would also mean cutting a paid-tier story that is already coded.

### Verdict: KEEP-GATED. Defer any further investment until War Room voice stabilizes (shared stack means Summit rides along for free).

---

## Map — KEEP-GATED

Routed at `AppView.MAP` (`src/App.tsx:1465`, renders `<PulseMapView>`, lazy-loaded `App.tsx:31`). Lives in `src/components/map/`.

### Maturity: ~85% real, and load-bearing beyond its own section
`PulseMapView.tsx` is 899 lines (down from a god-component after the `7bff377` perf refactor), backed by 16 hooks under `map/hooks/` and a real overlay/sub layer. Confirmed-real pieces:
- **Geocoding**: `useContactGeocoding` + `geocode` services.
- **Clustering + spiderfy**: NOT the half-done refactor the old note implied. `useMarkerClusters` + `useSpiderAnimation` are fully wired into render with mode tagging (normal / cluster-member / spider-anchor / spider-leg) at `PulseMapView.tsx:236-256` and `:615-721`; cluster-click bbox-zoom at `:308-324`. The strangler refactor has effectively landed (commit `7bff377` "perf(map): React.memo markers + decouple cluster/spider").
- **Live broadcast**: `useLivePresence` + `LiveBroadcastSheet` + live-broadcaster pins (`PulseMapView.tsx:368`, `:804-825`).
- **AI route proposals (the "Autopilot" surface)**: REAL, not stubbed. `useMapAiProposals` + `AiStrip` drive `proposeRoute` / `proposeWeekPlan` / `proposeAtlasInsight` in `mapAIService.ts:132/211/272`, all funneling through `invokeAIJson` -> `ai-router` (`mapAIService.ts:10`, `:177/238/306`), with an AI-paused-until backoff for capacity (`mapAIService.ts:58-78`). The AiStrip even earns the coral-for-AI exception.
- **Geofencing**: the service has a real client-side enter/exit/approach state machine (`geofenceService.ts`) AND it is actually started on the live location tick: `locationService.ts:795-808` calls `startGeofenceDetection(userId)`, `initGeofenceNotifications()`, and runs `geofenceService.processPosition(...)` on every raw position. It is consumed in real surfaces (`DecisionDetail.tsx`, `MapContactPanel.tsx`, `PlacePicker.tsx`, `LocationEditModal.tsx`). What is explicitly deferred (by its own header comment, `geofenceService.ts:21-23`) is SERVER-side background detection — a v2 reliability iteration, not a missing feature.

### What is genuinely incomplete
- Deeper "autopilot" (auto-accept / auto-replan) beyond propose-and-accept.
- ETA-arrival alerting as a polished loop (the geofence approach band exists; the alerting UX is thin).
- The Sidebar comment (`Sidebar.tsx:126-130`) self-describes the section as "mid-refactor (cluster + spiderfy layer, autopilot stubs)" — that comment is now stale on the cluster/spiderfy half (done) and accurate only on the autopilot half.

### Maintenance cost: medium
Largest surface-area dependency (Google Maps loader, geocoding quota, 16 hooks). But much of it is cross-section infrastructure: per `Sidebar.tsx:126-128`, the map stack also drives calendar travel chips, today geo-clusters, war-room team radar, and decision/task geofences. Deleting "Map the section" would not delete "Map the engine" — the services stay, so you would pay the maintenance cost anyway while losing the only place that renders it.

### Unique value: high (spatial layer is a genuine differentiator)
A contacts/places/meetings spatial layer with live team presence and AI route planning is not a commodity comms feature.

### Verdict: KEEP-GATED. Do not invest for v1 (autopilot/ETA polish is real scope). Update the stale Sidebar comment so it stops overstating the unfinished part.

---

## War Room — KEEP-GATED (INVEST target)

Routed at `AppView.LIVE_AI` (`src/App.tsx:1515`, renders `<LiveDashboard>`, lazy-loaded `App.tsx:18`). Lives in `src/components/WarRoom/` + the `LiveDashboard.tsx` controller (1,857 lines).

### Maturity: high (a real NotebookLM-class engine, not a shell)
- **RAG is real**: `ragService.ingestTextDocument` chunks + generates embeddings and inserts into `doc_embeddings` (`ragService.ts:65,125-155`); `searchSimilar` retrieves; `LiveDashboard.sendMessageDirect` builds a cited, source-grounded prompt with active-context filtering, an Intel Mode strict-citation prompt, and inline citation records (`LiveDashboard.tsx:565-761`). Document upload runs through real processors (`processDocument`, PDF/DOCX/XLSX/image) at `:845-951`.
- **Generators + studio**: timeline, FAQ, study guide, podcast/audio-overview (`generateSpeech`), export to Archives + markdown/html/json (`:1107-1369`).
- **Voice**: GPT-Realtime via the same GA stack as Summit. `LiveDashboard` mints a hosted ephemeral token from `openai-realtime-token` with `model: 'gpt-realtime'` and workspace tier-gating (`LiveDashboard.tsx:162-163`), connecting through `RealtimeVoiceAgent` / `realtimeAgentService` GA endpoints.
- **Real-time collaboration**: presence + message sync + collaborative artifact pins via `warRoomRealtimeService` (`LiveDashboard.tsx:314-354`).

### Gating: section gate + an already-shipped redesign that defaults ON
- Section gate: `experimentalEnabled`.
- The "Notebook" redesign (Path A: Sources / Chat / Studio) is flag `warRoomNotebook`, and it is `enabled: true, rolloutPercentage: 100` (`src/lib/featureFlags.ts:236-242`). Read at `LiveDashboard.tsx:1379`; legacy `StudioLayout` kept one release as the `?ff_warRoomNotebook=off` rollback path (`featureFlags.ts:231-235`). The notebook surface is fully built out (`WarRoom/notebook/`: NotebookShell, ChatPane, SourcesPane, GeneratorRail, DockedVoice, CitationChip, ReasoningTrace, etc.).

### Maintenance cost: medium-high but mostly shared
Biggest single controller (`LiveDashboard.tsx` 1,857 lines, plus a large `WarRoom/` tree), but voice cost is shared with Summit, and the engine (ragService + warRoomStore) is independent of UI. The prior appraisal already trimmed 15 dead files (commit `4a2b104`).

### Unique value: highest of the three
A NotebookLM-class RAG workspace with citations, generators, and live voice, inside a comms hub, is the strongest "why Pulse is different" story. Prior appraisal verdict was KEEP+INVEST; the code confirms it.

### Verdict: KEEP-GATED, and this is where investment should go if any is spent. The redesign is essentially shipped (flag ON). Finishing work = Phase 11 cleanup (delete the legacy `StudioLayout` rollback branch after soak) and polish, not building.

---

## What "CUT" would actually entail (and why it is the wrong opening move)

For any of the three, "cut for v1" means one of:

1. **Hide-only**: leave the code, ensure the section stays OFF by default. This is already the state. Net work: zero. Net focus gain: already realized. (This is just "KEEP-GATED" with honest framing.)
2. **Remove the nav entry**: delete the item from `getNavSections` in `Sidebar.tsx:124-135`. Low effort, but the routing in `App.tsx` and the entire component tree remain, so it is cosmetic and risks orphaning command-palette entries (`App.tsx:273/279/280`) and deep-links (e.g. `AppView.CONTACT_MAP` redirects to `AppView.MAP`, `App.tsx:1481-1483`).
3. **Delete the surfaces**: remove `Summit/`, `WarRoom/` + `LiveDashboard.tsx`, `map/`. This is the destructive option. It would:
   - Break the shared voice stack relationship (Summit imports War Room's `RealtimeVoiceAgent`; deleting War Room breaks Summit unless you also re-home that file).
   - Strand cross-section consumers of the map engine (calendar travel chips, today clusters, geofence-on-decisions/tasks) — `geofenceService` is imported by `DecisionDetail.tsx`, `todayClusterService.ts`, `locationService.ts`, etc.
   - Discard a paid-tier entitlement system (Summit) and a NotebookLM-class engine (War Room) that are provably complete.
   - Violate repo Rule A: any removal of functional code requires a pre-approved, specific pros/cons and explicit go-ahead. "Fewer sections" is not a real gain here because the gate already hides them.

The honest pros of cutting (smaller bundle for the 3 lazy chunks; less code to maintain) are dwarfed by the cons (broken shared deps, lost differentiators, lost monetization surface, regression risk in still-live cross-section features). Additive-and-reversible (keep gated) beats subtractive-and-clever.

---

## How to sharpen the focus claim without destroying months of work

Reframe, do not amputate. The focus problem is a STORY problem, not a code problem, because the master switch already keeps a default user on the core lanes (Pulse DM, Relay, Glimpse, Meetings, Calendar, Contacts). To make the focus credible: keep all three behind `experimentalEnabled` (default OFF) exactly as today; rename the section honestly so it reads as a deliberate, opt-in "Labs" lane rather than scope creep — the "features coming in v2.0" note already does most of this work; update the stale `Sidebar.tsx:126-130` comment so it stops calling cluster/spiderfy "mid-refactor" (it shipped) and scopes the open work to autopilot/ETA only; and pick War Room as the single thing you finish (Phase 11 legacy-branch cleanup plus polish) so the narrative becomes "one differentiator in the oven, two mature surfaces resting in Labs," instead of "three unfinished experiments." That is a tighter, truthful focus claim that costs you a label change and a comment edit, not the deletion of working RAG, voice, and spatial engines.
