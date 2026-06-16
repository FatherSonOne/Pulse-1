# Meetings — Launch-Fixes Implementation Handoff (2026-06-16)

> **Scope:** Sprint 0 (launch blockers) + Sprint 1 (core reliability) for the Pulse
> **Meetings** section.
> **Supersedes** the Sprint-0/Sprint-1 sections of
> [`docs/launch-readiness/meetings-launch-readiness-2026-06-16.md`](launch-readiness/meetings-launch-readiness-2026-06-16.md),
> which this handoff **corrects** with a fresh ground-truth re-verification (live DB +
> live edge-function posture + full code read on 2026-06-16).
> **Origin:** read-only assessment + adversarial re-verification. **Nothing here is
> executed yet.**

---

## 0. How to read this — Rule A gate

Per `CLAUDE.md` Rule A, **a plan is not a green light.** Two of these items are
materially destructive/security-affecting:

- **0.2** alters a live RLS policy on `pulse_video_rooms` (drops `authenticated_read`).
- **1.4** removes / re-routes a working (if dead-pathed) summarizer in `daily-webhook`.

Each such item below carries an explicit **Pros / Cons + Approval gate**. Do **not**
execute those until the user approves *that specific change*. The additive items
(copy fixes, error handling, wiring dead code, the provenance chip) are lower-risk but
still land as **separate commits on `main`** (no branches — `CLAUDE.md` §1).

---

## 1. Ground-truth snapshot (verified 2026-06-16, project `ucaeuszgoihoyrvhewxk`)

### 1a. Live `pulse_video_rooms` data
| Metric | Value |
|---|---|
| Rooms total | 8 (6 ended, 2 waiting) |
| With real `recording_url` | **0** |
| With real `recording_id` | **0** |
| With **real transcript text** | **0** (3 rows hold an *empty-string* transcript, 5 NULL) |
| With real summary | **3** (408 / 598 / 746 chars) |
| Distinct creators | 2 |

### 1b. Live edge-function posture (queried via Supabase API)
| Function | `verify_jwt` (live) | Correct? |
|---|---|---|
| `daily-webhook` | **`true`** | ❌ **wrong** — Daily sends no Supabase JWT, so its POST is gateway-401'd. This is the deployed default because the fn is undeclared in `config.toml`. |
| `daily-rooms` | `true` | ✅ correct — it validates a user JWT (`getUser(token)`). |
| `slack-events`, `gmail-push-receiver`, `send-push`, `billing-webhook` | `false` | ✅ the external-webhook precedent to mirror. |

### 1c. Corrections this handoff bakes in (vs. the readiness report)
1. **Transcript count:** report's "3 transcripts" (§1d) counted non-null *empty strings*.
   Truth = **0 real transcripts, 3 real summaries**. The report's own line 43 ("3
   summaries, 0 transcripts") is the correct number; use it.
