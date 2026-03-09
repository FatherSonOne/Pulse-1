# Pulse Performance Phase 2 — Master Plan

**Date:** 2026-03-08
**Status:** Planning
**Prerequisite:** Phase 1 complete ([2026-03-08-performance-audit-execution.md](2026-03-08-performance-audit-execution.md))
**Branch strategy:** Each tier executes on its own branch, merges to main independently

---

## Overview

Phase 1 addressed the highest-certainty, lowest-risk improvements (build cleanup, N+1 queries, caching, context memoization, virtualization). Phase 2 goes deeper: icon migration, systematic memoization, subscription safety, remaining data-layer debt, and — when ready — the structural component work that unlocks the biggest React gains.

**Phase 2 is organized into 3 tiers by scope and risk:**

| Tier | Theme | Risk | Effort | Branch |
|------|-------|------|--------|--------|
| 1 | High Impact, Low Risk | Zero–Low | Medium | `perf/tier-1-quick-wins` |
| 2 | Medium Impact, Measured Risk | Low–Medium | Medium–High | `perf/tier-2-architecture` |
| 3 | Structural Refactoring | Medium | High | `perf/tier-3-structural` |

---

## Tier 1 — High Impact, Low Risk

> Execute this tier first. All changes are behind-the-scenes with zero visual impact.
> Estimated execution plan: `docs/plans/2026-03-08-performance-tier-1-execution.md`

### 1.1 Font Awesome → lucide-react Full Migration

**Why:** The Font Awesome CDN loads ~180KB of CSS covering 7,000+ icons on every page load. It's a render-blocking request from an external CDN. `lucide-react` already covers the same icon needs and is tree-shaken at build time (only used icons included).

**Scope:**
- ~200+ TSX files with `fa-`, `fas`, `fab`, `far`, `fal` class strings
- All `<i className="fa-...">` elements need to become `<Icon />` from lucide-react
- After migration, delete `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/.../font-awesome/...">` from `index.html`

**Approach:**
1. Audit all unique `fa-` icon names used (grep and deduplicate)
2. Create a mapping table: `fa-solid fa-gear` → `<Settings />` from lucide-react
3. Migrate file by file, component by component
4. Verify no broken icons after each batch

**Impact:** ~180KB removed from every page load, eliminates 1 external CDN dependency, improves CSP posture.

**Risk:** Low. Icons are visual-only. Any missed icon shows as blank, easily caught.

---

### 1.2 React.memo on Leaf Components

**Why:** Only 1.9% of components are memoized. Components that receive stable props and render inside lists or large parents re-render on every parent state change even when their props haven't changed.

**High-value targets (identified during Phase 1 audit):**
- Thread row items in sidebar lists
- Contact list items (`ContactCard`, `ContactRow`, etc.)
- Email list row components
- Sidebar navigation items
- Message bubble components that receive only message data
- Dashboard widget components
- Any component rendered inside a `.map()` that receives primitive or memoized props

**Approach:**
1. Identify components that: (a) are rendered in lists, (b) receive stable props, (c) have no internal high-frequency state
2. Wrap with `React.memo()`
3. Ensure parent passes memoized callbacks via `useCallback` where needed (otherwise memo is defeated by new function references)
4. Verify with React DevTools Profiler — memo'd component should not highlight when siblings update

**Impact:** Fewer cascade re-renders throughout the app, smoother UI during state updates.

**Risk:** Very low. `React.memo` is a hint, not a behavioral change. Adding it incorrectly is a no-op, not a bug.

---

### 1.3 Real-Time Subscription Registry + Cleanup

**Why:** `dataService.ts` creates multiple Supabase real-time subscriptions with no centralized tracking. Over a long session (navigating between views), subscriptions can accumulate without cleanup, creating memory leaks and excess database connections.

**Affected subscriptions:**
- `subscribeToContacts()` → channel `contacts_changes`
- `subscribeToMessages(threadId)` → channel `messages_${threadId}` (one per thread!)
- `subscribeToUnifiedInbox()` → channel `unified_inbox`
- `subscribeToDashboardUpdates()` → creates up to 3 channels
- `usePulseMessaging.ts` subscription (already partially audited)

**Approach:**
1. Add a `subscriptionRegistry: Map<string, RealtimeChannel>` to `DataService`
2. Before creating any channel: if already registered, call `removeChannel()` on existing first
3. Add a `cleanupAllSubscriptions()` method called on logout/session end
4. Add a max active subscription count guard (warn at >10, refuse at >20)
5. Ensure all `useEffect` hooks that subscribe also call cleanup in their return

