import { describe, expect, it } from "vitest";
import { StateDifferenceEngine } from "./StateDifferenceEngine";
import {
  conceptAddedState,
  conceptRemovedState,
  contradictionStateA,
  contradictionStateB,
  insufficientState,
  relationStateA,
  relationStateB,
  reformulatedStateA,
  reformulatedStateB,
  stableStateA,
  stableStateB
} from "./__fixtures__/reflexivity-fixtures";

describe("StateDifferenceEngine", () => {
  it("returns a null or stable variation for identical states", () => {
    const difference = StateDifferenceEngine.compare(stableStateA, stableStateB);

    expect(difference.stabilityLevel).toBe("stable");
    expect(difference.items.some((item) => item.kind === "stabilization")).toBe(true);
  });

  it("detects an added concept", () => {
    const difference = StateDifferenceEngine.compare(stableStateA, conceptAddedState);

    expect(difference.conceptsAdded).toContain("transmission prudente");
  });

  it("detects a removed concept", () => {
    const difference = StateDifferenceEngine.compare(stableStateA, conceptRemovedState);

    expect(difference.conceptsRemoved).toContain("fait distingue de l'hypothese");
  });

  it("proposes probable reformulation without automatic merge", () => {
    const difference = StateDifferenceEngine.compare(reformulatedStateA, reformulatedStateB);

    expect(difference.conceptsReformulated[0]).toMatchObject({
      before: "IA",
      after: "Intelligence artificielle",
      mergedAutomatically: false,
      status: "Confirmation utilisateur requise"
    });
  });

  it("detects an added relation", () => {
    const difference = StateDifferenceEngine.compare(relationStateA, relationStateB);

    expect(difference.relationsAdded).toContain("observation ↔ interpretation");
  });

  it("distinguishes a potential contradiction from a removal", () => {
    const difference = StateDifferenceEngine.compare(contradictionStateA, contradictionStateB);

    expect(difference.items.some((item) => item.kind === "potential-contradiction")).toBe(true);
  });

  it("returns explicit insufficient indicators when data is missing", () => {
    const difference = StateDifferenceEngine.compare(insufficientState, stableStateA);

    expect(difference.insufficientIndicators.length).toBeGreaterThan(0);
    expect(difference.items.some((item) => item.label === "Indicateurs insuffisants")).toBe(true);
  });
});
