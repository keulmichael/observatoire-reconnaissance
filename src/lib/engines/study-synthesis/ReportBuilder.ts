import type { StudySynthesis, StudySynthesisSection } from "@/lib/types";
import type { AnalysisBundle, BuiltReport } from "./types";

export class ReportBuilder {
  build(bundle: AnalysisBundle, sections: StudySynthesisSection[]): BuiltReport {
    return {
      sections,
      markdown: toMarkdown(bundle, sections)
    };
  }
}

function toMarkdown(bundle: AnalysisBundle, sections: StudySynthesisSection[]) {
  const lines = [
    `# Synthèse d'étude - ${bundle.collected.study.title}`,
    "",
    `- Date de génération : ${bundle.collected.generatedAt}`,
    `- Modèle utilisé : StudySynthesisEngine:deterministic-v1`,
    `- Observations analysées : ${bundle.statistics.totalObservations}`,
    "",
    ...sections.flatMap(sectionToMarkdown)
  ];
  return lines.join("\n");
}

function sectionToMarkdown(section: StudySynthesisSection) {
  return [
    `## ${section.title}`,
    "",
    ...section.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...(section.claims.length
      ? [
          "### Conclusions tracées",
          "",
          ...section.claims.flatMap((claim) => [
            `- **${claim.kind}** - ${claim.text}`,
            `  - Confiance : ${claim.confidence}`,
            `  - Justification : ${claim.justification}`,
            `  - Sources : ${claim.evidence.length ? claim.evidence.map((item) => `${item.observationId}: ${item.excerpt}`).join(" ; ") : "aucune observation directe suffisante"}`,
            ""
          ])
        ]
      : [])
  ];
}

export function synthesisFilename(synthesis: StudySynthesis, extension: "md" | "html") {
  return `synthese-etude-v${synthesis.version}-${synthesis.generatedAt.slice(0, 10)}.${extension}`;
}
