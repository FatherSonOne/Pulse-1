# Pulse Observability & SLO Runbook

**Issue:** [#116](https://github.com/FatherSonOne/Pulse-1/issues/116) — Observability + SLOs for comms-grade reliability
**Owner:** solo (Aegis{FM}) · **Created:** 2026-05-31

> **Truth-in-product note.** This runbook honestly separates what is **shipped in code** (SLI
> instrumentation + SLO definitions) from what is **operator-owned** (uptime/status-page signup,
> alert-rule creation, vendor dashboards). The operator-owned items are NOT faked in-repo — they are
> concrete provider/config tasks with recommendations, listed in §6.

---

## 1. What's live today

| Layer | Tool | Where | Status |
|---|---|---|---|
| Error tracking + tracing + session replay | **Sentry** (`@sentry/react`) | `src/lib/monitoring/sentry.ts`, bootstrapped via `initializeMonitoring()` in `src/main.tsx` | **Live in prod.** `VITE_APP_MODE=production` set in Vercel 2026-05-28 (previously unset → `ENVIRONMENT==='development'` early-return at `sentry.ts:23` left it dormant). 10% traces, session replay (`maskAllText`/`blockAllMedia`). |
| Product analytics / retention | **PostHog** | `src/lib/monitoring/analytics.ts` | Live (#117). Trunk events: `$identify`, `Message Sent`, onboarding funnel. |
| Backend health | **Render** | `server.js` → `GET /api/health` at `https://pulse-api-1epw.onrender.com` | Live (#99). |
| Edge-function logs | **Supabase** | `supabase/functions/*` on project `pulse-chat` (`ucaeuszgoihoyrvhewxk`) | Dashboard logs available; no alerting wired (operator, §3.2). |

**New in this issue (#116):** the previously *defined-but-unused* Sentry helpers in `sentry.ts`
(`setUserContext` / `clearUserContext` / `captureError` / `addBreadcrumb`) are now wired into the three
trunk paths below, so the SLIs are actually measurable and errors are attributable to a user.

---

## 2. SLOs / SLIs

Targets are **v1, solo-operator-realistic** over a **28-day rolling window**. They are deliberately not
99.99% promises we can't measure — revisit after 28 days of real prod data (§6). Each SLI's signal is the
Sentry instrumentation added in #116 plus the existing PostHog events.

### 2.1 Message-send

- **SLI — success rate:** `1 − (failed sends / attempted sends)`. A failed send = the `catch` in
  `pulseService.sendMessage` firing (`captureError` with `surface=message-send`). The denominator is the
  PostHog `Message Sent` event count plus failures.
- **SLI — latency:** p95 of the `send_pulse_message` RPC round-trip, carried on the
  `message send` breadcrumb's `durationMs` (success and failure both stamped).
- **SLO:** success rate **≥ 99.5%**; **p95 < 1000 ms**.
- **Error budget:** 0.5% of sends / 28 days may fail.
- **Instrumentation:** `src/services/pulseService.ts` → `sendMessage`.

### 2.2 Auth (sign-in)

- **SLI — success rate:** valid sign-in attempts that succeed. A failure = the `catch` in
  `AuthContext.handleLogin` (`captureError` with `surface=auth`, `provider`). Note: routine
  bad-credential / cancelled-OAuth failures are noise — `sentry.ts`'s `beforeSend` already drops
  `cancelled` / network errors, so the captured set skews toward real auth-system failures.
- **SLI — latency:** p95 of `handleLogin` wall-clock (`durationMs` on the `sign-in succeeded/failed`
  breadcrumb). OAuth round-trips include provider redirect time, so the target is generous.
- **SLO:** valid-attempt success **≥ 99.9%**; **p95 < 2000 ms** (provider redirect included).
- **Error budget:** 0.1% of valid sign-ins / 28 days.
- **Instrumentation:** `src/contexts/AuthContext.tsx` → `handleLogin` (the single seam Google/Microsoft/Email funnel through).

### 2.3 AI-router latency

- **SLI — error rate:** `ai-router` edge-function calls that error (the `if (error)` branch in
  `invokeAI`, captured `surface=ai-router`, `task`).
- **SLI — latency:** p95 of the full client→edge→model round-trip (`durationMs` on the
  `ai-router call` breadcrumb). This is the metered router (server-side; no client keys), so latency
  includes provider inference time.
- **SLO:** error rate **< 2%**; **p95 < 6000 ms**.
- **Error budget:** 2% of AI calls / 28 days.
- **Instrumentation:** `src/services/ai/aiService.ts` → `invokeAI` (the single chokepoint all 29
  `geminiService` exports + `invokeAIJson` delegate through).

---

## 3. Alerting

### 3.1 Sentry alert rules (operator-owned — §6)

The captures above are tagged with a `surface` extra so rules can filter them. Recommended rules (create
in Sentry → Alerts; thresholds need a week of prod volume to calibrate):

| Alert | Condition (starting point) |
|---|---|
| Message-send failure spike | `surface=message-send` events > 1% of `Message Sent` volume over 1h |
| Auth failure spike | `surface=auth` events > 10 in 15m (tune to real sign-in volume) |
| AI-router error spike | `surface=ai-router` events > 2% of AI calls over 1h |
| Any new unhandled error type | first-seen issue → notify |

### 3.2 Supabase edge-function error rates (operator-owned)

Supabase dashboard → Logs → log-based alerts on `pulse-chat`. Watch `ai-router`, `send-email`,
`send-push`, `daily-webhook`, `delete-account` for 5xx rate. No code change — dashboard config.

### 3.3 External-vendor failures (operator-owned)

Subscribe to status pages / configure alerts: **Daily.co** (video), **Supabase** (DB/edge),
**Resend** (email), **Stripe** (billing). **Twilio** deferred until SMS v1.1 (#109). These are vendor
dashboards, not in-app.

---

## 4. Uptime monitoring + status page (operator-owned — §6)

No in-repo status page (would be a fake). Recommended: a hosted monitor (e.g. **Better Stack** or
**UptimeRobot** free tier) pinging:

1. Vercel frontend root (`https://pulse.logosvision.org`)
2. Render backend health (`https://pulse-api-1epw.onrender.com/api/health`)
3. A Supabase edge-function ping (e.g. a lightweight function or the REST health)

Attach the provider's hosted status page. ~15 min signup; the human owns it.

---

## 5. How to read the data day-to-day

- **Sentry → Issues**, filter `surface:message-send` / `surface:auth` / `surface:ai-router` for the
  error-rate SLIs; breadcrumbs on each event carry `durationMs` for latency spot-checks.
- **Sentry → Performance** (10% sampled traces) for route-level latency.
- **PostHog → `Message Sent`** for the send-success denominator + the NSM dashboards (#117).
- **Render / Supabase dashboards** for infra health.

---

## 6. Human follow-ups (close #116 when done)

- [ ] **Uptime + status page:** sign up for Better Stack / UptimeRobot; add the 3 monitors in §4; publish a status page.
- [ ] **Sentry alert rules:** create the §3.1 rules once ~1 week of prod error volume exists to calibrate thresholds.
- [ ] **Supabase edge-fn alerts:** configure §3.2 log-based alerts on `pulse-chat`.
- [ ] **Vendor alerts:** subscribe to Daily.co / Supabase / Resend / Stripe status (§3.3).
- [ ] **Revisit SLO targets** in §2 after 28 days of real data; tighten or loosen to match observed reality.
