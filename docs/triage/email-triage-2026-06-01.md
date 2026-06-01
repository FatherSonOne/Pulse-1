# Email Triage Report — 2026-06-01

> Forensic damage assessment of the Pulse **Email** section. This is a damage
> report, not an improvement plan. No code was changed. Classifications were
> traced through real imports, real handlers, git history, and the **live
> `pulse-chat` Supabase DB** (ref `ucaeuszgoihoyrvhewxk`) — not inferred from
> naming convention.

---

## Executive Summary

**Overall Health: STABLE (with two genuine defects + a large stranded-but-intact inventory)**

- Total code files: **78** TS/TSX (+ 2 CSS, 1,024 lines)
- Total lines: **~20,400** LoC (TS/TSX)
- **Solid: 59 files (76%)**
- Cracked: 3 files
- Severed: 3 files
- Stub: 2 files
- Gutted: 0 files
- Orphaned: 8 files
- Dormant: 3 files

**Plain-English summary.** The *live* email surface is healthy and genuinely
real-data-backed. `App.tsx:921` → `EmailClientWrapper` → **`EmailHybridClient`**
is the one and only email entry point; the `emailHybrid` feature flag and the
entire legacy `PulseEmailClientRedesign` 3-pane surface were retired in commit
`4e23f45` (Phase 11b, 2026-05-29). The hybrid Cockpit/Triage/Inbox surface reads
real Gmail-synced data from `cached_emails` through `emailSyncService` →
`emailStore` → `useCockpitData`/`useTriageQueue`, and send/snooze/schedule/
archive/search/AI-summary all wire to real services and the `ai-router` edge
function (server-side AI, per CLAUDE.md §4). Compose, settings, templates,
meeting/task extraction, and Google re-auth are all reachable and working.

The damage is concentrated in three places, none of which break a core
workflow:

1. **Two genuine runtime defects.** (a) `confidentialEmailService.create()` is
   wired into the live composer but writes to a `confidential_emails` table
   that **does not exist** on the live DB — confidential sends silently fail.
   (b) Three cosmetic fake-data / dead-button leaks in the live UI (SignalRow's
   collapsed AI chips do nothing; TriageDone shows fabricated session stats;
   CalendarPeekRail renders hardcoded mock events).

2. **A large body of intact-but-stranded code** orphaned by the Phase-11b
   deletion of the legacy client: the entire Campaigns trio, `FilterManager`,
   `LabelManager`, `FollowUpNudge`, `RelationshipPanel`, and the richer
   `EmailTemplatesModalEnhanced`. **None of these are broken** — they are
   complete, service-wired modules with no live host to mount them. This is a
   re-wire-or-cut decision (Rule A), not breakage.

3. **Two severed services pointing at missing tables.** `emailFilterService`
   (`email_filters`/`filter_execution_log` — missing) and `emailSignatureService`
   (`email_signatures` — missing) have no live consumer **and** no backing table.

**Fix first:** the confidential-send silent failure (real data loss surface),
then the three cosmetic fake-data leaks (they ship fake content to users today).
Everything else is a deliberate-deferral / re-wire decision.

---

## 1. Intended Purpose

Email is Pulse's **AI-triage-first email client**. From the user's perspective it
is a Gmail-backed inbox with three modes (toggle in the top bar):

- **Cockpit** — the default "command center": an AI daily-briefing header, a
  prioritized **Signals** list (high-`ai_priority_score` mail), categorized
  **Lanes**, an **Awaiting Replies** rail (sent mail with no response), and a
  calendar peek. Each signal expands inline to a reader with an AI summary card,
  one-click suggested replies, and meeting/action-item extractors.
- **Triage** — a focused, one-at-a-time "process the queue" flow (archive /
  snooze / reply / make-task / next) ending in a completion screen.
- **Inbox** — a conventional folder list view with bulk actions.

Supporting surfaces: a full compose modal (drafts, schedule-send, templates with
variables, confidential mode, Meet-link insertion, AI assist), a 5-tab settings
modal (accounts, vacation responder, blocked senders, notification rules, sync),
snooze/schedule pickers, and Google-auth status with re-connect. A separate
**Campaigns** sub-feature (segment builder + campaign builder + dashboard) exists
but is gated off for v1 (issue #105). The data spine is `cached_emails` (the
synced inbox cache), with Gmail proxied through the Express backend `server.js`
(`/api/gmail/proxy`, deployed at `pulse-api-1epw.onrender.com`) and AI routed
through the `ai-router` edge function.

---

## 2. What's Solid (Foundations — Don't Touch)

### Live UI spine (all SOLID, real-data-backed)
- **`EmailHybridClient.tsx`** (689 LoC) — the routed container. Real stores +
  services: sync (`emailSyncService.fullSync`), search with semantic→text
  fallback (`:259-266`), 30s-undo send (`:377-458`), re-auth, snooze, keyboard
  routing — all with error handling.
