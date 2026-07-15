import { describe, expect, it } from "vitest";
import { LanguageEngine } from "./LanguageEngine";

describe("LanguageEngine", () => {
  it("detects vocabulary evolution and probable reformulations", () => {
    const result = LanguageEngine.compare(["IA", "observation locale"], ["Intelligence artificielle", "observation locale"]);

    expect(result.newWords).toContain("intelligence");
    expect(result.abandonedWords).toContain("ia");
    expect(result.reformulationCandidates[0].mergedAutomatically).toBe(false);
  });
});
