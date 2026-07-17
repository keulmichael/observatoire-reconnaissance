import type {
  DifferenceCategory,
  DifferenceItem,
  ScientificLabel,
  StateDifference,
  UnderstandingState
} from "@/lib/types";
import { LanguageEngine, findReformulationCandidates, normalize } from "./LanguageEngine";
import { classifyComparisonLabel, inferStateType } from "../scientific-model";

export const StateDifferenceEngine = {
  compare(before: UnderstandingState, after: UnderstandingState): StateDifference {
    const language = LanguageEngine.compare(stateLanguageCorpus(before), stateLanguageCorpus(after));
    const items: DifferenceItem[] = [];
    const insufficientIndicators: string[] = [];
    const beforeType = inferStateType(before);
    const afterType = inferStateType(after);

    if (beforeType !== afterType) {
      insufficientIndicators.push(`Etats non comparables : ${beforeType} et ${afterType}.`);
    }

    if (!before.confirmedElements.length && !before.uncertainElements.length) {
      insufficientIndicators.push("Etat A sans elements conceptuels suffisants.");
    }
    if (!after.confirmedElements.length && !after.uncertainElements.length) {
      insufficientIndicators.push("Etat B sans elements conceptuels suffisants.");
    }

    const conceptsAdded = added(concepts(before), concepts(after));
    const conceptsRemoved = added(concepts(after), concepts(before));
    const conceptsReformulated = findReformulationCandidates(conceptsRemoved, conceptsAdded, "concept");
    const relationsAdded = added(relations(before), relations(after));
    const relationsRemoved = added(relations(after), relations(before));
    const relationsReformulated = findReformulationCandidates(relationsRemoved, relationsAdded, "relation");
    const decisionsNew = added(before.associatedBehaviors, after.associatedBehaviors);
    const decisionsAbandoned = added(after.associatedBehaviors, before.associatedBehaviors);
    const projectsNew = decisionsNew.filter(isProjectLike);
    const projectsAbandoned = decisionsAbandoned.filter(isProjectLike);
    const emotionsNew = added(emotions(before), emotions(after));
    const emotionsDisappeared = added(emotions(after), emotions(before));
    const emotionsStabilized = after.language.filter((value) => before.language.includes(value) && isEmotionLike(value));
    const contradictions = potentialContradictions(before, after);

    conceptsAdded.forEach((value) => {
      items.push(makeItem("addition", "concept", "Observation", undefined, value, `Concept ajoute : ${value}`, 0.86));
    });
    conceptsRemoved.forEach((value) => {
      items.push(makeItem("removal", "concept", "Observation", value, undefined, `Concept retire : ${value}`, 0.86));
    });
    conceptsReformulated.forEach((candidate) => {
      items.push(
        makeItem(
          "probable-reformulation",
          "concept",
          "Reformulation probable",
          candidate.before,
          candidate.after,
          candidate.reason,
          candidate.confidence,
          true
        )
      );
    });
    relationsAdded.forEach((value) => {
      items.push(makeItem("addition", "relation", "Relation possible", undefined, value, `Relation ajoutee : ${value}`, 0.78));
    });
    relationsRemoved.forEach((value) => {
      items.push(makeItem("removal", "relation", "Observation", value, undefined, `Relation retiree : ${value}`, 0.78));
    });
    relationsReformulated.forEach((candidate) => {
      items.push(
        makeItem(
          "probable-reformulation",
          "relation",
          "Reformulation probable",
          candidate.before,
          candidate.after,
          candidate.reason,
          candidate.confidence,
          true
        )
      );
    });
    emotionsNew.forEach((value) => {
      items.push(makeItem("addition", "emotion", "Observation", undefined, value, `Emotion apparue : ${value}`, 0.72));
    });
    emotionsDisappeared.forEach((value) => {
      items.push(makeItem("removal", "emotion", "Observation", value, undefined, `Emotion non retrouvee : ${value}`, 0.72));
    });
    decisionsNew.forEach((value) => {
      items.push(makeItem("addition", "behaviour", "Transformation observee", undefined, value, `Comportement ajoute : ${value}`, 0.76));
    });
    decisionsAbandoned.forEach((value) => {
      items.push(makeItem("removal", "behaviour", "Observation", value, undefined, `Comportement abandonne : ${value}`, 0.76));
    });
    contradictions.forEach(([left, right]) => {
      items.push(
        makeItem(
          "potential-contradiction",
          "concept",
          "Hypothese",
          left,
          right,
          "Formulations potentiellement contradictoires detectees localement.",
          0.64,
          true
        )
      );
    });

    if (after.stability === before.stability && after.confidence === before.confidence) {
      items.push(makeItem("stabilization", "stability", "Observation", String(before.stability), String(after.stability), "Stabilite et confiance inchangees.", 1));
    }

    insufficientIndicators.forEach((detail) => {
      items.push(makeItem("insufficient-data", "concept", "Indicateurs insuffisants", undefined, undefined, detail, 1));
    });

    const categoriesConcerned = [...new Set(items.map((item) => item.category))];
    const totalDifferences = items.filter((item) => item.kind !== "insufficient-data").length;

    return {
      fromStateId: before.id,
      toStateId: after.id,
      timeBetweenDays: daysBetween(before.date, after.date),
      totalDifferences,
      categoriesConcerned,
      stabilityLevel: stabilityLevel(before, after, totalDifferences, insufficientIndicators),
      items,
      conceptsAdded,
      conceptsRemoved,
      conceptsReformulated,
      relationsAdded,
      relationsRemoved,
      relationsReformulated,
      emotionsNew,
      emotionsDisappeared,
      emotionsStabilized,
      decisionsNew,
      decisionsAbandoned,
      projectsNew,
      projectsAbandoned,
      language,
      insufficientIndicators
    };
  }
};