**Impact:** Prevents memory leaks in long sessions, reduces Supabase connection count, improves stability.

**Risk:** Low. Adding a registry doesn't change subscription behavior — it just enforces cleanup.

---

### 1.4 Remaining SELECT * → Specific Columns

**Why:** Phase 1 fixed `getThreads()` and contacts. These files still use `SELECT *`:
- `src/services/activityService.ts` (lines ~150, 180, 211, 256)
- `src/services/unifiedInboxDb.ts` (lines ~256, 295, 315)
- `getVoxerRecordings()` in `dataService.ts`
- `getRecentActivity()` in `activityService.ts`

**Approach:** For each query, identify which columns are actually consumed downstream and replace `select('*')` with the minimum column set.

**Impact:** Reduced payload on every query, lower bandwidth consumption, faster Supabase response times.

**Risk:** Zero. Purely additive specificity.

---

### 1.5 Fix getThread() Singular N+1

**Why:** The single-thread fetch (`getThread(id)`) — called from `addMessage()` and `updateMessage()` (write-then-read paths) — still makes 2 sequential DB calls. Users feel this as lag after sending a message.

**Approach:** Same fix as `getThreads()` — use `select('*, messages(*)')` to join in one query.

**Impact:** Cuts per-message-send DB calls from 2 to 1. Directly improves perceived responsiveness.

**Risk:** Very low. Exact same pattern already proven in Phase 1 Task 3.

---

### 1.6 postMeetingService.startMonitoring() Fires on Every Events Change

**Why:** In `Calendar.tsx` (~line 544), `postMeetingService.startMonitoring(events)` is called inside a `useEffect([events])`. This means the monitoring restarts on every single change to the events array — even adding one calendar event restarts the polling service.

**Approach:** Add a ref to track if monitoring is already active. Only call `startMonitoring()` if not already running, or debounce the effect.

**Impact:** Prevents polling service from restarting dozens of times per session.

**Risk:** Very low. Single useEffect guard.

---

### 1.7 Mobile Drawer Virtualization

**Why:** The mobile drawer renders a second `pulseConversations.map()` without virtualization. Same `useVirtualList` hook, same approach.

**Impact:** Consistent with desktop virtualization, smooth mobile scrolling on large lists.

**Risk:** Very low. Identical pattern to Phase 1 Task 11.

---

## Tier 2 — Medium Impact, Measured Risk

> Execute after Tier 1 is merged and stable.
> Estimated execution plan: `docs/plans/2026-03-08-performance-tier-2-execution.md`

### 2.1 MessagesContext Splitting

