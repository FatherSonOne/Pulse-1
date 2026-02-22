-- Migration: Create Decision-to-Tasks Link Table
-- Date: 2026-02-21
-- Purpose: Link decisions to their extracted/generated tasks for traceability and workflow

-- ============================================================================
-- 1. DECISION_TASKS LINK TABLE
-- ============================================================================
-- Many-to-many relationship between decisions and tasks
-- Tracks which tasks were generated from which decisions

CREATE TABLE IF NOT EXISTS decision_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES extracted_tasks(id) ON DELETE CASCADE,

    -- Link metadata
    link_type TEXT NOT NULL DEFAULT 'derived', -- 'derived' (AI-generated), 'manual' (user-linked), 'prerequisite'
    confidence_score DECIMAL(3, 2), -- AI confidence in task extraction (0.00 to 1.00)

    -- Tracking
    created_by UUID REFERENCES pulse_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT decision_tasks_unique UNIQUE (decision_id, task_id),
    CONSTRAINT decision_tasks_link_type_check CHECK (
        link_type IN ('derived', 'manual', 'prerequisite')
    ),
    CONSTRAINT decision_tasks_confidence_range CHECK (
        confidence_score IS NULL OR (confidence_score >= 0.00 AND confidence_score <= 1.00)
    )
);

-- Set ownership
ALTER TABLE decision_tasks OWNER TO postgres;

-- Add helpful comments
COMMENT ON TABLE decision_tasks IS 'Links decisions to their derived/related tasks for traceability';
COMMENT ON COLUMN decision_tasks.link_type IS 'How the task is related: derived (AI-extracted), manual (user-linked), prerequisite (dependency)';
COMMENT ON COLUMN decision_tasks.confidence_score IS 'AI confidence score for derived tasks (0.00-1.00)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_decision_tasks_decision
    ON decision_tasks(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_tasks_task
    ON decision_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_decision_tasks_link_type
    ON decision_tasks(link_type);

-- ============================================================================
-- 2. DECISION METADATA COLUMNS
-- ============================================================================
-- Add columns to decisions table to track task generation and briefs

-- Add AI-generated decision brief (summary)
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS brief TEXT;

-- Add task generation tracking
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS tasks_generated_at TIMESTAMPTZ;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS tasks_count INTEGER DEFAULT 0;

-- Add consensus tracking
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS consensus_reached BOOLEAN DEFAULT false;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS consensus_reached_at TIMESTAMPTZ;

-- Add template reference
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS template_id UUID;

-- Create index for consensus queries
CREATE INDEX IF NOT EXISTS idx_decisions_consensus
    ON decisions(consensus_reached, consensus_reached_at) WHERE consensus_reached = true;

-- Create index for template queries
CREATE INDEX IF NOT EXISTS idx_decisions_template
    ON decisions(template_id) WHERE template_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN decisions.brief IS 'AI-generated 2-3 sentence summary of the decision';
COMMENT ON COLUMN decisions.tasks_generated_at IS 'When tasks were last generated from this decision';
COMMENT ON COLUMN decisions.tasks_count IS 'Cached count of linked tasks';
COMMENT ON COLUMN decisions.consensus_reached IS 'Whether voting consensus has been achieved';
COMMENT ON COLUMN decisions.template_id IS 'Reference to decision template (if used)';

-- ============================================================================
-- 3. DECISION TEMPLATES TABLE
-- ============================================================================
-- Pre-defined decision templates with suggested tasks and metadata

CREATE TABLE IF NOT EXISTS decision_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Template metadata
    name TEXT NOT NULL,
    description TEXT,
    category TEXT, -- 'hiring', 'product', 'strategy', 'budget', 'technical', etc.
    icon TEXT, -- Emoji or icon identifier

    -- Template structure
    title_template TEXT NOT NULL, -- e.g., "Should we hire a {role}?"
    description_template TEXT,
    suggested_tasks JSONB DEFAULT '[]'::JSONB, -- Array of task templates

    -- Decision type mapping
    default_decision_type TEXT, -- Maps to decisions.decision_type

    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,

    -- Template management
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false, -- System templates vs user-created
    created_by UUID REFERENCES pulse_users(id) ON DELETE SET NULL,
    workspace_id UUID, -- NULL for global templates, workspace-specific otherwise

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT decision_templates_name_unique UNIQUE (name, workspace_id)
);

-- Set ownership
ALTER TABLE decision_templates OWNER TO postgres;

-- Add helpful comments
COMMENT ON TABLE decision_templates IS 'Pre-defined templates for common decision types with suggested tasks';
COMMENT ON COLUMN decision_templates.suggested_tasks IS 'JSONB array of task objects: [{title, description, priority, deadline_offset_days}]';
COMMENT ON COLUMN decision_templates.is_system IS 'System templates are built-in and cannot be deleted';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_decision_templates_category
    ON decision_templates(category) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_decision_templates_workspace
    ON decision_templates(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decision_templates_usage
    ON decision_templates(usage_count DESC, last_used_at DESC) WHERE is_active = true;

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE decision_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_templates ENABLE ROW LEVEL SECURITY;

-- Policies for decision_tasks
-- Users can view links for decisions/tasks they have access to
CREATE POLICY "Users can view decision_tasks for accessible decisions"
    ON decision_tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM decisions
            WHERE decisions.id = decision_tasks.decision_id
            AND decisions.workspace_id IN (
                SELECT workspace_id FROM workspace_participants
                WHERE user_id = auth.uid()::text
            )
        )
    );

