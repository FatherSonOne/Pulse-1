-- ============================================================
-- MIGRATION: 20260309000113_cleanup_user_retention_cohorts_uuid.sql
-- PURPOSE:   Convert user_retention_cohorts.user_id from TEXT to UUID.
--            All other user_id columns in the schema use UUID; this
--            table is the only outlier, preventing FK creation.
--            Steps:
--              1. Add temp UUID column
--              2. Populate via safe cast (regex-guard)
--              3. Delete rows with non-UUID text (malformed, no auth.users match)
--              4. Swap columns: drop TEXT, rename UUID → user_id
--              5. Add FK + NOT NULL + unique constraint
--              6. Tighten RLS from USING (true) to USING (user_id = auth.uid())
-- ISSUE:     M-5 from 2026-03-09 database audit
-- ============================================================

BEGIN;

-- Step 1: temp UUID column
ALTER TABLE public.user_retention_cohorts
    ADD COLUMN IF NOT EXISTS user_uuid UUID;

-- Step 2: cast valid UUID strings
UPDATE public.user_retention_cohorts
SET user_uuid = user_id::UUID
WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Step 3: remove rows that couldn't be cast (orphaned / malformed)
DELETE FROM public.user_retention_cohorts
WHERE user_uuid IS NULL;

-- Step 4: drop old TEXT column, rename UUID column
-- First drop any constraints referencing user_id TEXT
ALTER TABLE public.user_retention_cohorts
    DROP CONSTRAINT IF EXISTS user_retention_cohorts_pkey;

ALTER TABLE public.user_retention_cohorts
    DROP CONSTRAINT IF EXISTS user_retention_cohorts_user_id_cohort_date_key;

-- Drop any RLS policies that reference user_id before dropping the column
DROP POLICY IF EXISTS "user_retention_cohorts_owner_all"
    ON public.user_retention_cohorts;

ALTER TABLE public.user_retention_cohorts
    DROP COLUMN user_id;

ALTER TABLE public.user_retention_cohorts
    RENAME COLUMN user_uuid TO user_id;

-- Step 5: restore constraints + add FK
ALTER TABLE public.user_retention_cohorts
    ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.user_retention_cohorts
    ADD PRIMARY KEY (user_id, cohort_date);

ALTER TABLE public.user_retention_cohorts
    ADD CONSTRAINT fk_user_retention_cohorts_user
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 6: tighten RLS (was USING (true))
DROP POLICY IF EXISTS "Allow authenticated users to read retention cohorts"
    ON public.user_retention_cohorts;

DROP POLICY IF EXISTS "Allow users to read own cohort data"
    ON public.user_retention_cohorts;

CREATE POLICY "Allow users to read own cohort data"
    ON public.user_retention_cohorts
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role functions (increment_message_click_count, increment_message_seen_count)
-- are SECURITY DEFINER and bypass RLS — no changes needed for them.

COMMIT;
