import type { StudySynthesisClaim, StudySynthesisConfidenceLevel } from "@/lib/types";
import type { CollectedStudyData } from "./types";

export class ConfidenceEvaluator {
  evaluate(data: CollectedStudyData, claims: StudySynthesisClaim[]) {
    const observationCount = data.observations.length;
    const evidenceCoverage = claims.length
      ? claims.reduce((total, item) => total + Math.min(item.evidence.length, 3), 0) / (claims.length * 3)
      : 0;
    const diversity = Math.min(1, new Set(data.observations.flatMap((item) => item.detectedDimensions?.map((dimension) => dimension.category) ?? [])).size / 6);
    const score = observationCountScore(observationCount) * 0.45 + evidenceCoverage * 0.35 + diversity * 0.2;
    return {
      overall: level(score),
      justification: `Niveau calculé à partir de ${observationCount} observation(s), d'une couverture de preuves de ${Math.round(evidenceCoverage * 100)} % et d'une diversité dimensionnelle de ${Math.round(diversity * 100)} %.`
    };
  }
}

function observationCountScore(count: number) {
  if (count >= 10) return 1;
  if (count >= 5) return 0.75;
  if (count >= 3) return 0.5;
  if (count >= 1) return 0.25;
  return 0;
}

function level(score: number): StudySynthesisConfidenceLevel {
  if (score >= 0.8) return "Très élevé";
  if (score >= 0.6) return "Élevé";
  if (score >= 0.35) return "Moyen";
  return "Faible";
}
