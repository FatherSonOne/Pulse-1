# Email Hybrid — Phase 12: Post-Soak Refinements

**Date:** 2026-05-28
**Status:** In progress
**Prerequisite:** Phases 0–10 of [`EMAIL_HYBRID_REDESIGN_HANDOFF_2026-05-27.md`](./EMAIL_HYBRID_REDESIGN_HANDOFF_2026-05-27.md) shipped (currently at commit `81a388d` on `main`).

---

## 0. Context

After Phases 0–10 landed and the user spent real time on the hybrid surface (via the `EmailHybridFlagToggle` BETA pill), a batch of usability gaps surfaced. None of them block the existing rollout path; they're refinements that make the surface feel like a finished product instead of a parallel-build prototype.

Phase 11 (flag flip → legacy cleanup) stays paused until these items are addressed, so users defaulting to the hybrid don't hit the same rough edges.

---

## 1. Items

Numbered top-down by build order. Effort is rough sittings, not hours.

### 12.1 — Lane count categorization (BUG)

**Symptom:** Cockpit Lanes show counts like `Work 19, Admin 0, Tools 31, Newsletters 0, Personal 0` even though the inbox has hundreds of emails of mixed kinds.

**Root cause:** `categorize()` in `src/components/Email/hybrid/data/emailRow.ts` only routes into Admin/News/Personal when Gmail attached `CATEGORY_UPDATES` / `CATEGORY_PROMOTIONS` / `CATEGORY_SOCIAL` labels. Most users — and this one — receive calendar invites from custom domains (e.g. `magan@rippleofone.org`) where Gmail doesn't tag with `CATEGORY_UPDATES`. Those fall to the `'work'` default. The only thing reliably hitting Tools is `render.com` (and similar) because they're in `TOOL_DOMAINS`.

**Fix:**
- Subject-pattern rules for calendar invites → Admin
  (`/^(Invitation|Updated invitation|Canceled event):/i`, `/calendar-noreply@google.com/`).
- Subject-pattern rules for receipts/invoices → Admin
  (`/(Receipt|Invoice|Order|Payment) from/i`, sender includes `billing@`/`receipts@`).
- Newsletter detection → News
  (`List-Unsubscribe` header present, sender begins with `newsletter@`/`updates@`).
- Expand `TOOL_DOMAINS` to common dev tooling (jira, confluence, atlassian, segment, mixpanel, amplitude).
- Document that ALL emails route into exactly one lane (current property — keep it).

**Effort:** 1 sitting. Pure data-layer change in `emailRow.ts` with no UI work. Lane counts auto-update because they're a `useMemo` over `emailStore.emails`.

**Acceptance:** A test inbox with a mix of calendar invites, Render alerts, Stripe receipts, a newsletter, and a personal email shows non-zero counts in 4–5 lanes (not just Work + Tools).

---

### 12.2 — Lane auto-sort help tooltip (UX)

**Symptom:** The `LANES · AUTO-SORTED` header gives no hint how the sorting works. User feedback: "needs inline help and guidance."

**Fix:** Small info chip next to `AUTO-SORTED` that on hover/click reveals a popover explaining the categorization rules (the same logic from 12.1, in plain English).

**Effort:** 1 sitting. New small `LanesHelpTip.tsx` component, added to `CockpitView` next to the Lanes header.

**Acceptance:** Hover/click reveals a 5-line explanation; popover dismisses on click-outside / Esc.

---

### 12.3 — Compose fullscreen affordance (UX)

**Symptom:** "I don't see a way to open an email in a full page email composer." The `EmailComposerModal` does have a maximize button (`□` icon in its header), but it's tucked away and easy to miss.

**Fix two ways, pick one:**
- **(a)** Default `isMaximized` to `true` when opening from the Compose FAB (new messages start fullscreen; reply/forward still in panel).
- **(b)** Add a second FAB next to Compose: a "Fullscreen compose" button that sets `isMaximized` immediately.

Recommend (a) — fewer buttons, matches Gmail's "full-screen new message" preference.

**Effort:** 1 sitting. One state flip in `EmailComposerModal.tsx` (or pass `defaultMaximized` from `EmailHybridClient`).

**Acceptance:** Clicking the Compose FAB opens the modal already maximized; chevron toggles back to panel-mode.

---

### 12.4 — Slide-out reader panel for non-Signal rows (UX)

