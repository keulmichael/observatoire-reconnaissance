import type {
  AIObservationResult,
  HistoryEntry,
  ObservationAnalysisDraft,
  LongitudinalObservationComparison,
  ObservationRecord,
  ObservatoryData,
  PersistentDeltaScore,
  PersistentRelationProposal,
  Study
} from "./types";
import { defaultAISettings } from "./ai/ObservationAI";
import { createInitialTheories } from "./engines/TheoryEngine";
import { GlobalObservatory } from "./global-observatory";
import { extractCanonicalDimensions } from "./parser/DimensionExtractor";

export const CURRENT_SCHEMA_VERSION = 5 as const;
export const LEGACY_AI_PROVIDER = defaultAISettings.provider;

export function migrateObservatoryData(input: ObservatoryData): ObservatoryData {
  const now = new Date().toISOString();
  return {
    ...input,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ownerId: input.ownerId,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    studies: input.studies.map((study) => normalizeStudy(study, now)),
    observationDrafts: (input.observationDrafts ?? []).map((draft) => normalizeObservationDraft(draft, now)),
    aiSettings: { ...defaultAISettings, ...(input.aiSettings ?? {}) },
    aiObservationResults: (input.aiObservationResults ?? []).map((result) => normalizeAIObservationResult(result, now)),
    theories: input.theories?.length ? input.theories : createInitialTheories(),
    theoryRevisionProposals: input.theoryRevisionProposals ?? [],
    theoryPredictions: input.theoryPredictions ?? [],
    reciprocalTestimonies: input.reciprocalTestimonies ?? [],
    reflexiveSignatures: input.reflexiveSignatures ?? [],
    globalObservatory: GlobalObservatory.refresh({
      ...GlobalObservatory.initialState(now),
      ...(input.globalObservatory ?? {}),
      collectionLogs: input.globalObservatory?.collectionLogs ?? [],
      historicalImports: input.globalObservatory?.historicalImports ?? []
    })
  };
}

export function normalizeAIObservationResult(result: AIObservationResult, now = new Date().toISOString()): AIObservationResult {
  const legacy = result as AIObservationResult & {
    provider?: AIObservationResult["provider"] | null;
    model?: string | null;
    status?: AIObservationResult["status"] | null;
    tokenUsage?: AIObservationResult["tokenUsage"] | null;
    latency?: number | null;
    createdAt?: string | null;
    promptHash?: string | null;
  };
  const provider = legacy.provider || LEGACY_AI_PROVIDER;
  const model = legacy.model || defaultAISettings.model;
  const status = legacy.status ?? (legacy.response ? "success" : "error");
  const createdAt = legacy.createdAt || now;
  const promptHash = legacy.promptHash || hash(`${result.id}-${model}-${createdAt}`);
  return {
    ...result,
    promptHash,
    provider,
    model,
    createdAt,
    response: result.response ?? null,
    tokenUsage: legacy.tokenUsage ?? {},
    latency: legacy.latency ?? 0,
    status
  };
}

