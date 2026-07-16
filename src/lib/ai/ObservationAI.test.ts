import { describe, expect, it } from "vitest";
import { migrateObservatoryData } from "../data-migration";
import { parseObservation } from "../parser/ObservationParser";
import type { AIProvider } from "./ObservationAI";
import { analyzeWithObservationAI, defaultAISettings } from "./ObservationAI";
import { mergeObservationAnalyses, parserDraftToAIResponse } from "./ObservationMerge";
import { normalizeAIResponse } from "./ObservationAISchema";

class FakeProvider implements AIProvider {
  readonly id = "fake";
  calls = 0;

  async analyze() {
    this.calls += 1;
    return {
      response: {
        people: [],
        organisations: [],
        places: [],
        manifestations: [
          {
            id: "ai-fire",
            type: "manifestation",
            label: "Incendie de foret",
            excerpt: "Les habitants s'inquietent pour les animaux",
            confidence: 0.98,
            reason: "Lecture semantique proposee.",
            source: "ai",
            status: "proposed"
          }
        ],
        events: [],
        objects: [
          {
            id: "ai-animals",
            type: "object",
            label: "Animaux",
            excerpt: "les animaux",
            confidence: 0.94,
            reason: "Objet d'attention explicite.",
            source: "ai",
            status: "proposed"
          }
        ],
        concepts: [{ id: "ai-solidarity", type: "concept", label: "Solidarite", excerpt: "solidarite", confidence: 0.93, reason: "Concept observe.", source: "ai", status: "proposed" }],
        emotions: [{ id: "ai-worry", type: "emotion", label: "Inquietude", excerpt: "s'inquietent", confidence: 0.96, reason: "Emotion attribuee au groupe.", source: "ai", status: "proposed" }],
        emotionScope: [],
        behaviours: [{ id: "ai-mobilisation", type: "behaviour", label: "Mobilisation", excerpt: "lancent des actions", confidence: 0.92, reason: "Comportement collectif.", source: "ai", status: "proposed" }],
        decisions: [],
        intentions: [],
        relations: [],
        questions: [{ id: "ai-q1", type: "question", label: "La solidarite est-elle durable ?", excerpt: "solidarite", confidence: 0.7, reason: "Point a valider.", source: "ai", status: "proposed" }],
        timeline: [],
        confidence: 0.9,
        limitations: ["Lecture non conclusive."],
        uncertainties: ["Cause de l'inquietude a confirmer."],
        reasoningSummary: "Resume non decisif."
      },
      tokenUsage: { totalTokens: 42 }
    };
  }
}

describe("Observation Intelligence Layer", () => {
  it("keeps local mode deterministic and offline-capable", async () => {
    const draft = parseObservation("Les habitants s'inquietent pour les animaux.");
    const result = await analyzeWithObservationAI({ draft, settings: { ...defaultAISettings, mode: "local" } });

    expect(result.result.status).toBe("disabled");
    expect(result.draft.observationMode).toBe("local");
    expect(result.draft.aiAnalysis).toBeUndefined();
    expect(result.draft.mergedObservation?.differences.every((item) => item.mergeStatus === "parser-only")).toBe(true);
  });

  it("runs assisted mode through a provider abstraction and never creates scientific objects directly", async () => {
    const provider = new FakeProvider();
    const draft = parseObservation("Les habitants s'inquietent pour les animaux et lancent des actions de solidarite.");
    const result = await analyzeWithObservationAI({
      draft,
      settings: { ...defaultAISettings, mode: "ai-assisted" },
      provider
    });

    expect(provider.calls).toBe(1);
    expect(result.result.status).toBe("success");
    expect(result.draft.detectedEmotions.some((item) => item.label === "Inquietude" && item.status === "proposed")).toBe(true);
    expect(result.draft.status).toBe("draft");
  });

  it("merges convergent parser and AI proposals while keeping disagreements separate", () => {
    const draft = parseObservation("Une situation provoque une inquietude.");
    const parser = parserDraftToAIResponse(draft);
    const ai = normalizeAIResponse({
      ...emptyPayload(),
      manifestations: [{ id: "ai-situation", type: "manifestation", label: "Evenement de crise", excerpt: "situation", confidence: 0.98, reason: "Plus precis.", source: "ai", status: "proposed" }],
      emotions: [{ id: "ai-joie", type: "emotion", label: "Joie", excerpt: "inquietude", confidence: 0.4, reason: "Divergence volontaire.", source: "ai", status: "proposed" }]
    });
    const merged = mergeObservationAnalyses(parser, ai, "2026-01-01T00:00:00.000Z");

    expect(merged.manifestations.some((item) => item.mergeStatus === "convergence" && item.sources.includes("parser") && item.sources.includes("ai"))).toBe(true);
    expect(merged.differences.some((item) => item.label === "Joie" && item.mergeStatus === "ai-only")).toBe(true);
  });

  it("reuses cache for the same observation and model settings", async () => {
    const provider = new FakeProvider();
    const draft = parseObservation("Une personne exprime une inquietude.");
    const first = await analyzeWithObservationAI({ draft, settings: { ...defaultAISettings, mode: "ai-assisted" }, provider });
    const second = await analyzeWithObservationAI({
      draft,
      settings: { ...defaultAISettings, mode: "ai-assisted" },
      provider,
      cache: first.cache
    });

    expect(provider.calls).toBe(1);
    expect(second.result.status).toBe("cached");
  });

  it("records validation and persists AI trace after user acceptance", () => {
    const draft = parseObservation("Une personne exprime une inquietude.");
    const accepted = {
      ...draft,
      status: "validated" as const,
      observationMode: "ai-assisted" as const,
      aiResultId: "ai-result-1",
      detectedEmotions: draft.detectedEmotions.map((item) => ({ ...item, status: "accepted" as const }))
    };
    const migrated = migrateObservatoryData({ version: 1, studies: [], observationDrafts: [accepted] });

    expect(migrated.aiSettings?.mode).toBe("local");
    expect(migrated.aiObservationResults).toEqual([]);
    expect(migrated.observationDrafts?.[0].aiResultId).toBe("ai-result-1");
  });

  it("supports provider switching by accepting any AIProvider implementation", async () => {
    const provider = new FakeProvider();
    const draft = parseObservation("Les habitants lancent des actions de solidarite.");
    const result = await analyzeWithObservationAI({
      draft,
      settings: { ...defaultAISettings, mode: "ai-assisted", model: "local-test-model" },
      provider
    });

    expect(result.result.model).toBe("local-test-model");
    expect(result.result.tokenUsage.totalTokens).toBe(42);
  });
});

function emptyPayload() {
  return {
    people: [],
    organisations: [],
    places: [],
    manifestations: [],
    events: [],
    objects: [],
    concepts: [],
    emotions: [],
    emotionScope: [],
    behaviours: [],
    decisions: [],
    intentions: [],
    relations: [],
    questions: [],
    timeline: [],
    confidence: 0,
    limitations: [],
    uncertainties: [],
    reasoningSummary: ""
  };
}
