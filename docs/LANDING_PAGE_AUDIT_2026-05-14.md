# LANDING PAGE AUDIT — Pulse Marketing Site

**Date:** 2026-05-14
**Section:** Pulse Landing Page (`src/components/LandingPage.tsx` + `src/components/LandingPage/landingData.ts`)
**Auditor:** Claude (Opus 4.7)
**Goal:** Cross-check information accuracy against the actual shipped app (Voxer → Relay rename, 8 → 5 peer consolidation, Glimpse split-out, and feature drift since launch).

---

## Execution status (2026-05-14)

After audit + critique, the user approved "everything in audit + critique, content first then design, instrument-grade quiet direction." The following waves shipped in this session:

| Wave | Scope | Status |
|------|------|--------|
| 1.1 | STATS array rewritten (8 Voice Modes → 5 Relay Peers + 6 Comm Surfaces; verified counts) | ✅ |
| 1.2 | `VOX_MODES` renamed to `RELAY_PEERS` with shipped peer names (Triage / Direct / Channel / Broadcast / Notes / Live) | ✅ |
| 1.3 | Relay section heading: "8 Ways to Speak" → "Five peers, one stream." | ✅ |
| 1.4 | FAQ Q1 rewritten to surface Glimpse / Maps / Workspaces; Q4 rewritten with the 5 peers | ✅ |
| 1.5 | `PULSE_TEAM_FEATURES` updated; `TrialExpiredBlock.tsx` now imports the list directly (single source of truth) | ✅ |
| 1.6 | Trinity Pulse card, Footer, Voice-First Scenario step 1 ("VOX DROP" → "RELAY DIRECT"), keyboard shortcuts (1–8 → T·D·C·B·N·L) | ✅ |
| 1.7 | Pulse Growth checkout verified against Stripe test-mode (`price_1TWqj0Gb3AGXe9w8QMGNRIek`); pricing corrected $300/$3,000 → real $249/$2,490 | ✅ |
| 2.1 | New Glimpse section added between Relay and War Room (6-card grid pending art-direction pass) | ✅ |
| 2.2 | New Maps & Field Ops section after CRM (Contact map, ETA share, Geofence, Travel buffers, Live broadcast, Route planning) | ✅ |
| 2.3 | Workspaces band added (compact, mono-label, no card-grid; demonstrates the eventual section-by-section variation) | ✅ |
| 3.1 | 14 of 15 gradient-text instances removed; hero "Every Decision." ha-gradient preserved per user instruction | ✅ |
| 3.2 | JetBrains Mono CSS scoped to landing-page uppercase tracked labels (`.lp-dark`, `.lp-light` ancestor selectors) — DESIGN.md Mono-Label Rule satisfied without touching every callsite | ✅ |
| 3.3 | Pulse Growth pricing card re-coloured: violet/purple/indigo gradients → zinc-950 surface + 1px rose accent + secondary CTA (outline). No category-reflex AI palette. | ✅ |
| 4.2 | Hero stats strip (`grid-cols-8` with seventh-and-a-half cell, the literal hero-metric template ban) replaced with a single declarative sentence below the hero | ✅ |
| 4.3 | `bg-black` → tinted `rgba(8,8,8,0.7)`; `ease-in-out` bounce → `cubic-bezier(0.16, 1, 0.3, 1)`; full `prefers-reduced-motion` block disabling all always-on animations + hero canvas | ✅ |
| 5 | Unused exports removed from `landingData.ts` (CRM_PLATFORMS, PLATFORMS, STUDIO_FEATURES, EMAIL_FEATURES, MESSAGING_FEATURES, CALENDAR_FEATURES, ANALYTICS_FEATURES, STATS); imports cleaned in `LandingPage.tsx` | ✅ |

### Detector before / after

- Impeccable CLI on `src/components/LandingPage.tsx`: **23 findings → 0 real issues** (2 remaining hits are false positives — selection-state classes and hover-state transitions, not actual rest-state contrast issues).

## Second pass (2026-05-15) — `/impeccable critique` + `/impeccable animate` + hero typography

After Waves 1-5 closed factual + slop issues, the page read accurate-but-flat. A focused critique + animate pass added motion and per-region polish:

| Pass | Scope | Status |
|------|-------|--------|
| Animate A | Section heading blur-in on viewport entry (IntersectionObserver, auto-targets every `<h2>` in `#main-content`) | ✅ |
| Animate B | Card hover lift capped at 2px across 14 instances (was 8px, theatrical) | ✅ |
| Animate C | Primary CTAs (`lp-cta-primary`) get DESIGN.md coral halo on hover + 1px lift, 220ms ease-out-expo | ✅ |
| Animate D | Relay orbit hover: 1px coral connector draws from card toward centre + JetBrains Mono shortcut badge (`T`/`D`/`C`/`B`/`N`/`L`) | ✅ |
| Animate E | CRM mesh canvas: recurring activity pings from random named nodes (~2-3s cadence, max 6 concurrent) | ✅ |
| Animate F | Section divider SVG: gradient line draws in via `stroke-dasharray` on viewport entry | ✅ |
| Animate G | Footer Pulse ECG wordmark: path draws itself in when footer enters viewport | ✅ |
| Hero A | "Every Decision." gradient cooled from coral→pink→violet to coral two-stop (`#f43f5e → #fb7185`). Eliminates the only surviving violet drift on the page | ✅ |
| Hero B | "Launch Pulse" CTA brought to parity with `lp-cta-primary` system (220ms ease-out-expo, coral halo shadow, 1px lift) | ✅ |
| Hero C | Headline letter-spacing relaxed `-0.03em → -0.02em`, line-height `1.04 → 1.08` | ✅ |
| Hero D | Responsive clipping fix: `.hero-asymm-content` now `max-width: min(880px, 92vw)` (was 52%), headline `clamp(26px, 6.5vw, 80px)` (was 64-96px), per-line `white-space: nowrap`, mobile font override removed | ✅ |
| Polish 1 | Pricing Monthly/Yearly toggle: single coral pill slides between states (280ms ease-out-expo) instead of per-button gradient swap | ✅ |
| Polish 2 | Hero badge `backdrop-filter: blur(12px)` reviewed → kept (glass-on-purpose, sits over moving signal canvas) | ✅ |
| Polish 3 | Six always-on icon animations (`lp-icon-bob` / `-spin` / `-throb` / `-zap` / `-tilt` / `-stamp`) — resting state quieted, hover plays one decisive iteration then settles. Cumulative fidgety effect resolved | ✅ |
| Wave 4.1.b | **Section background palette unified.** 11 different coloured radial gradients (indigo, purple, blue, indigo, emerald, amber, teal, indigo, emerald, indigo) collapsed into one coral-rose system. Each section still keeps its hue identity at the chip level (rose/purple/blue/indigo/emerald/amber/teal) but the backdrop is one consistent palette so the page reads as one product. Flagship sections (Relay, Decisions, CRM) get a slightly stronger coral; utility sections get a quieter wash. Relay's sonic decoration rings also rebranded from indigo-500/10 to rose-500/10. Logos Vision's component-level indigo/violet (icon, "Explore Network" CTA) kept — it's the LV brand, not Pulse | ✅ |
| Light Mode | **Light mode lifted off flat.** Previously 11 sections had `opacity: 0` for their background gradients in light mode, leaving the whole page reading as flat zinc. All 11 now render at 0.55 opacity in light mode so the coral mist registers as a subtle warm-paper tint — DESIGN.md §"Dark and light are equal citizens" honored. The three scroll-triggered sections (Relay / Decisions / CRM) preserve their fade-in-on-scroll choreography but multiply by 0.55 in light mode so the visual rhythm matches dark. CRM's indigo grid-dot overlay deliberately kept on top of the coral backdrop — it's the Logos Vision brand cue, the contrast tells the story | ✅ |

