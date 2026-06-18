# Breakout Rooms — Real-Build Handoff

**Date:** 2026-06-18
**Feature:** Meetings → Breakout Rooms (wire the existing UI to real Daily.co sub-rooms)
**Decision provenance:** Operator chose **"Build it for real (Daily)"** on 2026-06-18,
over keep-as-is / flag / remove. Context: the audit for #104 verified Breakout Rooms
is currently a *fully-built, provably-unreachable no-op* (see [Current state](#1-current-state--verified-ground-truth)).
This is **not a v1 launch blocker** — it is honest-disabled today — so this build can
land incrementally behind a flag and graduate when complete.
**Status:** NOT STARTED. This doc is the plan. No breakout code has been written.

---

## 0. TL;DR for the next session

- Daily integration is the **call-object / custom-UI** model (`@daily-co/daily-react`),
  **not** Daily Prebuilt — so there is **no native breakout-rooms toolbar**. Real
  breakouts = **create N ephemeral Daily sub-rooms + move each participant by
  having their client `leave()` the main room and `join()` the assigned sub-room**,
  orchestrated by the host over Daily **app-messages**.
- **The backend is already done and reusable.** `createPulseRoom()` and
  `getMeetingToken()` ([pulseVideoService.ts:120,128](../src/services/pulseVideoService.ts#L120))
  wrap the auth-gated `daily-rooms` edge function. Creating a breakout room and
  minting tokens needs **zero new backend**.
- **The signaling primitive already exists.** `daily.sendAppMessage(...)` +
  `useDailyEvent('app-message', ...)` are already wired for chat
  ([PulseVideoRoom.tsx:562,475](../src/components/Meetings/PulseVideoRoom.tsx#L475)).
  Breakouts add new message `type`s on the same channel.
- **The single biggest lift is structural, not Daily:** today's `BreakoutRoomsModal`
  lives in the **Meetings dashboard** (`Meetings.tsx`, *outside* `DailyProvider`) and
  is handed a `Contact[]` *invite list* — it has **no call object and no live
  participants**. A real feature must run **inside the live call**
  (`MeetingRoom`, *inside* `DailyProvider`) where `useParticipantIds()` and
  `useDaily()` exist. Plan accordingly.
- Preserve the existing 3-panel assignment UI (it's good) — **wire its buttons**,
  don't rebuild it. Rule A: additive over subtractive.

---

## 1. Current state — verified ground truth

Every line below was read on 2026-06-18.

### 1a. What exists (the UI — complete, polished, inert)

- **`BreakoutRoomsModal`** — [MeetingsComponents.tsx:1719](../src/components/Meetings/MeetingsComponents.tsx#L1719).
  A 3-panel modal: **Unassigned** (participant chips) · **Rooms** (room cards,
  rename, add room, assign/unassign) · **Controls** (duration picker, timer
  display, Start/End, Broadcast, Recall). Uses local state only.
  - `BreakoutRoom` interface — [MeetingsComponents.tsx:603](../src/components/Meetings/MeetingsComponents.tsx#L603):
    `{ id, name, participants: Contact[], color }`.
  - `BREAKOUT_COLORS` — [MeetingsComponents.tsx:611](../src/components/Meetings/MeetingsComponents.tsx#L611).
- **Every action button is a no-op:**
  - **Start/End Breakout** → `setActive(!active)` only (local) — ~[L1933](../src/components/Meetings/MeetingsComponents.tsx#L1933). No room creation, no moves.
  - **Broadcast to All** → `setBroadcastMode(false); setBroadcastMsg('')` — ~[L1956,1964](../src/components/Meetings/MeetingsComponents.tsx#L1956). Sends nothing.
  - **Call Everyone Back** → `onClose()` only — ~[L1977](../src/components/Meetings/MeetingsComponents.tsx#L1977). Recalls no one.

### 1b. Why it's honest today (provably unreachable)

- **Tools-menu "BREAKOUT"** — [TimeRail.tsx:449](../src/components/Meetings/TimeRail.tsx#L449):
  `disabled: true, badge: 'SOON'`. Rendered as a native `<button disabled>`
  ([TimeRail.tsx:457-461](../src/components/Meetings/TimeRail.tsx#L457)) — a disabled
  button **cannot fire onClick**, so `onBreakout` is dead-ended.
- **Only other trigger** is `handleFeatureClick('breakout')`
  ([Meetings.tsx:420](../src/components/Meetings/Meetings.tsx#L420)) — but
  `handleFeatureClick` ([Meetings.tsx:403](../src/components/Meetings/Meetings.tsx#L403))
  is **never called anywhere** (dead code).
- **MeetingSettings "Breakout Rooms" toggle** — [MeetingsComponents.tsx:1591](../src/components/Meetings/MeetingsComponents.tsx#L1591):
  `disabled` + "Coming Soon" badge.
- Wiring in the dashboard: `showBreakoutRooms` state
  ([Meetings.tsx:109](../src/components/Meetings/Meetings.tsx#L109)), modal render
  ([Meetings.tsx:611-615](../src/components/Meetings/Meetings.tsx#L611)) passing
  `activeParticipants` ([Meetings.tsx:145](../src/components/Meetings/Meetings.tsx#L145),
  a `Contact[]` — the **invite list, not live call participants**).

> **Cleanup to fold into this build:** delete the dead `handleFeatureClick`
> (Meetings.tsx:403-424) once breakouts are wired, OR repurpose it. It is the one
> piece of genuinely dead code here.

---

## 2. The Daily architecture as it actually is

| Concern | Reality | Evidence |
|---|---|---|
| SDK | `@daily-co/daily-js ^0.87.0` + `@daily-co/daily-react ^0.24.0` | [package.json:131-132](../package.json#L131) |
| Model | **Call object** (custom UI via `daily-react` hooks), **not** Prebuilt iframe | [PulseVideoRoom.tsx:13-18](../src/components/Meetings/PulseVideoRoom.tsx#L13) (`DailyProvider`, `useDaily`, `useDailyEvent`, `useParticipantIds`, `useParticipant`) |
| Call object creation | `DailyIframe.createCallObject({ url: roomUrl, token })` once at root, then `<DailyProvider callObject={co}>` | [PulseVideoRoom.tsx:1147,1176](../src/components/Meetings/PulseVideoRoom.tsx#L1147) |
| Join / leave | `daily.join({ url: roomUrl, token })` on mount; `daily.leave()` on unmount | [PulseVideoRoom.tsx:392,433](../src/components/Meetings/PulseVideoRoom.tsx#L392) |
| Live participants | `useParticipantIds({ filter: 'remote' })` + `localId`; names via `useParticipant(sessionId)` | [PulseVideoRoom.tsx:368,387,109](../src/components/Meetings/PulseVideoRoom.tsx#L368) |
| **Signaling** | `daily.sendAppMessage({ type, ... }, '*')` + `useDailyEvent('app-message', cb)`; **only `type:'chat'` handled today** | [PulseVideoRoom.tsx:562,475](../src/components/Meetings/PulseVideoRoom.tsx#L475) |
| Host flag | `isHost` threaded through `MeetingRoom` | [PulseVideoRoom.tsx:365,410,1181](../src/components/Meetings/PulseVideoRoom.tsx#L365) |
| Room/token backend | `daily-rooms` edge fn (auth-gated), actions: create-room, create-token, start/stop-recording, get-recordings, get-recording-link, save-transcript, delete-room | [supabase/functions/daily-rooms/index.ts](../supabase/functions/daily-rooms/index.ts) |
| Service wrappers | `createPulseRoom(eventId?, title?)`, `getMeetingToken(roomName, isOwner, displayName)`, `markRoomActive/Ended`, `getRoomByName`, `resolveRoomForJoin`, `deleteRoom`(via edge) | [pulseVideoService.ts:120,128,221,250,278](../src/services/pulseVideoService.ts#L120) |
| Room props (server) | `max_participants: 50`, cloud recording, deepgram transcription, **24h expiry** | [daily-rooms/index.ts:106-117](../supabase/functions/daily-rooms/index.ts#L106) |
| Token props (server) | `room_name`, `is_owner`, `user_name`, `user_id`, **4h expiry**, owner gets `enable_recording:'cloud'` | [daily-rooms/index.ts:142-151](../supabase/functions/daily-rooms/index.ts#L140) |

**Consequence:** because this is the call-object model, Daily's *built-in* breakout
UI (a Prebuilt feature) is unavailable. We orchestrate breakouts ourselves. That is
the standard pattern for custom Daily apps and is well-trodden.

---

## 3. Chosen approach — ephemeral host-orchestrated sub-rooms (Approach A)

**Mechanism (per breakout session):**

1. **Host** opens the breakout panel *inside the live call*, assigns live
   participants to N rooms (reuse existing 3-panel UI), picks a duration, hits Start.
2. **Host's client** calls `createPulseRoom(undefined, 'Breakout · {meetingName} · Room k')`
   once per room → gets `{ roomUrl, roomName }` for each. (Backend already exists.)
3. **Host broadcasts** an app-message `{ type: 'breakout-start', assignments }` where
   `assignments` maps each participant `session_id`/`user_id` → `{ roomUrl, roomName, endsAt }`.
4. **Each participant client** reads its own assignment, mints its **own** token via
   `getMeetingToken(breakoutRoomName, /*isOwner*/ false, displayName)`, then **moves**:
   `daily.leave()` → `daily.join({ url: breakoutRoomUrl, token })`. (Host stays in main
   or hops between rooms — host decision, see D2.)
5. **Recall:** host broadcasts `{ type: 'breakout-recall' }` on the **main-room**
   channel (and/or each sub-room). Each participant `leave()`s the sub-room and
   re-`join()`s the **main** room (host re-issues a main-room token, or the original
   token is cached and still valid — tokens last 4h, see Risk R1).
6. **Broadcast message:** host sends `{ type: 'breakout-broadcast', text }` that fan-outs
   to all sub-rooms (host must be a member of each, OR we relay; see Risk R3) and
   renders as a toast/banner in each sub-room.
7. **Cleanup:** on End/Recall, host calls `delete-room` (via edge) for each ephemeral
   breakout room (or let the 24h expiry reap them — see D4).

**Why ephemeral (not persisted) for v1:** a breakout session only needs to live for
the duration of the meeting. App-message state + the host as source-of-truth is enough.
Persisting assignments to a table (Approach C) buys reconnection-resilience and audit
trail but adds schema + RLS + a sync loop. **Defer persistence to v2** unless D3 says
otherwise.

**Approach B (Daily official breakout helper):** Daily publishes a reference
breakout-rooms module built on exactly this primitive. We are **not** taking a new
dependency for v1 — the hand-rolled version above reuses our existing backend and
signaling and keeps full control of the UI. Revisit if maintenance cost grows.

---

## 4. The structural move — breakouts must live INSIDE the call

This is the crux. Today:

```
Meetings.tsx (dashboard, NO DailyProvider)
  └─ <BreakoutRoomsModal activeParticipants={Contact[] invite list} />   ❌ no call object, no live participants
```

Target:

```
PulseVideoRoom.tsx
  └─ <DailyProvider callObject={co}>
       └─ MeetingRoom (isHost, useDaily(), useParticipantIds())
            └─ <BreakoutController />   ✅ host-only; live participants; can sendAppMessage + join/leave
            └─ app-message handler also routes breakout-* types
```

Two options for the modal:
- **(Recommended) Move/duplicate the assignment UI into the call.** Extract the
  visual 3-panel layout from `BreakoutRoomsModal` into a presentational component that
  takes `participants` + callbacks, and mount a new `BreakoutController` inside
  `MeetingRoom` that feeds it **live** participants and wires the buttons to Daily.
  Keep the existing dashboard modal as a no-op preview *or* remove its dashboard
  mounting once the in-call one works (Rule A: present the pros/cons before deleting).
- **(Not recommended) Keep it in the dashboard.** You cannot reach the call object or
  live participants from there without lifting the call state up — more invasive.

The dashboard's `activeParticipants: Contact[]` is the **invite list** and is the wrong
source for "who is actually in the room right now." Live breakouts must use
`useParticipantIds()` / `daily.participants()`.

---

## 5. Phased build plan

Each phase is independently committable (`feat(meetings): ... (breakout Pk)`), flag-gated,
and leaves the tree green. Ship behind a **`breakoutRooms` feature flag (default OFF)**
following the `inAppSms` pattern in [featureFlags.ts](../src/lib/featureFlags.ts) so
partial work never shows a half-wired control.

> **P0 — Flag + honest gating + dead-code cleanup.**
> Add `breakoutRooms` to `featureFlags.ts` (OFF, with the "no Daily wiring yet" comment
> + `?ff_breakoutRooms=on` dev override). Delete the dead `handleFeatureClick`
> (Meetings.tsx:403-424). Leave the Tools entry `disabled` until P6. *Acceptance:* tsc
> clean; nothing visible changes; dev override exists.

> **P1 — App-message protocol + handler.**
> Define a typed protocol (see §6) and extend the `app-message` handler
> ([PulseVideoRoom.tsx:475](../src/components/Meetings/PulseVideoRoom.tsx#L475)) to route
> `breakout-start` / `breakout-recall` / `breakout-broadcast` (no UI yet — log + state).
> *Acceptance:* a manually-sent app-message updates state; chat still works.

> **P2 — In-call host controller scaffold.**
> Add `<BreakoutController>` inside `MeetingRoom` (host-only via `isHost`), reading
> **live** participants from `useParticipantIds()`. Extract the presentational 3-panel
> UI from `BreakoutRoomsModal` into a shared component; render it from the controller
> with live data. Buttons still inert. *Acceptance:* host sees real participants in the
> assignment UI inside the call; non-host sees nothing.

> **P3 — Create rooms + move on Start (the core).**
> Wire Start: host `createPulseRoom()` per room → broadcast `breakout-start` with
> per-participant assignments → each client mints its token (`getMeetingToken`) and
> `leave()`→`join()` its sub-room. Host follows its own rule (D2). *Acceptance:* 3+
> real browsers split into sub-rooms and can see/hear only their roommates. **This is
> the milestone that makes it "real."**

> **P4 — Recall + cleanup.**
> Wire "Call Everyone Back": broadcast `breakout-recall`; every client returns to the
> main room; host `delete-room`s the ephemeral rooms (or defers to expiry per D4).
> Handle the timer auto-recall (D2). *Acceptance:* everyone is back in main; sub-rooms
> gone/expired; no ghost participants.

> **P5 — Broadcast message + timer surfacing.**
> Wire "Broadcast to All" → `breakout-broadcast`; render as a banner/toast in each
> sub-room. Surface the countdown in each sub-room with an auto-recall warning.
> *Acceptance:* a host broadcast appears in every sub-room; timer visible everywhere.

> **P6 — Un-gate the entrances.**
> Flip the Tools-menu "BREAKOUT" entry and the MeetingSettings toggle to enabled
> **only when** `breakoutRooms` flag is on AND `isHost`. Remove the "SOON"/"Coming
> Soon" badges under the flag. *Acceptance:* with `?ff_breakoutRooms=on`, a host can
> open breakouts from the in-call Tools menu; without the flag, it stays disabled+SOON.

> **P7 — Hardening + edge cases (see §8).**
> Late-joiners, host-leaves-mid-breakout, reconnection, recording-in-breakouts policy,
> mobile, token/room expiry mid-session. *Acceptance:* the §8 risk table is walked and
> each row is either handled or explicitly deferred-with-a-note.

---

## 6. App-message protocol (spec)

Single channel (`sendAppMessage(payload, '*')`). Add a discriminated union; keep
`type:'chat'` untouched. Suggested shapes (finalize in P1):

```ts
type BreakoutMsg =
  | { type: 'breakout-start'; sessionId: string; endsAt: number | null;
      assignments: Array<{ participant: string /* session_id */; roomUrl: string; roomName: string }> }
  | { type: 'breakout-recall'; sessionId: string }
  | { type: 'breakout-broadcast'; sessionId: string; text: string }
  | { type: 'breakout-ack'; sessionId: string; participant: string; state: 'moved' | 'returned' };
```

Notes:
- `participant` keys on Daily **`session_id`** (stable for a connection), resolved via
  `daily.participants()` / `useParticipant`. `user_id` (our Supabase id) is also on the
  participant object if a per-user key is preferred — verify which is populated for
  guests before relying on it.
- App-messages are **best-effort, not guaranteed**; late-joiners miss prior messages.
  The host is the source of truth — on `participant-joined` during an active breakout,
  the host re-unicasts the current assignment (P7).
- Cap payload size (Daily app-message limit is small, ~4–8KB); for many participants
  send per-room or unicast rather than one giant broadcast.

---

## 7. Backend reuse — nothing new required for the happy path

| Need | Reuse | Where |
|---|---|---|
| Create a breakout room | `createPulseRoom(undefined, title)` | [pulseVideoService.ts:120](../src/services/pulseVideoService.ts#L120) → daily-rooms `create-room` |
| Mint a sub-room token | `getMeetingToken(roomName, false, displayName)` | [pulseVideoService.ts:128](../src/services/pulseVideoService.ts#L128) → daily-rooms `create-token` |
| Tear down a breakout room | `callEdge({ action: 'delete-room', roomName })` (add a thin `deleteRoom()` export if missing) | [daily-rooms/index.ts:219](../supabase/functions/daily-rooms/index.ts#L219) |

**Possible backend touch (only if P7 needs it):** a `create-breakout-rooms` batch action
on the edge fn (create K rooms in one call) to cut round-trips, and/or a server-side
`is_owner` token for the host in each sub-room so the host can moderate. Both are
optimizations — the happy path works with the existing single-room/single-token actions.

---

## 8. Risks & edge cases (walk in P7)

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Token expiry (4h)** — original main-room token may be near expiry on recall | Re-mint a fresh main-room token on recall rather than reusing the cached one |
| R2 | **Room expiry (24h)** — ephemeral breakout rooms auto-expire | Fine for v1 (sessions are short); explicit `delete-room` on recall is the clean path |
| R3 | **Host can't broadcast into a room it isn't in** | Either (a) host hops rooms, (b) relay broadcasts via a server action, or (c) accept "broadcast = banner pushed via app-message to sub-room members who are still connected to the main-room app-message bus" — verify whether app-messages cross rooms (they do **not**; app-messages are room-scoped) → **broadcast must be re-sent into each sub-room**, so the host (or a server relay) must reach each room |
| R4 | **Late-joiner during active breakout** | On `participant-joined`, host unicasts current assignment (or routes them to a default room / keeps them in main) |
| R5 | **Host leaves mid-breakout** | Define succession: either end all breakouts (safest v1) or promote a co-host; decide in D2 |
| R6 | **Recording/transcription in breakouts** | Default: do **not** auto-record sub-rooms (cost + privacy). Decide in D1. The main-room recording stops when everyone leaves it |
| R7 | **Reconnection** mid-breakout (network blip) | Daily auto-rejoins the room it was in; ensure our state survives a remount (host re-unicast covers it) |
| R8 | **Mobile / Capacitor** | Verify `leave()`→`join()` works on the mobile webview; test camera/mic re-acquisition across the room switch |
| R9 | **App-message size cap** | Per-room or unicast assignments for large meetings (§6) |
| R10 | **Solo/non-host clients** must never see host controls | Gate `BreakoutController` on `isHost`; participants only react to messages |

> **Verify before building (Rule B):** confirm whether Daily app-messages are
> room-scoped (they are — this drives R3) and confirm which of `session_id` vs `user_id`
> is reliably populated for **guest** participants in this SDK version. Do this with a
> 2-browser smoke test in P1 before designing the assignment keying.

---

## 9. Disposition of existing code (Rule A)

- **`BreakoutRoomsModal` 3-panel UI** — **PRESERVE & REUSE.** Extract the presentational
  panels into a shared component consumed by the new in-call `BreakoutController`. Do
  **not** rewrite the assignment UX from scratch.
- **No-op buttons (Start/Broadcast/Recall)** — **WIRE**, don't delete.
- **`handleFeatureClick` (Meetings.tsx:403-424)** — **DELETE** (genuinely dead) or
  repurpose as the in-call entry. Present the one-line pros/cons before deleting per
  Rule A (it's trivial, but follow the contract).
- **Dashboard mounting of the modal (Meetings.tsx:611-615)** — once the in-call
  controller works, decide whether the dashboard entry stays as a no-op preview or is
  removed. **Present pros/cons + get approval before removing** (Rule A).
- **MeetingSettings breakout toggle (MeetingsComponents.tsx:1579-1592)** — keep disabled
  until P6; then gate on the flag.

---

## 10. Open decisions for the operator (resolve before/within P3–P4)

- **D1 — Record/transcribe breakout rooms?** Default proposed: **no** (cost + privacy;
  main-room recording is the record). Confirm.
- **D2 — Host behavior + succession.** Does the host (a) stay in main, (b) get assigned
  to a room, (c) freely hop? And if the host leaves mid-breakout, do we **end all**
  (safest) or promote a co-host? Default proposed: host can hop; host-leave **ends all**.
- **D3 — Ephemeral vs persisted.** v1 proposed **ephemeral** (app-message state only).
  Persisting to a `meeting_breakout_*` table is a v2 item (adds reconnection resilience
  + audit). Confirm ephemeral is acceptable for v1.
- **D4 — Cleanup policy.** Explicit `delete-room` on recall (clean) vs let 24h expiry
  reap them (lazy). Default proposed: explicit delete on recall.
- **D5 — Limits.** Max rooms (UI currently lets you add unbounded) and max
  participants/room. Main room is capped at `max_participants: 50`
  ([daily-rooms/index.ts:107](../supabase/functions/daily-rooms/index.ts#L107)); pick
  sane breakout caps.

---

## 11. Testing

- **Manual (authoritative):** 3+ real browser sessions (or Daily's test tooling) — only
  way to prove isolation, moves, recall, and broadcast across real rooms. Daily cannot
  be meaningfully faked in unit tests.
- **Unit:** the assignment/state reducer (pure) and the app-message
  encode/decode/router can be unit-tested without Daily.
- **e2e (Playwright):** can drive the host UI and assert app-messages are *sent*, but
  cannot validate real media routing — keep e2e to the control surface, not the AV.
- **tsc:** gate on **no NEW** errors (repo has ~1234 pre-existing; use the 8GB-heap
  invocation — see the tsc-OOM memory note). `npx tsc --noEmit` filtered to the touched
  scopes.

---

## 12. Ground-truth reference index (all verified 2026-06-18)

| What | File:line |
|---|---|
| BreakoutRoomsModal | `src/components/Meetings/MeetingsComponents.tsx:1719` |
| BreakoutRoom type / colors | `…MeetingsComponents.tsx:603,611` |
| No-op Start / Broadcast / Recall | `…MeetingsComponents.tsx:~1933,1956,1977` |
| MeetingSettings toggle (disabled) | `…MeetingsComponents.tsx:1579-1592` |
| Tools "BREAKOUT" entry (disabled+SOON) | `src/components/Meetings/TimeRail.tsx:449` |
| Tools menu render (native disabled btn) | `…TimeRail.tsx:457-461` |
| Dead `handleFeatureClick` + breakout case | `src/components/Meetings/Meetings.tsx:403,420` |
| Dashboard modal mount + invite-list prop | `…Meetings.tsx:109,145,611-615` |
| Daily hooks / provider import | `src/components/Meetings/PulseVideoRoom.tsx:13-18` |
| Call-object create + DailyProvider | `…PulseVideoRoom.tsx:1147,1176` |
| join / leave | `…PulseVideoRoom.tsx:392,433` |
| live participants | `…PulseVideoRoom.tsx:368,387,109` |
| sendAppMessage (chat) + app-message handler | `…PulseVideoRoom.tsx:562,475` |
| daily-rooms edge fn (create-room/token/delete) | `supabase/functions/daily-rooms/index.ts:75,136,219` |
| service wrappers | `src/services/pulseVideoService.ts:120,128,221,250,278` |
| Daily SDK versions | `package.json:131-132` |

---

## 13. BUILD LOG — P0–P7 shipped 2026-06-18

All phases built on `main`, flag-gated behind `breakoutRooms` (default OFF;
`?ff_breakoutRooms=on` to dev-test). Commits: P0 `699d187`, P1 `52c9ce8`,
P2 `e74e231`, P3a `d5c5d28`, P3b `30bb22f`, P4 `07b22cf`, P5 `99b6fb2`,
P6 `209110a`, P7 (this).

### Operator decisions (resolved)
- **D1** — No recording/transcription in sub-rooms (participants get non-owner
  tokens, which the edge fn mints without `enable_recording`).
- **D2** — Host stays in main, may hop; host-leave ends all (no co-host v1).
  Assignable pool = remote participants only.
- **D3** — **Persist** (not ephemeral). Host-owned `meeting_breakout_sessions`
  + `meeting_breakout_assignments` tables (migration 20260618000001).
- **D4** — Explicit `delete-room` on recall (4s grace), 24h expiry as backstop.
- **D5** — Sane defaults; max-rooms cap not enforced in v1 (note below).

### Architecture deviation from the original plan
- **Transport changed from Daily app-messages → Supabase Realtime broadcast**
  channel (`breakout-<mainRoomName>`, `useBreakoutChannel`). Reason: R3 — Daily
  app-messages are room-scoped and can't reach participants once they're in
  sub-rooms, which would make recall/broadcast impossible. The Realtime channel
  is room-agnostic. The protocol (`breakoutProtocol.ts`) is transport-agnostic,
  so the reducer + 11 unit tests were unaffected.
- **Dashboard surfaces removed** (operator choice, P6): the inert
  `BreakoutRoomsModal`, its Tools-menu entry, and the dead Settings toggle were
  deleted. The real feature is the in-call `BreakoutController` (host-only,
  flag-gated), which reuses the same `meetings-breakout-*` styling.

### §8 risk dispositions
- **R1 token expiry** — HANDLED: return-move re-mints a fresh main token.
- **R2 room expiry** — HANDLED: explicit `delete-room` on recall + 24h backstop.
- **R3 cross-room broadcast** — HANDLED: Realtime channel (see deviation).
- **R4 late-joiner** — DEFERRED: a participant joining main during an active
  breakout is NOT auto-assigned (stays in main). Host re-unicast on
  `participant-joined` is a future nicety. Acceptable v1 behavior.
- **R5 host leaves mid-breakout** — HANDLED: `handleLeave` recalls everyone
  before unmount; plus a participant self-return timer fires at `endsAt` even if
  the host crashed and no recall arrives.
- **R6 recording in breakouts** — HANDLED (D1): non-owner tokens, nobody starts
  recording in sub-rooms.
- **R7 reconnection** — HANDLED: Daily auto-rejoins the current room; breakout
  state lives in MeetingRoom (survives a blip); self-return timer is a backstop.
- **R8 mobile/Capacitor** — DEFERRED: `leave()`→`join()` + camera/mic
  re-acquisition across the room switch needs on-device testing.
- **R9 message size cap** — MITIGATED by the transport change (Realtime
  broadcast, not the small Daily app-message budget). Per-room unicast for very
  large meetings remains a future option.
- **R10 host controls leak** — HANDLED: `BreakoutController` is `isHost`+flag
  gated; participants only react to channel messages.

### Still open / deferred (post-flag-flip)
- **Live verification** — the AV truth (3+ real browsers split into sub-rooms,
  hear only roommates, recall returns everyone, broadcast reaches every room)
  is NOT YET VERIFIED. Daily media routing can't be exercised headless; needs a
  real multi-browser session with `?ff_breakoutRooms=on`.
- **Confirm Daily `user_id` for guests** (handoff §8) before adding per-
  participant self-read RLS on the breakout tables (currently host-only).
- **D5 caps** — no max-rooms / max-per-room enforcement yet.
- **R4 late-joiner** auto-assignment; mid-breakout reassignment.
- **R8 mobile** device pass.
- **pulse_video_rooms hygiene** — `delete-room` reaps the Daily room but leaves
  the `pulse_video_rooms` row (status 'waiting', host-owned). Harmless; could be
  swept later.

---

*Authored as the kickoff handoff for the operator-approved "build it for real"
path. P0–P7 shipped 2026-06-18 behind the `breakoutRooms` flag; live AV
verification is the remaining gate before flipping the flag on.*
