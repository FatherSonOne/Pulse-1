# Pulse — Fix-Before-Launch Punch List (Skeptic's cut)

**Source:** [`PULSE_REVIEW_AUDIT_2026-05-29.md`](./PULSE_REVIEW_AUDIT_2026-05-29.md) · **Companion:** [`PULSE_PRELAUNCH_ROADMAP.md`](./PULSE_PRELAUNCH_ROADMAP.md)

> **Artifact (a)** of the 2026-05-29 review. This is the critical reviewer's findings turned into a prioritized, evidence-anchored launch gate. It does **not** invent parallel tracking — every item points at a real `launch-roadmap` issue (existing or the two net-new ones). The organizing principle is the roadmap's own: *ship only what is real; stop showing what isn't.*

Severity key: 🚨 **blocker** (a stranger hits this in the first session and loses trust) · ⚠️ **integrity** (honest-product / multiplayer correctness) · 🔧 **debt** (won't be seen day-one but compounds).

---

## 🚨 P0 — Blockers (truth-in-product on the surfaces a new user sees first)

### P0-1 · Public copy advertises features that don't exist → **#124**
The legal copy was fixed in #112; the *marketing* copy wasn't. A reviewer (or a regulator) reading the public site finds claims the product can't back.

| Claim | Where | Reality | Fix |
|---|---|---|---|
| "End-to-end encryption" / "Message Encryption (End-to-end)" | `README.md:132,423` | No E2EE. Server-side AI requires plaintext. #113 (the positioning decision) is **open**. | Remove the claim; replace with the honest "encrypted in transit (TLS) + at rest" line once #113 lands. |
| "React 19.0" badge + stack | `README.md:12,165` | Ships `react@^18.2.0` (`package.json:167`). | Correct to 18.2 (or bump deliberately). |
| FAQ: "ElevenLabs… OpenAI Whisper and AssemblyAI" | `landingData.ts:10,43` | **Dropped from Privacy §5 in #112** — "zero server-side evidence." | Reconcile to the actually-wired set: **Gemini + Claude + OpenAI**. |
| FAQ: "Support staff cannot read your message content" | `landingData.ts:48` | Server-side AI processes plaintext content. | Qualify per the #113 decision; align to the corrected Privacy Policy. |
| SMS in pricing/FAQ ("500 SMS/mo") | landing pricing strip + FAQ | `inAppSms` OFF (#100); `smsService.isMockMode → true`. | Remove SMS from headline copy/pricing until #109/#120 make it real, or label "coming v1.1". |

**Deliverables:** honest README ([draft](./PULSE_README_HONEST_DRAFT_HANDOFF_2026-05-29.md)) + FAQ/landing reconcile. **Sibling to #104** (which gated the *in-app* surfaces; this is the *public-copy* equivalent). **Done when:** public copy contains zero claims contradicted by the Privacy Policy, `package.json`, or an OFF flag.

### P0-2 · Backend reliability floor → #116 (note R-09)
`pulse-api-1epw.onrender.com` is on Render's **free plan** — cold starts of tens of seconds on the path that powers Slack/Gmail/Twilio/CRM proxying. For a "comms hub," first-request latency after idle reads as "broken."
**Fix:** move to a warm tier **or** document an explicit cold-start SLO + a keep-warm ping, and set user-facing loading states accordingly. **Done when:** the integration proxy responds < 2s p95 from cold, or the SLO is written and the UI degrades gracefully.

---

## ⚠️ P1 — Integrity (honesty + multiplayer correctness)

### P1-1 · Reconcile Decisions "voting" → **#125**
`proposalMode` (decision capture + voting) is `enabled:false`, `targetUsers:['internal']`, `v0.1.0` (`featureFlags.ts:114-120`), yet the Capability Matrix says "Decisions + voting ✅" and the landing markets "From signal to action." Either voting is real for end users (then the flag/version is misleading) or it isn't (then the matrix + landing overclaim).
**Fix:** verify what an end user gets with the flag OFF; then ship `proposalMode` *or* qualify the matrix + landing copy. **Done when:** the claim and the shipped behavior match.

### P1-2 · Pick the v1 lane → #119
Landing = "high-performance teams"; `PRODUCT.md` = solo operator. Copy, onboarding (#118), and ASO can't cohere until one lane is chosen.
**Fix:** the `/launch-followups v1-lane` decision (recommended: **A — cross-surface AI hub**), then apply via [`PULSE_MARKETING_COPY_GUIDE.md`](./PULSE_MARKETING_COPY_GUIDE.md). **Done when:** `docs/PULSE_POSITIONING_GUIDE.md` exists and landing copy is updated to it.

### P1-3 · CRM OAuth server-side refactor → #99 remainder / #108
`oauthHelper`/`crmService` import the browser-only `supabase` client, so `/api/crm/callback` throws server-side. CRM is presented as connected; it isn't, end-to-end.
**Fix:** refactor onto the service-role client; add pagination (#108). **Done when:** a live CRM OAuth round-trip + paged sync works from production.

### P1-4 · E2EE positioning decision → #113
Gates P0-1's E2EE claim removal. Can't write honest crypto copy until the posture is decided.
**Fix:** `/launch-followups e2ee` (recommended: **Option A — server-side AI, no E2EE claim**). **Done when:** `docs/E2EE_POSITIONING_GUIDE.md` exists and the README/Privacy/marketing language aligns.

---

## 🔧 P2 — Debt (compounds, not first-session-visible)

| Item | Issue | Done when |
|---|---|---|
| TS error burndown + CI no-new-errors gate (~1,234 baseline) | #114 | CI fails on a *new* error; baseline trends down |
| Integration tests — billing / video / calendar / CRM / push / SMS | #115 | The money + comms paths have green E2E coverage |
| Observability + SLOs (incl. Render cold-start budget) | #116 | Sentry capturing prod errors; SLO dashboard live |

---

## Sequencing

1. **#124** first — it's the cheapest credibility win and the most visible lie. Pair with the honest-README draft already written.
2. **#113 → then finish #124's E2EE line.** (The crypto claim can't be rewritten honestly until the posture is picked.)
3. **#119 + #125 in parallel** — both are "make the claim match the build." #119 is a decision; #125 is verify-then-act.
4. **#99 remainder / #108**, then the P2 debt.
