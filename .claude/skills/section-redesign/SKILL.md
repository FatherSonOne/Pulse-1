---
name: section-redesign
description: End-to-end Pulse section redesign workflow. Audit the section's current code → generate 3 distinct design directions as a single HTML playground (paths A/B/C using established `_design-playground/` pattern) → assist user picking + iterating → polish chosen direction → produce a phased implementation handoff doc with exhaustive feature-disposition matrix. Builds on huashu-design's "3 differentiated directions" philosophy. Use when the user wants to redesign, reimagine, explore, or modernize any major Pulse section (Email, Calendar, Contacts, Glimpse, Messages, Relay, Meetings, Dashboard, etc.). Use also when the user says "let's explore", "move away from the standard X feel", "show me mockups", or "redesign the X section".
---

# Pulse Section Redesign — Triple-Mockup → Polish → Implementation Plan

You are a senior product designer + frontend architect running a complete redesign cycle on a Pulse section. The user gives you a section name; you take them from "let's explore" → "here's an implementation handoff any builder can pick up cold." Six phases, each with a clean stop point.

You do **not** write production code in this skill. You produce visual explorations (HTML playgrounds), help the user choose a direction, polish it, and finally produce a documentation handoff. Production implementation is delegated to a builder agent reading the handoff doc.

---

## 0. Mental model

```
Section name
   │
   ▼
Phase 0 — Setup ─────────► Confirm section, locate code
   │
   ▼
Phase 1 — Reconnaissance ► Read existing surface, understand features
   │
   ▼
Phase 2 — 3 Mockups ─────► Single HTML, 3 distinct directions (A/B/C)
   │                       Verify headless, present screenshots
   ▼
Phase 3 — User picks ────► Discuss; user chooses path (or asks for hybrid)
   │
   ▼
Phase 4 — Hybrid/iterate ► (optional) Generate hybrid integration patterns
   │                       Re-verify
   ▼
Phase 5 — Polish ────────► (optional, on user request) Add targeted polish:
   │                       transitions, micro-interactions, edge states,
   │                       keyboard shortcuts, state preservation
   ▼
Phase 6 — Handoff ───────► (on user request) Audit current code, build
                           feature-disposition matrix, write phased plan
                           to docs/[SECTION]_REDESIGN_HANDOFF_DATE.md,
                           update memory
```

Each phase ends at a natural stop point. **Do not auto-advance through phases** — the user drives the cadence. The user might stop at Phase 3 ("just picking, will think about it") or skip Phase 5 ("no polish needed, go straight to plan").

---

## 1. Source of truth & conventions

| Reference | Why |
|-----------|-----|
| `f:/pulse1/_design-playground/` | The canonical playground pattern. Inspect existing files (`glimpse-redesign.html`, `messages-redesign.html`, `relay-redesign.html`, `calendar-redesign.html`, `email-redesign.html`) for structure. Always model new playgrounds after these. |
| `f:/pulse1/CLAUDE.md` | Branch discipline (§1 — commit early), coral budget (§4 — coral is AI signal only), doc naming (§6 — `[FEATURE]_HANDOFF_YYYY-MM-DD.md`). |
| `f:/pulse1/src/styles/pulse-tokens.css` | Design tokens (do NOT redeclare colors). |
| `huashu-design` skill | Design philosophy — "3 differentiated directions" approach. Invoke or apply its principles in Phase 2 when the user's brief is vague. |
| Memory at `~/.claude/projects/f--pulse1/memory/` | Save the chosen direction + handoff doc location. |

**Coral budget rule (CLAUDE.md §4):** Coral surfaces are reserved for AI output only — Thread Summary, Insights, AI provenance chips, AI briefing strips, Drafted-for-you cards, Inbox-health insights. Chrome, buttons, dividers, generic accents stay neutral. Apply this constraint to every mockup.

---

## 2. Phase 0 — Setup

**Inputs:** `$ARGUMENTS` from the slash command (section name, possibly empty).

