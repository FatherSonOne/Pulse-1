# Email Hybrid Redesign — Implementation Handoff

**Date:** 2026-05-27
**Direction locked:** Path A (Inline Toggle) — Cockpit-as-main + segmented-pill Triage mode
**Status:** Ready to implement
**Owner:** TBD (this doc is the handoff)

---

## 0. TL;DR

We are refactoring the Pulse Email surface from "inbox list + viewer split pane" into a **Cockpit + Triage** hybrid. The Cockpit is the main page (editorial briefing, themed lanes, drafts rail, inline reader expansion). The Triage Queue is a **mode** entered via a segmented pill or `⌘E`, exited via a Dismiss pill or `ESC`. Both modes are mounted simultaneously and cross-faded so queue progress survives flips.

**Reference playground:** [`_design-playground/email-redesign.html`](../_design-playground/email-redesign.html) — Path A is canonical. Read this first; the look, motion, and copy decisions live there.

**The non-negotiable:** **no existing feature gets silently dropped.** Section 4 (Feature Disposition Matrix) catalogues every user-facing capability in the current Email surface and assigns it one of four labels: **Preserved**, **Moved**, **Deferred (v1.1)**, or **Removed (with rationale)**. If something isn't in that matrix, stop and ask.

**Rollout:** behind a new feature flag `emailHybrid` (default OFF). Both UIs ship side-by-side until the flag flips.

---

## 1. Source of Truth

| Asset | Purpose |
|------|---------|
| `_design-playground/email-redesign.html` (Path A) | Canonical visual + interaction spec. Production code should match the playground's structure, copy, motion, and coral budget. |
| `CockpitView`, `TriageView`, `PathA` functions inside the playground | Component contracts to mirror in TSX. |
| `src/styles/pulse-tokens.css` + `src/App.css` | Design tokens are canonical. Do NOT redeclare colors locally. |
| Memory: `~/.claude/projects/f--pulse1/memory/project_pulse_email_redesign_direction.md` | Captured direction. |
| This handoff | Authoritative plan; supersedes anything in chat history. |

**If the playground and this doc disagree about a layout detail:** the playground wins for visuals; this doc wins for wiring/data/behavior.

---

## 2. Mental Model

```
            ┌─────────────────────────────────────────────────────┐
            │  Canvas top bar:                                    │
            │  [⌘ Cockpit | ◇ Triage · 6]  ⌘E switch    [Search] [⚙]│
            ├─────────────────────────────────────────────────────┤
            │                                                     │
            │  ┌──────────────────────┐  ┌────────────────────┐   │
            │  │ COCKPIT (default)    │  │ TRIAGE (mode)      │   │
            │  │                      │  │                    │   │
            │  │ DAILY BRIEFING       │  │ X/N · ~Ts left     │   │
            │  │ "Three things move"  │  │ ════════════════   │   │
            │  │  [Start triage · N]  │  │                    │   │
            │  │                      │  │ ┌──────────────┐   │   │
            │  │ SIGNAL · TODAY       │  │ │ Avatar       │   │   │
            │  │  ▸ Maria (#1/6)  ⌄   │  │ │ Subject      │   │   │
            │  │  ▸ Sarah (#2/6)  ⌄   │  │ │ ●AI briefing │   │   │
            │  │  ▸ Theo  (#3/6)  ⌄   │  │ │ Body…        │   │   │
            │  │                      │  │ │ [E][H][T]    │   │   │
            │  │ LANES                │  │ │ [Send draft] │   │   │
            │  │  Work / Admin / …    │  │ └──────────────┘   │   │
            │  │                      │  │                    │   │
            │  │ RIGHT RAIL           │  │ ✓ Snooze · Sarah   │   │
            │  │  Drafts · Awaiting   │  │   [UNDO]           │   │
            │  │  Calendar · Health   │  │                    │   │
            │  │                      │  │ KEYBOARD legend    │   │
            │  │  [Compose] FAB       │  │ [Dismiss × ESC]    │   │
            │  └──────────────────────┘  └────────────────────┘   │
            │       (one view active, the other faded)            │
            └─────────────────────────────────────────────────────┘
```

**Invariants:**

1. **State preservation across flips.** Triage `{ idx, actedLast }` lives in the orchestrator (or a dedicated store), not in `TriageView`. Cockpit scroll position survives because the view never unmounts.
2. **Coral is AI signal only.** Coral surfaces in the new UI: AI briefing strip in Triage cards, "Drafted for you" rail, AI summary chevrons in Signal rows, the Start-Triage CTA, the Inbox-Health insight tile. Cockpit chrome stays neutral. See `CLAUDE.md` § 4.
3. **Cockpit is the main read+draft surface.** The split-pane viewer goes away. Reading happens via inline expansion of Signal rows; drafting happens via the existing `EmailComposerModal` (kept verbatim).
4. **Triage is a session, not a page.** Entering it adds nothing to history; Dismissing returns you to Cockpit exactly where you were.

---

## 3. Current State — Architecture Audit Summary

> Detailed file-by-file inventory is at the end of this doc (Appendix A). High-level only here.

### 3.1 Orchestrator
- **`src/components/Email/PulseEmailClientRedesign.tsx`** (629 lines) — reads from 3 Zustand stores, owns first-run/never-connected screen, auth-error banner, sync flow with 30-sec undo-send toast, search, and renders sidebar + split-pane (list + viewer).
- Routing entry: `App.tsx:20` lazy-imports `EmailClientWrapper` (`EmailClientWrapper.tsx:12` is a 23-line shim that just unwraps `user.email` / `user.name` and renders `PulseEmailClientRedesign`).

### 3.2 Zustand Stores (all three persist; no cross-store imports)
- **`emailStore.ts` (236L)** — folder/category, emails[], selectedEmail, folderCounts, sync state, offline state, search query, viewMode (`'list' | 'thread'`), and all CRUD actions (`handleArchive`, `handleTrash`, `handleToggleStar`, `handleMarkUnread`, `loadEmails`, `loadMore`).
- **`emailComposeStore.ts` (132L)** — `showComposer`, `replyToEmail`, `prefilledBody`, `restoredComposer`, `pendingSends Map` (for 30-sec undo). Actions: `openCompose / openReply / openReplyAll / openForward / openFollowUp / restoreComposer / addPendingSend / removePendingSend`.
- **`emailUIStore.ts` (91L)** — `zoomLevel` (50–100), `density` (comfortable/default/compact), `accentColor`, `sidebarOpen`, `showBriefing`, `dismissedFollowUps Set`, `showKeyboardShortcuts`, `showEmailSettings`, `showReauthModal`, `nudgeFocused`, `currentView` (`'inbox' | 'campaigns'`), `editingCampaign`, `campaignRefreshKey`.

### 3.3 Components (28 files in `src/components/Email/`)
- **List + viewer:** `EmailListRedesign` (548L, bulk select), `EmailViewerNew` (980L, thread + move/important/print/block/spam menus + extractor panels).
- **Compose:** `EmailComposerModal` (1,425L) — schedule send, templates, tone check, smart compose, confidential mode (5 restrictions), Meet creation, Drive quick-attach, attachment preview.
- **Side panels:** `DailyBriefing` (270L), `FollowUpRemindersDropdown` (324L), `RelationshipPanel` (365L), `MeetingExtractor` (381L), `ActionItemExtractor` (361L), `FollowUpNudge` (268L).
- **Settings hub:** `EmailSettingsModal` (1,318L) — 5 tabs: General / Gmail / Sync / Automation / Accounts. Inside Automation: vacation responder, blocked senders, notification rules. Inside Accounts: multi-account support.
- **Sub-modals:** `SnoozeModal` (168L), `ScheduleSendModal` (145L), `TemplatesModal` (386L), `EmailTemplatesModalEnhanced` (509L), `TemplateVariablesModal` (149L), `KeyboardShortcutsModal` (117L), `FilterManager` (578L), `LabelManager` (364L).
- **Auth/Sync indicators:** `GoogleAuthStatus` (110L), `OfflineIndicator` (127L).
- **Campaigns (FLAGGED OFF):** `EmailCampaignsDashboard`, `EmailCampaignBuilder`, `SegmentBuilder`.
- **Shells:** `EmailClientWrapper` (23L), `index.tsx` (11L).

