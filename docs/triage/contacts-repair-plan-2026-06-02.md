# Contacts Repair Plan — 2026-06-02

Source report: `docs/triage/contacts-triage-2026-06-02.md` (read 2026-06-02)
Scope chosen by user: **Full restoration**
Planning rules: this is a **plan**, not execution. No functional code is altered
until the user approves each item; destructive items carry a Rule-A pros/cons and
are executed one at a time with their own verification + commit (per CLAUDE.md
Rule A and the `/triage-repair` operating rules).

---

## 0. Verification Delta (report vs. ground truth, re-checked 2026-06-02)

The triage report is dated today, so drift is near-zero. Ground truth was
re-verified directly against the live Supabase DB (`ucaeuszgoihoyrvhewxk` /
pulse-chat), the migration registry, the migration files on disk, the deployed
edge-function list, and full re-reads of every cited file (5-agent parallel
re-verification + direct DB queries).

### CONFIRMED (still true)
- **§3.3 workspace sharing** — `workspaceContactsService.ts:73/:99` hit
  `.from('workspace_contacts')`; `listWorkspaceContacts` throws at `:115`;
  `shareContactsToWorkspace` catches per-chunk → `{succeeded, failed}`. The bulk
  Share path is **unconditionally reachable** on the live People surface
  (`ContactsRedesigned.tsx:1228` `onShare`, gated only by runtime
  `canShare={!!currentWorkspace && selectedIds.size >= 2}` at `:1244` — **no**
  feature flag). `ContactDetail.tsx:177` audit read is swallowed by `.catch` at
  `:181`. **DB ground truth:** `public.workspace_contacts` does **not** exist;
  `pg_policies` returns 0 policies for it.
- **§3.1 notes in-place mutation** — `ContactDetail.tsx:715` writes
  `supabase.from('contacts').update({ notes })`, then `:716`
  `contact.notes = newNotes || undefined` mutates the prop directly.
- **§4.2 autopilot** — `relationshipAutopilotService.ts` is a true zero-importer
  orphan (exports `draftKeepInTouchMessage` `:19`, `generateAutopilotActions`
  `:63`, `calculateNextActionDate` `:134`, `buildContactContext` `:147`);
  name-collision with the **live** `contactGoalTypes.ts:145 calculateNextActionDate`
  is real (incompatible signatures; all callers bind the contactGoalTypes one).
- **§5.1 `syncEmailInteractions`** — `relationshipIntelligenceService.ts:1077-1081`
  is a `console.log` placeholder, zero call sites.
- **§6 Phase C flag** — `VITE_CONTACTS_PHASE_C_ENABLED` lives in one file
  (`ContactsRedesigned.tsx:747`, strict `=== 'true'`), driving ~10 gates; off by
  default, no `.env` sets it.
- **§5.2 ReceivedTab stubs** — review-duplicates (`:232-241`), maybe/snooze
  (`:333-338`), block-sender (`:348-352`) are toast-only no-ops.
