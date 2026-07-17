import { describe, expect, it } from "vitest";
import { comparableUnderstandingStates, inferStateType } from "./scientific-model";
import type { Recognition, Study, UnderstandingState } from "./types";

const baseState: UnderstandingState = {
  id: "state-a",
  title: "Etat A",
  date: "2026-01-01",
  formulation: "Je comprends maintenant que l'observation doit être séparée de l'interprétation.",
  stability: 5,
  confidence: 5,
  confirmedElements: ["observation séparée de l'interprétation"],
  uncertainElements: [],
  language: ["je comprends maintenant"],
  associatedBehaviors: [],
  sourceObservationIds: ["obs-a"]
};

describe("scientific model guardrails", () => {
  it("does not classify an emotion-only state as an UnderstandingState", () => {
    const state: UnderstandingState = {
      ...baseState,
      id: "emotion-only",
      formulation: "La personne se dit inquiète et confuse.",
      confirmedElements: [],
      language: ["inquiétude", "confusion"]
    };

    expect(inferStateType(state)).toBe("EmotionalState");
  });

  it("requires comparable understanding states before transition construction", () => {
    const behaviourState: UnderstandingState = {
      ...baseState,
      id: "behaviour",
      formulation: "La personne change sa méthode de travail.",
      confirmedElements: [],
      associatedBehaviors: ["change sa méthode de travail"],
      language: []
    };

    expect(comparableUnderstandingStates(baseState, behaviourState)).toBe(false);
  });

  it("keeps recognitions tied to a source observation", () => {
    const recognition: Recognition = {
      id: "recognition-valid",
      title: "Reconnaissance validée",
      date: "2026-01-02",
      studyId: "study-a",
      exactWording: "Je comprends maintenant la différence.",
      author: "Sujet",
      beforeStateId: "state-a",
      afterStateId: "state-b",
      triggers: [],
      newRecognizedRelations: [],
      emotions: [],
      catalysts: [],
      languageImpact: "formulation directe",
      decisionImpact: "non documenté",
      relationImpact: "non documenté",
      projectImpact: "non documenté",
      transmissible: false,
      confirmed: true,
      stableOverTime: false,
      confirmationLevel: 1,
      sourceObservationIds: ["obs-a"]
    };
    const study: Pick<Study, "id" | "recognitions"> = { id: "study-a", recognitions: [recognition] };

    expect(study.recognitions.every((item) => item.studyId === study.id && item.sourceObservationIds?.length)).toBe(true);
  });
});
