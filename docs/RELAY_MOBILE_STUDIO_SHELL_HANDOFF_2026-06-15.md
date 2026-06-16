# Relay Mobile Studio-Shell Pass — Implementation Handoff

**Date:** 2026-06-15
**Surface:** Relay ("Voice Studio", formerly Voxer) — the studio SHELL + chrome + 6 surface bodies
**Status:** IN PROGRESS — **P0/P1/P2 shipped to `main` 2026-06-15** (`6325f14` / `0267a9f` / `695fe51`). All three are tsc-clean and desktop-byte-identical at ≥640px, but the **sub-640px VISUAL is not yet eyeballed**: the headless overflow probe loaded the logged-out landing page because the e2e auth token was stale (see §9). **P3–P7 remain** — pending the §10 decisions + a live eyeball. Execute the rest **with the app running**.
**Owner:** solo (Pulse). Direct-to-`main`, additive commits per phase.

---

## 1. Context & scope

### What "the studio shell" is

Relay is the voice section. Its current shell (Path C, "Voice Studio") is a horizontal
flexbox: a vertical **SourcesRail** on the left + a **body** on the right that switches
between **6 surfaces** via a `view` state guard in `src/components/Relay.tsx`:

| view        | component               | file                                            |
|-------------|-------------------------|-------------------------------------------------|
| `triage`    | RelayTriageStream (Inbox) | `src/components/Relay/RelayTriageStream.tsx`   |
| `direct`    | ClassicMode             | `src/components/Relay/ClassicMode.tsx`          |
| `channel`   | TeamVoxMode (Channels)  | `src/components/Relay/TeamVoxMode.tsx`          |
| `broadcast` | PulseRadio              | `src/components/Relay/PulseRadio.tsx`           |
| `notes`     | VoxNotesMode            | `src/components/Relay/VoxNotesMode.tsx`         |
| `live`      | VoiceRooms (flag-gated OFF) | `src/components/Relay/VoiceRooms.tsx`        |

Shared chrome lives in `src/components/Relay/studio/`: `SourcesRail.tsx`,
`StudioMasthead.tsx`, `StudioFooter.tsx` (persistent transport), `FloatingMic.tsx`,
`StudioCard.tsx`, `StudioMessageCard.tsx` (the flat per-message row primitive consumed by
ClassicMode/TeamVoxMode/VoxNotesMode), `Waveform.tsx`, the recorder-registration hook
`useRelayModeRecorder.ts`, the brain — `RelayStudioContext.tsx` — and the public barrel
`index.ts` (re-exports every studio primitive the shell + mode bodies import).

**The FloatingMic's dual-role record chain that this plan repeatedly warns must be preserved
is implemented in `useRelayModeRecorder.ts`.** Each mode (ClassicMode/TeamVoxMode/PulseRadio/
VoxNotesMode — verified consumers) calls `useRelayModeRecorder({ start, stop, cancel,
recording, enabled })` to register its OWN capture pipeline into the shell. The hook hands
the shell three levers (start/stop/cancel via a stable ref so re-registration never resets
an in-flight recording, `useRelayModeRecorder.ts:38-57`) and mirrors the mode's live
`recording` flag back (`notifyRecording`, L60-62) so the FloatingMic icon + the StudioFooter
RECORDING surface reflect the truth. `enabled:false` makes a mode register no recorder (the
FloatingMic hides via `requireRecorder && !hasRecorder`), used by modes that can only record
once a target exists (selected channel/broadcast/contact). This file is the load-bearing
contract behind every "preserve recording" risk in this doc — point any implementer here.

**Relay's responsive model is PANE-driven, not viewport-driven.** This is deliberate and
documented. `Relay.tsx:149` measures its own pane with `useElementWidth`
(`src/components/Relay/studio/useElementWidth.ts`, a ResizeObserver hook), feeds it to
`<RelayStudioProvider paneWidth={paneWidth}>` (`Relay.tsx:239`), and the context derives
three signals every surface keys off (`RelayStudioContext.tsx:432-436`):

```
const RAIL_AUTOCOLLAPSE_W = 900;   // L139
const SINGLE_PANE_W = 560;          // L140
railAutoCollapsed = paneWidth > 0 && paneWidth < RAIL_AUTOCOLLAPSE_W;   // L432
bodyWidth = paneWidth - railWidthPx (200 expanded / 64 collapsed);      // L435
singlePane = bodyWidth > 0 && bodyWidth < SINGLE_PANE_W;                 // L436 (BODY-width test)
```

The reason (verbatim from `useElementWidth.ts:7-11`): *"Relay never gets the full viewport
— the global Pulse nav and the vertical SourcesRail sit in front of every mode body — so
Tailwind md:/lg: (viewport media queries) over-report the room a mode actually has.
Measuring the *pane* gives container-query semantics."*

### Why a mobile pass

