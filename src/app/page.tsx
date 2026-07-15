"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  Copy,
  Download,
  GitCompare,
  GitBranch,
  Home,
  Import,
  Microscope,
  Network,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  TrendingUp,
  Trash2
} from "lucide-react";
import { ReflexiveMap } from "@/components/reflexive-map";
import { Badge, Field, Panel, StatCard, Textarea } from "@/components/ui";
import { useObservatory } from "@/lib/use-observatory";
import {
  buildAnalysis,
  buildDashboard,
  buildTimeline,
  compareStates,
  exportStudy
} from "@/lib/analytics";
import type { AppView, Study, TransitionStage } from "@/lib/types";
import { RecognitionCharts } from "@/components/recognition-charts";
import { DeltaEngine } from "@/lib/engines/DeltaEngine";
import { ReflexivityDashboardEngine } from "@/lib/engines/ReflexivityDashboardEngine";
import { StateDifferenceEngine } from "@/lib/engines/StateDifferenceEngine";

const views: Array<{ id: AppView; label: string; icon: React.ElementType }> = [
  { id: "dashboard", label: "Tableau de bord", icon: Home },
  { id: "studies", label: "Études", icon: BookOpen },
  { id: "states", label: "États", icon: Brain },
  { id: "transitions", label: "Transitions Δ", icon: GitBranch },
  { id: "state-comparison", label: "Comparaison d'états", icon: GitCompare },
  { id: "understanding-evolution", label: "Evolution d'une compréhension", icon: TrendingUp },
  { id: "reflexivity-engine", label: "Moteur de Réflexivité", icon: Microscope },
  { id: "map", label: "Carte réflexive", icon: Network },
  { id: "emotions", label: "Émotions", icon: Activity },
  { id: "catalysts", label: "Catalyseurs", icon: Sparkles },
  { id: "recognitions", label: "Reconnaissances", icon: Search },
  { id: "timeline", label: "Chronologie", icon: CalendarDays },
  { id: "analysis", label: "Analyse", icon: BarChart3 }
];

const discernmentQuestions = [
  "S'agit-il d'un fait ou d'une interprétation ?",
  "La relation est-elle observée ou seulement supposée ?",
  "Existe-t-il une confirmation indépendante ?",
  "Existe-t-il une explication plus simple ?",
  "Le changement est-il durable ?",
  "La personne concernée a-t-elle formulé elle-même cette reconnaissance ?",
  "La reconnaissance transforme-t-elle réellement le langage ou l'action ?"
];

const transitionStages: TransitionStage[] = [
  "État initial",
  "Perturbation",
  "Recherche",
  "Nouvelle relation",
  "Reconnaissance",
  "Transformation",
  "Stabilisation",
  "Transmission"
];

