# Portee d'analyse

Le type explicite est :

```ts
type AnalysisScope =
  | { mode: "selected-study"; studyId: string }
  | { mode: "all-studies" };
```

En mode etude selectionnee, les fonctions recoivent uniquement l'etude ciblee. En mode toutes les etudes, elles recoivent toutes les etudes accessibles et affichent le nombre d'etudes et d'observations analysees.

Les fallbacks implicites vers `studies[0]` sont a proscrire pour les fonctions analytiques.
