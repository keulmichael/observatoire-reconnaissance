import { demoData } from "./demo-data";
import { migrateObservatoryData } from "./data-migration";
import type { ObservatoryData } from "./types";

const STORAGE_KEY = "observatoire-reconnaissance:v1";

export const repository = {
  load(): ObservatoryData {
    if (typeof window === "undefined") return migrateObservatoryData(demoData);
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
  },
  save(data: ObservatoryData) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
  },
  reset() {
    const migrated = migrateObservatoryData(demoData);
    this.save(migrated);
    return migrated;
  }
};
