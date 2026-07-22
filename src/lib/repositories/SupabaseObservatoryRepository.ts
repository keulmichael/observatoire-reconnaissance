import type { SupabaseClient } from "@supabase/supabase-js";
import { migrateObservatoryData, normalizeAIObservationResult } from "../data-migration";
import type {
  AIObservationResult,
  GlobalCollectionLog,
  HistoricalImportSession,
  GlobalLearningSignal,
  GlobalObservedEvent,
  GlobalSourceConnector,
  ObservationAnalysisDraft,
  ObservatoryData,
  Study
} from "../types";
import { GlobalObservatory } from "../global-observatory";
import { Normalization } from "../global-observatory/Normalization";
import type { ObservatoryRepository, RepositoryPage } from "./ObservatoryRepository";

type DataRow<T> = { id: string; data: T; updated_at?: string };

export class SupabaseObservatoryRepository implements ObservatoryRepository {
  private warnings: string[] = [];

  constructor(private readonly client: SupabaseClient) {}

  async load(ownerId: string, page: RepositoryPage = {}): Promise<ObservatoryData> {
    this.warnings = [];
    const limit = page.limit ?? 50;
    const offset = page.offset ?? 0;
    const [studiesResult, draftsResult, aiResult, profileResult] = await Promise.all([
      this.client.from("studies").select("id,data,updated_at").eq("owner_id", ownerId).order("updated_at", { ascending: false }).range(offset, offset + limit - 1),
      this.client.from("observation_drafts").select("id,data,updated_at").eq("owner_id", ownerId).order("updated_at", { ascending: false }).limit(200),
      this.client.from("ai_observation_results").select("id,data,updated_at").eq("owner_id", ownerId).order("updated_at", { ascending: false }).limit(50),
      this.client.from("observatory_profiles").select("data").eq("owner_id", ownerId).maybeSingle()
    ]);
    throwIfError(studiesResult.error, "etudes");
    throwIfError(draftsResult.error, "observations");
    throwIfError(aiResult.error, "analyses");
    throwIfError(profileResult.error, "profil");

    const base = ((profileResult.data as { data?: Partial<ObservatoryData> } | null)?.data ?? {}) as Partial<ObservatoryData>;
    const core = {
      version: 1 as const,
      ...base,
      ownerId,
      studies: uniqueBy(((studiesResult.data ?? []) as Array<DataRow<Study>>).map((row) => row.data), (study) => study.id),
      observationDrafts: uniqueBy(((draftsResult.data ?? []) as Array<DataRow<ObservationAnalysisDraft>>).map((row) => row.data), (draft) => draft.id),
      aiObservationResults: uniqueBy(((aiResult.data ?? []) as Array<DataRow<AIObservationResult>>).map((row) => row.data), (result) => result.id)
    };
    try {
      return migrateObservatoryData({ ...core, globalObservatory: await this.loadGlobalObservatory(ownerId, base.globalObservatory) });
    } catch (error) {
      this.warnings = [`Veille mondiale non chargee: ${message(error)}`];
      return migrateObservatoryData(core);
    }
  }

  getWarnings() {
    return this.warnings;
  }

  async save(data: ObservatoryData, ownerId: string): Promise<ObservatoryData> {
    const saved = await this.saveCoreObservatory(data, ownerId);
    await this.saveGlobalObservatory(saved, ownerId);
    return saved;
  }

