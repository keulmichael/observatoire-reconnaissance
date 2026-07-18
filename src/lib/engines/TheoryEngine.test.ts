import { describe, expect, it } from "vitest";
import { migrateObservatoryData } from "../data-migration";
import type { ObservationRecord, ObservatoryData, Study, TheoryEvidenceRelation } from "../types";
import {
  buildTheoryEvidenceLink,
  createInitialTheories,
  createReciprocalTestimony,
  TheoryEngine
} from "./TheoryEngine";

describe("TheoryEngine", () => {
  it("creates two distinct initial theories", () => {
    const theories = createInitialTheories();

    expect(theories).toHaveLength(2);
    expect(theories[0].id).not.toBe(theories[1].id);
    expect(theories[0].linkedTheoryIds).toContain(theories[1].id);
  });

  it("creates versioned theoretical elements", () => {
    const [theory] = createInitialTheories();
    const element = theory.elements[0];

    expect(element.version).toBe("1.0");
    expect(theory.versions[0].elementSnapshots.some((snapshot) => snapshot.id === element.id)).toBe(true);
  });

  it("assesses an observation link as support", () => {
    const data = dataWithLink("supports");

    const assessment = TheoryEngine.assess(data).find((item) => item.theoryElementId === "axiom-observation");

    expect(assessment?.confirmations).toBe(1);
    expect(assessment?.cautiousSummary).toContain("soutiennent");
  });

  it("assesses an observation link as contradiction", () => {
    const data = dataWithLink("contradicts");

    const assessment = TheoryEngine.assess(data).find((item) => item.theoryElementId === "axiom-observation");

    expect(assessment?.contradictions).toBe(1);
    expect(assessment?.cautiousSummary).toContain("contredisent");
  });

  it("assesses an observation link as enrichment", () => {
    const data = dataWithLink("enriches");

    const assessment = TheoryEngine.assess(data).find((item) => item.theoryElementId === "axiom-observation");

    expect(assessment?.enrichments).toBe(1);
  });

  it("does not mutate theory when producing proposals", () => {
    const data = dataWithLink("supports");
    const before = JSON.stringify(data.theories);

    const proposals = TheoryEngine.propose(data);

    expect(proposals.length).toBeGreaterThan(0);
    expect(JSON.stringify(data.theories)).toBe(before);
  });

  it("accepts a revision proposal by creating a new version", () => {
    const data = withGeneratedProposals(dataWithLink("supports"));
    const proposal = data.theoryRevisionProposals?.find((item) => item.kind === "element-potentiellement-soutenu");

    const next = TheoryEngine.acceptRevisionProposal(data, proposal?.id ?? "", { explanation: "Revision validee." }, "Chercheur");
    const theory = next.theories?.[0];

    expect(theory?.versions).toHaveLength(2);
    expect(theory?.elements.find((item) => item.id === "axiom-observation")?.revisionHistory).toHaveLength(1);
  });

  it("rejects a proposal without changing versions", () => {
    const data = withGeneratedProposals(dataWithLink("supports"));
    const proposalId = data.theoryRevisionProposals?.[0]?.id ?? "";

    const next = TheoryEngine.setProposalStatus(data, proposalId, "rejected");

    expect(next.theories?.[0].versions).toHaveLength(1);
    expect(next.theoryRevisionProposals?.[0].status).toBe("rejected");
  });

  it("preserves version history after a revision", () => {
    const data = withGeneratedProposals(dataWithLink("supports"));
    const proposalId = data.theoryRevisionProposals?.[0]?.id ?? "";

    const next = TheoryEngine.acceptRevisionProposal(data, proposalId);

    expect(next.theories?.[0].versions[1].previousVersionId).toBe(next.theories?.[0].versions[0].id);
  });

  it("keeps traceability to source observations", () => {
    const data = withGeneratedProposals(dataWithLink("supports"));
    const proposalId = data.theoryRevisionProposals?.[0]?.id ?? "";

    const next = TheoryEngine.acceptRevisionProposal(data, proposalId);
    const element = next.theories?.[0].elements.find((item) => item.id === "axiom-observation");

    expect(element?.sourceObservationIds).toContain("observation-1");
    expect(element?.sourceStudyIds).toContain("study-1");
  });

  it("does not infer interior effects in reciprocal testimony", () => {
    const testimony = createReciprocalTestimony({
      observationId: "observation-1",
      studyId: "study-1",
      witnessA: "A",
      witnessB: "B",
      testimonyAToB: "message",
      responseB: "silence",
      observedEffectOnB: "non renseigne",
      observedEffectOnA: "non renseigne",
      contradiction: "non renseigne",
      validation: "non renseigne",
      rejection: "non renseigne",
      silence: "silence observe",
      integration: "non renseigne",
      transformation: "non renseigne",
      effectStatusOnB: "effet suppose",
      effectStatusOnA: "effet attribue par l'observateur",
      limitations: ["Aucun effet interieur deduit."]
    });

    expect(testimony.observedEffectOnB).toBe("non renseigne");
    expect(testimony.limitations.join(" ")).toContain("Aucun effet interieur");
  });

  it("builds descriptive reflexive signatures without value score", () => {
    const signature = TheoryEngine.buildReflexiveSignatures(baseData())[0];

    expect(signature.valueScore).toBeNull();
    expect(signature.prohibitedOutputs).toContain("niveau de conscience");
  });

  it("creates a prediction then links a future observation", () => {
    const data = baseData();
    const withPrediction = TheoryEngine.createPrediction(data, {
      formulation: "Une relation future pourrait produire un temoignage observable.",
      theoryId: "theory-reflexive-recognition",
      theoryElementIds: ["theorem-general-cycle"],
      applicationContext: "future observation",
      expectedResult: "temoignage documente",
      observableCriteria: ["extrait"],
      temporalWindow: "30 jours",
      author: "Chercheur",
      limitations: ["Non certain."]
    });
    const predictionId = withPrediction.theoryPredictions?.[0].id ?? "";
    const linked = TheoryEngine.linkFutureObservationToPrediction(withPrediction, predictionId, "observation-2");

    expect(linked.theoryPredictions?.[0].futureObservationIds).toContain("observation-2");
  });

  it("migrates data non destructively", () => {
    const data = migrateObservatoryData({ version: 1, studies: [study()] });

    expect(data.studies).toHaveLength(1);
    expect(data.theories).toHaveLength(2);
    expect(data.studies[0].observations?.[0].theoryEvidenceLinks ?? []).toHaveLength(0);
  });

  it("does not contaminate studies and theories", () => {
    const data = dataWithLink("supports");
    const assessment = TheoryEngine.assess(data).find((item) => item.theoryElementId === "axiom-observation");

    expect(assessment?.theoryId).toBe("theory-reflexive-recognition");
    expect(TheoryEngine.assess(data).find((item) => item.theoryId === "theory-reciprocal-recognition" && item.observationCount > 0)).toBeUndefined();
  });

  it("is deterministic", () => {
    const data = dataWithLink("supports");

    expect(TheoryEngine.assess(data)).toEqual(TheoryEngine.assess(data));
  });

  it("does not mutate inputs", () => {
    const data = dataWithLink("supports");
    const before = JSON.stringify(data);

    TheoryEngine.assess(data);
    TheoryEngine.propose(data, "2026-07-18T00:00:00.000Z");

    expect(JSON.stringify(data)).toBe(before);
  });
});