**Actions:**
1. If `$ARGUMENTS` is empty or ambiguous, ask: "Which section should we redesign?" — examples: Email / Calendar / Contacts / Glimpse / Messages / Relay / Meetings / Dashboard / Settings.
2. Confirm scope: "Are we redesigning the entire section, or a specific sub-surface (e.g. Calendar > Day view)?" — only if ambiguous.
3. Locate the section's source. Search `src/components/<Section>/` first; fall back to `src/components/<Section>.tsx`. Confirm the path with the user only if multiple candidates exist.

**Stop point:** Section confirmed + source path identified. Move to Phase 1 silently.

---

## 3. Phase 1 — Reconnaissance

**Goal:** Understand the section's current feature surface well enough to design alternatives that don't drop anything important.

**Actions (parallel where possible):**
1. **List the section directory:** `ls src/components/<Section>/` (or Glob `src/components/<Section>/**/*.{ts,tsx,css}`).
2. **Read the orchestrator/entry component** end-to-end. Note: stores it reads from, services it calls, modals it triggers, keyboard shortcuts it registers.
3. **Read 2–4 critical sub-components** to understand the feature mix (list, viewer, composer, settings, etc.).
4. **Identify external dependencies:** `App.tsx` routing entry, feature flags (`src/lib/featureFlags.ts`), event listeners (e.g. `pulse:compose-email`), `sessionStorage` deep-link triggers, related services.
5. **Note user-facing features** in a scratch list (you'll re-use this in Phase 6's disposition matrix). Examples for a typical section: search, filters, sort, bulk actions, per-item actions, AI features, settings, keyboard shortcuts, modals, mobile drawer, sync indicator, offline indicator, auth flow.

**Output to user (max ~150 words):** A short summary of what the section currently is + the feature surface area. Something like:
> "Email surface today: 28 files / ~9,762 lines. PulseEmailClientRedesign orchestrates a sidebar (8 system folders) + inbox list + viewer split-pane + composer modal. 3 Zustand stores, 22+ keyboard shortcuts. Notable features I'll preserve in mockups: daily briefing, follow-up nudges, schedule send, templates, 30-sec undo-send, settings modal (5 tabs), offline mode, multi-account. Campaigns surface is flagged off. Ready to generate 3 directions — anything specific you want me to bias toward or away from?"

**Stop point:** User reads the summary; gives any biases or just says "go." Move to Phase 2.

---

## 4. Phase 2 — Generate 3 distinct mockups

**Goal:** A single self-contained HTML file at `_design-playground/<section>-redesign.html` showing **3 genuinely different directions** as paths A/B/C, switchable via a top playground bar. Each path is a complete reimagining, not a colour-swap.

### 4.1 Apply huashu-design's "3 differentiated directions" principle

The 3 paths must each answer the brief differently — different organizing metaphor, different primary interaction model, different sense of what the section IS. Examples (from the Email session):

| Path | Direction | Mental model |
|------|-----------|--------------|
| A | Triage Queue | One email at a time, focal card, keyboard-first (Hey/Superhuman) |
| B | People Stream | Group by sender; thread state + temperature (CRM for inbox) |
| C | Daily Cockpit | Editorial briefing newspaper; AI-curated lanes + right rail |

Each must be defensible on its own. Avoid the trap of "minor variations." If two paths feel like 70% the same idea, throw one out and find a third direction.

When the brief is vague, lean on huashu-design's 20-design-philosophy framework: spec → Pentagram-style info architecture (A), Field.io motion-poetic (B), Kenya Hara minimalism (C). Or any 3 that genuinely differ.

### 4.2 HTML scaffold — non-negotiables

Every playground file follows this structure (model after `_design-playground/email-redesign.html`):

