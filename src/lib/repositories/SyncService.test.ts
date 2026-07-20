import { describe, expect, it, vi } from "vitest";
import { SyncService } from "./SyncService";
import type { ObservatoryRepository } from "./ObservatoryRepository";
import type { ObservatoryData } from "../types";

describe("SyncService", () => {
  it("conserve le cache local si aucun utilisateur n'est connecte", async () => {
    const cache = cacheRepo({ version: 1, studies: [] });
    const remote = remoteRepo();
    const service = new SyncService(cache, remote);
    const snapshot = await service.save({ version: 1, studies: [] }, null);
    expect(snapshot.status).toBe("local-cache");
    expect(remote.save).not.toHaveBeenCalled();
  });

  it("reprend sur cache local quand la persistance distante echoue", async () => {
    const cache = cacheRepo({ version: 1, studies: [] });
    const remote = remoteRepo();
    vi.mocked(remote.save).mockRejectedValueOnce(new Error("RLS denied"));
    const service = new SyncService(cache, remote);
    const snapshot = await service.save({ version: 1, studies: [] }, "user-1");
    expect(snapshot.status).toBe("error");
    expect(snapshot.error).toContain("RLS denied");
    expect(cache.load().studies).toEqual([]);
  });
});

function cacheRepo(initial: ObservatoryData) {
  let value = initial;
  return {
    load: () => value,
    save: (data: ObservatoryData) => {
      value = data;
    }
  };
}

function remoteRepo(): ObservatoryRepository {
  return {
    load: vi.fn(async () => ({ version: 1 as const, studies: [] })),
    save: vi.fn(async (data: ObservatoryData) => data)
  };
}
