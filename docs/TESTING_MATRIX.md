# Pulse App - Team Testing Matrix

## Pre-Testing Setup Checklist

### Environment Configuration
- [ ] Set `VITE_APP_MODE=production` in `.env` to disable mock fallbacks
- [ ] Verify Supabase connection is working (check browser console)
- [ ] Run `npm run dev` and confirm app starts without errors
- [ ] Clear localStorage before testing (`localStorage.clear()` in console)

### Supabase Dashboard Checks
- [ ] Verify Authentication providers are enabled (Google, Email)
- [ ] Check Row Level Security (RLS) policies are configured
- [ ] Verify required tables exist (contacts, tasks, calendar_events, emails)

---

## Testing Matrix

### 1. AUTHENTICATION (Priority: CRITICAL)

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| Google OAuth Login | 1. Click "Continue with Google"<br>2. Complete Google auth | User redirected back, logged in, Dashboard shown | | |
| Microsoft OAuth Login | 1. Click "Continue with Microsoft"<br>2. Complete MS auth | User redirected back, logged in, Dashboard shown | | |
| Email Signup | 1. Click "Sign in with Email"<br>2. Click "Create an account"<br>3. Fill form, submit | Account created, user logged in | | |
| Email Login | 1. Click "Sign in with Email"<br>2. Enter credentials, submit | User logged in, Dashboard shown | | |
| Invalid Email Login | 1. Enter wrong password | Error message displayed | | |
| Session Persistence | 1. Login<br>2. Refresh page | User remains logged in | | |
| Logout | 1. Go to Settings<br>2. Logout (if button exists) | User logged out, Login screen shown | | |

---

### 2. DASHBOARD (Priority: HIGH)

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| Dashboard Load | Navigate to Dashboard | Dashboard loads with widgets | | |
| Quick Stats Display | View dashboard stats | Shows tasks, messages, focus time | | |
| Task Widget | View task section | Tasks from database displayed | | |
| Calendar Widget | View calendar section | Events from database displayed | | |
| Navigation | Click each nav item | Correct view loads | | |

---

### 3. CONTACTS (Priority: HIGH)

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| View Contacts | Navigate to Contacts | Contact list displayed | | |
| Create Contact | Click Add, fill form, save | New contact appears in list | | |
| Edit Contact | Click contact, edit, save | Changes persisted | | |
| Delete Contact | Delete a contact | Contact removed from list | | |
| Search Contacts | Type in search bar | Filtered results shown | | |
| Contact Actions | Click message/call buttons | Navigates to correct feature | | |

---

### 4. TASKS (Priority: HIGH)

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| View Tasks | Navigate to Calendar/Tasks | Task list displayed | | |
| Create Task | Click New Task, fill, save | Task appears in list | | |
| Complete Task | Check/uncheck task | Status updates, persists on refresh | | |
| Edit Task | Click task, modify, save | Changes persisted | | |
| Delete Task | Delete a task | Task removed | | |
| Task Priority | Set different priorities | Visual indicator changes | | |
| Real-time Updates | Create task in another tab | Task appears in first tab | | |

---

### 5. CALENDAR (Priority: HIGH)

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| View Calendar | Navigate to Calendar | Calendar displayed with events | | |
| Create Event | Click date, fill form, save | Event appears on calendar | | |
| Edit Event | Click event, modify, save | Changes persisted | | |
| Delete Event | Delete an event | Event removed from calendar | | |
| Month Navigation | Click prev/next month | Calendar updates correctly | | |
| Quick Scheduler | Use quick scheduler widget | Event created successfully | | |

---

### 6. MESSAGES (Priority: HIGH)

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| View Messages | Navigate to Messages | Message threads displayed | | |
| Open Thread | Click a thread | Messages shown | | |
| Send Message | Type and send message | Message appears in thread | | |
| Real-time Receive | Receive message from another user | Message appears immediately | | |
| Search Messages | Use search function | Relevant messages found | | |
| Message Status | Send message | Shows sent/delivered status | | |

---

### 7. EMAIL (Priority: MEDIUM)

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| View Email | Navigate to Email | Email inbox displayed | | |
| Read Email | Click an email | Email content shown | | |
| Compose Email | Click compose | Email composer opens | | |
| Send Email | Compose and send | Email sent (if connected) | | |
| Star Email | Click star icon | Email starred | | |
| Folder Navigation | Click different folders | Correct emails shown | | |

---

### 8. AI FEATURES (Priority: MEDIUM)

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| Live AI Session | Start Live AI session | Audio/video interface loads | | |
| Gemini Chat | Ask a question | AI responds | | |
| Research (Perplexity) | Navigate to Research, query | Search results displayed | | |
| AI Lab Tools | Try each AI Lab tool | Tools function correctly | | |

---

### 9. INTEGRATIONS (Priority: MEDIUM)

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| Slack Messages | View Slack integration | Slack messages displayed | | |
| Calendar Sync | Check calendar sync status | Shows sync indicator if connected | | |
| Contact Import | Import contacts from provider | Contacts imported to database | | |

---

### 10. SETTINGS (Priority: LOW)

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| Theme Toggle | Switch dark/light mode | Theme changes, persists | | |
| Profile View | View profile section | User info displayed | | |
| Provider Connect | Connect additional provider | Connection flow starts | | |

---

## Performance Testing

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| Initial Load Time | Hard refresh app | Dashboard loads in < 3 seconds | | |
| Navigation Speed | Switch between views | View changes in < 1 second | | |
| Data Load | View large contact list | Data loads without UI freeze | | |
| Memory Usage | Use app for 30 mins | No memory leaks (check DevTools) | | |

---

## Error Handling

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| Network Offline | Disable network, use app | Graceful error messages | | |
| Invalid Input | Submit invalid form data | Validation errors shown | | |
| Session Expired | Wait for session timeout | Redirect to login | | |
| API Failure | Simulate API failure | Error toast/message shown | | |

---

## Browser Compatibility

| Browser | Version | Pass/Fail | Notes |
|---------|---------|-----------|-------|
| Chrome | Latest | | |
| Firefox | Latest | | |
| Safari | Latest | | |
| Edge | Latest | | |

---

## Mobile Responsiveness

| Test Case | Device/Width | Pass/Fail | Notes |
|-----------|--------------|-----------|-------|
| Mobile View | 375px | | |
| Tablet View | 768px | | |
| Desktop View | 1280px | | |
| Large Desktop | 1920px | | |

---

## Bug Report Template

```
**Bug Title:** [Brief description]

**Environment:**
- Browser:
- OS:
- App Version:
- User Account:

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**

**Actual Behavior:**

**Screenshots/Console Errors:**

**Severity:** Critical / High / Medium / Low

**Notes:**
```

---

## Sign-Off

| Tester | Date | Areas Tested | Overall Status |
|--------|------|--------------|----------------|
| | | | |
| | | | |
| | | | |

---

## Quick Reference: Key Files

| Feature | Primary File(s) |
|---------|-----------------|
| Authentication | `src/services/authService.ts`, `src/components/Login.tsx` |
| Dashboard | `src/components/Dashboard/` |
| Contacts | `src/components/Contacts.tsx`, `src/services/dataService.ts` |
| Tasks | `src/services/taskService.ts`, `src/components/TaskPanel.tsx` |
| Messages | `src/components/Messages/` |
| Email | `src/components/Email/`, `src/services/enhancedEmailService.ts` |
| AI Features | `src/services/geminiService.ts`, `src/components/LiveSession.tsx` |
| Config | `src/config/appConfig.ts`, `.env` |
