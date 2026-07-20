# Schema de base distante

Les migrations SQL creent les tables racines `profiles`, `observatory_profiles`, `studies`, `observation_records`, `observation_drafts` et `ai_observation_results`.

Les dimensions et resultats sont normalises dans des tables dediees : `manifestations`, `emotions`, `attitudes`, `representations`, `behaviours`, `concepts`, `relations`, `catalysts`, `understanding_states`, `emotional_states`, `behavioural_states`, `transitions`, `delta_scores`, `recognitions`, `timeline_events`, `open_questions`, `longitudinal_changes`, `history_entries`, `theory_elements`, `theory_evidence_links`.

Chaque table utilisateur contient `owner_id`, `created_at`, `updated_at` et un champ `data jsonb` pour conserver les textes longs, extraits et resultats IA sans troncature arbitraire.
