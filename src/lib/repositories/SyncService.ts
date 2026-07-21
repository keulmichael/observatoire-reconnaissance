import type { ObservatoryData } from "../types";
import type { ObservatoryRepository } from "./ObservatoryRepository";

type CacheRepository = {
  load(): ObservatoryData;
  save(data: ObservatoryData): void;
};

export type SyncStatus = "synced" | "syncing" | "offline" | "error" | "local-cache";

export type SyncSnapshot = {
  data: ObservatoryData;
  status: SyncStatus;
  error?: string;
  warning?: string;
};

export class SyncService {
  constructor(
    private readonly cache: CacheRepository,
    private readonly remote: ObservatoryRepository
  ) {}

  async load(ownerId: string | null): Promise<SyncSnapshot> {
    const cached = this.cache.load();
    if (!ownerId) return { data: cached, status: "local-cache" };
    try {
      const remote = await this.remote.load(ownerId, { limit: 100, offset: 0 });
      const warning = this.remote.getWarnings?.()[0];
      const data = warning ? preserveLocalCollectionsOnPartialFailure(remote, cached) : remote;
      this.cache.save(data);
      return { data, status: "synced", warning };
    } catch (error) {
      return { data: cached, status: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error", error: message(error) };
    }
  }

  async save(data: ObservatoryData, ownerId: string | null): Promise<SyncSnapshot> {
    const optimistic = { ...data, updatedAt: new Date().toISOString() };
    this.cache.save(optimistic);
    if (!ownerId) return { data: optimistic, status: "local-cache" };
    try {
      const saved = await this.syncCoreObservatory(optimistic, ownerId);
      this.cache.save(saved);
      const warning = await this.syncGlobalObservatory(saved, ownerId);
      return { data: saved, status: "synced", warning };
    } catch (error) {
      return { data: optimistic, status: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error", error: message(error) };
    }
  }

  async syncCoreObservatory(data: ObservatoryData, ownerId: string): Promise<ObservatoryData> {
    return this.remote.saveCoreObservatory
      ? this.remote.saveCoreObservatory(data, ownerId)
      : this.remote.save(data, ownerId);
  }

  async syncGlobalObservatory(data: ObservatoryData, ownerId: string): Promise<string | undefined> {
    if (!this.remote.saveGlobalObservatory) return undefined;
    try {
      await this.remote.saveGlobalObservatory(data, ownerId);
      return undefined;
    } catch (error) {
      return `Veille mondiale non synchronisee: ${message(error)}`;
    }
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Erreur de synchronisation";
}

function preserveLocalCollectionsOnPartialFailure(remote: ObservatoryData, cached: ObservatoryData): ObservatoryData {
  return {
    ...remote,
    globalObservatory: remote.globalObservatory ?? cached.globalObservatory
  };
}
