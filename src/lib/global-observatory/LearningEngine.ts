import type { GlobalLearningSignal, GlobalObservedEvent, GlobalObservatoryState } from "../types";
import { stableId } from "./utils";

export class LearningEngine {
  static record(
    state: GlobalObservatoryState,
    eventId: string,
    action: GlobalLearningSignal["action"],
    options: { suggestionId?: string; studyId?: string; reason?: string; now?: string } = {}
  ): GlobalObservatoryState {
    const now = options.now ?? new Date().toISOString();
    const weight = this.actionWeight(action);
    const signal: GlobalLearningSignal = {
      id: stableId("learning", `${eventId}-${action}-${options.studyId ?? ""}-${now}`),
      eventId,
      suggestionId: options.suggestionId,
      studyId: options.studyId,
      action,
      weight,
      reason: options.reason ?? this.defaultReason(action),
      createdAt: now
    };
    return {
      ...state,
      learningSignals: [signal, ...state.learningSignals],
      events: state.events.map((event) => this.updateEvent(event, signal))
    };
  }

  private static updateEvent(event: GlobalObservedEvent, signal: GlobalLearningSignal): GlobalObservedEvent {
    if (event.id !== signal.eventId) return event;
    return {
      ...event,
      learningWeight: Math.max(0, event.learningWeight + signal.weight),
      status: signal.action === "study-retained" || signal.action === "pertinence-confirmed" ? "studied" : event.status,
      createdStudyIds: signal.studyId && !event.createdStudyIds.includes(signal.studyId)
        ? [signal.studyId, ...event.createdStudyIds]
        : event.createdStudyIds,
      studySuggestion: event.studySuggestion
        ? {
            ...event.studySuggestion,
            status: signal.action === "study-abandoned" ? "abandoned" : "retained",
            createdStudyIds: signal.studyId && !event.studySuggestion.createdStudyIds.includes(signal.studyId)
              ? [signal.studyId, ...event.studySuggestion.createdStudyIds]
              : event.studySuggestion.createdStudyIds,
            updatedAt: signal.createdAt
          }
        : event.studySuggestion
    };
  }

  private static actionWeight(action: GlobalLearningSignal["action"]) {
    if (action === "study-retained") return 3;
    if (action === "observation-added") return 2;
    if (action === "pertinence-confirmed") return 5;
    return -2;
  }

  private static defaultReason(action: GlobalLearningSignal["action"]) {
    if (action === "study-retained") return "Une proposition a ete transformee en etude.";
    if (action === "observation-added") return "L'etude issue de l'evenement a produit une observation.";
    if (action === "pertinence-confirmed") return "La pertinence empirique a ete confirmee par l'activite de recherche.";
    return "La proposition a ete abandonnee.";
  }
}
