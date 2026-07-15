import { DeltaEngine } from "../engines/DeltaEngine";
import { RelationEngine } from "../engines/RelationEngine";
import { StateDifferenceEngine } from "../engines/StateDifferenceEngine";
import { TrajectoryEngine } from "../engines/TrajectoryEngine";
import type {
  Catalyst,
  EmotionObservation,
  Manifestation,
  ObservationAnalysisDraft,
  ObservationProposalStatus,
  Recognition,
  Relation,
  StateDifference,
  Study,
  TimelineEvent,
  Transition,
  UnderstandingState
} from "../types";
import { stableId } from "./ObservationParser";

type ScientificConstructionResult = {
  study: Study;
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
  const study = buildStudy(draft, artifacts, now);
  return buildResult(study, [study]);
}

export function addObservationToStudy(
  draft: ObservationAnalysisDraft,
  targetStudy: Study,
  allStudies: Study[] = [targetStudy],
  now = new Date().toISOString()
): ScientificConstructionResult {
  assertValidated(draft);

  const artifacts = buildScientificArtifacts(draft, now);
  const updatedStudy: Study = {
    ...targetStudy,
    status: draft.methodologicalStatus,
    currentLevel: draft.methodologicalStatus,
    notes: [targetStudy.notes, draft.conclusion].filter(Boolean).join("\n\n"),
    states: [...targetStudy.states, ...artifacts.states],
    manifestations: [...targetStudy.manifestations, ...artifacts.manifestations],
    transitions: [...targetStudy.transitions, ...artifacts.transitions],
    recognitions: [
      ...targetStudy.recognitions,
      ...artifacts.recognitions.map((recognition) => ({ ...recognition, studyId: targetStudy.id }))
    ],
    catalysts: [
      ...targetStudy.catalysts,
      ...artifacts.catalysts.map((catalyst) => ({
        ...catalyst,
        linkedStudies: [...new Set([...catalyst.linkedStudies, targetStudy.id])]
      }))
    ],
    emotionObservations: [...targetStudy.emotionObservations, ...artifacts.emotions],
    relations: [...targetStudy.relations, ...artifacts.relations],
    timeline: [...targetStudy.timeline, ...artifacts.timeline].sort((left, right) => left.date.localeCompare(right.date)),
    history: [...targetStudy.history, "Observation ajoutee depuis le Journal"],
    updatedAt: now
  };

  return buildResult(
    updatedStudy,
    allStudies.map((study) => (study.id === targetStudy.id ? updatedStudy : study))
  );
}

function assertValidated(draft: ObservationAnalysisDraft) {
  if (draft.status !== "validated") {
    throw new Error("Le brouillon doit etre valide explicitement avant construction scientifique.");
  }
}

function isIntegrated<T extends { status: ObservationProposalStatus }>(item: T) {
  return INTEGRATED_STATUSES.includes(item.status);
}

function buildScientificArtifacts(draft: ObservationAnalysisDraft, now: string) {
  const manifestations = draft.detectedManifestations.filter(isIntegrated).map((item): Manifestation => ({
    id: stableId("manifestation", `${draft.id}-${item.id}-${item.label}`),
    title: item.label,
    date: now.slice(0, 10),
    description: item.sourceExcerpt,
    evidenceLevel: 1
  }));

  const emotions = draft.detectedEmotions.filter(isIntegrated).map((item): EmotionObservation => ({
    id: stableId("emotion-observation", `${draft.id}-${item.id}-${item.label}`),
    emotion: item.label,
    intensity: 5,
    date: now.slice(0, 10),
    context: item.sourceExcerpt,
    duration: "non renseigne",
    comment: item.reason
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
    confirmationLevel: 1
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
    status: "supposée"
  }));

  const states = buildStates(draft, now);
  const transitions = buildTransitions(draft, states, manifestations, emotions, catalysts, now);
  const recognitions = buildRecognitions(draft, states, transitions, now);
  const timeline = buildTimeline(manifestations, emotions, catalysts, now);

  return { manifestations, emotions, catalysts, relations, states, transitions, recognitions, timeline };
}

