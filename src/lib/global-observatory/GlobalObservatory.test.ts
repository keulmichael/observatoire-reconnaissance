import { describe, expect, it } from "vitest";
import type { GlobalEventSource } from "../types";
import { Dashboard } from "./Dashboard";
import { GlobalObservatory } from "./GlobalObservatory";
import { InterestScorer } from "./InterestScorer";
import { LearningEngine } from "./LearningEngine";
import { MapEngine } from "./MapEngine";
import { NewsClassifier } from "./NewsClassifier";
import { NewsCollector } from "./NewsCollector";
import { ReflexiveAnalyzer } from "./ReflexiveAnalyzer";
import { SourceManager } from "./SourceManager";
import { StudySuggestionEngine } from "./StudySuggestionEngine";

const now = "2026-07-21T10:00:00.000Z";

function source(id: string, title: string, summary: string, connectorName = "BBC World"): GlobalEventSource {
  return {
    id,
    connectorId: "source-bbc-world",
    connectorName,
    title,
    publishedAt: now,
    country: "France",
    language: "fr",
    summary,
    authors: [],
    excerpts: [
      {
        id: `${id}-excerpt`,
        text: summary,
        location: "test",
        claimIds: []
      }
    ],
    collectedAt: now
  };
}

describe("GlobalObservatory engines", () => {
  it("initializes configurable sources with an empty observable-event state", () => {
    const state = SourceManager.createInitialState(now);
    expect(state.sources.length).toBeGreaterThan(0);
    expect(state.events).toEqual([]);
    expect(state.dashboard.activeEvents).toBe(0);
  });

  it("classifies a source without relying on hard-coded source names", () => {
    const categories = NewsClassifier.classify(source("a", "Election et reforme institutionnelle", "Le gouvernement annonce une reforme."));
    expect(categories).toContain("Politique");
  });

  it("collects articles as sources and merges them into one observed event when confidence is high", () => {
    const initial = SourceManager.createInitialState(now);
    const first = source("a", "Election presidentielle et contestation publique", "Une election provoque une contestation de legitimite.");
    const second = {
      ...source("b", "Election presidentielle et contestation publique", "Plusieurs acteurs contestent la legitimite de l'election.", "The Guardian World"),
      connectorId: "source-guardian-world",
      url: "https://www.theguardian.com/world/b"
    };
    const collected = NewsCollector.collect(initial, { sources: [first, second], now });
    expect(collected.events).toHaveLength(1);
    expect(collected.events[0].sources).toHaveLength(2);
    expect(collected.events[0].mergeCandidates.some((candidate) => candidate.status === "auto-fusion")).toBe(true);
  });

  it("produces explainable analysis, score, map and dashboard data", () => {
    const collected = GlobalObservatory.collect(SourceManager.createInitialState(now), [
      source("a", "Crise d'accueil et deplacement de population", "Des tensions apparaissent entre accueil, securite et reconnaissance institutionnelle.")
    ], now);
    const event = collected.events[0];
    const analysis = ReflexiveAnalyzer.analyze(event, now);
    const scored = { ...event, analysis, interest: InterestScorer.score({ ...event, analysis }) };
    const dashboard = Dashboard.build([scored]);
    const points = MapEngine.build([scored]);
    expect(analysis.claims.every((claim) => claim.status !== "fait rapporté" || claim.sourceIds.length > 0)).toBe(true);
    expect(scored.interest.stars).toBeGreaterThanOrEqual(1);
    expect(dashboard.analyzedEvents).toBe(1);
    expect(points[0].eventId).toBe(event.id);
  });

  it("creates a traceable study suggestion and updates learning when retained", () => {
    const state = GlobalObservatory.collect(SourceManager.createInitialState(now), [
      source("a", "Usage de l'IA dans l'education", "Des institutions encadrent l'usage de l'IA a l'ecole.")
    ], now);
    const event = state.events[0];
    const suggestion = StudySuggestionEngine.suggest(event, now);
    const study = StudySuggestionEngine.createStudy({ ...event, studySuggestion: suggestion }, now, "study-test");
    const learned = LearningEngine.record(state, event.id, "study-retained", {
      suggestionId: suggestion.id,
      studyId: study.id,
      now
    });
    expect(study.description).toContain("Sources utilisees");
    expect(study.openQuestions?.length).toBeGreaterThan(0);
    expect(learned.events[0].createdStudyIds).toContain("study-test");
  });
});
