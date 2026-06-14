# Section Launch Readiness — Can Real Users Trust This?

**Target section:** $ARGUMENTS

Comprehensive launch-readiness audit that answers one question: **Is this section ready for real users with real data?** Combines forensic code audit, competitive intelligence, trust/stickiness analysis, and produces an actionable roadmap handoff that feeds Pulse's pre-launch process.

This command is **read-only**. It produces a report and a roadmap; it does NOT modify code. (Per `CLAUDE.md`, auditing and executing are two different acts — finding an issue here does not grant permission to fix it. Hand Sprint 0/1 items to `/section-deep-dive`, `/launch-prep`, or a human for execution.)

---

## Philosophy

This isn't a code review. This is a **product readiness assessment** from three lenses:

1. **Engineering Lens** — Does every advertised capability actually work end-to-end?
2. **User Trust Lens** — Would a busy professional or small team stake their daily communication workflow on this?
3. **Market Lens** — How does this compare to the unified-comms, messaging, and productivity tools they're currently using (and paying for)?

Pulse is a unified, AI-powered communication + productivity hub — email, calendar, messages, voice (Relay), contacts/CRM, decisions & tasks, War Room — that runs on web, Android (Capacitor), and desktop (Electron). Judge every section against that promise.

---

## Phase 1: Forensic Capability Audit

### 1a. Locate ALL Files

Use **parallel subagents** to read all files simultaneously. Search with every strategy:

1. `src/components/<Section>/**/*` (and variants: `redesign/`, `v2/`, `v3/`)
2. `src/services/*<section>*` and grep the services dir for the section name
3. `src/hooks/use<Section>*`
4. `src/contexts/*<Section>*`
5. `src/utils/*<section>*`
6. `src/containers/*<Section>*` (if present)
7. `src/data/*<section>*`
8. `src/types.ts` and `src/types/*` for related interfaces
9. `supabase/migrations/*<section>*` — and grep migrations for the section's table names
10. `supabase/functions/*<section>*` — edge functions (Gemini routing, AI router, integration proxies all live server-side)
11. Routing / `navigationConfig` / `AppRouter.tsx` for the section's routes and nav entries
12. `FeatureContext` and feature-flag definitions — is this section gated behind a flag (many Pulse surfaces ship flagged OFF)?
13. Native bridges — Capacitor (`capacitor.config.*`, `android/`) and Electron paths the section touches (mic permissions, push, deep links, native share, background audio)
14. Cross-section consumers — grep all of `src/` for imports FROM this section, and for sibling sections this one reads from (Inbox ↔ Relay ↔ Contacts/CRM ↔ Calendar ↔ Workspaces ↔ Settings)

### 1b. Every Advertised Capability

For every feature the section CLAIMS to offer (buttons, tabs, menu items, form actions, page sections), trace the FULL chain:

```
UI Element → Event Handler → Service Call → Edge Function / Supabase → Response → UI Update
```

For AI features, the chain runs through the **centralized AI router / Supabase edge functions** — never a direct provider SDK call from React. A feature that calls Gemini/GPT/Claude directly from the client is a bug, not a capability.

Classify each capability:

| Status | Meaning |
|--------|---------|
| ✅ **REAL** | Works end-to-end with real data. Handles errors. Provides feedback. |
| ⚠️ **FRAGILE** | Works in the happy path but breaks on edge cases, has no error handling, or silently fails |
| 🔌 **DISCONNECTED** | UI exists but handler is empty, service isn't called, edge function missing, or DB table is absent |
| 🎭 **THEATRICAL** | Looks functional but uses mock/hardcoded data, console.logs instead of saving, returns canned AI responses, or shows fake confirmations |
| 💀 **DEAD** | Code exists but is unreachable — no route, no import, no trigger, or gated behind a flag that's permanently OFF |

### 1c. The Capability Matrix

| # | Capability | UI Location | Handler | Service / Edge Fn | DB Table | Status | Failure Mode |
|---|-----------|-------------|---------|-------------------|----------|--------|--------------|
| 1 | Create new record | Header "+" button | handleCreate() | service.create() | table_name | ✅/⚠️/🔌/🎭/💀 | What goes wrong |

