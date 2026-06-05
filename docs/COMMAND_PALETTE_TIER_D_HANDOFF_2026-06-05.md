# Command Palette — Tier D Handoff

**Date:** 2026-06-05
**Status:** Tiers A + B + C shipped to `main`; Tier D deferred (this doc).
**Author context:** Follows the echo usability walkthrough + adversarial recon of the
global Command Palette. Tiers A–C are live; this handoff specifies the three
remaining "create/act" verbs that were deliberately **not** bundled because each
needs new intent plumbing and/or carries a real landmine.

> Ground-truth discipline (CLAUDE.md): every line/anchor below was verified by the
> recon pass, but absolute line numbers predate the A–C edits to `App.tsx` and have
> since shifted by ~140 lines. **Grep the named anchors, don't trust the numbers.**
> Re-read each file before editing. Dry-run `tsc` gating on *no new* errors.

---

## 0. What already shipped (so you don't redo it)

| Commit | Tier | Summary |
|--------|------|---------|
| `6397613` | A1 | `isLiveShortcut()` gate — chips render only if the runner can fire them |
| `9815ea2` | A2 | "Schedule Meet" routes to `AppView.MEETINGS` (was `CALENDAR`) — **Meetings Part (b) is DONE** |
| `18c9622` | A3 | 6 Settings deep-link commands (clone of `help-billing`) |
| `3981fc7` | B | Global `app:create` scope — **New task** / **New contact** |
| `028fefc` | C | `contacts:people` provider — **Open `<name>`** (card) + **Message `<name>`** (conversation) |

**Architecture you can lean on (all live):**

- **Registry:** sections/`AppCommandRegistrar` call `useRegisterCommands(scope, { commands?, provider? })`
  (`src/contexts/CommandPaletteContext.tsx:308`). `getMatches` de-dupes by `id`,
  keeping **first-seen** (`:213-218`) — the inline comment at `:211` ("later wins")
  is wrong; trust the code. Unique ids ⇒ no collision.
- **`AppCommandRegistrar`** (grep `const AppCommandRegistrar`) is always-mounted inside
  `CommandPaletteProvider`. It now takes props `onNewTask`, `onNewContact`, `contacts`,
  `onOpenContact`, `onMessageContact` — **add new intent handlers here the same way**
  (widen the props interface, destructure, pass a stable `useCallback` from `App`).
- **Intent bridges already in use:**
  - `openTaskPanel` / `openAddContact` — boolean state in `App` + 100ms reset, consumed by
    Calendar/Contacts on mount (the proven Dashboard/AI-handler pattern).
  - `selectedContactId` → passed as `initialContactId` into Relay/Messages/Meetings
    (grep `initialContactId={selectedContactId}`). **This is how "Message `<name>`" works
    and is the reuse hook for Relay/Meetings below.**
  - **Event + sessionStorage handoff** (added in C): `pulse:contacts:open-contact` (live) +
    `pulse_focus_contact` sessionStorage (cold), both cleared on consume. **Reuse this
    exact two-path shape for compose (see D1).**

**sessionStorage keys already in play — do not collide:** `pulse_focus_contact` (C),
`pulse_focus_note` (palette NOTES → Archives), `pulse_pending_compose` (proposed in D1).

---

## D1 — Compose email  ⚠️ LANDMINE, do this as its own change

**Classification:** `risk`. A naive `dispatch('pulse:compose-email') + setView(EMAIL)` does
**not** reliably open a composer. Three proven failure modes:

1. **Gated off.** `features.emailEnabled` defaults **false** (`FeatureContext.tsx:94`;
   merge `:104-115`). `EmailClientWrapper` renders the "Email is turned off" placeholder
   (`EmailClientWrapper.tsx:53-66`); `EmailHybridClient` never mounts; the listener never
   registers; the event is dropped.
2. **Gmail not connected.** Even with email on, `getGmailConnectStatus()` → `disconnected`
   renders the Connect-Gmail screen (`EmailClientWrapper.tsx:79-119`); again no mount.
3. **Mount-after-event race.** Happy path: the route is lazy-loaded (`App.tsx` lazy import)
   and the grant probe is async (`EmailClientWrapper.tsx:45-48`, starts `'checking'`). The
   live listener (`EmailHybridClient.tsx:~244`) registers only after that resolves. A
   synchronous `run()` that dispatches **then** `setView` in the same tick fires the
   `CustomEvent` before the listener exists — CustomEvents are not buffered, so the intent
   is silently lost.

### The stale-key bug to avoid

