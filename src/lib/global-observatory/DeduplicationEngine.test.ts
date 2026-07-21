import { describe, expect, it } from "vitest";
import type { GlobalEventSource, GlobalObservedEvent } from "../types";
import { DeduplicationEngine } from "./DeduplicationEngine";

function article(id: string, title: string, url = `https://example.com/${id}`): GlobalEventSource {
  return {
    id,
    externalId: id,
    connectorId: "source-bbc-world",
    connectorName: "BBC World",
    title,
    url,
    publishedAt: "2026-07-21T10:00:00.000Z",
    country: "France",
    language: "fr",
    summary: "Une election provoque une contestation de legitimite institutionnelle.",
    authors: [],
    excerpts: [],
    collectedAt: "2026-07-21T10:00:00.000Z"
  };
}

function event(source: GlobalEventSource): GlobalObservedEvent {
  return {
    id: "event-a",
    title: source.title,
    normalizedTitle: source.title.toLowerCase(),
    summary: source.summary,
    country: source.country,
    startedAt: source.publishedAt,
    updatedAt: source.publishedAt,
    status: "active",
    categories: ["Politique"],
    themes: ["election"],
    sourceIds: [source.id],
    sources: [source],
    mergeCandidates: [],
    learningWeight: 0,
    createdStudyIds: []
  };
}

describe("DeduplicationEngine", () => {
  it("detects copies of the same article by canonical URL", () => {
    const existing = article("a", "Election presidentielle", "https://example.com/a?utm_source=x");
    const incoming = article("b", "Autre titre", "https://example.com/a");
    expect(DeduplicationEngine.decide([event(existing)], incoming).kind).toBe("duplicate-article");
  });

  it("detects several articles describing the same event", () => {
    const decision = DeduplicationEngine.decide(
      [event(article("a", "Election presidentielle et contestation publique"))],
      article("b", "Election presidentielle et contestation publique en France", "https://example.com/b")
    );
    expect(decision.kind).toBe("same-event-auto");
  });

  it("keeps similar but insufficiently close events distinct or for review", () => {
    const decision = DeduplicationEngine.decide(
      [event(article("a", "Election presidentielle et contestation publique"))],
      article("b", "Reforme sanitaire dans les hopitaux", "https://example.com/b")
    );
    expect(["distinct-event", "same-event-review"]).toContain(decision.kind);
  });
});
