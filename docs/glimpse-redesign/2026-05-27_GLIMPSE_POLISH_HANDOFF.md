# Glimpse Redesign — Polish & Follow-up Handoff

> **Status:** Path D redesign **SHIPPED** to `main` (2026-05-27). This doc
> tracks the **polish items deliberately deferred** during that ship, so a
> fresh session can finish them. Read it top to bottom before touching code.
>
> **Polish progress (2026-05-27, follow-up session):** items **1, 2, 3, 4, 5,
> 7 SHIPPED** to `main`; item **6 BLOCKED** (not buildable as polish). See the
> per-item ✅/🚫 markers below. Verification each commit: `vitest run
> src/services/glimpse` (9/9) + `tsc --noEmit` (no new `Glimpse.tsx` errors).
> Commits: `a394202` (1), `cbfa36c` (3), `3cbb402` (4), `942b33d` (2),
> `2c2bd5b` (7), `e23f4ca` (5).
>
> | Item | Status | Note |
> |---|---|---|
> | 1 reduced-motion | ✅ shipped | also neutralized translate-hovers + sibling `.gl-tc-empty-cta` |
> | 2 rail jump-to-source | ✅ shipped | split affordance (checkbox=convert, label=jump) + `.gl-card--flash` |
> | 3 processing skeleton | ✅ shipped | 2-line shimmer in summary slot; chip moved to tags row |
> | 4 fade-up entrance | ✅ shipped | `gl-fade-up` on `.gl-inbox` / `.gl-thread` |
> | 5 briefing time stat | ✅ shipped | honest "N min of video" from `lastMessageDuration` across `needs` |
> | 6 walkthrough badge | 🚫 **blocked** | capture mode is **never persisted** at send time — see item 6 |
> | 7 J/K inbox nav | ✅ shipped | local handler scoped to inbox; help overlay left unchanged (see note) |
>
> **Still open after this session:** item 6 (needs an upstream send-path +
> schema change, below), the visual/reduced-motion eyeball pass (overlaps
> #122), and the two **Open UX decisions** at the bottom (need the user's
> call). The `J`/`K` shortcut works but is *not* advertised in the shared
> `VoxKeyboardShortcutsHelp` (it renders `RELAY_SHORTCUTS`, shared across 10
> Relay surfaces; adding `J`/`K` there would advertise a Glimpse-only shortcut
> everywhere).
>
> **Companion docs:**
> - Implementation plan (executed): `2026-05-27_GLIMPSE_REDESIGN_HANDOFF.md`
> - Bigger deferred work (Tier-2 digest, visual pass, e2e spec, dead-code
>   cleanup): **GitHub issue #122** under launch epic **#98**. This doc is the
>   *small polish* set — complementary, not duplicate. Overlap is called out
>   per item.
> - Visual source of truth: `_design-playground/glimpse-redesign.html` (Path D)
>   + `_design-playground/_shots/glf-01..04`.

---

## What already shipped (don't rebuild)

Live on `main` across four commits:

| SHA | What |
|---|---|
| `22ae7cc` | `feat(glimpse): extract key decisions in conversation summary` — optional `keyDecisions` added to `ConversationSummary` (`relayAIService.ts`) |
| `3a27afe` | `feat(glimpse): Path D redesign — reel inbox + thread task rail` |
| `1897d53` | `feat(glimpse): Path D header — section tab nav + thread sub-header` |

All component code is in `src/components/Glimpse/Glimpse.tsx`; all styles in
`src/components/Glimpse/Glimpse.css`. Line numbers below are **as of `1897d53`**
— they will drift; anchor on the named component / CSS class, not the number.

Component map (Glimpse.tsx @ `1897d53`):
- `ReelCard` (L266) · `GlimpseBriefingCard` (L379) · `GlimpseTaskRail` (L473)
- `MessageBubble` (L580); its root is `<article className="gl-card">` (L659)
- `GlimpseSectionHeader` (L1033) · `GlimpseThreadHeader` (L1116)
- main `Glimpse` (L1250); `railTasks` memo (L1376); `handleTabSelect` (L1787);
  `activeConversation` (L1808)

**Invariants to preserve** (see `[[reference_pulse_design_tokens]]`, CLAUDE.md §4):
coral = AI-signal only; consume `--gl-*` / `--pulse-*` tokens, no color
literals; light + dark parity; the prelaunch "ship only what's real" rule
(no fabricated prose/stats).

---

## Polish items

### 1. `prefers-reduced-motion` doesn't cover the new components — **fix (a11y correctness)**
**What:** The reduced-motion guard in `Glimpse.css` (`@media (prefers-reduced-motion: reduce)`,
~L3199) is a *targeted* selector list, not a blanket `*` rule. It lists old
elements (`.gl-card`, `.gl-tc-row`, `.gl-record-btn`, `.gl-tc-empty-cta`, …) but
**none of the new Path-D classes**, so their hover lifts / rotations still
animate for users who asked the OS to reduce motion.

