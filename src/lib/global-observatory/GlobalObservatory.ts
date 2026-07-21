import type { GlobalObservedEvent, GlobalObservatoryState, GlobalSourceConnector, GlobalEventSource } from "../types";
import { Dashboard } from "./Dashboard";
import { InterestScorer } from "./InterestScorer";
import { LearningEngine } from "./LearningEngine";
import { MapEngine } from "./MapEngine";
import { NewsCollector } from "./NewsCollector";
import { ReflexiveAnalyzer } from "./ReflexiveAnalyzer";
import { SourceManager } from "./SourceManager";
import { StudySuggestionEngine } from "./StudySuggestionEngine";

export class GlobalObservatory {
  static initialState(now?: string) {
    return this.refresh(SourceManager.createInitialState(now));
  }

  static refresh(state: GlobalObservatoryState): GlobalObservatoryState {
    const events = state.events.map((event) => {
      const analyzed = event.analysis ? event : this.analyzeEvent(event);
      return { ...analyzed, interest: InterestScorer.score(analyzed) };
    });
    return {
      ...state,
      events,
      mapPoints: MapEngine.build(events),
      dashboard: Dashboard.build(events)
    };
  }

  static collect(state: GlobalObservatoryState, sources?: GlobalEventSource[], now?: string): GlobalObservatoryState {
    return this.refresh(NewsCollector.collect(state, { sources, now }));
  }

  static analyzeEvent(event: GlobalObservedEvent, now?: string): GlobalObservedEvent {
    const analysis = ReflexiveAnalyzer.analyze(event, now);
    const analyzed = {
      ...event,
      analysis,
      studySuggestion: StudySuggestionEngine.suggest({ ...event, analysis }, now),
      updatedAt: now ?? new Date().toISOString()
    };
    return { ...analyzed, interest: InterestScorer.score(analyzed) };
  }

  static analyzeEventById(state: GlobalObservatoryState, eventId: string, now?: string): GlobalObservatoryState {
    return this.refresh({
      ...state,
      events: state.events.map((event) => (event.id === eventId ? this.analyzeEvent(event, now) : event)),
      lastAnalyzedAt: now ?? new Date().toISOString()
    });
  }

  static upsertSource(state: GlobalObservatoryState, source: GlobalSourceConnector): GlobalObservatoryState {
    return this.refresh(SourceManager.upsertSource(state, source));
  }

  static setSourceEnabled(state: GlobalObservatoryState, sourceId: string, enabled: boolean): GlobalObservatoryState {
    return this.refresh(SourceManager.setEnabled(state, sourceId, enabled));
  }

  static recordLearning(
    state: GlobalObservatoryState,
    eventId: string,
    action: Parameters<typeof LearningEngine.record>[2],
    options?: Parameters<typeof LearningEngine.record>[3]
  ) {
    return this.refresh(LearningEngine.record(state, eventId, action, options));
  }
}
