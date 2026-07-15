import { describe, expect, it } from "vitest";
import { TrajectoryEngine } from "./TrajectoryEngine";
import { fixtureStudy, secondFixtureStudy } from "./__fixtures__/reflexivity-fixtures";

describe("TrajectoryEngine", () => {
  it("compares trajectories without using subject identity", () => {
    const [comparison] = TrajectoryEngine.compare([fixtureStudy, secondFixtureStudy]);

    expect(comparison.studyIds).toEqual(["study-fixture", "study-fixture-2"]);
    expect(comparison.excludedDimensions).toContain("personnes");
    expect(comparison.excludedDimensions).toContain("sujets nominatifs");
    expect(comparison.comparedDimensions).toContain("sequences d'etats");
    expect(comparison.similarity).toBeGreaterThan(0);
  });
});
