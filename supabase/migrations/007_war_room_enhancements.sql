-- Add Projects/War Rooms feature
create table if not exists ai_projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  description text,
  color text default '#f43f5e', -- Pulse rose theme color
  icon text default 'fa-folder',
  
  -- Project settings
  settings jsonb default '{}', -- Default agents, thinking mode, etc.
  
  is_archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Link sessions to projects
alter table ai_sessions add column if not exists project_id uuid references ai_projects(id) on delete set null;

-- Document summaries & keywords
alter table knowledge_docs add column if not exists ai_summary text;
alter table knowledge_docs add column if not exists ai_keywords text[];
alter table knowledge_docs add column if not exists processing_status text default 'pending'; -- 'pending', 'processing', 'completed', 'failed'

-- Link documents to projects
create table if not exists project_docs (
  project_id uuid references ai_projects(id) on delete cascade,
  doc_id uuid references knowledge_docs(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (project_id, doc_id)
);

-- Thinking logs (chain of thought)
create table if not exists ai_thinking_logs (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid references ai_messages(id) on delete cascade,
  thinking_steps jsonb not null, -- Array of {step: number, thought: string, duration_ms: number}
  total_thinking_time_ms integer,
  created_at timestamptz default now()
);

-- Suggested prompts
create table if not exists ai_prompt_suggestions (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references ai_sessions(id) on delete cascade,
  suggestion_text text not null,
  context_summary text, -- Why this was suggested
  relevance_score float,
  is_used boolean default false,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_ai_projects_user on ai_projects(user_id);
create index if not exists idx_ai_sessions_project on ai_sessions(project_id);
create index if not exists idx_thinking_logs_message on ai_thinking_logs(message_id);
create index if not exists idx_prompt_suggestions_session on ai_prompt_suggestions(session_id);

-- RLS Policies
alter table ai_projects enable row level security;
alter table project_docs enable row level security;
alter table ai_thinking_logs enable row level security;
alter table ai_prompt_suggestions enable row level security;

create policy "Users can manage own projects" on ai_projects
  for all using (user_id = auth.uid());

create policy "Users can manage docs in own projects" on project_docs
  for all using (
    exists (
      select 1 from ai_projects 
      where ai_projects.id = project_id 
      and ai_projects.user_id = auth.uid()
    )
  );

create policy "Users can view thinking logs for own sessions" on ai_thinking_logs
  for select using (
    exists (
      select 1 from ai_messages 
      join ai_sessions on ai_messages.session_id = ai_sessions.id
      where ai_messages.id = ai_thinking_logs.message_id 
      and ai_sessions.user_id = auth.uid()
    )
  );

create policy "Users can view suggestions for own sessions" on ai_prompt_suggestions
  for all using (
    exists (
      select 1 from ai_sessions 
      where ai_sessions.id = session_id 
      and ai_sessions.user_id = auth.uid()
    )
  );
