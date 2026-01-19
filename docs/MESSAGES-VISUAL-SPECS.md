# Messages Visual Design Specifications
## Component Design System for Pulse Messages

**Version:** 1.0
**Date:** December 23, 2025
**Design System:** Pulse UI Kit

---

## Color Palette

### Message UI Colors

```css
/* Core Message Colors */
--msg-sent-bg: #2563eb;              /* Primary blue for sent messages */
--msg-sent-text: #ffffff;            /* White text on sent */
--msg-received-bg: #27272a;          /* Dark zinc for received */
--msg-received-text: #fafafa;        /* Off-white text on received */

/* System & AI Messages */
--msg-system-bg: #6366f1;            /* Indigo for system notifications */
--msg-ai-bg: #8b5cf6;                /* Purple for AI messages */
--msg-ai-accent: #a78bfa;            /* Light purple for AI highlights */

/* Status Indicators */
--status-sending: #f59e0b;           /* Amber - message sending */
--status-sent: #10b981;              /* Green - message sent */
--status-delivered: #3b82f6;         /* Blue - message delivered */
--status-read: #6366f1;              /* Indigo - message read */
--status-failed: #ef4444;            /* Red - send failed */

/* Thread States */
--thread-active: #3b82f6;            /* Blue - active thread */
--thread-unread: #ef4444;            /* Red - unread indicator */
--thread-pinned: #fbbf24;            /* Yellow - pinned thread */
--thread-muted: #71717a;             /* Gray - muted thread */
--thread-archived: #52525b;          /* Darker gray - archived */

/* AI Intelligence Colors */
--ai-intent-question: #3b82f6;       /* Blue - question detected */
--ai-intent-task: #f59e0b;           /* Amber - task detected */
--ai-intent-decision: #8b5cf6;       /* Purple - decision detected */
--ai-intent-meeting: #ec4899;        /* Pink - meeting detected */

/* Health Indicators */
--health-excellent: #10b981;         /* Green - excellent team health */
--health-good: #84cc16;              /* Light green - good */
--health-warning: #f59e0b;           /* Amber - warning */
--health-critical: #ef4444;          /* Red - critical */

/* Reaction Colors */
--reaction-bg: #3f3f46;              /* Zinc-700 background */
--reaction-active-bg: #3b82f6;       /* Blue when user reacted */
--reaction-border: #52525b;          /* Zinc-600 border */
```

### Dark Theme (Default)

```css
:root[data-theme="dark"] {
  --background-primary: #09090b;     /* Zinc-950 */
  --background-secondary: #18181b;   /* Zinc-900 */
  --background-tertiary: #27272a;    /* Zinc-800 */
  --background-elevated: #3f3f46;    /* Zinc-700 */

  --text-primary: #fafafa;           /* Zinc-50 */
  --text-secondary: #e4e4e7;         /* Zinc-200 */
  --text-tertiary: #a1a1aa;          /* Zinc-400 */
  --text-muted: #71717a;             /* Zinc-500 */

  --border-primary: #27272a;         /* Zinc-800 */
  --border-secondary: #3f3f46;       /* Zinc-700 */

  --accent-primary: #ef4444;         /* Red-500 (Pulse brand) */
  --accent-hover: #dc2626;           /* Red-600 */
}
```

---

## Typography System

### Font Families

```css
--font-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
                'Oxygen', 'Ubuntu', 'Cantarell', 'Helvetica Neue', sans-serif;
--font-monospace: 'SF Mono', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
```

### Type Scale

```css
/* Message-Specific Typography */
.msg-sender-name {
  font-size: 0.875rem;        /* 14px */
  font-weight: 600;           /* Semibold */
  line-height: 1.25;
  letter-spacing: -0.01em;
}

.msg-text-content {
  font-size: 0.9375rem;       /* 15px */
  font-weight: 400;           /* Regular */
  line-height: 1.5;
  letter-spacing: 0;
}

.msg-timestamp {
  font-size: 0.6875rem;       /* 11px */
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.01em;
  opacity: 0.6;
}

.msg-thread-preview {
  font-size: 0.8125rem;       /* 13px */
  font-weight: 400;
  line-height: 1.4;
  letter-spacing: 0;
  opacity: 0.8;
}

.msg-system-notification {
  font-size: 0.75rem;         /* 12px */
  font-weight: 500;           /* Medium */
  line-height: 1.33;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.msg-ai-badge {
  font-size: 0.6875rem;       /* 11px */
  font-weight: 600;           /* Semibold */
  line-height: 1;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
```

