import type { SupabaseClient } from "@supabase/supabase-js";
import { migrateObservatoryData } from "../data-migration";
import type { AIObservationResult, ObservationAnalysisDraft, ObservatoryData, Study } from "../types";
import type { ObservatoryRepository, RepositoryPage } from "./ObservatoryRepository";

type DataRow<T> = { id: string; data: T; updated_at?: string };

export class SupabaseObservatoryRepository implements ObservatoryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async load(ownerId: string, page: RepositoryPage = {}): Promise<ObservatoryData> {
    const limit = page.limit ?? 50;
    const offset = page.offset ?? 0;
    const [studiesResult, draftsResult, aiResult, profileResult] = await Promise.all([
      this.client.from("studies").select("id,data,updated_at").eq("owner_id", ownerId).order("updated_at", { ascending: false }).range(offset, offset + limit - 1),
      this.client.from("observation_drafts").select("id,data,updated_at").eq("owner_id", ownerId).order("updated_at", { ascending: false }).limit(200),
      this.client.from("ai_observation_results").select("id,data,updated_at").eq("owner_id", ownerId).order("updated_at", { ascending: false }).limit(50),
      this.client.from("observatory_profiles").select("data").eq("owner_id", ownerId).maybeSingle()
    ]);
    throwIfError(studiesResult.error);
    throwIfError(draftsResult.error);
    throwIfError(aiResult.error);
    throwIfError(profileResult.error);

    const base = ((profileResult.data as { data?: Partial<ObservatoryData> } | null)?.data ?? {}) as Partial<ObservatoryData>;
    return migrateObservatoryData({
      version: 1,
      ...base,
      ownerId,
      studies: uniqueBy(((studiesResult.data ?? []) as Array<DataRow<Study>>).map((row) => row.data), (study) => study.id),
      observationDrafts: uniqueBy(((draftsResult.data ?? []) as Array<DataRow<ObservationAnalysisDraft>>).map((row) => row.data), (draft) => draft.id),
      aiObservationResults: uniqueBy(((aiResult.data ?? []) as Array<DataRow<AIObservationResult>>).map((row) => row.data), (result) => result.id)
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

    const operations = [
      this.client.from("observatory_profiles").upsert(profile, { onConflict: "owner_id" }),
      studies.length ? this.client.from("studies").upsert(studies, { onConflict: "id" }) : Promise.resolve({ error: null }),
      observations.length ? this.client.from("observation_records").upsert(observations, { onConflict: "id" }) : Promise.resolve({ error: null }),
      drafts.length ? this.client.from("observation_drafts").upsert(drafts, { onConflict: "id" }) : Promise.resolve({ error: null }),
      aiResults.length ? this.client.from("ai_observation_results").upsert(aiResults, { onConflict: "id" }) : Promise.resolve({ error: null })
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
