import type { AnalysisScope, ObservatoryData, Study } from "./types";

export function dataForAnalysisScope(data: ObservatoryData, scope: AnalysisScope): ObservatoryData {
  if (scope.mode === "all-studies") return data;
  return {
    ...data,
    studies: data.studies.filter((study) => study.id === scope.studyId)
  };
}

export function studiesForAnalysisScope(studies: Study[], scope: AnalysisScope): Study[] {
  if (scope.mode === "all-studies") return studies;
  return studies.filter((study) => study.id === scope.studyId);
}

export function analysisScopeSummary(studies: Study[], scope: AnalysisScope) {
  const scopedStudies = studiesForAnalysisScope(studies, scope);
  const observationCount = scopedStudies.reduce((sum, study) => sum + (study.observations ?? []).filter((record) => record.status === "active").length, 0);
  if (scope.mode === "all-studies") {
    return `Analyse transversale de ${scopedStudies.length} etude(s) et ${observationCount} observation(s)`;
  }
  return `${scopedStudies[0]?.title ?? "Etude selectionnee"} - ${observationCount} observation(s) analysee(s)`;
}