function buildStates(draft: ObservationAnalysisDraft, now: string): UnderstandingState[] {
  if (!hasIdentifiableBeforeAfter(draft)) return [];
  const acceptedConcepts = draft.detectedConcepts.filter(isIntegrated).map((concept) => concept.label);
  const acceptedEmotions = draft.detectedEmotions.filter(isIntegrated).map((emotion) => emotion.label);
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
      associatedBehaviors: []
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
      associatedBehaviors: []
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
      date: now.slice(0, 10)
    }
  ];
}

function buildRecognitions(draft: ObservationAnalysisDraft, states: UnderstandingState[], transitions: Transition[], now: string): Recognition[] {
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
      confirmationLevel: 1
    }
  ];
}

function hasExplicitRecognition(rawText: string) {
  return /\b(j'ai compris|j’ai compris|elle a compris|il a compris|reconnaissance|nouvelle compr[ée]hension)\b/i.test(rawText);
}

function buildTimeline(manifestations: Manifestation[], emotions: EmotionObservation[], catalysts: Catalyst[], now: string): TimelineEvent[] {
  return [
    ...manifestations.map((item): TimelineEvent => ({
      id: stableId("timeline-manifestation", item.id),
      kind: "manifestation",
      title: item.title,
      date: item.date,
      summary: item.description,
      inDeltaPath: false
    })),
    ...emotions.map((item): TimelineEvent => ({
      id: stableId("timeline-emotion", item.id),
      kind: "émotion",
      title: item.emotion,
      date: item.date,
      summary: item.context,
      inDeltaPath: false
    })),
    ...catalysts.map((item): TimelineEvent => ({
      id: stableId("timeline-catalyst", item.id),
      kind: "catalyseur",
      title: item.name,
      date: now.slice(0, 10),
      summary: item.context,
      inDeltaPath: false
    }))
  ];
}

function buildStudy(draft: ObservationAnalysisDraft, artifacts: ReturnType<typeof buildScientificArtifacts>, now: string): Study {
  const studyId = stableId("study", draft.id);
  return {
    id: studyId,
    title: "Observation validee",
    description: draft.rawText,
    subject: "Observation issue du Journal",
    startDate: now.slice(0, 10),
    status: draft.methodologicalStatus,
    currentLevel: draft.methodologicalStatus,
    notes: draft.conclusion,
    states: artifacts.states,
    manifestations: artifacts.manifestations,
    transitions: artifacts.transitions,
    recognitions: artifacts.recognitions.map((recognition) => ({ ...recognition, studyId })),
    catalysts: artifacts.catalysts.map((catalyst) => ({ ...catalyst, linkedStudies: [studyId] })),
    emotionObservations: artifacts.emotions,
    relations: artifacts.relations,
    timeline: artifacts.timeline,
    map: { nodes: [], edges: [] },
    history: ["Creation depuis une observation validee"],
    createdAt: now,
    updatedAt: now
  };
}

function buildResult(study: Study, studies: Study[]): ScientificConstructionResult {
  const sortedStates = study.states.slice().sort((left, right) => left.date.localeCompare(right.date));
  const stateDifference =
    sortedStates.length >= 2
      ? StateDifferenceEngine.compare(sortedStates[sortedStates.length - 2], sortedStates[sortedStates.length - 1])
      : null;
  const delta = stateDifference ? DeltaEngine.calculate(stateDifference) : null;

  return {
    study,
    stateDifference,
    delta,
    relationEngineProposals: RelationEngine.analyze(study),
    trajectoryComparisons: TrajectoryEngine.compare(studies),
    warnings: [
      sortedStates.length < 2 ? "Aucun Delta calcule : deux etats valides sont necessaires." : "",
      study.recognitions.length ? "" : "Aucune reconnaissance creee : aucune comprehension nouvelle confirmee."
    ].filter(Boolean)
  };
}