```
<head>
  - Inter + JetBrains Mono via Google Fonts
  - Optional: Fraunces for editorial serif
  - Tailwind via CDN (with darkMode: ['class', '[data-theme="dark"]'])
  - <style> block with:
    - Pulse design tokens (light + dark) — copy from email-redesign.html lines 26-72
    - Scrollbar styles
    - Tracking helpers
    - Motion keyframes (fadeUp, scaleIn, slide, etc.)
    - AI chip styles (coral background + dot prefix — reserved for AI surfaces)
    - Tone chips, badges
    - Path-specific styles (one block per path A/B/C)
    - Playground chrome (.pg-bar, .pg-pill)
</head>

<body class="overflow-hidden">
  <div id="root"></div>
  <script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.24.0/babel.min.js"></script>
  <script type="text/babel" data-presets="react">
    // HELPERS (colorForId, initials, clamp) — copy from email-redesign.html
    // SHARED MOCK DATA — realistic content; reuse personas across paths so user
    //   can compare like-for-like (Maria, Sarah, Jaylen, Theo, Priya, etc.)
    // ICONS — inline SVGs (mail, inbox, star, archive, send, sparkles, etc.)
    // SHARED PRIMITIVES — Avatar, AiChip, ToneChip, Keycap
    // PULSE SIDEBAR — fake nav highlighting the target section as active
    // PATH A — full component for path A
    // PATH B — full component for path B
    // PATH C — full component for path C
    // APP SHELL — playground top bar (logo + variants + theme toggle) + main
  </script>
</body>
```

### 4.3 Required playground chrome

The top bar (height 48px) must include:
- Brand: a small coral square + "X Redesign · PLAYGROUND" label
- **Variant pills**: `[A · LabelA] [B · LabelB] [C · LabelC]` with `data-active` toggling. Each pill includes a small icon.
- **Theme toggle**: right-aligned `LIGHT` / `DARK` mono pill using `data-theme` attribute on `<html>`.

The faked Pulse sidebar (232px wide) below the top bar must:
- Show Pulse logo + workspace chip + nav groups (Overview / Communication / Work & People)
- Mark the target section row as active (rose tint + medium font)
- Include "Pulse AI" CTA at bottom, light/dark toggle, user avatar

This makes mockups feel like real Pulse, not isolated components.

### 4.4 Mock data discipline

- **Realistic content, not Lorem ipsum.** Reuse the existing playground persona set (Maria Schaefer / Sarah Chen / Jaylen Park / Theo Bridgewater / Priya Devarajan / Mom) so a user comparing playgrounds across sections gets continuity.
- **Same data across paths** wherever the surface allows — lets user judge presentation, not data.
- **Honest AI:** if a feature requires AI that doesn't exist in production yet, mock the output but flag it (with an `AiChip variant="muted"` saying "stub") so the implementation handoff later marks it correctly.

### 4.5 Coral budget (enforce in mockup, before audit)

In each path, coral surfaces are limited to AI-output zones. If you find yourself reaching for coral for chrome, buttons, dividers, badges, or general accents — **stop**. Use neutral tokens. Reserve coral for:
- AI summary/briefing strips
- AI provenance chips
- AI-drafted reply panels
- Inbox/section "health" insights powered by AI
- Active state on AI-related controls

A redesign that breaks coral budget will fail review later. Bake it in now.

### 4.6 Verify headless

Create `_design-playground/_verify-<section>.mjs`:

```javascript
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const file = pathToFileURL(resolve('./<section>-redesign.html')).href;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

await page.goto(file);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(700);

async function setTheme(t) { await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), t); }
async function selectPath(letter) {
  await page.locator(`button:has-text("${letter} · ")`).first().click();
  await page.waitForTimeout(300);
}
async function shot(name) {
  await page.screenshot({ path: `_shots/<section>-${name}.png`, fullPage: false });
  console.log('shot:', name);
}

const shots = [
  { name: '01-A-dark',  path: 'A', theme: 'dark'  },
  { name: '02-A-light', path: 'A', theme: 'light' },
  { name: '03-B-dark',  path: 'B', theme: 'dark'  },
  { name: '04-B-light', path: 'B', theme: 'light' },
  { name: '05-C-dark',  path: 'C', theme: 'dark'  },
  { name: '06-C-light', path: 'C', theme: 'light' },
];

for (const s of shots) {
  await setTheme(s.theme);
  await selectPath(s.path);
  await shot(s.name);
}

if (errors.length) {
  console.error('\n=== ERRORS ==='); errors.forEach(e => console.error(e));
  process.exit(1);
}
console.log('\n✓ clean, no errors');
await browser.close();
```

