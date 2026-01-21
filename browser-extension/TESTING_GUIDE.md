# Pulse Chrome Extension - Testing Guide

## Quick Start Testing

### 1. Load Extension in Chrome

1. Open Chrome and navigate to: `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right corner)
3. Click **"Load unpacked"** button
4. Navigate to and select: `F:\pulse1\browser-extension`
5. The Pulse extension should appear in your extensions list

### 2. Verify Extension Loaded

You should see:
- ✅ Pulse icon in your browser toolbar
- ✅ Extension listed as "Pulse - Quick Capture v1.0.0"
- ✅ No errors in the extension card

### 3. Check Console for Errors

1. Click **"Service Worker"** link on the extension card
2. Check the console for initialization messages
3. Expected output: `[Pulse] Extension installed`

---

## Feature Testing Checklist

### Authentication Flow

#### Test 1: Initial Login
- [ ] Click the Pulse icon in toolbar
- [ ] Popup opens with "Sign in with Google" button
- [ ] Click "Sign in with Google"
- [ ] New tab opens to `https://pulse.logosvision.org/auth/extension-login`
- [ ] OAuth flow initiates
- [ ] After successful login, tab closes automatically
- [ ] Extension shows logged-in state
- [ ] User info displays correctly

#### Test 2: Session Persistence
- [ ] Close Chrome completely
- [ ] Reopen Chrome
- [ ] Click Pulse icon
- [ ] Extension remembers login session (no re-login required)

#### Test 3: Logout
- [ ] Open extension popup
- [ ] Click logout/sign out
- [ ] Extension returns to login state
- [ ] Session is cleared from storage

---

### Capture Features

#### Test 4: Quick Capture Popup
- [ ] Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
- [ ] Popup overlay appears on current page
- [ ] Can select a project from dropdown
- [ ] Can enter title and notes
- [ ] Click "Capture to Pulse"
- [ ] Success notification appears
- [ ] Content appears in War Room project

#### Test 5: Selection Capture
- [ ] Navigate to any webpage (e.g., Wikipedia article)
- [ ] Highlight some text
- [ ] Press `Ctrl+Shift+S` (Windows) or `Cmd+Shift+S` (Mac)
- [ ] Content is captured automatically
- [ ] Toast notification appears: "Captured!"
- [ ] Verify content saved in Pulse War Room

#### Test 6: Full Page Capture
- [ ] Navigate to an article page
- [ ] Press `Ctrl+Shift+A` (Windows) or `Cmd+Shift+A` (Mac)
- [ ] Entire page content is captured
- [ ] Article metadata extracted (title, author, date)
- [ ] Saved to default project (or prompt for project)

---

### Context Menu Features

#### Test 7: Capture Selected Text
- [ ] Highlight text on any page
- [ ] Right-click on the selection
- [ ] See "Capture to Pulse" option
- [ ] Click it
- [ ] Content saves successfully
- [ ] Notification confirms save

#### Test 8: Capture Entire Page
- [ ] Right-click anywhere on a page
- [ ] See "Capture entire page to Pulse" option
- [ ] Click it
- [ ] Full page content is captured
- [ ] Notification confirms save

#### Test 9: Save Link
- [ ] Right-click on any link
- [ ] See "Save link to Pulse" option
- [ ] Click it
- [ ] Link URL is saved
- [ ] Notification confirms save

#### Test 10: Save Image
- [ ] Right-click on any image
- [ ] See "Save image to Pulse" option
- [ ] Click it
- [ ] Image URL is saved
- [ ] Notification confirms save

---

### Settings & Configuration

#### Test 11: Extension Options
- [ ] Right-click extension icon → "Options"
- [ ] Options page opens
- [ ] Can set default project
- [ ] Can toggle floating button
- [ ] Can toggle keyboard shortcuts
- [ ] Settings save successfully
- [ ] Settings persist after browser restart

#### Test 12: Default Project
- [ ] Set a default project in options
- [ ] Capture content without selecting project
- [ ] Content saves to default project automatically

---

### Error Handling

#### Test 13: No Internet Connection
- [ ] Disable network connection
- [ ] Try to capture content
- [ ] Error message displays: "Network error" or similar
- [ ] Extension doesn't crash

#### Test 14: Invalid Session
- [ ] Manually clear extension storage
- [ ] Try to capture content
- [ ] Extension prompts to log in
- [ ] After login, capture works

