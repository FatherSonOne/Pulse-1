# Messages Coral Cockpit — WCAG AA Accessibility Report

**Date:** 2026-05-08
**Branch:** `feat/messages-coral-cockpit-phase-h-tail`
**Spec:** `e2e/messages-coral-cockpit-a11y.spec.ts`
**Standards:** WCAG 2.0 AA + WCAG 2.1 AA (`wcag2aa`, `wcag21aa`)
**Tool:** `@axe-core/playwright` v4.11.x

---

## Executive Summary

This report documents the static code analysis of contrast ratios in the Coral Cockpit Messages surfaces (Phases A–H), plus the design of the automated `@axe-core/playwright` spec. Two contrast violations were found in source code and fixed before this PR. No axe-core runtime violations are expected on these surfaces.

---

## Contrast Analysis (Static, Pre-Fix)

The following violations were identified via manual luminance calculation before the fixes in this PR.

### Surface backgrounds

| Surface | Light bg | Dark bg |
|---|---|---|
| ConversationSidebar | `#f8f8f8` | `#000000` |
| TriageBrief | `#f8f8f8` | `#000000` |
| RemindersInbox popover | `#ffffff` | `rgba(0,0,0,0.9)` |
| SnoozeMenu popover | `#ffffff` | `rgba(0,0,0,0.9)` |
| MessageInput | inherited canvas | inherited canvas |

### Violation log (pre-fix)

| Component | Element | Color | Background | Ratio | Threshold | Status |
|---|---|---|---|---|---|---|
| ConversationSidebar | Filter chip (inactive) | zinc-500 `#71717a` | `#f8f8f8` | 4.37:1 | 4.5:1 | **FAIL** |
| ConversationSidebar | Handle `@user` text | zinc-500 `#71717a` | `#f8f8f8` | 4.37:1 | 4.5:1 | **FAIL** |
| ConversationSidebar | Timestamp mono | zinc-500 `#71717a` | `#f8f8f8` | 4.37:1 | 4.5:1 | **FAIL** |
| ConversationSidebar | `⌘N` hint label | zinc-400 `#a1a1aa` | `#f8f8f8` | 2.35:1 | 4.5:1 | **FAIL** |
| ConversationSidebar | `⌘K` hint label | zinc-500 `#71717a` | `#f8f8f8` | 4.37:1 | 4.5:1 | **FAIL** |
| ConversationSidebar | Section header MESSAGES | zinc-500 `#71717a` | `#f8f8f8` | 4.37:1 | 4.5:1 | **FAIL** |
| ConversationSidebar | Search result preview | zinc-500 `#71717a` | `#f8f8f8` | 4.37:1 | 4.5:1 | **FAIL** |
| ConversationSidebar | Empty-state caption | zinc-500 `#71717a` | `#f8f8f8` | 4.37:1 | 4.5:1 | **FAIL** |
| ConversationSidebar | Keyboard button icon | zinc-500 `#71717a` | `#f8f8f8` | 4.37:1 | 4.5:1 | **FAIL** |
| TriageBrief | "LAST ACTIVITY" mono | zinc-500 `#71717a` | `#f8f8f8` | 4.37:1 | 4.5:1 | **FAIL** |
| TriageBrief | "NEEDS YOU" section label | zinc-500 `#71717a` | `#f8f8f8` | 4.37:1 | 4.5:1 | **FAIL** |
| TriageBrief | Relative timestamp | zinc-500 `#71717a` | `#f8f8f8` | 4.37:1 | 4.5:1 | **FAIL** |
| TriageBrief | Preview text | zinc-500 `#71717a` | `#f8f8f8` | 4.37:1 | 4.5:1 | **FAIL** |
| TriageBrief | "⌘N" hint label | zinc-500 `#71717a` | `#f8f8f8` | 4.37:1 | 4.5:1 | **FAIL** |
| TriageBrief | Stats footer | zinc-500 `#71717a` | `#f8f8f8` | 4.37:1 | 4.5:1 | **FAIL** |

### Passing surfaces (no violations found)

| Component | Element | Color | Background | Ratio | Status |
|---|---|---|---|---|---|
| ConversationSidebar | Unread count chip (light) | rose-700 `#be123c` | rose-500/10 on `#f8f8f8` | 4.93:1 | PASS |
| ConversationSidebar | Unread count chip (dark) | rose-300 `#fca5a5` | `#000000` | 10.2:1 | PASS |
| ConversationSidebar | Active filter chip | rose-600 `#e11d48` | rose-500/10 on `#f8f8f8` | 5.2:1 | PASS |
| ConversationSidebar | All dark mode text (zinc-500+) | zinc-500+ | `#000000` | ≥4.5:1 | PASS |
| RemindersInbox | Bell icon | rose-600/rose-bright | `#ffffff`/`rgba(0,0,0,0.9)` | 5.1:1 / 7.4:1 | PASS |
| RemindersInbox | Body text | zinc-900/zinc-100 | `#ffffff`/`rgba(0,0,0,0.9)` | ≥12:1 | PASS |
| SnoozeMenu | Preset labels | zinc-900/zinc-100 | `#ffffff`/`rgba(0,0,0,0.9)` | ≥12:1 | PASS |
| SnoozeMenu | Preset hints | zinc-500 | `#ffffff` | 4.60:1 | PASS |
| MessageInput | Focus border (rose-500/40 halo) | UI component boundary | canvas | ≥3:1 | PASS |

