# Email Repair Plan — 2026-06-01

Source report: `docs/triage/email-triage-2026-06-01.md` (read 2026-06-01)
Scope chosen by user: **Full restoration** (work the entire orphan inventory).

> This is an **approved planning artifact**, not an execution log. No code has
> been changed producing it. Each work item is the green light to *propose* that
> change in turn (with its Rule-A confirmation for destructive items), run its
> verification, and commit — one at a time. Approval of this plan's direction is
> NOT approval to delete; destructive items (WI-8 cut path, WI-11, WI-12) carry
> their own per-item gate at execution.

---

## 0. Verification Delta

The triage report was generated **today** and re-verified today against the real
current files + the live `pulse-chat` DB (ref `ucaeuszgoihoyrvhewxk`).

**Drift: none.** The most recent email-touching commit is `f255429`
(`refactor(email): merge Summary + Meeting + Tasks into one composite AI block`)
— exactly the "top of log" the report cites. Today's 5 commits are all
Messages / War Room / analytics, none touch `src/components/Email/**`,
`src/services/email*`, or `src/store/email*`. The report's snapshot is current.

**Finding-by-finding re-confirmation:**

| Finding | Report says | Re-verified | Status |
|---|---|---|---|
| SignalRow dead chips (`SignalRow.tsx:118`) | `onClick={(e)=>e.stopPropagation()}` no-op | Confirmed verbatim at `:118` | **CONFIRMED** |
| TriageDone fake stats (`TriageDone.tsx:17`) | hardcoded `'…~14s per email. 22% quicker…'` default | Confirmed verbatim at `:17`; no caller passes `summary` (`TriageView` renders bare) | **CONFIRMED** |
| CalendarPeekRail mock (`CalendarPeekRail.tsx:18`) | renders `MOCK_CALENDAR` | Confirmed verbatim; self-documented "Phase 2: still static mock data" | **CONFIRMED** |
| EmailSettings toggles (`EmailSettingsModal.tsx:557,568,575`) | `defaultChecked`/static, no `onChange` | Confirmed: `defaultChecked` checkboxes + uncontrolled `<select>`, zero handlers | **CONFIRMED** |
| Confidential send (`EmailComposerModal.tsx:366`) | "silently fails" to catch path | Confirmed wired to `confidentialEmailService.create()` → `.from('confidential_emails')`. **Refinement:** the email itself **sends fine** (lines 350-362, before the confidential block); only the metadata save fails, into a **visible** `toast.error('Email sent, but confidential settings failed to save.')`. Not silent — but confidential protections never apply. | **CHANGED** (real defect, characterization refined) |
| `confidential_emails` table | absent on live DB | `information_schema` query: **absent** | **CONFIRMED** |
| `email_filters` / `filter_execution_log` | absent | **absent** | **CONFIRMED** |
| `email_signatures` | absent | **absent** | **CONFIRMED** |
| `email_labels`, `email_campaigns`, `email_accounts`, `cached_emails` | present | **present** | **CONFIRMED** |
| Orphan importers (8 components) | "none mount" | Grep confirms: only self-refs + `featureFlags.ts` (flag def) + `hooks/index.ts` (barrel re-export of `useEmailKeyboardShortcuts`). No live host mounts any. | **CONFIRMED** |
| Backup DDL | in `migrations_backup/` | `20260114_{confidential_emails,email_filters,email_signatures,email_accounts}.sql` all present | **CONFIRMED** |
| Shift+N sync stub (`useEmailHybridShortcuts.ts:88`) | "phase-stub toast" | **CHANGED:** `onSync={handleSync}` **is** wired (`EmailHybridClient.tsx:557,595`); the toast is only the no-handler fallback. **Sync already works.** | **CHANGED** (partially stale) |
| Ctrl+Z undo stub (`:95`) | "Phase 7 toast" | Confirmed hardcoded `toast('Undo send lands in Phase 7.')` — BUT a real 30s-undo flow (`handleUndo`, `UNDO_SEND_DELAY_MS=30000`) **exists** in `handleSendEmail` (`:420`). The key just isn't wired to it. | **CONFIRMED** (with a real handler available to wire) |
| `g i/s/t/d` folder nav stub (`:136`) | "Phase 6 toast" | Confirmed hardcoded toast; `FolderListView` + folder state exist to wire into | **CONFIRMED** |