-- Users can create links for decisions they have access to
CREATE POLICY "Users can create decision_tasks for accessible decisions"
    ON decision_tasks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM decisions
            WHERE decisions.id = decision_id
            AND decisions.workspace_id IN (
                SELECT workspace_id FROM workspace_participants
                WHERE user_id = auth.uid()::text
            )
        )
    );

-- Users can delete links they created
CREATE POLICY "Users can delete own decision_tasks"
    ON decision_tasks FOR DELETE
    USING (auth.uid() = created_by);

-- Policies for decision_templates
-- Users can view active templates (global or their workspace)
CREATE POLICY "Users can view accessible templates"
    ON decision_templates FOR SELECT
    USING (
        is_active = true
        AND (
            workspace_id IS NULL -- Global templates
            OR workspace_id IN (
                SELECT workspace_id FROM workspace_participants
                WHERE user_id = auth.uid()::text
            )
        )
    );

-- Users can create templates in their workspace
CREATE POLICY "Users can create templates in own workspace"
    ON decision_templates FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_participants
            WHERE user_id = auth.uid()::text
        )
        AND is_system = false
    );

-- Users can update templates they created (non-system only)
CREATE POLICY "Users can update own templates"
    ON decision_templates FOR UPDATE
    USING (
        auth.uid() = created_by
        AND is_system = false
    );

-- Users can delete templates they created (non-system only)
CREATE POLICY "Users can delete own templates"
    ON decision_templates FOR DELETE
    USING (
        auth.uid() = created_by
        AND is_system = false
    );

-- ============================================================================
-- 5. FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function: Update tasks_count on decisions table
CREATE OR REPLACE FUNCTION update_decision_tasks_count()
RETURNS TRIGGER AS $$
DECLARE
    v_decision_id UUID;
    v_task_count INTEGER;
BEGIN
    -- Get decision_id from NEW or OLD
    v_decision_id := COALESCE(NEW.decision_id, OLD.decision_id);

    -- Count linked tasks
    SELECT COUNT(*) INTO v_task_count
    FROM decision_tasks
    WHERE decision_id = v_decision_id;

    -- Update the decision
    UPDATE decisions
    SET
        tasks_count = v_task_count,
        updated_at = NOW()
    WHERE id = v_decision_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update tasks_count on insert
CREATE TRIGGER trigger_update_tasks_count_on_insert
    AFTER INSERT ON decision_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_decision_tasks_count();

-- Trigger: Update tasks_count on delete
CREATE TRIGGER trigger_update_tasks_count_on_delete
    AFTER DELETE ON decision_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_decision_tasks_count();

-- Function: Update template usage stats
CREATE OR REPLACE FUNCTION update_template_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment usage count and update last_used_at for the template
    IF NEW.template_id IS NOT NULL THEN
        UPDATE decision_templates
        SET
            usage_count = usage_count + 1,
            last_used_at = NOW(),
            updated_at = NOW()
        WHERE id = NEW.template_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Track template usage when decision is created
CREATE TRIGGER trigger_update_template_usage
    AFTER INSERT ON decisions
    FOR EACH ROW
    WHEN (NEW.template_id IS NOT NULL)
    EXECUTE FUNCTION update_template_usage();

-- Function: Auto-update updated_at timestamp for templates
CREATE OR REPLACE FUNCTION update_decision_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update updated_at on decision_templates
CREATE TRIGGER trigger_update_template_updated_at
    BEFORE UPDATE ON decision_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_decision_template_updated_at();

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

-- Grant permissions for decision_tasks
GRANT SELECT, INSERT, DELETE ON TABLE decision_tasks TO authenticated;
GRANT ALL ON TABLE decision_tasks TO service_role;

-- Grant permissions for decision_templates
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE decision_templates TO authenticated;
GRANT ALL ON TABLE decision_templates TO service_role;

-- ============================================================================
-- 7. SEED SYSTEM TEMPLATES
-- ============================================================================

