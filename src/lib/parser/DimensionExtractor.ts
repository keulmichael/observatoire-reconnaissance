import type { CanonicalObservationElement, ObservationAnalysisDraft, ObservationRecord } from "../types";
import { stableId } from "./ObservationParser";
import { normalizeFrench } from "./french-emotion-patterns";

type SourceInput = Pick<ObservationRecord, "id" | "studyId" | "rawText" | "detectedEmotions" | "detectedManifestations" | "detectedConcepts" | "detectedRelations">;

export function extractCanonicalDimensionsFromDraft(draft: ObservationAnalysisDraft, studyId: string): CanonicalObservationElement[] {
  return extractCanonicalDimensions({
    id: draft.id,
    studyId,
    rawText: draft.rawText,
    detectedEmotions: draft.detectedEmotions,
    detectedManifestations: draft.detectedManifestations,
    detectedConcepts: draft.detectedConcepts,
    detectedRelations: draft.relationProposals
  });
}

export function extractCanonicalDimensions(record: SourceInput): CanonicalObservationElement[] {
  const elements: CanonicalObservationElement[] = [];
  const push = (item: Omit<CanonicalObservationElement, "id" | "observationId" | "studyId" | "status" | "provenance">) => {
    const key = `${record.id}-${item.category}-${item.label}-${item.subtype ?? ""}-${item.sourceExcerpt}`;
    elements.push({
      id: stableId("dimension", key),
      observationId: record.id,
      studyId: record.studyId,
      status: "proposed",
      provenance: ["local-parser"],
      ...item
    });
  };

  for (const emotion of record.detectedEmotions) {
    push({
      category: "Emotion",
      label: emotion.canonicalEmotion ?? emotion.label,
      subtype: emotion.expressionKind,
      polarity: emotion.polarity === "present" ? "neutral" : "uncertain",
      actors: [],
      sourceExcerpt: emotion.sourceExcerpt,
      confidence: emotion.confidence,
      reason: "Emotion issue de l'extracteur emotionnel local."
    });
  }

  for (const manifestation of record.detectedManifestations) {
    push({
      category: "Manifestation",
      label: manifestation.label,
      subtype: manifestation.kind,
      polarity: "neutral",
      actors: [],
      temporalMarker: manifestation.dateHint,
      sourceExcerpt: manifestation.sourceExcerpt,
      confidence: manifestation.confidence,
      reason: "Manifestation detectee comme fait observable."
    });
  }

  for (const concept of record.detectedConcepts) {
    push({
      category: "Concept",
      label: concept.label,
      polarity: "neutral",
      actors: [],
      sourceExcerpt: concept.sourceExcerpt,
      confidence: concept.confidence,
      reason: "Concept detecte localement."
    });
  }

  for (const relation of record.detectedRelations) {
    push({
      category: "Relation",
      label: relation.label,
      subtype: relation.relationType,
      polarity: "neutral",
      actors: [relation.sourceA, relation.sourceB].filter(Boolean),
      sourceExcerpt: relation.sourceExcerpt,
      confidence: relation.confidence,
      reason: "Relation proposee localement."
    });
  }

  const text = record.rawText;
  const normalized = normalizeFrench(text);
  const sourceExcerpt = text;

  if (/\bmepris|meprisee?s?|devalorisee?s?|devaloris/i.test(normalized)) {
    push({
      category: "Attitude",
      label: "mepris",
      subtype: "devalorisation",
      polarity: "negative",
      actors: actorsFrom(text),
      temporalMarker: temporalFrom(text),
      sourceExcerpt,
      confidence: 0.86,
      reason: "Le mepris est classe comme attitude relationnelle negative, pas comme emotion certaine."
    });
  }

  if (/\bidolatr|intouchable|glorifi|idealise/i.test(normalized)) {
    push({
      category: "Representation",
      label: "idealisation",
      subtype: "glorification",
      polarity: /\bidolatr|intouchable/i.test(normalized) ? "sacralizing" : "positive-extreme",
      actors: actorsFrom(text),
      temporalMarker: temporalFrom(text),
      sourceExcerpt,
      confidence: 0.84,
      reason: "L'idolatrie est classee comme representation/attitude d'idealisation, pas automatiquement comme emotion."
    });
  }

  if (/\bsolidarit|mobilisation|s'impliquer|aider|soutenir/i.test(normalized)) {
    push({
      category: "Behaviour",
      label: /\bsolidarit/i.test(normalized) ? "solidarite" : "mobilisation",
      subtype: "action collective ou relationnelle",
      polarity: "positive",
      actors: actorsFrom(text),
      sourceExcerpt,
      confidence: 0.8,
      reason: "La solidarite est classee comme comportement ou relation, pas comme emotion."
    });
  }

  if (/\bcompr[eé]hension|compris|comprendre|je comprends/i.test(text)) {
    push({
      category: "Concept",
      label: "comprehension",
      subtype: "cognition",
      polarity: "neutral",
      actors: actorsFrom(text),
      sourceExcerpt,
      confidence: 0.8,
      reason: "La comprehension est une cognition et ne doit jamais etre classee comme emotion."
    });
  }

  if (/\bauparavant|avant|desormais|maintenant|actuellement/i.test(normalized)) {
    push({
      category: "LanguageMarker",
      label: temporalFrom(text) ?? "marqueur temporel",
      polarity: "neutral",
      actors: [],
      temporalMarker: temporalFrom(text),
      sourceExcerpt,
      confidence: 0.75,
      reason: "Marqueur temporel utile pour comparer deux observations."
    });
  }

  return dedupe(elements);
}

function temporalFrom(text: string) {
  const match = text.match(/\b(auparavant|avant|desormais|maintenant|actuellement|jusqu'ici)\b/i);
  return match?.[0];
}

function actorsFrom(text: string) {
  return [...text.matchAll(/\b(public|figure|population|partie du public|elle|il|groupe)\b/gi)].map((match) => match[0]);
}

function dedupe(elements: CanonicalObservationElement[]) {
  const seen = new Set<string>();
  return elements.filter((element) => {
    const key = `${element.category}:${normalizeFrench(element.label)}:${normalizeFrench(element.sourceExcerpt)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
