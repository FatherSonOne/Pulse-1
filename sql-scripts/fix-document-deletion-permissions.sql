-- Fix Document Deletion Permissions
-- Run this in Supabase SQL Editor to enable document deletion

-- 1. Ensure RLS policies allow deletion
DROP POLICY IF EXISTS "Users can delete their own documents" ON knowledge_docs;

CREATE POLICY "Users can delete their own documents"
ON knowledge_docs
FOR DELETE
USING (auth.uid() = user_id);

-- 2. Enable CASCADE deletion for doc_embeddings
ALTER TABLE IF EXISTS doc_embeddings
DROP CONSTRAINT IF EXISTS doc_embeddings_doc_id_fkey CASCADE;

ALTER TABLE IF EXISTS doc_embeddings
ADD CONSTRAINT doc_embeddings_doc_id_fkey
FOREIGN KEY (doc_id)
REFERENCES knowledge_docs(id)
ON DELETE CASCADE;

-- 3. Enable CASCADE deletion for project_docs
ALTER TABLE IF EXISTS project_docs
DROP CONSTRAINT IF EXISTS project_docs_doc_id_fkey CASCADE;

ALTER TABLE IF EXISTS project_docs
ADD CONSTRAINT project_docs_doc_id_fkey
FOREIGN KEY (doc_id)
REFERENCES knowledge_docs(id)
ON DELETE CASCADE;

-- 4. Verify policies are active
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'knowledge_docs'
ORDER BY cmd;

-- Success message
SELECT 'Document deletion permissions fixed! You can now delete documents.' AS status;
