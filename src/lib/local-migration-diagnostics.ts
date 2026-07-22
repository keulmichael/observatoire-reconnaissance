import { migrateObservatoryData } from "./data-migration";
import type { ObservationAnalysisDraft, ObservationRecord, ObservatoryData, Study } from "./types";

export type LocalMigrationReport = {
  version: 1;
  ownerId: string;
  migratedAt: string;
  sourceHash: string;
  counts: LocalMigrationCounts;
  result: "success" | "partial" | "failed";
  imported: LocalMigrationCounts;
  error?: string;
};

export type LocalMigrationCounts = {
  studies: number;
  observations: number;
  drafts: number;
};

export type LocalMigrationStatus =
  | "no-local-data"
  | "remote-empty"
  | "already-migrated"
  | "local-new-data"
  | "partial-difference"
  | "migration-incomplete"
  | "migrated-to-other-owner";

export type LocalMigrationDiagnostic = {
  status: LocalMigrationStatus;
  localHash: string;
  counts: LocalMigrationCounts;
  remoteCounts: LocalMigrationCounts;
  missing: LocalMigrationCounts;
  different: LocalMigrationCounts;
  matching: LocalMigrationCounts;
  report: LocalMigrationReport | null;
  canMigrateMissing: boolean;
  canDeleteLocal: boolean;
};

type StudyMatch = {
  local: Study;
  remote?: Study;
  sameContent: boolean;
  missingObservations: ObservationRecord[];
  differentObservations: ObservationRecord[];
  matchingObservations: number;
};

export function createLocalMigrationReport(
  source: ObservatoryData,
  ownerId: string,
  result: LocalMigrationReport["result"],
  imported: LocalMigrationCounts,
  error?: string
): LocalMigrationReport {
  return {
    version: 1,
    ownerId,
    migratedAt: new Date().toISOString(),
    sourceHash: hashLocalBackup(source),
    counts: countLocalData(source),
    result,
    imported,
    ...(error ? { error } : {})
  };
}

export function compareLocalToRemote(
  localInput: ObservatoryData,
  remoteInput: ObservatoryData,
  ownerId: string,
  report: LocalMigrationReport | null = null
): LocalMigrationDiagnostic {
  const local = migrateObservatoryData(localInput);
  const remote = migrateObservatoryData(remoteInput);
  const counts = countLocalData(local);
  const remoteCounts = countLocalData(remote);
  const localHash = hashLocalBackup(local);
  const matches = matchStudies(local.studies, remote.studies);
  const missingStudies = matches.filter((match) => !match.remote).map((match) => match.local);
  const missingObservations = matches.flatMap((match) => match.missingObservations);
  const differentObservations = matches.flatMap((match) => match.differentObservations);
  const matchingObservations = matches.reduce((sum, match) => sum + match.matchingObservations, 0);
  const draftComparison = compareDrafts(local.observationDrafts ?? [], remote.observationDrafts ?? []);
  const missing = {
    studies: missingStudies.length,
    observations: missingObservations.length,
    drafts: draftComparison.missing.length
  };
  const different = {
    studies: matches.filter((match) => match.remote && !match.sameContent).length,
    observations: differentObservations.length,
    drafts: draftComparison.different.length
  };
  const matching = {
    studies: matches.filter((match) => match.remote).length,
    observations: matchingObservations,
    drafts: draftComparison.matching
  };
  const hasLocal = counts.studies > 0 || counts.observations > 0 || counts.drafts > 0;
  const hasRemote = remoteCounts.studies > 0 || remoteCounts.observations > 0 || remoteCounts.drafts > 0;
  const hasMissing = missing.studies > 0 || missing.observations > 0 || missing.drafts > 0;
  const hasDifferent = different.studies > 0 || different.observations > 0 || different.drafts > 0;
  const reportMatchesSource = report?.sourceHash === localHash;

  let status: LocalMigrationStatus;
  if (!hasLocal) status = "no-local-data";
  else if (reportMatchesSource && report.ownerId !== ownerId) status = "migrated-to-other-owner";
  else if (reportMatchesSource && report.result !== "success") status = "migration-incomplete";
  else if (!hasRemote) status = "remote-empty";
  else if (!hasMissing && !hasDifferent) status = "already-migrated";
  else if (hasMissing && !hasDifferent) status = "local-new-data";
  else status = "partial-difference";

  return {
    status,
    localHash,
    counts,
    remoteCounts,
    missing,
    different,
    matching,
    report,
    canMigrateMissing: status === "remote-empty" || status === "local-new-data" || ((status === "partial-difference" || status === "migration-incomplete") && hasMissing),
    canDeleteLocal: status === "already-migrated"
  };
}

export function mergeMissingLocalData(localInput: ObservatoryData, remoteInput: ObservatoryData, ownerId: string): ObservatoryData {
  const local = withOwner(migrateObservatoryData(localInput), ownerId);
  const remote = withOwner(migrateObservatoryData(remoteInput), ownerId);
  const matches = matchStudies(local.studies, remote.studies);
  const nextStudies = [...remote.studies];

  for (const match of matches) {
    if (!match.remote) {
      nextStudies.push(match.local);
      continue;
    }
    if (!match.missingObservations.length) continue;
    const index = nextStudies.findIndex((study) => study.id === match.remote?.id);
    if (index >= 0) {
      nextStudies[index] = {
        ...nextStudies[index],
        observations: [...(nextStudies[index].observations ?? []), ...match.missingObservations]
      };
    }
  }

  const draftComparison = compareDrafts(local.observationDrafts ?? [], remote.observationDrafts ?? []);
  return migrateObservatoryData({
    ...remote,
    ownerId,
    studies: nextStudies,
    observationDrafts: [...(remote.observationDrafts ?? []), ...draftComparison.missing]
  });
}

