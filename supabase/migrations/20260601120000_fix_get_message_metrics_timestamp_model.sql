-- Realign get_message_metrics to the live message_interactions timestamp-column model.
--
-- Background: message_interactions records one row per "shown" event and records
-- open/click/dismiss as timestamp UPDATEs on that row (shown_at / opened_at /
-- clicked_at / dismissed_at) — which is exactly what messageService.recordMessage*
-- writes. The previous get_message_metrics definition instead filtered on
-- interaction_type and averaged viewed_duration_seconds, neither of which exists on
-- the table, so the RPC threw whenever Message Analytics selected a message.
--
-- This rewrite keeps the original RETURNS signature intact (total_shown, total_opened,
-- total_clicked, total_dismissed, open_rate, click_rate, avg_time_to_action) so the
-- messageService.getMessageMetrics mapper is unchanged; only the body is corrected.
CREATE OR REPLACE FUNCTION public.get_message_metrics(message_uuid uuid)
 RETURNS TABLE(total_shown bigint, total_opened bigint, total_clicked bigint, total_dismissed bigint, open_rate numeric, click_rate numeric, avg_time_to_action numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE shown_at IS NOT NULL) AS total_shown,
    COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS total_opened,
    COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS total_clicked,
    COUNT(*) FILTER (WHERE dismissed_at IS NOT NULL) AS total_dismissed,
    CASE
      WHEN COUNT(*) FILTER (WHERE shown_at IS NOT NULL) > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::numeric /
           COUNT(*) FILTER (WHERE shown_at IS NOT NULL)::numeric) * 100,
          2
        )
      ELSE 0
    END AS open_rate,
    CASE
      WHEN COUNT(*) FILTER (WHERE shown_at IS NOT NULL) > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::numeric /
           COUNT(*) FILTER (WHERE shown_at IS NOT NULL)::numeric) * 100,
          2
        )
      ELSE 0
    END AS click_rate,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (COALESCE(clicked_at, opened_at) - shown_at)))
      FILTER (WHERE (clicked_at IS NOT NULL OR opened_at IS NOT NULL) AND shown_at IS NOT NULL),
      2
    ) AS avg_time_to_action
  FROM message_interactions
  WHERE message_id = message_uuid;
END;
$function$;
