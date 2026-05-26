# Pulse Pre-Launch Roadmap (Living Document)

**Created:** 2026-05-25 · **Owner:** solo (Aegis{FM}) · **Tracking epic:** [#98](https://github.com/FatherSonOne/Pulse-1/issues/98)
**Worked by:** the `/launch-prep` slash command — see [How the agent uses this doc](#how-the-agent-uses-this-doc).

> **Organizing principle (decided 2026-05-25): ship only what is real; feature-flag or hide the rest for v1.**
> The biggest launch risk is not any single gap — it is *truth-in-product*: showing a UI that advertises features (SMS, push, enrichment, meeting AI) that don't actually work. That erodes trust on day one. Every roadmap item serves either "make it real" or "stop showing what isn't."

This document is the single source of truth for launch readiness. It is **living**: the `/launch-prep` agent updates the [Status Table](#status-table) and [Resume Pointer](#resume-pointer) after every issue it completes, so the next run picks up where the last left off.

---

## How the agent uses this doc

`/launch-prep` runs **one issue per invocation**:

1. Read this doc (especially the [Resume Pointer](#resume-pointer) and [Status Table](#status-table)).
2. `gh issue list --label launch-roadmap --state open` → pick the highest-priority **unblocked** issue (P0 → P1 → P2; respect the **Depends-on** column).
3. Implement it on `main` per `CLAUDE.md` git discipline (commit each unit, conventional commits, `Co-Authored-By` trailer; **never branch without asking**; **pause-and-verify** any uncommitted work it didn't author).
4. On completion: comment on the issue with what shipped + evidence, close it (or mark `status: blocked` with the blocker), then update the [Status Table](#status-table) row and the [Resume Pointer](#resume-pointer) in this doc and commit that.
5. Report a short summary and stop. (One issue per run keeps history readable and lets the human review between steps.)

If the chosen issue turns out to be a product decision rather than a code task (e.g. CALEA legal read, E2EE positioning), the agent drafts the decision doc + options and asks the human rather than guessing.

---

## Audit summary (the 11 questions)

1. **Market.** Sits across Unified Communications & Collaboration (~$113–186B 2025, ~28% CAGR to ~$634B by 2030), team-messaging, and "work hub." The Western "everything app" thesis is unproven — treat all-in-one as a *convenience wedge*. Honest home: **AI-native unified comms hub for SMB teams + customer-facing roles.**
2. **Competitors.** Slack/Teams/Discord (chat), Voxer (PTT), Front/Missive/Spike (shared inbox), Beeper/Texts (unified messaging), Notion/ClickUp (work hub), Superhuman (AI email). **AI is table stakes** — everyone ships summaries + smart compose.
3. **Retention.** Headline = **DAU/MAU stickiness** (messaging 50–70%, collab 25–45%, Slack ~40–60%). Plus D1/D7/D30 curves, churn/NRR. **Key finding:** stickiness is a *multiplayer* property — Slack teams at ~2,000 messages hit 93% weekly retention; solo users barely retain.
4. **Launch-ready when:** every advertised surface works E2E; integration layer runs in prod (not localhost); SMS is 10DLC + TCPA compliant; email + push actually deliver; GDPR/CCPA + ToS live; retention instrumentation wired; team-activation onboarding exists.
5. **Under the hood.** **Productivity core is genuinely real:** Decisions+voting, Tasks/Subtasks, Contacts + vCard cards, Calendar (Google/Outlook + RRULE + booking), **Billing** (production-grade, 9 edge fns), Auth/MFA/biometric, **Relay voice** (4 modes + transcription), **Maps** (~85% real), Search, disciplined **AI-router**. **Comms-aggregation pitch is where demo ≠ reality** — see [Capability Matrix](#capability-matrix).
6. **First-use wow (real today):** one inbox + AI thread summaries, Relay async voice, vCard contact cards, Decisions voting, Maps route/week AI, cross-surface `Ctrl+/` assistant. Risk = hitting mocked SMS / never-arriving push right after.
7. **Gap vs competitors.** Jack-of-all-trades depth deficit; multiplayer cold-start ×N surfaces; switching costs; notification fatigue (funneling more channels in can amplify it).
8. **Close the gap.** Lead with cross-surface AI; make consolidation genuinely reduce switching+notifications; activate teams not individuals; ship only what's real; pick a v1 lane.
9. **Differentiators.** Cross-surface AI over one data model; Relay voice modes bundled with productivity; vCard contact cards; Decisions-with-voting; maps intelligence inside comms; disciplined metered AI-router + real billing.
10. **Risks.** SMS (10DLC blocking + TCPA $500–1,500/text + one-to-one consent Jan 27 2026); GDPR/CCPA + residency; CALEA (voice/video VoIP?); E2EE-vs-server-AI trust tension; deliverability; vendor lock-in (Twilio/Daily/Supabase); ~99.9% uptime bar; moderation/abuse.
11. **Else.** Follows the repo's existing issue convention (epic + `priority:*` + `type:*` + section labels). Truth-in-product is the through-line.

Full market evidence (with source URLs) and code evidence (file:line) are captured in the individual GitHub issues.

---

## Capability Matrix (verified 2026-05-25)

✅ REAL (works E2E) · 🟡 PARTIAL · 🔴 STUB / mocked / unwired

| Surface | Verdict | Note |
|---|---|---|
| Decisions + voting, Tasks, Subtasks | ✅ | DB-backed + AI decision wizard |
| Contacts + vCard contact-card sharing | ✅ | Differentiated; full edge-fn suite |
| Calendar (Google/Outlook, RRULE, booking) | ✅ | Token refresh via the deployed Render backend (#99) |
| Billing (Stripe) | ✅ | Production-grade; 9 edge functions |
| Auth / MFA / biometric | ✅ | Supabase OAuth + TOTP + WebAuthn |
| Relay voice (Direct/Channel/Broadcast/Notes) | ✅ | Real storage + tables + multi-provider transcription |
| Maps / location | ✅ (~85%) | geocode/directions/distance + real geofencing + AI route proposals |
| Unified Search | ✅ | Multi-source Supabase queries |
| AI features (summaries, compose, autopilot, RAG) | ✅ | All via metered `ai-router`, no client keys |
| Video meetings (Daily.co) | ✅ | `daily-rooms` edge fn |
| Unified Inbox | 🟡 | Aggregation real; Slack feeder now routes to the deployed backend (#99, route+CORS verified, live smoke pending); SMS hidden for v1 (#100); email/Pulse not auto-synced in |
| Email (Gmail) | 🟡 | Send real; token refresh via the deployed backend (#99, route verified, live refresh smoke pending) |
| CRM sync | 🟡 | Real API calls but no pagination (#108); OAuth still **not functional server-side** — `oauthHelper`/`crmService` import the browser-only `supabase` client, needs a service-role refactor (#99 remainder). Frontend client-id bug fixed (`f6d9119`) |
| Post-meeting AI | 🟡 | Outsourced to Entomate |
| Native Android / Electron | 🟡 | Builds exist; **Android unsigned** |
| **In-app SMS** | 🔴 → hidden | **100% mocked** (`smsService.isMockMode → true`); **gated OFF for v1** behind `inAppSms` flag (#100, `f1b9e49`). Real wiring tracked in #120 |
| **Push notifications** | 🔴 → code-ready | Sender built (#101, `713476f`): `send-push` VAPID dispatcher + wired to search alerts. **Inert until the human deploys it + sets VAPID secrets** (see `send-push/README.md`). Flag the push UI off if launching before that |
| Email campaigns | 🔴 (unsafe) | Naive per-recipient loop → spam-flag risk |
| "Contact enrichment" | 🔴 (mislabeled) | Internal dedup, no external data source |

**The latent blocker behind several rows is mostly resolved (2026-05-26):** the second backend (`server.js`, Express) is now **deployed on Render** at `https://pulse-api-1epw.onrender.com` (`npm run server`, `$PORT`-aware, health check at `/api/health`), and the frontend is rebuilt with `VITE_BACKEND_URL` pointing at it (verified inlined in the deployed bundles). The Slack/Twilio/Gmail/health routes are **mounted, input-validating, and CORS-correct** for `pulse.logosvision.org`; **live-account round-trips (real Slack channels / Gmail refresh) are pending a UI smoke test**. **Two pieces remain deferred:** (1) **CRM OAuth** can't run server-side — `oauthHelper`/`crmService` import the browser-only `supabase` client (`import.meta.env`), so the `/api/crm/callback` path throws until refactored onto the service-role client; (2) the **Logos Vision contacts-import** Google flow hardcodes a `localhost:5176` redirect and is LV-secret-gated. → [#99](https://github.com/FatherSonOne/Pulse-1/issues/99).

---

## Status Table

Statuses: `open` · `in-progress` · `blocked` · `done`. The agent edits the **Status** and **Notes** cells as it works.

### P0 — Launch blockers (working core)

| # | Title | Priority | Depends on | Status | Notes |
|---|---|---|---|---|---|
| [#99](https://github.com/FatherSonOne/Pulse-1/issues/99) | Deploy server.js backend + remove hardcoded localhost:3003 | critical | — | in-progress | **Deployed** on Render (`pulse-api-1epw.onrender.com`) via `render.yaml` Blueprint (`90b922d` PORT, `c293bfe` Blueprint, `f6d9119` CRM client-id). `VITE_BACKEND_URL` set in Vercel + verified inlined. Slack/Twilio/Gmail/health routes + CORS verified. **Remaining:** live-account round-trip smoke (user-driven); CRM server-side refactor (browser-supabase coupling) + LV-bridge localhost redirect deferred to follow-ups |
| [#100](https://github.com/FatherSonOne/Pulse-1/issues/100) | Flag/hide the mocked in-app SMS surface for v1 | critical | — | done | `f1b9e49` — `inAppSms` flag OFF; nav hidden + route redirects to Dashboard. Follow-up #120 owns real wiring |
| [#101](https://github.com/FatherSonOne/Pulse-1/issues/101) | Build push dispatch path (or flag push off) | critical | — | blocked | Sender built (`713476f`): `send-push` edge fn + wired to alerts. Blocked on **human**: VAPID keys + secrets + deploy + live test (see `send-push/README.md`) |
| [#102](https://github.com/FatherSonOne/Pulse-1/issues/102) | Transactional email deliverability — verified domain | critical | — | open | Owner-only default sender |
| [#103](https://github.com/FatherSonOne/Pulse-1/issues/103) | Android release signing (keystore) | high | — | open | Blocks Play upload |

### P1 — Truth-in-product

| # | Title | Priority | Depends on | Status | Notes |
|---|---|---|---|---|---|
| [#104](https://github.com/FatherSonOne/Pulse-1/issues/104) | Feature-flag audit — gate every non-real surface | high | — | open | Inventory + flags |
| [#105](https://github.com/FatherSonOne/Pulse-1/issues/105) | Email campaigns — flag for v1 (or harden) | high | — | open | Spam-flag risk |
| [#106](https://github.com/FatherSonOne/Pulse-1/issues/106) | Post-meeting AI — own it or relabel Entomate handoff | high | — | open | |
| [#107](https://github.com/FatherSonOne/Pulse-1/issues/107) | Relabel 'contact enrichment' (it's dedup) | medium | — | open | |
| [#108](https://github.com/FatherSonOne/Pulse-1/issues/108) | CRM sync pagination (limit:100 one-shot) | medium | #99 | open | |

### P1 — Compliance / legal

| # | Title | Priority | Depends on | Status | Notes |
|---|---|---|---|---|---|
| [#109](https://github.com/FatherSonOne/Pulse-1/issues/109) | SMS — A2P 10DLC + TCPA one-to-one consent | high | — | open | Gates real SMS |
| [#110](https://github.com/FatherSonOne/Pulse-1/issues/110) | CALEA determination for voice/video | medium | — | open | Legal read |
| [#111](https://github.com/FatherSonOne/Pulse-1/issues/111) | GDPR/CCPA data-rights + residency | high | — | open | DSAR + region pin |
| [#112](https://github.com/FatherSonOne/Pulse-1/issues/112) | ToS / Privacy / moderation + abuse review | high | — | open | |
| [#113](https://github.com/FatherSonOne/Pulse-1/issues/113) | E2EE positioning decision | medium | — | open | Server-AI tradeoff |

### P2 — Quality / reliability

| # | Title | Priority | Depends on | Status | Notes |
|---|---|---|---|---|---|
| [#114](https://github.com/FatherSonOne/Pulse-1/issues/114) | TS error burndown + CI no-new-errors gate | medium | — | open | ~1,234 baseline |
| [#115](https://github.com/FatherSonOne/Pulse-1/issues/115) | Integration test coverage (billing/video/calendar/CRM/push/SMS) | medium | — | open | |
| [#116](https://github.com/FatherSonOne/Pulse-1/issues/116) | Observability + SLOs | medium | — | open | Sentry already in deps |

### P2 — Growth / activation / positioning

| # | Title | Priority | Depends on | Status | Notes |
|---|---|---|---|---|---|
| [#117](https://github.com/FatherSonOne/Pulse-1/issues/117) | Retention instrumentation + define NSM | high | — | open | PostHog already in deps |
| [#118](https://github.com/FatherSonOne/Pulse-1/issues/118) | Team/multiplayer activation onboarding | high | — | open | First-30-days |
| [#119](https://github.com/FatherSonOne/Pulse-1/issues/119) | Sharpen positioning — cross-surface AI; pick v1 lane | medium | — | open | |

---

## Suggested sequencing

1. **#99** first — it unblocks the most surfaces (Slack/Twilio/Gmail/CRM) and is the single biggest demo-vs-reality gap.
2. Then the rest of P0 (**#100–#103**) — each independently makes the shipped surface honest or shippable.
3. P1 truth-in-product (**#104** drives the others) in parallel with P1 compliance reads (**#109–#113** — several are decisions, not code).
4. P2 quality + growth last, but **#117** (instrumentation) is worth pulling early so launch metrics exist from day one.

---

## Resume Pointer

> **The agent updates this block after every run.** It is the first thing the next run reads.

- **Last issue worked:** [#99](https://github.com/FatherSonOne/Pulse-1/issues/99) — `server.js` backend **deployed** on Render via `/backend-setup` walk-through (`90b922d`/`c293bfe`/`f6d9119`); proxies reachable + frontend wired; CRM/LV server-side bits deferred.
- **Last run (date):** 2026-05-26 — #99 backend deploy: `$PORT`-aware server, `render.yaml` Blueprint, CRM client-id fix; Render service `pulse-api-1epw.onrender.com` live (health/Slack/Twilio/Gmail routes + CORS verified); `VITE_BACKEND_URL` set in Vercel + verified inlined. Live-account round-trips pending user smoke.
- **Next up:** [#102](https://github.com/FatherSonOne/Pulse-1/issues/102) — Transactional email deliverability — verified sending domain (P0 critical, unblocked; note it's labeled `documentation` — likely a config/DNS + copy task, possibly part-decision). After that: #103 (Android signing), then P1 (#104 feature-flag audit drives the rest).
- **Open blockers / decisions waiting on the human:**
  - **#99 backend — DEPLOYED** on Render (`pulse-api-1epw.onrender.com`) + `VITE_BACKEND_URL` wired in Vercel. Remaining: (a) **user-driven live round-trip smoke** (connect Slack / load channels / Gmail refresh from `pulse.logosvision.org`); (b) **CRM OAuth server-side refactor** — `oauthHelper`/`crmService` import the browser-only `supabase` client, so `/api/crm/callback` can't run server-side (separate follow-up — unblocks #108); (c) LV contacts-import Google flow hardcodes `localhost:5176` redirect.
  - **#101 push deploy** — generate VAPID keypair, set `VAPID_*` + `PUSH_DISPATCH_SECRET` secrets, set `VITE_VAPID_PUBLIC_KEY` in Vercel, update `pwa_settings`, `supabase functions deploy send-push`, live browser test. Runbook: `supabase/functions/send-push/README.md`. ⚠️ Until done, push is inert — flag the PWA push UI off if launching first.
- **Notes for next run:** Re-read the Status Table first. #99 backend is **deployed** (proxies reachable; live smoke + CRM refactor remain) — no longer skip-blocked. #101 still `blocked` on human deploy; #100 done. Take #102 (email deliverability). It's tagged `documentation` so it may be a verified-domain/DNS + sender-config task with a decision component (which domain to send from — relates to the logosvision.org→qntmecos.com hosting question in memory `project_qntm_ecos_attribution`); if it's purely a human DNS/provider action, draft the runbook + decision and ask rather than guessing. Note: the `OAuthConfiguration.tsx:89` `process.env[...]` bug is **fixed** (`f6d9119`, now `import.meta.env`).

---

## Changelog

- **2026-05-25** — Roadmap created; audit captured; labels `launch-roadmap` + `compliance` added; Epic #98 + issues #99–#119 opened; `/launch-prep` command added.
- **2026-05-25** — #99 code half shipped (`7919edb`): all `localhost:3003` frontend references routed through a single env-driven `BACKEND_URL` helper (`src/config/backend.ts`); slack/twilio/CRM-OAuth de-hardcoded, gmail/contacts/email migrated onto the helper. #99 marked `blocked` on the human-owned deploy (host + `VITE_BACKEND_URL` + provider redirect-URI registration + round-trip verification). Added `/backend-setup` slash command to guide the human through that deploy.
- **2026-05-26** — #100 done (`f1b9e49`): in-app SMS surface gated OFF for v1 behind the new `inAppSms` feature flag (nav entry hidden, `AppView.SMS` route redirects to Dashboard, mock-mode badge unreachable). Real Twilio wiring + flag flip tracked in new follow-up #120 (depends on #99 backend + #109 10DLC).
- **2026-05-26** — #101 sender built (`713476f`): new `send-push` edge function (VAPID Web Push from `push_subscriptions`, secret-guarded, auto-deactivates gone subs) + best-effort wiring into `check-search-alerts` + fixed client public-key fallback (`settings`→`pwa_settings`). Marked `blocked` on the human-owned deploy (VAPID keypair + secrets + Vercel env + `pwa_settings` update + `supabase functions deploy` + live browser test; runbook in `send-push/README.md`).
- **2026-05-26** — #99 backend **DEPLOYED** via `/backend-setup` walk-through. `server.js` made `$PORT`-aware (`90b922d`), added `render.yaml` Blueprint (`c293bfe`, native Node, `npm ci --omit=dev`, health check `/api/health`), fixed CRM frontend client-id bug (`f6d9119`, `process.env`→`import.meta.env`). Hosted on Render at `https://pulse-api-1epw.onrender.com` (free plan; recreated as a Blueprint after the root frontend `Dockerfile` was auto-detected and built the wrong artifact). `VITE_BACKEND_URL` set in Vercel + redeploy verified (URL inlined in `svc-email`/`feature-messages` bundles). Verified: `/api/health` 200, Slack/Twilio/Gmail proxies mounted + input-validating, CORS allows `pulse.logosvision.org`. **Deferred (kept #99 open):** live-account round-trip smoke (user-driven); CRM OAuth server-side refactor (`oauthHelper`/`crmService` import the browser-only `supabase` client — blocks #108); LV contacts-import `localhost:5176` redirect.