export function normalizeStudy(study: Study, now = new Date().toISOString()): Study {
  const legacy = study as Study & {
    title?: string | null;
    description?: string | null;
    subject?: string | null;
    startDate?: string | null;
    status?: string | null;
    currentLevel?: string | null;
    notes?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  const createdAt = legacy.createdAt || now;
  const updatedAt = legacy.updatedAt || createdAt;
  return {
    ...study,
    title: legacy.title || "Etude importee",
    description: legacy.description ?? "",
    subject: legacy.subject ?? "Sujet importe",
    startDate: legacy.startDate || createdAt.slice(0, 10),
    status: legacy.status || "Observation ouverte",
    currentLevel: legacy.currentLevel || legacy.status || "Observation ouverte",
    notes: legacy.notes ?? "",
    openQuestions: study.openQuestions ?? [],
    structuredHistory: study.structuredHistory ?? legacyHistory(study),
    relationProposals: study.relationProposals ?? [],
    deltaScores: study.deltaScores ?? [],
    observations: (study.observations ?? []).map((record) => normalizeObservationRecord(record, study, now)),
    longitudinalComparisons: (study.longitudinalComparisons ?? []).map((comparison) => normalizeLongitudinalComparison(comparison, study.id)),
    multidimensionalChanges: study.multidimensionalChanges ?? [],
    studySyntheses: study.studySyntheses ?? [],
    activeStudySynthesisId: study.activeStudySynthesisId ?? study.studySyntheses?.[0]?.id,
    createdAt,
    updatedAt
  };
}

function normalizeObservationDraft(draft: ObservationAnalysisDraft, now: string): ObservationAnalysisDraft {
  const legacy = draft as ObservationAnalysisDraft & {
    rawText?: string | null;
    status?: ObservationAnalysisDraft["status"] | null;
    createdAt?: string | null;
    methodologicalStatus?: ObservationAnalysisDraft["methodologicalStatus"] | null;
    conclusion?: string | null;
  };
  return {
    ...draft,
    rawText: legacy.rawText ?? "",
    detectedPeople: draft.detectedPeople ?? [],
    detectedManifestations: draft.detectedManifestations ?? [],
    detectedEmotions: draft.detectedEmotions ?? [],
    detectedCatalysts: draft.detectedCatalysts ?? [],
    detectedConcepts: draft.detectedConcepts ?? [],
    chronology: draft.chronology ?? [],
    relationProposals: draft.relationProposals ?? [],
    confirmationQuestions: draft.confirmationQuestions ?? [],
    analysisWarnings: draft.analysisWarnings ?? [],
    createdAt: legacy.createdAt || now,
    status: legacy.status ?? "draft",
    methodologicalStatus: legacy.methodologicalStatus ?? "Observation ouverte",
    conclusion: legacy.conclusion ?? ""
  };
}

function normalizeObservationRecord(record: ObservationRecord, study: Study, now: string): ObservationRecord {
  const legacy = record as ObservationRecord & {
    rawText?: string | null;
    status?: ObservationRecord["status"] | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  const createdAt = legacy.createdAt || now;
  const normalized = {
    ...record,
    ownerId: record.ownerId ?? study.ownerId,
    studyId: record.studyId || study.id,
    rawText: legacy.rawText ?? "",
    createdAt,
    updatedAt: legacy.updatedAt || createdAt,
    status: legacy.status ?? "active",
    detectedPeople: record.detectedPeople ?? [],
    detectedManifestations: record.detectedManifestations ?? [],
    detectedEmotions: record.detectedEmotions ?? [],
    detectedCatalysts: record.detectedCatalysts ?? [],
    detectedConcepts: record.detectedConcepts ?? [],
    detectedRelations: record.detectedRelations ?? [],
    acceptedProposalIds: record.acceptedProposalIds ?? [],
    editedProposalIds: record.editedProposalIds ?? [],
    rejectedProposalIds: record.rejectedProposalIds ?? [],
    validationHistory: record.validationHistory ?? [],
    generatedManifestationIds: record.generatedManifestationIds ?? [],
    generatedEmotionIds: record.generatedEmotionIds ?? [],
    generatedCatalystIds: record.generatedCatalystIds ?? [],
    generatedRelationIds: record.generatedRelationIds ?? [],
    generatedStateIds: record.generatedStateIds ?? [],
    generatedTransitionIds: record.generatedTransitionIds ?? [],
    generatedRecognitionIds: record.generatedRecognitionIds ?? [],
    generatedTimelineEventIds: record.generatedTimelineEventIds ?? [],
    generatedDeltaIds: record.generatedDeltaIds ?? [],
    enginesExecuted: record.enginesExecuted ?? [],
    engineResultsSummary: record.engineResultsSummary ?? [],
    methodologicalWarnings: record.methodologicalWarnings ?? [],
    sourceExcerpts: record.sourceExcerpts ?? [],
    openQuestions: record.openQuestions ?? []
  };
  return {
    ...normalized,
    detectedDimensions: normalized.detectedDimensions?.length ? normalized.detectedDimensions : extractCanonicalDimensions(normalized)
  };
}

function normalizeLongitudinalComparison(
  comparison: LongitudinalObservationComparison,
  studyId: string
): LongitudinalObservationComparison {
  const createdAt = comparison.createdAt ?? comparison.comparedAt;
  return {
    ...comparison,
    studyId: comparison.studyId || studyId,
    title: comparison.title ?? comparison.potentialTransition ?? "Comparaison longitudinale",
    previousStateProposal: comparison.previousStateProposal ?? comparison.proposedPreviousState,
    currentStateProposal: comparison.currentStateProposal ?? comparison.proposedCurrentState,
    detectedDifferences: comparison.detectedDifferences ?? comparison.differences,
    limitations: comparison.limitations ?? comparison.methodologicalLimits,
    questions: comparison.questions ?? comparison.confirmationQuestions,
    resultStatus: comparison.resultStatus ?? inferLongitudinalResultStatus(comparison),
    commonDimensions: comparison.commonDimensions ?? comparison.dimensionsCompared
      .filter((dimension) => dimension.previous.length && dimension.current.length)
      .map((dimension) => dimension.label),
    emotionalPerturbations: comparison.emotionalPerturbations ?? comparison.dimensionsCompared
      .filter((dimension) => dimension.key === "emotion")
      .flatMap((dimension) => [...dimension.previous, ...dimension.current]),
    observerInterpretations: comparison.observerInterpretations ?? [],
    directPersonFormulations: comparison.directPersonFormulations ?? [],
    observableTransformations: comparison.observableTransformations ?? [],
    noTransitionReason: comparison.noTransitionReason ?? (
      comparison.generatedTransitionId
        ? "Transition deja validee."
        : "Donnees insuffisantes pour creer une transition complete et calculer un Delta de comprehension."
    ),
    followUpQuestions: comparison.followUpQuestions ?? comparison.questions ?? comparison.confirmationQuestions,
    methodologicalStatus: comparison.methodologicalStatus ?? "Statut methodologique migre",
    engineProvenance: comparison.engineProvenance ?? [comparison.engineVersion],
    createdAt,
    updatedAt: comparison.updatedAt ?? createdAt,
    status: normalizeLongitudinalStatus(comparison.status)
  };
}

function inferLongitudinalResultStatus(
  comparison: LongitudinalObservationComparison
): NonNullable<LongitudinalObservationComparison["resultStatus"]> {
  if (!comparison.previousObservationId) return "no_comparable_data";
  if (comparison.generatedTransitionId) return "transition_candidate";
  if (comparison.potentialTransition && comparison.proposedPreviousState && comparison.proposedCurrentState) return "transition_candidate";
  if (comparison.dimensionsCompared.some((dimension) => dimension.key === "emotion" && (dimension.previous.length || dimension.current.length))) {
    return "emotional_perturbation";
  }
  return comparison.differences.length ? "insufficient_data" : "insufficient_data";
}

function normalizeLongitudinalStatus(status: LongitudinalObservationComparison["status"]): LongitudinalObservationComparison["status"] {
  if (status === "propose") return "proposed";
  if (status === "modifie") return "edited";
  if (status === "valide") return "validated";
  if (status === "rejete") return "rejected";
  return status;
}

export function recordFromDraft(
  draft: ObservationAnalysisDraft,
  studyId: string,
  generated: {
    manifestationIds: string[];
    emotionIds: string[];
    catalystIds: string[];
    relationIds: string[];
    stateIds: string[];
    transitionIds: string[];
    recognitionIds: string[];
    timelineEventIds: string[];
    deltaIds: string[];
    longitudinalComparisonIds?: string[];
  },
  now: string
): ObservationRecord {
  const acceptedProposalIds = proposals(draft).filter((item) => item.status === "accepted").map((item) => item.id);
  const editedProposalIds = proposals(draft).filter((item) => item.status === "edited").map((item) => item.id);
  const rejectedProposalIds = proposals(draft).filter((item) => item.status === "rejected").map((item) => item.id);
  const openQuestions = draft.confirmationQuestions.map((text, index) => ({
    id: `${draft.id}-question-${index}`,
    studyId,
    sourceObservationIds: [draft.id],
    text,
    status: "ouverte" as const,
    createdAt: now
  }));

  const record: ObservationRecord = {
    id: draft.id,
    studyId,
    rawText: draft.rawText,
    createdAt: draft.createdAt,
    updatedAt: now,
    status: "active",
    detectedPeople: draft.detectedPeople,
    detectedManifestations: draft.detectedManifestations,
    detectedEmotions: draft.detectedEmotions,
    detectedCatalysts: draft.detectedCatalysts,
    detectedConcepts: draft.detectedConcepts,
    detectedRelations: draft.relationProposals,
    detectedDimensions: [],
    acceptedProposalIds,
    editedProposalIds,
    rejectedProposalIds,
    validationHistory: [
      ...acceptedProposalIds.map((proposalId) => validationEntry(now, "proposition acceptee", proposalId)),
      ...editedProposalIds.map((proposalId) => validationEntry(now, "proposition modifiee", proposalId)),
      ...rejectedProposalIds.map((proposalId) => validationEntry(now, "proposition rejetee", proposalId)),
      {
        id: `${draft.id}-validated`,
        date: now,
        action: "observation validee",
        summary: "Observation validee et integree a une etude."
      }
    ],
    generatedManifestationIds: generated.manifestationIds,
    generatedEmotionIds: generated.emotionIds,
    generatedCatalystIds: generated.catalystIds,
    generatedRelationIds: generated.relationIds,
    generatedStateIds: generated.stateIds,
    generatedTransitionIds: generated.transitionIds,
    generatedRecognitionIds: generated.recognitionIds,
    generatedTimelineEventIds: generated.timelineEventIds,
    generatedDeltaIds: generated.deltaIds,
    generatedLongitudinalComparisonIds: generated.longitudinalComparisonIds ?? [],
    enginesExecuted: [
      "ObservationParser",
      "StateDifferenceEngine",
      "DeltaEngine",
      "RelationEngine",
      "TrajectoryEngine",
      "LongitudinalObservationEngine"
    ],
    engineResultsSummary: [
      draft.conclusion,
      generated.transitionIds.length ? "Transition creee." : "Transition non creee.",
      generated.deltaIds.length ? "Delta calcule." : "Delta non disponible.",
      generated.longitudinalComparisonIds?.length ? "Comparaison longitudinale produite." : "Comparaison longitudinale non disponible."
    ],
    methodologicalWarnings: draft.analysisWarnings,
    sourceExcerpts: [...new Set(proposals(draft).map((item) => item.sourceExcerpt).filter(Boolean))],
    openQuestions,
    aiResultId: draft.aiResultId,
    deterministicAnalysis: draft.deterministicAnalysis,
    aiAnalysis: draft.aiAnalysis,
    mergedObservation: draft.mergedObservation,
    observationMode: draft.observationMode,
    aiStatus: draft.aiStatus,
    aiError: draft.aiError,
    aiLatency: draft.aiLatency,
    aiModel: draft.aiModel,
    aiAnalyzedAt: draft.aiAnalyzedAt
  };
  return {
    ...record,
    detectedDimensions: extractCanonicalDimensions(record)
  };
}

export function historyEntry(
  date: string,
  actionType: HistoryEntry["actionType"],
  objectType: string,
  objectId: string,
  summary: string,
  sourceObservationIds: string[] = []
): HistoryEntry {
  return {
    id: `history-${hash(`${date}-${actionType}-${objectType}-${objectId}-${summary}`)}`,
    date,
    actionType,
    objectType,
    objectId,
    sourceObservationIds,
    summary
  };
}

export function persistentRelationProposal(
  proposal: PersistentRelationProposal,
  now: string
): PersistentRelationProposal {
  return {
    ...proposal,
    updatedAt: now
  };
}

export function persistentDeltaFromScore(
  id: string,
  transitionId: string,
  sourceObservationIds: string[],
  delta: {
    score: number;
    positiveFactors: PersistentDeltaScore["positiveFactors"];
    negativeFactors: PersistentDeltaScore["negativeFactors"];
    neutralFactors: PersistentDeltaScore["neutralFactors"];
    limits: string[];
    interpretation: string;
  },
  missingData: string[],
  calculatedAt: string
): PersistentDeltaScore {
  return {
    id,
    transitionId,
    sourceObservationIds,
    rawScore: delta.score,
    positiveFactors: delta.positiveFactors,
    negativeFactors: delta.negativeFactors,
    neutralFactors: delta.neutralFactors,
    missingData,
    limitations: delta.limits,
    calculatedAt,
    engineVersion: "DeltaEngine:v1",
    interpretationLabel: deltaLabel(delta.score, missingData.length > 0)
  };
}

function validationEntry(date: string, action: "proposition acceptee" | "proposition modifiee" | "proposition rejetee", proposalId: string) {
  return {
    id: `validation-${hash(`${date}-${action}-${proposalId}`)}`,
    date,
    action,
    proposalId,
    summary: `${action} : ${proposalId}`
  };
}

function legacyHistory(study: Study): HistoryEntry[] {
  const date = study.createdAt ?? new Date().toISOString();
  const history = study.history ?? [];
  return history.map((summary, index) =>
    historyEntry(date, "import", "study", `${study.id}-legacy-${index}`, summary)
  );
}

function proposals(draft: ObservationAnalysisDraft) {
  return [
    ...draft.detectedPeople,
    ...draft.detectedManifestations,
    ...draft.detectedEmotions,
    ...draft.detectedCatalysts,
    ...draft.detectedConcepts,
    ...draft.relationProposals
  ];
}

function deltaLabel(score: number, insufficient: boolean): PersistentDeltaScore["interpretationLabel"] {
  if (insufficient) return "Données insuffisantes";
  const abs = Math.abs(score);
  if (abs === 0) return "Calcul non disponible";
  if (abs <= 2) return "Variation faible observée";
  if (abs <= 6) return "Variation modérée observée";
  return "Variation importante observée";
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}
