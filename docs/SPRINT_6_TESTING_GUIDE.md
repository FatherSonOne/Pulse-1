# Sprint 6: Proactive Features Enhancement - Testing Guide

**Date:** 2026-01-21
**Sprint:** Sprint 6 of 7
**Status:** Implementation Complete - Ready for Testing

---

## Overview

Sprint 6 implements real-time updates and enhanced proactive features for the AI-Enhanced Decisions & Tasks page. This guide provides comprehensive testing procedures to verify all functionality works as expected.

---

## Features Implemented

### 1. Real-time Updates via Supabase Subscriptions
- Live subscriptions to `decisions`, `tasks`, and `decision_votes` tables
- Automatic data refresh when changes occur
- Auto-regeneration of metrics and nudges
- Visual connection status indicator with pulse animation

### 2. Dismissible Notifications with Persistence
- localStorage-based persistence with 24-hour TTL
- Dismissed nudges persist across browser sessions
- Automatic cleanup of expired dismissals
- "Undo dismiss" snackbar notification
- "Dismiss all" functionality

### 3. Enhanced Action Handling for Nudges
- **Send Reminder** - Placeholder for email/notification system
- **Review Decision** - Navigate to decision detail and open Mission modal
- **Reassign Task** - Opens task reassignment modal with contact search
- **Extend Deadline** - Quick deadline extension dialog with presets
- **View Details** - Navigate to item detail view

### 4. New UI Components
- `RealTimeIndicator` - Connection status with pulse animation
- `ReassignTaskModal` - Task reassignment with contact search
- `ExtendDeadlineDialog` - Deadline extension with preset options
- Undo snackbar for dismissed nudges

---

## Testing Checklist

### A. Real-time Updates Testing

#### Test 1: Decision Changes
**Objective:** Verify real-time updates when decisions are modified

**Steps:**
1. Open the Decisions & Tasks page in your browser
2. Verify the RealTimeIndicator shows "Live" with green pulse animation
3. Open Supabase Dashboard in another tab/window
4. Navigate to Table Editor → `decisions` table
5. Modify an existing decision (change title, status, or proposal text)
6. **Expected:** Page automatically updates within 1-2 seconds without manual refresh
7. **Expected:** Metrics dashboard updates if relevant (e.g., velocity, stale count)
8. **Expected:** Nudges regenerate if status change affects them

**Success Criteria:**
- ✅ RealTimeIndicator shows "Connected" status
- ✅ Decision updates appear automatically
- ✅ Metrics recalculate automatically
- ✅ No page reload required

#### Test 2: Task Changes
**Objective:** Verify real-time updates when tasks are modified

**Steps:**
1. Open the Decisions & Tasks page
2. Switch to "Tasks" tab
3. Open Supabase Dashboard in another tab
4. Navigate to Table Editor → `tasks` table
5. Modify a task (change status, due date, or assignee)
6. **Expected:** Task list updates automatically
7. **Expected:** Nudges regenerate (e.g., overdue tasks counter updates)
8. **Expected:** Visual feedback shows the change

**Success Criteria:**
- ✅ Tasks update in real-time
- ✅ Nudges reflect new task state
- ✅ Overdue counter updates if applicable

#### Test 3: Vote Changes
**Objective:** Verify real-time updates when votes are cast

**Steps:**
1. Open the Decisions & Tasks page
2. Note current vote count on a decision
3. Open Supabase Dashboard in another tab
4. Navigate to Table Editor → `decision_votes` table
5. Insert a new vote record or delete an existing one
6. **Expected:** Decision card updates vote count automatically
7. **Expected:** Participation rate metric updates
8. **Expected:** Nudges update if vote affects stale decision status

**Success Criteria:**
- ✅ Vote counts update immediately
- ✅ Metrics recalculate
- ✅ No console errors

#### Test 4: Connection Status Indicator
**Objective:** Verify connection status is accurately displayed

**Steps:**
1. Open the Decisions & Tasks page
2. **Expected:** Indicator shows "Connecting..." (amber) briefly
3. **Expected:** Indicator changes to "Live" (green with pulse) when connected
4. Open browser DevTools → Network tab
5. Throttle network to "Offline"
6. **Expected:** Indicator changes to "Offline" (gray)
7. Re-enable network
8. **Expected:** Indicator reconnects and shows "Live" again

