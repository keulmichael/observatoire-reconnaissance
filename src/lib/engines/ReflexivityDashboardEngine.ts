import type { ObservatoryData, ReflexivityDashboard } from "@/lib/types";
import { CatalystEngine } from "./CatalystEngine";
import { DeltaEngine } from "./DeltaEngine";
import { StateDifferenceEngine } from "./StateDifferenceEngine";

export const ReflexivityDashboardEngine = {
  build(data: ObservatoryData): ReflexivityDashboard {
    const differences = data.studies.flatMap((study) =>
      successivePairs(study.states.slice().sort((a, b) => a.date.localeCompare(b.date))).map(([before, after]) =>
        StateDifferenceEngine.compare(before, after)
      )
    );
    const deltas = differences.map((difference) => DeltaEngine.calculate(difference));
    const dayGaps = differences.map((difference) => difference.timeBetweenDays).filter((value): value is number => value !== null);
    const stableGaps = differences
      .filter((difference) => difference.stabilityLevel === "stable" || difference.stabilityLevel === "variation faible")
      .map((difference) => difference.timeBetweenDays)
      .filter((value): value is number => value !== null);
    const catalysts = CatalystEngine.analyze(data.studies);
    const emotions = rank(data.studies.flatMap((study) => study.emotionObservations.map((emotion) => emotion.emotion)));
    const transmissions = data.studies.flatMap((study) => study.transitions.map((transition) => transition.transmissionCapacity)).filter(Boolean);
    const limits = [
      "Agrégation locale sur les donnees disponibles uniquement.",
      "Les moyennes ne sont pas calculees lorsque l'echantillon est insuffisant.",
      "Delta moyen ne mesure pas une progression ni une verite."
    ];

    return {
      averageDelta: deltas.length ? average(deltas.map((delta) => delta.score)) : null,
      averageDaysBetweenStates: dayGaps.length ? average(dayGaps) : null,
      averageDaysBeforeStabilization: stableGaps.length ? average(stableGaps) : null,
      newConcepts: unique(differences.flatMap((difference) => difference.conceptsAdded)),
      newRelations: unique(differences.flatMap((difference) => difference.relationsAdded)),
      frequentEmotions: emotions,
      frequentCatalysts: catalysts,
      newVocabulary: unique(differences.flatMap((difference) => difference.language.newWords)),
      transmissions: unique(transmissions),
      limits
    };
  }
};

function rank(values: string[]) {
  const map = new Map<string, number>();
  values.forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function average(values: number[]) {
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function successivePairs<T>(values: T[]): Array<[T, T]> {
  return values.slice(1).map((value, index) => [values[index], value]);
}
