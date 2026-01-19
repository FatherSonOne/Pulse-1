# ⚡ Quick Fix: Stop Getting Logged Out of Pulse

## 🎯 Fastest Solution (5 minutes)

### Go to Supabase Dashboard:
1. Visit: **https://supabase.com/dashboard**
2. Select your **Pulse project**
3. Click **Authentication** (left sidebar)
4. Click **Settings** or **Policies**
5. Find **JWT Settings**

### Change This One Setting:
```
JWT expiry limit: 604800
```
(That's 7 days in seconds)

### Save and Re-Login:
- Click **Save**
- Log out of Pulse
- Log back in
- **Done!** You'll stay logged in for 7 days now

---

## ✅ What I Just Changed in Your Code

**File Modified**: `src/services/supabase.ts`

**Before**:
- Checked session every 5 minutes
- Refreshed when 10 minutes left

**After**:
- Checks session every 2 minutes ✅
- Refreshes when 30 minutes left ✅

This makes Pulse **much more aggressive** about keeping you logged in, even before you hit the Supabase settings.

---

## 🧪 Test It

1. Make sure the code change is saved
2. Restart your dev server: `npm run dev`
3. Log out and back into Pulse
4. Check browser console (F12) - you should see:
   ```
   [Session Monitor] Started automatic session refresh monitoring
   [Session Monitor] Session valid for X minutes
   ```
5. Leave Pulse open in a tab for 10+ minutes
6. Come back - you should still be logged in!

---

## 📊 Expected Results

| Before | After |
|--------|-------|
| Logged out ~every 1 hour | Logged out after 7 days |
| Manual login frequently | Auto-refresh keeps you in |
| Session checks every 5 min | Session checks every 2 min |
| Refreshes at 10 min left | Refreshes at 30 min left |

---

## 💡 Pro Tip

For **maximum session persistence**:

### Supabase Settings:
- **JWT expiry**: 604800 (7 days)
- **Refresh token lifetime**: 2592000 (30 days)

### Result:
You'll only need to log in once every **30 days** (or when you manually log out).

---

## 🐛 If Still Having Issues

**Quick debug command** (paste in browser console):
```javascript
// Check your current session status
const { data } = await supabase.auth.getSession();
console.log('Expires in:', Math.round((data.session?.expires_at * 1000 - Date.now()) / 60000), 'minutes');
```

**Force refresh right now**:
```javascript
await supabase.auth.refreshSession();
console.log('Refreshed!');
```

---

**Questions?** Check `SESSION-DURATION-FIX.md` for full details!
