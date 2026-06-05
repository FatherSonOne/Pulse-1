# Landing Page — Quick Handoff (2026-05-15)

**Status:** Audit + critique + animate + multiple polish passes complete. Page is factually accurate, off the AI-slop banlist, motion system shipped, palette unified, light mode is now first-class. **One major item remains: Wave 4.1 per-section card-grid art direction.**

---

## Read this first

1. **Full audit + status log:** [LANDING_PAGE_AUDIT_2026-05-14.md](LANDING_PAGE_AUDIT_2026-05-14.md) — every wave, every fix, before/after notes
2. **User constraint memory:** `C:\Users\Aegis{FM}\.claude\projects\f--pulse1\memory\feedback_landing_hero_preserved.md` — hero block (logo + tagline + CTA + signal-wave canvas) is locked. The "Every Decision." gradient was approved to be tuned (now coral two-stop, was coral→pink→violet).
3. **Design system reference:** `PRODUCT.md` + `DESIGN.md` at project root (loaded via `node .claude/skills/impeccable/scripts/load-context.mjs` if needed)

## What shipped (every session)

### Content (Waves 1-2 + 5)
- STATS rewritten (8 Voice Modes → 5 Relay Peers + 6 Comm Surfaces); verified counts
- `VOX_MODES` renamed to `RELAY_PEERS` with shipped names: Triage / Direct / Channel / Broadcast / Notes / Live (each carries shipped keyboard shortcut letter)
- Relay section heading: "8 Ways to Speak" → "Five peers, one stream."
- FAQ Q1 + Q4 rewritten to surface Glimpse / Maps / Workspaces / Triage
- `PULSE_TEAM_FEATURES` updated; **`TrialExpiredBlock.tsx` now imports from `landingData`** (single source of truth)
- Pulse Growth pricing corrected to real Stripe values: **$249/mo, $2,490/yr** (was $300/$3,000)
- Trinity Pulse card / Footer / Voice-First Scenario step 1 / keyboard shortcut labels all updated
- **3 new sections added:** Glimpse (between Relay + War Room), Maps & Field Ops (after CRM), Workspaces band (compact mono-label, no card grid)
- 7 unused exports removed from `landingData.ts`

### Slop cleanup (Wave 3)
- 14 of 15 gradient-text instances removed (hero "Every Decision." preserved)
- JetBrains Mono scoped to landing-page uppercase tracked labels via `.lp-dark` / `.lp-light` ancestor selectors
- Pulse Growth pricing card recoloured: violet/purple/indigo → zinc-950 + 1px rose accent + outline CTA (kills AI-startup anti-reference)

### Hero stats strip (Wave 4.2)
- 7-cell `grid-cols-8` hero-metric template replaced with single declarative sentence: `"5 Relay peers + Triage stream · Glimpse video · War Room with 8 slash commands · 4 native CRMs · Maps and ETA share. One surface."`

### Motion hygiene (Wave 4.3 + Animate)
- `bg-black` → tinted `rgba(8,8,8,0.7)`; bounce ease-in-out → cubic-bezier(0.16, 1, 0.3, 1)
- Full `prefers-reduced-motion` block covers every animation
- **Animate A:** section heading blur-in on viewport entry (auto-targets every `<h2>` in `#main-content`)
- **Animate B:** card hover lifts capped at 2px across 14 instances (was 8px theatrical)
- **Animate C:** primary CTAs get DESIGN.md "coral halo" hover shadow + 1px lift
- **Animate D:** Relay orbit hover → coral connector line draws toward centre + JetBrains Mono shortcut badge (T/D/C/B/N/L)
- **Animate E:** CRM mesh canvas recurring activity pings from random named nodes (max 6 concurrent, ~2-3s cadence)
- **Animate F:** section divider SVG strokes draw in on viewport entry
- **Animate G:** footer Pulse ECG wordmark path draws in when footer enters viewport

### Hero typography (A/B/C/D)
- **A:** "Every Decision." gradient cooled from `#f43f5e → #ec4899 → #a855f7` (violet drift) to `#f43f5e → #fb7185` two-stop (stays inside brand palette)
- **B:** "Launch Pulse" CTA brought to parity with `lp-cta-primary` system (220ms ease-out-expo, coral halo, 1px lift) — `.hero-asymm-cta` rule in `LandingPage.css`
- **C:** letter-spacing relaxed `-0.03em → -0.02em`, line-height `1.04 → 1.08`
- **D (responsive fix):** `.hero-asymm-content { max-width: min(880px, 92vw) }` (was `52%`), headline `clamp(26px, 6.5vw, 80px)` (was `64-96px`), per-line `white-space: nowrap`, mobile font-size override removed. **"Every Decision." no longer clips at any viewport.**

