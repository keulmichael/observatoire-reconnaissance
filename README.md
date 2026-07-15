# Observatoire de la Reconnaissance

Application web locale pour observer des transformations de compréhension selon la Théorie de la Réflexivité.

L'application ne détermine pas la vérité d'une interprétation. Elle documente un chemin observable Delta : manifestations, relations, émotions, catalyseurs, reconnaissances, transformations, temporalité et confirmation.

## Stack technique

- Next.js App Router
- React
- TypeScript strict
- Tailwind CSS
- React Flow (`@xyflow/react`)
- Recharts
- Lucide React
- Persistance navigateur avec `localStorage`

## Installation

```bash
npm install
```

## Lancement local

```bash
npm run dev
```

## Qualité et build

```bash
npm run lint
npm run typecheck
npm run build
```

## Architecture principale

- `src/app` : shell applicatif Next.js et page principale.
- `src/components` : carte réflexive, graphiques et composants UI locaux.
- `src/lib/types.ts` : modèle de données TypeScript.
- `src/lib/demo-data.ts` : étude fictive de démonstration.
- `src/lib/repository.ts` : chargement, sauvegarde et réinitialisation via `localStorage`.
- `src/lib/analytics.ts` : indicateurs, exports JSON, chronologie et comparaisons locales.
- `docs/` : documentation d'audit, modèle et roadmap.
- `design-system/` : notes de direction d'interface existante.

## Fonctionnement général

L'interface propose un tableau de bord, une liste d'études, des états de compréhension, des transitions Delta, une carte réflexive, des observations émotionnelles, des catalyseurs, des reconnaissances, une chronologie et une vue d'analyse.

Les données de démonstration sont préchargées au premier lancement. L'utilisateur peut créer, modifier, dupliquer, supprimer et exporter des études, importer un fichier JSON, réinitialiser la démonstration et modifier la carte réflexive.

## Persistance des données

Les données restent dans le navigateur avec la clé `observatoire-reconnaissance:v1`. Aucun backend, aucune base de données distante et aucune API externe ne sont utilisés dans la version actuelle.

## Limites actuelles

- Les données sont locales au navigateur.
- Il n'existe pas encore d'authentification ni de collaboration multi-utilisateur.
- Les exports PDF et CSV ne sont pas présents.
- L'historique détaillé des modifications reste limité.
- Les analyses sont des calculs locaux et prudents, pas des confirmations scientifiques automatiques.

## Avertissement méthodologique

L'application observe des transformations de compréhension et ne prétend pas déterminer la Vérité.