- **`CockpitView.tsx`** (128) — consumes live `useCockpitData()`. (`MOCK_LANES`
  import is legit lane *metadata*; `TRIAGE_QUEUE_IDS` default is never hit.)
- **`TriageView.tsx`** (402) — archive/snooze/task/reply wired to real handlers.
- **`EmailReaderPanel.tsx`** (105), **`EmailBody.tsx`** (64, DOMPurify-sanitized),
  **`SearchResultsView.tsx`** (134), **`FolderListView.tsx`** (281, bulk ops POST
  to `${BACKEND_URL}/api/email/bulk`), **`TriageCard/TriageQueueStrip/
  TriageActionToast`**, **`primitives.tsx`**, **`HybridKeyboardShortcutsModal`**.
- **Cockpit rails (real data):** `BriefingHeader`, `AwaitingRepliesRail`
  (sent-mail follow-up heuristic via `emailSyncService.getEmailsByFolder('sent')`),
  `SignalSection` (j/k/o/Enter nav), `LaneRow`, `LaneSection`, `LanesHelpTip`,
  `ComposeFab`.
- **Inline reader stack:** `InlineReader` (252, reply/archive/snooze/task all
  wired, lazy thread fetch), `EmailAiBlock` (144, composite), `GeminiSummaryCard`
  (176, reads pre-computed `_raw.ai_*`, quick-reply chips → `openReply`).
- **Chrome (all wired):** `CanvasTopBar`, `FoldersDropdown`, `FiltersDropdown`,
  `ActiveFiltersStrip`, `SegmentedModeToggle`, `HybridFirstRunScreen`,
  `HybridAuthErrorBanner`.

### Data layer (SOLID)
- **`emailStore` / `emailComposeStore` / `emailUIStore`** — Zustand; all actions
  call real `emailSyncService` methods hitting live tables; error handling + toasts.
- **`emailSyncService.ts`** (1421) — real Gmail sync + `cached_emails`,
  `email_threads`, `email_sync_state`, `snoozed_emails`, `scheduled_emails`,
  `email_templates`. Incremental historyId sync. *(One TODO: important/snoozed/
  spam folder counts hardcoded `0` at `:801-805`.)*
- **`emailAIService.ts`** (481) — routes 100% through `invokeAIPrompt`/
  `invokeAIJson` → `ai-router` edge fn. **No direct Gemini calls** (compliant).
- **`emailSearchService.ts`** (512) — `cached_emails` text search + IndexedDB
  offline fallback + semantic search via `ai-router` (`email_analysis`).
- **`emailTemplateService`** (415), **`emailSegmentService`** (208),
  **`emailAccountsService`** (137 — `email_accounts` **verified to exist live**),
  **`emailCampaignService`** (225 — works, but see §7 re: orphaned consumers +
  unsafe send loop), **`emailMeetService`** (46 — real Google Calendar Meet
  link), **`offlineEmailStorage`** (590 — complete IndexedDB layer).
- **Hybrid data hooks:** `useCockpitData` (190, **real store, no mock reads**),
  `useTriageQueue` (71, **real store**), `emailRow` (281, view-model adapter),
  `emailFilters` (55), `folderMeta` (37), `createTaskFromEmail` (172, real
  `taskService.createTask` → `extracted_tasks`, schema-aware, dedup-guarded).

### Standalone surfaces reachable from the live UI (SOLID)
- **`EmailComposerModal.tsx`** (1738) — `onSend`→`handleSendEmail`, Gmail draft
  save, schedule-send, AI assist, Meet link; localStorage autosave. *(Hosts
  `ScheduleSendModal`, `TemplatesModal`, `TemplateVariablesModal`,
  `confidentialEmailService` — see §3.)*
- **`EmailSettingsModal.tsx`** (1318) — 5 tabs, all wired to real services.
  *(One cosmetic crack — see §3.)*
- **`TemplatesModal`** (386), **`TemplateVariablesModal`** (149),
  **`SnoozeModal`** (168), **`ScheduleSendModal`** (174),
  **`GoogleAuthStatus`** (110, polls `supabase.auth.getSession()` every 60s),
  **`OfflineIndicator`** (127 — the `Compact` export is the live one),
  **`MeetingExtractor`** (416, deterministic regex, `onAddToCalendar` wired),
  **`ActionItemExtractor`** (414, real `tasks` insert; schema bug already fixed
  in `bc4d320`).
- **`EmailClientWrapper.tsx`** (26) + **`index.tsx`** (9) — thin adapters.

**Confidence:** all of the above were verified by tracing imports/handlers to
real services and (for the data layer) confirming the backing table exists on
the live DB. The cockpit/triage "is it real or mock?" question was explicitly
resolved: **real.** `mockEmails.ts` is design-reference fallback only (one
exception — see §5, CalendarPeekRail).

---

## 3. What's Cracked (Fixable With Targeted Repairs)

Sorted trivial-first.

