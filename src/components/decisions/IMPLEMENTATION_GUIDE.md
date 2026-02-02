# Light Mode Implementation Guide

## Quick Reference for Developers

This guide provides practical implementation patterns for maintaining the optimized light mode design system.

---

## Color Usage Guidelines

### When to Use Each Color Level

#### Text Colors
```css
/* Primary content - Maximum contrast */
color: #0f172a;  /* slate-900 - 17.5:1 ratio */

/* Secondary content - Labels, captions */
color: #475569;  /* slate-600 - 7.2:1 ratio */

/* Tertiary content - Disabled, placeholders */
color: #94a3b8;  /* slate-400 - 4.5:1 ratio */
```

#### Background Colors
```css
/* Page background */
background: #f8fafc;  /* slate-50 */

/* Card backgrounds */
background: #ffffff;  /* Pure white */

/* Subtle highlights */
background: #fef2f2;  /* red/rose-50 for errors/urgent */
background: #fffbeb;  /* amber-50 for warnings */
background: #ecfdf5;  /* emerald-50 for success */
```

#### Border Colors
```css
/* Standard borders */
border: 2px solid #cbd5e1;  /* slate-300 */

/* Hover/active states */
border: 2px solid #e11d48;  /* rose-600 */

/* Accent borders (left/top) */
border-left: 4px solid #dc2626;  /* red-600 for critical */
border-left: 4px solid #d97706;  /* amber-600 for important */
```

---

## Component Patterns

### 1. Card Component Template

```css
.card {
  /* Base structure */
  background: #ffffff;
  border: 2px solid #cbd5e1;
  border-radius: 12px;
  padding: 1.125rem;

  /* Depth */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

  /* Interaction */
  transition: all 0.2s ease;
}

.card:hover {
  border-color: #e11d48;
  box-shadow: 0 4px 12px rgba(225, 29, 72, 0.12);
  transform: translateY(-2px);
}

.card:focus-within {
  outline: 3px solid #e11d48;
  outline-offset: 3px;
  box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.2);
}
```

### 2. Button Component Template

#### Primary Button
```css
.btn-primary {
  /* Visual */
  background: linear-gradient(135deg, #e11d48 0%, #db2777 100%);
  border: none;
  border-radius: 8px;
  color: white;

  /* Typography */
  font-size: 0.875rem;
  font-weight: 600;

  /* Spacing */
  padding: 0.625rem 1.125rem;

  /* Effects */
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  box-shadow: 0 8px 16px rgba(225, 29, 72, 0.35);
  transform: translateY(-2px);
}

.btn-primary:focus-visible {
  outline: 3px solid #e11d48;
  outline-offset: 3px;
  box-shadow: 0 0 0 4px rgba(225, 29, 72, 0.25);
}
```

#### Secondary Button
```css
.btn-secondary {
  /* Visual */
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  color: #0f172a;

  /* Typography */
  font-size: 0.875rem;
  font-weight: 500;

  /* Spacing */
  padding: 0.625rem 1rem;

  /* Effects */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: #fef2f2;
  border-color: #e11d48;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
```

### 3. Badge Component Template

#### Status Badges
```css
.badge-urgent {
  background: #fee2e2;  /* red-100 */
  border: 1px solid #fca5a5;  /* red-300 */
  color: #991b1b;  /* red-800 */
  font-weight: 700;
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-important {
  background: #fef3c7;  /* amber-100 */
  border: 1px solid #fcd34d;  /* amber-300 */
  color: #92400e;  /* amber-800 */
  /* Same spacing as urgent */
}

.badge-success {
  background: #d1fae5;  /* emerald-100 */
  border: 1px solid #6ee7b7;  /* emerald-300 */
  color: #065f46;  /* emerald-800 */
  /* Same spacing as urgent */
}
```

### 4. Alert Component Template

```css
.alert-error {
  /* Structure */
  background: #fef2f2;  /* red-50 */
  border: 2px solid #fecaca;  /* red-200 */
  border-left: 4px solid #dc2626;  /* red-600 accent */
  border-radius: 8px;
  padding: 1rem 1.25rem;

  /* Shadow */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.alert-error-title {
  color: #dc2626;  /* red-600 - 5.8:1 contrast */
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.alert-error-message {
  color: #0f172a;  /* slate-900 - 17.5:1 contrast */
  font-size: 0.875rem;
  line-height: 1.5;
}
```

