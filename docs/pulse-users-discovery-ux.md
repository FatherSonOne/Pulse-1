# Pulse Users Discovery — UX Specification

> Scope: Meso (one sheet + sub-sheet). Recipe: `empty` (zero-state drives design direction).
> Authored by: palette. Date: 2026-05-21. Status: Ready for artisan pass.
> Upstream spec: `docs/pulse-users-discovery-spec.md` (accord, L0–L2).

---

## 1. Tile-Chooser Redesign — Three-Tile Version

### 1.1 Critical Finding: Token Conflict

Before the tile-position recommendation: reading the current tile code at `ContactsRedesigned.tsx` lines 1743–1756 reveals that the **"Add manually" tile already uses `--pulse-tone-info-soft` as its icon background and `--pulse-tone-info` as its icon color.** The accord spec proposes that the new "Find teammates" tile use the same `--pulse-tone-info-soft` slot. Assigning the same color token to two tiles on the same picker destroys the visual differentiation that tokens exist to provide.

**Resolution**: Reassign the "Add manually" tile to `--pulse-tone-neutral-soft` / `--pulse-tone-neutral`. The `UserPlus` icon in a neutral background communicates "manual / generic input" accurately and matches the tile's semantic role (plain data entry, no network connection). The "Find teammates" tile then owns the info-soft slot, which reads as "connective / networked" — semantically correct for a peer-discovery surface.

Token confirmation (all from `src/styles/pulse-tokens.css`):
- `--pulse-tone-info`: `#3b82f6` (light) / `#60a5fa` (dark) — line 35 / line 100
- `--pulse-tone-info-soft`: `rgba(59, 130, 246, 0.10)` (light) / `rgba(96, 165, 250, 0.12)` (dark) — line 36 / line 101
- `--pulse-tone-neutral`: `#6b7280` — line 38
- `--pulse-tone-neutral-soft`: `rgba(107, 114, 128, 0.10)` — line 39

No token gaps. No new tokens needed. The reassignment is a one-line CSS change on the "Add manually" tile.

### 1.2 Tile Precedence Recommendation

**Recommended position: "Find teammates on Pulse" is tile #1 (topmost).**

Rationale: a new Pulse operator joining an existing workspace is almost always better served by the network path than by an import or a manual add. The workspace is the primary context; teammates on Pulse are already authoritative records. Placing the network tile first communicates this immediately — Pulse is a shared space, not a private address book. The Google import tile moves to position #2, and "Add manually" remains at position #3.

The tradeoff is real: users who have already internalized the current two-tile order will notice the shift, and muscle memory favors Google import sitting first. However, this feature is new — there is no existing muscle memory for the three-tile chooser, making this the lowest-cost moment to establish the preferred priority. Existing users see a new option at the top; they can still reach Import from Google one position lower. If telemetry after Phase 1 shows that 80%+ of users skip the first tile and proceed to Google import, revisit order at Phase 1.5.

### 1.3 Icon Recommendation

**`UserSearch`** (lucide-react, `user-search`).

Rationale: `Users` is already used on the Google import tile (line 1726) — repeating it on a second tile forces users to read the label rather than distinguish tiles by icon. `UserSearch` communicates "look for a specific person in a known pool" — precisely the Phase 1 action. It avoids `Sparkles` (AI connotation, forbidden on a non-AI surface), `Globe` (cross-org read, Phase 2), and `UserPlus` (already earmarked for "Add manually"). The magnifying-glass arc on `UserSearch` also implies intentionality rather than bulk import, which fits the single-workspace scope of Phase 1.

### 1.4 Subtitle Pattern

Existing tile subtitles are direct, single-sentence, and grounded: "Open the picker. Tick exactly who Pulse should know about." They are operator-peer in tone — no marketing softness. Match that register.

Placeholder subtitle for the new tile (final copy deferred to prose):
> "See who else is on Pulse in your workspace. One tap to add them."

This makes the scope explicit (workspace-bounded, not cross-org) and names the action (one tap). It is two sentences because the two facts — who is eligible, what the action costs — are both worth stating.

