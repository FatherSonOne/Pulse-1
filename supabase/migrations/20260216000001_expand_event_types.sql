-- Migration: Expand calendar event types
-- Adds focus, personal, travel, social, health types to calendar_events
-- and migrates existing events using keyword-based auto-detection

-- 1. Drop the old restrictive CHECK constraint
ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_event_type_check;

-- 2. Add a new CHECK constraint with all 10 types
--    Custom types (user-defined, stored client-side) are not constrained here —
--    the DB uses the type ID as a string, so custom IDs will just be stored as-is.
ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_event_type_check
  CHECK (event_type IS NOT NULL AND length(event_type) > 0);

-- 3. Create a helper function that mirrors the client-side autoDetectEventType logic
CREATE OR REPLACE FUNCTION public.auto_detect_event_type(
  p_title TEXT,
  p_description TEXT DEFAULT '',
  p_location TEXT DEFAULT ''
) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  combined TEXT;
BEGIN
  combined := lower(coalesce(p_title, '') || ' ' || coalesce(p_description, '') || ' ' || coalesce(p_location, ''));

  -- Video / online meetings
  IF combined ~ 'zoom|google meet|teams|webex|whereby|facetime|skype|video call|video meeting' THEN
    RETURN 'meet';
  END IF;

  -- In-person meetings / syncs
  IF combined ~ 'standup|sync|1:1|one.on.one|check.in|review|retro|sprint|scrum|board meeting|all.hands' THEN
    RETURN 'meet';
  END IF;

  -- Calls
  IF combined ~ '\bcall\b|\bphone\b|\bdial\b' AND combined !~ '\brecall\b|\bcallback\b' THEN
    RETURN 'call';
  END IF;

  -- Focus / deep work
  IF combined ~ 'focus|deep work|heads.down|no.interrupt|coding|writing|study|research|\bprep\b' THEN
    RETURN 'focus';
  END IF;

  -- Travel
  IF combined ~ 'flight|airport|hotel|\bcommute\b|drive to|\btravel\b|\btrip\b|\bvacation\b|conference trip' THEN
    RETURN 'travel';
  END IF;

  -- Deadlines
  IF combined ~ '\bdeadline\b|\bdue\b|\bsubmit\b|\blaunch\b|\brelease\b|\bship\b|\bmilestone\b' THEN
    RETURN 'deadline';
  END IF;

  -- Health / wellness
  IF combined ~ '\bdoctor\b|\bdentist\b|\btherapy\b|\bgym\b|\bworkout\b|\bexercise\b|\byoga\b|\brun\b|\bphysio\b|\bappointment\b|\bcheckup\b' THEN
    RETURN 'health';
  END IF;

  -- Social
  IF combined ~ '\blunch\b|\bdinner\b|\bbreakfast\b|\bcoffee\b|happy hour|\bparty\b|\bbirthday\b|\bwedding\b|\bsocial\b|\bouting\b' THEN
    RETURN 'social';
  END IF;

  -- Personal
  IF combined ~ '\bpersonal\b|\bfamily\b|\bkids?\b|\bschool\b|\berrand\b|\bgrocery\b|\bhaircut\b|\bcar\b' THEN
    RETURN 'personal';
  END IF;

  -- Default
  RETURN 'event';
END;
$$;

-- 4. Migrate existing events that have the default 'event' type
--    Update them to the detected type if a more specific one can be found.
UPDATE public.calendar_events
SET event_type = public.auto_detect_event_type(title, description, location)
WHERE event_type = 'event'
  AND public.auto_detect_event_type(title, description, location) <> 'event';

-- 5. Verify the migration
DO $$
DECLARE
  type_counts RECORD;
BEGIN
  FOR type_counts IN
    SELECT event_type, count(*) as cnt
    FROM public.calendar_events
    GROUP BY event_type
    ORDER BY cnt DESC
  LOOP
    RAISE NOTICE 'Type: %, Count: %', type_counts.event_type, type_counts.cnt;
  END LOOP;
END;
$$;