Detector after second pass: still 23→0 real issues, 2 false positives remain (selection-state + hover-transition).

### Locked in feedback memory
[Hero block preservation](C:\Users\Aegis{FM}\.claude\projects\f--pulse1\memory\feedback_landing_hero_preserved.md) — the hero logo + badge + three-line tagline + "Launch Pulse" CTA + signal-wave canvas compose the brand voice; only the "Every Decision." gradient is allowed to be tuned (now coral two-stop). The block itself stays.

---

## Still deferred (next session)

**Wave 4.1 — Vary the six identical 3-column card grids per section** (War Room, Email, Messaging, Calendar, Analytics, Decisions, plus the new Glimpse and Maps additions). This is the right scope for a dedicated `/impeccable shape` session per section because each layout needs design judgement, not pattern replacement. Suggested per-section directions from the critique:
- **War Room** — terminal-style live transcript with `/slash` commands streaming, no card grid
- **Email** — stacked inbox preview rail with one selected thread expanded
- **Messaging** — side-rail thread mock with AI Summarisation pinned
- **Calendar** — flat agenda strip with conflict markers, no cards
- **Analytics** — one big chart hero (Linear-style), single sentence beside it
- **Decisions** — horizontal 2×2 mini-kanban with sample cards
- **Glimpse + Maps** — vary column counts and densify one hero-row card each

To launch: `/impeccable shape Relay section` (then each other section in turn). Each session ~30-60 min.

**Wave 4.1.b — Section background palette unification.** Each section still has its own coloured radial-gradient bg (indigo, purple, blue, emerald, amber, teal). The critique flagged this as "7 vibes in one scroll." Recommend a single committed palette pass when the per-section layouts are redone.

**Wave 5.b — God-component refactor.** `LandingPage.tsx` is still 2,800+ lines after this session. Splitting into `LandingPage/sections/*.tsx` is N4-priority but worth doing once the per-section layouts settle.

---

---

## 1. Files in Scope

| File | Lines | Role |
|------|------:|------|
| [src/components/LandingPage.tsx](../src/components/LandingPage.tsx) | 2,744 | God-component: nav, hero, all sections, footer, helper subcomponents, FAQ |
| [src/components/LandingPage.css](../src/components/LandingPage.css) | 1,242 | Hero asymm grid, orbit ring, animations, mobile menu |
| [src/components/LandingPage/landingData.ts](../src/components/LandingPage/landingData.ts) | 204 | Static data: STATS, VOX_MODES, CRM_PLATFORMS, PLATFORMS, FAQ_DATA, SHORTCUT_GROUPS, STUDIO_FEATURES, EMAIL_FEATURES, MESSAGING_FEATURES, CALENDAR_FEATURES, ANALYTICS_FEATURES, PULSE_TEAM_FEATURES, PULSE_TEAM_PRICING, PULSE_GROWTH_FEATURES, PULSE_GROWTH_PRICING |

**Cross-referenced against (ground truth):**
- `src/types.ts` (line 9: `AppView` enum) — authoritative list of top-level sections
- `src/components/Sidebar/Sidebar.tsx` (line 72: `getNavSections`) — what users actually see
- `src/components/Relay.tsx` (line 63: `RelayView` type) — Relay's 5 peers + Triage
- `src/components/Relay/` (43 files) — the real Relay surface
- `src/components/Glimpse/Glimpse.tsx` — video messaging, **separate top-level section** (formerly "Video Vox")
- `src/services/relay/voxModeService.ts` — service still uses "Vox" naming internally
- `src/components/billing/TrialExpiredBlock.tsx` (FEATURES array) — canonical pricing copy
- `src/services/pulseAssistantService.ts` (line 257: `SECTION_LABELS`) — internal section taxonomy

---

## 2. Architecture Map