2. **Why transcripts were empty — and it's *already fixed in code*:**
   [`PulseVideoRoom.tsx:486-505`](../src/components/Meetings/PulseVideoRoom.tsx#L486-L505)
   documents the bug: the old `transcription-message` handler read `evt.is_final`
   (undefined) → every line stored `isFinal:false` → `handleLeave`'s
   `.filter(l => l.isFinal)` ([:577](../src/components/Meetings/PulseVideoRoom.tsx#L577))
   produced an empty transcript → `saveTranscript` persisted `''`. Current code hardcodes
   `isFinal: true` ([:503](../src/components/Meetings/PulseVideoRoom.tsx#L503)) — fixed
   **going forward**, but **no post-fix meeting exists in the DB to prove it.** → see
   Verification §6.
3. **`daily-webhook` is *not* the "only writer"** of `recording_url`:
   [`pulseVideoService.ts:282-285`](../src/services/pulseVideoService.ts#L282-L285)
   (`pollForRecording`) also writes it. Both are inert today (webhook 401'd; poll path
   never called), so recordings still never populate — but drop the "only writer" framing.
4. **AI-provenance chip (report item 1.3 / trust-killer #3) is ~90% already shipped.**
   `<AIProvenanceChip vendor="GEMINI" .../>` renders in the post-call SummaryView at
   [MeetingsComponents.tsx:2236/2269/2327/2348](../src/components/Meetings/MeetingsComponents.tsx#L2236).
   Only the **Recordings-modal summary detail**
   ([:1120-1131](../src/components/Meetings/MeetingsComponents.tsx#L1120-L1131)) still
   shows a bare "AI Summary" label. 1.3 shrinks accordingly.
5. **In-call recording/transcription failures already roll back + toast** via Daily event
   handlers ([:449-453](../src/components/Meetings/PulseVideoRoom.tsx#L449-L453),
   [:468-472](../src/components/Meetings/PulseVideoRoom.tsx#L468-L472)). Report item 1.1
   shrinks to the transcription *optimism* nuance only. The real error-handling gap is
   **screen-share** (1.2).

---

## 2. Corrected disposition matrix

| Report item | Verified reality (2026-06-16) | Disposition | Effort |
|---|---|---|---|
| 0.1 Recordings never playable | `recording_url=0` real; webhook `verify_jwt=true` live (gateway-dead) **confirmed**; poll path dead; copy misleading | **FIX** (pick a path) + mandatory copy fix | M |
| 0.2 Cross-tenant RLS | Policies/grants exact; only live non-owner reader = `getRoomByName`→`room_url`; `getRoomForEvent`/`getMyPastRooms` unused | **FIX** (RPC + drop policy) | M |
| 1.1 Harden rec/transcription toggles | Failures already toast+rollback via events; only `toggleTranscription` optimistic flip remains | **SHRUNK** → optional polish | S→XS |
| 1.2 Screen-share error handling | `toggleScreenShare` ([:524-533](../src/components/Meetings/PulseVideoRoom.tsx#L524-L533)) has no try/catch, no toast | **FIX** (the real gap) | S |
| 1.3 AI-provenance chip | Already in post-call SummaryView; missing only in Recordings-modal detail | **SHRUNK** → one spot | XS |
| 1.4 Route webhook through `ai-router` | Direct `gemini-1.5-flash` call confirmed ([daily-webhook:116-126](../supabase/functions/daily-webhook/index.ts#L116-L126)); only matters if 0.1 Path A is chosen | **FIX or DELETE** (conditional on 0.1) | S |

---

## 3. Sprint 0 — Launch blockers

### Item 0.1 — Recordings never become playable

**Problem.** `daily-rooms` creates rooms with `enable_recording:'cloud'`
([daily-rooms:108](../supabase/functions/daily-rooms/index.ts#L108)), but no
`recording_url` ever lands (`with_recording_url=0/8`). Two compounding breaks plus
misleading copy:
- **(a)** `daily-webhook` is the intended writer but is **live `verify_jwt=true`**
  (§1b) — Daily's JWT-less POST is 401'd at the gateway before the handler runs. It also
  never verifies the `DAILY_WEBHOOK_SECRET`/`x-daily-signature` it documents
  ([daily-webhook:9,16,31](../supabase/functions/daily-webhook/index.ts#L31)).
- **(b)** The client recovery path is dead: `getRoomRecordings`/`syncPendingRecordings`
  have **zero callers**; `pollForRecording` is called once *inside* the never-invoked
  `syncPendingRecordings` ([:300-319](../src/services/pulseVideoService.ts#L300-L319)).
  `handleLeave` ([:570-619](../src/components/Meetings/PulseVideoRoom.tsx#L570-L619))
  never polls.
- **(c)** Empty-state copy
  ([MeetingsComponents.tsx:1019-1021](../src/components/Meetings/MeetingsComponents.tsx#L1019-L1021)):
  "Enable Auto-Recording in Meeting Settings to save recordings" — promises playback the
  system can't deliver.

**Good news (edge already supports the client path):** `daily-rooms` exposes
`get-recordings` ([:188](../supabase/functions/daily-rooms/index.ts#L188)) **and**
`get-recording-link` ([:197](../supabase/functions/daily-rooms/index.ts#L197)) — so
Path B needs **no edge changes**, only wiring the dead client code.

**Fix — pick ONE persistence path; the copy fix is mandatory either way.**

**▶ Path A — Webhook (matches incumbents, async, survives client-close).**
1. Add to [`supabase/config.toml`](../supabase/config.toml) (mirror `slack-events` at
   [:435-436](../supabase/config.toml#L435-L436)):
   ```toml
   # daily-webhook: Daily.co recording.ready/error receiver. Daily sends NO Supabase
   # JWT, so verify_jwt MUST be off or the gateway 401s before the function's own
   # signature check runs. Auth is the x-daily-signature HMAC verified inside the fn.
   [functions.daily-webhook]
   verify_jwt = false
   ```
2. Add real signature verification inside the fn using `DAILY_WEBHOOK_SECRET` +
   `x-daily-signature` (currently documented but unchecked).
   ⚠️ **Confirm Daily's exact HMAC scheme from Daily's webhook docs before coding** —
   the function only names the header; do not guess the algorithm.
3. Redeploy; **register** the webhook in the Daily dashboard for `recording.ready` /
   `recording.error` → `…/functions/v1/daily-webhook`.
- **Pros:** robust, server-side, works even if the user closes the tab; one writer.
- **Cons:** external dashboard config + a Daily secret + the HMAC scheme; ships an
  edge-fn change; pairs with **1.4** (the webhook's summarizer must not bypass
  `ai-router`).

**▶ Path B — Client poll (no external config, all in-repo).**
1. In `handleLeave`, after `markRoomEnded`, fire-and-forget `pollForRecording(roomName)`
   **only when `isRecording`** (don't poll non-recorded rooms).
2. Call `syncPendingRecordings()` when the Recordings modal opens
   ([MeetingsComponents.tsx:896](../src/components/Meetings/MeetingsComponents.tsx#L896)).
   Consider relaxing its `recording_id IS NOT NULL` filter
   ([:306](../src/services/pulseVideoService.ts#L306)) to also catch ended+recorded rooms
   with a null `recording_id` (query Daily by `room_name`).
- **Pros:** zero external config; `daily-rooms` already supports the actions; fully
  reversible in-repo.
- **Cons:** only resolves while a client is open within the poll window
  (`pollForRecording` = 20×20s ≈ 6 min); a recorded room whose host closed the tab won't
  self-heal until someone reopens Recordings.

**▶ Mandatory regardless — fix the copy
([:1019-1021](../src/components/Meetings/MeetingsComponents.tsx#L1019-L1021)).** Make it
accurate (e.g. *"Recordings appear here a few minutes after a recorded meeting ends."*).
**Interim fallback if neither path ships before launch:** relabel the surface
**"Transcripts & Summaries"** and remove the Auto-Recording-saves-recordings claim
(the `b045d65` honesty-pass pattern).

**Recommendation:** **Path B + copy fix** for the launch gate (lowest risk, no external
deps, leverages already-built edge actions), with **Path A as a fast-follow** for
close-the-tab robustness. Either way 1.4 only applies if Path A ships.

**Verification:** Start a Pulse meeting, **enable recording**, leave; within Daily's
2–5 min window confirm `pulse_video_rooms.recording_url` populates and the Recordings
modal renders a playable element + working download.

**Effort:** Path A ≈ M (2–4h incl. dashboard + HMAC); Path B ≈ S–M (≈2h); copy fix ≈ XS.

---

### Item 0.2 — Cross-tenant RLS exposure on `pulse_video_rooms`

**Problem (verified live).** Policy `authenticated_read = SELECT USING (auth.role() =
'authenticated')` ([migration 20260312000001:34-36](../supabase/migrations/20260312000001_pulse_video_rooms.sql#L34-L36))
lets **any** authenticated user read **every** room's `transcript`/`summary`/
`recording_url`. `anon`+`authenticated` also hold column-level SELECT on those columns
(RLS still blocks `anon`). Current exposure = **3 summaries, 0 transcripts**, growing per
meeting.

**Blast radius (verified — small).** The only live non-owner reader is
`getRoomByName` → **App.tsx:131-133** (deep-link join), which consumes **only
`room.room_url`** ([App.tsx:133](../src/App.tsx#L133)). `getRoomForEvent` and
`getMyPastRooms` have **zero callers**. (Bonus: dropping the broad policy also closes
`getMyPastRooms`'s latent cross-user over-read — it filters only `status='ended'`, no
`created_by` — if it's ever wired up.)

**Fix — preserve deep-link join; do NOT just drop the policy (Rule A).**
1. Create a `SECURITY DEFINER` RPC returning only join-safe columns:
   ```sql
   CREATE OR REPLACE FUNCTION public.resolve_room_for_join(p_room_name text)
   RETURNS TABLE (room_url text, room_name text, status text, title text)
   LANGUAGE sql SECURITY DEFINER
   SET search_path = public, extensions, pg_temp   -- per DB Security Baseline
   AS $$
     SELECT room_url, room_name, status, title
     FROM public.pulse_video_rooms
     WHERE room_name = p_room_name
     LIMIT 1;
   $$;
   REVOKE ALL ON FUNCTION public.resolve_room_for_join(text) FROM public;
   GRANT EXECUTE ON FUNCTION public.resolve_room_for_join(text) TO authenticated;
   ```
2. Repoint `getRoomByName`'s join usage at the RPC (or add a dedicated
   `resolveRoomForJoin()` and switch `App.tsx:131`). Keep `owner_all` as the only
   direct-table read policy → `transcript`/`summary`/`recording_url` become owner-only.
3. `DROP POLICY authenticated_read ON public.pulse_video_rooms;`
4. **Defense-in-depth:** `REVOKE SELECT (transcript, summary, recording_url, recording_id)
   ON public.pulse_video_rooms FROM anon, authenticated;`

**⚠️ Migration discipline (`CLAUDE.md` §4):** dry-run inside a rolled-back transaction
until clean, *then* apply once:
```sql
DO $$ BEGIN
  -- create fn, drop policy, revoke grants here
  RAISE EXCEPTION 'rollback — dry run only';
END $$;
```

**Rule-A — Pros / Cons / Approval gate**
- **What changes:** drops `authenticated_read`; adds `resolve_room_for_join`; revokes
  column grants; edits `App.tsx:131` + `pulseVideoService.ts:245` (`getRoomByName`).
- **Pros:** transcript/summary/recording_url become owner-only; deep-link join preserved
  via a minimal-surface RPC; closes a real privacy gap before client calls land here.
- **Cons / preserved-vs-sacrificed:** if any *future* feature expects cross-user room
  reads (e.g. a shared team meeting library), it must go through a new explicit policy/RPC
  — this narrows the default. No current consumer is sacrificed (`getRoomForEvent`/
  `getMyPastRooms` unused; `getMeetingRecordings` already filters `created_by`).
- **Ask:** *Proceed with dropping `authenticated_read` + adding the RPC as specified?*
  Wait for explicit approval before applying.

**Verification:** As user B, `select('transcript,summary,recording_url')` on a room A
created → zero rows. As user B, deep-link `/meet/:roomName` for A's room → join still
resolves `room_url` and works.

**Effort:** M (≈2–3h incl. RPC + client repoint + dry-run).

---

## 4. Sprint 1 — Core reliability

### Item 1.2 — Screen-share error handling *(the real in-call gap)*
**Problem.** `toggleScreenShare`
([:524-533](../src/components/Meetings/PulseVideoRoom.tsx#L524-L533)) has bare `await`s,
no try/catch, no toast, and no `useDailyEvent` for a screen-share error. A denied OS
picker leaves no feedback and `setScreenSharing(true)` silently never runs.
**Fix.** Wrap start/stop in try/catch; on failure `toast.error('Screen share couldn't
start.')` and leave `screenSharing=false`. Mirror the existing recording/transcription
toast pattern ([:451](../src/components/Meetings/PulseVideoRoom.tsx#L451)).
**Effort:** S.

### Item 1.3 — Provenance chip in the Recordings-modal summary *(shrunk)*
**Problem.** Post-call SummaryView already wears the coral `AIProvenanceChip` (§1c.4);
only the Recordings-modal detail
([:1128-1131](../src/components/Meetings/MeetingsComponents.tsx#L1128-L1131)) shows a bare
"AI Summary" label.
**Fix.** Add `<AIProvenanceChip vendor="GEMINI" type="SUMMARY" />` to that header (the
component is already imported at
[:4](../src/components/Meetings/MeetingsComponents.tsx#L4)). **Optional copy decision:**
the chip shows provenance (`GEMINI · SUMMARY`) but not an explicit *"verify"* nudge — if
the report's "AI-generated — verify" affordance is wanted, that's a small copy add
(out of scope unless requested).
**Effort:** XS.

### Item 1.1 — Transcription toggle optimism *(shrunk → optional)*
**Problem.** `toggleTranscription`
([:550-551](../src/components/Meetings/PulseVideoRoom.tsx#L550-L551)) sets
`setTranscriptEnabled(true)` synchronously before the `transcription-started` event. The
`transcription-started`/`-error` events already correct it
([:460-472](../src/components/Meetings/PulseVideoRoom.tsx#L460-L472)), so the only effect
is a brief "LISTENING" flash if Deepgram fails to attach. `toggleRecording` is **not**
optimistic (state set by `recording-started` only — [:437](../src/components/Meetings/PulseVideoRoom.tsx#L437)).
**Fix (optional polish).** Drop the optimistic `setTranscriptEnabled(true)` at
[:551](../src/components/Meetings/PulseVideoRoom.tsx#L551) and let
`transcription-started` own the flip. Low value; include only if touching the file.
**Effort:** XS.

### Item 1.4 — `daily-webhook` summarizer bypasses `ai-router` *(conditional on 0.1 Path A)*
**Problem.** [daily-webhook:111-136](../supabase/functions/daily-webhook/index.ts#L111-L136)
calls `gemini-1.5-flash` directly with an inline key — bypasses metering and violates
`CLAUDE.md` §4 (all Gemini server-side via `ai-router`).
**Fix.** If Path A ships: route the webhook summary through `ai-router` (or **delete** the
webhook summarizer entirely — the client `handleLeave` path already produces the summary
via `generateMeetingSummary`→`ai-router`, so the webhook summary is redundant for
client-captured meetings). If Path B is chosen for 0.1, the webhook stays dead → **defer
1.4** (no live impact) or delete the dead summarizer for hygiene.

**Rule-A — Pros / Cons / Approval gate (deletion variant)**
- **What changes:** removes `buildSummaryPrompt`/`parseStructuredSummary` + the
  gemini-1.5-flash fetch from `daily-webhook`.
- **Pros:** restores metering + §4 compliance; one summary path, not two divergent ones.
- **Cons:** if Path A is later used to summarize *non-client-captured* recordings (e.g.
  dial-in only), that path would need an `ai-router` call instead.
- **Ask:** confirm delete-vs-reroute before touching the webhook summarizer.

---

## 5. Sequencing
1. **0.1 copy fix** (XS, no-risk) — ship immediately; removes the active false promise.
2. **0.2 RLS** (M, gated) — highest trust impact; before any multi-user/client use.
3. **0.1 persistence** (Path B recommended; Path A fast-follow).
4. **1.2 screen-share** (S) — bundle with any in-call edit.
5. **1.3 provenance chip** (XS), **1.1 optimism** (XS) — opportunistic in-file polish.
6. **1.4** — only with 0.1 Path A; else defer/hygiene-delete (gated).

Each lands as its own conventional commit on `main` (`fix(meetings): …` / `feat(meetings):
…` / `refactor(meetings): …`), `Co-Authored-By` per harness convention.

## 6. End-to-end verification checklist
- [ ] **Transcript fix proof (pre-existing fix, unverified live):** run a real meeting
      with transcription on; confirm `pulse_video_rooms.transcript` persists **non-empty**
      and a summary is generated from it.
- [ ] **0.1:** recorded meeting → `recording_url` populates within 2–5 min → Recordings
      modal plays it + download works.
- [ ] **0.1 copy:** empty Recordings state shows accurate copy (no false Auto-Recording
      promise).
- [ ] **0.2:** non-owner cannot SELECT another room's transcript/summary/recording_url;
      deep-link join still resolves `room_url`.
- [ ] **1.2:** denying the screen-share picker shows a toast and leaves state consistent.
- [ ] **1.3:** Recordings-modal summary detail shows the coral provenance chip.
- [ ] `npx tsc --noEmit` shows **no NEW** errors (repo has ~1234 pre-existing; gate on
      delta, use `NODE_OPTIONS=--max-old-space-size=8192`).

## 7. Open decisions for the user
1. **0.1 path:** Path B (recommended) vs Path A vs both?
2. **0.2:** approve the drop-`authenticated_read` + RPC plan (Rule A)?
3. **1.4:** reroute vs delete the webhook summarizer (only relevant if 0.1 Path A)?
4. **1.3 copy:** add an explicit "verify" nudge, or provenance chip alone?

## 8. Wire-in
- **0.1, 0.2** are launch-blocker candidates for
  [`docs/PULSE_PRELAUNCH_ROADMAP.md`](PULSE_PRELAUNCH_ROADMAP.md) (epic **#98**, label
  `launch-roadmap`) — file via `/launch-prep`, or hand the section to `/section-deep-dive`.
- Honesty-pass precedent: commit `b045d65` (gate Breakout) +
  `docs/MEET_MATE_DISPATCH_HANDOFF_2026-06-11.md` — gate/scope what isn't real rather than
  ship a dishonest button. Apply the same to Recordings (0.1 interim relabel).

---

*Drafted from a read-only re-verification (live DB + live edge-function API + full code
read, project `ucaeuszgoihoyrvhewxk`, 2026-06-16). No code or schema changed. Destructive
items (0.2, 1.4) require explicit per-change approval before execution per `CLAUDE.md`
Rule A.*
