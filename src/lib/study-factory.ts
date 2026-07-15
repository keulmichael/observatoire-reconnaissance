import type { Study } from "./types";

export function createEmptyStudy(createdAt = new Date().toISOString(), id = `study-${crypto.randomUUID()}`): Study {
  return {
    id,
    title: "Nouvelle etude d'observation",
    description: "Decrire le parcours d'observation.",
    subject: "Sujet a documenter",
    startDate: createdAt.slice(0, 10),
    status: "Observation ouverte",
    currentLevel: "Observation ouverte",
    notes: "",
    states: [],
    manifestations: [],
    transitions: [],
    recognitions: [],
    catalysts: [],
    emotionObservations: [],
    relations: [],
    timeline: [],
    map: { nodes: [], edges: [] },
    history: ["Creation de l'etude"],
    observations: [],
    openQuestions: [],
    structuredHistory: [],
    relationProposals: [],
    deltaScores: [],
    createdAt,
    updatedAt: createdAt
  };
}
