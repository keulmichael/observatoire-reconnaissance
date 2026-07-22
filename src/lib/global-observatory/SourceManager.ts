import type { GlobalObservatoryState, GlobalSourceConnector } from "../types";

export class SourceManager {
  static defaultSources(): GlobalSourceConnector[] {
    return [
      {
        id: "source-bbc-world",
        name: "BBC World",
        type: "rss",
        enabled: true,
        endpoint: "https://feeds.bbci.co.uk/news/world/rss.xml",
        reliability: 0.72,
        countries: ["Monde"],
        categories: ["Politique", "Société", "Guerre", "Santé", "Environnement"],
        updateFrequencyMinutes: 120,
        notes: "Flux RSS public d'actualites mondiales."
      },
      {
        id: "source-france24",
        name: "France 24",
        type: "rss",
        enabled: true,
        endpoint: "https://www.france24.com/fr/rss",
        reliability: 0.74,
        countries: ["Monde", "France"],
        categories: ["Politique", "Société", "Économie", "Guerre", "Culture"],
        updateFrequencyMinutes: 120,
        notes: "Flux RSS public francophone."
      },
      {
        id: "source-guardian-world",
        name: "The Guardian World",
        type: "rss",
        enabled: true,
        endpoint: "https://www.theguardian.com/world/rss",
        reliability: 0.72,
        countries: ["Monde", "Royaume-Uni"],
        categories: ["Politique", "Société", "Guerre", "Environnement", "Justice"],
        updateFrequencyMinutes: 120,
        notes: "Flux RSS public d'actualites internationales."
      },
      {
        id: "source-scientific-publications",
        name: "Publications scientifiques",
        type: "scientific-publication",
        enabled: true,
        reliability: 0.86,
        countries: ["Monde"],
        categories: ["Science", "IA", "Santé", "Environnement", "Technologie"],
        updateFrequencyMinutes: 720,
        notes: "Connecteur pret pour revues, prepublications, rapports et bases bibliographiques."
      },
      {
        id: "source-official-documents",
        name: "Documents officiels",
        type: "official-document",
        enabled: true,
        reliability: 0.82,
        countries: ["Monde"],
        categories: ["Politique", "Justice", "Santé", "Éducation", "Environnement"],
        updateFrequencyMinutes: 720,
        notes: "Connecteur pret pour ONU, OMS, UNESCO et institutions publiques."
      },
      {
        id: "source-gdelt",
        name: "GDELT",
        type: "event-database",
        enabled: true,
        endpoint: "https://api.gdeltproject.org/api/v2/doc/doc",
        reliability: 0.78,
        countries: ["Monde"],
        categories: ["Politique", "Guerre", "Société", "Économie"],
        updateFrequencyMinutes: 1440,
        notes: "Base mondiale d'evenements et d'articles. Connecteur historique extensible."
      },
      {
        id: "source-reliefweb",
        name: "ReliefWeb / OCHA",
        type: "geopolitical-data",
        enabled: true,
        endpoint: "https://api.reliefweb.int/v1/reports",
        reliability: 0.86,
        countries: ["Monde"],
        categories: ["Guerre", "Santé", "Environnement", "Société"],
        updateFrequencyMinutes: 1440,
        notes: "Crises humanitaires, deplacements, catastrophes et rapports OCHA."
      },
      {
        id: "source-usgs",
        name: "USGS",
        type: "environmental-data",
        enabled: true,
        endpoint: "https://earthquake.usgs.gov/fdsnws/event/1/query",
        reliability: 0.9,
        countries: ["Monde"],
        categories: ["Environnement", "Science"],
        updateFrequencyMinutes: 1440,
        notes: "Evenements geophysiques historiques. Connecteur officiel extensible."
      },
      {
        id: "source-world-bank",
        name: "Banque Mondiale",
        type: "economic-data",
        enabled: true,
        endpoint: "https://api.worldbank.org/v2",
        reliability: 0.88,
        countries: ["Monde"],
        categories: ["Économie", "Éducation", "Santé", "Environnement"],
        updateFrequencyMinutes: 1440,
        notes: "Indicateurs economiques et sociaux sur longue periode."
      },
      {
        id: "source-news-archives",
        name: "Archives presse mondiale",
        type: "historical-api",
        enabled: true,
        reliability: 0.7,
        countries: ["Monde"],
        categories: ["Politique", "Société", "Économie", "Guerre", "Culture"],
        updateFrequencyMinutes: 1440,
        notes: "Famille de connecteurs pour Reuters, AP, BBC, France24, Guardian, Al Jazeera, DW, NHK, Event Registry, Wikinews, MediaStack et NewsAPI selon licences disponibles."
      }
    ];
  }

  static createInitialState(now = new Date().toISOString()): GlobalObservatoryState {
    return {
      sources: this.defaultSources(),
      events: [],
      learningSignals: [],
      mapPoints: [],
      dashboard: {
        analyzedEvents: 0,
        activeEvents: 0,
        createdStudies: 0,
        frequentCategories: [],
        representedCountries: [],
        emergingThemes: [],
        studiedPhenomena: [],
        topStudyEvents: [],
        trends: []
      },
      collectionLogs: [],
      historicalImports: [],
      lastCollectedAt: now
    };
  }

  static upsertSource(state: GlobalObservatoryState, source: GlobalSourceConnector): GlobalObservatoryState {
    const exists = state.sources.some((item) => item.id === source.id);
    return {
      ...state,
      sources: exists
        ? state.sources.map((item) => (item.id === source.id ? source : item))
        : [source, ...state.sources]
    };
  }

  static setEnabled(state: GlobalObservatoryState, sourceId: string, enabled: boolean): GlobalObservatoryState {
    return {
      ...state,
      sources: state.sources.map((source) => (source.id === sourceId ? { ...source, enabled } : source))
    };
  }
}
