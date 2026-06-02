# Contacts Triage Report — 2026-06-02

> Forensic damage assessment of the Pulse **Contacts** section. This is a damage
> report, not an improvement plan. Ground truth was verified against the live
> Supabase DB (`ucaeuszgoihoyrvhewxk` / pulse-chat), git history, and full reads
> of every file. No code was changed.

---

## Executive Summary

**Overall Health: FRAGILE**

| Metric | Count |
|--------|-------|
| Files touching the section (approx.) | ~77 (34 components + 14 card components + 12 services + 1 hook + 10 migrations + 3 test files + ~3 type files) |
| **Solid** (live, real data) | ~21 components + 6 services |
| **Cracked** (live but broken/degraded) | 3 (workspace share live-broken, ContactDetail notes-in-place, FindTeammates/ContactGoalModal "coming soon" sub-surfaces) |
| **Severed** (data-layer or wiring cut) | 2 services (`workspaceContactsService`, `relationshipAutopilotService`) + 2 component-level imports |
| **Stub** (placeholder) | 2 (`relationshipIntelligenceService.syncEmailInteractions`, several ReceivedTab toast-actions) |
| **Gutted** (was better before) | **0 — no gutting found** |
| **Orphan** (dead code) | 2 superseded forks (`ContactsList`, `SmartListPanel`) + ~7 complete-but-unmounted feature components + a 5-file card "island" + ~8 orphan service methods |
| **Dormant** (complete, flag-off) | Phase C cards subsystem (4 mounted + island), gated on unset `VITE_CONTACTS_PHASE_C_ENABLED` |

**Plain English:** The **core of Contacts is healthy and fully wired to real
Supabase data.** App → `Contacts.tsx` → `ContactsLayout` → `ContactsShell` →
`{TodayView, ContactsRedesigned → ContactDetail}` plus the Google import wizard
(`ConnectContactsModal`) all work, read/write live tables, and were *hardened*
(not gutted) by the recent 2026-05/06 commits. The damage is concentrated at the
**edges**, in two shapes:

1. **One live feature is silently broken against the database.** "Share contacts
   to workspace" (Phase B) is reachable today on the People surface — it is **not**
   feature-flagged — but its backing table `workspace_contacts` **was never
   migrated to the live DB**. The migration *file* exists (committed in `f51691e`)
   but the registry shows it was never applied. Sharing therefore always fails;
   the workspace-audit read silently returns empty. **Fix this first.**

2. **A large amount of well-built code sits dark.** The Phase C contact-card
   sharing subsystem (~14 components + service + types + tests) is flag-gated OFF
   *and* its tables (`contact_cards`, `card_send_blocks`) were never migrated, so
   it cannot run even if the flag flips. Separately, ~7 complete feature
   components (AI contact search, meeting-prep card, the rich AI-insights tab,
   circles detail, etc.) were de-wired when the Phase D IA folded Circles into a
   sidebar facet — they're intact, backed by real services, just never mounted.

**Nothing is rotten and nothing was hollowed out.** Every "orphan" was verified
as a zero-importer with an intact body (git confirms only cosmetic/polish commits
touched them). The repair work is **re-wiring and migrating**, not rebuilding.

---

## 1. Intended Purpose

Contacts is Pulse's **relationship intelligence hub** — an address book that has
grown a CRM brain. From the user's perspective it provides:

- **Today** — an AI-generated daily relationship briefing: who to reach out to,
  follow-ups due, decaying relationships, birthdays, VIP activity, with
  one-click complete/snooze/dismiss and a Time/Route geo-clustered view.
- **People** — the contact directory: searchable/filterable list + grid, smart
  lists (recently-active, needs-attention, etc.), saved filters, circles (as a
  sidebar facet), bulk actions, archive, a rich per-contact detail panel with
  relationship score/trend, email history, goals, autopilot, and provenance.
- **Import** — selective Google Contacts import (label-scoped, dedup-aware) and a
  "trim" wizard for pruning.
