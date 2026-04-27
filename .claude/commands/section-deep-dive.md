# Section Deep Dive — Discover, Diagnose, Evolve

Perform a comprehensive deep dive on the specified section: **$ARGUMENTS**

This is a multi-phase session that goes beyond auditing. You will study the section to understand its purpose, diagnose every issue, benchmark it against real-world unified-communication, voice-messaging, and team-collaboration competitors, identify the feature gap, brainstorm evolution ideas, and then implement all fixes and improvements — leaving the section in a hardened, polished state.

---

## Phase 1: Discovery — What Is This Section?

Before touching any code, build a complete mental model of the section.

1. **Locate all files** belonging to this section — components, sub-components, services, hooks, contexts, types, utilities, styles, tests, edge functions, Supabase migrations, and Capacitor/Electron native bridges. List every file with its line count.

2. **Read every file completely.** Do not skim. Understand the full implementation.

3. **Answer these questions in writing:**
   - What is the core purpose of this section? What user problem does it solve?
   - Who is the primary user persona (knowledge worker, team lead, sales/CRM user, mobile-first communicator)?
   - What are the main workflows a user follows through this section?
   - What data entities does it operate on? Where does the data come from and go?
   - Which AI providers are used (Gemini, OpenAI, Claude via the centralized AI router) and how is the output consumed?
   - What external services does it integrate with (Supabase, Stripe, Gmail, Google Calendar, Slack, SMS providers, HubSpot/Salesforce/Pipedrive/Zoho)?
   - How does it behave across platforms (web, Android via Capacitor, desktop via Electron)?
   - How does it fit into the broader Pulse navigation, and how does it interact with sibling sections (Inbox ↔ Voxer ↔ CRM ↔ Workspaces ↔ Settings)?
   - What workspace/org-scoping, trial gating, and usage limits apply?

4. **Produce an architecture map** (ASCII diagram) showing:
   - Component tree and hierarchy
   - Data flow (Supabase tables → services → contexts → components → UI)
   - State management approach (contexts, local state, derived state, real-time subscriptions)
   - AI router call sites and provider selection
   - Real-time / subscription channels
   - External integrations and API boundaries
   - Platform branches (web vs. Capacitor vs. Electron)

Output: Write a `## Section Profile` with the answers and diagram.

---

## Phase 2: Health Check — What Works, What Doesn't

Systematically evaluate every feature and sub-feature in the section.

### Feature Inventory

Create a feature table covering every capability the section offers:

| # | Feature / Sub-feature | Status | Evidence | Notes |
|---|----------------------|--------|----------|-------|
| 1 | ... | Working / Partial / Broken / Stub / Dead Code | File:line | Details |

### Code Quality Scan

Check for each of these — report only actual findings, not clean passes:

- **Errors & Bugs**: Runtime errors, logic errors, broken workflows, race conditions, real-time subscription leaks
- **TypeScript Issues**: `any` types, missing types, incorrect type assertions, unsafe casts
- **Dead Code**: Unused imports, unreachable branches, commented-out blocks, initialized-but-never-used state, abandoned components
- **Stub/Fake Functionality**: Mock data presented as real, hardcoded values, placeholder UI that looks functional but isn't wired up, AI features returning canned responses
- **State Management Problems**: Prop drilling, unnecessary re-renders, stale closures, missing dependency arrays, leaky Supabase channels, missed cleanup in `useEffect`
- **Error Handling Gaps**: Missing try/catch around async operations, unhandled promise rejections, silent failures, no user-facing error states for failed AI / Supabase / integration calls
- **Security Concerns**: Exposed keys, missing input validation, XSS vectors, unprotected routes, missing RLS on workspace-scoped tables, OAuth tokens stored insecurely, missing trial/usage gates that should be enforced server-side
- **Performance Issues**: Unnecessary re-renders, missing memoization, large inline objects, N+1 query patterns, unbounded message/list rendering (use virtualization), oversized AI prompts, audio/blob handling that blocks the main thread
- **Accessibility Gaps**: Missing ARIA labels, keyboard navigation issues, color contrast problems, missing focus management, screen-reader-hostile audio components
- **UX Friction**: Confusing flow, missing loading states, missing empty states, jarring transitions, unclear CTAs, AI features without "thinking" indicators, no offline messaging
- **Theming**: Missing dark/light mode coverage, hardcoded colors that bypass the `themeClasses` pattern
- **Database/Backend**: Missing RLS policies, unoptimized queries, missing indexes, schema inconsistencies with TypeScript types, edge functions without auth checks, missing storage bucket setup
- **Platform Parity**: Web-only behaviors that break on Capacitor (Android) or Electron — file pickers, microphone permissions, push notifications, deep links, native share, background audio
- **Billing & Limits**: Trial/usage gating bypass paths, Stripe webhook handling, plan-tier feature flags