---

## Spacing System

### Base Grid: 4px

```css
--space-0: 0;
--space-1: 0.25rem;     /* 4px */
--space-2: 0.5rem;      /* 8px */
--space-3: 0.75rem;     /* 12px */
--space-4: 1rem;        /* 16px */
--space-5: 1.25rem;     /* 20px */
--space-6: 1.5rem;      /* 24px */
--space-8: 2rem;        /* 32px */
--space-10: 2.5rem;     /* 40px */
--space-12: 3rem;       /* 48px */
```

### Message-Specific Spacing

```css
/* Message Bubble Padding */
--msg-bubble-padding-x: 16px;          /* Horizontal padding inside bubble */
--msg-bubble-padding-y: 12px;          /* Vertical padding inside bubble */

/* Message Gaps */
--msg-same-sender-gap: 8px;            /* Gap between consecutive messages from same sender */
--msg-different-sender-gap: 16px;      /* Gap between messages from different senders */
--msg-section-divider-gap: 24px;       /* Gap around date dividers */

/* Thread List Spacing */
--thread-item-padding: 12px;           /* Thread list item padding */
--thread-list-gap: 4px;                /* Gap between thread items */

/* Input Area Spacing */
--input-container-padding: 16px;       /* Padding around input field */
--input-actions-gap: 8px;              /* Gap between input action buttons */
```

---

## Component Specifications

### Message Bubble

#### Visual Design

```css
.message-bubble {
  /* Base styling */
  padding: var(--msg-bubble-padding-y) var(--msg-bubble-padding-x);
  border-radius: 16px;
  max-width: 70%;
  word-wrap: break-word;

  /* Shadow */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);

  /* Transition */
  transition: all 150ms ease-out;
}

/* Sent message (right-aligned) */
.message-bubble--sent {
  background: var(--msg-sent-bg);
  color: var(--msg-sent-text);
  align-self: flex-end;
  border-bottom-right-radius: 4px;
}

/* Received message (left-aligned) */
.message-bubble--received {
  background: var(--msg-received-bg);
  color: var(--msg-received-text);
  align-self: flex-start;
  border-bottom-left-radius: 4px;
}

/* Hover state */
.message-bubble:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* Message grouping - first in group */
.message-bubble--first {
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
}

/* Message grouping - middle of group */
.message-bubble--middle {
  border-radius: 4px;
}

/* Message grouping - last in group */
.message-bubble--last {
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}
```

#### Responsive Behavior

```css
/* Mobile adjustments */
@media (max-width: 640px) {
  .message-bubble {
    max-width: 85%;
    padding: 10px 14px;
  }
}
```

---

### Thread List Item

#### Visual Design

```css
.thread-item {
  padding: var(--thread-item-padding);
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease-out;
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}

/* States */
.thread-item--default {
  background: transparent;
}

.thread-item--hover {
  background: var(--background-tertiary);
}

.thread-item--active {
  background: var(--background-elevated);
  border-left: 3px solid var(--accent-primary);
  padding-left: calc(var(--thread-item-padding) - 3px);
}

.thread-item--unread {
  font-weight: 600;
}

/* Unread badge */
.thread-item__unread-badge {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  background: var(--thread-unread);
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 12px;
  min-width: 20px;
  text-align: center;
}

/* Pinned indicator */
.thread-item--pinned::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 50%;
  background: var(--thread-pinned);
  border-radius: 0 2px 2px 0;
}

/* Muted indicator */
.thread-item--muted {
  opacity: 0.6;
}
```

---

### Message Input

#### Visual Design

