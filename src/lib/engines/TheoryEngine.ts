import type {
  ObservatoryData,
  ObservationRecord,
  ReciprocalTestimony,
  ReflexiveSignature,
  Study,
  SufferingObservation,
  Theory,
  TheoryAssessment,
  TheoryElement,
  TheoryEvidenceLink,
  TheoryHistoryEntry,
  TheoryPrediction,
  TheoryRevisionProposal,
  TheoryRevisionProposalKind,
  TheoryVersion
} from "@/lib/types";

export const THEORY_ENGINE_VERSION = "TheoryEngine:v1";

const nowSeed = "2026-07-18T00:00:00.000Z";

export const reflexiveCycleSteps = [
  "relation",
  "testimony",
  "solitude",
  "recognition",
  "transformation",
  "new-relation"
] as const;

export function createInitialTheories(createdAt = nowSeed): Theory[] {
  const reflectiveTheory = createTheory({
    id: "theory-reflexive-recognition",
    title: "Theorie de la Reconnaissance Reflexive",
    summary: "Modele prudent reliant relation, temoignage, solitude, reconnaissance et transformation.",
    createdAt,
    linkedTheoryIds: ["theory-reciprocal-recognition"],
    elements: [
      element("axiom-observation", "axiom", "Principe d'observation", "Une affirmation theorique doit rester reliee a des observations tracables.", createdAt),
      element("axiom-reflexivity", "axiom", "Principe de reflexivite", "Une relation peut modifier la maniere dont une conscience se comprend elle-meme.", createdAt),
      element("axiom-testimony", "axiom", "Principe du temoignage", "Un temoignage est un signal relationnel susceptible de soutenir, contredire ou enrichir une reconnaissance.", createdAt),
      element("prop-testimony-function", "proposition", "Reconnaissance et temoignage", "La reconnaissance est fonction du temoignage disponible et interpretable.", createdAt, ["axiom-testimony"]),
      element("prop-rejection-testimony", "proposition", "Rejet comme temoignage", "Le rejet peut constituer un temoignage sans valider automatiquement son interpretation.", createdAt, ["axiom-testimony"]),
      element("prop-suffering-amplifies", "proposition", "Souffrance comme amplification", "La souffrance rapportee peut amplifier le temoignage sans etre la cause premiere de la reconnaissance.", createdAt, ["axiom-observation", "axiom-testimony"]),
      element("prop-solitude-integration", "proposition", "Solitude et integration", "La solitude peut permettre l'integration d'un temoignage recu.", createdAt, ["axiom-reflexivity"]),
      element("prop-reflexive-cycle", "proposition", "Cycle reflexif", "L'evolution repose sur un cycle relation, temoignage, solitude, reconnaissance, transformation, nouvelle relation.", createdAt, ["axiom-reflexivity"]),
      element("prop-reflexivity-reduces-suffering", "proposition", "Reflexivite et souffrance necessaire", "La reflexivite peut reduire la souffrance necessaire aux reconnaissances futures.", createdAt, ["prop-suffering-amplifies"]),
      element("prop-soul-object", "proposition", "Objet de l'ame", "L'objet de l'ame est la reconnaissance plutot que la douleur.", createdAt, ["prop-testimony-function"]),
      element("prop-reflexive-autonomy", "proposition", "Autonomie reflexive", "La finalite est l'autonomie reflexive.", createdAt, ["axiom-reflexivity"]),
      element("theorem-general-cycle", "theorem", "Theoreme general", "Relation -> Temoignage -> Solitude -> Reconnaissance -> Transformation -> Nouvelle relation.", createdAt, ["prop-reflexive-cycle", "prop-testimony-function", "prop-solitude-integration"]),
      element("corollary-universal-consciousness", "corollary", "Corollaire du reseau reciproque", "La Conscience Universelle se reconnait dans le reseau des temoignages reciproques.", createdAt, ["theorem-general-cycle"])
    ]
  });

  const reciprocalPrinciples = [
    "La conscience ne se reconnait jamais seule.",
    "Chaque relation est un miroir.",
    "La reconnaissance est reciproque.",
    "La contradiction possede une valeur superieure a l'approbation.",
    "Le rejet peut etre un temoignage.",
    "Chaque personne possede une signature reflexive.",
    "L'evolution est mesurable.",
    "La souffrance est un amplificateur.",
    "La finalite est la reconnaissance.",
    "La conscience universelle se reconnait dans le reseau des temoignages."
  ];
  const reciprocalTheory = createTheory({
    id: "theory-reciprocal-recognition",
    title: "Theorie Generale de la Reconnaissance Reciproque",
    summary: "Theorie distincte et reliee, composee de dix principes independants.",
    createdAt,
    linkedTheoryIds: ["theory-reflexive-recognition"],
    elements: reciprocalPrinciples.map((statement, index) =>
      element(`reciprocal-principle-${index + 1}`, "principle", `Principe ${index + 1}`, statement, createdAt)
    )
  });

  return [reflectiveTheory, reciprocalTheory];
}