- **§7e island** — `ReceivedCardDetail`, `AcceptCardConfirmation` (1 *test* importer),
  `ForwardCardModal`, `ReviewDuplicatesScreen`, `CardLandingPage` have **0**
  production callers. `onOpenCard` (`ContactsRedesigned.tsx:1343-1350`) only stages
  `setPendingDeeplinkCardId` with a phase-6 TODO. (Report's "CardLandingPage may be
  SSR-referenced" caveat **disproven** — zero references anywhere.)
- **§7a/§7b orphan components** — all 7 are true zero-importers with intact bodies:
  `ContactsList` (382 ln), `SmartListPanel` (112 ln), `AIContactSearch` (182 ln),
  `ContactAIInsightsTab` (342 ln), `MeetingPrepCard` (372 ln; the many `MeetingPrepCard`
  grep hits are the *type* from `relationshipTypes.ts`, not the component
  `MeetingPrepCardComponent`), `CircleDetail` (371 ln), `ConversationContext` (175 ln).
- **§7b AIContactSearch backing** — `searchContactsNL` (`contactSearchAIService.ts:184`)
  is a real askAI-backed implementation (`parseNLQuery` `:52`), not a stub.

### 🔴 NEW — the report MISSED this
- **Saved filters is also DB-broken** (report graded it SOLID). `savedFiltersService.ts`
  hits `.from('saved_filters')` on every path — read `:48`, insert `:75`, update
  `:95`, delete `:106` — and **`public.saved_filters` does not exist** in the live
  DB (same un-applied Phase B batch as `workspace_contacts`). It is **not**
  localStorage and does **not** fall back to `saved_searches`. Failure behavior:
  - **Read** is swallowed (`ContactsRedesigned.tsx:851-855` `.catch(console.warn)`)
    → panel silently empty.
  - **Writes throw *unhandled*** — `createSavedFilter`/`updateSavedFilter`/
    `deleteSavedFilter` throw (`:85/:101/:107`); the handlers
    `handleSaveCurrentFilter` (`:1099`), `handleEditSavedFilter` (`:1123`),
    `handleDeleteSavedFilter` (`:1140`) `await` with **no try/catch** → unhandled
    promise rejection on every save/edit/delete.

### 🟡 CHANGED (true but materially different from the report)
- **§3.1 fix is bigger than "trivial."** `ContactDetail` has **no `onUpdateContact`
  prop** (props are `:33-52`; destructure `:102-116`). The report assumed routing
  through an existing prop. The real fix must (1) add the prop to `ContactDetailProps`
  + destructure it, and (2) pass it at the call site `ContactsRedesigned.tsx:1580-1593`
  (the parent already has `onUpdateContact` in scope at `:715`, invoked at `:1176-1177`).
- **§7b insights "sole renderer"** — `ContactAIInsightsTab` is the sole renderer of
  `RelationshipHealthCard` (`:110`) ✅, but **not** of `LeadScoreCard` —
  `ContactDetail.tsx:617` also renders it live. Deleting the tab would orphan the
  `RelationshipHealthCard` body but **not** `LeadScoreCard`.
- **§4.2 autopilot toggle is NOT dead** *(corrects the report's "no engine consumes
  that state" and my own first-pass framing).* `todayFeedService.ts:252-274
  buildAutopilotFeedItems` reads `goal.autopilotEnabled` (`:264`) and is **wired
  live** in `TodayView.tsx:114-116` — enabling autopilot surfaces a due goal as a
  priority Today nudge. `ContactGoalModal.tsx:200-205` documents this honestly. The
  **only** defect is the second toggle's subtitle "Drafts when it's time"
  (`RelationshipAutopilotToggle.tsx:68`) overpromising AI drafts. A separate, wired
  `enrichFeedItemsWithAIDrafts` (imported `TodayView.tsx:14`) already covers
  AI-draft enrichment — making `relationshipAutopilotService` a redundant duplicate,
  not the "missing engine."

### 🟢 STALE (already fixed — drop from the queue)
- **§5.3 `declineCard` is no longer a stub.** `contactCardService.ts:245-249` now
  calls the real `decline-contact-card` edge function, which writes to
  `card_recipient_state` (created by `20260525000002_phase_c_decline_state.sql:52`),
  added in commit `cab4ffb`. Only the docstring (`:236-238`) and the triage doc
  still say "card_declines / Backend deferred." The `card_declines` table the
  report worried about is **not** what the code targets.
- **Phase C backend is more complete than the report implied** — all 7 card edge
  functions exist on disk (`resolve-card-deeplink`, `render-contact-vcard`,
  `create-contact-card`, `accept-contact-card`, `revoke-contact-card`,
  `decline-contact-card`, `create-contact-card-bundle`) plus the `card_recipient_state`
  migration. **However, 0 of the 7 are DEPLOYED** to the live project (verified via
  `list_edge_functions`) — a fact neither the report nor I assumed; it enlarges the
  Phase C activation work.

### DB ground-truth snapshot (live, 2026-06-02)
| Object | State |
|---|---|
| `workspace_contacts`, `saved_filters`, `contact_cards`, `card_send_blocks`, `card_declines`, `card_recipient_state` | **ABSENT** |
| `contacts.possible_duplicate_of` (Phase C col) | **ABSENT** |
| 13 "solid" contacts tables (`contacts`, `contact_goals`, `contact_circles`, …) | present |
| `contacts.user_id` | **`text`** (not uuid) |
| Migration prereqs: `user_has_workspace_access(uuid)`, `update_updated_at_column()`, `workspaces`, `workspace_members`, `workspace_members.role`, `contacts.archived_at` | all **present** |
| Phase C card edge functions deployed | **0 of 7** |
| Migration files on disk (un-applied) | `20260524000002_phase_b_workspace_contacts`, `20260524000003_phase_b_saved_filters`, `20260525000001_phase_c_contact_cards`, `20260525000002_phase_c_decline_state` |

---

## 1. Decisions Taken (user, 2026-06-02)

| # | Fork | Decision | Notes |
|---|------|----------|-------|
| D1 | Scope of this pass | **Full restoration** | Includes Phase C activation. |
| D2 | The two DB-broken live features (workspace share + saved filters) | **Apply both Phase B migrations** | Client code already correct; all prereqs present; dry-run first. |
| D3 | Autopilot toggle + dead service | **Keep toggle + relabel the overpromising copy; delete ONLY `relationshipAutopilotService.ts`** | Revised after I surfaced that the toggle is live (Today nudges). Original "remove toggle" rescinded on corrected facts. |
| D4 | Orphaned-but-complete code | **Re-surface `AIContactSearch`** + **Delete superseded forks (`ContactsList`, `SmartListPanel`)** + **Mount/consolidate `ContactAIInsightsTab`** | "Leave all orphans" was *not* chosen. |

Sub-decisions still open (resolved at execution with a recommendation noted, gated
per Rule A where destructive): WI-5 mount-vs-consolidate exact shape; WI-9
`syncEmailInteractions` build-vs-delete; WI-10d snooze backend approach.

---

## 2. Work Items

Complexity: TRIVIAL (<5 min) · MODERATE (<30 min) · COMPLEX (>30 min / multi-step).

### WI-1 — Apply `workspace_contacts` (Phase B) migration to live DB
- **Findings:** §3.3, §4.1. **Archetype:** Reconnect (data-layer). **Complexity:** MODERATE.
- **What:** Apply `supabase/migrations/20260524000002_phase_b_workspace_contacts.sql`
  (table + 2 indexes + 3 RLS policies + grants). **No client change** — code is correct.
- **Procedure (CLAUDE.md schema-first):** (1) dry-run the body in a rolled-back txn
  via `execute_sql` (`BEGIN; … RAISE EXCEPTION 'rollback'`); (2) on clean, apply once
  via `apply_migration` (name `phase_b_workspace_contacts`) so it registers in
  `schema_migrations`. Strip the file's outer `BEGIN/COMMIT` if `apply_migration`
  manages its own transaction.
- **Deps:** prereqs verified present (`user_has_workspace_access`, `workspaces`,
  `workspace_members.role`). None blocking. **Blast radius:** additive; workspace
  peers can read the JOIN row but not the contact's private columns (RLS); service
  layer already projects safe columns only.
- **Verification:** re-query `information_schema.tables` (table exists) + `pg_policies`
  (3 policies) + registry; then exercise `shareContactsToWorkspace` happy path (or
  confirm no table-missing error).

### WI-2 — Apply `saved_filters` (Phase B) migration + harden write handlers
- **Findings:** NEW-saved-filters. **Archetype:** Reconnect (migration) + targeted repair.
  **Complexity:** MODERATE.
- **What:** (a) Apply `supabase/migrations/20260524000003_phase_b_saved_filters.sql`
  (table + 2 indexes + 4 RLS policies + `updated_at` trigger + grants). (b) Wrap the
  three write handlers `ContactsRedesigned.tsx:1099 handleSaveCurrentFilter`,
  `:1123 handleEditSavedFilter`, `:1140 handleDeleteSavedFilter` in try/catch with a
  `toast.error` — defensive against RLS/network failures even after the table exists
  (currently they throw unhandled).
- **Procedure:** dry-run → apply once (as WI-1).
- **Deps:** `update_updated_at_column()` present. None blocking. **Blast radius:**
  additive table; the handler hardening is local, low risk.
- **Verification:** `information_schema` (`saved_filters` exists) + `pg_policies` (4) +
  trigger present; then create/list/edit/delete a saved filter without throw; `tsc`
  on `ContactsRedesigned.tsx` (no NEW errors).

### WI-3 — Route ContactDetail notes save through a new `onUpdateContact` prop
- **Findings:** §3.1 (CHANGED). **Archetype:** Targeted repair. **Complexity:** MODERATE (2 files).
- **What:** (a) `ContactDetail.tsx` — add `onUpdateContact?: (updated: Contact) => void`
  to `ContactDetailProps` (`:33-52`) + destructure (`:102-116`); replace the in-place
  mutation (`:716`) with `onUpdateContact?.({ ...contact, notes: newNotes || undefined })`
  after the successful DB write (`:715`). Keep an optimistic local copy if needed so
  the inline display (`:739`) updates immediately. (b) `ContactsRedesigned.tsx:1580-1593`
  — pass `onUpdateContact={onUpdateContact}` to `<ContactDetail>` (already in scope at `:715`).
- **Deps:** none. **Blast radius:** low; must preserve the immediate UI update that the
  current mutation provides.
- **Verification:** `tsc` on the 2 files (no NEW errors); manual: edit notes → save →
  reflects immediately + persists on reopen + parent list reflects.

### WI-4 — Re-surface `AIContactSearch` in the People toolbar
- **Findings:** §7b (high-value orphan), D4. **Archetype:** Activate orphan. **Complexity:** MODERATE.
- **What:** `ContactsRedesigned.tsx` — import + mount `AIContactSearch` in the People
  toolbar; wire its result/selection callbacks into the existing filter/selection state
  without clobbering the standard search box. `AIContactSearch.tsx` may need a minor prop
  adapter. Coral/AI convention: `AIContactSearch` uses rose AI treatment (Wand2/Sparkles)
  — AI surface, coral/rose is permitted.
- **Deps:** `searchContactsNL` real ✅; server-side askAI via `ai-router` ✅. **Blast
  radius:** new affordance in the toolbar; must integrate with current search/filter state.
- **Verification:** `tsc` on `ContactsRedesigned.tsx`; manual: type an NL query → results
  + explanation chip render; falls back gracefully on AI error.

### WI-5 — Mount/consolidate `ContactAIInsightsTab` in ContactDetail
- **Findings:** §7b, §4.3/§4.4 (un-orphans `RelationshipHealthCard`), D4. **Archetype:**
  Activate orphan + consolidate (subtractive part → Rule A). **Complexity:** COMPLEX.
- **Recommended approach:** mount `ContactAIInsightsTab` as the canonical insights surface
  inside `ContactDetail`, **additively first** (behind the existing insights area), verify
  it renders (`RelationshipHealthCard` `:110`, `LeadScoreCard` `:232`), THEN — as a
  separate, Rule-A-gated step — remove the thinner inline insights block it supersedes.
  **De-dup `LeadScoreCard`:** it is also rendered at `ContactDetail.tsx:617`; the tab
  renders its own at `:232` — ensure only one renders to avoid a double card.
- **Deps:** sequence **after WI-3** (same file, avoids churn). **Blast radius:** ContactDetail
  layout; `LeadScoreCard` dual-render risk.
- **Rule-A block (for the inline-insights removal step only):** drafted at execution —
  the *mount* is additive and reversible; the *removal* of the inline block is subtractive
  and will get its own pros/cons + approval before it runs.
- **Verification:** `tsc` on ContactDetail + tab; manual: open a contact → insights tab
  shows health card + talking points + leads; no duplicate lead card.

### WI-6 — Relabel autopilot toggle copy + delete dead `relationshipAutopilotService.ts`  *(destructive)*
- **Findings:** §4.2, D3. **Archetype:** Targeted repair (copy) + ORPHAN delete. **Complexity:** MODERATE.
- **What (additive part):** `RelationshipAutopilotToggle.tsx:68` — change subtitle
  "Drafts when it's time" → honest copy matching `ContactGoalModal:200-205`
  (e.g. "Surfaces in Today when due" / keep "AI-drafted replies coming soon" elsewhere).
- **What (destructive part):** DELETE `src/services/relationshipAutopilotService.ts` (153 ln).
- **Rule-A pros/cons (deletion):**
  - **Exactly what changes:** delete `relationshipAutopilotService.ts` (exports
    `draftKeepInTouchMessage` `:19`, `generateAutopilotActions` `:63`,
    `calculateNextActionDate` `:134`, `buildContactContext` `:147`, local `inferActionType` `:111`).
  - **Pros:** removes a verified zero-importer orphan (grep returns only the file
    itself); its drafting role is redundant with the **wired** `enrichFeedItemsWithAIDrafts`
    (`TodayView.tsx:14`); auto-resolves the `calculateNextActionDate` name-collision
    with the live `contactGoalTypes.ts:145`.
  - **Cons:** loses an alternative AI-draft implementation (template-fallback
    `draftKeepInTouchMessage`) that could serve as a reference if you later build
    per-goal drafting differently. **Mitigation:** tracked file → git-recoverable.
  - **Preserve vs sacrifice:** PRESERVE the live toggle, `buildAutopilotFeedItems`,
    `enrichFeedItemsWithAIDrafts`, `setAutopilot`, `autopilot_enabled` column/data.
    SACRIFICE only the orphan engine.
  - **Completeness proof:** the live Today path imports `relationshipAutopilotService`
    nowhere (grep = 0). Nothing it exports is consumed; AI-draft enrichment is covered
    by the wired `enrichFeedItemsWithAIDrafts`.
- **Verification:** `tsc` full (no NEW errors — confirm no dangling import); manual:
  toggle still works; Today still surfaces autopilot nudges.

### WI-7 — Delete superseded forks `ContactsList` + `SmartListPanel`  *(destructive)*
- **Findings:** §7a, D4. **Archetype:** ORPHAN delete. **Complexity:** TRIVIAL-MODERATE.
- **Rule-A pros/cons:**
  - **Exactly what changes:** delete `src/components/contacts/ContactsList.tsx` (382 ln)
    and `src/components/contacts/SmartListPanel.tsx` (112 ln).
  - **Pros:** both are verified zero-importers (no `from '.../ContactsList'`/`SmartListPanel`,
    no barrel, no lazy) superseded by `ContactsRedesigned`'s inline `NodeCard`/`ListRow`
    (`:453/:605`) and inline Sidebar smart-lists (`:351`); they carry pre-migration
    FontAwesome icons + orange/amber gradients that would render off-brand (coral
    convention) if ever re-mounted; their filenames mislead (imply they're the active list).
  - **Cons:** `ContactsList.tsx:5` is the **only** importer of `RelationshipScoreBadge`
    (`RelationshipHealthCard.tsx:158`) — deletion leaves `RelationshipScoreBadge` an
    unused export (harmless dead export inside a still-used file; optionally prune in
    WI-8). Also loses a virtualized/IntersectionObserver infinite-scroll list that the
    inline renderer may not have (reference value if scale forces virtualization).
    **Mitigation:** git-recoverable.
  - **Preserve vs sacrifice:** PRESERVE the active `ContactsRedesigned` renderers.
    SACRIFICE two unused stale forks.
  - **Completeness proof:** active surface is provably `App → … → ContactsShell →
    ContactsRedesigned` (triage §2/§8a); both forks are unreachable.
- **Verification:** `tsc` full (no NEW errors); grep confirms no new dangling import; app
  People surface unchanged.

### WI-8 — Prune orphan exports/methods (§7c/§7d)  *(destructive — conservative)*
- **Findings:** §7c, §7d. **Archetype:** ORPHAN cleanup. **Complexity:** MODERATE (many small).
- **Candidates (each re-confirmed zero-importer at execution):** `LeadScoreIndicator`/
  `BuyingSignalBadge` orphan exports; `AlertCountBadge` (`RelationshipAlertsFeed.tsx:284`);
  `contactCircleService.getOrphanContacts`/`calculateCircleHealth`;
  `contactEnrichmentService.autoTagAllContacts`; `userContactService.getFavorites` +
  the dead `profiles`-table fallback in `getBasicProfile`;
  `relationshipAlertService.getAlertsByProfile`/`cleanupExpiredAlerts`/`getAlertCounts`;
  `RelationshipScoreBadge` (if WI-7 lands). Name-collision is **auto-resolved** by WI-6.
- **Recommendation:** conservative — prune only the clearly-dead, re-confirmed-at-execution
  items; **keep** anything ambiguous (preserve-by-default). Single batched Rule-A pros/cons
  presented before any deletion.
- **Verification:** `tsc` full (no NEW errors) after each batch.

### WI-9 — `syncEmailInteractions` (§5.1): build minimal or delete the stub
- **Findings:** §5.1. **Archetype:** STUB → build-or-cut. **Complexity:** MODERATE (build) / TRIVIAL (delete).
- **Open sub-decision (resolve at execution):** (A) build minimal real ingestion —
  call from `emailSyncService` completion to upsert `contact_interactions`; or (B)
  delete the empty method (`relationshipIntelligenceService.ts:1077-1081`) as dead code.
- **Recommendation:** lowest priority of the pass; if email-interaction signal isn't
  needed for launch, prefer (B). Either way it's isolated.
- **Verification:** `tsc`; if (A), confirm rows land in `contact_interactions` after a sync.

### WI-10 — Activate the Phase C contact-cards subsystem  *(largest — own session)*
- **Findings:** §6, §5.2, §7e, D1. **Archetype:** Activate dormant (multi-step). **Complexity:** COMPLEX.
- **Sub-items (in order):**
  - **WI-10a — Apply migrations:** `20260525000001_phase_c_contact_cards.sql`
    (`contact_cards`, `card_send_blocks`, `contacts.possible_duplicate_of`, 5 indexes,
    9 RLS) + `20260525000002_phase_c_decline_state.sql` (`card_recipient_state`,
    `revoke_contact_card_cascade` RPC). Dry-run → apply once, each.
  - **WI-10b — Deploy edge functions:** all 7 are **un-deployed** — deploy
    `create-contact-card`, `create-contact-card-bundle`, `accept-contact-card`,
    `decline-contact-card`, `revoke-contact-card`, `resolve-card-deeplink`,
    `render-contact-vcard`.
  - **WI-10c — Wire the island:** `onOpenCard` (`ContactsRedesigned.tsx:1343-1350`) →
    real `ReceivedCardDetail` route/render; this un-islands `ReceivedCardDetail`,
    `AcceptCardConfirmation`, `ForwardCardModal`, `ReviewDuplicatesScreen`.
  - **WI-10d — Build the 3 ReceivedTab toasts:** review-duplicates (`:232-241`) →
    `ReviewDuplicatesScreen`; block-sender (`:348-352`) → `card_send_blocks` insert via
    a new service method; maybe/snooze (`:333-338`) → **gap**: `card_recipient_state`
    supports `'snoozed'` but `decline-contact-card` only writes `'declined'` — needs a
    minimal snooze write (edge fn or direct insert) **or** leave snooze as honest
    "coming soon" (sub-decision).
  - **WI-10e — Flip the flag LAST:** set `VITE_CONTACTS_PHASE_C_ENABLED=true` (Vercel
    build-time var) only after 10a-10d are verified end-to-end.
- **Deps:** 10a before 10c/10d; 10b before 10e; 10e is the final gate. **Blast radius:**
  large — new user-facing card-sharing surface, public landing page, edge functions.
- **Verification:** per sub-item DB/edge checks; full E2E of send → receive → accept/
  decline/revoke before the flag flip.

---

## 3. Launch Order

### Dependency graph
```
WI-1  workspace_contacts migration ─┐
WI-2  saved_filters migration+harden┘   (independent; both = Wave 1)

WI-3  notes → onUpdateContact ─────────► WI-5  mount insights tab
                                          (same file: ContactDetail; WI-3 first)
WI-4  re-surface AIContactSearch       (independent; touches ContactsRedesigned)

WI-6  relabel + delete dead service ─┐
WI-7  delete superseded forks        ├─ destructive cleanup (after dependents stable)
WI-8  prune orphan exports/methods ──┘   (WI-8 after WI-6/WI-7; name-collision auto-fixed by WI-6)

WI-9  syncEmailInteractions          (independent / optional)

WI-10 Phase C: 10a→(10c,10d); 10b→10e  (own session; flag flip LAST)
```

### Sequenced table
| Order | Item | Category | Complexity | Why here | Unblocks |
|---|---|---|---|---|---|
| 1 | WI-1 workspace_contacts migration | Cracked (live) | MODERATE | User-reachable broken path; additive | Real share + audit |
| 2 | WI-2 saved_filters migration + harden | Cracked (live, NEW) | MODERATE | Unhandled rejections on every save; additive | Real saved filters |
| 3 | WI-3 notes → onUpdateContact | Cracked | MODERATE | Correctness; precedes WI-5 in same file | Clean parent state |
| 4 | WI-4 re-surface AIContactSearch | Orphan (high value) | MODERATE | Cheap activation of finished code | NL search live |
| 5 | WI-5 mount/consolidate insights tab | Orphan + consolidate | COMPLEX | Recovers richer surface; un-orphans HealthCard | — |
| 6 | WI-6 relabel + delete dead service | Repair + orphan delete | MODERATE | Destructive; after autopilot facts settled | Resolves name collision |
| 7 | WI-7 delete superseded forks | Orphan delete | TRIVIAL-MOD | Destructive; reversible last | Less confusion |
| 8 | WI-8 prune orphan exports/methods | Orphan cleanup | MODERATE | Destructive; after WI-6/WI-7 | Fewer foot-guns |
| 9 | WI-9 syncEmailInteractions | Stub | MODERATE/TRIV | Independent/optional | — |
| 10 | WI-10 Phase C activation | Dormant | COMPLEX | Largest; own session; flag flip last | Card sharing |

### Waves (each leaves a committable, verified state)
- **Wave 1 — Stop the bleeding (DB-broken live features).** WI-1 + WI-2. Additive,
  highest user impact. *Commits:* migration applies recorded; one code commit
  `fix(contacts): harden saved-filter write handlers + apply Phase B workspace_contacts/saved_filters`.
- **Wave 2 — Cheap correctness + quick activation.** WI-3, then WI-4. Additive.
  *Commits:* `fix(contacts): route ContactDetail notes save through onUpdateContact`;
  `feat(contacts): surface AIContactSearch in the People toolbar`.
- **Wave 3 — Insights surface recovery.** WI-5 (mount additive; inline-removal gated).
  *Commit(s):* `feat(contacts): mount ContactAIInsightsTab as the insights surface`
  (+ a separate gated commit if the inline block is removed).
- **Wave 4 — Destructive cleanup (Rule-A each).** WI-6 → WI-7 → WI-8. *Commits:* one per
  item, e.g. `refactor(contacts): relabel autopilot copy + remove orphan relationshipAutopilotService`,
  `chore(contacts): delete superseded ContactsList/SmartListPanel forks`,
  `chore(contacts): prune verified-orphan exports/methods`.
- **Wave 5 — Stub resolution.** WI-9. *Commit:* build or delete per sub-decision.
- **Wave 6 — Phase C activation (own session).** WI-10a→10e. *Commits:* migration
  applies + edge deploys recorded; `feat(contacts): wire Phase C card detail + ReceivedTab
  actions`; flag flip recorded last.

---

## 4. Out of Scope / Deferred (deliberate)

- **Honest "coming soon" sub-surfaces (§3.2):** `ContactGoalModal:203` and
  `FindTeammatesSheet:271-286` are labeled-honest, not broken — no change.
- **§7b other de-wired components not chosen in D4:** `MeetingPrepCard`
  (`MeetingPrepCardComponent`/`MeetingPrepBanner`), `CircleDetail`, `ConversationContext`
  remain orphaned, intact, preserved. Not deleted, not mounted this pass.
- **Map's internal `src/components/map/contacts/*`** — not part of this section (false positive).
- **Export-from-section** (data export lives in Settings/Privacy) — not added here.
- **Responsive/mobile audit** of the People surface — not in this pass.
- **WI-9 build path** if the build-vs-delete sub-decision lands on "delete."

---

## 5. Verification Strategy

- **Type-check:** `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`
  (default heap OOMs → false clean). Repo has **~1234 pre-existing** type errors
  (vite/esbuild skip type-check), so the gate is **"no NEW errors"**, not zero.
  For speed, a targeted check piped through `grep -E "contacts|savedFilters|todayFeed"`.
- **DB (per migration):** re-query `information_schema.tables` (table exists),
  `pg_policies` (policy count), `supabase_migrations.schema_migrations` (registered);
  for Phase C also `to_regprocedure('public.revoke_contact_card_cascade(uuid,text)')`.
  Always dry-run in a rolled-back transaction first (CLAUDE.md schema-first rule).
- **Edge functions (WI-10b):** `list_edge_functions` shows the 7 slugs ACTIVE post-deploy.
- **Tests:** `npm run test` (Vitest) for any touched service; the AcceptCardConfirmation
  test already exists for Phase C.
- **Manual/E2E:** per-item behavior checks listed in each work item; Phase C gets a full
  send→receive→accept/decline/revoke E2E before the flag flip.
- **Per CLAUDE.md:** commit each unit; explicit-path `git add`; don't batch unrelated
  changes; `Co-Authored-By` trailer; gitleaks pre-commit not bypassed.

---

## Appendix — current uncommitted working-tree state (flagged, not mine)
At session start the tree had (none authored this session): staged deletion
`D test-results/.last-run.json`; untracked `_shots/`; untracked
`docs/triage/contacts-triage-2026-06-02.md` (the source report). These are left
untouched. Recommend committing the source report + this plan (both tracked-location
docs) for safety before execution; the staged deletion and `_shots/` are the user's call.
