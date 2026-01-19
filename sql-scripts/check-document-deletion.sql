-- Check Document Deletion Permissions
-- Run this in Supabase SQL Editor to verify deletion is allowed

-- 1. Check if documents exist
SELECT id, title, user_id, created_at 
FROM knowledge_docs 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Check RLS policies for knowledge_docs table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'knowledge_docs';

-- 3. Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'knowledge_docs';

-- 4. Test deletion (REPLACE 'document-id-here' with actual ID)
-- DELETE FROM knowledge_docs WHERE id = 'document-id-here';

-- 5. Check foreign key constraints
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON rc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'knowledge_docs'
  AND tc.constraint_type = 'FOREIGN KEY';

-- 6. Check doc_embeddings foreign key
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON rc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'doc_embeddings'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'knowledge_docs';

-- If RLS is blocking deletions, add this policy:
/*
CREATE POLICY "Users can delete their own documents"
ON knowledge_docs
FOR DELETE
USING (auth.uid() = user_id);
*/

-- Enable CASCADE deletion for embeddings if not set:
/*
ALTER TABLE doc_embeddings
DROP CONSTRAINT IF EXISTS doc_embeddings_doc_id_fkey;

ALTER TABLE doc_embeddings
ADD CONSTRAINT doc_embeddings_doc_id_fkey
FOREIGN KEY (doc_id)
REFERENCES knowledge_docs(id)
ON DELETE CASCADE;
*/

-- Enable CASCADE deletion for project links if not set:
/*
ALTER TABLE project_docs
DROP CONSTRAINT IF EXISTS project_docs_doc_id_fkey;

ALTER TABLE project_docs
ADD CONSTRAINT project_docs_doc_id_fkey
FOREIGN KEY (doc_id)
REFERENCES knowledge_docs(id)
ON DELETE CASCADE;
*/