```
LandingPage.tsx (2,744 lines — god component)
│
├── 5 Sub-components (inlined, lines 25-470)
│   ├── QntmEcosIcon
│   ├── ThemeToggle hooks
│   ├── Hero signal-wave canvas (heroCanvasRef)
│   ├── CRM mesh-network canvas (crmCanvasRef)
│   └── Animated SVG icons for Relay mode cards (voxSvg)
│
├── Navigation (line 753)
│   ├── Logo + QntmEcos badge
│   ├── Desktop links: Features, Ecosystem, Scenarios, Pricing, Download dropdown, Docs, Privacy, Terms
│   ├── Theme toggle, User Guide button
│   ├── Log In / Get Started CTAs
│   └── Mobile menu (slide-down glass)
│
├── Main content (line 1056)
│   ├── Hero (line 1059) — "Every Signal. Every Voice. Every Decision."
│   │   └── Single CTA: Launch Pulse → onGetStarted
│   ├── Stats Strip (line 1141) — 7 stats from STATS array
│   ├── Feature Showcase (line 1156, id="features")
│   │   ├── A — Relay (line 1159, id="section-relay") "8 Ways to Speak" ⚠ STALE
│   │   ├── B — War Room (line 1297) "Your AI War Room"
│   │   ├── B2 — Email (line 1379) "Email, Reimagined"
│   │   ├── B3 — Messaging (line 1428) "Conversations That Convert"
│   │   ├── B4 — Calendar (line 1477) "Time, Orchestrated"
│   │   ├── B5 — Analytics (line 1526) "See Everything"
│   │   ├── C — Decisions (line 1573, id="section-decisions") "From Signal to Action"
│   │   └── D — CRM (line 1681, id="section-crm") "Know Your Network"
│   ├── Mobile Preview + Keyboard Shortcuts (line 1932)
│   ├── Trinity of Productivity (line 2093, id="ecosystem") — Pulse / Logos Vision / Entomate
│   ├── See It In Action (line 2202, id="scenarios") — Enterprise Flow / Voice-First Flow
│   ├── Available Everywhere (line 2269, id="download")
│   ├── Pricing (line 2392, id="pricing") — Pulse Team $100 / Pulse Growth $300
│   └── FAQ (line 2552) — 8 questions
│
└── Footer (line 2609)
    └── QntmEcos credit, product/legal links, social, copyright

External data flow:
landingData.ts (static export consts) ──► LandingPage.tsx (.map renders)
                                       └► TrialExpiredBlock.tsx (parallel copy of FEATURES — DRIFT RISK)
```

**No state management beyond local `useState` in LandingPage.tsx itself.** No services, no API calls, no Supabase usage. Pure marketing render with canvas animations.

---

## 3. Feature/Sub-feature Status Table

