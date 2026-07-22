import type {
  GlobalEventCategory,
  GlobalEventSource,
  GlobalObservatoryState,
  GlobalSourceConnector,
  HistoricalImportLogEntry,
  HistoricalImportRequest,
  HistoricalImportSession,
  HistoricalObservatoryStatistics,
  HistoricalSearchFilters
} from "../types";
import { NewsCollector } from "./NewsCollector";
import { NewsClassifier } from "./NewsClassifier";
import { Normalization } from "./Normalization";
import { SourceManager } from "./SourceManager";
import { stableId } from "./utils";

export interface HistoricalConnector {
  readonly id: string;
  fetchPage(input: HistoricalConnectorInput): Promise<HistoricalConnectorPage>;
}

export interface HistoricalConnectorInput {
  connector: GlobalSourceConnector;
  date: string;
  cursor?: string;
  limit: number;
  now: string;
}

export interface HistoricalConnectorPage {
  articles: GlobalEventSource[];
  nextCursor?: string;
  error?: string;
}

export type HistoricalConnectorRegistry = Record<string, HistoricalConnector>;

export class HistoricalImportEngine {
  static createSession(request: HistoricalImportRequest, now = new Date().toISOString()): HistoricalImportSession {
    const normalized = normalizeRequest(request);
    const totalDays = daysBetween(normalized.range.startDate, normalized.range.endDate) + 1;
    return {
      id: stableId("historical-import", `${normalized.range.startDate}-${normalized.range.endDate}-${normalized.sourceIds.join("-")}-${now}`),
      status: "planned",
      request: normalized,
      progress: {
        cursorDate: normalized.range.startDate,
        cursorSourceIndex: 0,
        processedDays: 0,
        totalDays,
        processedSources: 0,
        totalSources: normalized.sourceIds.length,
        articlesFetched: 0,
        eventsCreated: 0,
        mergedArticles: 0,
        duplicateArticles: 0,
        errors: 0,
        percent: 0,
        estimatedRemainingMs: 0
      },
      startedAt: now,
      updatedAt: now,
      logs: [log("info", `Import historique planifie du ${normalized.range.startDate} au ${normalized.range.endDate}.`, now)]
    };
  }

  static pause(state: GlobalObservatoryState, sessionId: string, now = new Date().toISOString()): GlobalObservatoryState {
    return this.updateSession(state, sessionId, (session) => ({
      ...session,
      status: session.status === "completed" ? session.status : "paused",
      updatedAt: now,
      logs: [log("warning", "Import interrompu par l'utilisateur.", now), ...session.logs]
    }));
  }

  static async runNextBatch(
    state: GlobalObservatoryState,
    input: {
      request?: HistoricalImportRequest;
      sessionId?: string;
      registry?: HistoricalConnectorRegistry;
      now?: string;
    }
  ): Promise<{ state: GlobalObservatoryState; session: HistoricalImportSession }> {
    const now = input.now ?? new Date().toISOString();
    const registry = input.registry ?? defaultHistoricalConnectorRegistry();
    const initialState = ensureHistoricalState(state);
    const session = input.sessionId
      ? findSession(initialState, input.sessionId)
      : this.createSession(input.request ?? defaultRequest(now), now);
    if (!session) throw new Error("Session d'import historique introuvable.");
    if (session.status === "completed") return { state: initialState, session };

    const sources = initialState.sources.filter((source) => session.request.sourceIds.includes(source.id));
    const startedEvents = initialState.events.length;
    const batchPlan = nextBatchPlan(session, sources);
    let nextState = upsertSession(initialState, { ...session, status: "running", updatedAt: now });
    let nextSession = findSession(nextState, session.id) ?? session;

    for (const item of batchPlan) {
      const connector = registry[item.source.type] ?? registry[item.source.id] ?? registry.mock;
      const result = await connector.fetchPage({
        connector: item.source,
        date: item.date,
        limit: session.request.batchSize,
        now
      });
      if (result.error) {
        nextSession = advanceSession(nextSession, item, {
          errors: 1,
          logs: [log("error", result.error, now, item.source.id, item.date)]
        });
        continue;
      }
      const before = nextState.events.length;
      nextState = NewsCollector.collect(nextState, {
        sources: result.articles,
        now,
        mode: "historical"
      });
      const latestLog = nextState.collectionLogs[0];
      nextSession = advanceSession(nextSession, item, {
        articlesFetched: result.articles.length,
        eventsCreated: Math.max(0, nextState.events.length - before),
        mergedArticles: latestLog?.mergedArticles ?? 0,
        duplicateArticles: latestLog?.duplicateArticles ?? 0,
        logs: [log("info", `${result.articles.length} article(s) importes depuis ${item.source.name}.`, now, item.source.id, item.date)]
      });
      if (session.request.maxArticles && nextSession.progress.articlesFetched >= session.request.maxArticles) break;
    }

    nextSession = finalizeProgress(nextSession, now);
    if (nextSession.progress.percent >= 100 || batchPlan.length === 0 || reachedArticleLimit(nextSession)) {
      nextSession = {
        ...nextSession,
        status: "completed",
        completedAt: now,
        logs: [log("info", `Import termine: ${nextState.events.length - startedEvents} nouvel evenement net dans ce batch.`, now), ...nextSession.logs]
      };
    }
    nextState = upsertSession(nextState, nextSession);
    return { state: nextState, session: nextSession };
  }

