import { describe, expect, it } from "vitest";
import { StudySynthesisEngine } from "./StudySynthesisEngine";
import type { ObservationRecord, Study } from "@/lib/types";

describe("StudySynthesisEngine", () => {
  it("genere une synthese structuree et tracee a partir des observations de l'etude", () => {
    const study = buildStudy([
      record("obs-1", "Hier, Marie exprimait du mepris pour cette idee et disait la rejeter."),
      record("obs-2", "Aujourd'hui, Marie parle avec idolatrie de cette meme idee et la place au centre.")
    ]);

    const synthesis = new StudySynthesisEngine().generate(study);

    expect(synthesis.model).toBe("StudySynthesisEngine:deterministic-v1");
    expect(synthesis.observationsAnalyzed).toBe(2);
    expect(synthesis.sections.map((section) => section.title)).toEqual([
      "1. Présentation de l'étude",
      "2. Résumé général",
      "3. Analyse statistique",
      "4. Analyse réflexive",
      "5. Vérification de la Théorie de la Réflexivité Universelle",
      "6. Hypothèses émergentes",
      "7. Limites de l'étude",
      "8. Niveau de confiance",
      "9. Pistes de recherche"
    ]);
    const claims = synthesis.sections.flatMap((section) => section.claims);
    expect(claims.some((claim) => claim.kind === "limite")).toBe(true);
    expect(claims.every((claim) => claim.evidence.every((item) => ["obs-1", "obs-2"].includes(item.observationId)))).toBe(true);
    expect(synthesis.markdown).toContain("Conclusions tracées");
  });
});

function buildStudy(observations: ObservationRecord[]): Study {
  return {
    id: "study-synthesis",
    title: "Etude de synthese",
    description: "Evaluer une trajectoire de reconnaissance.",
    subject: "Reconnaissance d'une idee",
    startDate: "2026-01-01",
    status: "Observation ouverte",
    currentLevel: "Observation ouverte",
    notes: "",
    states: [],
    manifestations: [],
    transitions: [],
    recognitions: [],
    catalysts: [],
    emotionObservations: [],
    relations: [],
    timeline: [],
    map: { nodes: [], edges: [] },
    history: [],
    observations,
    openQuestions: [],
    structuredHistory: [],
    relationProposals: [],
    deltaScores: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z"
  };
}

function record(id: string, rawText: string): ObservationRecord {
  return {
    id,
    studyId: "study-synthesis",
    rawText,
    createdAt: id === "obs-1" ? "2026-01-01T00:00:00.000Z" : "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    status: "active",
    detectedPeople: [],
    detectedManifestations: [],
    detectedEmotions: [],
    detectedCatalysts: [],
    detectedConcepts: [{ id: `${id}-concept`, label: "idee", concept: "idee", sourceExcerpt: rawText, confidence: 0.8, status: "accepted", reason: "Concept explicite.", provenance: ["local-parser"] }],
    detectedRelations: [],
    detectedDimensions: [
      { id: `${id}-dimension`, observationId: id, studyId: "study-synthesis", category: "Representation", label: rawText.includes("idolatrie") ? "idolatrie" : "mepris", polarity: rawText.includes("idolatrie") ? "sacralizing" : "negative", actors: ["Marie"], sourceExcerpt: rawText, confidence: 0.8, status: "accepted", provenance: ["local-parser"], reason: "Marqueur lexical." }
    ],
    acceptedProposalIds: [],
    editedProposalIds: [],
    rejectedProposalIds: [],
    validationHistory: [],
    generatedManifestationIds: [],
    generatedEmotionIds: [],
    generatedCatalystIds: [],
    generatedRelationIds: [],
    generatedStateIds: [],
    generatedTransitionIds: [],
    generatedRecognitionIds: [],
    generatedTimelineEventIds: [],
    generatedDeltaIds: [],
    enginesExecuted: [],
    engineResultsSummary: [],
    methodologicalWarnings: [],
    sourceExcerpts: [rawText],
    openQuestions: []
  };
}