- **(Deferred) Contact Cards** — share a contact "card" to another Pulse user with
  forwarding, expiry, revoke, and a public landing page for non-Pulse recipients.
- **Workspace sharing** — elevate a personal contact into a shared workspace
  directory with an audit trail.

The intelligence layer (relationship scoring, decay alerts, duplicate detection,
enrichment from email signatures, lead scoring) is real and substantial — it is
not a mock.

---

## 2. What's Solid (Foundations — Build On These)

### Active route chain (verified end-to-end)
```
App.tsx:27          lazy(() => import('./components/Contacts'))
App.tsx:898         case AppView.CONTACTS → <Contacts ... onAddContact onDeleteContact .../>
Contacts.tsx:23     <ContactsLayout {...props}/>            (thin pass-through)
ContactsLayout.tsx:3 re-export ContactsShell               (intentional, not gutted)
ContactsShell.tsx    2 tabs (today | people) + 5 modals
  ├─ today  → TodayView (:250)
  └─ people → ContactsRedesigned (:253) → ContactDetail (:1580)
```
All props (`onAction`, `onAddContact`, `onDeleteContact`, `onUpdateContact`,
`onSyncComplete`) thread through to real `dataService`/`supabase` calls.

### Solid components
- **ContactsShell** (`ContactsShell.tsx`) — 2-tab switcher + custom-event hub
  (`open-connect-modal`, `open-reconnect-modal`, `show-smart-list`, etc.) with
  matched listeners + cleanup. No dead handlers.
- **ContactsRedesigned** (`ContactsRedesigned.tsx`, 1864 ln) — the People surface.
  Sidebar, inline `NodeCard`/`ListRow` renderers, filtering, smart lists, saved
  filters, circles facet, bulk actions, add-chooser — all live. (The 1864 lines
  are real; this is the load-bearing component, **not** orphaned as its filename
  might suggest.)
- **ContactDetail** (`ContactDetail.tsx`, hardened 2026-06-01) — reads
  `cached_emails`, `contact_goals`, relationship profile; writes notes + goals;
  renders MapPreview from geocoded lat/lng. Git confirms recent commits
  *improved* it (typed-confirmation delete `0b1c837`, inline summary `c680dd0`).
- **TodayView** + **TodayFeedCard** + **TodayEmptyState** — AI briefing feed,
  two-phase load, real complete/snooze/dismiss via `todayFeedService`.
- **ConnectContactsModal** (985 ln) — 3-step Google import wizard, real People API,
  robust auth-failure → reconnect banner. Actively patched through Phase D.
- **AddContactModal, EditContactModal, BulkActionToolbar, SavedFiltersPanel,
  ArchivedToggle, ContactsEmptyState, NamePromptModal, ContactsOnboarding,
  DuplicateDetectionModal, ProvenanceChip, RelationshipAlertsFeed,
  RelationshipAutopilotToggle, TrimWizard** — all imported, rendered, real handlers.

### Solid services (real implementations, tables exist)
| Service | Table(s) — all verified present | Consumed by |
|---|---|---|
| `contactGoalService` | `contact_goals` ✓ | ContactDetail, TodayView, ContactGoalModal |
| `contactSearchAIService` | reads `relationship_profiles` ✓ | AIContactSearch |
| `contactCircleService` (CRUD + autoDetect) | `contact_circles` ✓, `contact_circle_members` ✓ | ContactsRedesigned, CircleDetail |
| `googleContactsService` (OAuth/import core) | `contacts` ✓ | ConnectContactsModal, settings, dataExport |
| `contactEnrichmentService` | `relationship_profiles` ✓, `contact_interactions` ✓, `duplicate_contacts` ✓ | useRelationshipIntelligence |
| `relationshipIntelligenceService` | `relationship_profiles` ✓, `contact_interactions` ✓, `smart_contact_groups`, `meeting_prep_cards` ✓ | useRelationshipIntelligence |
| `relationshipAlertService` | `relationship_alerts` ✓, `relationship_profiles` ✓ | useRelationshipIntelligence, todayFeedService |
| `userContactService` | `user_contact_annotations` ✓, `user_profiles` ✓ | Relay/Glimpse/presence (directory, not address-book) |
| `useRelationshipIntelligence` (hook) | delegates | ContactsRedesigned |