  static statistics(state: GlobalObservatoryState): HistoricalObservatoryStatistics {
    const events = state.events;
    return {
      eventsByMonth: count(events.map((event) => event.startedAt.slice(0, 7))),
      eventsByCountry: count(events.map((event) => event.country ?? "Monde")),
      eventsByCategory: count(events.flatMap((event) => event.categories)),
      eventsBySource: count(events.flatMap((event) => event.sources.map((source) => source.connectorName))),
      eventsByTheme: count(events.flatMap((event) => event.themes)),
      eventsByConfidence: count(events.map((event) => confidenceBucket(event.interest?.score ?? 0)))
    };
  }

  static search(state: GlobalObservatoryState, filters: HistoricalSearchFilters) {
    const query = normalize(filters.query);
    return state.events.filter((event) => {
      const text = normalize(`${event.title} ${event.summary} ${event.themes.join(" ")} ${event.sources.map((source) => source.summary).join(" ")}`);
      const startedAt = event.startedAt.slice(0, 10);
      return (!query || text.includes(query))
        && (filters.country === "all" || (event.country ?? "Monde") === filters.country)
        && (filters.category === "all" || event.categories.includes(filters.category as GlobalEventCategory))
        && (filters.sourceId === "all" || event.sources.some((source) => source.connectorId === filters.sourceId))
        && (filters.importance === "all" || event.interest?.level === filters.importance)
        && (filters.confidence === "all" || confidenceBucket(event.interest?.score ?? 0) === filters.confidence)
        && (!filters.startDate || startedAt >= filters.startDate)
        && (!filters.endDate || startedAt <= filters.endDate);
    });
  }

  private static updateSession(
    state: GlobalObservatoryState,
    sessionId: string,
    update: (session: HistoricalImportSession) => HistoricalImportSession
  ) {
    return {
      ...state,
      historicalImports: (state.historicalImports ?? []).map((session) => (session.id === sessionId ? update(session) : session))
    };
  }
}

export function defaultHistoricalConnectorRegistry(): HistoricalConnectorRegistry {
  const mock = new DeterministicHistoricalConnector();
  return {
    mock,
    rss: mock,
    "event-database": mock,
    "international-organization": mock,
    "geopolitical-data": mock,
    "economic-data": mock,
    "environmental-data": mock,
    "historical-api": mock,
    api: mock,
    web: mock,
    "official-document": mock
  };
}

export class DeterministicHistoricalConnector implements HistoricalConnector {
  readonly id = "mock";

  async fetchPage(input: HistoricalConnectorInput): Promise<HistoricalConnectorPage> {
    const categories = input.connector.categories.length ? input.connector.categories : ["Science"];
    const articles = Array.from({ length: Math.min(input.limit, 3) }, (_, index) => {
      const category = categories[index % categories.length];
      const country = input.connector.countries[index % input.connector.countries.length] ?? "Monde";
      const title = `${input.connector.name} - ${category} observe le ${input.date}`;
      const summary = `Signal historique ${category.toLowerCase()} documente par ${input.connector.name} pour ${country}.`;
      return Normalization.source({
        id: stableId("historical-article", `${input.connector.id}-${input.date}-${index}`),
        externalId: `${input.connector.id}:${input.date}:${index}`,
        connectorId: input.connector.id,
        connectorName: input.connector.name,
        title,
        url: input.connector.endpoint ? `${input.connector.endpoint}#${input.date}-${index}` : undefined,
        publishedAt: `${input.date}T12:00:00.000Z`,
        country,
        language: "fr",
        summary,
        authors: [],
        excerpts: [{
          id: stableId("historical-excerpt", `${input.connector.id}-${input.date}-${index}-${summary}`),
          text: summary,
          location: "historical:synthetic-page",
          claimIds: []
        }],
        collectedAt: input.now,
        categories: NewsClassifier.classify({ title, summary, categories: [category] } as GlobalEventSource)
      });
    });
    return { articles };
  }
}

function ensureHistoricalState(state: GlobalObservatoryState): GlobalObservatoryState {
  const base = state.sources.length ? state : SourceManager.createInitialState();
  return {
    ...base,
    historicalImports: base.historicalImports ?? []
  };
}

function normalizeRequest(request: HistoricalImportRequest): HistoricalImportRequest {
  const startDate = request.range.startDate <= request.range.endDate ? request.range.startDate : request.range.endDate;
  const endDate = request.range.endDate >= request.range.startDate ? request.range.endDate : request.range.startDate;
  return {
    ...request,
    range: { ...request.range, startDate, endDate },
    sourceIds: request.sourceIds.length ? request.sourceIds : SourceManager.defaultSources().map((source) => source.id),
    batchSize: Math.max(1, Math.min(50, Math.round(request.batchSize || 10)))
  };
}

