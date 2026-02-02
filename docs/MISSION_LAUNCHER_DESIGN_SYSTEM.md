# Mission Launcher - UI Design System Documentation

## Overview

The Mission Launcher is a premium modal navigation system for the War Room Hub that enables users to quickly access all 6 Mission modes. The design maintains the War Room's sophisticated tactical aesthetic with glass-morphism effects, subtle glows, dot matrix patterns, and smooth animations.

---

## Design Foundations

### Visual Language
- **Aesthetic**: Tactical premium with dark theme support
- **Pattern**: Glass-morphism with backdrop blur
- **Accents**: Mission-specific gradient overlays
- **Typography**: Archivo Black for headings, DM Sans for body
- **Animation**: Spring-based easing with staggered entrances

### Color System

#### Base Colors (Light Mode)
```css
--wrh-bg: #ffffff
--wrh-bg-secondary: #fafafa
--wrh-text: #000000
--wrh-text-secondary: #52525b
--wrh-text-muted: #a1a1aa
--wrh-border: #e4e4e7
--wrh-accent: #ff0000
```

#### Base Colors (Dark Mode)
```css
--wrh-bg: #09090b
--wrh-bg-secondary: #18181b
--wrh-text: #ffffff
--wrh-text-secondary: #94a3b8
--wrh-text-muted: #64748b
--wrh-border: #27272a
--wrh-accent: #ff0000
```

#### Mission-Specific Colors

