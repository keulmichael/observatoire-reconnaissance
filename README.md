# Observatoire de la Reconnaissance

Application web pour observer des transformations de comprehension selon la Theorie de la Reflexivite.

L'application ne determine pas la verite d'une interpretation. Elle documente un chemin observable Delta : manifestations, relations, emotions, attitudes, representations, catalyseurs, reconnaissances, transformations, temporalite et confirmation.

## Stack technique

- Next.js App Router
- React
- TypeScript strict
- Tailwind CSS
- React Flow (`@xyflow/react`)
- Recharts
- Lucide React
- Supabase PostgreSQL/Auth/Storage
- Cache navigateur avec `localStorage`

## Installation

```bash
npm install
```

## Configuration

Copier `.env.example` puis renseigner :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` cote serveur uniquement si une operation sensible l'exige
- `OPENAI_API_KEY` cote serveur pour l'analyse IA assistee

## Lancement local

```bash
npm run dev
```

## Qualite et build

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## Architecture principale

- `src/app` : shell applicatif Next.js et page principale.
- `src/components` : carte reflexive, graphiques et composants UI locaux.
- `src/lib/types.ts` : modele de donnees TypeScript.
- `src/lib/repository.ts` et `src/lib/repositories/*` : abstraction repository, cache local, Supabase et synchronisation.
- `src/lib/global-observatory/*` : Observatoire mondial, veille temps reel RSS, import historique, fusion, analyse reflexive, suggestions d'etudes et apprentissage.
- `src/lib/engines/MultidimensionalChangeEngine.ts` : comparaison multidimensionnelle prudente.
- `supabase/migrations/` : schema PostgreSQL, index, RLS et Storage prive.
- `docs/` : stockage, schema, securite, portee d'analyse et guide utilisateur.

## Observatoire mondial

Deux modes sont separes :

- Veille temps reel : collecte RSS quotidienne, actualisation manuelle ou cron, nouveaux articles recents.
- Import historique : import par jour, semaine, mois, annee ou periode personnalisee, par batch, avec pause/reprise, journal d'erreurs, statistiques et recherche.

L'import historique utilise `HistoricalImportEngine`. Les connecteurs sont extensibles pour GDELT, Event Registry, Wikinews, MediaStack, NewsAPI, Reuters/AP/BBC/France24/Guardian/Al Jazeera/DW/NHK, ONU, OMS, NASA, NOAA, Copernicus, USGS, ACLED, ReliefWeb/OCHA, FMI, Banque Mondiale et OCDE selon les droits d'acces disponibles.

## Persistance des donnees

Supabase PostgreSQL est la source de verite distante lorsqu'un utilisateur est connecte. `localStorage` avec la cle `observatoire-reconnaissance:v1` reste un cache local, un brouillon hors ligne et une file de reprise de synchronisation.

## Limites actuelles

- La collaboration multi-utilisateur est preparee dans le schema mais pas encore exposee dans l'interface.
- Les exports PDF et CSV ne sont pas presents.
- Les migrations Supabase doivent etre appliquees dans le projet Supabase cible avant production.
- Les analyses sont des calculs prudents et des propositions, pas des confirmations scientifiques automatiques.

## Avertissement methodologique

L'application observe des transformations de comprehension et ne pretend pas determiner la Verite.