| # | Item | Location | What's broken | Fix complexity | Cascade |
|---|------|----------|---------------|----------------|---------|
| 1 | **SignalRow dead AI chips** | `cockpit/SignalRow.tsx:115-125` | The 1-2 Claude-suggested-reply chips on a **collapsed** signal row use `onClick={(e) => e.stopPropagation()}` — a pure no-op. Never wired since the original mock scaffold (`06e07dc`). Same actions DO work once the row expands (InlineReader/GeminiSummaryCard route through `openReply`). | TRIVIAL | None — route to `openReply(email._raw, a.label)` like InlineReader |
| 2 | **EmailSettings General toggles** | `EmailSettingsModal.tsx:557,568,575` | "Auto-sync" / "Email Notifications" toggles + "Sync Frequency" select are `defaultChecked`/static — no state, no `onChange`, no persistence (decorative). The rest of the General tab (theme/accent/zoom/bundling/auto-archive/Drive) is real. | MODERATE | None |
| 3 | **`confidentialEmailService` → missing table** | `confidentialEmailService.ts` (called from `EmailComposerModal.tsx:366`) | Code is complete (real SHA-256 passcode hashing) and **wired into the live composer**, but target table **`confidential_emails` does not exist on the live DB** (verified). Every confidential send silently fails to the catch path. | COMPLEX (needs a migration + RLS, or feature-gate the UI) | Confidential-mode compose is non-functional; **only genuine data-path defect in the live surface** |
| 4 | **`useEmailHybridShortcuts` phase-stub keys** | `data/useEmailHybridShortcuts.ts:90-97,137` | The *live* shortcut hook. `c`/`?`/`/`/`b` work, but `Shift+N` (sync), `Ctrl+Z` (undo), and `g i/s/t/d` (folder nav) are **phase-stub toasts** ("lands in Phase 6/7"). The shortcuts modal honestly labels some as "(v1.1)". | MODERATE | Keyboard nav incomplete; non-blocking |

> **Note on #3:** This is the one that warrants real attention — it's wired,
> reachable, and silently loses the user's intent. Either ship the
> `confidential_emails` table (DDL exists in `supabase/migrations_backup/
> 20260114_confidential_emails.sql`) or gate the confidential toggle off until it
> does. Per CLAUDE.md schema rule, dry-run any new migration in a rolled-back
> transaction first.

---

## 4. What's Severed (Disconnected Wiring)

| Item | Location | The break | Reconnect? |
|------|----------|-----------|-----------|
| **`emailFilterService.ts`** (590) | service | No non-test consumer **and** backing tables `email_filters`/`filter_execution_log` **do not exist on live DB** (verified). Two internal stubs too (`'label'` returns false `:214`, `'forward'` logs only `:347`). | Re-wire only if filters feature is revived; needs both the host UI (`FilterManager`, §7) AND the tables (DDL in `migrations_backup/`). |
| **`emailSignatureService.ts`** (302) | service | No non-test consumer; backing table `email_signatures` **does not exist on live DB** (verified). Code itself is complete. | Tied to a signatures UI that doesn't exist on the hybrid surface. |
| **`Campaigns/SegmentBuilder.tsx`** (205) | component | SOLID code (real `emailSegmentService` CRUD + live preview count), but its **only** importer is `EmailCampaignBuilder` (`:570`) — which is itself an orphan with no live host. Severed-by-transitivity. | Reconnects automatically if Campaigns is re-hosted (§7). |

---

## 5. What's Stubbed (Fake Data / Never-Finished — in the LIVE surface)

| Item | Location | What it pretends to be | Work to make real | Priority |
|------|----------|------------------------|-------------------|----------|
| **TriageDone fabricated stats** | `hybrid/TriageDone.tsx:17` | The default `summary` ships hardcoded fake metrics — *"Your fastest session this week. ~14s per email. 22% quicker than last week."* No caller passes a real summary (`TriageView.tsx:304` renders it with none), so **every user sees fabricated stats**. The old stat-triplet was deliberately stripped (`7c327b7`) but this sentence survived. | Compute real session stats, or replace with a neutral line | HIGH (ships fake claims) |
| **CalendarPeekRail mock events** | `cockpit/CalendarPeekRail.tsx:18` (renders `mockEmails.ts` `MOCK_CALENDAR`) | Renders hardcoded events ("Q2 review · Maria Schaefer", etc.) as if real, whenever the footer strip is visible (`CockpitView.tsx:81,116`, i.e. when `awaitingReplies.length > 0`). Self-documented as deferred to a future calendar integration. | Wire to `googleCalendarService`, or hide the rail until integrated | HIGH (ships fake content) |
| **`emailTemplateService.generateTemplate()`** | `emailTemplateService.ts:397` | "AI-generate a template" — returns hardcoded `'Generated Subject'` (`// TODO: Integrate with AI`). | Route through `ai-router` like `emailAIService` | LOW (nice-to-have) |
| **`emailSyncService` folder counts** | `emailSyncService.ts:801-805` | important/snoozed/spam unread counts hardcoded `0` (`// TODO`). | Real count queries | LOW |
| **Campaigns dashboard rate columns** | `EmailCampaignsDashboard.tsx:410,415` | Open/click-rate columns render `"coming soon"` when `stats.sent===0`. | (inside an orphaned component — moot until re-hosted) | LOW |