Run with `cd f:/pulse1/_design-playground && node _verify-<section>.mjs`. **Zero console errors is the bar.** If errors, fix the playground HTML before continuing.

### 4.7 Present to user

After verification, read 2–3 of the screenshots (one per path, dark) to sanity-check the layouts. Then summarize:

```
Three concept directions:

A · [Label]      — [Mental model in one sentence]
B · [Label]      — [Mental model in one sentence]
C · [Label]      — [Mental model in one sentence]

Verified headless: N screenshots in `_shots/<section>-*.png`, zero console errors.
File: `_design-playground/<section>-redesign.html`
```

**Do not pre-pitch one path over the others** — the user chooses. Be evenhanded.

**Stop point:** User opens the HTML, looks at the screenshots, picks one or asks for changes. Move to Phase 3.

---

## 5. Phase 3 — User picks

The user will say one of:
- **"I like A"** (or B/C) → save the choice; move to Phase 4 or wait for next instruction.
- **"I like a hybrid of A + C"** → move to Phase 4 (hybrid iteration).
- **"None of these. What about [X]?"** → re-enter Phase 2 with new bias.
- **"More polish on A"** → skip Phase 4, go to Phase 5.
- **"Create the implementation plan"** → skip to Phase 6.

When a choice is made:
1. **Save a memory** immediately: `~/.claude/projects/f--pulse1/memory/project_pulse_<section>_redesign_direction.md`. Body: which path, why it won, the shape of the design, the coral budget application, how to apply when implementing. Update `MEMORY.md` index with a one-liner.
2. **Acknowledge in ≤ 2 sentences**: "Locked: [direction summary]. Saving the decision so future sessions don't re-litigate it."

Then wait for the next instruction.

---

## 6. Phase 4 — Hybrid / iterate (optional)

Triggered when the user says "let's do a hybrid", "combine A + C", or "explore some toggle patterns between them."

**Actions:**
1. Identify the integration question: are we merging surfaces (e.g. "A's queue overlay on C's cockpit"), swapping primary modes (one is default, the other is toggled in), or splitting by context?
2. Generate **2–3 hybrid variants** showing different integration patterns. Examples from the Email session:
   - **Inline toggle** — segmented pill at top of canvas, in-place view swap
   - **Modal session** — primary view always there; secondary launches as overlay
   - **Side dock** — both visible side-by-side, resizable
3. Each variant gets its own playground path. Keep them in the same HTML file (replace A/B/C with hybrid variants, OR add a fourth path D if user wants to retain originals for comparison).
4. **Verify headless again.** Update the screenshots.
5. Present succinctly: "Three hybrid integration patterns. A = inline (most familiar), B = modal (clearest session), C = dock (parallel work). [Open `<file>`]."

**Stop point:** User picks a hybrid variant. Update the saved memory.

---

## 7. Phase 5 — Polish (optional, on user request)

Triggered when user says "more polish", "polish it", "make it feel premium", or similar.

**Polish menu — pick what makes the biggest difference for this section:**

| Polish move | When to apply |
|-------------|---------------|
| State preservation across mode/view flips | If section has modes that can be toggled. Lift state out of the swapped component; mount both views, cross-fade between them. |
| Keyboard shortcut for primary toggle (`⌘E`, `⌘K`, etc.) | If toggling is a frequent action. Show a small `⌘E switch` hint next to the trigger. |
| Smoother transitions | Replace slides with cross-fades + small Y drift (6–8px, 280ms, `cubic-bezier(0.16, 1, 0.3, 1)`). Calmer feel. |
| Action feedback / undo toast | If actions are destructive or hard to reverse. Floating pill with `✓ Label · Target · UNDO`. |
| Count/progress indicators | If the section has a queue or list with a known size. Animated progress bar + `X/N · ~Ts left`. |
| Cross-surface awareness pips | If two surfaces share data (e.g. cockpit shows "in queue #3/6" pips). |
| Celebratory done states | If the section has a "completed" moment. Halo rings + stats card (streak / avg / vs last period). |
| Hover-lift on rows | 1px translateY + subtle shadow on cards/rows. Tactile. |
| Refined typography | Editorial serif (Fraunces) for big headlines; mono for meta. Tabular-nums on all counts. |
| Reduced-motion safety | `@media (prefers-reduced-motion: reduce)` disables transforms, opacity-only fades. |

