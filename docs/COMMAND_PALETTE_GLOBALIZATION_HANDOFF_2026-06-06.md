# Command Palette Globalization — Implementation Handoff

**Date:** 2026-06-06
**Origin:** `/impeccable critique` of the global search / command bar / palette / FAB
**Status:** Phases 1–5 SHIPPED. Phase 4 validated live. The command-surface *position*
went through three live iterations (floating pill → sidebar launcher) and is now being
**finalized** per the user's decision (2026-06-06): a **dedicated, persistent global
command bar header on every view** (see **Phase 6** below — the authoritative target).
Phase 6 is **SHIPPED + verified live** (`2d60aec` cutover, `a5c2fa6` dropdown portal fix).
The `commandBarGlobal` flag was removed in 5a.

> **Read Phase 6 first.** The "Final architecture (as shipped)" section below it documents
> the *interim* pill/sidebar state and is **superseded** by Phase 6's persistent header.

## Progress log

| Phase | Commit | State |
|-------|--------|-------|
| 1 — Section coverage (4 nav rows) | `c9ccdf1` | ✅ shipped |
| 2 — Global controls (`app:controls`) | `c9ccdf1` | ✅ shipped |
| 3 — Global section actions (`app:actions` + drains) | `b33daf5` | ✅ shipped |
| 4 — Global command bar pill (flagged) | `615f435` | ✅ shipped + validated live |
| 5a — Retire modal, flag removed, pill = one surface | `dad241f` | ✅ shipped, ⚠️ eyeball-pending |
| 5b — Globalize the quick-actions FAB (real actions) | `068a871` | ✅ shipped, ⚠️ eyeball-pending |
| (interim) Launcher → sidebar header (pill collided) | `4c92bf3` | ✅ shipped, ⚠️ superseded by Phase 6 |
| **6 — Dedicated persistent global command bar header** | `2d60aec` | ✅ **shipped + verified live** |
| 6-fix — Portal the dropdown above page content | `a5c2fa6` | ✅ shipped + verified live |

## Final architecture (as shipped)

- **Command surface:** the `GlobalCommandBar` pill (`GlobalCommandPalette.tsx`) on every
  view EXCEPT Dashboard (where the `InlineCommandPalette` hero bar stays). App renders
  `<GlobalCommandBar suppressed={view === AppView.DASHBOARD} />`. ⌘K → `pulse:command-palette-open`
  → the pill expands (or, on Dashboard, the hero bar focuses via a Dashboard listener).
  The centered modal is **deleted**.