**Net:** every finding holds. Two refinements (confidential is *notified*, not
silent; Shift+N sync already functions) **shrink** the work, they don't add it.
The schema ground-truth is exactly as reported.

---

## 1. Decisions Taken

All forks were surfaced to the user; answers recorded verbatim.

| # | Decision | Options offered | **User choice** | Consequence |
|---|---|---|---|---|
| D1 | **Scope of pass** | live-only / quick-wins / full restoration | **Full restoration** | Entire orphan inventory is in play; multi-wave plan |
| D2 | **Confidential mode** | gate off / **ship table+RLS** / leave | **Ship `confidential_emails` table + RLS** | WI-6. Caveat acknowledged: even with the table there is **no recipient-side enforcement** — confidential remains metadata-only on the receiving end. This makes the *save* succeed and the toast-error stop. |
| D3 | **CalendarPeekRail** | hide / **wire to googleCalendarService** / leave | **Wire to `googleCalendarService` now** | WI-4. `getTodayEvents()` exists; gate on `isConnected()`/empty |
| D4 | **TriageDone stats** | **neutral line** / compute real / leave | **Replace with a neutral editorial line** | WI-1. Avoids the hero-metric register DESIGN.md bans |
| D5 | **RelationshipPanel** | **re-wire** / park / cut | **Re-wire — with a hard constraint** | WI-7. User: *"I don't want the UI changed in the email section… without bringing back old design elements."* → re-wire data/logic only; render in current hybrid design language (pulse tokens); leave behind the legacy `stone/zinc` styling. Verified: the component imports **no** legacy CSS/components, so the constraint is satisfiable by a className re-skin alone. |
| D6 | **FollowUpNudge** | **investigate overlap → merge/cut** / re-host / park / cut | **Investigate overlap, then merge or cut** | WI-8. Diff vs the live `AwaitingRepliesRail` first; decision deferred to that evidence |
| D7 | **Campaigns trio** | **park behind flag** / re-host+harden / cut | **Park behind the flag until send is hardened** | Out of scope this pass (§4). Tracked as issue #105 (foreground send-loop → backend queue) |
| D8 | **Filters & Labels** | **revive LabelManager now; revive FilterManager with tables** / label-only / park / cut | **Revive both (LabelManager now, FilterManager + tables)** | WI-9 + WI-10 |
| D9 | **EmailTemplatesModalEnhanced** | **upgrade composer (re-skinned)** / park / cut | **Upgrade the composer to it, re-skinned to current design** | WI-11. Rule-A swap of the live `TemplatesModal`; same no-legacy-chrome constraint as D5 |
| D10 | **useEmailKeyboardShortcuts** | **delete** / keep | **Delete it** | WI-12. Rule-A; final no-consumer grep before removal |

---

## 2. Work Items

Complexity key: TRIVIAL (<5 min) · MODERATE (<30 min) · COMPLEX (>30 min).
Verification gate per CLAUDE.md: repo has ~1234 pre-existing `tsc` errors and
`tsc --noEmit` OOMs at default heap → run with
`NODE_OPTIONS=--max-old-space-size=8192` and gate on **no NEW errors on changed
scope**, not zero.

