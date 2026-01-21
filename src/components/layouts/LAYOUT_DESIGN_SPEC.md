# Sidebar + Messages Layout Integration - Design Specification

## Overview

This document specifies the complete UI design for integrating the `SidebarTabs` component with the `MessagesSplitView` layout in Pulse Messages. The design creates a cohesive, accessible, and responsive interface that works seamlessly across desktop and mobile devices.

---

## Layout Architecture

### Desktop Layout (768px+)

```
+------------------+----------------------------------------+
|                  |                                        |
|    Sidebar       |           Messages Split-View          |
|  (320px/60px)    |                                        |
|                  |    Thread List     |   Conversation    |
|  [Tab Nav]       |      (30%)         |      (70%)        |
|  - Messages      |                    |                   |
|  - Tools         |  +-------------+   |  +-------------+  |
|  - CRM           |  | Thread 1    |   |  | Header      |  |
|  - Analytics     |  | Thread 2    |   |  | Messages    |  |
|                  |  | Thread 3    |   |  | Input       |  |
|  [Content]       |  +-------------+   |  +-------------+  |
|                  |                    |                   |
|  [Shortcuts]     |                    |                   |
+------------------+--------------------+-------------------+
```

### Mobile Layout (<768px)

```
+----------------------------------------+
|                                        |
|           Messages Split-View          |
|                                        |
|    Thread List    OR    Conversation   |
|      (100%)              (100%)        |
|                                        |
|  +----------------------------------+  |
|  | Thread / Message Content        |  |
|  |                                  |  |
|  +----------------------------------+  |
|                                        |
+----------------------------------------+
|  [Messages] [Tools] [CRM] [Analytics]  |
+----------------------------------------+
        Mobile Bottom Tab Bar
```

---

## Dimension Specifications

### Sidebar Dimensions

| State | Width | Transition |
|-------|-------|------------|
| Expanded | 320px | 300ms cubic-bezier(0.4, 0, 0.2, 1) |
| Collapsed | 60px | 300ms cubic-bezier(0.4, 0, 0.2, 1) |

### Responsive Breakpoints

| Breakpoint | Sidebar Width | Thread List | Conversation |
|------------|---------------|-------------|--------------|
| Mobile (<768px) | Hidden (Bottom Bar) | 100% | 100% |
| Tablet (768px-1024px) | 280px | 35% | 65% |
| Desktop (1024px-1440px) | 320px | 30% | 70% |
| Large Desktop (1440px+) | 360px | 25% | 75% |

### Mobile Bottom Bar

| Property | Value |
|----------|-------|
| Height | 64px |
| Safe Area | env(safe-area-inset-bottom) |
| Tab Button Min Width | 64px |
| Icon Size | 20px (1.25rem) |
| Label Size | 10px (0.625rem) |

### Mobile Bottom Sheet

| Property | Value |
|----------|-------|
| Height | 70vh |
| Max Height | calc(100vh - 60px) |
| Border Radius | 24px (top corners) |
| Drag Handle | 40px x 4px |

---

## Component Structure

### MessagesLayout Component

```tsx
<MessagesLayout>
  {/* Desktop */}
  <aside className="messages-layout__sidebar">
    <SidebarTabs />
  </aside>

  <main className="messages-layout__main">
    <MessagesSplitView />
  </main>

  {/* Mobile */}
  <MobileTabBar />
  <MobileBottomSheet />
</MessagesLayout>
```

### State Management

```typescript
interface LayoutState {
  sidebarCollapsed: boolean;  // Sidebar expand/collapse state
  activeTab: SidebarTabType;  // 'messages' | 'tools' | 'crm' | 'analytics'
  isMobile: boolean;          // Responsive breakpoint state
  mobileSheetOpen: boolean;   // Mobile bottom sheet visibility
}
```

---

## Tab Navigation Design

### Tab Configuration

