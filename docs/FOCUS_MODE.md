# Pulse Messages - Focus Mode Documentation

**Version**: 1.0
**Last Updated**: 2026-01-19
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [User Interface](#user-interface)
5. [API Reference](#api-reference)
6. [Usage Examples](#usage-examples)
7. [Configuration](#configuration)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Overview

Focus Mode is a productivity feature in Pulse Messages that helps users concentrate on specific conversations without distractions. It implements a Pomodoro-style timer with customizable durations, break tracking, and persistent state management.

### Key Capabilities

- **Pomodoro Timer**: Default 25-minute focus sessions
- **Customizable Duration**: Adjust timer from 5 to 120 minutes
- **Distraction-Free UI**: Hides non-essential UI elements
- **Break Tracking**: Tracks breaks due after focus sessions
- **Persistence**: Survives page reloads via localStorage
- **Browser Notifications**: Alerts when session completes
- **Pause/Resume**: Full timer control

---

## Features

### 1. Focus Timer

**Default Duration**: 25 minutes (Pomodoro standard)

**Configurable Durations**:
- 5 minutes (Quick focus)
- 15 minutes (Short session)
- 25 minutes (Standard Pomodoro)
- 45 minutes (Extended focus)
- 60 minutes (Deep work)
- Custom (5-120 minutes)

**Timer Controls**:
- Start: Begin focus session
- Pause: Temporarily pause timer
- Resume: Continue from paused state
- Stop: End session early
- Reset: Reset to 0 elapsed time

### 2. Break Management

**Break System**:
- Short break: 5 minutes (after each session)
- Long break: 15-30 minutes (after 4 sessions)
- Break counter tracks sessions completed
- Auto-suggestion for breaks

**Break Types**:
```typescript
{
  shortBreak: 5 * 60,   // 5 minutes
  longBreak: 15 * 60,   // 15 minutes (after 4 sessions)
}
```

### 3. Distraction-Free Mode

**Hidden Elements During Focus**:
- Sidebar panels (Tools, Analytics, etc.)
- Non-thread notifications
- Unrelated conversations
- Background animations
- Optional: All UI except active thread

**Visible Elements**:
- Active thread/conversation
- Message input
- Essential navigation
- Focus timer overlay
- Emergency exit button

### 4. Focus Digest

**Purpose**: Summary of messages missed during focus session

**Features**:
- Auto-generated after session
- Key highlights from other threads
- Urgent messages flagged
- Action items extracted
- Summarized by AI

**Example**:
```
Focus Session Complete - 25 minutes

During your focus:
- 3 new messages in "Team Updates"
- 1 urgent message from John (marked for follow-up)
- 2 scheduled messages sent successfully

Action Items:
- Review budget proposal (from Sarah)
- Approve design mockups (from Design Team)

Well done! Take a 5-minute break.
```

### 5. Persistent State

**Saved to localStorage**:
```typescript
{
  isActive: boolean,
  threadId: string,
  timerDuration: number,
  startedAt: number,  // timestamp
}
```

**Restoration Logic**:
- On page load, check for active session
- Calculate elapsed time since start
- Resume if not expired
- Clear if session expired

### 6. Browser Notifications

**Permission Request**: Automatic on first load

**Notification Events**:
- Focus session complete
- Break time reminder
- Urgent message during focus (optional)

**Example Notification**:
```
Title: "Focus Session Complete!"
Body: "Great work! Time to take a break."
Icon: Pulse logo
```

---

## Architecture

### Context Provider

**File**: `src/contexts/FocusModeContext.tsx` (214 lines)

**State Variables**:
```typescript
{
  isActive: boolean,          // Focus mode active
  threadId: string | null,    // Focused thread ID
  timerDuration: number,      // Total duration (seconds)
  elapsedTime: number,        // Elapsed time (seconds)
  breaksDue: number,          // Number of breaks due
  isPaused: boolean,          // Timer paused
  isRunning: boolean,         // Timer actively running
  remainingTime: number,      // Time remaining (seconds)
  progress: number,           // Progress 0-100%
  focusDigest: string | null  // Post-session summary
}
```

**Actions**:
```typescript
{
  startFocusMode(threadId: string, duration?: number): void
  stopFocusMode(): void
  pauseFocusMode(): void
  resumeFocusMode(): void
  resetFocusMode(): void
  setTimerDuration(duration: number): void
  setFocusDigest(digest: string | null): void
}
```

### Hook API

```typescript
import { useFocusMode } from '@/contexts/FocusModeContext';

const {
  // State
  isActive,
  threadId,
  timerDuration,
  elapsedTime,
  breaksDue,
  isPaused,
  isRunning,
  remainingTime,
  progress,
  focusDigest,

  // Actions
  startFocusMode,
  stopFocusMode,
  pauseFocusMode,
  resumeFocusMode,
  resetFocusMode,
  setTimerDuration,
  setFocusDigest
} = useFocusMode();
```

### Timer Implementation

**Update Frequency**: Every 1 second

**Logic**:
```typescript
useEffect(() => {
  if (isActive && !isPaused) {
    const interval = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;

        // Auto-stop when complete
        if (newTime >= timerDuration) {
          clearInterval(interval);
          showNotification();
          return timerDuration;
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }
}, [isActive, isPaused, timerDuration]);
```

---

## User Interface

### Focus Mode Button

**Location**: Top toolbar in Messages component

**States**:
- Inactive: Gray/outline style
- Active: Purple/filled style
- Running: Animated pulse
- Paused: Yellow/warning style

**Example**:
```tsx
<button
  onClick={() => isActive ? stopFocusMode() : startFocusMode(activeThreadId)}
  className={`focus-mode-btn ${isActive ? 'active' : ''}`}
  aria-label="Toggle Focus Mode"
>
  <i className="fa fa-crosshairs" />
  {isActive ? 'Exit Focus' : 'Focus Mode'}
</button>
```

### Timer Overlay

**Position**: Fixed top-right corner

**Display**:
```
┌─────────────────────────┐
│  Focus Mode Active      │
│  ⏱  12:45 remaining     │
│  ████████░░░░░░  55%    │
│  [Pause] [Stop]         │
└─────────────────────────┘
```

**Features**:
- Countdown timer (MM:SS format)
- Progress bar
- Pause/Resume buttons
- Stop button
- Thread name display

**Example Component**:
```tsx
<div className="focus-timer-overlay">
  <h3>Focus Mode Active</h3>
  <div className="timer">
    {Math.floor(remainingTime / 60)}:{String(remainingTime % 60).padStart(2, '0')}
  </div>
  <div className="progress-bar">
    <div style={{ width: `${progress}%` }} />
  </div>
  <div className="controls">
    {isPaused ? (
      <button onClick={resumeFocusMode}>Resume</button>
    ) : (
      <button onClick={pauseFocusMode}>Pause</button>
    )}
    <button onClick={stopFocusMode}>Stop</button>
  </div>
</div>
```

### Focus Digest Modal

**Shown**: After focus session completes

**Content**:
- Session summary
- Messages missed
- Action items
- Break suggestion

**Example**:
```tsx
{focusDigest && (
  <div className="focus-digest-modal">
    <h2>Focus Session Complete!</h2>
    <div className="summary">{focusDigest}</div>
    <div className="stats">
      <p>Duration: {Math.floor(elapsedTime / 60)} minutes</p>
      <p>Messages received: {messagesCount}</p>
    </div>
    <button onClick={startBreak}>Take a Break (5 min)</button>
    <button onClick={closeFocusDigest}>Continue Working</button>
  </div>
)}
```

---

## API Reference

### useFocusMode Hook

#### State Properties

**isActive**: `boolean`
- Whether focus mode is currently active
- Default: `false`

**threadId**: `string | null`
- ID of the focused thread
- `null` when not in focus mode

**timerDuration**: `number`
- Total timer duration in seconds
- Default: `1500` (25 minutes)

**elapsedTime**: `number`
- Elapsed time in seconds
- Range: `0` to `timerDuration`

**breaksDue**: `number`
- Number of breaks due
- Increments after each completed session

**isPaused**: `boolean`
- Whether timer is currently paused
- Default: `false`

**isRunning**: `boolean`
- Computed: `isActive && !isPaused`
- Whether timer is actively running

**remainingTime**: `number`
- Computed: `timerDuration - elapsedTime`
- Time remaining in seconds

**progress**: `number`
- Computed: `(elapsedTime / timerDuration) * 100`
- Progress percentage (0-100)

**focusDigest**: `string | null`
- Post-session summary
- Set after session completes

#### Action Methods

**startFocusMode(threadId, duration?)**
```typescript
function startFocusMode(
  threadId: string,
  duration?: number
): void
```
- Starts focus mode for specified thread
- Optional duration overrides default
- Saves state to localStorage
- Resets elapsed time to 0

**stopFocusMode()**
```typescript
function stopFocusMode(): void
```
- Stops focus mode immediately
- Clears timer interval
- Increments breaks due if session complete
- Removes localStorage data

**pauseFocusMode()**
```typescript
function pauseFocusMode(): void
```
- Pauses the running timer
- Preserves elapsed time
- Timer can be resumed

**resumeFocusMode()**
```typescript
function resumeFocusMode(): void
```
- Resumes paused timer
- Continues from current elapsed time

**resetFocusMode()**
```typescript
function resetFocusMode(): void
```
- Resets elapsed time to 0
- Unpauses timer
- Keeps focus mode active

**setTimerDuration(duration)**
```typescript
function setTimerDuration(duration: number): void
```
- Sets timer duration in seconds
- Only affects future sessions if currently running

**setFocusDigest(digest)**
```typescript
function setFocusDigest(digest: string | null): void
```
- Sets post-session summary
- Used to display focus digest modal

---

## Usage Examples

### Example 1: Basic Focus Mode

```tsx
import { useFocusMode } from '@/contexts/FocusModeContext';

function MessagesHeader() {
  const { isActive, startFocusMode, stopFocusMode } = useFocusMode();
  const activeThreadId = useActiveThreadId();

  const handleToggleFocus = () => {
    if (isActive) {
      stopFocusMode();
    } else {
      startFocusMode(activeThreadId);
    }
  };

  return (
    <button onClick={handleToggleFocus}>
      {isActive ? 'Exit Focus' : 'Focus Mode'}
    </button>
  );
}
```

### Example 2: Custom Duration

```tsx
function FocusModeSettings() {
  const { startFocusMode, setTimerDuration } = useFocusMode();
  const [duration, setDuration] = useState(25);

  const handleStart = () => {
    setTimerDuration(duration * 60); // Convert minutes to seconds
    startFocusMode(activeThreadId, duration * 60);
  };

  return (
    <div>
      <select value={duration} onChange={e => setDuration(Number(e.target.value))}>
        <option value={5}>5 minutes</option>
        <option value={15}>15 minutes</option>
        <option value={25}>25 minutes (Pomodoro)</option>
        <option value={45}>45 minutes</option>
        <option value={60}>60 minutes</option>
      </select>
      <button onClick={handleStart}>Start Focus</button>
    </div>
  );
}
```

### Example 3: Timer Display

```tsx
function FocusTimer() {
  const {
    isActive,
    isRunning,
    isPaused,
    remainingTime,
    progress,
    pauseFocusMode,
    resumeFocusMode,
    stopFocusMode
  } = useFocusMode();

  if (!isActive) return null;

  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;

  return (
    <div className="focus-timer">
      <div className="time-display">
        {minutes}:{String(seconds).padStart(2, '0')}
      </div>
      <div className="progress-bar">
        <div style={{ width: `${progress}%` }} />
      </div>
      <div className="controls">
        {isPaused ? (
          <button onClick={resumeFocusMode}>Resume</button>
        ) : (
          <button onClick={pauseFocusMode}>Pause</button>
        )}
        <button onClick={stopFocusMode}>Stop</button>
      </div>
    </div>
  );
}
```

### Example 4: Distraction-Free UI

```tsx
function Messages() {
  const { isActive, threadId } = useFocusMode();

  return (
    <div className={`messages ${isActive ? 'focus-mode' : ''}`}>
      {/* Hide sidebar in focus mode */}
      {!isActive && <Sidebar />}

      {/* Show only focused thread */}
      {isActive ? (
        <Conversation threadId={threadId!} />
      ) : (
        <MessagesSplitView />
      )}

      {/* Hide tools panel in focus mode */}
      {!isActive && <ToolsPanel />}

      {/* Always show focus timer overlay */}
      <FocusTimer />
    </div>
  );
}
```

### Example 5: Focus Digest

```tsx
function FocusDigestModal() {
  const { focusDigest, setFocusDigest, elapsedTime } = useFocusMode();

  if (!focusDigest) return null;

  return (
    <div className="modal">
      <h2>Focus Session Complete!</h2>
      <p>Duration: {Math.floor(elapsedTime / 60)} minutes</p>
      <div className="digest">{focusDigest}</div>
      <button onClick={() => setFocusDigest(null)}>Close</button>
    </div>
  );
}
```

---

## Configuration

### Default Settings

```typescript
{
  defaultDuration: 25 * 60,        // 25 minutes (Pomodoro)
  shortBreak: 5 * 60,              // 5 minutes
  longBreak: 15 * 60,              // 15 minutes
  sessionsUntilLongBreak: 4,       // After 4 sessions
  enableNotifications: true,        // Browser notifications
  enablePersistence: true,          // localStorage
  autoStartBreak: false            // Auto-start break timer
}
```

### Customization

**Modify default duration**:
```tsx
const FocusModeProvider = ({ defaultDuration = 25 * 60, children }) => {
  const [timerDuration, setTimerDuration] = useState(defaultDuration);
  // ...
};
```

**Disable notifications**:
```tsx
// In FocusModeContext.tsx, comment out:
// if ('Notification' in window && Notification.permission === 'granted') {
//   new Notification('Focus Session Complete!', { ... });
// }
```

**Change persistence key**:
```tsx
// Change localStorage key
localStorage.setItem('customFocusModeKey', JSON.stringify(data));
```

---

## Best Practices

### 1. Use Standard Durations

**Recommended**:
- 25 minutes (Pomodoro standard)
- 45 minutes (extended focus)
- 90 minutes (ultradian cycle)

**Why**: Based on cognitive science and productivity research

### 2. Take Regular Breaks

**Break Pattern**:
- After 25 min: 5-minute break
- After 4 sessions: 15-30 minute break

**Benefits**: Prevents burnout, maintains focus quality

### 3. Focus on One Thread

**Best Practice**: Focus on single thread or conversation

**Avoid**: Switching between threads during focus

### 4. Minimize Interruptions

**Before Starting**:
- Set status to "Focusing"
- Notify team members
- Close other apps
- Silence phone

### 5. Review Focus Digest

**After Session**:
- Review missed messages
- Identify action items
- Respond to urgent items
- Plan next session

---

## Troubleshooting

### Timer Not Starting

**Problem**: Click "Focus Mode" but timer doesn't start

**Solutions**:
1. Verify active thread is selected
2. Check browser console for errors
3. Ensure FocusModeProvider wraps component
4. Clear localStorage and try again

### Timer Not Persisting

**Problem**: Timer resets on page refresh

**Solutions**:
1. Check localStorage is enabled
2. Verify localStorage key: `focusMode`
3. Check for JSON parse errors in console
4. Ensure timer hasn't expired

### Notifications Not Showing

**Problem**: No notification when session completes

**Solutions**:
1. Check notification permission granted
2. Enable notifications in browser settings
3. Test notification permission: `Notification.permission`
4. Verify notification code is not commented out

### Progress Bar Inaccurate

**Problem**: Progress doesn't match elapsed time

**Solutions**:
1. Check `timerDuration` is set correctly
2. Verify `elapsedTime` increments every second
3. Check for timer interval cleanup issues
4. Reset timer and try again

### Focus Mode Won't Stop

**Problem**: Can't exit focus mode

**Solutions**:
1. Click "Stop" button multiple times
2. Refresh page (state will restore if not expired)
3. Clear localStorage: `localStorage.removeItem('focusMode')`
4. Check for JavaScript errors

---

## Related Documentation

- [Messages Architecture](./MESSAGES_ARCHITECTURE.md) - System design
- [Component API](./COMPONENT_API.md) - Component props
- [User Guide](./USER_GUIDE.md) - User instructions
- [Keyboard Shortcuts](./KEYBOARD_SHORTCUTS.md) - Shortcuts reference

---

**Document Version**: 1.0
**Last Updated**: 2026-01-19
**Maintained By**: Pulse Engineering Team
**License**: Proprietary
