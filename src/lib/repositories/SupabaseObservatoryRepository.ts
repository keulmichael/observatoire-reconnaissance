import type { SupabaseClient } from "@supabase/supabase-js";
import { migrateObservatoryData } from "../data-migration";
import type {
  AIObservationResult,
  GlobalCollectionLog,
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
  constructor(private readonly client: SupabaseClient) {}

  async load(ownerId: string, page: RepositoryPage = {}): Promise<ObservatoryData> {
    const limit = page.limit ?? 50;
    const offset = page.offset ?? 0;
    const [studiesResult, draftsResult, aiResult, profileResult, globalSourcesResult, globalEventsResult, globalLearningResult, globalLogsResult] = await Promise.all([
      this.client.from("studies").select("id,data,updated_at").eq("owner_id", ownerId).order("updated_at", { ascending: false }).range(offset, offset + limit - 1),
      this.client.from("observation_drafts").select("id,data,updated_at").eq("owner_id", ownerId).order("updated_at", { ascending: false }).limit(200),
      this.client.from("ai_observation_results").select("id,data,updated_at").eq("owner_id", ownerId).order("updated_at", { ascending: false }).limit(50),
      this.client.from("observatory_profiles").select("data").eq("owner_id", ownerId).maybeSingle(),
      this.client.from("global_sources").select("data").eq("owner_id", ownerId).limit(200),
      this.client.from("global_events").select("data").eq("owner_id", ownerId).order("updated_at", { ascending: false }).limit(300),
      this.client.from("global_learning_signals").select("data").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(300),
      this.client.from("global_collection_logs").select("data").eq("owner_id", ownerId).order("started_at", { ascending: false }).limit(100)
    ]);
    throwIfError(studiesResult.error);
    throwIfError(draftsResult.error);
    throwIfError(aiResult.error);
    throwIfError(profileResult.error);
    throwIfError(globalSourcesResult.error);
    throwIfError(globalEventsResult.error);
    throwIfError(globalLearningResult.error);
    throwIfError(globalLogsResult.error);

    const base = ((profileResult.data as { data?: Partial<ObservatoryData> } | null)?.data ?? {}) as Partial<ObservatoryData>;
    const globalSources = ((globalSourcesResult.data ?? []) as Array<{ data: GlobalSourceConnector }>).map((row) => row.data);
    const globalEvents = ((globalEventsResult.data ?? []) as Array<{ data: GlobalObservedEvent }>).map((row) => row.data);
    const globalLearningSignals = ((globalLearningResult.data ?? []) as Array<{ data: GlobalLearningSignal }>).map((row) => row.data);
    const globalCollectionLogs = ((globalLogsResult.data ?? []) as Array<{ data: GlobalCollectionLog }>).map((row) => row.data);
    return migrateObservatoryData({
      version: 1,
      ...base,
      ownerId,
      studies: uniqueBy(((studiesResult.data ?? []) as Array<DataRow<Study>>).map((row) => row.data), (study) => study.id),
      observationDrafts: uniqueBy(((draftsResult.data ?? []) as Array<DataRow<ObservationAnalysisDraft>>).map((row) => row.data), (draft) => draft.id),
      aiObservationResults: uniqueBy(((aiResult.data ?? []) as Array<DataRow<AIObservationResult>>).map((row) => row.data), (result) => result.id),
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
            lastCollectedAt: globalCollectionLogs[0]?.completedAt
          })
        : base.globalObservatory
    });
  }

  async save(data: ObservatoryData, ownerId: string): Promise<ObservatoryData> {
    const migrated = migrateObservatoryData({ ...data, ownerId });
    const uniqueStudies = uniqueBy(migrated.studies, (study) => study.id);
    const uniqueDrafts = uniqueBy(migrated.observationDrafts ?? [], (draft) => draft.id);
    const uniqueAIResults = uniqueBy(migrated.aiObservationResults ?? [], (result) => result.id);
    const normalizedData = {
      ...migrated,
      studies: uniqueStudies,
      observationDrafts: uniqueDrafts,
      aiObservationResults: uniqueAIResults
    };
    const now = new Date().toISOString();
    const profile = {
      owner_id: ownerId,
      data: {
        version: normalizedData.version,
        schemaVersion: normalizedData.schemaVersion,
        ownerId,
        createdAt: normalizedData.createdAt ?? now,
        updatedAt: now,
        aiSettings: normalizedData.aiSettings,
        theories: normalizedData.theories ?? [],
        theoryRevisionProposals: normalizedData.theoryRevisionProposals ?? [],
        theoryPredictions: normalizedData.theoryPredictions ?? [],
        reciprocalTestimonies: normalizedData.reciprocalTestimonies ?? [],
        reflexiveSignatures: normalizedData.reflexiveSignatures ?? []
      },
      updated_at: now
    };
    const global = GlobalObservatory.refresh(normalizedData.globalObservatory ?? GlobalObservatory.initialState(now));
    const remoteStudyIds = new Map(uniqueStudies.map((study) => [study.id, ownerScopedId(ownerId, study.id)]));
    const studies = uniqueStudies.map((study) => ({
      id: remoteStudyIds.get(study.id) ?? ownerScopedId(ownerId, study.id),
      owner_id: ownerId,
      title: study.title,
      subject: study.subject,
      status: study.status,
      created_at: study.createdAt,
      updated_at: study.updatedAt ?? now,
      data: { ...study, ownerId }
    }));
    const observations = uniqueStudies.flatMap((study) =>
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
    const drafts = uniqueDrafts.map((draft) => ({
      id: ownerScopedId(ownerId, draft.id),
      owner_id: ownerId,
      status: draft.status,
      created_at: draft.createdAt,
      updated_at: now,
      raw_text: draft.rawText,
      data: draft
    }));
    const aiResults = uniqueAIResults.map((result) => ({
      id: ownerScopedId(ownerId, result.id),
      owner_id: ownerId,
      provider: result.provider,
      model: result.model,
      status: result.status,
      created_at: result.createdAt,
      updated_at: now,
      data: result
    }));
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
    const globalArticles = uniqueBy(global.events.flatMap((event) => event.sources), (source) => source.id).map((source) => ({
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
    const globalEventArticles = global.events.flatMap((event) =>
      event.sources.map((source) => ({
        owner_id: ownerId,
        event_id: ownerScopedId(ownerId, event.id),
        article_id: ownerScopedId(ownerId, source.id),
        merge_status: event.mergeCandidates.find((candidate) => candidate.eventId === event.id)?.status ?? "distinct",
        confidence: event.mergeCandidates.find((candidate) => candidate.eventId === event.id)?.confidence ?? 1,
        reason: event.mergeCandidates.find((candidate) => candidate.eventId === event.id)?.reason
      }))
    );
    const globalExcerpts = global.events.flatMap((event) =>
      event.sources.flatMap((source) =>
        source.excerpts.map((excerpt) => ({
          id: ownerScopedId(ownerId, excerpt.id),
          owner_id: ownerId,
          article_id: ownerScopedId(ownerId, source.id),
          location: excerpt.location,
          excerpt_text: excerpt.text,
          data: excerpt
        }))
      )
    );
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
    const globalClaimSources = global.events.flatMap((event) =>
      (event.analysis?.claims ?? []).flatMap((claim) =>
        claim.sourceIds.flatMap((sourceId) => {
          const excerptIds = claim.excerptIds.length ? claim.excerptIds : [undefined];
          return excerptIds.map((excerptId) => ({
            id: ownerScopedId(ownerId, `${claim.id}:${sourceId}:${excerptId ?? "no-excerpt"}`),
            owner_id: ownerId,
            claim_id: ownerScopedId(ownerId, claim.id),
            article_id: ownerScopedId(ownerId, sourceId),
            excerpt_id: excerptId ? ownerScopedId(ownerId, excerptId) : null
          }));
        })
      )
    );
    const globalSuggestions = global.events.filter((event) => event.studySuggestion).map((event) => ({
      id: ownerScopedId(ownerId, event.studySuggestion?.id ?? `suggestion-${event.id}`),
      owner_id: ownerId,
      event_id: ownerScopedId(ownerId, event.id),
      title: event.studySuggestion?.title ?? event.title,
      status: event.studySuggestion?.status ?? "proposed",
      data: event.studySuggestion,
      created_at: event.studySuggestion?.createdAt ?? now,
      updated_at: event.studySuggestion?.updatedAt ?? now
    }));
    const globalLearningSignals = global.learningSignals.map((signal) => ({
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

    const operations = [
      this.client.from("observatory_profiles").upsert(profile, { onConflict: "owner_id" }),
      studies.length ? this.client.from("studies").upsert(studies, { onConflict: "id" }) : Promise.resolve({ error: null }),
      observations.length ? this.client.from("observation_records").upsert(observations, { onConflict: "id" }) : Promise.resolve({ error: null }),
      drafts.length ? this.client.from("observation_drafts").upsert(drafts, { onConflict: "id" }) : Promise.resolve({ error: null }),
      aiResults.length ? this.client.from("ai_observation_results").upsert(aiResults, { onConflict: "id" }) : Promise.resolve({ error: null }),
      globalSources.length ? this.client.from("global_sources").upsert(globalSources, { onConflict: "id" }) : Promise.resolve({ error: null }),
      globalArticles.length ? this.client.from("global_articles").upsert(globalArticles, { onConflict: "id" }) : Promise.resolve({ error: null }),
      globalEvents.length ? this.client.from("global_events").upsert(globalEvents, { onConflict: "id" }) : Promise.resolve({ error: null }),
      globalEventArticles.length ? this.client.from("global_event_articles").upsert(globalEventArticles, { onConflict: "event_id,article_id" }) : Promise.resolve({ error: null }),
      globalExcerpts.length ? this.client.from("global_excerpts").upsert(globalExcerpts, { onConflict: "id" }) : Promise.resolve({ error: null }),
      globalAnalyses.length ? this.client.from("global_analyses").upsert(globalAnalyses, { onConflict: "id" }) : Promise.resolve({ error: null }),
      globalClaims.length ? this.client.from("global_claims").upsert(globalClaims, { onConflict: "id" }) : Promise.resolve({ error: null }),
      globalClaimSources.length ? this.client.from("global_claim_sources").upsert(globalClaimSources, { onConflict: "id" }) : Promise.resolve({ error: null }),
      globalSuggestions.length ? this.client.from("global_study_suggestions").upsert(globalSuggestions, { onConflict: "id" }) : Promise.resolve({ error: null }),
      globalLearningSignals.length ? this.client.from("global_learning_signals").upsert(globalLearningSignals, { onConflict: "id" }) : Promise.resolve({ error: null }),
      globalCollectionLogs.length ? this.client.from("global_collection_logs").upsert(globalCollectionLogs, { onConflict: "id" }) : Promise.resolve({ error: null })
    ];
    const results = await Promise.all(operations);
    results.forEach((result) => throwIfError(result.error));
    return normalizedData;
  }
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

function throwIfError(error: unknown) {
  if (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(message);
  }
}
