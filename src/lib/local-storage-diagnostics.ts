export type LocalStorageStudyPreview = {
  id?: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  observations: number;
  ownerId?: string;
};

export type LocalStorageDraftPreview = {
  id?: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  ownerId?: string;
};

export type LocalStorageDiagnosticEntry = {
  storage: "localStorage" | "sessionStorage" | "indexedDB";
  key: string;
  present: boolean;
  bytes: number;
  readable: boolean;
  parseError?: string;
  likelyObservatoryData: boolean;
  technicalOnly: boolean;
  studies: number;
  observations: number;
  drafts: number;
  schemaVersion?: string | number;
  version?: string | number;
  ownerIds: string[];
  preview: LocalStorageStudyPreview[];
  draftPreview: LocalStorageDraftPreview[];
  exportableValue?: unknown;
};

export const OBSERVATORY_STORAGE_KEYS = [
  "observatoire-reconnaissance:v1",
  "observatoire-reconnaissance",
  "observatoire:v1",
  "observatory-recognition:v1",
  "recognition-observatory:v1",
  "observatoire-recognition:v1",
  "observatoire-reconnaissance:backup",
  "observatoire-reconnaissance:drafts",
  "observatoire-reconnaissance:cache"
] as const;

const KEY_HINTS = [
  "observatoire",
  "reconnaissance",
  "observatory",
  "recognition",
  "observation",
  "study",
  "studies",
  "etude",
  "sauvegarde",
  "backup",
  "draft"
];

export async function diagnoseBrowserStorage(): Promise<LocalStorageDiagnosticEntry[]> {
  const entries = [
    ...diagnoseLocalStorage(window.localStorage),
    ...diagnoseStorage(window.sessionStorage, "sessionStorage", false)
  ];
  return [...entries, ...(await diagnoseIndexedDB())];
}

export function diagnoseLocalStorage(storage: Storage = window.localStorage): LocalStorageDiagnosticEntry[] {
  return diagnoseStorage(storage, "localStorage", true);
}

function diagnoseStorage(
  storage: Storage,
  storageName: LocalStorageDiagnosticEntry["storage"],
  includeKnownMissing: boolean
): LocalStorageDiagnosticEntry[] {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => Boolean(key))
    .filter((key) => isCandidateKey(key))
    .sort((a, b) => a.localeCompare(b));

  if (includeKnownMissing) {
    for (const key of OBSERVATORY_STORAGE_KEYS) {
      if (!keys.includes(key)) keys.push(key);
    }
  }

  return keys.map((key) => analyzeStorageValue(storageName, key, storage.getItem(key)));
}

export function buildLocalStorageBackup(entries: LocalStorageDiagnosticEntry[]) {
  return {
    exportedAt: new Date().toISOString(),
    source: "browser-storage",
    note: "Diagnostic non destructif. Aucune migration n'a ete effectuee.",
    keys: entries.map((entry) => ({
      storage: entry.storage,
      key: entry.key,
      present: entry.present,
      bytes: entry.bytes,
      readable: entry.readable,
      likelyObservatoryData: entry.likelyObservatoryData,
      technicalOnly: entry.technicalOnly,
      studies: entry.studies,
      observations: entry.observations,
      drafts: entry.drafts,
      schemaVersion: entry.schemaVersion,
      version: entry.version,
      ownerIds: entry.ownerIds,
      preview: entry.preview,
      draftPreview: entry.draftPreview,
      value: entry.exportableValue
    }))
  };
}

function analyzeStorageValue(
  storage: LocalStorageDiagnosticEntry["storage"],
  key: string,
  raw: string | null
): LocalStorageDiagnosticEntry {
  const base = {
    storage,
    key,
    present: raw !== null,
    bytes: raw?.length ?? 0,
    readable: false,
    likelyObservatoryData: OBSERVATORY_STORAGE_KEYS.includes(key as (typeof OBSERVATORY_STORAGE_KEYS)[number]),
    technicalOnly: isTechnicalKey(key),
    studies: 0,
    observations: 0,
    drafts: 0,
    ownerIds: [] as string[],
    preview: [] as LocalStorageStudyPreview[],
    draftPreview: [] as LocalStorageDraftPreview[]
  };
  if (raw === null) return base;

  try {
    const parsed = JSON.parse(raw) as unknown;
    const summary = summarizeValue(parsed);
    const technicalOnly = base.technicalOnly || (summary.ownerIds.length > 0 && summary.ownerIds.every((ownerId) => ownerId.startsWith("obs-")));
    return {
      ...base,
      readable: true,
      technicalOnly,
      likelyObservatoryData: base.likelyObservatoryData || summary.studies > 0 || summary.observations > 0 || summary.drafts > 0,
      studies: summary.studies,
      observations: summary.observations,
      drafts: summary.drafts,
      schemaVersion: readScalar(parsed, "schemaVersion"),
      version: readScalar(parsed, "version"),
      ownerIds: summary.ownerIds,
      preview: summary.preview,
      draftPreview: summary.draftPreview,
      exportableValue: parsed
    };
  } catch (error) {
    return {
      ...base,
      parseError: error instanceof Error ? error.message : "JSON illisible"
    };
  }
}

