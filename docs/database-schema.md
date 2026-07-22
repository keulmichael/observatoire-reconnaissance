# Schema de base distante

Les migrations SQL creent les tables racines `profiles`, `observatory_profiles`, `studies`, `observation_records`, `observation_drafts` et `ai_observation_results`.

Les dimensions et resultats sont normalises dans des tables dediees : `manifestations`, `emotions`, `attitudes`, `representations`, `behaviours`, `concepts`, `relations`, `catalysts`, `understanding_states`, `emotional_states`, `behavioural_states`, `transitions`, `delta_scores`, `recognitions`, `timeline_events`, `open_questions`, `longitudinal_changes`, `history_entries`, `theory_elements`, `theory_evidence_links`.

Chaque table utilisateur contient `owner_id`, `created_at`, `updated_at` et un champ `data jsonb` pour conserver les textes longs, extraits et resultats IA sans troncature arbitraire.

## Observatoire mondial

Les donnees mondiales sont stockees dans :

- `global_sources` : connecteurs RSS, bases d'evenements, organisations internationales, donnees geopolitiques, economiques et environnementales.
- `global_articles` : articles ou documents sources normalises.
- `global_events` : evenements observes apres fusion.
- `global_event_articles` : liaison many-to-many entre evenements et articles, avec statut de fusion.
- `global_excerpts` : extraits conserves pour la tracabilite.
- `global_claims`, `global_claim_sources`, `global_analyses` : analyse reflexive tracee.
- `global_study_suggestions`, `global_learning_signals` : suggestions validees par l'utilisateur et apprentissage.
- `global_collection_logs` : collecte temps reel et batchs historiques.
- `historical_import_sessions` : planification, curseur, progression, interruption, reprise et journal d'erreurs.

Les index de `202607220002_historical_import_observatory.sql` ciblent les recherches par periode, pays, score, mode de collecte et contenu `jsonb`.