**Success Criteria:**
- ✅ All connection states display correctly
- ✅ Pulse animation works in connected state
- ✅ Automatic reconnection after disconnect

---

### B. Dismissed Nudges Persistence Testing

#### Test 5: Dismiss and Persist
**Objective:** Verify dismissed nudges are stored in localStorage

**Steps:**
1. Open the Decisions & Tasks page
2. Wait for nudges to generate (ensure there are 3+ nudges)
3. Click the "X" button to dismiss a specific nudge
4. **Expected:** Nudge disappears immediately
5. **Expected:** "Nudge dismissed" snackbar appears at bottom
6. Open browser DevTools → Application → Local Storage
7. Check for key: `pulse-dismissed-nudges`
8. **Expected:** JSON array with dismissed nudge data including ID and timestamp
9. Refresh the page (F5)
10. **Expected:** Dismissed nudge does NOT reappear
11. **Expected:** Other nudges still visible

**Success Criteria:**
- ✅ Nudge dismissal works immediately
- ✅ localStorage contains dismissed nudge data
- ✅ Dismissed state persists across page reloads
- ✅ Timestamp is stored correctly

#### Test 6: 24-Hour TTL Expiration
**Objective:** Verify dismissed nudges expire after 24 hours

**Steps:**
1. Open browser DevTools → Application → Local Storage
2. Find `pulse-dismissed-nudges` key
3. Manually edit the `dismissedAt` timestamp to 25 hours ago:
   ```json
   [{
     "id": "stale-decision-xxx",
     "dismissedAt": 1642700000000
   }]
   ```
4. Refresh the page
5. **Expected:** Old dismissed nudges are cleared from storage
6. **Expected:** Nudge reappears if condition still applies

**Success Criteria:**
- ✅ Expired dismissals are automatically cleaned up
- ✅ Nudge reappears after expiration
- ✅ Storage is updated with cleaned data

#### Test 7: Undo Dismiss
**Objective:** Verify undo functionality for dismissed nudges

**Steps:**
1. Open the Decisions & Tasks page
2. Dismiss a nudge by clicking "X"
3. **Expected:** "Nudge dismissed" snackbar appears at bottom center
4. **Expected:** Snackbar contains "Undo" button with rose/pink styling
5. Click "Undo" button within 5 seconds
6. **Expected:** Nudge reappears in the list
7. **Expected:** Snackbar disappears
8. **Expected:** localStorage is updated (nudge ID removed)
9. Dismiss another nudge
10. Wait 6 seconds without clicking Undo
11. **Expected:** Snackbar auto-dismisses

**Success Criteria:**
- ✅ Undo button restores dismissed nudge
- ✅ Snackbar auto-dismisses after 5 seconds
- ✅ localStorage is correctly updated

#### Test 8: Dismiss All
**Objective:** Verify "Dismiss all" functionality

**Steps:**
1. Open the Decisions & Tasks page
2. Ensure there are multiple nudges visible (3+)
3. Click the "X" button in the nudges panel header
4. **Expected:** All nudges disappear
5. **Expected:** Nudges panel is hidden
6. Check localStorage → `pulse-dismissed-nudges`
7. **Expected:** All nudge IDs are stored
8. Refresh the page
9. **Expected:** Nudges panel remains hidden (all dismissed)

**Success Criteria:**
- ✅ All nudges dismissed at once
- ✅ All IDs stored in localStorage
- ✅ State persists across sessions

---

### C. Action Handler Testing

#### Test 9: Send Reminder Action
**Objective:** Verify "Send Reminder" action handler

**Steps:**
1. Create a stale decision (no votes in 24h+)
2. Wait for nudge to generate: "Decision has no votes for Xh"
3. Click "Send reminder to voters" button
4. **Expected:** Alert dialog appears with placeholder message
5. **Expected:** Nudge is automatically dismissed after action
6. **Expected:** No console errors

**Success Criteria:**
- ✅ Action triggers correctly
- ✅ Nudge dismissed after action
- ✅ Ready for email integration

#### Test 10: Review Decision Action
**Objective:** Verify "Review Decision" navigation

**Steps:**
1. Ensure there are pending votes nudge or stale decision nudge
2. Click the action button (e.g., "Review and vote")
3. **Expected:** Switches to "Decisions" tab if on Tasks
4. **Expected:** Decision Mission modal opens for specific decision
5. **Expected:** Modal shows decision context
6. **Expected:** Nudge is dismissed

