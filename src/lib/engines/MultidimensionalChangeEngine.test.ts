import { describe, expect, it } from "vitest";
import { MultidimensionalChangeEngine } from "./MultidimensionalChangeEngine";
import { extractCanonicalDimensions } from "../parser/DimensionExtractor";
import type { ObservationRecord, Study } from "../types";

describe("MultidimensionalChangeEngine", () => {
  it("classe mepris comme attitude et idolatrie comme idealisation representationnelle", () => {
    const previous = record("obs-1", "Auparavant, cette figure etait meprisee et regulierement devalorisee par une partie du public.", "2026-01-01T00:00:00.000Z");
    const current = record("obs-2", "Elle est desormais idolatree et presentee comme une figure presque intouchable.", "2026-02-01T00:00:00.000Z");
    const previousDimensions = extractCanonicalDimensions(previous);
    const currentDimensions = extractCanonicalDimensions(current);

    expect(previousDimensions).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "Attitude", label: "mepris", subtype: "devalorisation", polarity: "negative" })
    ]));
    expect(currentDimensions).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "Representation", label: "idealisation", subtype: "glorification" })
    ]));
    expect(currentDimensions.some((item) => item.category === "Emotion" && /idol/i.test(item.label))).toBe(false);
  });

  it("detecte mepris vers idolatrie sans validation automatique ni causalite", () => {
    const previous = { ...record("obs-1", "Auparavant, cette figure etait meprisee et regulierement devalorisee par une partie du public.", "2026-01-01T00:00:00.000Z") };
    const current = { ...record("obs-2", "Elle est desormais idolatree et presentee comme une figure presque intouchable.", "2026-02-01T00:00:00.000Z") };
    const study = studyFixture([previous, current]);
    const result = MultidimensionalChangeEngine.comparePair(study, previous, current, { mode: "selected-study", studyId: study.id }, "2026-03-01T00:00:00.000Z");

    expect(result.status).toBe("proposed");
    expect(result.changesDetected.map((change) => change.kind)).toEqual(expect.arrayContaining([
      "polarity-inversion",
      "representation-shift",
      "relation-shift",
      "language-shift",
      "amplification"
    ]));
    expect(result.sourceExcerpts).toHaveLength(2);
    expect(result.limitations.join(" ")).toContain("Portee du groupe non precisee");
    expect(result.limitations.join(" ")).toContain("Ne pas produire automatiquement reconnaissance");
  });

  it("ne classe pas comprehension comme emotion et classe solidarite comme comportement", () => {
    const dimensions = extractCanonicalDimensions(record("obs-3", "Je comprends maintenant la situation et des actions de solidarite apparaissent.", "2026-01-01T00:00:00.000Z"));
    expect(dimensions).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "Concept", label: "comprehension", subtype: "cognition" }),
      expect.objectContaining({ category: "Behaviour", label: "solidarite" })
    ]));
    expect(dimensions.some((item) => item.category === "Emotion" && /comprehension|solidarite/i.test(item.label))).toBe(false);
  });
});

function studyFixture(observations: ObservationRecord[]): Study {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "study-idolatrie",
    title: "Etude anonymisee",
    description: "",
    subject: "",
    startDate: "2026-01-01",
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
    observations,
    createdAt: now,
    updatedAt: now
  };
}

function record(id: string, rawText: string, createdAt: string): ObservationRecord {
  return {
    id,
    studyId: "study-idolatrie",
    rawText,
    createdAt,
    updatedAt: createdAt,
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
    sourceExcerpts: [rawText],
    openQuestions: []
  };
}
