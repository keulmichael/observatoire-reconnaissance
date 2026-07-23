import { describe, expect, it } from "vitest";
import type { GlobalEventSource, GlobalObservatoryState, GlobalSourceConnector } from "../types";
import { DeterministicHistoricalConnector, GdeltHistoricalConnector, HistoricalImportEngine, type HistoricalConnector } from "./HistoricalImportEngine";
import { eventProvenanceStatus } from "./Provenance";
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

  it("normalise une reponse GDELT avec provenance, date, langue, pays et URL canonique", async () => {
    const source = SourceManager.defaultSources().find((item) => item.id === "source-gdelt")!;
    const connector = new GdeltHistoricalConnector({
      minDelayMs: 0,
      fetchImpl: async () => jsonResponse({
        articles: [{
          title: "Verified GDELT article",
          url: "https://example.com/news?utm_source=x",
          seendate: "20260101T061500Z",
          domain: "example.com",
          language: "English",
          sourcecountry: "United States"
        }]
      })
    });

    const page = await connector.fetchPage({ connector: source, date: "2026-01-01", limit: 10, now: "2026-01-08T00:00:00.000Z" });

    expect(page.articles).toHaveLength(1);
    expect(page.articles[0]).toMatchObject({
      title: "Verified GDELT article",
      url: "https://example.com/news",
      publishedAt: "2026-01-01T06:15:00.000Z",
      language: "English",
      country: "United States",
      collectionMode: "historical"
    });
    expect(page.articles[0].provenance?.kind).toBe("real");
  });

  it("reessaie apres un 429 GDELT avec backoff", async () => {
    const source = SourceManager.defaultSources().find((item) => item.id === "source-gdelt")!;
    const waits: number[] = [];
    let calls = 0;
    const connector = new GdeltHistoricalConnector({
      minDelayMs: 0,
      sleep: async (ms) => { waits.push(ms); },
      fetchImpl: async () => {
        calls += 1;
        return calls === 1
          ? new Response("rate limited", { status: 429, headers: { "retry-after": "2" } })
          : jsonResponse({ articles: [] });
      }
    });

    const page = await connector.fetchPage({ connector: source, date: "2026-01-01", limit: 10, now: "2026-01-08T00:00:00.000Z" });

    expect(page.error).toBeUndefined();
    expect(calls).toBe(2);
    expect(waits).toContain(2000);
    expect(page.logs?.some((entry) => entry.message.includes("429"))).toBe(true);
  });

  it("filtre strictement les articles GDELT hors jour demande", async () => {
    const source = SourceManager.defaultSources().find((item) => item.id === "source-gdelt")!;
    const connector = new GdeltHistoricalConnector({
      minDelayMs: 0,
      fetchImpl: async () => jsonResponse({
        articles: [
          { title: "In range", url: "https://example.com/in", seendate: "20260101T061500Z" },
          { title: "Out of range", url: "https://example.com/out", seendate: "20260102T001500Z" }
        ]
      })
    });

    const page = await connector.fetchPage({ connector: source, date: "2026-01-01", limit: 10, now: "2026-01-08T00:00:00.000Z" });

    expect(page.articles.map((article) => article.title)).toEqual(["In range"]);
    expect(page.logs?.[0].message).toContain("2 recu(s), 1 retenu(s)");
  });

  it("subdivise une fenetre GDELT saturee avant de la declarer complete", async () => {
    const source = SourceManager.defaultSources().find((item) => item.id === "source-gdelt")!;
    const requestedUrls: string[] = [];
    const connector = new GdeltHistoricalConnector({
      minDelayMs: 0,
      fetchImpl: async (url) => {
        requestedUrls.push(String(url));
        return jsonResponse({
          articles: Array.from({ length: 250 }, (_, index) => ({
            title: `Saturated ${index}`,
            url: `https://example.com/saturated-${index}`,
            seendate: "20260101T001500Z"
          }))
        });
      }
    });

    const page = await connector.fetchPage({ connector: source, date: "2026-01-01", limit: 10, now: "2026-01-08T00:00:00.000Z" });

    expect(requestedUrls[0]).toContain("maxrecords=250");
    expect(page.articles).toHaveLength(0);
    expect(page.nextCursor).toContain("\"levelMinutes\":180");
    expect(page.coverage?.completeCoverage).toBe(false);
    expect(page.coverage?.subdividedWindows).toBe(1);
    expect(page.coverage?.windows?.[0].status).toBe("subdivided");
  });

  it("marque une sous-fenetre GDELT de 15 minutes encore saturee comme tronquee", async () => {
    const source = SourceManager.defaultSources().find((item) => item.id === "source-gdelt")!;
    const cursor = JSON.stringify({
      version: 1,
      pending: [{ start: "2026-01-01T00:00:00.000Z", end: "2026-01-01T00:15:00.000Z", levelMinutes: 15 }],
      completed: [],
      truncated: [],
      subdivided: 0,
      advanceCursor: "2026-01-01T06:00:00.000Z"
    });
    const connector = new GdeltHistoricalConnector({
      minDelayMs: 0,
      fetchImpl: async () => jsonResponse({
        articles: Array.from({ length: 250 }, (_, index) => ({
          title: `Leaf saturated ${index}`,
          url: `https://example.com/leaf-${index}`,
          seendate: "20260101T000500Z"
        }))
      })
    });

    const page = await connector.fetchPage({ connector: source, date: "2026-01-01", cursor, limit: 10, now: "2026-01-08T00:00:00.000Z" });

    expect(page.articles).toHaveLength(250);
    expect(page.coverage?.completeCoverage).toBe(false);
    expect(page.coverage?.truncatedWindows).toHaveLength(1);
    expect(page.coverage?.windows?.[0].status).toBe("truncated");
  });

  it("distingue donnees historiques reelles et simulees", async () => {
    const sources = SourceManager.defaultSources();
    const simulated = await new DeterministicHistoricalConnector().fetchPage({
      connector: sources[0],
      date: "2026-01-01",
      limit: 3,
      now: "2026-01-08T00:00:00.000Z"
    });
    const gdelt = new GdeltHistoricalConnector({
      minDelayMs: 0,
      fetchImpl: async () => jsonResponse({ articles: [{ title: "GDELT", url: "https://example.com/g", seendate: "20260101T061500Z" }] })
    });
    const real = await gdelt.fetchPage({
      connector: sources.find((item) => item.id === "source-gdelt")!,
      date: "2026-01-01",
      limit: 3,
      now: "2026-01-08T00:00:00.000Z"
    });

    expect(eventProvenanceStatus(eventFromSource(real.articles[0]))).toBe("real");
    expect(eventProvenanceStatus(eventFromSource(simulated.articles[0]))).toBe("simulated");
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

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function eventFromSource(source: GlobalEventSource) {
  return {
    id: `event-${source.id}`,
    title: source.title,
    normalizedTitle: source.title.toLowerCase(),
    summary: source.summary,
    country: source.country,
    startedAt: source.publishedAt.slice(0, 10),
    updatedAt: source.collectedAt,
    status: "active" as const,
    categories: source.categories ?? [],
    themes: [],
    sourceIds: [source.id],
    sources: [source],
    mergeCandidates: [],
    learningWeight: 0,
    createdStudyIds: []
  };
}
