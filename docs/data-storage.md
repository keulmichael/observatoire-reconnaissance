# Stockage des donnees

Supabase PostgreSQL est la source de verite distante. Les composants passent par `ObservatoryRepository`, `SupabaseObservatoryRepository`, `LocalCacheRepository` et `SyncService`; ils n'appellent pas Supabase directement.

`localStorage` conserve le cache `observatoire-reconnaissance:v1`, les brouillons hors ligne et la reprise apres erreur. Une migration guidee exporte d'abord les donnees locales, puis importe dans Supabase en preservant les identifiants lorsque possible.

Statuts affiches : Synchronise, En cours, Hors ligne, Erreur de synchronisation, Cache local.

## Import historique

Les sessions d'import historique sont stockees dans `historical_import_sessions`. Le champ `data jsonb` conserve la requete, la progression, le curseur, les journaux et les erreurs afin de reprendre un import interrompu sans perdre la trace.

Les articles, evenements, extraits, analyses et suggestions continuent d'utiliser les tables `global_articles`, `global_events`, `global_event_articles`, `global_excerpts`, `global_claims`, `global_analyses`, `global_study_suggestions` et `global_learning_signals`.

Les index ajoutes sur `owner_id`, dates, pays, score d'interet et `jsonb gin` preparent les volumes importants. L'objectif est de traiter par batch, pas de charger plusieurs centaines de milliers d'articles en une seule operation navigateur.
