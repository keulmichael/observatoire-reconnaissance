import type { DetectedEmotion } from "../types";
import { stableId } from "./ObservationParser";
import { detectFrenchEmotionExpressions } from "./french-emotion-patterns";

export function extractEmotions(rawText: string): DetectedEmotion[] {
  return detectFrenchEmotionExpressions(rawText).map((match): DetectedEmotion => {
    const label = labelFor(match.canonicalEmotion, match.polarity);
    const key = `${match.canonicalEmotion}-${match.polarity}-${match.originalExpression}-${match.sourceExcerpt}`;
    return {
      id: stableId("emotion", key),
      label,
      emotion: label,
      canonicalEmotion: match.canonicalEmotion,
      originalExpression: match.originalExpression,
      expressionKind: match.expressionKind,
      sourceKind: match.sourceKind,
      polarity: match.polarity,
      scope: match.scope,
      sourceExcerpt: match.sourceExcerpt,
      confidence: match.confidence,
      status: "proposed",
      reason: `${match.reason} Aucun diagnostic psychologique n'est ajoute.`,
      provenance: ["EmotionExtractor", "french-emotion-patterns"]
    };
  });
}

function labelFor(canonicalEmotion: string, polarity: DetectedEmotion["polarity"]) {
  if (polarity === "absent") return canonicalEmotion;
  if (polarity === "negated") return `${canonicalEmotion} niee`;
  if (polarity === "uncertain") return `${canonicalEmotion} incertaine`;
  return canonicalEmotion;
}
