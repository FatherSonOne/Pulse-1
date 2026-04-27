# Pulse Section UI Enhancement

Apply the Pulse premium dark design system to the section named in `$ARGUMENTS`.

**Target section:** $ARGUMENTS

---

## Your Role

You are a senior frontend designer performing a **purely visual/UX enhancement** on the named Pulse section. You will:

1. Read every CSS file owned by the target section
2. Optionally read 1–2 TSX files to understand class names (read-only — no TSX edits)
3. Rewrite only the CSS files to apply the design system below
4. Leave all TypeScript, hooks, services, state, and logic completely untouched

---

## Design System — Pulse Premium Dark

### CSS Token Pattern

Add this token block at the very top of the section's primary CSS file. Replace `[prefix]` with a short section-specific identifier (e.g. `email`, `tasks`, `contacts`).

```css
/* ============================================================
   [SECTION NAME] — DESIGN TOKENS
   Pulse Premium Dark · Rose Accent System
   ============================================================ */

:root {
  --[prefix]-bg:             #f8f8f8;
  --[prefix]-surface:        #ffffff;
  --[prefix]-surface-raised: #f2f2f2;
  --[prefix]-border:         rgba(0, 0, 0, 0.08);
  --[prefix]-primary:        #f43f5e;
  --[prefix]-primary-alt:    #ec4899;
  --[prefix]-primary-soft:   rgba(244, 63, 94, 0.10);
  --[prefix]-primary-softer: rgba(244, 63, 94, 0.05);
  --[prefix]-primary-glow:   rgba(244, 63, 94, 0.25);
  --[prefix]-text-main:      #0f0f0f;
  --[prefix]-text-secondary: #52525b;
  --[prefix]-text-muted:     #6b7280;
  --[prefix]-shadow-sm:      0 1px 3px rgba(0, 0, 0, 0.06);
  --[prefix]-shadow-md:      0 4px 12px rgba(0, 0, 0, 0.08);
  --[prefix]-shadow-rose:    0 0 0 1px var(--[prefix]-primary),
                             0 4px 24px var(--[prefix]-primary-glow);
}

.dark {
  --[prefix]-bg:             #000000;
  --[prefix]-surface:        rgba(255, 255, 255, 0.03);
  --[prefix]-surface-raised: rgba(255, 255, 255, 0.055);
  --[prefix]-border:         rgba(255, 255, 255, 0.06);
  --[prefix]-border-raised:  rgba(255, 255, 255, 0.08);
  --[prefix]-primary:        #f43f5e;
  --[prefix]-primary-alt:    #ec4899;
  --[prefix]-primary-soft:   rgba(244, 63, 94, 0.12);
  --[prefix]-primary-softer: rgba(244, 63, 94, 0.06);
  --[prefix]-primary-glow:   rgba(244, 63, 94, 0.30);
  --[prefix]-text-main:      #fafafa;
  --[prefix]-text-secondary: #b4b4b8;
  --[prefix]-text-muted:     #6b7280;
  --[prefix]-shadow-sm:      0 1px 4px rgba(0, 0, 0, 0.50);
  --[prefix]-shadow-md:      0 4px 16px rgba(0, 0, 0, 0.60);
  --[prefix]-shadow-rose:    0 0 0 1px var(--[prefix]-primary),
                             0 4px 24px var(--[prefix]-primary-glow);
}
```

---

### Canvas & Surfaces

| Context | Dark | Light |
|---------|------|-------|
| Page background | `#000000` | `#f8f8f8` |
| Header/toolbar | `#080808` | `#ffffff` |
| Card / list item (rest) | `rgba(255,255,255,0.03)` | `#ffffff` |
| Card / list item (hover) | `rgba(255,255,255,0.055)` | `rgba(0,0,0,0.03)` |
| Card / list item (active/selected) | `rgba(244,63,94,0.06)` | `rgba(244,63,94,0.04)` |
| Default border | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.08)` |
| Raised border | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.12)` |

**Never use opaque dark hex values** (`#18181B`, `#27272A`, `#1C1C1E`) in dark mode — all surfaces must be translucent rgba on the true black canvas.

---

### Rose Accent System — Budget Rule

**Maximum 4 rose-colored elements visible on screen at one time.** Prioritize:
1. Active / selected left border (`border-left: 2px solid var(--[prefix]-primary)`)
2. Focus glow ring on interactive input
3. Primary CTA button (send / compose / save)
4. AI badge or special-state indicator

Everything else — badges, timestamps, inactive icons — must use **neutral** `#9ca3af` or `--[prefix]-text-muted`.

**Always-on left border rule:** List items that can be active must have a `2px solid transparent` left border at rest. On hover: `rgba(244,63,94,0.25)`. On active/selected: `#f43f5e`. This provides spatial continuity without using the rose budget at rest.

```css
.list-item {
  border-left: 2px solid transparent;
  transition: border-color 150ms cubic-bezier(0.16, 1, 0.3, 1);
}
.list-item:hover {
  border-left-color: rgba(244, 63, 94, 0.25);
}
.list-item.active {
  border-left-color: #f43f5e;
  background: var(--[prefix]-primary-softer);
}
```

