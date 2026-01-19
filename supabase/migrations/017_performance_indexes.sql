-- ============================================
-- Performance Optimization Indexes
-- Migration: 017_performance_indexes.sql
-- ============================================

-- Drop existing indexes if they exist (safe to run multiple times)
DROP INDEX IF EXISTS idx_knowledge_docs_user;
DROP INDEX IF EXISTS idx_knowledge_docs_created;
DROP INDEX IF EXISTS idx_knowledge_docs_file_type;
DROP INDEX IF EXISTS idx_knowledge_docs_text_search;
DROP INDEX IF EXISTS idx_knowledge_docs_processing;

DROP INDEX IF EXISTS idx_ai_messages_session;
DROP INDEX IF EXISTS idx_ai_messages_created;

DROP INDEX IF EXISTS idx_ai_sessions_user;
DROP INDEX IF EXISTS idx_ai_sessions_project;
DROP INDEX IF EXISTS idx_ai_sessions_updated;

DROP INDEX IF EXISTS idx_ai_projects_user;
DROP INDEX IF EXISTS idx_ai_projects_updated;

DROP INDEX IF EXISTS idx_doc_embeddings_doc;
DROP INDEX IF EXISTS idx_doc_embeddings_chunk;

DROP INDEX IF EXISTS idx_doc_highlights_doc_user;
DROP INDEX IF EXISTS idx_doc_annotations_doc_user;

DROP INDEX IF EXISTS idx_doc_tags_doc;
DROP INDEX IF EXISTS idx_doc_tags_tag;

DROP INDEX IF EXISTS idx_collection_docs_collection;
DROP INDEX IF EXISTS idx_collection_docs_doc;

DROP INDEX IF EXISTS idx_doc_favorites_user;
DROP INDEX IF EXISTS idx_doc_recent_views_user;
DROP INDEX IF EXISTS idx_doc_recent_views_viewed;

DROP INDEX IF EXISTS idx_activity_feed_user;
DROP INDEX IF EXISTS idx_activity_feed_project;
DROP INDEX IF EXISTS idx_activity_feed_created;

DROP INDEX IF EXISTS idx_project_docs_project;
DROP INDEX IF EXISTS idx_project_docs_doc;

DROP INDEX IF EXISTS idx_unified_messages_channel_perf;
DROP INDEX IF EXISTS idx_unified_messages_user_perf;

-- ============================================
-- Knowledge Docs Indexes
-- ============================================

-- Index for user's documents
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_user
ON knowledge_docs(user_id);

-- Index for recent documents sorting
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_created
ON knowledge_docs(created_at DESC);

-- Index for file type filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_file_type
ON knowledge_docs(file_type);

-- Index for processing status
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_processing
ON knowledge_docs(processing_status)
WHERE processing_status IS NOT NULL;

-- Full-text search index on text content
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_text_search
ON knowledge_docs USING GIN(to_tsvector('english', COALESCE(text_content, '') || ' ' || COALESCE(ai_summary, '')));

-- ============================================
-- AI Messages Indexes
-- ============================================

-- Index for fetching messages by session
CREATE INDEX IF NOT EXISTS idx_ai_messages_session
ON ai_messages(session_id);

-- Index for message ordering
CREATE INDEX IF NOT EXISTS idx_ai_messages_created
ON ai_messages(session_id, created_at DESC);

-- ============================================
-- AI Sessions Indexes
-- ============================================

-- Index for user's sessions
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user
ON ai_sessions(user_id);

-- Index for project's sessions (project_id added by migration 007)
CREATE INDEX IF NOT EXISTS idx_ai_sessions_project
ON ai_sessions(project_id)
WHERE project_id IS NOT NULL;

-- Index for recent sessions
CREATE INDEX IF NOT EXISTS idx_ai_sessions_updated
ON ai_sessions(updated_at DESC);

-- ============================================
-- AI Projects Indexes
-- ============================================

-- Index for user's projects
CREATE INDEX IF NOT EXISTS idx_ai_projects_user
ON ai_projects(user_id);

-- Index for recent projects
CREATE INDEX IF NOT EXISTS idx_ai_projects_updated
ON ai_projects(updated_at DESC);

-- ============================================
-- Document Embeddings Indexes
-- ============================================

-- Index for document's embeddings
CREATE INDEX IF NOT EXISTS idx_doc_embeddings_doc
ON doc_embeddings(doc_id);

