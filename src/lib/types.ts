import type { Edge, Node } from "@xyflow/react";

export type AppView =
  | "journal"
  | "followup"
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
  | "analysis"
  | "theory-lab"
  | "recognition-theorem"
  | "reflexive-cycle"
  | "testimony-network"
  | "reflexive-signatures"
  | "theory-evolution";

export type ConfirmationLevel = 1 | 2 | 3;
export type ScientificEntityCategory =
  | "Emotion"
  | "Compréhension"
  | "Comportement"
  | "Concept"
  | "Manifestation"
  | "Catalyseur"
  | "Evénement"
  | "Relation"
  | "Reconnaissance"
  | "Métadonnée"
  | "Lieu"
  | "Personne"
  | "Organisation"
  | "Symbole";
export type StateType = "EmotionalState" | "UnderstandingState" | "BehaviourState";
export type EmotionOrigin = "declared_by_person" | "attributed_by_observer" | "proposed_by_engine" | "validated";
export type ReflexiveRelationStatus = "fait observé" | "hypothèse" | "interprétation";
export type ValidationStatus = "a valider" | "valide" | "conteste" | "revision demandee";
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
  observations?: ObservationRecord[];
  openQuestions?: OpenQuestion[];
  structuredHistory?: HistoryEntry[];
  relationProposals?: PersistentRelationProposal[];
  deltaScores?: PersistentDeltaScore[];
  longitudinalComparisons?: LongitudinalObservationComparison[];
  createdAt: string;
  updatedAt: string;
}

export interface UnderstandingState {
  id: string;
  type?: StateType;
  title: string;
  date: string;
  scope?: StateScope;
  formulation: string;
  stability: number;
  confidence: number;
  confirmedElements: string[];
  uncertainElements: string[];
  language: string[];
  associatedBehaviors: string[];
  sourceObservationIds?: string[];
  sourceExcerpt?: string;
  validatedProposalIds?: string[];
  engineProvenance?: string[];
  createdFromObservationAt?: string;
  confidenceScore?: number;
  methodologicalStatus?: string;
  validationStatus?: ValidationStatus;
  userComments?: string[];
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
  sourceObservationIds?: string[];
  sourceExcerpt?: string;
  validatedProposalIds?: string[];
  engineProvenance?: string[];
  createdFromObservationAt?: string;
  confidence?: number;
  methodologicalStatus?: string;
  deltaScoreId?: string;
  explanation?: string;
}

export interface Manifestation {
  id: string;
  title: string;
  date: string;
  description: string;
  evidenceLevel: ConfirmationLevel;
  sourceObservationIds?: string[];
  sourceExcerpt?: string;
  validatedProposalIds?: string[];
  engineProvenance?: string[];
  createdFromObservationAt?: string;
  confidence?: number;
  methodologicalStatus?: string;
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
  sourceObservationIds?: string[];
  sourceExcerpt?: string;
  validatedProposalIds?: string[];
  engineProvenance?: string[];
  createdFromObservationAt?: string;
  confidence?: number;
  methodologicalStatus?: string;
  studyId?: string;
  observationId?: string;
  relationSource?: "observateur" | "moteur" | "validation utilisateur";
}

export interface EmotionObservation {
  id: string;
  emotion: string;
  canonicalEmotion?: string;
  originalExpression?: string;
  expressionKind?: DetectedEmotion["expressionKind"];
  sourceKind?: DetectedEmotion["sourceKind"];
  polarity?: EmotionPolarity;
  scope?: EmotionScope;
  intensity?: number | null;
  origin?: EmotionOrigin;
  category?: "Emotion" | "Cognition";
  date: string;
  context: string;
  transitionId?: string;
  duration: string;
  comment: string;
  sourceObservationIds?: string[];
  sourceExcerpt?: string;
  validatedProposalIds?: string[];
  engineProvenance?: string[];
  createdFromObservationAt?: string;
  confidence?: number;
  methodologicalStatus?: string;
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
  sourceObservationIds?: string[];
  sourceExcerpt?: string;
  validatedProposalIds?: string[];
  engineProvenance?: string[];
  createdFromObservationAt?: string;
  confidence?: number;
  methodologicalStatus?: string;
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
  validation?: ValidationStatus;
  stability?: "non vérifiée" | "instable" | "stable";
  confirmationLevel: ConfirmationLevel;
  sourceObservationIds?: string[];
  sourceExcerpt?: string;
  validatedProposalIds?: string[];
  engineProvenance?: string[];
  createdFromObservationAt?: string;
  confidence?: number;
  methodologicalStatus?: string;
}

