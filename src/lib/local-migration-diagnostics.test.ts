import { describe, expect, it } from "vitest";
import {
  compareLocalToRemote,
  createLocalMigrationReport,
  mergeMissingLocalData
} from "./local-migration-diagnostics";
import type { ObservationAnalysisDraft, ObservatoryData, Study } from "./types";

describe("local migration diagnostics", () => {
  it("detecte des donnees locales quand le distant est vide", () => {
    const local = data([study("study-1", "Etude A", ["obs-1"])], [draft("draft-1")]);
    const diagnostic = compareLocalToRemote(local, data(), "owner-1");

    expect(diagnostic.status).toBe("remote-empty");
    expect(diagnostic.canMigrateMissing).toBe(true);
    expect(diagnostic.missing).toEqual({ studies: 1, observations: 1, drafts: 1 });
  });

  it("reconnait une sauvegarde locale deja migree dans le compte", () => {
    const local = data([study("study-1", "Etude A", ["obs-1"])], [draft("draft-1")]);
    const remote = data([study("study-1", "Etude A", ["obs-1"])], [draft("draft-1")]);
    const report = createLocalMigrationReport(local, "owner-1", "success", { studies: 1, observations: 1, drafts: 1 });

    const diagnostic = compareLocalToRemote(local, remote, "owner-1", report);

    expect(diagnostic.status).toBe("already-migrated");
    expect(diagnostic.canMigrateMissing).toBe(false);
    expect(diagnostic.canDeleteLocal).toBe(true);
  });

  it("detecte uniquement les nouvelles donnees locales", () => {
    const local = data([study("study-1", "Etude A", ["obs-1"]), study("study-2", "Etude B", ["obs-2"])]);
    const remote = data([study("study-1", "Etude A", ["obs-1"])]);

    const diagnostic = compareLocalToRemote(local, remote, "owner-1");
    const merged = mergeMissingLocalData(local, remote, "owner-1");

    expect(diagnostic.status).toBe("local-new-data");
    expect(diagnostic.missing).toEqual({ studies: 1, observations: 1, drafts: 0 });
    expect(merged.studies.map((item) => item.id)).toEqual(["study-1", "study-2"]);
  });

  it("signale une migration interrompue ou incomplete via le dernier rapport", () => {
    const local = data([study("study-1", "Etude A", ["obs-1"]), study("study-2", "Etude B", ["obs-2"])]);
    const remote = data([study("study-1", "Etude A", ["obs-1"])]);
    const report = createLocalMigrationReport(local, "owner-1", "partial", { studies: 1, observations: 1, drafts: 0 }, "timeout");

    const diagnostic = compareLocalToRemote(local, remote, "owner-1", report);

    expect(diagnostic.status).toBe("migration-incomplete");
    expect(diagnostic.canMigrateMissing).toBe(true);
  });

  it("bloque une sauvegarde deja migree vers un autre owner_id", () => {
    const local = data([study("study-1", "Etude A", ["obs-1"])]);
    const remote = data([study("study-1", "Etude A", ["obs-1"])]);
    const report = createLocalMigrationReport(local, "owner-2", "success", { studies: 1, observations: 1, drafts: 0 });

    const diagnostic = compareLocalToRemote(local, remote, "owner-1", report);

    expect(diagnostic.status).toBe("migrated-to-other-owner");
    expect(diagnostic.canMigrateMissing).toBe(false);
    expect(diagnostic.canDeleteLocal).toBe(false);
  });

  it("inclut les brouillons non rattaches dans la comparaison", () => {
    const local = data([], [draft("draft-1")]);
    const remote = data();

    const diagnostic = compareLocalToRemote(local, remote, "owner-1");
    const merged = mergeMissingLocalData(local, remote, "owner-1");

    expect(diagnostic.status).toBe("remote-empty");
    expect(diagnostic.missing.drafts).toBe(1);
    expect(merged.observationDrafts?.map((item) => item.id)).toEqual(["draft-1"]);
  });

  it("autorise la suppression locale seulement apres verification distante identique", () => {
    const local = data([study("study-1", "Etude A", ["obs-1"])]);

    expect(compareLocalToRemote(local, data(), "owner-1").canDeleteLocal).toBe(false);
    expect(compareLocalToRemote(local, local, "owner-1").canDeleteLocal).toBe(true);
  });
});

function data(studies: Study[] = [], drafts: ObservationAnalysisDraft[] = []): ObservatoryData {
  return {
    version: 1,
    studies,
    observationDrafts: drafts
  };
}

function study(id: string, title: string, observationIds: string[] = []): Study {
  const now = "2026-07-21T10:00:00.000Z";
  return {
    id,
    title,
    description: "Description",
    subject: title,
    startDate: "2026-07-21",
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
    observations: observationIds.map((observationId) => ({
      id: observationId,
      studyId: id,
      rawText: `Texte ${observationId}`,
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
      sourceExcerpts: [],
      openQuestions: []
    })),
    openQuestions: [],
    structuredHistory: [],
    relationProposals: [],
    deltaScores: [],
    createdAt: now,
    updatedAt: now
  };
}

function draft(id: string): ObservationAnalysisDraft {
  return {
    id,
    rawText: `Brouillon ${id}`,
    detectedPeople: [],
    detectedManifestations: [],
    detectedEmotions: [],
    detectedCatalysts: [],
    detectedConcepts: [],
    chronology: [],
    relationProposals: [],
    confirmationQuestions: [],
    analysisWarnings: [],
    createdAt: "2026-07-21T10:00:00.000Z",
    status: "draft",
    methodologicalStatus: "Observation ouverte",
    conclusion: ""
  };
}
