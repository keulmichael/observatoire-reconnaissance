import type {
  CanonicalDimension,
  ObservationRecord,
  Study,
  StudySynthesisClaim,
  StudySynthesisConfidenceLevel,
  StudySynthesisEvidence,
  StudySynthesisSection,
  StudySynthesisStatistics
} from "@/lib/types";

export type SynthesisModel = "StudySynthesisEngine:deterministic-v1";

export interface CollectedStudyData {
  study: Study;
  observations: ObservationRecord[];
  generatedAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  participants: string[];
}

export interface AnalysisBundle {
  collected: CollectedStudyData;
  statistics: StudySynthesisStatistics;
  reflexiveClaims: StudySynthesisClaim[];
  theoryClaims: StudySynthesisClaim[];
  hypotheses: StudySynthesisClaim[];
  limits: StudySynthesisClaim[];
  confidence: {
    overall: StudySynthesisConfidenceLevel;
    justification: string;
  };
}

export interface BuiltReport {
  sections: StudySynthesisSection[];
  markdown: string;
}

export type CountBucket = Record<string, { count: number; observationIds: Set<string>; evidence: StudySynthesisEvidence[] }>;

export const synthesisModel: SynthesisModel = "StudySynthesisEngine:deterministic-v1";

export const dimensionLabels: Record<CanonicalDimension, string> = {
  Emotion: "Emotion",
  Attitude: "Attitude",
  Representation: "Représentation",
  Behaviour: "Comportement",
  Relation: "Relation",
  Concept: "Concept",
  LanguageMarker: "Marqueur de langage",
  Manifestation: "Manifestation",
  Decision: "Décision",
  Transmission: "Transmission",
  Metadata: "Métadonnée"
};
