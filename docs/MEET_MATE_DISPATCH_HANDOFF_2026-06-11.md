# Meet Mate Dispatch from Pulse — Handoff

**Status:** Deferred (scoped future phase). Not started.
**Created:** 2026-06-11
**Context:** Phase 3 of the Meetings honesty pass. Launch framing is "Pulse
Meetings = lightweight native rooms; serious notetaking routed to Entomate's
Meet Mate bot." This doc captures the real wiring required so the future phase
resumes cleanly, and records *why a "Send Meet Mate" button was deliberately
NOT shipped in the honesty pass*.

---

## TL;DR

A "Send Meet Mate to this meeting" control is **net-new on both sides** and
carries a **load-bearing consent contract**. It is too large for a
cosmetic-dishonesty cleanup, and shipping a button that can't fulfill its
promise would be the exact dishonesty Phase 3 removes. So:

- **Shipped now:** nothing for Meet Mate. The external-meeting flow already
  `window.open`s the real Zoom/Meet/Teams link, which is honest. The real
  *after-the-fact* path ("export a finished recording to Entomate" via
  `meeting.export`) already exists and is honest.
- **Deferred to this phase:** real live-bot dispatch, additive and reversible,
  consent-first.

---

## What exists today (verified)

### Pulse side — can export a recording, cannot dispatch a live bot

- `ecosystem-outbound` whitelists exactly 7 event types and hard-403s anything
  else: `supabase/functions/ecosystem-outbound/index.ts:67-78`.
- The only Entomate-targeted meeting event is `meeting.export`
  (`src/services/meetingService.ts:443`, payload built `:460-475`), fired
  post-room from the leave handler in `src/components/Meetings/Meetings.tsx`
  (`autoExportIfEnabled`). It carries a **finished** `audioUrl` / `transcript`,
  **no** live `meetingUrl` / `platform` / `join` field.
- External meetings dead-end at `window.open` and never touch the bridge:
  `Meetings.tsx` `handleLinkJoin` (external-link branch) and `startMeeting`
  (non-pulse branch). These genuinely open the real meeting; they are honest.
- No `meeting.bot` / `meeting.join` / `bot.dispatch` event exists anywhere.
  (`ecosystem-bot` is the **opposite** direction: Entomate → Pulse chat.)

### Entomate side — the dispatch is real, but locked behind consent + admin auth

- The bot dispatch is real and working: `launchBotSession()`
  (`backend/services/botOrchestrator.js:170`) POSTs to Recall.ai `/bot`
  (`:253`) with `meeting_url`, `bot_name='Meet Mate'`, and Deepgram config.
- It is reachable **only** via `POST /api/admin/bots/launch`
  (`backend/routes/bots.js:52`), which:
  - **hard-requires `consentAcknowledged === true`** (`:58`), and
  - is gated by `authenticate` (real user JWT) + `authorizeOrgRole(['owner','admin'])`.
- Entomate's inbound bridge
  (`supabase/functions/ecosystem-inbound/index.ts:123-176`) has **no**
  bot/dispatch branch (`default:` returns `handled:false`) and never parses a
  meeting URL (grep `meetingUrl|meeting_url|hangoutLink` = no matches). It also
  holds no user JWT / org-admin role, so it structurally **cannot** call the
  existing admin route.

---

## Gaps to real (both sides)

1. **Pulse outbound whitelist** — `meeting.bot_dispatch` (or `bot.dispatch`) is
   not on `ALLOWED_EVENTS` (`ecosystem-outbound/index.ts:67-78`); it would 403.
   Add one whitelist entry + the header doc.
2. **Pulse sender** — no method emits a *live* meeting URL. Add a helper
   carrying `{ meetingUrl, platform, title, workspaceId, consentAcknowledged }`
   through the existing outbound wrapper.
3. **Pulse trigger UI** — the natural surfaces (`handleLinkJoin`, `startMeeting`
   external branch) only `window.open` today. A "Send Meet Mate" action is
   net-new wiring there, **additive alongside** `window.open`, and must capture
   explicit consent before emitting.
4. **Entomate inbound** — `ecosystem-inbound` needs a net-new `handleBotDispatch`
   case that parses the meeting URL.
5. **Entomate auth gap** — inbound holds no user JWT / org-admin role, so it
   cannot call `/api/admin/bots/launch`. Add a net-new **service-auth** route
   (e.g. `apiKeyAuth`-guarded `/api/internal/bots/dispatch`, same pattern as
   `backend/routes/automations.js:554`) that wraps `launchBotSession` directly.
6. **Consent is load-bearing** — `routes/bots.js:58` enforces
   `consentAcknowledged === true` for human launches. A Pulse-triggered dispatch
   **must** carry and forward an explicit consent affirmation (who / when) or it
   silently drops Entomate's P1.7 legal control (see Entomate
   `COUNSEL_REVIEW_PACKET.md` / `CONSENT_JURISDICTIONS.md`). This is not
   optional and not a detail to hand-wave.

---

## Recommended shape (when this phase is picked up)

Additive and reversible, deleting nothing:

1. **Pulse:** add `meeting.bot_dispatch` to the outbound whitelist + an emit
   helper that sends `{ meetingUrl, platform, title, workspaceId,
   consentAffirmation }`.
2. **Pulse UI:** a "Send Meet Mate" action in the external-join surfaces that
   **first** captures an explicit consent affirmation (who is consenting, when,
   which jurisdiction copy was shown), then emits the event. Keep `window.open`
   as the plain "open the meeting" path.
3. **Entomate:** a `handleBotDispatch` inbound case + an `apiKeyAuth`-guarded
   `/api/internal/bots/dispatch` route forwarding the consent affirmation into
   `launchBotSession`.

### Alternative (smaller, also honest)

A deep-link that opens Entomate's own BotLauncher with the meeting URL
prefilled. This hands the user to the system that *can* dispatch (where consent
is captured natively) and never implies Pulse itself joins the bot. Still
small-wiring (needs an Entomate BotLauncher route that accepts a prefilled URL
param — verify it exists first), so it belongs in this phase, not the cleanup.

---

## Do NOT (honesty guardrails)

- Do **not** render a "Send Meet Mate to this meeting" / "Dispatch notetaker"
  control until a real path can fulfill it. A no-op or silently-failing button
  is the dishonesty this phase removed.
- Do **not** dress the working `window.open` external join as a bot dispatch.
- If a forward-looking entry point is wanted before the wiring exists, the only
  non-deceptive option is a disabled / "Coming soon" affordance with an explicit
  note that live-bot dispatch is not yet wired — same treatment as the gated
  Breakout Tools-menu item (`src/components/Meetings/TimeRail.tsx`).