### Issue Registry

Catalog every issue found, categorized by severity:

| # | Severity | Category | Issue | Location | Impact | Proposed Fix |
|---|----------|----------|-------|----------|--------|--------------|
| 1 | Critical | ... | ... | file:line | ... | ... |
| 2 | Medium | ... | ... | file:line | ... | ... |
| 3 | Low | ... | ... | file:line | ... | ... |

Every issue MUST have a proposed fix — no orphan problems.

---

## Phase 3: Competitive Benchmarking — How Does It Compare?

Research how comparable features work in established unified-communication, messaging, and collaboration tools. The goal is to understand what best-in-class looks like so you can identify gaps.

### Identify Comparables

Based on the section's purpose, identify 4-6 comparable products. Consider:

**Unified Inbox / Team Email**: Front, Missive, Hiver, Help Scout, Spike, Superhuman, Shortwave
**Team Chat & Collaboration**: Slack, Microsoft Teams, Discord, Mattermost, Twist, Chanty
**Voice Messaging**: Voxer, Zello, WhatsApp voice notes, Telegram voice, iMessage audio, Marco Polo
**SMS / Business Messaging**: OpenPhone, TextMagic, Twilio Frontline, Salesmsg, Heymarket, Podium
**Sales Engagement / CRM Comms**: Outreach, Salesloft, Apollo, Gong, Chorus, Dialpad, Aircall, RingCentral
**AI Communication**: Gemini app, ChatGPT, Claude, Copilot, Notion AI, Otter, Fireflies, Krisp, Read.ai
**Mobile Messengers**: WhatsApp, Telegram, Signal, Messenger
**Productivity Inboxes**: Hey, Sanebox, Triage

### Feature Comparison Matrix

Build a matrix comparing your section's features against what these competitors offer:

| Feature | Pulse | Competitor A | Competitor B | Competitor C | Industry Standard? |
|---------|-------|-------------|-------------|-------------|-------------------|
| ... | Has/Partial/Missing | Has/Missing | Has/Missing | Has/Missing | Yes/No/Emerging |

Mark features as:
- Has it and it works well
- Has it but incomplete or rough
- Missing entirely
- Has it and it's better than competitors (differentiator)

### Gap Analysis

From the matrix, extract:
1. **Table-stakes gaps** — Features that every competitor has that we're missing. These are credibility gaps that could cause users to dismiss the section as incomplete.
2. **Competitive gaps** — Features that most competitors have and that would meaningfully improve the section.
3. **Differentiator opportunities** — Features that few competitors have but that align with Pulse's positioning — unified multi-channel + multi-provider AI + voice-first — and could become unique selling points.
4. **Over-engineering check** — Features we have that competitors don't and that nobody seems to need. Candidates for simplification.

---

## Phase 4: Evolution Brainstorm — Where Should This Section Go?

Based on everything learned in Phases 1-3, brainstorm how to evolve this section. Think in three horizons:

### Horizon 1: Foundation Hardening (implement now)
Things that make the existing features reliable, complete, and professional:
- Fix every issue from the Issue Registry
- Complete every stub/partial feature
- Add missing error handling, loading states, empty states
- Harden the database layer (RLS, indexes, constraints, storage buckets)
- Apply the `themeClasses` pattern for full dark/light parity
- Confirm trial/usage gating is enforced server-side
- Fill table-stakes feature gaps
- Verify Capacitor/Android and Electron parity

### Horizon 2: Competitive Parity (implement next)
Features that bring the section up to industry standard:
- Competitive gap features from the matrix
- UX improvements inspired by best-in-class competitors
- Data model extensions needed to support these features
- Integration points with other Pulse sections (Inbox ↔ Voxer ↔ CRM ↔ Workspaces)
- Deeper CRM sync coverage for the four supported platforms

### Horizon 3: Differentiation (plan for later)
Ideas that could make this section uniquely valuable:
- Differentiator opportunities from the gap analysis
- Multi-provider AI orchestration (route by task to the best of Gemini/GPT/Claude)
- Voice-first innovations on top of the Voxer foundation (Pulse Radio, Voice Threads, Vox Drop)
- Cross-channel intelligence (a single conversation thread spanning SMS + email + Slack + voice)
- Workspace/org-level AI shared context
- Predictive/proactive features (next-best-action across channels)

