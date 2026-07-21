import type { GlobalCollectionReport, GlobalObservatoryState } from "../../types";
import { GlobalObservatory } from "../GlobalObservatory";
import { SourceManager } from "../SourceManager";
import { stableId } from "../utils";
import { RssConnector } from "./RssConnector";

export interface RealNewsCollectionOptions {
  state?: GlobalObservatoryState;
  sourceIds?: string[];
  maxItemsPerSource?: number;
  timeoutMs?: number;
  mode?: "manual" | "cron" | "test";
  now?: string;
  fetchImpl?: typeof fetch;
}

export class RealNewsCollectionService {
  async collect(options: RealNewsCollectionOptions = {}): Promise<GlobalCollectionReport> {
    const now = options.now ?? new Date().toISOString();
    const state = options.state ?? SourceManager.createInitialState(now);
    const maxItemsPerSource = clamp(options.maxItemsPerSource ?? 8, 1, 20);
    const timeoutMs = clamp(options.timeoutMs ?? 8000, 1000, 12000);
    const selected = state.sources.filter((source) =>
      source.enabled
      && source.type === "rss"
      && (!options.sourceIds?.length || options.sourceIds.includes(source.id))
    );
    const connector = new RssConnector(options.fetchImpl);
    const results = await Promise.all(selected.map((source) =>
      connector.fetchSource(source, { timeoutMs, maxItems: maxItemsPerSource, now })
    ));
    const sources = results.flatMap((result) => result.articles);
    const failures = results
      .filter((result) => result.error)
      .map((result) => ({
        sourceId: result.source.id,
        sourceName: result.source.name,
        error: result.error ?? "Erreur inconnue"
      }));
    const nextState = GlobalObservatory.collect(state, sources, now);
    const collectionLog = nextState.collectionLogs[0] ?? {
      id: stableId("collection", now),
      startedAt: now,
      completedAt: now,
      sourcesRequested: selected.map((source) => source.id),
      sourcesSucceeded: [],
      sourcesFailed: failures,
      articlesFetched: sources.length,
      newEvents: 0,
      duplicateArticles: 0,
      mergedArticles: 0,
      ambiguousMerges: 0,
      mode: options.mode ?? "manual"
    };
    const log = {
      ...collectionLog,
      sourcesRequested: selected.map((source) => source.id),
      sourcesSucceeded: results.filter((result) => !result.error).map((result) => result.source.id),
      sourcesFailed: failures,
      articlesFetched: sources.length,
      mode: options.mode ?? "manual"
    };
    return {
      ...log,
      sources,
      events: nextState.events
    };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
