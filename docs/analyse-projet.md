# Analyse projet

Le dossier initial etait vide et sans depot Git. L'application a donc ete creee comme projet Next.js App Router autonome.

## Objectif

Construire un instrument d'observation de la dynamique de reconnaissance selon la Theorie de la Reflexivite, sans pretendre determiner la verite.

## Architecture retenue

- `src/app` : shell applicatif Next.js.
- `src/components` : composants reutilisables et visualisations.
- `src/lib/types.ts` : modele de donnees strict.
- `src/lib/demo-data.ts` : etude fictive prechargee.
- `src/lib/repository.ts` : couche de persistance localStorage.
- `src/lib/analytics.ts` : calculs locaux sans IA externe.
- `docs` et `design-system` : documentation fonctionnelle et design.

## 21st.dev

Recherche effectuee : composants de dashboard scientifique sombre. Les composants trouves etaient majoritairement des cartes statistiques ou dashboards generiques necessitant shadcn et une installation via API. Decision : rejet pour eviter dependances et collage visuel. Les patterns retenus sont implementes nativement avec Tailwind.

## Limites du workflow

Le skill requis `ui-ux-pro-max` n'etait pas disponible dans cette session. Les references internes mentionnees par le skill `website-builder` etaient absentes du cache local. Une approche UX equivalente a ete appliquee manuellement et documentee.
