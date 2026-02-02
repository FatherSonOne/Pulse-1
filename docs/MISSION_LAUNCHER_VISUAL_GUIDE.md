# Mission Launcher - Visual Design Guide

## Component Preview

```
┌──────────────────────────────────────────────────────────────────┐
│                       WAR ROOM HUB HEADER                        │
│                                                                  │
│  SELECT                     ┌──────────────┐  ┌──────────────┐  │
│  MODE                       │ 🚀 Missions  │  │ 🔍 Search... │  │
│                             └──────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                    ↓ (Click)
                                    ↓
┌──────────────────────────────────────────────────────────────────┐
│                     BACKDROP (75% black, blurred)                │
│                                                                  │
│    ┌────────────────────────────────────────────────────────┐   │
│    │  SELECT                                          ✕     │   │
│    │  MISSION                                               │   │
│    │  Choose a specialized mission mode...                  │   │
│    ├────────────────────────────────────────────────────────┤   │
│    │                                                        │   │
│    │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│    │  │ 🔍       │  │ ⚖️        │  │ ⚡       │            │   │
│    │  │ Research │  │ Decision │  │ Brainstm │            │   │
│    │  │ Mission  │  │ Mission  │  │ Mission  │            │   │
│    │  └──────────┘  └──────────┘  └──────────┘            │   │
│    │                                                        │   │
│    │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│    │  │ 🗺️       │  │ 📊       │  │ ✒️        │            │   │
│    │  │ Planning │  │ Analysis │  │ Creation │            │   │
│    │  │ Mission  │  │ Mission  │  │ Mission  │            │   │
│    │  └──────────┘  └──────────┘  └──────────┘            │   │
│    │                                                        │   │
│    ├────────────────────────────────────────────────────────┤   │
│    │                    ESC to close                        │   │
│    └────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Color Palette

### Mission Colors

#### Research Mission
```
█████ Blue-Teal Gradient
▓▓▓▓▓ #3b82f6 → #14b8a6
      Accent: #14b8a6
      Use: Information gathering, systematic research
```

#### Decision Mission
```
█████ Purple-Indigo Gradient
▓▓▓▓▓ #a855f7 → #6366f1
      Accent: #8b5cf6
      Use: Choice analysis, pros/cons evaluation
```

#### Brainstorm Mission
```
█████ Amber-Orange Gradient
▓▓▓▓▓ #fbbf24 → #f97316
      Accent: #f59e0b
      Use: Creative ideation, divergent thinking
```

#### Planning Mission
```
█████ Emerald-Green Gradient
▓▓▓▓▓ #10b981 → #22c55e
      Accent: #10b981
      Use: Strategic planning, roadmap creation
```

#### Analysis Mission
```
█████ Rose-Red Gradient
▓▓▓▓▓ #fb7185 → #ef4444
      Accent: #f43f5e
      Use: Data examination, pattern recognition
```

#### Creation Mission
```
█████ Indigo-Purple Gradient
▓▓▓▓▓ #6366f1 → #a855f7
      Accent: #818cf8
      Use: Content generation, creative output
```

---

## Typography Hierarchy

```
SELECT                    ← 10px, 700, 0.2em spacing, uppercase
MISSION                   ← 32px, 900, -0.02em spacing, display font

Choose a specialized...   ← 13px, 400, secondary color

Research Mission          ← 18px, 700, -0.01em spacing
Deep research with...     ← 13px, 400, 1.5 line-height

Launch Mission →          ← 13px, 700, accent color

ESC to close              ← 12px, 400, muted color
```

---

## Spacing System

```
Modal Container:
┌─ 2px border ──────────────────────────────┐
│ ┌─ 32px padding ──────────────────────┐  │
│ │ Header                               │  │
│ │ ├─ 4px gap                          │  │
│ │ │  Title Prefix                     │  │
│ │ │  Title Main                       │  │
│ │ └─ 8px gap                          │  │
│ │    Subtitle                          │  │
│ └──────────────────────────────────────┘  │
│                                            │
│ ┌─ 32px padding ──────────────────────┐  │
│ │ Missions Grid                        │  │
│ │ ├─ 20px gap between cards           │  │
│ │ │                                    │  │
│ │ │  Card (24px padding)               │  │
│ │ │  ├─ Icon: 64×64px                 │  │
│ │ │  ├─ 20px gap                      │  │
│ │ │  ├─ Title                         │  │
│ │ │  ├─ 8px gap                       │  │
│ │ │  ├─ Description                   │  │
│ │ │  └─ 20px gap                      │  │
│ │ │     Action label                  │  │
│ │ │                                    │  │
│ └──────────────────────────────────────┘  │
│                                            │
│ ┌─ 16px padding ──────────────────────┐  │
│ │ Footer (Keyboard hint)               │  │
│ └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