export interface TimelineEvent {
  id: string;
  kind: "manifestation" | "émotion" | "catalyseur" | "transition" | "reconnaissance" | "transmission";
  title: string;
  date: string;
  summary: string;
  inDeltaPath: boolean;
  sourceObservationIds?: string[];
  sourceExcerpt?: string;
  validatedProposalIds?: string[];
  engineProvenance?: string[];
  createdFromObservationAt?: string;
  confidence?: number;
  methodologicalStatus?: string;
}

export interface ReflexiveMapData {
  nodes: Node[];
  edges: Edge[];
}

export interface ReflexiveRelationMetadata {
  type: string;
  source: "observateur" | "moteur" | "validation utilisateur";
  confidence: number;
  studyId: string;
  observationId?: string;
  date: string;
  status: ReflexiveRelationStatus;
}

export interface ObservatoryData {
  version: 1;
  schemaVersion?: 2 | 3 | 4;
  studies: Study[];
  observationDrafts?: ObservationAnalysisDraft[];
  aiSettings?: ObservationAISettings;
  aiObservationResults?: AIObservationResult[];
  theories?: Theory[];
  theoryRevisionProposals?: TheoryRevisionProposal[];
  theoryPredictions?: TheoryPrediction[];
  reciprocalTestimonies?: ReciprocalTestimony[];
  reflexiveSignatures?: ReflexiveSignature[];
}

export type ObservationDraftStatus = "draft" | "reviewed" | "validated" | "rejected";
export type ObservationProposalStatus = "proposed" | "accepted" | "edited" | "rejected";
export type TemporalPrecision = "date explicite" | "date relative" | "ordre narratif" | "date inconnue";
export type ObservationMethodStatus =
  | "Observation ouverte"
  | "Donnees insuffisantes"
  | "Transition possible"
  | "Reconnaissance formulee"
  | "Stabilisation a verifier"
  | "Transformation durable confirmee";

export interface ObservationProposalBase {
  id: string;
  label: string;
  sourceExcerpt: string;
  confidence: number;
  status: ObservationProposalStatus;
  reason: string;
  provenance: string[];
}

export interface DetectedPerson extends ObservationProposalBase {
  entityText: string;
}

export interface DetectedManifestation extends ObservationProposalBase {
  kind: "presentation" | "message" | "discussion" | "rencontre" | "lecture" | "decision" | "declaration" | "evenement";
  dateHint?: string;
}

export interface DetectedEmotion extends ObservationProposalBase {
  emotion: string;
  canonicalEmotion?: string;
  originalExpression?: string;
  expressionKind: "exprimee directement" | "attribuee par le narrateur" | "supposee";
  sourceKind: "citation" | "discours rapporte" | "narration" | "inconnue";
  polarity?: EmotionPolarity;
  scope?: EmotionScope;
}

export interface DetectedCatalyst extends ObservationProposalBase {
  catalystType: Catalyst["type"];
}

export interface DetectedConcept extends ObservationProposalBase {
  concept: string;
}

export interface ObservationChronologyEntry {
  id: string;
  label: string;
  sourceExcerpt: string;
  order: number;
  phase: "Avant" | "Pendant" | "Apres" | "Ordre narratif";
  temporalMarker: string;
  precision: TemporalPrecision;
  status: ObservationProposalStatus;
  reason: string;
  provenance: string[];
}

export interface ObservationRelationProposal extends ObservationProposalBase {
  sourceA: string;
  sourceB: string;
  relationType: "relation temporelle" | "relation possible";
  initialStatus: "hypothese";
}

export interface ObservationAnalysisDraft {
  id: string;
  rawText: string;
  detectedPeople: DetectedPerson[];
  detectedManifestations: DetectedManifestation[];
  detectedEmotions: DetectedEmotion[];
  detectedCatalysts: DetectedCatalyst[];
  detectedConcepts: DetectedConcept[];
  chronology: ObservationChronologyEntry[];
  relationProposals: ObservationRelationProposal[];
  confirmationQuestions: string[];
  analysisWarnings: string[];
  createdAt: string;
  status: ObservationDraftStatus;
  methodologicalStatus: ObservationMethodStatus;
  conclusion: string;
  observationMode?: ObservationMode;
  deterministicAnalysis?: ObservationAIResponse;
  aiAnalysis?: ObservationAIResponse;
  aiResultId?: string;
  aiStatus?: AIObservationResult["status"];
  aiError?: string;
  aiLatency?: number;
  aiModel?: string;
  aiAnalyzedAt?: string;
  mergedObservation?: MergedObservationAnalysis;
}

