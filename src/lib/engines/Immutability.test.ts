import { describe, expect, it } from "vitest";
import { DeltaEngine } from "./DeltaEngine";
import { EmotionEngine } from "./EmotionEngine";
import { RelationEngine } from "./RelationEngine";
import { StateDifferenceEngine } from "./StateDifferenceEngine";
import { TrajectoryEngine } from "./TrajectoryEngine";
import { fixtureStudy, secondFixtureStudy, stableStateA, conceptAddedState } from "./__fixtures__/reflexivity-fixtures";

describe("engine immutability", () => {
  it("does not mutate input data", () => {
    const beforeStateSnapshot = JSON.stringify(stableStateA);
    const afterStateSnapshot = JSON.stringify(conceptAddedState);
    const studySnapshot = JSON.stringify(fixtureStudy);
    const secondStudySnapshot = JSON.stringify(secondFixtureStudy);

    const difference = StateDifferenceEngine.compare(stableStateA, conceptAddedState);
    DeltaEngine.calculate(difference);
    RelationEngine.analyze(fixtureStudy);
    EmotionEngine.detectSequences([fixtureStudy]);
    TrajectoryEngine.compare([fixtureStudy, secondFixtureStudy]);

    expect(JSON.stringify(stableStateA)).toBe(beforeStateSnapshot);
    expect(JSON.stringify(conceptAddedState)).toBe(afterStateSnapshot);
    expect(JSON.stringify(fixtureStudy)).toBe(studySnapshot);
    expect(JSON.stringify(secondFixtureStudy)).toBe(secondStudySnapshot);
  });
});
