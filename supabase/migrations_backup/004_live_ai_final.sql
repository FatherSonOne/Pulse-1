-- Enable Vector Extension for RAG
create extension if not exists vector;

-- Handle User Sync from Auth to Public
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- LIVE AI SESSIONS
-- Persistent chat sessions (like "Rooms" or "Threads")
-- ============================================
create table if not exists ai_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid, -- REMOVED FOREIGN KEY CONSTRAINT FOR NOW TO FIX 409 ERROR
  title text not null default 'New Session',
  description text,
  session_type text default 'chat', -- 'chat', 'research', 'brainstorm'
  
  -- Configuration for this specific session
  settings jsonb default '{}', -- Store active agents, temperature, etc.
  
  is_archived boolean default false,
  is_public boolean default false, -- If true, accessible by team
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- AI MESSAGES
-- Chat history for sessions
-- ============================================
create table if not exists ai_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references ai_sessions(id) on delete cascade,
  user_id uuid, -- REMOVED FOREIGN KEY CONSTRAINT
  
  role text not null, -- 'user', 'assistant', 'system'
  agent_id text, -- ID of the specific agent persona (e.g. 'skeptic', 'scribe')
  
  content text not null,
  
  -- For citations and sources
  citations jsonb default '[]', -- Array of { source_id, text, url }
  metadata jsonb default '{}', -- Token usage, processing time, etc.
  
  created_at timestamptz default now()
);

-- ============================================
-- KNOWLEDGE BASE (DOCUMENTS)
-- Global team knowledge base + Personal uploads
-- ============================================
create table if not exists knowledge_docs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid, -- REMOVED FOREIGN KEY CONSTRAINT
  
  title text not null,
  original_name text, -- Filename
  file_type text, -- 'pdf', 'docx', 'url', 'text'
  url text, -- Source URL or Storage Path
  
  summary text, -- AI generated summary
  
  -- Content storage (for simple text/markdown)
  -- For large files, we might only store chunks in embeddings
  text_content text, 
  
  is_processed boolean default false,
  is_shared boolean default true, -- Default to global team access
  
  metadata jsonb default '{}',
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- DOCUMENT EMBEDDINGS (VECTORS)
-- Chunks of documents for RAG
-- ============================================
create table if not exists doc_embeddings (
  id uuid primary key default uuid_generate_v4(),
  doc_id uuid references knowledge_docs(id) on delete cascade,
  
  content text not null, -- The specific chunk of text
  embedding vector(768), -- Dimensions for Gemini Embeddings (text-embedding-004)
  
  chunk_index integer,
  metadata jsonb default '{}',
  
  created_at timestamptz default now()
);

-- Create index for fast vector similarity search
create index if not exists idx_doc_embeddings_embedding on doc_embeddings 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- ============================================
-- SESSION DOCUMENTS JUNCTION
-- Link specific docs to a session context
-- ============================================
create table if not exists session_docs (
  session_id uuid references ai_sessions(id) on delete cascade,
  doc_id uuid references knowledge_docs(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (session_id, doc_id)
);

-- ============================================
-- RLS POLICIES
-- ============================================

alter table ai_sessions enable row level security;
alter table ai_messages enable row level security;
alter table knowledge_docs enable row level security;
alter table doc_embeddings enable row level security;
alter table session_docs enable row level security;

-- Sessions: Users see their own + public ones
create policy "Users can view own or public sessions" on ai_sessions
  for select using (user_id = auth.uid() or is_public = true);

create policy "Users can edit own sessions" on ai_sessions
  for all using (user_id = auth.uid());

create policy "Users can delete own sessions" on ai_sessions
  for delete using (user_id = auth.uid());

-- Messages: Users can view messages in sessions they have access to
create policy "Users can view messages in visible sessions" on ai_messages
  for select using (
    exists (
      select 1 from ai_sessions 
      where ai_sessions.id = ai_messages.session_id 
      and (ai_sessions.user_id = auth.uid() or ai_sessions.is_public = true)
    )
  );

create policy "Users can insert messages in visible sessions" on ai_messages
  for insert with check (
    exists (
      select 1 from ai_sessions 
      where ai_sessions.id = session_id 
      and (ai_sessions.user_id = auth.uid() or ai_sessions.is_public = true)
    )
  );

-- Knowledge Docs: Team-wide access
create policy "Users can view shared documents" on knowledge_docs
  for select using (is_shared = true or user_id = auth.uid());

create policy "Users can upload documents" on knowledge_docs
  for insert with check (auth.uid() = user_id);
  
create policy "Users can edit own documents" on knowledge_docs
  for update using (user_id = auth.uid());
  
create policy "Users can delete own documents" on knowledge_docs
  for delete using (user_id = auth.uid());

-- Embeddings inherit access from docs
create policy "Users can access embeddings of visible docs" on doc_embeddings
  for select using (
    exists (
      select 1 from knowledge_docs 
      where knowledge_docs.id = doc_embeddings.doc_id 
      and (knowledge_docs.is_shared = true or knowledge_docs.user_id = auth.uid())
    )
  );
  
create policy "Users can insert embeddings for own docs" on doc_embeddings
  for insert with check (
    exists (
      select 1 from knowledge_docs 
      where knowledge_docs.id = doc_embeddings.doc_id 
      and knowledge_docs.user_id = auth.uid()
    )
  );

-- Session Docs Junction
create policy "Users can manage docs in their sessions" on session_docs
  for all using (
    exists (
      select 1 from ai_sessions 
      where ai_sessions.id = session_id 
      and ai_sessions.user_id = auth.uid()
    )
  );

-- ============================================
-- VECTOR SEARCH FUNCTION (RPC)
-- ============================================
create or replace function match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_user_id uuid default null
)
returns table (
  id uuid,
  content text,
  similarity float,
  doc_title text,
  doc_url text
)
language plpgsql
as $$
begin
  return query
  select
    de.id,
    de.content,
    1 - (de.embedding <=> query_embedding) as similarity,
    kd.title as doc_title,
    kd.url as doc_url
  from doc_embeddings de
  join knowledge_docs kd on de.doc_id = kd.id
  where 1 - (de.embedding <=> query_embedding) > match_threshold
  and (
    kd.is_shared = true 
    or (filter_user_id is not null and kd.user_id = filter_user_id)
  )
  order by de.embedding <=> query_embedding
  limit match_count;
end;
$$;
