import { describe, expect, it } from "vitest";
import { RelationEngine } from "./RelationEngine";
import { fixtureStudy } from "./__fixtures__/reflexivity-fixtures";

describe("RelationEngine", () => {
  it("never returns an automatically confirmed relation", () => {
    const proposals = RelationEngine.analyze(fixtureStudy);

    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.every((proposal) => proposal.initialStatus === "hypothese")).toBe(true);
    expect(proposals.every((proposal) => proposal.actions.includes("valider") && proposal.actions.includes("rejeter"))).toBe(true);
  });
});
