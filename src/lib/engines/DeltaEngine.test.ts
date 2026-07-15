import { describe, expect, it } from "vitest";
import { DeltaEngine } from "./DeltaEngine";
import { StateDifferenceEngine } from "./StateDifferenceEngine";
import { conceptAddedState, stableStateA } from "./__fixtures__/reflexivity-fixtures";

describe("DeltaEngine", () => {
  it("exposes the complete calculation detail", () => {
    const difference = StateDifferenceEngine.compare(stableStateA, conceptAddedState);
    const delta = DeltaEngine.calculate(difference);

    expect(typeof delta.score).toBe("number");
    expect(delta.positiveFactors.length).toBeGreaterThan(0);
    expect(delta.negativeFactors).toBeInstanceOf(Array);
    expect(delta.neutralFactors).toBeInstanceOf(Array);
    expect(delta.limits.join(" ")).toContain("jamais une verite");
    expect(delta.interpretation).toBe("variation observable");
  });
});
