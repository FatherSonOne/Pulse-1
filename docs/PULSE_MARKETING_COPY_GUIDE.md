# Pulse — Landing-Page-Ready Marketing Copy (honest-optimist cut)

**Source:** [`PULSE_REVIEW_AUDIT_2026-05-29.md`](./PULSE_REVIEW_AUDIT_2026-05-29.md) · **Decision input:** #119 (`/launch-followups v1-lane`)

> **Artifact (b)** of the 2026-05-29 review — the Enthusiast's voice, but *true*. This is copy you could paste onto the landing page today without contradicting the Privacy Policy, `package.json`, or any OFF feature flag. It leans into the real moat (cross-surface AI over one data model, voice/video as first-class, decisions-to-action) and says **nothing** about E2EE, SMS-as-headline, or vendors the product doesn't run.
>
> **Lane assumption:** **A — cross-surface AI hub** (the recommended #119 lane). If the operator picks B (customer-facing vertical) or C (async-first), swap the sub-head + proof points per the variants at the bottom.

**Copy rules (carried from `DESIGN.md`):** no em dashes in UI copy; confident, not apologetic; AI is named, never mystified; no gradient-purple "AI made this" tropes. Every claim below is backed by a real, shipped surface.

---

## Hero

> **Eyebrow:** The AI command surface for people drowning in channels
> **Headline:** Every Signal. Every Voice. Every Decision.
> **Sub-head:** Pulse puts your messages, email, voice, video, calendar, contacts, and decisions on one screen — with one AI brain that reads across all of them, and always shows its work.
> **Primary CTA:** Launch Pulse **Secondary CTA:** See how the AI thinks

*(Keeps the existing, strong headline. Replaces the unprovable "central nervous system for high-performance teams" team-claim with a benefit that's true for the solo operator the product is actually built for — resolves R-07.)*

---

## The one-liner (meta description / ASO / social)

> Pulse is one screen for every work conversation — chat, email, voice, video, calendar, contacts, and decisions — with a cross-surface AI that summarizes, drafts, and triages, and labels every word it writes so you always know what's yours.

160-char cut: *"One screen for every work conversation, with a cross-surface AI that summarizes, drafts, and triages — and shows its work on every line."*

---

## Proof points (the real moat — each ties to a shipped surface)

1. **One AI brain, not ten chatbots.** Summaries, smart replies, task extraction, and daily briefings run over a *single* data model spanning every surface — routed server-side through a metered AI router (Gemini + Claude). *(Real: `ai-router`, ~40 AI primitives.)*
2. **AI that shows its work.** Every AI artifact wears a provenance chip — `CLAUDE · SUMMARY`, `GEMINI · DRAFT` — and a coral accent reserved exclusively for AI output. You never mistake the machine's words for your own. *(Real: `AIProvenanceTag`, the Coral Cockpit design system.)*
3. **Voice and video are first-class, not attachments.** Relay gives you async push-to-talk threads, broadcasts, and 1:1 voice; Glimpse turns a 30-minute call into a 30-second video with an AI transcript. *(Real: Relay 4 modes + transcription; Glimpse async video.)*
4. **From signal to action.** Turn a thread into a tracked Decision or Task without leaving the conversation. *(Real: Decisions/Tasks, DB-backed. NOTE: gate the word "voting" until #125 — see caveat below.)*
5. **Your network, in space and time.** Contacts with relationship health, plus a live Map layer with ETA sharing for teams that move. *(Real: Contacts CRM; Maps ~85%.)*
6. **Built like an instrument.** Cmd-K palette, Cmd-J capture, Vim-style g-chords, first-class dark/light, accessibility baked in (colorblind modes, reduced-motion, 48px touch). *(Real: global command layer; `AccessibilitySettings`.)*

---

## Honesty caveats (do NOT ship copy that violates these)

- **No "end-to-end encryption" claim** until #113 decides the posture. Allowed today: *"Encrypted in transit (TLS) and at rest. AI processes content server-side for the features you turn on."*
- **No SMS in the headline or pricing hero** until #109/#120 make it real (`inAppSms` is OFF). If mentioned at all: *"SMS — coming in a later release."*
- **AI vendor list = Gemini + Claude + OpenAI only.** Drop ElevenLabs / AssemblyAI / Whisper from the FAQ (they were removed from the Privacy Policy in #112). Fixes R-01.
- **"Voting" is cleared for use (#125 resolved 2026-05-30).** Real end-user decision voting ships ungated via the Decisions Cockpit (persisted to `decision_votes`); "capture, vote, and track decisions to action" is true today. Caveat: this is the **Decisions surface** voting — do **not** market the in-Messages composer "proposal mode" (the OFF `proposalMode` flag, simulated votes) as live.
- **Pricing** stays flat ("one plan, everything included") — that claim is real and is a genuine differentiator vs per-seat competitors.

---

## Lane variants (if #119 picks B or C instead of A)

- **B — Customer-facing teams:** Sub-head → *"Sales and CX teams: every customer conversation — email, chat, voice, calls — in one inbox, with one AI that briefs you before every touch."* Lead proof points with Contacts/CRM + cross-surface AI; soften the "everything app" breadth.
- **C — Async-first comms:** Sub-head → *"The team comms tool you actually keep up with, because the AI catches you up."* Lead with Relay/Glimpse async + catch-up summaries; lean on the retention/stickiness angle.

---

## Changelog
- **2026-05-29** — Created from the review's Enthusiast voice, constrained to honest claims. Assumes #119 lane A. Supersedes nothing yet — landing copy update is a separate execution step (file as a `launch-roadmap` issue once #119 + #124 land).
