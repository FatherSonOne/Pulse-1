# Relay → Voice Studio (Path C) — End-to-End UI Redesign Plan

> **Goal:** Apply the Path C "Voice Studio" design **unwaveringly** to every Relay
> section so they match the playground mockup end-to-end. UI parity is the only
> objective for this effort — all other polish/blockers (masthead toolbar
> overflow, threshold tuning, perf, copy) **wait**.
>
> **Source of truth (visual + structure):** `_design-playground/relay-redesign.html`
> → switch the playground to **"C · Voice Studio"**. Each section's exact target
> is a `PathC*` React function in that file (line numbers below). When in doubt,
> the playground wins — replicate its layout, hierarchy, spacing, copy, and the
> coral budget verbatim, then wire to real data.
>
> **Status when this plan was written (2026-05-24):** the shared row primitive
> (`RelayVoiceMessage`) + responsive shell are DONE and pushed. Only **Inbox**
> (`RelayTriageStream`) is a true Voice Studio surface. The other five sections
> have the right *rows* but the wrong *section scaffolding*.

---

## 1. What "matches the redesign" means (the bar)

A section is done only when its **body structure** matches its `PathC*` function:

1. **Masthead** — mono eyebrow (`RELAY · INBOX`, `PERSONAL NOTES`, `LIVE NOW · 2 ROOMS`,
   `CHANNEL · {WS}`, `DIRECT VOICE`, `BROADCAST · {when}`) + a `text-3xl font-semibold`
   title + a one-line subtitle. A shared component (see §3) — not the old
   `VoxModeToolbar`/`VoxModeHeader` chrome.
2. **Studio cards everywhere** — every content row is a `studio-card` (the
   `StudioCard` component / `.studio-card` class with the `data-active` coral
   ring), using the shared `Waveform` (fills with `progress` when active).
   `RelayVoiceMessage` (already migrated) is the card for message rows; Live,
   Broadcast-hero, Notes, and Channel-members use bespoke studio-card layouts.
