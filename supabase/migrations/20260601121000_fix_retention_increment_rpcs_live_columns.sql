-- Realign the retention increment RPCs to the live user_retention_cohorts schema.
--
-- The live table uses total_messages_seen / total_messages_clicked and has no
-- last_seen_at column. The prior function bodies wrote messages_seen_count /
-- messages_clicked_count / last_seen_at — all phantom columns — so the live
-- retention write path (recordMessageShown -> increment_messages_seen,
-- recordMessageClicked -> increment_messages_clicked) threw 42703 the moment any
-- in-app message was shown or clicked. It had never fired only because no
-- in_app_messages row has ever existed to display.
--
-- Decision: last-seen semantics fold into the existing updated_at column (no schema
-- change), which these functions already bump to NOW() on every increment.
--
-- All four overloads (text + uuid) are corrected. PostgREST selects the text
-- overload for the service's uncast string argument (verified), so the text
-- overloads are the load-bearing ones; the uuid overloads are fixed for parity.

CREATE OR REPLACE FUNCTION public.increment_messages_seen(user_uuid text)
 RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  INSERT INTO user_retention_cohorts (user_id, cohort_date, total_messages_seen, created_at, updated_at)
  VALUES (user_uuid::uuid, CURRENT_DATE, 1, NOW(), NOW())
  ON CONFLICT (user_id, cohort_date)
  DO UPDATE SET total_messages_seen = user_retention_cohorts.total_messages_seen + 1, updated_at = NOW();
END;
$f$;

CREATE OR REPLACE FUNCTION public.increment_messages_seen(user_uuid uuid)
 RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  UPDATE user_retention_cohorts
  SET total_messages_seen = total_messages_seen + 1, updated_at = NOW()
  WHERE user_id = user_uuid;
END;
$f$;

CREATE OR REPLACE FUNCTION public.increment_messages_clicked(user_uuid text)
 RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  INSERT INTO user_retention_cohorts (user_id, cohort_date, total_messages_clicked, created_at, updated_at)
  VALUES (user_uuid::uuid, CURRENT_DATE, 1, NOW(), NOW())
  ON CONFLICT (user_id, cohort_date)
  DO UPDATE SET total_messages_clicked = user_retention_cohorts.total_messages_clicked + 1, updated_at = NOW();
END;
$f$;

CREATE OR REPLACE FUNCTION public.increment_messages_clicked(user_uuid uuid)
 RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  UPDATE user_retention_cohorts
  SET total_messages_clicked = total_messages_clicked + 1, updated_at = NOW()
  WHERE user_id = user_uuid;
END;
$f$;