export const TheoryEngine = {
  assess(data: ObservatoryData): TheoryAssessment[] {
    const theories = data.theories ?? [];
    const links = allEvidenceLinks(data);
    return theories.flatMap((theory) =>
      theory.elements.map((elementItem) => assessElement(theory, elementItem, links))
    );
  },

  propose(data: ObservatoryData, createdAt = new Date().toISOString()): TheoryRevisionProposal[] {
    const existing = new Set((data.theoryRevisionProposals ?? []).map((proposal) => proposal.id));
    const proposals = this.assess(data).flatMap((assessment) => proposalsFromAssessment(assessment, createdAt));
    return proposals.filter((proposal) => !existing.has(proposal.id));
  },

  acceptRevisionProposal(
    data: ObservatoryData,
    proposalId: string,
    patch: Partial<Pick<TheoryElement, "statement" | "explanation" | "limitations" | "unresolvedQuestions">> = {},
    author = "Utilisateur",
    acceptedAt = new Date().toISOString()
  ): ObservatoryData {
    const proposal = (data.theoryRevisionProposals ?? []).find((item) => item.id === proposalId);
    if (!proposal) return data;
    const nextTheories = (data.theories ?? []).map((theory) => {
      const target = theory.elements.find((item) => item.id === proposal.theoryElementId);
      if (!target) return theory;
      const versionNumber = theory.versions.length + 1;
      const nextElements = theory.elements.map((elementItem) => {
        if (elementItem.id !== target.id) return elementItem;
        const statement = patch.statement ?? target.statement;
        const explanation = patch.explanation ?? proposedExplanation(target, proposal);
        const history = historyEntry("revision acceptee", target.id, acceptedAt, author, proposal.reasoningSummary, proposal.observationIds, proposal.studyIds);
        return {
          ...elementItem,
          statement,
          explanation,
          version: `${versionNumber}.0`,
          status: proposal.kind === "element-potentiellement-contredit" ? "conteste" : "revise",
          updatedAt: acceptedAt,
          author,
          sourceObservationIds: unique([...elementItem.sourceObservationIds, ...proposal.observationIds]),
          sourceStudyIds: unique([...elementItem.sourceStudyIds, ...proposal.studyIds]),
          supportingEvidenceIds: proposal.kind === "element-potentiellement-soutenu" ? unique([...elementItem.supportingEvidenceIds, proposal.id]) : elementItem.supportingEvidenceIds,
          contradictingEvidenceIds: proposal.kind === "element-potentiellement-contredit" ? unique([...elementItem.contradictingEvidenceIds, proposal.id]) : elementItem.contradictingEvidenceIds,
          enrichingEvidenceIds: proposal.kind === "element-potentiellement-enrichi" ? unique([...elementItem.enrichingEvidenceIds, proposal.id]) : elementItem.enrichingEvidenceIds,
          unresolvedQuestions: patch.unresolvedQuestions ?? unique([...elementItem.unresolvedQuestions, ...proposal.limitations]),
          limitations: patch.limitations ?? unique([...elementItem.limitations, "Revision issue d'une proposition validee par utilisateur."]),
          revisionHistory: [...elementItem.revisionHistory, history]
        } satisfies TheoryElement;
      });
      const version: TheoryVersion = {
        id: `${theory.id}-version-${versionNumber}`,
        theoryId: theory.id,
        version: `${versionNumber}.0`,
        createdAt: acceptedAt,
        author,
        reason: proposal.reasoningSummary,
        observationIds: proposal.observationIds,
        studyIds: proposal.studyIds,
        previousVersionId: theory.currentVersionId,
        elementSnapshots: nextElements.map(snapshotElement)
      };
      return {
        ...theory,
        currentVersionId: version.id,
        elements: nextElements,
        versions: [...theory.versions, version],
        history: [...theory.history, historyEntry("version creee", proposal.theoryElementId, acceptedAt, author, proposal.reasoningSummary, proposal.observationIds, proposal.studyIds)],
        updatedAt: acceptedAt
      };
    });
    return {
      ...data,
      theories: nextTheories,
      theoryRevisionProposals: (data.theoryRevisionProposals ?? []).map((item) =>
        item.id === proposalId ? { ...item, status: "accepted", decidedAt: acceptedAt, decidedBy: author } : item
      )
    };
  },

  setProposalStatus(
    data: ObservatoryData,
    proposalId: string,
    status: TheoryRevisionProposal["status"],
    decidedBy = "Utilisateur",
    decidedAt = new Date().toISOString()
  ): ObservatoryData {
    return {
      ...data,
      theoryRevisionProposals: (data.theoryRevisionProposals ?? []).map((proposal) =>
        proposal.id === proposalId ? { ...proposal, status, decidedAt, decidedBy } : proposal
      )
    };
  },

  createPrediction(
    data: ObservatoryData,
    prediction: Omit<TheoryPrediction, "id" | "createdAt" | "updatedAt" | "status" | "futureObservationIds">,
    createdAt = new Date().toISOString()
  ): ObservatoryData {
    const item: TheoryPrediction = {
      ...prediction,
      id: stableId("prediction", `${prediction.theoryId}-${prediction.formulation}-${createdAt}`),
      createdAt,
      updatedAt: createdAt,
      status: "proposee",
      futureObservationIds: []
    };
    return { ...data, theoryPredictions: [item, ...(data.theoryPredictions ?? [])] };
  },

  linkFutureObservationToPrediction(
    data: ObservatoryData,
    predictionId: string,
    observationId: string,
    linkedAt = new Date().toISOString()
  ): ObservatoryData {
    return {
      ...data,
      theoryPredictions: (data.theoryPredictions ?? []).map((prediction) =>
        prediction.id === predictionId
          ? {
              ...prediction,
              futureObservationIds: unique([...prediction.futureObservationIds, observationId]),
              updatedAt: linkedAt
            }
          : prediction
      )
    };
  },

  buildReflexiveSignatures(data: ObservatoryData): ReflexiveSignature[] {
    const people = new Map<string, { studies: Study[]; observations: ObservationRecord[] }>();
    data.studies.forEach((study) => {
      (study.observations ?? []).forEach((observation) => {
        observation.detectedPeople.forEach((person) => {
          const key = person.label;
          const current = people.get(key) ?? { studies: [], observations: [] };
          current.studies.push(study);
          current.observations.push(observation);
          people.set(key, current);
        });
      });
    });
    return [...people.entries()].map(([personLabel, source]) => descriptiveSignature(personLabel, source.studies, source.observations));
  },

  buildSufferingObservation(observation: ObservationRecord): SufferingObservation {
    const raw = observation.rawText.toLowerCase();
    const sufferingReported = /souffrance|douleur|peine|angoisse|detresse|tristesse|peur|colere/.test(raw);
    const recognitionFormulated = /reconnais|reconnaissance|j'ai compris|compris|comprend/.test(raw);
    return {
      id: stableId("suffering", observation.id),
      observationId: observation.id,
      declaredEmotionalIntensity: observation.detectedEmotions.some((emotion) => emotion.status !== "rejected") ? "emotion documentee" : "non renseignee",
      reportedSuffering: sufferingReported ? "souffrance rapportee dans le texte" : "non renseignee",
      supposedResistance: "non deduite automatiquement",
      receivedTestimony: /temoign|dit|message|rejet|silence|reponse/.test(raw) ? "temoignage possible a valider" : "non renseigne",
      formulatedRecognition: recognitionFormulated ? "reconnaissance ou comprehension formulee" : "non renseignee",
      observableTransformation: /change|transform|desormais|maintenant|nouvelle relation/.test(raw) ? "transformation observable possible" : "non renseignee",
      cautiousSummary: sufferingReported && recognitionFormulated
        ? "Une souffrance rapportee precede cette reconnaissance dans les observations disponibles."
        : "Les donnees sont insuffisantes.",
      limitations: ["Aucune causalite n'est inferee automatiquement."]
    };
  }
};

