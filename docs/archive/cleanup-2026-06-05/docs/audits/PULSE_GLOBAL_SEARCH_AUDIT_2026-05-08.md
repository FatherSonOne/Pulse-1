# Pulse Global Search — Full Section Audit

**Date:** 2026-05-08
**Auditor:** Claude (Opus 4.7)
**Scope:** All "global" search surfaces in Pulse — the Dashboard `Search the web` widget (the screenshot the user shared), the dedicated `/search` section (`UnifiedSearchRedesign`), and the supporting service layer.
**Branch state:** `main` (clean for search files; modifications elsewhere)

---

## 0. TL;DR

Pulse has **two unrelated "global" search surfaces** that share zero code:

1. **Dashboard "Search the web"** — a single-input AI Q&A bar that calls Gemini grounded search and renders one markdown answer. ~70 LOC inline in Dashboard.
2. **`/search` (UnifiedSearchRedesign)** — a 3-pane "search workspace" with 12 source adapters, AI rerank, web answer, geo modifier, clipboard, saved searches, alerts, voice, export, and a map view. ~8.8K LOC across 21 files.

The `/search` surface is **mostly working** but riddled with placebo controls, dead telemetry, broken type contracts, and a hard navigation conflict with the Dashboard. The Dashboard search is **functionally a duplicate of `/search`'s "Web search" toggle** — you can search the web from either surface using the same backend (`web_search` task in ai-router) but with totally different UI, totally different result rendering, and no shared history.

**The single biggest finding:** the segmented `Fast / Pro / Reasoning` control inside `/search → Intelligence → Web search` is a **placebo**. The component sets state, the state is passed to `sonarWebSearch`, and the service immediately discards it (`void options;`). Users think they're paying for sonar-pro/sonar-reasoning; they always get the default `web_search` task.

---

## 1. Files in Scope

| File | LOC | Role |
|---|---:|---|
| **Entry surfaces** | | |
| `src/components/Dashboard.tsx` (search slice ~lines 367–1469, 1030–1044) | ~70 | "Search the web" widget — the screenshot |
| `src/components/UnifiedSearchRedesign.tsx` | 1417 | The `/search` section — 3-pane workspace |
| `src/components/UnifiedSearchRedesign.css` | 2664 | Tokenized CSS (own token namespace `--search-*`) |
| `src/App.tsx` (lines 313–329, 584–598, 789–791) | ~30 | `MULTI_MODAL` route, `pulse:focus-search` / `pulse:set-search-query` listeners, Cmd+K |
| `src/hooks/useRoutePreload.ts` (line 33) | 1 | Preloads UnifiedSearchRedesign on `/search` |
| `src/components/Sidebar/Sidebar.tsx` (line 105) | 1 | Sidebar "Search" → AppView.MULTI_MODAL |
| **Sub-components** | | |
| `src/components/SearchResultCard.tsx` | 116 | Memoized result card |
| `src/components/SearchResultSkeleton.tsx` | 28 | Loading placeholder |
| `src/components/SearchDetailPanel.tsx` | 186 | Right-rail result detail drawer |
| `src/components/SearchMapView.tsx` | 188 | Google Maps view for geo-filtered results |
| `src/components/SaveSearchModal.tsx` | 156 | "Save search" + alert toggle |
| `src/components/OperatorReferencePopover.tsx` | 108 | `?`-key operator + shortcut reference |
| **Services** | | |
| `src/services/unifiedSearchService.ts` | 845 | 12-source fan-out, dedup, rank |
| `src/services/searchEnhancements.ts` | 492 | Suggestions + AI rerank + Sonar wrapper |
| `src/services/savedSearches.ts` | 131 | CRUD for `saved_searches` |
| `src/services/searchClipboardService.ts` | 235 | CRUD for `search_clipboard` |
| `src/services/searchExport.ts` | 136 | CSV/PDF/Markdown |
| `src/services/searchAnalyticsService.ts` | 171 | LocalStorage telemetry (writes only) |
| `src/services/searchQueryParser.ts` | 519 | Gmail-operator parser |
| `src/services/voiceSearch.ts` | 86 | Web Speech API wrapper |
| `src/services/geoSearchParser.ts` | 134 | "near me / within N mi" parser |
| `src/services/spatialSearchService.ts` | 130 | `entity_places` join + Haversine |
| `src/services/searchService.ts` | 238 | **Older, only used in messages thread search; not part of global surface** |
| `src/services/searchAI.ts` | 172 | **Dead — referenced nowhere** |
| `src/services/contactSearchAIService.ts` | 230 | Used only in `AIContactSearch.tsx` (Contacts NL search) |
| `src/services/emailSearchService.ts` | 521 | Used only in `PulseEmailClientRedesign.tsx` |
| **Backend** | | |
| `supabase/functions/check-search-alerts/index.ts` | ? | Cron-only Resend email job for `saved_searches.alert_enabled` |
| `supabase/migrations/20260119062007_remote_schema.sql` | (relevant slices) | Tables: `saved_searches`, `search_clipboard`, `search_history`, `search_index` (orphan) |
| **Tests** | | |
| `src/services/__tests__/SearchQueryParser.test.ts` | 75 | Operator parser only |

