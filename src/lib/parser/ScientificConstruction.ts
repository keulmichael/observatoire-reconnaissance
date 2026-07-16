import { historyEntry, persistentDeltaFromScore, recordFromDraft } from "../data-migration";
import { DeltaEngine } from "../engines/DeltaEngine";
import { LongitudinalObservationEngine } from "../engines/LongitudinalObservationEngine";
import { RelationEngine } from "../engines/RelationEngine";
import { StateDifferenceEngine } from "../engines/StateDifferenceEngine";
import { TrajectoryEngine } from "../engines/TrajectoryEngine";
import type {
  Catalyst,
  EmotionObservation,
  Manifestation,
  ObservationAnalysisDraft,
  ObservationProposalBase,
  ObservationProposalStatus,
  PersistentDeltaScore,
  PersistentRelationProposal,
  Recognition,
  Relation,
  StateDifference,
  Study,
  TimelineEvent,
  Transition,
  UnderstandingState
} from "../types";
import { stableId } from "./ObservationParser";

type ScientificArtifacts = {
  manifestations: Manifestation[];
  emotions: EmotionObservation[];
  catalysts: Catalyst[];
  relations: Relation[];
  states: UnderstandingState[];
  transitions: Transition[];
  recognitions: Recognition[];
  timeline: TimelineEvent[];
  relationProposals: PersistentRelationProposal[];
};

type ScientificConstructionResult = {
  study: Study;
  observationRecordId: string;
  stateDifference: StateDifference | null;
  delta: ReturnType<typeof DeltaEngine.calculate> | null;
  relationEngineProposals: ReturnType<typeof RelationEngine.analyze>;
  trajectoryComparisons: ReturnType<typeof TrajectoryEngine.compare>;
  warnings: string[];
};

const INTEGRATED_STATUSES: ObservationProposalStatus[] = ["accepted", "edited"];

export function constructScientificStudy(draft: ObservationAnalysisDraft, now = new Date().toISOString()): ScientificConstructionResult {
  assertValidated(draft);
  const artifacts = buildScientificArtifacts(draft, now);
  const baseStudy = buildStudy(draft, artifacts, now);
  const result = buildResult(baseStudy, [baseStudy], draft.id, now);
  return { ...result, study: enrichStudyWithObservation(baseStudy, draft, result.study, now) };
}

export function addObservationToStudy(
  draft: ObservationAnalysisDraft,
  targetStudy: Study,
  allStudies: Study[] = [targetStudy],
  now = new Date().toISOString()
): ScientificConstructionResult {
  assertValidated(draft);
  const artifacts = buildScientificArtifacts(draft, now);
  const mergedStudy = mergeArtifactsIntoStudy(draft, targetStudy, artifacts, now);
  const result = buildResult(
    mergedStudy,
    allStudies.map((study) => (study.id === targetStudy.id ? mergedStudy : study)),
    draft.id,
    now
  );
  return { ...result, study: enrichStudyWithObservation(mergedStudy, draft, result.study, now) };
}

function assertValidated(draft: ObservationAnalysisDraft) {
  if (draft.status !== "validated") {
    throw new Error("Le brouillon doit etre valide explicitement avant construction scientifique.");
  }
}

function isIntegrated<T extends { status: ObservationProposalStatus }>(item: T) {
  return INTEGRATED_STATUSES.includes(item.status);
}