**Tables confirmed present in live DB:** `contacts`, `contact_goals`,
`contact_circles`, `contact_circle_members`, `relationship_profiles`,
`relationship_health`, `relationship_alerts`, `contact_interactions`,
`meeting_prep_cards`, `duplicate_contacts`, `smart_contact_groups`,
`user_contact_annotations`, `user_profiles`. `contacts.user_id` is **`text`**
(not uuid) — matches the documented schema-inconsistency; treat as text in any
future join/RPC.

---

## 3. What's Cracked (Fixable With Targeted Repairs)

Sorted trivial → complex.

### 3.1 ContactDetail notes save mutates the prop object in place — TRIVIAL
- `ContactDetail.tsx:715-716`: `await supabase.from('contacts').update({notes})` then
  `contact.notes = newNotes` directly mutates the prop instead of calling
  `onUpdateContact`. The DB write succeeds, but parent React state isn't formally
  updated, so a re-render from the parent could show stale notes.
- **Fix:** route through the existing `onUpdateContact` prop. ~5 min.
- **Cascade:** low.

### 3.2 `ContactGoalModal` & `FindTeammatesSheet` carry honest "coming soon" sub-surfaces — TRIVIAL (cosmetic)
- `ContactGoalModal.tsx:203` — "AI-drafted replies coming soon" copy under a
  *functional* autopilot toggle. The toggle persists; only the drafting is unbuilt.
- `FindTeammatesSheet.tsx:271-286` — a deliberately `disabled` "@handle search —
  Coming later" input. The main discovery flow (`discoverPulseUsers`) is real.
- These are labeled-honest, not broken controls. No fix required; listed for completeness.

### 3.3 **Workspace contact sharing is live but broken against the DB — COMPLEX (migration)**
**This is the most important repair in the section.**
- The bulk "Share" action (`ContactsRedesigned.tsx:1228` `onShare` → `handleShareToWorkspace`
  `:1147` → `shareContactsToWorkspace`) and the ContactDetail workspace-audit read
  (`ContactDetail.tsx:177` `listWorkspaceContacts`) are **NOT feature-flagged** —
  they are reachable on the live People surface today.
- Both hit `.from('workspace_contacts')` (`workspaceContactsService.ts:73, 99`).
  **That table does not exist in the live DB.** The migration
  `20260524000002_phase_b_workspace_contacts.sql` was committed (`f51691e`) but the
  `schema_migrations` registry confirms it was **never applied** (only
  `phase_b_archive_column` from the same batch landed).
- **Failure behavior (verified):** `shareContactsToWorkspace` catches the per-chunk
  error and returns `{succeeded: [], failed: [...table-missing]}` — so the user
  clicks Share and it *always* fails (visible failure/partial-failure result).
  `listWorkspaceContacts` does `throw error` (`:115`) which ContactDetail's
  `.catch()` (`:181`) swallows with a `console.warn` — so the audit section
  **silently shows nothing**. No app crash either way.
- **Fix:** apply the Phase B `workspace_contacts` migration to the live DB (dry-run
  in a rolled-back transaction first per CLAUDE.md schema-first rule), then verify
  the RLS policies. The client code is already correct and complete.
- **Cascade:** any UI promising "shared with workspace" is currently a lie.

---

## 4. What's Severed (Disconnected Wiring)

### 4.1 `workspaceContactsService` — data-layer severed (see 3.3)
Well-written client code; backing table never migrated. Reconnect = apply the migration.

