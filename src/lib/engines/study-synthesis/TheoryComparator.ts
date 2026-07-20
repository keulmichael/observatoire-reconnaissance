import type { StudySynthesisClaim } from "@/lib/types";
import type { CollectedStudyData } from "./types";
import { claim, confidenceFromRatio, evidenceFromObservation } from "./utils";

export class TheoryComparator {
  compare(data: CollectedStudyData): StudySynthesisClaim[] {
    const observations = data.observations;
    const claims: StudySynthesisClaim[] = [];
    const relationEvidence = observations.filter((observation) => observation.detectedRelations.length || /relation|lien|assoc/i.test(observation.rawText));
    const transformationEvidence = observations.filter((observation) => /transform|changement|desormais|maintenant|evolu/i.test(observation.rawText));
    const contradictionEvidence = observations.filter((observation) => /contrad|incoher|sans effet|ne change pas|aucune transformation/i.test(observation.rawText));

    if (relationEvidence.length && transformationEvidence.length) {
      claims.push(claim({
        kind: "interpretation proposee",
        text: "Les observations soutiennent partiellement le principe selon lequel une relation reconnue peut accompagner une transformation.",
        confidence: confidenceFromRatio(Math.min(relationEvidence.length, transformationEvidence.length) / Math.max(observations.length, 1), observations.length),
        justification: "Le soutien reste partiel : relation et transformation sont présentes, mais leur causalité n'est pas démontrée.",
        evidence: [...relationEvidence, ...transformationEvidence].slice(0, 4).map(evidenceFromObservation)
      }));
    }

    if (contradictionEvidence.length) {
      claims.push(claim({
        kind: "interpretation proposee",
        text: "Certaines observations peuvent nuancer ou contredire une lecture trop linéaire de la théorie.",
        confidence: confidenceFromRatio(contradictionEvidence.length / Math.max(observations.length, 1), observations.length),
        justification: "Ces passages signalent une absence de transformation, une contradiction ou une incohérence observable.",
        evidence: contradictionEvidence.slice(0, 4).map(evidenceFromObservation)
      }));
    }

    if (!claims.length) {
      claims.push(claim({
        kind: "limite",
        text: "La comparaison avec la Théorie de la Réflexivité Universelle reste insuffisamment documentée.",
        confidence: "Élevé",
        justification: "Le corpus ne relie pas encore assez clairement relations, reconnaissance et transformations observables.",
        evidence: observations.slice(0, 2).map(evidenceFromObservation)
      }));
    }
    return claims;
  }
}