  async saveCoreObservatory(data: ObservatoryData, ownerId: string): Promise<ObservatoryData> {
    const migrated = normalizeRepositoryData(data, ownerId);
    const now = new Date().toISOString();
    const profile = {
      owner_id: ownerId,
      data: {
        version: migrated.version,
        schemaVersion: migrated.schemaVersion,
        ownerId,
        createdAt: migrated.createdAt ?? now,
        updatedAt: now,
        aiSettings: migrated.aiSettings,
        theories: migrated.theories ?? [],
        theoryRevisionProposals: migrated.theoryRevisionProposals ?? [],
        theoryPredictions: migrated.theoryPredictions ?? [],
        reciprocalTestimonies: migrated.reciprocalTestimonies ?? [],
        reflexiveSignatures: migrated.reflexiveSignatures ?? []
      },
      updated_at: now
    };
    const remoteStudyIds = new Map(migrated.studies.map((study) => [study.id, ownerScopedId(ownerId, study.id)]));
    const studies = migrated.studies.map((study) => ({
      id: remoteStudyIds.get(study.id) ?? ownerScopedId(ownerId, study.id),
      owner_id: ownerId,
      title: study.title,
      subject: study.subject,
      status: study.status,
      created_at: study.createdAt,
      updated_at: study.updatedAt ?? now,
      data: { ...study, ownerId }
    }));
    const observations = migrated.studies.flatMap((study) =>
      (study.observations ?? []).map((record) => ({
        id: ownerScopedId(ownerId, `${study.id}:${record.id}`),
        owner_id: ownerId,
        study_id: remoteStudyIds.get(study.id) ?? ownerScopedId(ownerId, study.id),
        status: record.status,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
        observed_at: record.createdAt,
        raw_text: record.rawText,
        data: { ...record, ownerId, studyId: study.id }
      }))
    );
    const drafts = (migrated.observationDrafts ?? []).map((draft) => ({
      id: ownerScopedId(ownerId, draft.id),
      owner_id: ownerId,
      status: draft.status,
      created_at: draft.createdAt,
      updated_at: now,
      raw_text: draft.rawText,
      data: draft
    }));
    const aiResults = (migrated.aiObservationResults ?? []).map((result) => {
      const normalized = normalizeAIObservationResult(result, now);
      return {
        id: ownerScopedId(ownerId, normalized.id),
        owner_id: ownerId,
        provider: normalized.provider,
        model: normalized.model,
        status: normalized.status,
        created_at: normalized.createdAt,
        updated_at: now,
        data: normalized
      };
    });
    await upsertOrSkip(this.client, "observatory_profiles", profile, "owner_id");
    await upsertOrSkip(this.client, "studies", studies, "id");
    await upsertOrSkip(this.client, "observation_records", observations, "id");
    await upsertOrSkip(this.client, "observation_drafts", drafts, "id");
    await upsertOrSkip(this.client, "ai_observation_results", aiResults, "id");
    return migrated;
  }

  async saveGlobalObservatory(data: ObservatoryData, ownerId: string): Promise<void> {
    const global = GlobalObservatory.refresh(data.globalObservatory ?? GlobalObservatory.initialState());
    const rows = buildGlobalRows(global, ownerId);
    await upsertOrSkip(this.client, "global_sources", rows.globalSources, "id");
    await upsertOrSkip(this.client, "global_articles", rows.globalArticles, "id");
    await upsertOrSkip(this.client, "global_events", rows.globalEvents, "id");
    await upsertOrSkip(this.client, "global_event_articles", rows.globalEventArticles, "event_id,article_id");
    await upsertOrSkip(this.client, "global_excerpts", rows.globalExcerpts, "id");
    await upsertOrSkip(this.client, "global_claims", rows.globalClaims, "id");
    await upsertOrSkip(this.client, "global_analyses", rows.globalAnalyses, "id");
    await upsertOrSkip(this.client, "global_claim_sources", rows.globalClaimSources, "id");
    await upsertOrSkip(this.client, "global_study_suggestions", rows.globalSuggestions, "id");
    await upsertOrSkip(this.client, "global_learning_signals", rows.globalLearningSignals, "id");
    await upsertOrSkip(this.client, "global_collection_logs", rows.globalCollectionLogs, "id");
    await upsertOrSkip(this.client, "historical_import_sessions", rows.historicalImportSessions, "id");
  }

