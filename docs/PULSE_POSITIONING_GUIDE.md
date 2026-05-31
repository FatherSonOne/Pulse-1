# Pulse Positioning Guide — Lead Message & v1 Lane (#119)

**Status: LANE A LOCKED + pricing structure DECIDED 2026-05-31 (solo-first).** Downstream execution (landing-copy swap, Stripe pricing implementation) files as its own issues. · **Created 2026-05-31** · Issue [#119](https://github.com/FatherSonOne/Pulse-1/issues/119) (`priority: medium`, `launch-roadmap`)

> **Operator decisions (2026-05-31):** **Lane A confirmed (solo-first cross-surface AI hub, team as on-ramp).** Pricing re-evaluated and decided — **Pulse Solo $20/mo (new hero tier), Team reframed to per-seat $15/seat (min 2), Growth $300 unchanged** (full model + COGS/break-even in `docs/PULSE_PRICING_UNIT_ECONOMICS_GUIDE.md`). Lead message + differentiator ranking below stand as locked. **Follow-ups (separate issues):** the landing-copy swap (adopt `PULSE_MARKETING_COPY_GUIDE.md` lane-A copy with the new prices) and the Stripe pricing implementation (catalog + plans/entitlements + billing UI).

> Drafted by `/launch-prep` as a decision, not code. It lays out the lead message, the v1-lane options, and a ranked differentiator list with a recommendation. **Nothing here is executed** until the operator picks a lane — at which point the landing copy (`PULSE_MARKETING_COPY_GUIDE.md`, already lane-A-shaped), onboarding (#118), and ASO can cohere. Pairs with `/launch-followups v1-lane`.

---

## The decision in one line

**Lead message:** *Pulse is one screen for every work conversation, with a cross-surface AI that summarizes, drafts, and triages over one data model — and shows its work on every line.*

**Recommended v1 lane: A — the cross-surface AI hub for the overloaded solo operator (and the one or two people they pull in).** Lead with the real, working core (productivity + voice + contacts + cross-surface AI); do **not** headline the half-real comms breadth (SMS is mocked/hidden #100; unified-inbox aggregation is partial).

---

## Why "cross-surface AI" is the only defensible lead (AC1)

"We have AI" is table stakes — Slack, Teams, Notion, Superhuman all ship summaries + smart compose. The defensible angle is the one a point tool **structurally cannot** replicate: **AI that reasons across surfaces because they sit on one data model.** A standalone email-AI can't see your Slack thread, your last voice note, the open Decision, or the contact's history; Pulse's can. That's the moat, and it compounds as more real surfaces land.

Two honesty rails on the lead message (locked by #112/#113/#124):
- **"Shows its work on every line"** — the AI-provenance chip pattern is a genuine differentiator *and* a trust signal. Keep it in the lead; it's the antidote to "generic AI startup."
- **No E2EE, no SMS-as-headline, no unowned vendors** — the copy guide is already constrained to claims that don't contradict the Privacy Policy / `package.json` / an OFF flag.

---

## The lane question — and the tension to resolve

The product has a **documented identity split** (review finding R-07):

| Source | Who it's for |
|---|---|
| `PRODUCT.md:7-13` (the build) | **The overloaded *solo* operator** — "attention saved, not features used"; chief-of-staff for one person juggling 4+ surfaces |
| Landing page (current copy) | "central nervous system for **high-performance teams**" — a team claim the product isn't built around |
| Audit summary (point 1) | "AI-native unified comms hub for **SMB teams + customer-facing roles**" |

This must be reconciled before copy/onboarding/ASO can cohere. The retention data (audit point 3) adds the real tension: **stickiness is a multiplayer property** — Slack teams at ~2,000 msgs hit 93% weekly retention; *solo users barely retain.* So a pure-solo lane is honest to the build but weak on retention; a pure-team lane is strong on retention but contradicts the build and over-promises breadth.

### The three lanes

| | **A — Cross-surface AI hub** *(recommended)* | **B — Customer-facing vertical** | **C — Async-first comms** |
|---|---|---|---|
| **One-liner** | One screen for every work conversation, AI over one data model | Every customer conversation in one inbox, AI briefs you before every touch | The team comms tool you keep up with, because the AI catches you up |
| **Who** | Overloaded solo operator + the 1–2 they pull in | Sales / CX / founder-led-sales teams | Small distributed teams drowning in channels |
| **Leads with** | Cross-surface AI + productivity/voice/contacts core | Contacts/CRM + pre-touch AI brief | Relay/Glimpse async + catch-up summaries |
| **Strengths** | Matches the actual build; honest; the real moat; expandable | Clear buyer + budget; CRM is real | Leans on the retention/stickiness moat directly |
| **Risks** | "Hub" can read as the unproven everything-app; solo retention is weak | Needs the half-real comms breadth (SMS) to feel complete; CRM sync still partial (#108) | Narrower TAM; async is a feature, not obviously a category |

### Recommendation: **Lane A, framed solo-first with a built-in team on-ramp**

Pick **A**, but resolve the tension explicitly rather than papering over it:
1. **Speak to the solo operator the product is actually built for** (PRODUCT.md is the source of truth) — "attention saved," chief-of-staff, 30-second-burst-to-90-minute-deep-work. Drop the unprovable "high-performance teams" headline.
2. **Make the team the on-ramp, not the hero** — the #118 activation work already nudges solo → invite-a-teammate. Position teams as "and the one or two people you pull in," which (a) is honest, (b) directly addresses the solo-retention weakness with the multiplayer retention lever, and (c) doesn't over-promise org-scale breadth the product doesn't have.
3. **Keep breadth as proof, not promise** — list voice/video/calendar/contacts/decisions as *evidence of "every work conversation,"* but don't headline SMS or full unified-inbox aggregation until they're real.

This is the lane the existing `PULSE_MARKETING_COPY_GUIDE.md` is already written for, so execution cost is low: adopt its lane-A copy, no rewrite.

---

## Differentiators, ranked (AC3)

Ranked by *defensibility × how-real-today*:

1. **Cross-surface AI over one data model** — the moat; structurally unavailable to point tools. ✅ real (metered `ai-router`, provenance chips). **The lead.**
2. **Relay voice modes + Glimpse video, as first-class productivity surfaces** — async voice/video bundled *with* tasks/decisions, not a bolt-on. ✅ real. The clearest "not Slack" wedge.
3. **Decisions-with-voting → action** — decisions tracked, voted (DB-backed, #125), and rolled into tasks. ✅ real; rare in comms tools.
4. **vCard contact cards + Contacts CRM** — shareable, relationship-aware contacts. ✅ real; strong for Lane B if ever chosen.
5. **Maps intelligence inside comms** — route/week AI, ETA sharing. ✅ ~85% real; a genuine surprise-and-delight, but a *fifth* reason, not a lead (niche for the solo-operator ICP).

> Ordering rationale: 1–2 are the "why Pulse exists" pair; 3 is the highest-leverage *unique* feature; 4 supports the ICP and is the pivot asset if the operator ever takes Lane B; 5 is real but the narrowest fit for a solo operator — keep it as depth, not headline.

---

## What this unblocks once decided

- **Landing copy** — adopt `PULSE_MARKETING_COPY_GUIDE.md` lane-A sub-head + proof points; retire the "high-performance teams" line (resolves R-07). File the landing-copy swap as its own `launch-roadmap` issue.
- **Onboarding (#118)** — already invite-led; reframe the first-run value prop around "attention saved" + pull-in-a-teammate.
- **ASO / store copy** — keyword + screenshot strategy keys off the chosen lane.

---

## Open question for the operator (the actual decision)

**Confirm Lane A (solo-first cross-surface AI hub, team as on-ramp)** — or pick B (customer-facing) / C (async-first), in which case swap the sub-head + proof points per the variants in `PULSE_MARKETING_COPY_GUIDE.md`. Secondary: do you want the team on-ramp surfaced in the *headline* ("and your team") or kept to proof points (recommended: proof points, to stay honest to the solo build)?

---

## Changelog
- **2026-05-31** — Created as the #119 decision draft (lead message + lane options + ranked differentiators + recommendation: Lane A, solo-first). Awaiting operator sign-off; no copy executed yet.