export default function ObservatoryApp() {
  const {
    data,
    selectedStudyId,
    selectedStudy,
    selectStudy,
    createStudy,
    updateStudy,
    deleteStudy,
    duplicateStudy,
    resetDemoData,
    importJson,
    exportAll,
    updateMap
  } = useObservatory();
  const [view, setView] = useState<AppView>("dashboard");
  const [query, setQuery] = useState("");
  const dashboard = useMemo(() => buildDashboard(data), [data]);
  const analysis = useMemo(() => buildAnalysis(data), [data]);
  const reflexivityDashboard = useMemo(() => ReflexivityDashboardEngine.build(data), [data]);
  const timeline = useMemo(() => buildTimeline(selectedStudy), [selectedStudy]);

  const studies = data.studies.filter((study) =>
    `${study.title} ${study.subject} ${study.description}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className="min-h-screen px-4 py-4 text-stone-100 md:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1500px] gap-4 lg:grid-cols-[280px_1fr_320px]">
        <aside className="glass sticky top-4 z-20 h-fit rounded-lg p-4">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.28em] text-goldSoft/80">Instrument local</p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight text-white">
              Observatoire de la Reconnaissance
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-300">
              Observer le chemin Δ de la compréhension sans le confondre avec une preuve de vérité.
            </p>
          </div>
          <nav className="grid gap-1" aria-label="Navigation principale">
            {views.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                    view === item.id
                      ? "bg-gold/18 text-goldSoft"
                      : "text-stone-300 hover:bg-white/7 hover:text-white"
                  }`}
                  onClick={() => setView(item.id)}
                >
                  <Icon aria-hidden className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-5 grid gap-2">
            <button className="flex items-center justify-center gap-2 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-night" onClick={createStudy}>
              <Plus className="h-4 w-4" aria-hidden /> Nouvelle étude
            </button>
            <button className="flex items-center justify-center gap-2 rounded-md border border-gold/30 px-3 py-2 text-sm text-goldSoft" onClick={exportAll}>
              <Download className="h-4 w-4" aria-hidden /> Export global
            </button>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200">
              <Import className="h-4 w-4" aria-hidden /> Import JSON
              <input
                className="sr-only"
                type="file"
                accept="application/json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importJson(file);
                  event.target.value = "";
                }}
              />
            </label>
            <button className="flex items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={resetDemoData}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Réinitialiser la démo
            </button>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="glass mb-4 rounded-lg p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-goldSoft/80">Chemin observable Δ</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">{views.find((item) => item.id === view)?.label}</h2>
              </div>
              <div className="flex max-w-md items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                <Search className="h-4 w-4 text-stone-400" aria-hidden />
                <input
                  aria-label="Filtrer les études"
                  className="w-full bg-transparent text-sm text-white placeholder:text-stone-500 focus:outline-none"
                  placeholder="Filtrer les études, sujets, observations..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
          </header>

          {view === "dashboard" && <Dashboard dashboard={dashboard} studies={studies} selectStudy={selectStudy} setView={setView} />}
          {view === "studies" && (
            <Studies
              studies={studies}
              selectedStudyId={selectedStudyId}
              selectStudy={selectStudy}
              updateStudy={updateStudy}
              deleteStudy={deleteStudy}
              duplicateStudy={duplicateStudy}
            />
          )}
          {view === "states" && <States study={selectedStudy} />}
          {view === "transitions" && <Transitions study={selectedStudy} />}
          {view === "state-comparison" && <StateComparison study={selectedStudy} />}
          {view === "understanding-evolution" && <UnderstandingEvolution study={selectedStudy} />}
          {view === "reflexivity-engine" && <ReflexivityEngineDashboard dashboard={reflexivityDashboard} />}
          {view === "map" && selectedStudy && <ReflexiveMap study={selectedStudy} onChange={updateMap} />}
          {view === "emotions" && <Emotions study={selectedStudy} />}
          {view === "catalysts" && <Catalysts study={selectedStudy} />}
          {view === "recognitions" && <Recognitions study={selectedStudy} />}
          {view === "timeline" && <Timeline events={timeline} />}
          {view === "analysis" && <Analysis analysis={analysis} />}
        </section>

        <aside className="glass h-fit rounded-lg p-4 lg:sticky lg:top-4">
          <div className="mb-4 flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-goldSoft" aria-hidden />
            <div>
              <h2 className="font-semibold text-white">Mode discernement</h2>
              <p className="mt-1 text-sm leading-6 text-stone-300">
                Panneau permanent pour distinguer observation, hypothèse et confirmation.
              </p>
            </div>
          </div>
          <ul className="grid gap-2">
            {discernmentQuestions.map((question) => (
              <li key={question} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-5 text-stone-200">
                {question}
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-md border border-gold/25 bg-gold/10 p-3 text-sm leading-6 text-goldSoft">
            Les émotions sont des indicateurs de transition, pas des preuves de vérité.
          </div>
        </aside>
      </div>
    </main>
  );
}

function Dashboard({
  dashboard,
  studies,
  selectStudy,
  setView
}: {
  dashboard: ReturnType<typeof buildDashboard>;
  studies: Study[];
  selectStudy: (id: string) => void;
  setView: (view: AppView) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {dashboard.stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Catalyseurs fréquents">
          <RankedList items={dashboard.topCatalysts} empty="Aucun catalyseur documenté." />
        </Panel>
        <Panel title="Émotions fréquentes">
          <RankedList items={dashboard.topEmotions} empty="Aucune émotion documentée." />
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Dernières observations">
          <div className="grid gap-2">
            {dashboard.latestEvents.map((event) => (
              <div key={event.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{event.title}</p>
                  <Badge>{event.kind}</Badge>
                </div>
                <p className="mt-1 text-sm text-stone-400">{event.date}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Études récentes">
          <div className="grid gap-2">
            {studies.map((study) => (
              <button
                key={study.id}
                className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-gold/40"
                onClick={() => {
                  selectStudy(study.id);
                  setView("studies");
                }}
              >
                <p className="font-medium text-white">{study.title}</p>
                <p className="mt-1 text-sm text-stone-400">{study.subject} · {study.status}</p>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Studies(props: {
  studies: Study[];
  selectedStudyId: string;
  selectStudy: (id: string) => void;
  updateStudy: (study: Study) => void;
  deleteStudy: (id: string) => void;
  duplicateStudy: (id: string) => void;
}) {
  const selected = props.studies.find((study) => study.id === props.selectedStudyId) ?? props.studies[0];
  return (
    <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
      <Panel title="Liste des études">
        <div className="grid gap-2">
          {props.studies.map((study) => (
            <button
              key={study.id}
              onClick={() => props.selectStudy(study.id)}
              className={`rounded-md border p-3 text-left transition ${
                study.id === props.selectedStudyId ? "border-gold/60 bg-gold/10" : "border-white/10 bg-white/[0.04] hover:border-gold/30"
              }`}
            >
              <p className="font-medium text-white">{study.title}</p>
              <p className="mt-1 text-sm text-stone-400">{study.subject}</p>
            </button>
          ))}
        </div>
      </Panel>
      {selected && (
        <Panel title="Fiche d'étude">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Titre" value={selected.title} onChange={(title) => props.updateStudy({ ...selected, title })} />
            <Field label="Sujet observé" value={selected.subject} onChange={(subject) => props.updateStudy({ ...selected, subject })} />
            <Field label="Date de début" type="date" value={selected.startDate} onChange={(startDate) => props.updateStudy({ ...selected, startDate })} />
            <Field label="Statut" value={selected.status} onChange={(status) => props.updateStudy({ ...selected, status })} />
            <Field label="Niveau actuel" value={selected.currentLevel} onChange={(currentLevel) => props.updateStudy({ ...selected, currentLevel })} />
          </div>
          <div className="mt-3 grid gap-3">
            <Textarea label="Description" value={selected.description} onChange={(description) => props.updateStudy({ ...selected, description })} />
            <Textarea label="Notes" value={selected.notes} onChange={(notes) => props.updateStudy({ ...selected, notes })} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="rounded-md bg-gold px-3 py-2 text-sm font-semibold text-night" onClick={() => props.updateStudy({ ...selected, updatedAt: new Date().toISOString() })}>
              <Save className="mr-2 inline h-4 w-4" aria-hidden /> Sauvegarder
            </button>
            <button className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={() => props.duplicateStudy(selected.id)}>
              <Copy className="mr-2 inline h-4 w-4" aria-hidden /> Dupliquer
            </button>
            <button className="rounded-md border border-white/10 px-3 py-2 text-sm text-stone-200" onClick={() => exportStudy(selected)}>
              <Download className="mr-2 inline h-4 w-4" aria-hidden /> Export JSON
            </button>
            <button className="rounded-md border border-red-400/30 px-3 py-2 text-sm text-red-200" onClick={() => props.deleteStudy(selected.id)}>
              <Trash2 className="mr-2 inline h-4 w-4" aria-hidden /> Supprimer
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}

function States({ study }: { study?: Study }) {
  if (!study) return <EmptyState />;
  const comparison = compareStates(study.states[0], study.states[study.states.length - 1]);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {study.states.map((state) => (
          <Panel key={state.id} title={state.title}>
            <p className="text-sm text-stone-400">{state.date}</p>
            <p className="mt-3 leading-7 text-stone-100">{state.formulation}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatCard label="Stabilité" value={`${state.stability}/10`} />
              <StatCard label="Confiance" value={`${state.confidence}/10`} />
            </div>
            <TagBlock title="Confirmés" items={state.confirmedElements} />
            <TagBlock title="Incertains" items={state.uncertainElements} />
            <TagBlock title="Langage" items={state.language} />
            <TagBlock title="Décisions / comportements" items={state.associatedBehaviors} />
          </Panel>
        ))}
      </div>
      <Panel title="Comparaison avant / après">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <TagBlock title="Changé" items={comparison.changed} />
          <TagBlock title="Apparu" items={comparison.appeared} />
          <TagBlock title="Disparu" items={comparison.disappeared} />
          <TagBlock title="Reformulé" items={comparison.reformulated} />
          <TagBlock title="Reste incertain" items={comparison.uncertain} />
        </div>
      </Panel>
    </div>
  );
}

function StateComparison({ study }: { study?: Study }) {
  const sortedStates = useMemo(() => study?.states.slice().sort((a, b) => a.date.localeCompare(b.date)) ?? [], [study]);
  const [fromStateId, setFromStateId] = useState("");
  const [toStateId, setToStateId] = useState("");
  if (!study || sortedStates.length < 2) return <EmptyState />;

  const fromState = sortedStates.find((state) => state.id === fromStateId) ?? sortedStates[0];
  const toState = sortedStates.find((state) => state.id === toStateId) ?? sortedStates[sortedStates.length - 1];
  const difference = StateDifferenceEngine.compare(fromState, toState);
  const delta = DeltaEngine.calculate(difference);

  return (
    <div className="grid gap-4">
      <Panel title="Choix des Ã©tats">
        <div className="grid gap-3 md:grid-cols-2">
          <StateSelect label="Etat A" states={sortedStates} value={fromState.id} onChange={setFromStateId} />
          <StateSelect label="Etat B" states={sortedStates} value={toState.id} onChange={setToStateId} />
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[1fr_120px_1fr]">
        <StateSnapshot title="Etat A" state={fromState} />
        <div className="glass flex items-center justify-center rounded-lg p-4 text-3xl text-goldSoft">â†’</div>
        <StateSnapshot title="Etat B" state={toState} />
      </div>
      <Panel title="DiffÃ©rences dÃ©tectÃ©es">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <StatCard label="DiffÃ©rences" value={difference.totalDifferences} />
          <StatCard label="CatÃ©gories" value={difference.categoriesConcerned.length} />
          <StatCard label="StabilitÃ©" value={difference.stabilityLevel} />
          <StatCard label="Temps entre Ã©tats" value={difference.timeBetweenDays === null ? "non calculable" : `${difference.timeBetweenDays} jours`} />
        </div>
        <div className="grid gap-2">
          {difference.items.map((item) => (
            <div key={item.id} className={`rounded-md border p-3 ${differenceColor(item.kind)}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-white">{item.label}</p>
                <Badge>{item.category}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-200">{item.detail}</p>
              {item.before || item.after ? (
                <p className="mt-2 text-xs text-stone-400">
                  {item.before ? `Avant : ${item.before}` : ""} {item.after ? `AprÃ¨s : ${item.after}` : ""}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
      <DeltaPanel delta={delta} />
    </div>
  );
}

function UnderstandingEvolution({ study }: { study?: Study }) {
  if (!study || study.states.length < 2) return <EmptyState />;
  const states = study.states.slice().sort((a, b) => a.date.localeCompare(b.date));
  const transitions = states.slice(1).map((state, index) => {
    const difference = StateDifferenceEngine.compare(states[index], state);
    return { before: states[index], after: state, difference, delta: DeltaEngine.calculate(difference) };
  });

  return (
    <div className="grid gap-4">
      {transitions.map((transition) => (
        <Panel key={`${transition.before.id}-${transition.after.id}`} title={`${transition.before.title} â†’ ${transition.after.title}`}>
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Î”(S) brut" value={transition.delta.score} />
            <StatCard label="DiffÃ©rences" value={transition.difference.totalDifferences} />
            <StatCard label="StabilitÃ©" value={transition.difference.stabilityLevel} />
            <StatCard label="DurÃ©e" value={transition.difference.timeBetweenDays === null ? "non calculable" : `${transition.difference.timeBetweenDays} jours`} />
          </div>
          <div className="mt-4 grid gap-2">
            {transition.delta.limits.map((limit) => (
              <div key={limit} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-stone-300">
                {limit}
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function ReflexivityEngineDashboard({ dashboard }: { dashboard: ReturnType<typeof ReflexivityDashboardEngine.build> }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Î” moyen" value={dashboard.averageDelta ?? "indicateurs insuffisants"} />
        <StatCard label="Temps moyen entre Ã©tats" value={dashboard.averageDaysBetweenStates === null ? "indicateurs insuffisants" : `${dashboard.averageDaysBetweenStates} jours`} />
        <StatCard label="Temps avant stabilisation" value={dashboard.averageDaysBeforeStabilization === null ? "indicateurs insuffisants" : `${dashboard.averageDaysBeforeStabilization} jours`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Concepts et vocabulaire nouveaux">
          <TagBlock title="Concepts nouveaux" items={dashboard.newConcepts} />
          <TagBlock title="Vocabulaire nouveau" items={dashboard.newVocabulary.slice(0, 18)} />
        </Panel>
        <Panel title="Relations et transmissions">
          <TagBlock title="Relations nouvelles" items={dashboard.newRelations} />
          <TagBlock title="Transmissions" items={dashboard.transmissions} />
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Ã‰motions frÃ©quentes">
          <RankedList items={dashboard.frequentEmotions} empty="Indicateurs insuffisants." />
        </Panel>
        <Panel title="Catalyseurs selon observations">
          <div className="grid gap-2">
            {dashboard.frequentCatalysts.map((catalyst) => (
              <div key={catalyst.name} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{catalyst.name}</p>
                  <Badge>{catalyst.influenceScore}</Badge>
                </div>
                <p className="mt-2 text-sm text-stone-400">{catalyst.limits[0]}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Limites du calcul">
        <div className="grid gap-2">
          {dashboard.limits.map((limit) => (
            <div key={limit} className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-stone-300">
              {limit}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Transitions({ study }: { study?: Study }) {
  if (!study) return <EmptyState />;
  return (
    <div className="grid gap-4">
      {study.transitions.map((transition) => (
        <Panel key={transition.id} title={transition.title}>
          <div className="grid gap-3 lg:grid-cols-3">
            <StatCard label="Durée de maturation" value={transition.maturationDuration} />
            <StatCard label="Confirmation" value={`${transition.confirmationLevel}/3`} />
            <StatCard label="Transmission" value={transition.transmissionCapacity} />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {transitionStages.map((stage) => (
              <div key={stage} className="rounded-md border border-gold/20 bg-gold/8 p-3 text-sm text-goldSoft">
                {stage}
              </div>
            ))}
          </div>
          <p className="mt-4 leading-7 text-stone-100">{transition.recognitionWording}</p>
          <TagBlock title="Manifestations déclenchantes" items={transition.triggeringManifestations} />
          <TagBlock title="Relations nouvelles" items={transition.newRelations} />
          <TagBlock title="Émotions" items={transition.emotions} />
          <TagBlock title="Catalyseurs" items={transition.catalysts} />
          <TagBlock title="Impact observable" items={[transition.observableImpact]} />
        </Panel>
      ))}
    </div>
  );
}

function Emotions({ study }: { study?: Study }) {
  if (!study) return <EmptyState />;
  return (
    <div className="grid gap-4">
      <Panel title="Suivi temporel">
        <RecognitionCharts study={study} mode="emotions" />
      </Panel>
      <Panel title="Observations émotionnelles">
        <div className="grid gap-3 md:grid-cols-2">
          {study.emotionObservations.map((emotion) => (
            <div key={emotion.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">{emotion.emotion}</p>
                <Badge>{emotion.intensity}/10</Badge>
              </div>
              <p className="mt-2 text-sm text-stone-300">{emotion.context}</p>
              <p className="mt-2 text-xs text-stone-500">{emotion.date} · {emotion.duration}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Catalysts({ study }: { study?: Study }) {
  if (!study) return <EmptyState />;
  return (
    <Panel title="Bibliothèque des catalyseurs / ponts">
      <div className="grid gap-3 md:grid-cols-2">
        {study.catalysts.map((catalyst) => (
          <div key={catalyst.id} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-white">{catalyst.name}</h3>
              <Badge>{catalyst.type}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-stone-300">{catalyst.description}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatCard label="Fréquence" value={catalyst.frequency} />
              <StatCard label="Impact moyen" value={`${catalyst.averageImpact}/10`} />
              <StatCard label="Confirmation" value={`${catalyst.confirmationLevel}/3`} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Recognitions({ study }: { study?: Study }) {
  if (!study) return <EmptyState />;
  return (
    <div className="grid gap-4">
      <Panel title="Reconnaissances">
        <div className="grid gap-3">
          {study.recognitions.map((recognition) => (
            <div key={recognition.id} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-white">{recognition.title}</h3>
                <div className="flex gap-2">
                  <Badge>Niveau {recognition.confirmationLevel}</Badge>
                  <Badge>{recognition.transmissible ? "Transmissible" : "Non transmissible"}</Badge>
                </div>
              </div>
              <p className="mt-3 leading-7 text-stone-100">{recognition.exactWording}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <TagBlock title="Déclencheurs" items={recognition.triggers} />
                <TagBlock title="Relations reconnues" items={recognition.newRecognizedRelations} />
                <TagBlock title="Impact langage" items={[recognition.languageImpact]} />
                <TagBlock title="Impact décisions" items={[recognition.decisionImpact]} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Distribution">
        <RecognitionCharts study={study} mode="recognitions" />
      </Panel>
    </div>
  );
}

function Timeline({ events }: { events: ReturnType<typeof buildTimeline> }) {
  return (
    <Panel title="Chronologie par étude">
      <div className="grid gap-3">
        {events.map((event) => (
          <div key={event.id} className={`rounded-md border p-4 ${event.inDeltaPath ? "border-gold/45 bg-gold/10" : "border-white/10 bg-white/[0.04]"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-white">{event.title}</p>
              <Badge>{event.kind}</Badge>
            </div>
            <p className="mt-1 text-sm text-stone-400">{event.date}</p>
            <p className="mt-2 text-sm leading-6 text-stone-300">{event.summary}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Analysis({ analysis }: { analysis: ReturnType<typeof buildAnalysis> }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {analysis.metrics.map((metric) => (
          <StatCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} />
        ))}
      </div>
      <Panel title="Hypothèses locales">
        <div className="grid gap-3">
          {analysis.insights.map((insight) => (
            <div key={insight} className="rounded-md border border-white/10 bg-white/[0.04] p-3 leading-6 text-stone-200">
              {insight}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Relations récurrentes">
        <RankedList items={analysis.recurrentRelations} empty="Les données sont insuffisantes pour conclure." />
      </Panel>
    </div>
  );
}

function StateSelect({
  label,
  states,
  value,
  onChange
}: {
  label: string;
  states: Study["states"];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-stone-200">{label}</span>
      <select
        className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {states.map((state) => (
          <option className="bg-ink" key={state.id} value={state.id}>
            {state.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function StateSnapshot({ title, state }: { title: string; state: Study["states"][number] }) {
  return (
    <Panel title={title}>
      <p className="text-sm text-stone-400">{state.date}</p>
      <h3 className="mt-2 font-semibold text-white">{state.title}</h3>
      <p className="mt-3 text-sm leading-6 text-stone-200">{state.formulation || "Indicateurs insuffisants"}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <StatCard label="StabilitÃ©" value={`${state.stability}/10`} />
        <StatCard label="Confiance" value={`${state.confidence}/10`} />
      </div>
    </Panel>
  );
}

function DeltaPanel({ delta }: { delta: ReturnType<typeof DeltaEngine.calculate> }) {
  return (
    <Panel title="Î”(S) - calcul transparent">
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <StatCard label="Score brut" value={delta.score} />
        <StatCard label="Facteurs positifs" value={delta.positiveFactors.length} />
        <StatCard label="Facteurs nÃ©gatifs" value={delta.negativeFactors.length} />
        <StatCard label="Facteurs neutres" value={delta.neutralFactors.length} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <FactorList title="Facteurs positifs" factors={delta.positiveFactors} />
        <FactorList title="Facteurs nÃ©gatifs" factors={delta.negativeFactors} />
        <FactorList title="Facteurs neutres" factors={delta.neutralFactors} />
      </div>
      <TagBlock title="Limites" items={delta.limits} />
    </Panel>
  );
}

function FactorList({ title, factors }: { title: string; factors: ReturnType<typeof DeltaEngine.calculate>["positiveFactors"] }) {
  return (
    <div>
      <h4 className="text-xs uppercase tracking-[0.18em] text-stone-500">{title}</h4>
      <div className="mt-2 grid gap-2">
        {factors.length ? (
          factors.map((factor) => (
            <div key={`${factor.label}-${factor.value}`} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">{factor.label}</p>
                <Badge>{factor.value}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-400">{factor.reason}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-stone-500">Non renseignÃ©</p>
        )}
      </div>
    </div>
  );
}

function differenceColor(kind: string) {
  if (kind === "addition") return "border-emerald-400/35 bg-emerald-400/10";
  if (kind === "probable-reformulation") return "border-orange-400/35 bg-orange-400/10";
  if (kind === "removal" || kind === "potential-contradiction") return "border-red-400/35 bg-red-400/10";
  if (kind === "stabilization") return "border-sky-400/35 bg-sky-400/10";
  return "border-white/10 bg-white/[0.04]";
}

function RankedList({ items, empty }: { items: Array<{ label: string; value: number | string }>; empty: string }) {
  if (!items.length) return <p className="text-sm text-stone-400">{empty}</p>;
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
          <span className="text-sm text-stone-200">{item.label}</span>
          <Badge>{item.value}</Badge>
        </div>
      ))}
    </div>
  );
}

function TagBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <h4 className="text-xs uppercase tracking-[0.18em] text-stone-500">{title}</h4>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.length ? items.map((item) => <Badge key={item}>{item}</Badge>) : <span className="text-sm text-stone-500">Non renseigné</span>}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Panel title="Aucune étude sélectionnée">
      <p className="text-stone-300">Créez ou sélectionnez une étude pour documenter le chemin observable Δ.</p>
    </Panel>
  );
}