-- Index for chunk ordering
CREATE INDEX IF NOT EXISTS idx_doc_embeddings_chunk
ON doc_embeddings(doc_id, chunk_index);

-- ============================================
-- Highlights and Annotations Indexes
-- ============================================

-- Composite index for document highlights by user
CREATE INDEX IF NOT EXISTS idx_doc_highlights_doc_user
ON doc_highlights(doc_id, user_id);

-- Composite index for document annotations by user
CREATE INDEX IF NOT EXISTS idx_doc_annotations_doc_user
ON doc_annotations(doc_id, user_id);

-- Index for unresolved annotations
CREATE INDEX IF NOT EXISTS idx_doc_annotations_unresolved
ON doc_annotations(doc_id)
WHERE resolved = FALSE;

-- ============================================
-- Tags and Collections Indexes
-- ============================================

-- Index for document's tags
CREATE INDEX IF NOT EXISTS idx_doc_tags_doc
ON doc_tags(doc_id);

-- Index for tag's documents
CREATE INDEX IF NOT EXISTS idx_doc_tags_tag
ON doc_tags(tag_id);

-- Index for collection's documents
CREATE INDEX IF NOT EXISTS idx_collection_docs_collection
ON collection_docs(collection_id);

-- Index for document's collections
CREATE INDEX IF NOT EXISTS idx_collection_docs_doc
ON collection_docs(doc_id);

-- ============================================
-- Favorites and Recent Views Indexes
-- ============================================

-- Index for user's favorites
CREATE INDEX IF NOT EXISTS idx_doc_favorites_user
ON doc_favorites(user_id);

-- Index for user's recent views
CREATE INDEX IF NOT EXISTS idx_doc_recent_views_user
ON doc_recent_views(user_id);

-- Index for recent views ordering
CREATE INDEX IF NOT EXISTS idx_doc_recent_views_viewed
ON doc_recent_views(user_id, viewed_at DESC);

-- ============================================
-- Activity Feed Indexes
-- ============================================

-- Index for user's activity
CREATE INDEX IF NOT EXISTS idx_activity_feed_user
ON activity_feed(user_id);

-- Index for project's activity
CREATE INDEX IF NOT EXISTS idx_activity_feed_project
ON activity_feed(project_id)
WHERE project_id IS NOT NULL;

-- Index for recent activity
CREATE INDEX IF NOT EXISTS idx_activity_feed_created
ON activity_feed(created_at DESC);

-- ============================================
-- Sharing Indexes
-- ============================================

-- Index for documents shared with user
CREATE INDEX IF NOT EXISTS idx_document_shares_shared_with
ON document_shares(shared_with_user);

-- Index for public links
CREATE INDEX IF NOT EXISTS idx_document_shares_public_link
ON document_shares(public_link)
WHERE public_link IS NOT NULL;

-- ============================================
-- Project Docs Junction Index
-- ============================================

-- Index for project's documents
CREATE INDEX IF NOT EXISTS idx_project_docs_project
ON project_docs(project_id);

-- Index for document's projects
CREATE INDEX IF NOT EXISTS idx_project_docs_doc
ON project_docs(doc_id);

-- ============================================
-- Unified Messages Index (from 001_unified_inbox_schema)
-- Note: These indexes already exist in 001_unified_inbox_schema.sql
-- but are included here for completeness with IF NOT EXISTS
-- ============================================

-- Index for messages by channel (column is 'timestamp' not 'sent_at')
CREATE INDEX IF NOT EXISTS idx_unified_messages_channel_perf
ON unified_messages(channel_id, timestamp DESC);

-- Index for user's messages
CREATE INDEX IF NOT EXISTS idx_unified_messages_user_perf
ON unified_messages(user_id, timestamp DESC);

-- ============================================
-- ANALYZE tables to update statistics
-- Only analyze tables that exist
-- ============================================

ANALYZE knowledge_docs;
ANALYZE ai_messages;
ANALYZE ai_sessions;
ANALYZE ai_projects;
ANALYZE doc_embeddings;
ANALYZE doc_highlights;
ANALYZE doc_annotations;
ANALYZE doc_tags;
ANALYZE collection_docs;
ANALYZE doc_favorites;
ANALYZE doc_recent_views;
ANALYZE activity_feed;
ANALYZE document_shares;
ANALYZE project_docs;
ANALYZE unified_messages;
