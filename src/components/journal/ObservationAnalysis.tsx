"use client";

import { Save } from "lucide-react";
import { Badge, Panel } from "@/components/ui";
import type { ObservationAnalysisDraft } from "@/lib/types";
import { ObservationQuestions } from "./ObservationQuestions";
import { ObservationSummary } from "./ObservationSummary";
import { ObservationTimeline } from "./ObservationTimeline";
import { ObservationValidation } from "./ObservationValidation";

export function ObservationAnalysis({
  draft,
  onChange,
  onValidate
}: {
  draft: ObservationAnalysisDraft;
  onChange: (draft: ObservationAnalysisDraft) => void;
  onValidate: () => void;
}) {
  return (
    <div className="grid gap-4">
      <ObservationSummary rawText={draft.rawText} />
      <DetectedPanel draft={draft} />
      <ObservationValidation draft={draft} onChange={onChange} />
      <ObservationQuestions questions={draft.confirmationQuestions} />
      <div className="glass rounded-lg p-4">
        <button className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-night" onClick={onValidate}>
          <Save className="h-4 w-4" aria-hidden />
          Valider et intégrer à une étude
        </button>
      </div>
    </div>
  );
}

function DetectedPanel({ draft }: { draft: ObservationAnalysisDraft }) {
  return (
    <Panel title="Ce que l'application a détecté">
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <DetectedList title="Personnes détectées" items={draft.detectedPeople.map((item) => item.label)} />
          <DetectedList title="Manifestations détectées" items={draft.detectedManifestations.map((item) => item.label)} />
          <DetectedList title="Émotions détectées" items={draft.detectedEmotions.map((item) => `${item.label} · ${item.expressionKind}`)} />
          <DetectedList title="Catalyseurs proposés" items={draft.detectedCatalysts.map((item) => item.label)} />
          <DetectedList title="Concepts détectés" items={draft.detectedConcepts.map((item) => item.label)} />
          <DetectedList title="Relations possibles" items={draft.relationProposals.map((item) => item.label)} />
        </div>
        <ObservationTimeline entries={draft.chronology} />
        <div className="rounded-md border border-gold/25 bg-gold/10 p-3 text-sm leading-6 text-goldSoft">
          {draft.conclusion}
        </div>
      </div>
    </Panel>
  );
}

function DetectedList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs uppercase tracking-[0.18em] text-stone-500">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.length ? items.map((item) => <Badge key={item}>{item}</Badge>) : <span className="text-sm text-stone-500">Non détecté</span>}
      </div>
    </div>
  );
}
