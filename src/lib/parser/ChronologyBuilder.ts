import type { DetectedEmotion, DetectedManifestation, ObservationChronologyEntry, TemporalPrecision } from "../types";
import { splitSentences, stableId } from "./ObservationParser";

export function buildChronology(
  rawText: string,
  manifestations: DetectedManifestation[],
  emotions: DetectedEmotion[]
): ObservationChronologyEntry[] {
  const entries = [...manifestations, ...emotions].map((proposal, index) => {
    const temporal = detectTemporalMarker(proposal.sourceExcerpt);
    return {
      id: stableId("chronology", `${proposal.id}-${proposal.sourceExcerpt}`),
      label: proposal.label,
      sourceExcerpt: proposal.sourceExcerpt,
      order: sentenceOrder(rawText, proposal.sourceExcerpt, index),
      phase: temporal.phase,
      temporalMarker: temporal.marker,
      precision: temporal.precision,
      status: proposal.status,
      reason: temporal.reason,
      provenance: ["ChronologyBuilder", ...proposal.provenance]
    };
  });

  return entries
    .sort((left, right) => left.order - right.order)
    .map((entry, index) => ({
      ...entry,
      phase: entry.precision === "ordre narratif" ? "Ordre narratif" : entry.phase,
      order: index + 1
    }));
}

function detectTemporalMarker(sourceExcerpt: string): {
  marker: string;
  precision: TemporalPrecision;
  phase: ObservationChronologyEntry["phase"];
  reason: string;
} {
  const explicitDate = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b/.exec(sourceExcerpt);
  if (explicitDate) {
    return {
      marker: explicitDate[0],
      precision: "date explicite",
      phase: "Pendant",
      reason: "Date explicite presente dans l'extrait."
    };
  }

  const relative = /\b(hier|aujourd'hui|aujourd’hui|demain|depuis la veille|la veille|avant|apres|après)\b/i.exec(sourceExcerpt);
  if (relative) {
    const marker = relative[0];
    return {
      marker,
      precision: "date relative",
      phase: /hier|avant|veille/i.test(marker) ? "Avant" : "Apres",
      reason: "Date relative conservee telle quelle, sans conversion absolue."
    };
  }

  if (sourceExcerpt.trim()) {
    return {
      marker: "ordre narratif",
      precision: "ordre narratif",
      phase: "Ordre narratif",
      reason: "Aucune date explicite ou relative ; ordre du recit utilise."
    };
  }

  return {
    marker: "date inconnue",
    precision: "date inconnue",
    phase: "Ordre narratif",
    reason: "Aucun indice temporel disponible."
  };
}

function sentenceOrder(rawText: string, sourceExcerpt: string, fallback: number) {
  const sentences = splitSentences(rawText);
  const index = sentences.findIndex((sentence) => sentence === sourceExcerpt || sentence.includes(sourceExcerpt));
  return index >= 0 ? index : fallback;
}
