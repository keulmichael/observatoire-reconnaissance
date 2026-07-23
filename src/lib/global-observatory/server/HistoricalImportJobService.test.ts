import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GlobalEventSource, HistoricalImportSession, ObservatoryData } from "@/lib/types";
import { HistoricalImportEngine, type HistoricalConnector } from "../HistoricalImportEngine";
import { SourceManager } from "../SourceManager";
import { stableId } from "../utils";
import { HistoricalImportJobService } from "./HistoricalImportJobService";

describe("HistoricalImportJobService", () => {
  it("verrouille, traite un lot, persiste et libere la session", async () => {
    const ownerId = "00000000-0000-0000-0000-000000000001";
    const source = SourceManager.defaultSources().find((item) => item.id === "source-gdelt")!;
    const session = HistoricalImportEngine.createSession({
      range: { granularity: "day", startDate: "2026-01-01", endDate: "2026-01-01" },
      sourceIds: [source.id],
      batchSize: 10,
      maxArticles: 10
    }, "2026-01-08T00:00:00.000Z");
    const rows = [sessionRow(ownerId, session)];
    const repository = repositoryStub(ownerId, session);
    const service = new HistoricalImportJobService(fakeClient(rows), repository as never);

    const result = await service.processNext({
      ownerId,
      sessionId: session.id,
      now: "2026-01-08T00:00:00.000Z",
      workerId: "worker-a",
      registry: { "source-gdelt": oneArticleConnector(source) }
    });

    expect(result.articlesFetched).toBe(1);
    expect(result.session.status).toBe("completed");
    expect(repository.saved).toHaveLength(1);
    expect(rows[0].locked_by).toBeNull();
    expect(rows[0].last_error).toBeNull();
  });

  it("persiste une nouvelle session avant le premier appel connecteur", async () => {
    const ownerId = "00000000-0000-0000-0000-000000000001";
    const source = SourceManager.defaultSources().find((item) => item.id === "source-gdelt")!;
    const rows: Array<ReturnType<typeof sessionRow>> = [];
    const repository = repositoryStub(ownerId, undefined, (saved) => {
      for (const session of saved.globalObservatory?.historicalImports ?? []) {
        const row = rows.find((item) => item.id === `${ownerId}:${session.id}`);
        if (row) {
          row.status = session.status;
          row.data = session;
        } else {
          rows.push(sessionRow(ownerId, session));
        }
      }
    });
    let savedBeforeFetch = false;
    const service = new HistoricalImportJobService(fakeClient(rows), repository as never);

    const result = await service.processNext({
      ownerId,
      now: "2026-01-08T00:00:00.000Z",
      workerId: "worker-a",
      request: {
        range: { granularity: "day", startDate: "2026-01-01", endDate: "2026-01-01" },
        sourceIds: [source.id],
        batchSize: 10
      },
      registry: {
        [source.id]: {
          id: source.id,
          async fetchPage() {
            savedBeforeFetch = repository.saved.some((saved) => saved.globalObservatory?.historicalImports?.length);
            return oneArticleConnector(source).fetchPage({
              connector: source,
              date: "2026-01-01",
              limit: 10,
              now: "2026-01-08T00:00:00.000Z"
            });
          }
        }
      }
    });

    expect(savedBeforeFetch).toBe(true);
    expect(rows[0].data.status).toBe("completed");
    expect(result.articlesFetched).toBe(1);
  });

  it("refuse de traiter une session deja verrouillee par un worker concurrent", async () => {
    const ownerId = "00000000-0000-0000-0000-000000000001";
    const source = SourceManager.defaultSources().find((item) => item.id === "source-gdelt")!;
    const session = HistoricalImportEngine.createSession({
      range: { granularity: "day", startDate: "2026-01-01", endDate: "2026-01-01" },
      sourceIds: [source.id],
      batchSize: 10
    }, "2026-01-08T00:00:00.000Z");
    const rows = [{ ...sessionRow(ownerId, session), locked_at: "2026-01-08T00:00:00.000Z", locked_by: "worker-other" }];
    const service = new HistoricalImportJobService(fakeClient(rows), repositoryStub(ownerId, session) as never);

    await expect(service.processNext({ ownerId, sessionId: session.id, now: "2026-01-08T00:00:30.000Z" })).rejects.toThrow("Aucune session historique");
  });

  it("reste idempotent quand une session terminee est relancee", async () => {
    const ownerId = "00000000-0000-0000-0000-000000000001";
    const source = SourceManager.defaultSources().find((item) => item.id === "source-gdelt")!;
    const session = {
      ...HistoricalImportEngine.createSession({
        range: { granularity: "day", startDate: "2026-01-01", endDate: "2026-01-01" },
        sourceIds: [source.id],
        batchSize: 10
      }, "2026-01-08T00:00:00.000Z"),
      status: "completed" as const,
      progress: {
        ...HistoricalImportEngine.createSession({
          range: { granularity: "day", startDate: "2026-01-01", endDate: "2026-01-01" },
          sourceIds: [source.id],
          batchSize: 10
        }, "2026-01-08T00:00:00.000Z").progress,
        articlesFetched: 1,
        percent: 100
      }
    };
    const rows = [sessionRow(ownerId, session)];
    const repository = repositoryStub(ownerId, session);
    const service = new HistoricalImportJobService(fakeClient(rows), repository as never);

    const result = await service.processNext({ ownerId, sessionId: session.id, now: "2026-01-08T00:01:00.000Z" });

    expect(result.session.status).toBe("completed");
    expect(result.articlesFetched).toBe(0);
  });
});

