# Pulse — Outside-In Product Review & Truth-in-Product Audit (2026-05-29)

**Author:** Claude (reviewer-desk pass, three-voice) · **Owner:** solo (Aegis{FM})
**Companion to:** [`PULSE_PRELAUNCH_ROADMAP.md`](./PULSE_PRELAUNCH_ROADMAP.md) · **Tracking epic:** [#98](https://github.com/FatherSonOne/Pulse-1/issues/98)
**Worked by:** the `/review-sync` slash command compiles this doc's findings into the roadmap (see [How this doc is used](#how-this-doc-is-used)).

> **Why this doc exists.** A tech-magazine-style review of Pulse, written from a *user's* perspective in three voices (Skeptic / Enthusiast / Pragmatist), grounded entirely in the repo (file:line evidence). Its second job is operational: it converts the Skeptic's findings into a launch-blocking [punch list](#fix-before-launch-punch-list) mapped to GitHub issues, so the review doesn't evaporate into prose. This is the canonical findings source the `/review-sync` command reads.

---

## How this doc is used

1. The **[Findings Ledger](#findings-ledger)** is the machine-readable heart: every finding has an ID (`R-NN`), an evidence anchor (`file:line`), a verdict, and a tracking issue (existing or new).
2. `/review-sync` reads the Ledger, diffs it against open `launch-roadmap` issues + the roadmap Status Table, and proposes: (a) new issues for untracked findings, (b) Status/Notes edits for tracked ones, (c) a Changelog line. The human approves before anything is filed or committed.
3. The three review voices below are the human-readable rationale; the Ledger + punch list are the actionable output.

---

## The review (three voices)

### 🔴 The Skeptic — "A beautiful UI with a `setTimeout` where its SMS should be"

Pulse advertises a breadth its own pre-launch roadmap flags as mocked, unsafe, or false. The roadmap states the #1 launch risk in its own words: *"truth-in-product… showing a UI that advertises features (SMS, push, enrichment, meeting AI) that don't actually work."* The team is right to worry, because the gap is real and several pieces were shipped by *hiding* rather than fixing:

- **SMS is a `setTimeout`.** `smsService.isMockMode → true`; "delivery" is `setTimeout(... 'delivered', 1000)`; no Twilio anywhere. Gated OFF (`inAppSms`, #100) — yet still listed in pricing ("500 SMS/mo") and the FAQ.
- **Public copy still lies even after the legal copy was fixed.** #112 removed ElevenLabs/AssemblyAI from the Privacy Policy ("zero server-side evidence") and deleted a false "anonymized" AI claim — but the **landing FAQ still lists ElevenLabs + AssemblyAI + Whisper** and the **README still claims End-to-end encryption** (twice) and **React 19** (ships 18.2). The marketing surface contradicts the corrected legal surface.
- **Simulated / paused multiplayer.** Decision **voting** (`proposalMode`) is `enabled:false`, internal-only, v0.1.0 — while the Capability Matrix says "Decisions + voting ✅" and the landing markets it. `pulseMessagesV2` is paused; `workspaceGroups` is "fiction until a consumer lands" (both honestly hidden, but the *new* Messages users see is the legacy surface).
- **Ops maturity is amber.** Backend on Render **free tier** (cold starts); ~**1,234 baseline TS errors** the build skips; nearly every major section is mid-redesign.

Verdict: a real, server-backed app — but launchable today only because it routes the demo *around* the parts that don't work.

### 🟢 The Enthusiast — "The most coherent design vision I've seen from one person"

- A **334-line written design constitution** (`DESIGN.md`, "The Coral Cockpit") with a named, *enforced* central idea: **coral is reserved exclusively for AI output**, signposted with a JetBrains-Mono provenance chip (`CLAUDE · SUMMARY`, `GEMINI · DRAFT`) that is labeled, attributable, dismissible. There is a literal **"Coral Budget Audit"** ("Reject any PR that adds coral elsewhere") and a primitive comment reading *"Used in EXACTLY four places… Coral budget is locked."*
- **First-class dual theming** — warm-paper `#f8f8f8` light, translucent-layer true-black dark — every token WCAG-AA-tuned *per theme* with a11y comments in the source. System-level accessibility (4 colorblind filters, reduced-motion presets, 48px touch mode).
- **Real, server-routed AI** (Gemini + Claude, no client keys, metered), **production-grade Stripe**, **real VAPID push**, 45 edge functions. The bold bets — **Relay** (voice as a first-class peer to chat/email) and **Glimpse** (async video), **Map-as-comms** with live-ETA links — are ideas a committee would have killed.

Verdict: the bones are already better than tools people pay for. Watch this developer.

### 🟡 The Pragmatist — "An extraordinary skeleton wearing borrowed clothes"

- **Identity crisis is the real story.** Landing sells "High-Performance Teams"; `PRODUCT.md` designs for the **overloaded solo operator** ("attention saved, not features used," benchmarked vs Linear/Raycast/Superhuman). The roadmap knows stickiness is a *multiplayer* property (Slack ~2,000 msgs → 93% weekly retention; solo barely retains). **#119 ("pick v1 lane") is still open** — until answered, Pulse is two products in one trench coat.
- **Does it live up to the promise?** "Every Signal. Every Voice. Every Decision." is *aspirationally* true: the **Voice** and **AI** pillars are the most real; **Signal** leaks (SMS mocked, unified inbox partial, CRM OAuth broken server-side); **Decision** is real until you want voting.
- **Daily-driver verdict:** Not yet for a *team* (messaging reliability + honest parity must land first). **Surprisingly close for a solo desktop power user** who lives in the Cmd-K / Cmd-J / g-chord cockpit and leans on honest-attributed AI triage.

Bottom line: the vision and craft have outrun the plumbing. Answer "solo or team?", make the on-screen + public copy tell the truth, get off the free tier — and this stops being a stunning prototype and becomes a product people defend.

---

## Findings Ledger

Verdicts: ✅ already tracked & resolved · 🟡 tracked, open · 🔴 **untracked → new issue** · ⚪ context-only (no action)

| ID | Finding | Evidence (file:line) | Verdict | Tracking issue |
|---|---|---|---|---|
| **R-01** | Public copy advertises non-real features: README claims **E2EE** (no E2EE exists) and **React 19** (ships 18.2); FAQ lists **ElevenLabs/AssemblyAI/Whisper** (dropped from Privacy §5 in #112) | `README.md:12,132,165,423`; `src/components/LandingPage/landingData.ts:10,43,48` | 🔴 | **NEW (#124)** — public-copy truth-in-product |
| **R-02** | Decision **voting** marketed as shipped, but `proposalMode` is `enabled:false`, `targetUsers:['internal']`, v0.1.0; Capability Matrix says "Decisions + voting ✅" | `src/lib/featureFlags.ts:114-120`; roadmap Capability Matrix row | 🔴 | **NEW (#125)** — reconcile decisions voting |
| **R-03** | In-app SMS 100% mocked, advertised in pricing/FAQ | `src/services/smsService.ts:40,92-95,167` | ✅ hidden v1 | #100 (done) · #120/#109 (real wiring) |
| **R-04** | Email campaigns = unsafe per-recipient loop, no List-Unsubscribe/suppression | `src/services/emailCampaignService.ts:148-204` | ✅ hidden v1 | #105 (done, hidden) |
| **R-05** | CRM OAuth non-functional server-side (browser-only `supabase` import) | `src/services/crm/oauthHelper.ts:7`; `server.js:747` | 🟡 | #99 remainder · #108 |
| **R-06** | Meeting Analytics surface had no writer (permanently empty) | roadmap #106 notes; `.from('meetings')` SELECT-only | ✅ gated honest | #106 (done) · #121 (writer) |
| **R-07** | Positioning split — landing = "teams", `PRODUCT.md` = solo operator; v1 lane unpicked | `PRODUCT.md:9-13,37-39`; `LandingPage.tsx` hero | 🟡 | #119 (open) |
| **R-08** | ~1,234 baseline TS errors; build skips type-check | memory `reference_pulse_tsc_oom`; #114 | 🟡 | #114 (open) |
| **R-09** | Backend on Render **free tier** → cold starts (comms-grade reliability risk) | roadmap Capability Matrix backend note | ⚪ → fold | #116 (Observability/SLOs) |
| **R-10** | `workspaceGroups` "fiction until a consumer lands" (honestly hidden) | `src/lib/featureFlags.ts` (workspaceGroups OFF) | ⚪ honest | permissions #42 ph.5 / group_grants |
| **R-11** | `pulseMessagesV2` paused; users get legacy Messages (honestly hidden) | memory `project_pulse_messages_pathd`; flag OFF | ⚪ honest | (V2 wiring backlog) |
| **R-12** | "Contact enrichment" was internal dedup, not external enrichment | roadmap #107 notes | ✅ relabeled | #107 (done) |

**Net-new this pass:** R-01, R-02 → two new issues (#124, #125 once filed). Everything else is already tracked or is honest-by-hiding (context-only).

---

## Fix-Before-Launch Punch List

The Skeptic's findings, prioritized as launch gates. Each line maps to a tracking issue. **This is artifact (a).** Detailed version: [`PULSE_FIX_BEFORE_LAUNCH_PUNCHLIST_GUIDE.md`](./PULSE_FIX_BEFORE_LAUNCH_PUNCHLIST_GUIDE.md).

**P0 — must be true before a stranger logs in**
1. **Public copy stops advertising non-real features** (E2EE, React 19, dropped AI vendors, SMS) — **#124**. Deliverables: honest README ([draft](./PULSE_README_HONEST_DRAFT_HANDOFF_2026-05-29.md)), FAQ vendor reconcile to Gemini+Claude+OpenAI, E2EE claim removed pending #113.
2. **Backend off the free tier OR documented cold-start SLO** — #116 (note R-09).

**P1 — honesty + multiplayer integrity**
3. **Reconcile Decisions "voting"** — ship `proposalMode` or qualify the matrix/landing copy — **#125**.
4. **Pick the v1 lane** (solo vs team) so copy + onboarding cohere — #119. Feeds [`PULSE_MARKETING_COPY_GUIDE.md`](./PULSE_MARKETING_COPY_GUIDE.md).
5. **CRM OAuth server-side refactor** — #99 remainder / #108.
6. **E2EE positioning decision** (gates the README claim removal) — #113.

**P2 — reliability / debt**
7. **TS error burndown + no-new-errors CI gate** — #114.
8. **Integration tests for the money/comms paths** — #115.
9. **Observability + SLOs** (incl. Render cold-start budget) — #116.

---

## Changelog

- **2026-05-29** — Doc created from the three-voice review. Findings Ledger captured (R-01…R-12). Net-new findings R-01 (public-copy honesty) + R-02 (decisions-voting reconcile) filed as #124/#125. Artifacts produced: punch list, marketing-copy guide, honest-README draft. `/review-sync` command added to compile future review passes into the roadmap.
