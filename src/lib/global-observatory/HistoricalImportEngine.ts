import type {
  GlobalEventCategory,
  GlobalEventSource,
  GlobalObservatoryState,
  GlobalSourceConnector,
  HistoricalImportLogEntry,
  HistoricalImportRequest,
  HistoricalImportSession,
  HistoricalImportProgress,
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
  logs?: HistoricalImportLogEntry[];
  coverage?: HistoricalCoverageUpdate;
}

export type HistoricalConnectorRegistry = Record<string, HistoricalConnector>;

type HistoricalCoverageUpdate = {
  completeCoverage: boolean;
  truncatedWindows?: string[];
  subdividedWindows?: number;
  estimatedCoverageLevel?: HistoricalImportProgress["estimatedCoverageLevel"];
  maxRecordsPerCall?: number;
  windows?: NonNullable<HistoricalImportProgress["coverageWindows"]>;
};

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
        estimatedRemainingMs: 0,
        completeCoverage: true,
        truncatedWindows: [],
        subdividedWindows: 0,
        estimatedCoverageLevel: "complete",
        coverageWindows: []
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
      const cursorKey = cursorKeyFor(item.source.id, item.date);
      const connector = registry[item.source.id] ?? registry[item.source.type] ?? registry.mock;
      const result = await connector.fetchPage({
        connector: item.source,
        date: item.date,
        cursor: nextSession.progress.sourceCursors?.[cursorKey],
        limit: remainingArticleLimit(nextSession),
        now
      });
      if (result.error) {
        nextSession = advanceSession(nextSession, item, {
          errors: 1,
          logs: [log("error", result.error, now, item.source.id, item.date), ...(result.logs ?? [])]
        });
        continue;
      }
      const before = nextState.events.length;
      nextState = NewsCollector.collect(nextState, {
        sources: result.articles.map((article) => ({
          ...article,
          collectionMode: "historical",
          provenance: {
            ...article.provenance,
            kind: article.provenance?.kind ?? "unknown",
            connector: article.provenance?.connector ?? item.source.id,
            importSessionId: nextSession.id
          }
        })),
        now,
        mode: "historical"
      });
      const latestLog = nextState.collectionLogs[0];
      nextSession = advanceSession(nextSession, item, {
        articlesFetched: result.articles.length,
        eventsCreated: Math.max(0, nextState.events.length - before),
        mergedArticles: latestLog?.mergedArticles ?? 0,
        duplicateArticles: latestLog?.duplicateArticles ?? 0,
        logs: [
          log("info", `${result.articles.length} article(s) importes depuis ${item.source.name}.`, now, item.source.id, item.date),
          ...(result.logs ?? [])
        ],
        sourceCursor: { key: cursorKey, value: result.nextCursor },
        keepCursorPosition: Boolean(result.nextCursor),
        coverage: result.coverage
      });
      if (session.request.maxArticles && nextSession.progress.articlesFetched >= session.request.maxArticles) break;
    }

    nextSession = finalizeProgress(nextSession, now);
    if (reachedArticleLimit(nextSession) && nextSession.progress.percent < 100) {
      nextSession = markCoverageLimitedByArticleCap(nextSession, now);
    }
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
  const gdelt = new GdeltHistoricalConnector();
  return {
    mock,
    "source-gdelt": gdelt,
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

type GdeltArticle = {
  url?: string;
  url_mobile?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
};

type GdeltWindow = {
  start: string;
  end: string;
  levelMinutes: number;
};

type GdeltCursor = {
  version: 1;
  pending: GdeltWindow[];
  completed: string[];
  truncated: string[];
  subdivided: number;
  advanceCursor?: string;
};

const GDELT_MAX_RECORDS = 250;
const GDELT_LEVEL_MINUTES = [360, 180, 90, 45, 15] as const;

export class GdeltHistoricalConnector implements HistoricalConnector {
  readonly id = "source-gdelt";
  private readonly endpoint = "https://api.gdeltproject.org/api/v2/doc/doc";
  private readonly intervalHours = 6;
  private readonly minDelayMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastCallAt = 0;

  constructor(options: {
    minDelayMs?: number;
    maxRetries?: number;
    fetchImpl?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
  } = {}) {
    this.minDelayMs = options.minDelayMs ?? 12000;
    this.maxRetries = options.maxRetries ?? 3;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async fetchPage(input: HistoricalConnectorInput): Promise<HistoricalConnectorPage> {
    const cursor = gdeltCursorFrom(input.date, input.cursor, this.intervalHours);
    const interval = cursor.pending.shift();
    if (!interval) {
      return { articles: [], nextCursor: cursor.advanceCursor };
    }
    const maxRecords = GDELT_MAX_RECORDS;
    const url = new URL(this.endpoint);
    url.searchParams.set("query", "(recognition OR protest OR conflict OR government OR climate OR health OR education OR economy)");
    url.searchParams.set("mode", "artlist");
    url.searchParams.set("format", "json");
    url.searchParams.set("sort", "datedesc");
    url.searchParams.set("maxrecords", String(maxRecords));
    url.searchParams.set("startdatetime", gdeltDateTime(new Date(interval.start)));
    url.searchParams.set("enddatetime", gdeltDateTime(new Date(interval.end)));

    const requestedUrl = url.toString();
    const startedAt = Date.now();
    const logs: HistoricalImportLogEntry[] = [];
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      await this.rateLimit();
      try {
        const response = await this.fetchImpl(requestedUrl, {
          headers: { "user-agent": "observatoire-reconnaissance/0.1 historical-import" },
          cache: "no-store"
        });
        if (response.status === 429 && attempt < this.maxRetries) {
          const retryAfter = retryAfterMs(response.headers.get("retry-after")) ?? Math.min(120_000, this.minDelayMs * (attempt + 2));
          logs.push(log("warning", `GET ${safeUrl(requestedUrl)} -> 429, retry dans ${retryAfter} ms.`, input.now, input.connector.id, input.date));
          await this.sleep(retryAfter);
          continue;
        }
        if (!response.ok) {
          return {
            articles: [],
            error: `GDELT HTTP ${response.status} pour ${interval.start} - ${interval.end}.`,
            logs: [...logs, log("error", `GET ${safeUrl(requestedUrl)} -> ${response.status}`, input.now, input.connector.id, input.date)]
          };
        }
        const payload = (await response.json()) as { articles?: GdeltArticle[] };
        const raw = payload.articles ?? [];
        const received = raw.filter((article) =>
          parseGdeltSeenDate(article.seendate, input.date).slice(0, 10) === input.date
        );
        const saturated = raw.length >= maxRecords;
        if (saturated && interval.levelMinutes > 15) {
          const children = splitGdeltWindow(interval);
          cursor.pending.unshift(...children);
          cursor.subdivided += 1;
          const coverage = gdeltCoverage(input.connector.id, interval, raw.length, maxRecords, "subdivided", cursor);
          return {
            articles: received.map((article, index) => this.toSource(article, input, requestedUrl, index)),
            nextCursor: encodeGdeltCursor(cursor),
            coverage,
            logs: [
              ...logs,
              log("warning", `GET ${safeUrl(requestedUrl)} -> HTTP ${response.status}, limite ${raw.length}/${maxRecords} atteinte; fenetre subdivisee en ${children.length} sous-fenetres.`, input.now, input.connector.id, input.date)
            ]
          };
        }
        const status = saturated ? "truncated" : "complete";
        const windowKey = gdeltWindowKey(interval);
        if (saturated) cursor.truncated.push(windowKey);
        else cursor.completed.push(windowKey);
        const nextCursor = cursor.pending.length ? encodeGdeltCursor(cursor) : cursor.advanceCursor;
        return {
          articles: received.map((article, index) => this.toSource(article, input, requestedUrl, index)),
          nextCursor,
          coverage: gdeltCoverage(input.connector.id, interval, raw.length, maxRecords, status, cursor),
          logs: [
            ...logs,
            log("info", `GET ${safeUrl(requestedUrl)} -> HTTP ${response.status}, ${raw.length} recu(s), ${received.length} retenu(s) en ${Date.now() - startedAt} ms.`, input.now, input.connector.id, input.date)
          ]
        };
      } catch (error) {
        if (attempt < this.maxRetries) {
          const wait = Math.min(120_000, this.minDelayMs * (attempt + 2));
          logs.push(log("warning", `GET ${safeUrl(requestedUrl)} -> erreur reseau, retry dans ${wait} ms.`, input.now, input.connector.id, input.date));
          await this.sleep(wait);
          continue;
        }
        return {
          articles: [],
          error: `Appel GDELT impossible: ${error instanceof Error ? error.message : "erreur reseau"}.`,
          logs: [...logs, log("error", `GET ${safeUrl(requestedUrl)} -> erreur reseau`, input.now, input.connector.id, input.date)]
        };
      }
    }
    return { articles: [], error: "Tentatives GDELT epuisees.", logs };
  }

  private async rateLimit() {
    const wait = Math.max(0, this.minDelayMs - (Date.now() - this.lastCallAt));
    if (wait > 0) await this.sleep(wait);
    this.lastCallAt = Date.now();
  }

  private toSource(article: GdeltArticle, input: HistoricalConnectorInput, requestedUrl: string, index: number): GlobalEventSource {
    const canonicalUrl = Normalization.canonicalUrl(article.url ?? article.url_mobile);
    const publishedAt = parseGdeltSeenDate(article.seendate, input.date);
    const title = article.title?.trim() || `Article GDELT ${input.date}`;
    const summary = `Article indexe par GDELT depuis ${article.domain ?? input.connector.name}.`;
    const externalSeed = canonicalUrl ?? `${input.connector.id}:${input.date}:${article.seendate ?? index}`;
    return Normalization.source({
      id: stableId("gdelt-article", externalSeed),
      externalId: stableId("gdelt-external", externalSeed),
      connectorId: input.connector.id,
      connectorName: input.connector.name,
      title,
      url: canonicalUrl,
      publishedAt,
      country: normalizeCountry(article.sourcecountry),
      language: article.language || "unknown",
      summary,
      authors: [],
      excerpts: [{
        id: stableId("gdelt-excerpt", `${externalSeed}-${summary}`),
        text: summary,
        location: "gdelt:doc-artlist",
        claimIds: []
      }],
      collectedAt: input.now,
      categories: NewsClassifier.classify({ title, summary, categories: input.connector.categories } as GlobalEventSource),
      collectionMode: "historical",
      provenance: {
        kind: "real",
        connector: input.connector.id,
        endpoint: this.endpoint,
        requestedUrl: safeUrl(requestedUrl),
        originalUrl: canonicalUrl,
        markers: ["gdelt-doc-api", "http-fetch"]
      }
    });
  }
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
        categories: NewsClassifier.classify({ title, summary, categories: [category] } as GlobalEventSource),
        collectionMode: "historical",
        provenance: {
          kind: "simulated",
          connector: input.connector.id,
          endpoint: input.connector.endpoint,
          originalUrl: input.connector.endpoint ? `${input.connector.endpoint}#${input.date}-${index}` : undefined,
          markers: ["deterministic", "mock", "synthetic-page"]
        }
      });
    });
    return {
      articles,
      logs: [log("warning", `${articles.length} article(s) generes artificiellement par le connecteur deterministe.`, input.now, input.connector.id, input.date)]
    };
  }
}