### 3.4 Services (16+)
`emailSyncService` (1,421L, the core), `gmailService` (980L, Gmail API wrapper), `offlineEmailStorage` (590L, IndexedDB), `emailAIService`, `emailTemplateService`, `emailFilterService`, `emailCampaignService` (UNSAFE/gated), `vacationResponderService`, `blockedSendersService`, `notificationRuleService`, `emailAccountsService`, `emailSearchService`, `smartComposeService`, `emailMeetService`, `confidentialEmailService`, `emailSignatureService`, `emailSegmentService`, `analyticsCollector`.

### 3.5 Keyboard hook
**`src/hooks/useEmailKeyboardShortcuts.ts` (359L)** — exhaustive Gmail-style shortcuts:

| Key | Action |
|-----|--------|
| `c` | Compose |
| `j` / `↓` | Next email |
| `k` / `↑` | Prev email |
| `o` / `Enter` | Open selected |
| `u` | Close email |
| `Shift+u` | Mark unread |
| `r` | Reply |
| `Shift+r` | Reply all |
| `f` | Forward |
| `e` | Archive |
| `#` / `Del` / `Backspace` | Trash |
| `s` | Star |
| `Shift+i` | Mark read |
| `b` | Snooze |
| `/` | Search |
| `Shift+n` | Refresh |
| `Ctrl+z` | Undo |
| `?` | Help modal |
| `g` then `i` | Go to Inbox |
| `g` then `s` | Go to Starred |
| `g` then `t` | Go to Sent |
| `g` then `d` | Go to Drafts |

Skips if a text input is focused (except `Escape`).

### 3.6 Feature flags
- **`emailCampaigns`** — default OFF, `src/lib/featureFlags.ts:187`. Gates the entire campaigns surface because `emailCampaignService.send()` is per-recipient/no-rate-limit/no-unsubscribe. Owning issue: #105.
- **NEW (this work):** `emailHybrid` — default OFF, gates whether `EmailClientWrapper` renders the new Cockpit or the legacy `PulseEmailClientRedesign`.

### 3.7 Routing
- `App.tsx:20` — lazy import: `const EmailClient = lazy(() => import('./components/Email/EmailClientWrapper'))`
- `App.tsx:199` — nav: `{ id: 'nav-email', label: 'Email', view: AppView.EMAIL, icon: 'fa-envelope' }`
- `App.tsx:914-915` — render: `case AppView.EMAIL: return user ? <EmailClient user={user} /> : null;`
- `App.tsx:500` — listens for `pulse:compose-email` custom event from Pulse Assistant (`send_email` action). Must continue to work.
- `sessionStorage('pulse_focus_nudge') === 'email'` — Daily Overview can deep-link into briefing focus state (`PulseEmailClientRedesign.tsx:114`). Must continue to work.

### 3.8 First-run / never-connected
`PulseEmailClientRedesign.tsx:414-449` renders an opinionated "One inbox, one surface." welcome screen with a Connect Google CTA. Triggers Google OAuth with full gmail scopes (`readonly`, `send`, `compose`, `modify`).

### 3.9 30-second undo-send flow
`PulseEmailClientRedesign.tsx:305-363` — custom toast with countdown + Undo button; on undo, `restoreComposer(params)` puts the user's content back into a fresh composer instance. **This is a critical UX feature** and must port verbatim.

---

## 4. Feature Disposition Matrix

> Every user-facing feature, with explicit disposition. Anything not listed is a bug in this doc — stop and surface.

### 4.1 Folders & navigation

| Feature | Current location | New location | Disposition | Notes |
|---------|------------------|--------------|-------------|-------|
| Inbox folder | Sidebar | Cockpit = inbox (default) | **Preserved** | The Cockpit IS the inbox. No "Inbox" nav button needed in v1 of hybrid. |
| Starred / Snoozed / Sent / Drafts / Important / All Mail / Trash / Spam | Sidebar | "More folders" dropdown in Cockpit top bar | **Moved** | Less prominent — bias users toward Cockpit. Dropdown opens a popover with the 8 folders + unread counts. Switching folders rebuilds the Cockpit lanes from that folder's emails (Cockpit only renders the briefing + signal section when in inbox; other folders show a simple list + reader expansion). See §5.4. |
| Folder unread counts | Sidebar pills | Inside the folders dropdown | **Preserved** | |
| Folder-specific empty copy (e.g. "No drafts saved.") | `EmailListRedesign.tsx:31-40` | Same copy, rendered in Cockpit's lane area when folder is empty | **Preserved** | |
| Mobile sidebar drawer | `sidebarOpen` in `emailUIStore` + `EmailSidebarRedesign` overlay | Cockpit mobile: hamburger opens folders dropdown as a sheet | **Preserved** | Same `sidebarOpen` state, repurposed UI. |

### 4.2 Inbox list features (`EmailListRedesign.tsx`)

| Feature | Current | New | Disposition |
|---------|---------|-----|-------------|
| Category tabs (Primary/Social/Promotions/Updates/Forums/Reservations/Purchases) | Inbox-only tab strip | **Cockpit lanes auto-derive from category.** Each category becomes a lane. | **Moved** |
| Category counts | Tab badge | Lane count badge | **Preserved** |
| Bulk select (checkbox per row + select-all) | List header bar | **Cockpit: only in folders other than inbox.** In inbox, Triage replaces bulk action. | **Moved** + augmented |
| Bulk Archive | Bulk action bar | Same, in non-inbox folders | **Preserved** |
| Bulk Delete | Bulk action bar (with confirm) | Same, in non-inbox folders | **Preserved** |
| Bulk Mark as Read | Bulk action bar | Same, in non-inbox folders | **Preserved** |
| Per-row hover actions (star/archive/snooze/trash) | Row hover | Per-row hover actions on lane rows AND signal rows | **Preserved** |
| Relative timestamps | `getRelativeTime()` | Same util, rendered in lane + signal rows | **Preserved** |
| Avatar colors (deterministic from sender id) | Local util | Same util; matches playground's `colorForId()` | **Preserved** |
| Pagination "Load more" | List footer | Lane footer "Load more" when expanded | **Preserved** |

### 4.3 Email viewer features (`EmailViewerNew.tsx`)

| Feature | Current | New | Disposition |
|---------|---------|-----|-------------|
| Read email body | Split-pane right side | **Inline expansion of Signal row** (Cockpit) **or full Triage card** (Triage mode) | **Moved** — viewer pane removed. See §5.3. |
| Thread view | Below body | **Inline expansion includes thread.** Each thread message stacks below the latest. | **Preserved** |
| Reply / Reply-all / Forward | Top bar buttons + composer | Same buttons, opens `EmailComposerModal` | **Preserved** |
| Star toggle | Top bar | Top of expanded reader + per-row hover | **Preserved** |
| Mark unread | Top bar | Same + `Shift+U` | **Preserved** |
| Archive | Top bar | Same + `E` | **Preserved** |
| Trash | Top bar | Same + `#` / `Del` | **Preserved** |
| Snooze | Top bar → `SnoozeModal` | Same + `B` | **Preserved** |
| Move menu (inbox/archive/spam/trash) | Dropdown | Same dropdown on reader expansion | **Preserved** |
| Mark important toggle | Move menu | Same | **Preserved** |
| Print email | "More" menu | Same | **Preserved** |
| Block sender | "More" menu → `blockedSendersService` | Same | **Preserved** |
| Report spam | "More" menu | Same | **Preserved** |
| Star pop animation | On click | Same micro-animation | **Preserved** |
| `MeetingExtractor` panel | Below body if AI detected a meeting | **Below body in inline reader** (same component) | **Preserved** |
| `ActionItemExtractor` panel | Below body | Same | **Preserved** |
| `RelationshipPanel` (contact intel: count, response time, strength, AI notes, custom notes, recent threads) | Right rail toggle | **Moved to Triage card metadata.** In Cockpit, hidden by default; expose via a "More about sender" disclosure in expanded reader. | **Moved (de-emphasized)** — keep the component, change the surface. Surface only on-demand. |

