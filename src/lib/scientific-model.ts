import type {
  DeltaFactor,
  DeltaScore,
  DifferenceCategory,
  EmotionObservation,
  ReflexiveRelationMetadata,
  ScientificEntityCategory,
  Study,
  UnderstandingState
} from "./types";
import type { Edge } from "@xyflow/react";

const UNDERSTANDING_MARKERS =
  /\b(compr(?:is|endre|éhension)|croyance|je pensais|je crois|je vois|perception|explication|raisonnement|reformul|hypoth[eè]se|signifie|parce que|donc|désormais|desormais)\b/i;
const EMOTION_WORDS =
  /\b(confusion|incertitude|curiosit[eé]|apaisement|clart[eé]|stress|doute|peur|joie|tristesse|col[eè]re|inqui[eé]tude|perdu|perdue)\b/i;
const BEHAVIOUR_MARKERS = /\b(action|comportement|d[eé]cision|mobilisation|agir|transmettre|t[eé]moigner|pratique|m[eé]thode)\b/i;
const METADATA_LABELS = /^(emotion actuelle d[eé]clar[eé]e|port[eé]e individuelle|port[eé]e collective|localisation|temporalit[eé]|population|sujet ou ph[eé]nom[eè]ne observ[eé])$/i;

export function containsUnderstanding(text: string) {
  return UNDERSTANDING_MARKERS.test(text);
}

export function inferStateType(state: UnderstandingState): NonNullable<UnderstandingState["type"]> {
  if (state.type) return state.type;
  const corpus = stateCorpus(state);
  if (containsUnderstanding(corpus)) return "UnderstandingState";
  if (BEHAVIOUR_MARKERS.test(corpus)) return "BehaviourState";
  return "EmotionalState";
}

export function comparableUnderstandingStates(before: UnderstandingState, after: UnderstandingState) {
  if (inferStateType(before) !== "UnderstandingState" || inferStateType(after) !== "UnderstandingState") return false;
  if (!containsUnderstanding(stateCorpus(before)) || !containsUnderstanding(stateCorpus(after))) return false;
  return sharedUnderstandingTopic(before, after);
}

export function sharedUnderstandingTopic(before: UnderstandingState, after: UnderstandingState) {
  const beforeTerms = conceptTerms(before);
  const afterTerms = conceptTerms(after);
  if (!beforeTerms.length || !afterTerms.length) return false;
  return beforeTerms.some((term) => afterTerms.includes(term));
}

export function conceptTerms(state: UnderstandingState) {
  return [...state.confirmedElements, ...state.uncertainElements, state.formulation]
    .flatMap((value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z]{4,}/g) ?? [])
    .filter((term) => !["avec", "dans", "pour", "entre", "cette", "comme", "mais", "plus", "moins"].includes(term));
}

export function stateCorpus(state: UnderstandingState) {
  return [
    state.title,
    state.formulation,
    ...state.confirmedElements,
    ...state.uncertainElements,
    ...state.language,
    ...state.associatedBehaviors
  ].join(" ");
}

export function classifyComparisonLabel(label: string): DifferenceCategory {
  if (METADATA_LABELS.test(label)) return "metadata";
  if (/emotion|intensit/i.test(label)) return "emotion";
  if (/comportement|mobilisation/i.test(label)) return "behaviour";
  if (/relation/i.test(label)) return "relation";
  if (/decision/i.test(label)) return "decision";
  if (/langage|vocabulaire/i.test(label)) return "language";
  return "concept";
}

