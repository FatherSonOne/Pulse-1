# Focus Mode Visual Completion - UI Design Specification

## Overview

This document provides comprehensive visual design specifications for completing the Focus Mode feature in Pulse Messages. The design system extends the existing FocusMode component with four new components that enhance the user experience.

---

## Design System Foundation

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--focus-blue-500` | `#3b82f6` | Primary focus/work mode |
| `--focus-blue-600` | `#2563eb` | Primary hover states |
| `--focus-green-500` | `#10b981` | Break mode, success states |
| `--focus-purple-500` | `#8b5cf6` | Highlights, streaks |
| `--focus-orange-500` | `#f59e0b` | High priority, warnings |
| `--focus-red-500` | `#ef4444` | Urgent priority, errors |
| `--focus-yellow-400` | `#facc15` | Celebration, achievements |

### Typography Scale

```css
/* Display - Bold headings */
font-family: 'Inter', system-ui, sans-serif;
font-weight: 700;

/* Timer/Statistics - Monospace */
font-family: 'JetBrains Mono', monospace;
font-weight: 600;

/* Body - Readable content */
font-family: 'Inter', system-ui, sans-serif;
font-weight: 400;
```

### Spacing System

Base unit: 4px (0.25rem)

| Token | Value | Usage |
|-------|-------|-------|
| space-1 | 4px | Tight spacing |
| space-2 | 8px | Element gaps |
| space-3 | 12px | Small padding |
| space-4 | 16px | Standard padding |
| space-6 | 24px | Section spacing |
| space-8 | 32px | Large sections |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| radius-sm | 8px | Buttons, badges |
| radius-md | 12px | Cards, inputs |
| radius-lg | 16px | Modals |
| radius-xl | 24px | Large containers |
| radius-full | 9999px | Pills, avatars |

---

## Component Specifications

### 1. FocusDigestCard

**Purpose**: Displays messages received during a focus session, grouped by conversation with priority indicators.

**Visual Specifications**:

```
+--------------------------------------------------+
|  [Mail Icon]  Focus Session Digest         [X]  |
|               25 min session completed           |
|                                                  |
|  [12 messages]  [2 urgent]  [3 high]            |
+--------------------------------------------------+
|                                                  |
|  +--------------------------------------------+  |
|  | [Avatar] Project Alpha                 [v] |  |
|  | [Urgent] "Need your review on..."          |  |
|  +--------------------------------------------+  |
|                                                  |
|  +--------------------------------------------+  |
|  | [Avatar] Team Chat                     [v] |  |
|  | [Normal] "Meeting scheduled for..."        |  |
|  +--------------------------------------------+  |
|                                                  |
+--------------------------------------------------+
|  [Dismiss All]              [Review Later]      |
+--------------------------------------------------+
```

**Dimensions**:
- Max width: 512px (max-w-lg)
- Max height: 85vh
- Header padding: 24px horizontal, 20px vertical
- Content padding: 16px
- Message group border-radius: 12px

**Color States**:

| Priority | Background | Border | Text |
|----------|------------|--------|------|
| Urgent | `rgba(239,68,68,0.1)` | `rgba(239,68,68,0.3)` | `#f87171` |
| High | `rgba(249,115,22,0.1)` | `rgba(249,115,22,0.3)` | `#fb923c` |
| Normal | `rgba(59,130,246,0.1)` | `rgba(59,130,246,0.3)` | `#60a5fa` |
| Low | `rgba(113,113,122,0.1)` | `rgba(113,113,122,0.3)` | `#71717a` |

**Animations**:

```typescript
// Container entry
const containerVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
      staggerChildren: 0.1
    }
  }
};

// Message group
const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1, x: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
  }
};

// Quick action buttons
whileHover={{ scale: 1.05 }}
whileTap={{ scale: 0.95 }}
```

---

### 2. DistractionBlockingOverlay

**Purpose**: Semi-transparent overlay that visually blocks distractions during focus sessions.

**Visual Specifications**:

```
+--------------------------------------------------+
| [Progress Bar - Top of Screen]                    |
|                                                   |
|    +-------------------+                          |
|    |                   |                          |
|    |  Gradient Blur    |                          |
|    |  Over Sidebar     |                          |
|    |                   |                          |
|    +-------------------+                          |
|                                                   |
|    +-------------------+                          |
|    | [Focus Time]      |                          |
|    |    18:42          |                          |
|    | ================= |                          |
|    | 75% complete      |                          |
|    |                   |                          |
|    | Session Goal:     |                          |
|    | "Complete docs"   |                          |
|    |                   |                          |
|    | [o o o] 3 breaks  |                          |
|    |                   |                          |
|    | [End Focus]       |                          |
|    +-------------------+                          |
|                                                   |
+--------------------------------------------------+
```

