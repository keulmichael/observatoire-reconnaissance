import { describe, expect, it } from "vitest";
import { EmotionEngine } from "./EmotionEngine";
import { fixtureStudy } from "./__fixtures__/reflexivity-fixtures";

describe("EmotionEngine", () => {
  it("counts an observed sequence without causal meaning", () => {
    const sequences = EmotionEngine.detectSequences([fixtureStudy], 3);

    expect(sequences[0]).toMatchObject({
      sequence: ["confusion", "questionnement", "apaisement"],
      count: 1,
      label: "Observation"
    });
    expect(sequences[0].limits.join(" ")).toContain("sans attribution de signification causale");
  });
});
