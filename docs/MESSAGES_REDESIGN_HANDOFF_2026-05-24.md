# Messages Redesign — Handoff (Path D · Signal Composer)

**Date:** 2026-05-24
**Status:** Design locked — ready for implementation
**Artifact:** [`_design-playground/messages-redesign.html`](../_design-playground/messages-redesign.html)
**Selected direction:** **Path D · Signal Composer** (open the playground — it lands on D)

---

## TL;DR

The current Messages section (list → thread → composer) works but tints **every
message bubble rose**, which floods the brand signal and flattens hierarchy. This
redesign keeps the proven 3-pane shape and fixes the visual + intelligence layer:

1. **Neutral bubbles.** Received/sent bubbles derive from `--pulse-ink` via
   `color-mix` and are **never rose**. Coral/rose retreats to signal only:
   AI provenance, unread, and the Send CTA.
2. **An intelligence spine.** The conversation gains a vertical timeline that
   surfaces AI-detected moments inline — `DECISION`, `OPEN QUESTION`,
   `NEEDS REPLY` — using the status-tone vocabulary (green / blue / amber).
3. **A "remembers the relationship" rail.** A collapsible right panel shows
   open items, the last decision, and reply pace for the contact.
4. **A compose-first input.** The composer gains inline Smart Compose
   ghost-text, a `/` command palette, a tone chip, and `⌘K` global actions.