**Dimensions**:
- Session info card: 288px width (w-72)
- Card position: fixed, left 24px, bottom 24px
- Card border-radius: 24px
- Card padding: 20px

**Gradient Overlay (Work Mode)**:
```css
background: linear-gradient(
  to right,
  rgba(59, 130, 246, 0.2) 0%,
  rgba(139, 92, 246, 0.15) 30%,
  transparent 60%
);
backdrop-filter: blur(8px);
```

**Gradient Overlay (Break Mode)**:
```css
background: linear-gradient(
  to right,
  rgba(16, 185, 129, 0.2) 0%,
  rgba(52, 211, 153, 0.15) 30%,
  transparent 60%
);
```

**Animations**:

```typescript
// Overlay entry
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  }
};

// Info card slide-in
const infoCardVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1, x: 0,
    transition: { duration: 0.4, delay: 0.2 }
  }
};

// Breathing effect for ambient glow
const breathingAnimation = {
  scale: [1, 1.02, 1],
  transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' }
};

// Active indicator pulse
animate={{
  scale: [1, 1.3, 1],
  opacity: [1, 0.7, 1]
}}
transition={{ duration: 1.5, repeat: Infinity }}
```

**Hold-to-End Interaction**:
- Hold duration: 2 seconds (100 intervals at 50ms)
- Progress fill: Red gradient from left
- Cancel on release before complete

---

### 3. SessionCompletionCelebration

**Purpose**: Celebrates successful focus session completion with confetti and statistics.

**Visual Specifications**:

```
+--------------------------------------------------+
|                                                   |
|              +----------------+                   |
|              |     [Star]     |                   |
|              |    TROPHY      |                   |
|              +----------------+                   |
|                                                   |
|           Session Complete!                       |
|        Great work staying focused                 |
|                                                   |
|   +----------+  +----------+                      |
|   | Duration |  | Blocked  |                      |
|   |   25m    |  |    12    |                      |
|   +----------+  +----------+                      |
|                                                   |
|   +----------+  +----------+                      |
|   | Score A+ |  | Breaks   |                      |
|   |   92%    |  |    1     |                      |
|   +----------+  +----------+                      |
|                                                   |
|   +------------------------------------------+   |
|   | [Fire] 5 Day Streak!                     |   |
|   | [||||||||   ] Best: 7 days              |   |
|   +------------------------------------------+   |
|                                                   |
|   +------------------------------------------+   |
|   |     Start Another Session                |   |
|   +------------------------------------------+   |
|                                                   |
|   [View Stats]              [Done]               |
|                                                   |
+--------------------------------------------------+
```

**Dimensions**:
- Max width: 448px (max-w-md)
- Trophy size: 96px diameter
- Stat card padding: 16px
- Grid gap: 16px

**Trophy Gradient**:
```css
background: linear-gradient(
  135deg,
  #facc15 0%,  /* yellow-400 */
  #f97316 100% /* orange-500 */
);
box-shadow: 0 8px 32px rgba(234, 179, 8, 0.3);
```

**Confetti System**:
- Particle count: 150
- Colors: Gold, Red, Teal, Blue, Green, Yellow, Plum, Mint, Purple
- Fall duration: 3-5 seconds
- Particle size: 8-16px
- Canvas blend mode: screen

**Animations**:

```typescript
// Trophy entrance
const trophyVariants = {
  hidden: { scale: 0, rotate: -180 },
  visible: {
    scale: 1, rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 15,
      delay: 0.3
    }
  }
};

// Stat counter animation
// Counts from 0 to value over 1.5 seconds with easeOutCubic

// Streak bar growth
initial={{ height: 0, opacity: 0 }}
animate={{ height: 24, opacity: 1 }}
transition={{ delay: 0.5 + index * 0.1 }}

// Sparkle effects around trophy
animate={{
  scale: [0, 1, 0],
  opacity: [0, 1, 0],
  rotate: [0, 180]
}}
transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
```

**Score Grade Colors**:

| Score | Grade | Color |
|-------|-------|-------|
| 90+ | A+ | `#34d399` (green-400) |
| 80-89 | A | `#34d399` (green-400) |
| 70-79 | B | `#60a5fa` (blue-400) |
| 60-69 | C | `#facc15` (yellow-400) |
| <60 | D | `#fb923c` (orange-400) |

