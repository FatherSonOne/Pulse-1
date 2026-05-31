-- Close the remaining RLS-off holes. 38 of these have no client usage (legacy
-- cross-app mirrors + empty dev scaffolding); enabling RLS with no policy makes
-- them deny-all to client roles while service-role/edge functions still work.
-- Verified: no direct `.from()` and no PostgREST embeds reference them.
--
-- Reverse with: ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;
alter table public.ecosystem_inbound_diagnostics enable row level security;
alter table public.logos_contacts            enable row level security;
alter table public.logos_projects            enable row level security;
alter table public.logos_cases               enable row level security;
alter table public.logos_notes               enable row level security;
alter table public.logos_pulse_activity      enable row level security;
alter table public.logos_pulse_mappings      enable row level security;
alter table public.logos_sync_logs           enable row level security;
alter table public.logos_tasks               enable row level security;
alter table public.entomate_meetings         enable row level security;
alter table public.entomate_automations      enable row level security;
alter table public.entomate_projects         enable row level security;
alter table public.entomate_action_items     enable row level security;
alter table public.entomate_automation_logs  enable row level security;
alter table public.entomate_project_tasks    enable row level security;
alter table public.agents                    enable row level security;
alter table public.ai_agents                 enable row level security;
alter table public.agent_runs                enable row level security;
alter table public.agent_run_steps           enable row level security;
alter table public.agent_execution_logs      enable row level security;
alter table public.automations               enable row level security;
alter table public.automation_logs           enable row level security;
alter table public.automation_templates      enable row level security;
alter table public.conversations             enable row level security;
alter table public.conversation_messages     enable row level security;
alter table public.crm_sync_log              enable row level security;
alter table public.embeddings                enable row level security;
alter table public.message_impact            enable row level security;
alter table public.projects                  enable row level security;
alter table public.teams                     enable row level security;
alter table public.search_documents          enable row level security;
alter table public.search_index              enable row level security;
alter table public.ai_insights_cache         enable row level security;
alter table public.user_ai_preferences       enable row level security;
alter table public.workspace_settings        enable row level security;
alter table public.gemini_rate_limits        enable row level security;
alter table public.project_templates         enable row level security;
alter table public.action_items              enable row level security;

-- meetings IS client-read (created_by-scoped). Give it a real owner policy
-- rather than deny-all so the AI Scribe meeting views keep working.
create policy meetings_owner_all on public.meetings
  for all to public
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
alter table public.meetings enable row level security;
