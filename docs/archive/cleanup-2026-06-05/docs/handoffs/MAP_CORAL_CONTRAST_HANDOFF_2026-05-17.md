# Map Section — Coral Contrast Handoff

**Date**: 2026-05-17
**From**: Palette (a11y audit, `/palette a11y src/components/map/...`)
**To**: Vision (brand sign-off), then Muse (token addition), then any coding agent (3-callsite swap)
**Status**: WCAG 2.2 SC 1.4.3 — AA-blocking on 3 callsites; not yet shipped
**Related commits**: `3c8fe33` (Batch 2), `d7663e3` (Batch 3)

---

## 1. Audit summary

The map section's lens row, AI sequence badges, and AI fetching/paused strip use `text-rose-500` over rose-tint surfaces. Measured contrast fails the 4.5:1 requirement for text under WCAG 2.2 AA.

| # | Pair | File:line | Ratio | Required |
|---|------|-----------|-------|----------|
| 1 | `text-rose-500` on `bg-rose-50` (active lens tab, light mode) | [src/components/map/PulseMapView.tsx:976](../src/components/map/PulseMapView.tsx#L976) | **~3.50:1** | 4.5:1 (small text 10–12 px) |
| 2 | `text-rose-500` on `bg-rose-100` (reorder sequence badge `1, 2, 3…`) | [src/components/map/PulseMapView.tsx:1612](../src/components/map/PulseMapView.tsx#L1612) | **~3.18:1** | 4.5:1 (bold small) |
| 3 | `text-rose-500/70` (AI strip fetching / paused / idle labels) | [src/components/map/PulseMapView.tsx:1730](../src/components/map/PulseMapView.tsx#L1730), [:1746](../src/components/map/PulseMapView.tsx#L1746), [:1762](../src/components/map/PulseMapView.tsx#L1762) | **~2.4:1** | 4.5:1 |

Dark surfaces pass — `text-rose-500` under `.dark` resolves to `--pulse-rose: #fb7185` against `zinc-950`, ~5.4:1. The gap is light-mode only.

Why this is the last AA blocker on the map: Batches 1–3 closed every other WCAG 2.2 issue identified in the `/palette a11y` audit. Contrast is the only item that touches brand identity rather than markup or behaviour, which is why it routes through Vision before Muse + implementation.

---

## 2. Proposed fix

### 2.1 Token addition

Append to [src/styles/pulse-tokens.css](../src/styles/pulse-tokens.css):

```css
:root {
  /* Coral ink intended for use on rose-tinted backgrounds (rose-50, rose-100,
     rose-500/10). Standard --pulse-rose (#f43f5e) does not meet WCAG 2.2 SC
     1.4.3 against these surfaces (~3.2–3.5:1 vs. required 4.5:1 for text).
     rose-700 = #BE123C → 5.95:1 on rose-50, 5.42:1 on rose-100. */
  --pulse-coral-ink-on-tint: #BE123C;
}

.dark {
  /* Dark surfaces are already passing — alias to the existing bright variant
     so consumers don't fork a Tailwind class per mode. */
  --pulse-coral-ink-on-tint: var(--pulse-rose-bright); /* #fda4af */
}
```

### 2.2 Callsite changes (light-mode only — dark surfaces unchanged)

1. **Active lens tab** — [src/components/map/PulseMapView.tsx:976](../src/components/map/PulseMapView.tsx#L976)
   - Before: `text-rose-500 ${isDarkMode ? 'bg-rose-500/10' : 'bg-rose-50'}`
   - After: `${isDarkMode ? 'text-rose-500 bg-rose-500/10' : 'text-[color:var(--pulse-coral-ink-on-tint)] bg-rose-50'}`

2. **Reorder sequence badge** — [src/components/map/PulseMapView.tsx:1612](../src/components/map/PulseMapView.tsx#L1612)
   - Same swap: light-mode `text-rose-500` → `text-[color:var(--pulse-coral-ink-on-tint)]`.

3. **Fetching / paused / idle strip labels** — [:1730](../src/components/map/PulseMapView.tsx#L1730), [:1746](../src/components/map/PulseMapView.tsx#L1746), [:1762](../src/components/map/PulseMapView.tsx#L1762)
   - Recommendation: drop coral text entirely. Replace `text-rose-500/70` with `text-gray-600 dark:text-gray-300`. The Sparkles icon stays coral — that carries the AI-strip identity. Coral text on these placeholders was decorative consistency, not signal, and pushing it to a darker coral makes the strip read more urgent than the state actually is.

### 2.3 Impact summary

- 3 callsite edits + 1 token block.
- No new dependencies, no behaviour changes, no API changes.
- Active-tab / sequence-badge changes preserve coral identity at deeper saturation. Fetching-strip change replaces coral text with neutral ink (icon stays coral).
- After the swap, axe-core color-contrast rule should report 0 violations on the map route.

---

## 3. Vision review — 3 questions

Vision owns the brand call before Muse adds the token. Three decisions:

### Q1 — Coral saturation on tinted surfaces

The proposal shifts coral text on rose-50 / rose-100 from `--pulse-rose` (#f43f5e) to a darker rose-700 (#BE123C). On a pure-white background these read as different colors; on rose-50 / rose-100 the contrast difference is what gives rose-700 the readability advantage. Acceptable trade?

- Option A — **rose-700 (#BE123C, 5.95:1)** — recommended; deepest coral that still reads as "coral", not "burgundy".
- Option B — `--pulse-rose-deep` (#e11d48 = rose-600, ~4.6:1) — closer to brand canon but only barely passes. Risk: subpixel anti-aliasing on some displays could push it under 4.5:1.
- Option C — Drop the tinted backgrounds. Active state becomes a 2 px coral underline or border, text stays neutral. Bigger visual redesign — defer if active-tab readability is the primary concern.

### Q2 — Sequence badges (10 px bold inside a coral pill)

These read more like a counter than a UI label. Options:

- Option A — Apply the same `--pulse-coral-ink-on-tint` swap. Counter stays coral-on-coral but legible.
- Option B — Drop coral on the digit, use `text-gray-700`. The coral pill still carries the brand; the number becomes a neutral counter inside it. Higher contrast (~7:1) and cleaner read.
- Recommendation: **Option B** — sequence badges are functional, not branded.

### Q3 — Fetching / paused / idle strip labels

The `text-rose-500/70` labels currently say "PULSE AI · ROUTE" (fetching), "PULSE AI · PAUSED", "No route today, just one stop." next to a coral Sparkles icon. Options:

- Option A — Bump opacity to 100% and use `--pulse-coral-ink-on-tint`. Keeps coral text identity.
- Option B — Drop coral text, use neutral ink (`text-gray-600 dark:text-gray-300`). Icon stays coral.
- Recommendation: **Option B** — the idle/paused states should read calmer than the active "PULSE AI · ROUTE" green-light state. Coral text on a placeholder makes the strip louder than it should be.

---

## 4. Execution prompt

Once Vision answers Q1–Q3, paste this into any coding agent (`/palette`, `/artisan`, or Claude directly) to land the change.

````
Coral contrast fix on Map section — implements WCAG 2.2 SC 1.4.3 closure
spec'd in docs/MAP_CORAL_CONTRAST_HANDOFF_2026-05-17.md §2.

Vision decisions (record here before shipping):
  Q1 active-tab coral: rose-700 (#BE123C) / rose-600 (#e11d48) / underline-only
  Q2 sequence badges:  apply coral / neutral (gray-700)
  Q3 fetching labels:  keep coral / neutral (gray-600 dark:gray-300)

Implementation:
1. src/styles/pulse-tokens.css — append to :root and .dark blocks:

     :root {
       /* Coral ink for use on rose-tinted surfaces. WCAG 2.2 SC 1.4.3.
          rose-700 = #BE123C → 5.95:1 on rose-50, 5.42:1 on rose-100. */
       --pulse-coral-ink-on-tint: #BE123C;
     }
     .dark {
       --pulse-coral-ink-on-tint: var(--pulse-rose-bright);
     }

   (If Vision picked Option B for Q1, swap #BE123C → #e11d48.)

2. src/components/map/PulseMapView.tsx — three edits:

   2a. Active lens tab (around L976) — only the light branch swaps:
       active
         ? `text-rose-500 ${isDarkMode ? 'bg-rose-500/10' : 'bg-rose-50'}`
       →
       active
         ? `${isDarkMode
             ? 'text-rose-500 bg-rose-500/10'
             : 'text-[color:var(--pulse-coral-ink-on-tint)] bg-rose-50'}`

   2b. Reorder sequence badge (around L1612) — light-mode coral swap, or
       per Q2 Option B, replace `text-rose-500` with `text-gray-700`.

   2c. Fetching / paused / idle labels (around L1730, L1746, L1762) — per
       Q3 Option B, replace `text-rose-500/70` with
       `text-gray-600 dark:text-gray-300` on the label <span> only (the
       <Sparkles> icon next to it stays coral).

3. Verify:
   - npx tsc --noEmit -p tsconfig.json passes (the existing pre-existing
     errors in App.tsx etc. are unrelated; only these files should be
     unaffected).
   - Manual check in browser at /map: active lens tab, reorder badges
     (enter reorder mode), and the "fetching"/"paused" placeholders all
     remain visible and brand-coherent in both light and dark mode.
   - Run axe-core if available — color-contrast rule should report 0
     violations on the map route after the swap.

Commit message style:
  a11y(map): coral contrast pass (WCAG 2.2 SC 1.4.3)

  Adds --pulse-coral-ink-on-tint and applies it to the three rose-tint
  surfaces that previously fell below 4.5:1: active lens tab (was
  3.50:1), sequence badge (was 3.18:1), fetching/paused strip labels
  (was 2.40:1). Dark-mode surfaces unchanged (already passing).

  Resolves the last AA blocker from the /palette audit; the map section
  is now ready for the Voyager axe-core E2E pass.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
````

---

## 5. Voyager handoff (after the coral fix lands)

```
PALETTE_TO_VOYAGER
- Trigger: a11y batches 1–3 + coral contrast all landed; map section
  ready for E2E a11y regression.
- Suite: src/components/map/PulseMapView.tsx + sub/BroadcastRecipientPicker.tsx
- Tooling: @axe-core/playwright on the /map route, lens=TODAY with mock
  contacts seeded (Pulse-linked + non-Pulse mix; 2 with home+work
  coords, 1 with home only).
- Coverage:
  1. axe-core full scan — pass criteria: 0 violations.
  2. Keyboard-only BroadcastRecipientPicker flow:
     - Tab to broadcast toggle → Enter
     - Tab into picker → search field has focus on mount
     - Tab → Space toggles row checkbox; sequence "3 selected of 12"
       announced via aria-live
     - Tab to "Broadcast to 3 recipients" → Enter
     - Focus returns to the broadcast toggle on dialog close
  3. Keyboard-only reorder flow:
     - Open route proposal → focus Reorder button → Enter
     - Tab to first <li> → ArrowDown twice (focus follows the moved
       stop)
     - Tab to Accept → Enter → polyline renders
  4. LiveBroadcastSheet:
     - Open via live chip → close button has initial focus
     - Tab stays inside sheet (focus trap)
     - Esc closes; focus returns to live chip
  5. SR snapshot: lens swap announcer fires
     "Today lens, N contacts on map" within 200 ms of pressing 1/2/3.
- Acceptance:
  - 0 axe violations across all 4 dialogs and main map.
  - All 4 keyboard flows complete without mouse.
  - Drag-and-drop reorder path still works for mouse users (smoke test).
```

---

## 6. Out-of-scope / known follow-ups

- `LocationEditModal` ([src/components/map/contacts/LocationEditModal.tsx](../src/components/map/contacts/LocationEditModal.tsx)) was not in the original audit scope and still uses its own focus-trap implementation. Migrate to `useDialogA11y` in a follow-up if it touches the map section's a11y guarantees.
- `MapFilterBar` was not audited — search input, broadcast toggle, and Geo-banner could all benefit from the same pass.
- The 2.5.7 dragging-movement fix shipped in B3.1 only covers the AI reorder list. If any other map-side drag interactions ship later (e.g. drag-to-pin a contact), they will need the same Up/Down + ArrowKey treatment.