---

### 4. FocusStatsDashboard

**Purpose**: Comprehensive statistics dashboard showing focus session history and trends.

**Visual Specifications**:

```
+--------------------------------------------------+
|  Focus Statistics                          [X]   |
|  Track your productivity journey                 |
|                                                  |
|  [Overview] [History]                            |
+--------------------------------------------------+
|                                                  |
|  +--------+ +--------+ +--------+ +--------+     |
|  | Total  | |Sessions| |  Avg   | |  Week  |     |
|  | 12h 30m| |  24/28 | |  25m   | |   5    |     |
|  +--------+ +--------+ +--------+ +--------+     |
|                                                  |
|  +-------------+  +---------------------------+  |
|  | Completion  |  |     Focus Time Chart      |  |
|  |    Rate     |  | [Daily] [Weekly] [Monthly]|  |
|  |             |  |                           |  |
|  |    [86%]    |  | |  |  | || |             |  |
|  |             |  | |  |  | || |  |          |  |
|  |    Ring     |  | |  || | || |  |  |       |  |
|  |             |  | || || | || || |  |       |  |
|  +-------------+  | S  M  T  W  T  F  S      |  |
|                   +---------------------------+  |
|                                                  |
|  +------------------------------------------+   |
|  | [Fire] 5 Day Streak      Best: 7 days    |   |
|  | [S][M][T][W][T][F][S]                    |   |
|  +------------------------------------------+   |
|                                                  |
|  +------------------------------------------+   |
|  | This Week Summary                         |   |
|  | 8h 45m  |  12 sessions  |  1h 15m avg    |   |
|  +------------------------------------------+   |
|                                                  |
+--------------------------------------------------+
```

**Dimensions**:
- Max width: 672px (max-w-2xl)
- Max height: 90vh
- Header padding: 24px horizontal, 20px vertical
- Content padding: 24px
- Stat card min-width: 120px

**Chart Specifications**:
- Bar width: Flexible (1fr per day)
- Bar max-width: 48px
- Bar border-radius: 8px top
- Today indicator: Blue gradient
- Other days: Gray gradient
- Height calculation: `(focusMinutes / maxMinutes) * 100%`

**Progress Ring**:
- Size: 120px diameter
- Stroke width: 8px
- Background stroke: `rgba(255, 255, 255, 0.1)`
- Progress stroke: Color based on percentage
- Rotation: -90deg (start from top)

```typescript
// Progress ring animation
const circumference = radius * 2 * Math.PI;
const strokeDashoffset = circumference - (progress / 100) * circumference;

initial={{ strokeDashoffset: circumference }}
animate={{ strokeDashoffset }}
transition={{ duration: 1, ease: 'easeOut' }}
```

**Time Range Tabs**:
- Daily: Last 7 days
- Weekly: Last 7 days (same data, different label format)
- Monthly: Last 30 days

---

## Framer Motion Animation Library

### Standard Transitions

```typescript
// Fast interactions (buttons, hovers)
const fastTransition = {
  duration: 0.15,
  ease: [0.4, 0, 0.2, 1]
};

// Normal transitions (cards, modals)
const normalTransition = {
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1]
};

// Spring transitions (bouncy elements)
const springTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 25
};

// Stagger children
const staggerTransition = {
  staggerChildren: 0.1,
  delayChildren: 0.2
};
```

### Reusable Variants

```typescript
// Modal entry/exit
export const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
      staggerChildren: 0.1
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -20,
    transition: { duration: 0.3 }
  }
};

// List item entry
export const listItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1]
    }
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.2 }
  }
};

// Button interactions
export const buttonVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 }
};
```

---

## Accessibility Specifications

### WCAG AA Compliance

| Requirement | Implementation |
|-------------|----------------|
| Color Contrast | 4.5:1 minimum for text, 3:1 for large text |
| Focus Indicators | 2px blue outline with 2px offset |
| Keyboard Navigation | Full tab support, Escape to close modals |
| Screen Readers | ARIA labels on all interactive elements |
| Reduced Motion | Respect `prefers-reduced-motion` |

### ARIA Labels

