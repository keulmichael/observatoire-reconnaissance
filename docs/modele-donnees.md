# Modele de donnees

Les interfaces TypeScript principales sont definies dans `src/lib/types.ts`.

## Entites

- `Study` : parcours d'observation complet.
- `UnderstandingState` : etat de comprehension date et formule.
- `Transition` : passage Delta entre deux etats.
- `Manifestation` : fait ou apparition documentee.
- `Relation` : lien entre deux objets avec force, statut et niveau de preuve.
- `EmotionObservation` : emotion observee dans le temps.
- `Catalyst` : pont ou catalyseur relie a des transitions.
- `Recognition` : formulation complete d'une reconnaissance.
- `TimelineEvent` : evenement affiche dans la chronologie.

Chaque objet prevoit des identifiants uniques et des timestamps lorsque l'entite porte un cycle de vie.

## Persistance

La V1 utilise `localStorage` via `src/lib/repository.ts`. Les composants n'accedent pas directement au stockage.
