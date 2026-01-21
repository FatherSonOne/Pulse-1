# Sprint 6: Quick Reference Guide

**For Developers** | **Last Updated:** 2026-01-21

---

## 🚀 What Was Built

Sprint 6 adds real-time collaboration and enhanced productivity features to the Decisions & Tasks page.

### Key Features
1. **Real-time Updates** - Live sync across users via Supabase
2. **Persistent Dismissed Nudges** - 24h TTL with localStorage
3. **Task Reassignment Modal** - Quick reassign with contact search
4. **Deadline Extension Dialog** - Fast deadline updates with presets
5. **Connection Status Indicator** - Visual feedback with pulse animation
6. **Undo Functionality** - 5-second window to restore dismissed nudges

---

## 📁 New Files Created

```
src/
├── utils/
│   └── dismissedNudgesStorage.ts          # localStorage manager (139 lines)
└── components/
    └── decisions/
        ├── RealTimeIndicator.tsx          # Connection status (68 lines)
        ├── RealTimeIndicator.css          # Status styles (195 lines)
        ├── ReassignTaskModal.tsx          # Task reassignment (233 lines)
        ├── ReassignTaskModal.css          # Modal styles (316 lines)
        ├── ExtendDeadlineDialog.tsx       # Deadline extension (197 lines)
        └── ExtendDeadlineDialog.css       # Dialog styles (293 lines)

docs/
├── SPRINT_6_TESTING_GUIDE.md              # Comprehensive testing (800+ lines)
├── SPRINT_6_IMPLEMENTATION_SUMMARY.md     # Full documentation
└── SPRINT_6_QUICK_REFERENCE.md            # This file
```

**Total New Code:** ~2,240 lines

---

## 🔧 API Reference

### Dismissed Nudges Storage

```typescript
import {
  getDismissedNudges,
  dismissNudge,
  dismissMultipleNudges,
  undoDismissNudge,
  clearAllDismissedNudges,
  isNudgeDismissed
} from '../utils/dismissedNudgesStorage';

// Get all dismissed nudges (auto-filters expired)
const dismissedSet: Set<string> = getDismissedNudges();

// Dismiss a single nudge
dismissNudge('nudge-id-123');

// Dismiss multiple nudges
dismissMultipleNudges(['id1', 'id2', 'id3']);

// Undo a dismissal
undoDismissNudge('nudge-id-123');

// Check if nudge is dismissed
if (isNudgeDismissed('nudge-id-123')) {
  // Don't show nudge
}

// Clear all dismissals
clearAllDismissedNudges();
```

### RealTimeIndicator Component

```typescript
import { RealTimeIndicator, ConnectionStatus } from './RealTimeIndicator';

// In your component
const [status, setStatus] = useState<ConnectionStatus>('disconnected');

return <RealTimeIndicator status={status} />;

// Status values: 'connected' | 'connecting' | 'disconnected' | 'error'
```

### ReassignTaskModal Component

```typescript
import { ReassignTaskModal } from './ReassignTaskModal';

// State
const [taskToReassign, setTaskToReassign] = useState<Task | null>(null);

// Handler
const handleReassign = async (taskId: string, newAssignee: string) => {
  await taskService.updateTask(taskId, { assigned_to: newAssignee });
  await loadTasks();
};

// Render
{taskToReassign && (
  <ReassignTaskModal
    task={taskToReassign}
    currentAssignee={taskToReassign.assigned_to}
    onClose={() => setTaskToReassign(null)}
    onReassign={handleReassign}
  />
)}
```

### ExtendDeadlineDialog Component

```typescript
import { ExtendDeadlineDialog } from './ExtendDeadlineDialog';

// State
const [taskToExtend, setTaskToExtend] = useState<Task | null>(null);

// Handler
const handleExtend = async (taskId: string, newDeadline: string) => {
  await taskService.updateTask(taskId, { due_date: newDeadline });
  await loadTasks();
};

// Render
{taskToExtend && (
  <ExtendDeadlineDialog
    task={taskToExtend}
    onClose={() => setTaskToExtend(null)}
    onExtend={handleExtend}
  />
)}
```

---

## 🔌 Real-time Subscriptions

### Setting Up Subscriptions

