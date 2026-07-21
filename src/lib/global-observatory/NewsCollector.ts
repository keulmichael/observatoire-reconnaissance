import type { GlobalCollectionLog, GlobalEventSource, GlobalObservedEvent, GlobalObservatoryState } from "../types";
import { DeduplicationEngine } from "./DeduplicationEngine";
import { NewsClassifier } from "./NewsClassifier";
import { Normalization } from "./Normalization";
import { stableId, unique } from "./utils";

export interface CollectionInput {
  sources?: GlobalEventSource[];
  now?: string;
  mode?: GlobalCollectionLog["mode"];
  failures?: GlobalCollectionLog["sourcesFailed"];
}

export class NewsCollector {
  static collect(state: GlobalObservatoryState, input: CollectionInput = {}): GlobalObservatoryState {
    const now = input.now ?? new Date().toISOString();
    const configuredSources = state.sources.filter((source) => source.enabled);
    const incoming = input.sources?.length ? input.sources : this.sampleSources(now);
    const allowed = incoming.map((source) => Normalization.source(source)).filter((source) =>
      configuredSources.some((connector) => connector.id === source.connectorId)
    );
    const initialCount = state.events.length;
    const result = allowed.reduce(
      (current, source) => this.integrateSource(current.events, source, now, current.log),
      {
        events: state.events,
        log: {
          id: stableId("collection", `${now}-${allowed.map((source) => source.id).join("-")}`),
          startedAt: now,
          completedAt: now,
          sourcesRequested: configuredSources.map((source) => source.id),
          sourcesSucceeded: unique(allowed.map((source) => source.connectorId)),
          sourcesFailed: input.failures ?? [],
          articlesFetched: allowed.length,
          newEvents: 0,
          duplicateArticles: 0,
          mergedArticles: 0,
          ambiguousMerges: 0,
          mode: input.mode ?? "manual"
        } satisfies GlobalCollectionLog
      }
    );
    const events = result.events;
    const log = {
      ...result.log,
      completedAt: new Date().toISOString(),
      newEvents: Math.max(result.log.newEvents, events.length - initialCount)
    };

    return {
      ...state,
      events,
      sources: state.sources.map((source) =>
        source.enabled ? { ...source, lastCollectedAt: now } : source
      ),
      collectionLogs: [log, ...(state.collectionLogs ?? [])].slice(0, 50),
      lastCollectedAt: now
    };
  }

  static integrateSource(
    events: GlobalObservedEvent[],
    source: GlobalEventSource,
    now: string,
    log?: GlobalCollectionLog
  ): { events: GlobalObservedEvent[]; log: GlobalCollectionLog } {
    const currentLog = log ?? {
      id: stableId("collection", `${now}-${source.id}`),
      startedAt: now,
      completedAt: now,
      sourcesRequested: [source.connectorId],
      sourcesSucceeded: [source.connectorId],
      sourcesFailed: [],
      articlesFetched: 1,
      newEvents: 0,
      duplicateArticles: 0,
      mergedArticles: 0,
      ambiguousMerges: 0,
      mode: "manual"
    };
    const decision = DeduplicationEngine.decide(events, source);
    if (decision.kind === "duplicate-article") {
      return { events, log: { ...currentLog, duplicateArticles: currentLog.duplicateArticles + 1 } };
    }
    if (decision.kind === "same-event-auto") {
      return {
        events: events.map((event) =>
          event.id === decision.event.id
          ? {
              ...event,
              summary: event.summary.length >= source.summary.length ? event.summary : source.summary,
              updatedAt: now,
              categories: unique([...event.categories, ...NewsClassifier.classify(source)]),
              themes: unique([...event.themes, ...NewsClassifier.themes(source)]).slice(0, 12),
              sourceIds: [...event.sourceIds, source.id],
              sources: [...event.sources, source],
              mergeCandidates: [
                ...event.mergeCandidates,
                {
                  eventId: event.id,
                  confidence: decision.confidence,
                  reason: decision.reason,
                  status: "auto-fusion"
                }
              ]
            }
          : event
        ),
        log: { ...currentLog, mergedArticles: currentLog.mergedArticles + 1 }
      };
    }

    const mergeCandidates = decision.kind === "same-event-review"
      ? [{
          eventId: decision.event.id,
          confidence: decision.confidence,
          reason: decision.reason,
          status: "validation-requise" as const
        }]
      : [];

    return {
      events: [this.eventFromSource(source, now, mergeCandidates), ...events],
      log: {
        ...currentLog,
        newEvents: currentLog.newEvents + 1,
        ambiguousMerges: currentLog.ambiguousMerges + (mergeCandidates.length ? 1 : 0)
      }
    };
  }

  private static eventFromSource(
    source: GlobalEventSource,
    now: string,
    mergeCandidates: GlobalObservedEvent["mergeCandidates"]
  ): GlobalObservedEvent {
    return {
      id: stableId("event", `${source.publishedAt.slice(0, 10)}-${source.country ?? "monde"}-${source.title}`),
      title: source.title,
      normalizedTitle: source.title.toLowerCase(),
      summary: source.summary,
      country: source.country,
      startedAt: source.publishedAt.slice(0, 10),
      updatedAt: now,
      status: "active",
      categories: NewsClassifier.classify(source),
      themes: NewsClassifier.themes(source),
      sourceIds: [source.id],
      sources: [source],
      mergeCandidates,
      learningWeight: 0,
      createdStudyIds: []
    };
  }

  private static sampleSources(now: string): GlobalEventSource[] {
    return [
      {
        id: stableId("source-item", "coalition-education-ai"),
        connectorId: "source-bbc-world",
        connectorName: "BBC World",
        title: "Coalition internationale pour encadrer l'IA dans l'education",
        publishedAt: now,
        country: "Monde",
        language: "fr",
        summary: "Plusieurs institutions annoncent un cadre commun pour l'usage de systemes d'IA dans les etablissements scolaires.",
        authors: [],
        excerpts: [
          {
            id: stableId("excerpt", "ia education institutions cadre commun"),
            text: "Les institutions disent vouloir proteger l'autonomie pedagogique tout en integrant des outils d'IA.",
            location: "resume collecteur",
            claimIds: []
          }
        ],
        collectedAt: now
      },
      {
        id: stableId("source-item", "deplacement-population-frontiere"),
        connectorId: "source-france24",
        connectorName: "France 24",
        title: "Deplacement massif de population apres une crise frontaliere",
        publishedAt: now,
        country: "Monde",
        language: "fr",
        summary: "Un rapport institutionnel documente des mouvements de population, des tensions d'accueil et des conflits de representation entre groupes.",
        authors: [],
        excerpts: [
          {
            id: stableId("excerpt", "deplacement accueil conflits representation"),
            text: "Le rapport decrit des tensions entre securite, accueil et reconnaissance des personnes deplacees.",
            location: "resume collecteur",
            claimIds: []
          }
        ],
        collectedAt: now
      },
      {
        id: stableId("source-item", "publication-sante-confiance"),
        connectorId: "source-guardian-world",
        connectorName: "The Guardian World",
        title: "Etude sur la confiance publique face aux recommandations sanitaires",
        publishedAt: now,
        country: "Monde",
        language: "fr",
        summary: "Une publication analyse comment la confiance envers les institutions influence l'adhesion aux recommandations de sante.",
        authors: [],
        excerpts: [
          {
            id: stableId("excerpt", "confiance institutions recommandations sante"),
            text: "Les auteurs associent l'adhesion aux recommandations a la perception de legitimite institutionnelle.",
            location: "resume collecteur",
            claimIds: []
          }
        ],
        collectedAt: now
      }
    ];
  }
}
