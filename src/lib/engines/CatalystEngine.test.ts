import { describe, expect, it } from "vitest";
import { CatalystEngine } from "./CatalystEngine";
import { fixtureStudy } from "./__fixtures__/reflexivity-fixtures";

describe("CatalystEngine", () => {
  it("calculates catalyst metrics from observations only", () => {
    const [metric] = CatalystEngine.analyze([fixtureStudy]);

    expect(metric.name).toBe("journal");
    expect(metric.frequency).toBe(2);
    expect(metric.associatedTransitions).toBe(1);
    expect(metric.limits.join(" ")).toContain("sans causalite automatique");
  });
});
