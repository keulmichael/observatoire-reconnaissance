create table if not exists public.historical_import_sessions (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null,
  range_start date not null,
  range_end date not null,
  started_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz,
  articles_fetched integer not null default 0,
  events_created integer not null default 0,
  errors integer not null default 0,
  data jsonb not null default '{}'::jsonb
);

create index if not exists historical_import_sessions_owner_id_idx on public.historical_import_sessions(owner_id);
create index if not exists historical_import_sessions_status_idx on public.historical_import_sessions(status);
create index if not exists historical_import_sessions_range_idx on public.historical_import_sessions(range_start, range_end);
create index if not exists historical_import_sessions_updated_at_idx on public.historical_import_sessions(updated_at);

create index if not exists global_articles_owner_published_idx on public.global_articles(owner_id, published_at);
create index if not exists global_articles_owner_country_idx on public.global_articles(owner_id, country);
create index if not exists global_articles_data_gin_idx on public.global_articles using gin (data);
create index if not exists global_events_owner_started_idx on public.global_events(owner_id, started_at);
create index if not exists global_events_owner_interest_idx on public.global_events(owner_id, interest_score);
create index if not exists global_events_data_gin_idx on public.global_events using gin (data);
create index if not exists global_claims_data_gin_idx on public.global_claims using gin (data);
create index if not exists global_collection_logs_mode_idx on public.global_collection_logs(mode);

alter table public.historical_import_sessions enable row level security;

drop policy if exists "historical_import_sessions own read" on public.historical_import_sessions;
drop policy if exists "historical_import_sessions own insert" on public.historical_import_sessions;
drop policy if exists "historical_import_sessions own update" on public.historical_import_sessions;
drop policy if exists "historical_import_sessions own delete" on public.historical_import_sessions;

create policy "historical_import_sessions own read" on public.historical_import_sessions
for select using (owner_id = auth.uid());

create policy "historical_import_sessions own insert" on public.historical_import_sessions
for insert with check (owner_id = auth.uid());

create policy "historical_import_sessions own update" on public.historical_import_sessions
for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "historical_import_sessions own delete" on public.historical_import_sessions
for delete using (owner_id = auth.uid());