export type ObservationMode = "local" | "ai-assisted";

export interface ObservationAISettings {
  mode: ObservationMode;
  provider: "openai";
  model: string;
  temperature: number;
  keepResponses: boolean;
  autoReanalyze: boolean;
  showReasoningSummary: boolean;
  showParserAIDifferences: boolean;
  allowFullStudyContext: boolean;
}

export type AIProposalStatus = "proposed" | "accepted" | "edited" | "rejected";
export type AIProposalSource = "parser" | "ai" | "parser+ai" | "user";

export interface AIObservationProposal {
  id: string;
  type: string;
  label: string;
  excerpt: string;
  confidence: number;
  reason: string;
  source: AIProposalSource;
  status: AIProposalStatus;
  model?: string;
  version?: string;
  promptHash?: string;
  createdAt?: string;
  latency?: number;
  userValidation?: {
    status: Exclude<AIProposalStatus, "proposed">;
    validatedAt: string;
    comment?: string;
  };
}

export type ObservationAICollectionKey =
  | "people"
  | "organisations"
  | "places"
  | "manifestations"
  | "events"
  | "objects"
  | "concepts"
  | "emotions"
  | "emotionScope"
  | "behaviours"
  | "decisions"
  | "intentions"
  | "relations"
  | "questions"
  | "timeline";

export type ObservationAIResponse = Record<ObservationAICollectionKey, AIObservationProposal[]> & {
  confidence: number;
  limitations: string[];
  uncertainties: string[];
  reasoningSummary: string;
};

export interface AIObservationResult {
  id: string;
  promptHash: string;
  provider: ObservationAISettings["provider"];
  model: string;
  createdAt: string;
  response: ObservationAIResponse | null;
  tokenUsage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  latency: number;
  status: "success" | "cached" | "error" | "offline" | "disabled";
  error?: string;
}

export interface AIConnectionStatus {
  configured: boolean;
  provider: ObservationAISettings["provider"];
  reachable: boolean;
  model: string;
  mode: "local" | "assisted";
  message: string;
  latency: number | null;
  checkedAt: string;
  lastError?: string;
}

export interface MergedObservationItem extends AIObservationProposal {
  sources: AIProposalSource[];
  parserProposalIds: string[];
  aiProposalIds: string[];
  mergeStatus: "convergence" | "parser-only" | "ai-only" | "divergence";
}

export type MergedObservationAnalysis = Record<ObservationAICollectionKey, MergedObservationItem[]> & {
  differences: MergedObservationItem[];
  convergences: MergedObservationItem[];
  createdAt: string;
};

export type ObservationRecordStatus = "active" | "archived" | "deleted";
export type OpenQuestionStatus = "ouverte" | "repondue" | "abandonnee";

export interface ValidationHistoryEntry {
  id: string;
  date: string;
  action: "proposition acceptee" | "proposition modifiee" | "proposition rejetee" | "observation validee";
  proposalId?: string;
  summary: string;
}

export interface ObservationRecord {
  id: string;
  studyId: string;
  rawText: string;
  createdAt: string;
  updatedAt: string;
  status: ObservationRecordStatus;
  authorLabel?: string;
  detectedPeople: DetectedPerson[];
  detectedManifestations: DetectedManifestation[];
  detectedEmotions: DetectedEmotion[];
  detectedCatalysts: DetectedCatalyst[];
  detectedConcepts: DetectedConcept[];
  detectedRelations: ObservationRelationProposal[];
  acceptedProposalIds: string[];
  editedProposalIds: string[];
  rejectedProposalIds: string[];
  validationHistory: ValidationHistoryEntry[];
  generatedManifestationIds: string[];
  generatedEmotionIds: string[];
  generatedCatalystIds: string[];
  generatedRelationIds: string[];
  generatedStateIds: string[];
  generatedTransitionIds: string[];
  generatedRecognitionIds: string[];
  generatedTimelineEventIds: string[];
  generatedDeltaIds: string[];
  generatedLongitudinalComparisonIds?: string[];
  enginesExecuted: string[];
  engineResultsSummary: string[];
  methodologicalWarnings: string[];
  sourceExcerpts: string[];
  openQuestions: OpenQuestion[];
  aiResultId?: string;
  deterministicAnalysis?: ObservationAIResponse;
  aiAnalysis?: ObservationAIResponse;
  mergedObservation?: MergedObservationAnalysis;
  observationMode?: ObservationMode;
  aiStatus?: AIObservationResult["status"];
  aiError?: string;
  aiLatency?: number;
  aiModel?: string;
  aiAnalyzedAt?: string;
  theoryEvidenceLinks?: TheoryEvidenceLink[];
  reflexiveCycleStepIds?: ReflexiveCycleStep[];
  reciprocalTestimonyIds?: string[];
  sufferingObservation?: SufferingObservation;
}

