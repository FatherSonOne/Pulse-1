-- =============================================================
-- FIX: Pulse Handle Validation Bug (COMPLETE FIX)
-- =============================================================
-- The original LIKE '_%' pattern matches ANY string because _ is a wildcard in SQL LIKE
-- This affects BOTH:
--   1. The is_handle_available() function
--   2. The CHECK CONSTRAINT on user_profiles table
--
-- RUN THIS ENTIRE SCRIPT IN YOUR SUPABASE SQL EDITOR
-- =============================================================

-- PART 1: Fix the CHECK CONSTRAINT on user_profiles table
-- This is what causes "violates check constraint valid_handle" error
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS valid_handle;

ALTER TABLE public.user_profiles ADD CONSTRAINT valid_handle CHECK (
    handle IS NULL OR
    (
        handle ~ '^[a-z0-9_]{3,30}$' AND
        handle NOT LIKE '%\_\_%' ESCAPE '\' AND
        LEFT(handle, 1) != '_' AND
        RIGHT(handle, 1) != '_'
    )
);

-- PART 2: Fix the is_handle_available() function
-- This is what causes "handle already taken" for all handles
CREATE OR REPLACE FUNCTION is_handle_available(check_handle TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check format (3-30 chars, lowercase alphanumeric and underscores)
    IF NOT (check_handle ~ '^[a-z0-9_]{3,30}$') THEN
        RETURN false;
    END IF;

    -- Check double underscores (escape _ with backslash in LIKE pattern)
    IF check_handle LIKE '%\_\_%' ESCAPE '\' THEN
        RETURN false;
    END IF;

    -- Check leading/trailing underscore (use LEFT/RIGHT instead of buggy LIKE pattern)
    IF LEFT(check_handle, 1) = '_' OR RIGHT(check_handle, 1) = '_' THEN
        RETURN false;
    END IF;

    -- Check reserved
    IF EXISTS (SELECT 1 FROM public.reserved_handles WHERE handle = check_handle) THEN
        RETURN false;
    END IF;

    -- Check taken
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE handle = check_handle) THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- TEST: Uncomment and run these to verify the fix works
-- =============================================================
-- SELECT is_handle_available('frank');        -- Should return TRUE
-- SELECT is_handle_available('frankly');      -- Should return TRUE
-- SELECT is_handle_available('quantum_ecos'); -- Should return TRUE
-- SELECT is_handle_available('_invalid');     -- Should return FALSE (starts with _)
-- SELECT is_handle_available('invalid_');     -- Should return FALSE (ends with _)
-- SELECT is_handle_available('bad__double');  -- Should return FALSE (double underscore)
