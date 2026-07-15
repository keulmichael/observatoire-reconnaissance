import type { ObservatoryData, Study, UnderstandingState } from "@/lib/types";

export const stableStateA: UnderstandingState = {
  id: "state-stable-a",
  title: "Etat stable A",
  date: "2026-01-01",
  formulation: "La relation est documentee comme hypothese.",
  stability: 6,
  confidence: 6,
  confirmedElements: ["relation documentee", "fait distingue de l'hypothese"],
  uncertainElements: ["portee du changement"],
  language: ["hypothese prudente", "observation locale"],
  associatedBehaviors: ["prise de notes"]
};

export const stableStateB: UnderstandingState = {
  ...stableStateA,
  id: "state-stable-b",
  date: "2026-01-03"
};

export const conceptAddedState: UnderstandingState = {
  ...stableStateA,
  id: "state-concept-added",
  date: "2026-01-05",
  confirmedElements: [...stableStateA.confirmedElements, "transmission prudente"],
  language: [...stableStateA.language, "transmission"]
};

export const conceptRemovedState: UnderstandingState = {
  ...stableStateA,
  id: "state-concept-removed",
  date: "2026-01-05",
  confirmedElements: ["relation documentee"],
  uncertainElements: [],
  language: ["observation locale"]
};

export const reformulatedStateA: UnderstandingState = {
  ...stableStateA,
  id: "state-reformulated-a",
  confirmedElements: ["IA"],
  language: ["IA"]
};

export const reformulatedStateB: UnderstandingState = {
  ...stableStateA,
  id: "state-reformulated-b",
  date: "2026-01-06",
  confirmedElements: ["Intelligence artificielle"],
  language: ["Intelligence artificielle"]
};

export const relationStateA: UnderstandingState = {
  ...stableStateA,
  id: "state-relation-a",
  confirmedElements: ["observation locale"]
};

export const relationStateB: UnderstandingState = {
  ...stableStateA,
  id: "state-relation-b",
  date: "2026-01-04",
  confirmedElements: ["observation locale", "observation ↔ interpretation"]
};

export const contradictionStateA: UnderstandingState = {
  ...stableStateA,
  id: "state-contradiction-a",
  confirmedElements: ["relation stable"]
};

export const contradictionStateB: UnderstandingState = {
  ...stableStateA,
  id: "state-contradiction-b",
  date: "2026-01-04",
  confirmedElements: ["relation non stable"]
};

export const insufficientState: UnderstandingState = {
  id: "state-insufficient",
  title: "Etat incomplet",
  date: "2026-01-02",
  formulation: "",
  stability: 0,
  confidence: 0,
  confirmedElements: [],
  uncertainElements: [],
  language: [],
  associatedBehaviors: []
};

export const fixtureStudy: Study = {
  id: "study-fixture",
  title: "Etude fixture",
  description: "Jeu de donnees deterministe.",
  subject: "Sujet non utilise par les moteurs de trajectoire",
  startDate: "2026-01-01",
  status: "test",
  currentLevel: "S2",
  notes: "",
  states: [stableStateA, conceptAddedState, relationStateB],
  manifestations: [],
  transitions: [
    {
      id: "transition-1",
      title: "Delta 1",
      fromStateId: stableStateA.id,
      toStateId: conceptAddedState.id,
      triggeringManifestations: ["question documentee"],
      newRelations: ["observation ↔ interpretation"],
      emotions: ["confusion", "questionnement", "apaisement"],
      catalysts: ["journal"],
      maturationDuration: "4 jours",
      recognitionWording: "Transformation observee dans le langage.",
      confirmationLevel: 2,
      observableImpact: "Formulation plus prudente.",
      transmissionCapacity: "partielle",
      date: "2026-01-05"
    }
  ],
  recognitions: [],
  catalysts: [
    {
      id: "catalyst-journal",
      name: "journal",
      type: "texte",
      description: "Trace ecrite.",
      context: "Observation",
      linkedStudies: ["study-fixture"],
      linkedTransitions: ["transition-1"],
      frequency: 2,
      averageImpact: 5,
      confirmationLevel: 2
    }
  ],
  emotionObservations: [
    {
      id: "emotion-1",
      emotion: "confusion",
      intensity: 6,
      date: "2026-01-02",
      context: "Etat initial",
      transitionId: "transition-1",
      duration: "1 jour",
      comment: ""
    },
    {
      id: "emotion-2",
      emotion: "questionnement",
      intensity: 5,
      date: "2026-01-03",
      context: "Exploration",
      transitionId: "transition-1",
      duration: "1 jour",
      comment: ""
    },
    {
      id: "emotion-3",
      emotion: "apaisement",
      intensity: 4,
      date: "2026-01-04",
      context: "Reformulation",
      transitionId: "transition-1",
      duration: "1 jour",
      comment: ""
    }
  ],
  relations: [],
  timeline: [],
  map: {
    nodes: [],
    edges: [{ id: "edge-1", source: "state-stable-a", target: "state-concept-added", label: "relation possible" }]
  },
  history: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

export const secondFixtureStudy: Study = {
  ...fixtureStudy,
  id: "study-fixture-2",
  title: "Autre trajectoire fixture",
  subject: "Autre sujet ignore par comparaison",
  catalysts: fixtureStudy.catalysts.map((catalyst) => ({ ...catalyst, linkedStudies: ["study-fixture-2"] }))
};

export const fixtureData: ObservatoryData = {
  version: 1,
  studies: [fixtureStudy, secondFixtureStudy]
};
