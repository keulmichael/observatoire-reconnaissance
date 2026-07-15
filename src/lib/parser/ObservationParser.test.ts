import { describe, expect, it } from "vitest";
import { DeltaEngine } from "../engines/DeltaEngine";
import { RelationEngine } from "../engines/RelationEngine";
import { StateDifferenceEngine } from "../engines/StateDifferenceEngine";
import type { ObservationAnalysisDraft, ObservationProposalStatus } from "../types";
import { parseObservation } from "./ObservationParser";
import { constructScientificStudy } from "./ScientificConstruction";

const demoObservation =
  "Hier, j'ai présenté un nouveau cadre de réflexion à une personne. Aujourd'hui, elle m'a dit qu'elle se sentait perdue depuis la veille. Je ne connais pas encore la raison.";

describe("ObservationParser", () => {
  it("keeps the raw text strictly unchanged", () => {
    const draft = parseObservation(demoObservation, "2026-07-15T10:00:00.000Z");

    expect(draft.rawText).toBe(demoObservation);
  });

  it("returns identical results for identical analyses", () => {
    const first = parseObservation(demoObservation, "2026-07-15T10:00:00.000Z");
    const second = parseObservation(demoObservation, "2026-07-15T10:00:00.000Z");

    expect(second).toEqual(first);
  });

  it("detects a quoted or reported emotion without adding a diagnosis", () => {
    const draft = parseObservation(demoObservation, "2026-07-15T10:00:00.000Z");
    const emotion = draft.detectedEmotions.find((item) => item.emotion.toLowerCase() === "perdue");

    expect(emotion).toMatchObject({
      expressionKind: "exprimee directement",
      sourceKind: "discours rapporte",
      status: "proposed"
    });
    expect(emotion?.reason).toContain("Aucun diagnostic psychologique n'est ajoute.");
  });

  it("keeps temporal relations as hypotheses", () => {
    const draft = parseObservation(demoObservation, "2026-07-15T10:00:00.000Z");

    expect(draft.relationProposals[0]).toMatchObject({
      relationType: "relation temporelle",
      initialStatus: "hypothese",
      status: "proposed"
    });
  });

  it("does not create a final state without an explicit before/after understanding change", () => {
    const draft = validateAll(parseObservation(demoObservation, "2026-07-15T10:00:00.000Z"));
    const result = constructScientificStudy(draft, "2026-07-15T10:00:00.000Z");

    expect(result.study.states).toHaveLength(0);
    expect(result.study.transitions).toHaveLength(0);
  });

  it("does not create a Recognition from an emotion alone", () => {
    const draft = validateAll(parseObservation("Elle m'a dit qu'elle etait perdue.", "2026-07-15T10:00:00.000Z"));
    const result = constructScientificStudy(draft, "2026-07-15T10:00:00.000Z");

    expect(result.study.recognitions).toHaveLength(0);
  });

  it("does not calculate Delta without two valid states", () => {
    const draft = validateAll(parseObservation(demoObservation, "2026-07-15T10:00:00.000Z"));
    const result = constructScientificStudy(draft, "2026-07-15T10:00:00.000Z");

    expect(result.stateDifference).toBeNull();
    expect(result.delta).toBeNull();
  });

  it("marks every detected proposal as initially non validated", () => {
    const draft = parseObservation(demoObservation, "2026-07-15T10:00:00.000Z");
    const proposals = allProposals(draft);

    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.every((item) => item.status === "proposed")).toBe(true);
  });

  it("keeps a source excerpt for every proposal", () => {
    const draft = parseObservation(demoObservation, "2026-07-15T10:00:00.000Z");

    expect(allProposals(draft).every((item) => item.sourceExcerpt.length > 0)).toBe(true);
  });

  it("does not integrate rejected proposals into Study", () => {
    const draft = validateAll(parseObservation(demoObservation, "2026-07-15T10:00:00.000Z"));
    const rejectedLabel = draft.detectedManifestations[0]?.label;
    draft.detectedManifestations = draft.detectedManifestations.map((item, index) =>
      index === 0 ? { ...item, status: "rejected" } : item
    );
    const result = constructScientificStudy(draft, "2026-07-15T10:00:00.000Z");

    expect(result.study.manifestations.map((item) => item.title)).not.toContain(rejectedLabel);
  });

  it("uses the edited proposal value during construction", () => {
    const draft = validateAll(parseObservation("Hier, j'ai présenté une theorie.", "2026-07-15T10:00:00.000Z"));
    draft.detectedManifestations = draft.detectedManifestations.map((item) => ({
      ...item,
      label: "presentation editee",
      status: "edited"
    }));
    const result = constructScientificStudy(draft, "2026-07-15T10:00:00.000Z");

    expect(result.study.manifestations.map((item) => item.title)).toContain("presentation editee");
  });

  it("produces insufficient data for the demonstration case", () => {
    const draft = parseObservation(demoObservation, "2026-07-15T10:00:00.000Z");

    expect(draft.detectedManifestations.map((item) => item.label)).toContain("presentation d'un cadre de reflexion");
    expect(draft.detectedPeople.map((item) => item.entityText)).toContain("une personne");
    expect(draft.detectedEmotions.map((item) => item.emotion.toLowerCase())).toContain("perdue");
    expect(draft.chronology.map((item) => item.temporalMarker)).toEqual(expect.arrayContaining(["Hier", "Aujourd'hui"]));
    expect(draft.conclusion).toBe(
      "Variation ou perturbation possible observee, mais donnees insuffisantes pour construire une transition Delta complete."
    );
  });

  it("does not mutate parser inputs", () => {
    const input = demoObservation;
    parseObservation(input, "2026-07-15T10:00:00.000Z");

    expect(input).toBe(demoObservation);
  });

  it("produces scientific objects compatible with existing engines when two states exist", () => {
    const draft = validateAll(
      parseObservation(
        "Hier, j'ai présenté une idee. Aujourd'hui, il a dit que j'ai compris une nouvelle compréhension et je reformule cette idee.",
        "2026-07-15T10:00:00.000Z"
      )
    );
    const result = constructScientificStudy(draft, "2026-07-15T10:00:00.000Z");
    expect(result.study.states).toHaveLength(2);
    expect(result.stateDifference).toEqual(StateDifferenceEngine.compare(result.study.states[0], result.study.states[1]));
    expect(result.delta).toEqual(DeltaEngine.calculate(result.stateDifference!));
    expect(RelationEngine.analyze(result.study)).toEqual(result.relationEngineProposals);
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

function allProposals(draft: ObservationAnalysisDraft) {
  return [
    ...draft.detectedPeople,
    ...draft.detectedManifestations,
    ...draft.detectedEmotions,
    ...draft.detectedCatalysts,
    ...draft.detectedConcepts,
    ...draft.relationProposals
  ];
}
