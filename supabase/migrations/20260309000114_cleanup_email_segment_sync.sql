-- ============================================================
-- MIGRATION: 20260309000114_cleanup_email_segment_sync.sql
-- PURPOSE:   Prevent email_campaigns.segment_name from drifting out of
--            sync with the email_segments FK.
--            A BEFORE trigger auto-populates segment_name from
--            email_segments.name when segment_id is set.
--            If segment_id is NULL, segment_name is left as-is
--            (backwards compatible with pre-FK campaigns).
-- ISSUE:     H-9 from 2026-03-09 database audit
-- SAFE:      CREATE OR REPLACE + DROP TRIGGER IF EXISTS
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_campaign_segment_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If segment_id is being set, pull the name from email_segments
    IF NEW.segment_id IS NOT NULL THEN
        SELECT name INTO NEW.segment_name
        FROM public.email_segments
        WHERE id = NEW.segment_id;

        -- If the segment was deleted (FK set but row gone), fall back gracefully
        IF NOT FOUND THEN
            NEW.segment_name := COALESCE(NEW.segment_name, 'Unknown Segment');
            NEW.segment_id   := NULL;  -- clear dangling FK
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_campaign_segment_name_sync ON public.email_campaigns;

CREATE TRIGGER trg_campaign_segment_name_sync
    BEFORE INSERT OR UPDATE OF segment_id
    ON public.email_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_campaign_segment_name();

-- Backfill existing rows that have segment_id set but segment_name may be stale
UPDATE public.email_campaigns ec
SET segment_name = es.name
FROM public.email_segments es
WHERE ec.segment_id = es.id
  AND ec.segment_name IS DISTINCT FROM es.name;

COMMIT;
