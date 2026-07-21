import type { GlobalObservedEvent, GlobalReflexiveAnalysis, GlobalTraceableClaim } from "../types";
import { GLOBAL_OBSERVATORY_VERSION, stableId, unique } from "./utils";

const mechanismKeywords = [
  { label: "Reconnaissance institutionnelle", terms: ["institution", "etat", "gouvernement", "onu", "oms", "unesco", "loi"] },
  { label: "Reconnaissance collective", terms: ["population", "collectif", "societe", "manifestation", "communaute"] },
  { label: "Conflit de representation", terms: ["tension", "conflit", "identite", "legitimite", "frontiere", "representation"] },
  { label: "Integration ou separation", terms: ["integration", "accueil", "exclusion", "separation", "deplacement", "migration"] },
  { label: "Transformation des pratiques", terms: ["cadre", "reforme", "adoption", "usage", "recommandation", "education"] }
];

export class ReflexiveAnalyzer {
  static analyze(event: GlobalObservedEvent, now = new Date().toISOString()): GlobalReflexiveAnalysis {
    const corpus = `${event.title} ${event.summary} ${event.sources.map((source) => source.summary).join(" ")}`.toLowerCase();
    const mechanisms = mechanismKeywords
      .filter((item) => item.terms.some((term) => corpus.includes(term)))
      .map((item) => item.label);
    const recognitionMechanisms = mechanisms.length ? unique(mechanisms) : ["Mecanisme de reconnaissance a verifier"];
    const dimensions = unique([...event.categories, ...recognitionMechanisms]).slice(0, 8);
    const claims = this.claimsFor(event, recognitionMechanisms);

    return {
      eventId: event.id,
      summary: event.summary,
      observedPhenomenon: `Phenomenon observable: ${event.title}. Il doit etre traite comme un cas empirique possible, pas comme une conclusion theorique.`,
      stakes: "L'interet tient a la possibilite d'observer des formes de reconnaissance, de legitimation, de conflit de representation ou de transformation des pratiques.",
      recognitionMechanisms,
      observableDimensions: dimensions,
      researchQuestions: [
        "Quels mecanismes de reconnaissance sont visibles dans les sources disponibles ?",
        "Quels conflits de representation apparaissent entre acteurs, institutions ou groupes ?",
        "Quels processus d'integration ou de separation peuvent etre observes dans le temps ?",
        "Quelles formulations directes restent a collecter pour distinguer fait, interpretation et hypothese ?"
      ],
      hypotheses: recognitionMechanisms.map((mechanism) =>
        `Hypothese: cet evenement pourrait rendre observable un processus de ${mechanism.toLowerCase()}.`
      ),
      similarStudySearch: `Rechercher des etudes anterieures sur: ${unique([...event.categories, ...event.themes]).join(", ")}.`,
      uncertainElements: [
        "Les mecanismes proposes restent des hypotheses tant que les observations directes ne sont pas validees.",
        "La similarite avec des etudes existantes doit etre verifiee dans une base bibliographique.",
        "Les extraits collectes peuvent etre incomplets selon les connecteurs actives."
      ],
      sourceAgreement: {
        confirmedByMultipleSources: event.sources.length > 1 ? [event.title] : [],
        singleSourceOnly: event.sources.length === 1 ? [event.title] : [],
        contested: [],
        unknown: [
          "Existence d'etudes similaires non verifiee automatiquement.",
          "Positions des acteurs non citees directement lorsque les extraits RSS ne les contiennent pas."
        ]
      },
      claims,
      generatedAt: now,
      engineVersion: GLOBAL_OBSERVATORY_VERSION
    };
  }

  private static claimsFor(event: GlobalObservedEvent, mechanisms: string[]): GlobalTraceableClaim[] {
    const firstSource = event.sources[0];
    const firstExcerpt = firstSource?.excerpts[0];
    return [
      {
        id: stableId("claim", `${event.id}-summary`),
        text: event.summary,
        status: "fait rapporté",
        sourceIds: event.sourceIds,
        excerptIds: event.sources.flatMap((source) => source.excerpts.map((excerpt) => excerpt.id)),
        confidence: Math.min(0.9, 0.45 + event.sources.length * 0.12)
      },
      {
        id: stableId("claim", `${event.id}-mechanisms`),
        text: `Mecanismes possibles: ${mechanisms.join(", ")}.`,
        status: "hypothèse",
        sourceIds: firstSource ? [firstSource.id] : [],
        excerptIds: firstExcerpt ? [firstExcerpt.id] : [],
        confidence: 0.58
      },
      {
        id: stableId("claim", `${event.id}-limits`),
        text: "Analyse produite comme aide a l'observation; aucune causalite n'est etablie.",
        status: "limite",
        sourceIds: event.sourceIds,
        excerptIds: [],
        confidence: 1
      }
    ];
  }
}
