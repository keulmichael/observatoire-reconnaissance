import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, migrateObservatoryData } from "./data-migration";
import type { AIObservationResult, ObservatoryData, Study } from "./types";

describe("migrateObservatoryData", () => {
  for (const schemaVersion of [1, 2, 3, 4, 5] as const) {
    it(`importe une sauvegarde schemaVersion ${schemaVersion} avec resultats IA legacy sans provider`, () => {
      const input = legacyBackup(schemaVersion);

      const migrated = migrateObservatoryData(input);

      expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(migrated.studies).toHaveLength(1);
      expect(migrated.studies[0].id).toBe("study-legacy");
      expect(migrated.observationDrafts).toHaveLength(1);
      expect(migrated.aiObservationResults).toHaveLength(1);
      expect(migrated.aiObservationResults?.[0]).toMatchObject({
        id: "ai-result-legacy",
        promptHash: "prompt-legacy",
        provider: "openai",
        model: "gpt-4.1-mini",
        status: "success",
        createdAt: "2026-07-20T07:30:21.974Z",
        latency: 12,
        tokenUsage: {}
      });
      expect(migrated.aiObservationResults?.[0].response?.confidence).toBe(0.72);
    });
  }
});

function legacyBackup(schemaVersion: 1 | 2 | 3 | 4 | 5): ObservatoryData {
  const data: ObservatoryData = {
    version: 1,
    schemaVersion: schemaVersion === 1 ? undefined : schemaVersion,
    studies: [study()],
    observationDrafts: [{
      id: "draft-legacy",
      rawText: "Texte importe",
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
      conclusion: "Import conserve"
    }],
    aiObservationResults: [legacyAIResult()]
  };
  return data;
}

function legacyAIResult(): AIObservationResult {
  return {
    id: "ai-result-legacy",
    promptHash: "prompt-legacy",
    model: "gpt-4.1-mini",
    createdAt: "2026-07-20T07:30:21.974Z",
    response: {
      people: [],
      organisations: [],
      places: [],
      manifestations: [],
      events: [],
      objects: [],
      concepts: [],
      emotions: [],
      attitudes: [],
      representations: [],
      emotionScope: [],
      behaviours: [],
      decisions: [],
      intentions: [],
      relations: [],
      questions: [],
      timeline: [],
      confidence: 0.72,
      limitations: [],
      uncertainties: [],
      reasoningSummary: "Analyse conservee"
    },
    tokenUsage: {},
    latency: 12,
    status: "success"
  } as unknown as AIObservationResult;
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
    notes: "Notes conservees",
    states: [],
    manifestations: [],
    transitions: [],
    recognitions: [],
    catalysts: [],
    emotionObservations: [],
    relations: [],
    timeline: [],
    map: { nodes: [], edges: [] },
    history: ["Historique conserve"],
    observations: [],
    createdAt: now,
    updatedAt: now
  };
}
