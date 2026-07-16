import { describe, expect, it } from "vitest";
import { LongitudinalObservationEngine } from "./LongitudinalObservationEngine";
import type { ObservationRecord, Study } from "@/lib/types";

const previousText =
  "Habituellement, lorsqu'il y a des incendies de foret dans le sud de la France ou dans le monde, les gens n'ont pas de reaction et ne montrent pas d'emotion particuliere. Les Francais sont impassibles face aux consequences causees par les incendies.";

const currentText =
  "Il y a en ce moment un incendie dans la foret de Fontainebleau et la reaction des gens est differente : ils s'inquietent pour les animaux et ont lance des actions de solidarite. Ils sont prets a s'impliquer dans la sauvegarde de la faune et de la flore.";

describe("LongitudinalObservationEngine", () => {
  it("detects a variation between two separate observations while respecting chronology", () => {
    const study = makeStudy();
    const previous = makeRecord("obs-1", previousText, "2026-07-15T10:00:00.000Z");
    const current = makeRecord("obs-2", currentText, "2026-07-16T10:00:00.000Z");

    const result = LongitudinalObservationEngine.compare(study, [current, previous], current, "2026-07-16T11:00:00.000Z");

    expect(result.previousObservationId).toBe(previous.id);
    expect(result.potentialTransition).toBe("Changement potentiel detecte dans les reactions collectives decrites.");
    expect(result.status).toBe("proposed");
  });

  it("detects emotion, mobilization, action and attention shifts in the Fontainebleau case", () => {
    const study = makeStudy();
    const previous = makeRecord("obs-1", previousText, "2026-07-15T10:00:00.000Z");
    const current = makeRecord("obs-2", currentText, "2026-07-16T10:00:00.000Z");

    const result = LongitudinalObservationEngine.compare(study, [previous, current], current);
    const differenceDimensions = result.differences.map((difference) => difference.dimension);

    expect(differenceDimensions).toContain("emotion");
    expect(differenceDimensions).toContain("mobilisation");
    expect(differenceDimensions).toContain("comportement");
    expect(differenceDimensions).toContain("objetAttention");
    expect(result.proposedPreviousState?.elements).toContain("faible emotion declaree");
    expect(result.proposedPreviousState?.elements).toContain("faible mobilisation declaree");
    expect(result.proposedPreviousState?.elements).toContain("portee : collectif");
    expect(result.proposedPreviousState?.evidenceLevel).toBe("faible");
    expect(result.proposedCurrentState?.elements).toContain("inquietude pour les animaux");
    expect(result.proposedCurrentState?.elements).toContain("actions de solidarite");
    expect(result.proposedCurrentState?.elements).toContain("volonte d'implication");
    expect(result.proposedCurrentState?.elements).toContain("attention portee a animaux");
    expect(result.proposedCurrentState?.elements).toContain("attention portee a faune");
    expect(result.proposedCurrentState?.elements).toContain("attention portee a flore");
    expect(result.proposedCurrentState?.elements.some((element) => /fontainebleau/i.test(element))).toBe(true);
  });

  it("flags collective generalization and never concludes to a durable national change", () => {
    const study = makeStudy();
    const previous = makeRecord("obs-1", previousText, "2026-07-15T10:00:00.000Z");
    const current = makeRecord("obs-2", currentText, "2026-07-16T10:00:00.000Z");

    const result = LongitudinalObservationEngine.compare(study, [previous, current], current);

    expect(result.methodologicalLimits.join(" ")).toContain("generalisation collective declaree");
    expect(result.methodologicalLimits.join(" ")).toContain("observation ponctuelle et localisee");
    expect(result.conclusion).toBe(
      "Les observations decrivent des reactions differentes. Les donnees sont insuffisantes pour conclure a un changement durable de la population francaise ou a une causalite precise."
    );
    expect(result.conclusion).not.toBe("Un changement national durable est confirme.");
  });

  it("keeps source excerpts for both observations and produces confirmation questions", () => {
    const study = makeStudy();
    const previous = makeRecord("obs-1", previousText, "2026-07-15T10:00:00.000Z");
    const current = makeRecord("obs-2", currentText, "2026-07-16T10:00:00.000Z");

    const result = LongitudinalObservationEngine.compare(study, [previous, current], current);

    expect(result.sourceExcerpts).toEqual([
      { observationId: previous.id, excerpt: previousText },
      { observationId: current.id, excerpt: currentText }
    ]);
    expect(result.confirmationQuestions).toContain("Quelles sources documentent la reaction actuelle ?");
    expect(result.confirmationQuestions).toContain("La mobilisation concerne-t-elle quelques personnes ou une part importante de la population ?");
  });

  it("returns insufficient comparison when no earlier equivalent exists", () => {
    const study = makeStudy();
    const current = makeRecord("obs-2", currentText, "2026-07-16T10:00:00.000Z");

    const result = LongitudinalObservationEngine.compare(study, [current], current);

    expect(result.previousObservationId).toBeUndefined();
    expect(result.potentialTransition).toBeNull();
    expect(result.missingData).toContain("aucune comparaison suffisante : aucune observation anterieure comparable dans cette etude.");
    expect(result.conclusion).toBe("Aucune comparaison suffisante avec une observation anterieure de cette etude.");
  });

  it("does not mutate input records or study", () => {
    const study = makeStudy();
    const previous = makeRecord("obs-1", previousText, "2026-07-15T10:00:00.000Z");
    const current = makeRecord("obs-2", currentText, "2026-07-16T10:00:00.000Z");
    const before = JSON.stringify({ study, previous, current });

    LongitudinalObservationEngine.compare(study, [previous, current], current);

    expect(JSON.stringify({ study, previous, current })).toBe(before);
  });
});

function makeStudy(): Study {
  return {
    id: "study-fire",
    title: "Etude incendies",
    description: "",
    subject: "Reactions aux incendies",
    startDate: "2026-07-15",
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
    observations: [],
    openQuestions: [],
    structuredHistory: [],
    relationProposals: [],
    deltaScores: [],
    longitudinalComparisons: [],
    createdAt: "2026-07-15T09:00:00.000Z",
    updatedAt: "2026-07-15T09:00:00.000Z"
  };
}

function makeRecord(id: string, rawText: string, createdAt: string): ObservationRecord {
  return {
    id,
    studyId: "study-fire",
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
