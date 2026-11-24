-- EAI-08 follow-up: close browser access to the bridge tokens.
--
-- Before: every signed-in user could SELECT service_token / inbound_token and
-- INSERT / UPDATE any ecosystem_config row (api_url included), so a user could
-- read every bridge secret or point the heartbeat at their own URL.
-- After: browsers read only the non-secret columns. All writes go through the
-- service role (edge functions) or SQL run by a platform admin.

drop policy if exists authenticated_insert_ecosystem_config on public.ecosystem_config;
drop policy if exists authenticated_update_ecosystem_config on public.ecosystem_config;

revoke all on public.ecosystem_config from anon, authenticated;

-- authenticated_read_ecosystem_config (SELECT, true) stays; these columns are
-- what the Settings page and isEntomateConnected() read. Not service_token,
-- inbound_token or features (features holds the peer gateway_key).
grant select (id, app_name, api_url, bot_url, enabled, last_heartbeat, created_at, updated_at)
  on public.ecosystem_config to authenticated;
