import type { LanguageEvolution, ReformulationCandidate } from "@/lib/types";

const STOP_WORDS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "ce",
  "ces",
  "cette",
  "de",
  "des",
  "du",
  "en",
  "et",
  "est",
  "je",
  "la",
  "le",
  "les",
  "l",
  "que",
  "qui",
  "un",
  "une"
]);

export const LanguageEngine = {
  compare(beforeValues: string[], afterValues: string[]): LanguageEvolution {
    const beforeWords = tokenize(beforeValues.join(" "));
    const afterWords = tokenize(afterValues.join(" "));
    const beforeSet = new Set(beforeWords);
    const afterSet = new Set(afterWords);
    const newWords = [...afterSet].filter((word) => !beforeSet.has(word)).sort();
    const abandonedWords = [...beforeSet].filter((word) => !afterSet.has(word)).sort();
    const stableWords = [...afterSet].filter((word) => beforeSet.has(word)).sort();
    const candidates = findReformulationCandidates(beforeValues, afterValues, "language");

    return {
      newWords,
      abandonedWords,
      stableWords,
      vocabularyDelta: newWords.length - abandonedWords.length,
      conceptFrequency: buildFrequency(beforeWords, afterWords),
      reformulationCandidates: candidates,
      status: beforeWords.length && afterWords.length ? "Observation" : "Indicateurs insuffisants"
    };
  },

  tokenize,
  normalize,
  findReformulationCandidates
};

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findReformulationCandidates(
  beforeValues: string[],
  afterValues: string[],
  category: ReformulationCandidate["category"]
): ReformulationCandidate[] {
  const beforeOnly = beforeValues.filter((value) => !afterValues.includes(value));
  const afterOnly = afterValues.filter((value) => !beforeValues.includes(value));

  return beforeOnly
    .flatMap((before) =>
      afterOnly.map((after) => ({
        before,
        after,
        category,
        confidence: reformulationConfidence(before, after),
        reason: reformulationReason(before, after),
        status: "Confirmation utilisateur requise" as const,
        mergedAutomatically: false as const
      }))
    )
    .filter((candidate) => candidate.confidence >= 0.52)
    .sort((a, b) => b.confidence - a.confidence);
}

function buildFrequency(beforeWords: string[], afterWords: string[]) {
  const concepts = [...new Set([...beforeWords, ...afterWords])].sort();
  return concepts.map((concept) => {
    const before = beforeWords.filter((word) => word === concept).length;
    const after = afterWords.filter((word) => word === concept).length;
    return { concept, before, after, delta: after - before };
  });
}

function reformulationConfidence(before: string, after: string): number {
  const left = tokenize(before);
  const right = tokenize(after);
  if (!left.length || !right.length) return 0;

  const leftInitials = left.map((word) => word[0]).join("");
  const rightInitials = right.map((word) => word[0]).join("");
  const normalizedBefore = normalize(before).replace(/\s/g, "");
  const normalizedAfter = normalize(after).replace(/\s/g, "");

  if (normalizedBefore === rightInitials || normalizedAfter === leftInitials) return 0.92;

  const intersection = left.filter((word) => right.includes(word)).length;
  const union = new Set([...left, ...right]).size;
  const tokenScore = union ? intersection / union : 0;
  const lengthScore = 1 - Math.min(Math.abs(normalizedBefore.length - normalizedAfter.length), 20) / 20;

  return Number(Math.max(tokenScore, tokenScore * 0.7 + lengthScore * 0.3).toFixed(2));
}

function reformulationReason(before: string, after: string): string {
  const beforeCompact = normalize(before).replace(/\s/g, "");
  const afterInitials = tokenize(after).map((word) => word[0]).join("");
  if (beforeCompact === afterInitials) {
    return "Forme courte compatible avec les initiales de la formulation longue.";
  }
  return "Similarite lexicale locale detectee ; confirmation utilisateur requise.";
}