### 4.4 Compose features (`EmailComposerModal.tsx`)

**All compose features stay verbatim.** The modal is unchanged; only its trigger points move.

| Feature | Disposition |
|---------|-------------|
| New compose (`c` key, FAB, Compose button) | **Preserved** — Cockpit's bottom-right FAB + canvas top bar Compose chip + `c` key |
| Reply / Reply-all / Forward | **Preserved** |
| Follow-up template (`openFollowUp`) | **Preserved** |
| Schedule send → `ScheduleSendModal` | **Preserved** |
| Templates → `EmailTemplatesModalEnhanced` | **Preserved** |
| Template variables → `TemplateVariablesModal` | **Preserved** |
| Tone check (`emailAIService.checkTone`) | **Preserved** |
| Smart compose (auto-complete) | **Preserved** |
| Confidential mode (5 restrictions) | **Preserved** |
| Meet creation (`emailMeetService.createMeeting`) | **Preserved** |
| Drive quick-attach | **Preserved** |
| Attachment preview | **Preserved** |
| 30-second undo-send toast | **Preserved verbatim** — port `handleSendEmail` from current orchestrator to the new one (lines 305-363). |
| Composer restore on send failure | **Preserved** |
| `pulse:compose-email` custom event from Assistant | **Preserved** — listener stays in the orchestrator. |

### 4.5 AI / extraction features

| Feature | Current | New | Disposition |
|---------|---------|-----|-------------|
| **DailyBriefing component** (greeting + 4 stat cards + top 3 priority + Open Priority Inbox CTA + collapsed state) | Top of inbox area, `showBriefing` toggle | **Replaced by Cockpit's "Daily Briefing" header section.** The new editorial top ("Three things move today. Maria's deck, Sarah's NDA, Priya's reply.") IS the briefing. The 4 stat numbers (new/urgent/meetings/follow-ups) survive as the small `42 NEW SINCE 6 AM · 7 NEED YOU · 35 BATCHED` metadata strip. The "top 3 priority" list becomes the **Signal · today** section. | **Reimagined — same data, new presentation.** Component is retired; its data-fetching logic (the heuristics in `loadBriefing`) is hoisted into the Cockpit's data hook. |
| `DailyBriefing.css` | Co-located | Delete after migration (no longer used) | **Removed** |
| `briefing.greeting` ("Good morning/afternoon/evening") | Header line | Add as small line above editorial headline: `GOOD MORNING · WED MAY 27` | **Preserved** — tucked into the meta strip. |
| Briefing collapsed state | Click to expand | **N/A** — briefing is permanent in Cockpit. Replaced by the `showBriefing` toggle being repurposed: when false, the briefing headline + signal section collapse to a single one-liner. | **Reimagined** |
| Briefing focus nudge (sessionStorage flag from Daily Overview) | Scroll-to + rose tint | **Preserved** — same trigger, scrolls to Cockpit briefing top + brief rose tint on the headline. |
| `FollowUpNudge` (inline in composer/list) | Composer | **Preserved** — still rendered inside `EmailComposerModal` (unchanged). |
| `FollowUpRemindersDropdown` (top bar) | Top-right of header | **Moved into Cockpit right-rail as "AWAITING REPLIES" section.** The dropdown variant is retired in favor of a permanent rail panel showing the same data. | **Moved + reimagined** |
| `dismissedFollowUps Set` | `emailUIStore` | **Preserved** — rail uses the same dismiss mechanism. |
| `MeetingExtractor` | Below email body in viewer | **Preserved** — same component in inline reader expansion. |
| `ActionItemExtractor` | Below email body | **Preserved** — same component. |
| `RelationshipPanel` | Right side of viewer | **Moved** — on-demand disclosure inside inline reader. |
| AI-drafted reply per email (`email.draft` in playground mock) | **Does not exist in production yet.** The playground shows a mocked "Claude drafted" reply panel. | **NEW FEATURE** — needs a service call. Out of scope for this hybrid migration (would require `emailAIService.generateReply()`). Show as **placeholder UI only** for v1 of the hybrid; wire to real AI in v1.1. **MUST stub gracefully** — if no draft is available, hide the panel cleanly. |
| "Drafted for you" rail card | **Does not exist in production.** Playground mock. | **NEW FEATURE** — same as above. Stub for v1; wire to AI in v1.1. |
| "Inbox health" insight (e.g. "92% reply rate") | **Does not exist in production.** | **NEW FEATURE** — defer to v1.1. For v1 hybrid, **hide the panel entirely** rather than fake the data. |

### 4.6 Folder operations & per-email actions

| Feature | Current key | New key | Disposition |
|---------|-------------|---------|-------------|
| Toggle star (`s`) | `s` | `s` | **Preserved** |
| Archive (`e`) | `e` | `e` (Triage primary action; Cockpit row hover) | **Preserved** |
| Trash (`#`/`Del`) | `#`/`Del`/`Backspace` | Same | **Preserved** |
| Snooze (`b`) | `b` opens `SnoozeModal` | Same; in Triage, `H` is a Triage-shortcut for Snooze (per playground) — **reconcile:** both keys work in Triage. `B` opens modal, `H` snoozes with default (1 hour). | **Preserved + augmented** |
| Reply (`r`) | `r` | `r` | **Preserved** |
| Reply-all (`Shift+R`) | `Shift+r` | `Shift+r` | **Preserved** |
| Forward (`f`) | `f` | `f` | **Preserved** |
| Mark read (`Shift+I`) | `Shift+i` | `Shift+i` | **Preserved** |
| Mark unread (`Shift+U`) | `Shift+u` | `Shift+u` | **Preserved** |
| Compose (`c`) | `c` | `c` | **Preserved** |
| Search focus (`/`) | `/` | `/` | **Preserved** |
| Help modal (`?`) | `?` | `?` | **Preserved** |
| Refresh (`Shift+N`) | `Shift+n` | `Shift+n` | **Preserved** |
| Undo (`Ctrl+Z`) | `Ctrl+z` | `Ctrl+z` | **Preserved** |
| Open email (`o`/`Enter`) | Open in viewer | **Open inline expansion in Cockpit; advance to focal card in Triage.** | **Preserved with new semantics** |
| Close email (`Esc`) | Close viewer | **Esc closes inline expansion AND dismisses Triage** (when in Triage mode). Reconcile: in Triage, Esc = Dismiss (priority). In Cockpit with an expanded row, Esc = collapse. | **Preserved with mode-aware behavior** |
| Next/prev (`j`/`k`) | Navigate list | Navigate Cockpit signal rows + lane rows; advance/back in Triage queue | **Preserved with mode-aware behavior** |
| Go-to-folder (`g i / g s / g t / g d`) | Switch folder | Same; opens Cockpit on the target folder | **Preserved** |
| **NEW: Switch mode (`⌘E`/`Ctrl+E`)** | — | Flips Cockpit ↔ Triage | **NEW** (per playground) |
| **NEW: Triage Task (`T`)** | — | "→ Task" action — push email to Decisions & Tasks | **NEW** — requires hooking into the `decisionTaskHub` service or its equivalent. Check `src/components/decisions/`. If integration is unclear, **stub with a toast** for v1: "Task created (stub)" — log the intent to console + a TODO comment + a follow-up issue. |

### 4.7 Search & filters

