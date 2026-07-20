import { describe, expect, it } from "vitest";
import { analysisScopeSummary, dataForAnalysisScope } from "./analysis-scope";
import type { ObservatoryData, Study } from "./types";

describe("AnalysisScope", () => {
  it("filtre strictement l'etude selectionnee", () => {
    const data = fixtureData();
    const scoped = dataForAnalysisScope(data, { mode: "selected-study", studyId: "study-a" });
    expect(scoped.studies.map((study) => study.id)).toEqual(["study-a"]);
    expect(scoped.studies[0].observations?.map((record) => record.studyId)).toEqual(["study-a"]);
  });

  it("agrege reellement toutes les etudes", () => {
    const data = fixtureData();
    const scoped = dataForAnalysisScope(data, { mode: "all-studies" });
    expect(scoped.studies).toHaveLength(2);
    expect(analysisScopeSummary(scoped.studies, { mode: "all-studies" })).toContain("2 etude(s) et 2 observation(s)");
  });
});

function fixtureData(): ObservatoryData {
  return {
    version: 1,
    studies: [study("study-a"), study("study-b")]
  };
}

function study(id: string): Study {
  const now = "2026-07-20T00:00:00.000Z";
  return {
    id,
    title: id,
    description: "",
    subject: "",
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
      id: `${id}-obs`,
      studyId: id,
      rawText: id,
      createdAt: now,
      updatedAt: now,
      status: "active",
      detectedPeople: [],
      detectedManifestations: [],
      detectedEmotions: [],
      detectedCatalysts: [],
      detectedConcepts: [],
      detectedRelations: [],
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
      sourceExcerpts: [id],
      openQuestions: []
    }],
    createdAt: now,
    updatedAt: now
  };
}