function buildScientificArtifacts(draft: ObservationAnalysisDraft, now: string): ScientificArtifacts {
  const sourceObservationIds = [draft.id];
  const validProposalIds = integratedProposals(draft).map((item) => item.id);

  const manifestations = draft.detectedManifestations.filter(isIntegrated).map((item): Manifestation => ({
    id: stableId("manifestation", `${draft.id}-${item.id}-${item.label}`),
    title: item.label,
    date: now.slice(0, 10),
    description: item.sourceExcerpt,
    evidenceLevel: 1,
    sourceObservationIds,
    sourceExcerpt: item.sourceExcerpt,
    validatedProposalIds: [item.id],
    engineProvenance: ["ManifestationExtractor"],
    createdFromObservationAt: now,
    confidence: item.confidence,
    methodologicalStatus: draft.methodologicalStatus
  }));

  const emotions = draft.detectedEmotions.filter(isIntegrated).map((item): EmotionObservation => ({
    id: stableId("emotion-observation", `${draft.id}-${item.id}-${item.label}`),
    emotion: item.label,
    canonicalEmotion: item.canonicalEmotion ?? item.emotion,
    originalExpression: item.originalExpression ?? item.emotion,
    expressionKind: item.expressionKind,
    sourceKind: item.sourceKind,
    polarity: item.polarity ?? "present",
    scope: item.scope ?? "indeterminate",
    intensity: 5,
    date: now.slice(0, 10),
    context: item.sourceExcerpt,
    duration: "non renseigne",
    comment: item.reason,
    sourceObservationIds,
    sourceExcerpt: item.sourceExcerpt,
    validatedProposalIds: [item.id],
    engineProvenance: ["EmotionExtractor"],
    createdFromObservationAt: now,
    confidence: item.confidence,
    methodologicalStatus: draft.methodologicalStatus
  }));

  const catalysts = draft.detectedCatalysts.filter(isIntegrated).map((item): Catalyst => ({
    id: stableId("catalyst", `${draft.id}-${item.id}-${item.label}`),
    name: item.label,
    type: item.catalystType,
    description: item.reason,
    context: item.sourceExcerpt,
    linkedStudies: [],
    linkedTransitions: [],
    frequency: 1,
    averageImpact: 0,
    confirmationLevel: 1,
    sourceObservationIds,
    sourceExcerpt: item.sourceExcerpt,
    validatedProposalIds: [item.id],
    engineProvenance: ["CatalystExtractor"],
    createdFromObservationAt: now,
    confidence: item.confidence,
    methodologicalStatus: draft.methodologicalStatus
  }));

  const relations = draft.relationProposals.filter(isIntegrated).map((item): Relation => ({
    id: stableId("relation", `${draft.id}-${item.id}-${item.label}`),
    source: item.sourceA,
    target: item.sourceB,
    type: item.relationType,
    strength: Math.round(item.confidence * 100),
    date: now.slice(0, 10),
    evidenceLevel: 1,
    note: item.sourceExcerpt,
    status: "supposée",
    sourceObservationIds,
    sourceExcerpt: item.sourceExcerpt,
    validatedProposalIds: [item.id],
    engineProvenance: ["RelationEngine", "ChronologyBuilder"],
    createdFromObservationAt: now,
    confidence: item.confidence,
    methodologicalStatus: draft.methodologicalStatus
  }));

  const states = buildStates(draft, validProposalIds, now);
  const transitions = buildTransitions(draft, states, manifestations, emotions, catalysts, validProposalIds, now);
  const recognitions = buildRecognitions(draft, states, transitions, validProposalIds, now);
  const timeline = buildTimeline(manifestations, emotions, catalysts, now);
  const relationProposals = draft.relationProposals.map((proposal): PersistentRelationProposal => ({
    ...proposal,
    studyId: "",
    sourceObservationIds,
    engine: "RelationEngine",
    createdAt: now,
    updatedAt: now
  }));

  return { manifestations, emotions, catalysts, relations, states, transitions, recognitions, timeline, relationProposals };
}

function buildStates(draft: ObservationAnalysisDraft, validProposalIds: string[], now: string): UnderstandingState[] {
  if (!hasIdentifiableBeforeAfter(draft)) return [];
  const acceptedConcepts = draft.detectedConcepts.filter(isIntegrated).map((concept) => concept.label);
  const acceptedEmotions = draft.detectedEmotions.filter(isIntegrated).map((emotion) => emotion.label);
  const base = {
    sourceObservationIds: [draft.id],
    validatedProposalIds: validProposalIds,
    engineProvenance: ["ObservationParser", "StateDifferenceEngine"],
    createdFromObservationAt: now,
    methodologicalStatus: draft.methodologicalStatus,
    validationStatus: "a valider" as const,
    userComments: []
  };

  return [
    {
      id: stableId("state-before", `${draft.id}-before`),
      title: "Avant observation",
      date: now.slice(0, 10),
      formulation: draft.chronology[0]?.sourceExcerpt ?? draft.rawText,
      stability: 5,
      confidence: 4,
      confirmedElements: [],
      uncertainElements: acceptedConcepts,
      language: [],
      associatedBehaviors: [],
      sourceExcerpt: draft.chronology[0]?.sourceExcerpt ?? draft.rawText,
      confidenceScore: 0.4,
      ...base
    },
    {
      id: stableId("state-after", `${draft.id}-after`),
      title: "Apres observation",
      date: now.slice(0, 10),
      formulation: draft.chronology[draft.chronology.length - 1]?.sourceExcerpt ?? draft.rawText,
      stability: 4,
      confidence: 3,
      confirmedElements: [],
      uncertainElements: acceptedConcepts,
      language: acceptedEmotions,
      associatedBehaviors: [],
      sourceExcerpt: draft.chronology[draft.chronology.length - 1]?.sourceExcerpt ?? draft.rawText,
      confidenceScore: 0.3,
      ...base
    }
  ];
}