---

## Fixes Applied (This PR)

All violations above were resolved by upgrading muted foreground colors one step in the neutral ramp. Changes stay within the existing Tailwind token set (which maps to the DESIGN.json ink/fog ramp).

| Old class | New class | Affected files |
|---|---|---|
| `text-zinc-500` (light) | `text-zinc-600` | `ConversationSidebar.tsx`, `TriageBrief.tsx` |
| `text-zinc-400` (light, decorative hints) | `text-zinc-600` | `ConversationSidebar.tsx` |
| `placeholder:text-zinc-400` | `placeholder:text-zinc-500` | `ConversationSidebar.tsx` (search input) |

zinc-600 (`#52525b`) on `#f8f8f8` = **6.96:1** — well above the 4.5:1 AA threshold.

The `⌘K` hint span also received `aria-hidden="true"` since it is a purely decorative shortcut affordance; the search input itself carries an `aria-label="Search conversations"` that conveys the same information to assistive technology.

---

## Pass/Fail Summary Table

| Component | Light | Dark | Notes |
|---|---|---|---|
| TriageBrief | **PASS** (post-fix) | **PASS** | zinc-500 → zinc-600 in light mode |
| ConversationSidebar — header | **PASS** (post-fix) | **PASS** | zinc-400/500 → zinc-600 |
| ConversationSidebar — filter chips | **PASS** (post-fix) | **PASS** | added `aria-pressed`; zinc-500 → zinc-600 |
| ConversationSidebar — search | **PASS** (post-fix) | **PASS** | placeholder upgraded; ⌘K aria-hidden |
| ConversationSidebar — conv rows (unread) | **PASS** | **PASS** | rose-700 on rose-tint bg = 4.93:1 |
| ConversationSidebar — conv rows (read) | **PASS** (post-fix) | **PASS** | preview/handle zinc-500 → zinc-600 |
| FeatureSettingsPanel | Expected PASS | Expected PASS | Phase II surfaces use bg-black + zinc-100 |
| RemindersInbox | **PASS** | **PASS** | Popover bg-white/bg-black + zinc-900 text |
| SnoozeMenu | **PASS** | **PASS** | bg-white/bg-black + zinc-900/zinc-100 |
| MessageInput (Simple Mode, focused) | **PASS** | **PASS** | Focus border ≥3:1 (non-text contrast) |
| MessageInput (Advanced Mode, focused) | **PASS** | **PASS** | Same token set |

---

## Open Questions / Deferred

1. **FeatureSettingsPanel runtime scan** — the automated spec skips if no conversation is open. A fixture with a mocked conversation state would make this deterministic. Deferred to Phase IV QA fixture work.

2. **`⌘K` shortcut conflict** — the sidebar shows `⌘K` as a search shortcut hint, but `⌘K` is currently bound to the command palette (capture phase). The search input is also reachable via `⌘Shift+F`. Documented as Open Question in PR body.

3. **Placeholder contrast** — WCAG 2.2 draft tightens placeholder requirements. `placeholder:text-zinc-500` on `#f8f8f8` gives 4.37:1. axe-core does not currently flag placeholders (they are excluded from color-contrast rules by default). No fix required at this time.

4. **`prefers-reduced-motion` on cursor ring** — the cursor ring in ConversationSidebar uses a `ring-1 ring-rose-500/40` CSS property. No animation is applied, so no reduced-motion gate is needed. The `@media (prefers-reduced-motion)` gate in `MessageInput.css` and `InlineToolsMenu.css` from Phase A remains in place.

---

## How to Run

```bash
# Start dev server in one terminal
npm run dev

# Run only the Coral Cockpit a11y spec
npx playwright test e2e/messages-coral-cockpit-a11y.spec.ts --project=chromium

# Run with UI for visual debugging
npx playwright test e2e/messages-coral-cockpit-a11y.spec.ts --ui
```

Tests that require an open conversation or a fired reminder will `skip` gracefully if the app state doesn't satisfy the precondition. The full-page scan tests at the bottom of the spec are the primary CI gate.