For each brainstormed feature, note:
- **What**: One-line description
- **Why**: The user problem it solves or the value it adds
- **Complexity**: Low / Medium / High
- **Dependencies**: What else needs to exist first

---

## Phase 5: Implementation — Fix, Build, Polish

Now execute. Work through improvements systematically.

### Execution Order

1. **Critical fixes first** — Anything broken, any security issue, any data integrity risk, any billing/gating bypass
2. **Stub completion** — Wire up any fake/placeholder functionality to real data and services (especially AI features returning canned output and Pulse-user-only contact filters)
3. **Error handling & resilience** — Add try/catch, loading states, empty states, error boundaries, retries; surface failures from the AI router and integrations
4. **TypeScript hardening** — Replace `any` types, add missing interfaces, fix type safety
5. **Dead code removal** — Remove unused imports, unreachable code, commented-out blocks
6. **Theme parity** — Apply the `themeClasses` pattern; remove hardcoded colors
7. **UX polish** — Loading indicators, AI "thinking" states, transitions, empty states, responsive fixes, mobile gesture support
8. **Table-stakes features** — Implement the most critical gap features from Phase 3
9. **Performance** — Memoization, virtualization for message lists, query optimization, audio handling on a worker
10. **Accessibility** — ARIA labels, keyboard navigation, focus management
11. **Platform parity** — Verify and fix on Capacitor/Android and Electron

### Implementation Rules

- Fix one issue at a time. Verify each fix before moving to the next.
- Run `npm run build` periodically to catch TypeScript errors early.
- For mobile-affecting changes, run `npm run android:sync` and verify on Android.
- When adding new features, follow existing patterns in the codebase — don't introduce new paradigms.
- If a fix requires database changes, document the migration SQL clearly and place it under `supabase/migrations/`.
- If a fix is too large or risky for this session, document it as a follow-up item with full context instead of attempting a half-measure.
- Keep a running log of every change made.
- Honor the centralized AI router — don't bypass it with direct provider SDK calls.

### After Each Change

Briefly note:
- What was changed and why
- Which Issue Registry item it resolves (by number)
- Any new issues discovered during the fix

---

## Phase 6: Session Report

After all implementation work is complete, produce a final report.

### Summary

- Section analyzed: [name]
- Files read: [count]
- Issues found: [count by severity]
- Issues fixed: [count]
- Issues deferred: [count, with reasons]
- New features added: [list]
- Competitors benchmarked: [list]

### Changes Made

| # | Change | Files Modified | Issue # Resolved | Type |
|---|--------|---------------|-----------------|------|
| 1 | ... | ... | #X | Fix / Enhancement / New Feature |

### Deferred Items

For any issues or features not addressed in this session, provide full context so they can be picked up later:

| # | Item | Why Deferred | Suggested Approach | Priority |
|---|------|-------------|-------------------|----------|
| 1 | ... | ... | ... | High/Medium/Low |

### Evolution Roadmap

Summarize the Horizon 2 and Horizon 3 items as a prioritized backlog for future sessions.

### Output

Save the full report to: `docs/deep-dives/<SECTION_NAME>_DEEP_DIVE_<DATE>.md`

Use today's date in YYYY-MM-DD format. Use kebab-case for the section name.

---

## Guiding Principles

- **Honesty over politeness.** If something is broken, say it plainly. If a feature is a stub, call it a stub. If an AI feature returns mock data, call it out. The value of this session depends on accurate diagnosis.
- **Fix, don't just flag.** The difference between this and a static audit is that you actually implement solutions. Every issue in the registry should either be fixed or have a clear reason why it was deferred.
- **Think like a user.** Imagine a busy professional juggling SMS, email, Slack, and voice messages from clients and teammates all day. What would frustrate them? What would delight them? What would they expect from a unified, AI-powered communication platform that isn't there?
- **Compete on purpose.** Don't copy every feature from Slack or Front. Identify what matters for Pulse's specific positioning — unified multi-channel inbox, voice-first Voxer modes, multi-provider AI, mobile-first — and lean into that.
- **Mobile and desktop are first-class.** A change that works on web but breaks on Capacitor/Android or Electron is not done.
- **Theme parity is non-negotiable.** Every UI change must look correct in both light and dark mode.
- **Leave it better than you found it.** The section should demonstrably work better, look better, and be more reliable at the end of this session than at the beginning.