#### Test 15: API Errors
- [ ] Test with invalid Supabase credentials (dev only)
- [ ] Verify error handling
- [ ] User-friendly error messages display

---

## Performance Testing

### Test 16: Large Content Capture
- [ ] Capture a very long article (10,000+ words)
- [ ] Capture completes without timeout
- [ ] Content displays correctly in War Room

### Test 17: Rapid Captures
- [ ] Capture multiple items quickly (5+ in succession)
- [ ] All captures complete successfully
- [ ] No race conditions or data loss

### Test 18: Multiple Tabs
- [ ] Open 5+ tabs
- [ ] Capture content from different tabs
- [ ] Each capture associates with correct tab/URL

---

## Browser Compatibility

### Chrome/Chromium
- [ ] Works on Chrome (latest)
- [ ] Works on Brave
- [ ] Works on Edge
- [ ] Works on Opera

### Firefox (if adapted)
- [ ] Load as temporary extension
- [ ] Basic features work
- [ ] No manifest V3 compatibility issues

---

## Data Verification

### Test 19: Database Storage
- [ ] Capture content
- [ ] Open Supabase dashboard
- [ ] Check `knowledge_docs` table
- [ ] Verify new row with correct data:
  - user_id matches logged-in user
  - title is correct
  - text_content contains captured text
  - source_url is correct
  - file_type is 'web-capture'

### Test 20: Project Linking
- [ ] Capture content to specific project
- [ ] Check `project_docs` table
- [ ] Verify link between doc_id and project_id
- [ ] Content appears in project War Room

---

## Security Testing

### Test 21: API Key Security
- [ ] Verify Supabase anon key is not exposed in page
- [ ] Check that access_token is stored securely (chrome.storage)
- [ ] Verify no credentials in console logs

### Test 22: CORS & Permissions
- [ ] Extension only accesses allowed domains
- [ ] No unauthorized API calls
- [ ] User data is not sent to third parties

---

## Common Issues & Solutions

### Extension Won't Load
**Symptoms**: Error on load or won't appear in toolbar
**Solutions**:
- Check manifest.json syntax (run through JSON validator)
- Verify all file paths exist
- Check browser console for specific errors
- Reload extension after changes

### OAuth Not Working
**Symptoms**: Login redirects fail or loop infinitely
**Solutions**:
- Verify redirect URLs in Supabase Dashboard match exactly
- Check Google Cloud Console OAuth settings
- Ensure Supabase Google provider is enabled
- Clear browser cache and try again

### Content Not Saving
**Symptoms**: Capture appears to work but content missing
**Solutions**:
- Check browser console for API errors
- Verify network tab shows successful POST to Supabase
- Check Supabase RLS policies allow inserts
- Verify authentication token is valid

### Keyboard Shortcuts Not Working
**Symptoms**: Shortcuts don't trigger capture
**Solutions**:
- Check if shortcuts conflict with browser/OS shortcuts
- Go to `chrome://extensions/shortcuts` to verify/change
- Ensure extension has activeTab permission
- Check settings page has shortcuts enabled

---

## Debug Mode

### Enable Extension Debug Logs

1. Open extension popup
2. Right-click → "Inspect"
3. Go to Console tab
4. All `[Pulse]` prefixed logs will appear

### Check Background Service Worker

1. Go to `chrome://extensions/`
2. Find Pulse extension
3. Click "Service Worker" link
4. Console shows background script logs

### Inspect Content Script

1. Navigate to any webpage
2. Open DevTools (F12)
3. Go to Console
4. Content script logs appear here

---

## Test Data

### Sample Content for Testing

**Short Text**:
```
This is a test capture from the Pulse extension.
```

**Medium Article**:
- URL: https://medium.com/@example/article
- Expected: Title, author, date extracted

**Wikipedia Article**:
- URL: https://en.wikipedia.org/wiki/Chrome_extension
- Expected: Clean HTML, metadata

---

## Reporting Issues

When reporting bugs, include:
1. Browser version
2. Extension version
3. Steps to reproduce
4. Expected vs actual behavior
5. Console errors (if any)
6. Screenshots/screen recordings

---

**Test Completion Date**: _________________

**Tested By**: _________________

**Browser Version**: _________________

**Issues Found**: _________________

---

## Sign-Off

- [ ] All critical features tested and working
- [ ] No blocking bugs identified
- [ ] Performance is acceptable
- [ ] Security checks passed
- [ ] Ready for production deployment

**Approved By**: _________________

**Date**: _________________