function summarizeValue(value: unknown) {
  const studies = findStudyLikeObjects(value);
  const draftObjects = findDraftLikeObjects(value);
  const ownerIds = uniqueStrings([
    ...studies.map((study) => stringField(study, "ownerId")),
    ...draftObjects.map((draft) => stringField(draft, "ownerId"))
  ]);
  return {
    studies: studies.length,
    observations: studies.reduce((sum, study) => sum + arrayField(study, "observations").length, 0),
    drafts: draftObjects.length,
    ownerIds,
    preview: studies.slice(0, 10).map((study) => ({
      id: stringField(study, "id"),
      title: stringField(study, "title") || stringField(study, "subject") || "Etude sans titre",
      createdAt: stringField(study, "createdAt") || stringField(study, "startDate"),
      updatedAt: stringField(study, "updatedAt"),
      observations: arrayField(study, "observations").length,
      ownerId: stringField(study, "ownerId")
    })),
    draftPreview: draftObjects.slice(0, 10).map((draft) => ({
      id: stringField(draft, "id"),
      title: stringField(draft, "title") || excerpt(stringField(draft, "rawText")) || "Brouillon sans titre",
      createdAt: stringField(draft, "createdAt"),
      updatedAt: stringField(draft, "updatedAt"),
      ownerId: stringField(draft, "ownerId")
    }))
  };
}

function findStudyLikeObjects(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 4 || value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item) => findStudyLikeObjects(item, depth + 1));
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.studies)) {
    return record.studies.filter(isStudyLike) as Record<string, unknown>[];
  }
  return Object.values(record).flatMap((item) => findStudyLikeObjects(item, depth + 1));
}

function findDraftLikeObjects(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 4 || value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item) => findDraftLikeObjects(item, depth + 1));
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.observationDrafts)) {
    return record.observationDrafts.filter(isDraftLike) as Record<string, unknown>[];
  }
  return Object.values(record).flatMap((item) => findDraftLikeObjects(item, depth + 1));
}

function isStudyLike(value: unknown) {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.title === "string" || Array.isArray(record.observations) || typeof record.subject === "string";
}

function isDraftLike(value: unknown) {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.rawText === "string" || typeof record.conclusion === "string" || typeof record.status === "string";
}

async function diagnoseIndexedDB(): Promise<LocalStorageDiagnosticEntry[]> {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") return [];
  try {
    const databases = await indexedDB.databases();
    return databases
      .filter((database) => database.name && isCandidateKey(database.name))
      .map((database) => ({
        storage: "indexedDB" as const,
        key: database.name ?? "indexedDB sans nom",
        present: true,
        bytes: 0,
        readable: false,
        likelyObservatoryData: true,
        technicalOnly: isTechnicalKey(database.name ?? ""),
        studies: 0,
        observations: 0,
        drafts: 0,
        ownerIds: [],
        preview: [],
        draftPreview: [],
        version: database.version,
        parseError: "Base IndexedDB detectee par nom uniquement; contenu non ouvert par ce diagnostic."
      }));
  } catch (error) {
    return [{
      storage: "indexedDB",
      key: "indexedDB",
      present: false,
      bytes: 0,
      readable: false,
      likelyObservatoryData: false,
      technicalOnly: true,
      studies: 0,
      observations: 0,
      drafts: 0,
      ownerIds: [],
      preview: [],
      draftPreview: [],
      parseError: error instanceof Error ? error.message : "IndexedDB inaccessible"
    }];
  }
}

function isCandidateKey(key: string) {
  const normalized = key.toLowerCase();
  return OBSERVATORY_STORAGE_KEYS.includes(key as (typeof OBSERVATORY_STORAGE_KEYS)[number])
    || KEY_HINTS.some((hint) => normalized.includes(hint))
    || normalized.startsWith("sb-");
}

function isTechnicalKey(key: string) {
  const normalized = key.toLowerCase();
  return normalized.startsWith("sb-") || normalized.includes("supabase") || normalized.includes("auth-token");
}

function readScalar(value: unknown, field: string) {
  if (value === null || typeof value !== "object") return undefined;
  const item = (value as Record<string, unknown>)[field];
  return typeof item === "string" || typeof item === "number" ? item : undefined;
}

function stringField(value: Record<string, unknown>, field: string) {
  const item = value[field];
  return typeof item === "string" ? item : undefined;
}

function arrayField(value: Record<string, unknown>, field: string) {
  const item = value[field];
  return Array.isArray(item) ? item : [];
}

function uniqueStrings(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function excerpt(value: string | undefined) {
  if (!value) return undefined;
  return value.length > 80 ? `${value.slice(0, 77)}...` : value;
}
