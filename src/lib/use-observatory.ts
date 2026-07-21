"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { repository } from "./repository";
import type { GlobalCollectionReport, ObservationAnalysisDraft, ObservatoryData, Study, TheoryEvidenceRelation, TheoryPrediction, TheoryRevisionProposal } from "./types";
import { downloadJson } from "./analytics";
import { addObservationToStudy, constructScientificStudy } from "./parser/ScientificConstruction";
import { migrateObservatoryData, normalizeStudy } from "./data-migration";
import { formatStudyDeletionConfirmation } from "./study-deletion";
import { buildTheoryEvidenceLink, TheoryEngine } from "./engines/TheoryEngine";
import { StudySynthesisEngine } from "./engines/study-synthesis";
import { GlobalObservatory, StudySuggestionEngine } from "./global-observatory";
import type { SyncStatus } from "./repositories/SyncService";

export function useObservatory() {
  const [data, setData] = useState<ObservatoryData>({ version: 1, studies: [], observationDrafts: [] });
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null);
  const [isDeletingStudy, setIsDeletingStudy] = useState(false);
  const [studyNotice, setStudyNotice] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local-cache");
  const [syncError, setSyncError] = useState("");
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLoad = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const local = repository.loadLocal();
      setData(local);
      setSelectedStudyId((current) => current ?? local.studies[0]?.id ?? null);
      const session = await repository.session();
      if (cancelled) return;
      setAuthUserId(session.user?.id ?? null);
      setAuthEmail(session.user?.email ?? null);
      const snapshot = await repository.load();
      if (cancelled) return;
      setData(snapshot.data);
      setSyncStatus(snapshot.status);
      setSyncError(snapshot.error ?? "");
      setSelectedStudyId((current) => current ?? snapshot.data.studies[0]?.id ?? null);
      didLoad.current = true;
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!didLoad.current) return;
    repository.localCache.save(data);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSyncStatus((current) => (current === "local-cache" ? current : "syncing"));
    saveTimer.current = setTimeout(() => {
      void repository.save(data).then((snapshot) => {
        setSyncStatus(snapshot.status);
        setSyncError(snapshot.error ?? "");
      });
    }, 250);
  }, [data]);

  const selectedStudy = useMemo(
    () => (selectedStudyId ? data.studies.find((study) => study.id === selectedStudyId) : undefined),
    [data.studies, selectedStudyId]
  );

  const persistNow = useCallback(async (nextData: ObservatoryData) => {
    const snapshot = await repository.save(nextData);
    setSyncStatus(snapshot.status);
    setSyncError("");
    return snapshot;
  }, []);

  function updateStudy(study: Study) {
    setData((current) => ({
      ...current,
      studies: current.studies.map((item) =>
        item.id === study.id ? { ...study, updatedAt: new Date().toISOString() } : item
      )
    }));
  }

  function createStudy() {
    const createdAt = new Date().toISOString();
    const study: Study = {
      id: `study-${crypto.randomUUID()}`,
      ownerId: authUserId ?? undefined,
      title: "Nouvelle étude d'observation",
      description: "Décrire le parcours d'observation.",
      subject: "Sujet à documenter",
      startDate: createdAt.slice(0, 10),
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
      history: ["Création de l'étude"],
      observations: [],
      openQuestions: [],
      structuredHistory: [],
      relationProposals: [],
      deltaScores: [],
      createdAt,
      updatedAt: createdAt
    };
    setData((current) => ({ ...current, studies: [study, ...current.studies] }));
    setSelectedStudyId(study.id);
  }

  function deleteStudy(id: string) {
    const study = data.studies.find((item) => item.id === id);
    if (!study || isDeletingStudy) return;
    if (!window.confirm(formatStudyDeletionConfirmation(study))) return;
    setIsDeletingStudy(true);
    setStudyNotice("");
    try {
      const result = repository.deleteStudy(data, id);
      setData(result.data);
      setSelectedStudyId(result.nextSelectedStudyId);
      setStudyNotice("Étude supprimée.");
    } catch {
      setStudyNotice("La suppression a échoué. Aucune donnée n’a été modifiée.");
      window.alert("La suppression a échoué. Aucune donnée n’a été modifiée.");
    } finally {
      setIsDeletingStudy(false);
    }
  }

  function duplicateStudy(id: string) {
    const source = data.studies.find((study) => study.id === id);
    if (!source) return;
    const clone = {
      ...source,
      id: `study-${crypto.randomUUID()}`,
      title: `${source.title} · copie`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setData((current) => ({ ...current, studies: [clone, ...current.studies] }));
    setSelectedStudyId(clone.id);
  }

  function resetDemoData() {
    if (!window.confirm("Réinitialiser les données de démonstration ?")) return;
    const reset = repository.reset();
    setData(reset);
    setSelectedStudyId(reset.studies[0]?.id ?? null);
  }

  async function importJson(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ObservatoryData | Study;
      if ("studies" in parsed) {
        const migrated = migrateObservatoryData(parsed);
        setData(migrated);
        setSelectedStudyId(migrated.studies[0]?.id ?? null);
      } else {
        setData((current) => ({ ...current, studies: [normalizeStudy(parsed), ...current.studies] }));
        setSelectedStudyId(parsed.id);
      }
    } catch {
      window.alert("Le fichier JSON n'a pas pu être importé.");
    }
  }

  function exportAll() {
    downloadJson("observatoire-reconnaissance.json", data);
  }

  function updateMap(nodes: Node[], edges: Edge[]) {
    if (!selectedStudy) return;
    updateStudy({ ...selectedStudy, map: { nodes, edges } });
  }

  function saveObservationDraft(draft: ObservationAnalysisDraft) {
    setData((current) => {
      const drafts = current.observationDrafts ?? [];
      const exists = drafts.some((item) => item.id === draft.id);
      return {
        ...current,
        observationDrafts: exists ? drafts.map((item) => (item.id === draft.id ? draft : item)) : [draft, ...drafts]
      };
    });
  }

  function updateAISettings(settings: NonNullable<ObservatoryData["aiSettings"]>) {
    setData((current) => ({
      ...current,
      aiSettings: settings
    }));
  }

  function saveAIObservationResult(result: NonNullable<ObservatoryData["aiObservationResults"]>[number]) {
    setData((current) => {
      const results = current.aiObservationResults ?? [];
      if (results.some((item) => item.id === result.id || item.promptHash === result.promptHash)) return current;
      return {
        ...current,
        aiObservationResults: [result, ...results].slice(0, 50)
      };
    });
  }

  function refreshTheoryProposals() {
    setData((current) => {
      const proposals = TheoryEngine.propose(current);
      if (!proposals.length) return current;
      return {
        ...current,
        theoryRevisionProposals: [...proposals, ...(current.theoryRevisionProposals ?? [])]
      };
    });
  }

  function linkObservationToTheory(input: {
    studyId: string;
    observationId: string;
    theoryId: string;
    theoryElementId: string;
    relation: TheoryEvidenceRelation;
    reasoningSummary: string;
  }) {
    setData((current) => {
      const study = current.studies.find((item) => item.id === input.studyId);
      const observation = study?.observations?.find((item) => item.id === input.observationId);
      if (!study || !observation) return current;
      const sourceExcerpts = observation.sourceExcerpts.length ? observation.sourceExcerpts : [observation.rawText];
      const link = buildTheoryEvidenceLink({
        theoryId: input.theoryId,
        theoryElementId: input.theoryElementId,
        observationId: input.observationId,
        studyId: input.studyId,
        relation: input.relation,
        researchLevel: "empirical",
        sourceExcerpts,
        reasoningSummary: input.reasoningSummary,
        limitations: ["Lien cree par validation utilisateur."]
      });
      return {
        ...current,
        studies: current.studies.map((item) =>
          item.id !== input.studyId
            ? item
            : {
                ...item,
                observations: (item.observations ?? []).map((record) =>
                  record.id === input.observationId
                    ? { ...record, theoryEvidenceLinks: [...(record.theoryEvidenceLinks ?? []), link] }
                    : record
                ),
                updatedAt: new Date().toISOString()
              }
        )
      };
    });
  }

  function acceptTheoryRevision(proposalId: string, patch?: Parameters<typeof TheoryEngine.acceptRevisionProposal>[2]) {
    setData((current) => TheoryEngine.acceptRevisionProposal(current, proposalId, patch));
  }

  function setTheoryProposalStatus(proposalId: string, status: TheoryRevisionProposal["status"]) {
    setData((current) => TheoryEngine.setProposalStatus(current, proposalId, status));
  }

  function createTheoryPrediction(prediction: Omit<TheoryPrediction, "id" | "createdAt" | "updatedAt" | "status" | "futureObservationIds">) {
    setData((current) => TheoryEngine.createPrediction(current, prediction));
  }

  function linkPredictionObservation(predictionId: string, observationId: string) {
    setData((current) => TheoryEngine.linkFutureObservationToPrediction(current, predictionId, observationId));
  }

  function generateStudySynthesis(studyId: string) {
    const engine = new StudySynthesisEngine();
    let generatedId = "";
    setData((current) => ({
      ...current,
      studies: current.studies.map((study) => {
        if (study.id !== studyId) return study;
        const synthesis = engine.generate(study);
        generatedId = synthesis.id;
        return {
          ...study,
          studySyntheses: [synthesis, ...(study.studySyntheses ?? [])],
          activeStudySynthesisId: synthesis.id,
          updatedAt: new Date().toISOString()
        };
      })
    }));
    return generatedId;
  }

  async function collectGlobalEvents() {
    const state = data.globalObservatory ?? GlobalObservatory.initialState();
    const response = await fetch("/api/global-observatory/collect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        state,
        sourceIds: state.sources.filter((source) => source.enabled).map((source) => source.id),
        maxItemsPerSource: 8
      })
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(error.error ?? "Collecte impossible.");
    }
    const payload = (await response.json()) as { report: GlobalCollectionReport };
    setData((current) => {
      const currentGlobal = current.globalObservatory ?? GlobalObservatory.initialState();
      return {
        ...current,
        globalObservatory: GlobalObservatory.refresh({
          ...currentGlobal,
          events: payload.report.events,
          collectionLogs: [
            payload.report,
            ...((currentGlobal.collectionLogs ?? []).filter((log) => log.id !== payload.report.id))
          ].slice(0, 50),
          lastCollectedAt: payload.report.completedAt
        })
      };
    });
    return payload.report;
  }

  function analyzeGlobalEvent(eventId: string) {
    setData((current) => ({
      ...current,
      globalObservatory: GlobalObservatory.analyzeEventById(
        current.globalObservatory ?? GlobalObservatory.initialState(),
        eventId
      )
    }));
  }

  function setGlobalSourceEnabled(sourceId: string, enabled: boolean) {
    setData((current) => ({
      ...current,
      globalObservatory: GlobalObservatory.setSourceEnabled(
        current.globalObservatory ?? GlobalObservatory.initialState(),
        sourceId,
        enabled
      )
    }));
  }

  function createStudyFromGlobalEvent(eventId: string) {
    const now = new Date().toISOString();
    let createdStudyId: string | null = null;
    setData((current) => {
      const globalObservatory = GlobalObservatory.refresh(current.globalObservatory ?? GlobalObservatory.initialState());
      const event = globalObservatory.events.find((item) => item.id === eventId);
      if (!event) return current;
      const study = {
        ...StudySuggestionEngine.createStudy(event, now),
        ownerId: authUserId ?? undefined
      };
      createdStudyId = study.id;
      const withLearning = GlobalObservatory.recordLearning(globalObservatory, eventId, "study-retained", {
        suggestionId: event.studySuggestion?.id,
        studyId: study.id,
        reason: "Creation d'une etude depuis un evenement observe.",
        now
      });
      return {
        ...current,
        studies: [study, ...current.studies],
        globalObservatory: withLearning
      };
    });
    if (createdStudyId) setSelectedStudyId(createdStudyId);
    return createdStudyId;
  }

  function abandonGlobalStudySuggestion(eventId: string) {
    setData((current) => ({
      ...current,
      globalObservatory: GlobalObservatory.recordLearning(
        current.globalObservatory ?? GlobalObservatory.initialState(),
        eventId,
        "study-abandoned"
      )
    }));
  }

  function integrateObservationDraft(draft: ObservationAnalysisDraft, targetStudyId: string | "new" = "new") {
    const validatedDraft: ObservationAnalysisDraft = { ...draft, status: "validated" };
    const targetStudy = data.studies.find((study) => study.id === targetStudyId);
    const result = targetStudy
      ? addObservationToStudy(validatedDraft, targetStudy, data.studies)
      : constructScientificStudy(validatedDraft);
    const resultStudy = {
      ...result.study,
      ownerId: result.study.ownerId ?? authUserId ?? undefined,
      observations: (result.study.observations ?? []).map((record) => ({ ...record, ownerId: record.ownerId ?? authUserId ?? undefined }))
    };
    setData((current) => {
      const drafts = current.observationDrafts ?? [];
      const target = current.studies.find((study) => study.id === targetStudyId);
      return {
        ...current,
        observationDrafts: drafts.map((item) => (item.id === draft.id ? validatedDraft : item)),
        studies: target
          ? current.studies.map((study) => (study.id === target.id ? resultStudy : study))
          : [resultStudy, ...current.studies]
      };
    });
    setSelectedStudyId(resultStudy.id);
    return { ...result, study: resultStudy };
  }

  async function signIn(email: string, password: string) {
    const result = await repository.signIn(email, password);
    if (result.error) throw result.error;
    const session = await repository.session();
    setAuthUserId(session.user?.id ?? null);
    setAuthEmail(session.user?.email ?? null);
    const snapshot = await repository.load();
    setData(snapshot.data);
    setSyncStatus(snapshot.status);
    setSyncError(snapshot.error ?? "");
  }

  async function signUp(email: string, password: string) {
    const result = await repository.signUp(email, password);
    if (result.error) throw result.error;
    const session = await repository.session();
    setAuthUserId(session.user?.id ?? null);
    setAuthEmail(session.user?.email ?? email);
  }

  async function signOut() {
    await repository.signOut();
    setAuthUserId(null);
    setAuthEmail(null);
    setSyncStatus("local-cache");
  }

  async function migrateLocalToRemote() {
    if (!authUserId) throw new Error("Connexion requise avant migration.");
    const snapshot = await repository.migrateLocalToRemote(authUserId);
    setData(snapshot.data);
    setSyncStatus(snapshot.status);
    setSyncError("");
    return snapshot;
  }

  return {
    data,
    selectedStudyId,
    selectedStudy,
    selectStudy: setSelectedStudyId,
    createStudy,
    updateStudy,
    deleteStudy,
    duplicateStudy,
    isDeletingStudy,
    studyNotice,
    resetDemoData,
    importJson,
    exportAll,
    updateMap,
    observationDrafts: data.observationDrafts ?? [],
    aiSettings: data.aiSettings,
    aiObservationResults: data.aiObservationResults ?? [],
    updateAISettings,
    saveAIObservationResult,
    refreshTheoryProposals,
    linkObservationToTheory,
    acceptTheoryRevision,
    setTheoryProposalStatus,
    createTheoryPrediction,
    linkPredictionObservation,
    generateStudySynthesis,
    collectGlobalEvents,
    analyzeGlobalEvent,
    setGlobalSourceEnabled,
    createStudyFromGlobalEvent,
    abandonGlobalStudySuggestion,
    saveObservationDraft,
    integrateObservationDraft,
    authUserId,
    authEmail,
    authConfigured: repository.configured,
    syncStatus,
    syncError,
    signIn,
    signUp,
    signOut,
    migrationSummary: repository.migrationSummary,
    migrateLocalToRemote,
    persistNow
  };
}