**Be exhaustive.** Every button. Every tab. Every form field. Every dropdown option. Every context-menu action. If a user can click it, it gets a row.

### 1d. Data Integrity Check

For each database table this section uses:
- Does the table exist in migrations?
- Does it have RLS policies — and are workspace-scoped tables actually gated by `workspace_id` / `user_has_workspace_access`?
- Do the TypeScript types match the **actual** schema?
- Are there proper constraints (NOT NULL, FK, unique)?
- Is data actually being written and read with the correct query shape?

**Schema-first — never guess (CLAUDE.md law).** Pulse's schema is deliberately inconsistent: some id columns are `text` not `uuid` (`voxer_recordings.user_id`, `tasks.user_id`, `contacts.user_id`, `emails.user_id`, …), some tables lack `user_id` and key off `sender_id`/`owner_id`/`created_by`, cross-schema FKs are hidden from `information_schema` (query `pg_constraint`), and SECURITY DEFINER functions must pin `search_path`. **Verify column names/types against ground truth via the Supabase MCP (`list_tables` / `execute_sql` on `information_schema`), not naming convention or memory.** Flag any TS↔schema mismatch as a data-integrity risk.

### 1e. Failsafe Inventory

| Scenario | Handling | Grade |
|----------|----------|-------|
| Network disconnects mid-save | ? | A/B/C/F |
| User enters invalid data | ? | A/B/C/F |
| Empty state (no records yet) | ? | A/B/C/F |
| Concurrent editing / real-time conflict | ? | A/B/C/F |
| Real-time subscription drops or leaks (Supabase channel cleanup) | ? | A/B/C/F |
| Large dataset (1000+ records / long message list — virtualized?) | ? | A/B/C/F |
| Mobile / small viewport (Capacitor Android) | ? | A/B/C/F |
| Desktop (Electron) — file pickers, mic, deep links, native share | ? | A/B/C/F |
| Slow connection (3G) | ? | A/B/C/F |
| Session / OAuth token expiry mid-work (Google, Slack, etc.) | ? | A/B/C/F |
| AI router / edge function failure or timeout | ? | A/B/C/F |
| Required field left blank | ? | A/B/C/F |
| Destructive action (delete) | ? | A/B/C/F |
| Trial expired / usage limit hit / plan-tier gate | ? | A/B/C/F |

---

## Phase 2: User Trust Assessment

### 2a. The "Real User" Test

Imagine these specific users trying to use this section for their actual job:

**Solo professional / founder**: Runs their own work across Gmail, a calendar, WhatsApp/iMessage, sticky notes, and a half-used CRM. They're trialing Pulse (Solo, ~$20/mo) to consolidate all of it. They need this to work the FIRST time, or they'll fall back to the pile of tabs they already trust.

**Small team lead**: Coordinates a 3–10 person team's communication, currently paying for Slack + a shared inbox (Front/Missive) + a CRM, and is evaluating Pulse Team (~$15/seat) to collapse that stack. They expect polish, reliability, and that data they put in is data they can get back out and share with the team.

For each user, answer:
1. Can they accomplish their #1 task without confusion?
2. Can they accomplish it without hitting a dead end or error?
3. Would they feel confident their data was saved correctly?
4. Would they come back tomorrow and use it again?
5. Would they show it to a colleague and say "you should try this"?

### 2b. Trust Killers

Identify anything that would destroy user confidence:
- Buttons that do nothing
- Forms that submit but data disappears
- Loading states that never resolve / AI "thinking" states that hang
- Errors with no explanation
- Features that look available but aren't (especially AI features returning canned output)
- Inconsistent behavior (works sometimes, not others)
- Missing confirmations on destructive actions
- No undo capability
- Data that doesn't persist across page refreshes
- Features listed in navigation that lead to empty pages
- Broken theme parity (a surface that looks wrong in light or dark mode reads as "unfinished")
- A behavior that works on web but breaks on Android (Capacitor) or Electron

