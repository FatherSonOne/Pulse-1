# Search Redesign — Implementation Handoff (Workbench)

**Date:** 2026-05-30
**Direction locked:** Path B · **Workbench** (facet cockpit + dense data table + working-set dock)
**Status:** Ready to implement
**Owner:** TBD — this doc is the handoff; hand it to a builder agent cold.

---

## 0. TL;DR

Refactor the Search section from a card-feed (`UnifiedSearchRedesign.tsx`,
1,385 LoC) into a **power-user data Workbench**: a left **facet cockpit**
(checkbox content-types with live counts, date facet, saved searches, AI
ranking), a center **dense results table** (columns: Type · Subject/preview ·
Person · When; grouped into date lanes; sortable; multi-select), and a right
**Working Set dock** (the existing clipboard, reframed). The card feed survives
as a secondary **Cards** view; **Map** survives as the geo-contextual view.

**Non-negotiable principle (CLAUDE.md §4 — coral budget):** coral is AI
output only. The single coral surface in this redesign is the **AI-ranking**
facet/active-state. The table, facets, chrome, selection, and dock stay
neutral (`--pulse-ink*`, `--pulse-border*`). No coral on row hover, selection,
headers, or the dock. A redesign that bleeds coral into chrome fails review.

**Rollout model:** new feature flag **`searchWorkbench`** (default **OFF**).
App.tsx routes `AppView.MULTI_MODAL` to the legacy `UnifiedSearchRedesign`
when OFF and to the new `SearchWorkbench` when ON. Flip ON after the soak in
the final phase; delete legacy one phase later. **No production behavior
changes until the flag flips.**

This redesign is a **presentation + IA rewrite, not a data rewrite.** Every
service, every backend source, every operator, and the entire search controller
logic are **ported verbatim**. Nothing in `src/services/*search*` or
`unifiedSearchService` changes.

---

## 1. Source of Truth

| Reference | Location |
|-----------|----------|
| Playground (chosen path) | `_design-playground/search-redesign.html` → **Path B · Workbench** |
| Verify script | `_design-playground/_verify-search.mjs` (screenshots `_shots/search-*.png`) |
| This handoff | `docs/SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md` |
| Design tokens (canonical) | `src/styles/pulse-tokens.css` — consume `var(--pulse-*)`, never redeclare |
| Coral budget rule | `CLAUDE.md` §4 |
| Branch discipline | `CLAUDE.md` §1 (commit each phase; work on `main`; no branch w/o ask) |
| Memory | `~/.claude/projects/f--pulse1/memory/project_pulse_search_redesign_direction.md` |
| Legacy orchestrator | `src/components/UnifiedSearchRedesign.tsx` (1,385 LoC) |
| Legacy styles | `src/components/UnifiedSearchRedesign.css` (2,469 LoC) |

---

