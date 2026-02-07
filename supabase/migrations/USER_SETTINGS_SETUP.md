# User Settings Table Setup

This guide will help you set up the `user_settings` table in your Supabase database to fix the 400 Bad Request errors.

## What This Fixes

✅ Eliminates 400 errors from `/rest/v1/user_settings` API calls
✅ Enables cross-device settings sync
✅ Removes console warnings about "Cloud sync disabled"
✅ Properly secures user settings with RLS policies

## Quick Setup (Recommended)

### Option 1: Via Supabase Dashboard (Easiest)

1. **Open Supabase Dashboard**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your Pulse project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "+ New query"

3. **Copy and Paste the SQL**
   - Open `supabase/migrations/create_user_settings_secure.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Run the Migration**
   - Click "Run" (or press `Ctrl/Cmd + Enter`)
   - Wait for completion (should take 1-2 seconds)

5. **Verify Success**
   - Scroll down to see verification queries results
   - You should see:
     - ✅ Table created with RLS enabled
     - ✅ 4 RLS policies created
     - ✅ Indexes created
     - ✅ No errors

### Option 2: Via Supabase CLI (For Local Development)

```bash
# Make sure you're in the project root
cd f:\pulse1

# Push the migration to your database
supabase db push

# Or apply a specific migration
supabase migration up
```

## What Gets Created

### Table Structure
```sql
user_settings
├── id (UUID, primary key)
├── user_id (UUID, unique, references auth.users)
├── settings (JSONB, stores all app settings)
├── created_at (timestamp)
└── updated_at (timestamp, auto-updated)
```

### RLS Policies (Secure)
- **View**: Users can only read their own settings
- **Insert**: Users can only create their own settings
- **Update**: Users can only update their own settings
- **Delete**: Users can only delete their own settings

Each policy uses `auth.uid() = user_id` to ensure users can't access others' settings.

## Testing

After running the migration:

1. **Refresh your Pulse app** (hard refresh: `Ctrl/Cmd + Shift + R`)
2. **Open browser console** (F12)
3. **Log in to your account**
4. **Check for errors:**
   - ✅ No 400 errors in Network tab
   - ✅ No "Cloud sync disabled" warnings
   - ✅ Settings should now sync to database

## Verification Queries

Run these in Supabase SQL Editor to verify everything is set up correctly:

```sql
-- Check if table exists
SELECT tablename, tableowner, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'user_settings';

-- Check RLS policies
SELECT policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_settings';

-- Test query (should return empty or your settings)
SELECT * FROM user_settings;
```

## Troubleshooting

### Still seeing 400 errors?

**Cause**: Browser cached the failed requests
**Fix**: Hard refresh the page (`Ctrl/Cmd + Shift + R`)

### Seeing permission errors?

**Cause**: RLS policies might not be applied correctly
**Fix**: Rerun the migration SQL (it's safe to run multiple times)

### Settings not syncing?

**Cause**: `user_id` might not match your auth user ID
**Fix**: Check that you're logged in with the correct account

```sql
-- Check your auth user ID
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Check if settings exist for your user
SELECT * FROM user_settings WHERE user_id = 'your-user-id-here';
```

## Security Notes

✅ **Row Level Security (RLS) is enabled** - Users can only access their own data
✅ **Foreign key to auth.users** - Settings are automatically deleted when user is deleted
✅ **API keys are NOT synced** - Sensitive keys remain local only
✅ **JSONB validation** - Settings are stored in a structured format

## What Gets Synced

The following settings sync to the database:
- Theme preferences (light/dark/system)
- Notification settings
- Privacy settings
- Display preferences
- Calendar preferences
- Voice/Vox settings

**NOT synced** (local only for security):
- OpenAI API key
- Claude API key
- AssemblyAI API key
- ElevenLabs API key
- Perplexity API key
- Mapbox API key

## Next Steps

After setting up the table:

1. ✅ Verify 400 errors are gone
2. ✅ Test settings sync by changing a setting and refreshing
3. ✅ Test cross-device sync (optional) by logging in from another device
4. ✅ Monitor console for any remaining errors

## Need Help?

If you encounter any issues:

1. Check the verification queries above
2. Review the console errors (if any)
3. Check Supabase logs in the dashboard
4. Ensure you're using the latest migration file
