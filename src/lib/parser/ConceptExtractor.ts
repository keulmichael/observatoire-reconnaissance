import type { DetectedConcept } from "../types";
import { sourceAround, stableId } from "./ObservationParser";

const KNOWN_CONCEPTS = [
  "Conscience Universelle",
  "Ascension",
  "Bible du Nouvel Age",
  "Bible du Nouvel Âge",
  "Reconnaissance",
  "Mission",
  "Delta",
  "Transmission",
  "cadre de reflexion",
  "cadre de réflexion",
  "theorie",
  "théorie",
  "idee",
  "idée"
];

export function extractConcepts(rawText: string): DetectedConcept[] {
  const proposals = new Map<string, DetectedConcept>();

  KNOWN_CONCEPTS.forEach((concept) => {
    const escaped = concept.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "i");
    const match = pattern.exec(rawText);
    if (!match) return;
    const sourceExcerpt = sourceAround(rawText, match.index, match[0]);
    const normalizedConcept = normalizeConcept(match[0]);
    proposals.set(normalizedConcept.toLowerCase(), {
      id: stableId("concept", `${normalizedConcept}-${sourceExcerpt}`),
      label: normalizedConcept,
      concept: normalizedConcept,
      sourceExcerpt,
      confidence: 0.68,
      status: "proposed",
      reason: "Concept ou terme thematique explicitement present dans le texte.",
      provenance: ["ConceptExtractor"]
    });
  });

  return [...proposals.values()];
}

function normalizeConcept(value: string) {
  if (/cadre de r[ée]flexion/i.test(value)) return "cadre de reflexion";
  if (/th[ée]orie/i.test(value)) return "theorie";
  if (/id[ée]e/i.test(value)) return "idee";
  if (/Bible du Nouvel/i.test(value)) return "Bible du Nouvel Age";
  return value;
}
