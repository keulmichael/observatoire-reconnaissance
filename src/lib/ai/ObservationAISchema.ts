import type {
  AIObservationProposal,
  ObservationAICollectionKey,
  ObservationAIResponse
} from "../types";
import { clampConfidence } from "./ObservationConfidence";

export const observationAICollectionKeys: ObservationAICollectionKey[] = [
  "people",
  "organisations",
  "places",
  "manifestations",
  "events",
  "objects",
  "concepts",
  "emotions",
  "emotionScope",
  "behaviours",
  "decisions",
  "intentions",
  "relations",
  "questions",
  "timeline"
];

export function emptyAIResponse(): ObservationAIResponse {
  return {
    people: [],
    organisations: [],
    places: [],
    manifestations: [],
    events: [],
    objects: [],
    concepts: [],
    emotions: [],
    emotionScope: [],
    behaviours: [],
    decisions: [],
    intentions: [],
    relations: [],
    questions: [],
    timeline: [],
    confidence: 0,
    limitations: [],
    uncertainties: [],
    reasoningSummary: ""
  };
}

export function parseAIResponseJSON(value: string, metadata?: { model?: string; promptHash?: string; createdAt?: string; latency?: number }): ObservationAIResponse {
  return normalizeAIResponse(JSON.parse(value), metadata);
}

export function normalizeAIResponse(input: unknown, metadata?: { model?: string; promptHash?: string; createdAt?: string; latency?: number }): ObservationAIResponse {
  if (!input || typeof input !== "object") {
    throw new Error("La reponse IA doit etre un objet JSON.");
  }
  const record = input as Record<string, unknown>;
  const output = emptyAIResponse();

  for (const key of observationAICollectionKeys) {
    const items = Array.isArray(record[key]) ? record[key] : [];
    output[key] = items.map((item, index) => normalizeProposal(item, key, index, metadata));
  }

  output.confidence = clampConfidence(record.confidence);
  output.limitations = toStringArray(record.limitations);
  output.uncertainties = toStringArray(record.uncertainties);
  output.reasoningSummary = typeof record.reasoningSummary === "string" ? record.reasoningSummary : "";
  return output;
}

function normalizeProposal(
  input: unknown,
  fallbackType: string,
  index: number,
  metadata?: { model?: string; promptHash?: string; createdAt?: string; latency?: number }
): AIObservationProposal {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const label = text(record.label) || text(record.id) || `${fallbackType}-${index + 1}`;
  const excerpt = text(record.excerpt);
  return {
    id: text(record.id) || `${fallbackType}-${slug(label)}-${index + 1}`,
    type: text(record.type) || fallbackType,
    label,
    excerpt,
    confidence: clampConfidence(record.confidence),
    reason: text(record.reason) || "Proposition semantique a valider par l'utilisateur.",
    source: "ai",
    status: "proposed",
    model: metadata?.model,
    version: metadata?.model,
    promptHash: metadata?.promptHash,
    createdAt: metadata?.createdAt,
    latency: metadata?.latency
  };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
}