### WI-1 — TriageDone: replace fabricated stat with a neutral line
- **Findings:** §5 TriageDone (STUB, HIGH — ships fake claims to every user).
- **Files/lines:** `src/components/Email/hybrid/TriageDone.tsx:17`.
- **Archetype:** targeted repair (CRACKED-style honesty fix).
- **Approach:** change the default `summary` from
  `'Your fastest session this week. ~14s per email. 22% quicker than last week.'`
  to a metric-free editorial line, e.g.
  `'Queue cleared — your inbox is quiet for now.'` Keep the prop optional so a
  future real summary can still be passed. No new hero-metric register
  (consistent with the file's own DESIGN.md note at `:1-4`).
- **Complexity:** TRIVIAL.
- **Dependencies:** none. **Blast radius:** one default string; the component's
  layout/halo unchanged.
- **Verification:** `tsc` on the file; visually confirm the completion screen
  shows the neutral line (Triage → clear queue).

### WI-2 — SignalRow: wire collapsed AI chips to `openReply`
- **Findings:** §3 #1 (CRACKED — no-op chips since the `06e07dc` scaffold).
- **Files/lines:** `src/components/Email/hybrid/cockpit/SignalRow.tsx:115-125`.
- **Archetype:** targeted repair (reconnect to the existing store action).
- **Approach:** copy the InlineReader pattern verbatim:
  `const openReply = useEmailComposeStore((s) => s.openReply);` then change the
  chip `onClick` from `(e) => e.stopPropagation()` to
  `(e) => { e.stopPropagation(); openReply(email._raw, a.label); }`.
  `email._raw` is provided by the `emailRow` view-model (same source InlineReader
  reads). Net: collapsed-row chips do what the expanded-row chips already do.
- **Complexity:** TRIVIAL.
- **Dependencies:** none. **Blast radius:** one onClick + one store import; the
  TRIAGE/expand affordances on the same row are untouched.
- **Verification:** `tsc` on the file; click a collapsed signal's suggested-reply
  chip → composer opens pre-seeded.

### WI-3 — EmailSettings: wire the 3 decorative General controls
- **Findings:** §3 #2 (CRACKED — Auto-sync / Email Notifications toggles +
  Sync Frequency select are `defaultChecked`/uncontrolled).