### 1.5 Loaded-State Badge

When the RPC pre-counts available teammates before the user taps the tile, display a static badge inline with the tile title:

```
[title row]   Find teammates on Pulse    [3 ready]
[subtitle]    See who else is in your workspace …
```

- **Count known (≥1)**: badge text = `"{N} ready"` in `--pulse-tone-info` text, `--pulse-tone-info-soft` background, `border-radius: 9999px`, `font-size: 11px`, `padding: 2px 7px`. Do not show count on hover — it is persistent, low-weight, and actionable at a glance.
- **Count known (= 0)**: omit the badge entirely. The tile remains; tapping it leads the user to the zero-state which is the correct place to surface the invite CTA. Showing a "0 ready" badge pre-empts the user's decision before they even open the sheet.
- **Count unknown / RPC not yet fired**: omit the badge. Never show a spinner inside the tile — the chooser is already the first interactive moment; a pending state on tile render adds latency anxiety before any action has been requested.

Pseudo-structure for the badge (no implementation, layout only):
```
<div class="tile-title-row">
  <span class="tile-title">Find teammates on Pulse</span>
  {count > 0 && (
    <span class="teammate-count-badge" aria-label="{N} teammates available">
      {N} ready
    </span>
  )}
</div>
```

### 1.6 Revised Tile Layout (ASCII)

```
┌─────────────────────────────────────────────┐
│  Add a contact                              │
│  Pick someone from Google, or …            │
├─────────────────────────────────────────────┤
│ [🔵 icon]  Find teammates on Pulse  3 ready │  ← tile #1 (info-soft)
│             See who else is in your         │
│             workspace. One tap to add.      │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│ [🔴 icon]  Import from Google               │  ← tile #2 (rose-soft)
│             Open the picker. Tick exactly   │
│             who Pulse should know about.    │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│ [⚪ icon]  Add manually                     │  ← tile #3 (neutral-soft)
│             Fill in a name, email, phone.   │
│             Stays Pulse-local.              │
└─────────────────────────────────────────────┘
```

Hover: all three tiles use `hover:border-rose-300 dark:hover:border-rose-400/40` — consistent with the existing two-tile pattern; the rose hover border is chrome behavior, not brand-signal coloring.

---

## 2. Inner Discovery Sheet — State Design

The sheet opens when the user taps the "Find teammates on Pulse" tile. It is a second-layer modal (`z-[80]`, one layer above the chooser at `z-[70]`), same `max-w-sm` width. The chooser may close or dim behind it — close is simpler and recommended for Phase 1 to avoid stacked modal z-index management.

### 2.1 Loading State (< 600ms expected)

The RPC latency target is 95p ≤ 300ms warm. Render 3 skeleton rows immediately on sheet open; do not show a spinner (skeleton is the correct pattern for a list that will have content shape). If results arrive before 100ms, skip the skeleton transition entirely via a 100ms delay gate.

Each skeleton row mirrors the loaded row shape exactly: left avatar circle + two lines of text + right button placeholder. This prevents layout shift on data arrival.

```
┌─────────────────────────────────────────────┐
│  Teammates on Pulse            [× close]    │
│  In this workspace                          │
├─────────────────────────────────────────────┤
│  [○ ···]  ████████████  ████             │  ← 3 skeleton rows
│            ████████                         │    same height as loaded row
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│  [○ ···]  ████████████  ████             │
│            ████████                         │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│  [○ ···]  ████████████  ████             │
│            ████████                         │
└─────────────────────────────────────────────┘
```

Skeleton fill: `--pulse-tone-neutral-soft`, animated via a `pulse` CSS animation (opacity 0.5 → 1 → 0.5, 1.4s infinite). Respect `prefers-reduced-motion`: reduce animation to a static neutral fill.

### 2.2 Loaded — Has Results

**Row design:**

```
[avatar 32px]  Display Name          [Add] or [Added ✓]
               @handle · Member pill
```