---

### Typography Hierarchy

| Role | Size | Weight | Color | Letter-spacing |
|------|------|--------|-------|----------------|
| Section title / hero h1 | 28px | 700 | `--[prefix]-text-main` | −0.02em |
| Panel / column header | 16px | 600 | `--[prefix]-text-main` | −0.02em |
| Item / card title | 15px | 600 | `--[prefix]-text-main` | −0.01em |
| Sender name (own messages) | 14px | 600 | `#f43f5e` | −0.01em |
| Sender name (others) | 14px | 600 | `--[prefix]-text-main` | −0.01em |
| Body text / message text | 15px | 400 | `--[prefix]-text-main` | 0 |
| Preview / snippet text | 13px | 400 | `--[prefix]-text-muted` | 0 |
| Metadata / timestamps | 11px | 400 | `--[prefix]-text-muted` | 0 |
| Section labels / dividers | 11px | 600 | `--[prefix]-text-muted` | 0.12em, uppercase |
| Badges / counts | 10px | 700 | white on `#f43f5e` | 0 |
| Input placeholder | 16px | 400 | `#606066` | −0.01em |
| Input text | 16px | 400 | `#fafafa` | −0.01em |

Font family for all body text: `'Inter', system-ui, -apple-system, sans-serif`
Font family for code / shortcuts: `'JetBrains Mono', 'Courier New', monospace`

---

### Easing & Timing

| Use | Value |
|-----|-------|
| Enter / appear | `cubic-bezier(0.16, 1, 0.3, 1)` — spring decelerate |
| State transitions (hover, toggle) | `cubic-bezier(0.4, 0, 0.2, 1)` — standard material |
| Hover response | `150ms` |
| Card / item entry duration | `220ms` |
| Focus heartbeat | `500ms`, single-fire, `cubic-bezier(0.16, 1, 0.3, 1)` |
| Exit / close | `150ms`, `cubic-bezier(0.4, 0, 1, 1)` |

---

### Focus Heartbeat — Compositor-Safe Pattern

Use this pattern for **any interactive container** that receives keyboard focus (search bars, message inputs, compose windows, etc.).

```css
/* Static box-shadow on ::after — never animate box-shadow itself */
.my-input-container {
  position: relative;
}
.my-input-container::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: calc(border-radius-of-container + 4px);
  box-shadow:
    0 0 0 3px rgba(244, 63, 94, 0.12),
    0 0 24px rgba(244, 63, 94, 0.20);
  opacity: 0;
  pointer-events: none;
  will-change: opacity;          /* Only opacity changes — GPU composited */
  transition: opacity 0.2s ease;
}

/* Steady glow while focused */
.my-input-container:focus-within::after {
  opacity: 0.4;
}

/* Single-fire heartbeat — JS adds/removes this class on first focus */
.my-input-container.heartbeat-active::after {
  animation: [prefix]Heartbeat 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes [prefix]Heartbeat {
  0%   { opacity: 0;   }
  35%  { opacity: 1;   }
  100% { opacity: 0.4; }
}
```

**JS trigger (add to existing onFocus handler — do NOT create new handlers):**
```ts
// In the existing onFocus callback, after existing logic:
containerRef.current?.classList.add('heartbeat-active');
containerRef.current?.addEventListener('animationend', () => {
  containerRef.current?.classList.remove('heartbeat-active');
}, { once: true });
```

---

### List Item Stagger Animation

Apply to the first 5 items in any scrollable list (thread list, email list, card feed, etc.):

```css
@keyframes [prefix]Enter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.list-container .list-item {
  animation: [prefix]Enter 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* 40ms stagger — first 5 items only */
.list-container .list-item:nth-child(1) { animation-delay:   0ms; }
.list-container .list-item:nth-child(2) { animation-delay:  40ms; }
.list-container .list-item:nth-child(3) { animation-delay:  80ms; }
.list-container .list-item:nth-child(4) { animation-delay: 120ms; }
.list-container .list-item:nth-child(5) { animation-delay: 160ms; }

/* Items beyond 5: no animation overhead */
.list-container .list-item:nth-child(n+6) {
  animation: none;
  will-change: auto;
}
```

---

### Glass Dropdown / Popover

Apply to modals, command palettes, tool menus, autocomplete dropdowns:

```css
.my-dropdown {
  background: rgba(255, 255, 255, 0.97);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
          backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(244, 63, 94, 0.18);
  border-radius: 16px;
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(244, 63, 94, 0.04) inset;
}

.dark .my-dropdown {
  background: rgba(10, 10, 10, 0.95);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
          backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.70),
    0 0 0 1px rgba(244, 63, 94, 0.08) inset;
}

/* Dropdown header */
.my-dropdown-header {
  background: linear-gradient(135deg,
    rgba(244, 63, 94, 0.08) 0%,
    rgba(236, 72, 153, 0.08) 100%);
  border-bottom: 1px solid rgba(244, 63, 94, 0.15);
}
.dark .my-dropdown-header {
  background: rgba(244, 63, 94, 0.05);
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

/* Selected item in dropdown */
.my-dropdown-item.selected {
  background: linear-gradient(90deg,
    rgba(244, 63, 94, 0.12) 0%,
    rgba(244, 63, 94, 0.06) 100%);
  border-color: rgba(244, 63, 94, 0.3);
  border-left-color: #f43f5e;
}
```

