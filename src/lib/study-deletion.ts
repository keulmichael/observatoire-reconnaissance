import type { Catalyst, ObservatoryData, Study } from "./types";

export interface StudyDeletionSummary {
  observations: number;
  states: number;
  transitions: number;
  deltas: number;
  emotions: number;
  catalysts: number;
  relations: number;
  questions: number;
  timelineEvents: number;
}

export interface StudyDeletionResult {
  data: ObservatoryData;
  nextSelectedStudyId: string | null;
  summary: StudyDeletionSummary;
}

export function getStudyDeletionSummary(study: Study): StudyDeletionSummary {
  return {
    observations: study.observations?.length ?? 0,
    states: study.states.length,
    transitions: study.transitions.length,
    deltas: study.deltaScores?.length ?? 0,
    emotions: study.emotionObservations.length,
    catalysts: study.catalysts.length,
    relations: study.relations.length + (study.relationProposals?.length ?? 0),
    questions: study.openQuestions?.length ?? 0,
    timelineEvents: study.timeline.length
  };
}

export function formatStudyDeletionConfirmation(study: Study, summary = getStudyDeletionSummary(study)) {
  return [
    "Supprimer définitivement cette étude et toutes les données qui lui sont exclusivement liées ?",
    "",
    `Étude : ${study.title}`,
    "",
    `Observations : ${summary.observations}`,
    `États : ${summary.states}`,
    `Transitions : ${summary.transitions}`,
    `Delta : ${summary.deltas}`,
    `Émotions : ${summary.emotions}`,
    `Catalyseurs : ${summary.catalysts}`,
    `Relations : ${summary.relations}`,
    `Questions : ${summary.questions}`,
    `Événements de chronologie : ${summary.timelineEvents}`
  ].join("\n");
}

export function deleteStudyAtomically(data: ObservatoryData, studyId: string): StudyDeletionResult {
  const deletedStudy = data.studies.find((study) => study.id === studyId);
  if (!deletedStudy) {
    throw new Error(`Study not found: ${studyId}`);
  }

  const deletedObservationIds = new Set((deletedStudy.observations ?? []).map((observation) => observation.id));
  const deletedRawTexts = new Set((deletedStudy.observations ?? []).map((observation) => observation.rawText));
  const studies = data.studies
    .filter((study) => study.id !== studyId)
    .map((study) => detachDeletedStudyReferences(study, studyId));
  const observationDrafts = (data.observationDrafts ?? []).filter(
    (draft) => !deletedObservationIds.has(draft.id) && !deletedRawTexts.has(draft.rawText)
  );

  const nextData: ObservatoryData = {
    ...data,
    studies,
    observationDrafts
  };
  const orphanErrors = validateStudyDeletionResult(nextData, studyId);
  if (orphanErrors.length) {
    throw new Error(`Study deletion would leave orphan references: ${orphanErrors.join("; ")}`);
  }

  return {
    data: nextData,
    nextSelectedStudyId: studies[0]?.id ?? null,
    summary: getStudyDeletionSummary(deletedStudy)
  };
}

export function deleteStudyWithPersistence(
  data: ObservatoryData,
  studyId: string,
  persist: (nextData: ObservatoryData) => void
): StudyDeletionResult {
  const result = deleteStudyAtomically(data, studyId);
  persist(result.data);
  return result;
}

export function validateStudyDeletionResult(data: ObservatoryData, deletedStudyId: string) {
  const errors: string[] = [];
  if (data.studies.some((study) => study.id === deletedStudyId)) {
    errors.push("deleted study still present");
  }
  for (const study of data.studies) {
    for (const catalyst of study.catalysts) {
      if (catalyst.linkedStudies.includes(deletedStudyId)) {
        errors.push(`catalyst ${catalyst.id} still references deleted study`);
      }
    }
    for (const observation of study.observations ?? []) {
      if (observation.studyId === deletedStudyId) {
        errors.push(`observation ${observation.id} still references deleted study`);
      }
    }
    for (const question of study.openQuestions ?? []) {
      if (question.studyId === deletedStudyId) {
        errors.push(`question ${question.id} still references deleted study`);
      }
    }
    for (const proposal of study.relationProposals ?? []) {
      if (proposal.studyId === deletedStudyId) {
        errors.push(`relation proposal ${proposal.id} still references deleted study`);
      }
    }
  }
  return errors;
}

function detachDeletedStudyReferences(study: Study, deletedStudyId: string): Study {
  return {
    ...study,
    catalysts: study.catalysts.map((catalyst) => detachCatalystStudy(catalyst, deletedStudyId))
  };
}

function detachCatalystStudy(catalyst: Catalyst, deletedStudyId: string): Catalyst {
  if (!catalyst.linkedStudies.includes(deletedStudyId)) return catalyst;
  return {
    ...catalyst,
    linkedStudies: catalyst.linkedStudies.filter((id) => id !== deletedStudyId)
  };
}