- Avatar: 32×32px circle. Fallback: initials on `--pulse-tone-info-soft` background, `--pulse-tone-info` text.
- Name: `text-sm font-semibold`, `--pulse-ink`.
- Handle + role: `text-xs`, `--pulse-ink-3`. Handle omitted if null. Role pill: `Member` / `Admin` / `Owner` in `--pulse-tone-neutral-soft` with `--pulse-tone-neutral` text, `border-radius: 9999px`, `padding: 1px 6px`. Neutral pill is role-safe — it neither elevates admins nor demotes members.
- Action button: primary = `Add` (enabled); replaced with `Added` (disabled, `--pulse-ink-3` text, no background) when `alreadyInContacts === true`. The "Added" state is read-only — no unlink from this surface.
- Min row height: 48px (touch target compliant, WCAG 2.2 SC 2.5.8).

**Multi-select recommendation: Single-add MVP for Phase 1.**

Rationale: multi-select with a bulk-add footer adds two interaction layers (selection mode enter/exit, footer CTA management) and a focus-management burden. Most Phase 1 workspaces will have small teammate counts (≤20). Single-add lets the user process each person consciously, which is appropriate for a contact-addition action that has lightweight but real consequences. Multi-select ships in Phase 1.5 alongside the cross-workspace scope toggle, when result sets may be large enough (50+) to justify bulk selection. The RPC result shape already supports it; the UI deferral is intentional.

**Sort order:** Alphabetical by `display_name` (A→Z) as default. No user-facing sort controls in Phase 1 — the result set is small enough that ordering does not justify the chrome.

**Search-as-you-type: No-search Phase 1 MVP.**

The RPC is bounded to one workspace. Result sets above ~30 rows are rare at Phase 1. Client-side filtering (already in memory) is sufficient if counts grow. Phase 1 ships with no search input — the sheet is a simple scrollable list. Add a search input in Phase 1.5 when the cross-workspace scope toggle can return 100+ rows and filtering earns its affordance cost.

### 2.3 Loaded — Zero Results (Solo Workspace)

This is the most important state to get right: it appears whenever the authenticated user is the only Pulse user in their workspace. In a freshly-launched organization, every operator sees this state first. How it feels determines whether Pulse reads as a nascent network or a broken feature.

**The two options:**

**Option A — Louder: "Invite your team"**
```
[icon: UsersRound, --pulse-tone-info-soft bg]
Your workspace is just you, for now.
Nobody else has joined this workspace yet.
[ Invite a teammate → ]    (routes to workspace invite flow)
```

**Option B — Quieter: "They'll show up when they join"**
```
[icon: UsersRound, --pulse-tone-neutral-soft bg]
You're the first one here.
Teammates will appear automatically once they join your workspace.
(no CTA)
```

**Recommendation: Option A — the louder invite CTA.**

Step-by-step reasoning:

The user arrived here because they tapped a tile explicitly labeled "Find teammates on Pulse." They already have intent — they want people. A quiet "they'll show up later" message meets that intent with inaction, which reads as a dead end. The user has to navigate away and figure out on their own how to get teammates into the workspace. That is a flow-completion failure.

Option A intercepts the unfulfilled intent and redirects it constructively: you came to find people, there are none yet, here is exactly how to change that. The invite flow is one step deeper and the user chose to be here — the CTA is not an interruption, it is the natural next move.

The counterargument for Option B is that the CTA feels presumptuous: maybe the user just wanted to check, and doesn't have invite authority. This is handled by a soft, secondary-weight button (not a primary rose CTA) — it is an invitation, not a directive. Users without invite authority can ignore it without friction.

The icon for the zero-state uses `--pulse-tone-info-soft` (same as the tile that brought them here) rather than `--pulse-tone-neutral-soft`, preserving the visual thread from tile to state. The state is not negative — it is a starting point.

```
┌─────────────────────────────────────────────┐
│  Teammates on Pulse            [× close]    │
├─────────────────────────────────────────────┤
│                                             │
│          [🔵 UsersRound icon, 48px]         │
│                                             │
│       Your workspace is just you, for now.  │
│    Nobody else has joined this workspace    │
│    yet. Invite someone and they'll appear   │
│    here automatically.                      │
│                                             │
│         [ Invite a teammate ]               │  ← secondary weight button
│                                             │
└─────────────────────────────────────────────┘
```