The "obvious" fix (always write `sessionStorage` + drain on mount) **leaves a stale key on
the warm path**: if you're already on Email, the live listener opens the composer but the
mount-drain doesn't run, so the key lingers and pops a **blank composer on the next Email
remount.** (This is the same class of bug C's bridge avoids by clearing the key on *both*
paths.)

### Minimal additive fix (additive + reversible)

**STEP 1 — palette `run()`** writes a pending intent **and** dispatches the live event,
mirroring C's two-path bridge. Mirror the assistant payload shape (`recipient/subject/body`,
`ComposeEventDetail` at `EmailHybridClient.tsx:48-52`):

```ts
run: () => {
  try {
    sessionStorage.setItem('pulse_pending_compose', JSON.stringify({ recipient: '', subject: '', body: '' }));
  } catch {}
  window.dispatchEvent(new CustomEvent('pulse:compose-email', { detail: { recipient: '', subject: '', body: '' } })); // warm path
  setView(AppView.EMAIL); // cold path covered by Step 2
}
```

**STEP 2 — new `useEffect` in `EmailHybridClient`** that drains the pending intent on mount,
mirroring the existing `pulse_focus_nudge` sessionStorage idiom already in that file
(`EmailHybridClient.tsx:218-231`). Insert **immediately after** the existing
`pulse:compose-email` listener effect (~`:246`):

```ts
// pulse:compose-email — cold-start drain (covers the mount-after-event race)
useEffect(() => {
  if (typeof window === 'undefined') return;
  const raw = sessionStorage.getItem('pulse_pending_compose');
  if (!raw) return;
  sessionStorage.removeItem('pulse_pending_compose');
  try {
    const d = JSON.parse(raw) as ComposeEventDetail;
    restoreComposer({ to: d.recipient ? [d.recipient] : [], subject: d.subject || '', body: d.body || '' });
  } catch {}
}, [restoreComposer]);
```

`restoreComposer` is the existing store action (`emailComposeStore.ts:101-111`). The live
listener (`:233-246`) is untouched and still owns the warm path. **Also add
`sessionStorage.removeItem('pulse_pending_compose')` inside the live listener** so the warm
path clears the key too (defends against the stale-key bug above).

**STEP 3 — register the command CONDITIONALLY on `emailEnabled`** so it never appears as a
dead/navigate-in-disguise command when email is off:

- `emailEnabled` lives in `FeatureContext` via `useFeatures()` — **not** `useFeatureFlag`.
  `AppCommandRegistrar` currently imports only `useFeatureFlag`; add
  `import { useFeatures } from './contexts/FeatureContext'` + `const { features } = useFeatures()`
  (the registrar sits inside `FeatureProvider`, so the hook is valid — same place the
  existing `smsEnabled` gate works).
- Register an `app:email` scope whose commands array is `features.emailEnabled ? [composeCmd] : []`
  (mirror the SMS-nav `smsEnabled` filter).

### Open product decisions (DO NOT auto-resolve)

- **Gmail-disconnected case:** Steps 1–2 fix the race, not gating. If `emailEnabled` is on
  but Gmail is disconnected, the command lands the user on the Connect-Gmail screen
  (navigate-in-disguise). Decide: gate registration on Gmail-connected too, or accept the
  connect-screen landing as reasonable.
