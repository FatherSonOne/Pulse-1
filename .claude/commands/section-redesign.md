# Section Redesign — Triple-Mockup → Polish → Implementation Plan

End-to-end Pulse section redesign workflow. Audits the section's current code, generates 3 distinct design directions as a single HTML playground (paths A/B/C in `_design-playground/`), assists you picking + iterating, polishes the chosen direction, then produces a phased implementation handoff doc with an exhaustive feature-disposition matrix.

**Target section:** $ARGUMENTS

---

## How to use

Invoke this command with the section name as the argument. If you don't pass one, the agent will ask.

Examples:

```
/section-redesign Email
/section-redesign Calendar
/section-redesign Contacts
/section-redesign Glimpse threads
/section-redesign Dashboard
/section-redesign            ← will ask which section
```

---

## What happens

The agent runs the [`section-redesign` skill](../skills/section-redesign/SKILL.md), which walks six phases:

| Phase | What happens | Stop point |
|-------|--------------|-----------|
| **0 — Setup** | Confirm section + locate source | Confirmed |
| **1 — Reconnaissance** | Read the section's components/stores/services; summarize the feature surface in ~150 words | You give any biases or just say "go" |
| **2 — 3 Mockups** | Generate `_design-playground/<section>-redesign.html` with 3 distinct directions (paths A/B/C, switchable via top bar, both themes, fake Pulse sidebar). Headless-verify with Playwright. | You open the HTML and pick a path |
| **3 — User picks** | Save the choice as a project memory; acknowledge | You say "iterate", "polish", "make the plan", or stop |
| **4 — Hybrid/iterate** | (Optional) Generate 2–3 hybrid integration patterns; re-verify | You pick the hybrid variant |
| **5 — Polish** | (Optional) Add targeted polish: transitions, micro-interactions, edge states, keyboard shortcuts, state preservation, action toasts, done states | You say "good" or "more X" |
| **6 — Handoff** | (Optional) Audit current code (Explore subagent + ground-truth reads), build feature-disposition matrix (every feature → preserved / moved / deferred / removed), write phased plan to `docs/<SECTION>_REDESIGN_HANDOFF_<YYYY-MM-DD>.md`, update memory | Doc delivered |

You drive the cadence. The agent does NOT auto-advance through phases.

---

## What you get

- **A playground** at `_design-playground/<section>-redesign.html` — self-contained, runs in any browser, dark + light themes, 3 (or more after hybridizing) explorable design directions
- **Verification screenshots** at `_design-playground/_shots/<section>-*.png`
- **A memory entry** at `~/.claude/projects/f--pulse1/memory/project_pulse_<section>_redesign_direction.md` recording your chosen direction
- **An implementation handoff doc** (only if you reach Phase 6) at `docs/<SECTION>_REDESIGN_HANDOFF_<YYYY-MM-DD>.md` — phased, with a complete feature disposition matrix; self-contained enough for a builder agent to pick up cold

---

## What it does NOT do

- **No production code changes.** This skill produces docs + playgrounds. Implementation is delegated to a separate builder agent reading the handoff doc.
- **No commits.** Per CLAUDE.md, only commits when explicitly asked.
- **No feature dropping.** The Phase 6 disposition matrix is the contract — anything not mapped is a bug in the doc, and the agent will surface it as a "Decisions needed" gap rather than silently drop it.

---

## Reference — worked example

The Email section, May 2026 — produced via this exact workflow:

- Playground: [`_design-playground/email-redesign.html`](../../_design-playground/email-redesign.html)
- Verify script: [`_design-playground/_verify-email.mjs`](../../_design-playground/_verify-email.mjs)
- Chosen direction: Path A · Inline Toggle (Cockpit-as-main + segmented-pill Triage mode)
- Memory: `~/.claude/projects/f--pulse1/memory/project_pulse_email_redesign_direction.md`
- Handoff doc: [`docs/EMAIL_HYBRID_REDESIGN_HANDOFF_2026-05-27.md`](../../docs/EMAIL_HYBRID_REDESIGN_HANDOFF_2026-05-27.md)

Compare your output against these — they're the gold standard.

---

## Related commands

- `/design-playground` — single-section playground with controls/sliders (different pattern: knobs to tune one design, not 3 directions to compare)
- `/style-section` — apply Pulse premium dark CSS to an existing section (visual-only refresh; no architectural change)
- `/section-deep-dive` — discovery + diagnosis on an existing section (no redesign output)
- `/ui-enhance` — dual-agent UI/UX enhancement plan (more focused on incremental polish than rethink)

Pick `/section-redesign` when you want to **reimagine** a section, not refresh it.