### Polish (Polish 1-3 + 4.1.b + Light mode)
- **Polish 1:** Pricing Monthly/Yearly toggle — single coral pill slides between states (280ms ease-out-expo) instead of per-button gradient swap
- **Polish 3:** Six always-on icon animations (`lp-icon-bob/-spin/-throb/-zap/-tilt/-stamp`) quieted at rest; hover plays a single decisive iteration then settles
- **Wave 4.1.b — Section background palette unified:** 11 different coloured radial gradients (indigo, purple, blue, emerald, amber, teal, violet) collapsed into one coral-rose system. Flagship sections (Relay, Decisions, CRM) slightly stronger; utility sections quieter. Chip/icon hues per section preserved so differentiation still reads. Logos Vision panel's indigo/violet kept (it's LV's brand)
- **Light mode polish:** all 11 sections previously set `opacity: 0` in light mode → now `0.55` (or `× 0.55` for scroll-triggered ones). Light mode is no longer flat zinc; the unified coral system shows through subtly on paper-warm

### Detector
- Impeccable CLI: **23 findings → 0 real issues** (only 2 false positives remain: selection-state class on line 599 root wrapper, hover transition on line ~3153 social icon)

---

## What's deferred (the one major item left)

### Wave 4.1 — Per-section card-grid art direction

The six (now eight, with Glimpse + Maps) feature sections all use the same 3-column card grid (icon + heading + 3-line desc + tag chips). The critique flagged this as "identical card grids — impeccable shared-laws absolute ban" and recommended per-section art direction.

Suggested directions per the critique:

| Section | Direction | Notes |
|---------|-----------|------|
| **War Room** | Terminal-style live transcript with `/slash` commands streaming | No card grid; live mock |
| **Email** | Stacked inbox preview rail with one selected thread expanded | Inbox aesthetic |
| **Messaging** | Side-rail thread mock with AI Summarisation pinned | Conversation aesthetic |
| **Calendar** | Flat agenda strip with conflict markers | No cards |
| **Analytics** | One big chart hero (Linear-style) + single sentence | Easiest to start — only 4 cards |
| **Decisions** | Horizontal 2×2 mini-kanban with sample cards | Kanban aesthetic |
| **Glimpse + Maps** | Vary column counts; densify one hero-row card each | Already added, keep as-is or vary lightly |

Each section is ~30-60 min in a dedicated `/impeccable shape` session. Recommended starting order: **Analytics** (simplest, 4 cards), then **War Room** (highest distinctive potential), then the rest.

---

## Key files modified

| File | Role |
|------|------|
| `src/components/LandingPage.tsx` | God-component (~3,200 lines) — all sections, hero, nav, footer, inline CSS block, animations |
| `src/components/LandingPage.css` | Hero asymmetric layout, orbital ring, mobile menu, signal-wave canvas styles |
| `src/components/LandingPage/landingData.ts` | Static marketing copy: RELAY_PEERS, FAQ_DATA, SHORTCUT_GROUPS, PULSE_TEAM_FEATURES, PULSE_TEAM_PRICING, PULSE_GROWTH_FEATURES, PULSE_GROWTH_PRICING |
| `src/components/billing/TrialExpiredBlock.tsx` | Now imports `PULSE_TEAM_FEATURES` from landingData (single source of truth) |
| `docs/LANDING_PAGE_AUDIT_2026-05-14.md` | Full audit + status log |

## Key memories to load

- `feedback_landing_hero_preserved` — hero block locked, only Decision gradient tunable
- `reference_stripe_config` — confirmed Stripe price IDs for Team ($100/$1000) and Growth ($249/$2490)
- `project_pulse_relay_rename` — Voxer→Relay rebrand context
- `reference_pulse_design_tokens` — canonical `--pulse-*` vars
- `project_pulse_maps_infra` — Maps stack reality check (geofencing was stub; verified live by 2026-05-14)

## Critical CSS classes added this work (callsite-safe)

- `.lp-reveal` / `.lp-revealed` — IntersectionObserver-driven scroll reveals
- `.lp-section-divider` — wrapper for SVG draw-in
- `.lp-card-hover` — opt-in for system-compliant 2px lift
- `.lp-cta-primary` — coral halo on hover (DESIGN.md elevation vocabulary)
- `.lp-orbit-card` / `.lp-orbit-link` / `.lp-orbit-key` — Relay orbital hover
- `.lp-footer-mark` — footer ECG draw-in

## Build / verify quickly

```bash
cd f:/pulse1
npx impeccable --json src/components/LandingPage.tsx | grep '"name"'
# Expected: 2 false positives (line 599 selection, line ~3153 hover) — no real issues
```

Dev server: `npm run dev` (Vite). All changes are HMR-safe.

---

## Resume point

Next session, the appropriate `/impeccable` command is:

```
/impeccable shape Analytics section as a single chart hero with the four metric cards collapsed into one sparkline + sentence pair
```

That's the smallest scope first card-grid section to redesign. Once Analytics ships, repeat for War Room, Email, Messaging, Calendar, Decisions one at a time.