function createTheory(input: {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  linkedTheoryIds: string[];
  elements: TheoryElement[];
}): Theory {
  const version: TheoryVersion = {
    id: `${input.id}-version-1`,
    theoryId: input.id,
    version: "1.0",
    createdAt: input.createdAt,
    author: "Initialisation systeme",
    reason: "Initialisation prudente de la theorie versionnee.",
    observationIds: [],
    studyIds: [],
    elementSnapshots: input.elements.map(snapshotElement)
  };
  return {
    id: input.id,
    title: input.title,
    summary: input.summary,
    currentVersionId: version.id,
    linkedTheoryIds: input.linkedTheoryIds,
    relationLinks: [],
    elements: input.elements.map((item) => ({ ...item, theoryId: input.id })),
    versions: [version],
    history: [historyEntry("theorie initialisee", input.id, input.createdAt, "Initialisation systeme", input.summary, [], [])],
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  };
}

function element(
  id: string,
  type: TheoryElement["type"],
  title: string,
  statement: string,
  createdAt: string,
  parentElementIds: string[] = []
): TheoryElement {
  return {
    id,
    theoryId: "",
    parentElementIds,
    type,
    title,
    statement,
    explanation: "Formulation initiale a tester par observations et validations utilisateur.",
    version: "1.0",
    status: "formule",
    createdAt,
    updatedAt: createdAt,
    author: "Initialisation systeme",
    confidenceLabel: "insuffisamment documente",
    sourceObservationIds: [],
    sourceStudyIds: [],
    supportingEvidenceIds: [],
    contradictingEvidenceIds: [],
    enrichingEvidenceIds: [],
    unresolvedQuestions: [],
    limitations: ["Aucune observation existante n'est liee automatiquement."],
    revisionHistory: []
  };
}