---

### Scrollbar — Unified Style

```css
.scrollable-area {
  scrollbar-width: thin;
  scrollbar-color: rgba(244, 63, 94, 0.15) transparent;
}
.scrollable-area::-webkit-scrollbar       { width: 6px; }
.scrollable-area::-webkit-scrollbar-track { background: transparent; }
.scrollable-area::-webkit-scrollbar-thumb {
  background: rgba(244, 63, 94, 0.15);
  border-radius: 3px;
}
.scrollable-area::-webkit-scrollbar-thumb:hover {
  background: rgba(244, 63, 94, 0.35);
}
```

---

### Primary CTA Button

```css
.cta-button {
  background: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%);
  border: none;
  color: white;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(244, 63, 94, 0.35);
  transition: all 150ms cubic-bezier(0.16, 1, 0.3, 1);
}
.cta-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(244, 63, 94, 0.45);
}
.cta-button:active  { transform: scale(0.95); }
.cta-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
```

### Secondary / Ghost Button

```css
.ghost-button {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #9ca3af;
  border-radius: 8px;
  transition: all 150ms cubic-bezier(0.16, 1, 0.3, 1);
}
.ghost-button:hover {
  background: rgba(244, 63, 94, 0.08);
  border-color: rgba(244, 63, 94, 0.3);
  color: #f43f5e;
}
```

---

### Unread / Count Badges

```css
.unread-badge {
  background: #f43f5e;
  color: white;
  font-size: 10px;
  font-weight: 700;
  border-radius: 10px;
  padding: 2px 6px;
  min-width: 18px;
  text-align: center;
}
```

---

### Date / Section Dividers

```css
.date-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #6b7280;
}
.date-divider::before,
.date-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.06);  /* dark */
}
.date-divider::before,
.date-divider::after {
  background: rgba(0, 0, 0, 0.08);         /* light */
}
```

---

### AI / Special State

AI-specific accents use **purple** `#8B5CF6` — not rose. This is reserved for the AI toggle button and AI-generated content labels. Do not replace purple with rose in AI contexts.

```css
/* AI state indicator */
.ai-active-indicator {
  color: #8B5CF6;
  border-color: rgba(139, 92, 246, 0.4);
  background: rgba(139, 92, 246, 0.1);
}
```

---

### Accessibility

```css
/* Rose focus ring — replaces browser default */
*:focus-visible {
  outline: 2px solid #f43f5e;
  outline-offset: 2px;
  border-radius: 4px;
}
*:focus:not(:focus-visible) { outline: none; }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Implementation Steps

Follow these steps for every section:

1. **Read** the section's CSS file(s) and 1–2 TSX files (read-only) to map existing class names
2. **Add** the `--[prefix]-*` token block at the top of the primary CSS file
3. **Add** the `[prefix]Heartbeat` and `[prefix]Enter` keyframes
4. **Update** all container backgrounds: remove opaque dark hex → translucent rgba tokens
5. **Replace** any blue (`#3b82f6`, `#60a5fa`, `#eff6ff`) or non-rose active states with the rose token system
6. **Apply** the `::after` heartbeat glow to the section's primary interactive input
7. **Apply** nth-child stagger to list items (first 5, 40ms apart)
8. **Verify** rose budget: count visible rose elements — must be ≤ 4
9. **Update** all scrollbar styles to rose thumb pattern
10. **Update** all dark-mode selectors from hardcoded hex to token variables
11. **Update** typography per hierarchy table
12. **Test** both dark and light mode mentally — check no hard-coded colors remain

---

## What NOT to Change

- **No `.tsx` edits** — zero changes to component logic, hooks, props, or state
- **No purple `#8B5CF6`** replacement in AI contexts — AI keeps purple
- **No structural changes** — don't add or remove DOM structure via CSS (no `display: none` on functional elements)
- **No new CSS classes** — only update existing selectors. If a new class is truly needed for a keyframe target, prefix it with `[prefix]-`

---

## Verification Checklist

After implementing, mentally verify:

- [ ] Dark mode: true black `#000000` canvas (not dark gray)
- [ ] Surfaces: translucent rgba, not opaque hex
- [ ] Rose budget: ≤ 4 rose elements visible simultaneously
- [ ] Active/selected items: rose left border `2px solid #f43f5e`
- [ ] Focus: heartbeat animation fires once, settles to steady glow
- [ ] List entry: stagger animation visible on first 5 items
- [ ] Typography: correct sizes per hierarchy table
- [ ] Timestamps and metadata: 11px, `#6b7280`
- [ ] Scrollbars: rose thumb with correct hover brightening
- [ ] Dropdowns/popovers: dark glass treatment
- [ ] AI toggle (if present): remains purple, not rose
- [ ] Light mode: warm stone backgrounds, not black
- [ ] No inline styles added to TSX
- [ ] `-webkit-backdrop-filter` prefix present alongside `backdrop-filter`