```typescript
import { supabase } from '../../services/supabase';

useEffect(() => {
  if (!workspaceId) return;

  // Subscribe to decisions
  const decisionsChannel = supabase
    .channel('decisions-changes')
    .on(
      'postgres_changes',
      {
        event: '*', // 'INSERT' | 'UPDATE' | 'DELETE' | '*'
        schema: 'public',
        table: 'decisions',
        filter: `workspace_id=eq.${workspaceId}`
      },
      (payload) => {
        console.log('Decision change:', payload);
        // Handle the change
        loadDecisions();
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnectionStatus('connected');
      }
    });

  // Cleanup
  return () => {
    decisionsChannel.unsubscribe();
  };
}, [workspaceId]);
```

### Event Payload Structure

```typescript
interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, any>;      // New record (for INSERT/UPDATE)
  old: Record<string, any>;      // Old record (for UPDATE/DELETE)
  schema: string;
  table: string;
}
```

---

## 🎨 CSS Classes Reference

### RealTimeIndicator

```css
.rt-indicator                  /* Container */
.rt-indicator-connected        /* Green state */
.rt-indicator-connecting       /* Amber state */
.rt-indicator-disconnected     /* Gray state */
.rt-indicator-error            /* Red state */
.rt-indicator-pulse            /* Pulse animation element */
```

### Undo Snackbar

```css
.undo-snackbar                 /* Snackbar container */
.undo-snackbar-button          /* Undo button */
.undo-snackbar-close           /* Close button */
```

### ReassignTaskModal

```css
.reassign-modal-overlay        /* Dark overlay */
.reassign-modal                /* Modal container */
.reassign-modal-header         /* Header section */
.reassign-search-input         /* Search field */
.reassign-contacts-list        /* Contact list */
.reassign-contact-item         /* Individual contact */
.reassign-contact-item.selected /* Selected contact */
```

### ExtendDeadlineDialog

```css
.extend-deadline-overlay       /* Dark overlay */
.extend-deadline-dialog        /* Dialog container */
.extend-deadline-options       /* Grid of preset options */
.extend-deadline-option        /* Individual option button */
.extend-deadline-option.selected /* Selected option */
.extend-deadline-preview       /* Preview section */
```

---

## 🧪 Quick Testing Commands

### Test Real-time Updates

```sql
-- In Supabase SQL Editor

-- Update a decision
UPDATE decisions
SET title = 'Updated Title ' || NOW()
WHERE id = 'your-decision-id';

-- Update a task
UPDATE tasks
SET status = 'done'
WHERE id = 'your-task-id';

-- Insert a vote
INSERT INTO decision_votes (decision_id, user_id, vote_option)
VALUES ('decision-id', 'user-id', 'approve');
```

### Test localStorage Persistence

```javascript
// In Browser Console

// Check dismissed nudges
localStorage.getItem('pulse-dismissed-nudges');

// Manually set dismissal (for testing)
localStorage.setItem('pulse-dismissed-nudges', JSON.stringify([
  { id: 'test-nudge-1', dismissedAt: Date.now() }
]));

// Clear all dismissals
localStorage.removeItem('pulse-dismissed-nudges');

// Test expired dismissal (25 hours ago)
const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000);
localStorage.setItem('pulse-dismissed-nudges', JSON.stringify([
  { id: 'expired-nudge', dismissedAt: oldTimestamp }
]));
// Refresh page - should be auto-cleared
```

---

## 🐛 Debugging Tips

### Check Real-time Connection

```javascript
// In Browser Console
supabase.getChannels(); // See all active channels

// Check connection status
console.log('Channels:', supabase.getChannels().map(c => ({
  topic: c.topic,
  state: c.state
})));
```

### Monitor Real-time Events

```typescript
// Add debug logging in DecisionTaskHub
const handleDecisionChange = (payload: any) => {
  console.log('📊 Decision change:', {
    event: payload.eventType,
    table: payload.table,
    new: payload.new,
    old: payload.old
  });
  // ... rest of handler
};
```

### Check localStorage Usage

```javascript
// In Browser Console

// Check size of stored data
const stored = localStorage.getItem('pulse-dismissed-nudges');
console.log('Storage size:', new Blob([stored]).size, 'bytes');
console.log('Dismissed count:', JSON.parse(stored || '[]').length);

// Check for expired entries
const dismissed = JSON.parse(stored || '[]');
const now = Date.now();
const cutoff = now - (24 * 60 * 60 * 1000);
const expired = dismissed.filter(d => d.dismissedAt < cutoff);
console.log('Expired dismissals:', expired.length);
```

---

## 🔥 Common Issues & Solutions

### Issue: Real-time not working

**Symptoms:** Changes in Supabase don't appear automatically