export function countLocalData(data: ObservatoryData): LocalMigrationCounts {
  return {
    studies: data.studies.length,
    observations: data.studies.reduce((sum, study) => sum + (study.observations ?? []).length, 0),
    drafts: data.observationDrafts?.length ?? 0
  };
}

export function hashLocalBackup(data: ObservatoryData): string {
  return stableHash({
    studies: data.studies.map(studySignatureForHash).sort((a, b) => a.key.localeCompare(b.key)),
    drafts: (data.observationDrafts ?? []).map(draftSignatureForHash).sort((a, b) => a.key.localeCompare(b.key))
  });
}

function matchStudies(localStudies: Study[], remoteStudies: Study[]): StudyMatch[] {
  const remoteById = new Map(remoteStudies.map((study) => [study.id, study]));
  const remoteByLogical = new Map(remoteStudies.map((study) => [studyLogicalKey(study), study]));
  return localStudies.map((local) => {
    const remote = remoteById.get(local.id) ?? remoteByLogical.get(studyLogicalKey(local));
    const observationComparison = remote
      ? compareObservations(local, remote)
      : { missing: local.observations ?? [], different: [], matching: 0 };
    return {
      local,
      remote,
      sameContent: remote ? stableHash(studySignatureForHash(local)) === stableHash(studySignatureForHash(remote)) : false,
      missingObservations: observationComparison.missing,
      differentObservations: observationComparison.different,
      matchingObservations: observationComparison.matching
    };
  });
}

function compareObservations(localStudy: Study, remoteStudy: Study) {
  const remoteObservations = remoteStudy.observations ?? [];
  const remoteById = new Map(remoteObservations.map((observation) => [observation.id, observation]));
  const remoteByLogical = new Map(remoteObservations.map((observation) => [observationLogicalKey(remoteStudy, observation), observation]));
  const missing: ObservationRecord[] = [];
  const different: ObservationRecord[] = [];
  let matching = 0;

  for (const localObservation of localStudy.observations ?? []) {
    const remoteObservation = remoteById.get(localObservation.id) ?? remoteByLogical.get(observationLogicalKey(localStudy, localObservation));
    if (!remoteObservation) {
      missing.push(localObservation);
    } else if (stableHash(observationSignatureForHash(localStudy, localObservation)) === stableHash(observationSignatureForHash(remoteStudy, remoteObservation))) {
      matching += 1;
    } else {
      different.push(localObservation);
    }
  }
  return { missing, different, matching };
}

function compareDrafts(localDrafts: ObservationAnalysisDraft[], remoteDrafts: ObservationAnalysisDraft[]) {
  const remoteById = new Map(remoteDrafts.map((draft) => [draft.id, draft]));
  const remoteByLogical = new Map(remoteDrafts.map((draft) => [draftLogicalKey(draft), draft]));
  const missing: ObservationAnalysisDraft[] = [];
  const different: ObservationAnalysisDraft[] = [];
  let matching = 0;

  for (const localDraft of localDrafts) {
    const remoteDraft = remoteById.get(localDraft.id) ?? remoteByLogical.get(draftLogicalKey(localDraft));
    if (!remoteDraft) {
      missing.push(localDraft);
    } else if (stableHash(draftSignatureForHash(localDraft)) === stableHash(draftSignatureForHash(remoteDraft))) {
      matching += 1;
    } else {
      different.push(localDraft);
    }
  }
  return { missing, different, matching };
}

function withOwner(data: ObservatoryData, ownerId: string): ObservatoryData {
  return {
    ...data,
    ownerId,
    studies: data.studies.map((study) => ({
      ...study,
      ownerId,
      observations: (study.observations ?? []).map((observation) => ({ ...observation, ownerId, studyId: study.id }))
    }))
  };
}

function studyLogicalKey(study: Study) {
  return normalizeKey(["study", study.title, study.startDate || study.createdAt]);
}

function observationLogicalKey(study: Study, observation: ObservationRecord) {
  return normalizeKey(["observation", studyLogicalKey(study), observation.createdAt, stableHash(observation.rawText)]);
}

function draftLogicalKey(draft: ObservationAnalysisDraft) {
  return normalizeKey(["draft", draft.createdAt, stableHash(draft.rawText)]);
}

function studySignatureForHash(study: Study) {
  return {
    key: studyLogicalKey(study),
    id: study.id,
    title: study.title,
    startDate: study.startDate,
    createdAt: study.createdAt,
    subject: study.subject,
    observations: (study.observations ?? []).map((observation) => observationSignatureForHash(study, observation)).sort((a, b) => a.key.localeCompare(b.key))
  };
}

function observationSignatureForHash(study: Study, observation: ObservationRecord) {
  return {
    key: observationLogicalKey(study, observation),
    id: observation.id,
    studyKey: studyLogicalKey(study),
    studyId: observation.studyId || study.id,
    rawText: observation.rawText,
    createdAt: observation.createdAt,
    status: observation.status
  };
}

function draftSignatureForHash(draft: ObservationAnalysisDraft) {
  return {
    key: draftLogicalKey(draft),
    id: draft.id,
    rawText: draft.rawText,
    createdAt: draft.createdAt,
    status: draft.status
  };
}

function normalizeKey(parts: Array<string | undefined>) {
  return parts.map((part) => (part ?? "").trim().toLocaleLowerCase("fr-FR")).join("|");
}

function stableHash(value: unknown) {
  const input = stableStringify(value);
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== "ownerId" && key !== "updatedAt")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}
