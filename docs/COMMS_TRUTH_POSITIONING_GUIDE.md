# Comms-Truth Positioning: What Pulse Claims vs What Is Actually Live

Owner: solo (Pulse). Date: 2026-06-13. Status: decision-ready.
Scope: close the gap between Pulse's advertised comms surface and what is on by default for a fresh public signup, before launch.

---

## TL;DR

The landing page is mostly already honest. The hero promises "Every channel, one surface" (LandingPage.tsx:1490) and the index strip under it lists only real, ungated surfaces (Relay, Glimpse, War Room, CRMs, Maps), no SMS/email/Slack promise (LandingPage.tsx:1523). The README is the gold standard: it has a literal "What Pulse does today" vs "Planned / not yet enabled (honest status)" split (README.md:17, README.md:33).

Three specific places still over-claim the connected-account story relative to default-on reality:

1. The Messaging section subhead says Slack is "unified in one inbox" (LandingPage.tsx:2289). Slack is real two-way in code but gated OFF by default (slackMessagesGrounding / slackChannelsGrounding, FeatureContext.tsx:125-128) and needs VITE_BACKEND_URL set.
2. The FAQ answer "Pulse brings Slack into one inbox alongside its own channels and DMs" (landingData.ts:47) describes a default-on Slack inbox that does not exist on a fresh signup.
3. PRODUCT.md still says Pulse "pulls SMS, email, Slack, voice ... into one inbox" (PRODUCT.md:17), and a phone-screenshot alt text references SMS as a live item (LandingPage.tsx:4222). In-app SMS is 100 percent mocked (smsService.isMockMode hard-true) and is correctly hidden from the UI; the SMS word should not survive in any forward-facing promise.

Email is already handled correctly: the whole email landing section is compile-time hidden (SHOW_EMAIL_ON_LANDING = false, LandingPage.tsx:58) precisely because emailEnabled defaults OFF and rides a fragile owner-only OAuth grant.

Recommendation: Option C (hybrid). Re-scope the language now (cheap, ships today, removes the launch risk) and treat the durable-OAuth + flags-default-ON work as a fast follow, not a launch blocker.

---

## 1. CLAIM vs REAL

Verified channel reality (given, not re-derived this pass):
- Pulse-native DM / Relay voice / Glimpse video / Daily meetings: REAL, two-way, ungated.
- Gmail send + inbound: REAL but gated behind emailEnabled (default OFF) and on a fragile owner-only OAuth grant that expires ~every 7 days.
- Slack DM + Slack Channels: REAL two-way in code, gated behind slackMessagesGrounding / slackChannelsGrounding (default OFF), need VITE_BACKEND_URL set.
- In-app SMS: 100 percent MOCKED (smsService.isMockMode hard-true), correctly hidden.
- Push: fires on inbound Pulse + Slack DMs (shipped this session); email/channel push not yet.
- "Unified Inbox" service: in-memory helper, not mounted in any live inbox screen.

| # | Claim (verbatim) | Source path:line | Default-on reality | Verdict |
|---|---|---|---|---|
| 1 | "the unified communication and intelligence layer ... It pulls SMS, email, Slack, voice (Relay ...), video glimpses, and CRM activity into one inbox" | PRODUCT.md:17 | SMS mocked; email + Slack gated OFF; only Pulse-native DM / Relay / Glimpse / meetings are default-on. No mounted unified inbox screen. | OVER-CLAIM (internal doc, but it is the source narrative copy flows from) |
| 2 | Hero badge "Every channel, one surface" | LandingPage.tsx:1490 | True as an aspirational frame; "surface" not "inbox", names no specific channel. | OK |
| 3 | Index strip: "5 Relay peers + Triage stream, Glimpse video, War Room with 8 slash commands, 4 native CRMs, Maps and ETA share. One surface." | LandingPage.tsx:1523 | Every item listed is real and ungated. Deliberately omits SMS/email/Slack. | OK (this is the model to copy) |
| 4 | Messaging subhead: "Channels, threads, and Slack, unified in one inbox." | LandingPage.tsx:2289 | Pulse channels/threads real + ungated; Slack gated OFF by default, needs backend env. "unified in one inbox" implies default-on. | OVER-CLAIM |
| 5 | Messaging mock chrome shows "Unified" next to a Slack glyph | LandingPage.tsx:2321-2322 | Decorative mock, but reinforces a default-on Slack-in-inbox read. | SOFT OVER-CLAIM |
| 6 | FAQ: "Pulse brings Slack into one inbox alongside its own channels and DMs for messaging, and connects Microsoft Outlook, Zoom, and Google Meet ..." | landingData.ts:47 | Slack gated OFF by default; Outlook/Zoom/Meet are calendar/meeting connectors, not "inbox". | OVER-CLAIM |
| 7 | FAQ "What is Pulse?": "one screen for every work conversation: messaging, email, voice (Relay), async video (Glimpse), calendar, contacts, and decisions" | landingData.ts:42 | Email gated OFF by default; everything else listed is real. "every work conversation" + email implies email is in. | SOFT OVER-CLAIM (email) |
| 8 | Phone screenshot alt: "50 unified items across Email, SMS, Voice, Notes and Live conversations" | LandingPage.tsx:4222 | SMS mocked, email gated OFF. Alt text is indexed and read by screen readers; it asserts SMS+email as live. | OVER-CLAIM |
| 9 | Email landing section hidden | LandingPage.tsx:58 (SHOW_EMAIL_ON_LANDING = false) | Correct: email is gated OFF + fragile owner-only grant, so it is not advertised. | OK (the right pattern) |
| 10 | landingData.ts comment: "5 communication surfaces ... in-app SMS gated OFF for v1" | landingData.ts:9 | Internal note already acknowledges SMS is out for v1. | OK (intent already correct) |
| 11 | README "What Pulse does today" lists Email as shipped (Gmail sync, templates ...) | README.md:23 | Email code is real but default-OFF behind emailEnabled + owner-only grant; "today" overstates default availability. | SOFT OVER-CLAIM |
| 12 | README "Planned / not yet enabled (honest status)": In-app SMS OFF, CRM sync in progress, Email campaigns disabled | README.md:33-42 | Matches reality. | OK (the model to copy) |