| Feature | Current | New | Disposition |
|---------|---------|-----|-------------|
| Search input (`/` focuses) | Top bar | **Preserved** — Cockpit canvas top bar (right side) |
| Search execution (semantic via `emailSearchService` + fallback to `emailSyncService.searchEmails`) | `handleSearch()` | **Preserved** — same flow |
| Search clear button | Inline X | Same | **Preserved** |
| Filter rules (`FilterManager`, 578L) | Modal trigger from EmailSettingsModal | **Preserved** — accessed via Settings → Automation → Filters |
| Custom labels (`LabelManager`, 364L) | Modal trigger | **Preserved** — accessed via Settings → Automation → Labels |
| System Gmail labels | Read-only on emails | Same | **Preserved** |
| Label-color picker | LabelManager | Same | **Preserved** |

### 4.8 Sync, offline, auth

| Feature | Current | New | Disposition |
|---------|---------|-----|-------------|
| Manual sync button | Top bar `RefreshCw` icon | **Preserved** — Cockpit top bar right cluster |
| Sync success pulse (`syncPulseKey`) | Coral ring on icon | **Preserved** |
| Sync custom toast ("Synced N new emails") | Custom toast | **Preserved verbatim** |
| Sync error toast (with Retry) | Custom toast | **Preserved verbatim** |
| Auto-sync on mount (if last sync > 5 min) | `useEffect` | **Preserved** |
| Offline detection | `offlineEmailStorage.onConnectivityChange` | **Preserved** |
| Offline toast | "You're offline. Changes will sync when connected." | **Preserved** |
| Back-online toast + auto-sync of pending actions | Toast + `syncPendingActions()` | **Preserved** |
| Pending actions count badge | `OfflineIndicatorCompact` | **Preserved** — same component, same slot in top bar |
| `OfflineIndicatorCompact` component | Top bar | **Preserved as-is** |
| `GoogleAuthStatus` component (connected / expiring / expired) | Top bar | **Preserved as-is** |
| Auth error banner (amber, top of canvas) | Below header | **Preserved as-is** — render above Cockpit briefing |
| Re-auth modal (`ReconnectGoogleModal`) | Triggered from banner or status | **Preserved as-is** |
| Re-auth flow with `supabase.auth.signInWithOAuth` and gmail scopes | `handleReAuthenticate()` | **Preserved verbatim** |
| First-run "Connect Google" screen ("One inbox, one surface.") | Replaces entire UI when never-connected | **Preserved verbatim** — render before Cockpit when `gmailConnectionState === 'never'` |
| `pulse-email-zero-halo` animation | First-run | **Preserved** |
| Connection state detection (`provider_token` + `total_emails_cached` heuristic) | `useEffect` in orchestrator | **Preserved** |

### 4.9 Settings & preferences

| Feature | Disposition |
|---------|-------------|
| `EmailSettingsModal` (5 tabs: General/Gmail/Sync/Automation/Accounts) | **Preserved as-is** — Settings gear icon in Cockpit top bar opens it unchanged |
| Vacation responder | **Preserved** (Automation tab) |
| Blocked senders | **Preserved** (Automation tab) |
| Notification rules | **Preserved** (Automation tab) |
| Filter rules | **Preserved** (Automation tab → Filters) |
| Label manager | **Preserved** (Automation tab → Labels) |
| Multi-account support (`emailAccountsService`) | **Preserved** (Accounts tab) |
| Zoom (`50-100`) | **Preserved** — Cockpit applies zoom transform on its main content (same `scale(zoomLevel/100)` pattern) |
| Density (`comfortable/default/compact`) | **Preserved** — wraps `setZoomLevel` |
| Accent color (`rose/blue/purple/green`) | **Currently unused in production styling.** Carry it forward in `emailUIStore` but **defer** any new styling tied to it; the new design is coral-locked per CLAUDE.md. Document this in the Settings UI as "Coming soon." |
| Keyboard shortcuts modal (`?`) | **Preserved as-is**, updated to include `⌘E` (Switch mode) and `T` (Push to Task) |

### 4.10 Campaigns surface

| Feature | Disposition |
|---------|-------------|
| `EmailCampaignsDashboard` / `EmailCampaignBuilder` / `SegmentBuilder` | **Preserved (still gated OFF).** The `emailCampaigns` flag stays false. The Cockpit does NOT include a campaigns nav entry. When the flag eventually flips, add a "Campaigns" item to the More-folders dropdown. |
| `emailCampaignService.send()` (unsafe loop) | **Untouched** — do not refactor as part of this work. Issue #105 owns it. |
| `setCurrentView('campaigns')` / `setEditingCampaign` actions in `emailUIStore` | **Preserved** — keep the state plumbing in place for when the flag flips |

### 4.11 External integrations & event listeners

| Feature | Disposition |
|---------|-------------|
| `pulse:compose-email` custom event (from Pulse Assistant) | **Preserved** — listener moves with the orchestrator |
| `sessionStorage('pulse_focus_nudge') === 'email'` deep-link from Daily Overview | **Preserved** — triggers scroll-to-briefing + rose tint, same behavior |
| `analyticsCollector.trackMessageEvent` on send success | **Preserved verbatim** |
| `useRoutePreload` reference to PulseEmailClientRedesign | **Update** — switch to the new entry point or the wrapper (which now contains the flag branch) |
| Pulse Assistant context (`useAssistantContext.ts`) — may pass current selected email | **Verify** — if Assistant reads `selectedEmail`, keep `selectedEmail` populated in `emailStore` when a Cockpit row is expanded |

### 4.12 Bottom-right keyboard shortcut hint icon

| Feature | Disposition |
|---------|-------------|
| Floating help button (`fixed bottom-4 right-4`) | **Preserved** but moved to **top bar** in Cockpit (the FAB collision with Compose was already noted in playground polish work) |

### 4.13 Mobile

| Feature | Disposition |
|---------|-------------|
| Mobile FAB compose (`bottom-20 right-4`) | **Preserved** — same z-index/style |
| Mobile sidebar drawer | **Preserved** — repurposed as folder-dropdown sheet |
| Mobile-only viewer takeover | **Preserved by inline expansion** — mobile shows expanded reader full-width; Cockpit signal/lane scroll behind |
| Triage on mobile | **TBD** — playground hasn't been tested at mobile widths. v1 of hybrid: hide Triage mode on `< md` (md: 768px). The seg-toggle pill collapses to a single "Cockpit" label on mobile, with a follow-up issue tracked to design mobile Triage. |

---

## 5. New Architecture

### 5.1 Component tree

```
src/components/Email/
├── EmailClientWrapper.tsx            ← branches on emailHybrid flag
├── PulseEmailClientRedesign.tsx      ← legacy (unchanged until flag flips)
├── hybrid/                            ← NEW
│   ├── EmailHybridClient.tsx         ← new orchestrator (replaces PulseEmailClientRedesign behind flag)
│   ├── CockpitView.tsx               ← editorial briefing + signal + lanes + right rail
│   ├── TriageView.tsx                ← focal-card queue + Dismiss
│   ├── TriageCard.tsx                ← single-email focal card (subject, AI strip, body, actions)
│   ├── TriageActionToast.tsx         ← floating "✓ Archive · Maria · UNDO"
│   ├── TriageDone.tsx                ← end state with halo + stats
│   ├── cockpit/
│   │   ├── BriefingHeader.tsx        ← serif headline + meta + Start-Triage CTA
│   │   ├── SignalSection.tsx         ← curated high-priority items
│   │   ├── SignalRow.tsx             ← row with inline reader expansion + queue pip
│   │   ├── InlineReader.tsx          ← expanded body + thread + Reply/Archive/Snooze/Task actions
│   │   ├── LaneSection.tsx           ← collapsible category lane
│   │   ├── LaneRow.tsx               ← compact row
│   │   ├── DraftedForYouRail.tsx     ← rail panel (stub for v1, AI-wired in v1.1)
│   │   ├── AwaitingRepliesRail.tsx   ← rail panel (powered by current follow-up logic)
│   │   ├── CalendarPeekRail.tsx      ← rail panel (today's events, links to Calendar section)
│   │   └── ComposeFab.tsx            ← floating Compose button
│   ├── chrome/
│   │   ├── SegmentedModeToggle.tsx   ← [Cockpit | Triage · N] + ⌘E hint
│   │   ├── FoldersDropdown.tsx       ← Starred/Snoozed/Sent/etc. popover
│   │   └── CanvasTopBar.tsx          ← assembles toggle + search + sync + settings
│   └── data/
│       ├── useCockpitData.ts         ← briefing fetch + signal selection + lane bucketing
│       ├── useTriageQueue.ts         ← derives the queue, exposes idx + advance + undo
│       └── useEmailHybridShortcuts.ts ← wraps useEmailKeyboardShortcuts + ⌘E + T
└── (all existing components stay untouched — they're reused as-is from the new code)
```

