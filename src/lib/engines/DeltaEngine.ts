import type { DeltaFactor, DeltaScore, DifferenceCategory, StateDifference } from "@/lib/types";
import { deltaFromFactors, emptyDeltaScore } from "../scientific-model";

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
  emotionAddition: { category: "emotion", value: 0, label: "Emotion apparue" },
  emotionRemoval: { category: "emotion", value: 0, label: "Emotion non retrouvee" },
  decisionAddition: { category: "behaviour", value: 1, label: "Comportement nouveau" },
  decisionRemoval: { category: "behaviour", value: -1, label: "Comportement abandonne" },
  projectAddition: { category: "project", value: 1, label: "Projet nouveau" },
  projectRemoval: { category: "project", value: -1, label: "Projet abandonne" },
  vocabularyChange: { category: "language", value: 1, label: "Evolution du vocabulaire" },
  stabilization: { category: "stability", value: 0, label: "Stabilisation observee" },
  contradiction: { category: "concept", value: -2, label: "Contradiction potentielle" },
  insufficientData: { category: "concept", value: 0, label: "Indicateurs insuffisants" }
};

export const DeltaEngine = {
  calculateBreakdown(difference: StateDifference) {
    const base = this.calculate(difference);
    const byCategory = (categories: DifferenceCategory[]) =>
      [...base.positiveFactors, ...base.negativeFactors, ...base.neutralFactors].filter((factor) =>
        categories.includes(factor.category)
      );
    const emotion = deltaFromFactors(byCategory(["emotion"]), ["Δ émotion : variation descriptive, sans transformation automatique en compréhension."]);
    const understanding = deltaFromFactors(byCategory(["concept", "relation", "language"]), difference.insufficientIndicators);
    const behaviour = deltaFromFactors(byCategory(["behaviour", "decision", "project"]), []);
    const transmission = deltaFromFactors(
      byCategory(["transmission"]),
      difference.categoriesConcerned.includes("transmission") ? [] : ["Δ transmission non calculé : aucune transmission documentée."]
    );
    const components = [emotion, understanding, behaviour, transmission];
    const componentFactors = components.flatMap((component) => [
      ...component.positiveFactors,
      ...component.negativeFactors,
      ...component.neutralFactors
    ]);
    const global = componentFactors.length
      ? deltaFromFactors(componentFactors, unique(components.flatMap((component) => component.limits)))
      : emptyDeltaScore(["Δ global non calculé : aucun sous-delta suffisamment documenté."]);
    return { emotion, understanding, behaviour, transmission, global };
  },

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
      factor(DELTA_WEIGHTS.emotionAddition, difference.emotionsNew.length, "Variation emotionnelle documentee separement.", ids(difference, "emotion", "addition")),
      factor(DELTA_WEIGHTS.emotionRemoval, difference.emotionsDisappeared.length, "Variation emotionnelle documentee separement.", ids(difference, "emotion", "removal")),
      factor(DELTA_WEIGHTS.decisionAddition, difference.decisionsNew.length, "Nombre de comportements nouveaux.", ids(difference, "behaviour", "addition")),
      factor(DELTA_WEIGHTS.decisionRemoval, difference.decisionsAbandoned.length, "Nombre de comportements abandonnes.", ids(difference, "behaviour", "removal")),
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

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

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
