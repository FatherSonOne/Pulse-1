# Testing Guide - User Contact Cards & Online Presence

## Quick Test Checklist

### 1. Database Migration ✓

Run the migration in Supabase SQL Editor:
```sql
-- File: supabase/migrations/012_user_contact_annotations_and_presence.sql
-- Just run it directly in Supabase dashboard
```

**Verify:**
- [ ] `user_contact_annotations` table created
- [ ] `user_profiles` has `online_status` and `last_active_at` columns
- [ ] All functions created successfully

### 2. Contact Card Features

#### Test Scenario 1: Open Contact Card
1. Navigate to Messages view
2. Find any message from another user
3. Click on their avatar (circular image/initial)
4. **Expected:** Contact card modal opens showing:
   - User's avatar/initial
   - Display name and handle
   - Green/gray online indicator
   - "Active now" or "Active Xm ago"
   - Public info section (email, phone if available)
   - "My Private Notes" section (empty initially)

#### Test Scenario 2: Add Private Notes
1. Open any user's contact card
2. Click "Edit" in "My Private Notes" section
3. Add:
   - Nickname: "Test Buddy"
   - Personal Notes: "This is my test friend"
   - Additional Phone: "+1234567890"
   - Company: "Test Corp"
4. Click "Save"
5. **Expected:**
   - Form saves successfully
   - Edit mode closes
   - Info displays in read mode
6. Close and reopen the same user's card
7. **Expected:** All saved info still displays

#### Test Scenario 3: Nickname Display
1. Add nickname "BFF" to a user
2. Save and close
3. **Expected:** When you reopen, "BFF" shows prominently
4. Their real name shows below in smaller text

#### Test Scenario 4: Favorite Contact
1. Open any contact card
2. Click the star icon (top right)
3. **Expected:** Star turns gold/yellow
4. Close and reopen
5. **Expected:** Star still gold

#### Test Scenario 5: Privacy Verification
1. Add private notes to User A
2. Log in as different user (or ask friend to check)
3. Have them view User A's contact
4. **Expected:** They do NOT see your private notes
5. Each user has their own unique notes

### 3. Online Presence Features

#### Test Scenario 6: Online Indicator
1. Log in as User A in one browser
2. Log in as User B in another browser (or incognito)
3. As User B, view User A's contact card
4. **Expected:** Green dot, "Active now"
5. As User A, close browser/tab
6. Wait 5 minutes
7. As User B, view User A's contact card again
8. **Expected:** Gray dot, "Active 5m ago"

#### Test Scenario 7: Real-time Updates
1. Open User A's contact card (User A is offline)
2. Have User A log in (in another browser)
3. **Expected:** Within ~60 seconds, status changes to "Active now"
4. Have User A log out
5. **Expected:** Status eventually changes to "Active Xm ago"

#### Test Scenario 8: Multiple Users
1. Have 3+ users logged in
2. Check contact cards for each
3. **Expected:** Each shows correct online status
4. Have one log out
5. **Expected:** Only that user's status changes

### 4. Integration Tests

#### Test Scenario 9: Messages View
1. Go to Messages view
2. Send/receive messages
3. **Expected:** All avatars are clickable
4. **Expected:** Clicking opens contact card
5. **Expected:** Can click different users' avatars

#### Test Scenario 10: Contacts View
1. Go to Contacts view
2. Find contacts that are Pulse users (have pulseUserId)
3. **Expected:** Real online/offline indicator on avatar
4. Find contacts that are NOT Pulse users
5. **Expected:** Static status indicator

### 5. Performance Tests

#### Test Scenario 11: Presence Heartbeat
1. Log in
2. Open browser console
3. Watch network tab
4. **Expected:** See periodic presence updates every ~60 seconds
5. Switch to another tab
6. **Expected:** Status changes to "away"
7. Return to tab
8. **Expected:** Status back to "online"

#### Test Scenario 12: Multiple Subscriptions
1. Open 5+ different contact cards
2. **Expected:** No significant lag
3. **Expected:** All indicators update correctly
4. Close all cards
5. **Expected:** No memory leaks (check console)

### 6. Edge Cases

#### Test Scenario 13: Own Profile
1. Try to click your own avatar in messages
2. **Expected:** Card does NOT open (button disabled)
3. Cursor shows "not-allowed" on your own avatar

#### Test Scenario 14: Deleted User
1. View card of user who might be deleted
2. **Expected:** Shows "Profile not found" error
3. Close button works