### 5.2 State management

**No new global store needed.** Reuse the three existing Zustand stores. Add:

1. **In `emailUIStore`:**
   - `emailHybridMode: 'cockpit' | 'triage'` (default `'cockpit'`)
   - `triageState: { idx: number; actedLast: { label: string; sender: string; idx: number } | null }` (default `{ idx: 0, actedLast: null }`)
   - `expandedSignalRowId: string | null` (default `null`) — which Signal row's inline reader is open
   - Actions: `setEmailHybridMode`, `setTriageState`, `setExpandedSignalRowId`, `dispatchTriageAction(label, emailId)` (advances + records action toast + invokes the matching emailStore action — wrap `handleArchive`/`handleTrash`/etc.)

2. **Derived from `emailStore`:**
   - `triageQueueIds: string[]` — memoized selector: unread + high-priority emails in inbox, ordered by priority score then recency. Excludes ones already dispatched in the current session (tracked via `triageState.idx`).

3. **Cockpit data hook (`useCockpitData`):**
   - Wraps the briefing logic currently in `DailyBriefing.loadBriefing` (the heuristics: ai_priority_score ≥ 70 / sentiment=urgent for "urgent"; thread reply detection for "follow up"; meeting detection for "meetings"; top 3 priority for "signal").
   - Returns `{ briefingMeta, signalEmails, laneBuckets, loading }`.

### 5.3 Reader expansion vs Triage card

**Inline reader (Cockpit Signal row click):**
- Click signal row → row expands inline (accordion) below the click target.
- Renders: full body, thread (if `threadCount > 1`, fetched via `emailSyncService.getThread`), `MeetingExtractor` + `ActionItemExtractor` if AI detected anything, "Drafted for you" panel if available, action bar (Reply/Reply-all/Forward/Archive/Snooze/Star/Move/More).
- A "More about sender" disclosure reveals `RelationshipPanel` content inline.
- Closing: click row header again, click outside (optional), or `Esc`.

**Triage card (focal mode):**
- Full-card focus: subject, AI briefing strip (coral), body, action bar (Archive E / Snooze H / →Task T / Reply R or Send draft ⌘↵).
- Per playground: mini-stack of next 2 cards peeking behind to telegraph depth.
- Drafted-reply panel below body if available.
- Action toast renders above the stage on action.
- Dismiss pill in top-right of Triage top bar with `ESC` keycap.

Both surfaces call the same `emailStore` actions for archive/star/etc.

### 5.4 Folders other than inbox

When the user clicks a non-inbox folder (Starred/Snoozed/Sent/Drafts/etc.) from the folders dropdown:
- Cockpit's briefing + signal section **hide**.
- Cockpit renders a **single full-width lane** of that folder's emails, each row click-to-expand into the inline reader.
- The right rail can stay (Drafts / Awaiting / Calendar still relevant) OR collapse — recommendation: **collapse** the right rail in non-inbox folders to give the list room. Add a "Show rail" toggle in the canvas top bar to override.
- Bulk-select returns (checkbox column on each row, top-bar bulk-action strip when items selected).

### 5.5 Triage queue composition

The Triage queue is a **derived view** from `emailStore.emails` (inbox + unread + priority sort), NOT a separate persistence:
- Source: `emails.filter(e => !e.is_read && e.ai_priority_score >= 60).sort((a,b) => b.ai_priority_score - a.ai_priority_score)`
- Tuneable thresholds — start with the values above; expose in Settings later.
- Capped at 20 items per session (avoid overwhelming users; "Triage cleared" with 20 still feels great).
- When user takes an action (Archive/Snooze/etc.) it calls the matching `emailStore` action AND advances `triageState.idx`. The next card pops in.
- Undo: rewind `idx` AND undo the underlying action (Star toggle is symmetric; Archive needs `emailSyncService.unarchive` if available, or a refetch of the affected email).

---

## 6. Implementation Phases

> Each phase is independently mergeable. Land them in order. **Commit after each phase** (per CLAUDE.md § 1).

### Phase 0 — Scaffolding (1 sitting)

**Goal:** Flag, file structure, no behavior change.

1. Add `emailHybrid` flag to `src/lib/featureFlags.ts` (default `false`, owner: this work). Follow the `emailCampaigns` template at line 187. Document override: `?ff_emailHybrid=on`.
2. Create `src/components/Email/hybrid/` folder and stub files listed in §5.1. Each stub: `export default function X() { return <div>X</div>; }` — enough to compile.
3. Update `EmailClientWrapper.tsx` to branch:
   ```tsx
   const useHybrid = useFeatureFlag('emailHybrid', user.id, false);
   return useHybrid
     ? <EmailHybridClient userEmail={user.email} userName={user.name} />
     : <PulseEmailClientRedesign userEmail={user.email} userName={user.name} />;
   ```
4. Add `emailHybridMode`, `triageState`, `expandedSignalRowId` to `emailUIStore.ts` with default values and setters.
5. **Acceptance:** repo builds; legacy email surface unchanged; `?ff_emailHybrid=on` renders the placeholder hybrid shell.
6. Commit: `feat(email): scaffold emailHybrid flag and hybrid/ directory`.

### Phase 1 — Cockpit shell (no real data)

**Goal:** Mount CockpitView with mock data matching the playground, end-to-end.

1. Port the playground's HTML/CSS into TSX components in `hybrid/cockpit/`. Use Pulse tokens via `pulse-*-color` Tailwind classes already in use (`src/styles/pulse-tokens.css`). NO inline color values.
2. Implement `BriefingHeader`, `SignalSection` + `SignalRow`, `LaneSection` + `LaneRow`, right rail (`DraftedForYouRail`, `AwaitingRepliesRail`, `CalendarPeekRail`, Inbox Health placeholder), `ComposeFab`.
3. Mock data via local consts — same Maria/Sarah/Theo/Priya as the playground.
4. Verify: matches the playground visually in both themes; signal row hover state; inline reader expansion (with mock body).
5. Commit: `feat(email): cockpit shell with mock data behind hybrid flag`.

### Phase 2 — Cockpit wired to real data

**Goal:** Real emails flow into the Cockpit.

