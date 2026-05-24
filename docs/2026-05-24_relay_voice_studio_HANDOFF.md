# Relay → Voice Studio (Path C) — Handoff · 2026-05-24

> Self-contained. A fresh session can execute from this file. Read it fully
> before touching code. The companion implementation brief is
> `docs/relay-voice-studio-finalization.md`; the visual target is
> `_design-playground/relay-redesign.html` → switch to **"C · Voice Studio"**.

---

## ⚠️ TL;DR — the direction has DRIFTED. Course-correct.

**User's verdict (2026-05-24, verbatim intent):**
- "Inbox is the only section that looks like it matches the Voice Studio
  design — the rest is drifting really close to being the same as it was
  before, just polished — which is not the point of this redesign."
- "There are still many, many parts of Relay that haven't been touched and are
  starting to blend back into Relay's original UI."
- "This design needs to be for **large screens AND smaller screens** with
  optimization. I never said design desktop-only UI."
- "Re-design Path C based on **Pulse's actual code**."
- "Right now what I'm looking for is **progress**."

**What went wrong:** this session preserved each mode's existing body/structure
and layered on mastheads, eyebrow labels, a coral audit, compose-bar tweaks, and
a unified recorder. That left **Direct / Channel / Broadcast / Notes / Live
structurally identical to old Relay, just polished.** Only **Inbox**
(`RelayTriageStream.tsx`) is genuinely Voice-Studio-native (full studio cards,
waveforms, karaoke transcript, masthead, shared transport).

**The mandate going forward:** REBUILD each mode's body to Inbox's bar — every
message/content row becomes a `StudioCard` with the `Waveform` primitive, the
active-card coral ring, and the Path-C layout from the playground — and make it
**responsive** (columns on wide, drawers/stacking on narrow). Stop polishing the
old chrome; rebuild the surfaces.

---

## 🔴 Two blocking issues to resolve FIRST next session

### 1. Responsive is non-negotiable — and currently broken at narrow widths
The user runs Pulse as a **browser webapp**, often as a narrow pane beside other
windows. Reported: **even maximized**, neither the Channel **channels-sidebar**
(pre-existing `hidden md:flex`) NOR the new **members rail** (`hidden md:flex`)
appears. So:
- Path C side columns must NOT be width-gated-only. Convert to **drawers /
  toggles / stacking** so the Voice Studio styling is visible at every width.
- **Investigate why even the pre-existing `md:flex` channels-sidebar doesn't
  render when maximized.** Candidates: (a) viewing a **stale/cached or deployed
  build that lacks these commits**; (b) workspace data not loaded so
  `renderSidebarContent()` is empty; (c) a global breakpoint/transform/zoom that
  shifts the effective CSS width. Confirm which before more layout work.

### 2. Confirm WHICH build the user is viewing
"Still old styling" + "no sidebar even maximized" strongly suggests the running
app may **not contain these commits**. First action next session: verify the
viewed URL is the dev server / branch with the work (hard-refresh; check a known
change like the Inbox masthead or the restyled RecordingPreview is present).
Pulse hosting note: production currently serves from `*.logosvision.org`; a
pushed commit to `main` is NOT live unless that environment is rebuilt/deployed.

---

## ✅ What shipped this session (all on `main`, pushed, tsc-clean)

Range ≈ `b495cbf` … `d610ffe`. Key commits:
- Tier 1 mastheads + coral-tile removal (`ae9d7bf`→`9769137`) — contextual
  eyebrows (DIRECT VOICE / CHANNEL · {ws} / BROADCAST [rose] / PERSONAL NOTES),
  neutral icon tiles.
- Tier 2 record-affordance dedupe fallback (`a5223b2`).
- **Live light-theme fix** (`0045441`) — `VoiceRooms` was dark-only; tokenized to
  `[var(--pulse-*)]` (dark identical, light fixed). ✅ verified.
- Tier 2 unify-trigger recorder: `RelayStudioContext.registerRecorder` +
  `notifyRecording` + `useRelayModeRecorder` hook; FloatingMic/footer drive each
  mode's own capture/preview pipeline. Notes (`b1b3288`, user mic-tested ✅),
  Direct/Channel/Broadcast (`83b1753`/`3c4b90f`/`c5c427f`).
- Direct conversation day-grouping (`fbf88c6`) — Today/Yesterday/Last week. ✅
- Channel members rail + AI digest + 3-col flex fix (`0e3cecf`/`cb795b2`),
  breakpoint lg→md (`d610ffe`) — **never verified visible by the user (width).**
- RecordingPreview → Voice Studio restyle (`05ffd62`) — coral-gradient tile →
  mono eyebrow + record dot; neutral-until-playing play button; tokens.
- Verification harness (`0de918a`/`b9183a2`/`f27e48d`): `e2e/relay-pathc-verify.spec.ts`.

