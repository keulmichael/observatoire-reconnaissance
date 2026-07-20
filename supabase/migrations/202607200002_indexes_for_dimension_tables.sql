do $$
declare target_table text;
begin
  foreach target_table in array array[
    'manifestations','emotions','attitudes','representations','behaviours','concepts','relations','catalysts',
    'understanding_states','emotional_states','behavioural_states','transitions','delta_scores','recognitions',
    'timeline_events','open_questions','longitudinal_changes','history_entries','theory_elements','theory_evidence_links'
  ] loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'owner_id') then
      execute format('create index if not exists %I on public.%I(owner_id)', target_table || '_owner_id_idx', target_table);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'study_id') then
      execute format('create index if not exists %I on public.%I(study_id)', target_table || '_study_id_idx', target_table);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'created_at') then
      execute format('create index if not exists %I on public.%I(created_at)', target_table || '_created_at_idx', target_table);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'type') then
      execute format('create index if not exists %I on public.%I(type)', target_table || '_type_idx', target_table);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'status') then
      execute format('create index if not exists %I on public.%I(status)', target_table || '_status_idx', target_table);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'source_observation_id') then
      execute format('create index if not exists %I on public.%I(source_observation_id)', target_table || '_source_observation_id_idx', target_table);
    end if;
  end loop;
end $$;
