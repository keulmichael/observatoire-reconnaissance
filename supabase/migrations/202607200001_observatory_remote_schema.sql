create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.observatory_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studies (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text,
  status text,
  data jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.observation_records (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  study_id text not null references public.studies(id) on delete cascade,
  raw_text text not null,
  status text not null,
  data jsonb not null,
  observed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.observation_drafts (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  raw_text text not null,
  status text not null,
  data jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.ai_observation_results (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  model text not null,
  status text not null,
  data jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.manifestations (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.emotions (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.attitudes (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.representations (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.behaviours (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.concepts (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.relations (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.catalysts (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.understanding_states (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.emotional_states (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.behavioural_states (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.transitions (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.delta_scores (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.recognitions (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.timeline_events (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.open_questions (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.longitudinal_changes (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.history_entries (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, study_id text not null references public.studies(id) on delete cascade, source_observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.theory_elements (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, theory_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.theory_evidence_links (id text primary key, owner_id uuid not null references auth.users(id) on delete cascade, theory_id text, theory_element_id text, study_id text, observation_id text, type text, status text, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table if not exists public.study_shares (
  id uuid primary key default gen_random_uuid(),
  study_id text not null references public.studies(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  shared_with uuid references auth.users(id) on delete cascade,
  permission text not null check (permission in ('read', 'contribute')),
  created_at timestamptz not null default now(),
  unique (study_id, shared_with)
);

create index if not exists studies_owner_id_idx on public.studies(owner_id);
create index if not exists studies_created_at_idx on public.studies(created_at);
create index if not exists studies_status_idx on public.studies(status);
create index if not exists observation_records_owner_id_idx on public.observation_records(owner_id);
create index if not exists observation_records_study_id_idx on public.observation_records(study_id);
create index if not exists observation_records_status_idx on public.observation_records(status);
create index if not exists observation_records_observed_at_idx on public.observation_records(observed_at);
create index if not exists observation_records_created_at_idx on public.observation_records(created_at);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','observatory_profiles','studies','observation_records','observation_drafts','ai_observation_results',
    'manifestations','emotions','attitudes','representations','behaviours','concepts','relations','catalysts',
    'understanding_states','emotional_states','behavioural_states','transitions','delta_scores','recognitions',
    'timeline_events','open_questions','longitudinal_changes','history_entries','theory_elements','theory_evidence_links',
    'study_shares'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

drop policy if exists "profiles own read" on public.profiles;
drop policy if exists "profiles own write" on public.profiles;
create policy "profiles own read" on public.profiles for select using (id = auth.uid());
create policy "profiles own write" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'observatory_profiles','studies','observation_records','observation_drafts','ai_observation_results',
    'manifestations','emotions','attitudes','representations','behaviours','concepts','relations','catalysts',
    'understanding_states','emotional_states','behavioural_states','transitions','delta_scores','recognitions',
    'timeline_events','open_questions','longitudinal_changes','history_entries','theory_elements','theory_evidence_links',
    'study_shares'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || ' own read', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || ' own insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || ' own update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || ' own delete', table_name);
    execute format('create policy %I on public.%I for select using (owner_id = auth.uid())', table_name || ' own read', table_name);
    execute format('create policy %I on public.%I for insert with check (owner_id = auth.uid())', table_name || ' own insert', table_name);
    execute format('create policy %I on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid())', table_name || ' own update', table_name);
    execute format('create policy %I on public.%I for delete using (owner_id = auth.uid())', table_name || ' own delete', table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('observatory-attachments', 'observatory-attachments', false)
on conflict (id) do nothing;

drop policy if exists "attachments owner read" on storage.objects;
drop policy if exists "attachments owner write" on storage.objects;

create policy "attachments owner read" on storage.objects
for select using (bucket_id = 'observatory-attachments' and owner = auth.uid());

create policy "attachments owner write" on storage.objects
for insert with check (bucket_id = 'observatory-attachments' and owner = auth.uid());
