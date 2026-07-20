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
      this.cache.save(remote);
      return { data: remote, status: "synced" };
    } catch (error) {
      return { data: cached, status: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error", error: message(error) };
    }
  }

  async save(data: ObservatoryData, ownerId: string | null): Promise<SyncSnapshot> {
    const optimistic = { ...data, updatedAt: new Date().toISOString() };
    this.cache.save(optimistic);
    if (!ownerId) return { data: optimistic, status: "local-cache" };
    try {
      const saved = await this.remote.save(optimistic, ownerId);
      this.cache.save(saved);
      return { data: saved, status: "synced" };
    } catch (error) {
      return { data: optimistic, status: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error", error: message(error) };
    }
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Erreur de synchronisation";
}
