import type { AIObservationProposal } from "../types";

export function clampConfidence(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric > 1) return Math.max(0, Math.min(1, numeric / 100));
  return Math.max(0, Math.min(1, numeric));
}

export function proposalConfidence(proposal: Pick<AIObservationProposal, "confidence">): number {
  return Math.round(clampConfidence(proposal.confidence) * 100);
}

export function averageConfidence(proposals: Array<Pick<AIObservationProposal, "confidence">>): number {
  if (!proposals.length) return 0;
  const total = proposals.reduce((sum, proposal) => sum + clampConfidence(proposal.confidence), 0);
  return Math.round((total / proposals.length) * 100) / 100;
}