**Total live code in this section: ≈ 8,800 LOC + ~70 LOC in Dashboard.**

---

## 2. Architecture Map

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           USER ENTRY POINTS                                    │
└────────────────────────────────────────────────────────────────────────────────┘
                                           │
        ┌──────────────────────────────────┴──────────────────────────────────┐
        │                                                                     │
   ┌────▼──────────────────────────┐                          ┌───────────────▼──────────────┐
   │  Dashboard.tsx                │                          │  Sidebar → "Search"          │
   │  ─────────────                │                          │  Cmd+K (App.tsx)             │
   │  "Search the web" widget      │                          │  voice cmd "search …"        │
   │  (the screenshot the user     │                          │  pulse:focus-search event    │
   │   shared)                     │                          └──────────────┬───────────────┘
   │                               │                                         │
   │  ◀─ Gemini web_search task ─▶│                                         ▼
   │  Renders: <ReactMarkdown>     │              ┌──────────────────────────────────────────┐
   │  + 3 source links             │              │      AppView.MULTI_MODAL                 │
   │                               │              │      ↓ React.lazy                        │
   │  Pure isolated UI — does NOT  │              │      <UnifiedSearchRedesign />           │
   │  share history / state with   │              └──────────────────────────────────────────┘
   │  /search                      │                                         │
   └───────────────────────────────┘                                         │
                                                                             ▼

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                       UnifiedSearchRedesign (1417 LOC)                                  │
│                                                                                         │
│  HEADER: view-mode strip (timeline/list/grid/map) · filters/clipboard toggles · save /  │
│          export                                                                         │
│                                                                                         │
│  ┌────────────────┐ ┌──────────────────────────────────┐ ┌────────────────────────────┐ │
│  │ LEFT (sidebar) │ │ CENTER (main)                    │ │ RIGHT (clipboard)          │ │
│  │                │ │                                  │ │                            │ │
│  │ Saved searches │ │ Hero search input                │ │ Quick note input           │ │
│  │ Content type   │ │ + voice / web / cmd buttons      │ │ Clipboard items            │ │
│  │  facets        │ │ + suggestions dropdown           │ │ Pin / delete                │ │
│  │ Intelligence   │ │ + operator hints                 │ │ Empty state                │ │
│  │  - AI rerank   │ │ + ? operator popover             │ │                            │ │
│  │  - Web search  │ │                                  │ │                            │ │
│  │  - Fast/Pro/   │ │ Empty state: "Resume" + recent   │ │                            │ │
│  │     Reasoning  │ │   threads + pinned + browse +    │ │                            │ │
│  │   ⚠ PLACEBO    │ │   onboard                        │ │                            │ │
│  │ Operators      │ │                                  │ │                            │ │
│  │  - from:       │ │ AI Web answer card               │ │                            │ │
│  │  - after:/     │ │ Source-error badges              │ │                            │ │
│  │     before:    │ │ Geo filter chip                  │ │                            │ │
│  │   (date popov.)│ │ Result count + group-by          │ │                            │ │
│  │                │ │ Batch toolbar                    │ │                            │ │
│  │                │ │                                  │ │                            │ │
│  │                │ │ Results feed                     │ │                            │ │
│  │                │ │  (timeline / list / grid / map)  │ │                            │ │
│  └────────────────┘ └──────────────────┬───────────────┘ └────────────────────────────┘ │
│                                        │                                                │
│                          opens ▼                                                        │
│                       SearchDetailPanel (right slide-in)                                │
│                                                                                         │
└─────────────────────────────────────────┬───────────────────────────────────────────────┘
                                          │
                       ┌──────────────────┴───────────────────┐
                       │                                      │
                       ▼                                      ▼
            ┌───────────────────────┐            ┌───────────────────────┐
            │ searchEnhancements    │            │ Side concerns:        │
            │ ─────────────────────  │            │ - voiceSearch         │
            │  enhancedSearch():     │            │ - searchExport        │
            │   1. parseToFlat-      │            │ - searchClipboard     │
            │      Operators()       │            │ - savedSearches       │
            │   2. unifiedSearch     │            │ - searchAnalytics ⚠   │
            │   3. semanticRerank   │            │   (writes only)       │
            │      via gemini-proxy │            │ - geoSearchParser     │
            │   4. dedupe + merge   │            │ - spatialSearch       │
            │                       │            └───────────────────────┘
            │  sonarWebSearch():    │
            │   ⚠ ignores `options.model` and `searchRecencyFilter`
            │   ⚠ uses ai-router 'web_search' (Gemini), name & docs say Sonar
            └───────────┬───────────┘
                        │
                        ▼
        ┌───────────────────────────────────────────────────────────────────┐
        │ unifiedSearchService — fan out to 12 sources, Promise.allSettled  │
        │   Each source: 8s timeout, slow-warning at 1s, deduped twice      │
        │                                                                   │
        │ Sources (per source: textSearch on search_vector + filters):     │
        │   unified_messages · messages · emails · gmail (live API) ·       │
        │   voxer_recordings · tasks · calendar_events · threads ·          │
        │   contacts · sms_messages · logos_notes · archives                │
        │                                                                   │
        │ 30s in-memory cache by (userId, query, filters, sort)             │
        │ Relevance: title-exact > title-word > content-word > sender       │
        └─────────────────────────┬─────────────────────────────────────────┘
                                  │
                                  ▼
        ┌───────────────────────────────────────────────────────────────────┐
        │ Supabase Postgres                                                 │
        │   tables w/ search_vector (tsvector): unified_messages, messages, │
        │     emails, voxer_recordings, tasks, calendar_events, threads,    │
        │     contacts, sms_messages, logos_notes, archives                 │
        │   search-specific tables: saved_searches, search_clipboard,       │
        │     search_history, search_index ⚠ (table exists, never queried) │
        │                                                                   │
        │   spatial: entity_places, places (joined by spatialSearchService)│
        │                                                                   │
        │ Edge functions: gemini-proxy (semantic rerank),                   │
        │                 ai-router (web_search task, used by Dashboard +   │
        │                              UnifiedSearch web answer)            │
        │                 check-search-alerts (cron, sends Resend email)    │
        │                                                                   │
        │ External: Gmail API (live), Google Maps JS SDK (map view)         │
        └───────────────────────────────────────────────────────────────────┘