Button style: outline variant (border `--pulse-tone-info`, text `--pulse-tone-info`, no fill). Not a rose primary — this is a suggestion, not an obligation. Min height 44px.

### 2.4 Error States

Three distinct failure modes; keep them distinct in copy but consistent in layout.

**Network failure** (fetch did not complete):
```
[icon: WifiOff, --pulse-tone-neutral-soft]
Could not reach Pulse.
Check your connection, then try again.
[ Try again ]   (retries the RPC; button primary)
```

**RPC denied / permissions** (RLS returned 0 rows due to policy, not genuine empty workspace):
```
[icon: Lock, --pulse-tone-neutral-soft]
You don't have access to this workspace's member list.
Contact your workspace admin.
```
Note: distinguish this from the zero-results state by detecting a 403/permission error from the service layer, not a 200 with empty array. The service layer must surface this distinction.

**Unexpected error** (500, timeout, malformed response):
```
[icon: AlertCircle, --pulse-tone-warning-soft]
Something went wrong on our end.
[Try again] or [Close]
```
Use `--pulse-tone-warning-soft` / `--pulse-tone-warning` for unexpected errors — this matches the existing status vocabulary in `pulse-tokens.css`. Do NOT use overdue (red) — this is not a user error.

### 2.5 Phase 2 Stub — Cross-Org Handle Search

The Phase 2 handle search box appears at the bottom of the inner sheet, visually separated from the Phase 1 workspace list. In Phase 1, render the stub as a disabled, grayed-out search input with a tooltip/label:

```
├─────────────────────────────────────────────┤
│  ─────────── Coming later ──────────────    │
│  [🔍 Search by @handle _______________]     │  ← disabled input, opacity: 0.4
│  Cross-org search — requires opt-in.        │
│  Available when this feature launches.      │
└─────────────────────────────────────────────┘
```

The divider ("Coming later") uses `--pulse-ink-3` text, `font-size: 11px`, uppercase tracking — the same affordance used elsewhere in Pulse for deferred features. The disabled input uses `opacity: 0.45`, `cursor: not-allowed`, `pointer-events: none`. It is `aria-disabled="true"` with `aria-label="Cross-org handle search — not yet available"`. Screen readers encounter the label but understand the control is not operable. The presence of the stub communicates roadmap without implying current functionality.

---

## 3. Accessibility Checklist

### Keyboard Navigation

- **Tile chooser**: tiles are `<button>` elements. Tab order: tile #1 → tile #2 → tile #3 → Cancel. No arrow-key roving needed for 3 items; Tab is sufficient and expected.
- **Inner sheet**: focus moves to the sheet's close button on open (explicit `autoFocus` or `useEffect` focus call, matching the `ContactsEmptyState` pattern at line 17-21). Tab through: close button → rows → invite CTA (if zero state) → loops back to close.
- **Row "Add" buttons**: `aria-label="Add {displayName} to contacts"` — do not rely on button text alone since adjacent rows share the same label text "Add".
- **"Added" state**: `aria-disabled="true"` on the disabled Add button; `aria-label="Already added: {displayName}"` so screen readers confirm the action was previously completed rather than encountering a silent disabled button.

### Screen Reader Labels

- Chooser dialog: `role="dialog" aria-modal="true" aria-labelledby="add-contact-chooser-title"` — already present for the existing chooser; extend to the inner sheet with its own id.
- Teammate count badge: `aria-label="{N} teammates available"` — the visible text "3 ready" is ambiguous without context; the aria-label provides it.
- Skeleton rows: `aria-busy="true"` on the list container while loading; `aria-label="Loading teammates"` on the skeleton region.
- Zero-state: `role="status"` on the empty-state container so screen readers announce it without the user navigating to it.

### Focus Management

