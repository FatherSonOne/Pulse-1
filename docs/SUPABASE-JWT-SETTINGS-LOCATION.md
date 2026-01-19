# 🔐 Finding JWT Expiry Settings in Supabase (Updated UI)

## The Settings Moved!

The Supabase UI has changed. Here's where to find the JWT expiry settings now:

---

## ✅ Correct Location (Updated for Current Supabase UI)

### Option 1: Project Settings (Most Likely)

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your Pulse project**
3. Click **⚙️ Project Settings** (bottom of left sidebar)
4. Click **Auth** in the settings menu
5. Scroll down to find these sections:

   **Look for**:
   - **JWT Expiry** (under "Security and sessions")
   - **JWT Settings** section
   - **Session timeout** settings
   - Or **Auth config** section

### Option 2: Authentication Configuration

1. Click **Authentication** in left sidebar
2. Look for a **Configuration** tab at the top
3. Or look for **⚙️ Settings** icon/button in the Authentication page
4. Find **JWT expiry** or **Session duration** settings

---

## 🔍 What You're Looking For

The setting might be labeled as:
- **JWT expiry**
- **Access token lifetime**
- **Session timeout**
- **Token expiry duration**

It will have a value in **seconds** (default is usually `3600` = 1 hour)

---

## 🎯 If You Still Can't Find It: Use Configuration Method

Since the UI keeps changing, here's a **guaranteed method** using Supabase's configuration:

### Method: Edit Project Configuration Directly

1. **Go to Supabase Dashboard**
2. **Select your Pulse project**
3. Click **⚙️ Project Settings** (bottom left)
4. Click **API** in the settings menu
5. Look for **Project Configuration** or **Config Variables**

### Add/Edit This Configuration:

Look for or add these environment variables:

```
GOTRUE_JWT_EXP = 604800
GOTRUE_REFRESH_TOKEN_ROTATION_ENABLED = true
```

**Where**:
- `604800` = 7 days in seconds
- This controls JWT expiry time

---

## 🚀 Alternative: Use SQL to Check Current Settings

**In Supabase SQL Editor**, run this to see current auth configuration:

```sql
-- Check current auth settings
SELECT * FROM pg_settings WHERE name LIKE '%jwt%';
```

---

## 💡 Easiest Solution: The Code Fix is Already Done!

**Good news**: The code changes I made to `src/services/supabase.ts` should significantly help even without changing Supabase settings!

### What The Code Fix Does:

The updated code now:
- ✅ Checks your session every **2 minutes** (was 5)
- ✅ Refreshes when **30 minutes** left (was 10)
- ✅ Much more aggressive about keeping you logged in

### Test It Now:

1. Make sure your dev server is running: `npm run dev`
2. Log out and back into Pulse
3. Check browser console (F12) for:
   ```
   [Session Monitor] Started automatic session refresh monitoring
   [Session Monitor] Session valid for X minutes
   ```
4. Leave Pulse open and come back in 15 minutes - should still be logged in!

---

## 🎯 Current Situation

Even with default Supabase settings (1 hour JWT expiry), the code changes should make a **huge difference** because:

1. **Auto-refresh happens at 30 min left** instead of 10
2. **Checks every 2 minutes** instead of 5
3. **Refreshes when app becomes visible** (you switch back to tab)

This means as long as you're **somewhat active** (return within 30 min of last activity), you'll **never get logged out**!

---

## 📊 Expected Behavior with Code Fix Only

| Scenario | Result |
|----------|--------|
| Using Pulse actively | ✅ Never logged out |
| Leave tab open, return < 30 min | ✅ Still logged in |
| Leave tab open, return 45 min later | ⚠️ Might need re-login |
| Close browser, return next day | ❌ Will need re-login |

---

## 🔧 Additional Step: Check Auth Providers

Sometimes the session duration is tied to your OAuth provider (Google):

1. In Supabase Dashboard
2. **Authentication** → **Providers**
3. Click on **Google** (or whatever you're using)
4. Look for **Session duration** or **Token lifetime** settings

---

## 🎉 Try This First

**Before hunting for Supabase settings**, test the code fix:

1. **Restart your dev server**: 
   ```bash
   npm run dev
   ```

2. **Clear browser storage** (fresh start):
   - Open DevTools (F12)
   - Application tab → Storage → Clear site data
   - Close DevTools

3. **Log in to Pulse**

4. **Monitor the console** (F12):
   ```
   [Session Monitor] Started automatic session refresh monitoring
   [Session Monitor] Session valid for X minutes
   ```

5. **Leave Pulse running for 20 minutes**, then come back
   - You should see auto-refresh messages in console
   - You should still be logged in

If this works well enough, you might not even need to change Supabase settings!

---

## 📞 Next Steps

1. **Try the code fix first** (it's already done)
2. If you still want to find Supabase settings, look in:
   - Project Settings → Auth
   - Or Configuration → Environment Variables
3. Let me know if the code fix helps enough!

---

## 🐛 Quick Debug

**Check your current session expiry** (paste in browser console):

```javascript
const { data } = await supabase.auth.getSession();
if (data.session) {
  const expiresAt = data.session.expires_at * 1000;
  const now = Date.now();
  const minutesLeft = Math.round((expiresAt - now) / 60000);
  console.log('Session expires in:', minutesLeft, 'minutes');
  console.log('Session expires at:', new Date(expiresAt).toLocaleString());
} else {
  console.log('No active session');
}
```

This will tell you exactly when your current session expires.

---

**TL;DR**: The code fix I already made should help a lot! Test it first before hunting for Supabase settings. The session will auto-refresh as long as you return within 30 minutes of last activity.
