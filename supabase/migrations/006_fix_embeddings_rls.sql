-- Fix RLS policy for doc_embeddings to allow inserts from authenticated users
drop policy if exists "Users can insert embeddings for own docs" on doc_embeddings;

create policy "Users can insert embeddings for own docs" on doc_embeddings
  for insert with check (
    exists (
      select 1 from knowledge_docs 
      where knowledge_docs.id = doc_embeddings.doc_id 
      and knowledge_docs.user_id = auth.uid()
    )
  );

-- Also ensure service role can bypass RLS if needed (for background jobs)
alter table doc_embeddings force row level security;
