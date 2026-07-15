import type { EmotionSequence, Study } from "@/lib/types";

export const EmotionEngine = {
  detectSequences(studies: Study[], sequenceLength = 3): EmotionSequence[] {
    const counts = new Map<string, number>();

    studies.forEach((study) => {
      const byTransition = new Map<string, string[]>();
      study.emotionObservations
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .forEach((emotion) => {
          const key = emotion.transitionId ?? "study-wide";
          byTransition.set(key, [...(byTransition.get(key) ?? []), emotion.emotion]);
        });

      byTransition.forEach((emotions) => {
        windows(emotions, sequenceLength).forEach((sequence) => {
          counts.set(sequence.join(" -> "), (counts.get(sequence.join(" -> ")) ?? 0) + 1);
        });
      });
    });

    return [...counts.entries()]
      .map(([key, count]) => ({
        sequence: key.split(" -> "),
        count,
        label: "Observation" as const,
        limits: ["Sequence observee sans attribution de signification causale."]
      }))
      .sort((a, b) => b.count - a.count);
  }
};

function windows(values: string[], size: number) {
  if (values.length < size) return [];
  return values.slice(0, values.length - size + 1).map((_, index) => values.slice(index, index + size));
}
