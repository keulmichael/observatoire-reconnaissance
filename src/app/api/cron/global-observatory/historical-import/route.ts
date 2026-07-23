import { NextResponse } from "next/server";
import type { HistoricalImportRequest } from "@/lib/types";
import { HistoricalImportJobService } from "@/lib/global-observatory/server/HistoricalImportJobService";
import { isAuthorizedCronRequest } from "@/lib/global-observatory/server/cron-security";
import { createSupabaseServiceClient } from "@/lib/supabase/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HistoricalImportJobBody = {
  ownerId?: string;
  request?: HistoricalImportRequest;
  sessionId?: string;
  command?: "process-next" | "pause";
  maxBatches?: number;
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  const secret = process.env.GLOBAL_OBSERVATORY_CRON_SECRET;
  if (!isAuthorizedCronRequest(request, secret)) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as HistoricalImportJobBody;
    const ownerId = sanitizeOwnerId(process.env.GLOBAL_OBSERVATORY_CRON_OWNER_ID ?? body.ownerId);
    if (!ownerId) return NextResponse.json({ error: "ownerId manquant ou invalide." }, { status: 400 });
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Configuration Supabase serveur incomplete: SUPABASE_SERVICE_ROLE_KEY requis." }, { status: 500 });
    }

    const service = new HistoricalImportJobService(createSupabaseServiceClient());
    if (body.command === "pause") {
      if (!body.sessionId) return NextResponse.json({ error: "sessionId manquant." }, { status: 400 });
      const session = await service.pause(ownerId, body.sessionId);
      return NextResponse.json({ session, latency: Date.now() - startedAt });
    }

    const result = await service.processNext({
      ownerId,
      request: sanitizeRequest(body.request),
      sessionId: sanitizeSessionId(body.sessionId),
      maxBatches: validBatchCount(body.maxBatches)
    });
    console.info("[historical-import-job] lot traite", {
      sessionId: result.session.id,
      status: result.session.status,
      articles: result.articlesFetched,
      events: result.eventsCreated,
      merged: result.mergedArticles,
      duplicates: result.duplicateArticles,
      latency: Date.now() - startedAt
    });
    return NextResponse.json({ ...result, latency: Date.now() - startedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur job historique";
    console.error("[historical-import-job] erreur", { error: message, latency: Date.now() - startedAt });
    return NextResponse.json({ error: message, latency: Date.now() - startedAt }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}

function sanitizeOwnerId(value: unknown) {
  return typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value) ? value : undefined;
}

function sanitizeSessionId(value: unknown) {
  return typeof value === "string" && /^[a-z0-9:-]{3,160}$/i.test(value) ? value : undefined;
}

function sanitizeRequest(request?: HistoricalImportRequest): HistoricalImportRequest | undefined {
  if (!request) return undefined;
  return {
    range: {
      granularity: request.range.granularity,
      startDate: request.range.startDate.slice(0, 10),
      endDate: request.range.endDate.slice(0, 10)
    },
    sourceIds: request.sourceIds.filter((sourceId) => /^[a-z0-9-]{3,100}$/i.test(sourceId)).slice(0, 8),
    batchSize: Math.max(1, Math.min(50, Math.round(request.batchSize || 10))),
    maxArticles: request.maxArticles ? Math.max(1, Math.min(500_000, Math.round(request.maxArticles))) : undefined
  };
}

function validBatchCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.min(3, Math.round(value))) : 1;
}