1. Build `useCockpitData()`. Port `DailyBriefing.loadBriefing` heuristics in (greeting + 4 counts + top-3 priority + meeting detection). Replace mock data in components with hook return.
2. Lane bucketing: derive lane = `email.labels` mapping (Primary → Work, Promotions → News, Updates → Tools, Forums → Personal, etc.). Use a single `categorize(email)` util — document the mapping in code comments.
3. Signal rows: top 3 unread by `ai_priority_score` (matches DailyBriefing's current logic).
4. Inline reader expansion calls `emailSyncService.getThread()` if `threadCount > 1`. Lazy-loaded — only fetched when row expands.
5. Row actions wire to `emailStore.handleArchive / handleTrash / handleToggleStar / handleMarkUnread`.
6. Wire Compose FAB to `openCompose`.
7. Wire `pulse:compose-email` listener and `pulse_focus_nudge` sessionStorage trigger (port from current orchestrator).
8. **Verify:** real emails appear in Cockpit; inline reader shows real body; archive removes from list; compose modal opens; deep-link from Daily Overview works.
9. Commit: `feat(email): cockpit wired to live data + briefing heuristics`.

### Phase 3 — Mode toggle + Triage shell

**Goal:** ⌘E toggles to a stub Triage view.

1. Implement `SegmentedModeToggle` (matches playground: `[Cockpit | Triage · N]` + count badge + has-items pulse + ⌘E hint).
2. Implement view-shell cross-fade: both Cockpit and Triage mount; CSS classes `.view-active` / `.view-inactive` per playground styles.
3. Hook ⌘E / Ctrl+E global keydown to toggle `emailHybridMode` (skip if a text input is focused).
4. Implement `TriageView` skeleton: top bar (queue counter + progress bar + Dismiss pill), stage area, keyboard legend, "Back to cockpit" link.
5. Implement `TriageCard` with mock email (subject, AI briefing strip, body, action bar with Archive E / Snooze H / → Task T / Reply R or Send draft ⌘↵).
6. `TriageActionToast` floats above stage with sender name + Undo (per playground).
7. `TriageDone` with halo rings + 3-stat card (Streak / Avg per email / Vs last week) — for now, stats are static numbers; wire later.
8. Dismiss flow: pill click OR `ESC` (mode-aware: `Esc` in Triage = dismiss to Cockpit; `Esc` in Cockpit with expanded row = collapse row).
9. **Verify:** can toggle modes; queue counter shows mock 6; state preserves across flips; Esc and Dismiss both work; action toast appears.
10. Commit: `feat(email): triage mode toggle + shell behind hybrid flag`.

### Phase 4 — Triage wired to real queue

**Goal:** Triage operates on the real inbox.

1. Build `useTriageQueue()` selector (memoized, derived from `emailStore.emails` per §5.5).
2. `TriageCard` renders the real email at `triageState.idx`.
3. Actions: Archive → `handleArchive(email)` + advance; Snooze → `setShowSnoozeModal` + `SnoozeModal` (existing) → `emailSyncService.snoozeEmail` + advance; Trash → `handleTrash` + advance; Reply → `openReply` + advance after compose modal closes (don't auto-advance on the reply button, only on send); Star → toggle (don't advance, it's a meta action).
4. → Task button: stub for v1 — show toast "Pushed to Tasks (stub)" + log TODO + create follow-up issue. Check `src/components/decisions/DecisionTaskHub.tsx` first; if there's a clean service hook, use it. **Do not block this phase on Task integration.**
5. Undo: rewind `idx`, re-fetch the affected email (or call the inverse action: `unarchive`, `restoreFromTrash`).
6. Per-card mount animation: `key={email.id}` + `card-in` CSS animation (per playground).
7. **Verify:** Triage shows real unread+priority emails; Archive/Snooze/Trash all work; undo works; reaching end shows Done state; pressing `⌘E` back to Cockpit preserves position; pressing back to Triage resumes mid-queue; cleared items show CLEARED pip on Cockpit signal rows.
8. Commit: `feat(email): triage queue wired to live data + actions`.

### Phase 5 — Keyboard shortcut reconciliation

**Goal:** All existing shortcuts work; new ones land cleanly.

1. Build `useEmailHybridShortcuts` — wraps the existing `useEmailKeyboardShortcuts` and adds:
   - `⌘E` / `Ctrl+E` → toggle mode (global; skips text inputs)
   - `T` → in Triage, push current to task; elsewhere, no-op
   - `H` → in Triage, snooze with default (1 hour) — `B` still opens the modal for custom time
2. Reconcile Esc behavior: priority order is `composer open → close composer` → `in triage → dismiss to cockpit` → `signal row expanded → collapse` → `selected email in cockpit → deselect`.
3. Reconcile `j`/`k` semantics: Cockpit = navigate visible signal/lane rows; Triage = no-op (advance only via actions).
4. Reconcile `o`/`Enter`: Cockpit selected row = expand; Triage = no-op.
5. Update `KeyboardShortcutsModal` to include the new shortcuts + a "Hybrid" section.
6. **Verify:** all 22+ shortcuts behave correctly; help modal accurately reflects bindings.
7. Commit: `feat(email): reconcile keyboard shortcuts for hybrid mode`.

### Phase 6 — Folders dropdown + non-inbox folder rendering

**Goal:** Other folders render in Cockpit shell.

1. `FoldersDropdown` component: popover with 8 system folders + counts; closes on selection.
2. When `currentFolder !== 'inbox'`: hide briefing + signal section; render a full-width lane of that folder's emails with bulk-select + per-row hover actions.
3. Right rail: collapse to hidden by default; add "Show rail" toggle in canvas top bar.
4. Empty states per folder (port copy from `EmailListRedesign.FOLDER_EMPTY_COPY`).
5. **Verify:** switch through all 8 folders; bulk-select works in non-inbox; empty states render.
6. Commit: `feat(email): folders dropdown + non-inbox cockpit rendering`.

### Phase 7 — Compose, undo-send, top-bar chrome

**Goal:** All compose paths and right-side top bar work identically to legacy.

1. Port `handleSendEmail` (30-sec undo flow) verbatim from legacy orchestrator to `EmailHybridClient`.
2. Wire all compose triggers: FAB, top-bar Compose chip (add one to canvas top bar), `c` key, signal row "Reply", `pulse:compose-email` event.
3. Port the canvas top-bar right cluster: `FollowUpRemindersDropdown` (or its new rail equivalent — see §4.5), `GoogleAuthStatus`, `OfflineIndicatorCompact`, `Briefing` toggle (re-purposed as Cockpit collapse), Sync `RefreshCw`, Settings `Settings`.
4. Port auth error banner (above Cockpit) + first-run "Connect Google" screen (replaces Cockpit entirely when never-connected).
5. Re-auth modal triggers preserved.
6. **Verify:** compose works from every trigger; undo-send works; first-run shows; auth banner appears on token expiry; sync icon spins + pulses on success.
7. Commit: `feat(email): port compose, sync, auth, and first-run flows to hybrid`.

### Phase 8 — Settings, search, modals

**Goal:** Settings, search, and remaining modals all behave identically.

1. `EmailSettingsModal` triggered from gear icon — no changes needed inside the modal, just the trigger.
2. Search: port `handleSearch` semantic+fallback flow; results override the Cockpit lanes (or render in a dedicated search view — recommendation: render in a single full-width lane labeled "Search results · N for 'query'", with a Clear button).
3. `KeyboardShortcutsModal` from `?` key.
4. `SnoozeModal` from `B` key or per-row snooze.
5. `ScheduleSendModal` from composer (untouched).
6. `EmailTemplatesModalEnhanced` from composer (untouched).
7. `ReconnectGoogleModal` from auth banner (untouched).
8. `FilterManager` + `LabelManager` from Settings → Automation (untouched).
9. **Verify:** all modals open + close; search works; settings save.
10. Commit: `feat(email): port settings, search, and modal triggers to hybrid`.

### Phase 9 — Mobile + responsive

**Goal:** Hybrid works at narrow widths.

1. At `< md` (768px): hide Triage mode; the seg-toggle pill collapses to just "Cockpit"; ⌘E becomes no-op.
2. Cockpit right rail collapses to a single "Insights" sheet (slide-up from bottom) on mobile.
3. Signal row expansion goes full-width.
4. FAB compose preserved (`bottom-20 right-4`).
5. Folder dropdown becomes a full-height drawer (re-use the existing `EmailSidebarRedesign` overlay pattern).
6. **Verify on iPhone 12 viewport (390x844):** Cockpit reads cleanly; expansion works; compose opens; folder drawer works.
7. Commit: `feat(email): mobile + responsive treatment for hybrid`.

### Phase 10 — QA + accessibility pass

**Goal:** Hybrid is keyboard-only navigable and screen-reader sane.

1. Tab order: top bar → toggle → folders → search → sync → settings → briefing CTA → signal rows → lane headers → rail → FAB.
2. `aria-pressed` on seg-toggle buttons.
3. `aria-expanded` on signal rows.
4. `aria-live="polite"` for the action toast in Triage.
5. Focus management: when Triage activates, focus moves to the first action button; when dismissed, focus returns to the seg-toggle.
6. All icon-only buttons get `aria-label`.
7. Reduced motion: `@media (prefers-reduced-motion)` disables the halo rings + slide animations; cross-fade becomes opacity-only.
8. Color contrast: spot-check coral text on canvas in both themes meets WCAG AA.
9. Lighthouse pass in both themes.
10. Commit: `chore(email): a11y + reduced-motion pass on hybrid`.

### Phase 11 — Flag flip + legacy cleanup

**Goal:** Hybrid becomes default; legacy is deletable.

1. Flip `emailHybrid` default to `true` in `featureFlags.ts`.
2. Optional dev-override stays for emergency rollback (`?ff_emailHybrid=off`).
3. After a 2-week soak, delete:
   - `src/components/Email/PulseEmailClientRedesign.tsx`
   - `src/components/Email/DailyBriefing.tsx` + `DailyBriefing.css`
   - `src/components/Email/EmailListRedesign.tsx`
   - `src/components/Email/EmailViewerNew.tsx`
   - `src/components/Email/EmailSidebarRedesign.tsx`
   - `src/components/Email/FollowUpRemindersDropdown.tsx` (replaced by rail panel)
4. Update `EmailClientWrapper.tsx` to render `EmailHybridClient` directly (drop the branch).
5. Update `index.tsx` exports.
6. Commit (two commits — flag flip, then cleanup after soak): `feat(email): flip emailHybrid default to true` then `chore(email): remove legacy email components after hybrid soak`.

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Reader expansion accordion feels cramped vs current split-pane | Med | UX regression for long emails | Allow max-height with internal scroll; offer "Open in full" button that lifts the body into a temporary fullscreen overlay (only when user opts in). |
| Bulk-select disappearing on inbox confuses power users | High | Workflow disruption | Inbox lanes ARE bulk-actionable via Triage; non-inbox folders keep classic bulk-select. Add a tooltip on the Triage button: "Bulk-archive everything in queue: use Triage." |
| AI-drafted reply panel is empty (no service yet) → looks broken | High | Perception of unfinished work | Conditional render: only show "Drafted for you" rail card + Triage card draft panel when `email.draft` is populated. For v1, this will be most-of-the-time empty. Hide cleanly. Track v1.1 issue: wire `emailAIService.generateReply()`. |
| Inbox health insight panel without real data | Med | Same as above | Hide entirely for v1. No "Coming soon" placeholder — just absent. |
| `RelationshipPanel` getting buried might surprise users who rely on it | Low | Mild | Inline "More about sender" disclosure is one-click. Document in release notes. |
| Triage Esc behavior conflicting with existing Esc-closes-viewer muscle memory | Med | Confusion | The legacy viewer is gone, so the prior Esc binding is moot. Triage Esc behavior matches Linear/Hey. Document in `?` modal. |
| Triage queue size of 20 feels arbitrary | Low | Workflow | Expose `triageQueueLimit` in Settings later. Start at 20. |
| 30-sec undo-send breaks if orchestrator unmounts | Critical | Lost emails | Same risk exists today. Port the exact pattern. The `pendingSends` Map in `emailComposeStore` survives because it's in Zustand. Verify with a manual test (start send → navigate away → come back → undo). |
| Auth error banner above briefing pushes content down | Low | Layout shift | Acceptable; matches legacy. |
| `pulse_focus_nudge` deep-link from Daily Overview no longer works | High | Cross-section integration breaks | Port the listener verbatim in Phase 2. Add an e2e test in Phase 10. |
| Pulse Assistant `send_email` action no longer fires composer | High | Assistant feature broken | Port the `pulse:compose-email` listener verbatim in Phase 7. Add e2e test. |
| Zoom transform on Cockpit (50-100%) breaks layout at extreme values | Med | Visual regression | Apply zoom only to main Cockpit content (not the canvas top bar). Test 50/80/100. |
| `useRoutePreload` references legacy component path | Low | Bundle preload wrong | Update reference in Phase 0. |
| Mobile Triage hidden but ⌘E still mapped on tablet keyboard | Low | Confusion | Mobile breakpoint check inside the shortcut handler — skip ⌘E if `window.innerWidth < 768`. |

---

## 8. Acceptance Criteria

### 8.1 Behavioral

- [ ] With `emailHybrid=off`, the email surface is bit-identical to today (visual diff + e2e regression).
- [ ] With `emailHybrid=on`, the Cockpit renders on first load and shows real briefing data, signal rows, lanes, and rail.
- [ ] All 22+ keyboard shortcuts behave per §4.6.
- [ ] `⌘E` / `Ctrl+E` toggles Cockpit ↔ Triage from anywhere except text inputs.
- [ ] Triage progress persists across mode flips.
- [ ] Triage actions (Archive/Snooze/Trash/Reply/Star) call the same `emailStore` actions and update the inbox state.
- [ ] Undo works in Triage (rewinds index AND reverses the underlying email-state action).
- [ ] Cockpit signal rows show queue position pip (`#1/6`) when item is in the active Triage queue; CLEARED green pip after dispatch.
- [ ] 30-second undo-send works (toast appears with countdown; Undo restores composer).
- [ ] First-run "Connect Google" screen renders when `provider_token` and `total_emails_cached` are both absent.
- [ ] Auth-error banner appears when token expires; Reconnect modal works.
- [ ] Daily Overview deep-link (`sessionStorage.pulse_focus_nudge='email'`) scrolls to and rose-tints the briefing.
- [ ] Pulse Assistant `pulse:compose-email` event opens the composer with pre-filled fields.
- [ ] Mobile (< md): Triage hidden; Cockpit + folder drawer + FAB work.
- [ ] Offline mode: pending-actions badge updates; auto-sync on reconnect.
- [ ] Search (semantic + fallback) returns results into the Cockpit lane area.
- [ ] All 5 Settings tabs work unchanged.

### 8.2 Visual

- [ ] Matches playground Path A in both themes (light + dark) at desktop width.
- [ ] Coral budget honored: coral surfaces only in AI strips, drafts, signal AI summary chevrons, Start-Triage CTA, Inbox-Health tile.
- [ ] Cross-fade transition: 280ms opacity + 6px Y drift between modes.
- [ ] Triage card mount animation: 320ms `cardIn` per email.
- [ ] Action toast: appears centered above stage on action; auto-stays until next action.
- [ ] Done-state halo: two coral rings pulse outward.

### 8.3 Code health

- [ ] Zero new TypeScript errors (`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` — repo has ~1234 pre-existing errors; gate is "no NEW").
- [ ] No new ESLint warnings on `hybrid/` files.
- [ ] No inline color values in any `hybrid/` component (consume tokens).
- [ ] No direct API calls; all data goes through existing services.
- [ ] No new untracked files at session end (commit early per CLAUDE.md § 1).

### 8.4 Performance

- [ ] Cockpit first-paint within 200ms of route mount on warm cache.
- [ ] Mode toggle within 60ms (cross-fade transition starts immediately).
- [ ] Triage card swap within 80ms.
- [ ] No unnecessary re-renders: profile with React DevTools, ensure Cockpit doesn't re-render on every Triage action (memoize lane sections + signal section by data references).

---

## 9. Out of Scope (Deferred to v1.1)

These are explicitly NOT part of this work:

1. **AI-drafted reply generation** (`email.draft` field populated by AI). Show panels conditionally; do not wire generation. Track v1.1 issue.
2. **Inbox health insight** ("92% reply rate this week" etc.) — hide the panel.
3. **Triage stats persistence** (Streak / Avg per email / Vs last week) — show static numbers in Done state; track v1.1 issue to compute & persist.
4. **Mobile Triage** — hide on `< md`; track v1.1 issue for mobile design.
5. **"→ Task" deep integration** with `decisions/` module — stub with toast in v1; track v1.1 wiring.
6. **`accentColor`** preference styling — keep state, no new UI styling.
7. **Campaigns surface** — stays gated OFF per issue #105.
8. **New AI service calls** — no new `emailAIService` methods.
9. **Refactoring `EmailComposerModal`** — untouched.
10. **Refactoring `EmailSettingsModal`** — untouched.
11. **Changes to `emailSyncService` / `gmailService`** — read-only consumption.

---

## 10. Decisions Log

| Decision | Why |
|----------|-----|
| Hybrid as default at flip; legacy deleted after 2-week soak | Reduces forking surface area; legacy code has 28 files and 9,762 lines. |
| Both views mounted simultaneously (cross-fade) instead of unmount/remount | State preservation across mode flips is a UX-critical polish that breaks with remount. |
| Triage state in `emailUIStore` (not a new store) | One less store to test; aligns with current architecture where UI state ≠ data state. |
| `DailyBriefing` component retired (not preserved) | Its data lives on as the Cockpit briefing header; its presentation does not match the new editorial direction. The retirement saves 270L + CSS. |
| `RelationshipPanel` demoted to on-demand disclosure | It's high-value but visually noisy; matches the "calm by default" Cockpit ethos. |
| "→ Task" stub in v1 | Don't block the hybrid landing on a deep integration that needs separate scoping. |
| Coral budget enforced via component review, not lint | Lint rule for token usage is a separate gear-up; manual review during PR is sufficient for v1. |
| `emailHybrid` flag at user-id level | Allows owner-only smoke test before flip. Standard pattern. |
| Mobile Triage hidden in v1 | Triage was designed at desktop widths in the playground; mobile needs its own design pass. Hiding > shipping half-baked. |
| `emailCampaigns` flag stays untouched | Out of scope; issue #105 owns. |
| Signal rows derive from `ai_priority_score >= 70` AND unread | Matches `DailyBriefing`'s current "top 3 priority" heuristic for continuity. |
| Triage queue derives from `ai_priority_score >= 60` AND unread | Slightly more inclusive than signal rows. Capped at 20. |

---

## Appendix A — Full file inventory (audit summary)

### `src/components/Email/` (28 files, ~9,762 lines)

| File | Lines | Disposition |
|------|-------|-------------|
| `PulseEmailClientRedesign.tsx` | 629 | Legacy — delete after soak |
| `EmailListRedesign.tsx` | 548 | Legacy — delete after soak |
| `EmailViewerNew.tsx` | 980 | Legacy — delete after soak; AI panels (Meeting/ActionItem) extracted for reuse |
| `EmailComposerModal.tsx` | 1,425 | **Preserved verbatim** |
| `EmailSettingsModal.tsx` | 1,318 | **Preserved verbatim** |
| `DailyBriefing.tsx` | 270 | Legacy — delete; heuristics ported to `useCockpitData` |
| `DailyBriefing.css` | – | Delete |
| `FollowUpNudge.tsx` | 268 | **Preserved** — used inside composer |
| `FollowUpRemindersDropdown.tsx` | 324 | Legacy — delete; data flows into `AwaitingRepliesRail` |
| `MeetingExtractor.tsx` | 381 | **Preserved** — used in inline reader |
| `ActionItemExtractor.tsx` | 361 | **Preserved** — used in inline reader |
| `RelationshipPanel.tsx` | 365 | **Preserved** — used on-demand in inline reader |
| `GoogleAuthStatus.tsx` | 110 | **Preserved** — same slot in top bar |
| `OfflineIndicator.tsx` | 127 | **Preserved** — same slot |
| `FilterManager.tsx` | 578 | **Preserved** — accessed via Settings |
| `LabelManager.tsx` | 364 | **Preserved** — accessed via Settings |
| `SnoozeModal.tsx` | 168 | **Preserved** |
| `ScheduleSendModal.tsx` | 145 | **Preserved** |
| `TemplatesModal.tsx` | 386 | **Preserved** (or check if Enhanced replaces it) |
| `EmailTemplatesModalEnhanced.tsx` | 509 | **Preserved** |
| `TemplateVariablesModal.tsx` | 149 | **Preserved** |
| `KeyboardShortcutsModal.tsx` | 117 | **Preserved** + updated to include new shortcuts |
| `EmailSidebarRedesign.tsx` | 206 | Legacy — delete after soak; folder nav moves to FoldersDropdown |
| `EmailClientWrapper.tsx` | 23 | **Modified** — branches on `emailHybrid` flag |
| `index.tsx` | 11 | **Modified** — add hybrid exports |
| `Campaigns/EmailCampaignsDashboard.tsx` | ~350 | **Untouched** — gated OFF |
| `Campaigns/EmailCampaignBuilder.tsx` | ~500 | **Untouched** — gated OFF |
| `Campaigns/SegmentBuilder.tsx` | ~250 | **Untouched** — gated OFF |

### Stores
| File | Disposition |
|------|-------------|
| `src/store/emailStore.ts` | Unchanged |
| `src/store/emailComposeStore.ts` | Unchanged |
| `src/store/emailUIStore.ts` | **Extend** — add `emailHybridMode`, `triageState`, `expandedSignalRowId` + setters |

### Services
**All preserved unchanged.** Hybrid is a UI-only refactor.

### Hooks
| File | Disposition |
|------|-------------|
| `src/hooks/useEmailKeyboardShortcuts.ts` | **Preserved** — wrapped by new `useEmailHybridShortcuts` |

### App routing
| File | Disposition |
|------|-------------|
| `src/App.tsx:20, 199, 914-915, 500` | **Unchanged** — routes via `EmailClientWrapper` which branches internally |
| `src/hooks/useRoutePreload.ts` | **Verify** — preload reference may need updating |

### Feature flags
| File | Disposition |
|------|-------------|
| `src/lib/featureFlags.ts` | **Add** `emailHybrid` flag (default false, dev override `?ff_emailHybrid=on`) |

---

## Appendix B — Implementation reading order

If you're the agent picking this up, read in this order:

1. This entire handoff doc.
2. `_design-playground/email-redesign.html` — the canonical reference. Open it in a browser at both light and dark themes, A · Inline Toggle path. Click through every interaction. Memorize the motion.
3. `CLAUDE.md` — especially § 1 (branch discipline — commit early), § 4 (coral budget), § 5 (commands), § 6 (doc naming).
4. `src/components/Email/PulseEmailClientRedesign.tsx` — read end-to-end. This is the orchestrator you're replacing.
5. `src/store/emailStore.ts`, `src/store/emailComposeStore.ts`, `src/store/emailUIStore.ts` — the data model.
6. `src/components/Email/DailyBriefing.tsx` — its `loadBriefing` heuristics become `useCockpitData`.
7. `src/components/Email/EmailListRedesign.tsx` — for bulk-select patterns and category-tab behavior.
8. `src/components/Email/EmailViewerNew.tsx` — for the action menus, extractor panel integration, and Move/More dropdowns (will move to inline reader).
9. `src/hooks/useEmailKeyboardShortcuts.ts` — the keyboard contract.
10. `src/lib/featureFlags.ts:187` — the `emailCampaigns` flag template to mirror.

Once you've read all of this, scaffold Phase 0 and commit. Don't skip phases. Don't bundle phases unless the user says so. Each phase is independently shippable.

---

**End of handoff.**