function sessionRow(ownerId: string, session: HistoricalImportSession) {
  return {
    id: `${ownerId}:${session.id}`,
    owner_id: ownerId,
    status: session.status,
    locked_at: null as string | null,
    locked_by: null as string | null,
    attempts: 0,
    last_error: null as string | null,
    data: session
  };
}

function repositoryStub(ownerId: string, session?: HistoricalImportSession, onSave?: (data: ObservatoryData) => void) {
  const source = SourceManager.defaultSources().find((item) => item.id === "source-gdelt")!;
  return {
    saved: [] as ObservatoryData[],
    current: {
      version: 1,
      ownerId,
      studies: [],
      globalObservatory: {
        ...SourceManager.createInitialState("2026-01-08T00:00:00.000Z"),
        sources: [source],
        historicalImports: session ? [session] : []
      }
    } satisfies ObservatoryData as ObservatoryData,
    async load() {
      return this.current;
    },
    async saveGlobalObservatory(data: ObservatoryData) {
      this.saved.push(data);
      this.current = data;
      onSave?.(data);
    }
  };
}

function oneArticleConnector(source: ReturnType<typeof SourceManager.defaultSources>[number]): HistoricalConnector {
  return {
    id: source.id,
    async fetchPage(input) {
      return {
        articles: [{
          id: stableId("article", "gdelt-test"),
          externalId: "gdelt-test",
          connectorId: source.id,
          connectorName: source.name,
          title: "GDELT persisted article",
          url: "https://example.com/gdelt",
          publishedAt: `${input.date}T06:00:00.000Z`,
          country: "United States",
          language: "English",
          summary: "Real GDELT article",
          authors: [],
          excerpts: [{ id: "excerpt-1", text: "Real GDELT article", location: "gdelt:doc-artlist", claimIds: [] }],
          collectedAt: input.now,
          collectionMode: "historical",
          provenance: { kind: "real", connector: source.id }
        } satisfies GlobalEventSource]
      };
    }
  };
}

function fakeClient(rows: Array<ReturnType<typeof sessionRow>>): SupabaseClient {
  return {
    from() {
      return new Query(rows);
    }
  } as unknown as SupabaseClient;
}

class Query {
  private filters: Array<{ key: string; value: unknown }> = [];
  private patch: Record<string, unknown> | null = null;
  private wantsMaybeSingle = false;
  private limitCount: number | null = null;
  private lockFilter = false;

  constructor(private readonly rows: Array<ReturnType<typeof sessionRow>>) {}

  select() { return this; }
  order() { return this; }
  in() { return this; }
  limit(value: number) { this.limitCount = value; return this; }
  or(value: string) { this.lockFilter = value.includes("locked_at"); return this; }
  eq(key: string, value: unknown) { this.filters.push({ key, value }); return this; }
  update(patch: Record<string, unknown>) { this.patch = patch; return this; }
  maybeSingle() { this.wantsMaybeSingle = true; return Promise.resolve(this.executeSingle()); }
  then(resolve: (value: unknown) => void, reject: (reason?: unknown) => void) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }

  private execute() {
    let selected = this.matchingRows();
    if (this.patch) {
      selected.forEach((row) => Object.assign(row, this.patch));
    }
    if (this.limitCount != null) selected = selected.slice(0, this.limitCount);
    return { data: selected, error: null };
  }

  private executeSingle() {
    const result = this.execute();
    return { data: this.wantsMaybeSingle ? result.data[0] ?? null : result.data, error: null };
  }

  private matchingRows() {
    return this.rows.filter((row) => {
      const matchesFilters = this.filters.every((filter) => (row as unknown as Record<string, unknown>)[filter.key] === filter.value);
      const matchesLock = !this.lockFilter || !row.locked_at || new Date(row.locked_at) < new Date("2026-01-08T00:00:00.000Z");
      return matchesFilters && matchesLock;
    });
  }
}