-- Insert common decision templates
INSERT INTO decision_templates (
    name,
    description,
    category,
    icon,
    title_template,
    description_template,
    suggested_tasks,
    default_decision_type,
    is_system,
    is_active
) VALUES
(
    'Hire New Team Member',
    'Template for hiring decisions with standard recruitment tasks',
    'hiring',
    '👥',
    'Should we hire a {role}?',
    'Evaluate the need for hiring a new {role} for the {team} team.',
    '[
        {"title": "Define job requirements and responsibilities", "priority": "high", "deadline_offset_days": 3},
        {"title": "Create job posting and advertise", "priority": "high", "deadline_offset_days": 7},
        {"title": "Screen applications and schedule interviews", "priority": "medium", "deadline_offset_days": 14},
        {"title": "Conduct interviews and evaluate candidates", "priority": "high", "deadline_offset_days": 21},
        {"title": "Make offer and complete onboarding prep", "priority": "urgent", "deadline_offset_days": 28}
    ]'::JSONB,
    'consensus',
    true,
    true
),
(
    'Build New Feature',
    'Template for product feature decisions with development workflow',
    'product',
    '🚀',
    'Should we build {feature_name}?',
    'Decide whether to invest resources in building {feature_name}.',
    '[
        {"title": "Create technical specification document", "priority": "high", "deadline_offset_days": 3},
        {"title": "Estimate development effort and timeline", "priority": "high", "deadline_offset_days": 5},
        {"title": "Design user interface mockups", "priority": "medium", "deadline_offset_days": 7},
        {"title": "Review with stakeholders and get approval", "priority": "high", "deadline_offset_days": 10},
        {"title": "Create implementation plan and assign tasks", "priority": "urgent", "deadline_offset_days": 14}
    ]'::JSONB,
    'majority_vote',
    true,
    true
),
(
    'Budget Allocation',
    'Template for budget and resource allocation decisions',
    'budget',
    '💰',
    'How should we allocate the {budget_period} budget?',
    'Decide on budget allocation across departments/projects for {budget_period}.',
    '[
        {"title": "Collect budget requests from all departments", "priority": "high", "deadline_offset_days": 7},
        {"title": "Analyze historical spending and ROI", "priority": "medium", "deadline_offset_days": 10},
        {"title": "Draft proposed budget allocation", "priority": "high", "deadline_offset_days": 14},
        {"title": "Review and refine with leadership team", "priority": "urgent", "deadline_offset_days": 17},
        {"title": "Finalize and communicate budget decisions", "priority": "urgent", "deadline_offset_days": 21}
    ]'::JSONB,
    'consensus',
    true,
    true
),
(
    'Technical Architecture Decision',
    'Template for major technical decisions with analysis tasks',
    'technical',
    '⚙️',
    'Should we adopt {technology/approach}?',
    'Evaluate whether to adopt {technology/approach} for {use_case}.',
    '[
        {"title": "Research and document technical requirements", "priority": "high", "deadline_offset_days": 3},
        {"title": "Evaluate alternatives and create comparison matrix", "priority": "high", "deadline_offset_days": 7},
        {"title": "Build proof-of-concept or prototype", "priority": "medium", "deadline_offset_days": 14},
        {"title": "Assess security, scalability, and maintenance implications", "priority": "high", "deadline_offset_days": 17},
        {"title": "Document decision and create migration plan", "priority": "urgent", "deadline_offset_days": 21}
    ]'::JSONB,
    'consensus',
    true,
    true
),
(
    'Strategic Initiative',
    'Template for high-level strategic decisions',
    'strategy',
    '🎯',
    'Should we pursue {initiative}?',
    'Decide whether to pursue the strategic initiative: {initiative}.',
    '[
        {"title": "Define objectives and success metrics", "priority": "urgent", "deadline_offset_days": 3},
        {"title": "Conduct market research and competitive analysis", "priority": "high", "deadline_offset_days": 10},
        {"title": "Assess resource requirements and risks", "priority": "high", "deadline_offset_days": 14},
        {"title": "Create detailed execution roadmap", "priority": "high", "deadline_offset_days": 21},
        {"title": "Present to stakeholders and get alignment", "priority": "urgent", "deadline_offset_days": 28}
    ]'::JSONB,
    'consensus',
    true,
    true
)
ON CONFLICT (name, workspace_id) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migration: create_decision_tasks_link.sql';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Successfully created Decision-to-Task linking system:';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables:';
    RAISE NOTICE '  ✓ decision_tasks - Link decisions to tasks';
    RAISE NOTICE '  ✓ decision_templates - Pre-defined decision templates';
    RAISE NOTICE '';
    RAISE NOTICE 'Decision Enhancements:';
    RAISE NOTICE '  ✓ brief - AI-generated decision summary';
    RAISE NOTICE '  ✓ tasks_count - Cached count of linked tasks';
    RAISE NOTICE '  ✓ consensus_reached - Voting consensus tracking';
    RAISE NOTICE '  ✓ template_id - Template reference';
    RAISE NOTICE '';
    RAISE NOTICE 'System Templates Created:';
    RAISE NOTICE '  ✓ Hire New Team Member (5 tasks)';
    RAISE NOTICE '  ✓ Build New Feature (5 tasks)';
    RAISE NOTICE '  ✓ Budget Allocation (5 tasks)';
    RAISE NOTICE '  ✓ Technical Architecture Decision (5 tasks)';
    RAISE NOTICE '  ✓ Strategic Initiative (5 tasks)';
    RAISE NOTICE '';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '  ✓ RLS policies for security';
    RAISE NOTICE '  ✓ Automatic tasks_count updates';
    RAISE NOTICE '  ✓ Template usage tracking';
    RAISE NOTICE '';
    RAISE NOTICE 'Ready for Phase 2 Decision-Task Pipeline!';
    RAISE NOTICE '============================================';
END $$;
