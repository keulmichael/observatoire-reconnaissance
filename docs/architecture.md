# Architecture

## Observatoire mondial

Le module mondial a deux modes independants.

```text
Mode 1 - Veille temps reel
RSS publics
  -> RealNewsCollectionService
  -> RssConnector
  -> NewsCollector
  -> DeduplicationEngine
  -> GlobalObservatory.refresh
  -> ReflexiveAnalyzer / StudySuggestionEngine
```

```text
Mode 2 - Import historique
Periode utilisateur
  -> HistoricalImportEngine
  -> HistoricalConnectorRegistry
  -> batch par date et source
  -> pagination / reprise / journal
  -> NewsCollector
  -> DeduplicationEngine
  -> evenements mondiaux traces
  -> ReflexiveAnalyzer
  -> suggestions d'etudes validees par l'utilisateur
  -> LearningEngine
```

## Pipeline historique

Les connecteurs retournent des `GlobalEventSource`. Le pipeline conserve toutes les sources, tous les extraits et toutes les references dans l'evenement fusionne.

```text
Sources
  -> Articles
  -> Normalisation
  -> Fusion
  -> Detection des doublons
  -> Evenements
  -> Analyse reflexive
  -> Suggestions d'etudes
  -> Apprentissage
```

## Scalabilite

L'import historique est execute par batch. Une session stocke :

- la periode ;
- les sources ;
- le curseur date/source ;
- la progression ;
- les compteurs ;
- les journaux ;
- les erreurs.

Cette structure permet d'interrompre et de reprendre sans relancer toute la periode. Les connecteurs reels devront ajouter leurs propres curseurs de pagination quand l'API source les fournit.

## Connecteurs prevus

- Presse mondiale : Reuters, Associated Press, BBC, France24, The Guardian, Al Jazeera, Deutsche Welle, NHK World.
- Bases d'evenements : GDELT, Event Registry, Wikinews, MediaStack, NewsAPI si archives disponibles.
- Organisations internationales : ONU, OMS, NASA, NOAA, Copernicus, USGS.
- Geopolitique et humanitaire : ACLED, ReliefWeb, OCHA.
- Economie : FMI, Banque Mondiale, OCDE.

Les limites dependent des licences, des quotas, de la disponibilite historique et des conditions d'utilisation de chaque source.