This is the **conversation-surface** redesign. It is **complementary to**
[`docs/messages-tools-redesign.md`](messages-tools-redesign.md), which already
shipped the *tools-menu / compose-bar / context-menu* IA (epic #90, PRs 3–5).
That work defined *what actions live where*; this work defines *how the list,
thread, and intelligence read*. Reuse its locked rules — especially the
**coral-as-signal** budget — verbatim.

---

## Why Path D (and not A / B / C)

The playground ships four explorations. The owner chose to **lean Signal Thread
(B)** but pull in **Focus Composer's (C)** input experience:

| Path | What it was | Verdict |
|---|---|---|
| **A · Quiet Canvas** | Linear/Superhuman refinement of today's shape | Safe; lacked the differentiator |
| **B · Signal Thread** | Editorial spine + AI moments + relationship rail | **Liked** — the intelligence is the Pulse differentiator |
| **C · Focus Composer** | Compose-first, slim rail, quiet transcript, ⌘K | **Intrigued** — but full layout-inversion fights B's reading model |
| **D · Signal Composer** | **B kept whole + C's hero composer + ⌘K** | **Selected** |

The one C element that composes cleanly into B is **⌘K** (additive, layout-neutral).
C's icon-rail and condensed transcript were intentionally *not* carried over —
they contradict Signal Thread's "rich, intelligent reading" premise.

---

## Layout & component inventory

Three columns inside the existing Messages pane:

```
┌─ thread list (≈276px) ─┬─ conversation (1fr) ───────────┬─ relationship rail (≈280px, collapsible) ─┐
│  Messages · N unread   │  header: avatar · presence ·   │  RELATIONSHIP                              │
│  [FilterBar]           │          Summary · ⌘K · rail   │  OPEN ITEMS · n   (interactive checkbox)   │
│  thread rows           │  ┌ AISummaryCard (toggle) ┐    │  LAST DECISION   (tone-positive border)    │
│   · avatar + presence  │  spine ░ DECISION moment       │  PACE  (you / them / volume)               │
│   · pinned / dots      │       ░ message (editorial)    │                                            │
│   · unread badge       │       ░ OPEN QUESTION moment   │                                            │
│                        │  composer: tone chip / ghost / │                                            │
│                        │            / palette · ⌘↵ send │                                            │
└────────────────────────┴────────────────────────────────┴────────────────────────────────────────────┘
       ⌘K overlay floats above the whole pane (Esc to close)
```

Components in the playground (all in the single file, `PathD` + shared helpers):

| Component | Role | Notes for production |
|---|---|---|
| `FilterBar` | Thread-list filter (All/Unread/Pinned/Tasks/Decisions) | Icon-led, no horizontal scroll — see "Filter bar" below |
| `PathBRow` | One message + its spine dot / AI moment marker | Shared by B and D; carries the entrance animation |
| `AISummaryCard` | Coral AI Thread Summary with loading skeleton → content | Maps to existing Thread Summary tile / Gemini routing |
| relationship rail | Open items / last decision / pace | Collapsible via header `info` toggle |
| `⌘K` palette | Global command overlay | Real `Cmd/Ctrl+K` keybinding + `Esc` |
| composer | ghost-text + `/` palette + tone chip + rose Send | See `messages-tools-redesign.md` Surface 1 for the action spec |

---

## Brand / token rules (non-negotiable)

Consume canonical tokens only — `src/styles/pulse-tokens.css` (+ `--pulse-coral`
base in `src/App.css`). **Do not redeclare colors locally.**

- **Bubbles are neutral.** Playground uses
  `--msg-recv-bg: var(--pulse-surface-raised)` and
  `--msg-sent-bg: color-mix(in oklab, var(--pulse-ink) 9%/12%, transparent)`.
  Production should add equivalent `--pulse-*` tokens (via Muse) — **never
  reintroduce the rose-tinted bubble** the old surface used.
- **Coral = AI provenance only.** Summary card, AI moment markers, Smart Compose
  ghost chip, the AI command-palette action. Reuse the existing AI provenance
  chip pattern (`--pulse-coral-fg` / `-bg-12` / `-bg-08`; PR 4.4). Coral budget
  is locked — reject any PR that adds coral elsewhere.
- **Rose = brand signal.** Send CTA, unread dot/badge, active nav. (Playground
  uses rose Send per the Relay precedent; if the team prefers the spec's
  neutral Send, swap the one `pulse-rose-bg-color` on the send button.)
- **Status tones for moments / data.** `--pulse-tone-positive` (decision),
  `--pulse-tone-info` (question), `--pulse-tone-warning` (needs-reply / open
  task). Never coral for these — they are computed status, not AI prose.

---

## Filter bar (the "no horizontal scroll" fix)

The old filter row scrolled horizontally in the narrow list column. The new
`FilterBar` is an **icon-led segmented control**:

- Every filter is an icon; **only the active chip reveals its text label**
  (a `max-width` transition).
- Counts ride as a small badge on the **active** chip only; inactive chips with
  items show a 5px presence dot (rose for unread, neutral otherwise).
- `.filter-seg` has `flex-wrap: wrap` as a safety net — it can **never** scroll
  horizontally; worst case a chip wraps to a second line.
- Verified `scrollWidth − clientWidth = 0` across A/B/D in both themes.

Maps directly to the existing state in `src/components/Messages.tsx`:

```
threadFilter: 'all' | 'unread' | 'pinned' | 'with-tasks' | 'with-decisions'   (~line 720)
showArchived / archivedThreads                                                 (~line 721)
```

Playground ids → production: `tasks → with-tasks`, `decisions → with-decisions`.

---

## Motion

All additive, all `prefers-reduced-motion`-guarded (animations disabled, label
transition removed):

| Animation | Where | Spec |
|---|---|---|
| `spineDraw` | the vertical spine line | `scaleY 0→1`, 700ms, expo-out, on mount |
| `spineDot` | ordinary message dots on the spine | scale+fade, staggered `idx*70ms` |
| `momentPop` | AI moment node (decision/question) | overshoot pop, staggered |
| `nodeRing` | the **needs-reply** moment node only | infinite ring pulse (draws the eye) |
| `msgIn` | each message row | fade + 6px rise, staggered `idx*70ms` |
| `shimmer` | summary skeleton | 1.4s loop |

Use the project ease (`cubic-bezier(0.16,1,0.3,1)`) and `--pulse-duration`.
Production should drive these through the existing `useMotionPreset()` hook /
`MotionConfig reducedMotion="user"` (PR 3.4) rather than raw CSS.

---

## States (empty / loading) — demonstrable in the playground

| Surface | State | Behavior | Maps to |
|---|---|---|---|
| AI Thread Summary | **loading** | 4-line shimmer + "Reading 48 messages…" (~1.1s), then content fades in; `Regenerate` re-runs it | `messages-tools-redesign.md` §Empty/Loading/Error — Thread Summary; Gemini via `ai-router` edge fn |
| AI Thread Summary | **gated** (not in playground) | `<10 msgs` hide · `10–49` disabled "unlocks at 50" · `50+` active | same spec — wire to real message count |
| Open items (rail) | **empty** | check both items → "All clear — nothing open with Frank." + undo | new — back with real tasks/decisions data |
| Thread list | **empty filter** | `FilterBar` 0-result state (component present) | back with `threadFilter` result |
| Tone chip | **dismiss** | Apply / × hides it | per spec: relationship-aware, off after 30 days unflagged |

---

## Data & wiring map (playground mock → production)

| Playground | Production source |
|---|---|
| `THREADS` | real conversations; `pulse_users.auth_user_id` is the canonical join for `display_name` / `handle` / `avatar` (filter `is_bot IS NOT TRUE`) |
| live messages | `pulseService.subscribeToMessages` (trust its dedup — do **not** refetch the full list per send) |
| reactions | `pulseService.getReactionsForMessages`; reaction set already `['👍','❤️','😂','😮','😢','🔥']` (`COMMON_REACTIONS`) |
| AI summary / moments | Gemini **server-side only** via Supabase edge functions (`ai-router`) — no client API keys |
| open items / decisions | Decisions & Tasks surface (the rail is a per-contact view of existing task/decision data) |
| pace / volume | derived from message timestamps |

---

## Suggested implementation sequence

1. **Tokens** — add neutral bubble tokens to `pulse-tokens.css` (Muse). Confirm
   coral chip variants already exist (they do: `--pulse-coral-fg/-bg-12/-bg-08`).
2. **FilterBar** — drop-in replace the scrolling filter row; wire to
   `threadFilter`. Lowest-risk, immediately fixes the scroll bug.
3. **Neutral bubbles** — retire any remaining rose bubble background. (Most of
   this landed in PR 5 `--msg-*` cleanup; verify nothing reintroduced it.)
4. **Relationship rail** — collapsible panel, read-only first (open items / last
   decision / pace), then make open-items interactive.
5. **Spine + AI moments** — render the spine; surface decision/question markers
   from existing AI output. Add motion via `useMotionPreset()`.
6. **Composer smarts** — ghost-text + `/` palette + tone chip already specced in
   `messages-tools-redesign.md` Surface 1; this redesign only restyles them.
7. **⌘K** — global command palette (out of original tools scope; coordinate with
   the Cmd+K workstream noted in the tools doc).

Each step is independently shippable behind the solo-project direct-to-`main`
flow. Land them as separate conventional commits.

---

## Open questions

- **Send color:** rose (brand, Relay precedent) vs neutral (tools-redesign spec
  says Send is neutral). Playground uses rose. Pick one and apply globally.
- **Rail default:** open or collapsed on first load? Playground defaults open;
  may want collapsed on narrow viewports / mobile.
- **Mobile (375px):** not yet mocked. The 3-column layout collapses to
  list → thread (rail becomes a sheet, spine compresses). Needs its own pass.
- **AI moment density:** how aggressively to surface DECISION/QUESTION markers
  before they become noise. Start conservative (high-confidence only).

---

## What's mocked vs real in the playground

- **Mocked:** all data (`THREADS`, `CONVO`, `AI_SUMMARY`, `OPEN_ITEMS`,
  `RELATIONSHIP`), and most buttons are visual. The interactive bits are:
  filter switching, theme toggle, path switching, Summary loading→content,
  open-item checkboxes → empty state, tone-chip dismiss, `/` palette toggle,
  and `⌘K` (real keybinding).
- **Real:** the Pulse design tokens (mirrored from `pulse-tokens.css`), the
  coral budget discipline, the reaction set, and the `threadFilter` vocabulary.