---

## 6. What's Gutted (Was Better Before)

**None at the file level.** Two large historical teardowns happened, but both were
**clean generational replacements**, not destructive gutting of the current surface:

- **`f21aefd`** (2026-03-30) "complete Email audit revisal" — 29 files, +1940 /
  −4890. Deleted gen-1 UI (`PulseEmailClient`, `EmailComposer`, `EmailList`,
  `EmailSidebar`, `EmailViewer`, `EnhancedEmailClient`, `EmailLegacy`,
  `enhancedEmailService`) and **created the Zustand store trio**. Recoverable from
  before this commit if ever needed.
- **`4e23f45`** (2026-05-29, Phase 11b) "retire legacy surface + emailHybrid flag"
  — 12 files, +17 / **−4029**. Deleted gen-2 legacy `PulseEmailClientRedesign`
  (629), `EmailSidebarRedesign` (206), `EmailListRedesign` (548), `EmailViewerNew`
  (980), `DailyBriefing` (270) + `.css` (797), `FollowUpRemindersDropdown` (324),
  `KeyboardShortcutsModal` (117), `EmailHybridFlagToggle` (113). Recoverable from
  before this commit.

The current hybrid surface is the *intended successor* of both — not a
degradation. The real legacy of these deletions is the orphan inventory in §7
(components whose host was deleted but the components themselves survived).

---

## 7. What's Orphaned (Intact but No Live Path — Re-wire-or-Cut)

> **These are NOT dead/broken slop.** They are complete, service-wired modules
> stranded when their host (`PulseEmailClientRedesign`) was deleted in Phase 11b.
> Per CLAUDE.md Rule A, deletion requires an explicit approved pros/cons — these
> are listed for a **decision**, not auto-removal.