## 2. Mental Model

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TOOLBAR: search input · view toggle [Table|Cards|Map] · filters · export   │
├────────────┬─────────────────────────────────────────────┬────────────────┤
│ FACET      │ RESULTS TABLE (center)                       │ WORKING SET    │
│ COCKPIT    │  meta: "N of M · K filters"   Sort[Recent|Rel]│ DOCK (right)   │
│ (left)     │  ┌── col header: Type Subject Person When ──┐ │                │
│            │  │ ▸ TODAY (3) ──────────────────────────── │ │ quick note +   │
│ ☑ Content  │  │ □ ✉ Q2 roadmap…  — Maria  2h ago         │ │ ┌────────────┐ │
│   type     │  │ □ 💬 Frank…      — Frank  5h ago         │ │ │ clipped #1 │ │
│   (counts) │  │ ▸ YESTERDAY (3) ──────────────────────── │ │ │ clipped #2 │ │
│ ☐ Date     │  │ □ ✓ Send contract — Theo  Yesterday      │ │ └────────────┘ │
│ ✱ AI rank  │  └──────────────────────────────────────────┘ │ [Export set]   │
│ ★ Saved    │  [batch toolbar slides up when rows selected]│                │
└────────────┴─────────────────────────────────────────────┴────────────────┘
```

**Invariants the implementation MUST hold:**

1. **Coral = AI only.** Only `AI ranking` facet (and its ON badge) may use
   `--pulse-rose`/`--pulse-rose-soft`. Everything else neutral. (CLAUDE.md §4)
2. **Same data, new skin.** The search controller (debounce, `performSearch`,
   geo parse, partial-result streaming, AI rerank, analytics) is ported
   verbatim. No service signatures change.
3. **Nothing dropped.** Every feature in §4's matrix has a disposition. Map
   (geo), Cards (the old feed), inline peek, detail panel, clipboard, working
   memory, all 4 export/operator/keyboard surfaces survive.
4. **Flag-gated.** Legacy renders until `searchWorkbench` is ON. Both code
   paths compile and pass type-check throughout.
5. **Keyboard parity.** Table rows keep `role`, `tabIndex={0}`, and
   `data-result-id` so the ported results-keydown handler (↑↓→← Enter Esc)
   works unchanged.

---

## 3. Current State — Architecture Audit Summary

| Concern | File | LoC | One-line |
|---------|------|-----|----------|
| Orchestrator | `UnifiedSearchRedesign.tsx` | 1,385 | 3-col grid; owns ALL state + the search controller |
| Styles | `UnifiedSearchRedesign.css` | 2,469 | every class for the section |
| Result card | `SearchResultCard.tsx` | 117 | `React.memo`; select btn, badge, snippet, inline peek |
| Detail panel | `SearchDetailPanel.tsx` | 187 | slide-out; Clip/Copy/Go-to/Open; per-type meta; tags |
| Map view | `SearchMapView.tsx` | 189 | Google Maps; rose pins; distance tooltips |
| Operator popover | `OperatorReferencePopover.tsx` | 108 | operator table + keyboard map; click-to-insert |
| Save modal | `SaveSearchModal.tsx` | 157 | name + alerts (instant/daily/weekly) |
| Skeleton | `SearchResultSkeleton.tsx` | 29 | loading placeholders |
| **Services** | | | |
| Unified search | `unifiedSearchService.ts` | 845 | parallel search across **12 sources**; 30s cache; 8s/source timeout; progressive `onSourceComplete` |
| Enhancements | `searchEnhancements.ts` | 422 | suggestions, `enhancedSearch`, `semanticSearch` (Gemini via `gemini-proxy`), history |
| Clipboard | `searchClipboardService.ts` | 235 | CRUD + `clipSearchResult` over `search_clipboard` |
| Saved searches | `savedSearches.ts` | — | CRUD over `saved_searches` (+ alertFrequency) |
| Voice | `voiceSearch.ts` | — | SpeechRecognition wrapper |
| Export | `searchExport.ts` | — | CSV / PDF(print) / Markdown |
| Analytics | `searchAnalyticsService.ts` | — | localStorage telemetry (trackSearch/trackClick) |
| Geo parse | `geoSearchParser.ts` | — | `near me` / `near <place>` / `within N mi` |
| Spatial | `spatialSearchService.ts` | — | geocode + Haversine over `entity_places`/`places` (contact/task/event only) |
| Query parse | `searchQueryParser.ts` | — | operator grammar (`from: to: subject: after: before: is: has: label: -` …) |
| Routing | `App.tsx` | — | `AppView.MULTI_MODAL` → lazy `UnifiedSearchRedesign`, line ~950 |

**Backend sources queried (12):** `unified_messages`, `messages`, `emails`,
Gmail API, `voxer_recordings`, `tasks`, `calendar_events`, `threads`,
`contacts`, `sms_messages`, `logos_notes`, `archives`.

**SearchResultType (11):** `message · email · vox · note · task · event ·
thread · contact · sms · unified_message · archive`.

**localStorage keys:** `pulse:search:viewMode`, `pulse:search:useAI`,
`pulse:search:analytics:{userId}:{queries|clicks}`.

**Window events:** IN — `pulse:set-search-query`, `pulse:focus-search`;
OUT — `pulse:navigate` (from detail panel "Go to [Type]").

---

## 4. Feature Disposition Matrix  ← CORE OF THIS DOC

Disposition key: **Preserved** (verbatim) · **Moved** (kept, new
location/affordance) · **Deferred (v1.1)** · **Removed (rationale)**.

### 4.1 Toolbar / search input

| Feature | Current location | New location | Disposition | Notes |
|---|---|---|---|---|
| Search input + 300ms debounce | hero bar, center | toolbar (top strip, full-width) | **Moved** | Port `searchQuery`/`debouncedSearchQuery`. No longer a "hero"; it's a compact toolbar field. |
| Placeholder copy | "Search everything — messages, tasks, contacts, decisions…" | same | **Preserved** | |
| Clear (X) button | input right | toolbar field right | **Preserved** | |
| Voice search (Mic) | input right | toolbar field right | **Preserved** | `voiceSearchService`; `isListening` state + indicator. |
| Operator popover trigger (⌘ icon / `?`) | input right | toolbar | **Preserved** | `OperatorReferencePopover` reused verbatim. |
| Save search (Bookmark) | header controls | toolbar | **Preserved** | opens `SaveSearchModal`; disabled when query empty. |
| Export dropdown (CSV/MD/PDF) | header controls | toolbar | **Preserved** | `searchExport`; outside-click close effect ported. |
| Filters toggle (show/hide left) | header controls | toolbar | **Moved** | toggles facet cockpit; `showFilters`. |
| Clipboard toggle (show/hide right) | header controls | toolbar | **Moved** | toggles Working Set dock; `showClipboard`. |
| Heartbeat focus animation | input wrapper | — | **Removed** | rationale: launcher-flourish that doesn't fit a dense workbench; drop `searchBarHeartbeat` + keyframes. Pure cosmetic; no behavior lost. |

### 4.2 View modes

| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| Timeline (date buckets) | view toggle, **default** | **Table** view, grouped by **date lanes** (Today/Yesterday/This Week/This Month/Older) | **Moved** | `groupResultsByDate()` ported as the table's lane grouper. Timeline's date headers become lane separators. **Table is the new default.** |
| List (flat / conversation) | view toggle | **Table** with **Group** control: Date · Conversation · None | **Moved** | The table's "Group: None" = old flat List. Conversation grouping = ported `groupedResults` memo (`groupMode==='conversation'`). |
| Grid (cards) | view toggle | **Cards** view (secondary toggle) | **Moved** | Reuse `SearchResultCard` verbatim for Cards. Preserves card rendering + inline peek. |
| Map (geo-contextual) | view toggle (appears w/ geo filter) | **Map** view toggle (same contextual rule) | **Preserved** | `SearchMapView` reused verbatim; still auto-appears only when `activeGeoFilter`; still falls back to Table (was Timeline) when geo clears. |
| Group-by control (None/Conversation) | meta row (list/grid only) | table meta row → Date/Conversation/None | **Moved** | extend `GroupMode` to `'date' \| 'conversation' \| 'none'`. |
| `pulse:search:viewMode` persistence | localStorage | same (values: `table\|cards\|map`) | **Moved** | migrate old values: `timeline\|list` → `table`, `grid` → `cards`, `map` → `map` on read. |

> **Net view set: `Table` (default) · `Cards` · `Map`.** Timeline + List
> collapse into Table's grouping control; Grid → Cards. No capability lost.

### 4.3 Results table (NEW center surface)

| Feature | Disposition | Notes |
|---|---|---|
| Dense row: Type tag · Subject + inline preview · Person (avatar+name) · When | **New (UI)** | New `ResultRow.tsx`. Backed by existing `SearchResult` fields (`type`, `title`, `content`, `sender`, `timestamp`). |
| Column header row (sticky) | **New (UI)** | Type · Subject/preview · Person · When. |
| Date lanes (sticky lane headers w/ count) | **Moved** | from Timeline. |
| **Sort control: Recent / Relevance** | **New (UI), existing backing** | Currently NO user-facing sort. Wire to `SearchSortOptions` which `unifiedSearchService.search()` already accepts (`field: 'timestamp'\|'relevance'`, `order`). Recent = `timestamp desc`; Relevance = `relevance desc`. |
| Row multi-select checkbox | **Preserved** | `selectedResults: Set<string>`; ported. |
| Row click → detail panel | **Preserved** | `setDetailResult`. |
| Row keyboard (↑↓ nav, → peek, ← collapse, Enter open, Esc) | **Preserved** | Port `handleResultsKeyDown`. **Rows MUST keep `role="article"`, `tabIndex={0}`, `data-result-id`** so the handler works unchanged. Inline peek = expand the row (port `expandedResultId`). |
| Result count meta ("N of M results · K filters") | **Preserved** | ported from `results-meta-row`. |
| Infinite scroll (20/batch, IntersectionObserver) | **Preserved** | port `visibleCount` + `sentinelRef` effect. |
| Skeleton while loading | **Preserved** | `SearchResultSkeleton` reused (restyle to table-row skeleton in CSS only). |

### 4.4 Cards view (secondary)

| Feature | Disposition | Notes |
|---|---|---|
| `SearchResultCard` (select, badge, snippet, inline peek, sender/channel meta, Enter→detail) | **Preserved** | reused verbatim for Cards view. Conversation/date grouping headers apply here too. |

### 4.5 Facet cockpit (left — strengthened)

| Feature | Current | New | Disposition | Notes |
|---|---|---|---|---|
| Content-type facets (8) w/ live counts | toggle buttons | **checkbox** rows w/ counts | **Moved** | same `selectedTypes` Set + `facetCounts` memo + `toggleTypeFilter`. Restyle button→checkbox; hide zero-count when results present (keep current rule). |
| "Clear filters" | sidebar | facet header action | **Preserved** | |
| AI ranking toggle | Intelligence group | facet block (the **only coral** surface) | **Preserved** | `useAISearch` + `pulse:search:useAI`; coral ON badge. |
| `from:` operator button | Operators group | facet block | **Preserved** | sets `from:`, opens contact autocomplete (`/^from:/i` effect). |
| `after:` / `before:` inline date popovers | Operators group | facet block | **Preserved** | port `openOperator` + `operatorPopoverRef` outside-click effect. |
| Saved searches list (≤6) | sidebar group | facet block | **Preserved** | run on click (sets query+filters); alert bell indicator; delete w/ 6s **Undo toast** (port the snapshot/restore toast verbatim). |
| **Date facet (Today / This week / This month / Custom…)** | — | facet block | **New (UI), existing backing** | New affordance. Sets `filters.dateFrom`/`filters.dateTo` (already in `SearchFilters`). Custom = date range. Complements (does not replace) `after:`/`before:` operators. |

### 4.6 Working Set dock (right — reframed clipboard)

> The right rail is renamed **"Working Set"** but is backed by the **same**
> `searchClipboardService` + `search_clipboard` table. Behavior preserved;
> framing shifts from "clipboard" to "the set you're assembling."

| Feature | Disposition | Notes |
|---|---|---|
| Quick note input (Enter to save) | **Preserved** | `quickNoteText` + `handleQuickNote`. |
| Clipped item cards (title, preview, meta, category tag) | **Preserved** | `clipboardItems`. |
| Pin / unpin | **Preserved** | `updateClipboardItem({pinned})`. |
| Delete item | **Preserved** | `deleteClipboardItem`. |
| View toggle (notes ↔ categories) | **Preserved** | `clipboardView`; keep Folder/StickyNote toggle. |
| Expand / collapse (420px ↔ 250px) | **Preserved** | `clipboardExpanded`. |
| Count badge | **Preserved** | |
| Export set (CSV of the dock) | **Moved** | reuse `searchExport.exportToCSV` over working-set items; surfaced as dock footer button. |

### 4.7 Empty state (working memory) — center, when query empty

| Block | Disposition | Notes |
|---|---|---|
| Resume (recent + saved, keyboard 1–5) | **Preserved** | render in table area when `isEmptyState`. Port `resumeRef` sync + digit-key handler. |
| Recent threads (cross-source roll-up → `from:` query) | **Preserved** | `dataService.getRecentThreads(8)`. |
| Pinned (≤6 clipboard pins) | **Preserved** | |
| Browse by type (6 chips) | **Preserved** | sets type filter + `type:X` query. |
| First-run onboarding (4 example chips) | **Preserved** | shown when all other blocks empty. |

### 4.8 Result detail panel

| Feature | Disposition | Notes |
|---|---|---|
| `SearchDetailPanel` (Clip / Copy text / Go-to-source / Open; per-type meta; relevance %; tags; Esc-close) | **Preserved** | reused verbatim. Opens from table row or card. "Go to [Type]" still dispatches `pulse:navigate` per `TYPE_TO_VIEW`. |

### 4.9 Batch actions

| Feature | Disposition | Notes |
|---|---|---|
| Batch toolbar (N selected · Select all · Clip all · Export CSV · Clear) | **Preserved** | slides up on selection. Port `handleBatchClip` (with **6s Undo toast** rolling back inserted ids), `handleBatchExport`. |

### 4.10 Operators & query grammar

| Feature | Disposition | Notes |
|---|---|---|
| Operator grammar (`from: to: subject: body: has: filename: larger: smaller: after: before: is: label: category: cc: bcc: in: deliveredto: -`) | **Preserved** | `searchQueryParser` untouched. |
| Geo modifiers (`near me`, `near <place>`, `within N mi [of <place>]`) | **Preserved** | `geoSearchParser` + `spatialSearchService` untouched; geo chip + error bar ported. |
| Operator reference popover (table + keyboard map, click-to-insert) | **Preserved** | `OperatorReferencePopover` reused. |
| Operator autocomplete dropdown (`from:` contacts, `after:`/`before:` date hints) | **Preserved** | port `operatorHints` state + effects + input keydown nav. |
| Suggestions dropdown (on focus) | **Preserved** | `searchEnhancements.getSuggestions`. |

### 4.11 AI / intelligence

| Feature | Disposition | Notes |
|---|---|---|
| AI ranking (Gemini rerank via `gemini-proxy`) | **Preserved** | `searchEnhancements.semanticSearch`; toggle is the coral surface. |
| Voice search | **Preserved** | |
| Analytics (trackSearch / trackClick) | **Preserved** | keep both call sites (after search; on result click). |

### 4.12 System states

| Feature | Disposition | Notes |
|---|---|---|
| Source-error badges ("⚠ Gmail disconnected") | **Preserved** | `searchErrors`. |
| No-results empty state ("Nothing found for …") | **Preserved** | |
| Geo filter chip + geo error bar | **Preserved** | |
| ARIA live region (result count announcements) | **Preserved** | keep `role="status" aria-live="polite"`. |

### 4.13 Decisions needed (surface to user before/if contested)

1. **Heartbeat animation removal** — proposed Removed (§4.1). If the user
   wants a focus flourish kept, re-add as a subtle neutral ring (NOT coral).
2. **Grid → Cards rename** — proposed. If "Grid" as a multi-column card wall
   is valued distinctly from a single-column Cards list, keep both as
   `Cards` + `Grid`. Default assumption: one `Cards` view suffices.
3. **Date facet vs operators** — the new Date facet and `after:`/`before:`
   operators both set `dateFrom`/`dateTo`. They must stay in sync (facet
   selection should reflect in the query/filters and vice-versa) — see
   Risk R7.

---

## 5. New Architecture

### 5.1 Component tree (new home: `src/components/search/`)

```
src/components/search/
  SearchWorkbench.tsx        ← orchestrator (flag-ON entry). Thin: owns layout,
                                consumes useUnifiedSearch(), wires sub-components.
  useUnifiedSearch.ts        ← controller hook. ALL search state + effects ported
                                from UnifiedSearchRedesign (query/debounce,
                                performSearch, geo, partial stream, filters,
                                selectedTypes, sort, analytics, saved/clipboard
                                loaders, keyboard data refs).
  SearchToolbar.tsx          ← search input + view toggle + filter/clipboard/save/export
  FacetCockpit.tsx           ← left: content-type checkboxes, date facet, AI rank,
                                operators (from/after/before), saved searches
  ResultsTable.tsx           ← center table: col header, date/conversation lanes,
                                sort control, count meta, infinite scroll
  ResultRow.tsx              ← one table row (role=article, tabIndex, data-result-id,
                                inline peek). Keyboard-handler compatible.
  ResultsCards.tsx           ← Cards view wrapper around SearchResultCard
  WorkingMemory.tsx          ← empty-state blocks (Resume/Threads/Pinned/Browse/Onboard)
  WorkingSetDock.tsx         ← right: quick note + clipped items + export set
  search-workbench.css       ← NEW stylesheet (do NOT touch legacy .css)

