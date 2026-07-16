import { describe, expect, it } from "vitest";
import { LongitudinalObservationEngine } from "../engines/LongitudinalObservationEngine";
import type { ObservationAnalysisDraft, ObservationProposalStatus, Study } from "../types";
import { extractEmotions } from "./EmotionExtractor";
import { parseObservation } from "./ObservationParser";
import { addObservationToStudy } from "./ScientificConstruction";

const fireBefore =
  "Habituellement, lorsqu'il y a des incendies de foret dans le sud de la France ou dans le monde, les gens n'ont pas de reaction et ne montrent pas d'emotion particuliere. Les Francais sont impassibles face aux consequences causees par les incendies.";

const fireAfter =
  "Il y a en ce moment un incendie dans la foret de Fontainebleau et la reaction des gens est differente : ils s'inquietent pour les animaux et ont lance des actions de solidarite. Ils sont prets a s'impliquer dans la sauvegarde de la faune et de la flore.";

describe("EmotionExtractor", () => {
  it("detects French worry variants and verbal forms", () => {
    const labels = [
      "Il est inquiet.",
      "Elle est inquiete.",
      "Ils sont inquiets.",
      "Elles sont inquietes.",
      "Il s'inquiete.",
      "Ils s'inquietent pour les animaux."
    ].flatMap((text) => extractEmotions(text).map((emotion) => emotion.canonicalEmotion));

    expect(labels.every((label) => label === "inquietude")).toBe(true);
  });

  it("detects declared absence of reaction and impassibility", () => {
    const emotions = extractEmotions("Les gens n'ont pas de reaction, aucune emotion, sans reaction. Les Francais sont impassibles.");

    expect(emotions.map((emotion) => emotion.canonicalEmotion)).toContain("absence de reaction declaree");
    expect(emotions.every((emotion) => emotion.polarity === "absent")).toBe(true);
  });

  it("does not mark negated worry as present", () => {
    const emotions = extractEmotions("Ils ne sont pas inquiets.");

    expect(emotions[0]).toMatchObject({
      canonicalEmotion: "inquietude",
      polarity: "negated"
    });
  });

  it("marks attributed uncertainty and direct quotes distinctly", () => {
    const attributed = extractEmotions("Je pense qu'ils sont inquiets.");
    const quoted = extractEmotions("Elle a dit : \"Je suis inquiete\".");

    expect(attributed[0]).toMatchObject({ expressionKind: "supposee" });
    expect(quoted[0]).toMatchObject({ sourceKind: "citation" });
  });

  it("handles accents, apostrophes and plural expressions deterministically", () => {
    const text = "Ils s’inquiètent, sont préoccupés et profondément touchés.";
    const first = extractEmotions(text);
    const second = extractEmotions(text);

    expect(first).toEqual(second);
    expect(first.map((emotion) => emotion.canonicalEmotion)).toEqual(
      expect.arrayContaining(["inquietude", "preoccupation", "tristesse"])
    );
  });

  it("keeps solidarity and implication as behavior, not emotion", () => {
    const emotions = extractEmotions("Ils ont lance des actions de solidarite et sont prets a s'impliquer.");

    expect(emotions).toHaveLength(0);
  });

  it("keeps raw input unchanged", () => {
    const text = "Ils s'inquietent pour les animaux.";
    extractEmotions(text);

    expect(text).toBe("Ils s'inquietent pour les animaux.");
  });

  it("persists accepted detections through ObservationRecord and EmotionObservation", () => {
    const study = makeStudy();
    const draft = validateAll(parseObservation(fireAfter, "2026-07-16T10:00:00.000Z"));
    const result = addObservationToStudy(draft, study, [study], "2026-07-16T11:00:00.000Z").study;

    expect(result.observations?.[0].detectedEmotions.some((emotion) => emotion.canonicalEmotion === "inquietude")).toBe(true);
    expect(result.emotionObservations.some((emotion) => emotion.canonicalEmotion === "inquietude")).toBe(true);
    expect(result.timeline.some((event) => event.sourceObservationIds?.includes(draft.id))).toBe(true);
  });

  it("supports the two fire observations in longitudinal comparison without automatic validation", () => {
    const study = makeStudy();
    const firstStudy = addObservationToStudy(
      validateAll(parseObservation(fireBefore, "2026-07-15T10:00:00.000Z")),
      study,
      [study],
      "2026-07-15T11:00:00.000Z"
    ).study;
    const secondStudy = addObservationToStudy(
      validateAll(parseObservation(fireAfter, "2026-07-16T10:00:00.000Z")),
      firstStudy,
      [firstStudy],
      "2026-07-16T11:00:00.000Z"
    ).study;
    const comparison = secondStudy.longitudinalComparisons?.at(-1);

    expect(comparison?.potentialTransition).toBe("Changement potentiel detecte dans les reactions collectives decrites.");
    expect(comparison?.status).toBe("proposed");
    expect(comparison?.conclusion).toContain("insuffisantes pour conclure");
    expect(comparison?.differences.map((difference) => difference.dimension)).toContain("mobilisation");
  });

  it("uses the same shared emotion source for longitudinal comparison", () => {
    const study = makeStudy();
    const before = validateAll(parseObservation(fireBefore, "2026-07-15T10:00:00.000Z"));
    const after = validateAll(parseObservation(fireAfter, "2026-07-16T10:00:00.000Z"));
    const firstStudy = addObservationToStudy(before, study, [study], "2026-07-15T11:00:00.000Z").study;
    const secondStudy = addObservationToStudy(after, firstStudy, [firstStudy], "2026-07-16T11:00:00.000Z").study;
    const records = secondStudy.observations ?? [];
    const comparison = LongitudinalObservationEngine.compare(secondStudy, records, records[1], "2026-07-16T12:00:00.000Z");

    expect(comparison.dimensionsCompared.find((dimension) => dimension.key === "emotion")?.current).toContain("inquietude");
  });
});

function validateAll(draft: ObservationAnalysisDraft): ObservationAnalysisDraft {
  return {
    ...draft,
    status: "validated",
    detectedPeople: draft.detectedPeople.map(withStatus("accepted")),
    detectedManifestations: draft.detectedManifestations.map(withStatus("accepted")),
    detectedEmotions: draft.detectedEmotions.map(withStatus("accepted")),
    detectedCatalysts: draft.detectedCatalysts.map(withStatus("accepted")),
    detectedConcepts: draft.detectedConcepts.map(withStatus("accepted")),
    relationProposals: draft.relationProposals.map(withStatus("accepted")),
    chronology: draft.chronology.map((item) => ({ ...item, status: "accepted" }))
  };
}

function withStatus<T extends { status: ObservationProposalStatus }>(status: ObservationProposalStatus) {
  return (item: T): T => ({ ...item, status });
}

function makeStudy(): Study {
  return {
    id: "study-fire",
    title: "Etude incendies",
    description: "",
    subject: "Incendies",
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