**Symptom:** Clicking a Lane row, Folder row, or Search row opens inline expansion (just shipped in `53d60a6`). User wants those to open a right-side slide-out panel instead, since regular emails are longer and need a wider reading surface. Signal rows can stay inline (they're curated cards).

**Fix:**
- New `EmailReaderPanel.tsx` slide-out (right edge, fixed width on desktop ~520px, full-width on mobile, slides in from the right).
- `LaneRow`, `FolderListView` rows, `SearchResultsView` rows trigger this panel via a new `useEmailUIStore.readerPanelEmailId` slot.
- Inline expansion in `SignalRow` stays as-is (different UX intent).
- Panel hosts the same content `InlineReader` would (body + thread + action bar + AI extractors from 12.7).
- Close via X button, Esc, or click-outside.

**Effort:** 2 sittings. New component + state plumbing + replace inline expansion in three places (Lane/Folder/Search) without breaking Signal.

**Acceptance:** Click a Lane email → slide-out appears with full body + actions. Click Esc / X / outside → panel closes. Signal rows still expand inline.

---

### 12.5 — Filter dropdown next to Search (UX)

**Symptom:** "There is no way to Filter emails." Search exists; structured filters don't.

**Fix:** Filter button next to the search input that opens a popover with:
- Read status: All / Unread only / Read only
- Star: All / Starred only
- Has attachment: All / With attachments
- Lane: All / Work / Admin / Tools / News / Personal
- Date range: All / Today / This week / This month / Custom

Filters compose with the current folder; when active, the active-filter chip strip shows above the list with a one-click remove on each chip.

**Effort:** 2 sittings. New `FiltersDropdown.tsx`, a derived `useFilteredEmails()` hook, a chip strip in `CockpitView` / `FolderListView`.

**Acceptance:** Apply a filter → list updates; chip appears above the list; click chip × → filter removed; persists across mode flips for the session, resets on folder change.

---

### 12.6 — Triage prev/next navigation (UX)

**Symptom:** "There is no way to cycle through each triage item — it's just one at a time." User wants to jump around the queue instead of strictly forward.

**Fix:**
- ← / → arrow keys move idx without firing an action (just navigate).
- On-screen prev/next buttons in the top bar (or footer next to BACK TO COCKPIT).
- Visible queue strip across the top: 9 small avatars / chips representing each queued item, current one highlighted, click any to jump.
- Action toast still shows on Archive/Snooze/Trash/etc.; navigation is silent.

**Effort:** 2 sittings. Keyboard handler additions in `TriageView`, a new `TriageQueueStrip.tsx` component, idx clamping logic.

**Acceptance:** ← moves to previous card without acting on the current one; → moves forward; chips highlight + click to jump; circle-back works (already-cleared items show CLEARED pip but are still navigable).

---

### 12.7 — Port MeetingExtractor + ActionItemExtractor (UX)

**Symptom:** Legacy `EmailViewerNew` renders rich AI-extracted cards above the body:
- **Meeting Detected** card with title / date / attendees / "Add to Calendar" button
- **Action Items Detected** card with checkbox list per item + "Create N Tasks" button
- **Quick Replies** chips at the top of the Gemini summary

The hybrid `InlineReader` and the planned slide-out panel currently show only the raw body + a simple action bar.

**Fix:**
- Wire `MeetingExtractor` (`src/components/Email/MeetingExtractor.tsx`) inside `InlineReader` and `EmailReaderPanel`.
- Wire `ActionItemExtractor` (`src/components/Email/ActionItemExtractor.tsx`) the same way.
- Quick-reply chips: add to the AI briefing strip near the top of the reader (similar to legacy).

**Effort:** 1–2 sittings. Mostly mounting existing components in the right slots; small layout work to make them fit the hybrid aesthetic.

**Acceptance:** Open a meeting invite → Meeting Detected card appears with Add-to-Calendar. Open an email with detected tasks → Action Items card appears with checkboxes.

---

### 12.8 — Third "Inbox" segmented tab (FEATURE)

**Symptom:** "I feel like there needs to be another tabbed section next to Cockpit and Triage that is just the basic email inbox view — for users that want to sort through manually."

**Fix:**
- Segmented toggle becomes `[Cockpit | Triage · N | Inbox]`.
- Inbox tab shows a chronological full-width list of all inbox emails, no AI curation, no lane bucketing.
- Bulk-select (already exists in `FolderListView`) is available here too.
- Row click opens the new slide-out reader panel (12.4).
- Keyboard: ⌘E only toggles Cockpit ↔ Triage; new ⌘I (or another binding) for Inbox tab, or just click.

**Effort:** 2 sittings. New `InboxListView.tsx` (largely reused logic from `FolderListView`), seg-toggle extended to three options, mode store updated.

**Acceptance:** Click Inbox tab → chronological list of all 50 cached inbox emails (no Signal/Lanes split). Click a row → slide-out. Bulk-select works.

---

### 12.9 — Email Settings modal redesigned to Cockpit aesthetic (POLISH)

**Symptom:** The `EmailSettingsModal` is the unchanged legacy design — orange/pink gradient header, generic form rows. Looks like a different app from the hybrid surface.

**Fix:**
- Rebuild header to match Cockpit serif headline + meta strip + canvas-soft background.
- Tabs (`General / Gmail / Sync / Accounts / Automation`) restyled to match `seg-toggle` aesthetic.
- Form rows use `pulse-tokens` neutrals + the rose-as-AI-signal coral budget (CLAUDE.md §4).
- Keep all functional behavior identical — settings storage, vacation responder, blocked senders, filter manager, label manager untouched.

**Effort:** 2 sittings. Visual-only rewrite of `EmailSettingsModal.tsx`; no service changes.

**Acceptance:** Open Settings from gear icon → cockpit-styled modal opens. All tabs still work; all settings still save.

---

## 2. Sequencing

Bucket A — Quick wins (target: one commit each, can land same day):
- 12.1 — Lane categorization
- 12.2 — Lane help tooltip
- 12.3 — Compose fullscreen affordance

Bucket B — Medium UX (target: one commit per item):
- 12.4 — Slide-out reader panel
- 12.5 — Filter dropdown
- 12.6 — Triage prev/next navigation
- 12.7 — Meeting/Action Items extractor port

Bucket C — Bigger work:
- 12.8 — Inbox tab
- 12.9 — Settings modal redesign

Phase 11 (flag flip + legacy cleanup) **continues to wait** until at least Bucket A + B land — those refinements make defaulting users to hybrid actually defensible.

---

## 3. Acceptance gate for Phase 11 unlock

Before flipping `emailHybrid` default to `true`, all of 12.1, 12.2, 12.4, 12.6, 12.7 must ship. 12.3 + 12.5 + 12.8 + 12.9 are nice-to-haves that can ride the soak.
