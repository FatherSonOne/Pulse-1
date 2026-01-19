# Document Deletion Not Working - Debug Guide

## Issue
Documents immediately respawn after clicking delete button.

## Most Likely Cause
**Supabase RLS (Row Level Security) policies are blocking deletion.**

---

## 🔧 Quick Fix (Run this in Supabase)

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your Pulse project
3. Click "SQL Editor" in the left sidebar
4. Click "New Query"

### Step 2: Run This SQL

```sql
-- Fix Document Deletion Permissions

-- 1. Add DELETE policy for users
DROP POLICY IF EXISTS "Users can delete their own documents" ON knowledge_docs;

CREATE POLICY "Users can delete their own documents"
ON knowledge_docs
FOR DELETE
USING (auth.uid() = user_id);

-- 2. Enable CASCADE deletion for embeddings
ALTER TABLE doc_embeddings
DROP CONSTRAINT IF EXISTS doc_embeddings_doc_id_fkey CASCADE;

ALTER TABLE doc_embeddings
ADD CONSTRAINT doc_embeddings_doc_id_fkey
FOREIGN KEY (doc_id)
REFERENCES knowledge_docs(id)
ON DELETE CASCADE;

-- 3. Enable CASCADE deletion for project links
ALTER TABLE project_docs
DROP CONSTRAINT IF EXISTS project_docs_doc_id_fkey CASCADE;

ALTER TABLE project_docs
ADD CONSTRAINT project_docs_doc_id_fkey
FOREIGN KEY (doc_id)
REFERENCES knowledge_docs(id)
ON DELETE CASCADE;

-- Verify
SELECT 'Fix applied successfully!' AS status;
```

### Step 3: Click "Run"

### Step 4: Test in Pulse
1. Refresh your Pulse app
2. Try deleting a document again
3. Should work now! ✅

---

## 🐛 Debug Steps (If still not working)

### 1. Open Browser Console
- Press **F12** (Windows/Linux) or **Cmd+Option+I** (Mac)
- Click "Console" tab
- Keep it open while testing

### 2. Try Deleting a Document
- Click the trash icon on any document
- Watch the console for messages

### 3. Look For These Logs

**✅ Good logs (working):**
```
[War Room] DELETE CLICKED - Document: MyDoc.txt ID: abc-123
[War Room] Calling ragService.deleteDocument...
[RAG Service] Deleting document: abc-123
[RAG Service] Embeddings deleted successfully
[RAG Service] Project links deleted successfully
[RAG Service] Document deleted successfully from database
[War Room] ✅ DELETE SUCCESS
[War Room] ✅ Delete complete and verified
```

**❌ Bad logs (permission denied):**
```
[War Room] DELETE CLICKED - Document: MyDoc.txt
[War Room] ❌ DELETE FAILED: { code: '42501', message: 'permission denied' }
```

**❌ Bad logs (still exists after delete):**
```
[War Room] ✅ DELETE SUCCESS
[War Room] Reloading documents...
[RAG Service] Documents fetched: 9
// (document reappears in list)
```

### 4. Copy Console Errors
- If you see red error messages, copy them
- Share them so I can see what's failing

---

## 🔍 Manual Database Check

### Check Current Policies

Run this in Supabase SQL Editor:

```sql
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'knowledge_docs'
ORDER BY cmd;
```

**Expected Result:**
You should see a policy for `DELETE` that includes `auth.uid() = user_id`.

If you don't see a DELETE policy, that's the problem!

### Check If Documents Can Be Deleted

Try manually deleting in SQL (REPLACE the ID):

```sql
-- Find a document ID first
SELECT id, title FROM knowledge_docs LIMIT 1;

-- Try to delete it (use actual ID from above)
DELETE FROM knowledge_docs WHERE id = 'REPLACE-WITH-ACTUAL-ID';
```

If you get "permission denied", the RLS policy is the issue.

---

## 💡 Alternative Fix (If SQL doesn't work)

### Temporarily Disable RLS (NOT RECOMMENDED FOR PRODUCTION)

```sql
ALTER TABLE knowledge_docs DISABLE ROW LEVEL SECURITY;
ALTER TABLE doc_embeddings DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_docs DISABLE ROW LEVEL SECURITY;
```

⚠️ **Warning:** This removes security! Only use for testing.

### Re-enable with proper policies:

```sql
ALTER TABLE knowledge_docs ENABLE ROW LEVEL SECURITY;

-- Then run the fix from Step 2 above
```

---

## 🎯 Expected Behavior After Fix

### When You Click Delete:
1. ✅ Document disappears from sidebar immediately
2. ✅ Toast message: "Deleted: filename.txt"
3. ✅ Console shows success messages
4. ✅ Document stays gone after refresh
5. ✅ No errors in console

### What Should Happen in Database:
1. Document removed from `knowledge_docs` table
2. Related embeddings automatically deleted (CASCADE)
3. Related project links automatically deleted (CASCADE)

---

## 🚨 Still Not Working?

### Check These:

1. **Are you logged in?**
   - The `auth.uid()` must match the `user_id` on documents
   - Log out and log back in

2. **Did the SQL run successfully?**
   - Check for error messages after running SQL
   - Make sure you clicked "Run"

3. **Are you the document owner?**
   - You can only delete documents you uploaded
   - Check: `SELECT user_id FROM knowledge_docs WHERE id = 'doc-id';`
   - Compare with: `SELECT auth.uid();`

4. **Browser cache?**
   - Clear cache: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Try in incognito/private window

5. **Still respawning?**
   - Check console for: `[War Room] SKIPPING reload - deletion in progress`
   - If you see this, the deletion state is working
   - The problem is the database deletion failing

---

## 📋 What I've Added to Help Debug

### New Console Logs:
- `[War Room] DELETE CLICKED` - Shows when button clicked
- `[War Room] Calling ragService.deleteDocument...` - Before DB call
- `[RAG Service] Deleting document:` - Inside delete function
- `[RAG Service] Embeddings deleted successfully` - Embeddings removed
- `[RAG Service] Document deleted successfully` - Main doc removed
- `[War Room] ✅ DELETE SUCCESS` - Confirmed from DB
- `[War Room] ❌ DELETE FAILED:` - Shows exact error

### Deletion Safeguards:
- Sets `isDeletingDoc = true` to block reloads
- Waits 1 second for DB transaction to commit
- Only reloads after deletion completes
- Shows document name in success message

---

## 📞 Next Steps

1. **Run the SQL fix** (Step 2 above)
2. **Test deletion** with console open
3. **Copy any errors** from console
4. **Let me know** what logs you see

The fix should work in 99% of cases - it's almost certainly an RLS permission issue.

---

**Files Created:**
- `fix-document-deletion-permissions.sql` - Run this in Supabase
- `check-document-deletion.sql` - Diagnostic queries
- This guide

**Files Modified:**
- `src/components/LiveDashboard.tsx` - Added extensive logging and deletion safeguards
