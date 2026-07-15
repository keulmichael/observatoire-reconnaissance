import type { Study, TrajectoryComparison } from "@/lib/types";
import { normalize } from "./LanguageEngine";

export const TrajectoryEngine = {
  compare(studies: Study[]): TrajectoryComparison[] {
    const comparisons: TrajectoryComparison[] = [];
    for (let i = 0; i < studies.length; i += 1) {
      for (let j = i + 1; j < studies.length; j += 1) {
        comparisons.push(comparePair(studies[i], studies[j]));
      }
    }
    return comparisons.sort((a, b) => b.similarity - a.similarity);
  }
};

function comparePair(left: Study, right: Study): TrajectoryComparison {
  const leftSteps = left.states.slice().sort((a, b) => a.date.localeCompare(b.date)).map((state) => normalize(state.title));
  const rightSteps = right.states.slice().sort((a, b) => a.date.localeCompare(b.date)).map((state) => normalize(state.title));
  const commonSteps = intersect(leftSteps, rightSteps);
  const commonCatalysts = intersect(
    left.catalysts.map((catalyst) => catalyst.type),
    right.catalysts.map((catalyst) => catalyst.type)
  );
  const commonEmotions = intersect(
    left.emotionObservations.map((emotion) => emotion.emotion),
    right.emotionObservations.map((emotion) => emotion.emotion)
  );
  const commonTransmissionForms = intersect(
    left.transitions.map((transition) => transition.transmissionCapacity),
    right.transitions.map((transition) => transition.transmissionCapacity)
  );
  const averageDays = average([...durations(left), ...durations(right)]);
  const dimensions = [commonSteps.length, commonCatalysts.length, commonEmotions.length, commonTransmissionForms.length];
  const possible = [
    Math.max(leftSteps.length, rightSteps.length),
    Math.max(left.catalysts.length, right.catalysts.length),
    Math.max(left.emotionObservations.length, right.emotionObservations.length),
    Math.max(left.transitions.length, right.transitions.length)
  ].map((value) => Math.max(value, 1));
  const similarity = Number((dimensions.reduce((sum, value, index) => sum + value / possible[index], 0) / dimensions.length).toFixed(2));

  return {
    studyIds: [left.id, right.id],
    similarity,
    commonSteps,
    averageDays,
    commonCatalysts,
    commonEmotions,
    commonTransmissionForms,
    comparedDimensions: [
      "sequences d'etats",
      "types de transitions",
      "delais",
      "emotions documentees",
      "categories de catalyseurs",
      "formes de transmission"
    ],
    excludedDimensions: ["personnes", "identites", "valeurs individuelles", "sujets nominatifs"],
    limits: ["Comparaison de trajectoires uniquement ; aucune comparaison de personnes."]
  };
}

function intersect(left: string[], right: string[]) {
  const rightSet = new Set(right.map(normalize));
  return [...new Set(left.map(normalize).filter((value) => rightSet.has(value)))];
}

function durations(study: Study) {
  return study.transitions.map((transition) => Number.parseInt(transition.maturationDuration, 10)).filter(Number.isFinite);
}

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
