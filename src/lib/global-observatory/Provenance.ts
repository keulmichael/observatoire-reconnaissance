import type { GlobalEventSource, GlobalObservedEvent } from "../types";

export type ProvenanceStatus = "real" | "simulated" | "unknown";

export function sourceProvenanceStatus(source: GlobalEventSource): ProvenanceStatus {
  if (source.provenance?.kind) return source.provenance.kind;
  const markers = [
    source.externalId ?? "",
    source.title,
    source.url ?? "",
    ...source.excerpts.map((excerpt) => `${excerpt.location} ${excerpt.text}`)
  ].join(" ");
  if (/historical:synthetic-page|deterministic|mock|fixture|synthetic|observe le \d{4}-\d{2}-\d{2}|#\d{4}-\d{2}-\d{2}-\d+/i.test(markers)) {
    return "simulated";
  }
  return "unknown";
}

export function eventProvenanceStatus(event: GlobalObservedEvent): ProvenanceStatus {
  const statuses = new Set(event.sources.map(sourceProvenanceStatus));
  if (statuses.has("simulated")) return "simulated";
  if (statuses.has("unknown")) return "unknown";
  return "real";
}

export function provenanceLabel(status: ProvenanceStatus) {
  if (status === "real") return "Reel verifie";
  if (status === "simulated") return "Simule";
  return "Provenance non verifiable";
}

export function eventContainsUnverifiedData(event: GlobalObservedEvent) {
  return eventProvenanceStatus(event) !== "real";
}

export function provenanceStudyWarning(event: GlobalObservedEvent) {
  const status = eventProvenanceStatus(event);
  if (status === "real") return undefined;
  return [
    "Avertissement provenance:",
    status === "simulated"
      ? "cette etude a ete creee depuis un evenement contenant au moins une donnee simulee."
      : "cette etude a ete creee depuis un evenement dont la provenance n'est pas entierement verifiable.",
    `Statut provenance: ${provenanceLabel(status)}.`
  ].join(" ");
}
