"use client";

import { useEffect, useMemo, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { demoStudy } from "./demo-data";
import { repository } from "./repository";
import type { ObservatoryData, Study } from "./types";
import { downloadJson } from "./analytics";

export function useObservatory() {
  const [data, setData] = useState<ObservatoryData>({ version: 1, studies: [] });
  const [selectedStudyId, setSelectedStudyId] = useState("");

  useEffect(() => {
    const loaded = repository.load();
    setData(loaded);
    setSelectedStudyId(loaded.studies[0]?.id ?? "");
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
      ...demoStudy,
      id: `study-${crypto.randomUUID()}`,
      title: "Nouvelle étude d'observation",
      description: "Décrire le parcours d'observation.",
      subject: "Sujet à documenter",
      startDate: createdAt.slice(0, 10),
      notes: "",
      history: ["Création de l'étude"],
      createdAt,
      updatedAt: createdAt
    };
    setData((current) => ({ ...current, studies: [study, ...current.studies] }));
    setSelectedStudyId(study.id);
  }

  function deleteStudy(id: string) {
    if (!window.confirm("Supprimer cette étude et ses observations ?")) return;
    setData((current) => {
      const studies = current.studies.filter((study) => study.id !== id);
      setSelectedStudyId(studies[0]?.id ?? "");
      return { ...current, studies };
    });
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
    setSelectedStudyId(reset.studies[0]?.id ?? "");
  }

  async function importJson(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ObservatoryData | Study;
      if ("studies" in parsed) {
        setData(parsed);
        setSelectedStudyId(parsed.studies[0]?.id ?? "");
      } else {
        setData((current) => ({ ...current, studies: [parsed, ...current.studies] }));
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

  return {
    data,
    selectedStudyId,
    selectedStudy,
    selectStudy: setSelectedStudyId,
    createStudy,
    updateStudy,
    deleteStudy,
    duplicateStudy,
    resetDemoData,
    importJson,
    exportAll,
    updateMap
  };
}