```

---

## 3. Feature Status Catalog

### 3.1 Dashboard "Search the web" widget (the screenshot)

| Feature | Status | Notes |
|---|---|---|
| Text input + Search button | ✅ | `Dashboard.tsx:1404–1429` |
| `/` and `⌘K` hint chips | ⚠️ | `/` works (line 731). `⌘K` chip is **misleading** — Cmd+K does NOT focus this input; it routes to `/search` via `App.tsx:587` and (on Dashboard) ALSO toggles the Dashboard command palette. |
| Submit → Gemini grounded answer | ✅ | `geminiService.generateSearchResponse` → ai-router `web_search` task |
| Markdown render of answer | ✅ | Custom `<ReactMarkdown>` with brand-styled components |
| Up to 3 source links | ✅ | `searchResult.sources?.slice(0,3)` |
| ProvenanceChip "WEB · gemini" | ✅ | Wired |
| Dismiss button | ✅ | |
| Search history | ❌ | None. Each query is one-and-done. No connection to `search_history` table or `recent searches` shown in `/search`. |
| Loading spinner | ✅ | |
| Error → toast | ✅ | `handleAIError` first, then generic toast |
| Multi-turn / follow-up | ❌ | Single-shot only |
| Web AND Pulse search at once | ❌ | This widget only searches the web. `/search` does both. |
| Mobile keyboard handling | ⚠️ | Not specifically handled; works but no special mobile affordance |

**Verdict:** Self-contained, simple, working. But it's a **functional duplicate** of UnifiedSearch's web-search toggle with a different UI and zero shared state.

### 3.2 `/search` (UnifiedSearchRedesign)

#### Core search

| Feature | Status | Notes |
|---|---|---|
| Free-text query, debounced 300ms | ✅ | `useDebounce` |
| 12-source parallel fan-out | ✅ | Promise.allSettled, 8s per-source timeout |
| Per-source error badges | ✅ | "Gmail disconnected" / "x unavailable" |
| Result dedup (id, then content prefix) | ✅ | `deduplicateResults` |
| Relevance scoring | ✅ | Title-match heavy weighting |
| 30s in-memory cache | ✅ | But not invalidated when filters change because filters are part of the cache key — good. |
| Streaming partial results as sources complete | ✅ | `onSourceComplete` callback |
| Search history persistence | ✅ | `search_history` table, but `count` never increments (see issues) |
| Query operators (`from:` `after:` `before:` `tag:` `type:`) | ✅ | Parsed by `searchQueryParser` |
| Operator autocomplete (`from:` → contacts) | ✅ | Lines 454–471 |
| `?` operator reference popover | ✅ | But documents shortcuts that don't exist (see issues) |
| `/` and ⌘K to focus | ✅ | Component-level handler at line 332 |
| Voice search (Web Speech API) | ✅ | `voiceSearchService` |
| Suggestions dropdown (recent + popular) | ✅ | But "popular" is just "recent matching ILIKE" — no count-based ranking |

#### View modes

| Feature | Status | Notes |
|---|---|---|
| Timeline view (Today/Yesterday/Week/Month/Older) | ✅ | Default |
| List view | ✅ | |
| Grid view | ✅ | |
| Map view | ⚠️ | Only appears when `activeGeoFilter` is set. **`isDarkMode` prop is accepted but never passed** (line 1281–1285) — map is always light. |
| Group by conversation | ✅ | Hidden on timeline + map; auto-disabled when query has operator |

#### Filters / facets

| Feature | Status | Notes |
|---|---|---|
| Saved searches list (left rail) | ✅ | Click to load, X with undo toast |
| Content-type facets w/ live counts | ✅ | Empty state shows all 8; results state hides zero-count |
| AI ranking toggle | ✅ | Calls `gemini-proxy` semanticRerank |
| Web search toggle | ✅ | Two toggles exist: sidebar + hero bar (kept in sync) |
| **Fast / Pro / Reasoning segmented control** | 🔴 **BROKEN / PLACEBO** | UI sets state → passed as `{ model: webSearchModel }` → service signature accepts it → service body says `void options;` and ignores it entirely. The router's `web_search` task always runs, regardless. |

#### Empty state ("Working memory")

| Feature | Status | Notes |
|---|---|---|
| Resume list (recent + saved) | ✅ | Numbered 1–5 |
| Recent threads roll-up | ✅ | `dataService.getRecentThreads(8)` → sets `from:Counterpart` query |
| Pinned clipboard items | ✅ | Pre-filtered |
| Browse-by-type chips | ✅ | Sets `type:foo` query + selectedTypes |
| Onboard examples | ✅ | Shown only when all other lists empty |
| **`1`–`5` keyboard shortcut for Resume** | 🔴 **DOCUMENTED BUT NOT IMPLEMENTED** | OperatorReferencePopover advertises "1 — 5 Resume from list" (line 27), but no key handler binds digit keys to recent-search rows. |

#### Result interaction

| Feature | Status | Notes |
|---|---|---|
| Click → SearchDetailPanel | ✅ | |
| ArrowDown/Up between cards | ✅ | |
| ArrowRight to peek inline | ✅ | |
| ArrowLeft / Esc to collapse | ✅ | |
| Enter on focused card → detail | ✅ | |
| Detail panel "Go to source" | ✅ | Dispatches `pulse:navigate` — **but only opens the parent view, doesn't deep-link to the specific record** (e.g., Messages opens but not the thread). |
| Multi-select via checkbox | ✅ | |
| Batch clip + undo toast | ✅ | |
| Batch export CSV | ✅ | |
| Infinite scroll (20-item pages) | ✅ | IntersectionObserver |

#### Web answer card

| Feature | Status | Notes |
|---|---|---|
| Inline AI answer w/ ProvenanceChip | ✅ | |
| Citations rendered as host-name chips | ✅ | |
| Loading spinner | ✅ | |
| Markdown rendering | ✅ | But uses `prose prose-sm dark:prose-invert` while the rest of UnifiedSearch uses `--search-*` tokens — design system inconsistency. |

#### Geo modifier (B3)

| Feature | Status | Notes |
|---|---|---|
| Parse `near me`, `near <place>`, `within N mi` | ✅ | Pure regex, no I/O |
| Resolve geo center via `getCurrentUserLocation` / `geocodeAddress` | ✅ | |
| `entity_places` join → Haversine filter | ✅ | |
| Fall-back error inline ("Location unavailable", "Could not find …") | ✅ | |
| Auto-show Map view when geo active | ✅ | |
| Auto-fall-back to Timeline when geo cleared | ✅ | Line 446–451 |
| Show `0.7 mi` distance on each result card | ⚠️ | spatialSearchService writes `metadata.spatial.distanceMiles`, but `SearchResultCard` does not render it. Only the map pin tooltip uses it. |

#### Clipboard sidebar

| Feature | Status | Notes |
|---|---|---|
| Quick-note input + Enter to save | ✅ | |
| List items with title + preview + meta | ✅ | |
| Pin / unpin | ✅ | |
| Delete | ✅ | |
| Expand/collapse panel | ✅ | |
| Toggle notes / categories view | ⚠️ | Button toggles `clipboardView` state, but **no UI ever branches on it** — categories view never renders differently. |
| `selectedClipboardCategory` | ⚠️ | State exists, used in `getClipboardItems({category})`, but **no UI to set it** (no category list/picker). Always null. |

#### Save & alerts

| Feature | Status | Notes |
|---|---|---|
| SaveSearchModal | ✅ | But Tailwind `pink-500/gray-*` styling instead of `--search-*` tokens — inconsistent. |
| Persist to `saved_searches` | ✅ | |
| Alert toggle + frequency selector | ✅ persisted | |
| `check-search-alerts` cron + Resend email | ✅ exists | But unclear if scheduled in production. The function requires `CRON_SECRET`. **No code anywhere in this repo schedules it** — this needs to be set up via Supabase Scheduled Functions or pg_cron, externally. |
| Show "alert ON" indicator on saved-search row | ❌ | Not rendered; user has no signal that an alert is wired. |
| Edit alert frequency post-save | ❌ | No UI to update an existing saved search. |

#### Telemetry / Analytics

| Feature | Status | Notes |
|---|---|---|
| `searchAnalyticsService.trackSearch` (per-search count, zero-result flag) | 🔇 **WRITES ONLY** | Records to localStorage. Nothing reads or surfaces it. No "your top searches" panel, no "queries with no results to address" admin view. |
| `searchAnalyticsService.trackClick` | 🔇 **WRITES ONLY** | Same. Result-type click data is collected but never displayed. |
| `searchAnalyticsService.getSummary / getTopQueries / getZeroResultQueries` | 🔇 | Public methods, zero callers. |

#### Export

| Feature | Status | Notes |
|---|---|---|
| CSV export | ✅ | |
| Markdown (clipboard) export | ✅ | But labeled "Markdown" in the UI export menu — **exports the clipboard, not search results**. Users will expect markdown of search results. Misleading label. |
| PDF "print" export | ⚠️ | Opens print dialog of an HTML table; not a real PDF, no pagination, no branding. |

---

## 4. Issues by Severity

### 🔴 Critical

1. **Web-search "Fast / Pro / Reasoning" segmented control is a placebo** (`searchEnhancements.ts:462`, `UnifiedSearchRedesign.tsx:850–865`). `void options;` discards the model. UI implies user choice; backend ignores it. Either wire up the option (different ai-router tasks, or thread `model` through `invokeAI`'s options) or remove the control. **Trust hazard.**

2. **Cmd+K conflict between App.tsx and Dashboard.tsx** (`App.tsx:585–598` + `Dashboard.tsx:706–711`). Both attach a global `keydown` listener. On Dashboard view, Cmd+K both navigates to `/search` AND toggles the Dashboard command palette. Whichever resolves last wins visually, but both `setView` and `setShowCmdPalette(prev => !prev)` execute. Result: you arrive at `/search` with the (now hidden) Dashboard cmd palette toggled-on behind it. Decide: either Dashboard owns Cmd+K when mounted, or it always opens `/search`.

3. **`ParsedSearchQuery` type referenced but never imported** (`searchEnhancements.ts:246`). Compiles only because the project is not in fully strict mode (or `skipLibCheck`). The runtime works because `Record<string,string>` happens to expose the right keys, but the contract is fictional. Replace with the actual `parseToFlatOperators` return type.

4. **Dashboard "Search the web" widget and `/search`'s web-search toggle are two parallel implementations** of the same Gemini call (`generateSearchResponse` vs `sonarWebSearch`). Different UI, different result rendering, no shared history, both ship in production. This is duplication, not redundancy.

### 🟡 Medium

5. **`searchAnalyticsService` is dead-end telemetry.** 171 LOC, two writes per search, zero readers. Either expose via a "Search insights" panel (top queries, zero-result queries are an underused product signal) or delete the service.

6. **`searchAI.ts` is dead code.** 172 LOC. Only the file references itself. Delete or wire into `searchEnhancements`.

7. **`search_index` table in DB is never queried by client.** Either drop the table or document why it's reserved.

8. **`saveSearchToHistory` doesn't increment `search_history.count`** (`searchEnhancements.ts:413–446`). The schema has a `count` column with a btree index `idx_search_history_count`, but the app only updates `updated_at`. The "popular searches" suggestion queries `updated_at` order — so it's actually "most recent matching", not "most popular". Either fix the increment + use it for popular suggestions, or drop the column and the index.

9. **OperatorReferencePopover advertises shortcuts that don't exist** (`OperatorReferencePopover.tsx:27`): "1 — 5 Resume from list". UnifiedSearchRedesign has no key handler for digits 1–5.

10. **Clipboard "categories" view is a button to nowhere** (`UnifiedSearchRedesign.tsx:1331–1335`). Toggles `clipboardView` state, no rendering branch differs. Same with `selectedClipboardCategory` — used in the fetch filter, but no UI to set it.

11. **`SearchMapView` always light-theme** (`UnifiedSearchRedesign.tsx:1281–1285`). Component accepts `isDarkMode` prop, parent never passes it. In dark mode the map is jarring.

12. **`SearchDetailPanel`'s "Go to source" only opens the parent view.** Clicking a search result for a specific Gmail email and then "Go to Email" opens the inbox, not that email. This is the moment the user needs *most* — they searched for it, found it, want to act on it. Currently the result is essentially a dead-end preview unless they Clip it.

13. **`SaveSearchModal` styling diverges from search design tokens.** Uses `bg-pink-500`, `bg-gray-*` Tailwind utilities. Rest of UnifiedSearch uses `var(--search-primary)`, etc. Looks like a different app.

14. **Web answer card uses `prose prose-sm dark:prose-invert`** (`UnifiedSearchRedesign.tsx:1196`) instead of the search-token system used everywhere else in the same component.

15. **No way to edit a saved search.** Once saved, users can only delete + recreate. Alert frequency in particular is set-once-forever.

16. **`saved_searches.alert_enabled` flag has no surfacing in the saved-searches list.** No icon/dot indicates which searches alert; users won't know.

17. **`check-search-alerts` cron has no scheduling artifact in the repo.** Function exists, accepts `CRON_SECRET`, but no `pg_cron` migration or `supabase functions schedule` config commits this. If this isn't scheduled in the live project, every saved search alert is silent.

18. **`useWebSearch` toggle is duplicated** (sidebar Intelligence card + hero bar Globe icon). State is shared, but having two toggles for one preference doubles the surface area to learn and makes it ambiguous whether they're separate ideas.

19. **`getPopularSearches` SQL ignores `query` count, and `getRecentSearches` runs unconditionally on every keystroke** (`searchEnhancements.ts:474–477` + 88–94). `getSuggestions` runs on every character; each call is one Supabase round-trip. Debouncing applies only to `performSearch`, not to suggestions. With a slow connection this is a flood.

20. **Per-source 8s timeout × 12 sources** = up to 96s of wall-clock if every source hangs. Should be a budget on overall search, not per source. Today: a query against a slow Supabase region appears "still loading" long after it should have given up.

21. **`searchService.ts` (238 LOC) is the OLD search service.** Used only by the in-thread Search Panel. Confusing because it shares a name with the global surface and exposes its own `getRecentSearches`/`saveRecentSearch` that hit `localStorage` under a *different* key (`pulse_recent_searches`) than what the global search uses. Two parallel "recent searches" stores.

22. **`SearchResultCard` doesn't render `metadata.spatial.distanceMiles`** even though the spatial filter writes it. Users who filtered by "within 5 mi" can't see the per-result distance unless they switch to map view.

23. **No empty-source fall-back UI.** When ALL 12 sources error and only `searchErrors` is populated, the user sees the empty-state hint ("Nothing found for x") with no signal that the *backends* failed, not the query. Source-error badges are rendered above the results, but the empty-results message ("Try different keywords") is misleading.

### 🟢 Nice-to-have

24. **No "save as default" view mode per-user in DB.** localStorage only — logging in on a different device resets to timeline.

25. **No keyboard shortcut to focus next/prev source-error badge** or dismiss them.

26. **`@react-google-maps/api` loaded on every map switch** even if user never opens map view. The lazy-route on `/search` already preloads UnifiedSearch; consider deferring the map JS until `viewMode === 'map'` materializes, since most queries never trigger a geo filter.

27. **`SearchResultCard` doesn't memoize on selection state changes wisely** — `onSelect` and `onDetail` are new refs every render of parent (not wrapped in `useCallback`). React.memo() bails on equality. Consider stable callbacks.

28. **`Search Detail Panel` returns `null` when no result, but the listener is always on Escape.** OK at correctness level (it bails early), but the wiring uses `window.addEventListener` with no debouncing — consecutive Escapes (panel + then suggestions) hit both handlers.

29. **`groupResultsByDate` rebuilds buckets on every render** for timeline view (no memo). At 200 results the work is trivial, but if pagination grows…

30. **No "clear all filters" master button.** Have to clear types + clear geo + reset operators by typing.

31. **`searchExport.exportToPDF` is a print-window**, not a real PDF. With no styling beyond a basic table, it's barely usable for sharing.

32. **The `Browse by type` chips set `type:foo`** which sometimes returns zero results because the search has no free text. Pulse's text-search backend requires a query — `type:foo` with empty `freeText` is an empty `tsvector` query and the backend silently returns nothing instead of "all of type X". Browse-by-type should special-case "show all of type X" rather than searching.

33. **`searchAnalyticsService` keys by `userId` but records are stored in localStorage** — mixing a user-scoped concern with device-scoped storage. If two users share a browser, their analytics interleave (and EXPIRY_DAYS doesn't separate them).

34. **No type filter in the Dashboard widget.** Web search only — no way to constrain to messages or tasks from the Dashboard.

35. **`generateMapsResponse`** in `geminiService.ts` is exported but referenced nowhere. Likely dead.

---

## 5. Dead Code / Unused Imports

- `src/services/searchAI.ts` — entire file unused
- `searchAnalyticsService.getSummary / getTopQueries / getZeroResultQueries / getClicksByType / clearAll` — public, zero callers
- `geminiService.generateMapsResponse` — exported, never called
- `voiceSearchService.stopListening / isListening` — exported, never called
- `searchClipboardService` likely has unused color/positionX/positionY fields (would need full read to confirm) — schema supports a "sticky note board" that the UI doesn't expose
- `search_index` table in Postgres
- `idx_search_history_count` index — never used because `count` is never updated
- `SearchSortOptions` interface — declared and exported, but UI never lets the user choose; service hard-codes `{field:'timestamp', order:'desc'}` everywhere
- `searchService.ts` `getRecentSearches/saveRecentSearch/clearRecentSearches` — only `searchMessages`/`getSuggestions` are used by ThreadSearch; the recent-search bits duplicate UnifiedSearch and are never called
- `ParsedSearchQuery` referenced in `searchEnhancements.ts:246` — type is undefined; replace with the real return type

---

## 6. Revisal Plan — Phased

### Phase 1 — Stop the bleeding (1–2 days)

1.1 **Remove the placebo Fast/Pro/Reasoning control** OR wire it to real ai-router tasks if those tasks exist. Recommendation: remove it for v1, add back only when the router actually exposes the variants. (`searchEnhancements.ts:458–489`, `UnifiedSearchRedesign.tsx:850–865`, `useState webSearchModel`).

1.2 **Resolve the Cmd+K conflict.** Decide ownership. Recommended: Dashboard's Cmd+K opens the *Dashboard's* command palette only when the Dashboard is the active view; App.tsx's Cmd+K should be the universal "open `/search`" only when no other view has claimed it. Concretely: have App.tsx check `currentView !== AppView.DASHBOARD` before navigating; or remove App.tsx's handler and let each view define its own.

1.3 **Fix `ParsedSearchQuery` import** in `searchEnhancements.ts`. Replace `ParsedSearchQuery['operators']` with `Record<string,string>` to match the actual return shape of `parseToFlatOperators`.

1.4 **Fix `SearchMapView` dark mode.** Pass `isDarkMode` from UnifiedSearchRedesign (need to thread the value from the app's theme — it's not currently a prop on UnifiedSearch; either add it or read directly in the map view from a shared theme hook).

1.5 **Decide on the Dashboard widget vs `/search` web answer.** Either: (a) make the Dashboard widget a simplified launcher that opens `/search` with the query pre-filled and Web-search auto-on, OR (b) keep both but make them share history (`search_history` for both) and identical result rendering.

### Phase 2 — Wire up the half-built (2–3 days)

2.1 **Surface alert-on indicator** on saved-search rows. Bell icon when `alertEnabled`.

2.2 **Add edit-saved-search modal** (rename, change query/filters, change alert frequency).

2.3 **Schedule `check-search-alerts`.** Either commit a `pg_cron` migration (`SELECT cron.schedule(...)`) or `supabase config.toml` schedule. Verify it runs in prod. Document the `CRON_SECRET` setup.

2.4 **Either build out clipboard categories view, or remove the toggle button.** A category sidebar/picker is the smaller delta — adds value (group items by `category`).

2.5 **Make "Browse by type" chips actually browse.** Special-case `type:foo` with empty free text → fan out to that source's "list latest 50" query, no FTS.

2.6 **Show `metadata.spatial.distanceMiles` on result cards** when geo filter active, not only on the map.

2.7 **Implement digit-key shortcuts for Resume rows** OR remove the line from `OperatorReferencePopover`.

2.8 **Increment `search_history.count` on `saveSearchToHistory`** and switch `getPopularSearches` to order by `count DESC`. Or drop the column + index + the function.

2.9 **Deep-link from `SearchDetailPanel.handleGoToSource`**. Pass the result id/threadId in the navigation event detail and have target views honor it (`pulse_focus_nudge` style or a `pulse:open-thread` event).

2.10 **Replace per-source 8s timeout with overall 10s budget** on the search; drop per-source warnings as analytics events instead.

### Phase 3 — Refactor & shrink (3–5 days)

3.1 **Delete `src/services/searchAI.ts` (dead).**

3.2 **Delete `searchAnalyticsService` OR build a "Search insights" panel** in Settings → Analytics that surfaces top/zero-result queries and click-through rates. The data is already there, the value is real.

3.3 **Drop `search_index` table** if unused (verify with a migration check first).

3.4 **Consolidate the two "recent searches" stores.** Pick `search_history` as the source of truth; remove `searchService.ts:getRecentSearches/saveRecentSearch` and the `pulse_recent_searches` localStorage key.

3.5 **Re-namespace `SaveSearchModal` to `--search-*` tokens** to match the rest of the section's design system. Same for the AI answer card.

3.6 **Lazy-load `@react-google-maps/api`** behind `viewMode === 'map'` instead of at component mount.

3.7 **Stable callbacks for `SearchResultCard`** (`useCallback` for `toggleResultSelect` / `setDetailResult` wrappers) so `React.memo` actually memoizes.

3.8 **Memoize `groupResultsByDate`** result.

3.9 **Debounce `searchEnhancements.getSuggestions`** (currently runs every keystroke, 1 round-trip each).

### Phase 4 — Net-new polish (open-ended)

4.1 **Search Insights panel** (uses Phase 3.2 data): top 10 queries, zero-result queries (a goldmine for product), result-type click distribution, average results per query.

4.2 **"All-of-type" empty state mode** — `type:tasks` with no free text shows a richer browseable view (sortable, filterable) instead of a search results list.

4.3 **Multi-turn web search** — let users follow up on the AI answer card without losing the result panel below.

4.4 **Saved-search "diff since last visit"** — when the user opens a saved search, surface the new results since `last_used_at` distinctly.

4.5 **Cross-device view-mode preference** — store `pulse:search:viewMode` in `user_settings` row.

4.6 **PDF export upgrade** — render via a lightweight client lib (e.g., jsPDF) instead of print dialog.

4.7 **Voice search continuous mode + result highlight** — keep listening, refine query as user speaks.

4.8 **Federated search across other Quantum Ecosystems apps** (Logos Vision, Entomate) using the bridge token pattern documented in memory.

---

## 7. Suggested Cut Scope (if time-constrained)

If you only fix Phase 1 + items 2.1, 2.3, 2.7, 2.8, 3.1, 3.4 — you address every Critical and the most user-facing Mediums in roughly 3–4 days of work. This is what I'd recommend as the minimum bar for "ship this section without embarrassment."

---

## 8. Implementation Prompt (for a fresh Claude instance)

```
You are working in the Pulse codebase at f:/pulse1. Tech stack: React 18 + TypeScript + Vite, Supabase Postgres + edge functions, Tailwind + bespoke `--search-*` CSS tokens, Capacitor for Android. Branch: main.