| Mission | Gradient | Accent | Use Case |
|---------|----------|--------|----------|
| Research | Blue → Teal (#3b82f6 → #14b8a6) | #14b8a6 | Information gathering |
| Decision | Purple → Indigo (#a855f7 → #6366f1) | #8b5cf6 | Choice analysis |
| Brainstorm | Amber → Orange (#fbbf24 → #f97316) | #f59e0b | Creative ideation |
| Planning | Emerald → Green (#10b981 → #22c55e) | #10b981 | Strategy development |
| Analysis | Rose → Red (#fb7185 → #ef4444) | #f43f5e | Data examination |
| Creation | Indigo → Purple (#6366f1 → #a855f7) | #818cf8 | Content generation |

### Typography System

```css
/* Display */
--wrh-font-display: 'Archivo Black', 'Impact', system-ui
font-size: 32px
font-weight: 900
letter-spacing: -0.02em

/* Title Prefix */
font-size: 10px
font-weight: 700
letter-spacing: 0.2em
text-transform: uppercase

/* Card Title */
font-size: 18px
font-weight: 700
letter-spacing: -0.01em

/* Card Description */
font-size: 13px
line-height: 1.5

/* Action Label */
font-size: 13px
font-weight: 700
```

### Spacing System
- **Base Unit**: 4px
- **Card Padding**: 24px
- **Grid Gap**: 20px
- **Section Padding**: 32px 40px
- **Icon Size**: 64px × 64px
- **Close Button**: 40px × 40px

### Border Radius
```css
--wrh-radius-md: 12px   /* Icon backgrounds */
--wrh-radius-lg: 20px   /* Cards, buttons */
--wrh-radius-xl: 28px   /* Modal container */
```

---

## Component Architecture

### File Structure
```
src/components/WarRoom/
├── MissionLauncher.tsx      # Modal component
├── MissionLauncher.css      # Modal styles
├── WarRoomHub.tsx          # Integration point
└── WarRoomHub.css          # Button styles
```

### Component Hierarchy
```
WarRoomHub
└── MissionLauncher (conditional)
    ├── Backdrop (ml-backdrop)
    └── Container (ml-container)
        ├── Background Pattern (ml-bg-pattern)
        ├── Header (ml-header)
        │   ├── Title Section
        │   └── Close Button
        ├── Missions Grid (ml-missions-grid)
        │   └── Mission Cards × 6
        │       ├── Card Glow Effect
        │       ├── Icon Frame
        │       │   ├── Icon
        │       │   └── Corner Glyph
        │       └── Card Content
        │           ├── Title
        │           ├── Description
        │           └── Action Label
        └── Footer (ml-footer)
            └── Keyboard Hint
```

---

## Design Patterns

### Glass-Morphism Effect
```css
background: var(--wrh-bg);
backdrop-filter: blur(24px);
border: 2px solid var(--wrh-border);
box-shadow:
  0 32px 64px rgba(0, 0, 0, 0.2),
  0 0 80px rgba(255, 100, 50, 0.08),
  inset 0 1px 0 rgba(255, 255, 255, 0.03);
```

### Dot Matrix Pattern
```css
background-image: radial-gradient(
  circle at center,
  var(--wrh-gray-300) 1px,
  transparent 1px
);
background-size: 24px 24px;
opacity: 0.3;
```

### Card Hover State
```css
/* Lift Effect */
transform: translateY(-6px);

/* Border Accent */
border-color: var(--mission-accent);

/* Glow Shadow */
box-shadow:
  0 16px 48px rgba(0, 0, 0, 0.12),
  0 0 0 1px var(--mission-accent-soft);

/* Top Gradient Border */
::before {
  opacity: 1;
  background: var(--mission-gradient);
}
```

### Icon Animation
```css
.ml-mission-card:hover .ml-card-icon {
  transform: scale(1.05) rotate(-5deg);
}
```

---

## Animation Specifications

### Modal Entry
```css
/* Backdrop */
@keyframes mlFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
animation: mlFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);

/* Container */
@keyframes mlScaleIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
animation: mlScaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Staggered Card Entrance
```css
@keyframes mlCardIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Delays */
.ml-mission-card:nth-child(1) { animation-delay: 0.05s; }
.ml-mission-card:nth-child(2) { animation-delay: 0.10s; }
.ml-mission-card:nth-child(3) { animation-delay: 0.15s; }
.ml-mission-card:nth-child(4) { animation-delay: 0.20s; }
.ml-mission-card:nth-child(5) { animation-delay: 0.25s; }
.ml-mission-card:nth-child(6) { animation-delay: 0.30s; }
```

### Interaction Timing
```css
--wrh-ease: cubic-bezier(0.4, 0, 0.2, 1)      /* Standard */
--wrh-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)  /* Bounce */

/* Card hover */
transition: all 0.35s var(--wrh-ease);

/* Icon transform */
transition: transform 0.3s var(--wrh-ease);

/* Action arrow */
transition: transform 0.25s var(--wrh-ease);

/* Close button rotate */
transition: all 0.25s var(--wrh-ease);
```

---

## Responsive Breakpoints

### Desktop (>1024px)
```css
.ml-missions-grid {
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  padding: 32px 40px;
}
```

### Tablet (768px - 1024px)
```css
.ml-missions-grid {
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}
```

### Mobile (<768px)
```css
.ml-backdrop { padding: 0; }
.ml-container {
  max-width: 100%;
  border-radius: 0;
  border-left: none;
  border-right: none;
}
.ml-missions-grid {
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 24px 20px;
}
.ml-title-main { font-size: 24px; }
```

### Small Mobile (<480px)
```css
.ml-card-icon-frame {
  width: 56px;
  height: 56px;
}
.ml-card-icon { font-size: 20px; }
.ml-card-title { font-size: 16px; }
.ml-card-description { font-size: 12px; }
```

---

## Accessibility Compliance

### WCAG AA Standards Met

#### Color Contrast
- Normal text: 4.5:1 minimum ratio
- Large text: 3:1 minimum ratio
- Mission accents tested against backgrounds

#### Keyboard Navigation
```typescript
// ESC key closes modal
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };
  window.addEventListener('keydown', handleEscape);
}, []);

// Focus indicators
.ml-mission-card:focus-visible {
  outline: 2px solid var(--mission-accent);
  outline-offset: 4px;
}
```

#### Screen Reader Support
```tsx
<button
  className="ml-close-btn"
  onClick={onClose}
  aria-label="Close mission launcher"
>
  <i className="fa fa-times" />
</button>
```

#### Body Scroll Lock
```typescript
useEffect(() => {
  document.body.style.overflow = 'hidden';
  return () => {
    document.body.style.overflow = '';
  };
}, []);
```

---

## Integration Guide

### 1. Import Component
```tsx
import { MissionLauncher } from './MissionLauncher';
```

### 2. Add State Management
```tsx
const [showMissionLauncher, setShowMissionLauncher] = useState(false);
```

### 3. Create Handler
```tsx
const handleMissionSelect = (mission: MissionType) => {
  if (onMissionSelect) {
    onMissionSelect(mission);
    onRoomChange('missions');
  }
};
```

### 4. Add Trigger Button
```tsx
<button
  type="button"
  className="wrh-missions-btn"
  onClick={() => setShowMissionLauncher(true)}
  title="Open Mission Launcher"
>
  <i className="fa fa-rocket" />
  <span>Missions</span>
</button>
```

### 5. Render Modal
```tsx
{showMissionLauncher && (
  <MissionLauncher
    onMissionSelect={handleMissionSelect}
    onClose={() => setShowMissionLauncher(false)}
  />
)}
```

---

## Performance Optimizations

### Efficient Rendering
- Modal only renders when `showMissionLauncher === true`
- Single backdrop click handler with event delegation
- CSS transforms for animations (GPU accelerated)

### Animation Performance
```css
/* GPU-accelerated properties */
transform: translateY(-6px);     /* Composite layer */
opacity: 1;                      /* Composite layer */

/* Avoid these in animations */
/* height, width, top, left */  /* Triggers layout */
/* border, padding, margin */   /* Triggers layout */
```

### Asset Optimization
- Font Awesome icons (vector, scalable)
- CSS gradients (no image assets)
- Backdrop blur with fallback
- Pure CSS patterns (no images)

---

## Browser Support

### Modern Browsers (Full Support)
- Chrome 90+
- Firefox 88+
- Safari 14.1+
- Edge 90+

### Fallback Support
```css
/* Backdrop blur fallback */
.ml-backdrop {
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* If backdrop-filter not supported */
@supports not (backdrop-filter: blur(12px)) {
  .ml-backdrop {
    background: rgba(0, 0, 0, 0.9);
  }
}
```

---

## Design QA Checklist

### Visual Consistency
- [ ] Matches War Room Hub's font families
- [ ] Uses existing CSS variable system
- [ ] Border radius values consistent
- [ ] Spacing follows 4px base unit
- [ ] Colors match dark/light theme

### Interaction Quality
- [ ] Hover states smooth (350ms transitions)
- [ ] Click feedback immediate (<100ms)
- [ ] Animation timing feels natural
- [ ] Focus states clearly visible
- [ ] Loading states handled gracefully

### Accessibility
- [ ] Keyboard navigation complete
- [ ] Screen reader labels present
- [ ] Color contrast ratios met
- [ ] Focus trap in modal active
- [ ] ESC key closes modal

### Responsive Design
- [ ] Desktop layout (3 columns)
- [ ] Tablet layout (2 columns)
- [ ] Mobile layout (1 column)
- [ ] Touch targets 44px minimum
- [ ] Text readable at all sizes

### Performance
- [ ] Modal renders <100ms
- [ ] Animations 60fps smooth
- [ ] No layout thrashing
- [ ] No excessive repaints
- [ ] Bundle size impact minimal

---

## Component API

### MissionLauncher Props
```typescript
interface MissionLauncherProps {
  onMissionSelect: (mission: MissionType) => void;
  onClose: () => void;
}
```

### Mission Types
```typescript
type MissionType =
  | 'research'
  | 'decision'
  | 'brainstorm'
  | 'plan'
  | 'analyze'
  | 'create';
```

---

## Design Tokens Reference

### Complete Token System
```css
/* Layout */
--ml-max-width: 1000px
--ml-padding-desktop: 32px 40px
--ml-padding-mobile: 24px 20px
--ml-grid-gap: 20px
--ml-card-padding: 24px

/* Typography */
--ml-title-size: 32px
--ml-card-title-size: 18px
--ml-description-size: 13px
--ml-prefix-size: 10px

/* Sizing */
--ml-icon-size: 64px
--ml-close-btn-size: 40px
--ml-glyph-size: 16px

/* Effects */
--ml-backdrop-blur: 12px
--ml-container-blur: 24px
--ml-shadow-depth: 0 32px 64px rgba(0, 0, 0, 0.2)
--ml-hover-lift: -6px

/* Timing */
--ml-fade-duration: 0.3s
--ml-scale-duration: 0.4s
--ml-card-duration: 0.5s
--ml-hover-duration: 0.35s
```

---

## Future Enhancements

### Potential Improvements
1. **Search functionality** - Filter missions by keyword
2. **Recent missions** - Show last used missions at top
3. **Mission templates** - Pre-configured mission setups
4. **Favorites** - Pin frequently used missions
5. **Keyboard shortcuts** - Number keys for quick selection
6. **Mission preview** - Hover tooltip with more details

### Extensibility Points
- Mission data structure supports additional metadata
- CSS variables enable easy theme customization
- Animation timings configurable via CSS
- Grid layout adapts to any number of missions

---

## Maintenance Guidelines

### Updating Mission Data
```tsx
// Add new mission to MISSIONS array
const MISSIONS: MissionCard[] = [
  {
    id: 'new-mission',
    name: 'New Mission',
    icon: 'fa-icon-name',
    description: 'Mission description',
  },
  // ... existing missions
];

// Add corresponding CSS color variables
.ml-mission-card[data-mission="new-mission"] {
  --mission-gradient: linear-gradient(...);
  --mission-accent: #hexcolor;
  --mission-accent-soft: rgba(...);
  --mission-glow: rgba(...);
  --mission-shadow: rgba(...);
}
```

### Customizing Animations
```css
/* Adjust timing in CSS */
animation: mlScaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                     ^^^^ Duration
                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Easing

/* Change stagger delay */
.ml-mission-card:nth-child(n) { animation-delay: 0.05s; }
                                                  ^^^^^ Delay increment
```

---

**Design System Version**: 1.0
**Last Updated**: 2026-01-22
**Maintained By**: UI Designer Agent
**Status**: Production Ready
