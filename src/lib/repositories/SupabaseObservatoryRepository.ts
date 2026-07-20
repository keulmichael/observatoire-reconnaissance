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
      studies: ((studiesResult.data ?? []) as Array<DataRow<Study>>).map((row) => row.data),
      observationDrafts: ((draftsResult.data ?? []) as Array<DataRow<ObservationAnalysisDraft>>).map((row) => row.data),
      aiObservationResults: ((aiResult.data ?? []) as Array<DataRow<AIObservationResult>>).map((row) => row.data)
    });
  }

  async save(data: ObservatoryData, ownerId: string): Promise<ObservatoryData> {
    const migrated = migrateObservatoryData({ ...data, ownerId });
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
    const studies = migrated.studies.map((study) => ({
      id: study.id,
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
        id: record.id,
        owner_id: ownerId,
        study_id: study.id,
        status: record.status,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
        observed_at: record.createdAt,
        raw_text: record.rawText,
        data: { ...record, ownerId, studyId: study.id }
      }))
    );
    const drafts = (migrated.observationDrafts ?? []).map((draft) => ({
      id: draft.id,
      owner_id: ownerId,
      status: draft.status,
      created_at: draft.createdAt,
      updated_at: now,
      raw_text: draft.rawText,
      data: draft
    }));
    const aiResults = (migrated.aiObservationResults ?? []).map((result) => ({
      id: result.id,
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
    return migrated;
  }
}

function throwIfError(error: unknown) {
  if (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(message);
  }
}