export interface OpenQuestion {
  id: string;
  studyId: string;
  sourceObservationIds: string[];
  text: string;
  status: OpenQuestionStatus;
  answer?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface HistoryEntry {
  id: string;
  date: string;
  actionType:
    | "observation creee"
    | "observation modifiee"
    | "proposition acceptee"
    | "proposition rejetee"
    | "etat genere"
    | "etat valide"
    | "transition generee"
    | "delta calcule"
    | "comparaison longitudinale"
    | "relation validee"
    | "import"
    | "suppression"
    | "restauration"
    | "export";
  objectType: string;
  objectId: string;
  sourceObservationIds?: string[];
  summary: string;
}

export interface PersistentRelationProposal extends ObservationRelationProposal {
  studyId: string;
  sourceObservationIds: string[];
  engine: string;
  createdAt: string;
  updatedAt: string;
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
  | "behaviour"
  | "metadata"
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

export interface PersistentDeltaScore {
  id: string;
  transitionId: string;
  sourceObservationIds: string[];
  rawScore: number;
  positiveFactors: DeltaFactor[];
  negativeFactors: DeltaFactor[];
  neutralFactors: DeltaFactor[];
  missingData: string[];
  limitations: string[];
  calculatedAt: string;
  engineVersion: string;
  interpretationLabel:
    | "Variation faible observée"
    | "Variation modérée observée"
    | "Variation importante observée"
    | "Données insuffisantes"
    | "Calcul non disponible";
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

export type StateScope = "individuel" | "groupe" | "collectif" | "institutionnel" | "indetermine";
export type EmotionPolarity = "present" | "absent" | "negated" | "uncertain";
export type EmotionScope = "individual" | "group" | "collective" | "indeterminate";
export type LongitudinalComparisonStatus = "proposed" | "edited" | "validated" | "rejected" | "propose" | "valide" | "modifie" | "rejete";
export type LongitudinalConfidence = "faible" | "moyen" | "eleve";
export type LongitudinalResultStatus =
  | "no_comparable_data"
  | "emotional_perturbation"
  | "possible_reformulation"
  | "observable_understanding_change"
  | "transition_candidate"
  | "insufficient_data";

export type LongitudinalDimensionKey =
  | "sujet"
  | "population"
  | "emotion"
  | "intensiteEmotionnelle"
  | "comportement"
  | "mobilisation"
  | "decision"
  | "objetAttention"
  | "concepts"
  | "relations"
  | "localisation"
  | "temporalite"
  | "portee";

export interface LongitudinalDimensionSnapshot {
  key: LongitudinalDimensionKey;
  label: string;
  previous: string[];
  current: string[];
}

export interface ProposedObservedState {
  scope: StateScope;
  evidenceLevel: LongitudinalConfidence;
  summary: string;
  elements: string[];
}

export interface LongitudinalDifference {
  dimension: LongitudinalDimensionKey;
  label: string;
  previous: string[];
  current: string[];
  summary: string;
}

export interface ComparableObservation {
  observationId: string;
  createdAt: string;
  relevanceScore: number;
  sharedDimensions: LongitudinalDimensionKey[];
  sourceExcerpt: string;
}

export interface LongitudinalObservationComparison {
  id: string;
  studyId: string;
  sourceObservationIds: string[];
  previousObservationId?: string;
  currentObservationId: string;
  title?: string;
  comparableObservations: ComparableObservation[];
  dimensionsCompared: LongitudinalDimensionSnapshot[];
  differences: LongitudinalDifference[];
  proposedPreviousState: ProposedObservedState | null;
  proposedCurrentState: ProposedObservedState | null;
  previousStateProposal?: ProposedObservedState | null;
  currentStateProposal?: ProposedObservedState | null;
  detectedDifferences?: LongitudinalDifference[];
  potentialTransition: string | null;
  missingData: string[];
  methodologicalLimits: string[];
  limitations?: string[];
  confirmationQuestions: string[];
  questions?: string[];
  sourceExcerpts: Array<{ observationId: string; excerpt: string }>;
  resultStatus?: LongitudinalResultStatus;
  commonDimensions?: string[];
  emotionalPerturbations?: string[];
  observerInterpretations?: string[];
  directPersonFormulations?: string[];
  observableTransformations?: string[];
  noTransitionReason?: string;
  followUpQuestions?: string[];
  methodologicalStatus?: string;
  comparedAt: string;
  engine: "LongitudinalObservationEngine";
  engineVersion: string;
  engineProvenance?: string[];
  createdAt?: string;
  updatedAt?: string;
  status: LongitudinalComparisonStatus;
  confidence: LongitudinalConfidence;
  conclusion: string;
  reviewedAt?: string;
  rejectionReason?: string;
  generatedTransitionId?: string;
  generatedDeltaId?: string;
  initialVersion?: {
    title?: string;
    conclusion: string;
    proposedPreviousState: ProposedObservedState | null;
    proposedCurrentState: ProposedObservedState | null;
    dimensionsCompared: LongitudinalDimensionSnapshot[];
    differences: LongitudinalDifference[];
    methodologicalLimits: string[];
    confirmationQuestions: string[];
    sourceExcerpts: Array<{ observationId: string; excerpt: string }>;
    confidence: LongitudinalConfidence;
    savedAt: string;
  };
}

export type ResearchLevel = "empirical" | "analytical" | "theoretical" | "predictive";
export type TheoryElementType =
  | "axiom"
  | "principle"
  | "proposition"
  | "demonstration"
  | "theorem"
  | "corollary"
  | "open-hypothesis"
  | "prediction";
export type TheoryElementStatus =
  | "hypothese"
  | "formule"
  | "en observation"
  | "soutenu par certaines observations"
  | "conteste"
  | "insuffisamment documente"
  | "revise"
  | "abandonne";
export type TheoryConfidenceLabel =
  | "insuffisamment documente"
  | "en observation"
  | "soutenu par certaines observations"
  | "conteste";
export type TheoryEvidenceRelation = "supports" | "contradicts" | "enriches" | "not-concerned";
export type TheoryEvidenceStatus = "proposed" | "validated" | "rejected" | "deferred";
export type TheoryElementRelationType =
  | "complete"
  | "precise"
  | "contredit"
  | "generalise"
  | "depend de"
  | "reformule";
export type TheoryRevisionProposalKind =
  | "element-potentiellement-soutenu"
  | "element-potentiellement-contredit"
  | "element-potentiellement-enrichi"
  | "donnees-insuffisantes"
  | "nouvelle-question"
  | "proposition-de-revision"
  | "prediction-possible";
export type TheoryProposalStatus = "proposed" | "accepted" | "edited" | "rejected" | "deferred";
export type TheoryPredictionStatus =
  | "proposee"
  | "active"
  | "confirmee partiellement"
  | "non confirmee"
  | "contredite"
  | "abandonnee";
export type ReflexiveCycleStep =
  | "relation"
  | "testimony"
  | "solitude"
  | "recognition"
  | "transformation"
  | "new-relation";
export type ObservedEffectStatus =
  | "effet directement formule"
  | "effet attribue par l'observateur"
  | "effet suppose"
  | "effet confirme dans le temps";

export interface Theory {
  id: string;
  title: string;
  summary: string;
  currentVersionId: string;
  linkedTheoryIds: string[];
  relationLinks: TheoryElementRelation[];
  elements: TheoryElement[];
  versions: TheoryVersion[];
  history: TheoryHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface TheoryVersion {
  id: string;
  theoryId: string;
  version: string;
  createdAt: string;
  author: string;
  reason: string;
  observationIds: string[];
  studyIds: string[];
  previousVersionId?: string;
  elementSnapshots: Array<{
    id: string;
    type: TheoryElementType;
    title: string;
    statement: string;
    explanation: string;
    status: TheoryElementStatus;
    confidenceLabel: TheoryConfidenceLabel;
    sourceObservationIds: string[];
    sourceStudyIds: string[];
    supportingEvidenceIds: string[];
    contradictingEvidenceIds: string[];
    enrichingEvidenceIds: string[];
  }>;
}

export interface TheoryElement {
  id: string;
  theoryId: string;
  parentElementIds?: string[];
  type: TheoryElementType;
  title: string;
  statement: string;
  explanation: string;
  version: string;
  status: TheoryElementStatus;
  createdAt: string;
  updatedAt: string;
  author: string;
  confidenceLabel: TheoryConfidenceLabel;
  sourceObservationIds: string[];
  sourceStudyIds: string[];
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  enrichingEvidenceIds: string[];
  unresolvedQuestions: string[];
  limitations: string[];
  revisionHistory: TheoryHistoryEntry[];
}

export interface TheoryElementRelation {
  id: string;
  sourceTheoryId: string;
  sourceElementId: string;
  targetTheoryId: string;
  targetElementId: string;
  relation: TheoryElementRelationType;
  explanation: string;
  createdAt: string;
  author: string;
}

export interface TheoryEvidenceLink {
  id: string;
  theoryId: string;
  theoryElementId: string;
  observationId: string;
  studyId: string;
  relation: TheoryEvidenceRelation;
  researchLevel: ResearchLevel;
  sourceExcerpts: string[];
  reasoningSummary: string;
  limitations: string[];
  status: TheoryEvidenceStatus;
  createdAt: string;
  validatedBy?: string;
  validatedAt?: string;
}

export interface TheoryAssessment {
  theoryId: string;
  theoryElementId: string;
  observationCount: number;
  confirmations: number;
  contradictions: number;
  enrichments: number;
  uncertaintyZones: string[];
  confidenceLabel: TheoryConfidenceLabel;
  openQuestions: string[];
  cautiousSummary: string;
  evidenceLinks: TheoryEvidenceLink[];
}

export interface TheoryRevisionProposal {
  id: string;
  kind: TheoryRevisionProposalKind;
  theoryId: string;
  theoryElementId: string;
  observationIds: string[];
  studyIds: string[];
  sourceExcerpts: string[];
  reasoningSummary: string;
  confidence: number;
  limitations: string[];
  status: TheoryProposalStatus;
  createdAt: string;
  engineVersion: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface TheoryPrediction {
  id: string;
  formulation: string;
  theoryId: string;
  theoryElementIds: string[];
  applicationContext: string;
  expectedResult: string;
  observableCriteria: string[];
  temporalWindow: string;
  status: TheoryPredictionStatus;
  futureObservationIds: string[];
  createdAt: string;
  updatedAt: string;
  author: string;
  limitations: string[];
}

export interface TheoryHistoryEntry {
  id: string;
  date: string;
  action:
    | "theorie initialisee"
    | "version creee"
    | "revision proposee"
    | "revision acceptee"
    | "revision rejetee"
    | "prediction creee"
    | "lien de preuve valide";
  elementId?: string;
  author: string;
  summary: string;
  observationIds: string[];
  studyIds: string[];
}

export interface ReciprocalTestimony {
  id: string;
  observationId: string;
  studyId: string;
  witnessA: string;
  witnessB: string;
  testimonyAToB: string;
  responseB: string;
  observedEffectOnB: string;
  observedEffectOnA: string;
  contradiction: string;
  validation: string;
  rejection: string;
  silence: string;
  integration: string;
  transformation: string;
  effectStatusOnB: ObservedEffectStatus;
  effectStatusOnA: ObservedEffectStatus;
  limitations: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReflexiveSignature {
  id: string;
  personLabel: string;
  studyIds: string[];
  observationIds: string[];
  testimonyTypes: string[];
  documentedEmotions: string[];
  recurrentContradictions: string[];
  revealedThemes: string[];
  responseForms: string[];
  linkedTransformations: string[];
  sampleLimitations: string[];
  prohibitedOutputs: string[];
  valueScore: null;
}

export interface SufferingObservation {
  id: string;
  observationId: string;
  declaredEmotionalIntensity: string;
  reportedSuffering: string;
  supposedResistance: string;
  receivedTestimony: string;
  formulatedRecognition: string;
  observableTransformation: string;
  cautiousSummary: string;
  limitations: string[];
}
