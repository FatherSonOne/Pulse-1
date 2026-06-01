# Section Triage — Forensic Damage Assessment

Perform a forensic damage assessment on the specified section: **$ARGUMENTS**

This is NOT an improvement tool. This is a damage report. You are an insurance adjuster walking through after a storm — your job is to document exactly what's standing, what's cracked, what's collapsed, and what was never finished. No competitive benchmarking. No evolution roadmaps. No implementation. Just ground truth.

**Output:** `docs/triage/<section>-triage-<date>.md`

---

## Why This Exists

This codebase has been through multiple Claude sessions that made changes across sections — some helpful, some destructive. Sections that were working got partially rewritten, components got gutted, wiring got severed. This tool systematically assesses the damage so the developer can prioritize what to fix and in what order.

---

## Execution Strategy

Use **parallel subagents** to read all files simultaneously. Do NOT read files sequentially — launch 3-4 agents:
- Agent 1: Core components (pages, containers, main views)
- Agent 2: Services, hooks, utilities, types
- Agent 3: Sub-components (modals, forms, tables, cards, panels)
- Agent 4: Database migrations, edge functions, contexts, cross-section files

While agents run, read the routing (AppRouter.tsx or navigationConfig) and the section's entry point yourself.

---

## Phase 1: Locate Everything That Touches This Section

Cast a wide net. Search with ALL of these strategies:

1. **Glob** `src/components/<section>/**/*` (the main component directory)
2. **Glob** `src/components/<section>/redesign/**/*` (redesign subdirectory if it exists)
3. **Glob** `src/services/*<section>*` and **Grep** services directory for the section name
4. **Glob** `src/hooks/use<Section>*`
5. **Glob** `src/contexts/*<Section>*`
6. **Glob** `src/utils/*<section>*`
7. **Glob** `src/containers/*<Section>*`
8. **Glob** `src/data/*<section>*`
9. **Grep** `src/types.ts` and `src/types/*.ts` for related interfaces/types
10. **Glob** `supabase/migrations/*<section>*`
11. **Glob** `supabase/functions/*<section>*`
12. **Grep** routing files for routes pointing to this section
13. **Grep** the ENTIRE `src/` directory for imports FROM this section's files (cross-section consumers)
14. **Grep** for the section's Supabase table names across the codebase

For EVERY file found: record path, line count, last-modified date (via git log), and a one-line purpose summary.

Organize the file inventory into:
- **Core files** — the main page/container, primary sub-components
- **Supporting files** — services, hooks, contexts, types, utilities
- **Infrastructure files** — migrations, edge functions, configs
- **Cross-section consumers** — files in OTHER sections that import from this one

---

## Phase 2: Read Everything and Classify

Read every file found in Phase 1. For each file, determine its **structural integrity**:

### Classification System

Every component, function, service method, and UI element gets ONE of these labels:

| Label | Symbol | Meaning |
|-------|--------|---------|
| **Solid** | `[SOLID]` | Works correctly. Connected to real data. Handles errors. Does what it's supposed to. |
| **Cracked** | `[CRACKED]` | Partially works but has issues — broken imports, missing props, wrong data shape, silent failures, race conditions. Could be fixed with targeted repairs. |
| **Severed** | `[SEVERED]` | The code exists but the connection is cut — a component that renders but isn't wired to any route, a service method that nothing calls, an import that points to a deleted file, a handler that references a removed context. |
| **Stub** | `[STUB]` | Placeholder code that looks functional but isn't — hardcoded data, TODO comments, empty function bodies, mock returns, placeholder UI with no backend. |
| **Gutted** | `[GUTTED]` | Was clearly more complete before — you can see the bones of what it was (commented-out code, half-removed features, simplified replacements that lost functionality). Check git blame/log to confirm. |
| **Orphaned** | `[ORPHAN]` | Dead code — not imported anywhere, not routed to, not referenced. May have been part of a removed feature or a failed refactor. |
| **Intact but Unused** | `[DORMANT]` | Well-written, complete code that exists but is deliberately or accidentally not active — feature-flagged off, behind a commented-out route, or in a file that nothing imports yet. |

### How to Classify Accurately

- **Don't guess.** Trace the actual connections. Does the import resolve? Does the route exist? Does the service method get called? Does the Supabase table exist?
- **Check git blame** on suspicious files. If a file was recently gutted (large deletions in a single commit), note the commit hash and date.
- **Test the chain.** For each feature, trace: Route → Component → Hook/Service → Supabase. If any link in the chain is broken, the feature is broken regardless of how good the individual pieces look.
- **Look for orphaned UI.** Buttons that call empty handlers. Tabs that render nothing. Modals that can't be triggered. Menu items that go nowhere.

