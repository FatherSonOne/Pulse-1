# Fix: Redirect URL Issue in Development

## Problem
When logging in on the dev server (localhost), Supabase redirects to the production URL (`https://pulse.logosvision.org`) instead of back to localhost.

## Solution

The code has been updated to always use `window.location.origin` in development, but you also need to configure Supabase dashboard settings.

### Step 1: Update Supabase Dashboard Settings

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. In the **Redirect URLs** section, add these URLs (one per line):
   ```
   http://localhost:5173
   http://localhost:5173/**
   http://localhost:3000
   http://localhost:3000/**
   http://127.0.0.1:5173
   http://127.0.0.1:5173/**
   ```
5. **Site URL** can remain as `https://pulse.logosvision.org` (this is for production)
6. Click **Save**

### Step 2: Verify Environment Variables

Make sure your `.env.local` file has the correct Supabase URL:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 3: Restart Dev Server

After updating Supabase settings:

```bash
# Stop the dev server (Ctrl+C)
npm run dev
```

### Step 4: Test Login

1. Go to http://localhost:5173 (or your dev server URL)
2. Click "Continue with Google"
3. Complete OAuth login
4. **You should be redirected back to localhost** (not production)

## Technical Details

The code change ensures that:
- In development (localhost), it always uses `window.location.origin`
- In production, it uses `VITE_APP_URL` if set, otherwise current origin
- Native apps use the custom URL scheme

However, Supabase's dashboard settings **must also include localhost URLs** in the Redirect URLs whitelist, otherwise Supabase will reject the redirect and send you to the Site URL instead.

## Why This Happens

Supabase validates redirect URLs against the whitelist in the dashboard. If the redirect URL you're requesting isn't in the whitelist, Supabase ignores it and redirects to the Site URL (production) instead.

By adding localhost URLs to the Redirect URLs list, Supabase will accept and honor localhost redirects during development.

## Additional Notes

- The production Site URL (`https://pulse.logosvision.org`) should remain as is
- You can have both localhost and production URLs in the Redirect URLs list
- The `**` wildcard allows all paths under that domain
- You can add other local ports if needed (e.g., `http://localhost:3001`)
