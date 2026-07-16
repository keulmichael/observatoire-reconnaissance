"use client";

import { Save } from "lucide-react";
import { Badge, Panel } from "@/components/ui";
import type { ObservationAnalysisDraft, Study } from "@/lib/types";
import { ObservationQuestions } from "./ObservationQuestions";
import { ObservationSummary } from "./ObservationSummary";
import { ObservationTimeline } from "./ObservationTimeline";
import { ObservationValidation } from "./ObservationValidation";

export function ObservationAnalysis({
  draft,
  studies,
  targetStudyId,
  targetStudySearch,
  onTargetStudyChange,
  onTargetStudySearchChange,
  onChange,
  onValidate
}: {
  draft: ObservationAnalysisDraft;
  studies: Study[];
  targetStudyId: string | "new";
  targetStudySearch: string;
  onTargetStudyChange: (value: string | "new") => void;
  onTargetStudySearchChange: (value: string) => void;
  onChange: (draft: ObservationAnalysisDraft) => void;
  onValidate: () => void;
}) {
  return (
    <div className="grid gap-4">
      <ObservationSummary rawText={draft.rawText} />
      <DetectedPanel draft={draft} />
      <ObservationValidation draft={draft} onChange={onChange} />
      <ObservationQuestions questions={draft.confirmationQuestions} />
      <StudyTargetSelector
        draft={draft}
        studies={studies}
        value={targetStudyId}
        search={targetStudySearch}
        onChange={onTargetStudyChange}
        onSearchChange={onTargetStudySearchChange}
      />
      <div className="glass rounded-lg p-4">
        <button className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-night" onClick={onValidate}>
          <Save className="h-4 w-4" aria-hidden />
          Valider et intégrer à une étude
        </button>
      </div>
    </div>
  );
}

function StudyTargetSelector({
  draft,
  studies,
  value,
  search,
  onChange,
  onSearchChange
}: {
  draft: ObservationAnalysisDraft;
  studies: Study[];
  value: string | "new";
  search: string;
  onChange: (value: string | "new") => void;
  onSearchChange: (value: string) => void;
}) {
  const suggestions = suggestStudies(draft, studies);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredStudies = studies.filter((study) =>
    `${study.title} ${study.subject} ${study.description}`.toLowerCase().includes(normalizedSearch)
  );

  return (
    <Panel title="Étude cible">
      <div className="grid gap-4">
        {suggestions.length ? (
          <div>
            <h3 className="mb-2 text-xs uppercase tracking-[0.18em] text-stone-500">Études suggérées</h3>
            <div className="grid gap-2">
              {suggestions.map((study) => (
                <StudyChoice key={study.id} study={study} selected={value === study.id} suggested onSelect={() => onChange(study.id)} />
              ))}
            </div>
          </div>
        ) : null}

        <label className="grid gap-2">
          <span className="text-sm font-medium text-stone-200">Recherche</span>
          <input
            className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-stone-500"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher une étude existante"
          />
        </label>

        <div className="grid gap-2">
          <button
            className={`rounded-md border p-3 text-left transition ${
              value === "new" ? "border-gold/60 bg-gold/10" : "border-white/10 bg-white/[0.04] hover:border-gold/30"
            }`}
            onClick={() => onChange("new")}
          >
            <p className="font-medium text-white">Créer une nouvelle étude</p>
            <p className="mt-1 text-sm text-stone-400">Conserver le comportement actuel.</p>
          </button>
          {filteredStudies.map((study) => (
            <StudyChoice key={study.id} study={study} selected={value === study.id} onSelect={() => onChange(study.id)} />
          ))}
        </div>
      </div>
    </Panel>
  );
}

function StudyChoice({
  study,
  selected,
  suggested = false,
  onSelect
}: {
  study: Study;
  selected: boolean;
  suggested?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`rounded-md border p-3 text-left transition ${
        selected ? "border-gold/60 bg-gold/10" : "border-white/10 bg-white/[0.04] hover:border-gold/30"
      }`}
      onClick={onSelect}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-white">{study.title}</p>
        {suggested ? <Badge>Suggestion</Badge> : null}
      </div>
      <p className="mt-1 text-sm text-stone-400">{study.subject}</p>
    </button>
  );
}

function suggestStudies(draft: ObservationAnalysisDraft, studies: Study[]) {
  const terms = [
    ...draft.detectedPeople.map((person) => person.label),
    ...draft.detectedConcepts.map((concept) => concept.label)
  ]
    .map((term) => term.toLowerCase())
    .filter(Boolean);

  return studies.filter((study) => {
    const studyText = [
      study.title,
      study.subject,
      study.description,
      ...study.states.flatMap((state) => [...state.confirmedElements, ...state.uncertainElements, ...state.language]),
      ...study.catalysts.map((catalyst) => catalyst.name),
      ...study.manifestations.map((manifestation) => manifestation.description)
    ].join(" ").toLowerCase();
    return terms.some((term) => studyText.includes(term));
  });
}

function DetectedPanel({ draft }: { draft: ObservationAnalysisDraft }) {
  return (
    <Panel title="Ce que l'application a detecte">
      <div className="grid gap-4">
        <EmotionDetectionPanel draft={draft} />
        <div className="grid gap-3 md:grid-cols-2">
          <DetectedList title="Personnes detectees" items={draft.detectedPeople.map((item) => item.label)} />
          <DetectedList title="Manifestations detectees" items={draft.detectedManifestations.map((item) => item.label)} />
          <DetectedList title="Catalyseurs proposes" items={draft.detectedCatalysts.map((item) => item.label)} />
          <DetectedList title="Concepts detectes" items={draft.detectedConcepts.map((item) => item.label)} />
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

function EmotionDetectionPanel({ draft }: { draft: ObservationAnalysisDraft }) {
  return (
    <div>
      <h3 className="mb-2 text-xs uppercase tracking-[0.18em] text-stone-500">Emotions ou etats detectes</h3>
      {draft.detectedEmotions.length ? (
        <div className="grid gap-2">
          {draft.detectedEmotions.map((emotion) => (
            <div key={emotion.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-white">{emotion.originalExpression ?? emotion.label}</p>
                <Badge>{emotion.canonicalEmotion ?? emotion.emotion}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge>{emotion.scope ?? "indeterminate"}</Badge>
                <Badge>{emotion.polarity ?? "present"}</Badge>
                <Badge>{Math.round(emotion.confidence * 100)} %</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-300">{emotion.sourceExcerpt}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-stone-400">
          Aucune emotion explicite detectee dans ce texte.
        </p>
      )}
    </div>
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