- **Re-pointed buttons:** Calendar/Messages/CockpitHub "open palette" buttons now dispatch
  `pulse:command-palette-open` (they used to call the deleted modal's `open()`).
- **Quick-actions FAB:** `GlobalQuickActions.tsx`, mounted at App level, on every view.
  Real actions (task/contact/email composers, instant meeting, Quick-Relay contact picker);
  message/search navigate; War Room → `LIVE_AI` (route bug fixed). Email item gated on
  `emailEnabled`. The old Dashboard FAB + `dashboard:actions` scope + "?" button were removed
  (KeyboardChordsLayer already owns the `?` overlay).

## Eyeball checklist (do before considering this done)

Both themes + mobile: pill top-right on every non-Dashboard view; ⌘K expands it; Dashboard
shows the hero bar (no pill, no double bar) and ⌘K focuses it; drawer not clipped on
Messages/Calendar; the FAB shows on every view and each action fires (task/contact/email open
composers, meeting instant-starts, Quick Relay opens the contact picker → records, War Room
opens the War Room not Summit); Calendar/Messages/Cockpit palette buttons open the pill.

**Phase 4 form decision (2026-06-06):** user chose the **collapsed pill that
expands in place** (not a persistent full-width bar) — respects the dense
overflow-hidden views and costs no permanent vertical space. Implemented as a
portal'd top-right pill; expanded drawer is portal'd to `<body>` so it can't be
clipped. Flip `commandBarGlobal` in Settings → Features & Labs (new "Interface
(Beta)" category) to evaluate.

**To validate Phase 4 (do before Phase 5):** flip the flag, then confirm in both
themes + mobile — pill appears top-right on every view; ⌘K expands it (modal no
longer opens); drawer isn't clipped on Messages/Calendar; Esc/outside-click/run
collapses; Dashboard hero bar is gone (no double bar); pill doesn't collide with
any per-view top-right controls (reposition is trivial if it does).

---

## 0. Why this exists

The command palette engine is excellent (registry-based, fuzzy-scored, recents/most-used,
detector-clean). Three architectural gaps block it from being launch-grade:

1. **Coverage** — 4 sidebar sections (Glimpse, Analytics, Summit, War Room) have no palette
   nav; classic global controls (dark mode, sign out, switch workspace, open Pulse AI) have no
   command; section *actions* (Create Event, New Decision, Prioritize) only exist while that
   section is mounted, so "act from anywhere" half-works.
2. **Surface fragmentation** — three overlapping launch surfaces (Dashboard inline bar, centered
   ⌘K modal, Dashboard FAB) with inconsistent payloads (War Room route, Compose navigate-vs-open).
3. **The "global bar" isn't global** — `InlineCommandPalette` renders only inside Dashboard
   ([Dashboard.tsx:1312](../src/components/Dashboard.tsx#L1312)). On every other view there is no
   bar, only the modal.

## 1. Decisions locked (2026-06-06)

| # | Question | Decision |
|---|----------|----------|
| Coverage | How far? | **Sections + global controls + global actions** (the full set) |
| Surface (Q3) | Drawer model? | **Global bar + drawer, kill the centered modal** |
| FAB (Q2) | Keep it? | **Keep, make it real + global** (off Dashboard; items perform actions, not just navigate) |
| Sequencing | Order? | **Full plan, then execute** |

## 2. Current state (ground truth)

**Registry / runner:** `src/contexts/CommandPaletteContext.tsx` — `register(scope, {commands?,
provider?})`, `getMatches(query)` (fuzzy, dedupe-by-id first-seen), global shortcut runner
(rejects bare keys).

**UI:** `src/components/GlobalCommandPalette.tsx` exports two components sharing `getMatches`:
- `GlobalCommandPalette` — centered glass **modal**, portal'd, opened by ⌘K. Mounted once at
  [App.tsx:1357](../src/App.tsx#L1357).
- `InlineCommandPalette` — the **bar + anchored dropdown** ("the drawer"), rendered **only** in
  [Dashboard.tsx:1312](../src/components/Dashboard.tsx#L1312).

**Open path:** App's ⌘K handler ([App.tsx:1011](../src/App.tsx#L1011)) dispatches
`pulse:command-palette-open`; `AppCommandRegistrar` listens and calls `open()`
([App.tsx:229](../src/App.tsx#L229)).

**Registered command scopes today:**

| Scope | Where | Contents | Global? |
|-------|-------|----------|---------|
| `app:navigation` | App.tsx:470 | 14 nav rows (see gap below) | ✅ |
| `app:help` | App.tsx:471 | shortcuts + 7 Settings deep-links | ✅ |
| `app:create` | App.tsx:472 | New task, New contact | ✅ |
| `app:email` | App.tsx:473 | Compose email (gated `emailEnabled`) | ✅ |
| `app:meetings` | App.tsx:474 | Start a meeting (instant room) | ✅ |
| `contacts:people` | App.tsx:475 | provider → Open/Message/Meet/Vox `<name>` | ✅ |
| `dashboard:actions` | Dashboard.tsx:1243 | 8 quick-actions (navigate-only) | ❌ Dashboard-only |
| `calendar:actions` | Calendar.tsx:1663 | Today, Create Event, 6 view-switches | ❌ Calendar-only |
| `calendar:events` | Calendar.tsx:1664 | provider → event jump | ❌ Calendar-only |
| `decisions-cockpit` | CockpitHub.tsx:291 | New decision, Quick task, Prioritize, Export, Refresh | ❌ Cockpit-only |
| `messages:tools` | Messages.tsx:1238 | tool commands (gated OFF, `MESSAGES_TOOLS_ENABLED=false`) | ❌ Messages-only |

**Nav coverage gap** — `navDestinations` ([App.tsx:236](../src/App.tsx#L236)) vs sidebar
([Sidebar.tsx:84-132](../src/components/Sidebar/Sidebar.tsx#L84)):

| Section | View | In palette? |
|---------|------|-------------|
| Glimpse | `GLIMPSE` | ❌ |
| Analytics | `ANALYTICS` | ❌ |
| Summit | `LIVE` | ❌ |
| War Room | `LIVE_AI` | ❌ |

**FAB** ([Dashboard.tsx:1203](../src/components/Dashboard.tsx#L1203), rendered 1843) — 8 items, all
`setView(view,…)` (navigate-only). Bug: `warroom → AppView.LIVE`, but sidebar maps War Room →
`LIVE_AI` and Summit → `LIVE`. Dashboard-only (portal inside Dashboard).

## 3. Target state

- **One** command surface: a slim persistent command **bar** in the app chrome on every view; ⌘K
  focuses it and expands the **drawer** beneath. Centered modal retired.
- Palette navigates to **all 15** sections and exposes global **controls** and the high-value
  section **actions** from anywhere.
- FAB survives as the **touch / discoverability** affordance (mobile, at-rest), global, with items
  that perform real actions.

---

## 4. Feature-disposition matrix

| Item | Current | Disposition | Notes |
|------|---------|-------------|-------|
| `getMatches` / registry / runner | working | **KEEP as-is** | No engine changes. Everything below is registration + chrome. |
| `app:navigation` (14 rows) | global | **EXTEND** | +Glimpse, +Analytics, +Summit, +War Room (4 rows). Fix "Memory"→keep label but confirm keyword `archives`. |
| `app:help` (Settings deep-links) | global | **KEEP** | Already good. |
| `app:create` / `app:email` / `app:meetings` | global | **KEEP** | |
| `contacts:people` provider | global | **KEEP** | |
| **NEW** `app:controls` | — | **ADD** | Dark/light toggle, Sign out, Switch workspace, Collapse/expand sidebar, Open Pulse AI. |
| `dashboard:actions` | Dashboard-only, navigate-only | **REPLACE** | Fold useful items into global scopes; remove navigate-only dupes (they duplicate nav). |
| `calendar:actions` | Calendar-only | **PROMOTE (curated)** | Create Event + Go to Today become global via deep-link-then-fire; 6 view-switches stay section-local (only meaningful in Calendar). |
| `decisions-cockpit` | Cockpit-only | **PROMOTE (curated)** | New decision, Quick task, Prioritize become global; Export/Refresh stay local. |
| `messages:tools` | gated OFF | **LEAVE** | Untouched; flag stays off. |
| `InlineCommandPalette` | Dashboard hero | **PROMOTE to global chrome** | Becomes the one bar, rendered in `<main>` header on all views (flagged). |
| `GlobalCommandPalette` (modal) | global ⌘K | **RETIRE** (after cutover) | ⚠️ destructive — see §6. Kept as fallback until flag flips. |
| Dashboard FAB | Dashboard-only, navigate-only | **GLOBALIZE + upgrade** | Move to App chrome; items perform actions; fix War Room route. |
| FAB `warroom → LIVE` | likely mis-route | **FIX** → `LIVE_AI` | Confirm during impl. |
| Dead `shortcut: 'c'` on dt-quick-task | inert | **FIX or drop** | Either wire a real binding or remove the hint. |
| Email asymmetry (FAB navigate vs palette open) | inconsistent | **ALIGN** | FAB Compose opens composer via the same `handleComposeEmail` intent bridge. |

---

## 5. Phased implementation

### Phase 1 — Section coverage (additive, unflagged, ~30 min) ✅ safe
**Files:** `src/App.tsx`
- Add 4 entries to `navDestinations` ([App.tsx:236](../src/App.tsx#L236)): Glimpse (`fa-clapperboard`/video,
  `GLIMPSE`), Analytics (`fa-chart-line`, `ANALYTICS`), Summit (`fa-comments`, `LIVE`), War Room
  (`fa-book-open`, `LIVE_AI`), each with desc + keywords mirroring the existing rows.
- Benefits modal AND future bar immediately. Pure addition, reversible.

### Phase 2 — Global controls scope (additive, unflagged, ~45 min) ✅ safe
**Files:** `src/App.tsx` (new `app:controls` scope in `AppCommandRegistrar`; pass handlers as props)
- New `controlsCommands` registered under `app:controls`:
  - **Toggle dark / light mode** → `toggleTheme` ([App.tsx:691](../src/App.tsx#L691)). Label reflects
    current mode; `kind: 'action'`.
  - **Sign out** → `logout` ([App.tsx:549](../src/App.tsx#L549)). `kind: 'action'`, keywords logout/exit.
  - **Switch workspace** → ⚠️ verify the setter in `WorkspaceContext` before wiring (don't assume a
    name). If a switch handler exists, command opens the switcher or cycles; else defer this one item.
  - **Collapse / expand sidebar** → `setIsSidebarCollapsed` ([App.tsx:573](../src/App.tsx#L573)).
  - **Open Pulse AI** → `setShowPulseAI(true)` ([App.tsx:569](../src/App.tsx#L569)), keyword `assistant`,
    shortcut hint `⌘/` (live shortcut, chip will render).
- Thread the handlers into `AppCommandRegistrar` props (same pattern as `onNewTask` etc.).

### Phase 3 — Global section actions (curated promotion, unflagged, ~2–3h) ✅ safe-ish
**Files:** `src/App.tsx` (new `app:actions` scope), reuse existing intent bridges
- Promote the highest-value section actions to a global scope using **deep-link-then-fire** (the
  proven sessionStorage + event bridge pattern already used by `handleOpenContact` /
  `handleComposeEmail`):
  - **Create event** → set view CALENDAR + `pulse_pending_event` intent drained on Calendar mount
    (mirror `openTaskPanel`). Verify Calendar's mount-drain or add one.
  - **New decision / Quick task / Prioritize tasks with AI** → view DECISIONS_TASKS + a
    `pulse_pending_dt` intent drained by CockpitHub on mount (CockpitHub currently registers these
    only when mounted; add a cold-drain effect).
- Remove the now-redundant navigate-only `dashboard:actions` dupes (they're superseded by real
  global nav + actions). ⚠️ This deletes a working registration — minor, but list it in the
  cutover pros/cons.
- **Risk:** each promoted action needs a verified mount-drain on its destination, or it silently
  no-ops on cold navigation. Test each one cold (from Dashboard) and warm (already in section).

### Phase 4 — Global command bar + drawer (flagged `commandBarGlobal`, ~3–4h) ⚠️ destructive cutover
**Files:** `src/App.tsx` (render bar in `<main>` header), `src/components/GlobalCommandPalette.tsx`
- Render `InlineCommandPalette` in a persistent chrome row inside `<main>` ([App.tsx:1484](../src/App.tsx#L1484)),
  **above** the `renderContent()` scroller, so it shows on every view. Gate on `commandBarGlobal`.
- Re-point the ⌘K handler ([App.tsx:1011](../src/App.tsx#L1011)): when flag ON, ⌘K **focuses the bar**
  (dispatch `pulse:command-bar-focus`, InlineCommandPalette listens + `inputRef.focus()` + opens
  drawer) instead of opening the modal. When flag OFF, current modal behavior unchanged.
- Remove the Dashboard-local `<InlineCommandPalette>` ([Dashboard.tsx:1312](../src/components/Dashboard.tsx#L1312))
  when flag ON (avoid double bar on Dashboard).
- Keep the modal mounted while flag is OFF — **no deletion yet**.
- Mobile: bar collapses to a tap-to-expand search affordance; verify thumb-zone + 48px target.

### Phase 5 — Retire the modal + globalize the FAB (after Phase 4 proves out) ⚠️ destructive
**Files:** `src/App.tsx`, `src/components/GlobalCommandPalette.tsx`, `src/components/Dashboard.tsx`
- Once `commandBarGlobal` is validated in both themes + mobile: delete the `GlobalCommandPalette`
  modal component + its mount, remove the flag. **Requires explicit sign-off (Rule A, see §6).**
- Move the FAB out of Dashboard into App chrome (portal at App level) so it's global. Rewrite its
  items to perform actions (reuse `handleComposeEmail`, `handleNewTask`, `handleStartMeeting`,
  Vox/record intents) instead of bare `setView`. Fix `warroom → LIVE_AI`.
- Decide FAB-vs-bar overlap: FAB = touch/at-rest discoverability; bar = keyboard. Keep both,
  ensure they don't double on desktop (e.g. FAB hidden ≥lg where the bar is always visible, or
  FAB opens the bar's drawer pre-filtered to Actions).

### Phase 6 — Polish + verify (~1h)
- `/impeccable polish` pass on the new bar/drawer/FAB.
- Re-run `/impeccable critique` to confirm score lift + coverage.

---

## 6. Rule A — destructive-change pros/cons (approval gate)

These are the only subtractive moves. They do **not** execute until explicitly approved.

### 6a. Retire the centered modal (`GlobalCommandPalette`)
- **Exactly what changes:** delete the modal component body + its mount at App.tsx:1357; ⌘K stops
  opening a centered dialog and instead focuses the global bar.
- **Pros:** one canonical surface (fixes consistency heuristic #4, the weakest score); resolves Q3
  literally; less code; no more "two features" visual split.
- **Cons:** the modal is a known-good, a11y-complete (focus trap, aria-modal) surface used on
  every view today. The bar-focus model must replicate: focus management, Esc-to-close, mobile
  ergonomics, and not being clipped by `overflow-hidden` on Messages/Calendar panes
  ([App.tsx:1485](../src/App.tsx#L1485)). If the bar lives inside a scroll/overflow container, the
  drawer can be clipped — must verify or portal the drawer.
- **Preserved vs sacrificed:** all command resolution preserved (shared `getMatches`). Sacrificed:
  the centered focal moment some users prefer for a "stop and command" gesture.
- **Mitigation:** flagged cutover; modal stays until the bar is proven in both themes + mobile +
  the overflow-clip case. Delete only after sign-off.

### 6b. Remove navigate-only `dashboard:actions` dupes (Phase 3)
- **Pros:** removes redundant rows that duplicate real nav/actions; less noise.
- **Cons:** the FAB currently reads from the same `quickActions` array; must keep the FAB's source
  intact while removing only the palette registration. Low risk.

### 6c. Move/replace the FAB behavior (Phase 5)
- **Pros:** FAB stops being a worse palette; becomes a real touch affordance.
- **Cons:** changes muscle memory for Dashboard users who use the FAB today; navigate-only items
  that "just go to the section" become action items (different result). Confirm desired.

---

## 7. Verification

- `tsc` gate = **no NEW errors** (repo carries ~900 pre-existing; see [[reference_pulse_tsc_oom]];
  use `NODE_OPTIONS=--max-old-space-size=8192`).
- Manual: each new command fires cold (from Dashboard) and warm (in-section). Both themes.
- Each promoted action's mount-drain tested (the cold-navigation no-op is the top risk).
- Bar/drawer not clipped on Messages + Calendar (overflow-hidden panes).
- Mobile: bar + FAB thumb-zone, 48px targets.
- Re-run `npx impeccable --json` on changed components (expect clean).

## 8. Deferred / out of scope

- `messages:tools` stays gated off.
- Calendar 6 view-switches stay section-local (meaningless globally).
- Workspace-switch command deferred if no clean setter exists in `WorkspaceContext` (verify first).
- `aria-activedescendant` on the active row (a11y nicety, separate pass).

---

## 9. Suggested execution order

Phases 1–3 are pure additions — safe to ship now, benefit the modal immediately, and de-risk
the cutover by making coverage complete before the surface changes. Phases 4–5 are the flagged,
sign-off-gated surface cutover. Recommend: **ship 1–3, then pause for the §6 approval before 4–5.**

---

# Phase 6 — Dedicated persistent global command bar header (FINAL position)

**Decision (2026-06-06, user):** make the command surface a **dedicated command bar header
that is always visible at the top of the content area, identical on every view.** The user
explicitly chose to **sacrifice the vertical space** for a surface that is **consistent
throughout the app**. This supersedes the floating pill (5a) and the sidebar launcher
(`4c92bf3`).

**Why we landed here (the position journey):**
- Floating top-right pill (5a) → collided with per-section top-right controls (gear, SIGNALS/?).
- Sidebar header launcher (`4c92bf3`) → fixed the collision, but its drawer opened **centered**,
  which read as "a modal again," and the experience differed by view (Dashboard hero bar vs
  pill-drawer elsewhere).
- **Resolution:** one persistent bar, same place, every view. No floats, no per-view variants,
  no centered popup. The dropdown "slides down from the bar" (the bar IS the affordance).

## 6.1 Target architecture

ONE `InlineCommandPalette` rendered in a **persistent top chrome strip inside `<main>`**, above
the view content, on **every** view. ⌘K (and the mobile button / `g /` chord / the
Calendar·Messages·Cockpit buttons) **focus** that bar; focusing opens its dropdown
(`InlineCommandPalette` already does this). The bar is neutral chrome (coral only on focus
ring / active row, per DESIGN.md).

This is exactly the Dashboard hero bar (`InlineCommandPalette`) **lifted to the app shell** and
made universal. Everything else that exists today for "where the command surface lives" is
removed.

## 6.2 Change surface (exact, verified against `main` @ `4c92bf3`)

### ADD — the persistent header
**`src/App.tsx`** — restructure `<main>` (currently [App.tsx:1616-1622](../src/App.tsx#L1616)) into a
flex column with the bar pinned above a flex-1 scroll area. Current:
```jsx
<main className="flex-1 overflow-hidden relative transition-colors duration-500 w-full safe-area-bottom pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
  <div className={`h-full w-full flex flex-col ${MSG||CAL ? 'overflow-hidden' : 'overflow-auto mobile-scroll p-2 sm:p-3 md:p-4 lg:p-6'}`}>
    <div className={`w-full ${MSG||CAL ? 'h-full min-h-0 flex flex-col' : 'min-h-full max-w-[1600px] mx-auto flex flex-col'} animate-fade-in`}>
      {renderContent()}
    </div>
  </div>
</main>
```
Target:
```jsx
<main className="flex-1 overflow-hidden relative flex flex-col transition-colors duration-500 w-full safe-area-bottom pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
  <CommandBarHeader />               {/* shrink-0; ~56px strip; the one global bar */}
  <div className={`flex-1 min-h-0 w-full flex flex-col ${MSG||CAL ? 'overflow-hidden' : 'overflow-auto mobile-scroll p-2 sm:p-3 md:p-4 lg:p-6'}`}>
    <div className={`w-full ${MSG||CAL ? 'h-full min-h-0 flex flex-col' : 'min-h-full max-w-[1600px] mx-auto flex flex-col'} animate-fade-in`}>
      {renderContent()}
    </div>
  </div>
</main>
```
Key deltas: add `flex flex-col` to `<main>`; the content wrapper changes `h-full` → `flex-1 min-h-0`
so it fills the remaining height and scrolls **below** the pinned bar. The bar is OUTSIDE the
per-view overflow container, so Messages/Calendar (`overflow-hidden` panes) can't clip it or its
dropdown.

**New `CommandBarHeader`** (recommend a small component, either a new file
`src/components/CommandBarHeader.tsx` or exported from `GlobalCommandPalette.tsx`):
```tsx
export const CommandBarHeader: React.FC = () => {
  const ref = useRef<HTMLInputElement>(null);
  // ⌘K / mobile button / g-/ chord / section buttons all dispatch this → focus the bar.
  useEffect(() => {
    const focus = () => requestAnimationFrame(() => ref.current?.focus());
    window.addEventListener('pulse:command-palette-open', focus);
    window.addEventListener('pulse:command-bar-focus', focus);
    return () => { window.removeEventListener('pulse:command-palette-open', focus);
                   window.removeEventListener('pulse:command-bar-focus', focus); };
  }, []);
  return (
    <div className="shrink-0 px-3 sm:px-4 md:px-6 py-2.5 border-b border-zinc-200 dark:border-white/[0.06] bg-white/80 dark:bg-zinc-950/60 backdrop-blur">
      <div className="w-full max-w-[1600px] mx-auto">
        <InlineCommandPalette inputRef={ref} />
      </div>
    </div>
  );
};
```
Notes: align the inner `max-w-[1600px] mx-auto` with the content centering so the bar lines up
with content on wide screens. `InlineCommandPalette`'s dropdown is `absolute … z-50` below the
input — it overlays the content area (fine; bar sits at the top of `<main>`). Confirm the dropdown
is not clipped (the header div should not be `overflow-hidden`; default is visible).

### REMOVE — the interim surfaces (Rule A: working code; this is the approved replacement)
1. **Sidebar launcher** — revert `4c92bf3` in `src/components/Sidebar/Sidebar.tsx`: delete the
   command-launcher block ([Sidebar.tsx:338-363](../src/components/Sidebar/Sidebar.tsx#L338)) and the
   `isMac` import (line 30). It's redundant with the always-visible header.
2. **`GlobalCommandBar`** (the drawer host) in `src/components/GlobalCommandPalette.tsx` — retire it;
   remove `<GlobalCommandBar suppressed=… />` from `App.tsx` and the import. Its whole reason (open
   a drawer because the bar wasn't visible) is gone now the bar is persistent.
3. **Dashboard hero bar** — in `src/components/Dashboard.tsx`, remove the `<InlineCommandPalette
   inputRef={searchInputRef} />` hero render and the `pulse:command-palette-open` focus listener I
   added in 5a (the global header replaces both). Decide on `searchInputRef` + the `/` shortcut:
   the Dashboard `/`-to-focus handler should either be dropped or re-pointed to dispatch
   `pulse:command-palette-open` (so `/` focuses the global bar). **Don't leave `/` focusing a
   removed ref.**

### KEEP (unchanged)
- `InlineCommandPalette` component, the registry/`getMatches`, all command scopes (nav/help/
  create/email/meetings/controls/actions/people, calendar/decisions section drains).
- `GlobalQuickActions` FAB (`068a871`) — separate concern, stays.
- App's ⌘K keydown handler (dispatches `pulse:command-palette-open`), the mobile header command
  button, the `g /` chord, and the Calendar/Messages/CockpitHub buttons — all already dispatch the
  event; they now focus the header. No change needed.

## 6.3 Layout / responsive / a11y details

- **Height:** ~56px strip (`py-2.5` around the ~40px input). Same on all views.
- **Centering:** inner `max-w-[1600px] mx-auto` to match content; bar background spans full width,
  input column aligns with content.
- **Dropdown:** opens downward (existing). Verify `z-50` sits above content; verify not clipped by
  `<main>` (it isn't — main is full height; dropdown near top).
- **Mobile:** the bar shows on mobile too (consistency is the whole point). Verify it sits below any
  mobile top chrome / hamburger and above content; check it doesn't crowd the 48px touch targets.
  Confirm the `MobileBottomNav` and the mobile command button still make sense (the visible bar may
  make a mobile "open command" button redundant — optional cleanup).
- **Dark + light:** strip uses tinted neutrals + hairline border (no `#000`/`#fff`); test both.
- **Reduced motion:** the dropdown reveal should respect `prefers-reduced-motion`.
- **Coral budget:** chrome only; coral confined to focus ring + active row + match highlight.

## 6.4 Rule A — what's being removed (all working code), and the trade

- **Sacrificed:** ~56px of vertical space on every view (the user explicitly accepted this), the
  Dashboard's distinct hero treatment, and the floating/sidebar variants.
- **Gained:** one identical command surface everywhere (the user's stated goal: consistency), no
  collisions, no centered-modal feel, less code (three surfaces → one).
- **Preserved:** every command, all resolution logic, the FAB, all keyboard entry points.
- Execution still follows Rule A on the three deletions above — but the direction is the user's
  explicit decision, so this handoff IS the approved plan; implement, then eyeball.

## 6.5 Verification + eyeball checklist

- `tsc` gate: **no NEW errors** vs the 917 baseline (`NODE_OPTIONS=--max-old-space-size=8192 npx tsc
  --noEmit`); confirm zero refs to removed symbols (`GlobalCommandBar`, the Sidebar launcher,
  Dashboard `searchInputRef` if dropped).
- Eyeball, both themes + mobile + collapsed/expanded sidebar:
  - The bar appears at the top of **every** view, identical position, including Messages/Calendar
    (not clipped) and Dashboard (no separate hero bar, no double bar).
  - ⌘K focuses the bar and opens the dropdown; typing filters; Enter runs; Esc closes.
  - The `g /` chord, the mobile command button, and the Calendar/Messages/Cockpit "search" buttons
    all focus the same bar.
  - Content scrolls below the bar; the bar stays pinned.
  - The old sidebar launcher and any floating pill are gone.

## 6.6 Suggested commit sequencing

1. Add `CommandBarHeader` + restructure `<main>` (bar live on all views).
2. Remove the Dashboard hero bar + listener; re-point/drop the `/` shortcut.
3. Remove the sidebar launcher (revert `4c92bf3`’s Sidebar changes).
4. Retire `GlobalCommandBar` + its App mount/import.
Each step is independently revertable; `tsc` after each.
