# 🔐 How to Increase Pulse Session Duration

## Problem
You're being logged out of Pulse too frequently (almost every time you return to the app).

## Root Cause
Supabase JWT tokens expire by default after **1 hour**. While Pulse has auto-refresh enabled, if you close the app or tab, the refresh doesn't happen and your session expires.

---

## ✅ Solution 1: Increase JWT Expiry in Supabase (Recommended)

This changes the session duration at the server level, which is the most reliable fix.

### Steps:

1. **Go to your Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your Pulse project

2. **Navigate to Authentication Settings**
   - Click **Authentication** in the left sidebar
   - Click **Policies** (or **Settings** depending on UI)
   - Look for **JWT Settings** or **Token Settings**

3. **Increase JWT Expiry**
   - Find **JWT expiry limit** (default: 3600 seconds = 1 hour)
   - Change to one of these values:

   ```
   Recommended Options:
   • 604800 seconds  = 7 days (recommended for active users)
   • 2592000 seconds = 30 days (very convenient)
   • 86400 seconds   = 24 hours (middle ground)
   ```

4. **Save Changes**
   - Click **Save** or **Update**
   - Changes take effect immediately for new sessions

5. **Log Out and Back In**
   - In Pulse, log out completely
   - Log back in
   - Your new session will now last for the configured duration

### What This Does:
- JWT tokens will remain valid for much longer
- Pulse's auto-refresh will keep extending your session
- You won't be logged out unless you're inactive for the full duration

---

## ✅ Solution 2: Increase Refresh Token Expiry (Additional)

Refresh tokens are used to get new JWT tokens without re-logging in.

### Steps:

1. In the same **Authentication Settings** in Supabase:

2. Find **Refresh Token Rotation** settings

3. Set **Refresh Token Reuse Interval**:
   ```
   • Default: 10 seconds
   • Recommended: 3600 seconds (1 hour)
   ```

4. Set **Refresh Token Lifetime**:
   ```
   • Recommended: 2592000 seconds (30 days)
   ```

This ensures that even if your JWT expires, the refresh token can get you a new one for up to 30 days.

---

## ✅ Solution 3: Add Client-Side Session Persistence (Code Change)

If you can't change Supabase settings, or want extra reliability, we can improve the client-side code.

### File to Modify: `src/services/supabase.ts`

**Current Code** (lines 92-94):
```typescript
// Session refresh interval (check every 5 minutes instead of waiting for expiry)
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const TOKEN_REFRESH_THRESHOLD = 10 * 60 * 1000; // Refresh if less than 10 minutes left
```

**Change to** (more aggressive refresh):
```typescript
// Session refresh interval (check every 2 minutes for reliability)
const SESSION_CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes
const TOKEN_REFRESH_THRESHOLD = 30 * 60 * 1000; // Refresh if less than 30 minutes left
```

### What This Does:
- Checks session every 2 minutes instead of 5
- Refreshes when there's 30 minutes left instead of 10
- Much more proactive about keeping you logged in

---

## 🎯 Recommended Combination

**For Best Results, Do All Three:**

1. **Supabase JWT Expiry**: Set to 7 days (604800 seconds)
2. **Supabase Refresh Token**: Set to 30 days (2592000 seconds)
3. **Client Code**: Update thresholds to be more aggressive (optional)

This combination will:
- ✅ Keep you logged in for days/weeks at a time
- ✅ Auto-refresh before expiry
- ✅ Work even if you close and reopen the app
- ✅ Only require re-login every 30 days (or when you manually log out)

---

## 📝 Implementation Instructions

### For Supabase Changes (No Code Needed):

1. Log into Supabase Dashboard: https://supabase.com/dashboard
2. Select your Pulse project
3. Go to: **Authentication > Settings**
4. Find **JWT Settings** section
5. Change these values:
   - **JWT expiry limit**: `604800` (7 days)
   - **Refresh token reuse interval**: `3600` (1 hour)  
   - **Refresh token lifetime**: `2592000` (30 days)
6. Click **Save**
7. Done! Log out/in to Pulse to get new session

### For Code Changes (Optional Extra):

Would you like me to make the code changes to `src/services/supabase.ts` to be more aggressive about refreshing? This would give you extra protection.

---

## 🧪 Testing

After making changes:

1. **Log out of Pulse completely**
2. **Log back in**
3. **Check console** (F12) for:
   ```
   [Session Monitor] Session valid for X minutes
   ```
4. **Wait 10 minutes**
5. **Refresh the page** - you should still be logged in
6. **Close the app/tab**
7. **Return hours later** - you should still be logged in

---

## 🐛 Troubleshooting

### Still Getting Logged Out?

1. **Check Browser Console** (F12):
   ```javascript
   // Paste this in console to check session info:
   (async () => {
     const { data, error } = await supabase.auth.getSession();
     if (data.session) {
       console.log('Session expires in:', 
         Math.round((data.session.expires_at * 1000 - Date.now()) / 60000), 
         'minutes'
       );
     }
   })();
   ```

2. **Clear Browser Storage**:
   - Go to DevTools > Application > Storage
   - Click "Clear site data"
   - Log in again with fresh session

3. **Check Supabase Logs**:
   - Supabase Dashboard > Logs
   - Look for authentication errors

---

## ⚡ Quick Fix Right Now

If you need an immediate fix and can't access Supabase settings, try this:

**In Pulse, open Browser Console (F12) and run:**
```javascript
// Force a session refresh right now
await supabase.auth.refreshSession();
console.log('Session refreshed!');
```

This will extend your current session immediately.

---

## 📞 Need Help?

If you're still having issues after trying these solutions:
1. Check if Supabase JWT settings saved correctly
2. Clear browser cache and cookies
3. Try in incognito/private window
4. Check Supabase project status (dashboard)

Let me know if you'd like me to make the code changes for you!

---

**TL;DR:** 
1. Go to Supabase Dashboard
2. Authentication > Settings
3. Change JWT expiry to 604800 seconds (7 days)
4. Save and log out/in to Pulse
5. You're done!
