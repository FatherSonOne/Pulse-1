# Pulse Pricing & Unit Economics (#119 follow-on)

**Status: ANALYSIS DRAFT — awaiting operator direction.** · **Created 2026-05-31** · Follows the #119 Lane-A decision (solo-first). Pairs with `docs/PULSE_POSITIONING_GUIDE.md`.

> The operator locked **Lane A (solo-first)** but flagged that the current **$100 (Team) / $300 (Growth)** prices feel off for a solo product, and asked three questions before re-pricing: **(1) what does a solo user cost *me*? (2) how many users to break even? (3) what should the pricing model be?** This doc answers all three.
>
> **Two kinds of numbers below.** *Internal* figures (the metered caps, model mix, which services) are **ground-truth from the repo**. *External* unit prices (per-token, per-minute, per-GB vendor rates) are **estimates as of the Jan-2026 knowledge cutoff, clearly tagged `[EST]`** — plug in your real invoices to tighten. The structure holds regardless of the exact rates; the conclusion is robust to wide error bars because the dominant cost is small.

---

## 1. What a solo user costs you (COGS)

### The metered ceilings (ground truth — `plans` table + ai-router `metering.ts`)
| Resource | Team cap ($100) | Growth cap ($300) | Pre-launch default |
|---|---|---|---|
| AI messages / mo | 2,000 | 10,000 | 500 |
| SMS / mo | 500 | 2,500 | — (SMS is mocked + hidden, **$0 real cost** for v1, #100) |
| Storage | 50 GB | 500 GB | 5 GB |
| Voxer/Relay minutes / mo | 500 | 2,500 | 0 |
| Seats | unlimited | unlimited | 5 |

The caps **bound** worst-case COGS. Real usage is a fraction of the cap for almost all users.

### Cost drivers, itemized

**A. AI (`ai-router`) — the cost everyone fears, and it's small.** An "AI message" = one ai-router call. Model mix (from `ai-router/tasks.ts`): most tasks → **Gemini 2.5 Flash**; UX-critical → **Claude Haiku 4.5**; high-value reasoning → **Claude Sonnet 4.6**. Output is capped per task (512–4096 tokens; the new Glimpse digest is 512). Claude system prompts are cached (~90% input discount on hits).

`[EST]` blended cost per AI message (assume ~2K input / ~500 output, mostly Flash + some Haiku + occasional Sonnet):
- Gemini Flash msg ≈ **$0.002**; Haiku msg ≈ **$0.0045**; Sonnet msg ≈ **$0.0135**.
- Blended average ≈ **$0.004 / AI message**.

| AI usage | Monthly AI COGS `[EST]` |
|---|---|
| Solo at Team cap (2,000 msgs, maxed) | **~$8** |
| Realistic solo (200–600 msgs/mo) | **~$1–2.50** |
| Growth cap (10,000 msgs, maxed) | ~$40 |

**B. Transcription (Relay/Glimpse/meetings)** — `[EST]` Deepgram/Whisper ≈ $0.0043/min. Team Voxer cap 500 min → **~$2/mo** worst case; realistic solo far less.

**C. Video (Daily.co)** — `[EST]` ~$0.004/participant-min after the free tier (Daily includes ~10k free min/mo on standard plans, likely covering all early solo usage). Solo COGS ≈ **$0–1/mo**.

**D. Storage (Supabase)** — `[EST]` ~$0.021/GB/mo. 50 GB cap fully used → ~$1/mo; realistic solo (a few GB of voice/video) → **<$0.25/mo**.

**E. Email (Resend), Maps (Google)** — transactional volumes for a solo user sit in free tiers → **~$0**.

**F. Payment processing (Stripe)** — ~2.9% + $0.30 per charge. On a $25 charge ≈ **$1.03**; on $100 ≈ $3.20.

### Per-solo-user variable COGS (the answer to Q1)
| Scenario | Variable COGS / mo `[EST]` |
|---|---|
| **Realistic solo** (typical usage) | **~$3–6** |
| **Heavy solo** (near caps) | **~$12–15** |

> **Headline:** even a heavy solo user costs you **~$12–15/mo all-in**; a typical one **~$3–6**. The AI cap that *looks* expensive is ~$8/mo worst-case at current model rates. This is a **high-gross-margin** product at almost any sane price.

### Fixed infra (shared across ALL users, not per-user)
`[EST]` Supabase Pro (~$25 base + usage) + Vercel Pro (~$20) + Render backend (~$7–25) ≈ **~$55–70/mo total**, flat until scale. (Plus domain/misc.) This is the number break-even must clear.

---

## 2. Break-even (the answer to Q2)

Let fixed = **$65/mo** `[EST]`, realistic variable COGS = **$5/user**, Stripe ≈ 3.4% effective on small charges.

Contribution margin per paying user and break-even count (paying users needed to cover the $65 fixed nut):

| Price / mo | ~Stripe fee | Variable COGS | **Contribution / user** | **Break-even (users)** |
|---|---|---|---|---|
| $15 | ~$0.81 | $5 | **~$9.2** | **~7** |
| $20 | ~$0.88 | $5 | **~$14.1** | **~5** |
| $30 | ~$1.32 | $5 | **~$23.7** | **~3** |
| $100 (current Team) | ~$3.20 | $5 (solo) / up to $15 | **~$92** | **~1** |

> **The answer to Q2:** at a **$20–30/mo solo price you break even at ~3–5 paying users.** At the current $100 you break even at ~1 — which is *why $100 is leaving money on the table for a solo product*: it's priced to make 1 customer cover infra, not to win the solo ICP at volume. (These exclude your own labor; they're cash-COGS break-even, the number you asked for.)

