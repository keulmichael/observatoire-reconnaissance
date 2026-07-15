import type { DetectedCatalyst, DetectedConcept, DetectedManifestation } from "../types";
import { stableId } from "./ObservationParser";

const CATALYST_TYPES: Array<{ pattern: RegExp; type: DetectedCatalyst["catalystType"]; label: string }> = [
  { pattern: /\brencontre\b/i, type: "rencontre", label: "rencontre" },
  { pattern: /\blivre\b/i, type: "livre", label: "livre" },
  { pattern: /\bdiscussion\b/i, type: "rencontre", label: "discussion" },
  { pattern: /\b(th[ée]orie|cadre de r[ée]flexion)\b/i, type: "texte", label: "cadre de reflexion" },
  { pattern: /\b[ée]v[ée]nement\b/i, type: "autre", label: "evenement" },
  { pattern: /\b(IA|intelligence artificielle)\b/i, type: "intelligence artificielle", label: "IA" },
  { pattern: /\btexte\b/i, type: "texte", label: "texte" },
  { pattern: /\bsymbole\b/i, type: "symbole", label: "symbole" }
];

export function extractCatalysts(
  rawText: string,
  manifestations: DetectedManifestation[],
  concepts: DetectedConcept[]
): DetectedCatalyst[] {
  const proposals = new Map<string, DetectedCatalyst>();

  CATALYST_TYPES.forEach((definition) => {
    const match = definition.pattern.exec(rawText);
    if (!match) return;
    const sourceExcerpt = manifestations.find((manifestation) => manifestation.sourceExcerpt.includes(match[0]))?.sourceExcerpt
      ?? concepts.find((concept) => concept.sourceExcerpt.includes(match[0]))?.sourceExcerpt
      ?? match[0];
    proposals.set(definition.label, makeCatalyst(definition.label, definition.type, sourceExcerpt, "CatalystExtractor"));
  });

  manifestations
    .filter((manifestation) => manifestation.kind === "presentation" || manifestation.kind === "lecture" || manifestation.kind === "rencontre")
    .forEach((manifestation) => {
      const label = manifestation.label === "presentation d'un cadre de reflexion" ? "presentation du cadre de reflexion" : manifestation.label;
      proposals.set(label, makeCatalyst(label, "autre", manifestation.sourceExcerpt, "ManifestationExtractor"));
    });

  return [...proposals.values()];
}

function makeCatalyst(label: string, catalystType: DetectedCatalyst["catalystType"], sourceExcerpt: string, provenance: string): DetectedCatalyst {
  return {
    id: stableId("catalyst", `${label}-${sourceExcerpt}`),
    label,
    catalystType,
    sourceExcerpt,
    confidence: 0.56,
    status: "proposed",
    reason: "Element pouvant constituer un catalyseur possible ; aucune causalite n'est conclue automatiquement.",
    provenance: [provenance]
  };
}
