import type { DetectedEmotion } from "../types";
import { sourceAround, stableId } from "./ObservationParser";

const EMOTION_WORDS = [
  "perdue",
  "perdu",
  "heureuse",
  "heureux",
  "angoissee",
  "angoisse",
  "sereine",
  "serein",
  "motivee",
  "motive",
  "confuse",
  "confus",
  "inquiet",
  "inquiete",
  "apaisee",
  "apaise",
  "stress",
  "doute"
];

export function extractEmotions(rawText: string): DetectedEmotion[] {
  const proposals = new Map<string, DetectedEmotion>();

  EMOTION_WORDS.forEach((emotion) => {
    const pattern = new RegExp(`\\b${emotion}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(rawText))) {
      const sourceExcerpt = sourceAround(rawText, match.index, match[0]);
      const expression = classifyExpression(sourceExcerpt);
      const key = `${emotion}-${sourceExcerpt}`;
      proposals.set(key, {
        id: stableId("emotion", key),
        label: match[0],
        emotion: match[0],
        expressionKind: expression.expressionKind,
        sourceKind: expression.sourceKind,
        sourceExcerpt,
        confidence: expression.expressionKind === "supposee" ? 0.42 : 0.72,
        status: "proposed",
        reason: `${expression.reason} Aucun diagnostic psychologique n'est ajoute.`,
        provenance: ["EmotionExtractor"]
      });
    }
  });

  return [...proposals.values()];
}

function classifyExpression(sourceExcerpt: string): Pick<DetectedEmotion, "expressionKind" | "sourceKind"> & { reason: string } {
  if (/[«"].+\b(perdue|perdu|heureuse|heureux|angoissee|angoisse|sereine|serein|motivee|motive|confuse|confus|inquiet|inquiete|apaisee|apaise|stress|doute)\b.+[»"]/i.test(sourceExcerpt)) {
    return {
      expressionKind: "exprimee directement",
      sourceKind: "citation",
      reason: "Emotion ou etat exprime dans une citation."
    };
  }
  if (/\b(m'a dit|m’a dit|a dit|dit qu|se sentait|se sent|je suis|elle est|il est)\b/i.test(sourceExcerpt)) {
    return {
      expressionKind: "exprimee directement",
      sourceKind: "discours rapporte",
      reason: "Emotion ou etat rapporte comme expression de la personne."
    };
  }
  if (/\bsemble|semblait|peut-etre|peut être|probablement|j'imagine|je pense\b/i.test(sourceExcerpt)) {
    return {
      expressionKind: "supposee",
      sourceKind: "narration",
      reason: "Emotion seulement supposee dans la narration."
    };
  }
  return {
    expressionKind: "attribuee par le narrateur",
    sourceKind: "narration",
    reason: "Emotion attribuee par le narrateur."
  };
}