On a `<640px` phone the shell does **not** break (it's container-query driven) but it is
**cramped and not native**: the rail never leaves the horizontal flex row, so even
collapsed to its 64px icon strip it permanently steals ~18% of a ~360px screen; Relay
renders inset (rounded card) rather than full-bleed; and the chrome (FloatingMic,
StudioFooter) has zero safe-area / keyboard / global-slim-bar awareness. Two surfaces
(Inbox, Notes) never read the single-pane signal at all.

### HARD CONSTRAINT — additive layering, NEVER a rewrite (CLAUDE.md Rule A)

This is an 8-month-old, load-bearing surface. **Every change in this plan is additive
responsive layering on top of the working desktop layout.** Do NOT rewrite the desktop
flex shell, the pane-width derivation, the `mobileView` swap machinery, or any surface
body. The desktop manual rail toggle (localStorage `pulse.relay.railCollapsed`), the
auto-collapse at pane<900, the desktop split-pane sizing, and the shipped single-pane
collapse on Direct/Channels/Broadcast are all **working and must survive untouched.**
Before any removal/replace, STOP and present the Rule A pros/cons and get explicit
approval for THAT change.

### LIVE eyeball required

The headless Pixel-5 harness **cannot** load Direct contacts or the Channel workspace
(no contacts seeded / no workspace membership in the e2e auth session — confirmed by the
prior Path C state: "headless can't load Direct contacts/Channel workspace so those need
a live eyeball"). Inbox/Notes/Broadcast/shell-chrome are headless-verifiable; **Direct and
Channels must be verified on a real device or a logged-in browser at phone width.**

---

## 2. Current state (grounded, file-by-file)

### Shell — `src/components/Relay.tsx`
- L238 outer card: `h-full ... rounded-2xl overflow-hidden border ... shadow-xl` — desktop card chrome (inset, not full-bleed).
- L241 `<div ref={paneRef} className="h-full flex">` — the measured pane; a **horizontal flex that NEVER becomes a column** at any width.
- L243-250 `<SourcesRail ... hiddenViews={liveEnabled ? undefined : ['live']} />` — rail is the first flex child; Live entry hidden when flag off.
- L254 `<div className="flex-1 flex flex-col relative overflow-hidden">` — main pane; this `relative` is the FloatingMic's positioning parent.
- L267-353 the 6-surface `view ===` switch.
- L365 `{view !== 'live' && <StudioFooter suppressIdle={view !== 'triage'} />}` — footer is in normal flow; hidden in Live; pure-transport outside Inbox.
- L377-385 FloatingMic dual-role: Inbox `onClick={() => openComposer(null)} forceIdleIcon`; Direct/Channel/Broadcast/Notes `requireRecorder` (drives `studio.toggleRecording`).
- **Narrow handling: NONE at the shell level.** No viewport breakpoint, no bottom-bar/sheet rail variant.

### Context — `src/components/Relay/studio/RelayStudioContext.tsx`
- L139-142 constants `RAIL_AUTOCOLLAPSE_W=900`, `SINGLE_PANE_W=560`, `RAIL_W_EXPANDED=200`, `RAIL_W_COLLAPSED=64`.
- L432-436 the responsive derivation block (verified verbatim above) — **the single place to extend.**
- L448 `railCollapsed: effectiveRailCollapsed` — context exposes the EFFECTIVE (manual OR auto) value, not the raw pref.
- **Already handles narrow:** rail auto-collapse + `singlePane`/`bodyWidth` signals. **Doesn't:** no phone-grade derivation (no "rail as sheet/bottom-bar", no "full-bleed").

### Rail — `src/components/Relay/studio/SourcesRail.tsx` + `sources-rail.css`
- `.tsx` L95 reads `{ railCollapsed, railAutoCollapsed, toggleRail }`; L98-102 `<aside className="pulse-rail pulse-rail--collapsed|--expanded">`.
- L105 `{!railAutoCollapsed && (` — **collapse toggle is HIDDEN when the pane forces collapse**, so on mobile the user is locked into the 64px icon strip with `title=`-only labels (L133) — tooltips don't exist on touch.
- L160 smart-playlist rows render only `!railCollapsed && playlistCounts` — and `Relay.tsx` passes no `playlistCounts`, so doubly invisible on mobile.
- `sources-rail.css` L9 transitions width only; L11 `--expanded {width:200px}`, L12 `--collapsed {width:64px}`; **the ONLY @media is `prefers-reduced-motion` (L171)** — no viewport breakpoint, no mobile presentation.
- **Already handles narrow:** auto-collapse to 64px icons. **Doesn't:** never converts to off-canvas/sheet/bottom-bar; always eats ≥64px.

### Studio chrome
- **StudioMasthead** (`studio/StudioMasthead.tsx`): L57 `flex flex-wrap items-end justify-between gap-x-4 gap-y-2` — the **one** narrow affordance (right controls wrap below the title); L58 title is a **fixed `text-3xl` at all widths** (no clamp); L61 right slot `overflow-x-auto` fallback. No horizontal padding (consumer adds it).
- **StudioFooter** (`studio/StudioFooter.tsx` + `studio-footer.css`): L90 playing row is a **single non-wrapping flex** (play 44px + meta `__center` flex:1 min-width:0 + 4 actions all `flex-shrink:0`, css L121) at **fixed 24px side padding** (css L3); 120-bar waveform (`count={120}`, L127); L159-193 recording state = 60-bar wave + Cancel/Stop. `flex-shrink:0` in normal flow (NOT position:fixed). Scrub reads `getBoundingClientRect().width` (L83-87); playhead `left:${pct}%` (L131). **Only @media is `prefers-reduced-motion` (css L225).**
- **FloatingMic** (`studio/FloatingMic.tsx` + `floating-mic.css`): css L5-9 `position:absolute; bottom:88px; right:24px; z-index:20`; L10-11 fixed `56x56`; L33 `pulseRing` idle halo; **no env(safe-area), no narrow reposition, no `var(--pulse-bottom-bar)`.** L34 `requireRecorder && !hasRecorder → return null` (per-mode gating).
- **StudioCard** (`studio/StudioCard.tsx` + `studio-card.css`): `width:100%`, fluid — **safe on mobile, no change needed.**
- **StudioMessageCard** (`studio/StudioMessageCard.tsx`): the shared **flat voice-message row** primitive (header + transport + section-composed body) that wraps `StudioCard`; consumed by ClassicMode, TeamVoxMode, and VoxNotesMode (verified consumers + the barrel) for the rows in their scroll lists. Width-fluid (rides StudioCard's `width:100%`); `bodyIndent` is a fixed px (default 48, L118) and the header is a single non-wrapping flex (`flex items-center gap-3`, L152) with a `truncate` title (L157) and `ml-auto` meta (L168) — these are the rows that reflow inside each surface at phone width. No width-based logic of its own.
- **Waveform** (`studio/Waveform.tsx`): N flex `<i>` bars; 120 bars compress sub-pixel at phone width but don't overflow.
- **useRelayModeRecorder** (`studio/useRelayModeRecorder.ts`): the hook each mode uses to register its capture pipeline into the shell (start/stop/cancel + the `recording`-flag mirror that drives `hasRecorder`/`requireRecorder`/`studio.toggleRecording`). **This is the actual file behind the "preserve the FloatingMic dual-role record chain" warnings in §3/§5/risks — see §1.** No mobile concern of its own, but any reposition/hide of the mic must keep this registration intact.
- **Barrel** (`studio/index.ts`): the public surface re-exporting `RelayStudioProvider`/`useRelayStudio`, `useRelayModeRecorder`, `useElementWidth`, `Waveform`, `StudioCard`, `StudioMasthead`, `StudioMessageCard`, `SourcesRail`, `StudioFooter`, `FloatingMic`. Mode bodies + the shell import from here — touch it only if you add/rename a primitive.

### Surface bodies (which already collapse, with file:line)

1. **Direct / ClassicMode** — ✅ FULLY. Root gets `classic--single-pane` when `studio.singlePane` (`.tsx:1411`); `ClassicMode.css:721-729` makes `.classic-sidebar` a full-bleed absolute layer toggled by `.hidden-mobile`/`.visible`; `mobileView` state `'list'|'thread'` (L220); back button gated on `studio.singlePane` (L1536-1546); deep-link opens straight to `'thread'`. Plus secondary viewport @media (bubble 85% @768, padding @480, css L731-740). **Canonical reference implementation.**
2. **Channels / TeamVoxMode** — ✅ MOST SOPHISTICATED (3-column degradation, Tailwind+JS, no CSS file). `channelsInline = !singlePane && bodyWidth>=760`; `membersInline = !singlePane && bodyWidth>=1080` (L888-889). ≥1080 all inline; ≥760 members→header-reachable drawer (L1095-1105); <760 channels ALSO a left drawer (`animate-slide-in` + scrim, L967-990). Drawer closes on pick (L727-733).
3. **Broadcast / PulseRadio** — ✅ collapses, BUT has a **latent viewport trap**. Root `pulse-radio--single-pane` when `studio.singlePane` (`.tsx:579`); `.pane-visible`/`.pane-hidden` (css L76-80). **Trap:** base rule `.pulse-radio-sidebar { display:none }` shown only `@media (min-width:768px)` (css L61,66-68) — so when **viewport<768 but pane wide enough that `singlePane` is false**, the sidebar is `display:none` with no single-pane override → channels unreachable. Also `@media (max-width:640px)` hero stacking (css L939-945).
4. **Notes / VoxNotesMode** — ⚠️ DIFFERENT MODEL. Single-column timeline↔detail swap, but driven **purely by `selectedNote`** (L892, 897-899), **NOT** by `studio.singlePane` — so even on a WIDE pane it shows one pane at a time. Uses Tailwind `md:` viewport queries internally (L903). Reads **neither** `singlePane` nor `bodyWidth`. (Comment L889-891 "the timeline IS the surface, not a side list" suggests the one-pane-always shape may be **intentional** — confirm before treating as a gap; see §10.)
5. **Inbox / RelayTriageStream** — ⚠️ N/A by shape (no master-detail) but **non-responsive**. Single full-width card column. Fixed `px-7` padding on masthead (L786) and list (L873) — **never tightens**. Masthead `right` slot packs a status toggle + "All sources ▾" dropdown (L790-849) that crowds/wraps on a narrow pane. Reads neither signal.
6. **Live / VoiceRooms** (flag OFF) — ⚠️ PARTIAL. Reads `singlePane` for masthead padding (`px-4` vs `px-7`, L462) and sidecar hide (L827). Browse grid `repeat(auto-fill, minmax(260px,1fr))` reflows media-query-free (L533). BUT in-call grid uses **viewport** `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` (L662) — inconsistent with the pane model. Lower priority (flag-gated, "LOCAL PREVIEW" no peer transport).

### App.tsx mount (verified)
- `case AppView.RELAY: return <Relay .../>` (L1443-1444).
- `<main className="flex-1 overflow-hidden relative flex flex-col ... pb-[var(--pulse-bottom-bar)]">` (L1718).
- L1723: the overflow-hidden full-height branch is **only** `view === AppView.MESSAGES || CALENDAR || LIVE_AI`; **everything else (incl. RELAY) falls into `overflow-auto mobile-scroll p-2 sm:p-3 md:p-4 lg:p-6`** + wrapper `min-h-full max-w-[1600px] mx-auto` (L1724). So Relay is in the **padded/auto branch → inset, not full-bleed.** This branch line governs other views too — editing it is global, not Relay-local.

---

## 3. Gaps — what's wrong on `<640px` today

| # | Gap | Evidence |
|---|-----|----------|
| G1 | Rail eats ~64px (~18%) of a ~360px phone; never becomes off-canvas/bottom-bar | `Relay.tsx:241` flex never columns; `sources-rail.css:12` fixed 64px |
| G2 | Rail collapse toggle hidden on mobile → locked to icon strip; labels only in `title=` (no touch tooltips) | `SourcesRail.tsx:105, 133` |
| G3 | Smart playlists doubly invisible (force-collapsed + no `playlistCounts` passed) | `SourcesRail.tsx:160`; `Relay.tsx:248-249` |
| G4 | Relay inset (rounded card + padded branch), not full-bleed like Messages/Calendar | `Relay.tsx:238`; `App.tsx:1723` |
| G5 | FloatingMic ignores `--pulse-bottom-bar` (48px slim bar, z-40) — z-20 mic can sit under the bar; hardcoded `bottom:88px`, no safe-area | `floating-mic.css:5-9`; `index.css:16`; `MobileBottomNav` z-40 |
| G6 | FloatingMic idle halo overlaps the MobileBottomNav "+" quick-actions button in the same thumb corner | `floating-mic.css:5-9,33` vs slim-bar "+" |
| G7 | StudioFooter playing row never wraps/compacts; play+meta+4 actions+120 bars crowd at phone width | `studio-footer.css:3-11`; `StudioFooter.tsx:90,127` |
| G8 | StudioMasthead title fixed `text-3xl` at all widths (no clamp) | `StudioMasthead.tsx:58` |
| G9 | Inbox masthead filters + `px-7` padding non-responsive | `RelayTriageStream.tsx:786,790-849,873` |
| G10 | Notes never reads `singlePane`; uses `md:` viewport queries Relay otherwise avoids | `VoxNotesMode.tsx:892,903` |
| G11 | Broadcast viewport-trap: sidebar `display:none` <768px viewport even when pane is wide (`singlePane` false) | `PulseRadio.css:61,66-68` |
| G12 | No keyboard-occlusion handling; absolute FloatingMic + in-flow footer get pushed/overlapped when virtual keyboard opens (per-mode record inputs); `useVirtualKeyboard` exists but unused | `floating-mic.css` (no visualViewport); `utils/mobile.ts:390` |
| G13 | No env()/safe-area, no touch-action on scrubber, no overscroll-behavior anywhere in Relay CSS | grep: none present |
| G14 | Modals stay floating cards (max-w:420px) not full-screen sheets on phones | `ClassicMode.css:571-574`; `PulseRadio.css:519-523` |

---

## 4. Reusable primitives — "don't reinvent"

| Primitive | Path | Use for |
|-----------|------|---------|
| `useElementWidth` (ResizeObserver, 8px-stepped) | `src/components/Relay/studio/useElementWidth.ts` | **PREFERRED inside Relay** — extend the pane model, don't add viewport @media that disagrees with it |
| Responsive derivation block | `RelayStudioContext.tsx:432-436` | The single additive home for any new `railVariant`/`isMobilePane`/`fullBleed` signal |
| `useMediaQuery(query: string): boolean` | `src/hooks/useMediaQuery.ts:15` | TRUE-viewport decisions only (full-bleed card, "treat as phone"); SSR/first-paint-safe (synchronous matchMedia init, L18-22); doc: "read a boolean, pick between two STATIC class strings". Repo breakpoint convention is `(min-width: 768px)` |
| `--pulse-bottom-bar` token | `src/index.css:16-17` (`calc(48px + env(safe-area-inset-bottom,0px))`, 0 at md+) | **MANDATORY** for any new bottom-anchored Relay element. ~15 surfaces already use it (ClassicMode L2168, TeamVoxMode L1994, ContactsHybridPeople L678) |
| `MobileSheet` (a11y-complete sheet) | `src/components/MobileChrome/MobileSheet.tsx` | Rail-as-sheet on phones: focus trap, scroll-lock, Escape, `z-[9500]`, `md:hidden`, `animate-sheet-up`, `pb-[max(env(safe-area-inset-bottom),12px)]`. **Do NOT hand-roll** (and NOT `shared/MobileComponents.tsx` BottomSheet — stale/broken signatures; see risks) |
| Slim-bar pattern | `src/components/MobileBottomNav.tsx` (`md:hidden fixed bottom-0 z-40`, 48px, safe-area) | Reference for a Relay "sources" bottom-tab variant |
| Search Workbench collapse-to-single-column-with-absolute-overlay | `src/components/search/search-workbench.css:219-235` (`@media (max-width:767px)` → 1-col grid + side panes `position:absolute; inset:0; z-index:30`, `display:none` hidden) | Gold-standard ADDITIVE media block; zero desktop change |
| Contacts master/detail toggle | `src/components/contacts/hybrid/ContactsHybridPeople.tsx:122,565,616,618` | Model for list↔detail + `!isDesktop && selected` back button |
| Mobile utility hooks | `src/utils/mobile.ts` (`useVirtualKeyboard` L390, `useSafeAreaInsets` L458, `useDeviceType` L47, `hapticFeedback` L372) | Keyboard occlusion + safe-area + haptics |
| Focus trap / Android back | `src/hooks/useFocusTrap.ts:35`; `src/hooks/useAndroidBackButton.ts:12-16` (`interceptBack`) | Any Relay mobile overlay/sheet; close-sheet-on-back |
| `StudioMessageCard` (flat voice-message row) | `src/components/Relay/studio/StudioMessageCard.tsx` | The shared per-message row used by ClassicMode/TeamVoxMode/VoxNotesMode; width-fluid already. A mobile pass tightens `padding`/`bodyIndent` props at the call sites — do NOT fork the component |
| `useRelayModeRecorder` (per-mode recorder registration) | `src/components/Relay/studio/useRelayModeRecorder.ts` | **The load-bearing FloatingMic dual-role record chain.** Any mic reposition/hide MUST preserve each mode's `registerRecorder`/`notifyRecording` wiring — do not break `enabled`/`requireRecorder` gating |
| Studio barrel | `src/components/Relay/studio/index.ts` | Import studio primitives from here; only edit when adding/renaming a primitive |
| Existing single-pane convention | `.classic--single-pane` (`ClassicMode.css:721-729`), `.pulse-radio--single-pane`+`.pane-visible/.pane-hidden` (`PulseRadio.css:76-80`) | Mirror this shape for Inbox/Notes if they need it |
| Reachable-drawer pattern | `TeamVoxMode.tsx:967-990` (`absolute inset-0 z-40` slide-in + scrim, header-button toggled) | Keep a side column reachable rather than vanished |
| Canonical tokens | `src/styles/pulse-tokens.css` (rose family, surfaces, `--pulse-ease`, `.pulse-modal-scrim`, `html[data-large-touch-targets]` 48px) | All new CSS consumes `var(--pulse-*)` — no hex (CLAUDE.md §4) |
| Verify harness | `e2e/_verify-section.mjs` (Pixel 5 + saved auth + auto-dismiss trial paywall + overflow probe) | `SECTION=Relay node e2e/_verify-section.mjs` |
| Relay narrow spec | `e2e/relay-pathc-verify.spec.ts` (in-app resize NARROW tour; navigate by data-section ids not label text) | Extend, don't start fresh |
| Auth bootstrap | `e2e/auth.setup.ts:39-50` | **Delete `e2e/.auth/user.json` to force re-capture** (short-circuits if present) |

---

## 5. Phased plan (safest → riskiest)

> Each phase is additive and independently committable. Commit after each (CLAUDE.md §3).
> Coral/rose stays AI/active/live signal only — never chrome (CLAUDE.md §4).

### P0 — Foundation signal (no visual change)
- **Goal:** add the derived booleans the later phases consume, without changing any layout yet.
- **Files:** `RelayStudioContext.tsx` (extend L432-436 block + the `useMemo` value + the `RelayStudioApi` type) ONLY.
- **Additive approach:** add `const isMobilePane = bodyWidth > 0 && bodyWidth < <THRESHOLD>` (recommend reuse `SINGLE_PANE_W` semantics or a new `MOBILE_PANE_W`; see §7) and `const railAsSheet = isMobilePane` alongside the existing derivations. Expose them in the context value. **Do not consume them anywhere yet.** Optionally also expose a viewport `isPhoneViewport = useMediaQuery('(max-width: 767px)')` for the few decisions that are genuinely viewport-scoped (full-bleed card).
- **Risk:** very low — pure additive context fields. Existing consumers unaffected.
- **Verify:** `npx tsc --noEmit` (gate on no NEW errors — repo has ~1234 pre-existing); app still renders identically.

### P1 — Inbox responsiveness (headless-safe, no master/detail)
- **Goal:** make the simplest surface phone-clean first.
- **Files:** `RelayTriageStream.tsx`.
- **Additive approach:** replace fixed `px-7` (L786, L873) with `px-4 sm:px-7` (Tailwind static, desktop-identical at ≥sm); inside StudioMasthead `right` slot, lean on the existing `flex-wrap` and add label-hiding (`hidden sm:inline`) to the source-dropdown text if it crowds. Do NOT touch the statusFilter/sourceFilter handlers or the j/k/Enter/o/r/e keyboard nav.
- **Risk:** low — Tailwind static-class padding; no logic touched.
- **Verify:** `SECTION=Relay node e2e/_verify-section.mjs` lands on Inbox; overflow probe = 0; visual at 360px.

### P2 — StudioMasthead title clamp (shared, all surfaces inherit)
- **Goal:** stop the fixed `text-3xl` from crowding narrow panes.
- **Files:** `StudioMasthead.tsx:58`.
- **Additive approach:** `text-2xl sm:text-3xl` (static classes). Keep the eyebrow + `flex-wrap` row intact.
- **Risk:** low — one shared className; verify each surface masthead still reads right at desktop.
- **Verify:** visual sweep of Inbox/Notes/Broadcast mastheads at 360px and ≥768px.

### P3 — FloatingMic + StudioFooter clear the global slim bar + safe area
- **Goal:** stop the mic/footer colliding with `MobileBottomNav` and the home indicator.
- **Files:** `floating-mic.css`, `studio-footer.css` (scoped `@media (max-width:767px)` blocks only).
- **Additive approach:** in a phone media block, layer `bottom: calc(88px + var(--pulse-bottom-bar))` on `.pulse-floating-mic` (token is 0 at md+, so the desktop `bottom:88px` is untouched); add `padding-bottom: max(12px, env(safe-area-inset-bottom))` to the footer. Consider shrinking the mic to 48px on phones and nudging it off the slim-bar "+" thumb zone (G6) — but mic restyle is **load-bearing** (dual-role; the record chain it triggers is `useRelayModeRecorder.ts`), so keep position/size changes additive and behind the phone media block. Do NOT change the mic's role wiring in `Relay.tsx:377-385`.
- **⚠️ Per-STATE, not per-width, coupling:** the `88px` offset is calibrated against the footer's height, but the footer has **two different heights**: playing/base padding `12px 24px` + 1px top border (`studio-footer.css:6`) vs **recording** padding `16px 24px` + a `2px` top border (`studio-footer.css:154-155`). The recording state is the taller one — and it's the very mode where the mic AND the footer are both active. A single static `88px` (or `calc(88px + …)`) offset tuned to the playing footer can still let the mic overlap the recording footer's Cancel/Stop controls. Either bump the offset specifically while `--recording` is active (e.g. a `body:has(.pulse-studio-footer--recording) .pulse-floating-mic` raise, or a JS class off `studio.isRecording`) or add enough headroom to clear the tallest (recording) state. Treat this as a per-state coupling, not just a per-width one.
- **Risk:** medium — the mic is the only record affordance in Direct/Channel/Broadcast/Notes; footer is the canonical transport. Touch both together (offset is coupled to footer height, which varies by recording-vs-playing STATE). Verify recording still starts in each wired mode.
- **Verify:** live device — open keyboard in a per-mode record block, confirm mic/footer stay reachable and clear the slim bar; record+play in each mode.

### P4 — Broadcast viewport-trap fix (per-surface, surgical)
- **Goal:** close G11 without regressing the desktop two-column layout.
- **Files:** `PulseRadio.css:61-68` (replace, not delete).
- **Additive approach:** the base `.pulse-radio-sidebar { display:none }` + `@media(min-width:768px){display:flex}` must be **replaced by a pane-driven rule in the same change** — make the sidebar visible by default within the wide (`!singlePane`) layout and hidden via `.pane-hidden` under `--single-pane`, matching how the other surfaces already work. This is a Rule A removal/replace of a working (if buggy) rule → **present pros/cons + get approval before executing.**
- **Risk:** medium-high — interacts with both the wide side-by-side and the singlePane full-bleed states. Visual diff both.
- **Verify:** live — Broadcast at wide pane (two columns), at narrow viewport/wide pane (sidebar reachable), at phone (full-bleed swap).

### P5 — Rail → off-canvas/bottom variant on phones (the big shell change)
- **Goal:** reclaim the 64px the rail steals; give a thumb-reachable source switcher.
- **Files:** `RelayStudioContext.tsx` (consume P0's `railAsSheet`), `SourcesRail.tsx`, `sources-rail.css` (scoped `@media (max-width:767px)` block), `Relay.tsx` (mount a trigger when `railAsSheet`).
- **Additive approach (two options — DECISION needed, see §10):**
  - **(a) Bottom-tab bar:** render the 6 sources as a horizontal bar at the bottom of the pane on phones, offset by `var(--pulse-bottom-bar)`, preserving `role="tab"`/`aria-selected` and the T/D/C/B/N/L keyboard mapping. Mirrors the app-wide slim-bar paradigm.
  - **(b) Sources sheet:** keep a single launcher button; open `MobileSheet` listing the 6 sources. Less screen budget, fully a11y via the existing sheet.
  - Either way: **replicate `hiddenViews` filtering** so Live can't leak onto the mobile switcher while flag-gated; keep `toggleRail`/`pulse.relay.railCollapsed` desktop path untouched; scope ALL new CSS to `.pulse-rail` under the phone media block so the desktop 200/64 width transition (`sources-rail.css:9-12`) is unaffected.
- **Risk:** HIGH — high blast radius (changes every surface's available width; touches shell + context + rail). Strictly additive; the desktop rail must render byte-identically.
- **Verify:** headless overflow probe + live; confirm all 6 (5 live) sources reachable, keyboard shortcuts still switch, Live absent.

### P6 — Per-surface single-pane gap closure (the bulk)
- **Goal:** bring the surfaces that don't fully collapse up to the Direct/Channels standard.
- **Files:** `RelayTriageStream.tsx` (already mostly P1), `VoxNotesMode.tsx` (+ possibly `singlePane` adoption — pending §10 decision), `VoiceRooms.tsx` (low priority, flag OFF).
- **Additive approach:** for Notes, IF the user confirms side-by-side-on-desktop is wanted, layer `studio.singlePane` onto the existing `selectedNote` swap (don't replace it). For VoiceRooms in-call grid (L662), swap viewport `md:/lg:` for the auto-fill reflow already used in browse (L533) to match the pane model. Reuse the `.classic--single-pane`/`mobileView` shape verbatim.
- **Risk:** medium — Notes shape may be intentional (don't "fix" a deliberate decision); VoiceRooms is flag-gated (defer if time-boxed).
- **Verify:** live for Notes; flag-on local for VoiceRooms.

### P7 — Polish: touch-action, overscroll, modals-as-sheets (optional)
- **Goal:** native-feel hardening.
- **Files:** `studio-footer.css` (scrubber `touch-action: pan-y`/`none`), the independently-scrolling panes (`overscroll-behavior: contain`), `ClassicMode.css`/`PulseRadio.css` modals (full-screen sheet gated behind `singlePane`).
- **Additive approach:** scoped phone media blocks; modal sheet behavior gated so desktop card layout is preserved.
- **Risk:** low-medium — keep scrub geometry (`getBoundingClientRect` math) intact when restyling the wave wrap.
- **Verify:** live drag-to-seek doesn't fight page scroll; modals readable on phone.

---

## 6. Per-surface disposition matrix

| Surface | Already single-pane? | Mobile treatment in this pass | Effort | Risk |
|---------|----------------------|-------------------------------|--------|------|
| **Inbox** (RelayTriageStream) | N/A (no master/detail) | P1: responsive padding + masthead filter wrap (P2 title clamp inherited) | S | Low |
| **Direct** (ClassicMode) | ✅ Yes (`classic--single-pane`, mobileView) | None structural — inherits P2/P3; **verify live only** (headless can't load contacts) | XS (verify) | Low |
| **Channels** (TeamVoxMode) | ✅ Yes (3-col degradation, drawers) | None structural — inherits P2/P3; **verify live only** (headless can't load workspace) | XS (verify) | Low |
| **Broadcast** (PulseRadio) | ✅ Yes, but viewport-trap | P4: replace viewport sidebar rule with pane-driven (Rule A approval) | M | Med-High |
| **Notes** (VoxNotesMode) | ⚠️ No (`selectedNote`-driven, not `singlePane`) | P6: confirm intent first (§10); if gap, layer `singlePane` onto existing swap | M | Med |
| **Live** (VoiceRooms) | ⚠️ Partial (reads `singlePane`; in-call grid viewport) | P6 (low prio): align in-call grid to pane model; flag OFF so no live payoff | S | Low |
| **Shell/Rail** | rail auto-collapse only (never off-canvas) | P5: bottom-bar OR sheet variant (DECISION) | L | High |

---

## 7. Breakpoint strategy

**Recommendation: keep Relay PANE-driven; add exactly ONE new phone threshold; use viewport `useMediaQuery` only for the 1-2 truly viewport-scoped decisions.**

- **Authoritative (pane, in `RelayStudioContext.tsx`):** `RAIL_AUTOCOLLAPSE_W = 900`, `SINGLE_PANE_W = 560`. Add **one** phone constant, e.g. `MOBILE_PANE_W` — recommend `≈480` for `bodyWidth` (or simply reuse `singlePane`/`bodyWidth<560` if the "phone" and "single-pane" cases coincide in practice; prefer fewer constants). Editing the existing 900/560 silently shifts ALL six surfaces — **add, don't edit.**
- **Viewport (CSS @media / `useMediaQuery`):** use the repo convention **`(min-width: 768px)` / `(max-width: 767px)`** — matches `useMediaQuery` doc example (L13), Contacts (`ContactsHybridPeople:122`), SearchWorkbench (`:39`), Search Workbench CSS (`:219`), and `--pulse-bottom-bar` md+ zero (`index.css:17`). Use viewport ONLY for: full-bleed card decision (P5/G4) and the slim-bar offset (already token-driven).

**Inconsistencies to be aware of (do NOT mass-normalize — additive, per-file, with visual diffs):**
- ClassicMode.css uses **768 & 480** (cosmetic: bubble width, padding).
- PulseRadio.css uses **768 (min) & 640** — and the 768 one is the genuine bug (P4).
- Relay.css uses **768 & 480** targeting **mostly-DEAD `.vox-*` rules** (per its own L128-135 comment); leave it.
- `Relay.css` carries a SECOND `--vox-*` :root token block and ~900 LOC mostly-dead, still imported by 6 live components — **do not "clean up."**

Net: pane thresholds remain the source of truth; the new phone signal is pane-derived; viewport `768/767` is the only viewport number you add, matching everything else.

---

## 8. Flag / rollout

**Recommendation: ship responsive directly (NO feature flag), phase-gated by commit.**

Rationale:
- The prior "mobile responsive sections" and "mobile chrome slim bar" passes shipped responsive **un-flagged** (per MEMORY: both DONE+pushed without a flag) — responsive layering is desktop-safe by construction (`md:hidden` / `max-width` media blocks / `var(--pulse-bottom-bar)`→0 at md+), so there's no desktop blast radius to gate.
- A flag adds a dead branch on a surface that's already container-query forked; the per-phase commit cadence + `git revert <sha>` is the rollback unit (CLAUDE.md §default-workflow).
- **Exception:** the P5 rail-shell change is the one structurally risky item. If the user wants a safety valve, gate **only P5** behind a flag. The FeatureContext pattern is `isFeatureEnabled('<flag>')` (already used in `Relay.tsx:144` for `relayLiveRooms`); a new `relayMobileRail` flag (default OFF) would let P5 land dark and flip after a live eyeball. P0-P4, P6-P7 ship un-flagged.

---

## 9. Verification plan

### Headless Playwright (CAN cover)
- `SECTION=Relay node e2e/_verify-section.mjs` — Pixel 5, saved auth, auto-dismisses trial paywall, reports the widest horizontal-overflow offender. Covers: shell mount, Inbox, Notes, Broadcast, rail/chrome at 360px. Target `http://localhost:5174` (or set `TARGET`).
- Extend the NARROW tour in `e2e/relay-pathc-verify.spec.ts` (in-app resize, no reload). **Navigate by `data-section` ids, NOT visible text** — labels leave the DOM when the rail collapses (spec L118-120). The spec's L130-134 already documents the exact md:-vs-pane clip failure this pass fixes — assert it's gone.
- **Token-refresh gotcha (will burn a cycle if missed):** the e2e session's `refresh_token` ROTATES and **server-side refresh fails** for this harness (per the prior Path C state + MEMORY `reference_pulse_e2e_token_export`/`reference_pulse_e2e_auth_refresh`), so you cannot just let Playwright silently refresh a stale token. The token is ~1hr. To re-capture: **delete `e2e/.auth/user.json` first** (`auth.setup.ts:39-50` short-circuits if the file exists), then EITHER re-run `auth.setup.ts` (Google OAuth, no headless login) OR use the repo's **token-export / Blob-download** path — paste the DevTools `localStorage`-export snippet (note: `copy()` fails silently, so it Blob-downloads `user.json` into `Downloads`, a Claude working dir, and is moved into `e2e/.auth/`). Don't assume a "valid-looking" file is fresh — if Direct/Channels won't load, suspect the token before the code.
- `npx tsc --noEmit` after each phase — gate on **no NEW** type errors (repo has ~1234 pre-existing; use `NODE_OPTIONS=--max-old-space-size=8192` to avoid the OOM false-clean).

### Live device / browser (REQUIRED — headless gaps)
- **Direct (ClassicMode):** headless can't load contacts → verify list↔thread swap, back button, deep-link-to-thread, record+play **live**.
- **Channels (TeamVoxMode):** headless can't load workspace → verify channels/members drawers (<760 / ≥760 / ≥1080), record **live**.
- **All surfaces:** at 360px (small phone), 390px (iPhone), 768px (tablet boundary), and desktop — confirm desktop is byte-identical to pre-pass.
- **Chrome collisions:** FloatingMic clears the slim bar + safe-area; mic doesn't sit on the "+" button; footer clears the home indicator.
- **Keyboard:** focus a per-mode record input, open the virtual keyboard, confirm mic/footer reachable (P3/P12).
- **Capacitor Android:** this is a real AAB app (`capacitor.config.ts` appId `io.qntmpulse.app`) — test on a device/emulator for safe-area + hardware-back (sheet should consume back before view nav).
- **Touch targets:** 48×48 minimum (slim-bar convention); drag-to-seek scrubber works on touch.

---

## 10. Open questions / decisions for the user (resolve before P5/P6)

1. **Rail variant for P5 — bottom-tab bar (a) vs sources sheet (b)?** (a) mirrors the app-wide slim bar and keeps sources one-tap, but adds a second bottom bar above the global `MobileBottomNav`; (b) reuses `MobileSheet` and saves screen budget but costs a tap. **Needs a call before P5.**
2. **Notes (VoxNotesMode): is one-pane-at-a-time-even-on-desktop intentional?** The L889-891 comment ("the timeline IS the surface, not a side list") suggests yes. If intentional, P6 for Notes is a no-op (just confirm it collapses fine on phone via its `selectedNote` swap). If a gap, we layer `singlePane`. **Confirm before treating as a gap (Rule B).**
3. **Full-bleed Relay on phones (G4/P-optional)?** Going edge-to-edge means changing the `App.tsx:1723` branch condition (a GLOBAL line governing other views' padding) and/or stripping the `Relay.tsx:238` card chrome on phones. Worth it, or accept the inset card on mobile? **This edit is global, not Relay-local — needs explicit approval (Rule A).**
4. **Flag P5 or not?** Default recommendation is un-flagged; confirm whether the rail-shell change should land behind `relayMobileRail` (default OFF) for a dark-launch safety valve.
5. **Broadcast P4 is a Rule A replace** of the working-but-buggy viewport sidebar rule — confirm the pros/cons and approve the specific rule swap before execution.

---

## Provenance

Generated 2026-06-15 from a 5-area investigation (Relay shell + SourcesRail; studio chrome;
the 6 surface bodies; existing Pulse mobile/responsive conventions; CSS/breakpoints/tokens).
All cited file:line refs were spot-verified against the working tree before writing
(`Relay.tsx:238-385`, `RelayStudioContext.tsx:432-436`, `sources-rail.css:1-12`,
`useElementWidth.ts:7-11`, `useMediaQuery.ts:15`, `index.css:16-17`, `App.tsx:1718-1727`,
`useRelayModeRecorder.ts:35-62`, `StudioMessageCard.tsx:101-241`, `studio/index.ts`,
`studio-footer.css:6,154-155`, `floating-mic.css:5-9`, harness/primitive paths).

**Revision 2026-06-15 (critique pass):** added the previously-omitted `useRelayModeRecorder.ts`
(the load-bearing FloatingMic dual-role record chain — §1, §2, §4), `StudioMessageCard.tsx`
(the flat per-message row primitive that reflows in each surface — §2, §4), and the studio
`index.ts` barrel (§2, §4); corrected the `useElementWidth` docstring citation from `:9-12`
to `:7-11` (the quoted text is verbatim-correct; only the range drifted); added the per-STATE
(not per-width) footer-height coupling caveat to P3 (recording footer is taller: `16px 24px`
+ 2px border vs playing `12px 24px` + 1px); and documented the rotating-`refresh_token` /
failed-server-side-refresh e2e gotcha + the token-export/Blob-download re-capture path in §9.
A stale source comment in `useMediaQuery.ts:11` ("returns `false` until the effect runs")
contradicts the actual synchronous init at L16-22 — this doc deliberately describes the CODE
(synchronous, first-paint-safe), so trust the doc over that source comment.