```css
.message-input-container {
  padding: var(--input-container-padding);
  border-top: 1px solid var(--border-primary);
  background: var(--background-primary);
  position: sticky;
  bottom: 0;
  z-index: 10;
}

.message-input {
  display: flex;
  align-items: flex-end;
  gap: var(--input-actions-gap);
  background: var(--background-tertiary);
  border: 1px solid var(--border-secondary);
  border-radius: 12px;
  padding: 8px;
  transition: all 150ms ease-out;
}

.message-input:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.message-input__textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 15px;
  line-height: 1.5;
  resize: none;
  min-height: 44px;
  max-height: 120px;
  padding: 8px 12px;
}

.message-input__textarea::placeholder {
  color: var(--text-muted);
}

/* Action buttons */
.message-input__action-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 150ms ease-out;
}

.message-input__action-btn:hover {
  background: var(--background-elevated);
  color: var(--text-primary);
}

.message-input__send-btn {
  background: var(--accent-primary);
  color: white;
}

.message-input__send-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: scale(1.05);
}

.message-input__send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

### Avatar Component

#### Visual Design

```css
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
  color: white;
  flex-shrink: 0;
  position: relative;
}

/* Gradient backgrounds (based on name hash) */
.avatar--gradient-1 { background: linear-gradient(135deg, #ef4444, #f97316); }
.avatar--gradient-2 { background: linear-gradient(135deg, #3b82f6, #06b6d4); }
.avatar--gradient-3 { background: linear-gradient(135deg, #10b981, #22c55e); }
.avatar--gradient-4 { background: linear-gradient(135deg, #8b5cf6, #ec4899); }
.avatar--gradient-5 { background: linear-gradient(135deg, #f59e0b, #eab308); }

/* Online status indicator */
.avatar__status {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--background-primary);
}

.avatar__status--online {
  background: #10b981;
}

.avatar__status--away {
  background: #f59e0b;
}

.avatar__status--offline {
  background: #71717a;
}

/* Sizes */
.avatar--small {
  width: 32px;
  height: 32px;
  font-size: 14px;
}

.avatar--large {
  width: 56px;
  height: 56px;
  font-size: 24px;
}
```

---

### Typing Indicator

#### Visual Design

```css
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--msg-received-bg);
  border-radius: 16px;
  width: fit-content;
  max-width: 80px;
}

.typing-indicator__dots {
  display: flex;
  gap: 4px;
}

.typing-indicator__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary);
  animation: typing-dot 1.4s infinite ease-in-out;
}

.typing-indicator__dot:nth-child(1) {
  animation-delay: 0s;
}

.typing-indicator__dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator__dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-dot {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.6;
  }
  30% {
    transform: translateY(-6px);
    opacity: 1;
  }
}
```

---

### Reaction Badges

#### Visual Design

```css
.reaction-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.reaction-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--reaction-bg);
  border: 1px solid var(--reaction-border);
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 150ms ease-out;
}

.reaction-badge:hover {
  background: var(--background-elevated);
  transform: scale(1.05);
}

.reaction-badge--active {
  background: rgba(59, 130, 246, 0.2);
  border-color: var(--reaction-active-bg);
}

.reaction-badge__emoji {
  font-size: 14px;
  line-height: 1;
}

.reaction-badge__count {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.reaction-badge--active .reaction-badge__count {
  color: var(--reaction-active-bg);
}

/* Add reaction button */
.reaction-add-btn {
  width: 28px;
  height: 28px;
  border-radius: 12px;
  background: var(--background-tertiary);
  border: 1px solid var(--border-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease-out;
  opacity: 0;
  transform: scale(0.9);
}

.message-bubble:hover .reaction-add-btn {
  opacity: 1;
  transform: scale(1);
}

.reaction-add-btn:hover {
  background: var(--background-elevated);
  transform: scale(1.1);
}
```

---

### Date Divider

#### Visual Design

```css
.date-divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 24px 0;
}

.date-divider__line {
  flex: 1;
  height: 1px;
  background: var(--border-primary);
}

.date-divider__text {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

/* Sticky date divider */
.date-divider--sticky {
  position: sticky;
  top: 0;
  background: var(--background-primary);
  z-index: 5;
  padding: 8px 0;
}
```

---

### AI Features UI

#### Intent Badge

```css
.ai-intent-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  position: absolute;
  top: -12px;
  left: 16px;
}

.ai-intent-badge--question {
  background: rgba(59, 130, 246, 0.2);
  color: var(--ai-intent-question);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.ai-intent-badge--task {
  background: rgba(245, 158, 11, 0.2);
  color: var(--ai-intent-task);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.ai-intent-badge--decision {
  background: rgba(139, 92, 246, 0.2);
  color: var(--ai-intent-decision);
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.ai-intent-badge__icon {
  font-size: 10px;
}
```

#### Smart Reply Suggestions

```css
.smart-reply-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  background: var(--background-secondary);
  border-top: 1px solid var(--border-primary);
}

.smart-reply-chip {
  padding: 8px 14px;
  background: var(--background-tertiary);
  border: 1px solid var(--border-secondary);
  border-radius: 16px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 150ms ease-out;
  display: flex;
  align-items: center;
  gap: 6px;
}

.smart-reply-chip:hover {
  background: var(--background-elevated);
  border-color: var(--accent-primary);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.smart-reply-chip__icon {
  font-size: 12px;
  opacity: 0.6;
}
```

---

## Animation Specifications

### Message Entrance

```css
@keyframes message-send {
  0% {
    opacity: 0.7;
    transform: scale(0.95) translateY(5px);
  }
  50% {
    transform: scale(1.02) translateY(-1px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.message-bubble--sending {
  animation: message-send 300ms ease-out forwards;
}
```

### Message Receive

```css
@keyframes message-receive {
  0% {
    opacity: 0;
    transform: translateX(-20px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

.message-bubble--received-new {
  animation: message-receive 250ms ease-out forwards;
}
```

### Reaction Pop

```css
@keyframes reaction-pop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.reaction-badge--new {
  animation: reaction-pop 300ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

### Thread Item Slide

```css
@keyframes thread-slide-in {
  0% {
    opacity: 0;
    transform: translateX(-16px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

.thread-item--new {
  animation: thread-slide-in 200ms ease-out forwards;
}
```

### Skeleton Loading

```css
@keyframes skeleton-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--background-tertiary) 25%,
    var(--background-elevated) 50%,
    var(--background-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: 8px;
}

.skeleton--message {
  height: 60px;
  margin: 8px 0;
}

.skeleton--thread {
  height: 72px;
  margin: 4px 0;
}
```

---

## Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 640px) {
  .thread-list {
    width: 100%;
  }

  .message-chat {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
  }

  .message-bubble {
    max-width: 85%;
    font-size: 14px;
  }

  .message-input__textarea {
    font-size: 16px; /* Prevents zoom on iOS */
  }
}

/* Tablet */
@media (min-width: 641px) and (max-width: 1024px) {
  .thread-list {
    width: 280px;
  }

  .message-bubble {
    max-width: 75%;
  }
}

/* Desktop */
@media (min-width: 1025px) {
  .thread-list {
    width: 320px;
  }

  .message-bubble {
    max-width: 70%;
  }
}
```

---

## Touch Interactions (Mobile)

### Swipe Gestures

```typescript
// Swipe configuration
const SWIPE_CONFIG = {
  replyThreshold: 80,      // pixels to trigger reply
  archiveThreshold: 100,   // pixels to trigger archive
  hapticFeedback: true,
  showVisualCue: true,
};

// Visual feedback during swipe
.message-bubble--swiping-right {
  transform: translateX(var(--swipe-distance));
  transition: transform 100ms ease-out;
}

.message-bubble__swipe-action {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%) translateX(-100%);
  opacity: calc(var(--swipe-distance) / 80);
  transition: all 100ms ease-out;
}
```

### Long Press

```css
.message-bubble--long-pressing {
  animation: long-press-feedback 500ms ease-out;
}

@keyframes long-press-feedback {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.98);
  }
}
```

---

## Accessibility Specifications

### Focus States

```css
/* Keyboard focus */
.focusable:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Skip link for screen readers */
.skip-to-messages {
  position: absolute;
  left: -9999px;
  z-index: 999;
}

.skip-to-messages:focus {
  left: 50%;
  top: 10px;
  transform: translateX(-50%);
  background: var(--accent-primary);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
}
```

### High Contrast Mode

```css
@media (prefers-contrast: high) {
  .message-bubble--sent {
    border: 2px solid var(--msg-sent-bg);
  }

  .message-bubble--received {
    border: 2px solid var(--text-tertiary);
  }

  .thread-item--active {
    border: 2px solid var(--accent-primary);
  }
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .typing-indicator__dot {
    animation: none;
    opacity: 1;
  }
}
```

---

## Print Styles

```css
@media print {
  .thread-list,
  .message-input-container,
  .message-actions {
    display: none !important;
  }

  .message-bubble {
    page-break-inside: avoid;
    box-shadow: none;
    border: 1px solid #000;
    max-width: 100%;
  }

  .message-bubble--sent {
    background: #f0f0f0 !important;
    color: #000 !important;
  }

  .message-bubble--received {
    background: #fff !important;
    color: #000 !important;
    border: 1px solid #ccc;
  }
}
```

---

## Component States Matrix

| Component | Default | Hover | Active | Focus | Disabled | Loading |
|-----------|---------|-------|--------|-------|----------|---------|
| Message Bubble | Opacity 1 | Lift 1px, deeper shadow | - | - | Opacity 0.6 | Shimmer |
| Thread Item | Transparent bg | Zinc-800 bg | Zinc-700 + accent border | Outline 2px | - | Skeleton |
| Input Field | Border zinc-700 | - | Border red-500 + ring | Same as active | Opacity 0.5 | - |
| Action Button | Transparent | Elevated bg | Scale 0.98 | Outline 2px | Opacity 0.5 | Spinner |
| Reaction Badge | Zinc-700 bg | Scale 1.05 | Blue bg | Outline 2px | - | - |

---

## Design Tokens (CSS Variables)

```css
/* Complete token system for messages */
:root {
  /* Spacing tokens */
  --msg-space-bubble-x: 16px;
  --msg-space-bubble-y: 12px;
  --msg-space-same-sender: 8px;
  --msg-space-diff-sender: 16px;
  --msg-space-section: 24px;

  /* Sizing tokens */
  --msg-bubble-max-width: 70%;
  --msg-bubble-max-width-mobile: 85%;
  --msg-avatar-size: 40px;
  --msg-avatar-size-small: 32px;
  --msg-avatar-size-large: 56px;

  /* Border radius tokens */
  --msg-radius-bubble: 16px;
  --msg-radius-bubble-corner: 4px;
  --msg-radius-input: 12px;
  --msg-radius-button: 8px;

  /* Shadow tokens */
  --msg-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.1);
  --msg-shadow-md: 0 2px 8px rgba(0, 0, 0, 0.15);
  --msg-shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.2);

  /* Transition tokens */
  --msg-transition-fast: 150ms ease-out;
  --msg-transition-normal: 250ms ease-out;
  --msg-transition-slow: 400ms ease-out;
  --msg-transition-bounce: 300ms cubic-bezier(0.68, -0.55, 0.265, 1.55);

  /* Z-index tokens */
  --msg-z-base: 1;
  --msg-z-sticky: 5;
  --msg-z-dropdown: 10;
  --msg-z-modal: 50;
  --msg-z-toast: 100;
}
```

---

## Usage Examples

### Creating a Message Bubble

```tsx
<div className="message-bubble message-bubble--sent message-bubble--last">
  <div className="message-bubble__sender">You</div>
  <div className="message-bubble__content msg-text-content">
    This is a message with proper styling!
  </div>
  <div className="message-bubble__meta">
    <span className="msg-timestamp">2:34 PM</span>
    <i className="fa-solid fa-check-double status-icon status-icon--read"></i>
  </div>
  <div className="reaction-badges">
    <div className="reaction-badge reaction-badge--active">
      <span className="reaction-badge__emoji">👍</span>
      <span className="reaction-badge__count">3</span>
    </div>
  </div>
</div>
```

### Creating a Thread Item

```tsx
<div className="thread-item thread-item--active thread-item--unread">
  <div className="avatar avatar--gradient-2">
    <span>SK</span>
    <div className="avatar__status avatar__status--online"></div>
  </div>
  <div className="thread-item__content">
    <div className="thread-item__header">
      <span className="msg-sender-name">Sarah Kim</span>
      <span className="msg-timestamp">10m</span>
    </div>
    <div className="thread-item__preview msg-thread-preview">
      Let's schedule a meeting to discuss...
    </div>
  </div>
  <div className="thread-item__unread-badge">5</div>
</div>
```

---

**End of Visual Specifications**

For implementation questions or clarifications, refer to the main [Messages Enhancement Proposal](./MESSAGES-ENHANCEMENT-PROPOSAL.md).
