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

---

## Implementation Status — 2026-05-25

Shipped against the **legacy** Messages entry (the live default surface;
`Messages.tsx`). Each tranche is its own commit on `main`.

| Tranche | Commit | What landed |
|---|---|---|
| 1 — FilterBar | `f175620` | Icon-led segmented control (`FilterBar.tsx`) replaces the horizontally-scrolling filter row in `ConversationSidebar`. Active chip reveals its label; flex-wrap guarantees no horizontal scroll. Behavior/keys preserved. Counts/dots deferred (visible list is `pulseConversations`, filtering runs over `threads`). |
| 2a — Neutral bubbles | `0b19d79` | New `--pulse-msg-*` tokens; sent bubble rose→neutral ink-tint, coral "you heartbeat" hairline removed; received transparent→**filled surface-raised** (owner pick). Enforces DESIGN.md Coral-As-Signal. Applies to **both** entries (shared `messages.css`). |
| 2b — index.css cleanup | `9cff64a` | Removed the dead/conflicting legacy `--msg-*` bubble system from `index.css` (PR5's cleanup had missed it). Zero `--msg-*` refs remain. |
| 3a — Rail foundation | `9ed014f` | Host-agnostic `RelationshipRail.tsx` + `useRelationshipData.ts` (normalized `RailMessage` → `{ openItems, lastDecision, pace }`). Read-only; status tones, never coral; decision card uses a full tone border (not a banned side-stripe). |
| 3b — Rail wired (legacy) | `40f4227` | Docked rightmost column in the legacy conversation pane, guarded to a live conversation. Legacy-thread path yields full open-items + last-decision + pace; Pulse-DM path yields pace + "all clear" (PulseMessage carries no task/decision data). |

**Decisions locked this session:** Send/bubble color → **neutral** (Path D);
received bubble → **filled surface-raised**; rail host → **both surfaces**,
then V2 **deferred** (see below).

**Deferred / not yet built:**

- **3c — rail in v2 (`MessagesSplitView`):** deferred. v2 is paused
  (`pulseMessagesV2` flag default-OFF, "do not flip"), its `renderRightDrawer`
  slot is occupied, and the rail would be pace-only there. The component is
  host-agnostic so v2 wiring is a clean drop-in later. Tracked in
  `docs/deep-dives/messages_v2_parity_backlog.md` (local) + rail code comments.
- **Open-items / last-decision for Pulse DMs:** needs the Decisions & Tasks
  surface wired per-contact (today only legacy threads carry that data).
- **Rail interactivity** (open-item checkboxes), **mobile/375px** rail-as-sheet,
  and the later Path D tranches: **intelligence spine + AI moments**,
  **composer smarts** (ghost-text / `/` palette / tone chip), **⌘K**.

**Open questions resolved:** Send color → neutral. Rail default → open.
Still open: mobile pass, AI-moment density.

---

## Continuation Prompt (paste to resume)

> Copy everything in the block below into a fresh Pulse session to continue the
> Messages Path D implementation. It encodes the shipped state, the load-bearing
> gotchas, and the remaining work in priority order.

```
Continue the Messages "Path D / Signal Composer" redesign. Read first:
docs/MESSAGES_REDESIGN_HANDOFF_2026-05-24.md (esp. "Implementation Status") and
the project memory project_pulse_messages_pathd.md.

SHIPPED (on main): FilterBar (icon-led, no horiz scroll), neutral bubbles
(sent ink-tint/no coral hairline, received filled surface-raised; --pulse-msg-*
tokens), index.css --msg-* dead-code removal, RelationshipRail (+ useRelationshipData)
docked in the legacy conversation pane, and the intelligence-spine Phase 1
(useConversationMoments.detectMoments + ConversationSpine.SpineNode + .msg-spine-*
CSS) wired into the Pulse-DM message loop.

LOAD-BEARING FACTS (don't re-discover):
- Two surfaces, flag-gated in MessagesWithProviders.tsx (pulseMessagesV2). Legacy
  src/components/Messages.tsx is LIVE (flag default-OFF). V2 MessagesSplitView is
  FROZEN ("DO NOT FLIP THE FLAG"). Build on legacy.
- Host-agnostic components live in src/components/Messages/: RelationshipRail,
  useRelationshipData (normalized RailMessage shape: id/isOutbound/timestamp/text?/
  taskTitle?/decision?), ConversationSpine (SpineNode), useConversationMoments.
  The rail adapter + detectMoments() are computed in Messages.tsx ~line 1935,
  branching on activeThread (legacy Thread msgs: sender 'me'/'other', timestamp,
  relatedTaskId, decisionData) vs activePulseConv (PulseMessage: sender_id,
  created_at, content — NO task/decision data).
- Coral budget: moments/data use status tones (--pulse-tone-positive/info/warning),
  NEVER coral (coral = AI-output surfaces only). Bubbles are neutral; don't re-rose.
- Gemini is SERVER-SIDE ONLY via the ai-router edge function (no client apiKey).
- Verification of UI needs auth (Google OAuth) — visual checks require the human.

DO, IN ORDER:
1. Visual-verify the spine on an authed DM (npm run dev): left gutter line, per-
   message dots, amber ring-pulse on the last unanswered inbound. Tune
   .msg-spine-* alignment/continuity/gutter width in messages.css as needed.
2. Wire SpineNode into the legacy-thread render path (Messages.tsx activeThread
   branch, ~line 5159) the same way as the Pulse-DM path (wrap row in outer flex,
   SpineNode first, row → flex-1). This path carries decisionData, so DECISION
   (tone-positive) moments will appear there.
3. Spine Phase 2 — replace/augment heuristics with AI moment detection: add an
   ai-router-backed detector (server-side; new function or extend
   conversationIntelligenceService) that returns [{messageId, type, confidence}]
   for decision/question/needs-reply; threshold conservatively. Keep detectMoments
   as the heuristic fallback.
4. Rail polish: make open-items interactive (onToggleOpenItem is already a prop —
   needs a task-completion mutation), and add a mobile rail-as-sheet (currently
   hidden below xl via max-xl:hidden).
5. (Bigger / optional) per-contact open-items+decisions for the rail: tasks
   (taskService) and decisions (decisionService) are WORKSPACE-scoped with no
   contact/conversation FK — needs a schema change + write-path + RLS + backfill.
6. (When V2 cutover is worked) wire RelationshipRail + spine into MessagesSplitView.

Already DONE, do NOT redo: ⌘K (global App.tsx palette via useRegisterCommands);
composer smart-compose/slash/tone (exist + styled in MessageInputSection.tsx).

Follow CLAUDE.md: work on main, commit each unit with conventional messages +
explicit paths (a parallel session may be active — never bare `git commit`,
never touch files you didn't author), type-check before commit, no --no-verify.
```

---

## Status Update — 2026-05-25 (Session 2): Path D steps 2–5 SHIPPED

**This supersedes the continuation prompt above — steps 2 through 5 are done.**
All landed on `main` as separate conventional commits (legacy surface; V2 frozen).

| Step | Commit | What landed |
|---|---|---|
| 1 — spine verified | — | Owner confirmed the spine renders correctly on a DM. |
| 2 — spine in legacy thread | `5e46db8` | `SpineNode` wired into the legacy `activeThread` render path (mirrors the Pulse-DM wrap: row → `flex` gutter + `SpineNode` + `flex-1`). Legacy threads carry `decisionData`, so DECISION (tone-positive) moments now appear there too. |
| 3 — spine Phase 2 (AI) | `4ccff32` | `detectMomentsAI` (server-side via `processWithModel` → ai-router; no client key) + a `useConversationMoments` hook: heuristics paint instantly, AI upgrades async (stale-guard + per-conversation cache; gated off bot chats / <4 msgs). `mergeMoments` keeps structured decisions as ground truth + collapses to one trailing needs-reply. **21 unit tests.** |
| 4 — rail polish | `4d6a158` | Open-items interactive; mobile **rail-as-sheet** (an `xl:hidden` `PanelRightOpen` trigger in both conversation headers opens a right-side slide-in sheet; open-items count badge). |
| 5a — rail read-path | `b4e9068` | **No schema change needed.** `taskService.getOpenTasksByMessageIds` + `decisionService.getDecisionsByMessageIds` query the real `extracted_tasks` / `decisions` by the conversation's message ids (existing `origin_message_id` / `message_id`, both workspace-RLS'd). Merged into a `railData` memo for the DM path; `handleToggleOpenItem` now completes the real task for DMs (`updateTaskStatus 'done'`). Fixed a latent `railContactName` bug (`Thread.name` → `.contactName`). **6 unit tests.** |
| 5b — rail write-path | `415d948` | "Create task" / "Propose decision" actions on the live Pulse-DM context menu persist `origin_message_id` / `message_id` (title = trimmed message snippet; `created_by`/`proposed_by` = auth uid for the decisions RLS). The rail now lights up per-conversation. |

