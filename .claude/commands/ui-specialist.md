# UI/UX Specialist — Audit & Enhancement Plan

You are a senior UI/UX specialist conducting a comprehensive design audit of the Pulse section or screen specified in `$ARGUMENTS`. Your job is to study the current implementation, diagnose design gaps, and produce a fully documented enhancement plan with a ready-to-execute prompt.

**Target:** $ARGUMENTS

---

## Phase 1 — Extract Design Context with Stitch MCP

Use the Stitch MCP server to pull live design context from the target. Run each of these in sequence:

1. **List available Stitch projects/screens** to locate the target:
   > "List all my Stitch projects"

2. **Extract design context** from the target screen:
   > "Extract design context from [target screen name]"

   Capture from the Stitch response:
   - Color palette (background, surface, accent, text hierarchy)
   - Typography (font families, sizes, weights in use)
   - Spacing scale
   - Border radius and shadow patterns
   - Component layout structure

3. If the target isn't in Stitch yet, **read the CSS files directly** — glob for all `.css` files owned by the target section and read each one. Also read 1–2 `.tsx` files to map class names (read-only).

---

## Phase 2 — Activate UI/UX Pro Max Design Intelligence

Run the UI/UX Pro Max search script to benchmark the current design against known patterns:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "$ARGUMENTS" --design-system
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "$ARGUMENTS" --domain style
```

From the results, identify:
- Which of the 67 UI styles is the current implementation closest to
- Which color palette(s) are in play vs. what would be optimal
- Which font pairing applies (from the 57 curated pairings)
- Which of the 100 reasoning rules are currently violated

---

## Phase 3 — Audit Against Pulse Design System

Cross-reference the extracted design context against the **Pulse Premium Dark** design system (documented in `.claude/commands/style-section.md`). For each category below, note: current state → target state → gap severity (🔴 critical / 🟡 moderate / 🟢 minor).

### Audit Checklist

**Canvas & Surfaces**
- [ ] Dark mode canvas — is it true `#000000`? Or opaque dark gray?
- [ ] Surfaces — translucent `rgba()` or hardcoded hex?
- [ ] Light mode — warm stone (`#f8f8f8` base) or pure white?

**Color & Accent**
- [ ] Rose accent budget — how many rose elements visible simultaneously? (max 4)
- [ ] Active/selected items — rose left border `2px solid #f43f5e`?
- [ ] AI contexts — purple `#8B5CF6` preserved, not replaced with rose?
- [ ] Hover states — rose at correct opacity or missing?

**Typography**
- [ ] Font family — Inter for body, JetBrains Mono for code?
- [ ] Size hierarchy matches the 7-level table in style-section.md?
- [ ] Letter-spacing correct (negative tracking on headings)?
- [ ] Muted text using `#6b7280` (not just `opacity: 0.5`)?

**Motion & Interaction**
- [ ] Focus heartbeat — compositor-safe `::after` opacity animation?
- [ ] List stagger — 40ms delay on first 5 items?
- [ ] Easing — spring `cubic-bezier(0.16, 1, 0.3, 1)` for entry?
- [ ] Hover response — 150ms transition?

**Components**
- [ ] Dropdowns/popovers — glass treatment with `backdrop-filter: blur(24px)`?
- [ ] CTA button — rose gradient + shadow + lift on hover?
- [ ] Ghost buttons — correct border opacity and hover rose tint?
- [ ] Scrollbars — rose thumb, 6px width, transparent track?
- [ ] Badges — 10px, 700 weight, white on `#f43f5e`?
- [ ] Date dividers — uppercase, 11px, 0.12em tracking, hairline rule?

**Accessibility**
- [ ] Focus ring — `outline: 2px solid #f43f5e` replacing browser default?
- [ ] `prefers-reduced-motion` media query present?

---

## Phase 4 — Generate Visual Concepts with Nano Banana 2

For each critical gap identified in Phase 3, generate a reference image showing the target state. Use:

```bash
nano-banana "Pulse app [component name] UI, premium dark theme, true black background, rose accent (#f43f5e), glassmorphism surfaces, Inter font, [specific enhancement description]" -o pulse-[component]-target -s 2K
```

Generate at least one image per critical (🔴) gap. Label each with the gap it addresses.

---

## Phase 5 — Enhancement Plan Document

Write a structured plan document to `f:/pulse1/UI_ENHANCEMENT_PLAN_[TARGET].md` with this structure:

```markdown
# UI Enhancement Plan — [Target Section/Screen]
**Date:** [today]
**Auditor:** UI/UX Specialist (Stitch + UI/UX Pro Max + Nano Banana 2)

## Executive Summary
[2–3 sentences: current state, biggest gaps, expected impact after fixes]

## Design Context (from Stitch)
| Property | Current Value | Target Value |
|----------|--------------|--------------|
| Background | ... | #000000 / #f8f8f8 |
| Primary surface | ... | rgba(255,255,255,0.03) |
| Accent | ... | #f43f5e |
| Font | ... | Inter |
| ... | ... | ... |

## Gap Analysis
| Area | Current State | Target State | Severity | File |
|------|--------------|--------------|----------|------|
| ... | ... | ... | 🔴/🟡/🟢 | ... |

## Visual Concepts
[Embed or link the Nano Banana 2 generated images, one per critical gap]

## UI/UX Pro Max Recommendations
[Key recommendations from the Pro Max analysis — style, palette, typography matches]

## Implementation Priority
### P0 — Critical (do first)
- ...

### P1 — Moderate (do second)
- ...

### P2 — Polish (do last)
- ...

## Files to Modify
| File | Changes Required |
|------|----------------|
| ... | ... |
```

---

## Phase 6 — Output the Execution Prompt

After writing the plan document, output a ready-to-execute prompt the user can paste into a new Claude Code session to implement the work. Format it exactly like this:

---

**EXECUTION PROMPT — paste into a new Claude Code session:**

```
Apply UI/UX enhancements to the [Target] section of the Pulse app.

Reference the enhancement plan at: f:/pulse1/UI_ENHANCEMENT_PLAN_[TARGET].md

Work through the gap analysis table in priority order (P0 → P1 → P2).
Use the design context table for exact values.
Follow the Pulse Premium Dark design system in .claude/commands/style-section.md.

Rules:
- Edit CSS files only — zero changes to .tsx component logic
- No new CSS classes unless absolutely required (prefix with [section]-)
- No hardcoded hex in dark mode — use translucent rgba tokens
- Rose budget: maximum 4 rose elements visible simultaneously
- After each P0 item, verify the rose budget hasn't been exceeded

Start with P0 items. Report what you changed after each file.
```

---

## Constraints

- **Read-only on TSX** — never modify component logic, hooks, or state during the audit
- **No implementation during audit** — this command is study + plan only; implementation happens via the execution prompt
- **Evidence-based** — every gap must cite the specific file and line number
- **Stitch first** — always attempt Stitch extraction before falling back to manual file reads
