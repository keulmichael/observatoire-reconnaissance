# Stockage des donnees

Supabase PostgreSQL est la source de verite distante. Les composants passent par `ObservatoryRepository`, `SupabaseObservatoryRepository`, `LocalCacheRepository` et `SyncService`; ils n'appellent pas Supabase directement.

`localStorage` conserve le cache `observatoire-reconnaissance:v1`, les brouillons hors ligne et la reprise apres erreur. Une migration guidee exporte d'abord les donnees locales, puis importe dans Supabase en preservant les identifiants lorsque possible.

Statuts affiches : Synchronise, En cours, Hors ligne, Erreur de synchronisation, Cache local.
