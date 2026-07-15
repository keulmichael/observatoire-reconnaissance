import type { ObservatoryData, Study } from "./types";

const now = new Date().toISOString();

export const demoStudy: Study = {
  id: "study-demo-discussion",
  title: "Étude fictive : évolution d'une compréhension après une discussion",
  description:
    "Parcours de démonstration explicitement fictif montrant comment une idée nouvelle devient progressivement reformulable.",
  subject: "Compréhension d'une idée nouvelle lors d'un échange fictif",
  startDate: "2026-01-10",
  status: "en observation",
  currentLevel: "S2 stabilisé provisoirement",
  notes:
    "Données fictives. L'étude illustre un instrument d'observation, pas une preuve de vérité.",
  states: [
    {
      id: "state-s0",
      title: "S0 · confusion initiale",
      date: "2026-01-10",
      formulation: "L'idée est perçue comme intéressante mais difficile à relier aux repères existants.",
      stability: 3,
      confidence: 4,
      confirmedElements: ["présence d'une question ouverte", "difficulté à reformuler"],
      uncertainElements: ["relation exacte avec les pratiques existantes", "portée du changement"],
      language: ["je ne vois pas encore", "c'est peut-être lié"],
      associatedBehaviors: ["prise de notes", "demande d'exemple"]
    },
    {
      id: "state-s1",
      title: "S1 · relation émergente",
      date: "2026-01-12",
      formulation: "Une relation possible apparaît entre l'idée nouvelle et une situation déjà observée.",
      stability: 5,
      confidence: 6,
      confirmedElements: ["analogie reformulée", "exemple retrouvé"],
      uncertainElements: ["généralisation", "durabilité de l'effet"],
      language: ["cela rejoint", "je peux le relier à"],
      associatedBehaviors: ["comparaison", "discussion avec un pair fictif"]
    },
    {
      id: "state-s2",
      title: "S2 · reformulation transmissible",
      date: "2026-01-20",
      formulation:
        "La compréhension devient transmissible sous forme d'une distinction entre observation et interprétation.",
      stability: 7,
      confidence: 7,
      confirmedElements: ["reformulation claire", "usage dans une décision simple"],
      uncertainElements: ["confirmation indépendante", "stabilité au long cours"],
      language: ["je distingue le fait de l'hypothèse", "la relation reste à confirmer"],
      associatedBehaviors: ["mise à jour d'une méthode de travail", "transmission prudente"]
    }
  ],
  manifestations: [
    {
      id: "manifestation-1",
      title: "Présentation d'une nouvelle idée",
      date: "2026-01-10",
      description: "L'idée est introduite pendant une discussion fictive.",
      evidenceLevel: 1
    },
    {
      id: "manifestation-2",
      title: "Questionnement répété",
      date: "2026-01-12",
      description: "Plusieurs questions reviennent autour d'une relation possible.",
      evidenceLevel: 1
    }
  ],
  transitions: [
    {
      id: "transition-delta-1",
      title: "Δ1 · confusion vers relation émergente",
      fromStateId: "state-s0",
      toStateId: "state-s1",
      triggeringManifestations: ["Présentation d'une nouvelle idée", "Questionnement répété"],
      newRelations: ["idée nouvelle ↔ situation déjà vécue"],
      emotions: ["curiosité", "incertitude"],
      catalysts: ["discussion fictive", "exemple concret"],
      maturationDuration: "2 jours",
      recognitionWording: "Je reconnais une relation possible avec une situation que j'avais séparée.",
      confirmationLevel: 2,
      observableImpact: "Le langage passe de la confusion à une hypothèse relationnelle prudente.",
      transmissionCapacity: "partielle",
      date: "2026-01-12"
    },
    {
      id: "transition-delta-2",
      title: "Δ2 · relation émergente vers reformulation",
      fromStateId: "state-s1",
      toStateId: "state-s2",
      triggeringManifestations: ["Reformulation écrite", "Test dans une décision simple"],
      newRelations: ["observation ↔ interprétation", "reconnaissance ↔ transformation du langage"],
      emotions: ["apaisement", "clarté"],
      catalysts: ["prise de notes", "retour d'un pair fictif"],
      maturationDuration: "8 jours",
      recognitionWording:
        "Je reconnais que la transformation observable porte d'abord sur la manière de formuler.",
      confirmationLevel: 2,
      observableImpact: "Une décision est décrite avec des hypothèses séparées des faits.",
      transmissionCapacity: "oui, avec précautions",
      date: "2026-01-20"
    }
  ],
  recognitions: [
    {
      id: "recognition-1",
      title: "Relation possible reconnue",
      date: "2026-01-12",
      studyId: "study-demo-discussion",
      exactWording: "Je reconnais une relation possible avec une situation que j'avais séparée.",
      author: "Sujet fictif",
      beforeStateId: "state-s0",
      afterStateId: "state-s1",
      triggers: ["exemple concret", "questionnement"],
      newRecognizedRelations: ["idée nouvelle ↔ situation déjà vécue"],
      emotions: ["curiosité", "incertitude"],
      catalysts: ["discussion fictive"],
      languageImpact: "Apparition de formulations relationnelles prudentes.",
      decisionImpact: "Décision de vérifier l'hypothèse avant de conclure.",
      relationImpact: "Dialogue plus précis sur les termes utilisés.",
      projectImpact: "Ajout d'une note de méthode.",
      transmissible: true,
      confirmed: false,
      stableOverTime: false,
      confirmationLevel: 2
    },
    {
      id: "recognition-2",
      title: "Distinction faits / hypothèses",
      date: "2026-01-20",
      studyId: "study-demo-discussion",
      exactWording: "Je distingue désormais le fait observé de l'interprétation que j'en propose.",
      author: "Sujet fictif",
      beforeStateId: "state-s1",
      afterStateId: "state-s2",
      triggers: ["reformulation écrite", "retour prudent"],
      newRecognizedRelations: ["observation ↔ interprétation"],
      emotions: ["clarté", "apaisement"],
      catalysts: ["prise de notes"],
      languageImpact: "Usage explicite de fait, hypothèse et confirmation.",
      decisionImpact: "La décision est retardée jusqu'à obtenir un élément supplémentaire.",
      relationImpact: "La discussion devient moins affirmative.",
      projectImpact: "Création d'un protocole de notes.",
      transmissible: true,
      confirmed: true,
      stableOverTime: true,
      confirmationLevel: 3
    }
  ],
  catalysts: [
    {
      id: "catalyst-1",
      name: "Discussion fictive",
      type: "rencontre",
      description: "Échange de démonstration entre deux personnes fictives.",
      context: "Conversation exploratoire",
      linkedStudies: ["study-demo-discussion"],
      linkedTransitions: ["transition-delta-1"],
      frequency: 2,
      averageImpact: 7,
      confirmationLevel: 2
    },
    {
      id: "catalyst-2",
      name: "Prise de notes",
      type: "texte",
      description: "Support écrit permettant de comparer les formulations.",
      context: "Journal d'observation",
      linkedStudies: ["study-demo-discussion"],
      linkedTransitions: ["transition-delta-2"],
      frequency: 3,
      averageImpact: 8,
      confirmationLevel: 2
    }
  ],
  emotionObservations: [
    {
      id: "emotion-1",
      emotion: "incertitude",
      intensity: 7,
      date: "2026-01-10",
      context: "Première exposition à l'idée",
      transitionId: "transition-delta-1",
      duration: "quelques heures",
      comment: "Indicateur de perturbation, non preuve."
    },
    {
      id: "emotion-2",
      emotion: "curiosité",
      intensity: 8,
      date: "2026-01-12",
      context: "Recherche d'une relation possible",
      transitionId: "transition-delta-1",
      duration: "2 jours",
      comment: "La curiosité accompagne l'exploration."
    },
    {
      id: "emotion-3",
      emotion: "clarté",
      intensity: 7,
      date: "2026-01-20",
      context: "Reformulation stabilisée",
      transitionId: "transition-delta-2",
      duration: "durable sur la semaine",
      comment: "À confirmer dans le temps."
    }
  ],
  relations: [
    {
      id: "relation-1",
      source: "manifestation-1",
      target: "recognition-1",
      type: "déclenche",
      strength: 6,
      date: "2026-01-12",
      evidenceLevel: 2,
      note: "Relation possible, formulée prudemment.",
      status: "supposée"
    },
    {
      id: "relation-2",
      source: "catalyst-2",
      target: "recognition-2",
      type: "soutient",
      strength: 8,
      date: "2026-01-20",
      evidenceLevel: 2,
      note: "La trace écrite facilite la comparaison.",
      status: "observée"
    }
  ],
  timeline: [
    {
      id: "timeline-1",
      kind: "manifestation",
      title: "Présentation d'une nouvelle idée",
      date: "2026-01-10",
      summary: "Une idée nouvelle est introduite dans l'étude fictive.",
      inDeltaPath: true
    },
    {
      id: "timeline-2",
      kind: "émotion",
      title: "Incertitude initiale",
      date: "2026-01-10",
      summary: "L'incertitude signale une transition possible.",
      inDeltaPath: true
    },
    {
      id: "timeline-3",
      kind: "transition",
      title: "Δ1",
      date: "2026-01-12",
      summary: "Une relation possible apparaît entre deux éléments auparavant séparés.",
      inDeltaPath: true
    },
    {
      id: "timeline-4",
      kind: "reconnaissance",
      title: "Distinction faits / hypothèses",
      date: "2026-01-20",
      summary: "La compréhension devient reformulable et transmissible avec prudence.",
      inDeltaPath: true
    }
  ],
  map: {
    nodes: [
      { id: "manifestation-1", position: { x: 40, y: 80 }, data: { label: "Nouvelle idée", kind: "manifestation" } },
      { id: "emotion-1", position: { x: 260, y: 30 }, data: { label: "Incertitude", kind: "émotion" } },
      { id: "catalyst-2", position: { x: 260, y: 170 }, data: { label: "Prise de notes", kind: "catalyseur" } },
      { id: "recognition-2", position: { x: 520, y: 90 }, data: { label: "Distinction fait / hypothèse", kind: "reconnaissance" } },
      { id: "state-s2", position: { x: 760, y: 90 }, data: { label: "S2 reformulation", kind: "état" } }
    ],
    edges: [
      { id: "edge-1", source: "manifestation-1", target: "emotion-1", label: "perturbe" },
      { id: "edge-2", source: "emotion-1", target: "catalyst-2", label: "ouvre" },
      { id: "edge-3", source: "catalyst-2", target: "recognition-2", label: "soutient" },
      { id: "edge-4", source: "recognition-2", target: "state-s2", label: "stabilise" }
    ]
  },
  history: ["Création de l'étude fictive", "Ajout de deux transitions Δ"],
  createdAt: now,
  updatedAt: now
};

export const demoData: ObservatoryData = {
  version: 1,
  studies: [demoStudy]
};