REUSED VERBATIM (no changes):
  src/components/SearchResultCard.tsx        (Cards view)
  src/components/SearchDetailPanel.tsx
  src/components/SearchMapView.tsx
  src/components/OperatorReferencePopover.tsx
  src/components/SaveSearchModal.tsx
  src/components/SearchResultSkeleton.tsx
  src/services/*  (ALL search services unchanged)
```

### 5.2 State management

- Extract the entire controller from `UnifiedSearchRedesign.tsx` into
  **`useUnifiedSearch()`** — a hook returning `{ query, setQuery, results,
  loading, filters, selectedTypes, sort, setSort, viewMode, setViewMode,
  groupMode, setGroupMode, selectedResults, … + all handlers }`. This is a
  **lift-and-shift**, not a rewrite: copy the effects/callbacks 1:1, change
  only where they read/write local state vs returned API.
- `SearchWorkbench.tsx` becomes presentational: calls the hook, passes slices
  to `FacetCockpit` / `ResultsTable` / `WorkingSetDock` / `WorkingMemory`.
- Add `sort: SearchSortOptions` to the hook state (NEW); thread into
  `enhancedSearch`/`search` calls. Default `{ field: 'timestamp', order: 'desc' }`.

### 5.3 Reader/expansion mechanics

- **Inline peek** = row expands in place (port `expandedResultId`; `→` expand,
  `←`/`Esc` collapse). **Detail panel** = `SearchDetailPanel` slide-out on
  Enter/click. Both preserved exactly as today.

### 5.4 Sub-surface / grouping handling

- `GroupMode = 'date' | 'conversation' | 'none'`.
  - `date` → `groupResultsByDate()` lanes (default).
  - `conversation` → ported `groupedResults` memo.
  - `none` → flat.
- Map view ignores grouping (as today). Cards view honors grouping headers.

---

## 6. Implementation Phases

Each phase is independently mergeable, committed separately (CLAUDE.md §1, §3),
conventional-commit scope `search`. Type-check gate = **no NEW errors** vs the
~1,234 pre-existing baseline (use `NODE_OPTIONS=--max-old-space-size=8192 npx
tsc --noEmit`; vite skips type-check). Both flag paths must compile every phase.

### Phase 0 — Scaffold + flag (no UI yet)
**Goal:** flag wired, folder + empty components exist, legacy untouched.
1. Add `searchWorkbench: false` to `src/lib/featureFlags.ts` (default OFF).
2. Create `src/components/search/` with stub files (each renders `null` or a
   placeholder) + empty `search-workbench.css`.
3. In `App.tsx` `AppView.MULTI_MODAL` case: `featureFlags.searchWorkbench ?
   <SearchWorkbench isDarkMode={isDarkMode}/> : <UnifiedSearchRedesign …/>`
   (lazy-import both).
4. **Commit the new folder immediately** (CLAUDE.md §1 — untracked files vanish).
- **Accept:** app builds; flag OFF → legacy renders identically; flag ON →
  placeholder renders; `tsc` no new errors.
- **Commit:** `feat(search): scaffold Workbench folder + searchWorkbench flag (off)`

### Phase 1 — Extract `useUnifiedSearch` controller
**Goal:** the search brain lives in a hook, proven against legacy.
1. Copy all state + effects + handlers from `UnifiedSearchRedesign.tsx` into
   `useUnifiedSearch.ts`; return them.
2. Add `sort` state + `SearchSortOptions` threading into `enhancedSearch`.
3. (Optional safety) temporarily have legacy consume the hook to prove parity,
   OR keep legacy as-is and only the new tree consumes it.
- **Accept:** hook compiles; a throwaway smoke (`SearchWorkbench` logs results)
  returns the same result set as legacy for `from:maria`.
- **Commit:** `refactor(search): extract useUnifiedSearch controller hook`

### Phase 2 — Toolbar + shell layout
**Goal:** flag-ON renders the 3-col shell + working toolbar.
1. `SearchWorkbench.tsx` 3-col grid (reuse grid-template approach from legacy
   body, neutral tokens). 2. `SearchToolbar.tsx`: input (debounce), clear,
   voice, operator popover, save, export dropdown, view toggle
   `[Table|Cards|Map]`, filter/clipboard toggles.
- **Accept:** flag ON shows toolbar; typing searches; voice/popover/export work;
  view toggle switches an empty center placeholder.
- **Commit:** `feat(search): Workbench shell + toolbar`

### Phase 3 — Facet cockpit
**Goal:** left rail fully functional.
1. Content-type **checkboxes** w/ live counts + clear. 2. AI-ranking facet
   (**only coral**). 3. `from:`/`after:`/`before:` operators w/ date popovers.
4. Saved searches list w/ alert bell + delete-Undo toast. 5. **NEW** Date facet
   (Today/This week/This month/Custom → `dateFrom`/`dateTo`).
- **Accept:** every facet drives the query/filters; coral appears ONLY on AI
  rank; saved-search delete shows Undo and restores.
- **Commit:** `feat(search): facet cockpit (types, date, AI rank, operators, saved)`

### Phase 4 — Results table + lanes + sort
**Goal:** the center workbench table.
1. `ResultsTable.tsx` col header + date lanes + conversation/none grouping +
   count meta + infinite scroll. 2. `ResultRow.tsx` (role/tabIndex/
   data-result-id, inline peek). 3. Sort control Recent/Relevance.
4. Skeleton + no-results + source-error badges + geo chip/error + ARIA live.
- **Accept:** rows render dense; ↑↓→← Enter Esc work; sort reorders; lanes
  group; infinite scroll loads; selection checkboxes work.
- **Commit:** `feat(search): dense results table with date lanes + sort`

### Phase 5 — Cards + Map views
1. `ResultsCards.tsx` wraps `SearchResultCard` (honor grouping). 2. Wire
   `SearchMapView` for Map (contextual appear w/ geo; fallback to Table).
- **Accept:** Cards view = legacy card feel; Map appears only w/ geo filter and
  falls back when cleared; `viewMode` persists (with migration mapping).
- **Commit:** `feat(search): Cards + Map views`

### Phase 6 — Working Set dock + batch toolbar
1. `WorkingSetDock.tsx` (quick note, items, pin, delete, view toggle, expand,
   count, **Export set**). 2. Batch toolbar (Select all/Clip all+Undo/Export/
   Clear).
- **Accept:** clip from detail panel lands in dock; batch clip shows Undo;
  pin/delete/expand work.
- **Commit:** `feat(search): Working Set dock + batch actions`

### Phase 7 — Working memory empty state
1. `WorkingMemory.tsx`: Resume (kbd 1–5), Recent threads, Pinned, Browse-by-
   type, first-run onboarding.
- **Accept:** empty query shows all applicable blocks; digit keys 1–5 run
  Resume rows; thread row sets `from:`.
- **Commit:** `feat(search): working-memory empty state`

### Phase 8 — Detail panel + global keyboard + window events
1. Mount `SearchDetailPanel`. 2. Port global keydown (`/`, `⌘K`, `?`, digits).
3. Port window-event listeners (`pulse:set-search-query`, `pulse:focus-search`).
- **Accept:** detail opens/closes; Go-to-source navigates; global shortcuts +
  external events drive the new tree.
- **Commit:** `feat(search): detail panel + global shortcuts + window events`

### Phase 9 — Styling pass + coral audit + a11y/reduced-motion
1. Finalize `search-workbench.css` against the playground (neutral chrome,
   density, dark+light). 2. **Coral audit:** grep the new CSS/TSX for
   `rose`/`coral`/`f43f5e`/`fb7185` — every hit must be AI-ranking. 3. Hover-
   lift on rows; `prefers-reduced-motion` guard.
- **Accept:** matches Path B screenshots dark+light; coral only on AI rank;
  reduced-motion disables transforms.
- **Commit:** `polish(search): Workbench styling + coral-budget audit`

### Phase 10 — Verify, flip flag ON
1. Headless verify (extend `_verify-search.mjs` pattern against the live app /
   a new `_verify-search-workbench.mjs`): zero console errors, screenshots.
2. Manual smoke: real query round-trips across sources; Map w/ a geo query;
   export; saved-search alert create.
3. Flip `searchWorkbench: true`.
- **Accept:** parity with legacy on a real account; no console errors; flag ON.
- **Commit:** `feat(search): enable searchWorkbench (flag on)`

### Phase 11 — Legacy cleanup (after soak)
1. Delete `UnifiedSearchRedesign.tsx` + `UnifiedSearchRedesign.css`; remove the
   flag branch + flag. Keep the 6 reused sub-components (still imported).
2. Verify no other importer of the deleted files (grep).
- **Accept:** legacy gone; `tsc` no new errors; section works flag-free.
- **Commit:** `refactor(search): remove legacy UnifiedSearchRedesign post-soak`

---

## 7. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Controller extraction subtly changes search behavior | Med | High | Lift-and-shift 1:1; parity-smoke `from:maria` vs legacy in Phase 1 before any UI. |
| R2 | Keyboard handler breaks because table rows lack `role`/`data-result-id` | Med | Med | Invariant #5; `ResultRow` MUST keep `role="article" tabIndex={0} data-result-id`. |
| R3 | Coral bleeds into chrome (selection/hover/headers) | Med | High (review fail) | Phase 9 coral grep audit; neutral tokens only outside AI rank. |
| R4 | `viewMode` localStorage holds old `timeline/list/grid` values | High | Low | Migration map on read (§4.2). |
| R5 | Map view regression (Google Maps lib load) | Low | Med | Reuse `SearchMapView` verbatim; don't refactor it. |
| R6 | Both flag paths must compile each phase; drift breaks build | Med | Med | Type-check gate every phase; keep legacy importing nothing new. |
| R7 | Date facet and `after:`/`before:` operators desync | Med | Med | Single source: facet writes `dateFrom`/`dateTo`; reflect active range back into the facet; document precedence (explicit operator wins). |
| R8 | Partial-result streaming flicker in dense table | Low | Med | Keep `searchGeneration` guard + geo "no partial while geo active" rule. |
| R9 | Undo toasts (saved-search delete, batch clip) lost in port | Med | Med | Port the toast JSX + snapshot/insertedIds logic verbatim (legacy lines ~577–626, ~775–823). |
| R10 | Infinite-scroll observer not re-created on results change | Low | Med | Port effect dep `[searchResults.length]`. |
| R11 | New `search/` folder untracked → lost (May 2026 incident) | Med | High | Phase 0 commits the folder immediately (CLAUDE.md §1). |
| R12 | Analytics call sites dropped | Low | Low | Keep `trackSearch` (post-search) + `trackClick` (result click). |
| R13 | `gemini-proxy` rerank path changes | Low | Med | `searchEnhancements` untouched; only the toggle moves. |
| R14 | Pre-existing `CockpitHub.tsx` uncommitted change in tree | — | Low | Not ours; do not stage. Commit only `search` paths explicitly. |
| R15 | tsc OOM gives false "clean" | Med | Med | Always `--max-old-space-size=8192`; gate on no-new-errors. |

---

## 8. Acceptance Criteria

**Behavioral**
- [ ] Flag OFF → legacy Search renders byte-identical to today.
- [ ] Flag ON → all §4 Preserved/Moved features work; nothing Removed beyond
      heartbeat (and whatever the user signs off in §4.13).
- [ ] All operators (incl. geo) parse and filter identically to legacy.
- [ ] Keyboard: `/ ⌘K ? 1–5` global; `↑↓→← Enter Esc` in rows; operator-hint
      nav; modal Enter/Esc; detail Esc.
- [ ] Saved-search + batch-clip **Undo** toasts work.
- [ ] Window events in/out work; "Go to [Type]" navigates.

**Visual**
- [ ] Matches Path B screenshots in `_shots/search-*.png`, dark + light.
- [ ] **Coral only on AI-ranking facet.** Grep of new CSS/TSX confirms it.
- [ ] Density: table rows readable at the playground row height; lanes clear.

**Code-health**
- [ ] `tsc --noEmit` (8GB heap): no NEW errors vs baseline.
- [ ] Services unchanged (git diff shows no `src/services/*search*` edits).
- [ ] New folder committed each phase; commits per CLAUDE.md style.

**Performance**
- [ ] Partial-result streaming has no flicker; `searchGeneration` guard intact.
- [ ] Infinite scroll loads in 20-batches; no layout thrash.
- [ ] `prefers-reduced-motion` disables transforms.

---

## 9. Out of Scope (Deferred to v1.1)

1. **Saved-views / column customization** (show/hide/reorder table columns).
2. **Persisting the Working Set across sessions as named "sets"** (today it's
   the flat clipboard; named-set grouping is a follow-up).
3. **Server-side sort/pagination** — sort stays client-side over the fetched
   page (as today); deep server sort is later.
4. **Categories view real population** in the dock (UI exists; data sparse —
   ship as-is, populate later).
5. **Alert delivery UI** (frequency is stored; surfacing alert results in-app
   is a separate feature).
6. **Multi-column Grid wall** if §4.13.2 lands as "Cards only" for v1.

---

## 10. Decisions Log

| Decision | Why |
|---|---|
| Table is the new default view | Workbench philosophy = density + scannability; Timeline's date grouping survives as table lanes. |
| Timeline + List collapse into Table's Group control | Two near-identical card layouts → one table with Date/Conversation/None grouping; no capability lost. |
| Grid → single "Cards" view | One card view covers the old Grid; preserves `SearchResultCard` + inline peek. (Revisit per §4.13.2.) |
| Clipboard → "Working Set" rename, same backing | Reframes the rail to match the workbench mental model without a data change. |
| New `sort` control (Recent/Relevance) | `SearchSortOptions` already accepted by the service but never surfaced; a workbench needs explicit sort. |
| New Date facet | A facet cockpit should offer date filtering without typing operators; backed by existing `dateFrom`/`dateTo`. |
| Heartbeat animation removed | Launcher flourish; clashes with dense workbench calm. Cosmetic only. |
| Flag-gated, legacy kept until soak | Big surface rewrite; zero production risk until flip; clean rollback. |
| Coral confined to AI ranking | CLAUDE.md §4; the only AI-output surface in this design. |
| New CSS file (not editing the 2,469-line legacy) | Clean separation; legacy deletable in one shot at Phase 11. |

---

## Appendix A — Full file inventory

**New (create):** `src/components/search/{SearchWorkbench.tsx,
useUnifiedSearch.ts, SearchToolbar.tsx, FacetCockpit.tsx, ResultsTable.tsx,
ResultRow.tsx, ResultsCards.tsx, WorkingMemory.tsx, WorkingSetDock.tsx,
search-workbench.css}` · `src/lib/featureFlags.ts` (+1 flag) ·
`_design-playground/_verify-search-workbench.mjs`.

**Reused verbatim (import, no edit):** `SearchResultCard.tsx`,
`SearchDetailPanel.tsx`, `SearchMapView.tsx`, `OperatorReferencePopover.tsx`,
`SaveSearchModal.tsx`, `SearchResultSkeleton.tsx`, all `src/services/*`.

**Edited:** `src/App.tsx` (flag branch in `AppView.MULTI_MODAL`).

**Deleted (Phase 11):** `UnifiedSearchRedesign.tsx`, `UnifiedSearchRedesign.css`.

**Do NOT touch:** `src/components/decisions/cockpit/CockpitHub.tsx` (pre-existing
uncommitted change, not ours — R14).

## Appendix B — Implementation reading order (builder agent)

1. This doc (§4 matrix + §6 phases).
2. `_design-playground/search-redesign.html` → Path B (the visual spec).
3. `src/components/UnifiedSearchRedesign.tsx` — the controller to extract
   (esp. `performSearch` ~389–459, `handleResultsKeyDown` ~651–672, global
   keydown ~334–377, batch/undo toasts ~577–626 & ~775–823, groupers ~126–150
   & ~266–279).
4. `src/services/unifiedSearchService.ts` — types (`SearchResult`,
   `SearchFilters`, `SearchSortOptions`, `SearchResultType`) + the 12 sources.
5. `src/services/searchEnhancements.ts` — `enhancedSearch` / `semanticSearch`.
6. The 6 reused sub-components (to confirm props).
7. `CLAUDE.md` §1 (commit discipline) + §4 (coral budget).
8. `src/styles/pulse-tokens.css` — the only color source.

---

**Status: handoff complete. No code written, no flag added, no scaffolding —
this document is the deliverable.**
