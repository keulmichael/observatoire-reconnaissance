# Laboratoire theorique de la reconnaissance

## Distinction observation / theorie

Le laboratoire separe quatre niveaux.

- Niveau empirique : observations, extraits, evenements, emotions, comportements.
- Niveau analytique : etats, transitions, comparaisons, Delta.
- Niveau theorique : axiomes, principes, propositions, demonstrations, theoremes, corollaires.
- Niveau predictif : predictions derivees d'une theorie et testees par des observations futures.

Une observation ne devient jamais directement une verite theorique. Le flux impose est :

Observation -> Analyse -> Interpretation proposee -> Lien theorique propose -> Validation utilisateur -> Mise a jour eventuelle du niveau de soutien theorique.

## Architecture

Le modele ajoute :

- `Theory`
- `TheoryVersion`
- `TheoryElement`
- `TheoryEvidenceLink`
- `TheoryAssessment`
- `TheoryRevisionProposal`
- `TheoryPrediction`
- `TheoryHistoryEntry`

Les theories sont initialisees en `schemaVersion: 4` par migration non destructive. Les etudes et observations existantes restent utilisables, sans liaison automatique a la theorie.

## Statuts

Les statuts automatiques restent prudents :

- hypothese
- formule
- en observation
- soutenu par certaines observations
- conteste
- insuffisamment documente
- revise
- abandonne

Le moteur n'attribue pas automatiquement les statuts confirme, demontre ou prouve.

## Versionnement

Toute modification theorique acceptee cree une nouvelle `TheoryVersion`. Une version conserve :

- ancienne formulation par snapshot ;
- raison ;
- observations concernees ;
- etudes concernees ;
- auteur ;
- date ;
- version precedente.

Aucune version anterieure n'est ecrasee silencieusement.

## TheoryEngine

`TheoryEngine` est deterministe et ne modifie jamais directement la theorie. Il produit uniquement des `TheoryRevisionProposal`.

Types de propositions :

- element potentiellement soutenu ;
- element potentiellement contredit ;
- element potentiellement enrichi ;
- donnees insuffisantes ;
- nouvelle question ;
- proposition de revision ;
- prediction possible.

Chaque proposition contient les observations, etudes, extraits sources, resume de raisonnement, confiance, limites, statut initial `proposed`, date et version moteur.

## Liens de preuve

Un `TheoryEvidenceLink` relie une observation validee a un element theorique. La relation peut etre :

- supports ;
- contradicts ;
- enriches ;
- not-concerned.

Ces liens sont crees par validation utilisateur. Ils conservent les extraits sources et les limites.

## Contradictions et enrichissements

Une contradiction ne refute pas automatiquement un element. Elle signale une zone a examiner.

Un enrichissement ne modifie pas automatiquement la formulation theorique. Il cree une proposition que l'utilisateur peut accepter, modifier, rejeter ou differer.

## Predictions

Une prediction contient :

- formulation ;
- theorie source ;
- elements utilises ;
- contexte d'application ;
- resultat attendu ;
- criteres observables ;
- fenetre temporelle ;
- statut ;
- observations futures liees.

Une prediction n'est jamais affichee comme prophetie ou certitude.

## Temoignage reciproque

Le modele distingue temoin A, temoin B, temoignage, reponse, effets observes, contradiction, validation, rejet, silence, integration et transformation.

L'application ne deduit jamais automatiquement l'effet interieur d'une personne. Les effets sont classes comme directement formules, attribues par l'observateur, supposes ou confirmes dans le temps.

## Signature reflexive

La signature reflexive est un profil relationnel descriptif. Elle peut contenir temoignages associes, emotions documentees, contradictions recurrentes, themes reveles, formes de reponse, transformations liees et limites d'echantillon.

Elle ne produit jamais de niveau de conscience, valeur spirituelle, compatibilite absolue, destinee ou diagnostic psychologique.

## Souffrance

Le modele experimental separe intensite emotionnelle declaree, souffrance rapportee, resistance supposee, temoignage recu, reconnaissance formulee et transformation observable.

Formulation autorisee : "Une souffrance rapportee precede cette reconnaissance dans les observations disponibles."

Formulation interdite : "La souffrance a cause la reconnaissance."

## IA optionnelle

Si une cle OpenAI est configuree, l'IA peut proposer hypotheses, contradictions possibles, pistes et questions. Elle n'ecrit jamais la theorie. Le mode deterministe reste le mode par defaut.

## Limites methodologiques

Le laboratoire mesure un niveau de soutien observationnel, pas une verite. Toute conclusion reste conditionnee par les sources, l'echantillon, les validations utilisateur et les contradictions ouvertes.
