-- Migration: Fix AI updated_at triggers
-- Created: 2026-01-14
-- Description: Ensure updated_at triggers exist without failing if already created

DO $$
BEGIN
  -- ai_sessions trigger
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_ai_sessions_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_ai_sessions_updated_at
             BEFORE UPDATE ON ai_sessions
             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;

  -- knowledge_docs trigger
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_knowledge_docs_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_knowledge_docs_updated_at
             BEFORE UPDATE ON knowledge_docs
             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END $$;

