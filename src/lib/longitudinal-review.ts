import { historyEntry, persistentDeltaFromScore } from "./data-migration";
import { DeltaEngine } from "./engines/DeltaEngine";
import { StateDifferenceEngine } from "./engines/StateDifferenceEngine";
import { stableId } from "./parser/ObservationParser";
import type {
  LongitudinalConfidence,
  LongitudinalObservationComparison,
  ProposedObservedState,
  Study,
  Transition,
  UnderstandingState
} from "./types";

export type LongitudinalReviewStatus = "proposed" | "edited" | "validated" | "rejected";

export type LongitudinalEditPatch = {
  title: string;
  conclusion: string;
  previousStateProposal: ProposedObservedState | null;
  currentStateProposal: ProposedObservedState | null;
  dimensionsCompared: LongitudinalObservationComparison["dimensionsCompared"];
  detectedDifferences: LongitudinalObservationComparison["differences"];
  confidence: LongitudinalConfidence;
  limitations: string[];
  questions: string[];
  sourceExcerpts: LongitudinalObservationComparison["sourceExcerpts"];
};

export type LongitudinalReviewResult = {
  study: Study;
  comparison: LongitudinalObservationComparison;
  message: string;
  transitionId?: string;
  deltaId?: string;
};

export function validateLongitudinalComparison(
  study: Study,
  comparisonId: string,
  now = new Date().toISOString()
): LongitudinalReviewResult {
  const comparison = findComparison(study, comparisonId);
  if (isValidated(comparison)) {
    const existingTransition = comparison.generatedTransitionId
      ? study.transitions.find((transition) => transition.id === comparison.generatedTransitionId)
      : undefined;
    if (existingTransition) {
      return { study, comparison, message: "Transition deja validee.", transitionId: existingTransition.id, deltaId: comparison.generatedDeltaId };
    }
  }

  const sourceIds = [...new Set(comparison.sourceObservationIds)];
  const observations = sourceIds.map((id) => study.observations?.find((observation) => observation.id === id)).filter(Boolean);
  if (observations.length !== sourceIds.length) {
    throw new Error("Validation impossible : observation source introuvable.");
  }
  if (!comparison.previousObservationId || !comparison.currentObservationId) {
    throw new Error("Validation impossible : deux observations sources sont necessaires.");
  }

  const previousObservation = study.observations?.find((observation) => observation.id === comparison.previousObservationId);
  const currentObservation = study.observations?.find((observation) => observation.id === comparison.currentObservationId);
  if (!previousObservation || !currentObservation) {
    throw new Error("Validation impossible : les deux observations comparees sont introuvables.");
  }

  const previousProposal = comparison.previousStateProposal ?? comparison.proposedPreviousState;
  const currentProposal = comparison.currentStateProposal ?? comparison.proposedCurrentState;
  if (!isUsableStateProposal(previousProposal) || !isUsableStateProposal(currentProposal)) {
    throw new Error("Donnees insuffisantes : deux etats proposes et documentes sont necessaires.");
  }
  const usablePreviousProposal = previousProposal;
  const usableCurrentProposal = currentProposal;

  const previousState = findOrCreateState(study.states, usablePreviousProposal, previousObservation.id, comparison.id, "Etat anterieur propose", now);
  const currentState = findOrCreateState(
    previousState.created ? [...study.states, previousState.state] : study.states,
    usableCurrentProposal,
    currentObservation.id,
    comparison.id,
    "Etat actuel propose",
    now
  );
  const states = [
    ...study.states,
    ...(previousState.created ? [previousState.state] : []),
    ...(currentState.created ? [currentState.state] : [])
  ];

  const transitionId = comparison.generatedTransitionId ?? stableId("transition-longitudinal", `${comparison.id}-${previousState.state.id}-${currentState.state.id}`);
  const transition: Transition = {
    id: transitionId,
    title: comparison.title ?? comparison.potentialTransition ?? "Transition validee depuis une comparaison longitudinale",
    fromStateId: previousState.state.id,
    toStateId: currentState.state.id,
    triggeringManifestations: comparison.detectedDifferences?.map((difference) => difference.label) ?? comparison.differences.map((difference) => difference.label),
    newRelations: [],
    emotions: extractDimensionValues(comparison, "emotion"),
    catalysts: [],
    maturationDuration: "non calculee",
    recognitionWording: "",
    confirmationLevel: 1,
    observableImpact: comparison.conclusion,
    transmissionCapacity: "non renseignee",
    date: now.slice(0, 10),
    sourceObservationIds: sourceIds,
    sourceExcerpt: comparison.sourceExcerpts.map((item) => item.excerpt).join("\n"),
    validatedProposalIds: [comparison.id],
    engineProvenance: ["LongitudinalObservationEngine", "StateDifferenceEngine", "DeltaEngine"],
    createdFromObservationAt: now,
    confidence: confidenceNumber(comparison.confidence),
    methodologicalStatus: "Transition validee par l'utilisateur",
    explanation: comparison.conclusion
  };

  const transitionExists = study.transitions.some((item) => item.id === transitionId);
  const transitions = transitionExists
    ? study.transitions.map((item) => (item.id === transitionId ? { ...transition, deltaScoreId: item.deltaScoreId } : item))
    : [...study.transitions, transition];

  const stateDifference = StateDifferenceEngine.compare(previousState.state, currentState.state);
  const delta = DeltaEngine.calculate(stateDifference);
  const deltaId = comparison.generatedDeltaId ?? stableId("delta-longitudinal", `${transitionId}-${comparison.id}`);
  const persistentDelta = persistentDeltaFromScore(
    deltaId,
    transitionId,
    sourceIds,
    delta,
    stateDifference.insufficientIndicators,
    now
  );
  const deltaExists = (study.deltaScores ?? []).some((item) => item.id === deltaId);
  const deltaScores = deltaExists
    ? (study.deltaScores ?? []).map((item) => (item.id === deltaId ? persistentDelta : item))
    : [...(study.deltaScores ?? []), persistentDelta];

  const updatedTransition = { ...transition, deltaScoreId: persistentDelta.id };
  const updatedComparison: LongitudinalObservationComparison = {
    ...normalizeComparison(comparison),
    status: "validated",
    reviewedAt: now,
    updatedAt: now,
    generatedTransitionId: updatedTransition.id,
    generatedDeltaId: persistentDelta.id
  };

  const nextStudy = {
    ...study,
    states,
    transitions: transitions.map((item) => (item.id === updatedTransition.id ? updatedTransition : item)),
    deltaScores,
    longitudinalComparisons: updateComparison(study, updatedComparison),
    structuredHistory: [
      ...(study.structuredHistory ?? []),
      historyEntry(now, "transition generee", "Transition", updatedTransition.id, "Transition validee depuis une comparaison longitudinale.", sourceIds),
      historyEntry(now, "delta calcule", "PersistentDeltaScore", persistentDelta.id, "Delta calcule depuis une transition longitudinale validee.", sourceIds),
      historyEntry(now, "comparaison longitudinale", "LongitudinalObservationComparison", comparison.id, "Comparaison longitudinale validee.", sourceIds)
    ],
    updatedAt: now
  };

  assertNoOrphans(nextStudy, updatedTransition);
  return {
    study: nextStudy,
    comparison: updatedComparison,
    message: "Transition validee et enregistree.",
    transitionId: updatedTransition.id,
    deltaId: persistentDelta.id
  };
}

