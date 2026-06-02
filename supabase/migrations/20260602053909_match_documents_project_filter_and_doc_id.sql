-- WI-2 (War Room repair plan 2026-06-02): project-scoped RAG.
--
-- Two changes to match_documents, both required to fix §3.3 of the triage:
--   1. New optional `filter_doc_ids uuid[]` param. When non-null, the project
--      scope is applied in the WHERE clause — BEFORE the similarity ORDER BY /
--      LIMIT — so a project's documents are not crowded out of the global
--      top-N (the prior client-side post-filter on d.doc_id always returned []
--      because the RPC never returned doc_id at all).
--   2. The return now includes `doc_id` and `chunk_index`, which the client
--      filter relied on and which warRoomToolsService reads for voice-tool
--      citation source IDs.
--
-- DROP + CREATE (not CREATE OR REPLACE): changing the RETURNS TABLE column set
-- is a return-type change, which CREATE OR REPLACE rejects. Dry-run was done in
-- a rolled-back transaction first per CLAUDE.md §4; this is the single apply.

DROP FUNCTION IF EXISTS public.match_documents(vector, double precision, integer, uuid);

CREATE FUNCTION public.match_documents(
  query_embedding vector,
  match_threshold double precision,
  match_count integer,
  filter_user_id uuid DEFAULT NULL::uuid,
  filter_doc_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(id uuid, content text, similarity double precision, doc_title text, doc_url text, doc_id uuid, chunk_index integer)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.content,
    1 - (de.embedding <=> query_embedding) AS similarity,
    kd.title AS doc_title,
    kd.url AS doc_url,
    de.doc_id,
    de.chunk_index
  FROM doc_embeddings de
  JOIN knowledge_docs kd ON de.doc_id = kd.id
  WHERE 1 - (de.embedding <=> query_embedding) > match_threshold
  AND (
    kd.is_shared = true
    OR (filter_user_id IS NOT NULL AND kd.user_id = filter_user_id)
  )
  AND (filter_doc_ids IS NULL OR de.doc_id = ANY(filter_doc_ids))
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;
