import type { Edge, Node } from "@xyflow/react";

export type AppView =
  | "dashboard"
  | "studies"
  | "states"
  | "transitions"
  | "state-comparison"
  | "understanding-evolution"
  | "reflexivity-engine"
  | "map"
  | "emotions"
  | "catalysts"
  | "recognitions"
  | "timeline"
  | "analysis";

export type ConfirmationLevel = 1 | 2 | 3;
export type RelationStatus = "observée" | "supposée" | "confirmée" | "invalidée";
export type TransitionStage =
  | "État initial"
  | "Perturbation"
  | "Recherche"
  | "Nouvelle relation"
  | "Reconnaissance"
  | "Transformation"
  | "Stabilisation"
  | "Transmission";

export interface Study {
  id: string;
  title: string;
  description: string;
  subject: string;
  startDate: string;
  status: string;
  currentLevel: string;
  notes: string;
  states: UnderstandingState[];
  manifestations: Manifestation[];
  transitions: Transition[];
  recognitions: Recognition[];
  catalysts: Catalyst[];
  emotionObservations: EmotionObservation[];
  relations: Relation[];
  timeline: TimelineEvent[];
  map: ReflexiveMapData;
  history: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UnderstandingState {
  id: string;
  title: string;
  date: string;
  formulation: string;
  stability: number;
  confidence: number;
  confirmedElements: string[];
  uncertainElements: string[];
  language: string[];
  associatedBehaviors: string[];
}

export interface Transition {
  id: string;
  title: string;
  fromStateId: string;
  toStateId: string;
  triggeringManifestations: string[];
  newRelations: string[];
  emotions: string[];
  catalysts: string[];
  maturationDuration: string;
  recognitionWording: string;
  confirmationLevel: ConfirmationLevel;
  observableImpact: string;
  transmissionCapacity: string;
  date: string;
}

export interface Manifestation {
  id: string;
  title: string;
  date: string;
  description: string;
  evidenceLevel: ConfirmationLevel;
}

export interface Relation {
  id: string;
  source: string;
  target: string;
  type: string;
  strength: number;
  date: string;
  evidenceLevel: ConfirmationLevel;
  note: string;
  status: RelationStatus;
}

export interface EmotionObservation {
  id: string;
  emotion: string;
  intensity: number;
  date: string;
  context: string;
  transitionId?: string;
  duration: string;
  comment: string;
}

export interface Catalyst {
  id: string;
  name: string;
  type:
    | "personne"
    | "rencontre"
    | "livre"
    | "texte"
    | "symbole"
    | "événement"
    | "œuvre"
    | "intelligence artificielle"
    | "tradition"
    | "personnage historique"
    | "personnage symbolique"
    | "autre";
  description: string;
  context: string;
  linkedStudies: string[];
  linkedTransitions: string[];
  frequency: number;
  averageImpact: number;
  confirmationLevel: ConfirmationLevel;
}

export interface Recognition {
  id: string;
  title: string;
  date: string;
  studyId: string;
  exactWording: string;
  author: string;
  beforeStateId: string;
  afterStateId: string;
  triggers: string[];
  newRecognizedRelations: string[];
  emotions: string[];
  catalysts: string[];
  languageImpact: string;
  decisionImpact: string;
  relationImpact: string;
  projectImpact: string;
  transmissible: boolean;
  confirmed: boolean;
  stableOverTime: boolean;
  confirmationLevel: ConfirmationLevel;
}

export interface TimelineEvent {
  id: string;
  kind: "manifestation" | "émotion" | "catalyseur" | "transition" | "reconnaissance" | "transmission";
  title: string;
  date: string;
  summary: string;
  inDeltaPath: boolean;
}

export interface ReflexiveMapData {
  nodes: Node[];
  edges: Edge[];
}

export interface ObservatoryData {
  version: 1;
  studies: Study[];
}

export type ScientificLabel =
  | "Observation"
  | "Hypothese"
  | "Relation possible"
  | "Reformulation probable"
  | "Transformation observee"
  | "Indicateurs insuffisants"
  | "Confirmation utilisateur requise";

export type DifferenceKind =
  | "addition"
  | "removal"
  | "probable-reformulation"
  | "stabilization"
  | "potential-contradiction"
  | "insufficient-data";

export type DifferenceCategory =
  | "concept"
  | "relation"
  | "emotion"
  | "decision"
  | "project"
  | "language"
  | "stability"
  | "transmission";

export interface ReformulationCandidate {
  before: string;
  after: string;
  category: DifferenceCategory;
  confidence: number;
  reason: string;
  status: "Confirmation utilisateur requise";
  mergedAutomatically: false;
}

export interface DifferenceItem {
  id: string;
  kind: DifferenceKind;
  category: DifferenceCategory;
  label: ScientificLabel;
  before?: string;
  after?: string;
  detail: string;
  confidence: number;
  requiresUserValidation?: boolean;
}

export interface ConceptFrequency {
  concept: string;
  before: number;
  after: number;
  delta: number;
}

export interface LanguageEvolution {
  newWords: string[];
  abandonedWords: string[];
  stableWords: string[];
  vocabularyDelta: number;
  conceptFrequency: ConceptFrequency[];
  reformulationCandidates: ReformulationCandidate[];
  status: ScientificLabel;
}

export interface StateDifference {
  fromStateId: string;
  toStateId: string;
  timeBetweenDays: number | null;
  totalDifferences: number;
  categoriesConcerned: DifferenceCategory[];
  stabilityLevel: "stable" | "variation faible" | "variation forte" | "Indicateurs insuffisants";
  items: DifferenceItem[];
  conceptsAdded: string[];
  conceptsRemoved: string[];
  conceptsReformulated: ReformulationCandidate[];
  relationsAdded: string[];
  relationsRemoved: string[];
  relationsReformulated: ReformulationCandidate[];
  emotionsNew: string[];
  emotionsDisappeared: string[];
  emotionsStabilized: string[];
  decisionsNew: string[];
  decisionsAbandoned: string[];
  projectsNew: string[];
  projectsAbandoned: string[];
  language: LanguageEvolution;
  insufficientIndicators: string[];
}

export interface DeltaFactor {
  label: string;
  category: DifferenceCategory;
  value: number;
  reason: string;
  sourceDifferenceIds: string[];
}

export interface DeltaScore {
  score: number;
  positiveFactors: DeltaFactor[];
  negativeFactors: DeltaFactor[];
  neutralFactors: DeltaFactor[];
  limits: string[];
  interpretation: "variation observable" | "variation nulle ou stable" | "indicateurs insuffisants";
}

export interface RelationProposal {
  id: string;
  elements: [string, string];
  reason: string;
  confidence: number;
  provenance: string[];
  initialStatus: "hypothese";
  actions: ["valider", "rejeter"];
}

export interface CatalystMetrics {
  name: string;
  frequency: number;
  averageDaysBeforeTransformation: number | null;
  associatedTransitions: number;
  associatedEmotions: string[];
  associatedTransmissions: string[];
  influenceScore: number;
  limits: string[];
}

export interface EmotionSequence {
  sequence: string[];
  count: number;
  label: "Observation";
  limits: string[];
}

export interface ReflexivityDashboard {
  averageDelta: number | null;
  averageDaysBetweenStates: number | null;
  averageDaysBeforeStabilization: number | null;
  newConcepts: string[];
  newRelations: string[];
  frequentEmotions: Array<{ label: string; value: number }>;
  frequentCatalysts: CatalystMetrics[];
  newVocabulary: string[];
  transmissions: string[];
  limits: string[];
}

export interface TrajectoryComparison {
  studyIds: [string, string];
  similarity: number;
  commonSteps: string[];
  averageDays: number | null;
  commonCatalysts: string[];
  commonEmotions: string[];
  commonTransmissionForms: string[];
  comparedDimensions: string[];
  excludedDimensions: string[];
  limits: string[];
}