  private async loadGlobalObservatory(ownerId: string, fallback?: ObservatoryData["globalObservatory"]) {
    const [globalSourcesResult, globalEventsResult, globalLearningResult, globalLogsResult, historicalImportsResult] = await Promise.all([
      this.client.from("global_sources").select("data").eq("owner_id", ownerId).limit(200),
      this.client.from("global_events").select("data").eq("owner_id", ownerId).order("updated_at", { ascending: false }).limit(300),
      this.client.from("global_learning_signals").select("data").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(300),
      this.client.from("global_collection_logs").select("data").eq("owner_id", ownerId).order("started_at", { ascending: false }).limit(100),
      this.client.from("historical_import_sessions").select("data").eq("owner_id", ownerId).order("updated_at", { ascending: false }).limit(100)
    ]);
    throwIfError(globalSourcesResult.error, "veille mondiale/global_sources");
    throwIfError(globalEventsResult.error, "veille mondiale/global_events");
    throwIfError(globalLearningResult.error, "veille mondiale/global_learning_signals");
    throwIfError(globalLogsResult.error, "veille mondiale/global_collection_logs");
    throwIfError(historicalImportsResult.error, "veille mondiale/historical_import_sessions");
    const globalSources = ((globalSourcesResult.data ?? []) as Array<{ data: GlobalSourceConnector }>).map((row) => row.data);
    const globalEvents = ((globalEventsResult.data ?? []) as Array<{ data: GlobalObservedEvent }>).map((row) => row.data);
    const globalLearningSignals = ((globalLearningResult.data ?? []) as Array<{ data: GlobalLearningSignal }>).map((row) => row.data);
    const globalCollectionLogs = ((globalLogsResult.data ?? []) as Array<{ data: GlobalCollectionLog }>).map((row) => row.data);
    const historicalImports = ((historicalImportsResult.data ?? []) as Array<{ data: HistoricalImportSession }>).map((row) => row.data);
    if (!globalEvents.length && !globalSources.length && !historicalImports.length) return fallback;
    return migrateObservatoryData({
      version: 1,
      ownerId,
      studies: [],
      globalObservatory: globalEvents.length || globalSources.length
        ? GlobalObservatory.refresh({
            sources: globalSources,
            events: globalEvents,
            learningSignals: globalLearningSignals,
            collectionLogs: globalCollectionLogs,
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
            historicalImports,
            lastCollectedAt: globalCollectionLogs[0]?.completedAt
          })
        : fallback
    }).globalObservatory;
  }
}

