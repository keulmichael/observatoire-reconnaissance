import type { RelationProposal, Study } from "@/lib/types";
import { normalize } from "./LanguageEngine";

export const RelationEngine = {
  analyze(study: Study): RelationProposal[] {
    const proposals = new Map<string, RelationProposal>();

    study.transitions.forEach((transition) => {
      transition.newRelations.forEach((relation) => {
        const parts = splitRelation(relation);
        if (parts) {
          addProposal(proposals, {
            id: `relation-proposal-${normalize(parts.join("-")).slice(0, 48)}`,
            elements: parts,
            reason: "Relation formulee dans une transition Delta existante.",
            confidence: 0.74,
            provenance: [`transition:${transition.id}`],
            initialStatus: "hypothese",
            actions: ["valider", "rejeter"]
          });
        }
      });
    });

    study.map.edges.forEach((edge) => {
      const source = String(edge.source);
      const target = String(edge.target);
      addProposal(proposals, {
        id: `relation-proposal-${normalize(`${source}-${target}`).slice(0, 48)}`,
        elements: [source, target],
        reason: "Lien present dans la carte reflexive locale.",
        confidence: 0.62,
        provenance: [`map-edge:${edge.id}`],
        initialStatus: "hypothese",
        actions: ["valider", "rejeter"]
      });
    });

    return [...proposals.values()].sort((a, b) => b.confidence - a.confidence);
  }
};

function splitRelation(value: string): [string, string] | null {
  const parts = value.split(/↔|->|→|<->|--| entre /i).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return [parts[0], parts.slice(1).join(" ")];
}

function addProposal(map: Map<string, RelationProposal>, proposal: RelationProposal) {
  const key = normalize(proposal.elements.join("-"));
  const existing = map.get(key);
  if (!existing) {
    map.set(key, proposal);
    return;
  }
  map.set(key, {
    ...existing,
    confidence: Math.min(0.95, Number((existing.confidence + 0.08).toFixed(2))),
    provenance: [...new Set([...existing.provenance, ...proposal.provenance])],
    reason: `${existing.reason} Observation convergente supplementaire.`
  });
}
