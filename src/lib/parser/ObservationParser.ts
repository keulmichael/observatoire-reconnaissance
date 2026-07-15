import type { ObservationAnalysisDraft, ObservationMethodStatus } from "../types";
import { extractCatalysts } from "./CatalystExtractor";
import { buildChronology } from "./ChronologyBuilder";
import { extractConcepts } from "./ConceptExtractor";
import { extractEmotions } from "./EmotionExtractor";
import { extractManifestations } from "./ManifestationExtractor";

export function parseObservation(rawText: string, createdAt = new Date().toISOString()): ObservationAnalysisDraft {
  const detectedPeople = extractPeople(rawText);
  const detectedManifestations = extractManifestations(rawText);
  const detectedEmotions = extractEmotions(rawText);
  const detectedConcepts = extractConcepts(rawText);
  const detectedCatalysts = extractCatalysts(rawText, detectedManifestations, detectedConcepts);
  const chronology = buildChronology(rawText, detectedManifestations, detectedEmotions);
  const relationProposals = buildRelationProposals(chronology);
  const analysisWarnings = buildWarnings(detectedManifestations.length, detectedEmotions.length, chronology.length);
  const methodologicalStatus = determineMethodologicalStatus(
    detectedManifestations.length,
    detectedEmotions.length,
    relationProposals.length,
    detectedConcepts.length,
    rawText
  );

  return {
    id: stableId("observation-draft", rawText),
    rawText,
    detectedPeople,
    detectedManifestations,
    detectedEmotions,
    detectedCatalysts,
    detectedConcepts,
    chronology,
    relationProposals,
    confirmationQuestions: buildQuestions({
      hasEmotion: detectedEmotions.length > 0,
      hasManifestation: detectedManifestations.length > 0,
      hasConcept: detectedConcepts.length > 0,
      hasRelation: relationProposals.length > 0
    }),
    analysisWarnings,
    createdAt,
    status: "draft",
    methodologicalStatus,
    conclusion: buildConclusion(methodologicalStatus)
  };
}

export function stableId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function sourceAround(text: string, start: number, fallback: string): string {
  const sentences = splitSentences(text);
  return sentences.find((sentence) => sentence.includes(fallback)) ?? fallback;
}

function extractPeople(rawText: string) {
  const proposals = new Map<string, ReturnType<typeof makePerson>>();
  const genericPerson = /\b(une personne|un homme|une femme|quelqu'un|quelqu’une)\b/gi;
  let match: RegExpExecArray | null;

  while ((match = genericPerson.exec(rawText))) {
    const entityText = match[0];
    const sourceExcerpt = sourceAround(rawText, match.index, entityText);
    proposals.set(entityText.toLowerCase(), makePerson(entityText, sourceExcerpt));
  }

  const namedPerson = /\b(?:[A-Z][a-zA-ZÀ-ÿ'-]{2,})(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]{2,})?\b/g;
  while ((match = namedPerson.exec(rawText))) {
    const entityText = match[0];
    if (isLikelyNonPerson(entityText)) continue;
    const sourceExcerpt = sourceAround(rawText, match.index, entityText);
    proposals.set(entityText.toLowerCase(), makePerson(entityText, sourceExcerpt));
  }

  return [...proposals.values()];
}

function makePerson(entityText: string, sourceExcerpt: string) {
  return {
    id: stableId("person", `${entityText}-${sourceExcerpt}`),
    label: entityText,
    entityText,
    sourceExcerpt,
    confidence: entityText.includes(" ") ? 0.58 : 0.48,
    status: "proposed" as const,
    reason: "Entite textuelle citee, sans attribution d'intention ni d'etat psychologique.",
    provenance: ["ObservationParser.extractPeople"]
  };
}

function isLikelyNonPerson(value: string) {
  return /^(Hier|Aujourd|Bible|Conscience|Universelle|Ascension|Reconnaissance|Mission|Delta|Transmission|IA)$/i.test(value);
}

function buildRelationProposals(chronology: ObservationAnalysisDraft["chronology"]): ObservationAnalysisDraft["relationProposals"] {
  if (chronology.length < 2) return [];
  const ordered = chronology.slice().sort((left, right) => left.order - right.order);
  const first = ordered[0];
  const second = ordered[1];
  return [
    {
      id: stableId("relation", `${first.label}-${second.label}-${first.sourceExcerpt}-${second.sourceExcerpt}`),
      label: `${first.label} -> ${second.label}`,
      sourceA: first.label,
      sourceB: second.label,
      relationType: "relation temporelle",
      initialStatus: "hypothese",
      sourceExcerpt: `${first.sourceExcerpt} ${second.sourceExcerpt}`.trim(),
      confidence: 0.62,
      status: "proposed",
      reason: "Les deux elements apparaissent dans un ordre temporel ou narratif ; la causalite reste non confirmee.",
      provenance: ["ChronologyBuilder"]
    }
  ];
}

function buildWarnings(manifestations: number, emotions: number, chronology: number) {
  const warnings: string[] = [];
  if (!manifestations) warnings.push("Aucune manifestation explicite detectee.");
  if (!emotions) warnings.push("Aucune emotion explicite detectee.");
  if (chronology < 2) warnings.push("Transition non encore observable : avant/apres insuffisamment documentes.");
  warnings.push("Toute relation temporelle reste une hypothese tant qu'elle n'est pas validee.");
  return warnings;
}

function buildQuestions(flags: { hasEmotion: boolean; hasManifestation: boolean; hasConcept: boolean; hasRelation: boolean }) {
  const questions = [
    flags.hasEmotion ? "Cette emotion est-elle toujours presente ?" : "",
    flags.hasManifestation ? "Une nouvelle decision a-t-elle ete prise ?" : "",
    "La personne reformule-t-elle sa comprehension ?",
    flags.hasConcept ? "De nouveaux concepts sont-ils apparus ?" : "",
    "Le langage a-t-il change ?",
    flags.hasRelation ? "Le lien temporel propose doit-il etre valide, modifie ou ignore ?" : ""
  ].filter(Boolean);
  return [...new Set(questions)];
}

function determineMethodologicalStatus(
  manifestationCount: number,
  emotionCount: number,
  relationCount: number,
  conceptCount: number,
  rawText: string
): ObservationMethodStatus {
  if (!manifestationCount && !emotionCount && !conceptCount) return "Observation ouverte";
  if (relationCount && manifestationCount >= 2 && hasExplicitUnderstandingChange(rawText)) return "Transition possible";
  if (relationCount && emotionCount) return "Donnees insuffisantes";
  return "Donnees insuffisantes";
}

function hasExplicitUnderstandingChange(rawText: string) {
  return /\b(compris|comprendre|compr[ée]hension nouvelle|reformul[ée]|reconnu|reconnaissance|maintenant je vois|elle voit|il voit)\b/i.test(rawText);
}

function buildConclusion(status: ObservationMethodStatus) {
  if (status === "Transition possible") {
    return "Transition possible a confirmer par validation et observations supplementaires.";
  }
  return "Variation ou perturbation possible observee, mais donnees insuffisantes pour construire une transition Delta complete.";
}
