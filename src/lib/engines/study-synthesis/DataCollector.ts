import type { Study } from "@/lib/types";
import type { CollectedStudyData } from "./types";

export class DataCollector {
  collect(study: Study, generatedAt = new Date().toISOString()): CollectedStudyData {
    const observations = (study.observations ?? []).filter((observation) => observation.status !== "deleted");
    const dates = observations
      .map((observation) => observation.createdAt)
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
    const participants = new Set<string>();
    observations.forEach((observation) => {
      if (observation.authorLabel) participants.add(observation.authorLabel);
      observation.detectedPeople.forEach((person) => participants.add(person.label));
    });
    return {
      study,
      observations,
      generatedAt,
      periodStart: dates[0] ?? null,
      periodEnd: dates.at(-1) ?? null,
      participants: [...participants].sort((left, right) => left.localeCompare(right))
    };
  }
}