**Success Criteria:**
- ✅ Navigation works correctly
- ✅ Modal opens with decision context
- ✅ Smooth transition

#### Test 11: Reassign Task Action
**Objective:** Verify task reassignment modal and functionality

**Steps:**
1. Create a task or use existing task
2. Generate a nudge related to task assignment (e.g., workload imbalance)
3. Click "Consider redistributing work" or reassign action
4. **Expected:** ReassignTaskModal opens
5. **Expected:** Modal shows current task title and assignee
6. **Expected:** Search field is functional
7. Type in search box
8. **Expected:** Contact list filters dynamically
9. Select a contact from the list
10. **Expected:** Contact is highlighted with checkmark
11. Click "Reassign Task" button
12. **Expected:** Modal closes
13. **Expected:** Task updates in database
14. **Expected:** Task list refreshes automatically via real-time

**Success Criteria:**
- ✅ Modal opens with correct task data
- ✅ Search functionality works
- ✅ Contact selection works
- ✅ Reassignment persists to database
- ✅ Real-time update reflects change

#### Test 12: Extend Deadline Action
**Objective:** Verify deadline extension dialog and functionality

**Steps:**
1. Create an overdue task or task due soon
2. Wait for nudge: "X tasks overdue" or "X tasks due in next 48h"
3. Click action button to extend deadline
4. **Expected:** ExtendDeadlineDialog opens
5. **Expected:** Shows current deadline
6. **Expected:** Shows preset options: +1 Day, +3 Days, +1 Week, +2 Weeks, Custom
7. Select "+3 Days"
8. **Expected:** Preview shows new deadline date/time
9. **Expected:** New date is current deadline + 3 days
10. Click "Extend Deadline" button
11. **Expected:** Dialog closes
12. **Expected:** Task due_date updates in database
13. **Expected:** Task list refreshes via real-time
14. **Expected:** Nudge updates or disappears

**Test Custom Date:**
1. Open extension dialog again
2. Select "Custom Date" option
3. **Expected:** Date picker appears
4. Select a future date
5. **Expected:** Preview updates
6. Click "Extend Deadline"
7. **Expected:** Custom date is saved

**Success Criteria:**
- ✅ Dialog opens with correct task data
- ✅ All preset options work
- ✅ Custom date picker works
- ✅ Preview calculation is accurate
- ✅ Extension persists to database
- ✅ Real-time update reflects change

---

### D. UI/UX Testing

#### Test 13: RealTimeIndicator Visual States
**Objective:** Verify all indicator states display correctly

**States to Test:**
1. **Connected** (green):
   - Background: `rgba(16, 185, 129, 0.15)`
   - Text: `#10b981`
   - Pulse animation visible
   - Shows "Live" label
   - Wifi icon

2. **Connecting** (amber):
   - Background: `rgba(245, 158, 11, 0.15)`
   - Text: `#f59e0b`
   - Gentle pulse animation
   - Shows "Connecting..." label
   - Wifi icon

3. **Disconnected** (gray):
   - Background: `rgba(107, 114, 128, 0.15)`
   - Text: `#6b7280`
   - Shows "Offline" label
   - WifiOff icon

4. **Error** (red):
   - Background: `rgba(239, 68, 68, 0.15)`
   - Text: `#ef4444`
   - Shake animation on error
   - Shows "Error" label
   - AlertCircle icon

**Success Criteria:**
- ✅ All states render with correct colors
- ✅ Animations are smooth
- ✅ Labels are readable
- ✅ Icons are appropriate

#### Test 14: Modal Responsiveness
**Objective:** Verify modals work on different screen sizes

**Steps:**
1. Open ReassignTaskModal
2. Resize browser window to mobile size (375px width)
3. **Expected:** Modal adapts to mobile layout
4. **Expected:** All buttons accessible
5. **Expected:** Scrolling works if content overflows
6. Repeat for ExtendDeadlineDialog
7. Test on tablet size (768px width)

**Success Criteria:**
- ✅ Modals responsive on all screen sizes
- ✅ No horizontal scroll
- ✅ Touch-friendly button sizes
- ✅ Readable text on small screens

#### Test 15: Dark Mode Compatibility
**Objective:** Verify all new components work in dark mode