| Section | Landing-page Claim | Reality in App | Status | Notes |
|---|---|---|---|---|
| **Hero CTA** | "Launch Pulse" → onGetStarted | Routes to login | ✅ Working | — |
| **Stats: 8 Voice Modes** | 8 voice modes | Relay has 5 peers + Triage stream (6 views), Glimpse is a separate top-level section | ❌ **Wrong** | Stale number. Should be "5 Relay Peers" or merge: "6 Communication Surfaces" (Messages, Email, Relay, Glimpse, SMS, Summit) |
| **Stats: 7+ AI Models** | 7+ AI Models | Gemini, Claude, GPT-4, Whisper, ElevenLabs, AssemblyAI = 6 named in FAQ | ⚠️ Partial | Reasonable for a "+" claim; verify in `src/services/ai/aiService.ts` |
| **Stats: 4 CRM Integrations** | HubSpot, Salesforce, Pipedrive, Zoho | All four exist in `src/services/crm/` | ✅ Working | — |
| **Stats: 8 War Room Commands** | /brainstorm /decide /analyze /summarize /plan /debrief /risks /compare | War Room exists; verify count | ⚠️ Unverified | Need to verify in `src/components/WarRoom/useStudioCommands.ts` |
| **Stats: 5 Platform Syncs** | 5 platforms | Slack, Gmail, Outlook, Teams, Zoom, GMeet, HubSpot, SF, Pipedrive, Zoho = 10 in PLATFORMS array, but only 5 syncs claimed | ⚠️ Inconsistent | The number doesn't match the visualization; pick one definition |
| **Stats: 12 Archive Types** | 12 types | `src/components/Archives/` has 12 components but only a handful are "types" | ⚠️ Unverified | Need archiveHelpers / memoryDemoSeed audit |
| **Stats: 14 Settings Panels** | 14 panels | `src/components/settings/` has 30+ tsx files; ~16-18 top-level panels | ⚠️ Likely stale | Settings has grown beyond 14 |
| **8 Ways to Speak heading** | "8 Ways to Speak" Relay section | Relay = 5 peers (Direct, Channel, Broadcast, Notes, Live) + Triage stream | ❌ **Wrong** | Should be "5 Ways to Speak", "6 Surfaces of Voice", or rename approach |
| **VOX_MODES array (landingData.ts L14-23)** | 8 modes: Classic, Quick Vox, Team Vox, Vox Drop, Vox Notes, Video Vox, Pulse Radio, Voice Threads | Reality (`RelayView` type): triage \| direct \| channel \| broadcast \| notes \| live | ❌ **Wrong** | Most names don't match shipped app: "Video Vox" is now Glimpse (top-level), "Voice Threads" became VoiceRooms (Live peer), "Pulse Radio" = Broadcast peer, "Quick Vox" / "Vox Drop" / "Team Vox" are no longer mode names |
| **FAQ Q4: "8 Relay modes"** | 8 modes listed | Same stale list | ❌ **Wrong** | Direct contradiction with PULSE_TEAM_FEATURES which says "6 Relay modes" |
| **Pricing: PULSE_TEAM_FEATURES (L173)** | "All 6 Relay modes (Quick, Team, Drop, Threads, Radio, Notes)" | Same naming issue + count contradicts STATS | ❌ **Wrong** | The number 6 contradicts STATS=8, and the names still use Vox-era branding |
| **Trinity Pulse card (L2117)** | "8 Relay Modes + AI Transcription" | Same drift | ❌ **Wrong** | Same as VOX_MODES issue |
| **Footer description (L2622)** | "8 voice modes" | Same drift | ❌ **Wrong** | — |
| **Voice-First Scenario step 1 (L2251)** | "VOX DROP — Drop and Go" | "Vox Drop" is not a shipped mode name | ❌ **Wrong** | Use Relay or Quick Record/Schedule Send |
| **Glimpse (Video Messaging)** | Mentioned only as "Video Vox" inside VOX_MODES | Glimpse is a **separate top-level section** with its own feature surface (recording, conversations, AI transcripts, reactions, threading, search) | 🔇 **Missing** | Deserves its own section or at least a card |
| **Triage Stream** | Not mentioned | Relay's default landing view — central voice-message stream | 🔇 **Missing** | Should be the headline framing of Relay |
| **Summit (Experimental)** | Not mentioned | Live AI voice session, ships in Experimental sidebar group | 🔇 **Missing** | Could be a labs/experimental section |
| **Pulse Assistant (sidebar AI)** | Not mentioned | Floating AI assistant separate from War Room, context-aware per section | 🔇 **Missing** | Major feature, no surface |
| **Maps (Contact Map, ETA Share, Geofencing)** | Not mentioned | New stack: `src/components/contacts/map/*`, `src/services/geofenceService.ts`, `src/services/etaShareService.ts`, `src/components/EtaSharePage.tsx`, edge functions `maps-directions/`, `maps-distance/`, `maps-geocode/`, two migrations dated 2026-05-14 | 🔇 **Missing** | Brand-new infrastructure (per memory `project_pulse_maps_infra.md` + status: untracked) |
| **Workspaces / Multi-tenant** | Not mentioned | Full WorkspaceProvider + WorkspaceSwitcher + Invites + Team Settings + RolePermissionsMatrix | 🔇 **Missing** | Critical for the "Team" pricing tier message |
| **SMS** | Not mentioned (Stripe price hints "500 SMS / mo") | `AppView.SMS`, full SMS view, Twilio integration | 🔇 **Missing** | — |
| **Multi-Modal Search** | Not mentioned | `UnifiedSearchRedesign` lazy-loaded as MULTI_MODAL view | 🔇 **Missing** | Listed as keyboard shortcut "Ctrl+K" only |
| **Decisions Wizard** | "Decision Kanban" + "AI Task Prioritizer" cards | Real product includes wizard frames (allocate, build, conflict, hire, pickTool, strategy) | ⚠️ Partial | Cards understate the depth |
| **Dashboard widgets** | "Pulse in Your Pocket" mobile preview only | 14+ widgets: PulseNudges, RelayQuickRecorder, TeamRadar, Decisions strips, Tasks strips, Glance tiles, etc. | 🔇 **Missing** | Dashboard depth invisible |
| **Onboarding & OrgSetup** | Not mentioned | `OrgOnboardingModal`, `OrgSetupChecklist` exist | ➖ N/A | OK to omit from marketing |
| **MobileBottomNav** | Phone mockup shows custom layout | Real MobileBottomNav.tsx exists | ⚠️ Asset drift | Mockup doesn't match shipped mobile |
| **Pricing Team — $100/mo** | $100/mo monthly, $1000/yr | TrialExpiredBlock.tsx (L56-58) confirms $100/$1000 | ✅ Working | — |
| **Pricing Growth — $300/mo** | $300/mo monthly, $3000/yr | No code path validated — only on landing page | ⚠️ Unverified | TrialExpiredBlock only ships `pulse_team` plan ID; Growth tier may not be in checkout yet |
| **Trinity card: Pulse** | "Real-time messaging, 8 voice modes, AI studio, full email client, calendar, and analytics" | Missing CRM intelligence/contacts which is in the Pulse app, not Logos Vision | ⚠️ Misleading | The Logos Vision card duplicates what's actually in Pulse (relationship scoring lives in Pulse contacts) |
| **Logos Vision card** | "Deep relationship intelligence with health scoring and 4 native CRM integrations" | Logos Vision is a *separate* product, not bundled. Pulse has 4 CRM integrations of its own (which are the same ones) | ⚠️ Confusing | Need to clarify what's Pulse vs. Logos Vision since the user lives in Pulse |
| **Entomate card** | "Workflow Builders, Auto-Task Execution, Cross-Platform Actions" | Entomate is a sister product (per memory `project_entomate_*`) | ✅ Aspirational | OK as ecosystem context |
| **Download — Windows** | v25.1.3 installer link | Releases at github.com/FatherSonOne/Pulse-1 — verify exists | ⚠️ Unverified | Version may be stale (v25.1.3 vs. current build) |
| **Download — macOS / iOS** | "Universal" — inactive | App not built for macOS/iOS | ✅ Honest | "Coming soon" |
| **Download — F-Droid** | "Open Source" — inactive | Not on F-Droid | ✅ Honest | "Coming soon" |
| **FAQ Q1: "What is Pulse?"** | Lists Relay, calendar, contacts, etc. | Mostly accurate, but doesn't surface Glimpse, Summit, Maps, Workspaces | ⚠️ Outdated | Update to current feature set |
| **FAQ Q8: Devices** | "Windows, Android. iOS and macOS coming soon" | Capacitor build for Android exists. macOS/iOS not shipped | ✅ Working | — |
| **Shortcut: "Switch Vox mode 1-8"** (landingData.ts L74) | Numeric mode switcher 1-8 | Real shortcuts in `useRelayKeyboardShortcuts.ts` likely 1-5 (5 peers) | ⚠️ Likely stale | Verify; remove or update range |

---

## 4. Issues by Severity

### 🔴 Critical (Customer-facing factual incorrectness)

