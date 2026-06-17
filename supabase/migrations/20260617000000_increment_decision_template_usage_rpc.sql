-- Dedicated usage counter for decision_templates.
--
-- The pre-existing increment_template_usage() RPC targets message_templates
-- (a different table, plus a `user_id = auth.uid()` filter that decision_templates
-- does not have), so decision-template usage_count never incremented. The cockpit's
-- "New from template" create path (decisionTemplateService.trackUsage) now calls this
-- dedicated function instead.
--
-- SECURITY DEFINER so any authenticated user can bump a shared/system template's
-- counter; REVOKE from anon per the launch-readiness convention for DEFINER RPCs.
CREATE OR REPLACE FUNCTION public.increment_decision_template_usage(p_template_id uuid)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public','pg_temp'
AS $$
  UPDATE public.decision_templates
  SET usage_count = usage_count + 1, last_used_at = now()
  WHERE id = p_template_id;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_decision_template_usage(uuid) FROM anon;
