import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseObservatoryRepository } from "./SupabaseObservatoryRepository";
import type { AIObservationResult, ObservatoryData, Study } from "../types";

describe("SupabaseObservatoryRepository", () => {
  it("normalise les resultats IA legacy avant upsert et respecte les colonnes NOT NULL", async () => {
    const captured: Record<string, Array<Record<string, unknown>>> = {};
    const repository = new SupabaseObservatoryRepository(fakeSupabase(captured));

    const saved = await repository.saveCoreObservatory(legacyData(4), "e32b01b9-0935-463a-80db-ac6a6efdfab5");

    expect(saved.aiObservationResults?.[0].provider).toBe("openai");
    expect(captured.ai_observation_results).toHaveLength(1);
    expect(captured.ai_observation_results[0]).toMatchObject({
      provider: "openai",
      model: "gpt-4.1-mini",
      status: "success",
      created_at: "2026-07-20T07:30:21.974Z"
    });
    expect((captured.ai_observation_results[0].data as AIObservationResult).provider).toBe("openai");
    expectNoForbiddenNulls(captured);
  });
});

function fakeSupabase(captured: Record<string, Array<Record<string, unknown>>>): SupabaseClient {
  return {
    from(table: string) {
      return {
        async upsert(rows: Record<string, unknown> | Array<Record<string, unknown>>) {
          const list = Array.isArray(rows) ? rows : [rows];
          captured[table] = [...(captured[table] ?? []), ...list];
          expectRowsSatisfyNotNull(table, list);
          return { error: null };
        }
      };
    }
  } as unknown as SupabaseClient;
}

function expectNoForbiddenNulls(captured: Record<string, Array<Record<string, unknown>>>) {
  for (const [table, rows] of Object.entries(captured)) {
    expectRowsSatisfyNotNull(table, rows);
  }
}

function expectRowsSatisfyNotNull(table: string, rows: Array<Record<string, unknown>>) {
  const columns = NOT_NULL_COLUMNS[table] ?? [];
  for (const row of rows) {
    for (const column of columns) {
      expect(row[column], `${table}.${column}`).not.toBeNull();
      expect(row[column], `${table}.${column}`).not.toBeUndefined();
    }
  }
}

const NOT_NULL_COLUMNS: Record<string, string[]> = {
  observatory_profiles: ["owner_id", "data", "updated_at"],
  studies: ["id", "owner_id", "title", "data", "created_at", "updated_at"],
  observation_records: ["id", "owner_id", "study_id", "raw_text", "status", "data", "created_at", "updated_at"],
  observation_drafts: ["id", "owner_id", "raw_text", "status", "data", "created_at", "updated_at"],
  ai_observation_results: ["id", "owner_id", "provider", "model", "status", "data", "created_at", "updated_at"]
};

function legacyData(schemaVersion: 2 | 3 | 4 | 5): ObservatoryData {
  return {
    version: 1,
    schemaVersion,
    studies: [study()],
    observationDrafts: [{
      id: "draft-legacy",
      rawText: "Observation importee",
      detectedPeople: [],
      detectedManifestations: [],
      detectedEmotions: [],
      detectedCatalysts: [],
      detectedConcepts: [],
      chronology: [],
      relationProposals: [],
      confirmationQuestions: [],
      analysisWarnings: [],
      createdAt: "2026-07-20T07:30:21.974Z",
      status: "draft",
      methodologicalStatus: "Observation ouverte",
      conclusion: "Brouillon conserve"
    }],
    aiObservationResults: [{
      id: "ai-result-legacy",
      promptHash: "prompt-legacy",
      model: "gpt-4.1-mini",
      createdAt: "2026-07-20T07:30:21.974Z",
      response: null,
      tokenUsage: {},
      latency: 12,
      status: "success"
    } as AIObservationResult]
  };
}

function study(): Study {
  const now = "2026-07-20T07:30:21.974Z";
  return {
    id: "study-legacy",
    title: "Etude legacy",
    description: "Description conservee",
    subject: "Sujet conserve",
    startDate: "2026-07-20",
    status: "Observation ouverte",
    currentLevel: "Observation ouverte",
    notes: "",
    states: [],
    manifestations: [],
    transitions: [],
    recognitions: [],
    catalysts: [],
    emotionObservations: [],
    relations: [],
    timeline: [],
    map: { nodes: [], edges: [] },
    history: [],
    observations: [{
      id: "obs-legacy",
      studyId: "study-legacy",
      rawText: "Observation conservee",
      createdAt: now,
      updatedAt: now,
      status: "active",
      detectedPeople: [],
      detectedManifestations: [],
      detectedEmotions: [],
      detectedCatalysts: [],
      detectedConcepts: [],
      detectedRelations: [],
      detectedDimensions: [],
      acceptedProposalIds: [],
      editedProposalIds: [],
      rejectedProposalIds: [],
      validationHistory: [],
      generatedManifestationIds: [],
      generatedEmotionIds: [],
      generatedCatalystIds: [],
      generatedRelationIds: [],
      generatedStateIds: [],
      generatedTransitionIds: [],
      generatedRecognitionIds: [],
      generatedTimelineEventIds: [],
      generatedDeltaIds: [],
      enginesExecuted: [],
      engineResultsSummary: [],
      methodologicalWarnings: [],
      sourceExcerpts: [],
      openQuestions: []
    }],
    createdAt: now,
    updatedAt: now
  };
}