function makeItem(
  kind: DifferenceItem["kind"],
  category: DifferenceCategory,
  label: ScientificLabel,
  before: string | undefined,
  after: string | undefined,
  detail: string,
  confidence: number,
  requiresUserValidation = false
): DifferenceItem {
  return {
    id: `${kind}-${category}-${normalize(`${before ?? ""}-${after ?? ""}-${detail}`).slice(0, 42)}`,
    kind,
    category,
    label,
    before,
    after,
    detail,
    confidence,
    requiresUserValidation
  };
}

function concepts(state: UnderstandingState): string[] {
  return unique([...state.confirmedElements, ...state.uncertainElements, ...state.language]).filter(
    (value) => classifyComparisonLabel(value) === "concept"
  );
}

function relations(state: UnderstandingState): string[] {
  return concepts(state).filter((value) => /↔|->|relation|relie|relier|lien|entre/i.test(value));
}

function emotions(state: UnderstandingState): string[] {
  return unique([...state.language, ...state.uncertainElements, ...state.confirmedElements]).filter(isEmotionLike);
}

function added(beforeValues: string[], afterValues: string[]) {
  return afterValues.filter((value) => !beforeValues.includes(value));
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isEmotionLike(value: string) {
  return /confusion|incertitude|curiosite|curiosité|apaisement|clarte|clarté|questionnement|stress|doute/i.test(value);
}

function isProjectLike(value: string) {
  return /projet|creation|création|protocole|methode|méthode|plan|transmission/i.test(value);
}

function potentialContradictions(before: UnderstandingState, after: UnderstandingState): Array<[string, string]> {
  return before.confirmedElements.flatMap((left) =>
    after.confirmedElements
      .filter((right) => contradicts(left, right))
      .map((right): [string, string] => [left, right])
  );
}

function contradicts(left: string, right: string) {
  const a = normalize(left);
  const b = normalize(right);
  const removeNegation = (value: string) => value.replace(/\b(non|pas|aucun|aucune|sans)\b/g, "").replace(/\s+/g, " ").trim();
  return removeNegation(a) === removeNegation(b) && a !== b;
}

function stateLanguageCorpus(state: UnderstandingState) {
  return [
    state.title,
    state.formulation,
    ...state.confirmedElements,
    ...state.uncertainElements,
    ...state.language,
    ...state.associatedBehaviors
  ];
}

function daysBetween(before: string, after: string) {
  const start = Date.parse(before);
  const end = Date.parse(after);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

function stabilityLevel(
  before: UnderstandingState,
  after: UnderstandingState,
  totalDifferences: number,
  insufficientIndicators: string[]
): StateDifference["stabilityLevel"] {
  if (insufficientIndicators.length) return "Indicateurs insuffisants";
  if (totalDifferences === 0 || (before.stability === after.stability && totalDifferences <= 1)) return "stable";
  if (Math.abs(after.stability - before.stability) <= 2 && totalDifferences <= 5) return "variation faible";
  return "variation forte";
}