---

## Phase 3: Connection Map

Build a **wiring diagram** that shows how everything connects. This is the most important diagnostic — it reveals severed connections.

### 3a. Route-to-Render Chain

For every route that leads to this section:

```
Route: /app/<section>/<subroute>
  → Component: <ComponentName> (file:line)
    → Reads from: [contexts, hooks, services]
    → Writes to: [services, Supabase tables]
    → Child components: [list with status labels]
    → Status: [SOLID|CRACKED|SEVERED|etc.]
    → Issue: [if not SOLID, what's wrong]
```

### 3b. Data Flow Map

```
Supabase Table: <table_name>
  → Service: <ServiceName>.<method>() (file:line) — [SOLID|CRACKED|etc.]
    → Hook: use<Hook>() (file:line) — [SOLID|CRACKED|etc.]
      → Component: <Component> (file:line) — [SOLID|CRACKED|etc.]
        → UI Element: [what the user sees]
```

Do this for EVERY table the section touches.

### 3c. Cross-Section Dependencies

```
THIS SECTION DEPENDS ON:
  - AuthContext (src/contexts/AuthContext.tsx) — for user/org data
  - OrgContext (src/contexts/OrgContext.tsx) — for org-level state
  - [other contexts, shared services, shared components]

OTHER SECTIONS THAT DEPEND ON THIS ONE:
  - <Section B> imports <Component> from this section (file:line)
  - <Section C> calls <Service.method> from this section (file:line)
```

Flag any dependency that is **broken** (import points to missing file, context no longer provides expected value, etc.)

---

## Phase 4: UI Surface Audit

Go through the section's UI systematically and check for missing or broken elements:

### 4a. Page-Level Check

| Check | Status | Notes |
|-------|--------|-------|
| Route exists and resolves | | |
| Page renders without console errors | | |
| Page renders without blank/white sections | | |
| Loading state exists and shows | | |
| Empty state exists and shows | | |
| Error state exists and shows | | |
| Navigation to this section works | | |
| Navigation AWAY from this section works | | |
| Page title / breadcrumb is correct | | |
| Section uses correct section tint | | |

### 4b. Interactive Elements Check

For every button, link, tab, toggle, dropdown, form field, modal trigger, and clickable element on the page:

| Element | Location | Handler | Connected? | Works? | Notes |
|---------|----------|---------|-----------|--------|-------|
| [Button: "Add New"] | Header | handleAdd() | Yes/No | Yes/No | |
| [Tab: "Overview"] | TabBar | setActiveTab | Yes/No | Yes/No | |
| ... | ... | ... | ... | ... | |

Pay special attention to:
- Buttons with `onClick={() => {}}` (empty handlers)
- Buttons with `onClick={handleSomething}` where `handleSomething` is a no-op or stub
- Tabs/panels that render an empty div or "Coming soon" text
- Form fields that aren't connected to state
- Dropdowns with hardcoded options that don't come from real data
- Action menus where some items work and others don't

### 4c. Missing UI Patterns

Check whether these standard patterns exist. If any are missing that SHOULD exist for this section type, flag them:

- [ ] Search / filter bar
- [ ] Pagination or infinite scroll for lists
- [ ] Sort controls
- [ ] Bulk selection / bulk actions
- [ ] Single-item action menu (edit, delete, etc.)
- [ ] Detail view / slide-out panel
- [ ] Create/Add modal or form
- [ ] Edit modal or inline editing
- [ ] Delete confirmation dialog
- [ ] Export functionality
- [ ] Import functionality
- [ ] Keyboard shortcuts
- [ ] Responsive / mobile layout
- [ ] Refresh / sync indicator
- [ ] Toast / notification feedback for actions

---

## Phase 5: Damage Report

This is the final output. Compile everything into a structured triage document.

### Report Structure