3. **Exact layout** — the multi-column grids, lists, rails, and the room/related
   grids from the `PathC*` function. Wide → the mock's columns; narrow → the
   responsive drawers/single-pane that already exist (don't regress them).
4. **Coral budget (CLAUDE.md §4)** — coral ONLY for: now-playing/active source,
   record indicator, AI output (`pulse-coral-bg`/`-fg` chips + digests), and the
   primary record CTA. Never chrome, dividers, or generic accents.
5. **Shared studio footer + floating mic** — already wired via `useRelayStudio()`;
   keep playback flowing through the shared transport across every section.

---

## 2. Per-section spec — target, current, gap

Playground line refs are in `_design-playground/relay-redesign.html`.

| Section | Playground target | Current file | Gap to close |
|---|---|---|---|
| **Inbox** | `PathCInbox` L1535 + `PathCCard` L1559 | `RelayTriageStream.tsx` | ✅ reference — done. Copy its masthead + StudioCard + karaoke + `PULSE AI · KEY POINT` patterns. |
| **Live** | `PathCLive` L1909 | `VoiceRooms.tsx` | **Full rebuild.** Replace the LIVE·YOU/TEAMS/CONTACTS/AD-HOC rail+detail with: masthead `LIVE NOW · N ROOMS` / "Voice rooms" / "Drop in. Talk over voice. Walk away." + a **2-col grid of room studio-cards**: LIVE/EMPTY dot, "N present", room name, "Hosted by X" / "No one yet", animated live-bars + **Join room** button. Keep WebRTC join/leave + AI sidecar behavior. |
| **Broadcast** | `PathCBroadcast` L1830 | `PulseRadio.tsx` | **Full rebuild.** Masthead `BROADCAST · {WHEN}` / title / "host · N listeners · dur". A **big hero studio-card** for the featured broadcast: 14×14 play + 120-count tall waveform + `0:00 / dur` + a `PULSE AI · SUMMARY` coral block. Then **`RELATED BROADCASTS` 2-col grid** of compact studio-cards. (The migrated `RelayVoiceMessage` rows become the related grid / channel feed; the hero is new.) |
| **Notes** | `PathCNotes` L1874 | `VoxNotesMode.tsx` | **Restructure.** Drop the list+detail split as the primary view → a **single-column timeline** of studio-cards: masthead `PERSONAL NOTES` / "Voice notes" / "Personal · never shared · auto-transcribed"; each card = edit-icon tile + title + `when · dur` + play + waveform + transcript + `#TAG` chips. (Detail editor can remain reachable for tag/link editing, but the section's main surface is the timeline. The list cards from the row migration are close — align to this masthead + single-column structure.) |
| **Channel** | `PathCChannel` L1720 | `TeamVoxMode.tsx` | **Body rebuild.** `grid-cols-[200px_1fr_220px]`: (a) **CHANNELS list** (`# name` + unread), (b) **feed** with header (hash tile, `CHANNEL · {WS}`, name, "N members · M online · K voices today") + studio-card posts with `@MENTION` pill + **inline mention highlighting** in transcript, (c) **MEMBERS rail** (`ONLINE — n` / `OFFLINE — n`, avatar + role label) + **`CHANNEL AI` coral DIGEST** card. Members rail + digest partly exist from the responsive pass — align them to this exact structure. |
| **Direct** | `PathCDirect` L1617 | `ClassicMode.tsx` | **Body rebuild.** `grid-cols-[260px_1fr]`: (a) **PEOPLE list** (avatar + online dot + name + unread + "last · ago"), (b) conversation header (avatar + online dot + `DIRECT VOICE` + name + "Active Xm ago · N voices in thread" + search/bookmark/settings), (c) **day-grouped studio-cards** (me = `ml-12`, them = `mr-12`) with avatar+name+time, play+waveform, transcript. Rows are migrated; the people-list, rich header, and me/them indent need to match. |

**Shell (`PathC` L1328):** SourcesRail + `SMART PLAYLISTS` (Unheard/Needs reply/Bookmarked/Today with counts) + persistent `StudioFooter` (L1453) + floating mic. Mostly done; ensure the smart-playlist rail section renders with real counts.

---

## 3. Shared primitives to build/reuse FIRST (do not duplicate per mode)

- **`StudioMasthead`** (NEW, small): `{ eyebrow, title, subtitle?, tone?, right? }` →
  the mono-eyebrow + `text-3xl` title + subtitle block every section uses. Extract
  it once (Inbox's header is the reference) and reuse across all six. Replaces the
  per-mode `VoxModeToolbar`/`VoxModeHeader` masthead usage.
- **`StudioCard`** (`src/components/Relay/studio/StudioCard.tsx`) — the `.studio-card`
  + `data-active` coral-ring shell. Reuse for Live rooms, Broadcast hero/related,
  Notes timeline, Channel members digest.
- **`Waveform`** (`studio/Waveform.tsx`) — `seed`, `count`, `progress`, `tall`,
  `className` (color via `currentColor`). Already the bar everywhere.
- **`RelayVoiceMessage`** (`RelayVoiceMessage.tsx`) — the migrated message-row card
  (Direct/Channel feed/Notes-list/Broadcast-related). Already the Voice Studio bar.
- **`useRelayStudio()`** — shared transport (play/progress/record), `singlePane`,
  `bodyWidth`, `railAutoCollapsed`. Drive playback + responsive off this.
- **`StudioFooter` / `FloatingMic`** — persistent player + record affordance. Keep.

> Design tokens are canonical at `src/styles/pulse-tokens.css`; consume `var(--pulse-*)`.
> The playground's `pulse-coral-bg-color`/`pulse-coral-fg-color`/`pulse-rose-color`
> map to the real `--pulse-coral-*` / `--pulse-rose` tokens — use the tokens.

---

## 4. Suggested execution order (simple → complex; each = one commit, verified)

1. **`StudioMasthead`** shared component (+ adopt in Inbox to prove parity).
2. **Live** (`VoiceRooms`) — self-contained 2-col room grid. Cleanest full rebuild.
3. **Notes** (`VoxNotesMode`) — single-column timeline + masthead.
4. **Broadcast** (`PulseRadio`) — hero player + related grid.
5. **Direct** (`ClassicMode`) — people list + rich header + me/them studio cards.
6. **Channel** (`TeamVoxMode`) — 3-col feed + members rail + AI digest (most complex).

Each section: rebuild body to its `PathC*` function → wire real data + preserve all
behaviors → `tsc` (ignore the pre-existing list, §6) → Playwright verify wide+narrow,
dark+light → commit + push.

---

## 5. Verification protocol (every section, before commit)

- **Harness:** `e2e/relay-pathc-verify.spec.ts` → `npx playwright test e2e/relay-pathc-verify.spec.ts --project=chromium`. Screenshots land in `.relay-verify/` (gitignored); read the PNGs back. The NARROW tour resizes in-app (980/860/720/560) and navigates by `data-section` ids.
- **Token (lasts ~1 hr):** Google blocks automated OAuth. Refresh `e2e/.auth/user.json`
  via the **download** method (NOT `copy()`, which fails silently). In the logged-in
  `localhost:5173` console run the Blob-download snippet → it lands in
  `C:\Users\Aegis{FM}\Downloads` (a Claude working dir) → Claude copies it into
  `e2e/.auth/`. See memory `reference_pulse_e2e_token_export.md`.
- **Real data exists** in this account: Direct (Frank Messana thread), Channel
  (Franks › General), Broadcast (Test channel, 2 episodes), Notes (several). Use it.
- Compare each screenshot side-by-side against the matching `PathC*` in the
  playground. "Looks close" ≠ done — match the structure.

---

## 6. Guardrails (do not violate)

- **Git (CLAUDE.md §1):** work on `main`, commit per section, `git add <explicit paths>`
  (never `git add -A`), never branch without asking. Two pre-existing dirty files
  (`supabase/migrations/pulse1.entomate.code-workspace`, `test-results/.last-run.json`)
  must stay unstaged. Push after each verified section. gitleaks runs on commit — don't bypass.
- **tsc:** `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit`, filter to the file
  you touched. Pre-existing ignore-list errors (do NOT try to fix as part of this):
  `onSwitchMode`, `tc.text`, `RecordingPreview`/`VoxSmartReplies` prop mismatches,
  `Tower`, `bookmarked`, `broadcaster|timestamp`, `linkedItems`, the selection-mode
  `string vs VoxSelectionItem` comparison. Your changes must add **zero new** errors.
- **Server-side AI (CLAUDE.md §4):** all Gemini/AI via Supabase edge functions; no
  direct API calls from React.
- **Coral budget:** see §1.5. Coral is signal, never decoration.
- **Don't regress** the responsive single-pane behavior or the shared-transport playback.
- **Behavior parity:** preserve selection mode, reactions, menus, reply, favorite,
  chapters, seek (Notes detail), join/leave (Live), like/discuss/share (Broadcast).

---

## 7. Definition of done

All six sections (Inbox + Live + Notes + Broadcast + Direct + Channel) visually match
their `PathC*` playground function at wide AND narrow, dark AND light, with real data;
every content row is a studio-card on the shared Waveform; mastheads consistent via
`StudioMasthead`; coral budget respected; tsc adds no new errors; each section committed
+ pushed to `main`; verified by screenshot against the playground.

---

## 8. Execution prompt (paste into a fresh session)

```
Use the superpowers workflow to apply the Relay "Voice Studio" (Path C) UI
redesign END-TO-END across every Relay section, unwaveringly. UI parity is the
ONLY goal — defer all other polish/blockers.

Read first, in order:
1. docs/2026-05-24_relay_voice_studio_E2E_PLAN.md  (the plan — follow it)
2. _design-playground/relay-redesign.html, switched to "C · Voice Studio"
   (the visual source of truth — each section's target is its PathC* function:
   PathCInbox L1535, PathCDirect L1617, PathCChannel L1720, PathCBroadcast L1830,
   PathCNotes L1874, PathCLive L1909, PathC shell L1328, StudioFooter L1453)
3. CLAUDE.md (git + coral + AI-routing guardrails) and the MEMORY.md index

Then run the superpowers brainstorm → plan → execute discipline:
- Brainstorm/confirm the per-section approach against the plan's §2 table.
- Write the implementation plan (subagent-dispatchable, one section per unit,
  simple→complex order: StudioMasthead → Live → Notes → Broadcast → Direct → Channel).
- Execute section by section. For each: build the shared StudioMasthead first if
  not done, rebuild the section BODY to match its PathC* function (reuse StudioCard,
  Waveform, RelayVoiceMessage, useRelayStudio — never duplicate), wire to real data,
  preserve ALL existing behaviors, keep the responsive single-pane intact.

Non-negotiables:
- Match the playground structure exactly (layout, hierarchy, copy, coral budget) —
  "looks close" is not done.
- Verify EACH section before committing: refresh e2e/.auth/user.json via the
  download method (memory reference_pulse_e2e_token_export.md — copy() fails
  silently), run `npx playwright test e2e/relay-pathc-verify.spec.ts --project=chromium`,
  read the .relay-verify/ PNGs at wide AND narrow, and compare against the PathC*
  mock. Real data exists (Frank Messana DM, Franks>General channel, Test broadcast
  channel, several notes).
- Git: main, commit per section with explicit paths, never `git add -A`, leave the
  two pre-existing dirty files unstaged, push after each verified section.
- tsc must add ZERO new errors (the pre-existing ignore-list is in the plan §6).
- Coral is signal only; AI stays server-side via edge functions.

Definition of done = plan §7. Drive it to completion section by section.
```
