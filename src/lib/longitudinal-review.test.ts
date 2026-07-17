import { describe, expect, it } from "vitest";
import { migrateObservatoryData } from "./data-migration";
import {
  editLongitudinalComparison,
  reanalyzeLongitudinalComparisons,
  rejectLongitudinalComparison,
  validateLongitudinalComparison
} from "./longitudinal-review";
import type { LongitudinalObservationComparison, ObservationRecord, Study } from "./types";

const now = "2026-07-16T12:00:00.000Z";

describe("longitudinal review actions", () => {
  it("validates a comparison as a persistent transition with linked observations and Delta", () => {
    const study = makeStudy();
    const result = validateLongitudinalComparison(study, "comparison-1", now);
    const comparison = result.study.longitudinalComparisons?.[0];
    const transition = result.study.transitions[0];

    expect(result.message).toBe("Transition validee et enregistree.");
    expect(comparison?.status).toBe("validated");
    expect(comparison?.generatedTransitionId).toBe(transition.id);
    expect(comparison?.generatedDeltaId).toBe(result.study.deltaScores?.[0].id);
    expect(transition.sourceObservationIds).toEqual(["obs-1", "obs-2"]);
    expect(result.study.states).toHaveLength(2);
    expect(result.study.deltaScores).toHaveLength(1);
    expect(result.study.structuredHistory?.some((entry) => entry.actionType === "transition generee")).toBe(true);
  });

  it("reuses existing states and avoids duplicate transitions on a second validation", () => {
    const first = validateLongitudinalComparison(makeStudy(), "comparison-1", now).study;
    const second = validateLongitudinalComparison(first, "comparison-1", "2026-07-16T12:05:00.000Z").study;

    expect(second.states).toHaveLength(2);
    expect(second.transitions).toHaveLength(1);
    expect(second.deltaScores).toHaveLength(1);
  });

  it("does not create Delta or transition when state data is insufficient", () => {
    const study = makeStudy({
      proposedPreviousState: null,
      previousStateProposal: null
    });

    expect(() => validateLongitudinalComparison(study, "comparison-1", now)).toThrow("Donnees insuffisantes");
    expect(study.transitions).toHaveLength(0);
    expect(study.deltaScores).toHaveLength(0);
  });

  it("refuses to validate an emotional perturbation as a comprehension transition", () => {
    const study = makeStudy({
      resultStatus: "emotional_perturbation",
      potentialTransition: null,
      proposedPreviousState: null,
      proposedCurrentState: null,
      noTransitionReason: "Donnees insuffisantes pour etablir un changement de comprehension."
    });

    expect(() => validateLongitudinalComparison(study, "comparison-1", now)).toThrow("Donnees insuffisantes");
    expect(study.transitions).toHaveLength(0);
    expect(study.deltaScores).toHaveLength(0);
  });

  it("edits a proposal without validating it and preserves the initial version in history", () => {
    const study = makeStudy();
    const result = editLongitudinalComparison(study, "comparison-1", {
      title: "Titre modifie",
      conclusion: "Description modifiee",
      previousStateProposal: study.longitudinalComparisons![0].proposedPreviousState,
      currentStateProposal: study.longitudinalComparisons![0].proposedCurrentState,
      dimensionsCompared: study.longitudinalComparisons![0].dimensionsCompared,
      detectedDifferences: study.longitudinalComparisons![0].differences,
      confidence: "eleve",
      limitations: ["limite modifiee"],
      questions: ["question modifiee"],
      sourceExcerpts: study.longitudinalComparisons![0].sourceExcerpts
    }, now);

    const comparison = result.study.longitudinalComparisons![0];
    expect(comparison.status).toBe("edited");
    expect(comparison.title).toBe("Titre modifie");
    expect(comparison.initialVersion?.conclusion).toBe("Changement detecte.");
    expect(result.study.transitions).toHaveLength(0);
    expect(result.study.structuredHistory?.some((entry) => entry.summary.includes("modifiee"))).toBe(true);
  });

  it("rejects a proposal without deleting source observations or creating scientific artifacts", () => {
    const study = makeStudy();
    const result = rejectLongitudinalComparison(study, "comparison-1", "mauvaise interpretation", now);
    const comparison = result.study.longitudinalComparisons![0];

    expect(comparison.status).toBe("rejected");
    expect(comparison.rejectionReason).toBe("mauvaise interpretation");
    expect(comparison.reviewedAt).toBe(now);
    expect(result.study.observations).toHaveLength(2);
    expect(result.study.states).toHaveLength(0);
    expect(result.study.transitions).toHaveLength(0);
    expect(result.study.deltaScores).toHaveLength(0);
    expect(result.study.structuredHistory?.some((entry) => entry.summary.includes("rejetee"))).toBe(true);
  });

  it("rolls back completely when validation fails after a missing source observation", () => {
    const study = makeStudy({
      sourceObservationIds: ["obs-1", "missing"],
      currentObservationId: "missing"
    });
    const before = JSON.stringify(study);

    expect(() => validateLongitudinalComparison(study, "comparison-1", now)).toThrow("observation source introuvable");
    expect(JSON.stringify(study)).toBe(before);
  });

  it("migrates legacy longitudinal statuses and persistent fields", () => {
    const migrated = migrateObservatoryData({ version: 1, studies: [makeStudy({ status: "propose" })] });
    const comparison = migrated.studies[0].longitudinalComparisons![0];

    expect(comparison.status).toBe("proposed");
    expect(comparison.title).toBe("Changement potentiel detecte");
    expect(comparison.previousStateProposal?.summary).toBe("faible emotion declaree");
    expect(comparison.detectedDifferences).toHaveLength(1);
    expect(comparison.createdAt).toBeTruthy();
    expect(comparison.updatedAt).toBeTruthy();
    expect(comparison.resultStatus).toBe("transition_candidate");
    expect(comparison.noTransitionReason).toBeTruthy();
  });

  it("reanalyzes the full study from existing records without overwriting reviewed comparisons", () => {
    const validated = makeStudy({ status: "validated", generatedTransitionId: "transition-old" });
    const withThirdObservation: Study = {
      ...validated,
      observations: [
        ...validated.observations!,
        observation("obs-3", "Quelques jours plus tard, l'observateur estime qu'elle semble encore plus perdue.", "2026-07-17T10:00:00.000Z")
      ]
    };

    const result = reanalyzeLongitudinalComparisons(withThirdObservation, now);

    expect(result.study.longitudinalComparisons?.some((comparison) => comparison.id === "comparison-1" && comparison.status === "validated")).toBe(true);
    expect(result.study.longitudinalComparisons?.length).toBeGreaterThan(1);
    expect(result.study.observations?.find((item) => item.id === "obs-3")?.generatedLongitudinalComparisonIds?.length).toBeGreaterThan(0);
  });

  it("is deterministic and does not mutate inputs", () => {
    const study = makeStudy();
    const before = JSON.stringify(study);
    const first = validateLongitudinalComparison(study, "comparison-1", now);
    const second = validateLongitudinalComparison(study, "comparison-1", now);

    expect(JSON.stringify(study)).toBe(before);
    expect(first.study.transitions[0].id).toBe(second.study.transitions[0].id);
    expect(first.study.deltaScores?.[0].id).toBe(second.study.deltaScores?.[0].id);
  });
});

