-- Check and add missing columns to users table if needed
do $$
begin
  -- Add name column if it doesn't exist
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'name') then
    alter table public.users add column name text;
  end if;
  
  -- Add avatar_url column if it doesn't exist
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'avatar_url') then
    alter table public.users add column avatar_url text;
  end if;
  
  -- Add updated_at column if it doesn't exist
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'updated_at') then
    alter table public.users add column updated_at timestamptz default now();
  end if;
end
$$;

-- Ensure users table exists (in case it doesn't exist at all)
create table if not exists public.users (
  id uuid primary key,
  email text unique not null,
  name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.users enable row level security;

-- Drop existing policy if it exists, then create new one
drop policy if exists users_policy on public.users;
create policy users_policy on public.users for all using (auth.uid() = id);

-- Handle User Sync from Auth to Public
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set email = excluded.email,
      name = excluded.name,
      avatar_url = excluded.avatar_url,
      updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill existing users who might be missing from public.users
insert into public.users (id, email, name, avatar_url)
select 
  id, 
  email, 
  coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
  raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do nothing;
