# Integration Testing Guide - Phase 5

**Date**: January 19, 2026
**Status**: Ready for Testing
**Features**: Browser Extension, Email Templates, CRM Wizard

---

## Overview

This guide provides comprehensive testing procedures for the three major feature integrations completed in Phases 1-4:

1. **Browser Extension** - Chrome/Firefox web capture extension
2. **Email Template System** - Template management with variables and categories
3. **CRM Integration Wizard** - Multi-platform CRM setup and sync monitoring

---

## Prerequisites

### Environment Setup

1. **Database Migration Applied**
   ```bash
   npx supabase db push --include-all
   ```
   - Verify `template_categories` table exists
   - Verify enhanced columns in `knowledge_docs`, `project_docs`, `crm_integrations`, `crm_sync_logs`

2. **Environment Variables Set**
   - Copy `.env.example` to `.env.local`
   - Configure Supabase credentials (already set)
   - Optional: Configure CRM OAuth credentials for CRM wizard testing

3. **Development Server Running**
   ```bash
   npm run dev
   ```

4. **Test User Account**
   - Create a test user account in Pulse
   - Verify authentication works

---

## Test 1: Browser Extension Integration

### Installation Testing

#### Chrome Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select `f:\pulse1\browser-extension` folder
5. **Expected**: Extension appears with Pulse icon

**Evidence Required**: Screenshot of extension loaded in Chrome

#### Firefox Installation

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Navigate to `f:\pulse1\browser-extension` folder
4. Select `manifest.json`
5. **Expected**: Extension appears in list

**Evidence Required**: Screenshot of extension loaded in Firefox

### Authentication Testing

#### Test Case 1.1: Sign in with Google

1. Click Pulse extension icon in toolbar
2. Click **Sign in with Google**
3. Complete OAuth flow
4. **Expected**:
   - Redirects to Google OAuth
   - Returns to Pulse callback
   - Extension shows logged-in state
   - User profile visible in extension popup

**Evidence Required**: Screenshots of each step

**Pass Criteria**:
- [ ] OAuth redirect works
- [ ] Callback redirects back to extension
- [ ] Extension receives auth token
- [ ] Extension popup shows user info
- [ ] Session persists after closing popup

#### Test Case 1.2: Session Persistence

1. Close browser completely
2. Reopen browser
3. Click extension icon
4. **Expected**: Still logged in, no re-authentication required

**Evidence Required**: Screenshot showing persistent login

**Pass Criteria**:
- [ ] Session persists across browser restarts
- [ ] No re-authentication needed

### Capture Mode Testing

#### Test Case 1.3: Quick Capture Popup (Ctrl+Shift+P)