function assessElement(theory: Theory, elementItem: TheoryElement, links: TheoryEvidenceLink[]): TheoryAssessment {
  const elementLinks = links.filter((link) => link.theoryElementId === elementItem.id && link.theoryId === theory.id);
  const supporting = elementLinks.filter((link) => link.relation === "supports");
  const contradicting = elementLinks.filter((link) => link.relation === "contradicts");
  const enriching = elementLinks.filter((link) => link.relation === "enriches");
  const confidence = confidenceLabel(supporting.length, contradicting.length, elementLinks.length);
  return {
    theoryId: theory.id,
    theoryElementId: elementItem.id,
    observationCount: elementLinks.length,
    confirmations: supporting.length,
    contradictions: contradicting.length,
    enrichments: enriching.length,
    uncertaintyZones: elementLinks.length < 2 ? ["Echantillon insuffisant."] : contradicting.length ? ["Contradictions a examiner."] : [],
    confidenceLabel: confidence,
    openQuestions: unique([...elementItem.unresolvedQuestions, ...elementLinks.flatMap((link) => link.limitations)]),
    cautiousSummary: cautiousSummary(supporting.length, contradicting.length, elementLinks.length),
    evidenceLinks: elementLinks
  };
}

function proposalsFromAssessment(assessment: TheoryAssessment, createdAt: string): TheoryRevisionProposal[] {
  const proposals: TheoryRevisionProposal[] = [];
  if (!assessment.observationCount) {
    proposals.push(proposal("donnees-insuffisantes", assessment, [], createdAt, "Les donnees sont insuffisantes pour evaluer cet element."));
    return proposals;
  }
  if (assessment.confirmations > 0) {
    proposals.push(proposal("element-potentiellement-soutenu", assessment, supportingLinks(assessment), createdAt, "Les observations actuelles soutiennent prudemment cet element."));
  }
  if (assessment.contradictions > 0) {
    proposals.push(proposal("element-potentiellement-contredit", assessment, contradictingLinks(assessment), createdAt, "Les observations actuelles contredisent ou limitent cet element."));
  }
  if (assessment.enrichments > 0) {
    proposals.push(proposal("element-potentiellement-enrichi", assessment, enrichingLinks(assessment), createdAt, "Les observations actuelles enrichissent cet element sans le modifier automatiquement."));
  }
  if (assessment.contradictions > 0 && assessment.confirmations > 0) {
    proposals.push(proposal("proposition-de-revision", assessment, assessment.evidenceLinks, createdAt, "Une revision prudente peut etre examinee car soutiens et contradictions coexistent."));
  }
  return proposals;
}