Section: Pulse Global Search — both surfaces:
  • Dashboard "Search the web" widget (src/components/Dashboard.tsx ~lines 367, 1030–1044, 1402–1469)
  • /search section (src/components/UnifiedSearchRedesign.tsx + ~20 dependencies)

A full audit has been written at docs/PULSE_GLOBAL_SEARCH_AUDIT_2026-05-08.md — read it first.

EXECUTE PHASE 1 AND THE PRIORITY PHASE-2/3 ITEMS LISTED IN §7 OF THE AUDIT, in this order:

P1.1 — Remove the Fast/Pro/Reasoning segmented control.
  Files: src/components/UnifiedSearchRedesign.tsx (lines ~210, 850–865), src/services/searchEnhancements.ts (lines 26–35, 458–489).
  Specifics:
    - Delete the `webSearchModel` state and its setter.
    - Delete the `<div className="sonar-model-segments">` block.
    - Drop `model` and `searchRecencyFilter` from `SonarSearchOptions`. Delete `void options;`. Drop the `options` parameter from `sonarWebSearch` since it's now empty.
    - Update the call site to `sonarWebSearch(queryForBackend)`.
    - Update CSS: search for `.sonar-model-segments` in UnifiedSearchRedesign.css and delete the rules.
  Why: the option was a placebo — service body discarded it. Better honest UI than fake controls.