### 4.2 `relationshipAutopilotService` — fully severed (zero callers)
- `relationshipAutopilotService.ts` — grep for every export
  (`draftKeepInTouchMessage`, `generateAutopilotActions`, `calculateNextActionDate`,
  `buildContactContext`) returns **only this file**. Nothing imports it.
- Real AI-draft logic with template fallback, but unwired. Note: it re-declares
  `calculateNextActionDate`, a name that also lives in `contactGoalTypes` (the one
  actually used) — a collision to resolve before any consolidation.
- **Worth reconnecting?** The autopilot *toggle* (`RelationshipAutopilotToggle`) is
  live and persists state via `contactGoalService`, but no engine consumes that
  state to actually draft/send. This service is the missing engine. Decide:
  wire it up, or remove both the dead service and the toggle's unfulfilled promise.

### 4.3 `RelationshipScoreBadge` import — severed (dead import)
- `ContactsList.tsx:5` imports `RelationshipScoreBadge` from `RelationshipHealthCard`
  but never renders it (only `LeadGradeBadge` renders). Doubly dead since
  `ContactsList` itself is an orphan (§7).

### 4.4 `RelationshipHealthCard` — reachable only through dead code
- Its sole renderer is `ContactAIInsightsTab.tsx:110`, which is itself an orphan
  (§7). The card body is solid; the wiring tree above it is dead.

---

## 5. What's Stubbed (Never Finished)

### 5.1 `relationshipIntelligenceService.syncEmailInteractions` — STUB
- `relationshipIntelligenceService.ts:1077` — body is
  `console.log('Email interaction sync - implement integration with emailSyncService')`.
  Unwired. The rest of the service is solid; this one method is a placeholder.

### 5.2 Phase C ReceivedTab in-flow actions — STUB (toast no-ops)
- `cards/ReceivedTab.tsx` — "Review duplicates" (`:233`), "Maybe/snooze" (`:336`),
  "block sender" (`:350`) are `toast()`/`TODO` no-ops; their backend service
  methods (`card_send_blocks` writes, `card_declines`) don't exist. Only relevant
  if Phase C is activated (§6 dormant).

### 5.3 `contactCardService.declineCard` — STUB
- `contactCardService.ts:240` comment: "Backend deferred — service stub." Targets a
  `card_declines` table that does not exist.

---

## 6. What's Gutted (Was Better Before)

**None.** Git forensics on every suspect file shows only cosmetic/polish/hardening
commits — coral token sweep (`8ea6e88`), FontAwesome→lucide migration (`f1ef9f2`),
provenance-chip plumbing (`7ca03c0`), gradient/VIP-gold removal (`188e31b`,
`a4614aa`), typed-confirmation delete (`0b1c837`). No commit ripped logic out of
any component. The orphans below are **de-wired or never-wired**, not hollowed.

The one nuance: `SmartListPanel.tsx` (orphan, §7) still contains pre-migration
FontAwesome icon strings and orange/amber gradient tiles — it would render broken
icons and off-brand colors *if* re-wired. That's staleness from being left behind,
not active gutting.

---

## 7. What's Orphaned (Dead Code — Investigate, Don't Auto-Delete)

> Per CLAUDE.md Rule A, none of these should be removed without an explicit
> pros/cons. They are listed as **candidates for triage**, not deletion orders.
> Each was verified as a true zero-importer with an intact body.

### 7a. Superseded forks (strongest delete candidates)
- **`ContactsList.tsx`** — imported nowhere; no default export. The active list/grid
  is `ContactsRedesigned`'s inline `NodeCard` (`:453`) / `ListRow` (`:605`). A stale
  fork (still has `bg-blue-50` selection tint, `avatarColor`-as-class).
- **`SmartListPanel.tsx`** — imported nowhere; superseded by the inline Sidebar
  smart-lists in `ContactsRedesigned` (`:351`). Stale FA icons + orange gradients.