Flag ground-truth (FeatureContext.tsx):
- emailEnabled: false (FeatureContext.tsx:116) — gates all Gmail fetch/token use.
- slackMessagesGrounding: false (FeatureContext.tsx:125) — Slack DM ingest/send-as-you OFF.
- slackChannelsGrounding: false (FeatureContext.tsx:128) — Slack channel mirror/reply OFF.
- slackSend: false (FeatureContext.tsx:121) — per-contact Slack DM send OFF.
- experimentalEnabled: false (FeatureContext.tsx:119) — Summit/Map/War Room sidebar gated.
- Settings only surfaces Slack betas under "Integrations (Beta) ... Off by default" (FeatureContext.tsx:283-288); descriptions already hedge ("Backend + inbound still rolling out", "read-only for now") at FeatureContext.tsx:341-342.

Net read: the only true default-on, two-way comms channels for a fresh signup are Pulse-native DM, Relay voice, Glimpse video, and Daily meetings. Everything that touches an external account (SMS, email, Slack) is either mocked or gated OFF.

---

## 2. Options

### Option A: Flip Gmail + Slack to first-class (own them as features)

What it means: replace the owner-only ~7-day Gmail OAuth grant with a durable per-user grant, set VITE_BACKEND_URL in prod, flip emailEnabled / slackMessagesGrounding / slackChannelsGrounding default-ON, and keep the "one inbox for email + Slack" copy as a true promise.

Specific changes implied:
- New durable OAuth: a proper per-user Google grant (CASA-reviewed Gmail scopes) replacing the owner-scoped grant referenced at LandingPage.tsx:55-57. This is the heavy lift, multi-week, involves Google verification.
- Set VITE_BACKEND_URL on Vercel to the Render backend origin (the Slack two-way path is dead without it).
- FeatureContext.tsx: flip defaults emailEnabled, slackMessagesGrounding, slackChannelsGrounding to true (FeatureContext.tsx:116, :125, :128).
- LandingPage.tsx:58: SHOW_EMAIL_ON_LANDING = true (re-show the email section).
- Keep LandingPage.tsx:2289 and landingData.ts:47 as-is.

Pros:
- The strongest version of the pitch: a real unified inbox is the category-defining promise.
- No copy walk-back; the marketing matches a bigger product.

Cons:
- Highest risk at the exact moment risk matters (launch). The durable OAuth + Google verification is multi-week and externally gated; you cannot will it done by launch.
- Flipping email default-ON while the grant still expires every ~7 days means every public user hits a broken-email experience on day 7. That is worse than not advertising it.
- Slack two-way still needs an env var correctly set in prod and per-user token routing; flipping it ON globally before that is hardened invites first-week support load you cannot absorb solo.
- Violates the project's own "ship only what's real, flag the rest for v1" launch principle.

### Option B: Re-scope the language (market the true default-on surface)

What it means: market Pulse as "Pulse-native comms + cross-surface AI, with Slack and email as opt-in connectors", soften the "one inbox for SMS/email/Slack" promise everywhere, keep the betas opt-in. No backend/OAuth work.

Specific changes implied:
- PRODUCT.md:17: drop "SMS" entirely; reframe email/Slack as connected accounts, e.g. "the unified communication and intelligence layer ... it brings your Pulse messaging, Relay voice, Glimpse video, calendar, and CRM activity into one surface, and connects Slack and email as opt-in channels, layering AI for triage, summarization, drafting, and decision tracking."
- LandingPage.tsx:2289: change "Channels, threads, and Slack, unified in one inbox" to make Slack opt-in and lead with Pulse-native, e.g. "Pulse channels, threads, and DMs in one surface, with Slack as an opt-in connector. Walk away for an hour; Pulse summarizes the thread before you reopen it."
- landingData.ts:47 (FAQ "Unified Inbox"): reframe to "Pulse messaging (channels and DMs) is the core inbox. Slack can be connected as an opt-in beta, and Microsoft Outlook, Zoom, and Google Meet connect for calendar and meetings. Each connects via OAuth in Settings."
- landingData.ts:42 (FAQ "What is Pulse?"): qualify email as "email (when connected)".
- LandingPage.tsx:4222: rewrite alt text to drop SMS/email-as-live, e.g. "Pulse on iPhone: Memory tab showing recent voice, notes, and live conversations."
- README.md:23: move Email from "does today" into a "connect an account" qualifier, or note "(opt-in; Gmail grant)".
- No FeatureContext changes; betas stay default-OFF (correct as-is).