---

## Interactive State Patterns

### Standard Interaction Flow

```css
/* 1. Rest State */
.interactive-element {
  border: 2px solid #cbd5e1;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

/* 2. Hover State */
.interactive-element:hover {
  border-color: #e11d48;
  background: #fef2f2;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

/* 3. Active State */
.interactive-element:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* 4. Focus State */
.interactive-element:focus-visible {
  outline: 3px solid #e11d48;
  outline-offset: 3px;
  box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.2);
}

/* 5. Disabled State */
.interactive-element:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f1f5f9;
  border-color: #cbd5e1;
}
```

---

## Typography Patterns

### Heading Hierarchy

```css
.heading-1 {
  font-size: 2rem;        /* 32px */
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
  margin-bottom: 1rem;
}

.heading-2 {
  font-size: 1.5rem;      /* 24px */
  font-weight: 600;
  color: #0f172a;
  line-height: 1.3;
  margin-bottom: 0.75rem;
}

.heading-3 {
  font-size: 1.125rem;    /* 18px */
  font-weight: 600;
  color: #0f172a;
  line-height: 1.4;
  margin-bottom: 0.5rem;
}

.body-text {
  font-size: 0.875rem;    /* 14px */
  font-weight: 400;
  color: #0f172a;
  line-height: 1.6;
}

.caption-text {
  font-size: 0.75rem;     /* 12px */
  font-weight: 500;
  color: #475569;
  line-height: 1.5;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

---

## Shadow Usage Guide

### When to Apply Each Shadow Level

```css
/* Tier 1: Subtle Elevation (Cards at rest) */
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

/* Tier 2: Medium Elevation (Hover, dropdowns) */
box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);

/* Tier 3: High Elevation (Modals, floating elements) */
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

/* Tier 4: Maximum Elevation (Dialogs, toasts) */
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
```

### Colored Shadows (For Branded Elements)

```css
/* Primary action shadow */
box-shadow: 0 8px 16px rgba(225, 29, 72, 0.35);

/* Focus ring shadow */
box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.2);

/* Error state shadow */
box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);

/* Success state shadow */
box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
```

---

## Spacing System

### Consistent Spacing Scale (4px base)

```css
/* Use these spacing values for consistency */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
```

### Application Guidelines

```css
/* Card padding */
padding: 1.125rem;  /* 18px - slightly more than space-4 */

/* Button padding */
padding: 0.625rem 1.125rem;  /* Vertical: 10px, Horizontal: 18px */

/* Gap between elements */
gap: 0.75rem;  /* 12px - space-3 */

/* Section margins */
margin-bottom: 1.5rem;  /* 24px - space-6 */
```

---

## Accessibility Checklist

### Before Committing New Components

- [ ] **Contrast**: All text meets 4.5:1 minimum (7:1 preferred)
- [ ] **Focus**: Visible focus indicators on all interactive elements
- [ ] **Keyboard**: All functionality available via keyboard
- [ ] **ARIA**: Proper labels and roles for screen readers
- [ ] **Color**: Not relying on color alone to convey information
- [ ] **Touch**: Minimum 40px × 40px touch targets
- [ ] **Motion**: Respect `prefers-reduced-motion`

### Testing Tools

1. **Browser DevTools**: Color contrast checker
2. **axe DevTools**: Automated accessibility testing
3. **Keyboard**: Tab through entire interface
4. **Screen Reader**: Test with NVDA/JAWS/VoiceOver
5. **Zoom**: Test at 200% browser zoom

---

## Common Patterns Library

### Loading State

```css
.loading {
  opacity: 0.6;
  pointer-events: none;
  position: relative;
}

.loading::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24px;
  height: 24px;
  margin: -12px 0 0 -12px;
  border: 3px solid #cbd5e1;
  border-top-color: #e11d48;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### Empty State

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-state-icon {
  width: 64px;
  height: 64px;
  color: #cbd5e1;
  margin-bottom: 1.5rem;
}

