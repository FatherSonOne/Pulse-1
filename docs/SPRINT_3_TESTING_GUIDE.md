# Sprint 3: Enhanced Decision Cards - Testing Guide

**Sprint:** Sprint 3 - AI-Enhanced Decisions & Tasks
**Date:** 2026-01-21
**Status:** Ready for Testing

---

## Quick Start Testing

### Prerequisites

1. **Gemini API Key:**
   - Go to Settings
   - Add your Gemini API key
   - This enables AI risk assessment and task generation

2. **Sample Data:**
   - Database should have sample decisions (see `docs/sample_data_WORKING.sql`)
   - At least one decision in each status: proposed, voting, decided

3. **Browser:**
   - Chrome, Firefox, or Edge
   - Dev tools open for console logging

---

## Test Scenarios

### Test 1: AI Risk Assessment Badge

**Objective:** Verify risk badge displays correctly for voting decisions

**Steps:**
1. Navigate to Decisions & Tasks page
2. Find a decision with status "voting"
3. Look for risk badge next to status badge

**Expected Results:**
- Risk badge appears with color coding:
  - Low risk: Green background, CheckCircle icon
  - Medium risk: Amber background, Info icon
  - High risk: Red background, AlertTriangle icon
- Hover shows reasoning tooltip
- Badge does NOT appear for decided/cancelled decisions

**Console Logs:**
```
🔍 Loading decisions for workspace: [workspace-id]
✅ Loaded decisions: [count]
```

**Screenshot Locations:**
- Risk badge: Top of decision card, after status badge

---

### Test 2: Stakeholder Suggestions

**Objective:** Verify stakeholder chips display when AI has suggested them

**Steps:**
1. Find a decision with `ai_suggested_stakeholders` populated
2. Look for stakeholder section below decision meta

**Expected Results:**
- Section titled "AI-suggested stakeholders:" with Users icon
- Circular avatars with initials
- Names displayed next to avatars
- Rose/pink gradient on avatar backgrounds
- Hover effect on chips (background changes to rose tint)

**Database Check:**
```sql
SELECT title, ai_suggested_stakeholders
FROM decisions
WHERE ai_suggested_stakeholders IS NOT NULL;
```

**Visual Elements:**
- Avatar circles: 24px diameter
- Gradient: #f43f5e → #ec4899
- White text for initials

---

### Test 3: AI Recommendations

**Objective:** Verify recommendations display for medium/high risk decisions

**Steps:**
1. Find a decision with medium or high risk
2. Look for "AI Recommendations" panel below stakeholders

**Expected Results:**
- Purple-tinted panel with Sparkles icon
- Up to 2 recommendations displayed as bullet list
- Recommendations are contextual to the decision
- Panel does NOT appear for low-risk decisions

**API Verification:**
- Check console for Gemini API call
- Verify response contains `recommendations` array

---

### Test 4: Send Reminder Button

**Objective:** Test reminder functionality for voting decisions

**Steps:**
1. Find a decision with status "voting"
2. Scroll to action buttons at bottom of card
3. Click "Send Reminder" button