### 7b. De-wired complete feature components (Phase D IA casualties — preserve, decide later)
These are intact, backed by real services, and were unmounted when Circles became
a sidebar facet (`ab34ae0`) / when ContactDetail grew its own inline insights:
- **`AIContactSearch.tsx`** — natural-language contact search, wired to the **real**
  `searchContactsNL`. Never placed in the People toolbar. **Highest-value re-wire.**
- **`ContactAIInsightsTab.tsx`** — full 3-section (Overview/Factors/Leads) insights
  tab. Superseded by ContactDetail's thinner inline insights. Carries the only live
  renderers of `RelationshipHealthCard` + `LeadScoreCard`.
- **`MeetingPrepCard.tsx`** (`MeetingPrepCardComponent` + `MeetingPrepBanner`) —
  backing data path is real (`getUpcomingMeetingPreps`), no UI mounts it.
- **`CircleDetail.tsx`** — full circle CRUD against `contactCircleService`; unmounted
  when Circles was demoted. (Contains one `as any` escape hatch at `:294`, moot.)
- **`ConversationContext.tsx`** — self-contained pre-message context card; never rendered.

### 7c. Orphan exports inside live files
- `LeadScoreIndicator` + `BuyingSignalBadge` (the file's `LeadGradeBadge`/
  `LeadStatusBadge`/`LeadScoreCard` siblings ARE live).
- `AlertCountBadge` in `RelationshipAlertsFeed.tsx:284` (parent feed is live).

### 7d. Orphan service methods (no callers)
`contactCircleService.getOrphanContacts` / `calculateCircleHealth`;
`contactEnrichmentService.autoTagAllContacts`; `userContactService.getFavorites`;
`relationshipAlertService.getAlertsByProfile` / `cleanupExpiredAlerts` /
`getAlertCounts`. Also `userContactService.getBasicProfile`'s second fallback
queries a non-existent `profiles` table (`:216`) — dead-but-silent (returns null).

### 7e. Phase C card "orphan island" (orphaned even if the flag flips)
`ReceivedCardDetail`, `AcceptCardConfirmation`, `ForwardCardModal`,
`ReviewDuplicatesScreen`, `CardLandingPage` — no production caller at all, because
`ReceivedTab.onOpenCard` only stages `setPendingDeeplinkCardId` with a
`TODO(phase-6-review): wire to a real detail route` (`ContactsRedesigned.tsx:1345`).
`CardLandingPage` is by-design an SSR landing for the `resolve-card-deeplink` edge
function. (See §6/Dormant.)

---

## 8. Connection Map

### 8a. Route-to-Render chain (active surface — SOLID)
```
/app (AppView.CONTACTS)
  → Contacts.tsx → ContactsLayout → ContactsShell                [SOLID]
      ├─ TodayView                                               [SOLID]
      │    reads: todayFeedService, contactGoalService.getUpcomingActions
      │    writes: todayFeedService (complete/snooze/dismiss)
      ├─ ContactsRedesigned                                      [SOLID]
      │    reads: useRelationshipIntelligence (→ relationship_profiles,
      │           contact_interactions, relationship_alerts),
      │           contactCircleService, savedFiltersService
      │    writes: dataService.archive/restore/bulkDelete, addContact
      │    └─ ContactDetail                                      [SOLID core]
      │         reads: cached_emails, contact_goals, listWorkspaceContacts ⚠
      │         writes: contacts.notes (in-place ⚠ §3.1), contactGoalService
      └─ modals: AddContact, Edit, Onboarding, Trim, Connect     [SOLID]
```