**Solutions:**
1. Check connection status indicator - should show "Live"
2. Verify workspace ID is correct
3. Check console for subscription errors
4. Ensure RLS policies allow current user to read data
5. Check Supabase Dashboard → Settings → API → Realtime is enabled

### Issue: Dismissed nudges not persisting

**Symptoms:** Dismissed nudges reappear after page refresh

**Solutions:**
1. Check browser console for localStorage errors
2. Verify localStorage is enabled (not in private browsing)
3. Check `pulse-dismissed-nudges` key exists
4. Verify JSON is valid in localStorage

### Issue: Modals not opening

**Symptoms:** Click action button, nothing happens

**Solutions:**
1. Check console for errors
2. Verify task/decision object exists
3. Check modal state is being set correctly
4. Verify modal component is imported
5. Check if modal is already open (z-index issue)

### Issue: Undo button doesn't work

**Symptoms:** Click undo, nudge doesn't reappear

**Solutions:**
1. Check if 5-second window has expired
2. Verify `lastDismissedNudge` state is set
3. Check `undoDismissNudge` is being called
4. Verify `generateNudges` is called after undo
5. Check dismissed state is updated

---

## 📊 Performance Tips

### Optimize Real-time Updates

```typescript
// Debounce rapid updates
const [updateTimer, setUpdateTimer] = useState<NodeJS.Timeout>();

const handleChange = useCallback((payload: any) => {
  if (updateTimer) clearTimeout(updateTimer);

  const timer = setTimeout(() => {
    loadData();
    regenerateMetrics();
  }, 500); // Wait 500ms before updating

  setUpdateTimer(timer);
}, [updateTimer]);
```

### Reduce Re-renders

```typescript
// Use useCallback for handlers
const handleReassign = useCallback(async (taskId: string, assignee: string) => {
  await taskService.updateTask(taskId, { assigned_to: assignee });
}, []);

// Use useMemo for filtered data
const filteredNudges = useMemo(() => {
  return nudges.filter(n => !dismissedNudges.has(n.id));
}, [nudges, dismissedNudges]);
```

### Optimize localStorage

```typescript
// Batch operations when possible
const dismissMultiple = (ids: string[]) => {
  const dismissed = getDismissedNudges();
  ids.forEach(id => dismissed.add(id));
  // Single write instead of multiple
  localStorage.setItem('pulse-dismissed-nudges', JSON.stringify(
    Array.from(dismissed).map(id => ({ id, dismissedAt: Date.now() }))
  ));
};
```

---

## 🎯 Best Practices

### Real-time Subscriptions

1. **Always clean up subscriptions** in useEffect return
2. **Filter by workspace** to reduce unnecessary events
3. **Debounce rapid updates** to prevent UI thrashing
4. **Handle connection errors** gracefully
5. **Show connection status** to users

### localStorage

1. **Always validate data** when reading from localStorage
2. **Handle parse errors** with try-catch
3. **Implement TTL** to prevent stale data
4. **Keep data minimal** (store IDs, not full objects)
5. **Clean up expired data** on read

### Modals

1. **Close on Esc key press**
2. **Close on overlay click**
3. **Focus management** (auto-focus first input)
4. **Loading states** during async operations
5. **Error messages** with retry options

---

## 📖 Additional Resources

- **Full Documentation:** `docs/SPRINT_6_IMPLEMENTATION_SUMMARY.md`
- **Testing Guide:** `docs/SPRINT_6_TESTING_GUIDE.md`
- **Supabase Realtime Docs:** https://supabase.com/docs/guides/realtime
- **React Hooks Docs:** https://react.dev/reference/react

---

## 🚦 Next Steps

1. **Test thoroughly** using `SPRINT_6_TESTING_GUIDE.md`
2. **Write unit tests** for utilities and components
3. **Performance profiling** with React DevTools
4. **Accessibility audit** with WAVE or axe
5. **User testing** with real stakeholders

---

## ✅ Checklist for Integration

Before deploying Sprint 6 changes:

- [ ] All new components imported correctly
- [ ] Real-time subscriptions set up in DecisionTaskHub
- [ ] localStorage utilities work in all browsers
- [ ] Modals open and close smoothly
- [ ] Connection indicator shows correct status
- [ ] Undo functionality tested
- [ ] Dark mode verified on all components
- [ ] Mobile responsive layout tested
- [ ] Console errors checked and resolved
- [ ] Performance benchmarks met

---

**Questions?** Check the full documentation or testing guide for detailed information.

**Report Issues:** Add to project issue tracker with "Sprint 6" label.

---

*Last Updated: 2026-01-21 by Backend Architect Agent*
