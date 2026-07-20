import type {
  AIObservationProposal,
  DetectedCatalyst,
  DetectedConcept,
  DetectedEmotion,
  DetectedManifestation,
  DetectedPerson,
  MergedObservationAnalysis,
  MergedObservationItem,
  ObservationAICollectionKey,
  ObservationAIResponse,
  ObservationAnalysisDraft,
  ObservationProposalBase,
  ObservationRelationProposal
} from "../types";
import { stableId } from "../parser/ObservationParser";
import { averageConfidence } from "./ObservationConfidence";
import { emptyAIResponse, observationAICollectionKeys } from "./ObservationAISchema";

type ParserBucket = Partial<Record<ObservationAICollectionKey, AIObservationProposal[]>>;

export function parserDraftToAIResponse(draft: ObservationAnalysisDraft): ObservationAIResponse {
  const buckets: ParserBucket = {
    people: draft.detectedPeople.map((item) => parserProposal(item, "person")),
    manifestations: draft.detectedManifestations.map((item) => parserProposal(item, "manifestation")),
    emotions: draft.detectedEmotions.map((item) => parserProposal(item, "emotion")),
    concepts: draft.detectedConcepts.map((item) => parserProposal(item, "concept")),
    relations: draft.relationProposals.map((item) => parserProposal(item, "relation")),
    timeline: draft.chronology.map((item) => ({
      id: item.id,
      type: "timeline",
      label: item.label,
      excerpt: item.sourceExcerpt,
      confidence: 0.7,
      reason: item.reason,
      source: "parser",
      status: item.status
    })),
    objects: draft.detectedCatalysts.map((item) => parserProposal(item, "catalyst"))
  };
  const response = emptyAIResponse();
  for (const key of observationAICollectionKeys) response[key] = buckets[key] ?? [];
  response.confidence = averageConfidence(Object.values(buckets).flat());
  response.limitations = draft.analysisWarnings;
  response.uncertainties = draft.confirmationQuestions;
  response.reasoningSummary = "Analyse deterministe issue des extracteurs locaux.";
  return response;
}

export function mergeObservationAnalyses(
  parser: ObservationAIResponse,
  ai: ObservationAIResponse | null,
  createdAt = new Date().toISOString()
): MergedObservationAnalysis {
  const merged = baseMerged(createdAt);
  const aiResponse = ai ?? emptyAIResponse();

  for (const key of observationAICollectionKeys) {
    const parserItems = parser[key];
    const aiItems = aiResponse[key];
    const usedAI = new Set<string>();
    const items: MergedObservationItem[] = [];

    for (const parserItem of parserItems) {
      const match = aiItems.find((candidate) => !usedAI.has(candidate.id) && areSimilar(parserItem, candidate));
      if (match) {
        usedAI.add(match.id);
        items.push(mergeItem(parserItem, match, "convergence"));
      } else {
        items.push(singleItem(parserItem, "parser-only"));
      }
    }

    for (const aiItem of aiItems) {
      if (!usedAI.has(aiItem.id)) items.push(singleItem(aiItem, "ai-only"));
    }

    merged[key] = items;
  }

  merged.convergences = observationAICollectionKeys.flatMap((key) =>
    merged[key].filter((item) => item.mergeStatus === "convergence")
  );
  merged.differences = observationAICollectionKeys.flatMap((key) =>
    merged[key].filter((item) => item.mergeStatus !== "convergence")
  );
  return merged;
}

