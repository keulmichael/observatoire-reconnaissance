import type { Study, StudySynthesis, StudySynthesisClaim } from "@/lib/types";
import { DataCollector } from "./DataCollector";
import { StatisticsAnalyzer } from "./StatisticsAnalyzer";
import { ReflexiveAnalyzer } from "./ReflexiveAnalyzer";
import { TheoryComparator } from "./TheoryComparator";
import { HypothesisGenerator } from "./HypothesisGenerator";
import { ConfidenceEvaluator } from "./ConfidenceEvaluator";
import { NarrativeWriter } from "./NarrativeWriter";
import { ReportBuilder } from "./ReportBuilder";
import { claim, evidenceFromObservation, hash } from "./utils";
import { synthesisModel } from "./types";

export class StudySynthesisEngine {
  private readonly collector = new DataCollector();
  private readonly statisticsAnalyzer = new StatisticsAnalyzer();
  private readonly reflexiveAnalyzer = new ReflexiveAnalyzer();
  private readonly theoryComparator = new TheoryComparator();
  private readonly hypothesisGenerator = new HypothesisGenerator();
  private readonly confidenceEvaluator = new ConfidenceEvaluator();
  private readonly narrativeWriter = new NarrativeWriter();
  private readonly reportBuilder = new ReportBuilder();

  generate(study: Study): StudySynthesis {
    const startedAt = performanceNow();
    const generatedAt = new Date().toISOString();
    const collected = this.collector.collect(study, generatedAt);
    const statistics = this.statisticsAnalyzer.analyze(collected);
    const reflexiveClaims = this.reflexiveAnalyzer.analyze(collected);
    const theoryClaims = this.theoryComparator.compare(collected);
    const hypotheses = this.hypothesisGenerator.generate(collected);
    const limits = buildLimits(collected);
    const confidence = this.confidenceEvaluator.evaluate(collected, [...reflexiveClaims, ...theoryClaims, ...hypotheses]);
    const bundle = { collected, statistics, reflexiveClaims, theoryClaims, hypotheses, limits, confidence };
    const sections = this.narrativeWriter.write(bundle);
    const report = this.reportBuilder.build(bundle, sections);
    const nextVersion = (study.studySyntheses ?? []).length + 1;
    return {
      id: `synthesis-${hash(`${study.id}-${generatedAt}-${nextVersion}`)}`,
      studyId: study.id,
      version: nextVersion,
      generatedAt,
      model: synthesisModel,
      observationsAnalyzed: statistics.totalObservations,
      analysisDurationMs: Math.max(1, Math.round(performanceNow() - startedAt)),
      statistics,
      sections: report.sections,
      markdown: report.markdown
    };
  }
}

function buildLimits(collected: ReturnType<DataCollector["collect"]>): StudySynthesisClaim[] {
  const observations = collected.observations;
  const limits: StudySynthesisClaim[] = [];
  if (observations.length < 3) {
    limits.push(claim({
      kind: "limite",
      text: "Le nombre d'observations est insuffisant pour établir des tendances robustes.",
      confidence: "Très élevé",
      justification: "Moins de trois observations ne permettent pas de comparer des régularités.",
      evidence: observations.map(evidenceFromObservation)
    }));
  }
  if (!collected.study.recognitions.length) {
    limits.push(claim({
      kind: "limite",
      text: "Aucune reconnaissance validée n'est enregistrée dans l'étude.",
      confidence: "Élevé",
      justification: "Le tableau des reconnaissances de l'étude est vide.",
      evidence: observations.slice(0, 3).map(evidenceFromObservation)
    }));
  }
  if (!collected.study.transitions.length) {
    limits.push(claim({
      kind: "limite",
      text: "Aucune transition validée ne permet encore d'établir une chaîne de transformation complète.",
      confidence: "Élevé",
      justification: "Le tableau des transitions de l'étude est vide.",
      evidence: observations.slice(0, 3).map(evidenceFromObservation)
    }));
  }
  const contradictionEvidence = observations.filter((observation) => /contrad|incoher|pourtant|mais/i.test(observation.rawText));
  if (contradictionEvidence.length) {
    limits.push(claim({
      kind: "limite",
      text: "Certaines observations contiennent des tensions ou contradictions à vérifier.",
      confidence: "Moyen",
      justification: "Des marqueurs textuels signalent une possible contradiction, mais une validation humaine reste nécessaire.",
      evidence: contradictionEvidence.slice(0, 4).map(evidenceFromObservation)
    }));
  }
  return limits.length ? limits : [
    claim({
      kind: "limite",
      text: "Les limites principales concernent la diversité des sources, la confirmation indépendante et la stabilité temporelle.",
      confidence: "Moyen",
      justification: "Ces limites restent méthodologiques même lorsque le corpus contient plusieurs observations.",
      evidence: observations.slice(0, 3).map(evidenceFromObservation)
    })
  ];
}

function performanceNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}