function hasIdentifiableBeforeAfter(draft: ObservationAnalysisDraft) {
  const acceptedChronology = draft.chronology.filter(isIntegrated);
  const hasBefore = acceptedChronology.some((entry) => entry.phase === "Avant");
  const hasAfter = acceptedChronology.some((entry) => entry.phase === "Apres");
  return hasBefore && hasAfter && acceptedChronology.length >= 2 && hasExplicitUnderstandingChange(draft);
}

function hasExplicitUnderstandingChange(draft: ObservationAnalysisDraft) {
  return /\b(compris|comprendre|compr[ée]hension nouvelle|reformul[ée]|reconnu|reconnaissance|maintenant je vois|elle voit|il voit)\b/i.test(draft.rawText);
}

function buildTransitions(
  draft: ObservationAnalysisDraft,
  states: UnderstandingState[],
  manifestations: Manifestation[],
  emotions: EmotionObservation[],
  catalysts: Catalyst[],
  validProposalIds: string[],
  now: string
): Transition[] {
  if (states.length < 2) return [];
  return [
    {
      id: stableId("transition", draft.id),
      title: "Transition issue d'une observation validee",
      fromStateId: states[0].id,
      toStateId: states[1].id,
      triggeringManifestations: manifestations.map((item) => item.title),
      newRelations: draft.relationProposals.filter(isIntegrated).map((item) => item.label),
      emotions: emotions.map((item) => item.emotion),
      catalysts: catalysts.map((item) => item.name),
      maturationDuration: "non calculable",
      recognitionWording: "",
      confirmationLevel: 1,
      observableImpact: "Transition possible a confirmer par observations supplementaires.",
      transmissionCapacity: "non renseignee",
      date: now.slice(0, 10),
      sourceObservationIds: [draft.id],
      sourceExcerpt: draft.rawText,
      validatedProposalIds: validProposalIds,
      engineProvenance: ["StateDifferenceEngine", "DeltaEngine"],
      createdFromObservationAt: now,
      confidence: 0.5,
      methodologicalStatus: draft.methodologicalStatus,
      explanation: "Cette transition existe car l'observation validee contient un avant, un apres et une reformulation explicite."
    }
  ];
}

function buildRecognitions(draft: ObservationAnalysisDraft, states: UnderstandingState[], transitions: Transition[], validProposalIds: string[], now: string): Recognition[] {
  if (!states.length || !transitions.length || !hasExplicitRecognition(draft.rawText)) return [];
  return [
    {
      id: stableId("recognition", draft.id),
      title: "Reconnaissance formulee",
      date: now.slice(0, 10),
      studyId: stableId("study", draft.id),
      exactWording: draft.rawText,
      author: "non renseigne",
      beforeStateId: states[0].id,
      afterStateId: states[1].id,
      triggers: transitions[0].triggeringManifestations,
      newRecognizedRelations: transitions[0].newRelations,
      emotions: transitions[0].emotions,
      catalysts: transitions[0].catalysts,
      languageImpact: "a confirmer",
      decisionImpact: "non documente",
      relationImpact: "a confirmer",
      projectImpact: "non documente",
      transmissible: false,
      confirmed: false,
      stableOverTime: false,
      confirmationLevel: 1,
      sourceObservationIds: [draft.id],
      sourceExcerpt: draft.rawText,
      validatedProposalIds: validProposalIds,
      engineProvenance: ["ObservationParser"],
      createdFromObservationAt: now,
      confidence: 0.5,
      methodologicalStatus: draft.methodologicalStatus
    }
  ];
}