**Where:** `Glimpse.css` reduced-motion block (~L3199).

**Fix:** Add the new animated/transformed classes to the existing selector
list (keep the `animation: none !important; transition: none !important;`
body). At minimum the ones with `transform`:
- `.gl-reel-card` (hover `translateY(-2px)`)
- `.gl-thread-reply` (hover `translateY(-1px)`)
- `.gl-rail-toggle-chev` (`.open` rotates 180°)
- and the transition-only ones for consistency: `.gl-section-tab`,
  `.gl-thread-summarize`, `.gl-thread-back`, `.gl-thread-more`,
  `.gl-section-help`, `.gl-rail-task`, `.gl-briefing-need`, `.gl-mode-toggle-btn`.

**Acceptance:** With OS "reduce motion" on, none of the inbox/thread/header
elements translate, scale, or rotate; hover still gives a non-motion cue
(background/border change is fine).

---

### 2. Rail task → scroll-to / highlight its origin card — **deferred (plan-named "optional polish")**
**What:** Clicking a task in `GlimpseTaskRail` converts it to a Pulse task (✓)
but does **not** jump to the message it was extracted from. The implementation
plan (§3) named this as optional.

**Where:** `GlimpseTaskRail` (L473) — `handleAdd`; `MessageBubble` root
`<article className="gl-card">` (L659). The rail already has the owning message
on each task (`RailTask.message`).

**How:**
1. Give each card a stable id: in `MessageBubble`, add
   `id={`gl-msg-${message.id}`}` to the root `<article>`.
