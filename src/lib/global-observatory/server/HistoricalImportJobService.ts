import type { SupabaseClient } from "@supabase/supabase-js";
import type { HistoricalImportRequest, HistoricalImportSession, ObservatoryData } from "../../types";
import { GlobalObservatory } from "../GlobalObservatory";
import { HistoricalImportEngine, type HistoricalConnectorRegistry } from "../HistoricalImportEngine";
import { SupabaseObservatoryRepository } from "../../repositories/SupabaseObservatoryRepository";

type SessionRow = {
  id: string;
  owner_id: string;
  status: HistoricalImportSession["status"];
  locked_at?: string | null;
  locked_by?: string | null;
  attempts?: number | null;
  data: HistoricalImportSession;
};

export type HistoricalImportJobInput = {
  ownerId: string;
  request?: HistoricalImportRequest;
  sessionId?: string;
  maxBatches?: number;
  now?: string;
  workerId?: string;
  registry?: HistoricalConnectorRegistry;
};

export type HistoricalImportJobResult = {
  session: HistoricalImportSession;
  batchesProcessed: number;
  locked: boolean;
  articlesFetched: number;
  eventsCreated: number;
  mergedArticles: number;
  duplicateArticles: number;
};

export class HistoricalImportJobService {
  private readonly repository: SupabaseObservatoryRepository;

  constructor(private readonly client: SupabaseClient, repository?: SupabaseObservatoryRepository) {
    this.repository = repository ?? new SupabaseObservatoryRepository(client);
  }

  async processNext(input: HistoricalImportJobInput): Promise<HistoricalImportJobResult> {
    const maxBatches = Math.max(1, Math.min(3, input.maxBatches ?? 1));
    const now = input.now ?? new Date().toISOString();
    const workerId = input.workerId ?? `worker-${crypto.randomUUID()}`;
    let locked = input.sessionId
      ? await this.lockSessionByDataId(input.ownerId, input.sessionId, workerId, now)
      : await this.lockNextSession(input.ownerId, workerId, now);

    if (!locked && !input.request) {
      throw new Error("Aucune session historique disponible ou verrouillable.");
    }

    try {
      let data = await this.repository.load(input.ownerId, { limit: 100, offset: 0 });
      let global = data.globalObservatory ?? GlobalObservatory.initialState(now);
      if (!locked && input.request) {
        const plannedSession = HistoricalImportEngine.createSession(input.request, now);
        global = GlobalObservatory.refresh({
          ...global,
          historicalImports: [plannedSession, ...(global.historicalImports ?? []).filter((session) => session.id !== plannedSession.id)]
        });
        data = { ...data, globalObservatory: global };
        await this.repository.saveGlobalObservatory(data as ObservatoryData, input.ownerId);
        locked = await this.lockSessionByDataId(input.ownerId, plannedSession.id, workerId, now);
        if (!locked) throw new Error("Session historique creee mais non verrouillable.");
      }
      let session: HistoricalImportSession | undefined = locked?.data;
      let previous = session?.progress;
      let batchesProcessed = 0;

      for (let index = 0; index < maxBatches; index += 1) {
        const result = await HistoricalImportEngine.runNextBatch(global, {
          request: undefined,
          sessionId: session?.id,
          registry: input.registry,
          now
        });
        global = result.state;
        session = result.session;
        batchesProcessed += 1;
        data = { ...data, globalObservatory: GlobalObservatory.refresh(global) };
        await this.repository.saveGlobalObservatory(data as ObservatoryData, input.ownerId);
        if (session.status === "completed") break;
      }
      if (!session) throw new Error("Aucune session historique traitee.");

      await this.releaseSession(ownerScopedId(input.ownerId, session.id), workerId, null);

      previous = previous ?? {
        articlesFetched: 0,
        eventsCreated: 0,
        mergedArticles: 0,
        duplicateArticles: 0
      } as HistoricalImportSession["progress"];
      return {
        session,
        batchesProcessed,
        locked: Boolean(locked),
        articlesFetched: session.progress.articlesFetched - previous.articlesFetched,
        eventsCreated: session.progress.eventsCreated - previous.eventsCreated,
        mergedArticles: session.progress.mergedArticles - previous.mergedArticles,
        duplicateArticles: session.progress.duplicateArticles - previous.duplicateArticles
      };
    } catch (error) {
      if (locked) await this.releaseSession(locked.id, workerId, error instanceof Error ? error.message : "Erreur job historique");
      throw error;
    }
  }

  async pause(ownerId: string, sessionId: string, now = new Date().toISOString()) {
    const data = await this.repository.load(ownerId, { limit: 100, offset: 0 });
    const global = data.globalObservatory ?? GlobalObservatory.initialState(now);
    const paused = HistoricalImportEngine.pause(global, sessionId, now);
    await this.repository.saveGlobalObservatory({ ...data, globalObservatory: paused }, ownerId);
    const session = paused.historicalImports?.find((item) => item.id === sessionId);
    if (!session) throw new Error("Session historique introuvable.");
    return session;
  }

  private async lockNextSession(ownerId: string, workerId: string, now: string) {
    const expiredBefore = new Date(new Date(now).getTime() - 120_000).toISOString();
    const result = await this.client
      .from("historical_import_sessions")
      .select("id,owner_id,status,locked_at,locked_by,attempts,data")
      .eq("owner_id", ownerId)
      .in("status", ["planned", "running"])
      .or(`locked_at.is.null,locked_at.lt.${expiredBefore}`)
      .order("updated_at", { ascending: true })
      .limit(1);
    throwIfError(result.error, "selection session historique");
    const row = ((result.data ?? []) as SessionRow[])[0];
    return row ? this.lockRow(row, workerId, now) : null;
  }

  private async lockSessionByDataId(ownerId: string, sessionId: string, workerId: string, now: string) {
    const rowId = ownerScopedId(ownerId, sessionId);
    const result = await this.client
      .from("historical_import_sessions")
      .select("id,owner_id,status,locked_at,locked_by,attempts,data")
      .eq("id", rowId)
      .maybeSingle();
    throwIfError(result.error, "lecture session historique");
    const row = result.data as SessionRow | null;
    if (!row) return null;
    return this.lockRow(row, workerId, now);
  }

  private async lockRow(row: SessionRow, workerId: string, now: string) {
    const expiredBefore = new Date(new Date(now).getTime() - 120_000).toISOString();
    const result = await this.client
      .from("historical_import_sessions")
      .update({ locked_at: now, locked_by: workerId, attempts: (row.attempts ?? 0) + 1, last_error: null })
      .eq("id", row.id)
      .or(`locked_at.is.null,locked_at.lt.${expiredBefore}`)
      .select("id,owner_id,status,locked_at,locked_by,attempts,data")
      .maybeSingle();
    throwIfError(result.error, "verrou session historique");
    return result.data as SessionRow | null;
  }

  private async releaseSession(rowId: string, workerId: string, error: string | null) {
    const result = await this.client
      .from("historical_import_sessions")
      .update({ locked_at: null, locked_by: null, last_error: error })
      .eq("id", rowId)
      .eq("locked_by", workerId);
    throwIfError(result.error, "liberation verrou historique");
  }
}

function ownerScopedId(ownerId: string, id: string) {
  return `${ownerId}:${id}`;
}

function throwIfError(error: unknown, domain: string) {
  if (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`${domain}: ${message}`);
  }
}