### 2c. Stickiness Factors

What makes users STAY with a tool instead of switching back:
- [ ] Data is easy to get IN (import, quick-add, bulk ops, OAuth sync from Gmail/Calendar/Slack/CRM)
- [ ] Data is easy to get OUT (export, reports, channel export, integrations)
- [ ] Daily workflow is faster here than the multi-tool stack it replaces
- [ ] Automations / AI save time they can't get elsewhere
- [ ] Insights/analytics they can't see in their current tools
- [ ] Collaboration features (shared views, mentions, assignments, notifications)
- [ ] History / audit trail / recall archive they'd lose by leaving
- [ ] Cross-section flow — data moves between Inbox, Relay, Contacts, Calendar, Decisions, War Room (a moat single-purpose tools can't match)

Rate each: Present / Partial / Missing

---

## Phase 3: Competitive Intelligence

### 3a. Identify the Incumbent Tools

Based on the section's purpose, identify what users are CURRENTLY using for this job. Pull 4–6 from the relevant categories and research them with web search:

- **Unified Inbox / Team Email**: Front, Missive, Hiver, Help Scout, Spike, Superhuman, Shortwave
- **Team Chat & Collaboration**: Slack, Microsoft Teams, Discord, Mattermost, Twist
- **Voice Messaging** (for Relay): Voxer, Zello, WhatsApp/Telegram voice notes, Marco Polo, iMessage audio
- **SMS / Business Messaging**: OpenPhone, TextMagic, Salesmsg, Heymarket, Podium
- **Calendar / Scheduling**: Google Calendar, Calendly, Cron/Notion Calendar, Reclaim, Motion
- **CRM / Contacts**: HubSpot, Pipedrive, Salesforce, Zoho, Folk, Attio
- **Tasks / Decisions**: Notion, Linear, Todoist, Asana, ClickUp
- **AI Comms / Meeting Intelligence** (for War Room / AI surfaces): Otter, Fireflies, Read.ai, Notion AI, ChatGPT, Gemini, Copilot, NotebookLM

Focus your research on:
- What features do they advertise on their pricing/features page?
- What do users praise in reviews? (G2, Capterra, TrustRadius)
- What do users complain about? (These are our opportunities)
- What's their pricing? (Context for value perception vs. Pulse Solo $20 / Team $15-seat / Growth $300)
- What's their onboarding / first-run experience like?

### 3b. Feature Gap Matrix

| Feature | Pulse | Tool A | Tool B | Tool C | Must-Have? | Differentiator? |
|---------|-------|--------|--------|--------|-----------|----------------|

Classification:
- **Table Stakes** — Every competitor has it. Missing = instant disqualification
- **Expected** — Most competitors have it. Missing = perceived as incomplete
- **Delighter** — Few have it. Present = competitive advantage
- **Unique** — Nobody has it. Our special sauce

### 3c. Why Users Trust THOSE Apps

For each major competitor, identify:
1. **Reliability signals** — Auto-save indicators, undo, version history, sync status, data-backup messaging
2. **Competence signals** — Feature depth, customization, integrations list
3. **Social proof signals** — User counts, logos, testimonials, community
4. **Switching cost signals** — Data lock-in, workflow investment, team training

### 3d. Our Moats & Gaps

**Moats** (advantages Pulse has):
- **Unified multi-channel** — email + SMS + Slack + voice in one place; a single conversation can span channels
- **Multi-provider AI orchestration** — Gemini / GPT / Claude routed by task through one server-side AI router
- **Voice-first Relay** — Pulse Radio, Voice Threads, Vox Drop; no incumbent inbox treats voice as first-class
- **Mobile-first + desktop** — real Android app (Capacitor) and Electron desktop, not just a responsive web page
- **All-in-one** — Inbox + Relay + Contacts/CRM + Calendar + Decisions/Tasks + War Room in one tool, cross-linked
- **Solo-first pricing** — usable and affordable for an individual, scaling to teams

**Gaps** (where we fall short):
- List every feature gap from the matrix that's Table Stakes or Expected
- Rate each gap: CRITICAL (launch blocker) / IMPORTANT (fix soon) / NICE-TO-HAVE (post-launch)
- Call out any moat that's **claimed but not real** (e.g. a "unified" thread that doesn't actually merge channels, or an AI feature returning mock data) — an over-promised moat is a trust killer, not an advantage