P1.2 — Resolve the Cmd+K conflict.
  Files: src/App.tsx (lines 584–598), src/components/Dashboard.tsx (lines 706–711).
  Specifics: Make App.tsx's handler a no-op when the active view already owns Cmd+K. Two options:
    (a) Track a Set of "views that handle their own Cmd+K" — Dashboard, Messages, Email, Contacts. App.tsx checks `if (handledViews.has(currentView)) return;` before routing to MULTI_MODAL.
    (b) Move the universal handler into a hook each view opts in to.
  Pick (a) — smaller change. Implement in App.tsx; do not modify Dashboard.

P1.3 — Fix the broken type contract.
  File: src/services/searchEnhancements.ts (line 246).
  Replace `operators: ParsedSearchQuery['operators']` with `operators: Record<string, string>`. ParsedSearchQuery is undefined; the actual shape from parseToFlatOperators is `Record<string,string>`.

P1.4 — Pass isDarkMode to SearchMapView.
  Files: src/components/UnifiedSearchRedesign.tsx (line 1281–1285).
  Read the theme — search the codebase for how other components access it (e.g. usePulseTheme or document body class). Pass it as the prop. Verify the map renders dark in dark mode via getMapOptions(true).

P2.1 — Surface saved-search alert state.
  File: src/components/UnifiedSearchRedesign.tsx (lines ~743–807).
  When `s.alertEnabled`, render a Bell icon (lucide) before the Bookmark icon. Add a tooltip "Alert: <frequency>".

