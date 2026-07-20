do $$
declare table_name text;
begin
  foreach table_name in array array[
    'manifestations','emotions','attitudes','representations','behaviours','concepts','relations','catalysts',
    'understanding_states','emotional_states','behavioural_states','transitions','delta_scores','recognitions',
    'timeline_events','open_questions','longitudinal_changes','history_entries','theory_elements','theory_evidence_links'
  ] loop
    execute format('create index if not exists %I on public.%I(owner_id)', table_name || '_owner_id_idx', table_name);
    execute format('create index if not exists %I on public.%I(study_id)', table_name || '_study_id_idx', table_name);
    execute format('create index if not exists %I on public.%I(created_at)', table_name || '_created_at_idx', table_name);
    execute format('create index if not exists %I on public.%I(type)', table_name || '_type_idx', table_name);
    execute format('create index if not exists %I on public.%I(status)', table_name || '_status_idx', table_name);
    execute format('create index if not exists %I on public.%I(source_observation_id)', table_name || '_source_observation_id_idx', table_name);
  end loop;
end $$;
