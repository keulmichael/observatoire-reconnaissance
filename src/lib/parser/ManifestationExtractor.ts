import type { DetectedManifestation } from "../types";
import { sourceAround, stableId } from "./ObservationParser";

const MANIFESTATION_PATTERNS: Array<{
  kind: DetectedManifestation["kind"];
  pattern: RegExp;
  label: string;
  reason: string;
}> = [
  {
    kind: "presentation",
    pattern: /\b(pr[ée]sent[ée]?\s+(?:un|une|le|la|des|nouveau|nouvelle)?[^.!?\n]*)/i,
    label: "presentation",
    reason: "Une presentation est explicitement mentionnee dans le texte."
  },
  {
    kind: "message",
    pattern: /\b(message|m'a ecrit|m’a ecrit|m'a envoye|m’a envoye)\b[^.!?\n]*/i,
    label: "message",
    reason: "Un message est explicitement mentionne dans le texte."
  },
  {
    kind: "discussion",
    pattern: /\b(discussion|discut[ée]|conversation|parl[ée])\b[^.!?\n]*/i,
    label: "discussion",
    reason: "Une discussion est explicitement mentionnee dans le texte."
  },
  {
    kind: "rencontre",
    pattern: /\b(rencontre|rencontr[ée])\b[^.!?\n]*/i,
    label: "rencontre",
    reason: "Une rencontre est explicitement mentionnee dans le texte."
  },
  {
    kind: "lecture",
    pattern: /\b(lecture|lu|livre|texte)\b[^.!?\n]*/i,
    label: "lecture",
    reason: "Une lecture ou un texte est explicitement mentionne."
  },
  {
    kind: "decision",
    pattern: /\b(d[ée]cision|d[ée]cid[ée]|choisi|choix)\b[^.!?\n]*/i,
    label: "decision",
    reason: "Une decision est explicitement mentionnee dans le texte."
  },
  {
    kind: "declaration",
    pattern: /\b(m'a dit|m’a dit|a dit|dit qu|d[ée]clar[ée]|formul[ée])\b[^.!?\n]*/i,
    label: "declaration",
    reason: "Une declaration est explicitement mentionnee dans le texte."
  },
  {
    kind: "evenement",
    pattern: /\b([ée]v[ée]nement|incident|situation)\b[^.!?\n]*/i,
    label: "evenement",
    reason: "Un evenement est explicitement mentionne dans le texte."
  }
];

export function extractManifestations(rawText: string): DetectedManifestation[] {
  const proposals = new Map<string, DetectedManifestation>();

  MANIFESTATION_PATTERNS.forEach((definition) => {
    const matches = rawText.matchAll(new RegExp(definition.pattern, "gi"));
    for (const match of matches) {
      const matchedText = (match[1] ?? match[0]).trim();
      const sourceExcerpt = sourceAround(rawText, match.index ?? 0, matchedText);
      const label = normalizePresentationLabel(definition.label, matchedText);
      const key = `${definition.kind}-${sourceExcerpt}`;
      proposals.set(key, {
        id: stableId("manifestation", key),
        label,
        kind: definition.kind,
        sourceExcerpt,
        confidence: 0.74,
        status: "proposed",
        reason: definition.reason,
        provenance: ["ManifestationExtractor"]
      });
    }
  });

  return [...proposals.values()];
}

function normalizePresentationLabel(label: string, matchedText: string) {
  if (/cadre de r[ée]flexion/i.test(matchedText)) return "presentation d'un cadre de reflexion";
  return label;
}
