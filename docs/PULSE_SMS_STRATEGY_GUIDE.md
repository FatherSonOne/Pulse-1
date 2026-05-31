# Pulse SMS Strategy — What (if anything) to Pursue Pre-Launch

**Created:** 2026-05-30 · **Status:** ✅ **DECIDED 2026-05-30 — Option 1 (defer SMS to v1.1)** · **Owner:** solo (Aegis{FM})

> **DECISION (2026-05-30, operator):** **Option 1 — SMS is a post-launch (v1.1+) item.** Keep it hidden (#100) and out of copy (#124); leave #109 + #120 in the backlog. Launch with Email + Relay + Unified Inbox carrying the "Signal" pillar. The truth-in-product debt was already paid by #100 + #124, so no further SMS work is needed for v1. The 10DLC clock is **not** started now; if SMS becomes a committed v1.1 capability later, the first action is the human `/launch-followups` registration (Option 3), and #120 code follows once the number clears.
**Prompted by:** *"In the review there were a lot of pressure points around the lack of SMS in Pulse — what part would benefit from pursuing this gap now?"*
**Related issues:** [#100](https://github.com/FatherSonOne/Pulse-1/issues/100) (done — hide mock), [#124](https://github.com/FatherSonOne/Pulse-1/issues/124) (done — de-copy), [#109](https://github.com/FatherSonOne/Pulse-1/issues/109) (open, `high` — 10DLC/TCPA compliance), [#120](https://github.com/FatherSonOne/Pulse-1/issues/120) (open, `medium` — real wiring)

---

## TL;DR recommendation

> **Do NOT build real SMS sending (#120) for v1.** Its critical path is a **regulatory gate with weeks of lead time** (#109 — A2P 10DLC brand+campaign registration) that no code can shortcut, and building the wiring before that clears produces rotting code behind a flag that can't legally flip. **The review's SMS pressure was about *advertising a fake feature* — and that is already fully resolved** by #100 (surface hidden) + #124 (removed from pricing/FAQ). The honest "Signal" story for v1 leans on the channels that are real (Email, Relay voice, Unified Inbox).
>
> **The only SMS work that genuinely benefits from being started now is a *business decision + a long-lead-time registration*, not code:** decide whether SMS is a committed **v1.1** capability, and if yes, **kick off the 10DLC registration immediately** (carrier vetting is the bottleneck, ~1–8 weeks, costs money, needs a registered legal entity — Quantum Ecosystems LLC) so the clock runs in parallel with launch. That's a `/launch-followups` human task.
>
> **One optional small real slice exists** (see Option 2): the `twilioService → Unified Inbox` **read path is already real code** and is the compliance-lightest piece — *receiving* a customer's text into the inbox does not require 10DLC the way outbound campaigns do. If "SMS" must mean *something* real at launch, "inbound texts appear in your unified inbox" is the only honest, near-term candidate — but even replying touches outbound rules, so treat it carefully.

---

## Why the pressure exists — and what actually relieves it

The 2026-05-29 review's Skeptic voice led with SMS: *"A beautiful UI with a `setTimeout` where its SMS should be"* (`smsService.isMockMode → true`; "delivery" is a `setTimeout`; no Twilio in the in-app path). The R-03 finding: **"In-app SMS 100% mocked, advertised in pricing/FAQ."**

Read precisely, the pressure is **not "Pulse must ship SMS."** It is **"Pulse must stop *pretending* it has SMS."** Two different cures:

| Cure | Status | Effect on the review pressure |
|---|---|---|
| **Stop advertising it** (hide surface + remove from copy) | ✅ **DONE** — #100 (`inAppSms` OFF, nav hidden, route redirects) + #124 (SMS removed from "What is Pulse?", both pricing tiers, FAQ) | **Resolves R-03 entirely.** A stranger logging in no longer sees a fake feature or pays for a phantom "500 SMS/mo." |
| **Actually build it** | 🔴 blocked on a regulatory gate | Does *not* relieve the launch pressure faster than honesty does, and reintroduces risk |

**So the truth-in-product debt is already paid.** Anything further on SMS is now a *product roadmap* question (do we want this capability, and when), not a *launch-blocker* question.

---

## The two SMS surfaces (important — they have different gates)

A repo audit shows the codebase already separates two things that "SMS" colloquially blurs:

1. **In-app SMS app** — `src/services/smsService.ts` (mock: in-memory arrays, `isMockMode()` hardcoded `true`) + `src/components/SMS/*`. This is the **outbound conversational sender**. It is the thing #120 would wire to real Twilio, and it is squarely blocked by #109 (outbound A2P 10DLC).
2. **Twilio → Unified Inbox feeder** — `src/services/twilioService.ts` is **real code**: it proxies through the deployed Render backend (`${BACKEND_URL}/api/twilio/proxy`, #99) with `getMessages()` / `testConnection()` / `getMessageCount()`. This is a **read/aggregate** path, and #100's own acceptance explicitly allowed it to remain ("The real `twilioService` → Unified Inbox path may remain, gated on the deployed backend").

The regulatory wall (#109) sits almost entirely in front of **surface #1's outbound traffic**. Surface #2 (reading inbound) is materially less gated.

---

## The hard gate: why #120 can't be a pre-launch code task

#109's facts (from the issue): **US carriers block 100% of unregistered 10DLC traffic** (since Feb 2025); **TCPA damages are \$500–\$1,500 per text**; the **FCC one-to-one consent rule** is in force. Registration is **A2P brand + campaign with The Campaign Registry** — a process that needs a registered business, money, and **weeks of carrier vetting**. None of that is code, and #120's own acceptance says *"Do NOT flip the flag on before #109 clears."*

**Therefore:** writing the #120 wiring now = code that sits behind an OFF flag for an unknown number of weeks, drifting against the backend and Twilio SDK, with its consent/STOP/HELP logic untestable end-to-end until a registered number exists. Low leverage, real rot risk. This is the textbook case the roadmap's "ship only what's real" principle was written for.

---

## Options

### Option 1 — Status quo: SMS is a post-launch (v1.1+) item; do nothing more now  ⭐ recommended for v1 scope
Keep SMS hidden (#100) and out of copy (#124). Leave #109 + #120 in the backlog. Launch with Email + Relay + Unified Inbox carrying the "Signal" pillar.
- ✅ Zero risk, zero rot, fully honest. Matches every decision already made.
- ✅ Frees the runway for genuinely launch-gating work (#99 CRM remainder, #116 observability, #115 QA).
- ⚠️ "Signal" pillar stays one channel short; some prospects will ask "where's SMS?" — answered with an honest "on the v1.1 roadmap."

### Option 2 — Ship the *inbound* read slice only (compliance-light), label outbound "coming"
Keep outbound OFF; smoke-test + surface the **real `twilioService` inbound → Unified Inbox** path so customer texts *appear* in the inbox (read-only / conversational-reply). This is the one near-term slice that can be real.
- ✅ Gives the "Signal" promise a real SMS touchpoint without 10DLC campaign registration for outbound blasts.
- 🟡 Needs live Twilio creds on the backend (#99 dependency) + a careful compliance read: *receiving* is fine, but *replying* is still outbound A2P — so frame it as inbound-visibility, not a two-way campaign tool, until #109.
- 🟡 Real but small scope; still leaves the in-app sender (#120) OFF.
- **Verdict:** the only defensible "pursue a real piece now" path — but it's modest, and arguably still post-launch polish.

### Option 3 — Pursue the compliance critical path now (start #109 registration), build #120 later
Treat SMS as a committed v1.1 capability: **start the 10DLC brand+campaign registration immediately** (because lead time is the bottleneck), then schedule #120 code once the number clears.
- ✅ Correct sequencing if SMS *is* a strategic must-have — starts the long clock in parallel with launch.
- 🔴 The actionable "now" piece is **human/business** (register the brand, pay, wait), not `/launch-prep` code → belongs in `/launch-followups`.
- 🔴 Only worth it if the business has decided SMS is a real differentiator worth the carrier fees + ongoing compliance burden. Pulse's moat (per the audit) is cross-surface **AI**, not being another SMS app.

### Option 4 — Build the #120 wiring now anyway
Write the real `smsService` + consent/STOP/HELP plumbing pre-launch.
- 🔴 Rejected. Rotting code behind a flag that can't flip; consent logic untestable without a registered number; fights "ship only what's real." Pure cost, no launch benefit.

---

## Recommendation

**Adopt Option 1 for v1** (SMS stays a v1.1 item; the truth-in-product debt is already paid by #100 + #124). **Escalate the *decision* in Option 3** to the human as a business call: *is SMS a committed v1.1 capability?* If **yes**, the single highest-leverage action available **now** is to **start the #109 10DLC registration** (via `/launch-followups`, because it's human + long-lead-time) so it isn't the thing that gates v1.1 three months from now. **Option 2** is available as a small, honest "make one real SMS touchpoint" slice if you want SMS to mean *something* at launch, but it is not required and depends on live Twilio creds.

**What does NOT benefit from being pursued now:** the #120 code (real outbound wiring) — it's the *last* step, not the first, and doing it early just creates rot.

### If the human picks an action, here's where it routes
- **"SMS is v1.1, start the clock"** → `/launch-followups` task: register A2P brand + campaign with The Campaign Registry (Quantum Ecosystems LLC); document opt-in/STOP/HELP policy (#109 acceptance). *Not a `/launch-prep` code run.*
- **"Do the inbound read slice"** → a `/launch-prep`-able code task (Option 2): smoke + surface `twilioService` inbound into the Unified Inbox, gated on live backend creds; keep outbound OFF. Would need its own scoped issue (or fold into #120 as a phase 1 "inbound-only").
- **"Defer entirely"** → no action; #109/#120 stay in the backlog; this guide records the rationale.

---

## Changelog
- **2026-05-30** — Guide created (`/launch-prep` strategy run). Mapped the two SMS surfaces (mock in-app sender vs real `twilioService` inbox feeder), established that the review's SMS pressure (R-03) is already resolved by #100 + #124, and that #120's critical path is the human/long-lead-time #109 10DLC registration. Recommended Option 1 (defer to v1.1) + escalated the v1.1-commitment decision to the human.
- **2026-05-30** — **DECIDED: Option 1 (defer to v1.1)** (operator). No further SMS work for v1; #109/#120 stay backlogged with this guide as the recorded rationale. 10DLC clock intentionally not started.
</content>