- On sheet open: focus first interactive element (close button). This prevents focus remaining on the tile that opened the sheet (now hidden behind the scrim).
- On sheet close: return focus to the tile that opened the sheet (`ref` capture before open).
- On "Add" action: after adding a single contact, keep focus on the next row's Add button (or the zero-state CTA if the list empties). Do not close the sheet after a single add — the user likely wants to add multiple teammates in sequence.

### Contrast

- `--pulse-tone-info` (`#3b82f6` on white `#ffffff`): 3.07:1 — passes for large text / UI components (WCAG 2.2 SC 1.4.11, ≥3:1), but fails for normal text (≥4.5:1). **Do not use `--pulse-tone-info` for body text or button labels.** Use it only for icon fills and pill backgrounds. For the invite CTA border/text at normal text size, use `--pulse-tone-info` text on `--pulse-surface` only if font-size ≥ 18px (large text threshold) or font-weight ≥ bold at ≥14px — otherwise substitute `--pulse-ink` for the button label and `--pulse-tone-info` for the border only.
- Dark mode `--pulse-tone-info` (`#60a5fa` on `rgba(255,255,255,0.03)` ≈ black): estimated ~7.5:1 — passes all levels.
- Skeleton fills: `--pulse-tone-neutral-soft` is decorative; contrast exemption applies.
- Role pill (`--pulse-tone-neutral` on `--pulse-tone-neutral-soft`): decorative badge — contrast exemption for non-text UI elements applies; verify during implementation.

---

## 4. Token Reference Table

All tokens confirmed present in source. No invented values.

| Token | Value (light) | Value (dark) | File | Line (approx) | Usage in this design |
|---|---|---|---|---|---|
| `--pulse-tone-info` | `#3b82f6` | `#60a5fa` | `src/styles/pulse-tokens.css` | 35 / 100 | New tile icon color; avatar fallback text; role pill; invite CTA border |
| `--pulse-tone-info-soft` | `rgba(59,130,246,0.10)` | `rgba(96,165,250,0.12)` | `src/styles/pulse-tokens.css` | 36 / 101 | New tile icon bg; avatar fallback bg; zero-state icon bg |
| `--pulse-tone-info-glow` | `rgba(59,130,246,0.30)` | `rgba(96,165,250,0.35)` | `src/styles/pulse-tokens.css` | 37 / 102 | Optional: focus ring on info-toned elements (artisan decision) |
| `--pulse-tone-neutral` | `#6b7280` | `#6b7280` | `src/styles/pulse-tokens.css` | 38 / 103 | "Add manually" tile icon color (reassigned); role pill text; skeleton icon |
| `--pulse-tone-neutral-soft` | `rgba(107,114,128,0.10)` | `rgba(107,114,128,0.14)` | `src/styles/pulse-tokens.css` | 39 / 104 | "Add manually" tile icon bg (reassigned); skeleton fill; network/lock error icon bg |
| `--pulse-tone-warning` | `#f97316` | `#fb923c` | `src/styles/pulse-tokens.css` | 29 / 94 | Unexpected error icon color |
| `--pulse-tone-warning-soft` | `rgba(249,115,22,0.10)` | `rgba(251,146,60,0.12)` | `src/styles/pulse-tokens.css` | 30 / 95 | Unexpected error icon bg |
| `--pulse-rose-soft` | `rgba(244,63,94,0.10)` | `rgba(244,63,94,0.12)` | `src/styles/pulse-tokens.css` | 19 / 86 | Google import tile icon bg (existing, unchanged) |
| `--pulse-rose` | `#f43f5e` | `#fb7185` | `src/styles/pulse-tokens.css` | 15 / 82 | Google import tile icon color (existing, unchanged) |
| `--pulse-canvas` | `#f8f8f8` | `#000000` | `src/styles/pulse-tokens.css` | 43 / 108 | Tile background (existing pattern, unchanged) |
| `--pulse-surface` | `#ffffff` | `rgba(255,255,255,0.03)` | `src/styles/pulse-tokens.css` | 45 / 110 | Inner sheet background |
| `--pulse-border` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.06)` | `src/styles/pulse-tokens.css` | 47 / 112 | Tile borders, sheet dividers |
| `--pulse-shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | `0 4px 16px rgba(0,0,0,0.60)` | `src/styles/pulse-tokens.css` | 52 / 117 | Inner sheet elevation |
| `--pulse-ink` | `#0f0f0f` | `#fafafa` | `src/styles/pulse-tokens.css` | 56 / 121 | Row display names |
| `--pulse-ink-2` | `#52525b` | `#b4b4b8` | `src/styles/pulse-tokens.css` | 57 / 122 | Secondary text; Cancel button |
| `--pulse-ink-3` | `#6b7280` | `#6b7280` | `src/styles/pulse-tokens.css` | 58 / 123 | Handle + role subtitle; "Added" state text; "Coming later" divider |
| `--pulse-duration` | `220ms` | `220ms` | `src/styles/pulse-tokens.css` | 67 | Skeleton animation base |
| `--pulse-ease` | `cubic-bezier(0.16,1,0.3,1)` | same | `src/styles/pulse-tokens.css` | 67 | Sheet open transition |