export function applyMergedObservationToDraft(
  draft: ObservationAnalysisDraft,
  merged: MergedObservationAnalysis
): ObservationAnalysisDraft {
  return {
    ...draft,
    detectedPeople: merged.people.map((item): DetectedPerson => ({
      ...baseProposal(item),
      entityText: item.label
    })),
    detectedManifestations: merged.manifestations.map((item): DetectedManifestation => ({
      ...baseProposal(item),
      kind: "evenement"
    })),
    detectedEmotions: merged.emotions.map((item): DetectedEmotion => ({
      ...baseProposal(item),
      emotion: item.label,
      canonicalEmotion: item.label,
      originalExpression: item.label,
      expressionKind: "supposee",
      sourceKind: item.excerpt ? "narration" : "inconnue",
      polarity: "present",
      scope: "indeterminate"
    })),
    detectedCatalysts: merged.objects.map((item): DetectedCatalyst => ({
      ...baseProposal(item),
      catalystType: "autre"
    })),
    detectedConcepts: merged.concepts.map((item): DetectedConcept => ({
      ...baseProposal(item),
      concept: item.label
    })),
    relationProposals: merged.relations.map((item): ObservationRelationProposal => {
      const parts = item.label.split(/\s*->\s*/);
      return {
        ...baseProposal(item),
        sourceA: parts[0] ?? item.label,
        sourceB: parts[1] ?? "a confirmer",
        relationType: "relation possible",
        initialStatus: "hypothese"
      };
    }),
    mergedObservation: merged,
    confirmationQuestions: [
      ...new Set([
        ...draft.confirmationQuestions,
        ...merged.questions.map((item) => item.label),
        ...merged.differences.map((item) => `Confirmer ou rejeter la proposition : ${item.label}`)
      ])
    ]
  };
}

function parserProposal(item: ObservationProposalBase, type: string): AIObservationProposal {
  return {
    id: item.id,
    type,
    label: item.label,
    excerpt: item.sourceExcerpt,
    confidence: item.confidence,
    reason: item.reason,
    source: "parser",
    status: item.status
  };
}

function baseProposal(item: MergedObservationItem): ObservationProposalBase {
  return {
    id: item.id,
    label: item.label,
    sourceExcerpt: item.excerpt,
    confidence: item.confidence,
    status: "proposed",
    reason: item.reason,
    provenance: item.sources
  };
}

function mergeItem(parserItem: AIObservationProposal, aiItem: AIObservationProposal, mergeStatus: MergedObservationItem["mergeStatus"]): MergedObservationItem {
  const preferred = aiItem.label.length >= parserItem.label.length ? aiItem : parserItem;
  return {
    ...preferred,
    id: stableId("merged", `${parserItem.id}-${aiItem.id}-${preferred.label}`),
    source: "parser+ai",
    confidence: Math.max(parserItem.confidence, aiItem.confidence),
    reason: [parserItem.reason, aiItem.reason].filter(Boolean).join(" | "),
    status: "proposed",
    sources: ["parser", "ai"],
    parserProposalIds: [parserItem.id],
    aiProposalIds: [aiItem.id],
    mergeStatus
  };
}

function singleItem(item: AIObservationProposal, mergeStatus: MergedObservationItem["mergeStatus"]): MergedObservationItem {
  return {
    ...item,
    id: stableId("merged", `${item.source}-${item.id}-${item.label}`),
    sources: [item.source],
    parserProposalIds: item.source === "parser" ? [item.id] : [],
    aiProposalIds: item.source === "ai" ? [item.id] : [],
    mergeStatus
  };
}

function areSimilar(left: AIObservationProposal, right: AIObservationProposal) {
  const leftLabel = normalize(left.label);
  const rightLabel = normalize(right.label);
  if (!leftLabel || !rightLabel) return false;
  return leftLabel === rightLabel || leftLabel.includes(rightLabel) || rightLabel.includes(leftLabel);
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function baseMerged(createdAt: string): MergedObservationAnalysis {
  return {
    people: [],
    organisations: [],
    places: [],
    manifestations: [],
    events: [],
    objects: [],
    concepts: [],
    emotions: [],
    attitudes: [],
    representations: [],
    emotionScope: [],
    behaviours: [],
    decisions: [],
    intentions: [],
    relations: [],
    questions: [],
    timeline: [],
    differences: [],
    convergences: [],
    createdAt
  };
}
