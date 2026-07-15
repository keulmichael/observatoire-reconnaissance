# Mode Observation

## Philosophie

Le Mode Observation inverse le point d'entree de l'Observatoire de la Reconnaissance.

L'utilisateur ne construit plus directement les etats, les differences, les reconnaissances, Delta ou les trajectoires. Il raconte ce qu'il observe. L'application produit ensuite un brouillon de propositions, que l'utilisateur valide avant toute construction scientifique permanente.

Flux obligatoire :

```text
Texte brut
-> Analyse deterministe
-> Brouillon de propositions
-> Validation utilisateur
-> Construction scientifique
-> Execution des moteurs existants
```

Aucun objet scientifique permanent n'est cree avant validation explicite.

## Texte source

Le texte original est conserve strictement a l'identique dans `rawText`.

Le parseur ne corrige pas, ne reformule pas, ne resume pas, ne supprime pas de passage, ne modifie pas la ponctuation et ne remplace pas les termes de l'utilisateur. Les elements detectes restent separes du texte source.

## Brouillon de donnees

Le type `ObservationAnalysisDraft` contient :

- `rawText` ;
- `detectedPeople` ;
- `detectedManifestations` ;
- `detectedEmotions` ;
- `detectedCatalysts` ;
- `detectedConcepts` ;
- `chronology` ;
- `relationProposals` ;
- `confirmationQuestions` ;
- `analysisWarnings` ;
- `createdAt` ;
- `status`.

Chaque proposition conserve :

- un identifiant stable ;
- un extrait source ;
- un niveau de confiance ;
- un statut `proposed`, `accepted`, `edited` ou `rejected` ;
- une raison ;
- une provenance.

Les brouillons sont persistés dans `observationDrafts`, séparément des `studies`.

## Extracteurs

Les extracteurs sont deterministes et locaux :

- `ManifestationExtractor` detecte uniquement des evenements explicitement presents : presentation, message, discussion, rencontre, lecture, decision, declaration, evenement.
- `EmotionExtractor` distingue emotion exprimee directement, emotion attribuee par le narrateur et emotion supposee.
- `CatalystExtractor` propose des catalyseurs possibles sans conclure a une causalite.
- `ConceptExtractor` detecte des concepts ou termes thematiques explicitement presents.
- `ChronologyBuilder` distingue date explicite, date relative, ordre narratif et date inconnue.

Aucun appel IA, aucune API externe et aucun modele statistique ne sont utilises.

## Validation

Les propositions restent non validees par defaut. L'utilisateur peut les accepter, les modifier ou les rejeter.

Une proposition rejetee n'est pas integree a `Study`. Une proposition modifiee utilise la version validee par l'utilisateur.

Les personnes citees sont uniquement traitees comme entites textuelles. L'application n'attribue jamais automatiquement une intention, une croyance, un etat psychologique, une mission, une transformation ou une causalite.

## Construction scientifique

Apres validation, l'application peut construire des objets compatibles avec le modele existant :

- `Study` ;
- `Manifestation` ;
- `EmotionObservation` ;
- `Catalyst` ;
- `Relation` ;
- `TimelineEvent` ;
- `UnderstandingState`, seulement si un avant et un apres sont identifiables ;
- `Transition`, seulement si deux etats valides existent ;
- `Recognition`, seulement si une comprehension nouvelle est explicitement formulee.

Une emotion seule ne constitue jamais une reconnaissance. Une confusion seule ne constitue jamais une transition achevee.

`StateDifferenceEngine` et `DeltaEngine` ne sont executes que si deux `UnderstandingState` valides existent. Sinon l'application indique que les donnees sont insuffisantes.

## Temporalite, correlation et causalite

Une relation temporelle indique seulement qu'un element apparait avant un autre dans le recit ou dans les reperes temporels fournis.

Elle ne prouve pas une causalite.

Exemple de formulation autorisee :

```text
La presentation de la theorie precede l'etat rapporte et peut constituer un catalyseur possible.
```

Formulation interdite :

```text
La theorie a provoque la transformation.
```

## Limites sans IA

L'analyse repose sur des dictionnaires, des motifs textuels et l'ordre narratif. Elle peut manquer des formulations indirectes, produire des faux positifs lexicaux ou ne pas comprendre une nuance contextuelle.

Ces limites sont voulues : le systeme observe et propose, l'utilisateur confirme.

## Consentement et respect des personnes

Le Mode Observation respecte les regles ethiques existantes :

- ne pas observer une personne a son insu dans un cadre de recherche formel ;
- ne pas transformer une emotion en preuve ;
- ne pas imposer une interpretation ;
- distinguer faits, hypotheses et confirmations ;
- proteger les donnees personnelles ;
- demander le consentement pour toute etude portant sur une autre personne.

## Cas de demonstration

Texte :

```text
Hier, j'ai presente un nouveau cadre de reflexion a une personne. Aujourd'hui, elle m'a dit qu'elle se sentait perdue depuis la veille. Je ne connais pas encore la raison.
```

Faits ou propositions detectes :

- presentation d'un cadre de reflexion ;
- personne citee ;
- declaration ulterieure ;
- etat exprime : `perdue` ;
- ordre temporel : presentation puis declaration.

Hypotheses possibles :

- relation temporelle entre la presentation et la declaration ;
- catalyseur possible a confirmer.

Elements absents :

- aucune nouvelle comprehension formulee ;
- aucune decision documentee ;
- aucune transformation durable ;
- aucune reconnaissance confirmee ;
- aucun etat d'arrivee suffisamment defini.

Conclusion attendue :

```text
Variation ou perturbation possible observee, mais donnees insuffisantes pour construire une transition Delta complete.
```

## Mode Observation et Mode Expert

Le Journal d'Observation devient le premier ecran. La vue Suivi affiche l'etat methodologique courant.

Les vues existantes restent disponibles en Mode Expert : tableau de bord, etudes, etats, transitions Delta, carte reflexive, emotions, catalyseurs, reconnaissances, chronologie et analyse.