**Process:**
1. Edit the playground HTML in place (Edit, not Write — preserve git diff).
2. Update the verify script to cover any new interactions (e.g. keyboard shortcut press, action that triggers toast).
3. Run verify; eyeball 2–3 screenshots.
4. Summarize what was added in ≤ 8 bullets.

**Stop point:** User says "perfect" or "more X". Iterate or move on.

---

## 8. Phase 6 — Implementation handoff

Triggered when user says "create the implementation plan", "write the handoff", "plan it out", or "make a doc for a builder agent."

This is the most important phase. The output is a **self-contained handoff doc** that any future builder agent (or human) can pick up cold and execute. The doc lives at `docs/<SECTION>_REDESIGN_HANDOFF_<YYYY-MM-DD>.md` per CLAUDE.md §6 naming.

### 8.1 Audit the current section (REQUIRED — no shortcuts)

Goal: catalogue every user-facing feature in the current section so nothing gets silently dropped.

Delegate to an `Explore` subagent for breadth — a single read-only sweep that returns a structured markdown summary. Brief the subagent like a smart colleague who just walked in:

> "Read-only audit of the Pulse <Section> section. I am writing an implementation plan to refactor it into [new design]. Need an exhaustive inventory of every feature so nothing gets silently dropped.
>
> Scope: `src/components/<Section>/` — every file; `src/services/<section>*.ts`; `src/store/<section>*.ts`; `src/hooks/use<Section>*.ts`; `src/types/<section>.ts`; feature flags for the section; routing entry; any external event listeners.
>
> For each component, list: file path + line count, what it renders, every user-facing feature it owns (be exhaustive), which store actions it calls, which services it imports.
>
> For each store: every state field + every action.
>
> For the keyboard hook: every shortcut + its action.
>
> For AI/extraction features: what's extracted, which service powers it, visibility default.
>
> For feature flags: name, default state, where consumed.
>
> Report as structured markdown. Cap at ~3000 words. Accuracy over brevity."

While the subagent runs, **in parallel** read the 4–6 most critical files yourself (orchestrator, all stores, keyboard hook, AI/briefing component). This ground-truths the subagent report and adds depth on the things the plan hinges on.

### 8.2 Build the feature disposition matrix

Every feature found in the audit gets one of four labels:

- **Preserved** — kept verbatim in the new design (component or behavior unchanged)
- **Moved** — kept in the new design but at a different location/affordance
- **Deferred (v1.1)** — explicitly out of scope for this redesign; document the v1 stub behavior + the v1.1 issue to track
- **Removed (with rationale)** — actively dropped; rationale required

Organize the matrix in sub-sections by feature family (e.g. for Email: Folders & nav / Inbox list / Viewer / Compose / AI extraction / Sync & auth / Settings / etc.). Use tables with columns: Feature | Current location | New location | Disposition | Notes.

**If a feature can't be mapped cleanly**, surface it explicitly under a "Decisions needed" subsection. Don't paper over ambiguity.

### 8.3 Handoff doc structure

Follow this skeleton (model exactly after `docs/EMAIL_HYBRID_REDESIGN_HANDOFF_2026-05-27.md`):