#### Test Scenario 15: Network Offline
1. Disconnect internet
2. Try to open contact card
3. **Expected:** Shows loading or error state
4. Reconnect
5. **Expected:** Works again

#### Test Scenario 16: Long Nickname
1. Add very long nickname (50+ characters)
2. **Expected:** Truncates or wraps gracefully
3. No layout breaking

#### Test Scenario 17: Special Characters
1. Add nickname with emojis: "😎 Cool Friend 🎉"
2. Add notes with special chars: "Test & <test>"
3. **Expected:** Saves and displays correctly
4. No XSS vulnerability

### 7. UI/UX Tests

#### Test Scenario 18: Mobile Responsive
1. Open contact card on mobile device
2. **Expected:**
   - Card takes full width
   - Edit form is usable
   - All buttons accessible
   - Scrolling works
   - Can close card

#### Test Scenario 19: Keyboard Navigation
1. Open contact card
2. Press Tab repeatedly
3. **Expected:**
   - Can navigate all buttons
   - Focus indicators visible
   - Can close with Esc (if implemented)

#### Test Scenario 20: Dark Mode
1. Toggle dark mode
2. Open contact card
3. **Expected:**
   - Card readable in both modes
   - Colors appropriate
   - Contrast sufficient

## Automated Testing Commands

```bash
# Run linting
npm run lint

# Check TypeScript types
npx tsc --noEmit

# Test imports
npm run build
```

## Database Testing Queries

```sql
-- Check annotation was created
SELECT * FROM user_contact_annotations WHERE user_id = 'YOUR_USER_ID';

-- Check presence updates
SELECT id, handle, online_status, last_active_at 
FROM user_profiles 
ORDER BY last_active_at DESC 
LIMIT 10;

-- Test enriched profile function
SELECT * FROM get_enriched_user_profile('YOUR_USER_ID', 'TARGET_USER_ID');

-- Check online users count
SELECT get_online_users_count();

-- Test last active status
SELECT get_last_active_status('USER_ID');
```

## Common Issues & Fixes

### Issue: Contact card doesn't open
**Fix:** Check console for errors, verify userId is valid UUID

### Issue: Annotations don't save
**Fix:** 
- Check user is authenticated
- Verify RLS policies in Supabase
- Check database connection

### Issue: Presence doesn't update
**Fix:**
- Refresh page
- Check Supabase connection
- Verify user logged in
- Check browser console for errors

### Issue: Real-time not working
**Fix:**
- Enable Realtime in Supabase project settings
- Check Supabase status
- Verify subscription code

### Issue: Indicators not showing
**Fix:**
- Check userId prop is passed correctly
- Verify user_profiles has presence columns
- Check component is imported correctly

## Success Criteria

All features working when:
- ✅ Can open contact cards by clicking avatars
- ✅ Can add/edit private notes
- ✅ Notes persist across sessions
- ✅ Notes are private to each user
- ✅ Online indicators show correct status
- ✅ Status updates in real-time
- ✅ Presence heartbeat works automatically
- ✅ Works on mobile and desktop
- ✅ No console errors
- ✅ No performance issues

## Video Demo Script

### 30-Second Demo
1. "Click any user avatar" (click)
2. "See their contact details" (show card)
3. "Add my personal notes" (click Edit)
4. "Like a nickname - only I can see it" (type "Best Friend")
5. "Save" (click Save)
6. "And see who's online right now" (point to green dot)

### 2-Minute Deep Dive
1. Show clicking avatar
2. Explain public info section
3. Show private notes section
4. Add nickname example
5. Add custom phone/email
6. Save and verify
7. Close and reopen to show persistence
8. Show online status
9. Demonstrate real-time update (if possible)
10. Show favorites feature
11. Emphasize privacy

## Rollout Checklist

- [ ] Database migration run successfully
- [ ] All TypeScript files compiled without errors
- [ ] No linting errors
- [ ] Tested on development environment
- [ ] Tested with real users
- [ ] Mobile tested
- [ ] Dark mode tested
- [ ] Performance tested
- [ ] Privacy verified
- [ ] Documentation complete
- [ ] Team trained on features

## Feedback Collection

After deployment, gather feedback on:
1. Ease of use - Can users find the feature?
2. Usefulness - Do they use nicknames/notes?
3. Performance - Any lag or issues?
4. Bugs - Any unexpected behavior?
5. Requests - What would improve it?

## Metrics to Track

- Number of annotations created
- Number of favorites added
- Average time spent on contact cards
- Click-through rate on avatars
- Online presence accuracy
- Real-time update latency
