create table if not exists public.global_sources (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source_type text not null,
  endpoint text,
  enabled boolean not null default true,
  reliability numeric not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name, source_type)
);

create table if not exists public.global_articles (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_id text not null references public.global_sources(id) on delete cascade,
  external_id text,
  canonical_url text,
  normalized_title text not null,
  title text not null,
  published_at timestamptz not null,
  collected_at timestamptz not null,
  language text not null,
  country text,
  summary text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, canonical_url),
  unique (owner_id, source_id, external_id)
);

create table if not exists public.global_events (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  normalized_title text not null,
  summary text not null,
  country text,
  status text not null,
  started_at timestamptz not null,
  updated_event_at timestamptz not null,
  interest_score numeric,
  interest_level text,
  learning_weight numeric not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, normalized_title, started_at, country)
);

create table if not exists public.global_event_articles (
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null references public.global_events(id) on delete cascade,
  article_id text not null references public.global_articles(id) on delete cascade,
  merge_status text not null,
  confidence numeric not null default 0,
  reason text,
  created_at timestamptz not null default now(),
  primary key (event_id, article_id)
);

create table if not exists public.global_excerpts (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  article_id text not null references public.global_articles(id) on delete cascade,
  location text not null,
  excerpt_text text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.global_claims (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null references public.global_events(id) on delete cascade,
  claim_text text not null,
  claim_status text not null check (claim_status in ('fait rapporté', 'interprétation', 'hypothèse', 'limite', 'observation sourcée')),
  confidence numeric not null default 0,
  generated_at timestamptz not null,
  model_version text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.global_claim_sources (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  claim_id text not null references public.global_claims(id) on delete cascade,
  article_id text not null references public.global_articles(id) on delete cascade,
  excerpt_id text references public.global_excerpts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (claim_id, article_id, excerpt_id)
);

create table if not exists public.global_analyses (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null references public.global_events(id) on delete cascade,
  engine_version text not null,
  generated_at timestamptz not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, event_id, engine_version)
);

create table if not exists public.global_study_suggestions (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null references public.global_events(id) on delete cascade,
  title text not null,
  status text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.global_user_decisions (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_id text references public.global_events(id) on delete cascade,
  suggestion_id text references public.global_study_suggestions(id) on delete set null,
  decision text not null,
  reason text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.global_learning_signals (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null references public.global_events(id) on delete cascade,
  suggestion_id text references public.global_study_suggestions(id) on delete set null,
  study_id text references public.studies(id) on delete set null,
  action text not null,
  weight numeric not null,
  reason text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

create table if not exists public.global_collection_logs (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  mode text not null,
  articles_fetched integer not null default 0,
  new_events integer not null default 0,
  duplicate_articles integer not null default 0,
  merged_articles integer not null default 0,
  ambiguous_merges integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists global_sources_owner_id_idx on public.global_sources(owner_id);
create index if not exists global_articles_owner_id_idx on public.global_articles(owner_id);
create index if not exists global_articles_published_at_idx on public.global_articles(published_at);
create index if not exists global_articles_normalized_title_idx on public.global_articles(normalized_title);
create index if not exists global_events_owner_id_idx on public.global_events(owner_id);
create index if not exists global_events_status_idx on public.global_events(status);
create index if not exists global_events_country_idx on public.global_events(country);
create index if not exists global_event_articles_owner_id_idx on public.global_event_articles(owner_id);
create index if not exists global_excerpts_article_id_idx on public.global_excerpts(article_id);
create index if not exists global_claims_event_id_idx on public.global_claims(event_id);
create index if not exists global_learning_signals_event_id_idx on public.global_learning_signals(event_id);
create index if not exists global_collection_logs_owner_id_idx on public.global_collection_logs(owner_id);
create index if not exists global_collection_logs_started_at_idx on public.global_collection_logs(started_at);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'global_sources','global_articles','global_events','global_event_articles','global_excerpts','global_claims',
    'global_claim_sources','global_analyses','global_study_suggestions','global_user_decisions',
    'global_learning_signals','global_collection_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
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
