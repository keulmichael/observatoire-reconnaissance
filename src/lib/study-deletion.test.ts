import { describe, expect, it } from "vitest";
import type {
  Catalyst,
  EmotionObservation,
  Manifestation,
  ObservationRecord,
  ObservatoryData,
  OpenQuestion,
  PersistentDeltaScore,
  PersistentRelationProposal,
  Relation,
  Study,
  TimelineEvent,
  Transition,
  UnderstandingState
} from "./types";
import { createEmptyStudy } from "./study-factory";
import {
  deleteStudyAtomically,
  deleteStudyWithPersistence,
  formatStudyDeletionConfirmation,
  validateStudyDeletionResult
} from "./study-deletion";

const now = "2026-07-16T10:00:00.000Z";

describe("study deletion", () => {
  it("deletes an empty study", () => {
    const data = dataWith(study("study-a"));
    const result = deleteStudyAtomically(data, "study-a");

    expect(result.data.studies).toHaveLength(0);
    expect(result.nextSelectedStudyId).toBeNull();
  });

  it("deletes a study with observations and related drafts", () => {
    const deleted = withObservation(study("study-a"), observation("obs-a", "study-a", "Texte source"));
    const kept = study("study-b");
    const data: ObservatoryData = {
      ...dataWith(deleted, kept),
      observationDrafts: [
        {
          id: "obs-a",
          rawText: "Texte source",
          detectedPeople: [],
          detectedManifestations: [],
          detectedEmotions: [],
          detectedCatalysts: [],
          detectedConcepts: [],
          chronology: [],
          relationProposals: [],
          confirmationQuestions: [],
          analysisWarnings: [],
          createdAt: now,
          status: "validated",
          methodologicalStatus: "Donnees insuffisantes",
          conclusion: "Données insuffisantes"
        }
      ]
    };

    const result = deleteStudyAtomically(data, "study-a");

    expect(result.data.studies.map((item) => item.id)).toEqual(["study-b"]);
    expect(result.data.observationDrafts).toHaveLength(0);
  });

  it("deletes states, transitions and persisted Delta with the study", () => {
    const deleted = {
      ...study("study-a"),
      states: [state("state-a"), state("state-b")],
      transitions: [transition("transition-a")],
      deltaScores: [delta("delta-a", "transition-a")]
    };
    const result = deleteStudyAtomically(dataWith(deleted, study("study-b")), "study-a");

    expect(result.data.studies).toHaveLength(1);
    expect(result.data.studies[0].states).toHaveLength(0);
    expect(result.data.studies[0].transitions).toHaveLength(0);
    expect(result.data.studies[0].deltaScores).toHaveLength(0);
  });

  it("returns another study as next selection when the active study is deleted", () => {
    const result = deleteStudyAtomically(dataWith(study("study-a"), study("study-b")), "study-a");

    expect(result.nextSelectedStudyId).toBe("study-b");
  });

  it("returns null when no study remains", () => {
    const result = deleteStudyAtomically(dataWith(study("study-a")), "study-a");

    expect(result.nextSelectedStudyId).toBeNull();
  });

  it("keeps a shared catalyst in another study and removes the deleted study reference", () => {
    const sharedInDeleted = catalyst("shared-catalyst", ["study-a", "study-b"]);
    const sharedInKept = catalyst("shared-catalyst", ["study-a", "study-b"]);
    const result = deleteStudyAtomically(
      dataWith(withCatalyst(study("study-a"), sharedInDeleted), withCatalyst(study("study-b"), sharedInKept)),
      "study-a"
    );

    expect(result.data.studies[0].catalysts).toHaveLength(1);
    expect(result.data.studies[0].catalysts[0].linkedStudies).toEqual(["study-b"]);
  });

  it("deletes an exclusive catalyst with its study", () => {
    const exclusive = catalyst("exclusive-catalyst", ["study-a"]);
    const result = deleteStudyAtomically(dataWith(withCatalyst(study("study-a"), exclusive), study("study-b")), "study-a");

    expect(result.data.studies.flatMap((item) => item.catalysts.map((catalystItem) => catalystItem.id))).not.toContain("exclusive-catalyst");
  });

  it("does not leave orphan references to the deleted study", () => {
    const deleted = {
      ...study("study-a"),
      observations: [observation("obs-a", "study-a", "Texte source")],
      openQuestions: [openQuestion("question-a", "study-a", ["obs-a"])],
      relationProposals: [relationProposal("proposal-a", "study-a", ["obs-a"])]
    };

    const result = deleteStudyAtomically(dataWith(deleted, withCatalyst(study("study-b"), catalyst("shared", ["study-a", "study-b"]))), "study-a");

    expect(validateStudyDeletionResult(result.data, "study-a")).toEqual([]);
  });

  it("does not persist partial data when persistence fails", () => {
    const data = dataWith(study("study-a"), study("study-b"));
    const persist = () => {
      throw new Error("localStorage failure");
    };

    expect(() => deleteStudyWithPersistence(data, "study-a", persist)).toThrow("localStorage failure");
    expect(data.studies.map((item) => item.id)).toEqual(["study-a", "study-b"]);
  });

  it("requires an explicit confirmation message with dependency counts", () => {
    const target = {
      ...withObservation(study("study-a"), observation("obs-a", "study-a", "Texte source")),
      states: [state("state-a")],
      transitions: [transition("transition-a")],
      deltaScores: [delta("delta-a", "transition-a")],
      emotionObservations: [emotion("emotion-a")],
      manifestations: [manifestation("manifestation-a")],
      relations: [relation("relation-a")],
      openQuestions: [openQuestion("question-a", "study-a", ["obs-a"])],
      timeline: [timelineEvent("timeline-a")]
    };

    const message = formatStudyDeletionConfirmation(target);

    expect(message).toContain("Supprimer définitivement cette étude et toutes les données qui lui sont exclusivement liées ?");
    expect(message).toContain("Observations : 1");
    expect(message).toContain("États : 1");
    expect(message).toContain("Transitions : 1");
    expect(message).toContain("Delta : 1");
    expect(message).toContain("Émotions : 1");
    expect(message).toContain("Relations : 1");
    expect(message).toContain("Questions : 1");
    expect(message).toContain("Événements de chronologie : 1");
  });
});