### 8b. Data-flow map — broken seams highlighted
```
workspace_contacts  (TABLE MISSING — migration unapplied)        ✖ BROKEN
  → workspaceContactsService.shareContactsToWorkspace  [CRACKED] → always fails
  → workspaceContactsService.listWorkspaceContacts     [CRACKED] → silent empty
      → ContactsRedesigned bulk Share (LIVE, not flagged)
      → ContactDetail workspace audit (LIVE, not flagged)

contact_cards / card_send_blocks  (TABLES MISSING)               ✖ BROKEN
  → contactCardService.fetch/create/...                [SEVERED if flag on]
      → Phase C cards subsystem (flag OFF → currently inert)     ◐ DORMANT

relationship_profiles / contact_interactions / relationship_alerts  ✓
  → relationshipIntelligenceService / Alert / Enrichment [SOLID]
      → useRelationshipIntelligence → ContactsRedesigned, TodayView

contact_goals ✓ → contactGoalService [SOLID] → ContactDetail/TodayView
contact_circles(+members) ✓ → contactCircleService [SOLID] → ContactsRedesigned
contacts ✓ → googleContactsService / dataService [SOLID] → import + list
```

### 8c. Cross-section dependencies
```
THIS SECTION DEPENDS ON:
  AuthContext, WorkspaceContext (currentWorkspace), dataService.getContacts(),
  supabase client, askAI/ai-router (server-side Gemini), geocoding/locationService.

OTHER SECTIONS THAT DEPEND ON THIS ONE — all via the stable dataService seam,
no cross-imports of contacts/ components (clean):
  Dashboard.tsx:679, Dashboard/QuickScheduler.tsx:61, PulseAssistant/
  useAssistantContext.ts:134, dailyBriefingService.ts:145 → dataService.getContacts()
  settings/integrations/GoogleServicesIntegration.tsx:363/422 → googleContactsService
  Analytics + weeklyBriefingService → relationshipHealthService (parallel scoring
    engine on relationship_health; NOT consumed by any Contacts component)
  NOTE: src/components/map/contacts/* is map's OWN internal subfolder, not a
    dependency on components/contacts/ (false positive).
```
**No broken cross-section imports found.** The only cross-section break is internal:
the missing `workspace_contacts`/`contact_cards` tables.

---

## 9. UI Surface Audit

### 9a. Page-level
| Check | Status | Notes |
|---|---|---|
| Route resolves | ✅ | App.tsx:898 |
| Renders without blank sections | ✅ | Today + People both render |
| Loading state | ✅ | TodayView two-phase; intelligence hook loads on mount |
| Empty state | ✅ | ContactsEmptyState, TodayEmptyState |
| Error state | ◐ | workspace-share failure surfaces; workspace-audit fails silently (§3.3) |
| Navigation in/out | ✅ | handleContactAction routes to Messages/Relay/Meetings |
| Section tint / tokens | ✅ | coral reserved for AI surfaces per convention |

### 9b. Interactive elements — notable findings
| Element | Location | Connected? | Works? | Notes |
|---|---|---|---|---|
| Bulk "Share to workspace" | ContactsRedesigned:1228 | Yes | **No** | table missing → always fails (§3.3) |
| Workspace audit list | ContactDetail:177 | Yes | **No** | silent empty (§3.3) |
| "Share as card" | ContactsRedesigned:1229 | Flag-gated | n/a | OFF (Phase C) |
| Contact notes save | ContactDetail:715 | Yes | Yes* | writes DB; in-place prop mutation (§3.1) |
| NL contact search | AIContactSearch (orphan) | **No** | n/a | not mounted (§7b) |
| All other buttons/handlers | — | Yes | Yes | no empty `onClick={() => {}}`, no no-ops found in live code |

### 9c. Missing UI patterns
Present: search/filter, smart lists, saved filters, sort, bulk select/actions,
single-item menu, detail panel, create/edit/delete modals, delete confirmation,
import, keyboard shortcuts (Cmd+K/1/2/Esc), refresh, toast feedback.
Gaps: **export** (data-export lives in Settings/Privacy, not in-section); the rich
**AI-insights tab** and **NL search** exist but aren't surfaced (orphaned, §7b);
**responsive/mobile** layout not audited here.

---

## 10. Repair Priority Queue

