import type {
  ComparableObservation,
  LongitudinalComparisonStatus,
  LongitudinalConfidence,
  LongitudinalDifference,
  LongitudinalDimensionKey,
  LongitudinalDimensionSnapshot,
  LongitudinalObservationComparison,
  ObservationRecord,
  ProposedObservedState,
  StateScope,
  Study
} from "../types";
import { stableId } from "../parser/ObservationParser";
import { detectFrenchEmotionExpressions, normalizeFrench } from "../parser/french-emotion-patterns";

export const LONGITUDINAL_OBSERVATION_ENGINE_VERSION = "LongitudinalObservationEngine:v1";

type ObservationDimensions = Record<LongitudinalDimensionKey, string[]>;

const DIMENSION_LABELS: Record<LongitudinalDimensionKey, string> = {
  sujet: "Sujet ou phenomene observe",
  population: "Population ou acteur concerne",
  emotion: "Emotion exprimee",
  intensiteEmotionnelle: "Intensite emotionnelle",
  comportement: "Comportement",
  mobilisation: "Mobilisation",
  decision: "Decision",
  objetAttention: "Objet d'attention",
  concepts: "Concepts employes",
  relations: "Relations formulees",
  localisation: "Localisation",
  temporalite: "Temporalite",
  portee: "Portee individuelle ou collective"
};

const ALL_DIMENSIONS = Object.keys(DIMENSION_LABELS) as LongitudinalDimensionKey[];

export const LongitudinalObservationEngine = {
  compare(
    study: Study,
    chronologicalRecords: ObservationRecord[],
    newObservation: ObservationRecord,
    now = new Date().toISOString()
  ): LongitudinalObservationComparison {
    const records = chronologicalRecords
      .filter((record) => record.studyId === study.id && record.status === "active")
      .slice()
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const previousRecords = records.filter(
      (record) => record.id !== newObservation.id && record.createdAt <= newObservation.createdAt
    );
    const currentDimensions = dimensionsFromRecord(newObservation);
    const comparableObservations = previousRecords
      .map((record) => comparableObservation(record, currentDimensions))
      .filter((item) => item.relevanceScore > 0)
      .sort((left, right) => right.relevanceScore - left.relevanceScore || left.createdAt.localeCompare(right.createdAt));
    const selectedPrevious: ObservationRecord | null = comparableObservations[0]
      ? previousRecords.find((record) => record.id === comparableObservations[0].observationId)
        ?? null
      : null;
    const previousDimensions = selectedPrevious ? dimensionsFromRecord(selectedPrevious) : emptyDimensions();
    const dimensionsCompared = buildDimensionSnapshots(previousDimensions, currentDimensions);
    const differences = selectedPrevious ? buildDifferences(dimensionsCompared) : [];
    const missingData = buildMissingData(dimensionsCompared, selectedPrevious);
    const methodologicalLimits = buildMethodologicalLimits(selectedPrevious, newObservation, previousDimensions, currentDimensions);
    const confidence = confidenceFrom(comparableObservations[0]?.relevanceScore ?? 0, differences.length, methodologicalLimits.length);
    const proposedPreviousState = selectedPrevious ? proposedState(previousDimensions, selectedPrevious.rawText, "anterieur") : null;
    const proposedCurrentState = proposedState(currentDimensions, newObservation.rawText, "actuel");
    const potentialTransition = potentialTransitionFrom(differences, selectedPrevious);
    const sourceExcerpts = [
      ...(selectedPrevious ? [{ observationId: selectedPrevious.id, excerpt: excerpt(selectedPrevious) }] : []),
      { observationId: newObservation.id, excerpt: excerpt(newObservation) }
    ];
    const conclusion = conclusionFrom(differences, selectedPrevious);

    return {
      id: stableId("longitudinal-comparison", `${study.id}-${selectedPrevious?.id ?? "none"}-${newObservation.id}-${now}`),
      studyId: study.id,
      sourceObservationIds: [...new Set(sourceExcerpts.map((item) => item.observationId))],
      previousObservationId: selectedPrevious?.id,
      currentObservationId: newObservation.id,
      comparableObservations,
      dimensionsCompared,
      differences,
      proposedPreviousState,
      proposedCurrentState,
      potentialTransition,
      missingData,
      methodologicalLimits,
      confirmationQuestions: buildConfirmationQuestions(differences, methodologicalLimits),
      sourceExcerpts,
      comparedAt: now,
      engine: "LongitudinalObservationEngine",
      engineVersion: LONGITUDINAL_OBSERVATION_ENGINE_VERSION,
      status: "propose" satisfies LongitudinalComparisonStatus,
      confidence,
      conclusion
    };
  }
};