function defaultRequest(now: string): HistoricalImportRequest {
  const date = now.slice(0, 10);
  return {
    range: { granularity: "day", startDate: date, endDate: date },
    sourceIds: SourceManager.defaultSources().slice(0, 2).map((source) => source.id),
    batchSize: 10
  };
}

function findSession(state: GlobalObservatoryState, sessionId: string) {
  return (state.historicalImports ?? []).find((session) => session.id === sessionId);
}

function upsertSession(state: GlobalObservatoryState, session: HistoricalImportSession): GlobalObservatoryState {
  const sessions = state.historicalImports ?? [];
  const exists = sessions.some((item) => item.id === session.id);
  return {
    ...state,
    historicalImports: exists
      ? sessions.map((item) => (item.id === session.id ? session : item))
      : [session, ...sessions]
  };
}

function nextBatchPlan(session: HistoricalImportSession, sources: GlobalSourceConnector[]) {
  const plan: Array<{ date: string; source: GlobalSourceConnector; sourceIndex: number }> = [];
  let date = session.progress.cursorDate;
  let sourceIndex = session.progress.cursorSourceIndex;
  const maxSteps = Math.max(1, Math.ceil(session.request.batchSize / 3));
  while (plan.length < maxSteps && date <= session.request.range.endDate) {
    const source = sources[sourceIndex];
    if (source) plan.push({ date, source, sourceIndex });
    sourceIndex += 1;
    if (sourceIndex >= sources.length) {
      sourceIndex = 0;
      date = addDays(date, 1);
    }
  }
  return plan;
}

function advanceSession(
  session: HistoricalImportSession,
  item: { date: string; sourceIndex: number },
  delta: {
    articlesFetched?: number;
    eventsCreated?: number;
    mergedArticles?: number;
    duplicateArticles?: number;
    errors?: number;
    logs?: HistoricalImportLogEntry[];
  }
): HistoricalImportSession {
  const sourceIndex = item.sourceIndex + 1 >= session.progress.totalSources ? 0 : item.sourceIndex + 1;
  const cursorDate = sourceIndex === 0 ? addDays(item.date, 1) : item.date;
  return {
    ...session,
    progress: {
      ...session.progress,
      cursorDate,
      cursorSourceIndex: sourceIndex,
      processedSources: session.progress.processedSources + 1,
      processedDays: Math.min(session.progress.totalDays, daysBetween(session.request.range.startDate, cursorDate)),
      articlesFetched: session.progress.articlesFetched + (delta.articlesFetched ?? 0),
      eventsCreated: session.progress.eventsCreated + (delta.eventsCreated ?? 0),
      mergedArticles: session.progress.mergedArticles + (delta.mergedArticles ?? 0),
      duplicateArticles: session.progress.duplicateArticles + (delta.duplicateArticles ?? 0),
      errors: session.progress.errors + (delta.errors ?? 0)
    },
    logs: [...(delta.logs ?? []), ...session.logs].slice(0, 200)
  };
}

function finalizeProgress(session: HistoricalImportSession, now: string): HistoricalImportSession {
  const totalSteps = Math.max(1, session.progress.totalDays * session.progress.totalSources);
  const processedSteps = Math.min(totalSteps, session.progress.processedSources);
  const percent = Math.min(100, Math.round((processedSteps / totalSteps) * 100));
  const elapsed = Math.max(1, new Date(now).getTime() - new Date(session.startedAt).getTime());
  const remainingSteps = Math.max(0, totalSteps - processedSteps);
  return {
    ...session,
    status: "running",
    updatedAt: now,
    progress: {
      ...session.progress,
      percent,
      estimatedRemainingMs: Math.round((elapsed / Math.max(1, processedSteps)) * remainingSteps)
    }
  };
}

function reachedArticleLimit(session: HistoricalImportSession) {
  return Boolean(session.request.maxArticles && session.progress.articlesFetched >= session.request.maxArticles);
}

function log(level: HistoricalImportLogEntry["level"], message: string, at: string, sourceId?: string, date?: string): HistoricalImportLogEntry {
  return {
    id: stableId("historical-log", `${at}-${level}-${message}-${sourceId ?? ""}-${date ?? ""}`),
    at,
    level,
    message,
    sourceId,
    date
  };
}

function count(items: string[]) {
  const totals = new Map<string, number>();
  items.filter(Boolean).forEach((item) => totals.set(item, (totals.get(item) ?? 0) + 1));
  return [...totals.entries()].map(([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value);
}

function confidenceBucket(score: number) {
  if (score >= 0.75) return "Confiance elevee";
  if (score >= 0.45) return "Confiance moyenne";
  return "Confiance faible";
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function daysBetween(startDate: string, endDate: string) {
  return Math.max(0, Math.round((dateOnly(endDate).getTime() - dateOnly(startDate).getTime()) / 86_400_000));
}

function addDays(date: string, days: number) {
  const next = dateOnly(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function dateOnly(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}
