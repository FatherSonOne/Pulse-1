# Pulse Browser Extension Setup Guide

## Overview

The Pulse Browser Extension allows users to capture web content directly to their Pulse War Room projects. This guide covers installation, configuration, and deployment.

## Prerequisites

- Supabase project with Google OAuth configured
- Pulse web application deployed and accessible
- Chrome or Firefox browser

---

## 1. Supabase OAuth Configuration

### Enable Google OAuth Provider

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Google** and click **Enable**
4. Configure Google OAuth:
   - **Client ID**: Your Google OAuth Client ID
   - **Client Secret**: Your Google OAuth Client Secret
   - **Authorized Redirect URIs**: Add these URLs:
     ```
     https://pulse.logosvision.org/auth/extension-login
     https://pulse.logosvision.org/auth/extension-oauth-callback
     https://pulse.logosvision.org/auth/extension-callback
     ```

### Add Site URL

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Add your site URL: `https://pulse.logosvision.org`

### Add Redirect URLs

1. In **Authentication** → **URL Configuration** → **Redirect URLs**
2. Add these URLs:
   ```
   https://pulse.logosvision.org/auth/extension-login
   https://pulse.logosvision.org/auth/extension-oauth-callback
   https://pulse.logosvision.org/auth/extension-callback
   ```

---

## 2. Google Cloud Console Setup

### Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure:
   - **Application type**: Web application
   - **Name**: Pulse Browser Extension
   - **Authorized JavaScript origins**:
     ```
     https://pulse.logosvision.org
     https://ucaeuszgoihoyrvhewxk.supabase.co
     ```
   - **Authorized redirect URIs**:
     ```
     https://pulse.logosvision.org/auth/extension-login
     https://pulse.logosvision.org/auth/extension-oauth-callback
     https://pulse.logosvision.org/auth/extension-callback
     https://ucaeuszgoihoyrvhewxk.supabase.co/auth/v1/callback
     ```

6. Click **Create** and save your:
   - Client ID
   - Client Secret

---

## 3. Extension Configuration

The extension is already configured with the correct Supabase credentials:

- **Supabase URL**: `https://ucaeuszgoihoyrvhewxk.supabase.co`
- **Supabase Anon Key**: (Configured in `src/background.js`)

### Verify Configuration

Check `browser-extension/src/background.js`:

```javascript
const PULSE_URL = 'https://pulse.logosvision.org';
const SUPABASE_URL = 'https://ucaeuszgoihoyrvhewxk.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

---

## 4. Load Extension in Chrome

### Development Mode

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `browser-extension` folder
5. The extension should now appear in your extensions list

### Test the Extension

1. Click the Pulse icon in your browser toolbar
2. Click **Sign in with Google**
3. Complete the OAuth flow
4. You should be redirected back to the extension
5. Try capturing content using:
   - **Quick Capture**: `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - **Capture Selection**: `Ctrl+Shift+S`
   - **Capture Page**: `Ctrl+Shift+A`

---

## 5. Load Extension in Firefox

### Development Mode

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Navigate to the `browser-extension` folder
4. Select `manifest.json`
5. The extension will be loaded temporarily

**Note**: Firefox temporary extensions are removed when you close the browser.

---

## 6. Extension Features

### Capture Modes

1. **Quick Capture Popup** (`Ctrl+Shift+P`)
   - Opens popup overlay
   - Select project
   - Add title and notes
   - Save to War Room

2. **Selection Capture** (`Ctrl+Shift+S`)
   - Highlight text on any webpage
   - Use keyboard shortcut
   - Text is captured with source URL

3. **Full Page Capture** (`Ctrl+Shift+A`)
   - Captures entire article
   - Extracts metadata (title, author, date)
   - Cleans up HTML

4. **Context Menu Integration**
   - Right-click on:
     - Selected text → "Capture to Pulse"
     - Page → "Capture entire page to Pulse"
     - Link → "Save link to Pulse"
     - Image → "Save image to Pulse"

### Data Storage

Captured content is stored in the `knowledge_docs` table:

```sql
CREATE TABLE knowledge_docs (
  id UUID PRIMARY KEY,
  user_id UUID,
  title TEXT,
  content TEXT,
  url TEXT,
  source_type TEXT, -- 'web_capture'
  metadata JSONB,
  created_at TIMESTAMPTZ
);
```

Content can be linked to projects via `project_docs`:

```sql
CREATE TABLE project_docs (
  project_id UUID,
  doc_id UUID,
  added_by UUID,
  created_at TIMESTAMPTZ
);
```

---

## 7. Testing Checklist

### Authentication

- [ ] Extension loads without errors
- [ ] Can click "Sign in with Google"
- [ ] OAuth flow redirects to Google
- [ ] OAuth redirects back to callback
- [ ] Extension receives auth token
- [ ] Extension stores session
- [ ] Can logout successfully

### Capture Features

- [ ] Quick capture popup opens (`Ctrl+Shift+P`)
- [ ] Can select project from dropdown
- [ ] Can enter title and notes
- [ ] Content saves successfully
- [ ] Content appears in War Room
- [ ] Selection capture works (`Ctrl+Shift+S`)
- [ ] Full page capture works (`Ctrl+Shift+A`)

### Context Menus

- [ ] Right-click on selection shows "Capture to Pulse"
- [ ] Right-click on page shows "Capture entire page"
- [ ] Right-click on link shows "Save link"
- [ ] Right-click on image shows "Save image"
- [ ] All context menu items function correctly

### Persistence

- [ ] Extension settings persist across browser restarts
- [ ] Auth session persists
- [ ] Recent projects list updates
- [ ] Capture history is maintained

---

## 8. Production Deployment

### Chrome Web Store

1. Create a Chrome Web Store developer account ($5 one-time fee)
2. Zip the `browser-extension` folder
3. Upload to Chrome Web Store Developer Dashboard
4. Fill in store listing details:
   - Description
   - Screenshots
   - Privacy policy URL
   - Category: Productivity
5. Submit for review

### Firefox Add-ons

1. Create a Firefox Add-ons developer account (free)
2. Zip the `browser-extension` folder
3. Upload to Firefox Add-ons Developer Hub
4. Fill in listing details
5. Submit for review

---

## 9. Troubleshooting

### Extension won't load

- Check that `manifest.json` is valid JSON
- Verify all file paths in manifest exist
- Check browser console for errors

### OAuth not working

- Verify redirect URLs are exactly configured in both:
  - Supabase Dashboard
  - Google Cloud Console
- Check that OAuth client ID and secret match
- Ensure Supabase Google provider is enabled

### Content not saving

- Check browser console for API errors
- Verify Supabase connection
- Check RLS policies allow inserts
- Verify `knowledge_docs` table exists

### Extension icon not showing

- Check that icon files exist in `icons/` folder
- Verify icon paths in `manifest.json`
- Try reloading the extension

---

## 10. Support

For issues or questions:

- GitHub Issues: https://github.com/logosvision/pulse/issues
- Email: support@logosvision.org
- Documentation: https://pulse.logosvision.org/docs

---

## API Endpoints Used

The extension communicates with these Supabase REST API endpoints:

```
POST   https://ucaeuszgoihoyrvhewxk.supabase.co/rest/v1/knowledge_docs
POST   https://ucaeuszgoihoyrvhewxk.supabase.co/rest/v1/project_docs
GET    https://ucaeuszgoihoyrvhewxk.supabase.co/rest/v1/ai_projects?user_id=eq.{userId}
```

All requests require authentication via JWT token in the `Authorization` header.

---

**Last Updated**: January 19, 2026
**Version**: 1.0.0