---

## Phase 4: Launch Readiness Scorecard

### The Verdict

Rate the section on these dimensions (1–10 scale):

| Dimension | Score | Evidence |
|-----------|-------|----------|
| **Core Functionality** — Do the main features work? | /10 | |
| **Data Reliability** — Is data saved, retrieved, and displayed correctly? | /10 | |
| **Error Resilience** — Does it handle failures gracefully (network, AI router, token expiry)? | /10 | |
| **User Confidence** — Would a user trust this with real data? | /10 | |
| **Completeness** — Are there dead ends or stub features? | /10 | |
| **Performance** — Is it fast enough for daily use (lists virtualized, no N+1)? | /10 | |
| **Competitive Parity** — Does it match table-stakes features? | /10 | |
| **Platform Parity** — Does it work on web AND Android (Capacitor) AND Electron? | /10 | |
| **Theme Parity** — Correct in both light and dark mode (`themeClasses`)? | /10 | |
| **Onboarding** — Can a new user figure it out? | /10 | |
| **Polish** — Does it feel professional and finished? | /10 | |
| **Stickiness** — Would users stay after trying it? | /10 | |

**Overall Launch Readiness: X/120**

### Launch Decision

Based on the score (normalize to a percentage):
- **80–100%**: Ready to launch. Minor polish items only.
- **60–79%**: Launch with caveats. Document known limitations. Fix within 2 weeks.
- **40–59%**: Not ready. Critical gaps will cause user churn. Fix before any onboarding.
- **0–39%**: Significant rebuild needed. Do not expose to users.

---

## Phase 5: Roadmap to Launch-Ready

### Priority Framework

Every item gets scored:
- **User Impact** (1–5): How much does this affect daily workflows?
- **Trust Impact** (1–5): How much does this affect user confidence?
- **Effort** (S/M/L/XL): How long to implement?
- **Dependencies**: What else must be done first?

### The Roadmap

#### 🚨 Sprint 0: Launch Blockers (fix before ANY user touches this)

Items that would cause immediate loss of trust or data:

| # | Item | Type | Effort | User Impact | Trust Impact |
|---|------|------|--------|-------------|--------------|
| 1 | ... | Bug/Gap/Stub | S/M/L | /5 | /5 |

#### ⚡ Sprint 1: Core Reliability (first week)

Items that make the happy path bulletproof:

| # | Item | Type | Effort | User Impact | Trust Impact |
|---|------|------|--------|-------------|--------------|

#### 🔧 Sprint 2: Completeness (second week)

Fill gaps, wire stubs, add missing table-stakes features:

| # | Item | Type | Effort | User Impact | Trust Impact |
|---|------|------|--------|-------------|--------------|

#### ✨ Sprint 3: Polish & Parity (third week)

Competitive feature gaps, UX improvements, platform/theme parity, delighters:

| # | Item | Type | Effort | User Impact | Trust Impact |
|---|------|------|--------|-------------|--------------|

#### 🚀 Sprint 4: Differentiation (post-launch)

Features that make Pulse uniquely valuable — cross-channel intelligence, multi-provider AI orchestration, voice-first Relay innovations, workspace-level shared AI context, next-best-action:

| # | Item | Type | Effort | User Impact | Trust Impact |
|---|------|------|--------|-------------|--------------|

### Implementation Handoff

For each Sprint 0 and Sprint 1 item, provide:
```
## Item: [Name]

**Problem**: What's wrong / what's missing
**Location**: Exact file(s) and line(s)
**Fix approach**: Step-by-step implementation plan
**Verification**: How to confirm it's fixed (build / test / live check)
**Dependencies**: What must exist first
**Estimated effort**: Time + complexity
```