P2.7 — Either implement digit-key shortcuts OR remove the line.
  File: src/components/OperatorReferencePopover.tsx (line 27).
  Recommendation: implement, since the empty state already numbers Resume rows visually.
  In UnifiedSearchRedesign.tsx, in the existing global onKey handler (line 332), add: when not in a field, key matches /^[1-5]$/, and isEmptyState is true, click the corresponding `recentSearches[i-1]` row OR fall through to savedSearches if recents are exhausted. Match the rendering order in the Resume section.

P2.8 — Increment search_history.count.
  File: src/services/searchEnhancements.ts (lines 413–446).
  In the existing-row UPDATE branch, add `count` field: `.update({ updated_at: ..., count: existing.count + 1 })` — but `existing` only selects `id` today. Change the .select() to `.select('id, count')`. Increment client-side or use a Postgres RPC (`increment_search_count(id uuid)`).
  Then in getPopularSearches (line 348), order by `count DESC, updated_at DESC`.

P3.1 — Delete the dead service.
  Run: rm src/services/searchAI.ts. Verify zero imports break (grep first).

P3.4 — Consolidate recent searches storage.
  File: src/services/searchService.ts.
  Delete `getRecentSearches`, `saveRecentSearch`, `clearRecentSearches`. Verify nothing imports them (Grep `pulse_recent_searches`). Keep the `searchMessages` / `getSuggestions` methods that ThreadSearch uses.