**Key discoveries (corrections to this handoff's earlier assumptions):**

- **Step 5 required NO migration / backfill / RLS work.** The feared "no
  contact/conversation FK" was wrong: `extracted_tasks.origin_message_id` (uuid)
  and `decisions.message_id` (uuid) already exist and are workspace-RLS'd — the
  message id *is* the conversation link. Verified live via the Supabase MCP
  (project `pulse-chat`, ref `ucaeuszgoihoyrvhewxk`). Note: the `tasks` table is
  a separate legacy/unused table — the real tasks live in `extracted_tasks`.
  Caveat that forced 5b: 0 of 15 tasks / 15 decisions had the link set (seed
  data only), so the read-path alone would always show "all clear".
- **`tsc --noEmit` OOMs at the default Node heap** (exit 134 ~4GB) and dies
  before reporting — a naive run reads as a false "clean". Use
  `NODE_OPTIONS=--max-old-space-size=8192`; with 8GB it reports **~1234
  pre-existing errors** repo-wide (vite/esbuild builds without type-checking).
  These 5 commits add **zero** new errors. (CLAUDE.md §5 lists the bare command.)

**Still open / needs a human (can't be done headless):**

- **Visual + E2E pass with auth (Google OAuth):** spine on real DMs, mobile
  sheet at 375px, and the full 5a/5b loop (create task/decision from a DM →
  rail item appears + DB row written). Headless can't reach these.
- **V2 context-menu parity:** 5b wired the *live* legacy menu; the
  `messageContextMenuV2` beta menu (default OFF) still lacks the two actions.
- **AI-extracted titles** for 5b (currently the raw message snippet) — optional.
- **AI moment-density tuning** if the spine feels noisy.
- **V2 `MessagesSplitView`:** rail + spine wiring (still frozen; flag default-OFF).
