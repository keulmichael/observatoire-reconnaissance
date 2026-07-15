import { demoData } from "./demo-data";
import type { ObservatoryData } from "./types";

const STORAGE_KEY = "observatoire-reconnaissance:v1";

export const repository = {
  load(): ObservatoryData {
    if (typeof window === "undefined") return demoData;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      this.save(demoData);
      return demoData;
    }
    try {
      const parsed = JSON.parse(raw) as ObservatoryData;
      return { ...parsed, observationDrafts: parsed.observationDrafts ?? [] };
    } catch {
      this.save(demoData);
      return demoData;
    }
  },
  save(data: ObservatoryData) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
  },
  reset() {
    this.save(demoData);
    return demoData;
  }
};