function buildGlobalRows(global: NonNullable<ObservatoryData["globalObservatory"]>, ownerId: string) {
  const now = new Date().toISOString();
  const globalSources = global.sources.map((source) => ({
      id: ownerScopedId(ownerId, source.id),
      owner_id: ownerId,
      name: source.name,
      source_type: source.type,
      endpoint: source.endpoint,
      enabled: source.enabled,
      reliability: source.reliability,
      data: source,
      updated_at: now
    }));
    const persistedSourceIds = new Set(globalSources.map((source) => source.id));
    const globalArticles = uniqueBy(global.events.flatMap((event) => event.sources), (source) => source.id)
      .filter((source) => persistedSourceIds.has(ownerScopedId(ownerId, source.connectorId)))
      .map((source) => ({
      id: ownerScopedId(ownerId, source.id),
      owner_id: ownerId,
      source_id: ownerScopedId(ownerId, source.connectorId),
      external_id: source.externalId,
      canonical_url: source.url,
      normalized_title: Normalization.title(source.title),
      title: source.title,
      published_at: source.publishedAt,
      collected_at: source.collectedAt,
      language: source.language,
      country: source.country,
      summary: source.summary,
      data: source,
      updated_at: now
    }));
    const globalEvents = global.events.map((event) => ({
      id: ownerScopedId(ownerId, event.id),
      owner_id: ownerId,
      title: event.title,
      normalized_title: event.normalizedTitle,
      summary: event.summary,
      country: event.country,
      status: event.status,
      started_at: event.startedAt,
      updated_event_at: event.updatedAt,
      interest_score: event.interest?.score,
      interest_level: event.interest?.level,
      learning_weight: event.learningWeight,
      data: event,
      updated_at: now
    }));
    const persistedEventIds = new Set(globalEvents.map((event) => event.id));
    const persistedArticleIds = new Set(globalArticles.map((article) => article.id));
    const globalEventArticles = uniqueBy(global.events.flatMap((event) =>
      event.sources
        .filter((source) => persistedEventIds.has(ownerScopedId(ownerId, event.id)) && persistedArticleIds.has(ownerScopedId(ownerId, source.id)))
        .map((source) => ({
        owner_id: ownerId,
        event_id: ownerScopedId(ownerId, event.id),
        article_id: ownerScopedId(ownerId, source.id),
        merge_status: event.mergeCandidates.find((candidate) => candidate.eventId === event.id)?.status ?? "distinct",
        confidence: event.mergeCandidates.find((candidate) => candidate.eventId === event.id)?.confidence ?? 1,
        reason: event.mergeCandidates.find((candidate) => candidate.eventId === event.id)?.reason
      }))
    ), (row) => `${row.event_id}:${row.article_id}`);
    const globalExcerpts = global.events.flatMap((event) =>
      event.sources.flatMap((source) =>
        source.excerpts
          .filter(() => persistedArticleIds.has(ownerScopedId(ownerId, source.id)))
          .map((excerpt) => ({
          id: ownerScopedId(ownerId, excerpt.id),
          owner_id: ownerId,
          article_id: ownerScopedId(ownerId, source.id),
          location: excerpt.location,
          excerpt_text: excerpt.text,
          data: excerpt
        }))
      )
    );
    const persistedExcerptIds = new Set(globalExcerpts.map((excerpt) => excerpt.id));
    const globalAnalyses = global.events.filter((event) => event.analysis).map((event) => ({
      id: ownerScopedId(ownerId, `analysis-${event.id}-${event.analysis?.engineVersion ?? "v1"}`),
      owner_id: ownerId,
      event_id: ownerScopedId(ownerId, event.id),
      engine_version: event.analysis?.engineVersion ?? "unknown",
      generated_at: event.analysis?.generatedAt ?? now,
      data: event.analysis
    }));
    const globalClaims = global.events.flatMap((event) =>
      (event.analysis?.claims ?? []).map((claim) => ({
        id: ownerScopedId(ownerId, claim.id),
        owner_id: ownerId,
        event_id: ownerScopedId(ownerId, event.id),
        claim_text: claim.text,
        claim_status: claim.status,
        confidence: claim.confidence,
        generated_at: event.analysis?.generatedAt ?? now,
        model_version: event.analysis?.engineVersion ?? "unknown",
      data: claim
      }))
    );
    const persistedClaimIds = new Set(globalClaims.map((claim) => claim.id));
    const globalClaimSources = global.events.flatMap((event) =>
      (event.analysis?.claims ?? []).flatMap((claim) =>
        claim.sourceIds.filter((sourceId) => persistedClaimIds.has(ownerScopedId(ownerId, claim.id)) && persistedArticleIds.has(ownerScopedId(ownerId, sourceId))).flatMap((sourceId) => {
          const excerptIds = claim.excerptIds.length ? claim.excerptIds : [undefined];
          return excerptIds.filter((excerptId) => !excerptId || persistedExcerptIds.has(ownerScopedId(ownerId, excerptId))).map((excerptId) => ({
            id: ownerScopedId(ownerId, `${claim.id}:${sourceId}:${excerptId ?? "no-excerpt"}`),
            owner_id: ownerId,
            claim_id: ownerScopedId(ownerId, claim.id),
            article_id: ownerScopedId(ownerId, sourceId),
            excerpt_id: excerptId ? ownerScopedId(ownerId, excerptId) : null
          }));
        })
      )
    );
    const globalSuggestions = global.events.filter((event) => event.studySuggestion && persistedEventIds.has(ownerScopedId(ownerId, event.id))).map((event) => ({
      id: ownerScopedId(ownerId, event.studySuggestion?.id ?? `suggestion-${event.id}`),
      owner_id: ownerId,
      event_id: ownerScopedId(ownerId, event.id),
      title: event.studySuggestion?.title ?? event.title,
      status: event.studySuggestion?.status ?? "proposed",
      data: event.studySuggestion,
      created_at: event.studySuggestion?.createdAt ?? now,
      updated_at: event.studySuggestion?.updatedAt ?? now
    }));
    const globalLearningSignals = global.learningSignals.filter((signal) => persistedEventIds.has(ownerScopedId(ownerId, signal.eventId))).map((signal) => ({
      id: ownerScopedId(ownerId, signal.id),
      owner_id: ownerId,
      event_id: ownerScopedId(ownerId, signal.eventId),
      suggestion_id: signal.suggestionId ? ownerScopedId(ownerId, signal.suggestionId) : null,
      study_id: signal.studyId ? ownerScopedId(ownerId, signal.studyId) : null,
      action: signal.action,
      weight: signal.weight,
      reason: signal.reason,
      data: signal,
      created_at: signal.createdAt
    }));
    const globalCollectionLogs = (global.collectionLogs ?? []).map((log) => ({
      id: ownerScopedId(ownerId, log.id),
      owner_id: ownerId,
      started_at: log.startedAt,
      completed_at: log.completedAt,
      mode: log.mode,
      articles_fetched: log.articlesFetched,
      new_events: log.newEvents,
      duplicate_articles: log.duplicateArticles,
      merged_articles: log.mergedArticles,
      ambiguous_merges: log.ambiguousMerges,
      data: log
    }));
    const historicalImportSessions = (global.historicalImports ?? []).map((session) => ({
      id: ownerScopedId(ownerId, session.id),
      owner_id: ownerId,
      status: session.status,
      started_at: session.startedAt,
      updated_at: session.updatedAt,
      completed_at: session.completedAt,
      range_start: session.request.range.startDate,
      range_end: session.request.range.endDate,
      articles_fetched: session.progress.articlesFetched,
      events_created: session.progress.eventsCreated,
      errors: session.progress.errors,
      data: session
    }));

  return {
    globalSources,
    globalArticles,
    globalEvents,
    globalEventArticles,
    globalExcerpts,
    globalClaims,
    globalAnalyses,
    globalClaimSources,
    globalSuggestions,
    globalLearningSignals,
    globalCollectionLogs,
    historicalImportSessions
  };
}

async function upsertOrSkip(client: SupabaseClient, table: string, rows: unknown[] | unknown, onConflict: string) {
  if (Array.isArray(rows) && rows.length === 0) return;
  const result = await client.from(table).upsert(rows as Record<string, unknown> | Array<Record<string, unknown>>, { onConflict });
  throwIfError(result.error, table);
}

function normalizeRepositoryData(data: ObservatoryData, ownerId: string): ObservatoryData {
  const migrated = migrateObservatoryData({ ...data, ownerId });
  return {
    ...migrated,
    studies: uniqueBy(migrated.studies, (study) => study.id),
    observationDrafts: uniqueBy(migrated.observationDrafts ?? [], (draft) => draft.id),
    aiObservationResults: uniqueBy(migrated.aiObservationResults ?? [], (result) => result.id)
  };
}

function ownerScopedId(ownerId: string, id: string) {
  return `${ownerId}:${id}`;
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function throwIfError(error: unknown, domain?: string) {
  if (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(domain ? `${domain}: ${message}` : message);
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Erreur de synchronisation";
}
