import type { ObservatoryData } from "../types";

export type RepositoryPage = {
  limit?: number;
  offset?: number;
};

export interface ObservatoryRepository {
  load(ownerId: string, page?: RepositoryPage): Promise<ObservatoryData>;
  save(data: ObservatoryData, ownerId: string): Promise<ObservatoryData>;
  saveCoreObservatory?(data: ObservatoryData, ownerId: string): Promise<ObservatoryData>;
  saveGlobalObservatory?(data: ObservatoryData, ownerId: string): Promise<void>;
  getWarnings?(): string[];
}