function makeStudy(patch: Partial<LongitudinalObservationComparison> = {}): Study {
  return {
    id: "study-1",
    title: "Etude",
    description: "Etude test",
    subject: "Incendies",
    startDate: "2026-07-16",
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
    observations: [
      observation("obs-1", "Les gens restent impassibles face aux incendies.", "2026-07-15T10:00:00.000Z"),
      observation("obs-2", "Les habitants expriment une inquietude pour les animaux.", "2026-07-16T10:00:00.000Z")
    ],
    openQuestions: [],
    structuredHistory: [],
    relationProposals: [],
    deltaScores: [],
    longitudinalComparisons: [comparison(patch)],
    createdAt: now,
    updatedAt: now
  };
}

function observation(id: string, rawText: string, createdAt: string): ObservationRecord {
  return {
    id,
    studyId: "study-1",
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
    generatedLongitudinalComparisonIds: [],
    enginesExecuted: [],
    engineResultsSummary: [],
    methodologicalWarnings: [],
    sourceExcerpts: [rawText],
    openQuestions: []
  };
}

function comparison(patch: Partial<LongitudinalObservationComparison>): LongitudinalObservationComparison {
  return {
    id: "comparison-1",
    studyId: "study-1",
    sourceObservationIds: ["obs-1", "obs-2"],
    previousObservationId: "obs-1",
    currentObservationId: "obs-2",
    title: "Changement potentiel detecte",
    comparableObservations: [],
    dimensionsCompared: [{ key: "emotion", label: "Emotion exprimee", previous: ["faible emotion"], current: ["inquietude"] }],
    differences: [{ dimension: "emotion", label: "Emotion exprimee", previous: ["faible emotion"], current: ["inquietude"], summary: "Variation emotionnelle." }],
    proposedPreviousState: { scope: "collectif", evidenceLevel: "faible", summary: "faible emotion declaree", elements: ["faible emotion declaree"] },
    proposedCurrentState: { scope: "collectif", evidenceLevel: "moyen", summary: "inquietude pour les animaux", elements: ["inquietude pour les animaux"] },
    potentialTransition: "Changement potentiel detecte",
    missingData: [],
    methodologicalLimits: ["limite initiale"],
    confirmationQuestions: ["Confirmer ?"],
    sourceExcerpts: [{ observationId: "obs-1", excerpt: "Avant" }, { observationId: "obs-2", excerpt: "Apres" }],
    comparedAt: now,
    engine: "LongitudinalObservationEngine",
    engineVersion: "LongitudinalObservationEngine:v1",
    status: "proposed",
    confidence: "moyen",
    conclusion: "Changement detecte.",
    ...patch
  };
}
