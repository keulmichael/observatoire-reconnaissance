import type { StudySynthesisClaim } from "@/lib/types";
import type { CollectedStudyData } from "./types";
import { claim, confidenceFromRatio, evidenceFromObservation } from "./utils";

export class HypothesisGenerator {
  generate(data: CollectedStudyData): StudySynthesisClaim[] {
    const observations = data.observations;
    const claims: StudySynthesisClaim[] = [];
    const recurringConcepts = new Map<string, string[]>();
    observations.forEach((observation) => {
      observation.detectedConcepts.forEach((concept) => {
        const key = concept.concept || concept.label;
        recurringConcepts.set(key, [...(recurringConcepts.get(key) ?? []), observation.id]);
      });
    });
    const recurring = [...recurringConcepts.entries()].find(([, ids]) => ids.length >= 2);
    if (recurring) {
      const [concept, ids] = recurring;
      claims.push(claim({
        kind: "hypothese nouvelle",
        text: `Le concept "${concept}" pourrait structurer une piste de recherche transversale dans cette étude.`,
        confidence: confidenceFromRatio(ids.length / Math.max(observations.length, 1), observations.length),
        justification: "Cette hypothèse repose sur une récurrence, mais elle ne prouve ni causalité ni centralité théorique.",
        evidence: observations.filter((observation) => ids.includes(observation.id)).slice(0, 4).map(evidenceFromObservation)
      }));
    }

    const unexpected = observations.filter((observation) => /inattendu|surprise|paradox|pourtant|malgre/i.test(observation.rawText));
    if (unexpected.length) {
      claims.push(claim({
        kind: "hypothese nouvelle",
        text: "Des phénomènes inattendus ou paradoxaux méritent une vérification dans de futures observations.",
        confidence: confidenceFromRatio(unexpected.length / Math.max(observations.length, 1), observations.length),
        justification: "Les marqueurs textuels suggèrent une anomalie, mais l'échantillon ne suffit pas à la transformer en conclusion.",
        evidence: unexpected.slice(0, 4).map(evidenceFromObservation)
      }));
    }

    if (!claims.length) {
      claims.push(claim({
        kind: "hypothese nouvelle",
        text: "Aucune hypothèse nouvelle robuste ne peut être proposée au-delà des pistes déjà visibles dans les objets de l'étude.",
        confidence: "Moyen",
        justification: "Le moteur ne détecte pas de récurrence ou d'anomalie suffisamment explicite.",
        evidence: observations.slice(0, 2).map(evidenceFromObservation)
      }));
    }
    return claims;
  }
}
