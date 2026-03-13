-- ============================================================
-- Migration: Calendar Recurring Events
-- Adds recurrence columns to calendar_events table
-- ============================================================

-- Recurrence rule (RRULE string, e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20260601)
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;

-- End date for the recurrence series
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS recurrence_end DATE;

-- Self-referencing FK: virtual instances point back to the parent event
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS recurrence_parent_id UUID
    REFERENCES calendar_events(id) ON DELETE CASCADE;

-- Flag rows that are overrides/exceptions to a recurring series
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS is_recurring_exception BOOLEAN DEFAULT false;

-- Index for fast lookup of all instances belonging to a parent
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence_parent
  ON calendar_events(recurrence_parent_id)
  WHERE recurrence_parent_id IS NOT NULL;

-- Index for fast lookup of exceptions by parent + date
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence_exception
  ON calendar_events(recurrence_parent_id, start_time)
  WHERE is_recurring_exception = true;

-- RLS: existing policies on calendar_events already cover these new columns
-- because RLS is enforced at the row level, not column level.
-- No additional policy changes required.

COMMENT ON COLUMN calendar_events.recurrence_rule IS
  'RRULE string per RFC 5545. Example: FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20260601';
COMMENT ON COLUMN calendar_events.recurrence_end IS
  'Hard end date for the series (redundant with UNTIL in RRULE but kept for fast querying)';
COMMENT ON COLUMN calendar_events.recurrence_parent_id IS
  'Non-null on exception rows. Points to the original recurring event.';
COMMENT ON COLUMN calendar_events.is_recurring_exception IS
  'True when this row is an edited or deleted override for a specific occurrence.';