| ID | Issue | Location | Impact |
|---|---|---|---|
| C1 | **"8 Voice Modes" stat** is incorrect — Relay has 5 peers (+Triage) | `landingData.ts:5`, hero stats strip | Anchors a wrong number repeated across the entire page |
| C2 | **"8 Ways to Speak"** section title + 8-card radial orbit shows Vox-era mode names that no longer match the app | `LandingPage.tsx:1179`, `landingData.ts:14-23` | The flagship feature section misrepresents the product |
| C3 | **Internal self-contradiction:** STATS says "8 Voice Modes", PULSE_TEAM_FEATURES says "All 6 Relay modes", FAQ says "8 Relay modes" — three different counts on the same page | `landingData.ts:5`, `:49`, `:173` | Visible inconsistency damages trust |
| C4 | **Glimpse (video messaging) is invisible** — only appears buried as "Video Vox" inside the Vox-modes radial, but it's a full top-level section in the shipped app | landing page entirely | Whole product surface undisclosed |
| C5 | **FAQ Q4 still describes 8 Vox modes verbatim** including stale names "Quick Vox", "Team Vox", "Vox Drop" | `landingData.ts:49` | Pre-purchase FAQ misleads buyers |
| C6 | **Voice-First Scenario step 1** labels the system "VOX DROP" — a name that doesn't exist in the shipped UI | `LandingPage.tsx:2251` | Demo flow describes a feature that isn't there by that name |
| C7 | **Trinity Pulse card claim "8 Relay Modes + AI Transcription"** is wrong | `LandingPage.tsx:2117` | Same drift, prominently placed |
| C8 | **Footer line "AI-powered messaging, email, 8 voice modes, calendar..."** | `LandingPage.tsx:2622` | Last impression carries stale stat |
| C9 | **Pulse Growth tier ($300/mo) on landing but checkout only ships `pulse_team`** | `LandingPage.tsx:2497`, `TrialExpiredBlock.tsx:46` | Possible 404/checkout failure if user clicks "Start with Growth"; need to verify `billingService.createCheckout` supports `pulse_growth` planId |

### 🟡 Medium (Missing features, inconsistencies, UX gaps)

| ID | Issue | Location |
|---|---|---|
| M1 | **Maps / Geofencing / ETA Share** — brand-new product surface, zero mention | landing page entirely |
| M2 | **Workspaces (multi-tenant)** — critical for "Team" positioning, not mentioned | landing page entirely |
| M3 | **Summit (Experimental voice session)** — not mentioned even as a beta teaser | landing page entirely |
| M4 | **Pulse Assistant (sidebar AI)** — sectionally context-aware AI, distinct from War Room, no mention | landing page entirely |
| M5 | **Multi-Modal Search** — `UnifiedSearchRedesign` ships in app, only referenced as Ctrl+K shortcut | `landingData.ts:58` |
| M6 | **Triage Stream** — Relay's default view, the actual "inbox" for voice messages, not framed | Relay section |
| M7 | **Stats "5 Platform Syncs"** doesn't match the 10 platforms in `PLATFORMS` array; pick a number that reflects truth | `landingData.ts:5,32-43` |
| M8 | **Stats "14 Settings Panels"** likely outdated — settings has grown to 18+ top-level panels | `landingData.ts:5` |
| M9 | **Stats "12 Archive Types"** unverified | `landingData.ts:5` |
| M10 | **CRM Trinity confusion**: Logos Vision card claims CRM intelligence, but actual CRM integrations live in Pulse Settings → Integrations. Need to clarify Pulse-internal CRM vs. Logos Vision product. | `LandingPage.tsx:2127-2151` |
| M11 | **Phone mockup** in "Pulse in Your Pocket" section doesn't match shipped MobileBottomNav.tsx | `LandingPage.tsx:1947-2000` |
| M12 | **Keyboard shortcut "1-8: Switch Vox mode"** — likely 1-5 now in `useRelayKeyboardShortcuts.ts` | `landingData.ts:74` |
| M13 | **"AI Calendar Assistant — 4-tab AI panel"** — verify the panel still has 4 tabs | `landingData.ts:154` |
| M14 | **"Video Vox" in PULSE_TEAM_FEATURES** — should be "Glimpse" | `landingData.ts:174` |
| M15 | **STUDIO_FEATURES export is unused** — `LandingPage.tsx:1317-1353` inlines the same data instead of importing from `landingData.ts` | `landingData.ts:101-132` |
| M16 | **EMAIL_FEATURES, MESSAGING_FEATURES, CALENDAR_FEATURES, ANALYTICS_FEATURES exports unused** — same pattern; landing page inlines duplicates | `landingData.ts:134-166` |

### 🟢 Nice-to-Have (Polish, optimization, completeness)

| ID | Issue | Location |
|---|---|---|
| N1 | God component — 2,744 lines. The 6 feature sections (Relay/War Room/Email/Messaging/Calendar/Analytics) could each be a sub-component file. | `LandingPage.tsx` |
| N2 | Animated SVG icons defined inline (`voxSvg(i)`) at line 473. Move to `LandingPage/voxSvg.tsx`. | `LandingPage.tsx:473-535` |
| N3 | Canvas animations (hero signal wave L169, CRM mesh L316) are inline. Extract to `LandingPage/heroCanvas.ts` and `LandingPage/crmMeshCanvas.ts`. | `LandingPage.tsx:169-471` |
| N4 | FAQ_DATA unused outside this file but FAQ section inline-loops through it correctly — OK | `LandingPage.tsx:2562` |
| N5 | SHORTCUT_GROUPS exists in landingData but no section renders it (used to be a "Built for Speed" panel?) — find usage or remove dead export | `landingData.ts:56-99` |
| N6 | The "Built for Speed" placeholder at line 2031 — verify what content renders there now | `LandingPage.tsx:2031` |
| N7 | Hero stats grid uses `grid-cols-8` on `sm:` — with 7 items, one cell goes empty (could re-verify visual alignment) | `LandingPage.tsx:1142` |
| N8 | `lp-orbit-card` radial chart math `(360 / VOX_MODES.length) * i - 90` auto-fits if the array length changes — no math fix needed when shrinking from 8 → 5 | `LandingPage.tsx:1259` |
| N9 | Light-mode polish — radial-gradient backgrounds set `opacity: 0` in light mode for many sections, dimming the visual identity. Verify intentional. | multiple |
| N10 | Aria/SR-only patterns are generally good; verify `aria-controls` targets match across mobile menu, FAQ accordion, and tabs. | nav + FAQ |

### Dead Code / Hygiene Findings

- **Unused exports** in `landingData.ts`: `STUDIO_FEATURES`, `EMAIL_FEATURES`, `MESSAGING_FEATURES`, `CALENDAR_FEATURES`, `ANALYTICS_FEATURES`, `SHORTCUT_GROUPS` — the landing page inlines this data instead of importing. Either wire them up or delete.
- **Duplicated FEATURES list**: `landingData.ts:170 (PULSE_TEAM_FEATURES)` and `TrialExpiredBlock.tsx:17 (FEATURES)` are identical-by-intent but stored separately. Comment at L170 acknowledges this. **Consolidate** — import from landingData in TrialExpiredBlock or vice versa.
- **`AppView.TOOLS`** referenced in `pulseAssistantService.ts:271` but **not defined** in `types.ts` enum (lines 9-29). Dead enum key or missing route.
- **`<linearGradient id="div-grad">`** declared at line 31 but never referenced in this file (could be used elsewhere via `url(#div-grad)`). Verify or remove.