- **Prefill:** ship a truly empty composer, or prefill a selected contact's email? The bridge
  supports prefill via the same payload (and a `Compose <name>` per-person command could be
  added to the `contacts:people` provider, reusing the contact's `email`).
- **cc/bcc:** `ComposeEventDetail` has no cc/bcc; prefilling those needs an additive extension
  to the event shape + `emailComposeStore`.

**Effort:** M. **Touches:** `App`/`AppCommandRegistrar` (register + `useFeatures`),
`EmailHybridClient.tsx` (drain effect + live-listener removeItem). All additive.

---

## D2 — New voice message (Relay)  — needs-plumbing, no free reuse

The palette can only navigate to Relay; the recorder is **in-pane only**
(`studio.toggleRecording` / SPACE / `FloatingMic`). Relay registers **zero** palette
commands and has **no** start-recording prop.

### Plumbing (additive)

1. **`App` intent + handler.** Add a `relayStartRecording` boolean (or reuse a transient
   intent like `openTaskPanel`'s pattern), a stable `handleNewVox` `useCallback`, and pass it
   to `AppCommandRegistrar` (same widening pattern as `onNewTask`).
2. **Relay prop.** Widen `RelayProps` (grep `interface RelayProps`, ~`Relay.tsx:82-86`) with
   `startRecording?: boolean`, and add an effect that arms the recorder when it's true.
   ⚠️ **Unverified:** the recorder entry point is `useRelayModeRecorder` (per project memory) —
   **read it first** to find the exact "begin recording" call; the recon did not open it.
3. **Command.** Register `app:relay` `{ id: 'create-vox', label: 'New voice message',
   kind: 'action', icon: 'fa-microphone', run: handleNewVox }` where `handleNewVox` sets the
   intent + `setView(AppView.RELAY)`.

**Open question:** which Relay mode should arm — Messages/Notes/Live? Confirm the default
target (likely a quick voice message = Messages mode) before wiring.

**Effort:** M. **Touches:** `App`, `Relay.tsx` (+ verify `useRelayModeRecorder`). Additive,
but the recorder call is unverified — treat as its own investigation+change.

---

## D3 — "Start a meeting" action  — needs-plumbing (Part b mis-route already shipped in A2)

`startMeeting()` / `createAndJoinPulseRoom()` are component-local closures
(`Meetings.tsx:~260`, `~237`); Meetings registers no palette commands and has no start prop.

### Split verdict (use the free reuse where it exists)

- **"Meet WITH `<contact>`" = FREE.** `handleContactAction('meet', id)` (grep
  `const handleContactAction`) sets `selectedContactId` + `setView(MEETINGS)`, and
  `initialContactId` auto-starts via `createAndJoinPulseRoom` (`Meetings.tsx:~161`). You could
  add a **"Meet `<name>`"** command to the existing `contacts:people` provider for ~free,
  reusing `onMessageContact`'s sibling pattern (add an `onMeetContact` handler).
- **"Start a NEW blank meeting" = needs-plumbing.** No prop trigger exists. Additive wiring:

```ts
// 1) App: intent state near selectedContactId
const [meetingIntent, setMeetingIntent] = useState<'startPulse' | null>(null);

// 2) App: pass into the AppView.MEETINGS render arm + clear on consume
<Meetings ... startIntent={meetingIntent} onIntentConsumed={() => setMeetingIntent(null)} />

// 3) Meetings.tsx: widen MeetingsProps (~:47-53) ADDITIVELY
startIntent?: 'startPulse' | null;
onIntentConsumed?: () => void;

// 4) Meetings.tsx: one effect alongside the existing intent effects (~after :176)
useEffect(() => {
  if (startIntent === 'startPulse') {
    createAndJoinPulseRoom('Instant Pulse Meeting'); // reuses the proven path
    onIntentConsumed?.();
  }
}, [startIntent]); // deps intentionally narrow — matches house style of the other intent effects

// 5) Register via a new app:meetings scope (NOT Dashboard — its setView options type
//    is only { openTaskPanel, openAddContact }). Pass a stable onStartMeeting handler to
//    AppCommandRegistrar that does setMeetingIntent('startPulse') + setView(MEETINGS).
{ id: 'start-pulse-meeting', label: 'Start a meeting', desc: 'Open Pulse Meetings and start an instant room',
  kind: 'action', icon: 'fa-video', run: onStartMeeting }
```

**Risks / decisions:**

- `createAndJoinPulseRoom` makes a real edge call and can throw `EdgeCallError` (handled at
  `Meetings.tsx:~246-257`) — a global "Start a meeting" can land on the active view with an
  error banner if the call fails. Acceptable, worth noting.
- The new `start-pulse-meeting` id coexists with the existing navigate `action-meeting`
  ("Schedule Meet") — intentional (start-instant vs navigate). Confirm you want both rows.
- **Product call:** does "start a meeting" mean *instant room* (the plan above) or merely
  *navigate to the Meetings landing*? If navigate-only, it's a one-liner
  (`run: () => setView(AppView.MEETINGS)`) with zero new props — but A2 already makes
  "Schedule Meet" do exactly that, so a distinct command only earns its place if it
  instant-starts.

**Effort:** M (instant-start) / S (the free "Meet `<name>`" provider addition). **Touches:**
`App`, `Meetings.tsx`, optionally `contacts:people` provider. Ship the instant-start pieces
as one unit (partial application degrades to harmless no-ops).

---

## Recommended sequence & guardrails

1. **D3 "Meet `<name>`"** (S, free reuse via `contacts:people`) — fastest win.
2. **D1 Compose email** (M) — highest user value, but **its own commit**; get the two product
   decisions answered first. Verify the warm/cold paths manually (headless can't load Gmail).
3. **D3 instant-start meeting** (M) — if product wants instant-room semantics.
4. **D2 New vox** (M) — last; verify `useRelayModeRecorder` before wiring.

**Per CLAUDE.md:** present a Rule A pros/cons before executing each; commit each unit
separately on `main`; `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` gating on
**no new** errors (repo carries ~900 pre-existing); never `--no-verify` (gitleaks). The
contacts/email/meeting open paths can't be verified headless — flag each for a live eyeball.
