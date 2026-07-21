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