---

## Component States

### Mission Card States

#### Default State
```
┌────────────────────────┐
│ 🔍                    │  Border: 2px #e4e4e7
│ 64×64px icon          │  Background: #fafafa
│                        │  Transform: translateY(0)
│ Research Mission       │  Shadow: none
│ Deep research with...  │
│                        │
│ Launch Mission →       │
└────────────────────────┘
```

#### Hover State
```
┌────────────────────────┐  ← 3px gradient top border appears
│ 🔍                    │  Border: 2px #14b8a6 (accent)
│ 64×64px icon          │  Background: #fafafa
│ (scaled 1.05×)        │  Transform: translateY(-6px)
│ (rotated -5°)         │  Shadow: 0 16px 48px + glow
│                        │  Glow effect: radial gradient
│ Research Mission       │
│ Deep research with...  │
│                        │
│ Launch Mission    →    │  ← Arrow moves 4px right
└────────────────────────┘
```

#### Focus State
```
┌────────────────────────┐
│ 🔍                    │
│ 64×64px icon          │  Outline: 2px solid accent
│                        │  Outline offset: 4px
│ Research Mission       │  (Visible keyboard focus)
│ Deep research with...  │
│                        │
│ Launch Mission →       │
└────────────────────────┘
  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  ← Focus outline
```

---

## Animation Timeline

```
Modal Open Sequence:
─────────────────────────────────────────────────────────────

0ms    Backdrop renders
       opacity: 0 → 1 (300ms fade)

0ms    Container renders
       opacity: 0 → 1
       scale: 0.9 → 1.0
       translateY: 20px → 0
       (400ms spring easing)

50ms   Card 1 enters
       opacity: 0 → 1, translateY: 20px → 0 (500ms)

100ms  Card 2 enters (same animation)

150ms  Card 3 enters

200ms  Card 4 enters

250ms  Card 5 enters

300ms  Card 6 enters

750ms  All animations complete
       (300ms total stagger + 500ms animation - 50ms first delay)


Interaction Animations:
─────────────────────────────────────────────────────────────

Card Hover:
  0ms     Mouse enter
  350ms   All transitions complete (border, transform, shadow, glow)

Icon Scale/Rotate:
  0ms     Hover start
  300ms   Transform complete (scale 1.05, rotate -5deg)

Arrow Slide:
  0ms     Hover start
  250ms   TranslateX(4px) complete

Close Button:
  0ms     Hover start
  250ms   Rotate(90deg) complete
```

---

## Responsive Layouts

### Desktop (>1024px)
```
┌─────────────────────────────────────────────────────────┐
│  SELECT                          🚀 Missions  🔍 Search │
│  MISSION                                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                │
│  │Research │  │Decision │  │Brainstm │                │
│  └─────────┘  └─────────┘  └─────────┘                │
│                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                │
│  │Planning │  │Analysis │  │Creation │                │
│  └─────────┘  └─────────┘  └─────────┘                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Tablet (768px - 1024px)
```
┌─────────────────────────────────────────┐
│  SELECT                  🚀 M  🔍 Search │
│  MISSION                                │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │  Research   │  │  Decision   │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ Brainstorm  │  │  Planning   │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │  Analysis   │  │  Creation   │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
└─────────────────────────────────────────┘
```

### Mobile (<768px)
```
┌──────────────────────────┐
│  SELECT                  │
│  MISSION                 │
├──────────────────────────┤
│  ┌────────────────────┐  │
│  │  🚀 Missions       │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │  🔍 Search...      │  │
│  └────────────────────┘  │
├──────────────────────────┤
│  ┌────────────────────┐  │
│  │  🔍 Research       │  │
│  │  Mission           │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │  ⚖️ Decision        │  │
│  │  Mission           │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │  ⚡ Brainstorm     │  │
│  │  Mission           │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │  🗺️ Planning       │  │
│  │  Mission           │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │  📊 Analysis       │  │
│  │  Mission           │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │  ✒️ Creation        │  │
│  │  Mission           │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