function comparableObservation(record: ObservationRecord, currentDimensions: ObservationDimensions): ComparableObservation {
  const dimensions = dimensionsFromRecord(record);
  const sharedDimensions = ALL_DIMENSIONS.filter((key) => overlaps(dimensions[key], currentDimensions[key]));
  const topicBoost = overlaps(dimensions.sujet, currentDimensions.sujet) || overlaps(dimensions.concepts, currentDimensions.concepts) ? 2 : 0;
  return {
    observationId: record.id,
    createdAt: record.createdAt,
    relevanceScore: sharedDimensions.length + topicBoost,
    sharedDimensions,
    sourceExcerpt: excerpt(record)
  };
}

function dimensionsFromRecord(record: ObservationRecord): ObservationDimensions {
  const text = record.rawText;
  const concepts = unique([
    ...record.detectedConcepts.map((concept) => concept.label),
    ...matches(text, /(incendies? de foret|foret|faune|flore|animaux|ecosysteme|solidarite|reaction|consequence)/gi)
  ]);
  return {
    sujet: unique(matches(text, /(incendies? de foret|incendie|reaction des gens|consequences? caus[ée]es? par les incendies)/gi)),
    population: unique([
      ...record.detectedPeople.map((person) => person.label),
      ...matches(text, /(les francais|les gens|population|habitants|personnes|quelques personnes)/gi)
    ]),
    emotion: unique([
      ...record.detectedEmotions.map((emotion) => emotion.canonicalEmotion ?? emotion.label),
      ...detectFrenchEmotionExpressions(text).map((emotion) => emotion.canonicalEmotion)
    ]),
    intensiteEmotionnelle: unique(matches(text, /(faible|forte|intense|particuliere|impassibles?|prets a s'impliquer|aucune emotion)/gi)),
    comportement: unique(matches(text, /(ne montrent pas|lance|ont lance|s'impliquer|sauvegarde|reagir|reaction|actions?)/gi)),
    mobilisation: unique(matches(text, /(pas de reaction|aucune reaction|impassibles?|solidarite|mobilisation|actions? de solidarite|prets a s'impliquer|s'impliquer|sauvegarde)/gi)),
    decision: unique(matches(text, /(ont decide|decision|prets a|lance|ont lance|volonte|veulent|sont prets)/gi)),
    objetAttention: unique(matches(text, /(animaux|faune|flore|ecosysteme|consequences?|foret|incendies?)/gi)),
    concepts,
    relations: unique([
      ...record.detectedRelations.map((relation) => relation.label),
      ...matches(text, /(face aux consequences|pour les animaux|dans la sauvegarde|reaction .* differente)/gi)
    ]),
    localisation: unique(matches(text, /(fontainebleau|sud de la france|dans le monde|france|foret de fontainebleau)/gi)),
    temporalite: unique(matches(text, /(habituellement|anterieur|avant|en ce moment|actuel|actuellement|maintenant|ponctuel)/gi)),
    portee: unique(scopeLabels(text))
  };
}

function buildDimensionSnapshots(previous: ObservationDimensions, current: ObservationDimensions): LongitudinalDimensionSnapshot[] {
  return ALL_DIMENSIONS.map((key) => ({
    key,
    label: DIMENSION_LABELS[key],
    previous: previous[key],
    current: current[key]
  }));
}

function buildDifferences(dimensions: LongitudinalDimensionSnapshot[]): LongitudinalDifference[] {
  return dimensions
    .filter((dimension) => hasDifference(dimension.previous, dimension.current))
    .map((dimension) => ({
      dimension: dimension.key,
      label: dimension.label,
      previous: dimension.previous,
      current: dimension.current,
      summary: differenceSummary(dimension)
    }));
}

function differenceSummary(dimension: LongitudinalDimensionSnapshot): string {
  if (!dimension.previous.length && dimension.current.length) {
    return `Apparition documentee : ${dimension.current.join(", ")}.`;
  }
  if (dimension.previous.length && !dimension.current.length) {
    return `Element anterieur non retrouve dans l'observation actuelle : ${dimension.previous.join(", ")}.`;
  }
  return `Variation entre ${dimension.previous.join(", ")} et ${dimension.current.join(", ")}.`;
}

function proposedState(dimensions: ObservationDimensions, rawText: string, phase: "anterieur" | "actuel"): ProposedObservedState {
  const scope = scopeFrom(rawText);
  const elements = unique([
    ...dimensions.emotion.map((value) => emotionStateLabel(value, phase)),
    ...dimensions.mobilisation.map((value) => mobilizationStateLabel(value, phase)),
    ...dimensions.comportement,
    ...dimensions.objetAttention.map((value) => `attention portee a ${value}`),
    ...dimensions.localisation.map((value) => `evenement localise ou mentionne : ${value}`),
    ...dimensions.portee.map((value) => `portee : ${value}`)
  ]);
  return {
    scope,
    evidenceLevel: scope === "collectif" || scope === "indetermine" ? "faible" : "moyen",
    summary: elements.length ? elements.join("; ") : "Etat propose avec donnees limitees.",
    elements
  };
}

function potentialTransitionFrom(differences: LongitudinalDifference[], previous: ObservationRecord | null): string | null {
  if (!previous) return null;
  const changed = new Set(differences.map((difference) => difference.dimension));
  const reactionChange = changed.has("emotion") || changed.has("mobilisation") || changed.has("comportement");
  if (reactionChange) return "Changement potentiel detecte dans les reactions collectives decrites.";
  if (differences.length) return "Variation potentielle detectee entre observations.";
  return null;
}

function buildMissingData(dimensions: LongitudinalDimensionSnapshot[], previous: ObservationRecord | null): string[] {
  if (!previous) return ["aucune comparaison suffisante : aucune observation anterieure comparable dans cette etude."];
  return dimensions
    .filter((dimension) => !dimension.previous.length || !dimension.current.length)
    .map((dimension) => `${dimension.label} incomplet pour une des deux observations.`);
}

function buildMethodologicalLimits(
  previous: ObservationRecord | null,
  current: ObservationRecord,
  previousDimensions: ObservationDimensions,
  currentDimensions: ObservationDimensions
): string[] {
  const limits: string[] = [];
  if (!previous) limits.push("Aucune observation anterieure pertinente ne permet une comparaison longitudinale complete.");
  if (isCollectiveGeneralization(previous?.rawText ?? "")) {
    limits.push("La formulation anterieure est une generalisation collective declaree, pas une mesure representative.");
  }
  if (isCollectiveGeneralization(current.rawText)) {
    limits.push("La formulation actuelle attribue une reaction a un groupe sans mesure d'ampleur documentee.");
  }
  if (currentDimensions.localisation.some((value) => /fontainebleau/i.test(value))) {
    limits.push("La mobilisation autour de Fontainebleau est une observation ponctuelle et localisee declaree.");
  }
  if (previousDimensions.portee.includes("collectif") || currentDimensions.portee.includes("collectif")) {
    limits.push("Ne pas conclure a une emotion ou une pensee de toute une population sans preuve supplementaire.");
  }
  limits.push("Les observations decrivent des reactions differentes, mais ne suffisent pas a conclure a un changement national durable ou a une causalite precise.");
  return unique(limits);
}

function buildConfirmationQuestions(differences: LongitudinalDifference[], limits: string[]): string[] {
  const questions = [
    "Quelles sources documentent la reaction actuelle ?",
    "Existe-t-il des exemples comparables pour les incendies anterieurs ?",
    "La mobilisation concerne-t-elle quelques personnes ou une part importante de la population ?",
    "Cette reaction est-elle liee a la proximite geographique ?",
    "Le changement persiste-t-il apres l'evenement ?",
    "Les medias ont-ils modifie la visibilite de la faune touchee ?"
  ];
  if (!differences.length || limits.length) return questions;
  return questions;
}

function conclusionFrom(differences: LongitudinalDifference[], previous: ObservationRecord | null): string {
  if (!previous) return "Aucune comparaison suffisante avec une observation anterieure de cette etude.";
  if (!differences.length) return "Comparaison effectuee, sans variation significative detectee.";
  return "Les observations decrivent des reactions differentes. Les donnees sont insuffisantes pour conclure a un changement durable de la population francaise ou a une causalite precise.";
}

function confidenceFrom(score: number, differenceCount: number, limitCount: number): LongitudinalConfidence {
  if (score >= 5 && differenceCount >= 3 && limitCount <= 2) return "eleve";
  if (score >= 3 && differenceCount >= 1) return "moyen";
  return "faible";
}

function scopeFrom(text: string): StateScope {
  if (/\b(institution|etat|gouvernement|mairie|ministere|collectivite)\b/i.test(text)) return "institutionnel";
  if (/\b(les francais|population francaise|toute la population|collective|collectif)\b/i.test(text)) return "collectif";
  if (/\b(les gens|habitants|groupe|communaut[ée]|personnes)\b/i.test(text)) return "groupe";
  if (/\b(je|j'|il|elle|une personne|un homme|une femme)\b/i.test(text)) return "individuel";
  return "indetermine";
}

function scopeLabels(text: string): string[] {
  const scope = scopeFrom(text);
  return scope === "indetermine" ? [] : [scope];
}

function emotionStateLabel(value: string, phase: "anterieur" | "actuel") {
  if (/absence de reaction|aucune emotion|pas de reaction|impassibles?|sans reaction/i.test(value)) return "faible emotion declaree";
  if (/inquiet/i.test(value)) return "inquietude pour les animaux";
  return phase === "anterieur" ? `emotion anterieure declaree : ${value}` : `emotion actuelle declaree : ${value}`;
}

function mobilizationStateLabel(value: string, phase: "anterieur" | "actuel") {
  if (/aucune|pas de reaction|impassible/i.test(value)) return "faible mobilisation declaree";
  if (/solidarite/i.test(value)) return "actions de solidarite";
  if (/s'impliquer|prets/i.test(value)) return "volonte d'implication";
  return phase === "anterieur" ? `mobilisation anterieure : ${value}` : `mobilisation actuelle : ${value}`;
}

function isCollectiveGeneralization(text: string) {
  return /\b(les francais|les gens|la population|tout le monde|personne ne|les gens n')\b/i.test(text);
}

function emptyDimensions(): ObservationDimensions {
  return ALL_DIMENSIONS.reduce((accumulator, key) => ({ ...accumulator, [key]: [] }), {} as ObservationDimensions);
}

function matches(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => match[0]);
}

function hasDifference(previous: string[], current: string[]) {
  if (!previous.length && !current.length) return false;
  const before = previous.map(normalizeValue).sort().join("|");
  const after = current.map(normalizeValue).sort().join("|");
  return before !== after;
}

function overlaps(left: string[], right: string[]) {
  const normalizedRight = new Set(right.map(normalizeValue));
  return left.some((value) => normalizedRight.has(normalizeValue(value)));
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const normalized = normalizeValue(value);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

function normalizeValue(value: string) {
  return normalizeFrench(value);
}

function excerpt(record: ObservationRecord) {
  return record.sourceExcerpts[0] ?? record.rawText.slice(0, 320);
}

