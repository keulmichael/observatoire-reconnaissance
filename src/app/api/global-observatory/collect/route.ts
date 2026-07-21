import { NextResponse } from "next/server";
import type { GlobalObservatoryState } from "@/lib/types";
import { RealNewsCollectionService } from "@/lib/global-observatory/server/RealNewsCollectionService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CollectBody = {
  state?: GlobalObservatoryState;
  sourceIds?: string[];
  maxItemsPerSource?: number;
};

const MIN_INTERVAL_MS = 30_000;
let lastManualCollectionAt = 0;

export async function POST(request: Request) {
  const startedAt = Date.now();
  if (Date.now() - lastManualCollectionAt < MIN_INTERVAL_MS) {
    return NextResponse.json({ error: "Collecte trop rapprochee. Reessayez dans quelques secondes." }, { status: 429 });
  }
  lastManualCollectionAt = Date.now();

  try {
    const body = (await request.json()) as CollectBody;
    const sourceIds = Array.isArray(body.sourceIds)
      ? body.sourceIds.filter((sourceId) => typeof sourceId === "string" && /^[a-z0-9-]{3,80}$/.test(sourceId)).slice(0, 12)
      : undefined;
    const service = new RealNewsCollectionService();
    const report = await service.collect({
      state: body.state,
      sourceIds,
      maxItemsPerSource: validLimit(body.maxItemsPerSource),
      timeoutMs: 8000,
      mode: "manual"
    });
    console.info("[global-observatory] collecte manuelle", {
      latency: Date.now() - startedAt,
      sources: report.sourcesRequested.length,
      articles: report.articlesFetched,
      events: report.events.length,
      errors: report.sourcesFailed.length
    });
    return NextResponse.json({ report, latency: Date.now() - startedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur de collecte";
    console.error("[global-observatory] erreur collecte manuelle", { latency: Date.now() - startedAt, error: message });
    return NextResponse.json({ error: message, latency: Date.now() - startedAt }, { status: 500 });
  }
}

function validLimit(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.min(20, Math.round(value))) : 8;
}
