alter table if exists public.ai_observation_results
  alter column provider set default 'openai',
  alter column model set default 'gpt-4.1-mini',
  alter column status set default 'error',
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.ai_observation_results
set
  provider = coalesce(nullif(provider, ''), nullif(data->>'provider', ''), 'openai'),
  model = coalesce(nullif(model, ''), nullif(data->>'model', ''), 'gpt-4.1-mini'),
  status = coalesce(nullif(status, ''), nullif(data->>'status', ''), 'error'),
  created_at = coalesce(created_at, nullif(data->>'createdAt', '')::timestamptz, now()),
  updated_at = coalesce(updated_at, nullif(data->>'updatedAt', '')::timestamptz, now())
where provider is null
   or provider = ''
   or model is null
   or model = ''
   or status is null
   or status = ''
   or created_at is null
   or updated_at is null;

update public.ai_observation_results
set data = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(coalesce(data, '{}'::jsonb), '{provider}', to_jsonb(provider), true),
      '{model}',
      to_jsonb(model),
      true
    ),
    '{status}',
    to_jsonb(status),
    true
  ),
  '{createdAt}',
  to_jsonb(created_at),
  true
)
where data is null
   or data->>'provider' is null
   or data->>'provider' = ''
   or data->>'model' is null
   or data->>'model' = ''
   or data->>'status' is null
   or data->>'status' = ''
   or data->>'createdAt' is null
   or data->>'createdAt' = '';

alter table if exists public.ai_observation_results
  alter column provider set not null,
  alter column model set not null,
  alter column status set not null,
  alter column data set not null,
  alter column created_at set not null,
  alter column updated_at set not null;