function dataWith(...studies: Study[]): ObservatoryData {
  return { version: 1, schemaVersion: 2, studies, observationDrafts: [] };
}

function study(id: string): Study {
  return { ...createEmptyStudy(now, id), title: id };
}

function withObservation(base: Study, record: ObservationRecord): Study {
  return { ...base, observations: [record] };
}

function withCatalyst(base: Study, item: Catalyst): Study {
  return { ...base, catalysts: [item] };
}

function observation(id: string, studyId: string, rawText: string): ObservationRecord {
  return {
    id,
    studyId,
    rawText,
    createdAt: now,
    updatedAt: now,
    status: "active",
    detectedPeople: [],
    detectedManifestations: [],
    detectedEmotions: [],
    detectedCatalysts: [],
    detectedConcepts: [],
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
    sourceExcerpts: [rawText],
    openQuestions: []
  };
}

function state(id: string): UnderstandingState {
  return {
    id,
    title: id,
    date: now,
    formulation: "Formulation",
    stability: 0.5,
    confidence: 0.5,
    confirmedElements: [],
    uncertainElements: [],
    language: [],
    associatedBehaviors: []
  };
}

function transition(id: string): Transition {
  return {
    id,
    title: id,
    fromStateId: "state-a",
    toStateId: "state-b",
    triggeringManifestations: [],
    newRelations: [],
    emotions: [],
    catalysts: [],
    maturationDuration: "inconnue",
    recognitionWording: "",
    confirmationLevel: 1,
    observableImpact: "",
    transmissionCapacity: "",
    date: now
  };
}

function delta(id: string, transitionId: string): PersistentDeltaScore {
  return {
    id,
    transitionId,
    sourceObservationIds: [],
    rawScore: 0,
    positiveFactors: [],
    negativeFactors: [],
    neutralFactors: [],
    missingData: [],
    limitations: [],
    calculatedAt: now,
    engineVersion: "test",
    interpretationLabel: "Calcul non disponible"
  };
}

function catalyst(id: string, linkedStudies: string[]): Catalyst {
  return {
    id,
    name: id,
    type: "texte",
    description: "",
    context: "",
    linkedStudies,
    linkedTransitions: [],
    frequency: 1,
    averageImpact: 0,
    confirmationLevel: 1
  };
}

function emotion(id: string): EmotionObservation {
  return {
    id,
    emotion: "perdue",
    intensity: 1,
    date: now,
    context: "Observation",
    duration: "inconnue",
    comment: ""
  };
}

function manifestation(id: string): Manifestation {
  return {
    id,
    title: id,
    date: now,
    description: "",
    evidenceLevel: 1
  };
}

function timelineEvent(id: string): TimelineEvent {
  return {
    id,
    kind: "manifestation",
    title: id,
    date: now,
    summary: "",
    inDeltaPath: false
  };
}

function openQuestion(id: string, studyId: string, sourceObservationIds: string[]): OpenQuestion {
  return {
    id,
    studyId,
    sourceObservationIds,
    text: "Question ?",
    status: "ouverte",
    createdAt: now
  };
}

function relation(id: string): Relation {
  return {
    id,
    source: "A",
    target: "B",
    type: "possible",
    strength: 0.5,
    date: now,
    evidenceLevel: 1,
    note: "",
    status: "supposée"
  };
}

function relationProposal(id: string, studyId: string, sourceObservationIds: string[]): PersistentRelationProposal {
  return {
    id,
    label: "Relation possible",
    sourceExcerpt: "Texte source",
    confidence: 0.5,
    status: "proposed",
    reason: "Hypothèse",
    provenance: ["RelationEngine"],
    sourceA: "A",
    sourceB: "B",
    relationType: "relation possible",
    initialStatus: "hypothese",
    studyId,
    sourceObservationIds,
    engine: "RelationEngine",
    createdAt: now,
    updatedAt: now
  };
}