function hasExplicitRecognition(rawText: string) {
  return /\b(j'ai compris|j’ai compris|elle a compris|il a compris|reconnaissance|nouvelle compr[ée]hension)\b/i.test(rawText);
}

function buildTimeline(manifestations: Manifestation[], emotions: EmotionObservation[], catalysts: Catalyst[], now: string): TimelineEvent[] {
  return [
    ...manifestations.map((item): TimelineEvent => tracedTimeline("timeline-manifestation", "manifestation", item.id, item.title, item.date, item.description, item)),
    ...emotions.map((item): TimelineEvent => tracedTimeline("timeline-emotion", "émotion", item.id, item.emotion, item.date, item.context, item)),
    ...catalysts.map((item): TimelineEvent => tracedTimeline("timeline-catalyst", "catalyseur", item.id, item.name, now.slice(0, 10), item.context, item))
  ];
}

function tracedTimeline(prefix: string, kind: TimelineEvent["kind"], id: string, title: string, date: string, summary: string, source: Manifestation | EmotionObservation | Catalyst): TimelineEvent {
  return {
    id: stableId(prefix, id),
    kind,
    title,
    date,
    summary,
    inDeltaPath: false,
    sourceObservationIds: source.sourceObservationIds,
    sourceExcerpt: source.sourceExcerpt,
    validatedProposalIds: source.validatedProposalIds,
    engineProvenance: source.engineProvenance,
    createdFromObservationAt: source.createdFromObservationAt,
    confidence: source.confidence,
    methodologicalStatus: source.methodologicalStatus
  };
}

function buildStudy(draft: ObservationAnalysisDraft, artifacts: ScientificArtifacts, now: string): Study {
  const studyId = stableId("study", draft.id);
  const linkedArtifacts = linkArtifactsToStudy(artifacts, studyId);
  return {
    id: studyId,
    title: "Observation validee",
    description: draft.rawText,
    subject: "Observation issue du Journal",
    startDate: now.slice(0, 10),
    status: draft.methodologicalStatus,
    currentLevel: draft.methodologicalStatus,
    notes: draft.conclusion,
    states: linkedArtifacts.states,
    manifestations: linkedArtifacts.manifestations,
    transitions: linkedArtifacts.transitions,
    recognitions: linkedArtifacts.recognitions,
    catalysts: linkedArtifacts.catalysts,
    emotionObservations: linkedArtifacts.emotions,
    relations: linkedArtifacts.relations,
    timeline: linkedArtifacts.timeline,
    map: buildMap(linkedArtifacts),
    history: ["Creation depuis une observation validee"],
    observations: [],
    openQuestions: [],
    structuredHistory: [],
    relationProposals: linkedArtifacts.relationProposals,
    deltaScores: [],
    createdAt: now,
    updatedAt: now
  };
}

function mergeArtifactsIntoStudy(draft: ObservationAnalysisDraft, targetStudy: Study, artifacts: ScientificArtifacts, now: string): Study {
  const linkedArtifacts = linkArtifactsToStudy(artifacts, targetStudy.id);
  return {
    ...targetStudy,
    status: draft.methodologicalStatus,
    currentLevel: draft.methodologicalStatus,
    notes: [targetStudy.notes, draft.conclusion].filter(Boolean).join("\n\n"),
    states: [...targetStudy.states, ...linkedArtifacts.states],
    manifestations: [...targetStudy.manifestations, ...linkedArtifacts.manifestations],
    transitions: [...targetStudy.transitions, ...linkedArtifacts.transitions],
    recognitions: [...targetStudy.recognitions, ...linkedArtifacts.recognitions],
    catalysts: [...targetStudy.catalysts, ...linkedArtifacts.catalysts],
    emotionObservations: [...targetStudy.emotionObservations, ...linkedArtifacts.emotions],
    relations: [...targetStudy.relations, ...linkedArtifacts.relations],
    timeline: [...targetStudy.timeline, ...linkedArtifacts.timeline].sort((left, right) => left.date.localeCompare(right.date)),
    map: buildMap({
      ...linkedArtifacts,
      manifestations: [...targetStudy.manifestations, ...linkedArtifacts.manifestations],
      emotions: [...targetStudy.emotionObservations, ...linkedArtifacts.emotions],
      catalysts: [...targetStudy.catalysts, ...linkedArtifacts.catalysts],
      relations: [...targetStudy.relations, ...linkedArtifacts.relations]
    }),
    relationProposals: [...(targetStudy.relationProposals ?? []), ...linkedArtifacts.relationProposals],
    history: [...targetStudy.history, "Observation ajoutee depuis le Journal"],
    updatedAt: now
  };
}

function linkArtifactsToStudy(artifacts: ScientificArtifacts, studyId: string): ScientificArtifacts {
  const transitions = artifacts.transitions;
  return {
    ...artifacts,
    recognitions: artifacts.recognitions.map((recognition) => ({ ...recognition, studyId })),
    catalysts: artifacts.catalysts.map((catalyst) => ({
      ...catalyst,
      linkedStudies: [...new Set([...catalyst.linkedStudies, studyId])],
      linkedTransitions: [...new Set([...catalyst.linkedTransitions, ...transitions.map((transition) => transition.id)])]
    })),
    relationProposals: artifacts.relationProposals.map((proposal) => ({ ...proposal, studyId }))
  };
}

function buildResult(study: Study, studies: Study[], observationId: string, now: string): ScientificConstructionResult {
  const sortedStates = study.states.slice().sort((left, right) => left.date.localeCompare(right.date));
  const stateDifference =
    sortedStates.length >= 2
      ? StateDifferenceEngine.compare(sortedStates[sortedStates.length - 2], sortedStates[sortedStates.length - 1])
      : null;
  const delta = stateDifference ? DeltaEngine.calculate(stateDifference) : null;
  const transition = study.transitions[study.transitions.length - 1];
  const persistentDelta = delta && transition
    ? persistentDeltaFromScore(
        stableId("delta", `${transition.id}-${observationId}`),
        transition.id,
        [observationId],
        delta,
        stateDifference?.insufficientIndicators ?? [],
        now
      )
    : null;
  const updatedStudy = persistentDelta
    ? attachDelta(study, transition.id, persistentDelta)
    : study;

  return {
    study: updatedStudy,
    observationRecordId: observationId,
    stateDifference,
    delta,
    relationEngineProposals: RelationEngine.analyze(updatedStudy),
    trajectoryComparisons: TrajectoryEngine.compare(studies.map((item) => (item.id === updatedStudy.id ? updatedStudy : item))),
    warnings: [
      sortedStates.length < 2 ? "Aucun Delta calcule : deux etats valides sont necessaires." : "",
      updatedStudy.recognitions.length ? "" : "Aucune reconnaissance creee : aucune comprehension nouvelle confirmee."
    ].filter(Boolean)
  };
}

function attachDelta(study: Study, transitionId: string, delta: PersistentDeltaScore): Study {
  return {
    ...study,
    transitions: study.transitions.map((transition) =>
      transition.id === transitionId ? { ...transition, deltaScoreId: delta.id } : transition
    ),
    deltaScores: [...(study.deltaScores ?? []), delta]
  };
}

function enrichStudyWithObservation(baseStudy: Study, draft: ObservationAnalysisDraft, resultStudy: Study, now: string): Study {
  const generated = {
    manifestationIds: resultStudy.manifestations.filter((item) => item.sourceObservationIds?.includes(draft.id)).map((item) => item.id),
    emotionIds: resultStudy.emotionObservations.filter((item) => item.sourceObservationIds?.includes(draft.id)).map((item) => item.id),
    catalystIds: resultStudy.catalysts.filter((item) => item.sourceObservationIds?.includes(draft.id)).map((item) => item.id),
    relationIds: resultStudy.relations.filter((item) => item.sourceObservationIds?.includes(draft.id)).map((item) => item.id),
    stateIds: resultStudy.states.filter((item) => item.sourceObservationIds?.includes(draft.id)).map((item) => item.id),
    transitionIds: resultStudy.transitions.filter((item) => item.sourceObservationIds?.includes(draft.id)).map((item) => item.id),
    recognitionIds: resultStudy.recognitions.filter((item) => item.sourceObservationIds?.includes(draft.id)).map((item) => item.id),
    timelineEventIds: resultStudy.timeline.filter((item) => item.sourceObservationIds?.includes(draft.id)).map((item) => item.id),
    deltaIds: (resultStudy.deltaScores ?? []).filter((item) => item.sourceObservationIds.includes(draft.id)).map((item) => item.id)
  };
  const preliminaryRecord = recordFromDraft(draft, resultStudy.id, generated, now);
  const longitudinalComparison = LongitudinalObservationEngine.compare(
    resultStudy,
    [...(baseStudy.observations ?? []), preliminaryRecord],
    preliminaryRecord,
    now
  );
  const record = {
    ...preliminaryRecord,
    generatedLongitudinalComparisonIds: [longitudinalComparison.id],
    engineResultsSummary: [...preliminaryRecord.engineResultsSummary, longitudinalComparison.conclusion]
  };
  const questions = record.openQuestions;
  return {
    ...resultStudy,
    longitudinalComparisons: [...(baseStudy.longitudinalComparisons ?? []), longitudinalComparison],
    observations: [...(baseStudy.observations ?? []), record],
    openQuestions: [...(baseStudy.openQuestions ?? []), ...questions],
    structuredHistory: [
      ...(baseStudy.structuredHistory ?? []),
      historyEntry(now, "observation creee", "ObservationRecord", record.id, "Observation validee et enregistree.", [record.id]),
      ...generated.stateIds.map((id) => historyEntry(now, "etat genere", "UnderstandingState", id, "Etat genere depuis une observation.", [record.id])),
      ...generated.transitionIds.map((id) => historyEntry(now, "transition generee", "Transition", id, "Transition generee depuis une observation.", [record.id])),
      ...generated.deltaIds.map((id) => historyEntry(now, "delta calcule", "PersistentDeltaScore", id, "Delta calcule et persiste.", [record.id])),
      historyEntry(
        now,
        "comparaison longitudinale",
        "LongitudinalObservationComparison",
        longitudinalComparison.id,
        longitudinalComparison.potentialTransition ?? longitudinalComparison.conclusion,
        longitudinalComparison.sourceObservationIds
      )
    ],
    history: [...resultStudy.history, `Observation ${record.id} enregistree`]
  };
}

function buildMap(artifacts: Pick<ScientificArtifacts, "manifestations" | "emotions" | "catalysts" | "relations">) {
  const nodes = [
    ...artifacts.manifestations.map((item, index) => node(item.id, item.title, "manifestation", index, 0, item.sourceObservationIds?.[0], item.sourceExcerpt)),
    ...artifacts.emotions.map((item, index) => node(item.id, item.emotion, "emotion", index, 1, item.sourceObservationIds?.[0], item.sourceExcerpt)),
    ...artifacts.catalysts.map((item, index) => node(item.id, item.name, "catalyseur", index, 2, item.sourceObservationIds?.[0], item.sourceExcerpt))
  ];
  const edges = artifacts.relations.map((relation) => ({
    id: `edge-${relation.id}`,
    source: relation.source,
    target: relation.target,
    label: relation.type
  }));
  return { nodes, edges };
}

function node(id: string, label: string, kind: string, index: number, row: number, sourceObservationId?: string, sourceExcerpt?: string) {
  return {
    id,
    position: { x: 80 + index * 180, y: 80 + row * 140 },
    data: { label, kind, sourceObservationId, sourceExcerpt }
  };
}

function integratedProposals(draft: ObservationAnalysisDraft): ObservationProposalBase[] {
  return proposals(draft).filter((item) => item.status === "accepted" || item.status === "edited");
}

function proposals(draft: ObservationAnalysisDraft): ObservationProposalBase[] {
  return [
    ...draft.detectedPeople,
    ...draft.detectedManifestations,
    ...draft.detectedEmotions,
    ...draft.detectedCatalysts,
    ...draft.detectedConcepts,
    ...draft.relationProposals
  ];
}