```tsx
// Modals
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">

// Progress indicators
<div role="progressbar" aria-valuenow={75} aria-valuemin={0} aria-valuemax={100}>

// Time displays
<span aria-label="18 minutes 42 seconds remaining">18:42</span>

// Close buttons
<button aria-label="Close dialog">

// Priority badges
<span aria-label="Urgent priority message">
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Escape | Close modal/overlay |
| Space | Pause/resume timer (when overlay visible) |
| Enter | Activate focused button |
| Tab | Navigate between interactive elements |

---

## Responsive Breakpoints

| Breakpoint | Width | Adjustments |
|------------|-------|-------------|
| Mobile | < 480px | Single column, reduced padding |
| Tablet | 480-768px | Two column stats grid |
| Desktop | > 768px | Full layout |

### Mobile Specific

```css
@media (max-width: 768px) {
  .focus-digest-card {
    margin: 16px;
    max-height: calc(100vh - 32px);
  }

  .focus-session-info-card {
    left: 16px;
    right: 16px;
    bottom: 16px;
    width: auto;
  }

  .focus-stats-chart-bar {
    min-width: 24px;
  }
}
```

---

## File Structure

```
src/components/Messages/
├── FocusMode.tsx                    # Existing - Main focus mode component
├── FocusTimer.tsx                   # Existing - Timer display
├── FocusControls.tsx                # Existing - Control buttons
├── FocusDigestCard.tsx              # NEW - Message digest
├── DistractionBlockingOverlay.tsx   # NEW - Blocking overlay
├── SessionCompletionCelebration.tsx # NEW - Celebration animation
├── FocusStatsDashboard.tsx          # NEW - Statistics dashboard
├── FocusModeComponents.css          # NEW - Component styles
├── FocusModeExtensions.ts           # NEW - Export index
└── messages.css                     # Existing - Messages styles
```

---

## Integration Guide

### 1. Import Components

```tsx
import {
  FocusDigestCard,
  DistractionBlockingOverlay,
  SessionCompletionCelebration,
  FocusStatsDashboard
} from './FocusModeExtensions';

import './FocusModeComponents.css';
```

### 2. Add to Focus Mode Flow

```tsx
// In parent component managing focus state
const [showDigest, setShowDigest] = useState(false);
const [showCelebration, setShowCelebration] = useState(false);
const [showStats, setShowStats] = useState(false);
const [blockedMessages, setBlockedMessages] = useState([]);

// When focus session ends
const handleSessionEnd = (completed: boolean) => {
  if (completed) {
    setShowCelebration(true);
  }
  if (blockedMessages.length > 0) {
    setShowDigest(true);
  }
};

// Render
return (
  <>
    {/* Existing focus mode */}
    <FocusMode {...props} />

    {/* Distraction overlay during active session */}
    <DistractionBlockingOverlay
      isActive={isFocusActive && !showCelebration}
      mode={focusMode}
      timeRemaining={timeRemaining}
      totalTime={totalTime}
      breakCount={breakCount}
      onEmergencyEnd={handleEmergencyEnd}
      blockedNotifications={blockedMessages.length}
    />

    {/* Celebration on completion */}
    <SessionCompletionCelebration
      isVisible={showCelebration}
      stats={sessionStats}
      streak={streakInfo}
      onStartAnother={handleStartAnother}
      onClose={() => setShowCelebration(false)}
      onViewStats={() => {
        setShowCelebration(false);
        setShowStats(true);
      }}
    />

    {/* Digest after celebration */}
    <FocusDigestCard
      isVisible={showDigest && !showCelebration}
      messages={blockedMessages}
      sessionDuration={sessionDuration}
      onReply={handleReply}
      onDismiss={handleDismiss}
      onSnooze={handleSnooze}
      onDismissAll={handleDismissAll}
      onViewThread={handleViewThread}
      onClose={() => setShowDigest(false)}
    />

    {/* Stats dashboard */}
    <FocusStatsDashboard
      isVisible={showStats}
      stats={focusStats}
      dailyData={dailyFocusData}
      onClose={() => setShowStats(false)}
      userId={userId}
    />
  </>
);
```

---

## Performance Considerations

1. **Confetti Canvas**: Uses requestAnimationFrame for smooth 60fps animation
2. **CSS Animations**: Hardware-accelerated transforms and opacity
3. **Lazy Loading**: Dashboard chart data loaded on visibility
4. **Reduced Motion**: All animations disabled when user prefers reduced motion

---

## Testing Checklist

- [ ] All components render correctly in light/dark mode
- [ ] Animations play smoothly at 60fps
- [ ] Keyboard navigation works for all interactive elements
- [ ] Screen readers announce content correctly
- [ ] Components are responsive at all breakpoints
- [ ] Hold-to-end interaction requires full duration
- [ ] Confetti cleans up properly after animation
- [ ] Stats dashboard loads correct time range data
