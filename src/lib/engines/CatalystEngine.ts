import type { CatalystMetrics, Study } from "@/lib/types";

export const CatalystEngine = {
  analyze(studies: Study[]): CatalystMetrics[] {
    const metrics = new Map<string, CatalystMetrics>();

    studies.flatMap((study) => study.catalysts).forEach((catalyst) => {
      const transitions = studies.flatMap((study) =>
        study.transitions.filter((transition) =>
          catalyst.linkedTransitions.includes(transition.id) || transition.catalysts.includes(catalyst.name)
        )
      );
      const emotions = studies.flatMap((study) =>
        study.emotionObservations.filter((emotion) => transitions.some((transition) => transition.id === emotion.transitionId))
      );
      const durations = transitions.map((transition) => Number.parseInt(transition.maturationDuration, 10)).filter(Number.isFinite);
      const transmissions = transitions.map((transition) => transition.transmissionCapacity).filter(Boolean);
      const existing = metrics.get(catalyst.name);
      const next: CatalystMetrics = {
        name: catalyst.name,
        frequency: (existing?.frequency ?? 0) + catalyst.frequency,
        averageDaysBeforeTransformation: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
        associatedTransitions: (existing?.associatedTransitions ?? 0) + transitions.length,
        associatedEmotions: [...new Set([...(existing?.associatedEmotions ?? []), ...emotions.map((emotion) => emotion.emotion)])],
        associatedTransmissions: [...new Set([...(existing?.associatedTransmissions ?? []), ...transmissions])],
        influenceScore: 0,
        limits: ["Influence calculee par frequence d'observation, sans causalite automatique."]
      };
      next.influenceScore = next.frequency + next.associatedTransitions + next.associatedEmotions.length;
      metrics.set(catalyst.name, next);
    });

    return [...metrics.values()].sort((a, b) => b.influenceScore - a.influenceScore);
  }
};