**Steps:**
1. Enable dark mode in app settings
2. Navigate to Decisions & Tasks page
3. Verify all components:
   - RealTimeIndicator colors are readable
   - ReassignTaskModal has dark background
   - ExtendDeadlineDialog has dark styling
   - Undo snackbar is visible against dark background
   - Nudges panel contrast is sufficient
4. Test all interactions in dark mode

**Success Criteria:**
- ✅ All text is readable
- ✅ Colors have proper contrast
- ✅ Borders are visible
- ✅ Hover states work
- ✅ No white flash on modal open

---

### E. Performance Testing

#### Test 16: Real-time Update Performance
**Objective:** Verify real-time updates don't cause performance issues

**Steps:**
1. Open browser DevTools → Performance tab
2. Start recording
3. Trigger multiple rapid changes in Supabase:
   - Update 3 decisions
   - Update 5 tasks
   - Insert 2 votes
4. Stop recording after 10 seconds
5. Analyze performance profile
6. **Expected:** No significant frame drops
7. **Expected:** Updates complete within 500ms each
8. **Expected:** Memory usage stable (no leaks)

**Success Criteria:**
- ✅ Frame rate stays above 30fps
- ✅ No memory leaks
- ✅ Updates feel instant
- ✅ No blocking operations

#### Test 17: localStorage Performance
**Objective:** Verify localStorage operations don't block UI

**Steps:**
1. Dismiss 20 nudges rapidly (click X repeatedly)
2. **Expected:** UI remains responsive
3. **Expected:** No lag or freezing
4. Check localStorage size
5. **Expected:** Storage size is reasonable (<1KB for 20 dismissals)

**Success Criteria:**
- ✅ No UI blocking
- ✅ Storage operations are async
- ✅ Reasonable storage size

---

### F. Error Handling Testing

#### Test 18: Network Failure Handling
**Objective:** Verify graceful handling of network issues

**Steps:**
1. Open Decisions & Tasks page
2. Wait for connection to establish
3. Open DevTools → Network tab
4. Set throttling to "Offline"
5. **Expected:** Connection status changes to "Offline"
6. Try to reassign a task
7. **Expected:** Error message shows
8. **Expected:** App doesn't crash
9. Re-enable network
10. **Expected:** Auto-reconnects
11. Try reassign again
12. **Expected:** Works successfully

**Success Criteria:**
- ✅ Graceful error messages
- ✅ No app crashes
- ✅ Auto-reconnection works
- ✅ Operations resume after reconnect

#### Test 19: Supabase Connection Error
**Objective:** Verify handling of Supabase connection issues

**Steps:**
1. Temporarily modify Supabase URL in .env.local to invalid value
2. Restart dev server
3. Navigate to Decisions & Tasks page
4. **Expected:** Connection status shows "Error"
5. **Expected:** Helpful error in console
6. **Expected:** Page remains functional (no crash)
7. **Expected:** Manual refresh button still works

**Success Criteria:**
- ✅ Error state is clear
- ✅ App remains stable
- ✅ Helpful error messages

#### Test 20: Invalid Data Handling
**Objective:** Verify handling of malformed data

**Steps:**
1. Open Supabase Dashboard
2. Manually insert invalid task record (missing required fields)
3. **Expected:** Real-time handler catches error
4. **Expected:** Error logged to console
5. **Expected:** App doesn't crash
6. **Expected:** Valid tasks still display

**Success Criteria:**
- ✅ Invalid data doesn't crash app
- ✅ Errors are logged
- ✅ Valid data still works

---

## Manual Testing Scenarios

### Scenario 1: End-to-End Workflow
**Objective:** Test complete real-time workflow

**Story:**
1. User opens Decisions & Tasks page (sees "Live" indicator)
2. Team member creates a new decision in Supabase
3. Decision appears on user's screen automatically
4. User sees nudge: "You have 1 decision waiting for your vote"
5. User clicks "Review and vote" action
6. Decision Mission modal opens
7. User votes, modal closes
8. Metrics update automatically (participation rate increases)
9. Nudge disappears (no pending votes)
10. Another team member marks a task as overdue
11. New nudge appears: "1 task overdue"
12. User clicks action to extend deadline
13. Extension dialog opens, user selects "+3 Days"
14. Deadline extends, task updates in real-time
15. Nudge disappears

**Success Criteria:**
- ✅ All steps execute smoothly
- ✅ No manual refreshes needed
- ✅ Real-time updates feel natural
- ✅ Actions work as expected

### Scenario 2: Multi-Browser Sync
**Objective:** Verify real-time sync across multiple browsers