---

## 5. Revisal Plan (Phased)

### Phase 1 — Fix Factual Errors (1-2 hours) 🔴

1. **`landingData.ts:5` — STATS array**
   - Change `{ value: '8', label: 'Voice Modes' }` → `{ value: '5', label: 'Relay Peers' }` OR `{ value: '6', label: 'Comm Surfaces' }` (Messages, Email, Relay, Glimpse, SMS, Summit)
   - Reduce or update `8 War Room Commands` after verifying actual count in `useStudioCommands.ts`
   - Update `5 Platform Syncs` to match the real integration count (or rename "Native Integrations" with the right number)
   - Audit and update `12 Archive Types`, `14 Settings Panels`

2. **`landingData.ts:14-23` — VOX_MODES**
   - Replace with shipped names:
     ```ts
     export const RELAY_PEERS = [
       { icon: 'fa-solid fa-inbox',      name: 'Triage',    desc: 'Your unified voice-message stream — every Relay message in one prioritized list' },
       { icon: 'fa-solid fa-wave-square', name: 'Direct',    desc: 'One-to-one voice messages with waveform visualization and AI transcription' },
       { icon: 'fa-solid fa-users',       name: 'Channel',   desc: 'Channel-based voice threads with @mentions and group transcription' },
       { icon: 'fa-solid fa-radio',       name: 'Broadcast', desc: 'Live broadcast mode — stream to your entire team simultaneously' },
       { icon: 'fa-solid fa-note-sticky', name: 'Notes',     desc: 'Personal voice journaling with AI summary and keyword extraction' },
       { icon: 'fa-solid fa-tower-broadcast', name: 'Live',  desc: 'Discord-style persistent voice rooms — always-on hangouts for your team' },
     ];
     ```
   - Rename the exported const from `VOX_MODES` → `RELAY_PEERS` (and update usage at `LandingPage.tsx:1258`).
   - Glimpse moves OUT of this section into its own card/section.

3. **`LandingPage.tsx:1179` — section heading**
   - "8 Ways to Speak" → "5 Ways to Speak, One Unified Stream" or "Voice, Made Async" or "Relay — Voice, Reimagined"

4. **`landingData.ts:49` — FAQ Q4**
   - Rewrite: "What are the Relay peers?" with the new 5-peer description, drop legacy Vox names.

5. **`landingData.ts:170-176` — PULSE_TEAM_FEATURES**
   - `'All 6 Relay modes (Quick, Team, Drop, Threads, Radio, Notes)'` → `'All 5 Relay peers + Triage stream'`
   - `'Video Vox + Studio RAG'` → `'Glimpse video messaging + Studio RAG'`
   - **Also update `TrialExpiredBlock.tsx:18-23` FEATURES array to match** (or import shared list).

6. **`LandingPage.tsx:2117` — Trinity Pulse card**
   - `8 Relay Modes + AI Transcription` → `5 Relay Peers + Glimpse + AI Transcription`

7. **`LandingPage.tsx:2622` — Footer**
   - `8 voice modes` → `Relay + Glimpse voice & video` or `voice and video messaging`

8. **`LandingPage.tsx:2251` — Voice-First Scenario step 1**
   - System label "VOX DROP" → "RELAY DIRECT" or "QUICK RECORD"
   - Body text update: "Drop and Go" stays great; just change the system label

9. **`landingData.ts:74` — keyboard shortcut**
   - `[ keys: ['1–8'], desc: 'Switch Vox mode' ]` → `[ keys: ['1–5'], desc: 'Switch Relay peer' ]` (verify against `useRelayKeyboardShortcuts.ts`)

10. **Verify or remove Pulse Growth tier in pricing**
    - Check `billingService.createCheckout` supports `planId: 'pulse_growth'`. If not, either ship the price ID + Stripe product or hide the Growth card with a "Coming soon" badge.

### Phase 2 — Surface Missing Features (2-3 hours) 🟡

11. **Add a Glimpse section** to Feature Showcase between Relay and War Room
    - Cards: "Face-cam + Screen recording", "AI Transcripts on every video", "Reactions + Threading", "Search across all glimpses", "Reply Drafts with AI"
    - Header: "Video, Without the Meeting" or "Glimpse — async video for your team"

12. **Add a Workspaces / Team section** (or fold into Trinity intro)
    - "Built for teams — multi-workspace, roles, invites, billing-per-org"
    - This is foundational marketing for the $100 Team tier

13. **Add a Maps / Field Operations section** (or "Pulse in the Real World")
    - Contact Map, ETA Share, Geofencing, Travel buffers
    - Reference live broadcast + Maps for the field-team use case
    - **Caveat:** per memory `project_pulse_maps_infra.md`, geofencing/ETA/Autopilot were stubs in early 2026 — verify they're real now (the new migration files dated 2026-05-14 suggest yes)

14. **Add a Summit teaser** under an "Experimental" or "Coming next" strip
    - "Summit — live AI voice sessions with full transcript and artifact extraction"

15. **Add a Pulse Assistant mention** to the War Room section OR as its own card
    - "Section-aware AI assistant — Ctrl+/ from any view"

16. **Update FAQ Q1 "What is Pulse?"** to surface Glimpse, Maps, Workspaces, Summit.