function ensureHistoricalState(state: GlobalObservatoryState): GlobalObservatoryState {
  const base = state.sources.length ? state : SourceManager.createInitialState();
  const existingSourceIds = new Set(base.sources.map((source) => source.id));
  const missingDefaultSources = SourceManager.defaultSources().filter((source) => !existingSourceIds.has(source.id));
  return {
    ...base,
    sources: [...base.sources, ...missingDefaultSources],
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
    sourceCursor?: { key: string; value?: string };
    keepCursorPosition?: boolean;
    coverage?: HistoricalCoverageUpdate;
  }
): HistoricalImportSession {
  const sourceIndex = delta.keepCursorPosition ? item.sourceIndex : item.sourceIndex + 1 >= session.progress.totalSources ? 0 : item.sourceIndex + 1;
  const cursorDate = delta.keepCursorPosition ? item.date : sourceIndex === 0 ? addDays(item.date, 1) : item.date;
  const sourceCursors = { ...(session.progress.sourceCursors ?? {}) };
  if (delta.sourceCursor) {
    if (delta.sourceCursor.value) sourceCursors[delta.sourceCursor.key] = delta.sourceCursor.value;
    else delete sourceCursors[delta.sourceCursor.key];
  }
  return {
    ...session,
    progress: {
      ...session.progress,
      cursorDate,
      cursorSourceIndex: sourceIndex,
      processedSources: delta.keepCursorPosition ? session.progress.processedSources : session.progress.processedSources + 1,
      processedDays: Math.min(session.progress.totalDays, daysBetween(session.request.range.startDate, cursorDate)),
      articlesFetched: session.progress.articlesFetched + (delta.articlesFetched ?? 0),
      eventsCreated: session.progress.eventsCreated + (delta.eventsCreated ?? 0),
      mergedArticles: session.progress.mergedArticles + (delta.mergedArticles ?? 0),
      duplicateArticles: session.progress.duplicateArticles + (delta.duplicateArticles ?? 0),
      errors: session.progress.errors + (delta.errors ?? 0),
      sourceCursors,
      ...mergeCoverage(session.progress, delta.coverage)
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

function markCoverageLimitedByArticleCap(session: HistoricalImportSession, now: string): HistoricalImportSession {
  return {
    ...session,
    progress: {
      ...session.progress,
      completeCoverage: false,
      estimatedCoverageLevel: session.progress.truncatedWindows?.length ? "incomplete" : "partial"
    },
    logs: [
      log("warning", "Couverture partielle: la limite maxArticles a interrompu l'import avant la fin de la plage demandee.", now),
      ...session.logs
    ]
  };
}

function remainingArticleLimit(session: HistoricalImportSession) {
    if (!session.request.maxArticles) return session.request.batchSize;
  return Math.max(1, Math.min(session.request.batchSize, session.request.maxArticles - session.progress.articlesFetched));
}

function mergeCoverage(progress: HistoricalImportProgress, coverage?: HistoricalCoverageUpdate): Partial<HistoricalImportProgress> {
  if (!coverage) return {};
  const truncatedWindows = new Set([...(progress.truncatedWindows ?? []), ...(coverage.truncatedWindows ?? [])]);
  const existingWindows = new Map((progress.coverageWindows ?? []).map((window) => [window.key, window]));
  (coverage.windows ?? []).forEach((window) => existingWindows.set(window.key, window));
  const completeCoverage = coverage.completeCoverage && truncatedWindows.size === 0;
  return {
    completeCoverage,
    truncatedWindows: [...truncatedWindows],
    subdividedWindows: (progress.subdividedWindows ?? 0) + (coverage.subdividedWindows ?? 0),
    estimatedCoverageLevel: completeCoverage ? "complete" : coverage.estimatedCoverageLevel ?? "partial",
    maxRecordsPerCall: coverage.maxRecordsPerCall ?? progress.maxRecordsPerCall,
    coverageWindows: [...existingWindows.values()]
  };
}

function cursorKeyFor(sourceId: string, date: string) {
  return `${sourceId}:${date}`;
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

function intervalFromCursor(date: string, cursor: string | undefined, intervalHours: number) {
  const dayStart = dateOnly(date);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const start = cursor ? new Date(cursor) : dayStart;
  if (Number.isNaN(start.getTime()) || start >= dayEnd) return undefined;
  const end = new Date(Math.min(dayEnd.getTime(), start.getTime() + intervalHours * 3_600_000));
  return { start, end };
}

function gdeltCursorFrom(date: string, cursor: string | undefined, intervalHours: number): GdeltCursor {
  if (cursor?.startsWith("{")) {
    try {
      const parsed = JSON.parse(cursor) as GdeltCursor;
      if (parsed.version === 1 && Array.isArray(parsed.pending)) return parsed;
    } catch {
      // Fall back to a plain ISO cursor below.
    }
  }
  const interval = intervalFromCursor(date, cursor, intervalHours);
  return {
    version: 1,
    pending: interval ? [{ start: interval.start.toISOString(), end: interval.end.toISOString(), levelMinutes: intervalHours * 60 }] : [],
    completed: [],
    truncated: [],
    subdivided: 0,
    advanceCursor: interval ? nextIntervalCursor(date, interval.end) : undefined
  };
}

function encodeGdeltCursor(cursor: GdeltCursor) {
  return JSON.stringify(cursor);
}

function splitGdeltWindow(window: GdeltWindow) {
  const currentIndex = GDELT_LEVEL_MINUTES.indexOf(window.levelMinutes as (typeof GDELT_LEVEL_MINUTES)[number]);
  const nextLevel = GDELT_LEVEL_MINUTES[Math.min(GDELT_LEVEL_MINUTES.length - 1, currentIndex + 1)] ?? 15;
  const start = new Date(window.start).getTime();
  const end = new Date(window.end).getTime();
  const stepMs = nextLevel * 60_000;
  const children: GdeltWindow[] = [];
  for (let next = start; next < end; next += stepMs) {
    children.push({
      start: new Date(next).toISOString(),
      end: new Date(Math.min(end, next + stepMs)).toISOString(),
      levelMinutes: nextLevel
    });
  }
  return children;
}

function gdeltCoverage(
  sourceId: string,
  window: GdeltWindow,
  received: number,
  maxRecords: number,
  status: NonNullable<HistoricalImportProgress["coverageWindows"]>[number]["status"],
  cursor: GdeltCursor
): HistoricalCoverageUpdate {
  const key = gdeltWindowKey(window);
  const saturatedWindows = uniqueStrings(status === "truncated" || status === "subdivided" ? [key, ...cursor.truncated] : [...cursor.truncated]);
  const truncatedWindows = uniqueStrings(status === "truncated" ? [key, ...cursor.truncated] : [...cursor.truncated]);
  const pendingWindows = cursor.pending.length;
  return {
    completeCoverage: saturatedWindows.length === 0 && pendingWindows === 0,
    truncatedWindows,
    subdividedWindows: status === "subdivided" ? 1 : 0,
    estimatedCoverageLevel: truncatedWindows.length ? "incomplete" : status === "subdivided" || pendingWindows > 0 ? "partial" : "complete",
    maxRecordsPerCall: maxRecords,
    windows: [{
      key,
      sourceId,
      start: window.start,
      end: window.end,
      levelMinutes: window.levelMinutes,
      received,
      maxRecords,
      status
    }]
  };
}

function gdeltWindowKey(window: GdeltWindow) {
  return `${window.start}/${window.end}`;
}

function uniqueStrings(items: string[]) {
  return [...new Set(items)];
}

function nextIntervalCursor(date: string, intervalEnd: Date) {
  const dayEnd = new Date(dateOnly(date).getTime() + 86_400_000);
  if (intervalEnd >= dayEnd) return undefined;
  return intervalEnd.toISOString();
}

function gdeltDateTime(date: Date) {
  return date.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

function parseGdeltSeenDate(value: string | undefined, fallbackDate: string) {
  if (!value) return `${fallbackDate}T12:00:00.000Z`;
  const compact = value.replace(/\D/g, "");
  if (compact.length >= 14) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}T${compact.slice(8, 10)}:${compact.slice(10, 12)}:${compact.slice(12, 14)}.000Z`;
  }
  return `${fallbackDate}T12:00:00.000Z`;
}

function normalizeCountry(value: string | undefined) {
  if (!value || value.toLowerCase() === "unknown") return "Monde";
  return value;
}

function safeUrl(value: string) {
  const url = new URL(value);
  ["key", "token", "apikey", "api_key"].forEach((param) => {
    if (url.searchParams.has(param)) url.searchParams.set(param, "[secret]");
  });
  return url.toString();
}

function retryAfterMs(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
  return undefined;
}
