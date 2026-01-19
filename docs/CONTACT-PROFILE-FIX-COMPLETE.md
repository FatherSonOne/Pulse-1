# 🔧 Fix for "Profile not found" Error - Database Column Ambiguity

## Problem Found!

The screenshot shows the real issue:
```
Error code: '42702'
Message: "Column reference 'email' is ambiguous"
```

This is a **database function error** in the `get_enriched_user_profile` function.

---

## ✅ Solution: Apply Database Migration

I've created a fix migration that resolves the ambiguous column references.

### Step 1: Apply the Migration

**Option A: Using Supabase CLI (Recommended)**
```bash
# Navigate to your project root
cd F:\pulse

# Push the new migration to Supabase
npx supabase db push
```

**Option B: Manual SQL (If CLI doesn't work)**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy the entire contents of: `supabase/migrations/016_fix_contact_profile_error.sql`
3. Paste into SQL Editor
4. Click **Run**

### Step 2: Verify the Fix

After running the migration, test it:

1. **Restart your dev server**:
   ```bash
   npm run dev
   ```

2. **Clear browser storage** (fresh start):
   - Open DevTools (F12)
   - Application tab → Storage → Clear site data

3. **Log back into Pulse**

4. **Try clicking on a contact** (like Frankie Messana)
   - The profile should now load!
   - Check console for success logs instead of errors

---

## 🔍 What Was Wrong

### The Bug:
The database function had an ambiguous column reference:
```sql
SELECT
    p.phone,  -- Column exists in user_profiles
    (SELECT email FROM auth.users WHERE id = p.id) as email,  -- Subquery
    ...
```

When joining tables, SQL couldn't determine which `email` column to use.

### The Fix:
```sql
SELECT
    p.phone_number,  -- Use explicit column name
    p.email,         -- Use email from user_profiles directly
    p.company,       -- Added missing columns
    p.role,          -- Added missing columns
    p.location,      -- Added missing columns
    p.birthday,      -- Added missing columns
    ...
```

---

## 📦 Files Changed

### 1. Database Migration (NEW)
**File**: `supabase/migrations/016_fix_contact_profile_error.sql`
- Drops old function
- Recreates with fixed column references
- Adds missing profile fields

### 2. TypeScript Types (UPDATED)
**File**: `src/types/userContact.ts`
- Changed `phone` → `phoneNumber` to match DB
- Added `company`, `role`, `location`, `birthday` fields
- Made optional fields properly optional

### 3. Service Layer (UPDATED)
**File**: `src/services/userContactService.ts`
- Updated `mapEnrichedProfileFromRpc` to use `phone_number`
- Added mapping for new fields
- Fixed fallback query to match new schema

---

## 🧪 Testing

### Test 1: Basic Profile Load
```javascript
// In browser console (F12)
const { data, error } = await supabase.rpc('get_enriched_user_profile', {
  p_requesting_user_id: 'your-user-id',
  p_target_user_id: '9af4fe07-4d0e-4e58-ba2c-252e8a7b682d'
});

if (error) {
  console.error('Error:', error);
} else {
  console.log('Profile loaded:', data);
}
```

### Test 2: Click Contact in UI
1. Open Messages
2. Click on any Pulse user avatar
3. Contact panel should slide in without errors
4. You should see their profile information

### Test 3: Check Console Logs
Look for these success messages:
```
[userContactService] getEnrichedProfile called for: 9af4fe07...
[userContactService] RPC returned data: [object]
[UserContactCard] Received profile data: [object]
```

---

## 🎉 Expected Results

### Before Fix:
- ❌ Error: "Column reference 'email' is ambiguous"
- ❌ "Profile not found" dialog
- ❌ Console shows RPC error code 42702

### After Fix:
- ✅ Profile loads successfully
- ✅ Contact panel slides in smoothly
- ✅ All profile fields display correctly
- ✅ Console shows successful data retrieval

---

## 🐛 If Still Having Issues

### Check Migration Applied
```sql
-- Run in Supabase SQL Editor
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'get_enriched_user_profile';
```

Should show the updated function with `phone_number` instead of `phone`.

### Check User Profile Exists
```sql
-- Run in Supabase SQL Editor
SELECT id, handle, email, phone_number 
FROM user_profiles 
WHERE id = '9af4fe07-4d0e-4e58-ba2c-252e8a7b682d';
```

Should return the user's profile data.

### Force Refresh Types
```bash
# Regenerate Supabase types
npx supabase gen types typescript --project-id your-project-id > src/types/supabase.ts
```

---

## 📊 Technical Details

### Column Mapping Changes

| Old (Broken) | New (Fixed) | Source Table |
|--------------|-------------|--------------|
| `p.phone` | `p.phone_number` | user_profiles |
| Subquery for email | `p.email` | user_profiles |
| Missing | `p.company` | user_profiles |
| Missing | `p.role` | user_profiles |
| Missing | `p.location` | user_profiles |
| Missing | `p.birthday` | user_profiles |

### Why It Failed
PostgreSQL couldn't resolve which `email` column to use when:
1. user_profiles table has an `email` column
2. A subquery was trying to get email from auth.users
3. Both were in the same SELECT statement

### The Proper Fix
- Use columns directly from the `user_profiles` table
- Remove ambiguous subqueries
- Explicitly qualify all column names with table aliases

---

## 🚀 Quick Checklist

- [ ] Migration file created: `016_fix_contact_profile_error.sql`
- [ ] TypeScript types updated: `src/types/userContact.ts`
- [ ] Service updated: `src/services/userContactService.ts`
- [ ] Run migration in Supabase (SQL Editor or CLI)
- [ ] Restart dev server: `npm run dev`
- [ ] Clear browser storage
- [ ] Test clicking on contact
- [ ] Verify profile loads without errors

---

## 💡 Prevention

To avoid similar issues in the future:
1. Always use explicit table aliases in SQL (e.g., `p.email`, not just `email`)
2. Avoid subqueries when the column exists in the main table
3. Test database functions with sample data before deploying
4. Keep TypeScript types in sync with database schema

---

**Once you run the migration, the "Profile not found" error should be completely resolved!** 🎉