1. Navigate to any webpage (e.g., https://example.com)
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. **Expected**: Quick capture popup overlay appears
4. Fill in:
   - Title: "Test Quick Capture"
   - Notes: "Testing quick capture functionality"
   - Select project from dropdown
5. Click **Save**
6. **Expected**:
   - Success notification
   - Content saved to database
   - Appears in War Room

**Evidence Required**:
- Screenshot of quick capture popup
- Screenshot of saved content in War Room

**Pass Criteria**:
- [ ] Keyboard shortcut triggers popup
- [ ] Project dropdown loads user's projects
- [ ] Can enter title and notes
- [ ] Save button works
- [ ] Content appears in War Room
- [ ] URL is captured correctly
- [ ] Timestamp is accurate

#### Test Case 1.4: Selection Capture (Ctrl+Shift+S)

1. Navigate to any webpage with text
2. Highlight/select a paragraph of text
3. Press `Ctrl+Shift+S` (or `Cmd+Shift+S` on Mac)
4. **Expected**: Capture modal appears with selected text pre-filled
5. Add title and select project
6. Click **Save**
7. **Expected**: Selected text saved to War Room

**Evidence Required**:
- Screenshot of text selection
- Screenshot of capture modal with selected text
- Screenshot of saved content in War Room

**Pass Criteria**:
- [ ] Selected text is captured
- [ ] Source URL is included
- [ ] Content preserved accurately
- [ ] Formatting maintained (if applicable)

#### Test Case 1.5: Full Page Capture (Ctrl+Shift+A)

1. Navigate to an article webpage
2. Press `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac)
3. **Expected**: Full page content extracted
4. **Expected**: Modal shows:
   - Article title (auto-extracted)
   - Article content (cleaned HTML)
   - Source URL
   - Metadata (author, date if available)
5. Select project and save
6. **Expected**: Full article saved to War Room

**Evidence Required**:
- Screenshot of article page
- Screenshot of capture modal with extracted content
- Screenshot of saved article in War Room

**Pass Criteria**:
- [ ] Page content extracted
- [ ] Title auto-detected
- [ ] HTML cleaned (no ads/navigation)
- [ ] Metadata extracted when available
- [ ] Images preserved (if applicable)

### Context Menu Testing

#### Test Case 1.6: Context Menu Integration

1. **Test on selected text**:
   - Right-click on selected text
   - **Expected**: "Capture to Pulse" option appears
   - Click option
   - **Expected**: Capture modal opens with selected text

2. **Test on page**:
   - Right-click anywhere on page
   - **Expected**: "Capture entire page to Pulse" option appears
   - Click option
   - **Expected**: Full page capture initiates

3. **Test on link**:
   - Right-click on a hyperlink
   - **Expected**: "Save link to Pulse" option appears
   - Click option
   - **Expected**: Link saved with page title

4. **Test on image**:
   - Right-click on an image
   - **Expected**: "Save image to Pulse" option appears
   - Click option
   - **Expected**: Image URL saved (or image uploaded)

**Evidence Required**: Screenshots of all 4 context menu scenarios

**Pass Criteria**:
- [ ] Context menu appears on text selection
- [ ] Context menu appears on page right-click
- [ ] Context menu appears on link right-click
- [ ] Context menu appears on image right-click
- [ ] All menu items function correctly

### Database Verification

#### Test Case 1.7: Data Persistence

1. Open Supabase dashboard
2. Navigate to Table Editor → `knowledge_docs`
3. Verify captured content exists:
   - `title` matches what was entered
   - `content` contains captured text
   - `url` is the source URL
   - `source_type` is `'web_capture'`
   - `metadata` contains additional info
   - `user_id` matches authenticated user

4. Navigate to Table Editor → `project_docs`
5. Verify link exists:
   - `project_id` matches selected project
   - `doc_id` matches created knowledge doc
   - `added_by` matches user ID

**Evidence Required**: Screenshots of database entries

**Pass Criteria**:
- [ ] `knowledge_docs` entry created
- [ ] `project_docs` link created
- [ ] RLS policies allow user to see own data
- [ ] RLS policies prevent cross-user access

---

## Test 2: Email Template System

### Template CRUD Testing

#### Test Case 2.1: Create New Template

1. Navigate to Email section (or wherever templates are integrated)
2. Open Email Templates Modal
3. Click **Create New Template**
4. Fill in template editor:
   - Name: "Sales Follow-up Template"
   - Category: "Sales"
   - Subject: "Re: {{subject}} - Follow up"
   - Body:
     ```
     Hi {{firstName}},

     Thank you for your interest in {{productName}}. I wanted to follow up on our conversation from {{currentDate}}.

     Best regards,
     {{senderName}}
     ```
5. Click **Save**
6. **Expected**: Template appears in templates list

**Evidence Required**:
- Screenshot of template editor
- Screenshot of saved template in list

**Pass Criteria**:
- [ ] Can create new template
- [ ] Variables extracted automatically ({{firstName}}, {{subject}}, {{productName}}, {{currentDate}}, {{senderName}})
- [ ] Template saves to database
- [ ] Template appears in list immediately

#### Test Case 2.2: Edit Existing Template

1. Open Email Templates Modal
2. Click **Edit** on a template
3. Modify:
   - Change name to "Sales Follow-up Template (Updated)"
   - Add a variable: {{companyName}}
4. Click **Save**
5. **Expected**: Changes persist

**Evidence Required**:
- Screenshot before edit
- Screenshot after edit

**Pass Criteria**:
- [ ] Can edit template
- [ ] Changes save to database
- [ ] Variables re-extracted on save
- [ ] Updated timestamp changes

#### Test Case 2.3: Delete Template

1. Open Email Templates Modal
2. Click **Delete** on a template
3. Confirm deletion
4. **Expected**: Template removed from list

**Evidence Required**: Screenshot of confirmation and result

**Pass Criteria**:
- [ ] Delete confirmation appears
- [ ] Template removed from database
- [ ] Template removed from UI
- [ ] No orphaned data

### Variable System Testing

#### Test Case 2.4: Variable Insertion

1. Create or edit a template
2. Click **Insert Variable** button
3. **Expected**: Variable picker modal appears
4. Browse variables by category:
   - Contact variables
   - Message variables
   - User variables
   - Dynamic variables
5. Click a variable (e.g., {{firstName}})
6. **Expected**: Variable inserted at cursor position in template body

**Evidence Required**:
- Screenshot of variable picker
- Screenshot of inserted variable

**Pass Criteria**:
- [ ] Variable picker displays all 23+ predefined variables
- [ ] Variables grouped by category
- [ ] Click to insert works
- [ ] Variable format is {{variableName}}

#### Test Case 2.5: Variable Replacement

1. Select a template with variables
2. Click **Use Template** while composing an email to a contact
3. **Expected**: Variables replaced with actual contact data:
   - {{firstName}} → Contact's first name
   - {{lastName}} → Contact's last name
   - {{email}} → Contact's email
   - {{company}} → Contact's company
   - {{currentDate}} → Today's date
   - {{senderName}} → Logged-in user's name
4. **Expected**: Subject and body fields filled with replaced content

**Evidence Required**:
- Screenshot of template with variables
- Screenshot of email composer with replaced values

**Pass Criteria**:
- [ ] All variables replaced with correct data
- [ ] Missing data shows empty string (not {{variable}})
- [ ] Dynamic variables (date, time) generate correctly
- [ ] Subject and body both process variables

### Category System Testing

#### Test Case 2.6: Create Category

1. Open Email Templates Modal
2. Click **Manage Categories**
3. Click **Add Category**
4. Fill in:
   - Name: "Customer Support"
   - Color: #3b82f6 (blue)
   - Icon: fa-headset
5. Save
6. **Expected**: Category appears in category list

**Evidence Required**: Screenshot of new category

**Pass Criteria**:
- [ ] Can create category
- [ ] Category persists in database
- [ ] Color displays correctly
- [ ] Icon displays correctly

#### Test Case 2.7: Filter by Category

1. Open Email Templates Modal
2. Click on category filter (e.g., "Sales")
3. **Expected**: Only templates in "Sales" category display
4. Click "All Categories"
5. **Expected**: All templates display again

**Evidence Required**: Screenshot of filtered view

**Pass Criteria**:
- [ ] Filtering works correctly
- [ ] Template count updates
- [ ] Clear filter works

### Favorites System Testing

#### Test Case 2.8: Toggle Favorite

1. Open Email Templates Modal
2. Click the star/favorite icon on a template
3. **Expected**: Template marked as favorite
4. Click again
5. **Expected**: Template unmarked as favorite

**Evidence Required**: Screenshots showing toggle

**Pass Criteria**:
- [ ] Favorite toggle works
- [ ] Favorite status persists in database
- [ ] Favorite icon updates immediately

#### Test Case 2.9: Filter by Favorites

1. Mark 2-3 templates as favorites
2. Click "Favorites Only" filter
3. **Expected**: Only favorited templates display
4. Toggle off favorites filter
5. **Expected**: All templates display

**Evidence Required**: Screenshot of favorites filter

**Pass Criteria**:
- [ ] Favorites filter works
- [ ] Shows only favorited templates
- [ ] Clear filter works

### Search Testing

#### Test Case 2.10: Search Templates

1. Open Email Templates Modal
2. Type in search box: "follow"
3. **Expected**: Templates with "follow" in name, body, or description display
4. Type: "{{firstName}}"
5. **Expected**: Templates containing {{firstName}} variable display
6. Clear search
7. **Expected**: All templates display

**Evidence Required**: Screenshots of search results

**Pass Criteria**:
- [ ] Search finds matches in name
- [ ] Search finds matches in body
- [ ] Search finds matches in description
- [ ] Search is case-insensitive
- [ ] Clear search works

### Usage Statistics Testing

#### Test Case 2.11: Usage Count

1. Note current usage count for a template
2. Use the template in an email
3. Return to templates modal
4. **Expected**: Usage count incremented by 1
5. **Expected**: Last used timestamp updated

**Evidence Required**:
- Screenshot before use (count = N)
- Screenshot after use (count = N+1)

**Pass Criteria**:
- [ ] Usage count increments
- [ ] Last used timestamp updates
- [ ] Most used templates sort correctly

### Database Verification

#### Test Case 2.12: Template Data Persistence

1. Open Supabase dashboard
2. Navigate to Table Editor → `email_templates`
3. Verify template entry:
   - `name` matches
   - `subject` and `body` match
   - `variables` array contains extracted variables
   - `category` matches selected category
   - `is_favorite` boolean correct
   - `use_count` accurate
   - `last_used_at` timestamp correct

4. Navigate to Table Editor → `template_categories`
5. Verify category entry:
   - `name`, `color`, `icon` match
   - `sort_order` set

**Evidence Required**: Screenshots of database entries

**Pass Criteria**:
- [ ] All fields persist correctly
- [ ] RLS policies work
- [ ] Foreign keys valid

---

## Test 3: CRM Integration Wizard

### Wizard Flow Testing

#### Test Case 3.1: Platform Selection

1. Navigate to Settings → CRM Integrations
2. Click **Connect CRM**
3. **Expected**: Wizard modal opens on Step 1: Platform Selection
4. **Expected**: Visual cards for:
   - HubSpot
   - Salesforce
   - Pipedrive
   - Zoho CRM
5. Each card shows:
   - Platform logo
   - Feature list
   - Pricing tier info
6. Click **HubSpot** card
7. **Expected**: Advances to Step 2: OAuth Configuration

**Evidence Required**: Screenshot of platform selector

**Pass Criteria**:
- [ ] All 4 platforms display
- [ ] Cards show features and pricing
- [ ] Selection advances to next step
- [ ] Back button works (if applicable)

#### Test Case 3.2: OAuth Configuration

**Note**: This test requires valid OAuth credentials in `.env.local`

1. On Step 2: OAuth Configuration for HubSpot
2. **Expected**: Displays OAuth instructions
3. **Expected**: Shows required scopes:
   - crm.objects.contacts.read/write
   - crm.objects.companies.read/write
   - crm.objects.deals.read/write
4. Click **Authorize HubSpot**
5. **Expected**: Redirects to HubSpot OAuth page
6. Grant permissions
7. **Expected**: Redirects back to wizard
8. **Expected**: Advances to Step 3: Connection Test

**Evidence Required**:
- Screenshot of OAuth configuration step
- Screenshot of HubSpot OAuth page
- Screenshot after successful OAuth

**Pass Criteria**:
- [ ] OAuth instructions clear
- [ ] Scopes displayed
- [ ] OAuth redirect works
- [ ] Callback handling works
- [ ] Tokens stored securely

#### Test Case 3.3: Connection Test

1. On Step 3: Connection Test
2. **Expected**: Wizard automatically tests:
   - API connectivity
   - Permission verification
   - Quota/rate limit check
3. **Expected**: Shows test results:
   - ✓ Connection successful
   - ✓ Permissions verified
   - ✓ API quota: X requests remaining
4. If any test fails:
   - **Expected**: Clear error message
   - **Expected**: Option to retry or go back
5. Click **Continue**
6. **Expected**: Advances to Step 4: Setup Complete

**Evidence Required**: Screenshot of connection test results

**Pass Criteria**:
- [ ] Connection test runs automatically
- [ ] Results display clearly
- [ ] Errors handled gracefully
- [ ] Can proceed on success

#### Test Case 3.4: Setup Complete

1. On Step 4: Setup Complete
2. **Expected**: Success confirmation message
3. **Expected**: Quick start guide:
   - View sync status
   - Trigger manual sync
   - Configure sync settings
4. Click **Go to Dashboard** or **Close**
5. **Expected**: Integration appears in CRM integrations list

**Evidence Required**: Screenshot of completion screen

**Pass Criteria**:
- [ ] Success message displays
- [ ] Quick start guide helpful
- [ ] Integration saved to database
- [ ] Can navigate to dashboard

### Sync Monitoring Testing

#### Test Case 3.5: Sync Status Panel

1. Navigate to Dashboard
2. Locate **CRM Sync Status** widget
3. **Expected**: Shows:
   - Connected CRM platform (e.g., HubSpot)
   - Last sync timestamp
   - Sync status (success/failed/in progress)
   - Records synced count
4. If errors exist:
   - **Expected**: Error message displayed
   - **Expected**: Error icon/indicator

**Evidence Required**: Screenshot of sync status panel

**Pass Criteria**:
- [ ] Panel displays connected CRM
- [ ] Last sync time accurate
- [ ] Status indicator correct
- [ ] Error messages clear

#### Test Case 3.6: Manual Sync Trigger

1. On Sync Status Panel
2. Click **Sync Now** button
3. **Expected**:
   - Button shows loading state
   - Sync initiates
   - Progress indicator appears
4. Wait for sync to complete
5. **Expected**:
   - Last sync timestamp updates
   - Records synced count updates
   - Success message appears

**Evidence Required**:
- Screenshot before sync
- Screenshot during sync (loading state)
- Screenshot after sync (updated data)

**Pass Criteria**:
- [ ] Manual sync triggers correctly
- [ ] Loading state displays
- [ ] Sync completes successfully
- [ ] Timestamp and count update

#### Test Case 3.7: Sync History Logs

1. Click **View Sync History** on Sync Status Panel
2. **Expected**: Modal/panel shows sync logs:
   - Timestamp
   - Sync type (full/incremental)
   - Status (success/failed/partial)
   - Records synced
   - Duration
   - Errors (if any)
3. Logs sorted by most recent first

**Evidence Required**: Screenshot of sync history

**Pass Criteria**:
- [ ] Sync logs display
- [ ] All fields accurate
- [ ] Sorted correctly
- [ ] Pagination works (if many logs)

### Database Verification

#### Test Case 3.8: CRM Integration Data

1. Open Supabase dashboard
2. Navigate to Table Editor → `crm_integrations`
3. Verify integration entry:
   - `platform` = 'hubspot' (or selected platform)
   - `access_token` stored (encrypted/hashed)
   - `refresh_token` stored
   - `token_expires_at` set
   - `is_active` = true
   - `sync_enabled` = true
   - `last_sync_at` timestamp
   - `settings` JSONB contains config

4. Navigate to Table Editor → `crm_sync_logs`
5. Verify sync log entries:
   - `integration_id` matches integration
   - `sync_type` set
   - `status` reflects outcome
   - `records_synced` count
   - `errors` array (if any)
   - `duration_ms` calculated
   - `started_at` and `completed_at` timestamps

**Evidence Required**: Screenshots of database entries

**Pass Criteria**:
- [ ] Integration entry complete
- [ ] Tokens stored securely
- [ ] Sync logs recorded
- [ ] RLS policies work

---

## Test 4: Cross-Feature Integration

### Test Case 4.1: Browser Extension → Email Templates

1. Capture a webpage about a product using browser extension
2. Navigate to Email → Compose
3. Select recipient related to the captured product
4. Open Email Templates
5. Select a sales template with {{productName}} variable
6. **Expected**: Variable should be replaceable with product info from captured content

**Evidence Required**: Screenshot of email with auto-filled product data

**Pass Criteria**:
- [ ] Captured content accessible from email composer
- [ ] Variables can reference captured data
- [ ] Integration seamless

### Test Case 4.2: CRM Contact → Email Template Variables

1. Sync contacts from CRM (e.g., HubSpot)
2. Navigate to Email → Compose
3. Select a synced CRM contact as recipient
4. Use email template with variables:
   - {{firstName}}, {{lastName}}, {{company}}, {{email}}
5. **Expected**: Variables populated from CRM contact data

**Evidence Required**: Screenshot of email with CRM data

**Pass Criteria**:
- [ ] CRM contact data available
- [ ] Variables replaced with CRM data
- [ ] All contact fields accessible

### Test Case 4.3: Browser Extension → CRM Sync

1. Capture a webpage with lead information
2. Ensure CRM sync is enabled
3. Trigger CRM sync
4. **Expected**: Captured lead information could be synced to CRM (if logic implemented)

**Evidence Required**: Screenshot of sync log

**Pass Criteria**:
- [ ] Captured content available for sync
- [ ] Sync process handles new data
- [ ] Data appears in CRM

---

## Test 5: Error Handling & Edge Cases

### Test Case 5.1: Browser Extension - No Internet

1. Disconnect internet
2. Try to capture content
3. **Expected**: Graceful error message: "No internet connection. Content will be saved when online."

**Pass Criteria**:
- [ ] Offline detection works
- [ ] Queue system for offline captures
- [ ] Sync when back online

### Test Case 5.2: Email Templates - Empty Variables

1. Create template with {{firstName}}
2. Use template for contact without first name
3. **Expected**: Variable replaced with empty string, not "{{firstName}}"

**Pass Criteria**:
- [ ] Missing data handled gracefully
- [ ] No variable syntax in final output

### Test Case 5.3: CRM Wizard - Invalid OAuth Credentials

1. Enter invalid OAuth credentials
2. Try to authorize
3. **Expected**: Clear error message
4. **Expected**: Option to retry with corrected credentials

**Pass Criteria**:
- [ ] Error message helpful
- [ ] Can retry authorization
- [ ] No partial data saved

### Test Case 5.4: CRM Sync - API Rate Limit

1. Trigger multiple syncs rapidly
2. **Expected**: Rate limit detection
3. **Expected**: Retry with exponential backoff
4. **Expected**: User notification about rate limiting

**Pass Criteria**:
- [ ] Rate limit detected
- [ ] Backoff logic works
- [ ] User informed of delay

---

## Test 6: Performance Testing

### Test Case 6.1: Template List Performance

1. Create 50+ templates
2. Open Email Templates Modal
3. **Expected**:
   - Templates load in < 2 seconds
   - Scrolling is smooth
   - Search responds instantly

**Evidence Required**: Performance metrics (browser DevTools)

**Pass Criteria**:
- [ ] Load time < 2 seconds
- [ ] No UI lag
- [ ] Efficient database queries

### Test Case 6.2: Browser Extension - Large Page Capture

1. Navigate to a very long article (10,000+ words)
2. Use full page capture
3. **Expected**:
   - Content extracted without timeout
   - Completes in < 10 seconds
   - No memory issues

**Evidence Required**: Performance metrics

**Pass Criteria**:
- [ ] Large pages handled
- [ ] No crashes
- [ ] Reasonable completion time

### Test Case 6.3: CRM Sync - Large Dataset

1. Trigger sync with 1000+ CRM records
2. **Expected**:
   - Batch processing used
   - Progress indicator shows updates
   - Completes without timeout
   - No memory overflow

**Evidence Required**: Sync duration and performance data

**Pass Criteria**:
- [ ] Handles large datasets
- [ ] Batching implemented
- [ ] No performance degradation

---

## Test 7: Security & RLS Testing

### Test Case 7.1: Cross-User Data Isolation

1. Create templates as User A
2. Log in as User B
3. Open Email Templates Modal
4. **Expected**: User A's templates NOT visible to User B

**Evidence Required**: Screenshots from both user accounts

**Pass Criteria**:
- [ ] RLS policies prevent cross-user access
- [ ] Each user sees only their own data
- [ ] Database queries filtered by user_id

### Test Case 7.2: Browser Extension - Auth Token Security

1. Inspect extension storage
2. **Expected**: Auth tokens stored securely
3. **Expected**: No sensitive data in localStorage
4. **Expected**: Tokens use httpOnly cookies or encrypted storage

**Evidence Required**: Screenshot of storage inspection

**Pass Criteria**:
- [ ] Tokens not exposed in clear text
- [ ] Secure storage mechanism used
- [ ] Token expiration handled

### Test Case 7.3: CRM OAuth - Token Refresh

1. Wait for CRM access token to expire (or manually expire)
2. Trigger sync
3. **Expected**:
   - Token refresh attempted automatically
   - Sync completes with refreshed token
   - No user intervention required

**Evidence Required**: Log of token refresh

**Pass Criteria**:
- [ ] Token refresh logic works
- [ ] Sync continues after refresh
- [ ] Refresh token stored securely

---

## Test Summary Checklist

### Browser Extension
- [ ] Chrome installation works
- [ ] Firefox installation works
- [ ] Authentication flow completes
- [ ] Quick capture (Ctrl+Shift+P) works
- [ ] Selection capture (Ctrl+Shift+S) works
- [ ] Full page capture (Ctrl+Shift+A) works
- [ ] All context menu items work
- [ ] Content saves to database
- [ ] Content appears in War Room
- [ ] Session persists across restarts

### Email Template System
- [ ] Can create templates
- [ ] Can edit templates
- [ ] Can delete templates
- [ ] Variables extract automatically
- [ ] Variables replace correctly
- [ ] Categories filter templates
- [ ] Search finds templates
- [ ] Favorites toggle works
- [ ] Usage statistics track correctly
- [ ] Templates persist in database

### CRM Integration Wizard
- [ ] Platform selection displays all CRMs
- [ ] OAuth flow completes successfully
- [ ] Connection test validates setup
- [ ] Setup completes and saves integration
- [ ] Sync status panel displays correctly
- [ ] Manual sync trigger works
- [ ] Sync history logs accurately
- [ ] Integration persists in database

### Cross-Feature Integration
- [ ] Browser extension content accessible elsewhere
- [ ] CRM contact data populates template variables
- [ ] All features work together seamlessly

### Performance
- [ ] Large datasets handled efficiently
- [ ] No UI lag or freezing
- [ ] Database queries optimized

### Security
- [ ] RLS policies prevent cross-user access
- [ ] Auth tokens stored securely
- [ ] Token refresh works automatically

---

## QA Report Template

After completing all tests, create a final QA report using this template:

```markdown
# QA Test Report - Phase 5

**Date**: [Date]
**Tester**: [Your Name]
**Environment**: [Browser versions, OS, etc.]

## Summary

- **Total Test Cases**: [Number]
- **Passed**: [Number]
- **Failed**: [Number]
- **Blocked**: [Number]

## Browser Extension

### Passed
- [List passed test cases]

### Failed
- [List failed test cases with details]

### Screenshots
- [Include evidence screenshots]

## Email Template System

### Passed
- [List passed test cases]

### Failed
- [List failed test cases with details]

### Screenshots
- [Include evidence screenshots]

## CRM Integration Wizard

### Passed
- [List passed test cases]

### Failed
- [List failed test cases with details]

### Screenshots
- [Include evidence screenshots]

## Critical Issues

1. **Issue**: [Description]
   - **Severity**: High/Medium/Low
   - **Steps to Reproduce**: [Steps]
   - **Expected**: [Expected behavior]
   - **Actual**: [Actual behavior]
   - **Screenshot**: [Link]

## Recommendations

- [List of recommendations for fixes or improvements]

## Sign-off

All critical and high-severity issues must be resolved before production deployment.

**Approved by**: _______________
**Date**: _______________
```

---

## Next Steps After Testing

Once all tests pass:

1. **Phase 6**: Update documentation
   - Update main README.md
   - Create user guides
   - Document API endpoints
   - Create video tutorials

2. **Deployment Preparation**
   - Run production build
   - Test production build
   - Prepare deployment checklist
   - Configure production environment variables

3. **Browser Extension Publishing**
   - Package extension
   - Submit to Chrome Web Store
   - Submit to Firefox Add-ons
   - Wait for review approval

4. **User Rollout**
   - Beta test with select users
   - Gather feedback
   - Make final adjustments
   - General availability release

---

**Testing Timeline Estimate**: 1-2 hours per feature = 3-6 hours total

**Evidence Required**: Screenshots for every test case showing success or failure

**Sign-off Required**: All critical and high-severity bugs fixed before production

---

**Last Updated**: January 19, 2026
**Status**: Ready for Testing Execution