function proposal(
  kind: TheoryRevisionProposalKind,
  assessment: TheoryAssessment,
  links: TheoryEvidenceLink[],
  createdAt: string,
  reasoningSummary: string
): TheoryRevisionProposal {
  const observationIds = unique(links.map((link) => link.observationId));
  const studyIds = unique(links.map((link) => link.studyId));
  return {
    id: stableId("theory-proposal", `${kind}-${assessment.theoryId}-${assessment.theoryElementId}-${observationIds.join("-")}-${studyIds.join("-")}`),
    kind,
    theoryId: assessment.theoryId,
    theoryElementId: assessment.theoryElementId,
    observationIds,
    studyIds,
    sourceExcerpts: unique(links.flatMap((link) => link.sourceExcerpts)),
    reasoningSummary,
    confidence: confidenceScore(assessment),
    limitations: assessment.uncertaintyZones.length ? assessment.uncertaintyZones : ["Proposition a valider par l'utilisateur."],
    status: "proposed",
    createdAt,
    engineVersion: THEORY_ENGINE_VERSION
  };
}

function allEvidenceLinks(data: ObservatoryData): TheoryEvidenceLink[] {
  return data.studies.flatMap((study) =>
    (study.observations ?? []).flatMap((observation) => observation.theoryEvidenceLinks ?? [])
  );
}

function supportingLinks(assessment: TheoryAssessment) {
  return assessment.evidenceLinks.filter((link) => link.relation === "supports");
}

function contradictingLinks(assessment: TheoryAssessment) {
  return assessment.evidenceLinks.filter((link) => link.relation === "contradicts");
}

function enrichingLinks(assessment: TheoryAssessment) {
  return assessment.evidenceLinks.filter((link) => link.relation === "enriches");
}

function confidenceLabel(supporting: number, contradicting: number, total: number): TheoryElement["confidenceLabel"] {
  if (!total) return "insuffisamment documente";
  if (contradicting > supporting) return "conteste";
  if (supporting >= 2 && contradicting === 0) return "soutenu par certaines observations";
  return "en observation";
}

function confidenceScore(assessment: TheoryAssessment) {
  if (!assessment.observationCount) return 0.1;
  const raw = (assessment.confirmations + assessment.enrichments * 0.5 - assessment.contradictions) / Math.max(assessment.observationCount, 1);
  return Math.max(0.05, Math.min(0.95, Number((0.5 + raw / 2).toFixed(2))));
}