2. In the rail, either on task click (alongside convert) or via a small
   secondary "jump" affordance, call
   `document.getElementById(`gl-msg-${t.message.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })`
   and toggle a transient highlight class (e.g. `.gl-card--flash`, a ~1.2s
   coral-soft ring that respects reduced-motion → instant, see item 1).
3. Decide UX: convert-and-jump on the same click, or split (tap text = jump,
   tap checkbox icon = convert). Recommend split so converting doesn't yank
   scroll.

**Acceptance:** Clicking a rail task (or its jump affordance) scrolls the
origin card into view with a brief, reduced-motion-safe highlight; convert
behavior unchanged.

---

### 3. Reel card processing state has no skeleton — **minor fidelity**
**What:** A still-transcribing glimpse shows only the `Transcribing` pending
chip in `ReelCard`; the old triage row showed a shimmer skeleton
(`.gl-tc-summary-skeleton`). Honest, just less polished.

**Where:** `ReelCard` (L266) — the `processing && !hasSummary` branch; reuse the
existing `gl-skel` keyframe (Glimpse.css ~L1592) or `.gl-tc-summary-skeleton`.

**How:** Render two short skeleton bars in the summary slot (reserving the
`min-height: 2.9em` the summary already uses) with the chip above/below.
Respect reduced-motion (the skeleton spans are already in the L3199 list — keep
them there).

**Acceptance:** A processing reel card shows a 2-line shimmer placeholder where
the summary will land, matching the triage row's old behavior.

---

### 4. No entrance `fade-up` on the new views — **minor fidelity**
**What:** The playground faded the inbox/thread in (`.fade-up`). The shipped
`.gl-inbox` / `.gl-thread` mount with no transition.

**Where:** `Glimpse.css` — add a `gl-fade-up` keyframe (or reuse one if added)
and apply to `.gl-inbox` and `.gl-thread`.

**How:** ~240ms `cubic-bezier(0.16,1,0.3,1)` translateY(6px)→0 + opacity.
**Must** be disabled under reduced-motion (add both classes to the L3199 list).

**Acceptance:** Inbox and thread fade/rise in on mount; nothing animates under
reduced-motion.

---

### 5. Briefing omits a "time" stat — **optional, needs honest data**
**What:** The playground mock showed "8 min saved." It was left out rather than
fabricated (prelaunch "ship only what's real").

**Where:** `GlimpseBriefingCard` (L379) — the `gl-briefing-meta` slot (currently
shows `{totalUnread} unread`).

**How (if wanted):** Make it *deterministic and honestly framed*. The inbox only
has `lastMessageDuration` per conversation (not total unwatched), so the only
truthful stat is e.g. **"N min of video waiting"** = sum of `lastMessageDuration`
across `needs` conversations. Do **not** label it "time saved" (unprovable).
Caveat in a comment that it's last-message duration, not full backlog.

**Acceptance:** If added, the number is reproducible from `GlimpseConversation`
fields and labelled in a way that's literally true.

---

### 6. No "Walkthrough" badge on reel cards — **data-limited (upstream change)**
**What:** `ReelCard` shows a Group badge (derivable from participants) but no
Walkthrough badge — `GlimpseConversation` carries no per-conversation capture
type. The messages/thread know (`captureMode`), the inbox list doesn't.

**Where:** Data origin: `src/services/glimpse/glimpseService.ts`
(`getMyConversations` mapper) + `GlimpseConversation` type in
`glimpseTypes.ts`; consumer `ReelCard` (L266).

**How:** Surface a `lastMessageCaptureMode` (or `lastMessageKind`) on
`GlimpseConversation` from the service query (the last message's capture mode),
then render a `WALK` poster badge in `ReelCard` mirroring the Group badge.
Confirm RLS / query shape via MCP before adding a new column read
(`[[project_pulse_relay_workspace_rls]]`). If the source column doesn't exist,
this is blocked until it's recorded at send time.

**🚫 CONFIRMED BLOCKED (2026-05-27).** Capture mode is **never persisted**.
The send-path insert into `video_vox_messages`
(`glimpseService.ts` ~L510) writes no capture-mode column; `captureMode`
(`'cam' | 'cam-screen'`) exists only client-side in `useGlimpseRecording.ts`
and is discarded on send. So this is not a polish/UI task — unblocking it is a
4-step upstream change, in order:
> 1. Migration: add a `capture_mode` (text) column to `video_vox_messages` on
>    the live `pulse-chat` project (`[[reference_pulse_supabase]]`).
> 2. Write it in the insert at `glimpseService.ts` ~L510 (`captureMode` is
>    already threaded into the send call).
> 3. Surface `lastMessageCaptureMode` on `GlimpseConversation` via the
>    `mapDbToConversation` mapper (~L1494) + the `glimpseTypes.ts` type.
> 4. Render the `WALK` poster badge in `ReelCard`, mirroring the Group badge.
>
> Backfill is impossible for existing rows (the data was never captured), so
> old glimpses would show no badge regardless. Surface to the user before
> doing this — it's a schema change on the live DB, out of scope for a polish
> pass.

**Acceptance:** Walkthrough glimpses show a `WALK` badge in the reel grid,
sourced from real data (no heuristic guessing).

---

### 7. `J` / `K` inbox keyboard navigation — **never wired (pre-existing gap)**
**What:** The playground advertised `J`/`K` next/prev in the inbox; it was never
implemented (also absent in the old triage table — not a regression).

**Where:** `useRelayKeyboardShortcuts` (`src/hooks/useRelayKeyboardShortcuts.ts`)
+ the reel grid in `Glimpse.tsx` (`viewMode === 'conversations'` render).

**How:** Add `onNext`/`onPrev` to the shortcuts hook (or a local keydown handler
scoped to the inbox) that moves focus across the `.gl-reel-card` buttons (they're
already focusable `<button>`s, grouped under Needs-you / FYI `<section>`s). Roving
tabindex or simple focus-next over `querySelectorAll('.gl-reel-card')`. Honor the
`?` help overlay (already lists the shortcut set).

**Acceptance:** `J`/`K` move focus card-to-card across both sections; `Enter`
opens the focused glimpse; doesn't fire while typing in an input.

---

## Open UX decisions (need the user's call before building)

- **Thread tab when no conversation is open** — currently **disabled (dimmed)**
  in `GlimpseSectionHeader` (L1033, the `disabled = t.id === 'thread' && !hasActiveThread`
  line). Alternative: hide it entirely until a glimpse is open. *User to decide.*
- **⋯ menu vs visible buttons** — Smart Replies / Draft / Select live in the
  `GlimpseThreadHeader` (L1116) overflow menu. Alternative: promote one or more
  to always-visible buttons next to Summarize. *User to decide which, if any.*

---

## Verify (per repo conventions)

- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` — gate on **no NEW**
  errors (`[[reference_pulse_tsc_oom]]`; ~1234 pre-existing).
- `npx vitest run src/services/glimpse` — keep the 9 glimpse tests green.
- Visual: dark + light, empty inbox, processing, group, long transcript, rail
  with 0 tasks, reduced-motion on. (This overlaps the #122 visual-pass item —
  do them together.)
- e2e a11y spec for inbox-grid + thread-rail is tracked in **#122** (pattern:
  `e2e/messages-coral-cockpit-a11y.spec.ts`; auth refresh per
  `[[reference_pulse_e2e_auth_refresh]]`).

## Commit discipline (CLAUDE.md)
Work on `main`; commit each item independently with a conventional message and
the `Co-Authored-By: Claude Opus 4.7 (1M context)` trailer. A parallel session
has been active in this repo — commit only your own files with explicit paths,
never a bare `git commit`, and pause-and-verify any uncommitted work you didn't
author.
