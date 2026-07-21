import { NextResponse } from "next/server";
import { GlobalObservatory } from "@/lib/global-observatory";
import { RealNewsCollectionService } from "@/lib/global-observatory/server/RealNewsCollectionService";
import { isAuthorizedCronRequest } from "@/lib/global-observatory/server/cron-security";
import { SupabaseObservatoryRepository } from "@/lib/repositories/SupabaseObservatoryRepository";
import { createSupabaseServiceClient } from "@/lib/supabase/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const secret = process.env.GLOBAL_OBSERVATORY_CRON_SECRET;
  const ownerId = process.env.GLOBAL_OBSERVATORY_CRON_OWNER_ID;

  if (!isAuthorizedCronRequest(request, secret)) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }
  if (!ownerId) {
    return NextResponse.json({ error: "GLOBAL_OBSERVATORY_CRON_OWNER_ID manquant." }, { status: 500 });
  }

  try {
    const repository = new SupabaseObservatoryRepository(createSupabaseServiceClient());
    const data = await repository.load(ownerId);
    const service = new RealNewsCollectionService();
    const report = await service.collect({
      state: data.globalObservatory ?? GlobalObservatory.initialState(),
      maxItemsPerSource: 10,
      timeoutMs: 8000,
      mode: "cron"
    });
    const nextData = {
      ...data,
      globalObservatory: GlobalObservatory.refresh({
        ...(data.globalObservatory ?? GlobalObservatory.initialState()),
        events: report.events,
        collectionLogs: [report, ...((data.globalObservatory?.collectionLogs ?? []).filter((log) => log.id !== report.id))].slice(0, 50),
        lastCollectedAt: report.completedAt
      })
    };
    await repository.save(nextData, ownerId);
    console.info("[global-observatory-cron] collecte sauvegardee", {
      latency: Date.now() - startedAt,
      articles: report.articlesFetched,
      events: report.events.length,
      errors: report.sourcesFailed.length
    });
    return NextResponse.json({ report, latency: Date.now() - startedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur cron";
    console.error("[global-observatory-cron] erreur", { latency: Date.now() - startedAt, error: message });
    return NextResponse.json({ error: message, latency: Date.now() - startedAt }, { status: 500 });
  }
}
