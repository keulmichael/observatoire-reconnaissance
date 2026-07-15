# Moteur de Reflexivite

## Objet scientifique

Le moteur de Reflexivite observe des indicateurs objectivables de reorganisation d'une comprehension entre deux etats `UnderstandingState`.

Il n'observe pas la Verite, les personnes, les croyances, les valeurs individuelles ou un niveau spirituel. Il observe uniquement des variations documentees dans les donnees locales de l'application.

Formule centrale :

```text
Delta(S) = variation observable entre deux etats de comprehension
```

`Delta(S)` mesure une variation observable de comprehension, jamais la Verite ni la valeur d'une personne.

## Donnees utilisees

Les moteurs conservent la compatibilite avec le modele existant :

- `Study`
- `UnderstandingState`
- `Transition`
- `Relation`
- `EmotionObservation`
- `Catalyst`
- `Recognition`

L'objet historique `Recognition` n'est pas supprime. Pendant cette evolution, une reconnaissance saisie coexiste avec une reconnaissance calculee par comparaison d'etats. Une migration future pourra transformer `Recognition` en resultat derive d'un `StateDifference`, mais cette migration n'est pas realisee maintenant.

## Moteurs

### StateDifferenceEngine

Compare deux `UnderstandingState` et produit un `StateDifference`.

Il distingue :

- ajout ;
- retrait ;
- reformulation probable ;
- stabilisation ;
- contradiction potentielle ;
- indicateurs insuffisants.

Une reformulation probable produit un `ReformulationCandidate` avec `Confirmation utilisateur requise`. Le moteur ne fusionne jamais automatiquement deux formulations.

### LanguageEngine

Analyse localement le vocabulaire :

- nouveaux mots ;
- mots abandonnes ;
- mots stables ;
- frequences ;
- candidats de reformulation.

La detection repose sur normalisation locale, tokenisation et similarite simple. Aucune IA ni modele externe n'est utilise.

### DeltaEngine

Calcule `Delta(S)` a partir d'un `StateDifference`.

Le calcul retourne :

- score brut ;
- facteurs positifs ;
- facteurs negatifs ;
- facteurs neutres ;
- limites du calcul.

Une valeur positive ne signifie pas automatiquement une progression. Elle peut indiquer une restructuration, une instabilite, une expansion lexicale ou une transformation observee.

### RelationEngine

Produit uniquement des `RelationProposal`.

Chaque proposition contient :

- les elements concernes ;
- la raison calculee ;
- le niveau de confiance ;
- la provenance des donnees ;
- le statut initial `hypothese` ;
- les actions `valider` et `rejeter`.

Le moteur ne retourne jamais une relation confirmee automatiquement.

### CatalystEngine

Calcule des indicateurs de catalyseurs selon les observations :

- frequence ;
- temps moyen avant transformation ;
- nombre de transitions associees ;
- emotions associees ;
- transmissions associees.

Ces indicateurs ne prouvent pas une causalite.

### EmotionEngine

Detecte des sequences emotionnelles recurrentes.

Exemple :

```text
confusion -> questionnement -> apaisement
```

Le moteur affiche seulement une sequence observee un certain nombre de fois. Il ne conclut pas a une signification causale.

### TrajectoryEngine

Compare plusieurs trajectoires sans comparer les personnes.

Dimensions autorisees :

- sequences d'etats ;
- types de transitions ;
- delais ;
- emotions documentees ;
- categories de catalyseurs ;
- formes de transmission.

Dimensions exclues :

- personnes ;
- identites ;
- valeurs individuelles ;
- sujets nominatifs.

## Methode de calcul de Delta(S)

Les ponderations sont explicites dans `src/lib/engines/DeltaEngine.ts`.

Ponderations actuelles :

| Facteur | Valeur |
| --- | ---: |
| Concept ajoute | +2 |
| Concept retire | -1 |
| Reformulation probable de concept | +1 |
| Relation possible ajoutee | +2 |
| Relation retiree | -1 |
| Decision ou comportement nouveau | +2 |
| Decision ou comportement abandonne | -1 |
| Projet nouveau | +1 |
| Projet abandonne | -1 |
| Evolution du vocabulaire | +1 par amplitude absolue |
| Contradiction potentielle | -2 |
| Stabilisation observee | 0 |
| Indicateurs insuffisants | 0 |

Le score brut est la somme de ces facteurs. Les facteurs sont conserves dans le resultat pour rendre le calcul decomposable et reproductible.

## Exemples

Concept ajoute :

```text
Avant : observation locale
Apres : observation locale + transmission prudente
Resultat : ajout de concept, Delta positif par variation observee
```

Reformulation probable :

```text
Avant : IA
Apres : Intelligence artificielle
Resultat : reformulation probable, confirmation utilisateur requise
```

Contradiction potentielle :

```text
Avant : relation stable
Apres : relation non stable
Resultat : contradiction potentielle, pas simple suppression
```

## Limites

- Les calculs dependent uniquement des donnees saisies localement.
- Une absence de donnees produit `Indicateurs insuffisants`.
- Les reformulations probables peuvent produire des faux positifs.
- Les frequences ne prouvent pas une causalite.
- Les trajectoires similaires ne prouvent pas des causes similaires.
- Les emotions sont des indicateurs de transition, pas des preuves.

## Biais possibles

- Biais de saisie : ce qui n'est pas documente ne peut pas etre observe.
- Biais lexical : deux formulations proches peuvent avoir des sens differents.
- Biais temporel : une chronologie incomplete peut deformer les delais.
- Biais de confirmation : l'utilisateur peut valider trop vite une relation possible.

## Fait, hypothese, confirmation

Fait : element documente dans les donnees.

Hypothese : interpretation prudente ou relation possible issue des indicateurs.

Confirmation : validation explicite par l'utilisateur ou stabilite documentee dans le temps. Les moteurs ne produisent pas seuls une confirmation definitive.

## Regles ethiques

Les moteurs doivent employer des formulations prudentes :

- Observation
- Hypothese
- Relation possible
- Reformulation probable
- Transformation observee
- Indicateurs insuffisants
- Confirmation utilisateur requise

Les moteurs ne doivent jamais produire :

- "Ceci est vrai."
- un score de Verite ;
- un niveau spirituel ;
- une interpretation comme un fait ;
- une reformulation probable comme une equivalence certaine ;
- une correlation comme une causalite.

## Avertissement

`Delta(S)` mesure une variation observable de comprehension, jamais la Verite ni la valeur d'une personne.
