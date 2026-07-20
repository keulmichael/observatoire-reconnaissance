import type { StudySynthesisStatistics } from "@/lib/types";
import type { CollectedStudyData, CountBucket } from "./types";
import { addCount, toStatisticItems } from "./utils";

export class StatisticsAnalyzer {
  analyze(data: CollectedStudyData): StudySynthesisStatistics {
    const dimensions: CountBucket = {};
    const emotions: CountBucket = {};
    const behaviours: CountBucket = {};
    const concepts: CountBucket = {};
    const representations: CountBucket = {};
    const transformations: CountBucket = {};
    const relations: CountBucket = {};

    data.observations.forEach((observation) => {
      observation.detectedDimensions?.forEach((dimension) => {
        addCount(dimensions, dimension.category, observation, dimension.sourceExcerpt);
        if (dimension.category === "Behaviour") addCount(behaviours, dimension.label, observation, dimension.sourceExcerpt);
        if (dimension.category === "Representation" || dimension.category === "Attitude") addCount(representations, dimension.label, observation, dimension.sourceExcerpt);
      });
      observation.detectedEmotions.forEach((emotion) => addCount(emotions, emotion.canonicalEmotion ?? emotion.emotion ?? emotion.label, observation, emotion.sourceExcerpt));
      observation.detectedConcepts.forEach((concept) => addCount(concepts, concept.concept || concept.label, observation, concept.sourceExcerpt));
      observation.detectedRelations.forEach((relation) => addCount(relations, relation.label, observation, relation.sourceExcerpt));
    });

    data.study.transitions.forEach((transition) => {
      const source = data.observations.find((observation) => transition.sourceObservationIds?.includes(observation.id));
      if (source) addCount(transformations, transition.title, source, transition.sourceExcerpt);
    });
    (data.study.multidimensionalChanges ?? []).forEach((change) => {
      change.changesDetected.forEach((item) => {
        const source = data.observations.find((observation) => change.sourceObservationIds.includes(observation.id));
        if (source) addCount(transformations, item.summary, source, change.sourceExcerpts[0]?.excerpt);
      });
    });

    return {
      totalObservations: data.observations.length,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      participants: data.participants,
      dimensions: toStatisticItems(dimensions),
      emotions: toStatisticItems(emotions),
      behaviours: toStatisticItems(behaviours),
      concepts: toStatisticItems(concepts),
      representations: toStatisticItems(representations),
      transformations: toStatisticItems(transformations),
      relations: toStatisticItems(relations)
    };
  }
}