---

## Visual Effects

### Glass-Morphism
```css
backdrop-filter: blur(24px)
background: rgba(255, 255, 255, 0.98)  [light]
background: rgba(10, 14, 20, 0.98)      [dark]
border: 2px solid semi-transparent
box-shadow: multi-layered depth
```

### Glow Effect (on hover)
```
Card center emits radial gradient:
  rgba(accent-color, 0.12) → transparent

Visible as subtle halo around card
Opacity: 0 → 1 on hover (400ms)
```

### Dot Matrix Pattern
```
Background overlay:
  1px dots on 24px grid
  30% opacity (light mode)
  40% opacity (dark mode)
  Color: gray-300 (light) / gray-800 (dark)
```

### Top Border Accent
```
Card hover reveals 3px gradient border:
  Position: top edge
  Background: mission gradient
  Opacity: 0 → 1 (300ms)
```

### Corner Glyph
```
16×16px angular bracket:
  Position: top-right of icon
  Border: 2px solid accent
  Style: L-shape (top-right corner)
  Opacity: 0 → 0.6 on hover
```

---

## Accessibility Features

### Keyboard Navigation
```
Tab Order:
1. Close Button (×)
2. Mission Card 1 (Research)
3. Mission Card 2 (Decision)
4. Mission Card 3 (Brainstorm)
5. Mission Card 4 (Planning)
6. Mission Card 5 (Analysis)
7. Mission Card 6 (Creation)

ESC Key → Close modal
Enter/Space → Activate focused card
```

### Focus Indicators
```
All interactive elements:
  outline: 2px solid accent-color
  outline-offset: 2px or 4px
  Highly visible contrast
```

### Screen Reader Support
```html
<button aria-label="Close mission launcher">×</button>

Mission cards have semantic text:
  "Research Mission - Deep research with systematic..."
```

### Motion Preferences
```css
@media (prefers-reduced-motion: reduce) {
  /* All animations can be disabled */
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Design Specifications Summary

| Element | Size | Color | Font | Spacing |
|---------|------|-------|------|---------|
| Modal Container | Max 1000px | var(--wrh-bg) | DM Sans | 32-40px padding |
| Header Title | 32px | var(--wrh-text) | Archivo Black | -0.02em |
| Mission Card | Min 280px | var(--wrh-bg-secondary) | DM Sans | 24px padding |
| Card Icon | 64×64px | White on gradient | Font Awesome | 20px bottom |
| Card Title | 18px | var(--wrh-text) | DM Sans Bold | -0.01em |
| Description | 13px | var(--wrh-text-secondary) | DM Sans | 1.5 line-height |
| Close Button | 40×40px | Transparent | Font Awesome | Absolute positioned |
| Grid Gap | 20px | N/A | N/A | Between cards |

---

## Implementation Checklist

### Design Deliverables ✓
- [✓] Component structure (MissionLauncher.tsx)
- [✓] Complete styling (MissionLauncher.css)
- [✓] Integration code (WarRoomHub.tsx updates)
- [✓] Button styling (WarRoomHub.css additions)
- [✓] Responsive breakpoints (mobile, tablet, desktop)
- [✓] Dark mode support
- [✓] Animation specifications
- [✓] Accessibility features

### Visual Consistency ✓
- [✓] Matches War Room Hub aesthetic
- [✓] Uses existing CSS variables
- [✓] Consistent border radius values
- [✓] Aligned spacing system
- [✓] Matching typography scale

### Interaction Design ✓
- [✓] Smooth entry animations
- [✓] Hover state feedback
- [✓] Click interactions
- [✓] Keyboard support
- [✓] Focus management
- [✓] Modal close handlers

### Performance ✓
- [✓] GPU-accelerated animations
- [✓] Efficient render cycle
- [✓] No layout thrashing
- [✓] Minimal bundle impact
- [✓] Optimized CSS selectors

---

**Visual Guide Version**: 1.0
**Design System**: War Room Hub Tactical
**Component**: Mission Launcher Modal
**Status**: Production Ready