**Forbidden tokens (confirmed not used in this design):**
- `--pulse-coral`, `--pulse-coral-fg`, `--pulse-coral-bg-12`, `--pulse-coral-bg-08` — AI-output surfaces only, per `pulse-tokens.css` lines 70-77 and CLAUDE.md §3.

---

## 5. Token Gaps Flagged

**None.** All tokens referenced exist in `src/styles/pulse-tokens.css` with light and dark definitions. The `--pulse-tone-info-*` family is complete (base, soft, glow). No muse pass needed for token additions.

**One reassignment required** (not a gap, a conflict resolution): the "Add manually" tile at `ContactsRedesigned.tsx` lines 1746-1748 must move from `--pulse-tone-info-soft` / `--pulse-tone-info` to `--pulse-tone-neutral-soft` / `--pulse-tone-neutral`. This is a 2-line change, scoped to the artisan implementation pass.

---

## 6. Outstanding Questions for User

Items that were open in accord's spec, with palette recommendations where answerable:

| Question | Palette recommendation | Status |
|---|---|---|
| **Tile precedence**: "Find teammates" above or below Google import? | Above (tile #1) — see §1.2 for full rationale | Recommendation made; user confirms |
| **Multi-select in Phase 1?** | No — single-add MVP; multi-select defers to Phase 1.5 (see §2.2) | Recommendation made; user confirms |
| **Workspace-role pill copy**: surface role explicitly or stay role-agnostic? | Surface it — "Member" / "Admin" / "Owner" in neutral pill. The data is already visible in Team Settings; discovery list surfacing it is informative and consistent, not a leak. | Recommendation made; user confirms |
| **Zero-state CTA**: active "Invite a teammate" or quiet "they'll show up when they join"? | Active invite CTA (Option A) — see §2.3 for step-by-step reasoning | Recommendation made; user confirms |
| **Phase 2 handle namespace**: `@handle` required or bare handle? | Defer to Phase 2 — not a Phase 1 design decision. Stub UI in §2.5 uses `@handle` placeholder to establish the convention early and signal "this is a handle lookup, not a name search." | Deferred; no user decision needed now |
| **Cross-app discovery (Entomate / Logos Vision users)**: scope of C1/C2? | Defer to Phase 2 — accord's default proposal (C3 only for cross-app) is sound. Do not widen C1 to include non-Pulse-workspace members. | Deferred; accord's default applies |
| **Contrast of `--pulse-tone-info` for normal text**: use as button label? | No — use only for icon fills, pill backgrounds, and large-text buttons (≥18px). Use `--pulse-ink` for button labels at normal size. | Design constraint, not a user decision |

---

*Palette → Artisan handoff: implement §1 (tile reorder + token reassignment + new tile), §2 (inner sheet with all five states), §3 (aria labels + focus management). Flow: sheet open/close transition at `--pulse-ease` / `--pulse-duration`. Prose: finalize subtitle copy for all three tiles and zero-state body text. Muse: no token additions needed.*
