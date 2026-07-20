import { migrateObservatoryData } from "../data-migration";
import type { ObservatoryData } from "../types";

export class LocalCacheRepository {
  constructor(
    private readonly storageKey: string,
    private readonly fallbackData: ObservatoryData
  ) {}

  load(): ObservatoryData {
    if (typeof window === "undefined") return migrateObservatoryData(this.fallbackData);
    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) {
      const migrated = migrateObservatoryData({ version: 1, studies: [] });
      this.save(migrated);
      return migrated;
    }
    try {
      const parsed = JSON.parse(raw) as ObservatoryData;
      const migrated = migrateObservatoryData(parsed);
      this.save(migrated);
      return migrated;
    } catch {
      const migrated = migrateObservatoryData({ version: 1, studies: [] });
      this.save(migrated);
      return migrated;
    }
  }

  save(data: ObservatoryData) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(this.storageKey, JSON.stringify(migrateObservatoryData(data), null, 2));
  }

  remove() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(this.storageKey);
  }
}
