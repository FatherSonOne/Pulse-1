-- Migration: Missing Features Integration
-- Date: 2026-01-19
-- Purpose: Add missing tables and enhancements for Browser Extension, Email Templates, and CRM Integration features
-- Features: Browser Extension, Email Template System, CRM Wizard

-- ============================================================================
-- 1. BROWSER EXTENSION SUPPORT
-- ============================================================================
-- Tables already exist: knowledge_docs, project_docs
-- Add missing columns if needed

-- Add source_type column to knowledge_docs if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_docs'
        AND column_name = 'source_type'
    ) THEN
        ALTER TABLE knowledge_docs
        ADD COLUMN source_type TEXT DEFAULT 'manual';

        COMMENT ON COLUMN knowledge_docs.source_type IS 'Source of the document: web_capture, manual, upload, etc.';
    END IF;
END $$;

-- Add content column to knowledge_docs if it doesn't exist (separate from text_content)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_docs'
        AND column_name = 'content'
    ) THEN
        ALTER TABLE knowledge_docs
        ADD COLUMN content TEXT;

        COMMENT ON COLUMN knowledge_docs.content IS 'Raw content from browser extension captures';
    END IF;
END $$;

-- Add added_by column to project_docs if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'project_docs'
        AND column_name = 'added_by'
    ) THEN
        ALTER TABLE project_docs
        ADD COLUMN added_by UUID REFERENCES users(id);

        COMMENT ON COLUMN project_docs.added_by IS 'User who added the document to the project';
    END IF;
END $$;

-- Add created_at column to project_docs if it doesn't exist (already has added_at, but create_at for consistency)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'project_docs'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE project_docs
        ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- ============================================================================
-- 2. EMAIL TEMPLATE SYSTEM ENHANCEMENTS
-- ============================================================================
-- Table email_templates already exists
-- Add template_categories table

CREATE TABLE IF NOT EXISTS template_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6b7280', -- Hex color for UI
    icon TEXT, -- Icon name/emoji
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT template_categories_color_hex CHECK (color ~* '^#[0-9a-f]{6}$')
);

-- Add owner to postgres
ALTER TABLE template_categories OWNER TO postgres;

-- Add comment
COMMENT ON TABLE template_categories IS 'User-defined categories for organizing email templates';

-- Add missing columns to email_templates if needed
DO $$
BEGIN
    -- Add is_shared column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'email_templates'
        AND column_name = 'is_shared'
    ) THEN
        ALTER TABLE email_templates
        ADD COLUMN is_shared BOOLEAN DEFAULT false;

        COMMENT ON COLUMN email_templates.is_shared IS 'Whether template is shared with team';
    END IF;

    -- Add usage_count column if it doesn't exist (table has use_count)
    -- We'll use the existing use_count column instead
END $$;

-- Create indexes for template_categories
CREATE INDEX IF NOT EXISTS idx_template_categories_user ON template_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_template_categories_sort ON template_categories(sort_order);

-- ============================================================================
-- 3. CRM INTEGRATION ENHANCEMENTS
-- ============================================================================
-- Tables crm_integrations and crm_sync_logs already exist
-- Add missing columns for wizard functionality

-- Add settings column to crm_integrations if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_integrations'
        AND column_name = 'settings'
    ) THEN
        ALTER TABLE crm_integrations
        ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;

        COMMENT ON COLUMN crm_integrations.settings IS 'Platform-specific configuration settings';
    END IF;
END $$;

-- Add user_id column to crm_integrations if it doesn't exist (currently has workspace_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_integrations'
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE crm_integrations
        ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

        -- Copy workspace_id to user_id for existing records
        UPDATE crm_integrations SET user_id = workspace_id WHERE user_id IS NULL;

        COMMENT ON COLUMN crm_integrations.user_id IS 'User who owns this CRM integration';
    END IF;
END $$;

-- Add last_error column to crm_integrations if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_integrations'
        AND column_name = 'last_error'
    ) THEN
        ALTER TABLE crm_integrations
        ADD COLUMN last_error TEXT;

        COMMENT ON COLUMN crm_integrations.last_error IS 'Last error message from sync operations';
    END IF;
END $$;