---

## 3. What the pricing model should be (the answer to Q3)

**The pricing follows the lane.** Lane A is now **solo-first** — but $100/$300 are *team* prices. The solo operator Pulse is built for (PRODUCT.md: "Linear / Raycast / Notion / Superhuman; their bar is best-of-category") expects **prosumer pricing (~$15–30/mo)**, not enterprise-seat pricing. Charging $100 to a solo user contradicts the lane and filters out the exact ICP.

The cost model (§1–2) shows there's **no COGS reason** to price high: margins are healthy at $20–30. So the constraint on price is **willingness-to-pay + positioning**, not cost.

### Recommended structure: add a solo tier *below* the existing team tiers

| Tier | Price `[proposed]` | For | Caps |
|---|---|---|---|
| **Pulse Solo** *(new)* | **~$20–24/mo** ($200–240/yr) | The solo operator (Lane A hero) | Team-like AI (e.g. 1,500–2,000 msgs), 1 seat, generous-enough storage/voice |
| **Pulse Team** *(reframe existing $100)* | keep ~$100 *or* drop to a **per-seat** model (~$15–20/seat) | The 1–2+ people the solo pulls in (the on-ramp) | current Team caps, multi-seat |
| **Pulse Growth** ($300) | keep | Heavier teams | current Growth caps |

**Two open strategic choices for the operator:**
- **(a) Solo tier price:** $19 (aggressive, land-grab, Superhuman-adjacent is $30 so $19 reads as a deal) vs $24–29 (still prosumer, fatter margin). Both break even ≤5 users.
- **(b) Team model:** keep Team as a $100 flat *small-team* plan, OR convert to **per-seat (~$15–20/seat)** so the solo→team on-ramp is smooth (solo pays $20 → adds a teammate → $40, not a $100 cliff). Per-seat better matches the "team as on-ramp" positioning and removes the jarring 5× jump.

### Why not just lower Team to $20?
Because the team caps (and the multiplayer retention value) justify more than a solo plan; collapsing to one cheap tier forfeits expansion revenue. A 3-tier solo/team/growth ladder lets the **solo price win the ICP** while team/growth capture willingness-to-pay as usage and headcount grow.

---

## 4. Caveats / what to verify before locking prices
- **Replace every `[EST]`** with real vendor rates from your invoices (Anthropic/Google AI token prices, Daily, Deepgram, Supabase storage+egress, Render). The conclusion (healthy margins, ~3–7 user break-even, solo price viable) is robust to ±2× error on these because the dominant AI cost is only ~$8/mo at the cap.
- **Egress/bandwidth** (video + media delivery at scale) isn't separately modeled — watch it as users grow; it's the cost most likely to surprise.
- **Free trial** (30-day per the Stripe config) means trial users carry COGS with no revenue — keep the trial AI cap modest (the pre-launch 500-msg default ≈ ~$2 COGS is fine).
- **Annual discount** (current 10 months for 12) is already in the catalog; factor the discount into CM if most pay annually.
- These are **cash-COGS** break-evens — they don't price in your time/salary or CAC. They answer "when does a user pay for itself," which is what was asked.

---

## 5. Recommendation (one line)
**Introduce a Pulse Solo tier at ~$20–24/mo as the Lane-A hero price, reframe the $100 Team tier toward per-seat (~$15–20/seat) so solo→team is a smooth on-ramp, and keep Growth at $300.** Margins support it comfortably (break-even ~3–5 paying users); the blocker on price is positioning/WTP, not cost. Verify the `[EST]` vendor rates against real invoices before committing the numbers.

---

## Open questions for the operator
1. **Solo tier price:** $19 (land-grab) vs $24–29 (margin)?
2. **Team model:** keep $100 flat small-team, or convert to per-seat (~$15–20/seat) for a smooth on-ramp?
3. Can you share **real vendor invoice numbers** (Anthropic/Google AI spend, Daily, Supabase) so I can replace the `[EST]` rates and tighten the model?

## Changelog
- **2026-05-31** — Created after the #119 Lane-A decision surfaced a pricing re-eval. Models per-solo-user COGS (~$3–6 typical, ~$12–15 heavy; AI cap ~$8 worst-case), break-even (~3–7 paying users at $15–30), and recommends a new ~$20–24 Solo tier + per-seat Team reframe. External unit prices tagged `[EST]` pending real invoices.
