# Modele de tracabilite

`ObservationRecord` est la source permanente de tracabilite.

Chaque objet scientifique genere peut porter :

- `sourceObservationIds` ;
- `sourceExcerpt` ;
- `validatedProposalIds` ;
- `engineProvenance` ;
- `createdFromObservationAt` ;
- `confidence` ;
- `methodologicalStatus`.

Objets concernes :

- manifestations ;
- emotions ;
- catalyseurs ;
- relations ;
- etats ;
- transitions ;
- reconnaissances ;
- evenements de chronologie ;
- Delta persistant.

Delta est persiste dans `PersistentDeltaScore`, lie a une transition et aux observations sources.

