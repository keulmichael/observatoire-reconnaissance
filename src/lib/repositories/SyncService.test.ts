import { describe, expect, it, vi } from "vitest";
import { SyncService } from "./SyncService";
import type { ObservatoryRepository } from "./ObservatoryRepository";
import type { ObservatoryData } from "../types";

describe("SyncService", () => {
  it("conserve le cache local si aucun utilisateur n'est connecte", async () => {
    const cache = cacheRepo({ version: 1, studies: [] });
    const remote = remoteRepo();
    const service = new SyncService(cache, remote);
    const snapshot = await service.save({ version: 1, studies: [] }, null);
    expect(snapshot.status).toBe("local-cache");
    expect(remote.save).not.toHaveBeenCalled();
  });

  it("reprend sur cache local quand la persistance distante echoue", async () => {
    const cache = cacheRepo({ version: 1, studies: [] });
    const remote = remoteRepo();
    vi.mocked(remote.save).mockRejectedValueOnce(new Error("RLS denied"));
    const service = new SyncService(cache, remote);
    const snapshot = await service.save({ version: 1, studies: [] }, "user-1");
    expect(snapshot.status).toBe("error");
    expect(snapshot.error).toContain("RLS denied");
    expect(cache.load().studies).toEqual([]);
  });

  it("garde les etudes et observations visibles quand la synchronisation globale echoue en 23503", async () => {
    const existing = {
      version: 1 as const,
      studies: [study("study-1", ["obs-1", "obs-2"]), study("study-2", ["obs-3"])]
    };
    const cache = cacheRepo(existing);
    const remote = remoteRepo();
    remote.saveCoreObservatory = vi.fn(async (data: ObservatoryData) => data);
    remote.saveGlobalObservatory = vi.fn(async () => {
      throw new Error('code 23503: insert or update on table "global_event_articles" violates foreign key constraint');
    });
    const service = new SyncService(cache, remote);

    const snapshot = await service.save(existing, "user-1");

    expect(snapshot.status).toBe("synced");
    expect(snapshot.warning).toContain("Veille mondiale non synchronisee");
    expect(snapshot.data.studies).toHaveLength(2);
    expect(snapshot.data.studies.flatMap((item) => item.observations ?? [])).toHaveLength(3);
    expect(cache.load().studies).toHaveLength(2);
    expect(remote.saveCoreObservatory).toHaveBeenCalledOnce();
  });

  it("conserve la derniere veille locale valide si seul le chargement global echoue", async () => {
    const cached = {
      version: 1 as const,
      studies: [study("cached-study", ["cached-obs"])],
      globalObservatory: emptyGlobalState("cached-event")
    };
    const remote = remoteRepo();
    vi.mocked(remote.load).mockResolvedValueOnce({ version: 1, studies: [study("remote-study", ["remote-obs"])] });
    remote.getWarnings = vi.fn(() => ["Veille mondiale non chargee"]);
    const cache = cacheRepo(cached);
    const service = new SyncService(cache, remote);

    const snapshot = await service.load("user-1");

    expect(snapshot.status).toBe("synced");
    expect(snapshot.data.studies[0].id).toBe("remote-study");
    expect(snapshot.data.globalObservatory?.events[0].id).toBe("cached-event");
    expect(cache.load().globalObservatory?.events[0].id).toBe("cached-event");
  });
});

function cacheRepo(initial: ObservatoryData) {
  let value = initial;
  return {
    load: () => value,
    save: (data: ObservatoryData) => {
      value = data;
    }
  };
}

function remoteRepo(): ObservatoryRepository {
  return {
    load: vi.fn(async () => ({ version: 1 as const, studies: [] })),
    save: vi.fn(async (data: ObservatoryData) => data)
  };
}

function study(id: string, observationIds: string[]): ObservatoryData["studies"][number] {
  const now = "2026-07-21T10:00:00.000Z";
  return {
    id,
    title: id,
    description: "Etude existante",
    subject: "Sujet",
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
      rawText: observationId,
      updatedAt: now,
      detectedPeople: [],
      detectedManifestations: [],
      detectedEmotions: [],
      detectedCatalysts: [],
      detectedConcepts: [],
      detectedRelations: [],
      chronology: [],
      relationProposals: [],
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
      openQuestions: [],
      confirmationQuestions: [],
      analysisWarnings: [],
      createdAt: now,
      status: "active",
      methodologicalStatus: "Observation ouverte",
      conclusion: "Observation conservee"
    })),
    openQuestions: [],
    structuredHistory: [],
    relationProposals: [],
    deltaScores: [],
    createdAt: now,
    updatedAt: now
  };
}

function emptyGlobalState(eventId: string): NonNullable<ObservatoryData["globalObservatory"]> {
  return {
    sources: [],
    events: [{
      id: eventId,
      title: eventId,
      normalizedTitle: eventId,
      summary: "Evenement en cache",
      startedAt: "2026-07-21T10:00:00.000Z",
      updatedAt: "2026-07-21T10:00:00.000Z",
      status: "active",
      categories: [],
      themes: [],
      sourceIds: [],
      sources: [],
      mergeCandidates: [],
      learningWeight: 1,
      createdStudyIds: []
    }],
    learningSignals: [],
    mapPoints: [],
    dashboard: {
      analyzedEvents: 0,
      activeEvents: 1,
      createdStudies: 0,
      frequentCategories: [],
      representedCountries: [],
      emergingThemes: [],
      studiedPhenomena: [],
      topStudyEvents: [],
      trends: []
    },
    collectionLogs: []
  };
}
