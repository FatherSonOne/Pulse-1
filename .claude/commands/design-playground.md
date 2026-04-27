# Design Playground — Interactive Section Redesign

Combines the `<creative-pipeline>` and `<playground>` workflows to redesign any section, page, or component. Asks clarifying questions first, then generates a self-contained HTML playground with live preview, controls panel, and a prompt generator for fine-tuning and change tracking.

---

## Step 1 — Gather Context

Before generating anything, ask the user these clarifying questions. Wait for all answers before proceeding.

```
Ask as a numbered list. Wait for the user to respond before generating the playground.

1. **Target** — What section/page/component are you redesigning? (e.g. hero, pricing section, nav, card component, onboarding screen)

2. **Reference files** — Is there a brand file, existing component, or concept file I should pull palette/style from? (e.g. `pulse-concept-showcase.html`, a Figma screenshot, or the current component path)

3. **Layout direction** — Any strong layout preferences? (e.g. centered / asymmetric left-text-right-graphic / full-bleed / split-screen / stacked mobile-first)

4. **Visual tone** — How should it feel? (e.g. dark + cinematic / clean + minimal / bold + expressive / glassmorphism / editorial)

5. **Animation level** — None / Subtle (micro-interactions only) / Moderate (entrance animations) / Heavy (canvas/particle systems, continuous motion)

6. **Primary focal element** — What is the hero/anchor visual? (e.g. canvas graphic, product screenshot, 3D object, illustration, typography-only)

7. **CTA / interaction** — How many CTAs? What style? (e.g. single coral gradient button / ghost + filled pair / text link only)

8. **Hard constraints** — Anything that must NOT change? (e.g. specific headline copy, brand colors, existing button behavior)
```

---

## Step 2 — Read Source Files

After receiving answers, silently read:
- The target component file (from the repo)
- Any referenced brand/concept files
- `LandingPage.css` (or equivalent styles) for existing design tokens

Do not ask further questions. Proceed directly to Step 3.

---

## Step 3 — Generate the HTML Playground

Create a self-contained HTML file at `f:/pulse1/output/[section-name]-playground.html`.

### Playground structure

```
+-------------------------+------------------------------------------+
|                         |                                          |
|  Controls Panel         |  Live Preview                            |
|  (left ~280px)          |  (fills remaining width)                 |
|                         |  Renders the actual section/component    |
|  Grouped by:            |  in context (mock page frame or          |
|  • Background / Theme   |   isolated full-width preview)           |
|  • Layout               |                                          |
|  • Typography           |                                          |
|  • Visual / Graphic     |                                          |
|  • Animation            |                                          |
|  • CTA / Interaction    +------------------------------------------+
|                         |  Prompt Output                           |
|  [ Reset Defaults ]     |  Auto-generated developer brief          |
|                         |  [ Copy Prompt ]                         |
+-------------------------+------------------------------------------+
```

### Controls to include (adapt based on section type)

| Control | Type | What it drives |
|---|---|---|
| Background | 4-option button group | bg color / gradient variants |
| Layout Mode | button group or dropdown | layout structure options |
| Graphic Mode | dropdown | visual focal element variants |
| Glow / Shadow Intensity | slider 0–100 | radial glow, box-shadow depth |
| Animation Speed | slider 0–100 | canvas/CSS animation timing |
| Particle / Element Density | slider 0–100 | particle count, grid density |
| Typography Scale | dropdown | compact / balanced / massive |
| CTA Style | button group | filled / ghost / gradient / text |
| Tagline | dropdown | 4 copy alternatives + hidden |
| Grid Overlay | toggle | show/hide background grid |
| Light Mode | toggle | switch between dark/light preview |

Add or remove controls based on what the section needs. Always include at minimum: Background, Glow Intensity, Animation Speed, Typography Scale, CTA Style, Light Mode toggle.

### Canvas / animation (when animation level is Moderate or Heavy)

Use HTML5 Canvas with `requestAnimationFrame`. Implement at least 2 graphic modes (e.g. Signal waves, Orbital rings, Neural mesh, Radial burst). Bake chosen settings as named constants at the top of the canvas class for clarity.

### Prompt output format

The prompt output bar must auto-regenerate on every control change. Format:

```
[Section Name] Direction: [Layout type] — [bg color/style], [graphic description] dominating [position],
glow at [N]%, speed [N]%, [particle/element density descriptor]. [Font family] [weight] headline,
[scale descriptor] — [headline copy note]. CTA: [style]. Tagline: "[first 40 chars…]".
Grid: [on/off]. Mode: [dark/light].
```

Include a **Copy Prompt** button. Include a **Reset Defaults** button that restores the initial recommended settings.

### Security rules for the HTML file

- Never use `innerHTML` with dynamic/user-controlled content
- Use `document.createTextNode()` for text insertion
- Use `el.textContent = value` for label/value updates
- Use `el.style.property = value` for live style updates
- DOM structure must be built with `createElement` + `appendChild`

---

## Step 4 — After the Playground is Shared

Tell the user:
> "Open `output/[section-name]-playground.html` in your browser. Tweak the controls until you're happy with the direction, then copy the prompt from the bottom bar and paste it here. I'll implement it into the source files."

When the user pastes back a finalized prompt:
1. Parse the direction settings from the prompt
2. Implement into the actual source files (CSS + TSX/component)
3. Run `npx vite build` to verify (or equivalent build command)
4. Report back with what changed and confirm no new errors

---

## Example invocations

```
/design-playground redesign the pricing section
/design-playground rebuild the onboarding flow cards
/design-playground refresh the nav header — keeping the logo
/design-playground create a new features grid section
```
