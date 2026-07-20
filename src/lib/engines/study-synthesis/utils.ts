import type { ObservationRecord, StudySynthesisClaim, StudySynthesisConfidenceLevel, StudySynthesisEvidence, StudySynthesisStatisticItem } from "@/lib/types";
import type { CountBucket } from "./types";

export function evidenceFromObservation(observation: ObservationRecord): StudySynthesisEvidence {
  return {
    observationId: observation.id,
    excerpt: firstExcerpt(observation)
  };
}

export function firstExcerpt(observation: ObservationRecord) {
  return (observation.sourceExcerpts?.[0] || observation.rawText).slice(0, 240);
}

export function addCount(bucket: CountBucket, label: string, observation: ObservationRecord, excerpt?: string) {
  const key = cleanLabel(label);
  if (!key) return;
  bucket[key] ??= { count: 0, observationIds: new Set<string>(), evidence: [] };
  if (!bucket[key].observationIds.has(observation.id)) {
    bucket[key].count += 1;
    bucket[key].observationIds.add(observation.id);
    bucket[key].evidence.push({ observationId: observation.id, excerpt: (excerpt || firstExcerpt(observation)).slice(0, 240) });
  }
}

export function toStatisticItems(bucket: CountBucket, limit = 8): StudySynthesisStatisticItem[] {
  return Object.entries(bucket)
    .map(([label, value]) => ({
      label,
      count: value.count,
      observationIds: [...value.observationIds],
      evidence: value.evidence.slice(0, 3)
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit);
}

export function claim(input: Omit<StudySynthesisClaim, "id">): StudySynthesisClaim {
  return {
    id: `claim-${hash(`${input.kind}-${input.text}-${input.evidence.map((item) => item.observationId).join("-")}`)}`,
    ...input
  };
}

export function confidenceFromRatio(ratio: number, observations: number): StudySynthesisConfidenceLevel {
  if (observations < 2) return "Faible";
  if (ratio >= 0.75 && observations >= 5) return "Très élevé";
  if (ratio >= 0.5 && observations >= 3) return "Élevé";
  if (ratio >= 0.25) return "Moyen";
  return "Faible";
}

export function cleanLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function formatDate(value: string | null) {
  if (!value) return "non renseignée";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

export function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}