| Item | LoC | State | Importers | Recommendation |
|------|-----|-------|-----------|----------------|
| **`Campaigns/EmailCampaignBuilder.tsx`** | 900 | Rich, fully service-wired (campaign CRUD/send, segments, templates, AI generate, 3-step wizard); mounts `SegmentBuilder`. Flag `emailCampaigns` (`featureFlags.ts:185`, `enabled:false`) gated this **in the deleted legacy client** — flipping the flag now mounts nothing. | none mount it | INVESTIGATE — deliberately deferred (issue #105: `emailCampaignService.send()` is an unsafe per-recipient loop). Re-host or keep parked, don't delete. |
| **`Campaigns/EmailCampaignsDashboard.tsx`** | 555 | Real `emailCampaignService` list/duplicate/delete; `onNewCampaign`/`onEditCampaign` props nothing supplies. | none mount it | INVESTIGATE (pairs with Builder) |
| **`RelationshipPanel.tsx`** | 365 | Real `email_contacts`/`cached_emails` reads+notes save; designed as a 288px reader sidebar; hybrid `EmailReaderPanel` doesn't mount it. | none | INVESTIGATE — strong re-wire candidate into the reader |
| **`FollowUpNudge.tsx`** | 268 | Real sent-mail reply detection + urgency tiering + `settingsService`; touched by `f21aefd` "feature wiring" but no current host. | none | INVESTIGATE — re-wire into Cockpit/Glimpse |
| **`FilterManager.tsx`** | 578 | Full CRUD on `email_filters`/`email_labels` (but `email_filters` table missing live); UI-only (doesn't apply rules to incoming mail). | none | INVESTIGATE — needs host + tables to revive |
| **`LabelManager.tsx`** | 364 | Real CRUD on `email_labels` + applies labels to `cached_emails` (`:141-167`). | none | INVESTIGATE |
| **`EmailTemplatesModalEnhanced.tsx`** | 509 | Richer template modal (favorites, categories, usage tracking) than the live `TemplatesModal`. SOLID-quality. | none (active composer uses `TemplatesModal`) | INVESTIGATE — possible upgrade for the live composer, or cut as a dupe |
| **`useEmailKeyboardShortcuts.ts`** | 358 | Complete Gmail-style shortcut hook; superseded by `useEmailHybridShortcuts`. Only the `hooks/index.ts` barrel re-exports it. | none (functional) | DELETE candidate (superseded) — confirm no barrel consumer first |

---

## 8. Connection Map

### 8a. Route-to-Render Chain
```
App.tsx:20  lazy(() => import('./components/Email/EmailClientWrapper'))
App.tsx:921 <EmailClient user=… />        nav id 'nav-email' (App.tsx:203, AppView.EMAIL)
  → EmailClientWrapper.tsx:23  → <EmailHybridClient userEmail userName />   [SOLID]
    → reads: emailStore (cached_emails), emailUIStore, emailComposeStore,
             emailSyncService, emailSearchService, emailAIService (ai-router)
    → writes: emailSyncService (Gmail proxy + cached_emails/threads/sync_state/
             snoozed/scheduled), createTaskFromEmail → extracted_tasks
    → modes: CockpitView | TriageView | FolderListView | SearchResultsView   [all SOLID]
    → mounts: EmailSettingsModal(:645) EmailComposerModal(:653) SnoozeModal(:668)
    → top bar (CanvasTopBar): GoogleAuthStatus + OfflineIndicatorCompact
    → inline reader: InlineReader → EmailAiBlock → {GeminiSummaryCard,
             MeetingExtractor, ActionItemExtractor}
  EmailComposerModal mounts → ScheduleSendModal, TemplatesModal,
             TemplateVariablesModal; calls confidentialEmailService [CRACKED: table missing]
```

### 8b. Data Flow Map (live tables)
```
Gmail API ──(server.js /api/gmail/proxy)──> emailSyncService.fullSync
  → cached_emails (35 cols, uuid user_id, RLS on)   [SOLID]
    → emailStore.emails → useFilteredEmails / useCockpitData / useTriageQueue
      → CockpitView / TriageView / FolderListView / SignalSection
        → UI: signals, lanes, triage queue, folder list
email_threads     → emailSyncService.getThread → InlineReader (lazy)            [SOLID]
snoozed_emails    → emailSyncService.snooze* → SnoozeModal                      [SOLID]
scheduled_emails  → emailSyncService.scheduleEmail → ScheduleSendModal          [SOLID]
email_templates   → emailTemplateService + emailSyncService → TemplatesModal    [SOLID, dup impls]
email_segments + email_contacts → emailSegmentService → SegmentBuilder          [SOLID/SEVERED host]
email_campaigns   → emailCampaignService → Campaigns/* (ORPHANED host)          [SOLID/ORPHAN]
email_accounts    → emailAccountsService → EmailSettingsModal (verified live)   [SOLID]
extracted_tasks   → createTaskFromEmail → TriageView/InlineReader               [SOLID]
ai-router (edge)  → emailAIService / emailSearchService.semantic                [SOLID, server-side]
─ MISSING TABLES (verified absent on live DB) ─
confidential_emails  → confidentialEmailService ← EmailComposerModal            [CRACKED]
email_filters / filter_execution_log → emailFilterService (no consumer)         [SEVERED]
email_signatures     → emailSignatureService (no consumer)                      [SEVERED]
```

### 8c. Cross-Section Dependencies
```
THIS SECTION DEPENDS ON:
  AuthContext / supabase.auth        — session + provider_token (GoogleAuthStatus)
  googleCalendarService              — Meet links (emailMeetService), events (extractors)
  taskService → extracted_tasks      — createTaskFromEmail, ActionItemExtractor
  ai-router edge function            — all AI (summary/reply/analysis/semantic search)
  server.js (pulse-api on Render)    — /api/gmail/proxy, /api/email/{accounts,
                                       vacation-responder,blocked-senders,
                                       notification-rules,confidential,bulk,ai}
                                       (requires VITE_BACKEND_URL at build time)

OTHER SECTIONS THAT DEPEND ON THIS ONE (all imports RESOLVE — no broken links):
  Dashboard.tsx:37,518               → emailSyncService.getCategoryUnreadCounts()
  PulseAssistant/useAssistantContext → emailSyncService.getEmailsByFolder/getUnreadCount
  pulseAssistantService / searchQueryParser → type CachedEmail (from emailSyncService)
  contacts/ContactDetail.tsx:153     → reads cached_emails (contact email history)
  unifiedSearchService.ts:330        → reads the **emails** table (NOT cached_emails) ⚠
  memoryIngestService.ts:409         → reads cached_emails
  labelService.ts:272,323 / bulkOperationsService.ts:197-406 → mutate cached_emails

NO external component imports components/Email/* — coupling is service/table-level only.
```

**Highlighted broken/divergent connections:**
- `confidentialEmailService` → `confidential_emails` (table missing) — **broken**.
- `unifiedSearchService.ts:330` queries the legacy **`emails`** table (18 cols,
  `user_id text`, wide-open `"Allow all access" USING(true)` RLS), while the
  inbox uses **`cached_emails`**. Global search and the inbox read **different
  source tables** — a correctness divergence + a permissive-RLS security note on
  `emails`. (Outside the strict Email surface, but it's the section's data.)

---

## 9. UI Surface Audit

### 9a. Page-Level
| Check | Status | Notes |
|-------|--------|-------|
| Route exists and resolves | ✅ | `App.tsx:921`, `AppView.EMAIL` |
| Renders without console errors | ✅ | (static read; live smoke recommended for backend-dependent paths) |
| No blank/white sections | ⚠ | CalendarPeekRail shows **fake** events (not blank) — §5 |
| Loading state | ✅ | sync state surfaced via `emailSyncService.getSyncState()` |
| Empty state | ✅ | `folderMeta` empty states; `HybridFirstRunScreen` for no-auth |
| Error state | ✅ | `HybridAuthErrorBanner`, toast catches throughout |
| Navigation to/away | ✅ | lazy route + nav entry |
| Section tint / tokens | ✅ | coral reserved for AI surfaces (GeminiSummaryCard/AiChip) per CLAUDE.md §4 |

### 9b. Interactive Elements (defects only — the rest are wired)
| Element | Location | Handler | Connected? | Works? | Notes |
|---------|----------|---------|-----------|--------|-------|
| Collapsed signal AI chips | `SignalRow.tsx:115-125` | `stopPropagation` | No | **No** | §3 #1 — no-op since scaffold |
| General "Auto-sync"/"Notifications" toggles | `EmailSettingsModal.tsx:557,568` | — | No | No | §3 #2 — decorative |
| "Sync Frequency" select | `EmailSettingsModal.tsx:575` | — | No | No | decorative |
| Confidential send | `EmailComposerModal.tsx:366` | `confidentialEmailService.create` | Yes | **No** | §3 #3 — table missing |
| `Shift+N` / `Ctrl+Z` / `g i/s/t/d` | `useEmailHybridShortcuts.ts:90-137` | toast stubs | Partial | No | §3 #4 |
| DraftedForYou Send/Edit/X | `DraftedForYouRail.tsx:36-44` | none | No | n/a | DORMANT — rail only renders when `drafts.length>0`, always `[]` (v1.1) |
| InlineReader/TriageCard draft block | `InlineReader.tsx:221-229` | none | No | n/a | DORMANT — `emailRow.ts:227 draft:null` always, never renders |
| TriageView "Send draft" | `TriageView.tsx:90-92` | toast | No | n/a | DORMANT — gated on truthy `draft` |

### 9c. Missing UI Patterns (vs. expected for an email client)
- [x] Search / filter bar — `CanvasTopBar` + `FiltersDropdown` ✅
- [x] List virtualization / scroll — folder + signal lists ✅
- [x] Sort/filter controls — `ActiveFiltersStrip`, `useFilteredEmails` ✅
- [x] Bulk selection / actions — `FolderListView` (→ `/api/email/bulk`) ✅
- [x] Single-item action menu — triage/inline actions ✅
- [x] Detail view — `EmailReaderPanel` / `InlineReader` ✅
- [x] Compose / Edit — `EmailComposerModal` ✅
- [x] Delete confirmation — trash flows ✅
- [x] Refresh / sync indicator — sync state in top bar ✅
- [x] Toast feedback — throughout ✅
- [x] Keyboard shortcuts — `useEmailHybridShortcuts` (partial, §3 #4) ⚠
- [ ] **Signatures management UI** — service exists (`emailSignatureService`) but
      no UI on the hybrid surface, and table missing. **Gap.**
- [ ] **Filters/rules UI** — `FilterManager` exists but orphaned + table missing.
      **Gap (was a feature, now stranded).**
- [ ] **Drafts rail** — `DraftedForYouRail` present but dormant (v1.1). **Deferred.**
- [ ] **Calendar integration** — `CalendarPeekRail` shows mock data. **Stub.**
- [~] Import/Export — campaign/segment import exists but in orphaned Campaigns.

---

## 10. Repair Priority Queue

| Priority | Item | Category | Est. Complexity | Enables / Why |
|----------|------|----------|-----------------|---------------|
| 1 | Confidential send silently fails (table missing) | Cracked | COMPLEX (migration + RLS, or gate UI off) | Stops silent data-intent loss in live composer; DDL already in `migrations_backup/` |
| 2 | TriageDone fabricated session stats | Stub | TRIVIAL | Stops shipping fake claims to every triage user |
| 3 | CalendarPeekRail mock events | Stub | MODERATE (wire `googleCalendarService` or hide rail) | Stops shipping fake calendar content |
| 4 | SignalRow dead AI chips | Cracked | TRIVIAL | One-line `openReply` route; restores collapsed-row actions |
| 5 | EmailSettings General toggles wiring | Cracked | MODERATE | Real persistence of sync/notification prefs |
| 6 | `useEmailHybridShortcuts` stub keys (sync/undo/nav) | Cracked | MODERATE | Completes keyboard nav |
| 7 | **DECIDE** RelationshipPanel re-wire into reader | Orphaned | (decision) | Reconnects a complete 365-LoC feature into the live reader |
| 8 | **DECIDE** FollowUpNudge re-host | Orphaned | (decision) | Reconnects complete follow-up surfacing |
| 9 | **DECIDE** Campaigns trio: re-host vs park vs cut | Orphaned/Severed | (decision; blocked by #105 unsafe send loop) | 1,660 LoC + SegmentBuilder; needs send-loop safety first |
| 10 | **DECIDE** FilterManager/LabelManager + tables, or cut | Orphaned/Severed | (decision; needs tables from `migrations_backup/`) | Filters/labels feature revival |
| 11 | **DECIDE** EmailTemplatesModalEnhanced: upgrade composer or cut dupe | Orphaned | (decision) | Richer templates, or removes 509-LoC dupe |
| 12 | Delete `useEmailKeyboardShortcuts` (superseded) | Orphaned | TRIVIAL (after barrel check) | Removes 358 LoC dead hook |
| 13 | `emailTemplateService.generateTemplate` / folder-count TODOs | Stub | LOW | Polish |

> Items 7-13 are **Rule A decisions** — present pros/cons and get explicit
> approval before deleting or re-wiring any of them.

---

## 11. Git Forensics

**Recent section activity** (`git log -- src/components/Email/ src/services/email*.ts
src/store/email*.ts`): dominated by the Hybrid Cockpit redesign + a long tail of
`refactor(email)` token/coral polish. Top of log: `f255429 refactor(email): merge
Summary + Meeting + Tasks into one composite AI block`.

**Phase 11b — legacy surface removal:**
- `4e23f45` (2026-05-29 00:15) `refactor(email): retire legacy surface +
  emailHybrid flag (Phase 11b)` — 12 files, +17 / **−4029**. Deleted
  `PulseEmailClientRedesign`, `EmailSidebarRedesign`, `EmailListRedesign`,
  `EmailViewerNew`, `DailyBriefing`(+css), `FollowUpRemindersDropdown`,
  `KeyboardShortcutsModal`, `EmailHybridFlagToggle`. Collapsed `EmailClientWrapper`
  to a thin adapter; removed the `emailHybrid` flag (retirement-marker comment in
  `featureFlags.ts`). **This is the commit that orphaned the §7 inventory.**

**Earlier teardown:**
- `f21aefd` (2026-03-30 22:41) `feat(email): complete Email audit revisal` — 29
  files, +1940 / **−4890**. Killed gen-1 UI, created the Zustand store trio, wrote
  the `/api/email/*` endpoints into `server.js`. Doc: `docs/EMAIL_AUDIT_2026-03-30.md`.

**`emailHybrid` flag lifecycle:** `5c7dda5` (scaffold) → `c1bcf9a` (Phase 11a:
default true) → `4e23f45` (Phase 11b: removed). Flag fully retired; one email
surface remains.

**Recovery handles:** gen-1 UI recoverable from before `f21aefd`; gen-2 legacy
"Redesign" surface recoverable from before `4e23f45`; orphaned-table DDL intact in
`supabase/migrations_backup/20260114_email_*.sql`.

---

## Appendix — Full File Inventory & Classification (78 TS/TSX files)

### Core hybrid UI (33) — `src/components/Email/hybrid/**`
| File | LoC | Label |
|------|-----|-------|
| EmailHybridClient.tsx | 689 | SOLID |
| CockpitView.tsx | 128 | SOLID |
| TriageView.tsx | 402 | SOLID |
| TriageCard.tsx | 202 | SOLID |
| TriageDone.tsx | 56 | **STUB** |
| TriageQueueStrip.tsx | 86 | SOLID |
| TriageActionToast.tsx | 28 | SOLID |
| EmailReaderPanel.tsx | 105 | SOLID |
| EmailBody.tsx | 64 | SOLID |
| SearchResultsView.tsx | 134 | SOLID |
| FolderListView.tsx | 281 | SOLID |
| HybridKeyboardShortcutsModal.tsx | 231 | SOLID |
| primitives.tsx | 101 | SOLID |
| cockpit/BriefingHeader.tsx | 82 | SOLID |
| cockpit/ComposeFab.tsx | 25 | SOLID |
| cockpit/DraftedForYouRail.tsx | 53 | **DORMANT** |
| cockpit/AwaitingRepliesRail.tsx | 44 | SOLID |
| cockpit/CalendarPeekRail.tsx | 30 | **STUB** |
| cockpit/SignalSection.tsx | 141 | SOLID |
| cockpit/SignalRow.tsx | 159 | **CRACKED** |
| cockpit/LaneRow.tsx | 52 | SOLID |
| cockpit/LaneSection.tsx | 54 | SOLID |
| cockpit/LanesHelpTip.tsx | 120 | SOLID |
| cockpit/InlineReader.tsx | 252 | SOLID |
| cockpit/EmailAiBlock.tsx | 144 | SOLID |
| cockpit/GeminiSummaryCard.tsx | 176 | SOLID |
| chrome/HybridFirstRunScreen.tsx | 75 | SOLID |
| chrome/HybridAuthErrorBanner.tsx | 53 | SOLID |
| chrome/ActiveFiltersStrip.tsx | 93 | SOLID |
| chrome/CanvasTopBar.tsx | 144 | SOLID |
| chrome/FoldersDropdown.tsx | 101 | SOLID |
| chrome/FiltersDropdown.tsx | 200 | SOLID |
| chrome/SegmentedModeToggle.tsx | 111 | SOLID |

### Data layer (25) — `src/store`, `src/services`, `src/hooks`, `hybrid/data`, `src/types`
| File | LoC | Label |
|------|-----|-------|
| store/emailStore.ts | 235 | SOLID |
| store/emailComposeStore.ts | 131 | SOLID |
| store/emailUIStore.ts | 203 | SOLID |
| services/emailSyncService.ts | 1421 | SOLID (1 TODO) |
| services/emailAIService.ts | 481 | SOLID |
| services/emailSearchService.ts | 512 | SOLID |
| services/emailTemplateService.ts | 415 | SOLID (1 STUB method) |
| services/emailSegmentService.ts | 208 | SOLID |
| services/emailAccountsService.ts | 137 | SOLID (table verified live) |
| services/emailCampaignService.ts | 225 | SOLID (orphaned consumers) |
| services/emailMeetService.ts | 46 | SOLID |
| services/offlineEmailStorage.ts | 590 | SOLID |
| services/emailFilterService.ts | 590 | **SEVERED** (table missing) |
| services/emailSignatureService.ts | 302 | **SEVERED** (table missing) |
| services/confidentialEmailService.ts | 144 | **CRACKED** (table missing, wired) |
| hooks/useEmailKeyboardShortcuts.ts | 358 | **ORPHAN** |
| hybrid/data/useEmailHybridShortcuts.ts | 147 | **CRACKED** (stub keys) |
| hybrid/data/mockEmails.ts | 157 | **DORMANT** (1 live leak via CalendarPeek) |
| hybrid/data/useCockpitData.ts | 190 | SOLID |
| hybrid/data/useTriageQueue.ts | 71 | SOLID |
| hybrid/data/emailRow.ts | 281 | SOLID |
| hybrid/data/emailFilters.ts | 55 | SOLID |
| hybrid/data/folderMeta.ts | 37 | SOLID |
| hybrid/data/createTaskFromEmail.ts | 172 | SOLID |
| types/email.ts | 136 | **DORMANT** (legacy parallel model) |

### Standalone components (18) — `src/components/Email/**` (non-hybrid)
| File | LoC | Label | Importer |
|------|-----|-------|----------|
| EmailComposerModal.tsx | 1738 | SOLID | EmailHybridClient:653 |
| EmailSettingsModal.tsx | 1318 | SOLID (1 cosmetic crack) | EmailHybridClient:645 |
| TemplatesModal.tsx | 386 | SOLID | EmailComposerModal:1720 |
| TemplateVariablesModal.tsx | 149 | SOLID | EmailComposerModal:1728 |
| SnoozeModal.tsx | 168 | SOLID | EmailHybridClient:668 |
| ScheduleSendModal.tsx | 174 | SOLID | EmailComposerModal:1515 |
| GoogleAuthStatus.tsx | 110 | SOLID | CanvasTopBar:108 |
| OfflineIndicator.tsx | 127 | SOLID (`Compact` live) | CanvasTopBar:110 |
| MeetingExtractor.tsx | 416 | SOLID | EmailAiBlock:108 |
| ActionItemExtractor.tsx | 414 | SOLID | EmailAiBlock:123 |
| EmailTemplatesModalEnhanced.tsx | 509 | **ORPHAN** | none |
| FilterManager.tsx | 578 | **ORPHAN** | none |
| LabelManager.tsx | 364 | **ORPHAN** | none |
| FollowUpNudge.tsx | 268 | **ORPHAN** | none |
| RelationshipPanel.tsx | 365 | **ORPHAN** | none |
| Campaigns/EmailCampaignBuilder.tsx | 900 | **ORPHAN** | none mount |
| Campaigns/EmailCampaignsDashboard.tsx | 555 | **ORPHAN** | none mount |
| Campaigns/SegmentBuilder.tsx | 205 | **SEVERED** | EmailCampaignBuilder:570 (orphan) |

### Adapters (2)
| File | LoC | Label |
|------|-----|-------|
| EmailClientWrapper.tsx | 26 | SOLID |
| index.tsx | 9 | SOLID |

### Supporting (CSS, not integrity-classified)
| File | LoC |
|------|-----|
| hybrid/hybrid.css | 640 |
| email-composer.css | 384 |

### Infrastructure — migrations & edge functions
- **Live tables (verified present on `pulse-chat`):** `cached_emails` (35 cols),
  `emails` (18, `user_id text`, wide-open RLS ⚠), `email_threads`, `email_sync_state`,
  `snoozed_emails`, `scheduled_emails`, `email_templates`, `template_categories`,
  `email_segments`, `email_contacts`, `email_campaigns`, `email_accounts`,
  `email_labels`, `custom_labels`, `email_follow_ups`.
- **Verified ABSENT on live DB** (DDL only in `supabase/migrations_backup/`):
  `confidential_emails`, `email_filters`, `filter_execution_log`, `email_signatures`.
- **Edge functions:** no Gmail/IMAP/SMTP sync fn — Gmail is proxied via `server.js`
  `/api/gmail/proxy`. `send-email` (Resend), `send-security-alert`,
  `check-search-alerts`, `ai-router` (defines `email_draft`/`email_reply`/
  `email_analysis` tasks).

---

*Generated by `/section-triage Email` — forensic read of 78 source files across 4
parallel agents + live `pulse-chat` schema verification. No code was modified.*
