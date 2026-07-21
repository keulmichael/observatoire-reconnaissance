import type { User } from "@supabase/supabase-js";
import { demoData } from "./demo-data";
import { migrateObservatoryData } from "./data-migration";
import type { ObservatoryData } from "./types";
import { deleteStudyWithPersistence } from "./study-deletion";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "./supabase/client";
import { LocalCacheRepository } from "./repositories/LocalCacheRepository";
import { SupabaseObservatoryRepository } from "./repositories/SupabaseObservatoryRepository";
import { SyncService, type SyncSnapshot } from "./repositories/SyncService";

export const STORAGE_KEY = "observatoire-reconnaissance:v1";

const localCache = new LocalCacheRepository(STORAGE_KEY, demoData);
const supabaseRepository = new SupabaseObservatoryRepository(createSupabaseBrowserClient());
const syncService = new SyncService(localCache, supabaseRepository);

export type RepositorySession = {
  user: User | null;
  configured: boolean;
};

export type MigrationSummary = {
  hasLocalData: boolean;
  studies: number;
  observations: number;
  drafts: number;
  exportData: ObservatoryData;
};

export const repository = {
  configured: isSupabaseConfigured(),
  localCache,
  supabaseRepository,
  syncService,

  loadLocal(): ObservatoryData {
    return localCache.load();
  },

  async session(): Promise<RepositorySession> {
    if (!isSupabaseConfigured()) return { user: null, configured: false };
    const { data } = await createSupabaseBrowserClient().auth.getSession();
    return { user: data.session?.user ?? null, configured: true };
  },

  async load(): Promise<SyncSnapshot> {
    const session = await this.session();
    return syncService.load(session.user?.id ?? null);
  },

  async save(data: ObservatoryData): Promise<SyncSnapshot> {
    const session = await this.session();
    return syncService.save(data, session.user?.id ?? null);
  },

  reset() {
    const migrated = migrateObservatoryData(demoData);
    localCache.save(migrated);
    return migrated;
  },

  deleteStudy(data: ObservatoryData, studyId: string) {
    return deleteStudyWithPersistence(data, studyId, (nextData) => {
      localCache.save(nextData);
      void this.save(nextData);
    });
  },

  async signIn(email: string, password: string) {
    const client = createSupabaseBrowserClient();
    return client.auth.signInWithPassword({ email, password });
  },

  async signUp(email: string, password: string) {
    const client = createSupabaseBrowserClient();
    return client.auth.signUp({ email, password });
  },

  async signOut() {
    const client = createSupabaseBrowserClient();
    return client.auth.signOut();
  },

  migrationSummary(): MigrationSummary {
    const exportData = localCache.load();
    return {
      hasLocalData: exportData.studies.length > 0 || (exportData.observationDrafts ?? []).length > 0,
      studies: exportData.studies.length,
      observations: exportData.studies.reduce((sum, study) => sum + (study.observations ?? []).length, 0),
      drafts: exportData.observationDrafts?.length ?? 0,
      exportData
    };
  },

  async migrateLocalToRemote(ownerId: string): Promise<SyncSnapshot> {
    const data = localCache.load();
    const owned = withOwner(data, ownerId);
    const saved = await syncService.save(owned, ownerId);
    localCache.save(saved.data);
    return saved;
  }
};

function withOwner(data: ObservatoryData, ownerId: string): ObservatoryData {
  const now = new Date().toISOString();
  return migrateObservatoryData({
    ...data,
    ownerId,
    updatedAt: now,
    studies: data.studies.map((study) => ({
      ...study,
      ownerId,
      updatedAt: study.updatedAt ?? now,
      observations: (study.observations ?? []).map((record) => ({ ...record, ownerId }))
    }))
  });
}
