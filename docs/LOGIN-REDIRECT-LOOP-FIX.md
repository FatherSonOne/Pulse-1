# Fix: Login Redirect Loop Issue (Production)

## Problem Description
When users try to log in at https://pulse.logosvision.org, the OAuth authorization opens the Pulse app loading screen, but then cycles back to the landing page instead of completing authentication.

## Root Cause Analysis

### 1. **Environment Variable Mismatch** ✅ FIXED
The `.env.production` file had the wrong URL:
- **Incorrect**: `VITE_APP_URL=https://app.pulsemessages.com`
- **Correct**: `VITE_APP_URL=https://pulse.logosvision.org`

This caused the OAuth redirect URL to be misconfigured.

### 2. **Supabase OAuth Redirect URLs** ⚠️ NEEDS CONFIGURATION
The Supabase project must have the production URL whitelisted in the allowed redirect URLs.

### 3. **Auth State Not Persisting**
Possible session or token refresh issue after OAuth callback.

## Solution Steps

### Step 1: Update Supabase Dashboard Settings ⚠️ REQUIRED

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your Pulse project**
3. **Navigate to**: Authentication → URL Configuration
4. **Update the following settings**:

   **Site URL:**
   ```
   https://pulse.logosvision.org
   ```

   **Redirect URLs** (add these, one per line):
   ```
   https://pulse.logosvision.org
   https://pulse.logosvision.org/**
   https://pulse.logosvision.org/auth/callback
   http://localhost:5173
   http://localhost:5173/**
   http://localhost:3000
   http://localhost:3000/**
   ```

5. **Click Save**

### Step 2: Verify Environment Variables ✅ COMPLETED

The `.env.production` file has been updated with the correct URLs:

```env
VITE_APP_URL=https://pulse.logosvision.org
VITE_API_URL=https://pulse.logosvision.org
```

### Step 3: Rebuild and Redeploy the Application

After updating Supabase settings:

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Deploy to production (your deployment method)
# For example, if using Vercel:
vercel --prod

# Or if using another platform, upload the dist/ folder
```

### Step 4: Verify OAuth Provider Configuration

For **Google OAuth** (if using):

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Find your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, ensure you have:
   ```
   https://pulse.logosvision.org
   https://pulse.logosvision.org/auth/callback
   https://YOUR-SUPABASE-PROJECT.supabase.co/auth/v1/callback
   ```

For **Microsoft OAuth** (if using):

1. Go to [Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps)
2. Find your app registration
3. Under **Authentication** → **Platform configurations** → **Web**
4. Ensure redirect URIs include:
   ```
   https://pulse.logosvision.org
   https://YOUR-SUPABASE-PROJECT.supabase.co/auth/v1/callback
   ```

### Step 5: Test the Login Flow

1. **Clear browser cache and cookies** for `pulse.logosvision.org`
2. Go to https://pulse.logosvision.org
3. Click "Get Started" or "Log In"
4. Complete OAuth login with your provider (Google/Microsoft)
5. **Expected Result**: You should be redirected back to the Pulse dashboard, NOT the landing page

## Technical Details

### How OAuth Flow Works

1. User clicks "Login with Google" on landing page
2. App calls `loginWithGoogle()` which redirects to Supabase Auth
3. Supabase redirects to Google OAuth consent screen
4. User authorizes the app
5. Google redirects back to Supabase with auth code
6. **Supabase exchanges code for tokens and redirects to `VITE_APP_URL`**
7. App receives callback, `onAuthStateChange` fires with user session
8. `AuthContext` sets user state
9. `App.tsx` detects authenticated user and shows dashboard

### Why the Loop Occurred

**Before the fix:**
- Step 6 was redirecting to `https://app.pulsemessages.com` (wrong URL)
- This URL wasn't configured, so Supabase may have rejected it
- Or the redirect happened but to the wrong domain
- User ended up on landing page without auth state
- Clicking login again started the cycle

**After the fix:**
- Step 6 redirects to `https://pulse.logosvision.org` (correct)
- Supabase accepts the redirect (if configured properly)
- Auth state is set correctly
- User sees dashboard

## Troubleshooting

### Issue: Still redirects to landing page after OAuth

**Check:**
1. Supabase redirect URLs include `https://pulse.logosvision.org/**`
2. Browser console for errors (press F12)
3. Network tab shows successful auth callback
4. LocalStorage has `pulse_user_session` key after login

**Solution:**
- Clear browser cache completely
- Check Supabase logs for auth errors
- Verify Google/Microsoft OAuth redirect URIs

### Issue: "Invalid redirect URI" error

**Check:**
1. Google Cloud Console has the correct redirect URIs
2. Supabase project has `https://pulse.logosvision.org` in redirect URLs
3. The OAuth provider callback URL matches Supabase's callback format

**Solution:**
- Add the exact redirect URI shown in the error to both Google Cloud Console and Supabase settings

### Issue: Session not persisting after refresh

**Check:**
1. Browser is allowing cookies for `pulse.logosvision.org`
2. Supabase session expiry settings
3. Browser console for session refresh errors

**Solution:**
```javascript
// Check session in browser console:
localStorage.getItem('pulse_user_session')

// If null, clear and retry:
localStorage.clear()
// Then login again
```

## Verification Checklist

After completing all steps:

- [ ] `.env.production` has `VITE_APP_URL=https://pulse.logosvision.org`
- [ ] Supabase Site URL is `https://pulse.logosvision.org`
- [ ] Supabase Redirect URLs includes `https://pulse.logosvision.org/**`
- [ ] Google OAuth redirect URIs include Supabase callback URL
- [ ] Application rebuilt with `npm run build`
- [ ] Application deployed to production
- [ ] Login flow tested end-to-end successfully
- [ ] User session persists after page refresh
- [ ] No console errors during authentication

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Setup](https://support.google.com/cloud/answer/6158849)
- [Pulse OAuth Setup Guide](./OAUTH_SETUP_GUIDE.md)
- [Pulse Redirect URL Fix](./REDIRECT-URL-FIX.md)

## Support

If issues persist after following this guide:

1. Check browser console for specific error messages
2. Review Supabase Auth logs in dashboard
3. Verify network requests in browser DevTools
4. Test with a different OAuth provider (Google vs Microsoft)
5. Try in incognito/private browsing mode