17. **Clarify Trinity Pulse vs. Logos Vision boundary**:
    - Pulse card: keep relationship intelligence (it lives in Pulse contacts)
    - Logos Vision card: re-position as "Bidirectional sync — your case-management system" (since most users won't have Logos Vision)

### Phase 3 — Refactor & Consolidate (2-3 hours) 🟢

18. **Split LandingPage.tsx** into per-section components:
    - `LandingPage/sections/HeroSection.tsx`
    - `LandingPage/sections/RelaySection.tsx`
    - `LandingPage/sections/WarRoomSection.tsx`
    - `LandingPage/sections/EmailSection.tsx`
    - `LandingPage/sections/MessagingSection.tsx`
    - `LandingPage/sections/CalendarSection.tsx`
    - `LandingPage/sections/AnalyticsSection.tsx`
    - `LandingPage/sections/DecisionsSection.tsx`
    - `LandingPage/sections/CRMSection.tsx`
    - `LandingPage/sections/TrinitySection.tsx`
    - `LandingPage/sections/ScenariosSection.tsx`
    - `LandingPage/sections/DownloadSection.tsx`
    - `LandingPage/sections/PricingSection.tsx`
    - `LandingPage/sections/FAQSection.tsx`
    - `LandingPage/sections/FooterSection.tsx`
    - `LandingPage/canvas/heroCanvas.ts` + `crmMeshCanvas.ts`
    - `LandingPage/voxSvg.tsx` (Relay mode SVGs)

19. **Wire up unused landingData exports** (EMAIL_FEATURES etc.) — replace inline literals with imports.

20. **Single source of truth for pricing features**:
    - `PULSE_TEAM_FEATURES` and `PULSE_GROWTH_FEATURES` should be imported by `TrialExpiredBlock.tsx` (currently a parallel copy).

21. **Remove or define `AppView.TOOLS`** in `types.ts` — currently referenced in pulseAssistantService.

### Phase 4 — New Features & Polish 🟢

22. **Add a "What's New" or changelog ribbon** linking to the Maps launch, Workspaces rollout, etc.
23. **Live demo embeds** for Relay (audio waveform), Glimpse (video preview), War Room (typed transcript).
24. **Honest "Built in public" badge** linking to GitHub commits if FatherSonOne is the dev story.
25. **A11y review**: verify reduced-motion compliance for the orbit ring and signal-wave canvas.

---

## 6. Agent Prompt for Implementation

Paste the prompt below into a fresh Claude session to execute Phase 1 + Phase 2 of this audit. It is self-contained.

````md
# Task: Update Pulse Landing Page to Reflect Shipped Product (Phase 1 + 2)

You are editing the marketing landing page for Pulse to fix factual drift between the page and the shipped app. Voxer was renamed to Relay; the 8-mode "Vox" radial chart is no longer accurate (5 peers + Triage stream remain in Relay, "Video Vox" became a separate top-level section called **Glimpse**, and several mode names no longer exist).

## Ground truth references (READ THESE FIRST)
- `src/types.ts` (line 9) — `AppView` enum: DASHBOARD, MESSAGES, EMAIL, SMS, RELAY, GLIMPSE, CALENDAR, MEETINGS, CONTACTS, LIVE (Summit), LIVE_AI (War Room), ARCHIVES, SETTINGS, MULTI_MODAL (Search), ANALYTICS, DECISIONS_TASKS, USERS_GUIDE, CONTACT_MAP
- `src/components/Relay.tsx` (line 63) — `RelayView = 'triage' | 'direct' | 'channel' | 'broadcast' | 'notes' | 'live'`
- `src/components/Sidebar/Sidebar.tsx` (line 72-119) — authoritative section grouping (Communication: Messages, Email, Relay, Glimpse; Work & People: Calendar, Meetings, Contacts, Decisions & Tasks; Intelligence: Search, Analytics, War Room, Archives, User Guide; Experimental: Summit)
- `src/components/Glimpse/Glimpse.tsx` — Glimpse is a full top-level section with recording, conversations, AI transcripts, reactions, threading, search
- `src/components/billing/TrialExpiredBlock.tsx` (line 17-24) — FEATURES array that must stay in sync with landing-page PULSE_TEAM_FEATURES

## Files to edit
1. `src/components/LandingPage/landingData.ts` (204 lines)
2. `src/components/LandingPage.tsx` (2,744 lines)
3. `src/components/billing/TrialExpiredBlock.tsx` (sync the FEATURES list)

## Phase 1 — Fix factual errors

### 1. landingData.ts — STATS (line 4-12)
Replace `{ value: '8', label: 'Voice Modes' }` with `{ value: '5', label: 'Relay Peers' }`. Audit the other stat counts:
- `8 War Room Commands` — verify in `src/components/WarRoom/useStudioCommands.ts` and update if drifted
- `5 Platform Syncs` — pick a definition that matches the PLATFORMS array length (10) or trim
- `12 Archive Types` — verify in `src/components/Archives/archiveHelpers.ts` or memory seed
- `14 Settings Panels` — count top-level panels in `src/components/settings/*.tsx` (likely 16-18 now)

### 2. landingData.ts — Rename VOX_MODES → RELAY_PEERS (line 14-23)
Replace with the 6 real Relay surfaces. Use this exact array:
```ts
export const RELAY_PEERS = [
  { icon: 'fa-solid fa-inbox',       name: 'Triage',    desc: 'Your unified voice-message stream — every Relay message in one prioritized list' },
  { icon: 'fa-solid fa-wave-square', name: 'Direct',    desc: 'One-to-one voice messages with waveform visualization and AI transcription' },
  { icon: 'fa-solid fa-users',       name: 'Channel',   desc: 'Channel-based voice threads with @mentions and group transcription' },
  { icon: 'fa-solid fa-radio',       name: 'Broadcast', desc: 'Live broadcast mode — stream to your entire team simultaneously' },
  { icon: 'fa-solid fa-note-sticky', name: 'Notes',     desc: 'Personal voice journaling with AI summary and keyword extraction' },
  { icon: 'fa-solid fa-tower-broadcast', name: 'Live',  desc: 'Discord-style persistent voice rooms — always-on hangouts for your team' },
];
```

### 3. LandingPage.tsx — Relay section update
- Line 1179: change `"8 Ways to Speak"` to `"5 Peers, One Stream"` (or similar honest framing)
- Line 1258: change `VOX_MODES.map(...)` to `RELAY_PEERS.map(...)` — the radial math `(360 / arr.length) * i - 90` auto-fits the smaller array
- Update the import at the top to use `RELAY_PEERS` instead of `VOX_MODES`

### 4. landingData.ts — FAQ Q4 (line 49)
Rewrite to: `{ q: "What are the Relay peers?", a: "Triage (your unified voice-message stream), Direct (one-to-one voice with AI transcription), Channel (voice threads with @mentions), Broadcast (live team broadcast), Notes (personal voice journaling), and Live (persistent voice rooms). Plus Glimpse — async video messaging — as a separate top-level section." }`

### 5. landingData.ts — Pricing features (line 170-177)
Replace PULSE_TEAM_FEATURES with:
```ts
export const PULSE_TEAM_FEATURES = [
  'Unlimited team seats',
  'All 5 Relay peers + Triage stream',
  'Glimpse video messaging + Studio RAG',
  'Email, calendar, messaging, meetings',
  'Maps + ETA share + geofencing',
  'Advanced analytics + full ecosystem bridge',
  '2,000 AI messages / 500 SMS / 50 GB storage / mo',
];
```

### 6. TrialExpiredBlock.tsx — sync FEATURES (line 17-24)
Either:
- (Preferred) import `PULSE_TEAM_FEATURES` from `../LandingPage/landingData` and use it directly, OR
- Copy the new array into the local FEATURES const so they match exactly

### 7. LandingPage.tsx — Other stale "8 modes" strings
- Line 2117: `<Check />8 Relay Modes + AI Transcription` → `<Check />5 Relay Peers + Glimpse + AI Transcription`
- Line 2622: `"8 voice modes"` → `"voice and video messaging via Relay and Glimpse"`
- Line 2251: scenario step `system: 'VOX DROP'` → `system: 'RELAY DIRECT'` (or `'QUICK RECORD'`); body text fine as is

### 8. landingData.ts — Keyboard shortcut (line 74)
- Change `[ keys: ['1–8'], desc: 'Switch Vox mode' ]` → `[ keys: ['1–5'], desc: 'Switch Relay peer' ]` (verify against `src/hooks/useRelayKeyboardShortcuts.ts`)

## Phase 2 — Surface missing features

### 9. Add Glimpse section (LandingPage.tsx around line 1294, after Relay's SectionDivider)
Use the same card-grid pattern as the Email/Messaging sections. Six cards:
- "Face-cam + Screen Recording" — Capture the screen, your face, or both
- "AI Transcripts on Every Glimpse" — Searchable text from every video
- "Reactions, Threading, Bookmarks" — Async conversations on video
- "Reply Drafts" — AI-generated reply outlines (see `GlimpseReplyDraftPanel.tsx`)
- "Full Search" — Find any moment by transcript text
- "Send to Contacts or Threads" — Same audience model as Relay

Color palette: pink/coral (Video icon). Section ID: `section-glimpse`. Header: "Video, Without the Meeting".

### 10. Add Maps / Field Operations card section (after CRM section ~line 1923)
**Verify first** that geofence/eta-share are live (check `src/services/geofenceService.ts` and `src/components/EtaSharePage.tsx` — the new migrations 20260514* suggest they shipped).

Six cards:
- Contact Map — Plot your network geographically
- ETA Share — Live arrival countdown with one-tap share
- Geofence Alerts — Auto-log arrivals + departures
- Travel Buffers — Auto-padded calendar around meetings
- Real-Time Location — Optional live broadcast to teammates
- Route Planning — Multi-stop optimization

Color palette: emerald/teal. Section ID: `section-maps`.

### 11. Add Workspaces messaging
Either:
- Drop a small "Built for teams" strip above the Trinity section
- Or add a card to the Decisions section: "Workspaces — multi-tenant by design"

### 12. Update FAQ Q1 to mention Glimpse, Maps, Workspaces
Replace landingData.ts:46:
```
{ q: "What is Pulse?", a: "Pulse is an AI-powered communication and productivity platform for high-performance teams. It combines: messaging, email, voice (Relay with 5 peers + Triage stream), async video (Glimpse), calendar with meetings, contacts with CRM intelligence, maps with ETA share, an AI research studio (War Room), and analytics — all in one interface, organized by workspace." }
```

## Verification

After edits:
1. Open landing page in dev: stats strip should show "5 Relay Peers" not "8 Voice Modes"
2. Relay section radial chart should show 6 cards (auto-fits via the existing math)
3. Pricing card should match TrialExpiredBlock.tsx exactly
4. FAQ Q4 should mention 5 peers, not 8 modes
5. Search the codebase for any remaining `'Vox Drop'`, `'Quick Vox'`, `'8 voice modes'`, `'8 Relay modes'`, `'8 Ways'` strings — flag any survivors
6. Trinity Pulse card should not say "8 Relay Modes"

## Constraints
- Do NOT change the visual design or color system — only the content/data
- Do NOT touch the canvas animations
- Do NOT add new dependencies
- Match the existing TypeScript and React patterns (functional components, tailwind, lucide-react icons)
- Keep `landingData.ts` as the single source of marketing copy; if you need to inline new content, add it as a new export there and import it

## What success looks like
A user scanning the landing page sees exactly what's in the app today: 5 Relay peers (with Triage stream), Glimpse for video, Maps for field ops, and workspaces for teams — no Vox-era terminology anywhere on the page.
````

---

## 7. Out-of-Scope Notes

- **CSS file (`LandingPage.css`, 1,242 lines)** was not reviewed in detail in this audit but is referenced by `lp-orbit-card`, `hero-asymm-*`, `lp-mobile-*`, `lp-bar-*`, `lp-throb-*`, `lp-flash`, `lp-ecg-line`, `lp-orbit-g`, `lp-icon-*` class names. CSS may carry the same legacy `--cv-*` / `--pr-*` orange-RGB shadow patterns from the pre-coral rebrand (see memory `project_pulse_relay_css_legacy.md`). A separate pass should audit it after Phase 1.
- **SEO/Open Graph meta tags** not part of this component — check `index.html` separately.
- **Privacy / Terms pages** linked but not audited — verify they exist at `/privacy` and `/terms`.
- **Stripe Pulse Growth product ID** — verify that `pulse_growth` price IDs exist in Stripe before keeping the Growth tier visible (see memory `reference_stripe_config.md`).