---

## Phase 6: Output

### Save the Report

Write the complete audit to: `docs/launch-readiness/<SECTION_NAME>-launch-readiness-<YYYY-MM-DD>.md`

Use today's date in `YYYY-MM-DD` format and kebab-case for the section name. (Parallels the existing `docs/triage/` and `docs/deep-dives/` conventions.)

### Wire Into the Pre-Launch Process

This audit feeds Pulse's living launch roadmap. After saving the report:
- The Sprint 0 / Sprint 1 items are launch-blocker candidates for `docs/PULSE_PRELAUNCH_ROADMAP.md` (epic **#98**, label `launch-roadmap`).
- Recommend filing the confirmed launch blockers as `launch-roadmap` issues so `/launch-prep` can pick them up one at a time, or hand a single section to `/section-deep-dive` to fix-and-build in place.
- Do NOT file issues or edit the roadmap from this command unless the user asks — this is an assessment, and execution is a separate, explicitly-approved act.

### Executive Summary (print to console)

```
═══════════════════════════════════════════════════
  PULSE SECTION LAUNCH READINESS: <Section Name>
═══════════════════════════════════════════════════

  Overall Score: XX/120  (XX%)
  Launch Decision: [READY / LAUNCH WITH CAVEATS / NOT READY / REBUILD NEEDED]

  Capabilities: XX total | XX real | XX fragile | XX disconnected | XX theatrical | XX dead
  Trust Killers: XX found
  Table-Stakes Gaps: XX
  Launch Blockers: XX items (Sprint 0)
  Platform/Theme parity issues: XX

  Top 3 Actions:
  1. [Most critical fix]
  2. [Second most critical]
  3. [Third most critical]

  Full report: docs/launch-readiness/<file>.md
  Next: file Sprint 0 as launch-roadmap issues (#98) → /launch-prep,
        or hand to /section-deep-dive to fix in place.
═══════════════════════════════════════════════════
```

---

## Guiding Principles

- **Think like a paying customer**, not a developer. "It compiles" is not "it works."
- **Read before you assert (CLAUDE.md law).** Trace every chain end-to-end and quote the real lines / real schema. "I couldn't find it" ≠ "it isn't there." Verify the schema against ground truth via the Supabase MCP, never against naming convention or memory.
- **Trace every chain end-to-end.** A button that calls a service that hits a missing table — or an AI feature that bypasses the router — is NOT a working feature; it's a trap.
- **Mock data is a lie.** If it looks real but isn't connected to Supabase / the AI router, it's theatrical. Flag it.
- **Platform and theme parity are part of "works."** A surface that breaks on Android/Electron or looks wrong in dark mode is not launch-ready.
- **Compare against what users currently use.** They won't switch from a tool that works to one that's "almost ready."
- **Be specific.** "Needs work" is useless. "The save button calls `service.create()` which throws because `workspace_id` is null when no workspace is selected" is actionable.
- **The roadmap must be executable.** Another Claude session should be able to pick up the handoff doc cold and implement Sprint 0 without asking questions.
- **Stubs are worse than missing features.** A missing feature sets expectations correctly. A stub that looks like it works but doesn't destroys trust permanently.
- **Assess, don't execute.** This command never edits code, files issues, or touches the roadmap on its own. It diagnoses; the human (or `/section-deep-dive` / `/launch-prep`) acts.

---

## Supersedes

This command replaces and combines, for the launch-readiness view:
- `/audit` — basic feature inventory + issue catalog
- `/section-deep-dive` — discovery + diagnosis + competitive + implementation (still the canonical **fix-and-build** tool)
- `/section-triage` — forensic damage classification (still the canonical **read-only damage report**)
- `/triage-repair` — damage report → sequenced repair plan

Use `/section-launch-readiness` for the comprehensive "is this ready for real users?" view. The above commands still exist; reach for `/section-deep-dive` when you want to *fix* rather than *assess*, and `/section-triage` when you only need a damage map.
