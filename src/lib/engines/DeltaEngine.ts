import type { DeltaFactor, DeltaScore, DifferenceCategory, StateDifference } from "@/lib/types";

type WeightRule = {
  category: DifferenceCategory;
  value: number;
  label: string;
};

export const DELTA_WEIGHTS: Record<string, WeightRule> = {
  conceptAddition: { category: "concept", value: 2, label: "Concept ajoute" },
  conceptRemoval: { category: "concept", value: -1, label: "Concept retire" },
  conceptReformulation: { category: "concept", value: 1, label: "Reformulation probable de concept" },
  relationAddition: { category: "relation", value: 2, label: "Relation possible ajoutee" },
  relationRemoval: { category: "relation", value: -1, label: "Relation retiree" },
  decisionAddition: { category: "decision", value: 2, label: "Decision ou comportement nouveau" },
  decisionRemoval: { category: "decision", value: -1, label: "Decision ou comportement abandonne" },
  projectAddition: { category: "project", value: 1, label: "Projet nouveau" },
  projectRemoval: { category: "project", value: -1, label: "Projet abandonne" },
  vocabularyChange: { category: "language", value: 1, label: "Evolution du vocabulaire" },
  stabilization: { category: "stability", value: 0, label: "Stabilisation observee" },
  contradiction: { category: "concept", value: -2, label: "Contradiction potentielle" },
  insufficientData: { category: "concept", value: 0, label: "Indicateurs insuffisants" }
};

export const DeltaEngine = {
  calculate(difference: StateDifference): DeltaScore {
    const factors: DeltaFactor[] = [
      factor(DELTA_WEIGHTS.conceptAddition, difference.conceptsAdded.length, "Nombre de concepts ajoutes.", ids(difference, "concept", "addition")),
      factor(DELTA_WEIGHTS.conceptRemoval, difference.conceptsRemoved.length, "Nombre de concepts retires.", ids(difference, "concept", "removal")),
      factor(
        DELTA_WEIGHTS.conceptReformulation,
        difference.conceptsReformulated.length,
        "Nombre de reformulations probables non fusionnees.",
        ids(difference, "concept", "probable-reformulation")
      ),
      factor(DELTA_WEIGHTS.relationAddition, difference.relationsAdded.length, "Nombre de relations possibles ajoutees.", ids(difference, "relation", "addition")),
      factor(DELTA_WEIGHTS.relationRemoval, difference.relationsRemoved.length, "Nombre de relations retirees.", ids(difference, "relation", "removal")),
      factor(DELTA_WEIGHTS.decisionAddition, difference.decisionsNew.length, "Nombre de decisions ou comportements nouveaux.", ids(difference, "decision", "addition")),
      factor(DELTA_WEIGHTS.decisionRemoval, difference.decisionsAbandoned.length, "Nombre de decisions ou comportements abandonnes.", ids(difference, "decision", "removal")),
      factor(DELTA_WEIGHTS.projectAddition, difference.projectsNew.length, "Nombre de projets nouveaux.", []),
      factor(DELTA_WEIGHTS.projectRemoval, difference.projectsAbandoned.length, "Nombre de projets abandonnes.", []),
      factor(DELTA_WEIGHTS.vocabularyChange, Math.abs(difference.language.vocabularyDelta), "Amplitude absolue de variation du vocabulaire.", []),
      factor(DELTA_WEIGHTS.contradiction, ids(difference, "concept", "potential-contradiction").length, "Contradictions potentielles detectees.", ids(difference, "concept", "potential-contradiction")),
      factor(DELTA_WEIGHTS.stabilization, difference.stabilityLevel === "stable" ? 1 : 0, "Stable signifie variation faible ou nulle, pas progression.", ids(difference, "stability", "stabilization")),
      factor(DELTA_WEIGHTS.insufficientData, difference.insufficientIndicators.length, "Absence d'indicateurs suffisants pour certains calculs.", ids(difference, "concept", "insufficient-data"))
    ].filter((item) => item.value !== 0 || item.label === DELTA_WEIGHTS.stabilization.label || item.label === DELTA_WEIGHTS.insufficientData.label);

    const score = factors.reduce((sum, item) => sum + item.value, 0);

    return {
      score,
      positiveFactors: factors.filter((item) => item.value > 0),
      negativeFactors: factors.filter((item) => item.value < 0),
      neutralFactors: factors.filter((item) => item.value === 0),
      limits: [
        "Delta mesure une variation observable, jamais une verite ni une valeur personnelle.",
        "Une valeur positive ne signifie pas automatiquement une progression.",
        "Les reformulations probables exigent une confirmation utilisateur.",
        ...difference.insufficientIndicators
      ],
      interpretation: difference.insufficientIndicators.length
        ? "indicateurs insuffisants"
        : score === 0
          ? "variation nulle ou stable"
          : "variation observable"
    };
  }
};

function factor(rule: WeightRule, count: number, reason: string, sourceDifferenceIds: string[]): DeltaFactor {
  return {
    label: `${rule.label} x${count}`,
    category: rule.category,
    value: rule.value * count,
    reason,
    sourceDifferenceIds
  };
}

function ids(
  difference: StateDifference,
  category: DifferenceCategory,
  kind: StateDifference["items"][number]["kind"]
) {
  return difference.items.filter((item) => item.category === category && item.kind === kind).map((item) => item.id);
}