Pros:
- Ships today, solo, zero backend risk. Closes the entire advertise-vs-reality gap at launch.
- Aligns with the repo's existing honest pattern (README split, the hidden email section, the index strip).
- The true default-on surface (Pulse DM + Relay + Glimpse + Daily + cross-surface AI) is already a differentiated pitch; the AI moat, not the channel count, is the real story.

Cons:
- Slightly less grand than "one inbox for everything". You give up the broadest version of the claim.
- "Opt-in connector" language is less punchy than "unified inbox"; needs careful copy so it does not read as a limitation.
- You will want to re-grand the copy later once Option A lands, so it is two copy passes over time.

### Option C: Hybrid (re-scope now, upgrade copy as features graduate)

What it means: do Option B's copy fixes now to be launch-honest, AND keep the connectors visible as first-class opt-in betas (not buried), with copy written so it upgrades cleanly when the durable OAuth and prod env land. Sequence the Option A backend work as a post-launch fast follow, flipping defaults per channel only after each is hardened.

Specific changes implied:
- All of Option B's copy edits (PRODUCT.md:17, LandingPage.tsx:2289, landingData.ts:42 + :47, LandingPage.tsx:4222, README.md:23).
- Keep the Slack glyph + "Unified" mock chrome (LandingPage.tsx:2321) but ensure the surrounding subhead frames it as opt-in, so the mock illustrates a real (if opt-in) capability rather than a default.
- Leave FeatureContext defaults OFF at launch (FeatureContext.tsx:116, :125, :128); the Settings "Integrations (Beta)" group already frames them honestly (FeatureContext.tsx:283-288, :341-342).
- Post-launch sequence (each independent, ship when ready): (1) set VITE_BACKEND_URL in prod and flip slackChannelsGrounding/slackMessagesGrounding default-ON once two-way is smoke-tested live; (2) durable Gmail OAuth grant, then flip emailEnabled default-ON and SHOW_EMAIL_ON_LANDING = true; (3) when a channel goes default-ON, restore the stronger "unified inbox" wording for that channel only.

Pros:
- Launch-honest today with no backend dependency, same as Option B.
- Keeps the connector story alive and visible so the eventual default-ON flip is a copy upgrade, not a new feature reveal.
- Lets you flip each channel independently as it hardens, instead of an all-or-nothing gate. Matches the existing "Backend + inbound still rolling out" hedge already in the flag descriptions.

Cons:
- Slightly more nuance to hold than pure B: you maintain "opt-in beta" framing now plus a clear internal trigger for when to re-grand each line.
- Risk that the post-launch flips slip and the opt-in framing becomes permanent. (Mitigated: that is the honest steady state anyway, so no harm.)

---

## 3. Recommendation

Go with Option C (hybrid), executing Option B's copy edits immediately as the launch-blocking part.

Why: the launch risk is purely the copy gap, and that gap is small and concrete (4 strings on the landing/FAQ + PRODUCT.md + 1 alt-text + 1 README line). Fixing it is a same-day, solo, zero-backend change that removes the entire advertise-vs-reality exposure. Option A's durable OAuth is real future value but is externally gated (Google verification) and cannot be a launch dependency; forcing it would either delay launch or ship a default-ON email path that breaks every user on day 7. Option C keeps the connector story first-class and visible so that when the backend work lands, you re-grand the copy channel-by-channel rather than re-introducing a feature. The product's actual moat is the cross-surface AI over the default-on Pulse-native surfaces, which is already advertised truthfully (LandingPage.tsx:1523, README.md:17), so re-scoping costs you very little narrative and buys you a launch you do not have to defend.

Minimal launch-blocking edit set (the must-do subset of C):
- PRODUCT.md:17 — remove "SMS", reframe email/Slack as opt-in connectors.
- LandingPage.tsx:2289 — Slack as opt-in connector, lead with Pulse-native.
- landingData.ts:47 — rewrite the "Unified Inbox" FAQ.
- landingData.ts:42 — qualify email with "(when connected)".
- LandingPage.tsx:4222 — drop SMS/email from the screenshot alt text.
- README.md:23 — qualify Email as opt-in.

Everything else (FeatureContext flips, durable OAuth, re-showing the email section) is explicitly deferred to post-launch and is not required to ship honestly.

> Note (added at save time): LandingPage.tsx and landingData.ts are currently in uncommitted working-tree WIP owned by the user. The Option B/C copy edits to those files must be coordinated with that WIP (do not sweep), so they are NOT auto-applied by this doc.
