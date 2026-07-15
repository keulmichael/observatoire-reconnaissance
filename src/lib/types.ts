import type { Edge, Node } from "@xyflow/react";

export type AppView =
  | "dashboard"
  | "studies"
  | "states"
  | "transitions"
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
