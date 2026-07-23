alter table public.historical_import_sessions
add column if not exists locked_at timestamptz,
add column if not exists locked_by text,
add column if not exists attempts integer not null default 0,
add column if not exists last_error text;

create index if not exists historical_import_sessions_lock_idx
on public.historical_import_sessions(status, locked_at, updated_at);
