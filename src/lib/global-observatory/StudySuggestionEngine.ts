import type { GlobalObservedEvent, GlobalStudySuggestion, Study } from "../types";
import { provenanceStudyWarning } from "./Provenance";
import { stableId } from "./utils";

export class StudySuggestionEngine {
  static suggest(event: GlobalObservedEvent, now = new Date().toISOString()): GlobalStudySuggestion {
    return {
      id: stableId("global-suggestion", event.id),
      eventId: event.id,
      title: `Etude: ${event.title}`,
      rationale: event.analysis?.stakes ?? "Evenement potentiellement observable pour la Theorie de la Reflexivite Universelle.",
      categories: event.categories,
      hypotheses: event.analysis?.hypotheses ?? [],
      sourceIds: event.sourceIds,
      claimIds: event.analysis?.claims.map((claim) => claim.id) ?? [],
      status: "proposed",
      createdStudyIds: event.createdStudyIds,
      createdAt: now,
      updatedAt: now
    };
  }

  static createStudy(event: GlobalObservedEvent, now = new Date().toISOString(), id = `study-${crypto.randomUUID()}`): Study {
    const sourceLines = event.sources.map((source) => {
      const link = source.url ? ` (${source.url})` : "";
      return `- ${source.connectorName}: ${source.title}${link}`;
    });
    const hypotheses = event.analysis?.hypotheses ?? [];
    const provenanceWarning = provenanceStudyWarning(event);
    return {
      id,
      title: event.studySuggestion?.title ?? `Etude: ${event.title}`,
      description: [
        event.analysis?.summary ?? event.summary,
        "",
        "Sources utilisees:",
        ...sourceLines,
        "",
        "Hypotheses initiales:",
        ...hypotheses.map((hypothesis) => `- ${hypothesis}`)
      ].join("\n"),
      subject: event.title,
      startDate: now.slice(0, 10),
      status: "Observation ouverte",
      currentLevel: "Observation ouverte",
      notes: [
        provenanceWarning,
        `Evenement source: ${event.id}`,
        `Categories: ${event.categories.join(", ")}`,
        `Niveau d'interet: ${event.interest?.level ?? "Non score"}`,
        `Traçabilite: ${event.analysis?.claims.length ?? 0} claim(s), ${event.sourceIds.length} source(s).`
      ].filter(Boolean).join("\n"),
      states: [],
      manifestations: [
        {
          id: `manifestation-${event.id}`,
          title: event.title,
          date: event.startedAt,
          description: event.analysis?.observedPhenomenon ?? event.summary,
          evidenceLevel: event.sources.length >= 3 ? 3 : event.sources.length >= 2 ? 2 : 1,
          sourceExcerpt: event.sources.flatMap((source) => source.excerpts.map((excerpt) => excerpt.text)).join("\n"),
          engineProvenance: ["StudySuggestionEngine"]
        }
      ],
      transitions: [],
      recognitions: [],
      catalysts: [],
      emotionObservations: [],
      relations: [],
      timeline: [
        {
          id: `timeline-${event.id}`,
          kind: "manifestation",
          title: event.title,
          date: event.startedAt,
          summary: event.summary,
          inDeltaPath: false,
          sourceExcerpt: event.sources.flatMap((source) => source.excerpts.map((excerpt) => excerpt.text)).join("\n"),
          engineProvenance: ["StudySuggestionEngine"]
        }
      ],
      map: { nodes: [], edges: [] },
      history: ["Etude creee depuis la Veille mondiale."],
      observations: [],
      openQuestions: (event.analysis?.researchQuestions ?? []).map((text, index) => ({
        id: `global-question-${event.id}-${index}`,
        studyId: id,
        sourceObservationIds: [],
        text,
        status: "ouverte",
        createdAt: now
      })),
      structuredHistory: [],
      relationProposals: [],
      deltaScores: [],
      createdAt: now,
      updatedAt: now
    };
  }
}
