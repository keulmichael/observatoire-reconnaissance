import type { StudySynthesisClaim } from "@/lib/types";
import type { CollectedStudyData } from "./types";
import { claim, confidenceFromRatio, evidenceFromObservation } from "./utils";

export class ReflexiveAnalyzer {
  analyze(data: CollectedStudyData): StudySynthesisClaim[] {
    const claims: StudySynthesisClaim[] = [];
    const observations = data.observations;
    const recognitionSources = observations.filter((observation) =>
      data.study.recognitions.some((recognition) => recognition.sourceObservationIds?.includes(observation.id)) ||
      /reconna|compris|comprend|reformul/i.test(observation.rawText)
    );
    const transitionSources = observations.filter((observation) =>
      data.study.transitions.some((transition) => transition.sourceObservationIds?.includes(observation.id))
    );
    const blockers = observations.filter((observation) => /rejet|mepris|bloqu|perdu|silence|contrad/i.test(observation.rawText));

    if (recognitionSources.length) {
      claims.push(claim({
        kind: "interpretation proposee",
        text: `${recognitionSources.length} observation(s) contiennent des indices de reconnaissance, de compréhension ou de reformulation.`,
        confidence: confidenceFromRatio(recognitionSources.length / Math.max(observations.length, 1), observations.length),
        justification: "La conclusion reste interprétative car elle dépend des marqueurs textuels et des objets de reconnaissance déjà produits.",
        evidence: recognitionSources.slice(0, 4).map(evidenceFromObservation)
      }));
    }

    if (transitionSources.length) {
      claims.push(claim({
        kind: "fait observe",
        text: `${transitionSources.length} observation(s) ont produit au moins une transition structurée dans l'étude.`,
        confidence: confidenceFromRatio(transitionSources.length / Math.max(observations.length, 1), observations.length),
        justification: "Ces transitions proviennent des objets enregistrés dans l'étude, pas d'une extrapolation.",
        evidence: transitionSources.slice(0, 4).map(evidenceFromObservation)
      }));
    }

    if (blockers.length) {
      claims.push(claim({
        kind: "interpretation proposee",
        text: "Certains passages signalent des obstacles possibles à la reconnaissance, notamment rejet, mépris, blocage, silence ou contradiction.",
        confidence: confidenceFromRatio(blockers.length / Math.max(observations.length, 1), observations.length),
        justification: "Ces obstacles sont proposés à partir de marqueurs explicitement présents dans les observations.",
        evidence: blockers.slice(0, 4).map(evidenceFromObservation)
      }));
    }

    if (!claims.length) {
      claims.push(claim({
        kind: "limite",
        text: "Les données ne permettent pas encore d'identifier une chaîne réflexive suffisamment documentée.",
        confidence: "Élevé",
        justification: "Aucune observation ou structure enregistrée ne relie clairement émotion, comportement, représentation, concept et reconnaissance.",
        evidence: []
      }));
    }
    return claims;
  }
}