-- Enhance crm_sync_logs structure
DO $$
BEGIN
    -- Add integration_id column (currently has crm_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync_logs'
        AND column_name = 'integration_id'
    ) THEN
        ALTER TABLE crm_sync_logs
        ADD COLUMN integration_id UUID REFERENCES crm_integrations(id) ON DELETE CASCADE;

        -- Copy crm_id to integration_id for existing records
        UPDATE crm_sync_logs SET integration_id = crm_id WHERE integration_id IS NULL;
    END IF;

    -- Add records_synced column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync_logs'
        AND column_name = 'records_synced'
    ) THEN
        ALTER TABLE crm_sync_logs
        ADD COLUMN records_synced INTEGER DEFAULT 0;

        -- Calculate from existing columns
        UPDATE crm_sync_logs
        SET records_synced = COALESCE(contacts_synced, 0) + COALESCE(companies_synced, 0) + COALESCE(deals_synced, 0)
        WHERE records_synced = 0;
    END IF;

    -- Add errors column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync_logs'
        AND column_name = 'errors'
    ) THEN
        ALTER TABLE crm_sync_logs
        ADD COLUMN errors JSONB DEFAULT '[]'::jsonb;

        -- Migrate error_message to errors array
        UPDATE crm_sync_logs
        SET errors = jsonb_build_array(jsonb_build_object('message', error_message))
        WHERE error_message IS NOT NULL AND errors = '[]'::jsonb;
    END IF;

    -- Add duration_ms column if it doesn't exist (table has duration_seconds)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync_logs'
        AND column_name = 'duration_ms'
    ) THEN
        ALTER TABLE crm_sync_logs
        ADD COLUMN duration_ms INTEGER;

        -- Convert duration_seconds to duration_ms
        UPDATE crm_sync_logs
        SET duration_ms = duration_seconds * 1000
        WHERE duration_seconds IS NOT NULL AND duration_ms IS NULL;
    END IF;
END $$;

-- Create additional indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_integration ON crm_sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_started ON crm_sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_integrations_user ON crm_integrations(user_id);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on template_categories
ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;

-- Policies for template_categories
CREATE POLICY "Users can view own categories"
    ON template_categories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
    ON template_categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
    ON template_categories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
    ON template_categories FOR DELETE
    USING (auth.uid() = user_id);

-- Additional RLS policies for crm_integrations if needed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'crm_integrations'
        AND policyname = 'Users can view own integrations'
    ) THEN
        CREATE POLICY "Users can view own integrations"
            ON crm_integrations FOR SELECT
            USING (auth.uid() = user_id OR auth.uid() = workspace_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'crm_integrations'
        AND policyname = 'Users can insert own integrations'
    ) THEN
        CREATE POLICY "Users can insert own integrations"
            ON crm_integrations FOR INSERT
            WITH CHECK (auth.uid() = user_id OR auth.uid() = workspace_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'crm_integrations'
        AND policyname = 'Users can update own integrations'
    ) THEN
        CREATE POLICY "Users can update own integrations"
            ON crm_integrations FOR UPDATE
            USING (auth.uid() = user_id OR auth.uid() = workspace_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'crm_integrations'
        AND policyname = 'Users can delete own integrations'
    ) THEN
        CREATE POLICY "Users can delete own integrations"
            ON crm_integrations FOR DELETE
            USING (auth.uid() = user_id OR auth.uid() = workspace_id);
    END IF;
END $$;

-- RLS policies for crm_sync_logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'crm_sync_logs'
        AND policyname = 'Users can view own sync logs'
    ) THEN
        CREATE POLICY "Users can view own sync logs"
            ON crm_sync_logs FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM crm_integrations
                    WHERE crm_integrations.id = crm_sync_logs.integration_id
                    AND (crm_integrations.user_id = auth.uid() OR crm_integrations.workspace_id = auth.uid())
                )
            );
    END IF;
END $$;

-- ============================================================================
-- 5. GRANTS
-- ============================================================================

-- Grant permissions on template_categories
GRANT ALL ON TABLE template_categories TO anon;
GRANT ALL ON TABLE template_categories TO authenticated;
GRANT ALL ON TABLE template_categories TO service_role;

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Add updated_at trigger for template_categories
CREATE OR REPLACE TRIGGER update_template_categories_updated_at
    BEFORE UPDATE ON template_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 036_missing_features_integration.sql completed successfully';
    RAISE NOTICE 'Added support for:';
    RAISE NOTICE '  - Browser Extension (knowledge_docs enhancements)';
    RAISE NOTICE '  - Email Template System (template_categories table)';
    RAISE NOTICE '  - CRM Integration Wizard (crm_integrations enhancements)';
END $$;
