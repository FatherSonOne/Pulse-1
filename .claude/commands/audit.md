# Full Section Audit

Perform a comprehensive audit of the specified section/module: **$ARGUMENTS**

## Process

1. **Identify all relevant files** — components, services, types, hooks, utils, styles, and tests related to this section. List them with line counts.

2. **Read every file thoroughly** — don't skim. Read the actual code.

3. **Map the architecture** — produce an ASCII diagram showing:
   - Components and their hierarchy
   - Services and data flow
   - Database tables/schemas involved
   - External API integrations
   - State management approach

4. **Catalog current status** for every feature/sub-feature:
   | Feature | Status | Notes |
   |---------|--------|-------|
   | ... | ✅ Working / ⚠️ Partial / ❌ Broken / 🔇 Stub | Details |

5. **Document issues found**, categorized by severity:
   - 🔴 **Critical** — Broken functionality, data issues, security problems
   - 🟡 **Medium** — Missing wiring, UX problems, inconsistencies
   - 🟢 **Nice-to-Have** — Missing features, polish, optimizations

6. **Check for**:
   - Dead code / unused imports / unreachable paths
   - State that's initialized but never rendered
   - Services that exist but aren't called
   - Duplicate logic across files
   - God components that need splitting
   - Missing error handling
   - Hardcoded values that should be configurable
   - TypeScript `any` types or missing types
   - Accessibility gaps
   - Performance concerns (unnecessary re-renders, missing memoization, large bundles)

7. **Produce a revisal plan** with phased implementation:
   - Phase 1: Fix broken/critical issues
   - Phase 2: Wire up partial/stub functionality
   - Phase 3: Refactor and improve architecture
   - Phase 4: New features and polish

8. **Generate a Claude agent prompt** at the end — a self-contained prompt that another Claude instance could use to implement the revisal plan, with full context on file paths, current state, and expected outcomes.

## Output

Save the audit to: `docs/<SECTION_NAME>_AUDIT_<DATE>.md`

Use today's date in YYYY-MM-DD format. Use SCREAMING_SNAKE_CASE for the section name.

Be thorough. Be honest. If something is broken, say it's broken. If something is fake/stub, call it out. The goal is a complete ground-truth picture of this section so we can make informed decisions about what to fix, refactor, or remove.
