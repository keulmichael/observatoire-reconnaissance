import { describe, expect, it } from "vitest";
import type { GlobalEventSource, GlobalObservatoryState, GlobalSourceConnector } from "../types";
import { HistoricalImportEngine, type HistoricalConnector } from "./HistoricalImportEngine";
import { SourceManager } from "./SourceManager";
import { stableId } from "./utils";

describe("HistoricalImportEngine", () => {
  it("planifie un import annuel et progresse par batch sans perdre la session", async () => {
    const state = SourceManager.createInitialState("2026-01-01T00:00:00.000Z");
    const sourceIds = state.sources.slice(0, 2).map((source) => source.id);

    const first = await HistoricalImportEngine.runNextBatch(state, {
      request: {
        range: { granularity: "year", startDate: "2026-01-01", endDate: "2026-12-31" },
        sourceIds,
        batchSize: 6,
        maxArticles: 24
      },
      now: "2026-01-01T00:00:00.000Z"
    });

    expect(first.session.status).toBe("running");
    expect(first.session.progress.totalDays).toBe(365);
    expect(first.session.progress.articlesFetched).toBeGreaterThan(0);
    expect(first.state.historicalImports?.[0].id).toBe(first.session.id);

    const second = await HistoricalImportEngine.runNextBatch(first.state, {
      sessionId: first.session.id,
      now: "2026-01-01T00:01:00.000Z"
    });

    expect(second.session.id).toBe(first.session.id);
    expect(second.session.progress.articlesFetched).toBeGreaterThan(first.session.progress.articlesFetched);
    expect(second.session.logs.length).toBeGreaterThan(first.session.logs.length);
  });

  it("permet pause puis reprise", async () => {
    const state = SourceManager.createInitialState("2026-01-01T00:00:00.000Z");
    const started = await HistoricalImportEngine.runNextBatch(state, {
      request: {
        range: { granularity: "week", startDate: "2026-02-01", endDate: "2026-02-07" },
        sourceIds: state.sources.slice(0, 1).map((source) => source.id),
        batchSize: 3
      }
    });
    const paused = HistoricalImportEngine.pause(started.state, started.session.id, "2026-02-01T00:02:00.000Z");
    expect(paused.historicalImports?.[0].status).toBe("paused");

    const resumed = await HistoricalImportEngine.runNextBatch(paused, {
      sessionId: started.session.id,
      now: "2026-02-01T00:03:00.000Z"
    });

    expect(resumed.session.status).toBe("running");
    expect(resumed.session.progress.processedSources).toBeGreaterThan(started.session.progress.processedSources);
  });

  it("fusionne plusieurs articles parlant du meme evenement en conservant les sources", async () => {
    const source = SourceManager.defaultSources()[0];
    const state = { ...SourceManager.createInitialState(), sources: [source] };
    const registry = duplicateConnector(source);

    const first = await HistoricalImportEngine.runNextBatch(state, {
      request: {
        range: { granularity: "day", startDate: "2026-03-10", endDate: "2026-03-10" },
        sourceIds: [source.id],
        batchSize: 3
      },
      registry
    });

    expect(first.state.events).toHaveLength(1);
    expect(first.state.events[0].sources).toHaveLength(2);
    expect(first.state.events[0].sources.flatMap((item) => item.excerpts)).toHaveLength(2);
  });

  it("traite une volumetrie de plusieurs centaines d'articles par reprises successives", async () => {
    let state: GlobalObservatoryState = SourceManager.createInitialState("2026-01-01T00:00:00.000Z");
    const sourceIds = state.sources.slice(0, 4).map((source) => source.id);
    let sessionId: string | undefined;

    for (let index = 0; index < 20; index += 1) {
      const result = await HistoricalImportEngine.runNextBatch(state, {
        request: sessionId ? undefined : {
          range: { granularity: "month", startDate: "2026-04-01", endDate: "2026-04-30" },
          sourceIds,
          batchSize: 24,
          maxArticles: 300
        },
        sessionId
      });
      state = result.state;
      sessionId = result.session.id;
      if (result.session.status === "completed") break;
    }

    const session = state.historicalImports?.[0];
    expect(session?.progress.articlesFetched).toBeGreaterThanOrEqual(300);
    expect(session?.status).toBe("completed");
    expect(session?.progress.errors).toBe(0);
    expect(state.events.length).toBeGreaterThan(0);
    expect(session?.progress.mergedArticles).toBeGreaterThan(0);
  });
});

function duplicateConnector(source: GlobalSourceConnector): Record<string, HistoricalConnector> {
  const article = (id: string, title: string, excerpt: string): GlobalEventSource => ({
    id,
    externalId: id,
    connectorId: source.id,
    connectorName: source.name,
    title,
    url: `https://example.test/${id}`,
    publishedAt: "2026-03-10T12:00:00.000Z",
    country: "France",
    language: "fr",
    summary: "Plusieurs sources documentent la meme crise institutionnelle majeure.",
    categories: ["Politique"],
    authors: [],
    excerpts: [{
      id: stableId("excerpt", excerpt),
      text: excerpt,
      location: "test",
      claimIds: []
    }],
    collectedAt: "2026-03-10T13:00:00.000Z"
  });
  return {
    mock: {
      id: "mock",
      async fetchPage() {
        return {
          articles: [
            article("article-a", "Crise institutionnelle majeure documentee", "La source A documente la crise."),
            article("article-b", "Crise institutionnelle majeure confirmee", "La source B confirme la crise.")
          ]
        };
      }
    }
  };
}