function withGeneratedProposals(data: ObservatoryData): ObservatoryData {
  return { ...data, theoryRevisionProposals: TheoryEngine.propose(data, "2026-07-18T00:00:00.000Z") };
}

function dataWithLink(relation: TheoryEvidenceRelation): ObservatoryData {
  const data = baseData();
  const link = buildTheoryEvidenceLink({
    theoryId: "theory-reflexive-recognition",
    theoryElementId: "axiom-observation",
    observationId: "observation-1",
    studyId: "study-1",
    relation,
    researchLevel: "empirical",
    sourceExcerpts: ["extrait source"],
    reasoningSummary: "Lien valide par utilisateur.",
    limitations: []
  }, "2026-07-18T00:00:00.000Z");
  return {
    ...data,
    studies: [
      {
        ...data.studies[0],
        observations: [{ ...(data.studies[0].observations?.[0] as ObservationRecord), theoryEvidenceLinks: [link] }]
      }
    ]
  };
}

function baseData(): ObservatoryData {
  return {
    version: 1,
    schemaVersion: 4,
    studies: [study()],
    observationDrafts: [],
    theories: createInitialTheories(),
    theoryRevisionProposals: [],
    theoryPredictions: [],
    reciprocalTestimonies: [],
    reflexiveSignatures: []
  };
}

function study(): Study {
  return {
    id: "study-1",
    title: "Etude test",
    description: "Description",
    subject: "Sujet",
    startDate: "2026-07-18",
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
    observations: [observation()],
    openQuestions: [],
    structuredHistory: [],
    relationProposals: [],
    deltaScores: [],
    longitudinalComparisons: [],
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z"
  };
}

function observation(): ObservationRecord {
  return {
    id: "observation-1",
    studyId: "study-1",
    rawText: "Alice temoigne et dit avoir compris une relation nouvelle.",
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    status: "active",
    detectedPeople: [{
      id: "person-1",
      label: "Alice",
      sourceExcerpt: "Alice temoigne",
      confidence: 0.9,
      status: "accepted",
      reason: "Nom detecte.",
      provenance: ["test"],
      entityText: "Alice"
    }],
    detectedManifestations: [],
    detectedEmotions: [],
    detectedCatalysts: [],
    detectedConcepts: [{
      id: "concept-1",
      label: "relation nouvelle",
      sourceExcerpt: "relation nouvelle",
      confidence: 0.8,
      status: "accepted",
      reason: "Concept test.",
      provenance: ["test"],
      concept: "relation nouvelle"
    }],
    detectedRelations: [],
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
    sourceExcerpts: ["Alice temoigne"],
    openQuestions: []
  };
}
