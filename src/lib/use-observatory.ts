"use client";

import { useEffect, useMemo, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { repository } from "./repository";
import type { ObservationAnalysisDraft, ObservatoryData, Study } from "./types";
import { downloadJson } from "./analytics";
import { addObservationToStudy, constructScientificStudy } from "./parser/ScientificConstruction";
import { migrateObservatoryData, normalizeStudy } from "./data-migration";
import { formatStudyDeletionConfirmation } from "./study-deletion";

export function useObservatory() {
  const [data, setData] = useState<ObservatoryData>({ version: 1, studies: [], observationDrafts: [] });
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null);
  const [isDeletingStudy, setIsDeletingStudy] = useState(false);
  const [studyNotice, setStudyNotice] = useState("");

  useEffect(() => {
    const loaded = repository.load();
    setData(loaded);
    setSelectedStudyId(loaded.studies[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (data.studies.length) repository.save(data);
  }, [data]);

  const selectedStudy = useMemo(
    () => data.studies.find((study) => study.id === selectedStudyId) ?? data.studies[0],
    [data.studies, selectedStudyId]
  );

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

  function integrateObservationDraft(draft: ObservationAnalysisDraft, targetStudyId: string | "new" = "new") {
    const validatedDraft: ObservationAnalysisDraft = { ...draft, status: "validated" };
    const targetStudy = data.studies.find((study) => study.id === targetStudyId);
    const result = targetStudy
      ? addObservationToStudy(validatedDraft, targetStudy, data.studies)
      : constructScientificStudy(validatedDraft);
    setData((current) => {
      const drafts = current.observationDrafts ?? [];
      const target = current.studies.find((study) => study.id === targetStudyId);
      return {
        ...current,
        observationDrafts: drafts.map((item) => (item.id === draft.id ? validatedDraft : item)),
        studies: target
          ? current.studies.map((study) => (study.id === target.id ? result.study : study))
          : [result.study, ...current.studies]
      };
    });
    setSelectedStudyId(result.study.id);
    return result;
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
    saveObservationDraft,
    integrateObservationDraft
  };
}