.empty-state-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.empty-state-description {
  font-size: 0.875rem;
  color: #475569;
  max-width: 500px;
}
```

### Skeleton Loading

```css
.skeleton {
  background: linear-gradient(
    90deg,
    #e2e8f0 0%,
    #f1f5f9 50%,
    #e2e8f0 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## Performance Best Practices

### Efficient Transitions

```css
/* Good: Only animate transform and opacity */
transition: transform 0.2s ease, opacity 0.2s ease;

/* Avoid: Animating expensive properties */
/* transition: all 0.2s ease; */
/* transition: width 0.2s ease; */
/* transition: height 0.2s ease; */
```

### Hardware Acceleration

```css
/* Trigger GPU acceleration for smooth animations */
.animated-element {
  transform: translateZ(0);
  will-change: transform;
}

/* Remove will-change after animation completes */
.animated-element.complete {
  will-change: auto;
}
```

---

## Responsive Patterns

### Mobile-First Approach

```css
/* Base styles (mobile) */
.responsive-element {
  padding: 1rem;
  font-size: 0.875rem;
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  .responsive-element {
    padding: 1.25rem;
    font-size: 1rem;
  }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .responsive-element {
    padding: 1.5rem;
    font-size: 1rem;
  }
}
```

---

## Error Prevention

### Common Mistakes to Avoid

❌ **Don't do this:**
```css
/* Using transparent backgrounds without fallback */
background: rgba(244, 63, 94, 0.1);

/* Single pixel borders */
border: 1px solid #e7e5e4;

/* Low contrast text */
color: #9ca3af;
```

✅ **Do this instead:**
```css
/* Solid backgrounds with proper contrast */
background: #fef2f2;

/* Visible borders */
border: 2px solid #cbd5e1;

/* High contrast text */
color: #475569;
```

---

## Browser Support

### CSS Features Used

All modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+):
- CSS custom properties (variables)
- CSS Grid and Flexbox
- backdrop-filter (with -webkit- prefix)
- box-shadow
- linear-gradient
- transform and transitions

### Graceful Degradation

```css
/* Fallback for backdrop-filter */
.modal-overlay {
  background: rgba(0, 0, 0, 0.7);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}

/* If backdrop-filter not supported, solid background still works */
@supports not (backdrop-filter: blur(4px)) {
  .modal-overlay {
    background: rgba(0, 0, 0, 0.85);
  }
}
```

---

## Quick Reference: Color Palette

```css
/* Copy-paste ready color values */

/* Slate (Primary Neutrals) */
--slate-50: #f8fafc;
--slate-100: #f1f5f9;
--slate-300: #cbd5e1;
--slate-600: #475569;
--slate-900: #0f172a;

/* Rose (Primary Accent) */
--rose-100: #ffe4e6;
--rose-300: #fda4af;
--rose-600: #e11d48;
--rose-700: #be123c;
--rose-800: #9f1239;

/* Red (Errors/Urgent) */
--red-50: #fef2f2;
--red-100: #fee2e2;
--red-200: #fecaca;
--red-600: #dc2626;
--red-800: #991b1b;

/* Amber (Warnings) */
--amber-50: #fffbeb;
--amber-600: #d97706;
--amber-800: #92400e;

/* Emerald (Success) */
--emerald-50: #ecfdf5;
--emerald-100: #d1fae5;
--emerald-300: #6ee7b7;
--emerald-600: #059669;
--emerald-800: #065f46;

/* Blue (Info) */
--blue-50: #eff6ff;
--blue-300: #93c5fd;
--blue-700: #1d4ed8;

/* Violet (AI Features) */
--violet-50: #f5f3ff;
--violet-200: #ddd6fe;
--violet-700: #6d28d9;

/* Pink (Stakeholders) */
--pink-50: #fdf2f8;
--pink-200: #fbcfe8;
--pink-600: #db2777;
--pink-700: #be185d;
```

---

**Last Updated**: 2026-01-30
**Version**: 1.0.0
**Maintainer**: Development Team
