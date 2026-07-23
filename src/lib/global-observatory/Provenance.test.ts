import { describe, expect, it } from "vitest";
import type { GlobalEventSource, GlobalObservedEvent } from "../types";
import { StudySuggestionEngine } from "./StudySuggestionEngine";
import { eventContainsUnverifiedData, eventProvenanceStatus, provenanceLabel, sourceProvenanceStatus } from "./Provenance";

describe("global observatory provenance", () => {
  it("detecte les marqueurs historiques simules existants", () => {
    const source = sourceFixture({
      externalId: "source-bbc-world:2026-01-01:0",
      title: "BBC World - Politique observe le 2026-01-01",
      url: "https://feeds.bbci.co.uk/news/world/rss.xml#2026-01-01-0",
      location: "historical:synthetic-page"
    });

    expect(sourceProvenanceStatus(source)).toBe("simulated");
    expect(eventProvenanceStatus(eventFixture([source]))).toBe("simulated");
    expect(provenanceLabel("real")).toBe("Reel verifie");
  });

  it("marque une etude creee par derogation depuis des donnees simulees", () => {
    const event = eventFixture([sourceFixture({ provenance: { kind: "simulated", connector: "source-bbc-world" } })]);

    expect(eventContainsUnverifiedData(event)).toBe(true);
    const study = StudySuggestionEngine.createStudy(event, "2026-01-08T00:00:00.000Z", "study-test");

    expect(study.notes).toContain("Avertissement provenance");
    expect(study.notes).toContain("donnee simulee");
  });
});

function sourceFixture(overrides: Partial<GlobalEventSource> & { location?: string } = {}): GlobalEventSource {
  return {
    id: "article-1",
    externalId: overrides.externalId,
    connectorId: "source-bbc-world",
    connectorName: "BBC World",
    title: overrides.title ?? "Article",
    url: overrides.url,
    publishedAt: "2026-01-01T12:00:00.000Z",
    country: "Monde",
    language: "fr",
    summary: "Resume",
    authors: [],
    excerpts: [{
      id: "excerpt-1",
      text: "Extrait",
      location: overrides.location ?? "test",
      claimIds: []
    }],
    collectedAt: "2026-01-01T13:00:00.000Z",
    provenance: overrides.provenance
  };
}

function eventFixture(sources: GlobalEventSource[]): GlobalObservedEvent {
  return {
    id: "event-1",
    title: "Evenement",
    normalizedTitle: "evenement",
    summary: "Resume",
    startedAt: "2026-01-01",
    updatedAt: "2026-01-01T13:00:00.000Z",
    status: "active",
    categories: ["Politique"],
    themes: [],
    sourceIds: sources.map((source) => source.id),
    sources,
    mergeCandidates: [],
    learningWeight: 0,
    createdStudyIds: []
  };
}