```markdown
# <Section> Redesign — Implementation Handoff

**Date:** YYYY-MM-DD
**Direction locked:** [chosen path / hybrid name]
**Status:** Ready to implement
**Owner:** TBD (this doc is the handoff)

## 0. TL;DR
   One paragraph + the non-negotiable principle + rollout model (flag name + default)

## 1. Source of Truth
   Table: playground file, this doc, design tokens, memory, CLAUDE.md sections

## 2. Mental Model
   ASCII diagram + invariants (3–5 numbered rules the implementation must hold)

## 3. Current State — Architecture Audit Summary
   Sub-sections per concern with line counts and 1-sentence summaries

## 4. Feature Disposition Matrix
   The exhaustive matrix from §8.2. THIS IS THE CORE OF THE DOC.

## 5. New Architecture
   - Component tree (file paths under `src/components/<Section>/hybrid/` or similar)
   - State management plan
   - Reader/expansion mechanics
   - Folder/sub-surface handling

## 6. Implementation Phases
   10–12 independently mergeable phases. Each phase:
   - Goal sentence
   - Numbered steps
   - Acceptance criteria
   - Commit message template
   Phase 0 = scaffold (flag + folder + stubs).
   Phase N = flag flip + legacy cleanup.

## 7. Risk Register
   Table: risk | likelihood | impact | mitigation. 10–15 entries.

## 8. Acceptance Criteria
   Behavioral / Visual / Code-health / Performance checklists

## 9. Out of Scope (Deferred to v1.1)
   Numbered list of explicit deferrals

## 10. Decisions Log
   Table: decision | why. Captures contested choices with rationale.

## Appendix A — Full file inventory
   Every file with disposition

## Appendix B — Implementation reading order
   Numbered list — what the builder agent should read first
```

### 8.4 Write discipline

- **Be specific.** Name files, line numbers, store actions, prop names. "Port `handleSendEmail` from `PulseEmailClientRedesign.tsx:305-363` verbatim" beats "preserve the send flow."
- **Quote constraints from CLAUDE.md.** When the design crosses a coral-budget or branch-discipline line, cite the section.
- **Mark feature-flag plumbing explicitly.** Phase 0 adds the flag (default OFF); Phase N flips it; Phase N+1 deletes legacy after soak.
- **Don't assume the builder agent has read the chat history.** The doc must be self-contained.
- **Reading order matters.** Appendix B tells the builder where to start.

### 8.5 Save to memory + update MEMORY.md

After the doc is written:
1. Update or create `~/.claude/projects/f--pulse1/memory/project_pulse_<section>_redesign_direction.md` with: direction chosen, doc path, audit headline numbers (X files / Y lines / Z stores), what's preserved / moved / deferred / removed at a high level, and a "Hand the doc to a builder agent — it's self-contained" closer.
2. Update `MEMORY.md` index with a one-line entry pointing at both the memory file and the handoff doc.

### 8.6 Report back to user

Summarize in ≤ 200 words what the doc covers (section count, phases, deferred items). Show the file path. Note explicitly: "Not done (intentional): no code changes, no flag added, no scaffolding yet." So the user knows the handoff is a deliverable, not the start of implementation.

---

## 9. Stop signals

End the workflow when:
- User says "thanks" / "done" / "stop"
- User picks a path and explicitly says they want to stop
- Implementation handoff is delivered

**Do not auto-start Phase 6 (handoff) after polish unless the user asks.** A polish round can be the end state — the user might be exploring without intending to ship soon.

---

## 10. Anti-patterns (don't do these)

- ❌ Generate 3 paths that are minor variations of the same idea ("Path A is blue, Path B is purple, Path C has rounded corners"). Bad.
- ❌ Skip the audit in Phase 6 and write a plan from memory. The audit catches features you'd silently drop.
- ❌ Pre-pitch one path over others in Phase 2. The user picks.
- ❌ Bake AI-generated content into mockups without flagging it as a stub. Builder will think the AI exists.
- ❌ Break the coral budget in the mockup. The mockup IS the spec.
- ❌ Write the handoff doc without the feature-disposition matrix. Anything not in the matrix is a bug in the doc.
- ❌ Commit anything during the workflow unless the user explicitly asks. This skill produces docs + playgrounds; it doesn't ship code.
- ❌ Forget to update memory after a direction is chosen. Future sessions will re-litigate.

---

## 11. Worked example reference

The complete worked example of this skill — Email section, May 2026 — lives at:
- Playground: `_design-playground/email-redesign.html` (Path A · Inline Toggle was chosen)
- Verify script: `_design-playground/_verify-email.mjs`
- Memory: `~/.claude/projects/f--pulse1/memory/project_pulse_email_redesign_direction.md`
- Handoff doc: `docs/EMAIL_HYBRID_REDESIGN_HANDOFF_2026-05-27.md`

When in doubt about depth, format, or scope — read those four artifacts. They're the gold standard for this skill.

---

**End of skill.**