**Why:** Phase 1 memoized the `MessagesContext` value (prevents re-renders when the provider's parent re-renders). But all 25+ properties still broadcast to every consumer on any internal state change. A component consuming only `threads` still re-renders when `pulseUserSearch` changes.

**Full solution:** Split `MessagesContext` into focused sub-contexts:
- `ThreadsContext` — `threads`, `activeThreadId`, thread actions
- `PulseContext` — `pulseConversations`, `pulseMessages`, pulse-specific state
- `PulseUIContext` — search state, context menu positions, typing indicators, mobile view

**Approach:**
1. Identify which components consume which properties (grep for `useMessagesContext` or equivalent)
2. Group properties by consumer overlap
3. Create sub-contexts, keeping backward compat via a wrapper hook that aggregates
4. Migrate consumer by consumer

**Impact:** Components only re-render when their specific slice changes. Major improvement for components that only need threads.

**Risk:** Medium. Context splitting touches every consumer. Must be done systematically with grep-first inventory.

---

### 2.2 WorkspaceContext Splitting

**Why:** Same issue as MessagesContext. 13 properties broadcasting to all consumers.

**Split into:**
- `WorkspaceDataContext` — `workspaces`, `currentWorkspace`, `members`, `currentRole`
- `WorkspaceActionsContext` — `switchWorkspace`, `createWorkspace`, `updateWorkspace`, `refresh*`
- `WorkspacePermissionsContext` — `isOwner`, `isAdmin`, `canManageMembers`

**Impact:** Components that only check permissions don't re-render when workspace list changes.

**Risk:** Medium. Same approach as MessagesContext split.

---

### 2.3 Settings.tsx State Consolidation (useReducer)

**Why:** `Settings.tsx` has 40+ independent `useState` calls. Every UI interaction causes React to evaluate all 40 state variables. Grouping related state into `useReducer` or object-shaped state reduces the overhead.

**Approach:**
1. Group state by logical section (profile fields, notification prefs, integration tokens, UI flags)
2. Replace groups with `useReducer` or `useState` holding an object
3. Update setters to use dispatch or spread updates

**Impact:** Fewer re-renders during settings interactions, cleaner code as a side effect.

**Risk:** Low-Medium. Touches Settings.tsx but no other files.

---

### 2.4 Email Segment applyRules() SQL Filtering

**Why:** `applyRules()` in `emailSegmentService.ts` fetches up to 1,000 contacts then filters them in JavaScript. Hard limit means segments with >1,000 matching contacts are silently truncated. The fix moves filtering to SQL WHERE clauses.

**Approach:**
1. Map segment rule operators to Supabase query methods
2. Build the query dynamically from `filter_rules` array
3. Remove the `limit(1000)` in favor of proper SQL filtering
4. Test with complex multi-rule segments

**Impact:** Correct results for large contact lists, reduced JS memory usage, faster segment refresh.

**Risk:** Medium. Requires careful mapping of all rule operators to Supabase query syntax.

---

### 2.5 Activity Logs Pagination

**Why:** `getRecentActivity()` loads 50 activity log entries with `SELECT *` and no cursor. Every dashboard open fetches 50 full rows.

**Approach:**
1. Replace `SELECT *` with specific columns
2. Add `range(offset, offset + limit - 1)` cursor support
3. Update callers to pass offset parameter

**Impact:** Smaller payloads, supports infinite scroll if ever needed.

**Risk:** Low. Additive change, callers still work with default offset=0.

---

### 2.6 Capacitor Smart Cache Invalidation

**Why:** `capacitor.config.ts` has `clearCache: true`, which wipes the entire WebView cache on every app update. Mobile users re-download all assets on every release.

**Approach:**
1. Switch to `clearCache: false`
2. Implement version-based selective invalidation — only invalidate asset URLs that have changed (Vite's content-hash filenames already handle this)
3. Keep the service worker cache-clearing for web (already version-aware)

**Impact:** Faster app updates on mobile, better offline resilience.

**Risk:** Low-Medium. Need to verify Capacitor WebView caching behavior on Android.

---

### 2.7 CRM SDK Lazy Loading

**Why:** `@hubspot/api-client` (26MB in node_modules) is bundled at startup. Users who don't use CRM integrations download it regardless.

**Approach:**
1. Move HubSpot, Pipedrive, Zoho imports to dynamic `import()` inside the service methods that need them
2. Ensure Vite's manual chunk config splits these into separate lazy chunks
3. Same pattern for Salesforce (though jsforce was removed — the REST client remains)

**Impact:** Removes CRM SDKs from initial bundle for non-CRM users.

**Risk:** Medium. Dynamic imports in service classes require handling the async nature of module loading.

---

## Tier 3 — Structural Refactoring

> Execute after Tiers 1 and 2 are stable. Highest impact, requires dedicated focus.
> Estimated execution plan: `docs/plans/2026-03-08-performance-tier-3-execution.md`

> **Note:** The user previously chose to exclude component splits. This tier is documented here for when the time is right. It is NOT in scope for Tiers 1 or 2.

### 3.1 Messages.tsx Decomposition (6,793 lines)

**Current pain:** A 6,793-line monolithic component. Any state change re-renders the entire component tree. Zero possibility of effective memoization at the top level.

**Proposed decomposition:**
- `MessagesLayout.tsx` — top-level layout, sidebar/main split
- `ThreadSidebar.tsx` — thread list, search, filter bar
- `ThreadListItem.tsx` — single thread row (memoizable)
- `MessagePane.tsx` — active thread message view
- `MessageBubble.tsx` — single message (memoizable)
- `MessageInput.tsx` — compose area
- `MessageEnhancements/` — AI features (already partially split via lazy bundles)

**Prerequisite:** Context splitting (Tier 2.1) should be done first so sub-components can subscribe to focused contexts.

**Impact:** Enables React.memo at every boundary, drastically reduces re-render surface.

**Risk:** Medium. Well-defined JSX boundaries make this tractable if done incrementally.

---

### 3.2 Calendar.tsx Decomposition (4,616 lines)

**Proposed decomposition:**
- `CalendarLayout.tsx` — view routing
- `CalendarMonthView.tsx`
- `CalendarWeekView.tsx`
- `CalendarAgendaView.tsx`
- `CalendarEventModal.tsx`
- `CalendarSidebar.tsx` — mini calendar, filters
- `CalendarEventCard.tsx` (memoizable)

**Impact:** Targeted re-renders on view-specific state changes.

**Risk:** Medium. Many internal state variables need careful distribution.

---

### 3.3 Settings.tsx Decomposition (3,759 lines)

**Proposed decomposition:**
- `SettingsLayout.tsx` — section navigation
- `ProfileSettings.tsx`
- `NotificationSettings.tsx`
- `IntegrationSettings.tsx`
- `AppearanceSettings.tsx`
- `SecuritySettings.tsx`

**Note:** Tier 2.3 (useReducer) should be done first — it simplifies decomposition by grouping related state.

**Impact:** Settings sections load and update independently.

**Risk:** Low. Settings sections are already visually isolated — decomposition follows natural boundaries.

---

### 3.4 LiveDashboard.tsx Decomposition (2,922 lines)

**Proposed decomposition:**
- `DashboardLayout.tsx`
- `DashboardMetricsPanel.tsx`
- `DashboardActivityFeed.tsx`
- `DashboardQuickActions.tsx`
- `DashboardWidgets/` — individual widget components (memoizable)

**Impact:** Dashboard widgets only re-render when their specific data changes.

**Risk:** Low. Dashboard is already widget-oriented conceptually.

---

### 3.5 useCallback Coverage in Messages.tsx

**Why:** Many event handlers in `Messages.tsx` are created fresh on every render. After `React.memo` is applied to child components (Tier 1.2), un-memoized handler props passed to those children defeat the memoization.

**Approach:** After decomposition (3.1), audit all handlers passed to child components and wrap with `useCallback` with correct dependency arrays.

**Note:** This is most effective AFTER 3.1 because the current monolithic structure makes it hard to know which handlers are passed where.

---

## Execution Order & Dependencies

```
Phase 1 (complete) ──►  Tier 1 ──►  Tier 2 ──►  Tier 3
                         │           │
                         │           ├── 2.1 Context Split → enables 3.1-3.4 decomp
                         │           └── 2.3 useReducer → simplifies 3.3
                         │
                         ├── 1.2 React.memo → multiplied by 3.1-3.4 decomp
                         └── 1.3 Subscription registry → prerequisite for long sessions
```

**Hard dependencies:**
- Tier 2.1 (context splitting) should precede Tier 3.1 (Messages decomp)
- Tier 2.3 (useReducer in Settings) should precede Tier 3.3 (Settings decomp)
- Tier 1.2 (React.memo) delivers more value after Tier 3 decomposition

**Soft recommendations:**
- Complete Font Awesome migration (1.1) before any other Tier 1 work — it's high-visibility
- Subscription registry (1.3) should be done before any long-session testing

---

## Effort Estimates

| Item | Files Touched | Estimated Complexity |
|------|--------------|---------------------|
| 1.1 Font Awesome migration | ~200 | High (volume) |
| 1.2 React.memo sweep | ~30-50 | Medium |
| 1.3 Subscription registry | 2-3 | Low |
| 1.4 SELECT * remaining | 3 | Low |
| 1.5 getThread() N+1 | 1 | Very Low |
| 1.6 postMeetingService guard | 1 | Very Low |
| 1.7 Mobile drawer virtual | 1 | Very Low |
| 2.1 MessagesContext split | 5-10 | High |
| 2.2 WorkspaceContext split | 3-5 | Medium |
| 2.3 Settings useReducer | 1 | Medium |
| 2.4 Email segment SQL filter | 1 | Medium |
| 2.5 Activity pagination | 2 | Low |
| 2.6 Capacitor cache | 1 | Low |
| 2.7 CRM SDK lazy | 3-5 | Medium |
| 3.1 Messages decomp | 1 → ~8 | Very High |
| 3.2 Calendar decomp | 1 → ~7 | High |
| 3.3 Settings decomp | 1 → ~6 | Medium |
| 3.4 LiveDashboard decomp | 1 → ~5 | Medium |
| 3.5 useCallback sweep | ~20 | Medium |

---

## Next Step

When ready to execute Tier 1, run:

```
superpowers:writing-plans → docs/plans/2026-03-08-performance-tier-1-execution.md
```

Then execute via subagent-driven development.