Nothing needs reverting; it's all additive/correct. It's just **not enough** —
it polished rather than rebuilt.

---

## 📋 Per-mode state vs the Voice Studio bar

| Mode | File | Now | Must become (Path C) |
|---|---|---|---|
| **Inbox** | `RelayTriageStream.tsx` | ✅ **reference — true Voice Studio** | (done — copy its patterns) |
| **Direct** | `ClassicMode.tsx` (+`.css`) | old `classic-*` bubbles + masthead + day-group | studio-card me/them rows, responsive thread-list (drawer on narrow) |
| **Channel** | `TeamVoxMode.tsx` | old feed + masthead + compose bar + (hidden) rail | studio-card posts, members as drawer/panel, AI digest, responsive |
| **Broadcast** | `PulseRadio.tsx` (+`.css`) | old `pulse-radio-*` + masthead + title input | big studio player + chapters + AI summary + related studio cards |
| **Notes** | `VoxNotesMode.tsx` | old list+detail + masthead | studio-card **timeline** (mock `PathCNotes`) |
| **Live** | `VoiceRooms.tsx` | light-fixed; old rail+detail | room **grid** of studio cards + `LIVE NOW · N` masthead, responsive |

---

## 🎯 What "Voice Studio" actually means (the bar to hit)

Open `_design-playground/relay-redesign.html` → Path C and match it. Concretely:
- **Every row is a `StudioCard`** (`src/components/Relay/studio/StudioCard.tsx`)
  using the **`Waveform`** primitive, the **active coral ring** (auto via
  `data-active`), and the karaoke transcript reveal — exactly as Inbox does.
- **Masthead** pattern (mono eyebrow + title) — already in place per mode.
- **Coral budget** (CLAUDE.md §4): coral only for AI / now-playing / record /
  primary-CTA. Tokens at `src/styles/pulse-tokens.css`; consume `var(--pulse-*)`.
- **Responsive**: wide → the mock's multi-column; narrow → drawers/stacked,
  never a vanished column. This is a hard requirement, not optional.
- Shared transport via `useRelayStudio()` (already wired everywhere).

---

## 🧰 Tooling & gotchas (save the next session hours)

- **Playwright self-verification works** — `e2e/relay-pathc-verify.spec.ts`
  screenshots all sources light+dark into `.relay-verify/` (gitignored); read the
  PNGs back. Run wide AND narrow viewports to catch responsive breakage.
  `npx playwright test e2e/relay-pathc-verify.spec.ts --project=chromium`.
- **Auth**: Google blocks automated-browser OAuth, so the repo's
  `auth.setup --headed` flow is dead. Refresh `e2e/.auth/user.json` from a REAL
  logged-in tab (DevTools console):
  `copy(JSON.stringify({cookies:[],origins:[{origin:location.origin,localStorage:Object.entries(localStorage).map(([name,value])=>({name,value}))}]}))`
  → save to `e2e/.auth/user.json`. Supabase access token lasts **~1 hour** (re-export when it lapses). `auth.setup` short-circuits on ANY existing token even if expired — overwrite to refresh.
- **Headless data race**: the Channel workspace/channel data often doesn't load
  in headless ("Select a channel"), so the members rail can't be auto-captured.
- **User screenshots over 2000px don't transmit** (API rejects). Ask for
  ≤2000px crops, or answers in words.
- **tsc**: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit`; the
  pre-existing ignore list is in `docs/relay-voice-studio-finalization.md`
  (onSwitchMode, tc.text, RecordingPreview/VoxSmartReplies prop mismatches,
  Tower, bookmarked, broadcaster|timestamp, recordingMode hold|tap, linkedItems).
- **Git**: work on `main`, commit per unit, never `git add -A`, two pre-existing
  dirty files (`supabase/migrations/pulse1.entomate.code-workspace`,
  `test-results/.last-run.json`) must stay unstaged (CLAUDE.md §1).
- Parallel Claude sessions share this repo — a commit `e09b7cc` from another
  session landed mid-session; expect interleaving.

## 🗺️ Suggested plan for the next session

1. **Confirm the build** the user sees contains the commits (hard-refresh; verify
   Inbox masthead + restyled RecordingPreview render). Resolve the
   "no sidebar even maximized" mystery (stale build vs data vs breakpoint).
2. **Establish a responsive Voice Studio shell pattern** once (column↔drawer
   helper) so every mode reuses it.
3. **Rebuild modes to Inbox parity, one at a time**, verifying each with
   screenshots at BOTH a wide (~1440) and narrow (~700) viewport before moving
   on. Suggested order: Notes (simplest timeline) → Direct → Channel → Broadcast
   → Live. REBUILD bodies into studio cards; do not re-polish old chrome.