export function ontologyCategory(value: string, fallback: ScientificEntityCategory = "Concept"): ScientificEntityCategory {
  if (METADATA_LABELS.test(value)) return "Métadonnée";
  if (EMOTION_WORDS.test(value)) return "Emotion";
  if (BEHAVIOUR_MARKERS.test(value)) return "Comportement";
  if (/reconnaissance|je reconnais/i.test(value)) return "Reconnaissance";
  if (/relation|lien|entre|->|↔/i.test(value)) return "Relation";
  if (/lieu|fontainebleau|france|for[eê]t|ville|pays/i.test(value)) return "Lieu";
  if (/organisation|association|institution/i.test(value)) return "Organisation";
  if (/symbole|signe/i.test(value)) return "Symbole";
  if (/manifestation|observation|fait observ/i.test(value)) return "Manifestation";
  return fallback;
}

export function emotionOriginLabel(origin: EmotionObservation["origin"]) {
  if (origin === "declared_by_person") return "déclarée par la personne";
  if (origin === "attributed_by_observer") return "attribuée par l'observateur";
  if (origin === "validated") return "validée";
  return "proposée par le moteur";
}

export function emptyDeltaScore(limits: string[]): DeltaScore {
  return {
    score: 0,
    positiveFactors: [],
    negativeFactors: [],
    neutralFactors: [],
    limits,
    interpretation: "indicateurs insuffisants"
  };
}

export function deltaFromFactors(factors: DeltaFactor[], limits: string[]): DeltaScore {
  const score = factors.reduce((sum, factor) => sum + factor.value, 0);
  return {
    score,
    positiveFactors: factors.filter((factor) => factor.value > 0),
    negativeFactors: factors.filter((factor) => factor.value < 0),
    neutralFactors: factors.filter((factor) => factor.value === 0),
    limits,
    interpretation: limits.length ? "indicateurs insuffisants" : score === 0 ? "variation nulle ou stable" : "variation observable"
  };
}

export function automaticMapRelations(study: Study): Edge[] {
  const existing = study.map.edges.map((edge) => ({
    ...edge,
    data: relationMetadataFromEdge(study, edge.data as Partial<ReflexiveRelationMetadata> | undefined) as unknown as Record<string, unknown>
  }));
  const existingKeys = new Set(existing.map((edge) => `${edge.source}->${edge.target}`));
  const generated = study.relations
    .filter((relation) => relation.studyId === undefined || relation.studyId === study.id)
    .filter((relation) => !existingKeys.has(`${relation.source}->${relation.target}`))
    .map((relation) => ({
      id: `edge-${relation.id}`,
      source: relation.source,
      target: relation.target,
      label: relation.type,
      animated: !isObservedRelation(relation.status),
      style: relationStyle(String(relation.status)),
      data: {
        type: relation.type,
        source: relation.relationSource ?? "moteur",
        confidence: relation.confidence ?? relation.strength / 100,
        studyId: study.id,
        observationId: relation.observationId ?? relation.sourceObservationIds?.[0],
        date: relation.date,
        status: isObservedRelation(relation.status) ? "fait observé" : isHypothesisRelation(relation.status) ? "hypothèse" : "interprétation"
      } satisfies ReflexiveRelationMetadata as Record<string, unknown>
    }));
  return [...existing, ...generated];
}

function relationMetadataFromEdge(study: Study, data?: Partial<ReflexiveRelationMetadata>): ReflexiveRelationMetadata {
  return {
    type: data?.type ?? "relation",
    source: data?.source ?? "observateur",
    confidence: data?.confidence ?? 0.5,
    studyId: data?.studyId ?? study.id,
    observationId: data?.observationId,
    date: data?.date ?? new Date().toISOString().slice(0, 10),
    status: data?.status ?? "fait observé"
  };
}

export function relationStyle(status: string) {
  if (status === "supposée" || status === "hypothèse") return { strokeDasharray: "6 6", stroke: "#d6b25e" };
  if (status === "interprétation") return { stroke: "#fb923c", strokeWidth: 2 };
  return { stroke: "#f0d990", strokeWidth: 2 };
}

function isObservedRelation(status: unknown) {
  return String(status).normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("observe");
}

function isHypothesisRelation(status: unknown) {
  return String(status).normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("suppose");
}
