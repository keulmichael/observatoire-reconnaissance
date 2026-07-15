import type { ObservatoryData, Study, TimelineEvent, UnderstandingState } from "./types";

type Metric = { label: string; value: string | number; hint?: string };

export function buildDashboard(data: ObservatoryData) {
  const studies = data.studies;
  const manifestations = studies.flatMap((study) => study.manifestations);
  const relations = studies.flatMap((study) => study.relations);
  const recognitions = studies.flatMap((study) => study.recognitions);
  const transitions = studies.flatMap((study) => study.transitions);
  const confirmations = recognitions.map((recognition) => recognition.confirmationLevel);
  const averageConfirmation = confirmations.length
    ? (confirmations.reduce((sum, value) => sum + value, 0) / confirmations.length).toFixed(1)
    : "0";

  const stats: Metric[] = [
      { label: "Études", value: studies.length, hint: "parcours d'observation" },
      { label: "Manifestations", value: manifestations.length },
      { label: "Relations", value: relations.length },
      { label: "Reconnaissances", value: recognitions.length },
      { label: "Transitions observées", value: transitions.length },
      { label: "Confirmation moyenne", value: `${averageConfirmation}/3` }
    ];

  return {
    stats,
    topCatalysts: rank(studies.flatMap((study) => study.catalysts.map((catalyst) => catalyst.name))),
    topEmotions: rank(studies.flatMap((study) => study.emotionObservations.map((emotion) => emotion.emotion))),
    latestEvents: studies
      .flatMap((study) => study.timeline)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
  };
}

export function buildAnalysis(data: ObservatoryData) {
  const transitions = data.studies.flatMap((study) => study.transitions);
  const recognitions = data.studies.flatMap((study) => study.recognitions);
  const incompleteTransitions = transitions.filter((transition) => transition.confirmationLevel < 2).length;
  const unconfirmed = recognitions.filter((recognition) => !recognition.confirmed).length;
  const durable = recognitions.filter((recognition) => recognition.stableOverTime).length;

  const metrics: Metric[] = [
      { label: "Reconnaissances", value: recognitions.length },
      { label: "Maturation moyenne", value: averageMaturation(transitions.map((transition) => transition.maturationDuration)) },
      { label: "Transitions incomplètes", value: incompleteTransitions },
      { label: "Transformations durables", value: durable }
    ];

  return {
    metrics,
    insights: [
      "Une relation possible apparaît entre les catalyseurs écrits et la stabilisation des reformulations.",
      unconfirmed
        ? `${unconfirmed} reconnaissance(s) restent à confirmer par une observation durable ou indépendante.`
        : "Le changement semble stable sur la période observée pour les reconnaissances confirmées.",
      "Les données sont insuffisantes pour conclure à une vérité ; elles décrivent seulement des séquences observables.",
      "Cette séquence est récurrente dans plusieurs observations lorsque perturbation, questionnement et reformulation sont documentés."
    ],
    recurrentRelations: rank(data.studies.flatMap((study) => study.relations.map((relation) => relation.type)))
  };
}

export function buildTimeline(study?: Study): TimelineEvent[] {
  if (!study) return [];
  return [...study.timeline].sort((a, b) => a.date.localeCompare(b.date));
}

export function compareStates(before?: UnderstandingState, after?: UnderstandingState) {
  if (!before || !after) {
    return { changed: [], appeared: [], disappeared: [], reformulated: [], uncertain: [] };
  }
  return {
    changed: [`stabilité ${before.stability}/10 → ${after.stability}/10`, `confiance ${before.confidence}/10 → ${after.confidence}/10`],
    appeared: after.confirmedElements.filter((item) => !before.confirmedElements.includes(item)),
    disappeared: before.uncertainElements.filter((item) => !after.uncertainElements.includes(item)),
    reformulated: after.language.filter((item) => !before.language.includes(item)),
    uncertain: after.uncertainElements
  };
}

export function exportStudy(study: Study) {
  downloadJson(`${study.id}.json`, study);
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function rank(values: string[]) {
  const map = new Map<string, number>();
  values.forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

function averageMaturation(values: string[]) {
  const days = values.map((value) => Number.parseInt(value, 10)).filter(Number.isFinite);
  if (!days.length) return "non calculable";
  return `${Math.round(days.reduce((sum, value) => sum + value, 0) / days.length)} jours`;
}