- **Files/lines:** `src/components/Email/EmailSettingsModal.tsx:557,568,575`.
- **Archetype:** targeted repair (state + persistence).
- **Approach:** convert the three to controlled inputs backed by state, persisted
  via the existing `src/services/settingsService.ts` (confirm its key shape at
  execution — read it first, don't assume column/key names). Mirror how the
  *working* General controls on the same tab (theme/accent/zoom/bundling/
  auto-archive/Drive) already persist.
- **Complexity:** MODERATE.
- **Dependencies:** none (settingsService exists). **Blast radius:** isolated to
  the General tab; the other 4 tabs untouched.
- **Verification:** `tsc` on the file; toggle a control, reopen settings →
  state persists; confirm the persisted key round-trips through settingsService.

### WI-4 — CalendarPeekRail: render real today's events
- **Findings:** §5 CalendarPeekRail (STUB, HIGH — fabricated events).
- **Files/lines:** `src/components/Email/hybrid/cockpit/CalendarPeekRail.tsx`
  (whole file, currently maps `MOCK_CALENDAR`).
- **Archetype:** build-it-for-real (STUB → live data, per D3).
- **Approach:** replace the `MOCK_CALENDAR` import/map with
  `googleCalendarService.getTodayEvents()` (verified to exist, `:543`,
  returns `CalendarEvent[]`). Gate on `googleCalendarService.isConnected()`
  (`:440`): if not connected or zero events, render an honest empty/hidden state
  rather than fabricated rows. Load in a `useEffect` with loading + error guards;
  keep the existing CALENDAR·TODAY masthead + token styling. Map `CalendarEvent`
  → the row shape (time, title, `linked`).
- **Complexity:** MODERATE.
- **Dependencies:** none hard (googleCalendarService is live). **Blast radius:**
  the rail only; removes the last live `mockEmails.ts` leak (`MOCK_CALENDAR`).
- **Verification:** `tsc`; with a connected Google account, rail shows real
  events; disconnected → empty/hidden, never mock.

### WI-5 — useEmailHybridShortcuts: finish the wired-able stub keys
- **Findings:** §3 #4 (CRACKED — `Ctrl+Z`, `g i/s/t/d` are toasts).
- **Files/lines:** `src/components/Email/hybrid/data/useEmailHybridShortcuts.ts:92-97,131-137`;
  consumes handlers from `EmailHybridClient.tsx`.
- **Archetype:** targeted repair (complete keyboard nav).
- **Approach:** (a) `Ctrl+Z` → wire to the **existing** 30s-undo flow. The real
  handler lives as a closure (`handleUndo`, `:420`) inside `handleSendEmail`;
  lift it to a ref/state on `EmailHybridClient` and pass an `onUndo` into the
  hook, replacing the "Phase 7" toast. (b) `g i/s/t/d` → pass an
  `onGoToFolder(folder)` that calls the existing folder setter (the one
  `FolderListView` uses) instead of the "Phase 6" toast. (c) **Note:** `Shift+N`
  sync is already functional — leave it; just delete the stale "lands in Phase"
  wording if it remains anywhere user-visible. Keep the shortcuts-modal labels
  honest.
- **Complexity:** MODERATE.
- **Dependencies:** none (undo flow + folder state both exist). **Blast radius:**
  the hook + a couple of new props threaded from the client.
- **Verification:** `tsc`; press `Ctrl+Z` within the 30s window → send cancels;
  `g` then `i/s/t/d` → folder switches.

### WI-6 — Ship the `confidential_emails` table + RLS (data-path defect)
- **Findings:** §3 #3 (CRACKED→data path), §8b/§8c broken connection.
- **Files:** `supabase/migrations_backup/20260114_confidential_emails.sql`
  (source DDL) → a new forward migration; consumer
  `src/services/confidentialEmailService.ts` (unchanged — already correct);
  reachable from `EmailComposerModal.tsx:366`.
- **Archetype:** build-it-for-real (per D2) — schema repair.
- **Approach (schema-first, per CLAUDE.md §4):**
  1. The backup DDL is sound: PK uuid, `user_id uuid → auth.users`,
     `email_id text → cached_emails(id)`, 4 RLS policies (select/insert/update/
     delete on `auth.uid() = user_id`), 4 indexes, `updated_at` trigger.
  2. **Add the security-baseline pin** (per the 2026-05-31 DB security baseline
     memory: all functions pin `search_path`): give
     `update_confidential_emails_updated_at()` a
     `SET search_path = public, pg_temp` clause — the backup DDL omits it.
  3. **Dry-run in a rolled-back transaction** (`DO $$ … RAISE EXCEPTION
     'rollback' $$`) until it completes clean, **then apply once** via
     `apply_migration`. Never apply-then-debug.
  4. Re-query `information_schema` to confirm the table + policies landed.
- **Complexity:** COMPLEX (migration + RLS + verification).
- **Dependencies:** none. **Blast radius:** new table only; additive. Does NOT
  add recipient-side enforcement (documented limitation — confidential stays
  metadata-only). **Cascade if left broken:** confidential compose keeps
  erroring on every send.
- **Verification:** dry-run clean; post-apply `information_schema` shows table +
  4 policies + search_path-pinned trigger fn; live confidential send round-trip
  → no toast-error, row appears in `confidential_emails`.

### WI-7 — Re-wire RelationshipPanel into the reader (re-skinned, no legacy UI)
- **Findings:** §7 RelationshipPanel (ORPHAN, strong re-wire candidate).
- **Files:** `src/components/Email/RelationshipPanel.tsx` (365) →
  mount in `src/components/Email/hybrid/EmailReaderPanel.tsx` (and/or
  `cockpit/InlineReader.tsx`).
- **Archetype:** reconnect (severed-by-host-deletion) + re-skin.
- **Approach — and the D5 hard constraint:** the panel imports **only**
  `supabase`, the `CachedEmail` type, and `lucide` icons — **no legacy CSS or
  components**. So re-wiring brings back **no** old design. The one thing to fix
  is its internal Tailwind palette (`stone-*`/`zinc-*`) → migrate those
  className strings to `pulse-*` tokens so it reads as native hybrid chrome.
  Then mount it as a contact-context sidebar in the reader, passing the open
  email (`RelationshipPanelProps { email: CachedEmail; onClose }`). Its data
  reads (`email_contacts`, recent threads from `cached_emails`) + notes save are
  already real — do not alter them.
- **Complexity:** COMPLEX (re-skin pass + layout integration).
- **Dependencies:** none hard. **Blast radius:** additive to the reader; existing
  reader content must reflow to host a 288px sidebar without regressing
  InlineReader. **No deletion.**
- **Verification:** `tsc`; open an email → panel shows real contact stats +
  recent threads; notes save round-trips; visual check that **no** stone/zinc
  legacy styling remains and the email section's existing UI is otherwise
  unchanged (per D5).

### WI-8 — FollowUpNudge: investigate overlap vs AwaitingRepliesRail → merge or cut
- **Findings:** §7 FollowUpNudge (ORPHAN).
- **Files:** `src/components/Email/FollowUpNudge.tsx` (268) vs the live
  `src/components/Email/hybrid/cockpit/AwaitingRepliesRail.tsx` (44).
- **Archetype:** confirm-then-decide (per D6).
- **Approach:** at execution, diff the two surfaces' behavior. Both detect sent
  mail awaiting replies; FollowUpNudge adds urgency tiering + `settingsService`.
  - If FollowUpNudge is a **superset**: fold its urgency-tiering logic into the
    live rail (additive), then retire the orphan **with a Rule-A block**.
  - If it's a **strict dup**: cut FollowUpNudge **with a Rule-A block**
    (exact files/lines, pros/cons, preserve-vs-sacrifice, completeness proof).
  - Either deletion is a **gated** act — present pros/cons and WAIT.
- **Complexity:** MODERATE (investigation) + the chosen path.
- **Dependencies:** none. **Blast radius:** if merging, the live Cockpit rail.
- **Verification:** `tsc`; awaiting-replies surfacing still works (and shows
  urgency tiers if merged); no second competing follow-up UI ships.

### WI-9 — Revive LabelManager (table exists)
- **Findings:** §7 LabelManager (ORPHAN, revivable now per D8).
- **Files:** `src/components/Email/LabelManager.tsx` (364) → host it (settings
  tab or chrome dropdown — confirm best mount at execution).
- **Archetype:** reconnect (host-only gap).
- **Approach:** `email_labels` **exists live** and LabelManager already does real
  CRUD + applies labels to `cached_emails` (`:141-167`). Mount it behind a
  settings entry (or FoldersDropdown affordance). Same D5 re-skin discipline:
  migrate any `stone/zinc` styling to pulse tokens; bring back no legacy chrome.
- **Complexity:** MODERATE.
- **Dependencies:** none (table present). **Blast radius:** additive host UI.
- **Verification:** `tsc`; create/rename/delete a label persists to
  `email_labels`; applying a label mutates `cached_emails`; live round-trip.

### WI-10 — Revive FilterManager + ship its tables + finish stub actions
- **Findings:** §4 `emailFilterService` (SEVERED), §7 FilterManager (ORPHAN),
  §5 (internal stubs).
- **Files:** `src/components/Email/FilterManager.tsx` (578);
  `src/services/emailFilterService.ts` (590, stubs at `:214` `'label'`→false,
  `:347` `'forward'`→log-only); DDL
  `supabase/migrations_backup/20260114_email_filters.sql` (→ `email_filters`,
  `filter_execution_log`).
- **Archetype:** build-it-for-real (host + tables + finish stubs), per D8.
- **Approach:**
  1. **Schema-first:** read the `email_filters` backup DDL; add `search_path`
     pins to any functions; dry-run in a rolled-back txn; apply once; verify via
     `information_schema`.
  2. Finish the two service stubs: `'label'` action should apply a label (reuse
     LabelManager's label-apply path from WI-9), `'forward'` should actually
     forward (or be explicitly gated with an honest "not yet" if forwarding needs
     backend work — name it, don't fake it).
  3. Host FilterManager (settings tab), re-skinned to pulse tokens (D5).
  4. **Honest limitation to surface in UI:** FilterManager is UI-only — it does
     **not** apply rules to *incoming* mail (no rules-execution engine exists).
     Label it as manage-rules-only, or scope an apply-on-demand action; do not
     imply auto-filtering that isn't built.
- **Complexity:** COMPLEX (migration + 2 stub completions + host + re-skin).
- **Dependencies:** **WI-9** (reuses the label-apply path for the `'label'`
  action). **Blast radius:** new tables + new settings UI + service behavior
  change. Additive.
- **Verification:** dry-run clean; tables + policies present post-apply; `tsc`;
  create a filter persists to `email_filters`; the `'label'` action applies a
  label; `filter_execution_log` records a run.

### WI-11 — Upgrade composer to EmailTemplatesModalEnhanced (Rule-A swap, re-skinned)
- **Findings:** §7 EmailTemplatesModalEnhanced (ORPHAN, per D9).
- **Files:** `src/components/Email/EmailTemplatesModalEnhanced.tsx` (509) replaces
  the live `src/components/Email/TemplatesModal.tsx` (386) at its mount in
  `EmailComposerModal.tsx:1720`.
- **Archetype:** orphan-revive **as a destructive swap** → **Rule-A gated**.
- **Rule-A block (to present + get explicit approval before executing):**
  - **Exactly what changes:** swap the import/mount at `EmailComposerModal:1720`
    from `TemplatesModal` to `EmailTemplatesModalEnhanced`; once proven, delete
    `TemplatesModal.tsx` (386) and its `TemplateVariablesModal` linkage if the
    Enhanced one subsumes it (verify — `TemplateVariablesModal` may still be
    needed).
  - **Pros:** favorites, categories, usage tracking; one template modal instead
    of two; removes a 386-LoC near-dup.
  - **Cons / at risk:** the live composer's exact template-insert contract
    (variable substitution via `TemplateVariablesModal:1728`, the `onSelect`
    shape, autosave interplay) must be preserved; Enhanced must be proven a
    **superset** of every current behavior before `TemplatesModal` is cut. Risk
    of regressing template-variable flow if Enhanced handles variables
    differently.
  - **Preserve vs sacrifice:** preserve all current insert/variable behavior;
    sacrifice the simpler modal only after parity is proven.
  - **Completeness proof required:** before deletion, demonstrate Enhanced
    handles variables + insert identically (or better).
  - **D5 constraint:** re-skin Enhanced to pulse tokens; no legacy chrome.
- **Complexity:** COMPLEX.
- **Dependencies:** none hard. **Blast radius:** the composer's template path.
- **Verification:** `tsc`; insert a template with variables via the composer →
  identical-or-better result vs today; favorites/categories work; only after
  parity proven, remove `TemplatesModal` and re-verify the composer still builds
  and inserts.

### WI-12 — Delete useEmailKeyboardShortcuts (superseded, Rule-A)
- **Findings:** §7 `useEmailKeyboardShortcuts` (ORPHAN, DELETE candidate, per D10).
- **Files:** `src/hooks/useEmailKeyboardShortcuts.ts` (358); its re-export in
  `src/hooks/index.ts`.
- **Archetype:** orphan deletion → **Rule-A gated**.
- **Rule-A block (present + approve before executing):**
  - **Exactly what changes:** delete `useEmailKeyboardShortcuts.ts` and remove
    its line from the `hooks/index.ts` barrel.
  - **Pros:** removes 358 LoC of genuinely superseded dead code (replaced by
    `useEmailHybridShortcuts`).
  - **Cons / at risk:** if any consumer imports it via the barrel, that breaks.
  - **Completeness proof required:** a fresh repo-wide grep proving the **only**
    references are the file itself + the barrel re-export (today's grep already
    shows exactly that — re-run at execution to be safe).
  - **Preserve vs sacrifice:** nothing functional sacrificed (the live hook is
    `useEmailHybridShortcuts`).
- **Complexity:** TRIVIAL (after the grep).
- **Dependencies:** do **last** (destructive). **Blast radius:** the barrel.
- **Verification:** post-delete grep returns zero references; `tsc` on changed
  scope shows no new errors; app builds.

---

## 3. Launch Order

See §5 for waves; the dependency-sorted table is there.

---

## 4. Out of Scope / Deferred (deliberate — not missed work)

| Item | Why deferred | Tracking |
|---|---|---|
| **Campaigns trio** (Builder 900 + Dashboard 555 + SegmentBuilder 205) | D7: park behind `emailCampaigns` flag. Re-hosting requires moving `emailCampaignService.send()` from a fragile foreground browser loop to a backend queue (+ unsubscribe/dedup/open-tracking) — a multi-day sub-project. | issue #105; flag `emailCampaigns` stays `false` |
| **emailSignatureService + signatures UI** | §4 SEVERED + §9c gap. There is **no** signatures UI anywhere — reviving this is a net-new feature build (service + missing `email_signatures` table + brand-new UI), not a restoration of stranded code. Not surfaced as a fork this pass. | Recommend a separate feature decision |
| **DraftedForYouRail / InlineReader draft block / TriageView "Send draft"** | §9b DORMANT — all gated on a `draft` that is always `null`/`[]` (v1.1 AI-drafts feature not built). | v1.1 |
| **`types/email.ts` legacy parallel model** | DORMANT — superseded by `CachedEmail`; harmless. Cleanup only if it causes confusion. | — |
| **`emailTemplateService.generateTemplate()` AI stub** (`:397`) | §5 LOW — returns hardcoded subject. Nice-to-have; route through `ai-router` later. | v1.1 |
| **`emailSyncService` folder counts hardcoded 0** (`:801-805`) | §5 LOW — important/snoozed/spam unread counts. Polish. | v1.1 |
| **`unifiedSearchService.ts:330` reads legacy `emails` table** | §8c — global search reads `emails` (wide-open `USING(true)` RLS) while the inbox reads `cached_emails`. A correctness divergence + a **permissive-RLS security note**. Outside the strict Email surface; warrants its own security-scoped pass, not a bundle into this UI repair. | **Flag for a separate security/data pass** |

---

## 5. Recommended Launch Order

### Dependency graph
```
WI-9 (LabelManager revive) ──────► WI-10 (FilterManager: reuses label-apply path)
WI-6 (confidential table) ── isolated migration, unblocks nothing else
WI-1, WI-2 ── trivial, independent
WI-3, WI-4, WI-5 ── moderate live-surface, independent
WI-7 (RelationshipPanel) ── independent re-skin
WI-11 (Templates swap) ── independent, DESTRUCTIVE (Rule-A)
WI-8 (FollowUpNudge) ── independent, may be DESTRUCTIVE (Rule-A)
WI-12 (delete old hook) ── independent, DESTRUCTIVE (Rule-A), do LAST
```
Only one hard edge: **WI-9 → WI-10**. Everything else is ordered by impact +
reversibility (additive before subtractive; destructive last).

### Sequenced table
| Order | Item | Category | Complexity | Why here | Unblocks |
|---|---|---|---|---|---|
| 1 | WI-1 TriageDone neutral line | Stub→honesty | TRIVIAL | Stops fake claims to every triage user; cheapest win | momentum |
| 2 | WI-2 SignalRow chips → openReply | Cracked | TRIVIAL | Restores dead live buttons; one-line route | — |
| 3 | WI-6 confidential table + RLS | Cracked→schema | COMPLEX | The one data-path defect; isolated migration, do early while focused | confidential send |
| 4 | WI-4 CalendarPeek → real events | Stub | MODERATE | Removes last live mock-data leak | — |
| 5 | WI-3 settings toggles wiring | Cracked | MODERATE | Real persistence of sync/notif prefs | — |
| 6 | WI-5 shortcut keys (undo/nav) | Cracked | MODERATE | Completes keyboard nav (sync already works) | — |
| 7 | WI-9 LabelManager revive | Orphan→revive | MODERATE | Table exists; lowest-risk orphan; foundation for WI-10 | **WI-10** |
| 8 | WI-7 RelationshipPanel re-wire | Orphan→reconnect | COMPLEX | High-value reader feature; additive + re-skin (D5) | — |
| 9 | WI-10 FilterManager + tables | Orphan/Severed→build | COMPLEX | Needs WI-9's label path + new tables | — |
| 10 | WI-11 Templates upgrade (swap) | Orphan→destructive | COMPLEX | **Rule-A** swap of a working modal; after additive work is stable | — |
| 11 | WI-8 FollowUpNudge merge/cut | Orphan→decide | MODERATE+ | **Rule-A** if cut; needs the live rail stable to diff against | — |
| 12 | WI-12 delete old shortcut hook | Orphan→destructive | TRIVIAL | **Rule-A**; pure deletion, do last after grep | — |

### Waves (each leaves a committable, verified state)
- **Wave 1 — Stop shipping fake/dead content.** WI-1, WI-2.
  *Commits:* `fix(email): replace fabricated TriageDone session stat with neutral line`;
  `fix(email): wire collapsed SignalRow AI chips to openReply`.
- **Wave 2 — Confidential data path.** WI-6 (isolated migration).
  *Commit:* `feat(email): ship confidential_emails table + RLS (fixes silent confidential-save failure)`.
- **Wave 3 — Live-surface completion.** WI-4, WI-3, WI-5.
  *Commits:* one each — CalendarPeek real events; settings toggles persistence;
  keyboard undo/folder-nav.
- **Wave 4 — Orphan revivals (additive, re-skinned).** WI-9 → WI-7 → WI-10.
  *Commits:* one each — LabelManager host; RelationshipPanel re-wire; FilterManager
  + tables. (WI-9 before WI-10 by dependency.)
- **Wave 5 — Decisions & destructive cleanup (each Rule-A gated).** WI-11, WI-8,
  WI-12.
  *Commits:* one each — only after their per-item pros/cons are approved.

Per CLAUDE.md §3: commit each work item independently; never batch unrelated
changes; conventional-commit messages with `feat(email)/fix(email)/refactor(email)`
scope; sign with the `Co-Authored-By: Claude` line.

---

## 6. Verification Strategy

**Gate commands** (per the tsc-OOM + pre-existing-errors memory):
- Type-check changed scope: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`
  — gate on **no NEW errors** (repo carries ~1234 pre-existing). For speed,
  filter: `… | grep -E "Email|email"`.
- Unit/where applicable: `npm run test`.
- Migrations (WI-6, WI-10): **dry-run in a rolled-back transaction first**
  (`DO $$ … RAISE EXCEPTION 'rollback' $$`), then `apply_migration` once, then
  re-query `information_schema` to confirm. Never apply-then-debug.
- Live round-trips that need the backend (`server.js` on Render) or Google auth
  (CalendarPeek, confidential send, label apply) require a logged-in dev session
  — flag for a manual eyeball where headless can't reach them.

**Per-item check** is named in each WI above and must actually run (report real
output) before that item's commit — "done" requires evidence, per the operating
contract.

---

*Plan produced by `/triage-repair` from `email-triage-2026-06-01.md`. Re-verified
against live code + `pulse-chat` schema; forks decided by the user (§1). No code
changed in producing this plan.*