**Story:**
1. Open same workspace in Chrome and Firefox (same user)
2. Dismiss a nudge in Chrome
3. **Expected:** localStorage only affects Chrome (dismissals are client-side)
4. Modify a decision in Chrome
5. **Expected:** Decision updates in Firefox automatically
6. Reassign a task in Firefox
7. **Expected:** Task updates in Chrome automatically

**Success Criteria:**
- ✅ Data changes sync across browsers
- ✅ Dismissed nudges are per-client
- ✅ No conflicts

---

## Automated Testing Recommendations

### Unit Tests to Write
```typescript
// dismissedNudgesStorage.test.ts
describe('Dismissed Nudges Storage', () => {
  test('stores dismissed nudge with timestamp', () => {
    dismissNudge('test-nudge-123');
    const dismissed = getDismissedNudges();
    expect(dismissed.has('test-nudge-123')).toBe(true);
  });

  test('filters out expired dismissals', () => {
    // Mock localStorage with old timestamp
    // Verify it's filtered out
  });

  test('undo removes from dismissed set', () => {
    dismissNudge('test-nudge-456');
    undoDismissNudge('test-nudge-456');
    const dismissed = getDismissedNudges();
    expect(dismissed.has('test-nudge-456')).toBe(false);
  });
});

// RealTimeIndicator.test.tsx
describe('RealTimeIndicator', () => {
  test('renders connected state with pulse', () => {
    render(<RealTimeIndicator status="connected" />);
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByClassName('rt-indicator-pulse')).toBeInTheDocument();
  });

  test('renders all status states correctly', () => {
    // Test connected, connecting, disconnected, error
  });
});
```

### Integration Tests to Write
```typescript
// DecisionTaskHub.integration.test.tsx
describe('DecisionTaskHub Real-time Integration', () => {
  test('subscribes to Supabase channels on mount', async () => {
    // Mock Supabase
    // Verify subscriptions are created
  });

  test('updates decisions when Supabase event fires', async () => {
    // Mock event payload
    // Verify component re-renders with new data
  });

  test('dismissing nudge persists to localStorage', async () => {
    // Render with nudges
    // Click dismiss
    // Verify localStorage
  });
});
```

---

## Known Limitations

1. **Stakeholder Suggestions from Contacts Table**: Not yet implemented (deferred to future sprint)
2. **Email/Slack Integration**: "Send Reminder" shows placeholder alert
3. **Cross-device Dismissed Nudges**: Dismissals are stored in localStorage (client-side only)
4. **Network Resilience**: Limited retry logic for failed subscriptions

---

## Success Metrics

### Performance Targets
- ✅ Real-time update latency: <2 seconds
- ✅ localStorage read/write: <10ms
- ✅ Modal open animation: 60fps
- ✅ Zero memory leaks over 10-minute session

### Functionality Targets
- ✅ 100% of real-time events trigger updates
- ✅ 100% of dismissed nudges persist across sessions
- ✅ 100% of action handlers execute successfully
- ✅ Zero console errors during normal operation

### User Experience Targets
- ✅ Connection status always visible and accurate
- ✅ Undo functionality works within 5-second window
- ✅ Modals are responsive and accessible
- ✅ Dark mode works perfectly

---

## Bug Reporting Template

If you find issues during testing, please report using this format:

```markdown
**Bug Title:** [Brief description]

**Severity:** [Critical / High / Medium / Low]

**Feature:** [Real-time Updates / Dismissed Nudges / Action Handlers / UI]

**Steps to Reproduce:**
1. Step one
2. Step two
3. ...

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshots/Videos:**
[If applicable]

**Environment:**
- Browser: [Chrome 120 / Firefox 121 / etc.]
- OS: [Windows 11 / macOS 14 / etc.]
- Screen Size: [1920x1080 / Mobile / etc.]

**Console Errors:**
```
[Paste any console errors]
```

**Additional Context:**
[Any other relevant information]
```

---

## Next Steps After Testing

1. ✅ **All Tests Pass**: Mark Sprint 6 as complete, proceed to Sprint 7
2. ⚠️ **Minor Issues Found**: Document as technical debt, proceed with caution
3. ❌ **Critical Issues Found**: Fix immediately before proceeding

---

**Testing Contact:** Backend Architect Agent
**Last Updated:** 2026-01-21
**Version:** 1.0