| Tab | Icon | Color | Shortcut |
|-----|------|-------|----------|
| Messages | `fa-messages` | Blue (#3b82f6) | Cmd+1 |
| Tools | `fa-wrench` | Purple (#9333ea) | Cmd+2 |
| CRM | `fa-users` | Green (#22c55e) | Cmd+3 |
| Analytics | `fa-chart-line` | Orange (#f97316) | Cmd+4 |

### Tab States

**Expanded State (320px)**
- Full label visible
- Description text visible
- Keyboard shortcut badge
- 48px height per tab

**Collapsed State (60px)**
- Icon only (40px x 40px button)
- Tooltip on hover (right-positioned)
- Active indicator bar (3px left border)
- Badge positioned top-right

### Tab Interaction States

| State | Visual Treatment |
|-------|------------------|
| Default | Gray icon, transparent background |
| Hover | Light color tint background, icon scale 1.05 |
| Active | Color background, color icon, left indicator |
| Focus | 2px blue outline, 2px offset |
| Disabled | 60% opacity, no pointer events |

---

## Tool Selection Flow

### User Journey

```
1. User clicks "Tools" tab
   └─> Tab activates with purple indicator
   └─> SidebarContent renders ToolsPanel

2. User searches/browses tools
   └─> Category tabs filter tools
   └─> Search highlights matches

3. User selects a tool
   └─> onToolSelect callback fires
   └─> Tool usage tracked in localStorage
   └─> (Optional) Auto-switch to Messages tab

4. Tool action executes
   └─> Tool modal/panel opens in main area
   └─> Results displayed in conversation
```

### Tool Selection Visual Feedback

```css
/* Tool card selection */
.tool-card:active {
  transform: scale(0.98);
  background: var(--color-primary-100);
}

/* Selected tool indicator */
.tool-card--selected::after {
  content: '';
  position: absolute;
  inset: -2px;
  border: 2px solid var(--color-primary-500);
  border-radius: inherit;
}
```

---

## Collapsed Sidebar Mini-Icons

### Visual Specifications

```
+--------+
|  .--.  |  <-- 40px x 40px button
| |    | |
|  `--'  |
|        |
| [icon] |  <-- 18px icon, centered
|        |
| (2)    |  <-- Badge (if present)
+--------+
    |
    +---> [Tooltip]
          +-----------------+
          | Messages   ⌘1  |
          | View conversations
          +-----------------+
```

### Collapsed Icon CSS

```css
.sidebar-collapsed-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.sidebar-collapsed-icon__icon {
  font-size: 1.125rem; /* 18px */
}

.sidebar-collapsed-icon__indicator {
  position: absolute;
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 24px;
  border-radius: 0 2px 2px 0;
}

.sidebar-collapsed-tooltip {
  position: absolute;
  left: calc(100% + 12px);
  top: 50%;
  transform: translateY(-50%);
  min-width: 160px;
  padding: 12px 16px;
  background: #18181b;
  border-radius: 12px;
}
```

---

## Mobile Bottom Sheet Behavior

### Sheet States

| State | Position | Interaction |
|-------|----------|-------------|
| Hidden | translateY(100%) | Tap tab to open |
| Open | translateY(0) | Drag to dismiss |
| Dragging | Follow touch | Release to snap |

### Gesture Handling

```typescript
// Drag threshold for dismiss
const DRAG_THRESHOLD = 100; // pixels

// On drag end
if (dragY > DRAG_THRESHOLD) {
  closeSheet();
} else {
  snapToOpen();
}
```

### Sheet Animation

```typescript
const sheetTransition = {
  initial: { y: '100%' },
  animate: { y: 0 },
  exit: { y: '100%' },
  transition: {
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1]
  }
};
```

### Backdrop Behavior

- Background: rgba(0, 0, 0, 0.5)
- Backdrop blur: 4px
- Click to dismiss: Yes
- Scroll lock: Yes (body overflow hidden)

---

## Color System

### Tab Color Palette

```css
:root {
  /* Blue (Messages) */
  --color-blue-50: #eff6ff;
  --color-blue-100: #dbeafe;
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;

  /* Purple (Tools) */
  --color-purple-50: #faf5ff;
  --color-purple-100: #f3e8ff;
  --color-purple-500: #9333ea;
  --color-purple-600: #7c3aed;

  /* Green (CRM) */
  --color-green-50: #f0fdf4;
  --color-green-100: #dcfce7;
  --color-green-500: #22c55e;
  --color-green-600: #16a34a;

  /* Orange (Analytics) */
  --color-orange-50: #fff7ed;
  --color-orange-100: #ffedd5;
  --color-orange-500: #f97316;
  --color-orange-600: #ea580c;
}
```

### Dark Mode Adjustments

```css
.dark {
  /* Backgrounds are inverted with transparency */
  --color-blue-bg: rgba(59, 130, 246, 0.15);
  --color-purple-bg: rgba(147, 51, 234, 0.15);
  --color-green-bg: rgba(34, 197, 94, 0.15);
  --color-orange-bg: rgba(249, 115, 22, 0.15);
}
```

---

## Animation Specifications

### Sidebar Collapse/Expand

```css
.sidebar-container {
  transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: width;
}
```

### Tab Switch

```typescript
// Framer Motion config
const tabTransition = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
  transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
};
```

### Active Indicator

```typescript
// Spring animation for active tab indicator
const indicatorTransition = {
  type: 'spring',
  stiffness: 500,
  damping: 30
};
```

---

## Accessibility (WCAG AA)

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move focus between interactive elements |
| Enter/Space | Activate focused button |
| Escape | Close bottom sheet / clear search |
| Cmd+B | Toggle sidebar collapse |
| Cmd+1-4 | Switch to tab 1-4 |

### ARIA Attributes

```html
<aside
  role="complementary"
  aria-label="Sidebar navigation"
>
  <nav role="tablist" aria-label="Main tabs">
    <button
      role="tab"
      aria-selected="true"
      aria-controls="panel-messages"
      id="tab-messages"
    >
      Messages
    </button>
  </nav>

  <div
    role="tabpanel"
    id="panel-messages"
    aria-labelledby="tab-messages"
  >
    <!-- Content -->
  </div>
</aside>
```

### Color Contrast

All text meets WCAG AA requirements:
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- Interactive elements: Clear focus indicators

### Focus Management

- Focus visible outline: 2px solid #3b82f6
- Focus offset: 2px
- Focus trapped in bottom sheet when open
- Focus returns to trigger when sheet closes

---

## File Structure

```
src/components/
├── layouts/
│   ├── MessagesLayout.tsx      # Main layout component
│   ├── messagesLayout.css      # Layout styles
│   └── LAYOUT_DESIGN_SPEC.md   # This specification
│
├── Sidebar/
│   ├── SidebarTabs.tsx         # Tab navigation container
│   ├── SidebarTab.tsx          # Individual tab component
│   ├── SidebarContent.tsx      # Tab content renderer
│   ├── SidebarCollapsedIcons.tsx # Collapsed state icons
│   ├── sidebarTabs.css         # Tab styles
│   └── sidebarCollapsedIcons.css # Collapsed icon styles
│
├── Messages/
│   ├── MessagesSplitView.tsx   # Split-view layout
│   ├── ThreadListPanel.tsx     # Thread list (30%)
│   ├── ConversationPanel.tsx   # Conversation (70%)
│   └── messages.css            # Message styles
│
└── ToolsPanel/
    ├── ToolsPanel.tsx          # Tools panel container
    └── ...                     # Tool components
```

---

## Implementation Checklist

### Phase 1: Layout Foundation
- [x] Create MessagesLayout component
- [x] Create messagesLayout.css styles
- [x] Implement sidebar width animations
- [x] Add responsive breakpoint handling

### Phase 2: Collapsed State
- [x] Create SidebarCollapsedIcons component
- [x] Implement tooltip on hover
- [x] Add active indicator animation
- [x] Style badge notifications

### Phase 3: Mobile Support
- [x] Create MobileTabBar component
- [x] Implement MobileBottomSheet component
- [x] Add drag-to-dismiss gesture
- [x] Handle safe area insets

### Phase 4: Integration
- [ ] Wire up tool selection callbacks
- [ ] Add keyboard shortcut handlers
- [ ] Implement localStorage persistence
- [ ] Add analytics tracking

### Phase 5: Polish
- [ ] Add reduced motion support
- [ ] Test high contrast mode
- [ ] Verify screen reader navigation
- [ ] Performance optimization

---

## Usage Example

```tsx
import { MessagesLayout } from './components/layouts/MessagesLayout';

function App() {
  const handleToolSelect = (toolId: string) => {
    console.log('Tool selected:', toolId);
    // Open tool modal, trigger action, etc.
  };

  return (
    <MessagesLayout
      channels={channels}
      messages={messages}
      currentUserId={userId}
      onSendMessage={handleSend}
      onToolSelect={handleToolSelect}
      defaultTab="messages"
      defaultCollapsed={false}
    />
  );
}
```

---

**Design System Version**: 1.0.0
**Last Updated**: January 2026
**Author**: UI Designer Agent