export function editLongitudinalComparison(
  study: Study,
  comparisonId: string,
  patch: LongitudinalEditPatch,
  now = new Date().toISOString()
): LongitudinalReviewResult {
  const comparison = findComparison(study, comparisonId);
  const normalized = normalizeComparison(comparison);
  const initialVersion = normalized.initialVersion ?? snapshotComparison(normalized, now);
  const updated: LongitudinalObservationComparison = {
    ...normalized,
    title: patch.title,
    conclusion: patch.conclusion,
    proposedPreviousState: patch.previousStateProposal,
    proposedCurrentState: patch.currentStateProposal,
    previousStateProposal: patch.previousStateProposal,
    currentStateProposal: patch.currentStateProposal,
    dimensionsCompared: patch.dimensionsCompared,
    differences: patch.detectedDifferences,
    detectedDifferences: patch.detectedDifferences,
    confidence: patch.confidence,
    methodologicalLimits: patch.limitations,
    limitations: patch.limitations,
    confirmationQuestions: patch.questions,
    questions: patch.questions,
    sourceExcerpts: patch.sourceExcerpts,
    status: "edited",
    initialVersion,
    updatedAt: now
  };
  const nextStudy = {
    ...study,
    longitudinalComparisons: updateComparison(study, updated),
    structuredHistory: [
      ...(study.structuredHistory ?? []),
      historyEntry(now, "comparaison longitudinale", "LongitudinalObservationComparison", comparison.id, "Comparaison longitudinale modifiee sans validation automatique.", comparison.sourceObservationIds)
    ],
    updatedAt: now
  };
  return { study: nextStudy, comparison: updated, message: "Proposition modifiee." };
}

export function rejectLongitudinalComparison(
  study: Study,
  comparisonId: string,
  reason: string,
  now = new Date().toISOString()
): LongitudinalReviewResult {
  const comparison = findComparison(study, comparisonId);
  const updated: LongitudinalObservationComparison = {
    ...normalizeComparison(comparison),
    status: "rejected",
    reviewedAt: now,
    updatedAt: now,
    rejectionReason: reason || "Motif non renseigne"
  };
  const nextStudy = {
    ...study,
    longitudinalComparisons: updateComparison(study, updated),
    structuredHistory: [
      ...(study.structuredHistory ?? []),
      historyEntry(now, "comparaison longitudinale", "LongitudinalObservationComparison", comparison.id, `Proposition rejetee : ${updated.rejectionReason}.`, comparison.sourceObservationIds)
    ],
    updatedAt: now
  };
  return {
    study: nextStudy,
    comparison: updated,
    message: "Proposition rejetee. Les observations sources sont conservees."
  };
}