VERIFICATION CHECKLIST (run after each item):
  - npm run typecheck — no new errors
  - The /search page loads
  - Cmd+K from Dashboard opens the Dashboard cmd palette (NOT /search)
  - Cmd+K from any other view opens /search
  - The Web search toggle still flips on/off
  - The "Fast / Pro / Reasoning" buttons are gone
  - On a saved search with alertEnabled true, a bell shows up
  - Pressing 1 in the empty state runs the first recent search
  - searchAI.ts no longer exists; nothing imports it
  - Map view in dark mode is dark

REPORT BACK: a one-paragraph summary per item with the diff line count and any blockers. Do NOT proceed past P1 if any P1 verification fails — escalate.
```

---

## 9. Open Questions for the User

1. **Are the Dashboard "Search the web" widget and `/search` meant to be two distinct experiences, or one?** This is the call that determines the entire shape of the consolidation.
2. **Should the `Fast / Pro / Reasoning` control come back wired up?** If so — what task names would the router expose, and is there budget for the more expensive variants?
3. **Is `check-search-alerts` actually scheduled in production?** If not, all alert subscriptions are silent, which is worse than not offering alerts at all.
4. **Search analytics — product opportunity or cost?** The data is being collected but not surfaced. A "Search insights" panel for users (and an admin view for zero-result queries) is a small lift with real product value.

---

*End of audit.*
