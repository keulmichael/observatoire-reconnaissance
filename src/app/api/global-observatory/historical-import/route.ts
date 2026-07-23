import { NextResponse } from "next/server";
import type { GlobalObservatoryState, HistoricalImportRequest } from "@/lib/types";
import { HistoricalImportEngine } from "@/lib/global-observatory/HistoricalImportEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HistoricalImportBody = {
  state?: GlobalObservatoryState;
  request?: HistoricalImportRequest;
  sessionId?: string;
  command?: "run" | "pause";
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const body = (await request.json()) as HistoricalImportBody;
    const state = body.state ?? emptyState();
    if (body.command === "pause" && body.sessionId) {
      const paused = HistoricalImportEngine.pause(state, body.sessionId);
      const session = paused.historicalImports?.find((item) => item.id === body.sessionId);
      return NextResponse.json({ state: paused, session, latency: Date.now() - startedAt });
    }
    const result = await HistoricalImportEngine.runNextBatch(state, {
      request: sanitizeRequest(body.request),
      sessionId: sanitizeSessionId(body.sessionId)
    });
    return NextResponse.json({ ...result, latency: Date.now() - startedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import historique impossible";
    return NextResponse.json({ error: message, latency: Date.now() - startedAt }, { status: 500 });
  }
}

function sanitizeSessionId(value: unknown) {
  return typeof value === "string" && /^[a-z0-9:-]{3,120}$/i.test(value) ? value : undefined;
}

function sanitizeRequest(request?: HistoricalImportRequest): HistoricalImportRequest | undefined {
  if (!request) return undefined;
  return {
    range: {
      granularity: request.range.granularity,
      startDate: request.range.startDate.slice(0, 10),
      endDate: request.range.endDate.slice(0, 10)
    },
    sourceIds: request.sourceIds.filter((sourceId) => /^[a-z0-9-]{3,100}$/i.test(sourceId)).slice(0, 40),
    batchSize: Math.max(1, Math.min(50, Math.round(request.batchSize || 10))),
    maxArticles: request.maxArticles ? Math.max(1, Math.min(500_000, Math.round(request.maxArticles))) : undefined
  };
}

function emptyState(): GlobalObservatoryState {
  return {
    sources: [],
    events: [],
    learningSignals: [],
    mapPoints: [],
    dashboard: {
      analyzedEvents: 0,
      activeEvents: 0,
      createdStudies: 0,
      frequentCategories: [],
      representedCountries: [],
      emergingThemes: [],
      studiedPhenomena: [],
      topStudyEvents: [],
      trends: []
    },
    collectionLogs: [],
    historicalImports: []
  };
}
