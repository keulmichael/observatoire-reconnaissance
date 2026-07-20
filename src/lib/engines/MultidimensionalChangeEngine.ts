import type {
  AnalysisScope,
  CanonicalDimension,
  CanonicalObservationElement,
  MultidimensionalChange,
  MultidimensionalChangeKind,
  ObservationRecord,
  Study
} from "../types";
import { stableId } from "../parser/ObservationParser";
import { extractCanonicalDimensions } from "../parser/DimensionExtractor";

export const MULTIDIMENSIONAL_CHANGE_ENGINE_VERSION = "MultidimensionalChangeEngine:v1";

export const MultidimensionalChangeEngine = {
  compareStudy(study: Study, scope: AnalysisScope, now = new Date().toISOString()): MultidimensionalChange[] {
    const records = (study.observations ?? [])
      .filter((record) => record.status === "active")
      .slice()
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    return records.slice(1).map((record, index) => this.comparePair(study, records[index], record, scope, now));
  },

  comparePair(study: Study, previous: ObservationRecord, current: ObservationRecord, scope: AnalysisScope, now = new Date().toISOString()): MultidimensionalChange {
    const previousElements = elementsFor(previous);
    const currentElements = elementsFor(current);
    const dimensionsCommon = commonDimensions(previousElements, currentElements);
    const changesDetected = buildChanges(previousElements, currentElements);
    const insufficientData = [
      !previousElements.length ? "Observation anterieure sans dimensions exploitables." : "",
      !currentElements.length ? "Observation actuelle sans dimensions exploitables." : "",
      !dimensionsCommon.length ? "Aucune dimension commune stricte ; comparaison limitee aux signaux lexicaux." : ""
    ].filter(Boolean);
    const limitations = [
      "Aucun changement n'est valide automatiquement.",
      "Portee du groupe non precisee.",
      ...(/idolatr/i.test(current.rawText) ? ["Formulation \"idolatrie\" eventuellement hyperbolique."] : []),
      "Contexte mediatique possible ; besoin de donnees complementaires.",
      "Ne pas produire automatiquement reconnaissance, progression, verite ou causalite."
    ];
    const sourceObservationIds = [previous.id, current.id];

    return {
      id: stableId("multidimensional-change", `${study.id}-${previous.id}-${current.id}-${now}`),
      studyId: study.id,
      scope,
      dimensionsCommon,
      proposedPreviousState: previousElements.length
        ? { summary: summarize(previousElements), elements: previousElements }
        : null,
      proposedCurrentState: currentElements.length
        ? { summary: summarize(currentElements), elements: currentElements }
        : null,
      changesDetected,
      insufficientData,
      limitations,
      questions: [
        "Quel groupe est exactement concerne ?",
        "L'idolatrie est-elle descriptive, hyperbolique ou mesuree par des donnees observables ?",
        "Quels extraits confirment la stabilite du changement ?"
      ],
      sourceObservationIds,
      sourceExcerpts: [
        { observationId: previous.id, excerpt: previous.sourceExcerpts[0] ?? previous.rawText },
        { observationId: current.id, excerpt: current.sourceExcerpts[0] ?? current.rawText }
      ],
      confidence: confidenceFrom(changesDetected, insufficientData),
      status: "proposed",
      engine: "MultidimensionalChangeEngine",
      engineVersion: MULTIDIMENSIONAL_CHANGE_ENGINE_VERSION,
      createdAt: now,
      updatedAt: now
    };
  }
};

function elementsFor(record: ObservationRecord) {
  return record.detectedDimensions?.length ? record.detectedDimensions : extractCanonicalDimensions(record);
}

function commonDimensions(previous: CanonicalObservationElement[], current: CanonicalObservationElement[]): CanonicalDimension[] {
  const currentCategories = new Set(current.map((element) => element.category));
  return [...new Set(previous.map((element) => element.category).filter((category) => currentCategories.has(category)))];
}

function buildChanges(previous: CanonicalObservationElement[], current: CanonicalObservationElement[]): MultidimensionalChange["changesDetected"] {
  const changes: MultidimensionalChange["changesDetected"] = [];
  const beforeNegativeAttitude = previous.find((element) => element.category === "Attitude" && element.polarity === "negative");
  const afterIdealization = current.find((element) =>
    (element.category === "Representation" || element.category === "Attitude")
    && (element.subtype === "glorification" || /idealisation|glorification/i.test(element.label))
  );
  if (beforeNegativeAttitude && afterIdealization) {
    changes.push(change("polarity-inversion", "Attitude", beforeNegativeAttitude.label, afterIdealization.label, "Inversion de polarite : attitude negative vers idealisation positive extreme ou sacralisante.", 0.9));
    changes.push(change("representation-shift", "Representation", "devalorisation", "glorification", "Changement de representation : devalorisation vers figure presque intouchable.", 0.88));
    changes.push(change("relation-shift", "Relation", "distance ou rejet", "rapport sacralisant", "Changement de relation propose entre le public et la figure.", 0.76));
    changes.push(change("language-shift", "LanguageMarker", "meprisee / devalorisee", "idolatree / intouchable", "Modification du vocabulaire de valuation.", 0.86));
    changes.push(change("amplification", "Representation", "valorisation absente ou negative", "valorisation amplifiee", "Amplification de la valorisation.", 0.82));
  }

  for (const category of commonDimensions(previous, current)) {
    const beforeLabels = previous.filter((element) => element.category === category).map((element) => element.label);
    const afterLabels = current.filter((element) => element.category === category).map((element) => element.label);
    if (beforeLabels.join("|") !== afterLabels.join("|")) {
      changes.push(change("reformulation", category, beforeLabels.join(", "), afterLabels.join(", "), `Variation dans la dimension ${category}.`, 0.62));
    }
  }

  if (!changes.length) {
    changes.push(change("insufficient-data", "Metadata", undefined, undefined, "Donnees insuffisantes pour caracteriser un changement multidimensionnel.", 1));
  }
  return dedupeChanges(changes);
}

function change(kind: MultidimensionalChangeKind, dimension: CanonicalDimension, before: string | undefined, after: string | undefined, summary: string, confidence: number) {
  return {
    id: stableId("change", `${kind}-${dimension}-${before ?? ""}-${after ?? ""}-${summary}`),
    kind,
    dimension,
    before,
    after,
    summary,
    confidence
  };
}

function summarize(elements: CanonicalObservationElement[]) {
  return elements.map((element) => `${element.category}: ${element.label}`).join("; ");
}

function confidenceFrom(changes: MultidimensionalChange["changesDetected"], insufficientData: string[]) {
  if (insufficientData.length) return 0.45;
  if (changes.some((changeItem) => changeItem.kind === "polarity-inversion")) return 0.86;
  return 0.62;
}

function dedupeChanges(changes: MultidimensionalChange["changesDetected"]) {
  const seen = new Set<string>();
  return changes.filter((item) => {
    const key = `${item.kind}:${item.dimension}:${item.before}:${item.after}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
