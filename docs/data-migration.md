# Migration des donnees

Le format local utilise `schemaVersion: 2`.

Au chargement, `migrateObservatoryData` complete les anciennes donnees sans suppression :

- `observations` ;
- `openQuestions` ;
- `structuredHistory` ;
- `relationProposals` ;
- `deltaScores`.

Les anciennes etudes sont conservees. Les anciens brouillons sont conserves dans `observationDrafts`.

Si une donnee ancienne ne peut pas etre convertie automatiquement, elle reste dans son champ d'origine et peut etre exportee.

