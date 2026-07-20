import type { StudySynthesisClaim, StudySynthesisSection, StudySynthesisStatisticItem } from "@/lib/types";
import type { AnalysisBundle } from "./types";
import { claim, formatDate } from "./utils";

export class NarrativeWriter {
  write(bundle: AnalysisBundle): StudySynthesisSection[] {
    const { collected, statistics } = bundle;
    const dominantDimensions = listLabels(statistics.dimensions);
    const dominantPhenomena = listLabels([...statistics.emotions, ...statistics.concepts, ...statistics.representations].slice(0, 5));
    const presentationClaim = claim({
      kind: "fait observe",
      text: `L'étude contient ${statistics.totalObservations} observation(s) couvrant la période ${formatDate(statistics.periodStart)} - ${formatDate(statistics.periodEnd)}.`,
      confidence: statistics.totalObservations ? "Très élevé" : "Élevé",
      justification: "Cette information est calculée directement à partir des observations enregistrées.",
      evidence: collected.observations.slice(0, 3).map((observation) => ({ observationId: observation.id, excerpt: observation.rawText.slice(0, 200) }))
    });

    return [
      {
        id: "presentation",
        title: "1. Présentation de l'étude",
        paragraphs: [
          `Thème : ${collected.study.subject || collected.study.title}.`,
          `Objectif : ${collected.study.description || "objectif non renseigné dans la fiche d'étude"}.`,
          `Corpus : ${statistics.totalObservations} observation(s), période ${formatDate(statistics.periodStart)} - ${formatDate(statistics.periodEnd)}, ${statistics.participants.length || 1} participant(s) ou personne(s) repérée(s).`
        ],
        claims: [presentationClaim]
      },
      {
        id: "summary",
        title: "2. Résumé général",
        paragraphs: [
          statistics.totalObservations
            ? `L'étude montre principalement ${dominantPhenomena || "des phénomènes encore peu stabilisés"}. Les dimensions les plus présentes sont ${dominantDimensions || "insuffisamment renseignées"}.`
            : "Aucune observation n'est encore disponible ; aucune conclusion empirique ne peut être formulée.",
          bundle.reflexiveClaims[0]?.text ?? "Aucune tendance réflexive dominante ne peut encore être isolée.",
          "Les éléments ci-dessous distinguent les faits observés, les tendances statistiques, les interprétations et les hypothèses afin de ne pas transformer une piste en certitude."
        ],
        claims: [presentationClaim, ...bundle.reflexiveClaims.slice(0, 2)]
      },
      {
        id: "statistics",
        title: "3. Analyse statistique",
        paragraphs: [
          `Total des observations : ${statistics.totalObservations}.`,
          statSentence("Dimensions", statistics.dimensions),
          statSentence("Émotions", statistics.emotions),
          statSentence("Comportements", statistics.behaviours),
          statSentence("Concepts", statistics.concepts),
          statSentence("Représentations", statistics.representations),
          statSentence("Transformations", statistics.transformations),
          statSentence("Relations", statistics.relations)
        ],
        claims: statisticClaims(statistics)
      },
      {
        id: "reflexive-analysis",
        title: "4. Analyse réflexive",
        paragraphs: [
          "Cette section recherche les évolutions de reconnaissance, chaînes de transformation et relations entre émotions, comportements, représentations et concepts.",
          bundle.reflexiveClaims.map((item) => item.text).join(" ") || "Aucune chaîne réflexive n'est suffisamment documentée.",
          "Les facteurs favorables ou bloquants restent des interprétations tant que les observations ne documentent pas explicitement une transformation durable."
        ],
        claims: bundle.reflexiveClaims
      },
      {
        id: "theory-comparison",
        title: "5. Vérification de la Théorie de la Réflexivité Universelle",
        paragraphs: [
          "La comparaison recherche des éléments de soutien, de nuance, d'atypie ou de contradiction sans forcer la validation de la théorie.",
          bundle.theoryClaims.map((item) => item.text).join(" ")
        ],
        claims: bundle.theoryClaims
      },
      {
        id: "hypotheses",
        title: "6. Hypothèses émergentes",
        paragraphs: [
          "Les hypothèses suivantes sont proposées comme pistes de recherche, pas comme conclusions établies.",
          bundle.hypotheses.map((item) => item.text).join(" ")
        ],
        claims: bundle.hypotheses
      },
      {
        id: "limits",
        title: "7. Limites de l'étude",
        paragraphs: [
          "Cette partie est obligatoire afin d'indiquer ce que les données ne permettent pas encore d'établir.",
          bundle.limits.map((item) => item.text).join(" ")
        ],
        claims: bundle.limits
      },
      {
        id: "confidence",
        title: "8. Niveau de confiance",
        paragraphs: [`Niveau global : ${bundle.confidence.overall}. ${bundle.confidence.justification}`],
        claims: [
          claim({
            kind: "interpretation proposee",
            text: `Le niveau de confiance global de cette synthèse est ${bundle.confidence.overall}.`,
            confidence: bundle.confidence.overall,
            justification: bundle.confidence.justification,
            evidence: collected.observations.slice(0, 3).map((observation) => ({ observationId: observation.id, excerpt: observation.rawText.slice(0, 200) }))
          })
        ]
      },
      {
        id: "research",
        title: "9. Pistes de recherche",
        paragraphs: researchTracks(bundle),
        claims: []
      }
    ];
  }
}

function listLabels(items: StudySynthesisStatisticItem[]) {
  return items.slice(0, 4).map((item) => `${item.label} (${item.count})`).join(", ");
}

function statSentence(title: string, items: StudySynthesisStatisticItem[]) {
  return `${title} : ${items.length ? listLabels(items) : "aucune donnée suffisante"}.`;
}

function statisticClaims(statistics: AnalysisBundle["statistics"]): StudySynthesisClaim[] {
  return [
    ...statistics.dimensions.slice(0, 3).map((item) => claim({
      kind: "tendance statistique" as const,
      text: `La dimension "${item.label}" apparaît dans ${item.count} observation(s).`,
      confidence: item.count >= 3 ? "Élevé" as const : "Moyen" as const,
      justification: "Fréquence calculée automatiquement à partir des dimensions extraites des observations.",
      evidence: item.evidence
    })),
    ...statistics.emotions.slice(0, 2).map((item) => claim({
      kind: "tendance statistique" as const,
      text: `L'émotion "${item.label}" fait partie des émotions les plus fréquentes.`,
      confidence: item.count >= 3 ? "Élevé" as const : "Moyen" as const,
      justification: "Fréquence calculée à partir des émotions détectées dans les observations.",
      evidence: item.evidence
    }))
  ];
}

function researchTracks(bundle: AnalysisBundle) {
  const tracks = [
    "Compléter les observations qui ne contiennent pas encore de formulation directe de reconnaissance.",
    "Documenter la durée des transformations pour distinguer changement ponctuel et stabilisation.",
    "Créer une étude dédiée aux hypothèses émergentes les plus récurrentes.",
    "Vérifier les contradictions ou observations atypiques par de nouvelles sources indépendantes."
  ];
  if (!bundle.statistics.emotions.length) tracks.push("Approfondir la dimension émotionnelle, actuellement trop peu renseignée.");
  if (!bundle.statistics.relations.length) tracks.push("Documenter plus précisément les relations observées entre personnes, concepts et comportements.");
  return tracks;
}
