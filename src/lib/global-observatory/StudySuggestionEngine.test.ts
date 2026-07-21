import { describe, expect, it } from "vitest";
import { GlobalObservatory } from "./GlobalObservatory";
import { SourceManager } from "./SourceManager";
import { StudySuggestionEngine } from "./StudySuggestionEngine";

describe("StudySuggestionEngine", () => {
  it("creates a study with event, sources, hypotheses, categories and links", () => {
    const state = GlobalObservatory.collect(SourceManager.createInitialState("2026-07-21T10:00:00.000Z"), undefined, "2026-07-21T10:00:00.000Z");
    const event = state.events[0];
    const study = StudySuggestionEngine.createStudy(event, "2026-07-21T11:00:00.000Z", "study-global");
    expect(study.subject).toBe(event.title);
    expect(study.description).toContain("Sources utilisees");
    expect(study.description).toContain(event.sources[0].connectorName);
    expect(study.notes).toContain(event.categories.join(", "));
    expect(study.openQuestions?.length).toBeGreaterThan(0);
  });
});