function cautiousSummary(supporting: number, contradicting: number, total: number) {
  if (!total) return "Les donnees sont insuffisantes.";
  if (contradicting > supporting) return "Les observations actuelles contredisent certains aspects.";
  if (supporting > 0) return "Les observations actuelles soutiennent certains aspects.";
  return "Les donnees sont insuffisantes.";
}

function proposedExplanation(target: TheoryElement, proposal: TheoryRevisionProposal) {
  return [
    target.explanation,
    `Revision utilisateur issue de ${proposal.observationIds.length} observation(s).`,
    proposal.reasoningSummary
  ].join(" ");
}

function snapshotElement(elementItem: TheoryElement) {
  return {
    id: elementItem.id,
    type: elementItem.type,
    title: elementItem.title,
    statement: elementItem.statement,
    explanation: elementItem.explanation,
    status: elementItem.status,
    confidenceLabel: elementItem.confidenceLabel,
    sourceObservationIds: elementItem.sourceObservationIds,
    sourceStudyIds: elementItem.sourceStudyIds,
    supportingEvidenceIds: elementItem.supportingEvidenceIds,
    contradictingEvidenceIds: elementItem.contradictingEvidenceIds,
    enrichingEvidenceIds: elementItem.enrichingEvidenceIds
  };
}

function historyEntry(
  action: TheoryHistoryEntry["action"],
  elementId: string,
  date: string,
  author: string,
  summary: string,
  observationIds: string[],
  studyIds: string[]
): TheoryHistoryEntry {
  return {
    id: stableId("theory-history", `${action}-${elementId}-${date}-${summary}`),
    date,
    action,
    elementId,
    author,
    summary,
    observationIds,
    studyIds
  };
}

function descriptiveSignature(personLabel: string, studies: Study[], observations: ObservationRecord[]): ReflexiveSignature {
  const emotions = unique(observations.flatMap((observation) => observation.detectedEmotions.map((emotion) => emotion.canonicalEmotion ?? emotion.label)));
  const concepts = unique(observations.flatMap((observation) => observation.detectedConcepts.map((concept) => concept.label)));
  const responses = unique(observations.flatMap((observation) => observation.detectedRelations.map((relation) => relation.label)));
  return {
    id: stableId("signature", personLabel),
    personLabel,
    studyIds: unique(studies.map((study) => study.id)),
    observationIds: unique(observations.map((observation) => observation.id)),
    testimonyTypes: responses,
    documentedEmotions: emotions,
    recurrentContradictions: concepts.filter((concept) => /contradiction|rejet|opposition|silence/i.test(concept)),
    revealedThemes: concepts,
    responseForms: responses,
    linkedTransformations: unique(observations.flatMap((observation) => observation.generatedTransitionIds)),
    sampleLimitations: observations.length < 3 ? ["Echantillon trop faible pour decrire une recurrence."] : [],
    prohibitedOutputs: ["niveau de conscience", "valeur spirituelle", "compatibilite absolue", "destinee", "diagnostic psychologique"],
    valueScore: null
  };
}

export function buildTheoryEvidenceLink(input: Omit<TheoryEvidenceLink, "id" | "createdAt" | "status">, createdAt = new Date().toISOString()): TheoryEvidenceLink {
  return {
    ...input,
    id: stableId("theory-evidence", `${input.theoryElementId}-${input.observationId}-${input.relation}`),
    status: "validated",
    createdAt
  };
}

export function stableId(prefix: string, value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return `${prefix}-${(result >>> 0).toString(36)}`;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function createReciprocalTestimony(input: Omit<ReciprocalTestimony, "id" | "createdAt" | "updatedAt">, createdAt = new Date().toISOString()): ReciprocalTestimony {
  return {
    ...input,
    id: stableId("reciprocal-testimony", `${input.witnessA}-${input.witnessB}-${input.observationId}-${createdAt}`),
    createdAt,
    updatedAt: createdAt
  };
}