```markdown
# <Section> Triage Report — <Date>

## Executive Summary

**Overall Health: [CRITICAL | DAMAGED | FRAGILE | STABLE | HEALTHY]**

- Total files: X
- Total lines: X
- Solid: X files (X%)
- Cracked: X files
- Severed: X files
- Stub: X files
- Gutted: X files
- Orphaned: X files
- Dormant: X files

**One-paragraph plain-English summary of the damage.** What works, what doesn't,
and what the developer should fix first.

---

## 1. Intended Purpose

What this section IS (or was meant to be). Describe it from the user's perspective:
what problem it solves, what workflows it supports, who uses it.
Base this on the code's structure, comments, variable names, and UI text — not assumptions.

---

## 2. What's Solid (These Are Your Foundations)

List every component, service, hook, and UI element that is genuinely working.
Group by functional area. For each:
- What it does
- Where it lives (file:line)
- What it connects to
- Confidence level (verified working vs. appears correct)

This section tells the developer: "Don't touch these. Build on them."

---

## 3. What's Cracked (Fixable With Targeted Repairs)

List every partially-working piece. For each:
- What it does / should do
- Where it lives (file:line)
- What's broken specifically (wrong import, missing prop, stale reference, etc.)
- Estimated fix complexity: TRIVIAL (< 5 min) | MODERATE (< 30 min) | COMPLEX (> 30 min)
- Dependencies: what else breaks if this stays broken

Sort by estimated fix complexity (trivial first — quick wins).

---

## 4. What's Severed (Disconnected Wiring)

List every component/service/hook that exists but isn't connected. For each:
- What it was supposed to do
- Where the break is (missing route, deleted import source, removed context, etc.)
- What would need to happen to reconnect it
- Whether it's worth reconnecting or should be removed

---

## 5. What's Stubbed (Never Finished)

List every placeholder, mock, or skeleton. For each:
- What it pretends to be
- Where it lives (file:line)
- How much work remains to make it real
- Priority: is this core functionality or a nice-to-have?

---

## 6. What's Gutted (Was Better Before)

List anything that was clearly more complete in the past. For each:
- What it used to do (from git history)
- What it does now
- What was lost
- Commit that did the damage (hash + date + message)
- Whether the old version should be restored or rebuilt fresh

This is the most important section for damage assessment.

---

## 7. What's Orphaned (Dead Code — Safe to Remove)

List code that nothing references. For each:
- What it is
- Where it lives
- Whether it's truly orphaned (double-check before recommending deletion)
- Recommendation: DELETE or INVESTIGATE FURTHER

---

## 8. Connection Map

The full wiring diagrams from Phase 3:
- Route-to-Render chains
- Data flow maps
- Cross-section dependency graph
- Broken connections highlighted

---

## 9. UI Surface Audit

The full UI audit from Phase 4:
- Page-level checks
- Interactive element inventory
- Missing UI patterns

---

## 10. Repair Priority Queue

Based on everything above, a prioritized list of what to fix and in what order.
Priority is based on:
1. **User impact** — does this block a core workflow?
2. **Cascade risk** — does this break other things?
3. **Fix complexity** — quick wins first when impact is equal
4. **Foundation value** — fixing this enables fixing other things

| Priority | Item | Category | Est. Complexity | Enables |
|----------|------|----------|----------------|---------|
| 1 | ... | Cracked/Severed/etc. | Trivial/Moderate/Complex | [what else this unblocks] |
| 2 | ... | ... | ... | ... |

---

## 11. Git Forensics

Summary of recent git activity on this section's files:
- Last 10 commits touching this section (hash, date, message, files changed)
- Any large deletions (commits that removed significant code)
- Any file renames or moves
- Any commits from automated/AI sessions that changed many files at once

This helps the developer understand WHEN the damage happened and potentially
revert specific commits.
```

---

## Guiding Principles

- **Accuracy over speed.** Read the actual code. Trace the actual connections. Check git history. Don't classify based on vibes.
- **No implementation.** This tool produces a report, not fixes. The developer decides what to fix and when.
- **No judgment on past decisions.** Don't editorialize about why code is the way it is. Just document what IS.
- **Be specific.** "handleSubmit is broken" is useless. "handleSubmit (ContactForm.tsx:142) calls contactService.update() which references a `contact_notes` column that doesn't exist in the contacts table migration" is useful.
- **Think in chains.** A component isn't "working" if its data source is broken. A service isn't "solid" if nothing calls it. Always trace the full chain.
- **Flag the worst first.** The Executive Summary should tell the developer whether to panic, worry, or relax — and what to fix first.
- **Distinguish "never built" from "was built and broken."** These require very different responses. Stubs need building. Gutted code might just need reverting.
- **Check git before claiming something is gutted.** Use `git log --oneline -10 -- <file>` and `git log --diff-filter=M --stat -- <file>` to confirm recent destructive changes.
