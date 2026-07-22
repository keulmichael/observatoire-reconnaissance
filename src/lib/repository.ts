import type { User } from "@supabase/supabase-js";
import { demoData } from "./demo-data";
import { migrateObservatoryData } from "./data-migration";
import type { ObservatoryData } from "./types";
import { deleteStudyWithPersistence } from "./study-deletion";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "./supabase/client";
import { LocalCacheRepository } from "./repositories/LocalCacheRepository";
import { SupabaseObservatoryRepository } from "./repositories/SupabaseObservatoryRepository";
import { SyncService, type SyncSnapshot } from "./repositories/SyncService";
import {
  compareLocalToRemote,
  countLocalData,
  createLocalMigrationReport,
  mergeMissingLocalData,
  type LocalMigrationDiagnostic,
  type LocalMigrationReport
} from "./local-migration-diagnostics";

export const STORAGE_KEY = "observatoire-reconnaissance:v1";
export const MIGRATION_REPORT_KEY = `${STORAGE_KEY}:migration-report`;

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
    const counts = countLocalData(exportData);
    return {
      hasLocalData: counts.studies > 0 || counts.observations > 0 || counts.drafts > 0,
      studies: counts.studies,
      observations: counts.observations,
      drafts: counts.drafts,
      exportData
    };
  },

  async localMigrationDiagnostic(ownerId: string): Promise<LocalMigrationDiagnostic> {
    const local = localCache.load();
    const remote = await supabaseRepository.load(ownerId, { limit: 100, offset: 0 });
    return compareLocalToRemote(local, remote, ownerId, readMigrationReport());
  },

  async migrateLocalToRemote(ownerId: string): Promise<SyncSnapshot> {
    const local = localCache.load();
    const remote = await supabaseRepository.load(ownerId, { limit: 100, offset: 0 });
    const diagnostic = compareLocalToRemote(local, remote, ownerId, readMigrationReport());
    if (diagnostic.status === "already-migrated") {
      throw new Error("Migration bloquee : ces donnees locales existent deja dans le compte.");
    }
    if (diagnostic.status === "migrated-to-other-owner") {
      throw new Error("Migration bloquee : cette sauvegarde locale a deja ete migree vers un autre compte.");
    }
    if (!diagnostic.canMigrateMissing) {
      throw new Error("Aucune donnee locale manquante a importer.");
    }
    const merged = mergeMissingLocalData(local, remote, ownerId);
    try {
      const saved = await syncService.save(merged, ownerId);
      const result = saved.status === "synced" ? "success" : "partial";
      saveMigrationReport(createLocalMigrationReport(local, ownerId, result, diagnostic.missing, saved.error ?? saved.warning));
      return saved;
    } catch (error) {
      saveMigrationReport(createLocalMigrationReport(local, ownerId, "failed", diagnostic.missing, message(error)));
      throw error;
    }
  },

  async removeLocalBackup(ownerId: string): Promise<ObservatoryData> {
    const local = localCache.load();
    const remote = await supabaseRepository.load(ownerId, { limit: 100, offset: 0 });
    const diagnostic = compareLocalToRemote(local, remote, ownerId, readMigrationReport());
    if (!diagnostic.canDeleteLocal) {
      throw new Error("Suppression locale bloquee : les donnees correspondantes ne sont pas confirmees dans Supabase.");
    }
    localCache.remove();
    removeMigrationReport();
    return local;
  }
};

function readMigrationReport(): LocalMigrationReport | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(MIGRATION_REPORT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalMigrationReport;
  } catch {
    return null;
  }
}

function saveMigrationReport(report: LocalMigrationReport) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MIGRATION_REPORT_KEY, JSON.stringify(report, null, 2));
}

function removeMigrationReport() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(MIGRATION_REPORT_KEY);
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Erreur de migration";
}