**Expected Results:**
- Button appears with Bell icon
- Blue background color (#3b82f6)
- Click shows alert: "Reminder sent for: [decision title]"
- Alert explains this will send notifications in production
- Button does NOT appear for decided/cancelled decisions

**Visual Verification:**
- Button position: Left side of action buttons row
- Hover effect: Darker blue background
- Icon size: 16px

---

### Test 5: Generate Tasks from Decision

**Objective:** Test AI task generation for decided decisions

**Steps:**
1. Find a decision with status "decided"
2. Scroll to action buttons
3. Click "Generate Tasks" button (rose/pink gradient)
4. Wait for spinner to complete

**Expected Results:**
- Button appears ONLY for decided decisions
- Rose/pink gradient background
- Click shows loading spinner
- Success alert: "Successfully generated [X] tasks from this decision!"
- Alert prompts to switch to Tasks tab
- Tasks appear in Tasks view with:
  - `decision_id` in metadata
  - `generated_by_ai: true` flag
  - Proper workspace association

**Console Verification:**
```
🔍 Generating tasks from decision...
✅ Created [count] tasks
```

**Database Verification:**
```sql
SELECT id, title, metadata->>'decision_id' as decision_id,
       metadata->>'generated_by_ai' as ai_generated
FROM tasks
WHERE metadata->>'generated_by_ai' = 'true';
```

**Error Cases:**
- No Gemini API key: Alert prompts to add key
- Wrong status: Alert says "Tasks can only be generated from decided decisions"
- API failure: Alert says "Failed to generate tasks. Please try again."

---

### Test 6: View Mission Button

**Objective:** Test Decision Mission modal integration

**Steps:**
1. Find any decision (any status)
2. Click "View Mission" button
3. Check modal content

**Expected Results:**
- Modal opens with decision title in header
- Initial context message from AI:
  ```
  I've loaded the decision: "[decision title]"
  Status: [status]
  Type: [type]

  How can I help you with this decision?
  ```
- Can send messages about the decision
- Close button works
- Overlay click closes modal

**Visual Verification:**
- Modal title: "Decision: [title]" (not "Create Decision with AI")
- Purple-tinted button (#8b5cf6)
- Button appears for all decision statuses

---

### Test 7: Predicted Completion Badge

**Objective:** Verify predicted completion date display

**Steps:**
1. Find a decision with `ai_predicted_completion` field populated
2. Look for badge with Clock icon

**Expected Results:**
- Badge displays date in localized format
- Blue background color
- Only shows for voting decisions
- Positioned after risk badge

**Database Check:**
```sql
SELECT title, ai_predicted_completion
FROM decisions
WHERE ai_predicted_completion IS NOT NULL;
```

---

### Test 8: Dark Mode

**Objective:** Verify all AI features work in dark mode

**Steps:**
1. Toggle dark mode in app settings
2. Review all decision cards

**Expected Results:**
- Risk badges maintain color visibility
- Stakeholder chips have dark background (#171717)
- Recommendations panel has dark purple tint
- Action buttons have dark backgrounds
- Text contrast meets accessibility standards

**Visual Verification:**
- Background colors adjusted for dark theme
- Border colors use transparency for blend
- Text remains readable

---

### Test 9: Mobile Responsive

**Objective:** Test responsive design on mobile viewports

**Steps:**
1. Open Chrome DevTools
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select iPhone or Android device
4. Navigate through decision cards

**Expected Results:**
- Stakeholder chips stack vertically
- Action buttons stack vertically
- AI badges scale down (smaller font, padding)
- All text remains readable
- No horizontal scroll
- Touch targets are adequate (min 44px)

**Viewports to Test:**
- iPhone SE (375px)
- iPhone 12 Pro (390px)
- iPad (768px)
- Desktop (1920px)

---

### Test 10: Build and Deploy

**Objective:** Verify production build works

**Steps:**
```bash
npm run build
npm run preview
```

**Expected Results:**
- Build completes with no errors
- All TypeScript compiles successfully
- CSS bundles properly
- Preview server runs without issues
- All features work in production mode

**Build Verification:**
```
✓ built in [time]
dist/index.html
dist/assets/EnhancedDecisionCard-[hash].css
dist/assets/index-[hash].js
```

---

## Performance Testing

### Load Time

**Objective:** Ensure AI features don't slow down page

**Steps:**
1. Open Chrome DevTools Performance tab
2. Start recording
3. Navigate to Decisions & Tasks page
4. Stop recording after page loads

**Expected Results:**
- Total load time < 3 seconds
- Risk assessment API calls in background (non-blocking)
- Cards render immediately with data
- Loading states show for async operations

### API Call Volume

**Objective:** Verify efficient API usage

**Steps:**
1. Open Network tab
2. Filter by "gemini" or API endpoint
3. Load Decisions & Tasks page

**Expected Results:**
- Risk assessment: 1 call per voting/proposed decision
- Task generation: 1 call per button click
- No redundant API calls
- Proper error handling on failures

---

## Accessibility Testing

### Keyboard Navigation

**Steps:**
1. Use Tab key to navigate through cards
2. Use Enter/Space to activate buttons

**Expected Results:**
- All action buttons keyboard accessible
- Focus visible on all interactive elements
- Proper tab order (top to bottom)
- No keyboard traps

### Screen Reader

**Steps:**
1. Enable screen reader (NVDA, VoiceOver, or JAWS)
2. Navigate through decision cards

**Expected Results:**
- All text announced properly
- Button purposes clear
- Risk levels announced
- Stakeholder names read correctly

### Color Contrast

**Steps:**
1. Use browser contrast checker
2. Check all text against backgrounds

**Expected Results:**
- Text contrast ratio ≥ 4.5:1 (AA standard)
- Risk badge text readable on colored backgrounds
- Dark mode maintains proper contrast

---

## Error Handling Testing

### No API Key

**Steps:**
1. Remove Gemini API key from localStorage
2. Try to generate tasks

**Expected Results:**
- Clear alert: "Please add your Gemini API key in settings to use AI task generation."
- No console errors
- No broken UI

### API Failure

**Steps:**
1. Use invalid API key
2. Try AI features

**Expected Results:**
- Graceful fallback for risk assessment (low risk)
- Error alert for task generation
- Console shows error but app continues

### Network Offline

**Steps:**
1. Open DevTools Network tab
2. Set to "Offline"
3. Try to load decisions

**Expected Results:**
- Loading state appears
- Error message shown
- Retry option available
- No app crash

---

## Integration Testing

### End-to-End Flow

**Scenario:** User creates decision, gets AI insights, generates tasks

**Steps:**
1. Click "Create Decision" in header
2. Use Decision Mission to create decision
3. Set status to "voting"
4. Verify risk assessment appears
5. Vote on decision
6. Change status to "decided"
7. Click "Generate Tasks"
8. Switch to Tasks tab
9. Verify generated tasks appear

**Expected Results:**
- Entire flow completes without errors
- Data persists across page refreshes
- Tasks properly linked to decision
- All AI insights accurate

---

## Regression Testing

### Existing Features

**Verify these still work:**
- [ ] Basic decision card voting
- [ ] Vote results display
- [ ] Status badges
- [ ] Decided decisions show final decision
- [ ] Filter by status works
- [ ] Refresh button updates data
- [ ] Empty states display
- [ ] Loading states show correctly

---

## Console Debugging

### Expected Console Logs

**On Page Load:**
```
🔍 Loading decisions for workspace: [id]
✅ Loaded decisions: [count]
🔢 Generating metrics from decisions: [count]
📊 Metrics generated: {velocityPerWeek: X, ...}
🔔 Generating nudges from: [X] decisions and [Y] tasks
```

**On Risk Assessment:**
```
Loading AI risk assessment for decision: [id]
Risk assessment complete: {riskLevel: "medium", ...}
```

**On Task Generation:**
```
Generating tasks from decision: [id]
Created task: [task-id]
Successfully generated [count] tasks
```

### Error Logs to Watch For

**Should NOT see:**
```
❌ TypeError: Cannot read property 'X' of undefined
❌ Uncaught promise rejection
❌ Failed to fetch
```

**Should see (with proper handling):**
```
⚠️ No Gemini API key found, skipping risk assessment
⚠️ Failed to generate tasks: [error message]
```

---

## Database Verification

### Check Data Structure

**Decisions Table:**
```sql
SELECT
  title,
  status,
  ai_risk_level,
  ai_predicted_completion,
  ai_suggested_stakeholders,
  ai_insights
FROM decisions
WHERE status = 'voting'
LIMIT 5;
```

**Tasks Table:**
```sql
SELECT
  id,
  title,
  metadata->>'decision_id' as decision_id,
  metadata->>'generated_by_ai' as ai_generated,
  metadata->>'estimated_duration' as duration
FROM tasks
WHERE metadata->>'generated_by_ai' = 'true'
LIMIT 5;
```

---

## Bug Reporting Template

**If you find issues, report with:**

```markdown
### Bug Report

**Feature:** [e.g., Generate Tasks button]
**Severity:** [Critical/High/Medium/Low]
**Browser:** [Chrome 120, Firefox 121, etc.]

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshots:**
[Attach if applicable]

**Console Errors:**
[Copy/paste any errors]

**Additional Context:**
[Anything else relevant]
```

---

## Success Criteria

### All Tests Passing

- [ ] All 10 test scenarios complete successfully
- [ ] Performance metrics within targets
- [ ] Accessibility checks pass
- [ ] Error handling works correctly
- [ ] Integration flow completes end-to-end
- [ ] No regressions in existing features
- [ ] Console logs are clean (no errors)
- [ ] Database data is correct

### Ready for Production

When all tests pass:
1. Create git commit
2. Push to staging environment
3. Run final smoke tests
4. Deploy to production
5. Monitor for 24 hours

---

## Quick Reference

### Test Data Setup

**Minimal test data needed:**
```sql
-- 1 proposed decision (for testing without AI)
-- 1 voting decision (for risk assessment)
-- 1 decided decision (for task generation)
-- 3-5 contacts (for stakeholder suggestions)
```

### API Keys Required

- Gemini API key (for AI features)
- OpenAI API key (for Decision Mission)

### Files Modified

- `src/components/decisions/EnhancedDecisionCard.tsx`
- `src/components/decisions/EnhancedDecisionCard.css`
- `src/components/decisions/DecisionTaskHub.tsx`

### Related Services

- `src/services/decisionAnalyticsService.ts`
- `src/services/taskIntelligenceService.ts`
- `src/services/taskService.ts`

---

**Testing Start:** [Your timestamp]
**Tester:** [Your name]
**Build Version:** 28.1.0
**Sprint:** 3 of 7