export function normalizeComparison(comparison: LongitudinalObservationComparison): LongitudinalObservationComparison {
  const status = normalizeStatus(comparison.status);
  const createdAt = comparison.createdAt ?? comparison.comparedAt;
  return {
    ...comparison,
    title: comparison.title ?? comparison.potentialTransition ?? "Comparaison longitudinale",
    previousStateProposal: comparison.previousStateProposal ?? comparison.proposedPreviousState,
    currentStateProposal: comparison.currentStateProposal ?? comparison.proposedCurrentState,
    detectedDifferences: comparison.detectedDifferences ?? comparison.differences,
    limitations: comparison.limitations ?? comparison.methodologicalLimits,
    questions: comparison.questions ?? comparison.confirmationQuestions,
    engineProvenance: comparison.engineProvenance ?? [comparison.engineVersion],
    createdAt,
    updatedAt: comparison.updatedAt ?? createdAt,
    status
  };
}

export function normalizeStatus(status: LongitudinalObservationComparison["status"]): LongitudinalReviewStatus {
  if (status === "valide") return "validated";
  if (status === "modifie") return "edited";
  if (status === "rejete") return "rejected";
  return status === "propose" ? "proposed" : status;
}

function findComparison(study: Study, comparisonId: string) {
  const comparison = (study.longitudinalComparisons ?? []).find((item) => item.id === comparisonId);
  if (!comparison) throw new Error("Proposition longitudinale introuvable.");
  return comparison;
}

function isValidated(comparison: LongitudinalObservationComparison) {
  return normalizeStatus(comparison.status) === "validated";
}

function updateComparison(study: Study, updated: LongitudinalObservationComparison) {
  return (study.longitudinalComparisons ?? []).map((item) => (item.id === updated.id ? updated : normalizeComparison(item)));
}

function isUsableStateProposal(proposal: ProposedObservedState | null | undefined): proposal is ProposedObservedState {
  return Boolean(proposal?.summary.trim() && proposal.elements.length);
}

function findOrCreateState(
  states: UnderstandingState[],
  proposal: ProposedObservedState,
  observationId: string,
  comparisonId: string,
  fallbackTitle: string,
  now: string
) {
  const existing = states.find((state) =>
    state.sourceObservationIds?.includes(observationId)
    && state.sourceExcerpt === proposal.summary
  );
  if (existing) return { state: existing, created: false };
  const state: UnderstandingState = {
    id: stableId("state-longitudinal", `${comparisonId}-${observationId}-${proposal.summary}`),
    title: fallbackTitle,
    date: now.slice(0, 10),
    scope: proposal.scope,
    formulation: proposal.summary,
    stability: proposal.evidenceLevel === "eleve" ? 7 : proposal.evidenceLevel === "moyen" ? 5 : 3,
    confidence: proposal.evidenceLevel === "eleve" ? 7 : proposal.evidenceLevel === "moyen" ? 5 : 3,
    confirmedElements: [],
    uncertainElements: proposal.elements,
    language: [],
    associatedBehaviors: proposal.elements.filter((item) => /mobilisation|solidarite|action|comportement|implication/i.test(item)),
    sourceObservationIds: [observationId],
    sourceExcerpt: proposal.summary,
    validatedProposalIds: [comparisonId],
    engineProvenance: ["LongitudinalObservationEngine"],
    createdFromObservationAt: now,
    confidenceScore: confidenceNumber(proposal.evidenceLevel),
    methodologicalStatus: "Etat propose valide par l'utilisateur",
    validationStatus: "a valider",
    userComments: []
  };
  return { state, created: true };
}

function confidenceNumber(confidence: LongitudinalConfidence) {
  if (confidence === "eleve") return 0.8;
  if (confidence === "moyen") return 0.55;
  return 0.35;
}

function extractDimensionValues(comparison: LongitudinalObservationComparison, dimension: string) {
  return comparison.dimensionsCompared
    .filter((item) => item.key === dimension)
    .flatMap((item) => item.current);
}

function snapshotComparison(comparison: LongitudinalObservationComparison, savedAt: string) {
  return {
    title: comparison.title,
    conclusion: comparison.conclusion,
    proposedPreviousState: comparison.proposedPreviousState,
    proposedCurrentState: comparison.proposedCurrentState,
    dimensionsCompared: comparison.dimensionsCompared,
    differences: comparison.differences,
    methodologicalLimits: comparison.methodologicalLimits,
    confirmationQuestions: comparison.confirmationQuestions,
    sourceExcerpts: comparison.sourceExcerpts,
    confidence: comparison.confidence,
    savedAt
  };
}

function assertNoOrphans(study: Study, transition: Transition) {
  if (!study.states.some((state) => state.id === transition.fromStateId)) {
    throw new Error("Validation annulee : etat source introuvable apres construction.");
  }
  if (!study.states.some((state) => state.id === transition.toStateId)) {
    throw new Error("Validation annulee : etat cible introuvable apres construction.");
  }
  if (transition.deltaScoreId && !(study.deltaScores ?? []).some((delta) => delta.id === transition.deltaScoreId)) {
    throw new Error("Validation annulee : Delta orphelin detecte.");
  }
}