| # | Item | Category | Complexity | Enables / Why |
|---|------|----------|-----------|---------------|
| 1 | Apply `workspace_contacts` (Phase B) migration to live DB | Cracked (live) | Complex (migration; dry-run first) | Unblocks the only user-reachable broken feature; makes share + audit real |
| 2 | Route ContactDetail notes save through `onUpdateContact` | Cracked | Trivial | Correct parent state; prevents stale notes |
| 3 | Decide `relationshipAutopilotService` + autopilot toggle: wire engine or remove promise | Severed | Moderate | Resolves a dead engine behind a live toggle |
| 4 | Re-surface `AIContactSearch` in the People toolbar | Orphan (high value) | Moderate | Activates a complete NL search wired to a real AI service |
| 5 | Decide `ContactAIInsightsTab` vs ContactDetail inline insights (consolidate or mount) | Orphan | Moderate | Recovers a richer insights surface; un-orphans RelationshipHealthCard |
| 6 | `relationshipIntelligenceService.syncEmailInteractions` — build or delete | Stub | Moderate | Email-interaction signal currently never ingested |
| 7 | Phase C cards: apply `contact_cards`/`card_send_blocks` migrations + wire `ReceivedCardDetail` + deploy edge fns BEFORE flipping `VITE_CONTACTS_PHASE_C_ENABLED` | Dormant | Complex | Don't flip the flag until DB + island wiring + toast-stubs are real |
| 8 | Triage orphan forks `ContactsList` / `SmartListPanel` (pros/cons per Rule A) | Orphan | Trivial-Moderate | Removes confusing superseded duplicates |
| 9 | Resolve `calculateNextActionDate` name collision; prune orphan service methods (§7d) | Orphan | Trivial | Cleanup; reduces foot-guns |

---

## 11. Git Forensics

**Last commits touching the section (most recent first):**
```
b2b47d8 docs(claude): code-preservation guardrails + bundle WIP
c0d0d12 docs(contacts): relabel "enrichment" as internal data (#107)
743f384 polish(contacts): canvas token drift + slim health ring
e728a29 typeset(contacts): mono eyebrow + dated H2 on TodayView
a4614aa perf(contacts): kill no-op gradients + layout-thrash
11f53cc refactor(contacts): drop border-l-4 stripes from TrimWizard
0b1c837 refactor(contacts): typed-confirmation delete (replaces confirm())
c680dd0 refactor(contacts): collapse ContactDetail quick-stats to inline
188e31b refactor(contacts): quieter action cluster + drop gold VIP gradient
7ca03c0 feat(contacts): plumb AIProvenanceChip into ContactDetail/MeetingPrep/Health
```
- **No large single-commit deletions / gutting** in `src/components/contacts/`.
  The only structural change is `ab34ae0` "Phase D step 5: Circles → People facet"
  — which *demoted* Circles (orphaning `CircleDetail`) rather than deleting logic.
- **Migration provenance (the core finding):** `f51691e` added the Phase B
  `workspace_contacts` migration file; `3bc4dc2` added the Phase C contact-cards
  backend. **Neither was applied** — the live `schema_migrations` registry contains
  only `phase_b_archive_column` (`20260520181913`) from those batches. The
  authored-but-unapplied gap is the root cause of every "table missing" finding in
  this report.
- Recent activity is overwhelmingly **polish + hardening** (coral tokens, FA→lucide,
  typed confirmations), consistent with a section that was *finished and refined*,
  not damaged. The damage here is **omission** (migrations never run, features never
  re-mounted), not regression.

---

### Verification note
Table existence, column types, and migration-apply status were queried directly
against the live Supabase DB (`ucaeuszgoihoyrvhewxk`) on 2026-06-02. Reachability
claims are grep-verified zero/non-zero importer counts. Where two sub-assessments
disagreed (migration-file-exists vs table-applied), ground truth was taken from
`information_schema` and `supabase_migrations.schema_migrations`, which showed the
Phase B/C table migrations are **not** applied. No files were modified.
